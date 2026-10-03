import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';

async function loadDetector() {
    const analysis = await readFile(new URL('../js/analysis.js', import.meta.url), 'utf8');
    const hfo = await readFile(new URL('../js/hfo.js', import.meta.url), 'utf8');
    const context = { console };
    context.globalThis = context;
    vm.runInNewContext(`${analysis}\n${hfo}\n;globalThis.EEGHFO = EEGHFO;`, context, { filename: 'js/hfo.js' });
    return context.EEGHFO;
}

function random(seed) {
    let state = seed >>> 0;
    const uniform = () => {
        state = (state + 0x6D2B79F5) >>> 0;
        let t = state;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    return () => {
        const u = Math.max(1e-12, uniform());
        return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * uniform());
    };
}

// background noise plus slow rhythm, with gaussian-windowed bursts at known centres
function synthesize({ sampleRate, seconds, noise, bursts = [], seed = 7, extra = () => 0 }) {
    const gaussian = random(seed);
    const signal = new Float64Array(Math.round(sampleRate * seconds));
    for (let i = 0; i < signal.length; i++) {
        const t = i / sampleRate;
        signal[i] = noise * gaussian() + 20 * Math.sin(2 * Math.PI * 9 * t) + extra(t, i);
    }
    for (const burst of bursts) {
        const sigma = burst.duration / 4;
        const first = Math.max(0, Math.floor((burst.center - 3 * sigma) * sampleRate));
        const last = Math.min(signal.length, Math.ceil((burst.center + 3 * sigma) * sampleRate));
        for (let i = first; i < last; i++) {
            const t = i / sampleRate - burst.center;
            signal[i] += burst.amplitude * Math.exp(-(t * t) / (2 * sigma * sigma)) * Math.sin(2 * Math.PI * burst.frequency * t);
        }
    }
    return signal;
}

const centres = [3.2, 7.9, 12.4, 18.05, 23.6, 29.3, 34.75, 41.1, 47.5, 53.9];

function matchBursts(events, sampleRate, expected, tolerance = 0.06) {
    const found = expected.filter(center => events.some(event => event.start / sampleRate - tolerance <= center && event.end / sampleRate + tolerance >= center));
    const spurious = events.filter(event => !expected.some(center => event.start / sampleRate - tolerance <= center && event.end / sampleRate + tolerance >= center));
    return { found, spurious };
}

test('sampling-rate rules clamp the ripple band at 0.4 x fs and block when too little remains', async () => {
    const hfo = await loadDetector();
    const at256 = hfo.assessSampling(256, 'ripple');
    assert.equal(at256.tone, 'warning');
    assert.equal(at256.limited, true);
    assert.match(at256.headline, /80–102 Hz/);
    assert.match(at256.message, /not ripples/);

    assert.equal(hfo.assessSampling(200, 'ripple').tone, 'blocked');
    assert.equal(hfo.minimumRateFor(80), 250);
    assert.equal(hfo.assessSampling(512, 'ripple').tone, 'warning');
    assert.equal(hfo.assessSampling(700, 'ripple').limited, false);
    assert.equal(hfo.assessSampling(2000, 'ripple').message, '');
    assert.equal(hfo.assessSampling(1000, 'fast_ripple').tone, 'warning');
    assert.equal(hfo.assessSampling(512, 'fast_ripple').tone, 'blocked');
    assert.equal(hfo.usableCeiling(256), 102);
    assert.equal(hfo.hardCeiling(256), 115);
});

test('blockwise Hilbert envelope recovers a sinusoid amplitude across block seams', async () => {
    const hfo = await loadDetector();
    const sampleRate = 1000;
    const signal = new Float64Array(200000);
    for (let i = 0; i < signal.length; i++) signal[i] = 7 * Math.sin(2 * Math.PI * 97 * i / sampleRate);
    const envelope = hfo.hilbertEnvelope(signal);
    let worst = 0;
    for (let i = 2000; i < signal.length - 2000; i += 37) worst = Math.max(worst, Math.abs(envelope[i] - 7));
    assert.ok(worst < 0.15, `envelope error ${worst}`);
});

test('the default detector finds known ripple bursts and little else', async () => {
    const hfo = await loadDetector();
    const sampleRate = 2000;
    const bursts = centres.map((center, index) => ({ center, duration: 0.05, frequency: 110 + index * 8, amplitude: 14 }));
    const signal = synthesize({ sampleRate, seconds: 60, noise: 5, bursts });
    const band = { key: 'ripple', low: 80, high: 250 };
    const result = hfo.detectChannel(signal, sampleRate, { detector: 'zurich', band, params: hfo.defaultParams('zurich', 'scalp') });
    const { found, spurious } = matchBursts(result.events, sampleRate, centres);
    assert.ok(found.length >= 9, `found ${found.length} of ${centres.length}`);
    assert.ok(spurious.length <= 1, `${spurious.length} spurious events`);
    const first = result.events.find(event => Math.abs(event.start / sampleRate - 3.2) < 0.06);
    assert.ok(Math.abs(first.features.peakFrequency - 110) < 12, `peak frequency ${first.features.peakFrequency}`);
    assert.ok(first.features.cycles >= 3);
    assert.ok(result.stats.screening.crossings >= result.events.length);
});

test('a filtered sharp transient is screened out or flagged instead of passing as a ripple', async () => {
    const hfo = await loadDetector();
    const sampleRate = 2000;
    const spikeAt = 20;
    const signal = synthesize({
        sampleRate,
        seconds: 40,
        noise: 5,
        extra: t => {
            const distance = Math.abs(t - spikeAt);
            return distance < 0.004 ? 250 * (1 - distance / 0.004) : 0;
        }
    });
    const band = { key: 'ripple', low: 80, high: 250 };
    const params = { ...hfo.defaultParams('zurich', 'intracranial'), minSnr: 0 };
    const result = hfo.detectChannel(signal, sampleRate, { detector: 'zurich', band, params });
    const atSpike = result.events.filter(event => event.start / sampleRate - 0.1 <= spikeAt && event.end / sampleRate + 0.1 >= spikeAt);
    for (const event of atSpike) assert.ok(event.features.flags.includes('near a sharp transient'), 'transient candidate is not flagged');
    assert.ok(result.stats.screening.spectral + result.stats.screening.duration + result.stats.screening.peaks >= 1 || atSpike.length === 0);
});

test('short-time energy detector reproduces the Staba criteria on the same bursts', async () => {
    const hfo = await loadDetector();
    const sampleRate = 2000;
    const bursts = centres.map(center => ({ center, duration: 0.05, frequency: 140, amplitude: 20 }));
    const signal = synthesize({ sampleRate, seconds: 60, noise: 5, bursts, seed: 11 });
    const result = hfo.detectChannel(signal, sampleRate, { detector: 'ste', band: { key: 'ripple', low: 80, high: 250 }, params: hfo.defaultParams('ste') });
    const { found, spurious } = matchBursts(result.events, sampleRate, centres);
    assert.ok(found.length >= 9, `found ${found.length}`);
    assert.ok(spurious.length <= 2, `${spurious.length} spurious events`);
    assert.equal(result.stats.rmsWindowSamples, 7);
});

test('sub-band scalp detector finds longer low-amplitude bursts at 600 Hz', async () => {
    const hfo = await loadDetector();
    const sampleRate = 600;
    const bursts = centres.map(center => ({ center, duration: 0.12, frequency: 105, amplitude: 9 }));
    const signal = synthesize({ sampleRate, seconds: 60, noise: 2.5, bursts, seed: 5 });
    const band = { key: 'ripple', low: 80, high: hfo.usableCeiling(sampleRate) };
    const result = hfo.detectChannel(signal, sampleRate, { detector: 'ellenrieder', band, params: hfo.defaultParams('ellenrieder') });
    const { found, spurious } = matchBursts(result.events, sampleRate, centres, 0.1);
    assert.ok(found.length >= 8, `found ${found.length}`);
    assert.ok(spurious.length <= 3, `${spurious.length} spurious events`);
});

test('line noise and its aliases inside the band are detected and planned as notches', async () => {
    const hfo = await loadDetector();
    const sampleRate = 256;
    const channels = [0, 1, 2].map(seed => synthesize({
        sampleRate,
        seconds: 60,
        noise: 4,
        seed: seed + 21,
        extra: t => 6 * Math.sin(2 * Math.PI * 60 * t) + 3 * Math.sin(2 * Math.PI * 180 * t + seed)
    }));
    const detection = hfo.detectLineFrequency(channels, sampleRate);
    assert.equal(detection.frequency, 60);
    const notches = hfo.planNotches(60, detection.spectrum, sampleRate, { low: 80, high: 102 });
    assert.deepEqual([...notches.map(item => Math.round(item.frequency))], [76]);
    assert.equal(notches[0].aliased, true);
    assert.equal(hfo.foldFrequency(420, 256), 92);
});

test('a clean recording yields no line frequency rather than a guess', async () => {
    const hfo = await loadDetector();
    const sampleRate = 500;
    const channels = [synthesize({ sampleRate, seconds: 60, noise: 4, seed: 3 })];
    assert.equal(hfo.detectLineFrequency(channels, sampleRate).frequency, null);
});

test('events on most channels at once are flagged as simultaneous', async () => {
    const hfo = await loadDetector();
    const make = (channelIndex, onset) => ({ channelIndex, onset, offset: onset + 0.03, features: { flags: [] } });
    const events = [make(0, 10), make(1, 10.01), make(2, 10.005), make(3, 30)];
    hfo.flagMultichannel(events, 4, 1000);
    assert.ok(events[0].features.flags.some(flag => flag.startsWith('simultaneous on 3')));
    assert.equal(events[3].features.flags.length, 0);
});

test('Hilbert and line-length detectors follow their published thresholds', async () => {
    const hfo = await loadDetector();
    const sampleRate = 2000;
    const bursts = centres.map(center => ({ center, duration: 0.05, frequency: 140, amplitude: 18 }));
    const signal = synthesize({ sampleRate, seconds: 60, noise: 5, bursts, seed: 13 });
    const band = { key: 'ripple', low: 80, high: 250 };

    const hilbert = hfo.detectChannel(signal, sampleRate, { detector: 'hilbert', band, params: hfo.defaultParams('hilbert') });
    assert.ok(matchBursts(hilbert.events, sampleRate, centres).found.length >= 9);
    const threshold = hilbert.stats.thresholds[0].threshold;
    for (const event of hilbert.events) {
        assert.ok((event.end - event.start) / sampleRate * 1000 >= 10);
        assert.equal(event.features.criteria.find(item => item.key === 'duration').pass, true);
    }
    assert.ok(threshold > 0);

    const lineLength = hfo.detectChannel(signal, sampleRate, { detector: 'sll', band, params: hfo.defaultParams('sll') });
    assert.ok(matchBursts(lineLength.events, sampleRate, centres).found.length >= 8);
    assert.equal(lineLength.stats.thresholds.length, Math.round(60 / 180) || 1);
    for (const event of lineLength.events) assert.ok((event.end - event.start) / sampleRate * 1000 >= 12);
});

test('consensus keeps events found by enough detectors and records who agreed', async () => {
    const hfo = await loadDetector();
    const sampleRate = 2000;
    const bursts = centres.map(center => ({ center, duration: 0.05, frequency: 140, amplitude: 18 }));
    const signal = synthesize({ sampleRate, seconds: 60, noise: 5, bursts, seed: 17 });
    const band = { key: 'ripple', low: 80, high: 250 };
    const members = ['zurich', 'ste', 'hilbert'].map(detector => ({ detector, params: hfo.defaultParams(detector, 'intracranial') }));
    const result = hfo.detectChannel(signal, sampleRate, { detector: 'consensus', band, consensus: { members, minAgreement: 2, toleranceMs: 0 } });
    const { found, spurious } = matchBursts(result.events, sampleRate, centres);
    assert.ok(found.length >= 9, `found ${found.length}`);
    assert.ok(spurious.length <= 1, `${spurious.length} spurious`);
    for (const event of result.events) {
        assert.ok(event.features.agreement >= 2);
        assert.equal(event.features.foundBy.length, event.features.agreement);
        assert.ok(Object.keys(event.features.criteriaByDetector).length >= 2);
    }
    for (const item of result.screened) assert.equal(item.stage, 'agreement');
});

test('duplicate and inverted channels are recognised', async () => {
    const hfo = await loadDetector();
    const a = synthesize({ sampleRate: 256, seconds: 30, noise: 10, seed: 1 });
    const b = synthesize({ sampleRate: 256, seconds: 30, noise: 10, seed: 2 });
    const inverted = a.map(value => -value);
    const copy = Float64Array.from(b);
    const duplicates = hfo.findDuplicateChannels([a, b, inverted, copy], 256);
    assert.deepEqual(JSON.parse(JSON.stringify(duplicates.map(item => [item.index, item.of, item.inverted]))), [[2, 0, true], [3, 1, false]]);
});

// sharp biphasic spikes (8 ms peak, slower trailing trough) at the given times
function spikeTrain(times, amplitude = 150) {
    return t => {
        let value = 0;
        for (const centre of times) {
            const d = t - centre;
            if (Math.abs(d) > 0.15) continue;
            value += amplitude * Math.exp(-(d * d) / (2 * 0.008 ** 2)) - amplitude / 3 * Math.exp(-((d - 0.05) ** 2) / (2 * 0.03 ** 2));
        }
        return value;
    };
}

test('MNI and CS detectors find known ripple bursts', async () => {
    const hfo = await loadDetector();
    const sampleRate = 2000;
    const bursts = centres.map(center => ({ center, duration: 0.05, frequency: 140, amplitude: 16 }));
    const signal = synthesize({ sampleRate, seconds: 60, noise: 5, bursts });
    const band = { key: 'ripple', low: 80, high: 250 };
    for (const detector of ['mni', 'cs']) {
        const result = hfo.detectChannel(signal, sampleRate, { detector, band, params: hfo.defaultParams(detector) });
        const { found, spurious } = matchBursts(result.events, sampleRate, centres);
        assert.ok(found.length >= 9, `${detector} found ${found.length}`);
        assert.ok(spurious.length <= 2, `${detector} ${spurious.length} spurious`);
    }
});

test('spike-ripple detection needs the spike as well as the ripple', async () => {
    const hfo = await loadDetector();
    const sampleRate = 2000;
    const bursts = centres.map(center => ({ center, duration: 0.05, frequency: 180, amplitude: 16 }));
    const band = { key: 'ripple', low: 80, high: 250 };
    const params = hfo.defaultParams('spike_ripple');
    const withSpikes = synthesize({ sampleRate, seconds: 60, noise: 5, bursts, extra: spikeTrain(centres.map(center => center + 0.01), 120) });
    const withoutSpikes = synthesize({ sampleRate, seconds: 60, noise: 5, bursts });
    const hits = hfo.detectChannel(withSpikes, sampleRate, { detector: 'spike_ripple', band, params });
    const misses = hfo.detectChannel(withoutSpikes, sampleRate, { detector: 'spike_ripple', band, params });
    assert.ok(matchBursts(hits.events, sampleRate, centres).found.length >= 8);
    assert.ok(misses.events.length <= 1, `${misses.events.length} events without spikes`);
    assert.equal(hfo.detectors.spike_ripple.minSampleRate, 750);
});

test('the spike detector finds sharp transients at clinical sampling rates and ignores plain background', async () => {
    const hfo = await loadDetector();
    const times = [5.3, 11.2, 17.8, 24.4, 31.1, 38.6, 44.9, 52.2];
    for (const sampleRate of [256, 1000]) {
        const signal = synthesize({ sampleRate, seconds: 60, noise: 8, seed: 3, extra: spikeTrain(times) });
        const spikes = hfo.detectSpikes(signal, sampleRate);
        const hit = times.filter(time => spikes.some(spike => Math.abs(spike.time - time) < 0.03));
        assert.equal(hit.length, times.length, `${sampleRate} Hz found ${hit.length}`);
        assert.ok(spikes.length <= times.length + 2, `${sampleRate} Hz ${spikes.length} spikes`);
    }
    const quiet = hfo.detectSpikes(synthesize({ sampleRate: 256, seconds: 60, noise: 8, seed: 3 }), 256);
    assert.ok(quiet.length <= 3, `${quiet.length} spikes in background`);
});

test('classification labels spikes, artifacts, and ripple + fast ripple overlap without removing events', async () => {
    const hfo = await loadDetector();
    const make = (onset, features = {}) => ({ channelIndex: 0, onset, offset: onset + 0.05, features: { peakFrequency: 140, cycles: 6, troughRatio: 0.3, peakRatio: 2, flags: [], ...features } });
    const events = [make(1), make(2), make(3, { flags: ['near a line-noise frequency'] }), make(4, { troughRatio: 0.9, cycles: 2 })];
    hfo.classifyChannelEvents(events, [{ time: 2.03, strength: 2 }], 'intracranial');
    assert.deepEqual(events.map(event => event.features.classification.primary), ['hfo', 'spike_hfo', 'artifact', 'false_ripple']);
    assert.equal(events[1].features.classification.spike.lagMs, 30);
    assert.equal(events[0].features.classification.bandClass, 'ripple');

    const ripple = { ...make(10), band: { key: 'ripple' } };
    const fast = { ...make(10.02, { peakFrequency: 320 }), band: { key: 'fast_ripple' } };
    const alone = { ...make(20), band: { key: 'ripple' } };
    hfo.markRippleFastRipple([ripple, fast, alone]);
    assert.equal(ripple.features.classification.cooccurrence, 'ripple_and_fast_ripple');
    assert.equal(fast.features.classification.cooccurrence, 'ripple_and_fast_ripple');
    assert.equal(alone.features.classification?.cooccurrence, undefined);
});

test('marking comparison scores identical sets as perfect and shifted sets as disjoint', async () => {
    const hfo = await loadDetector();
    const events = centres.map((center, index) => ({ channelIndex: index % 2, onset: center, offset: center + 0.05 }));
    const same = hfo.compareMarkings(events, events, { duration: 60, channels: [0, 1] });
    assert.equal(same.tp, events.length);
    assert.equal(same.f1, 1);
    assert.equal(same.binnedKappa.kappa, 1);
    assert.equal(same.eventKappa.kappa, 1);
    assert.equal(same.channelRho, null);

    const shifted = events.map(event => ({ ...event, onset: event.onset + 0.2, offset: event.offset + 0.2 }));
    const apart = hfo.compareMarkings(events, shifted, { duration: 60, channels: [0, 1] });
    assert.equal(apart.f1, 0);
    assert.equal(apart.fn, events.length);
    assert.equal(apart.fp, events.length);
    assert.ok(apart.binnedKappa.kappa < 0.05);

    // one reference event missing from the comparison and one extra
    const partial = [...events.slice(1), { channelIndex: 1, onset: 58, offset: 58.05 }];
    const result = hfo.compareMarkings(events, partial, { duration: 60, channels: [0, 1] });
    assert.equal(result.tp, events.length - 1);
    assert.equal(result.fn, 1);
    assert.equal(result.fp, 1);
    assert.ok(Math.abs(result.f1 - 0.9) < 1e-12);
    assert.ok(result.sensitivityInterval.low < 0.9 && result.sensitivityInterval.high > 0.9);

    // a long event cannot match two short ones
    const long = [{ channelIndex: 0, onset: 1, offset: 1.3 }];
    const two = [{ channelIndex: 0, onset: 1.05, offset: 1.1 }, { channelIndex: 0, onset: 1.2, offset: 1.25 }];
    assert.equal(hfo.compareMarkings(long, two).tp, 1);
    assert.equal(hfo.compareMarkings(long, two, { rule: 'iou' }).tp, 0);
});

test('gamma quantiles match known chi-square values', async () => {
    const hfo = await loadDetector();
    // chi-square with 4 degrees of freedom is gamma(k = 2, theta = 2); its 95th percentile is 9.487729
    assert.ok(Math.abs(hfo.gamma.quantile(0.95, { k: 2, theta: 2 }) - 9.487729) < 1e-5);
    assert.ok(Math.abs(hfo.gamma.quantile(0.5, { k: 1, theta: 1 }) - Math.LN2) < 1e-9);
});
