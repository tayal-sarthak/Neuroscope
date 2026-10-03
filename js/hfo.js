// hfo candidate detection: band-pass, energy, threshold, segment, screen, describe
const EEGHFO = {

    bands: {
        ripple: { low: 80, high: 250, label: 'Ripple', trialType: 'ripple' },
        fast_ripple: { low: 250, high: 500, label: 'Fast ripple', trialType: 'fast_ripple' }
    },

    // anti-alias filters usually roll off near 0.4·fs; past 0.45·fs the band-pass cannot settle
    usableRatio: 0.4,
    hardRatio: 0.45,
    minBandWidth: 20,

    defaultDetector: 'zurich',

    detectors: {
        zurich: {
            label: 'Hilbert + spectral check (Zurich)',
            short: 'Hilbert + spectral check',
            runner: 'detectZurich',
            citation: 'Burnos et al. 2014, PLoS ONE 9:e94381; Fedele et al. 2017, Sci Rep 7:13836; scalp stage from Cserpan et al. 2021, Brain Commun 3:fcab052. NeuroScope uses a 4th-order zero-phase Butterworth band-pass in place of the published FIR, and a quiet-signal baseline in place of the Stockwell-entropy baseline. The threshold is set per epoch from that baseline; candidates must last long enough, show repeated oscillation peaks, have a spectral peak separated from lower frequencies, and, for scalp recordings, stay below the amplitude ceiling and stand out from their surroundings.',
            params: [
                { key: 'epochSec', label: 'Epoch length', unit: 's', min: 10, max: 3600, step: 10, help: 'The threshold is recomputed for each epoch of each channel.' },
                { key: 'thresholdPercentile', label: 'Threshold percentile', unit: '%', min: 90, max: 99.99, step: 0.1, help: 'Envelope percentile over quiet baseline samples. Lower values find more candidates.' },
                { key: 'minDurationMs', label: 'Shortest event', unit: 'ms', min: 2, max: 500, step: 1, help: 'Envelope must stay above threshold at least this long.' },
                { key: 'maxDurationMs', label: 'Longest event', unit: 'ms', min: 20, max: 2000, step: 10, help: 'Longer bursts are usually muscle or a sustained tone.' },
                { key: 'minPeaks', label: 'Oscillation peaks', unit: '', min: 1, max: 20, step: 1, help: 'Positive band-passed peaks above threshold required inside the event.' },
                { key: 'mergeGapMs', label: 'Merge gap', unit: 'ms', min: 0, max: 200, step: 1, help: 'Candidates closer than this are joined. Scalp setting; intracranial work used 10 ms.' },
                { key: 'troughRatio', label: 'Trough / peak power', unit: '', min: 0.05, max: 1, step: 0.05, help: 'Spectral check: the trough below the HFO peak must be this much weaker. Set 1 to skip.' },
                { key: 'peakRatio', label: 'Peak / low peak power', unit: '', min: 0, max: 5, step: 0.05, help: 'Spectral check: the HFO peak relative to the nearest lower-frequency peak. Set 0 to skip.' },
                { key: 'minSnr', label: 'Signal-to-noise', unit: '', min: 0, max: 50, step: 0.5, help: 'Event power over the surrounding ±0.5 s. Set 0 to skip.' },
                { key: 'amplitudeCeilingUv', label: 'Amplitude ceiling', unit: 'µV', min: 0, max: 5000, step: 1, help: 'Band-passed peaks above this are rejected as artifact. Scalp setting; 0 turns it off.' }
            ],
            defaults(electrodes) {
                return electrodes === 'intracranial'
                    ? { epochSec: 300, thresholdPercentile: 99.5, minDurationMs: 20, maxDurationMs: 200, minPeaks: 4, mergeGapMs: 10, troughRatio: 0.8, peakRatio: 0.5, minSnr: 0, amplitudeCeilingUv: 0 }
                    : { epochSec: 300, thresholdPercentile: 99.5, minDurationMs: 20, maxDurationMs: 200, minPeaks: 4, mergeGapMs: 40, troughRatio: 0.8, peakRatio: 0.5, minSnr: 4, amplitudeCeilingUv: 20 };
            }
        },
        ste: {
            label: 'Short-time energy (Staba)',
            short: 'Short-time energy',
            runner: 'detectSte',
            citation: 'Staba et al. 2002, J Neurophysiol 88:1743–1752, with the defaults used by RIPPLELAB (Navarrete et al. 2016) and PyHFO. Designed for intracranial microelectrodes sampled at 10 kHz. Below 1000 Hz sampling the 3 ms RMS window spans fewer than three samples and is widened to three; on scalp recordings a 6 ms event is shorter than one 80 Hz cycle. NeuroScope uses a 4th-order zero-phase Butterworth band-pass in place of the published Chebyshev II.',
            params: [
                { key: 'epochSec', label: 'Epoch length', unit: 's', min: 10, max: 3600, step: 10, help: 'Mean and SD are computed per epoch of each channel.' },
                { key: 'rmsWindowMs', label: 'RMS window', unit: 'ms', min: 1, max: 50, step: 0.5, help: 'Centred window for the root-mean-square energy; at least three samples are used.' },
                { key: 'thresholdSd', label: 'Energy threshold', unit: 'SD', min: 1, max: 20, step: 0.5, help: 'RMS must exceed mean + this many SD.' },
                { key: 'minDurationMs', label: 'Shortest event', unit: 'ms', min: 1, max: 500, step: 1, help: 'RMS must stay above threshold longer than this.' },
                { key: 'mergeGapMs', label: 'Merge gap', unit: 'ms', min: 0, max: 200, step: 1, help: 'Events closer than this are joined.' },
                { key: 'minPeaks', label: 'Rectified peaks', unit: '', min: 1, max: 30, step: 1, help: 'Peaks of the rectified band-passed signal required inside the event.' },
                { key: 'peakThresholdSd', label: 'Peak threshold', unit: 'SD', min: 0.5, max: 10, step: 0.5, help: 'Rectified peaks must exceed mean + this many SD.' }
            ],
            defaults() {
                return { epochSec: 600, rmsWindowMs: 3, thresholdSd: 5, minDurationMs: 6, mergeGapMs: 10, minPeaks: 6, peakThresholdSd: 3 };
            }
        },
        ellenrieder: {
            label: 'Sub-band RMS (von Ellenrieder)',
            short: 'Sub-band RMS',
            runner: 'detectEllenrieder',
            citation: 'von Ellenrieder et al. 2012, Clin Neurophysiol 123:670–680, designed for scalp EEG sampled at 600 Hz. The band is split into 10 Hz sub-bands; RMS over four cycles is compared with a slowly adapting background (an exponential approximation of the published 30 s causal mean). The wideband/narrowband ratio and the minimum narrowband RMS were patient-specific in the paper (2.85–3.38 and 1.34–1.44 µV); the defaults here are their midpoints.',
            params: [
                { key: 'thresholdFactor', label: 'Threshold factor', unit: '×', min: 1.2, max: 10, step: 0.1, help: 'RMS must exceed this multiple of the adaptive background.' },
                { key: 'backgroundSec', label: 'Background memory', unit: 's', min: 2, max: 300, step: 1, help: 'Time constant of the adaptive background.' },
                { key: 'minCycles', label: 'Minimum cycles', unit: '', min: 1, max: 20, step: 0.5, help: 'Shortest event in cycles of the sub-band centre, added to the filter ringing time.' },
                { key: 'mergeGapMs', label: 'Merge gap', unit: 'ms', min: 0, max: 300, step: 5, help: 'Events in any sub-band closer than this are joined.' },
                { key: 'maxWideRatio', label: 'Wide / narrow ratio', unit: '', min: 1, max: 20, step: 0.05, help: 'Broadband peak over sub-band peak; transients and muscle spread across bands.' },
                { key: 'minNarrowRmsUv', label: 'Narrowband RMS', unit: 'µV', min: 0, max: 100, step: 0.05, help: 'Minimum sub-band RMS inside the event.' }
            ],
            defaults() {
                return { thresholdFactor: 2.5, backgroundSec: 30, minCycles: 4, mergeGapMs: 50, maxWideRatio: 3.1, minNarrowRmsUv: 1.4 };
            }
        },
        hilbert: {
            label: 'Hilbert envelope (Crépon)',
            short: 'Hilbert envelope',
            runner: 'detectHilbert',
            citation: 'Crépon et al. 2010, Brain 133:33–45, with the RIPPLELAB defaults (Navarrete et al. 2016): the band-passed signal\'s Hilbert envelope must exceed its mean + 5 SD for at least 10 ms. The original used 180–400 Hz on the whole recording; RIPPLELAB uses one-hour epochs. There is no oscillation count or spectral check, so filtered spikes pass more easily than with the Zurich method.',
            params: [
                { key: 'epochSec', label: 'Epoch length', unit: 's', min: 10, max: 3600, step: 10, help: 'Mean and SD of the envelope are computed per epoch of each channel.' },
                { key: 'thresholdSd', label: 'Envelope threshold', unit: 'SD', min: 1, max: 20, step: 0.5, help: 'Envelope must exceed mean + this many SD.' },
                { key: 'minDurationMs', label: 'Shortest event', unit: 'ms', min: 1, max: 500, step: 1, help: 'Envelope must stay above threshold at least this long.' },
                { key: 'mergeGapMs', label: 'Merge gap', unit: 'ms', min: 0, max: 200, step: 1, help: 'Events closer than this are joined. RIPPLELAB does not merge.' }
            ],
            defaults() {
                return { epochSec: 3600, thresholdSd: 5, minDurationMs: 10, mergeGapMs: 0 };
            }
        },
        sll: {
            label: 'Short line-length (Gardner)',
            short: 'Line length',
            runner: 'detectLineLength',
            citation: 'Gardner et al. 2007, Clin Neurophysiol 118:1134–1143, in the short line-length form used by RIPPLELAB (Navarrete et al. 2016): the signal is first differenced to flatten the 1/f spectrum, band-passed, and its line length over 5 ms must exceed the 97.5th percentile of its own distribution in each 3-minute epoch for at least 12 ms. A percentile threshold always flags about 2.5% of samples, so this detector is sensitive but needs review.',
            params: [
                { key: 'epochSec', label: 'Epoch length', unit: 's', min: 10, max: 3600, step: 10, help: 'The percentile threshold is computed per epoch of each channel.' },
                { key: 'windowMs', label: 'Line-length window', unit: 'ms', min: 1, max: 100, step: 1, help: 'Centred window for the line length; at least three samples are used.' },
                { key: 'thresholdPercentile', label: 'Threshold percentile', unit: '%', min: 80, max: 99.99, step: 0.1, help: 'Line length must exceed this percentile of the epoch.' },
                { key: 'minDurationMs', label: 'Shortest event', unit: 'ms', min: 1, max: 500, step: 1, help: 'Line length must stay above threshold at least this long.' },
                { key: 'mergeGapMs', label: 'Merge gap', unit: 'ms', min: 0, max: 200, step: 1, help: 'Events closer than this are joined. RIPPLELAB does not merge.' }
            ],
            defaults() {
                return { epochSec: 180, windowMs: 5, thresholdPercentile: 97.5, minDurationMs: 12, mergeGapMs: 0 };
            }
        },
        mni: {
            label: 'Baseline entropy + gamma (MNI)',
            short: 'MNI',
            runner: 'detectMni',
            citation: 'Zelmann et al. 2012, Clin Neurophysiol 123:106–116 (and Zelmann et al. 2010, EMBC). Segments whose wavelet entropy is high are noise-like baseline. With at least 5 s of baseline per minute, the threshold is the 99.9999th percentile of a gamma distribution fitted to baseline RMS energy; otherwise the channel has continuous high-frequency activity and an iterative gamma fit at the 95th percentile is used. NeuroScope follows the papers where RIPPLELAB differs: RIPPLELAB marks low-entropy segments as baseline, which reverses the rule (Roehri et al. 2017 also corrected this). Entropy is computed from lag-averaged wavelet power, and the band-pass is a 4th-order zero-phase Butterworth instead of the published FIR.',
            params: [
                { key: 'segmentMs', label: 'Baseline segment', unit: 'ms', min: 50, max: 500, step: 5, help: 'Segments with 50% overlap are tested for noise-like (high-entropy) content.' },
                { key: 'entropyRatio', label: 'Entropy ratio', unit: '× max', min: 0.3, max: 0.99, step: 0.01, help: 'A segment is baseline when its wavelet entropy exceeds this fraction of white-noise entropy.' },
                { key: 'minBaselineSec', label: 'Baseline needed', unit: 's per min', min: 1, max: 30, step: 0.5, help: 'Less baseline than this switches the channel to continuous high-frequency mode.' },
                { key: 'baselineEpochSec', label: 'Baseline per threshold', unit: 's', min: 2, max: 60, step: 1, help: 'A new threshold is fitted each time this much baseline has accumulated.' },
                { key: 'percentile', label: 'Baseline percentile', unit: '%', min: 90, max: 99.99999, step: 0.0001, help: 'Gamma percentile of baseline energy used as the threshold.' },
                { key: 'chfPercentile', label: 'Continuous-HF percentile', unit: '%', min: 50, max: 99.9, step: 0.5, help: 'Gamma percentile for channels without enough baseline.' },
                { key: 'minDurationMs', label: 'Shortest event', unit: 'ms', min: 2, max: 500, step: 1, help: 'Energy must stay above threshold longer than this.' },
                { key: 'mergeGapMs', label: 'Merge gap', unit: 'ms', min: 0, max: 200, step: 1, help: 'Events closer than this are joined.' }
            ],
            defaults() {
                return { segmentMs: 125, entropyRatio: 0.67, minBaselineSec: 5, baselineEpochSec: 10, percentile: 99.9999, chfPercentile: 95, minDurationMs: 10, mergeGapMs: 10 };
            }
        },
        cs: {
            label: 'Cycle and frequency dominance (CS)',
            short: 'CS',
            runner: 'detectCs',
            citation: 'Cimbálník, Stead et al. 2018, J Neurosci Methods 293:210–225, as implemented in epycom (detect_hfo_cs_beta, Apache-2.0). The band is covered by overlapping sub-bands; in each, amplitude and frequency dominance (how much the narrow band explains the broader signal) are normalised, multiplied, and compared with gamma-distribution bounds fitted on Mayo Clinic intracranial recordings at 5 and 32 kHz. Detections in neighbouring sub-bands are joined. The published C version is no longer available; this is the development version, and scalp or low-sampling-rate use is unvalidated.',
            params: [
                { key: 'cdfThreshold', label: 'Distribution bound', unit: '', min: 0.01, max: 0.5, step: 0.01, help: 'Lower gamma quantile each feature must exceed; the upper bound is five times the 99th percentile.' },
                { key: 'edgeThreshold', label: 'Edge threshold', unit: '', min: 0, max: 2, step: 0.05, help: 'The normalised product trace must exceed this to start a detection.' },
                { key: 'windowSec', label: 'Normalisation window', unit: 's', min: 2, max: 60, step: 1, help: 'Features are normalised within windows of this length.' }
            ],
            defaults() {
                return { cdfThreshold: 0.1, edgeThreshold: 0.1, windowSec: 10 };
            }
        },
        spike_ripple: {
            label: 'Spike-ripple (Chu 2017)',
            short: 'Spike-ripple',
            runner: 'detectSpikeRipple',
            fixedBand: { low: 100, high: 300 },
            minSampleRate: 750,
            citation: 'Chu et al. 2017, J Neurosci Methods 276:46–55, from the authors\' MATLAB code. Designed for scalp EEG: ripple candidates (100–300 Hz envelope above its 85th percentile for at least 20 ms, with at least three regular cycles) are kept only when a spike in the raw signal coincides with them, judged against a bootstrap estimate of normal deflections. Spike-associated ripples localised the epileptogenic zone better than ripples alone in a four-centre study (Shi et al. 2024). NeuroScope uses a zero-phase Butterworth band-pass instead of the published FIR, scales the smoothing and regularity test from the original 2035 Hz to this recording, and accepts spikes of either polarity because bipolar montages flip sign.',
            params: [
                { key: 'envelopePercentile', label: 'Envelope percentile', unit: '%', min: 50, max: 99.9, step: 0.5, help: 'Ripple-band envelope must exceed this percentile of the channel.' },
                { key: 'minDurationMs', label: 'Shortest ripple', unit: 'ms', min: 5, max: 200, step: 1, help: 'Candidates shorter than this are dropped.' },
                { key: 'minCycles', label: 'Minimum cycles', unit: '', min: 1, max: 10, step: 1, help: 'Positive zero crossings required inside the ripple.' },
                { key: 'maxFano', label: 'Regularity (Fano factor)', unit: '', min: 0.1, max: 10, step: 0.1, help: 'Variance-to-mean ratio of cycle lengths must be below this.' },
                { key: 'spikePercentile', label: 'Spike height percentile', unit: '%', min: 50, max: 99.9, step: 0.5, help: 'The spike peak must exceed this percentile of the raw signal.' }
            ],
            defaults() {
                return { envelopePercentile: 85, minDurationMs: 20, minCycles: 3, maxFano: 1, spikePercentile: 95 };
            }
        }
    },

    // consensus runs other detectors; only its agreement rule lives here
    consensusDetector: {
        label: 'Consensus of several detectors',
        short: 'Consensus',
        runner: null,
        consensus: true,
        citation: 'Different groups define an HFO differently, and published detectors disagree on many events (Zelmann et al. 2012; Navarrete et al. 2016; Roehri et al. 2017). Consensus runs each selected detector on the same filtered signal and keeps the moments when at least the chosen number of detectors are active at once (a coverage count, as in pyHFO), so one long detection cannot join unrelated events. Event bounds are where that agreement holds; the full extent of the member detections is kept too. Each event records which detectors agreed and what each one measured.',
        params: [
            { key: 'minAgreement', label: 'Detectors that must agree', unit: '', min: 1, max: 8, step: 1, help: 'How many must be active at the same moment: 1 is the union, all of them the intersection, a majority is the usual compromise. Fewer becomes a near-miss.' },
            { key: 'toleranceMs', label: 'Overlap tolerance', unit: 'ms', min: 0, max: 100, step: 1, help: 'Detections this close together count as the same event.' }
        ],
        defaults() {
            return { minAgreement: 2, toleranceMs: 0 };
        }
    },

    detectorDefinition(detector) {
        if (detector === 'consensus') return this.consensusDetector;
        return this.detectors[detector] || this.detectors[this.defaultDetector];
    },

    defaultParams(detector, electrodes = 'scalp') {
        if (detector === 'consensus') return this.consensusDetector.defaults();
        return { ...(this.detectors[detector] || this.detectors[this.defaultDetector]).defaults(electrodes) };
    },

    paramLabel(detector, key) {
        const param = this.detectorDefinition(detector)?.params.find(item => item.key === key);
        if (!param) return key;
        return param.unit ? `${param.label.toLowerCase()} ${param.unit}` : param.label.toLowerCase();
    },

    // ---------- sampling-rate rules ----------

    usableCeiling(sampleRate) {
        return Math.floor(sampleRate * this.usableRatio);
    },

    hardCeiling(sampleRate) {
        return Math.floor(sampleRate * this.hardRatio);
    },

    minimumRateFor(low) {
        return Math.ceil((low + this.minBandWidth) / this.usableRatio);
    },

    // ripple and fast-ripple bands for a dual run, clipped to the usable band
    dualBands(sampleRate) {
        const ceiling = this.usableCeiling(sampleRate);
        return [
            { key: 'ripple', low: 80, high: Math.min(250, ceiling) },
            { key: 'fast_ripple', low: 250, high: Math.min(500, ceiling) }
        ];
    },

    // detectors with their own band or fitted constants cannot run on every recording
    detectorAvailability(key, sampleRate, band = null) {
        const definition = this.detectors[key];
        if (!definition) return { available: true, reason: '' };
        if (definition.minSampleRate && sampleRate < definition.minSampleRate) {
            return { available: false, short: `needs ${definition.minSampleRate} Hz`, reason: `${definition.short} needs at least ${definition.minSampleRate} Hz sampling for its fixed ${definition.fixedBand.low}–${definition.fixedBand.high} Hz band; this recording is ${sampleRate} Hz.` };
        }
        if (key === 'cs' && band && !this.csBands(sampleRate, band).length) {
            return { available: false, short: 'no sub-band fits', reason: `None of the CS sub-bands (fitted on 5 kHz recordings) fits ${band.low}–${band.high} Hz at ${sampleRate} Hz sampling.` };
        }
        return { available: true, reason: '' };
    },

    assessSampling(sampleRate, bandKey) {
        if (bandKey === 'ripple_fr') {
            const fast = this.assessSampling(sampleRate, 'fast_ripple');
            if (fast.tone === 'blocked') {
                return { ...fast, headline: 'Ripple + fast ripple is unavailable.', message: `Fast ripples need at least ${this.minimumRateFor(250)} Hz sampling; this recording is ${sampleRate} Hz. Choose Ripple instead.` };
            }
            return {
                ...fast,
                headline: fast.limited ? `Fast ripples band-limited to 250–${this.usableCeiling(sampleRate)} Hz.` : 'Ripples and fast ripples run separately.',
                message: `${fast.limited ? `${fast.message} ` : ''}Each band is detected on its own; a ripple overlapped by a fast ripple on the same channel is labelled ripple + fast ripple (Fedele et al. 2017).`
            };
        }
        const ceiling = this.usableCeiling(sampleRate);
        const preset = this.bands[bandKey];
        if (!preset) {
            return {
                tone: 'info',
                limited: false,
                headline: `${sampleRate} Hz sampling.`,
                message: `Band edges up to ${ceiling} Hz are well inside the anti-alias range; up to ${this.hardCeiling(sampleRate)} Hz is allowed with caution.`
            };
        }
        const recommended = bandKey === 'fast_ripple' ? 2000 : 1000;
        const effectiveHigh = Math.min(preset.high, ceiling);
        if (effectiveHigh - preset.low < this.minBandWidth) {
            return {
                tone: 'blocked',
                limited: true,
                headline: `${preset.label} detection is unavailable.`,
                message: `It needs at least ${this.minimumRateFor(preset.low)} Hz sampling; this recording is ${sampleRate} Hz. ${recommended} Hz or more is recommended.`
            };
        }
        if (effectiveHigh < preset.high) {
            return {
                tone: 'warning',
                limited: true,
                headline: `Band-limited to ${preset.low}–${effectiveHigh} Hz.`,
                message: `At ${sampleRate} Hz sampling only part of the ${preset.label.toLowerCase()} band is recorded. Treat candidates as exploratory high-frequency activity (${preset.low}–${effectiveHigh} Hz), not ${preset.label.toLowerCase()}s, and do not compare their rate with published ${preset.label.toLowerCase()} rates.${sampleRate < 500 ? ' No published scalp ripple study sampled below 500 Hz.' : ''} The full band needs ${Math.ceil(preset.high / this.usableRatio)} Hz; ${recommended} Hz or more is recommended.`
            };
        }
        if (sampleRate < recommended) {
            return {
                tone: 'info',
                limited: false,
                headline: `Full ${preset.label.toLowerCase()} band available.`,
                message: `${recommended} Hz or more is recommended for HFO work (Gliske et al. 2016).`
            };
        }
        return { tone: 'info', limited: false, headline: '', message: '' };
    },

    // ---------- signal primitives ----------

    _sectionCache: {},

    // true butterworth band-pass: low-pass prototype -> band-pass -> bilinear (prewarped), as biquads.
    // a high-pass/low-pass cascade sags in the middle of narrow bands; this keeps the passband flat.
    designBandpass(sampleRate, low, high, order = 4) {
        const key = `${sampleRate}|${low}|${high}|${order}`;
        if (this._sectionCache[key]) return this._sectionCache[key];
        const warp = f => 2 * sampleRate * Math.tan(Math.PI * f / sampleRate);
        const w1 = warp(low);
        const w2 = warp(high);
        const w0 = Math.sqrt(w1 * w2);
        const bandwidth = w2 - w1;
        const k = 2 * sampleRate;
        const mul = (a, b) => [a[0] * b[0] - a[1] * b[1], a[0] * b[1] + a[1] * b[0]];
        const div = (a, b) => {
            const d = b[0] * b[0] + b[1] * b[1];
            return [(a[0] * b[0] + a[1] * b[1]) / d, (a[1] * b[0] - a[0] * b[1]) / d];
        };
        const sqrt = a => {
            const r = Math.hypot(a[0], a[1]);
            const re = Math.sqrt(Math.max(0, (r + a[0]) / 2));
            const im = Math.sqrt(Math.max(0, (r - a[0]) / 2));
            return [re, a[1] < 0 ? -im : im];
        };
        const poles = [];
        for (let i = 0; i < order; i++) {
            const theta = Math.PI * (2 * i + 1) / (2 * order) + Math.PI / 2;
            const prototype = [Math.cos(theta), Math.sin(theta)];
            const a = [prototype[0] * bandwidth / 2, prototype[1] * bandwidth / 2];
            const d = sqrt([a[0] * a[0] - a[1] * a[1] - w0 * w0, 2 * a[0] * a[1]]);
            for (const s of [[a[0] + d[0], a[1] + d[1]], [a[0] - d[0], a[1] - d[1]]]) {
                poles.push(div([k + s[0], s[1]], [k - s[0], -s[1]]));
            }
        }
        // each upper-half-plane pole and its conjugate form one section with zeros at z = ±1
        const sections = poles
            .filter(z => z[1] > 1e-12)
            .map(z => ({ b0: 1, b1: 0, b2: -1, a1: -2 * z[0], a2: z[0] * z[0] + z[1] * z[1] }));
        const real = poles.filter(z => Math.abs(z[1]) <= 1e-12).map(z => z[0]);
        for (let i = 0; i + 1 < real.length; i += 2) {
            sections.push({ b0: 1, b1: 0, b2: -1, a1: -(real[i] + real[i + 1]), a2: real[i] * real[i + 1] });
        }
        // unit gain at the centre frequency the bilinear transform maps w0 to
        const omega = 2 * Math.atan(w0 / k);
        const e1 = [Math.cos(-omega), Math.sin(-omega)];
        const e2 = [Math.cos(-2 * omega), Math.sin(-2 * omega)];
        let response = [1, 0];
        for (const c of sections) {
            const numerator = [c.b0 + c.b1 * e1[0] + c.b2 * e2[0], c.b1 * e1[1] + c.b2 * e2[1]];
            const denominator = [1 + c.a1 * e1[0] + c.a2 * e2[0], c.a1 * e1[1] + c.a2 * e2[1]];
            response = mul(response, div(numerator, denominator));
        }
        const gain = 1 / Math.hypot(response[0], response[1]);
        sections[0] = { ...sections[0], b0: sections[0].b0 * gain, b1: sections[0].b1 * gain, b2: sections[0].b2 * gain };
        this._sectionCache[key] = sections;
        return sections;
    },

    _runSections(data, sections) {
        let output = data;
        for (const section of sections) output = EEGAnalysis._applyBiquad(output, section);
        return output;
    },

    // zero-phase band-pass with reflected padding so the ends do not ring
    bandpass(signal, sampleRate, low, high, order = 4) {
        const sections = this.designBandpass(sampleRate, low, high, order);
        const n = signal.length;
        const pad = Math.max(0, Math.min(n - 2, Math.round(0.5 * sampleRate)));
        const padded = new Float64Array(n + 2 * pad);
        for (let i = 0; i < pad; i++) {
            padded[i] = 2 * signal[0] - signal[pad - i];
            padded[n + pad + i] = 2 * signal[n - 1] - signal[n - 2 - i];
        }
        for (let i = 0; i < n; i++) padded[pad + i] = signal[i];
        const forward = this._runSections(padded, sections).reverse();
        const backward = this._runSections(forward, sections).reverse();
        return backward.subarray(pad, pad + n);
    },

    notch(signal, sampleRate, frequencies) {
        let output = signal;
        for (const frequency of frequencies) {
            output = EEGAnalysis._notchFilter(output, sampleRate, frequency, Math.max(0.5, frequency / 30));
        }
        return output;
    },

    meanStd(values, start = 0, end = values.length) {
        const n = Math.max(1, end - start);
        let sum = 0;
        for (let i = start; i < end; i++) sum += values[i];
        const mean = sum / n;
        let squares = 0;
        for (let i = start; i < end; i++) {
            const delta = values[i] - mean;
            squares += delta * delta;
        }
        return { mean, std: Math.sqrt(squares / n) };
    },

    // linear-interpolated percentile; quickselect keeps long channels linear rather than n log n
    percentile(values, p) {
        const n = values.length;
        if (!n) return 0;
        const work = Float64Array.from(values);
        const position = Math.max(0, Math.min(n - 1, p / 100 * (n - 1)));
        const lower = Math.floor(position);
        const low = this._select(work, lower);
        if (position === lower) return low;
        let next = Infinity;
        for (let i = lower + 1; i < n; i++) if (work[i] < next) next = work[i];
        return low + (next - low) * (position - lower);
    },

    // in-place quickselect: afterwards work[k] holds the k-th smallest and everything right of k is >= it
    _select(work, k) {
        let left = 0;
        let right = work.length - 1;
        while (right > left) {
            const pivot = work[(left + right) >> 1];
            let i = left;
            let j = right;
            while (i <= j) {
                while (work[i] < pivot) i++;
                while (work[j] > pivot) j--;
                if (i <= j) {
                    const t = work[i]; work[i] = work[j]; work[j] = t;
                    i++;
                    j--;
                }
            }
            if (k <= j) right = j;
            else if (k >= i) left = i;
            else break;
        }
        return work[k];
    },

    // centered moving rms over `width` samples (prefix sums keep it linear)
    movingRMS(signal, width) {
        const n = signal.length;
        const w = Math.max(1, Math.round(width));
        const half = Math.floor(w / 2);
        const prefix = new Float64Array(n + 1);
        for (let i = 0; i < n; i++) prefix[i + 1] = prefix[i] + signal[i] * signal[i];
        const out = new Float64Array(n);
        for (let i = 0; i < n; i++) {
            const a = Math.max(0, i - half);
            const b = Math.min(n, a + w);
            out[i] = Math.sqrt((prefix[b] - prefix[a]) / Math.max(1, b - a));
        }
        return out;
    },

    // in-place iterative radix-2 complex fft; inverse when `inverse` is true (unscaled)
    fftComplex(re, im, inverse = false) {
        const n = re.length;
        for (let i = 1, j = 0; i < n; i++) {
            let bit = n >> 1;
            for (; j & bit; bit >>= 1) j ^= bit;
            j ^= bit;
            if (i < j) {
                let t = re[i]; re[i] = re[j]; re[j] = t;
                t = im[i]; im[i] = im[j]; im[j] = t;
            }
        }
        for (let len = 2; len <= n; len <<= 1) {
            const angle = (inverse ? 2 : -2) * Math.PI / len;
            const wRe = Math.cos(angle);
            const wIm = Math.sin(angle);
            const half = len >> 1;
            for (let i = 0; i < n; i += len) {
                let curRe = 1;
                let curIm = 0;
                for (let k = 0; k < half; k++) {
                    const a = i + k;
                    const b = a + half;
                    const tRe = curRe * re[b] - curIm * im[b];
                    const tIm = curRe * im[b] + curIm * re[b];
                    re[b] = re[a] - tRe;
                    im[b] = im[a] - tIm;
                    re[a] += tRe;
                    im[a] += tIm;
                    const nextRe = curRe * wRe - curIm * wIm;
                    curIm = curRe * wIm + curIm * wRe;
                    curRe = nextRe;
                }
            }
        }
    },

    // analytic signal (real, imaginary) in overlapping FFT blocks so memory stays bounded
    analyticSignal(signal, blockSize = 65536, overlap = 4096) {
        const n = signal.length;
        const outRe = new Float64Array(n);
        const outIm = new Float64Array(n);
        const size = Math.min(blockSize, 1 << Math.ceil(Math.log2(Math.max(2, n))));
        const pad = size >= n ? 0 : overlap;
        const step = size - 2 * pad;
        const re = new Float64Array(size);
        const im = new Float64Array(size);
        for (let keepStart = 0; keepStart < n; keepStart += step) {
            const blockStart = keepStart - pad;
            re.fill(0);
            im.fill(0);
            for (let i = 0; i < size; i++) {
                const source = blockStart + i;
                if (source >= 0 && source < n) re[i] = signal[source];
            }
            this.fftComplex(re, im, false);
            for (let k = 1; k < size / 2; k++) {
                re[k] *= 2;
                im[k] *= 2;
            }
            for (let k = size / 2 + 1; k < size; k++) {
                re[k] = 0;
                im[k] = 0;
            }
            this.fftComplex(re, im, true);
            const keepEnd = Math.min(n, keepStart + step);
            for (let source = keepStart; source < keepEnd; source++) {
                const i = source - blockStart;
                outRe[source] = re[i] / size;
                outIm[source] = im[i] / size;
            }
        }
        return { re: outRe, im: outIm };
    },

    // analytic-signal magnitude, computed in overlapping blocks so memory stays bounded
    hilbertEnvelope(signal, blockSize = 65536, overlap = 4096) {
        const n = signal.length;
        const out = new Float64Array(n);
        const size = Math.min(blockSize, 1 << Math.ceil(Math.log2(Math.max(2, n))));
        const pad = size >= n ? 0 : overlap;
        const step = size - 2 * pad;
        const re = new Float64Array(size);
        const im = new Float64Array(size);

        for (let keepStart = 0; keepStart < n; keepStart += step) {
            const blockStart = keepStart - pad;
            re.fill(0);
            im.fill(0);
            for (let i = 0; i < size; i++) {
                const source = blockStart + i;
                if (source >= 0 && source < n) re[i] = signal[source];
            }
            this.fftComplex(re, im, false);
            // keep DC and Nyquist, double positive frequencies, zero negative frequencies
            for (let k = 1; k < size / 2; k++) {
                re[k] *= 2;
                im[k] *= 2;
            }
            for (let k = size / 2 + 1; k < size; k++) {
                re[k] = 0;
                im[k] = 0;
            }
            this.fftComplex(re, im, true);
            const keepEnd = Math.min(n, keepStart + step);
            for (let source = keepStart; source < keepEnd; source++) {
                const i = source - blockStart;
                out[source] = Math.sqrt(re[i] * re[i] + im[i] * im[i]) / size;
            }
        }
        return out;
    },

    // ---------- segmentation ----------

    // contiguous runs where energy > threshold inside [start, end); returns [startSample, endSample) pairs
    findRuns(energy, threshold, start = 0, end = energy.length) {
        const runs = [];
        let runStart = -1;
        for (let i = start; i < end; i++) {
            const limit = typeof threshold === 'number' ? threshold : threshold[i];
            const above = energy[i] > limit;
            if (above && runStart < 0) runStart = i;
            else if (!above && runStart >= 0) {
                runs.push([runStart, i]);
                runStart = -1;
            }
        }
        if (runStart >= 0) runs.push([runStart, end]);
        return runs;
    },

    mergeRuns(runs, gapSamples) {
        if (!runs.length) return [];
        const sorted = runs.map(run => run.slice()).sort((a, b) => a[0] - b[0]);
        const merged = [sorted[0]];
        for (let i = 1; i < sorted.length; i++) {
            const last = merged[merged.length - 1];
            if (sorted[i][0] - last[1] < gapSamples) last[1] = Math.max(last[1], sorted[i][1]);
            else merged.push(sorted[i]);
        }
        return merged;
    },

    // local maxima of |x| above `threshold` inside [start, end)
    countRectifiedPeaks(signal, start, end, threshold) {
        let peaks = 0;
        for (let i = Math.max(1, start); i < Math.min(signal.length - 1, end); i++) {
            const value = Math.abs(signal[i]);
            if (value > threshold && value >= Math.abs(signal[i - 1]) && value > Math.abs(signal[i + 1])) peaks++;
        }
        return peaks;
    },

    // local maxima of x (positive half-waves) above `threshold` inside [start, end)
    countPositivePeaks(signal, start, end, threshold) {
        let peaks = 0;
        for (let i = Math.max(1, start); i < Math.min(signal.length - 1, end); i++) {
            const value = signal[i];
            if (value > threshold && value >= signal[i - 1] && value > signal[i + 1]) peaks++;
        }
        return peaks;
    },

    // ---------- line noise ----------

    foldFrequency(frequency, sampleRate) {
        const wrapped = frequency % sampleRate;
        return wrapped > sampleRate / 2 ? sampleRate - wrapped : wrapped;
    },

    lineComponents(lineFrequency, sampleRate, maxHarmonic = 12) {
        const components = [];
        for (let k = 1; k <= maxHarmonic; k++) {
            const folded = this.foldFrequency(k * lineFrequency, sampleRate);
            if (folded > 1 && !components.some(item => Math.abs(item.frequency - folded) < 0.5)) {
                components.push({ harmonic: k, frequency: folded, aliased: k * lineFrequency > sampleRate / 2 });
            }
        }
        return components;
    },

    // median spectrum over the first minute of up to eight channels, at ~1 Hz resolution
    lineNoiseSpectrum(channels, sampleRate) {
        const segmentLength = 1 << Math.ceil(Math.log2(sampleRate));
        const spectra = [];
        for (const signal of channels.slice(0, 8)) {
            const length = Math.min(signal.length, Math.round(60 * sampleRate));
            if (length < segmentLength) continue;
            const result = EEGAnalysis.welchPSD(signal.subarray(0, length), sampleRate, segmentLength, 0.5, 'hanning');
            spectra.push(result);
        }
        if (!spectra.length) return null;
        const freqs = spectra[0].freqs;
        const psd = new Float64Array(freqs.length);
        for (let k = 0; k < freqs.length; k++) {
            const values = spectra.map(spectrum => spectrum.psd[k]).sort((a, b) => a - b);
            psd[k] = values[Math.floor(values.length / 2)];
        }
        return { freqs, psd };
    },

    lineProminence(spectrum, frequency) {
        const { freqs, psd } = spectrum;
        const resolution = freqs[1] - freqs[0];
        let peak = 0;
        const neighbours = [];
        for (let k = 0; k < freqs.length; k++) {
            const distance = Math.abs(freqs[k] - frequency);
            if (distance <= Math.max(1, resolution)) peak = Math.max(peak, psd[k]);
            else if (distance >= 2 && distance <= 7) neighbours.push(psd[k]);
        }
        if (!neighbours.length || peak <= 0) return 0;
        neighbours.sort((a, b) => a - b);
        const floor = neighbours[Math.floor(neighbours.length / 2)];
        return floor > 0 ? 10 * Math.log10(peak / floor) : 0;
    },

    // picks 50 or 60 Hz from harmonic prominence; null when neither stands out
    detectLineFrequency(channels, sampleRate) {
        const spectrum = this.lineNoiseSpectrum(channels, sampleRate);
        if (!spectrum) return { frequency: null, spectrum: null };
        const score = base => this.lineComponents(base, sampleRate, 8)
            .map(component => Math.max(0, this.lineProminence(spectrum, component.frequency)))
            .reduce((sum, value) => sum + value, 0);
        const fifty = score(50);
        const sixty = score(60);
        const best = sixty >= fifty ? 60 : 50;
        const margin = Math.abs(sixty - fifty);
        return { frequency: Math.max(fifty, sixty) >= 6 && margin >= 3 ? best : null, spectrum, scores: { 50: fifty, 60: sixty } };
    },

    // harmonics and aliases that actually stand out in this recording; the fundamental always counts
    presentLineComponents(lineFrequency, spectrum, sampleRate) {
        if (!lineFrequency) return [];
        return this.lineComponents(lineFrequency, sampleRate)
            .filter(component => component.harmonic === 1 || !spectrum || this.lineProminence(spectrum, component.frequency) >= 3)
            .map(component => component.frequency);
    },

    // line harmonics and aliases inside the analysis band that are visibly present
    planNotches(lineFrequency, spectrum, sampleRate, band) {
        if (!lineFrequency) return [];
        return this.lineComponents(lineFrequency, sampleRate)
            .filter(component => component.frequency >= band.low - 10 && component.frequency <= band.high + 10)
            .filter(component => component.frequency < sampleRate / 2 - 2)
            .map(component => ({ ...component, prominence: spectrum ? this.lineProminence(spectrum, component.frequency) : null }))
            .filter(component => component.prominence === null || component.prominence >= 3)
            .map(component => ({ ...component, frequency: Math.round(component.frequency * 10) / 10 }));
    },

    // ---------- spectral check (Burnos 2014) ----------

    _kernelCache: new Map(),

    // complex gaussian kernel with sigma = 1/f, which matches the Stockwell transform window
    _stockwellKernel(frequency, sampleRate) {
        const key = `${sampleRate}|${frequency}`;
        let kernel = this._kernelCache.get(key);
        if (kernel) return kernel;
        const sigma = 1 / frequency;
        const half = Math.ceil(3 * sigma * sampleRate);
        const re = new Float64Array(2 * half + 1);
        const im = new Float64Array(2 * half + 1);
        let norm = 0;
        for (let i = -half; i <= half; i++) {
            const t = i / sampleRate;
            const gauss = Math.exp(-(t * t) / (2 * sigma * sigma));
            re[i + half] = gauss * Math.cos(2 * Math.PI * frequency * t);
            im[i + half] = gauss * Math.sin(2 * Math.PI * frequency * t);
            norm += gauss;
        }
        kernel = { half, re, im, norm };
        if (this._kernelCache.size > 4000) this._kernelCache.clear();
        this._kernelCache.set(key, kernel);
        return kernel;
    },

    // amplitude-normalised power spectrum at one sample
    instantaneousSpectrum(signal, center, sampleRate, fMin, fMax, step) {
        const freqs = [];
        const power = [];
        for (let f = fMin; f <= fMax + 1e-9; f += step) {
            const { half, re, im, norm } = this._stockwellKernel(f, sampleRate);
            let sumRe = 0;
            let sumIm = 0;
            let weight = 0;
            const first = Math.max(-half, -center);
            const last = Math.min(half, signal.length - 1 - center);
            for (let i = first; i <= last; i++) {
                const value = signal[center + i];
                sumRe += value * re[i + half];
                sumIm += value * im[i + half];
            }
            // near the recording edges only part of the window exists; renormalise by what was used
            if (first !== -half || last !== half) {
                for (let i = first; i <= last; i++) weight += Math.hypot(re[i + half], im[i + half]);
            } else {
                weight = norm;
            }
            freqs.push(f);
            power.push(weight > 0 ? (sumRe * sumRe + sumIm * sumIm) / (weight * weight) : 0);
        }
        return { freqs, power };
    },

    spectralCheck(signal, center, sampleRate, band, masks, params) {
        const fMax = Math.min(this.hardCeiling(sampleRate), Math.max(band.high, 70));
        const step = fMax > 260 ? 2 : 1;
        const { freqs, power } = this.instantaneousSpectrum(signal, center, sampleRate, 20, fMax, step);
        const masked = f => masks.some(mask => f >= mask.low && f <= mask.high);
        let hiIndex = -1;
        let firstInRange = -1;
        for (let k = 0; k < freqs.length; k++) {
            if (freqs[k] < Math.max(60, band.low - 20) || freqs[k] > band.high || masked(freqs[k])) continue;
            if (firstInRange < 0) firstInRange = k;
            if (hiIndex < 0 || power[k] > power[hiIndex]) hiIndex = k;
        }
        if (hiIndex < 0) return { pass: false, reason: 'no spectral peak in band' };
        // a maximum pinned to the bottom of the search range is the tail of lower-frequency power, not a peak
        if (hiIndex === firstInRange && hiIndex > 0 && power[hiIndex - 1] >= power[hiIndex]) {
            return { pass: false, reason: 'spectrum falls through the band', peakFrequency: freqs[hiIndex] };
        }
        let troughIndex = -1;
        for (let k = 0; k < hiIndex; k++) {
            if (freqs[k] < 40 || masked(freqs[k])) continue;
            if (troughIndex < 0 || power[k] < power[troughIndex]) troughIndex = k;
        }
        const peakFrequency = freqs[hiIndex];
        if (troughIndex < 0) return { pass: false, reason: 'no trough below the peak', peakFrequency };
        let lowIndex = -1;
        for (let k = troughIndex - 1; k >= 1; k--) {
            if (masked(freqs[k])) continue;
            if (power[k] >= power[k - 1] && power[k] >= power[k + 1]) {
                lowIndex = k;
                break;
            }
        }
        if (lowIndex < 0) lowIndex = 0;
        const troughRatio = power[troughIndex] / power[hiIndex];
        const peakRatio = power[lowIndex] > 0 ? power[hiIndex] / power[lowIndex] : Infinity;
        const pass = (params.troughRatio >= 1 || troughRatio < params.troughRatio)
            && (params.peakRatio <= 0 || peakRatio > params.peakRatio);
        return {
            pass,
            reason: pass ? null : troughRatio >= params.troughRatio ? 'no clear trough below the peak' : 'lower-frequency activity dominates',
            peakFrequency,
            troughFrequency: freqs[troughIndex],
            troughRatio,
            peakRatio
        };
    },

    // ---------- explanations ----------

    // one line of a detector's reasoning: what was measured, the rule it had to meet, and whether it did
    criterion(key, label, value, unit, rule, pass) {
        return { key, label, value: Number.isFinite(value) ? value : null, unit, rule, pass: Boolean(pass) };
    },

    // near-misses are kept (capped) so a reviewer can see what the detector set aside and why
    maxScreenedPerChannel: 2500,

    screen(list, start, end, stage, reason, criteria) {
        if (list.length < this.maxScreenedPerChannel) list.push({ start, end, stage, reason, criteria });
    },

    // ---------- detectors ----------

    // quiet samples: away from any high-energy stretch (±margin) and within ±2σ′ of the band-passed mean,
    // where σ′ is the SD after dropping samples beyond 3 SD
    quietBaseline(filtered, envelope, start, end, margin) {
        const all = this.meanStd(filtered, start, end);
        let sum = 0;
        let squares = 0;
        let count = 0;
        for (let i = start; i < end; i++) {
            if (Math.abs(filtered[i] - all.mean) < 3 * all.std) {
                sum += filtered[i];
                squares += filtered[i] * filtered[i];
                count++;
            }
        }
        const mean = count ? sum / count : all.mean;
        const robustStd = count ? Math.sqrt(Math.max(0, squares / count - mean * mean)) : all.std;
        // difference array marks every sample within `margin` of a high-energy sample
        const marks = new Int32Array(end - start + 1);
        for (let i = start; i < end; i++) {
            if (envelope[i] <= 3 * robustStd) continue;
            marks[Math.max(0, i - margin - start)]++;
            marks[Math.min(end - start, i + margin + 1 - start)]--;
        }
        const values = new Float64Array(end - start);
        let count2 = 0;
        let depth = 0;
        for (let i = start; i < end; i++) {
            depth += marks[i - start];
            if (depth === 0 && Math.abs(filtered[i] - mean) < 2 * robustStd) values[count2++] = envelope[i];
        }
        return { values: values.subarray(0, count2), robustStd };
    },

    detectZurich(context) {
        const { notched, filtered, sampleRate, params, band, masks } = context;
        const n = filtered.length;
        const envelope = this.hilbertEnvelope(filtered);
        const epoch = Math.max(Math.round(params.epochSec * sampleRate), Math.round(10 * sampleRate));
        const margin = Math.round(0.05 * sampleRate);
        const counts = { crossings: 0, duration: 0, peaks: 0, spectral: 0, amplitude: 0, snr: 0 };
        const thresholds = [];
        let candidates = [];

        for (let start = 0; start < n; start += epoch) {
            // a short tail joins the previous epoch so its threshold is not computed from a sliver
            const end = n - (start + epoch) < epoch / 3 ? n : Math.min(n, start + epoch);
            const baseline = this.quietBaseline(filtered, envelope, start, end, margin);
            let values = baseline.values;
            const usedFallback = values.length < 2 * sampleRate;
            if (usedFallback) values = envelope.subarray(start, end);
            const threshold = this.percentile(values, params.thresholdPercentile);
            thresholds.push({ start: start / sampleRate, end: end / sampleRate, threshold, baselineSeconds: usedFallback ? 0 : values.length / sampleRate });
            const runs = this.findRuns(envelope, threshold, start, end).map(run => [...run, threshold]);
            candidates.push(...runs);
            if (end === n) break;
        }
        counts.crossings = candidates.length;
        const merged = [];
        for (const run of candidates.sort((a, b) => a[0] - b[0])) {
            const last = merged[merged.length - 1];
            if (last && run[0] - last[1] < Math.round(params.mergeGapMs / 1000 * sampleRate)) {
                last[1] = Math.max(last[1], run[1]);
                last[2] = Math.min(last[2], run[2]);
            } else merged.push(run.slice());
        }

        const minLength = params.minDurationMs / 1000 * sampleRate;
        const maxLength = params.maxDurationMs / 1000 * sampleRate;
        const surround = Math.round(0.5 * sampleRate);
        const events = [];
        const screened = [];
        for (const [start, end, threshold] of merged) {
            const length = end - start;
            const criteria = [];
            let envelopePeak = 0;
            let peak = start;
            for (let i = start; i < end; i++) if (envelope[i] > envelopePeak) { envelopePeak = envelope[i]; peak = i; }
            criteria.push(this.criterion('envelope', 'Envelope peak', envelopePeak / threshold, '× threshold', `> 1 (threshold ${threshold.toFixed(2)} µV, P${params.thresholdPercentile} of quiet baseline)`, true));
            const durationMs = length / sampleRate * 1000;
            const durationOk = length >= minLength && length <= maxLength;
            criteria.push(this.criterion('duration', 'Duration', durationMs, 'ms', `${params.minDurationMs}–${params.maxDurationMs} ms`, durationOk));
            if (!durationOk) {
                counts.duration++;
                // very short blips are too numerous to keep; long bursts are kept because they are often muscle
                if (length > maxLength) this.screen(screened, start, end, 'duration', 'longer than the longest event', criteria);
                continue;
            }
            const peaks = this.countPositivePeaks(filtered, start, end, threshold);
            criteria.push(this.criterion('peaks', 'Oscillation peaks', peaks, '', `≥ ${params.minPeaks} above threshold`, peaks >= params.minPeaks));
            if (peaks < params.minPeaks) { counts.peaks++; this.screen(screened, start, end, 'peaks', 'too few oscillation peaks', criteria); continue; }
            const spectral = this.spectralCheck(notched, peak, sampleRate, band, masks, params);
            criteria.push(this.criterion('spectralPeak', 'Spectral peak', spectral.peakFrequency, 'Hz', `inside ${Math.max(60, band.low - 20)}–${band.high} Hz`, Boolean(spectral.peakFrequency) && spectral.reason !== 'no spectral peak in band' && spectral.reason !== 'spectrum falls through the band'));
            if (Number.isFinite(spectral.troughRatio)) {
                criteria.push(this.criterion('troughRatio', 'Trough / peak power', spectral.troughRatio, '', params.troughRatio >= 1 ? 'not checked' : `< ${params.troughRatio}`, params.troughRatio >= 1 || spectral.troughRatio < params.troughRatio));
                criteria.push(this.criterion('peakRatio', 'Peak / lower peak power', spectral.peakRatio, '', params.peakRatio <= 0 ? 'not checked' : `> ${params.peakRatio}`, params.peakRatio <= 0 || spectral.peakRatio > params.peakRatio));
            }
            if (!spectral.pass) { counts.spectral++; this.screen(screened, start, end, 'spectral', spectral.reason || 'spectral check', criteria); continue; }
            let maxAbs = 0;
            for (let i = start; i < end; i++) maxAbs = Math.max(maxAbs, Math.abs(filtered[i]));
            let contextMin = Infinity;
            let contextMax = -Infinity;
            for (let i = Math.max(0, peak - surround); i < Math.min(n, peak + surround); i++) {
                contextMin = Math.min(contextMin, filtered[i]);
                contextMax = Math.max(contextMax, filtered[i]);
            }
            const ceilingOk = !(params.amplitudeCeilingUv > 0 && maxAbs > params.amplitudeCeilingUv);
            criteria.push(this.criterion('amplitude', 'Band-passed peak', maxAbs, 'µV', params.amplitudeCeilingUv > 0 ? `≤ ${params.amplitudeCeilingUv} µV` : 'no ceiling', ceilingOk));
            criteria.push(this.criterion('contextRange', 'Band-passed range ±0.5 s', contextMax - contextMin, 'µV', '≤ 500 µV', contextMax - contextMin <= 500));
            if (!ceilingOk || contextMax - contextMin > 500) {
                counts.amplitude++;
                this.screen(screened, start, end, 'amplitude', ceilingOk ? 'artifact-sized activity nearby' : 'above the amplitude ceiling', criteria);
                continue;
            }
            const snr = this.eventSnr(filtered, start, end, peak, surround, merged);
            criteria.push(this.criterion('snr', 'Signal-to-noise', snr, '', params.minSnr > 0 ? `≥ ${params.minSnr}` : 'not checked', !(params.minSnr > 0 && snr < params.minSnr)));
            if (params.minSnr > 0 && snr < params.minSnr) { counts.snr++; this.screen(screened, start, end, 'snr', 'does not stand out from its surroundings', criteria); continue; }
            events.push({ start, end, threshold, snr, spectral, criteria });
        }
        return { events, thresholds, counts, envelope, screened };
    },

    // (RMS_event / RMS_surround)², surround is ±0.5 s around the peak minus every candidate
    eventSnr(filtered, start, end, peak, surround, runs) {
        let eventSum = 0;
        for (let i = start; i < end; i++) eventSum += filtered[i] * filtered[i];
        const eventRms = Math.sqrt(eventSum / Math.max(1, end - start));
        const a = Math.max(0, peak - surround);
        const b = Math.min(filtered.length, peak + surround);
        const nearby = runs.filter(run => run[1] > a && run[0] < b);
        let sum = 0;
        let count = 0;
        for (let i = a; i < b; i++) {
            if (nearby.some(run => i >= run[0] && i < run[1])) continue;
            sum += filtered[i] * filtered[i];
            count++;
        }
        const backgroundRms = count ? Math.sqrt(sum / count) : 0;
        return backgroundRms > 0 ? (eventRms / backgroundRms) ** 2 : Infinity;
    },

    detectSte(context) {
        const { filtered, sampleRate, params } = context;
        const n = filtered.length;
        let width = Math.round(params.rmsWindowMs / 1000 * sampleRate);
        width = Math.max(3, width % 2 === 0 ? width + 1 : width);
        const rms = this.movingRMS(filtered, width);
        const rectified = new Float64Array(n);
        for (let i = 0; i < n; i++) rectified[i] = Math.abs(filtered[i]);
        const epoch = Math.max(Math.round(params.epochSec * sampleRate), Math.round(10 * sampleRate));
        const counts = { crossings: 0, duration: 0, peaks: 0 };
        const thresholds = [];
        const events = [];
        const screened = [];
        for (let start = 0; start < n; start += epoch) {
            const end = n - (start + epoch) < epoch / 3 ? n : Math.min(n, start + epoch);
            const energy = this.meanStd(rms, start, end);
            const threshold = energy.mean + params.thresholdSd * energy.std;
            const rectifiedStats = this.meanStd(rectified, start, end);
            const peakThreshold = rectifiedStats.mean + params.peakThresholdSd * rectifiedStats.std;
            thresholds.push({ start: start / sampleRate, end: end / sampleRate, threshold, peakThreshold });
            const runs = this.mergeRuns(this.findRuns(rms, threshold, start, end), Math.round(params.mergeGapMs / 1000 * sampleRate));
            counts.crossings += runs.length;
            for (const [a, b] of runs) {
                let rmsPeak = 0;
                for (let i = a; i < b; i++) rmsPeak = Math.max(rmsPeak, rms[i]);
                const criteria = [this.criterion('energy', 'RMS peak', rmsPeak / threshold, '× threshold', `> 1 (mean + ${params.thresholdSd} SD = ${threshold.toFixed(2)} µV)`, true)];
                const durationMs = (b - a) / sampleRate * 1000;
                criteria.push(this.criterion('duration', 'Duration', durationMs, 'ms', `> ${params.minDurationMs} ms`, durationMs > params.minDurationMs));
                if (durationMs <= params.minDurationMs) { counts.duration++; continue; }
                const peaks = this.countRectifiedPeaks(filtered, a, b, peakThreshold);
                criteria.push(this.criterion('peaks', 'Rectified peaks', peaks, '', `≥ ${params.minPeaks} above mean + ${params.peakThresholdSd} SD`, peaks >= params.minPeaks));
                if (peaks < params.minPeaks) { counts.peaks++; this.screen(screened, a, b, 'peaks', 'too few rectified peaks', criteria); continue; }
                events.push({ start: a, end: b, threshold, criteria });
            }
            if (end === n) break;
        }
        return { events, thresholds, counts, rmsWindowSamples: width, screened };
    },

    // shared tail of the simple threshold detectors: runs above a per-epoch threshold, merged, then a minimum duration
    thresholdEvents(energy, sampleRate, params, thresholdFor, labels) {
        const n = energy.length;
        const epoch = Math.max(Math.round(params.epochSec * sampleRate), Math.round(10 * sampleRate));
        const counts = { crossings: 0, duration: 0 };
        const thresholds = [];
        const events = [];
        const screened = [];
        for (let start = 0; start < n; start += epoch) {
            const end = n - (start + epoch) < epoch / 3 ? n : Math.min(n, start + epoch);
            const threshold = thresholdFor(start, end);
            thresholds.push({ start: start / sampleRate, end: end / sampleRate, threshold: threshold.value });
            const runs = this.mergeRuns(this.findRuns(energy, threshold.value, start, end), Math.round((params.mergeGapMs || 0) / 1000 * sampleRate));
            counts.crossings += runs.length;
            for (const [a, b] of runs) {
                let peak = 0;
                for (let i = a; i < b; i++) peak = Math.max(peak, energy[i]);
                const durationMs = (b - a) / sampleRate * 1000;
                const criteria = [
                    this.criterion('energy', labels.energy, peak / threshold.value, '× threshold', `> 1 (${threshold.rule})`, true),
                    this.criterion('duration', 'Duration', durationMs, 'ms', `≥ ${params.minDurationMs} ms`, durationMs >= params.minDurationMs)
                ];
                if (durationMs < params.minDurationMs) { counts.duration++; continue; }
                events.push({ start: a, end: b, threshold: threshold.value, criteria });
            }
            if (end === n) break;
        }
        return { events, thresholds, counts, screened };
    },

    detectHilbert(context) {
        const { filtered, sampleRate, params } = context;
        const envelope = this.hilbertEnvelope(filtered);
        return this.thresholdEvents(envelope, sampleRate, params, (start, end) => {
            const stats = this.meanStd(envelope, start, end);
            return { value: stats.mean + params.thresholdSd * stats.std, rule: `mean + ${params.thresholdSd} SD of the envelope` };
        }, { energy: 'Envelope peak' });
    },

    detectLineLength(context) {
        const { notched, sampleRate, params, band } = context;
        // first difference whitens the 1/f background before band-passing (RIPPLELAB SLL)
        const differenced = new Float64Array(notched.length);
        for (let i = 1; i < notched.length; i++) differenced[i] = notched[i] - notched[i - 1];
        differenced[0] = differenced[1] || 0;
        const filtered = this.bandpass(differenced, sampleRate, band.low, band.high);
        let width = Math.round(params.windowMs / 1000 * sampleRate);
        width = Math.max(3, width);
        const lineLength = this.movingLineLength(filtered, width);
        const result = this.thresholdEvents(lineLength, sampleRate, params, (start, end) => ({
            value: this.percentile(lineLength.subarray(start, end), params.thresholdPercentile),
            rule: `P${params.thresholdPercentile} of the epoch's line length`
        }), { energy: 'Line-length peak' });
        result.windowSamples = width;
        return result;
    },

    // sum of absolute first differences over a centred window, normalised by window length
    movingLineLength(signal, width) {
        const n = signal.length;
        const w = Math.max(2, Math.round(width));
        const half = Math.floor(w / 2);
        const prefix = new Float64Array(n + 1);
        for (let i = 1; i < n; i++) prefix[i + 1] = prefix[i] + Math.abs(signal[i] - signal[i - 1]);
        const out = new Float64Array(n);
        for (let i = 0; i < n; i++) {
            const a = Math.max(1, i - half);
            const b = Math.min(n, a + w - 1);
            out[i] = (prefix[b] - prefix[a]) / Math.max(1, b - a);
        }
        return out;
    },

    // ---------- MNI (Zelmann 2012) ----------

    // fraction of a segment's in-band wavelet power at each scale, from |X(f)|^4 (Wiener–Khinchin: the
    // autocorrelation's spectrum is |X|^2), normalised so white noise gives equal weight to every scale
    wellBaselineMask(filtered, sampleRate, band, params) {
        const n = filtered.length;
        const length = Math.max(8, Math.round(params.segmentMs / 1000 * sampleRate));
        const hop = Math.max(1, Math.round(length / 2));
        const size = 1 << Math.ceil(Math.log2(2 * length));
        const freqs = [];
        for (let f = band.low; f <= band.high + 1e-9; f += 5) freqs.push(f);
        const mask = new Uint8Array(n);
        if (freqs.length < 3) return { mask, scales: freqs.length, baselineSeconds: 0 };
        const bins = [];
        for (let k = 1; k < size / 2; k++) bins.push(k * sampleRate / size);
        const kernels = freqs.map(f => {
            const sigmaF = f / (6 * Math.PI);
            const weights = bins.map(bin => Math.exp(-((bin - f) ** 2) / (sigmaF * sigmaF)));
            const total = weights.reduce((sum, value) => sum + value, 0) || 1;
            return weights.map(value => value / total);
        });
        const limit = params.entropyRatio * Math.log(freqs.length);
        const re = new Float64Array(size);
        const im = new Float64Array(size);
        const power = new Float64Array(bins.length);
        for (let start = 0; start + length <= n; start += hop) {
            re.fill(0);
            im.fill(0);
            for (let i = 0; i < length; i++) re[i] = filtered[start + i];
            this.fftComplex(re, im, false);
            for (let k = 0; k < bins.length; k++) {
                const p = re[k + 1] * re[k + 1] + im[k + 1] * im[k + 1];
                power[k] = p * p;
            }
            const scalePower = kernels.map(kernel => {
                let sum = 0;
                for (let k = 0; k < kernel.length; k++) sum += kernel[k] * power[k];
                return sum;
            });
            const total = scalePower.reduce((sum, value) => sum + value, 0);
            if (!(total > 0)) continue;
            let entropy = 0;
            for (const value of scalePower) {
                const share = value / total;
                if (share > 0) entropy -= share * Math.log(share);
            }
            if (entropy > limit) mask.fill(1, start, start + length);
        }
        let count = 0;
        for (let i = 0; i < n; i++) count += mask[i];
        return { mask, scales: freqs.length, baselineSeconds: count / sampleRate };
    },

    detectMni(context) {
        const { filtered, sampleRate, params, band } = context;
        const n = filtered.length;
        const baseline = this.wellBaselineMask(filtered, sampleRate, band, params);
        const minutes = n / sampleRate / 60;
        const baselineMode = baseline.scales >= 3 && baseline.baselineSeconds >= params.minBaselineSec * minutes;
        let width = Math.round((baselineMode ? 0.010 : 0.005) * sampleRate);
        width = Math.max(3, width % 2 === 0 ? width + 1 : width);
        const energy = this.movingRMS(filtered, width);
        const threshold = new Float64Array(n).fill(Infinity);
        const thresholds = [];

        if (baselineMode) {
            // close an epoch each time enough baseline has accumulated; a short remainder joins the last epoch
            const needed = Math.round(params.baselineEpochSec * sampleRate);
            let epochStart = 0;
            let indices = [];
            const finish = (end, sampleIndices) => {
                const fit = this.gamma.fit(energy, sampleIndices);
                const value = fit ? this.gamma.quantile(params.percentile / 100, fit) : Infinity;
                threshold.fill(value, epochStart, end);
                thresholds.push({ start: epochStart / sampleRate, end: end / sampleRate, threshold: value, mode: 'baseline', shape: fit?.k ?? null });
            };
            for (let i = 0; i < n; i++) {
                if (baseline.mask[i]) indices.push(i);
                if (indices.length >= needed && n - i > needed / 2) {
                    finish(i + 1, indices);
                    epochStart = i + 1;
                    indices = [];
                }
            }
            if (epochStart < n) {
                if (indices.length < needed / 2 && thresholds.length) {
                    const last = thresholds[thresholds.length - 1];
                    threshold.fill(last.threshold, epochStart, n);
                    last.end = n / sampleRate;
                } else finish(n, indices);
            }
        } else {
            const epoch = Math.round(60 * sampleRate);
            const minRun = params.minDurationMs / 1000 * sampleRate;
            for (let start = 0; start < n; start += epoch) {
                const end = n - (start + epoch) < epoch / 3 ? n : Math.min(n, start + epoch);
                const keep = new Uint8Array(end - start).fill(1);
                let value = Infinity;
                for (let iteration = 0; iteration < 20; iteration++) {
                    const indices = [];
                    for (let i = start; i < end; i++) if (keep[i - start]) indices.push(i);
                    const fit = this.gamma.fit(energy, indices);
                    if (!fit) break;
                    value = this.gamma.quantile(params.chfPercentile / 100, fit);
                    let removed = 0;
                    for (const [a, b] of this.findRuns(energy, value, start, end)) {
                        if (b - a <= minRun) continue;
                        keep.fill(0, a - start, b - start);
                        removed++;
                    }
                    if (!removed) break;
                }
                threshold.fill(value, start, end);
                thresholds.push({ start: start / sampleRate, end: end / sampleRate, threshold: value, mode: 'continuous high frequency' });
                if (end === n) break;
            }
        }

        // duration first, then merging, as in the reference implementation
        const minRun = params.minDurationMs / 1000 * sampleRate;
        const counts = { crossings: 0, duration: 0 };
        const raw = this.findRuns(energy, threshold);
        counts.crossings = raw.length;
        const long = raw.filter(([a, b]) => b - a > minRun);
        counts.duration = raw.length - long.length;
        const merged = this.mergeRuns(long, Math.round(params.mergeGapMs / 1000 * sampleRate));
        const modeText = baselineMode
            ? `baseline mode: ${baseline.baselineSeconds.toFixed(0)} s of noise-like baseline`
            : baseline.scales < 3 ? 'continuous mode: band too narrow for the entropy test' : `continuous mode: only ${baseline.baselineSeconds.toFixed(0)} s of baseline`;
        const events = merged.map(([start, end]) => {
            let peak = 0;
            let limit = Infinity;
            for (let i = start; i < end; i++) {
                if (energy[i] > peak) { peak = energy[i]; limit = threshold[i]; }
            }
            return {
                start,
                end,
                threshold: limit,
                criteria: [
                    this.criterion('mode', 'Threshold source', baselineMode ? 1 : 0, '', modeText, true),
                    this.criterion('energy', 'RMS peak', peak / limit, '× threshold', `> 1 (gamma P${baselineMode ? params.percentile : params.chfPercentile})`, true),
                    this.criterion('duration', 'Duration', (end - start) / sampleRate * 1000, 'ms', `> ${params.minDurationMs} ms`, true)
                ]
            };
        });
        return { events, thresholds, counts, screened: [], baselineMode, baselineSeconds: baseline.baselineSeconds };
    },

    // ---------- CS (Cimbálník–Stead 2018, epycom beta constants) ----------

    csConstants: {
        starts: [44, 52, 62, 73, 86, 102, 121, 143, 169, 199, 237, 280, 332, 392, 464, 549, 650],
        centres: [52, 62, 73, 86, 102, 121, 143, 169, 199, 237, 280, 332, 392, 464, 549, 650, 769],
        stops: [62, 73, 86, 102, 121, 143, 169, 199, 237, 280, 332, 392, 464, 549, 650, 769, 909],
        amp: {
            k: [1.13970939, 0.90183703, 1.26436011, 1.03769074, 0.85849874, 0.94987266, 0.80845992, 1.67940963, 1.04080418, 1.24382275, 1.60240884, 1.10695014, 1.17010383, 0.88196648, 1.04245538, 0.70917389, 2.21536184],
            theta: [1.65277574, 3.48530721, 2.98961385, 11.54210813, 18.93869204, 10.11982852, 10.53609476, 5.91562993, 11.09205920, 8.84505258, 6.92641365, 18.89938640, 23.76501855, 30.42839963, 27.30653900, 22.48544327, 0.08329301],
            offset: [6.41469207, 6.39345582, 6.40000914, 7.32380252, 8.32055181, 8.58559154, 8.27742490, 9.97358643, 10.49550234, 12.41888242, 15.86698463, 21.34769474, 21.89082728, 17.18456284, 18.93825748, 16.30660646, 7.69330283]
        },
        fhom: {
            k: [1.66197234, 1.00540463, 1.79692941, 1.15586041, 1.02455216, 1.21727010, 1.12610054, 0.70076969, 0.98379084, 1.54577304, 1.51861533, 1.23976157, 1.43199934, 1.17238163, 0.58636256, 1.12205645, 0.09508500],
            theta: [4.71109440, 6.05698300, 3.84238418, 6.23370380, 7.89603172, 7.87712768, 8.45272550, 10.00101086, 6.58376596, 3.53488296, 5.27183305, 6.36805821, 7.56839088, 8.24757240, 14.90634368, 18.85016717, 260.59793175],
            offset: [8.16878678, 10.55275451, 8.07166998, 8.07086829, 8.94105317, 7.75703706, 7.89853517, 7.14019430, 8.17322770, 8.55596745, 6.90226263, 7.17550663, 7.77665423, 9.07663424, 14.82474643, 20.20094041, 17.71110000]
        },
        prod: {
            k: [0.84905609, 1.01954096, 1.58872304, 1.88690171, 1.27908635, 1.06280570, 0.92824868, 1.49057163, 1.38457279, 2.14489528, 1.35910370, 1.44452982, 1.89318549, 0.92291990, 0.97845756, 1.42279817, 0.09633877],
            theta: [5.84241875, 2.72996718, 3.68246691, 6.69128325, 10.43308700, 11.90997028, 13.04316866, 6.93301203, 8.31241387, 4.62399907, 7.32859575, 11.79756235, 12.32143937, 26.04107818, 17.76146131, 18.81871472, 195.40205368],
            offset: [16.32704840, 19.47650057, 16.18710622, 16.34553372, 19.25022797, 18.30852676, 18.15222002, 18.98117587, 19.84269749, 21.64225522, 24.19732683, 25.65335524, 26.52948797, 24.05945634, 38.10559556, 34.94781992, 20.41020467]
        },
        dur: {
            k: [0.94831016, 1.20644724, 1.19723676, 1.24834990, 1.72876216, 1.88991915, 1.45709687, 1.76097598, 1.42626762, 1.81104799, 2.09379726, 2.28979796, 1.92883462, 2.15155894, 1.14187099, 1.42071107, 0.38495461],
            theta: [0.04543605, 0.04113687, 0.03842913, 0.03390445, 0.02099894, 0.01687568, 0.01622539, 0.00794505, 0.00857187, 0.00499798, 0.00489236, 0.00462047, 0.00532479, 0.00263985, 0.00623849, 0.01249162, 0.00115305],
            offset: [0.10320000, 0.09316255, 0.06500000, 0.05480000, 0.04420000, 0.03220000, 0.02820000, 0.02580000, 0.02291436, 0.01940000, 0.01760000, 0.01500000, 0.01180000, 0.01000000, 0.01180000, 0.01500000, 0.00844698]
        }
    },

    csBands(sampleRate, band) {
        const constants = this.csConstants;
        const ceiling = Math.min(sampleRate / 2 - 1, this.usableCeiling(sampleRate));
        return constants.starts.map((start, index) => ({ index, start, centre: constants.centres[index], stop: constants.stops[index] }))
            .filter(item => item.stop <= ceiling && item.centre >= band.low && item.centre <= band.high);
    },

    csBounds(feature, index, cdf) {
        const table = this.csConstants[feature];
        const scale = p => this.gamma.inverse(table.k[index], p) * table.theta[index] + table.offset[index];
        return { min: scale(cdf), max: 5 * scale(0.99) };
    },

    // (v − q2) / ((q2 − q1) / 2) with q1, q2 at the 33rd and 67th percentiles, per window
    csNormalise(values, window) {
        const n = values.length;
        const out = new Float64Array(n);
        for (let start = 0; start < n; start += window) {
            const end = n - (start + window) < window / 3 ? n : Math.min(n, start + window);
            const q1 = this.percentile(values.subarray(start, end), 100 / 3);
            const q2 = this.percentile(values.subarray(start, end), 200 / 3);
            const spread = (q2 - q1) / 2 || 1;
            for (let i = start; i < end; i++) out[i] = (values[i] - q2) / spread;
            if (end === n) break;
        }
        return out;
    },

    detectCs(context) {
        const { notched, sampleRate, params, band } = context;
        const n = notched.length;
        const bands = this.csBands(sampleRate, band);
        const counts = { crossings: 0, duration: 0, features: 0 };
        const window = Math.round(params.windowSec * sampleRate);
        const accepted = [];
        const screened = [];
        for (const item of bands) {
            const narrow = this.bandpass(notched, sampleRate, item.start, item.stop, 3);
            const broad = this.bandpass(notched, sampleRate, Math.max(1, item.centre / 4), item.stop, 3);
            const narrowAnalytic = this.analyticSignal(narrow);
            const broadAnalytic = this.analyticSignal(broad);
            const amplitude = new Float64Array(n);
            const signalPower = new Float64Array(n + 1);
            const noisePower = new Float64Array(n + 1);
            for (let i = 0; i < n; i++) {
                const re = narrowAnalytic.re[i];
                const im = narrowAnalytic.im[i];
                const magnitude = Math.hypot(re, im);
                amplitude[i] = magnitude;
                const cosNarrow = magnitude > 0 ? re / magnitude : 0;
                const broadMagnitude = Math.hypot(broadAnalytic.re[i], broadAnalytic.im[i]);
                const cosBroad = broadMagnitude > 0 ? broadAnalytic.re[i] / broadMagnitude : 0;
                signalPower[i + 1] = signalPower[i] + cosNarrow * cosNarrow;
                noisePower[i + 1] = noisePower[i] + (cosBroad - cosNarrow) ** 2;
            }
            const cycleSeconds = 4 / item.centre;
            const width = Math.max(3, Math.round(cycleSeconds * sampleRate));
            const half = Math.floor(width / 2);
            const dominance = new Float64Array(n);
            for (let i = 0; i < n; i++) {
                const a = Math.max(0, i - half);
                const b = Math.min(n, a + width);
                const noise = noisePower[b] - noisePower[a];
                dominance[i] = noise > 0 ? (signalPower[b] - signalPower[a]) / noise : 0;
            }
            const ampNorm = this.csNormalise(amplitude, window);
            const domNorm = this.csNormalise(dominance, window);
            const product = new Float64Array(n);
            for (let i = 0; i < n; i++) {
                const value = Math.sqrt(Math.abs(ampNorm[i] * domNorm[i]));
                product[i] = ampNorm[i] > 0 && domNorm[i] > 0 ? value : -value;
            }
            const prodNorm = this.csNormalise(product, window);
            const bounds = {
                dur: this.csBounds('dur', item.index, params.cdfThreshold),
                amp: this.csBounds('amp', item.index, params.cdfThreshold),
                fhom: this.csBounds('fhom', item.index, params.cdfThreshold),
                prod: this.csBounds('prod', item.index, params.cdfThreshold)
            };
            for (const [a, b] of this.findRuns(prodNorm, params.edgeThreshold)) {
                counts.crossings++;
                const duration = (b - a) / sampleRate;
                if (duration < bounds.dur.min || duration > bounds.dur.max) { counts.duration++; continue; }
                const scale = Math.sqrt(duration / cycleSeconds);
                let ampMean = 0;
                let domMean = 0;
                let prodMean = 0;
                for (let i = a; i < b; i++) { ampMean += ampNorm[i]; domMean += domNorm[i]; prodMean += prodNorm[i]; }
                ampMean = ampMean / (b - a) * scale;
                domMean = domMean / (b - a) * scale;
                prodMean = prodMean / (b - a) * scale;
                const inside = (value, range) => value >= range.min && value <= range.max;
                const criteria = [
                    this.criterion('subBand', 'Sub-band', item.centre, 'Hz', `${item.start}–${item.stop} Hz`, true),
                    this.criterion('duration', 'Duration', duration * 1000, 'ms', `${(bounds.dur.min * 1000).toFixed(0)}–${(bounds.dur.max * 1000).toFixed(0)} ms`, true),
                    this.criterion('amplitude', 'Amplitude score', ampMean, '', `${bounds.amp.min.toFixed(1)}–${bounds.amp.max.toFixed(0)}`, inside(ampMean, bounds.amp)),
                    this.criterion('dominance', 'Frequency dominance', domMean, '', `${bounds.fhom.min.toFixed(1)}–${bounds.fhom.max.toFixed(0)}`, inside(domMean, bounds.fhom)),
                    this.criterion('product', 'Combined score', prodMean, '', `${bounds.prod.min.toFixed(1)}–${bounds.prod.max.toFixed(0)}`, inside(prodMean, bounds.prod))
                ];
                if (!(inside(ampMean, bounds.amp) && inside(domMean, bounds.fhom) && inside(prodMean, bounds.prod))) {
                    counts.features++;
                    this.screen(screened, a, b, 'features', `outside the CS feature bounds in ${item.start}–${item.stop} Hz`, criteria);
                    continue;
                }
                accepted.push({ start: a, end: b, criteria, band: item });
            }
        }
        // detections that overlap across sub-bands form one conglomerate
        accepted.sort((x, y) => x.start - y.start);
        const events = [];
        for (const detection of accepted) {
            const last = events[events.length - 1];
            if (last && detection.start <= last.end) {
                last.end = Math.max(last.end, detection.end);
                last.bands.push(detection.band);
            } else {
                events.push({ start: detection.start, end: detection.end, criteria: detection.criteria, bands: [detection.band] });
            }
        }
        for (const event of events) {
            const low = Math.min(...event.bands.map(item => item.start));
            const high = Math.max(...event.bands.map(item => item.stop));
            event.criteria = [this.criterion('bands', 'Sub-bands joined', event.bands.length, '', `${low}–${high} Hz`, true), ...event.criteria];
            event.subBand = [low, high];
        }
        return { events, thresholds: [], counts, screened, subBands: bands.map(item => [item.start, item.stop]) };
    },

    // ---------- spike-ripple (Chu 2017) ----------

    seededRandom(seed) {
        let state = seed >>> 0;
        return () => {
            state = (state + 0x6D2B79F5) >>> 0;
            let t = state;
            t = Math.imul(t ^ (t >>> 15), t | 1);
            t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
            return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
        };
    },

    detectSpikeRipple(context) {
        const { notched, raw, sampleRate, params } = context;
        const n = notched.length;
        const ripple = this.bandpass(notched, sampleRate, 100, Math.min(300, this.hardCeiling(sampleRate)));
        const envelope = this.hilbertEnvelope(ripple);
        const threshold = this.percentile(envelope, params.envelopePercentile);
        const counts = { crossings: 0, duration: 0, cycles: 0, regularity: 0, spike: 0 };
        const screened = [];
        const edge = Math.round(sampleRate);
        const runs = this.mergeRuns(this.findRuns(envelope, threshold), Math.round(0.005 * sampleRate))
            .filter(([a, b]) => a > edge && b < n - edge);
        counts.crossings = runs.length;

        // spike context: smoothed raw signal, its high percentile, and a bootstrap of normal 50 ms deflections
        const smoothWidth = Math.max(1, Math.round(11 / 2035 * sampleRate));
        const smooth = new Float64Array(n);
        let running = 0;
        for (let i = 0; i < n; i++) {
            running += raw[i];
            if (i >= smoothWidth) running -= raw[i - smoothWidth];
            smooth[Math.max(0, i - Math.floor(smoothWidth / 2))] = running / Math.min(i + 1, smoothWidth);
        }
        const centred = this.meanStd(smooth).mean;
        const magnitude = Float64Array.from(smooth, value => Math.abs(value - centred));
        const heightLimit = this.percentile(magnitude, params.spikePercentile);
        const span = Math.round(0.05 * sampleRate);
        const random = this.seededRandom(20171);
        const rises = new Float64Array(4000);
        for (let j = 0; j < rises.length; j++) {
            const i = Math.floor(random() * (n - span - 1));
            let peak = 0;
            for (let k = i; k < i + span; k++) peak = Math.max(peak, magnitude[k]);
            rises[j] = peak - magnitude[i];
        }
        const riseLimit = this.percentile(rises, 95);
        const events = [];
        for (const [a, b] of runs) {
            const durationMs = (b - a) / sampleRate * 1000;
            const criteria = [this.criterion('duration', 'Ripple duration', durationMs, 'ms', `> ${params.minDurationMs} ms`, durationMs > params.minDurationMs)];
            if (durationMs <= params.minDurationMs) { counts.duration++; continue; }
            let mean = 0;
            for (let i = a; i < b; i++) mean += ripple[i];
            mean /= b - a;
            const crossings = [];
            for (let i = a + 1; i < b; i++) if (ripple[i - 1] - mean < 0 && ripple[i] - mean >= 0) crossings.push(i);
            criteria.push(this.criterion('cycles', 'Ripple cycles', crossings.length, '', `≥ ${params.minCycles}`, crossings.length >= params.minCycles));
            if (crossings.length < params.minCycles) { counts.cycles++; this.screen(screened, a, b, 'cycles', 'too few ripple cycles', criteria); continue; }
            const intervals = crossings.slice(1).map((value, index) => (value - crossings[index]) * 2035 / sampleRate);
            const intervalStats = this.meanStd(Float64Array.from(intervals));
            const fano = intervalStats.mean > 0 ? intervalStats.std ** 2 / intervalStats.mean : Infinity;
            criteria.push(this.criterion('regularity', 'Fano factor of cycles', fano, '', `< ${params.maxFano}`, fano < params.maxFano));
            if (!(fano < params.maxFano)) { counts.regularity++; this.screen(screened, a, b, 'regularity', 'irregular cycles', criteria); continue; }

            const centre = Math.round((a + b) / 2);
            const from = Math.max(0, centre - span);
            const to = Math.min(n - 1, centre + span);
            let peakIndex = from;
            for (let i = from; i <= to; i++) if (magnitude[i] > magnitude[peakIndex]) peakIndex = i;
            const peak = magnitude[peakIndex];
            const riseBefore = peak - magnitude[from];
            const fallAfter = peak - magnitude[to];
            const spikeOk = peak > heightLimit && riseBefore > riseLimit && fallAfter > riseLimit && a < peakIndex;
            criteria.push(
                this.criterion('spikeHeight', 'Spike peak', peak, 'µV', `> ${heightLimit.toFixed(1)} µV (P${params.spikePercentile})`, peak > heightLimit),
                this.criterion('spikeShape', 'Rise and fall', Math.min(riseBefore, fallAfter), 'µV', `> ${riseLimit.toFixed(1)} µV (bootstrap P95)`, riseBefore > riseLimit && fallAfter > riseLimit),
                this.criterion('timing', 'Ripple starts before spike peak', (peakIndex - a) / sampleRate * 1000, 'ms', '> 0 ms', a < peakIndex)
            );
            if (!spikeOk) { counts.spike++; this.screen(screened, a, b, 'spike', 'no spike under the ripple', criteria); continue; }
            events.push({ start: a, end: b, criteria, spikePeak: peakIndex });
        }
        return { events, thresholds: [{ start: 0, end: n / sampleRate, threshold }], counts, screened };
    },

    _ringingCache: {},

    // half-amplitude width of the zero-phase band-pass impulse response: how much a burst is stretched
    ringingSeconds(sampleRate, low, high) {
        const key = `${sampleRate}|${low}|${high}`;
        if (this._ringingCache[key] === undefined) this._ringingCache[key] = this._measureRinging(sampleRate, low, high);
        return this._ringingCache[key];
    },

    _measureRinging(sampleRate, low, high) {
        const length = Math.round(1.5 * sampleRate);
        const impulse = new Float64Array(length);
        impulse[Math.floor(length / 2)] = 1;
        const envelope = this.hilbertEnvelope(this.bandpass(impulse, sampleRate, low, high));
        let peak = 0;
        for (const value of envelope) peak = Math.max(peak, value);
        let first = -1;
        let last = -1;
        for (let i = 0; i < length; i++) {
            if (envelope[i] >= 0.5 * peak) {
                if (first < 0) first = i;
                last = i;
            }
        }
        return first < 0 ? 0 : (last - first) / sampleRate;
    },

    detectEllenrieder(context) {
        const { notched, sampleRate, params, band } = context;
        const n = notched.length;
        const subBands = [];
        for (let low = band.low; low + 10 <= band.high + 1e-9; low += 10) subBands.push([low, low + 10]);
        if (!subBands.length) subBands.push([band.low, band.high]);
        const alpha = 1 / Math.max(1, params.backgroundSec * sampleRate);
        const counts = { crossings: 0, duration: 0, ratio: 0, rms: 0 };
        const runs = [];
        const narrow = [];
        for (const [low, high] of subBands) {
            const filtered = this.bandpass(notched, sampleRate, low, high);
            narrow.push({ low, high, filtered });
            const center = (low + high) / 2;
            const rms = this.movingRMS(filtered, Math.round(4 / center * sampleRate));
            const warmup = Math.min(n, Math.round(params.backgroundSec * sampleRate));
            let background = this.percentile(rms.subarray(0, Math.max(1, warmup)), 50);
            const above = new Uint8Array(n);
            for (let i = 0; i < n; i++) {
                const limit = params.thresholdFactor * background;
                above[i] = rms[i] > limit ? 1 : 0;
                background += alpha * (Math.min(rms[i], limit) - background);
            }
            const minLength = (params.minCycles / center + this.ringingSeconds(sampleRate, low, high)) * sampleRate;
            const found = this.findRuns(above, 0.5);
            counts.crossings += found.length;
            for (const [a, b] of found) {
                if (b - a < minLength) { counts.duration++; continue; }
                runs.push([a, b]);
            }
        }
        const merged = this.mergeRuns(runs, Math.round(params.mergeGapMs / 1000 * sampleRate));
        const wideLow = Math.max(1, band.low - 5);
        const wideHigh = Math.min(this.hardCeiling(sampleRate), band.high + 5);
        const wide = this.bandpass(notched, sampleRate, wideLow, wideHigh);
        const events = [];
        const screened = [];
        for (const [start, end] of merged) {
            let best = null;
            for (const sub of narrow) {
                let squares = 0;
                let maxAbs = 0;
                for (let i = start; i < end; i++) {
                    squares += sub.filtered[i] * sub.filtered[i];
                    maxAbs = Math.max(maxAbs, Math.abs(sub.filtered[i]));
                }
                const rms = Math.sqrt(squares / Math.max(1, end - start));
                if (!best || rms > best.rms) best = { rms, maxAbs, low: sub.low, high: sub.high };
            }
            let wideMax = 0;
            for (let i = start; i < end; i++) wideMax = Math.max(wideMax, Math.abs(wide[i]));
            const ratio = best.maxAbs > 0 ? wideMax / best.maxAbs : Infinity;
            const criteria = [
                this.criterion('subBand', 'Strongest sub-band', (best.low + best.high) / 2, 'Hz', `${best.low}–${best.high} Hz above ${params.thresholdFactor}× its background`, true),
                this.criterion('duration', 'Duration', (end - start) / sampleRate * 1000, 'ms', `≥ ${params.minCycles} cycles + filter ringing`, true),
                this.criterion('wideRatio', 'Wide / narrow peak', ratio, '', `< ${params.maxWideRatio}`, ratio < params.maxWideRatio),
                this.criterion('narrowRms', 'Sub-band RMS', best.rms, 'µV', `> ${params.minNarrowRmsUv} µV`, best.rms > params.minNarrowRmsUv)
            ];
            if (ratio >= params.maxWideRatio) { counts.ratio++; this.screen(screened, start, end, 'ratio', 'broadband activity (transient or muscle)', criteria); continue; }
            if (best.rms <= params.minNarrowRmsUv) { counts.rms++; this.screen(screened, start, end, 'rms', 'sub-band activity too weak', criteria); continue; }
            events.push({ start, end, subBand: [best.low, best.high], wideRatio: ratio, narrowRms: best.rms, criteria });
        }
        return { events, thresholds: [], counts, subBands, screened };
    },

    // ---------- per channel ----------

    // filtering shared by every detector run on one channel and band
    prepareChannel(raw, sampleRate, config) {
        const { band } = config;
        const notches = config.notches || [];
        const notched = notches.length ? this.notch(raw, sampleRate, notches.map(item => item.frequency)) : raw;
        const filtered = this.bandpass(notched, sampleRate, band.low, band.high);
        const lineComponents = config.lineComponents || notches.map(item => item.frequency);
        // slopes are judged below the HFO band so high-frequency noise does not mask a spike
        const slow = EEGAnalysis.butterworth(raw, sampleRate, 0, Math.min(70, band.low * 0.8), 4, 'lowpass');
        return {
            raw,
            notched,
            filtered,
            sampleRate,
            band,
            filteredStats: this.meanStd(filtered),
            lineComponents,
            lineFrequency: config.lineFrequency || null,
            bandLimited: Boolean(config.bandLimited),
            masks: [
                ...(config.lineFrequency ? [{ low: config.lineFrequency - 5, high: config.lineFrequency + 5 }] : []),
                ...lineComponents.map(frequency => ({ low: frequency - 2, high: frequency + 2 }))
            ],
            slow,
            sharpness: this.derivativeScale(slow)
        };
    },

    // one detector on an already prepared channel; returns events with features, near-misses and stats
    runPrepared(prepared, detector, params) {
        const { raw, notched, filtered, sampleRate, band, masks, filteredStats } = prepared;
        const definition = this.detectors[detector] || this.detectors[this.defaultDetector];
        const result = this[definition.runner]({ raw, notched, filtered, sampleRate, params, band, masks, prepared });
        const events = result.events.map(event => ({
            start: event.start,
            end: event.end,
            features: this.featuresFor(prepared, event)
        }));
        return {
            events,
            screened: (result.screened || []).map(item => ({ start: item.start, end: item.end, stage: item.stage, reason: item.reason, criteria: item.criteria })),
            stats: {
                filteredStd: filteredStats.std,
                thresholds: result.thresholds,
                screening: result.counts,
                rmsWindowSamples: result.rmsWindowSamples,
                subBands: result.subBands
            }
        };
    },

    featuresFor(prepared, event) {
        const { raw, filtered, sampleRate, band, filteredStats, lineComponents } = prepared;
        const features = this.describeEvent(raw, filtered, event.start, event.end, sampleRate, band, { backgroundStd: filteredStats.std });
        // every detector gets the Burnos spectral measurements so classes are comparable across methods
        let spectral = event.spectral;
        if (!spectral) {
            let peak = event.start;
            for (let i = event.start; i < event.end; i++) if (Math.abs(filtered[i]) > Math.abs(filtered[peak])) peak = i;
            spectral = this.spectralCheck(prepared.notched, peak, sampleRate, band, prepared.masks, { troughRatio: 0.8, peakRatio: 0.5 });
        }
        if (spectral?.peakFrequency) features.spectralPeakFrequency = spectral.peakFrequency;
        if (Number.isFinite(spectral?.troughRatio)) features.troughRatio = spectral.troughRatio;
        if (Number.isFinite(spectral?.peakRatio)) features.peakRatio = spectral.peakRatio;
        if (Number.isFinite(event.snr)) features.snr = event.snr;
        if (event.subBand) features.subBand = event.subBand;
        if (event.wideRatio !== undefined) features.wideRatio = event.wideRatio;
        if (event.threshold !== undefined) features.threshold = event.threshold;
        features.criteria = event.criteria || [];
        features.flags = [];
        const frequency = features.peakFrequency;
        if (frequency && lineComponents.some(component => Math.abs(component - frequency) <= 2)) {
            features.flags.push('near a line-noise frequency');
        }
        if (this.nearSharpTransient(prepared.slow, event.start, event.end, sampleRate, prepared.sharpness)) {
            features.flags.push('near a sharp transient');
        }
        if (prepared.bandLimited) features.flags.push('band-limited');
        return features;
    },

    detectChannel(raw, sampleRate, config) {
        const prepared = this.prepareChannel(raw, sampleRate, config);
        if (config.detector === 'consensus') return this.detectConsensus(prepared, config.consensus);
        return this.runPrepared(prepared, config.detector, config.params);
    },

    // ---------- consensus across detectors ----------

    consensusDefaults() {
        return { members: ['zurich', 'ste', 'ellenrieder'], minAgreement: 2, toleranceMs: 0 };
    },

    // every member detector runs on the same filtered channel. A k-of-n coverage sweep keeps the stretches
    // where at least k detectors are active at once, so one long detection cannot chain unrelated events
    // together; stretches some detectors found but fewer than k become near-misses (pyHFO-style support).
    detectConsensus(prepared, consensus) {
        const { sampleRate } = prepared;
        const members = consensus.members.filter(member => this.detectors[member.detector]);
        const k = Math.max(1, Math.min(members.length, consensus.minAgreement));
        const tolerance = Math.round((consensus.toleranceMs || 0) / 1000 * sampleRate);
        const memberStats = {};
        const screening = { crossings: 0, agreement: 0 };
        const byDetector = new Map();
        const points = [];
        members.forEach(member => {
            const result = this.runPrepared(prepared, member.detector, member.params);
            memberStats[member.detector] = { events: result.events.length, screening: result.stats.screening };
            screening.crossings += result.events.length;
            byDetector.set(member.detector, result.events);
            // a detector's own overlapping events count once
            const own = this.mergeRuns(result.events.map(event => [event.start - tolerance, event.end + tolerance]), 1);
            for (const [start, end] of own) {
                points.push([start, 1, member.detector], [end, -1, member.detector]);
            }
        });
        points.sort((x, y) => x[0] - y[0] || x[1] - y[1]);

        const active = new Map();
        let count = 0;
        let agreedStart = -1;
        let anyStart = -1;
        let reachedK = false;
        const agreed = [];
        const unions = [];
        for (const [position, change, detector] of points) {
            const before = active.get(detector) || 0;
            const after = before + change;
            active.set(detector, after);
            if (before === 0 && after > 0) count++;
            if (before > 0 && after === 0) count--;
            if (count >= 1 && anyStart < 0) { anyStart = position; reachedK = false; }
            if (count >= k && agreedStart < 0) { agreedStart = position; reachedK = true; }
            if (count < k && agreedStart >= 0) { agreed.push([agreedStart, position]); agreedStart = -1; }
            if (count === 0 && anyStart >= 0) { unions.push({ start: anyStart, end: position, reachedK }); anyStart = -1; }
        }
        const eroded = agreed
            .map(([start, end]) => [start + tolerance, end - tolerance])
            .filter(([start, end]) => end > start);
        const intervals = this.mergeRuns(eroded, Math.round(0.010 * sampleRate));
        const order = members.map(member => member.detector);
        const overlapping = (detector, start, end) => (byDetector.get(detector) || []).filter(event => event.start < end && event.end > start);

        const events = intervals.map(([start, end]) => {
            const foundBy = order.filter(detector => overlapping(detector, start, end).length);
            const criteriaByDetector = {};
            let unionStart = start;
            let unionEnd = end;
            const flags = new Set();
            for (const detector of foundBy) {
                const hits = overlapping(detector, start, end);
                criteriaByDetector[detector] = hits[0].features.criteria;
                for (const hit of hits) {
                    unionStart = Math.min(unionStart, hit.start);
                    unionEnd = Math.max(unionEnd, hit.end);
                    for (const flag of hit.features.flags || []) flags.add(flag);
                }
            }
            const criteria = [this.criterion('agreement', 'Detectors in agreement', foundBy.length, `of ${order.length}`, `≥ ${k} at the same time`, foundBy.length >= k)];
            const features = this.featuresFor(prepared, { start, end, criteria });
            const lead = overlapping(foundBy[0], start, end)[0];
            for (const key of ['spectralPeakFrequency', 'troughRatio', 'peakRatio', 'snr', 'subBand', 'wideRatio']) {
                if (lead?.features[key] !== undefined) features[key] = lead.features[key];
            }
            features.foundBy = foundBy;
            features.agreement = foundBy.length;
            features.criteriaByDetector = criteriaByDetector;
            features.unionOnset = unionStart / sampleRate;
            features.unionOffset = unionEnd / sampleRate;
            features.flags = Array.from(new Set([...features.flags, ...flags]));
            return { start, end, features };
        });

        const screened = [];
        for (const union of unions) {
            if (union.reachedK) continue;
            screening.agreement++;
            const foundBy = order.filter(detector => overlapping(detector, union.start + tolerance, union.end - tolerance).length);
            const criteria = [this.criterion('agreement', 'Detectors in agreement', foundBy.length, `of ${order.length}`, `≥ ${k} at the same time`, false)];
            this.screen(screened, Math.max(0, union.start + tolerance), union.end - tolerance, 'agreement', `found only by ${foundBy.map(key => this.detectors[key].short).join(', ') || 'one detector'}`, criteria);
        }
        return {
            events,
            screened,
            stats: {
                filteredStd: prepared.filteredStats.std,
                thresholds: [],
                screening,
                members: memberStats
            }
        };
    },

    // robust scale of the first difference, for spotting sharp transients
    derivativeScale(raw) {
        const step = Math.max(1, Math.floor(raw.length / 50000));
        const values = new Float64Array(Math.floor((raw.length - 1) / step));
        for (let i = 0; i < values.length; i++) {
            const index = (i + 1) * step;
            values[i] = Math.abs(raw[index] - raw[index - 1]);
        }
        return this.percentile(values, 50) * 1.4826 || 1;
    },

    nearSharpTransient(slow, start, end, sampleRate, scale) {
        const margin = Math.round(0.05 * sampleRate);
        let maxStep = 0;
        for (let i = Math.max(1, start - margin); i < Math.min(slow.length, end + margin); i++) {
            maxStep = Math.max(maxStep, Math.abs(slow[i] - slow[i - 1]));
        }
        return maxStep > 8 * scale;
    },

    // channels that carry the same signal (or its inverse), e.g. CHB-MIT repeats T8-P8 and stores P7-T7 = -T7-P7.
    // Returns [{ index, of, inverted }] for the later channel of each duplicate pair.
    findDuplicateChannels(channelData, sampleRate) {
        const length = Math.min(...channelData.map(signal => signal.length), Math.round(120 * sampleRate));
        const step = Math.max(1, Math.floor(length / 20000));
        const summaries = channelData.map(signal => {
            let sum = 0;
            let count = 0;
            for (let i = 0; i < length; i += step) { sum += signal[i]; count++; }
            const mean = sum / Math.max(1, count);
            let squares = 0;
            for (let i = 0; i < length; i += step) squares += (signal[i] - mean) ** 2;
            return { mean, norm: Math.sqrt(squares) };
        });
        const duplicates = [];
        for (let b = 1; b < channelData.length; b++) {
            if (!summaries[b].norm) continue;
            for (let a = 0; a < b; a++) {
                if (!summaries[a].norm || duplicates.some(item => item.index === a)) continue;
                let dot = 0;
                for (let i = 0; i < length; i += step) {
                    dot += (channelData[a][i] - summaries[a].mean) * (channelData[b][i] - summaries[b].mean);
                }
                const r = dot / (summaries[a].norm * summaries[b].norm);
                if (Math.abs(r) > 0.9995) {
                    duplicates.push({ index: b, of: a, inverted: r < 0 });
                    break;
                }
            }
        }
        return duplicates;
    },

    // events seen on at least half the analysed channels within ±25 ms are likely common-mode
    flagMultichannel(events, channelCount, sampleRate) {
        if (channelCount < 3) return;
        const window = 0.025;
        const sorted = events.slice().sort((a, b) => a.onset - b.onset);
        let left = 0;
        for (const event of sorted) {
            while (sorted[left].offset < event.onset - window) left++;
            const channels = new Set();
            for (let i = left; i < sorted.length && sorted[i].onset <= event.offset + window; i++) channels.add(sorted[i].channelIndex);
            if (channels.size >= Math.max(3, Math.ceil(channelCount / 2))) {
                event.features.flags = event.features.flags || [];
                if (!event.features.flags.some(flag => flag.startsWith('simultaneous'))) {
                    event.features.flags.push(`simultaneous on ${channels.size} channels`);
                }
            }
        }
    },

    // ---------- features ----------

    zeroCrossingFrequency(signal, start, end, sampleRate) {
        let crossings = 0;
        let first = -1;
        let last = -1;
        for (let i = start + 1; i < end; i++) {
            if ((signal[i - 1] < 0 && signal[i] >= 0) || (signal[i - 1] >= 0 && signal[i] < 0)) {
                const fraction = signal[i - 1] / (signal[i - 1] - signal[i]);
                const position = i - 1 + (Number.isFinite(fraction) ? fraction : 0);
                if (first < 0) first = position;
                last = position;
                crossings++;
            }
        }
        if (crossings < 2 || last <= first) return null;
        return ((crossings - 1) / 2) / ((last - first) / sampleRate);
    },

    describeEvent(raw, filtered, start, end, sampleRate, band, context) {
        let peakAmplitude = 0;
        let peakSample = start;
        for (let i = start; i < end; i++) {
            const value = Math.abs(filtered[i]);
            if (value > peakAmplitude) {
                peakAmplitude = value;
                peakSample = i;
            }
        }
        let rawMin = Infinity;
        let rawMax = -Infinity;
        let filteredMin = Infinity;
        let filteredMax = -Infinity;
        for (let i = start; i < end; i++) {
            rawMin = Math.min(rawMin, raw[i]);
            rawMax = Math.max(rawMax, raw[i]);
            filteredMin = Math.min(filteredMin, filtered[i]);
            filteredMax = Math.max(filteredMax, filtered[i]);
        }
        // dominant in-band frequency at the strongest sample; zero crossings get skewed by edge noise
        const spectrum = this.instantaneousSpectrum(filtered, peakSample, sampleRate, band.low, band.high, band.high - band.low > 180 ? 2 : 1);
        let frequency = null;
        let best = -Infinity;
        spectrum.freqs.forEach((f, index) => {
            if (spectrum.power[index] > best) {
                best = spectrum.power[index];
                frequency = f;
            }
        });
        const durationSeconds = (end - start) / sampleRate;
        // breadth of the in-band spectrum (0 = one frequency, 1 = flat), regularity of cycles, and flat (clipped) stretches
        const totalPower = spectrum.power.reduce((sum, value) => sum + value, 0);
        let entropy = 0;
        if (totalPower > 0) {
            for (const value of spectrum.power) {
                const share = value / totalPower;
                if (share > 0) entropy -= share * Math.log(share);
            }
            entropy /= Math.log(Math.max(2, spectrum.power.length));
        }
        const crossings = [];
        let mean = 0;
        for (let i = start; i < end; i++) mean += filtered[i];
        mean /= Math.max(1, end - start);
        for (let i = start + 1; i < end; i++) if (filtered[i - 1] - mean < 0 && filtered[i] - mean >= 0) crossings.push(i);
        const intervals = crossings.slice(1).map((value, index) => (value - crossings[index]) / sampleRate * 1000);
        let cycleFano = null;
        if (intervals.length >= 2) {
            const stats = this.meanStd(Float64Array.from(intervals));
            cycleFano = stats.mean > 0 ? stats.std * stats.std / stats.mean : null;
        }
        let flat = 0;
        let longestFlat = 0;
        for (let i = start + 1; i < end; i++) {
            flat = raw[i] === raw[i - 1] ? flat + 1 : 0;
            longestFlat = Math.max(longestFlat, flat);
        }
        return {
            spectralEntropy: entropy,
            cycleFano,
            flatMs: longestFlat / sampleRate * 1000,
            peakTime: (peakSample + (context.offsetSamples || 0)) / sampleRate,
            peakAmplitude,
            peakToPeak: filteredMax - filteredMin,
            peakFrequency: frequency,
            zeroCrossingFrequency: this.zeroCrossingFrequency(filtered, start, end, sampleRate),
            cycles: frequency ? frequency * durationSeconds : null,
            rawPeakToPeak: rawMax - rawMin,
            backgroundRatio: context.backgroundStd > 0 ? peakAmplitude / context.backgroundStd : null
        };
    },

    // ---------- interictal spikes (Janca et al. 2015, Brain Topogr 28:172) ----------
    // Resample to 200 Hz, band-pass 10–60 Hz, Hilbert envelope; in 5 s windows (1 s step) fit a log-normal
    // to the envelope and flag local maxima above k·(mode + median) = k·(e^(μ−σ²) + e^μ), k = 3.65.
    // Maxima closer than 120 ms keep the highest; the first and last second are ignored.
    detectSpikes(raw, sampleRate, options = {}) {
        const k = options.k || 3.65;
        const target = sampleRate >= 200 ? 200 : sampleRate;
        const high = Math.min(60, target * 0.4);
        const smoothed = sampleRate > target ? EEGAnalysis.butterworth(raw, sampleRate, 0, Math.min(high * 1.2, target * 0.45), 4, 'lowpass') : raw;
        const ratio = sampleRate / target;
        const length = Math.floor(raw.length / ratio);
        const resampled = new Float64Array(length);
        for (let i = 0; i < length; i++) {
            const position = i * ratio;
            const index = Math.floor(position);
            const fraction = position - index;
            resampled[i] = smoothed[index] * (1 - fraction) + (smoothed[Math.min(smoothed.length - 1, index + 1)] || 0) * fraction;
        }
        let signal = resampled;
        if (options.lineFrequency && options.lineFrequency <= 1.1 * 60 && options.lineFrequency < target / 2 - 2) {
            signal = this.notch(signal, target, [options.lineFrequency]);
        }
        if (length < target * 6) return [];
        const filtered = this.bandpass(signal, target, 10, high);
        const envelope = this.hilbertEnvelope(filtered);
        const logEnvelope = Float64Array.from(envelope, value => Math.log(Math.max(value, 1e-12)));
        const window = Math.round(5 * target);
        const step = Math.round(target);
        const centres = [];
        for (let start = 0; start + window <= length; start += step) {
            const stats = this.meanStd(logEnvelope, start, start + window);
            centres.push({ position: start + window / 2, value: k * (Math.exp(stats.mean - stats.std * stats.std) + Math.exp(stats.mean)) });
        }
        if (!centres.length) return [];
        const threshold = new Float64Array(length);
        let c = 0;
        for (let i = 0; i < length; i++) {
            while (c < centres.length - 1 && centres[c + 1].position <= i) c++;
            const a = centres[c];
            const b = centres[Math.min(centres.length - 1, c + 1)];
            if (i <= a.position || a === b) threshold[i] = a.value;
            else threshold[i] = a.value + (b.value - a.value) * (i - a.position) / (b.position - a.position);
        }
        const peaks = [];
        for (let i = target; i < length - target; i++) {
            if (envelope[i] > threshold[i] && envelope[i] >= envelope[i - 1] && envelope[i] > envelope[i + 1]) peaks.push(i);
        }
        const merged = [];
        const gap = Math.round(0.12 * target);
        for (const peak of peaks) {
            const last = merged[merged.length - 1];
            if (last !== undefined && peak - last < gap) {
                if (envelope[peak] > envelope[last]) merged[merged.length - 1] = peak;
            } else merged.push(peak);
        }
        return merged.map(index => ({ time: index / target, strength: envelope[index] / threshold[index] }));
    },

    // ---------- advisory event classes ----------
    // Labels guide review; they never remove candidates. Rule order follows the validation literature:
    // saturation, common-mode, line, muscle, false ripple (Bénar 2010; Burnos 2014), then HFO or spike-HFO.

    classifyEvent(event, context) {
        const features = event.features;
        const flags = features.flags || [];
        const artifacts = [];
        const evidence = [];
        if (features.flatMs >= 10) artifacts.push({ kind: 'saturation', reason: `flat for ${features.flatMs.toFixed(0)} ms (clipping)` });
        const simultaneous = flags.find(flag => flag.startsWith('simultaneous'));
        if (simultaneous) artifacts.push({ kind: 'common-mode', reason: simultaneous });
        if (flags.includes('near a line-noise frequency')) artifacts.push({ kind: 'line', reason: 'peak sits on a present line-noise frequency' });
        const durationMs = (event.offset - event.onset) * 1000;
        const broadband = (features.spectralEntropy ?? 0) > 0.85 || (features.wideRatio ?? 0) > 3;
        if (durationMs > 200 && broadband) artifacts.push({ kind: 'muscle', reason: `${durationMs.toFixed(0)} ms of broadband activity` });

        const noIsolatedPeak = (Number.isFinite(features.troughRatio) && features.troughRatio >= 0.8)
            || (Number.isFinite(features.peakRatio) && features.peakRatio <= 0.5);
        const transientHint = flags.includes('near a sharp transient')
            || (Number.isFinite(features.cycleFano) && features.cycleFano >= 1)
            || (Number.isFinite(features.cycles) && features.cycles < 3);
        if (noIsolatedPeak) evidence.push('no isolated spectral peak');
        if (flags.includes('near a sharp transient')) evidence.push('sharp transient nearby');
        if (Number.isFinite(features.cycleFano) && features.cycleFano >= 1) evidence.push('irregular cycles');

        const window = context.spikeWindow;
        const spike = (context.spikes || []).find(item => item.time >= event.onset - window && item.time <= event.offset + window);
        const spikeInfo = spike ? { associated: true, lagMs: Math.round((spike.time - event.onset) * 1000), windowMs: Math.round(window * 1000) } : { associated: false, windowMs: Math.round(window * 1000) };

        let primary = spike ? 'spike_hfo' : 'hfo';
        if (artifacts.length) primary = 'artifact';
        else if (noIsolatedPeak && transientHint) primary = 'false_ripple';

        const frequency = features.peakFrequency;
        let bandClass = null;
        if (Number.isFinite(frequency)) {
            bandClass = frequency < 80 ? 'below_ripple' : frequency < 250 ? 'ripple' : frequency < 500 ? 'fast_ripple' : 'very_fast';
            if ([80, 250, 500].some(edge => Math.abs(frequency - edge) <= 10)) bandClass += '_boundary';
        }
        return { primary, spike: spikeInfo, artifacts, evidence, bandClass };
    },

    // events of one channel run through the classifier together with that channel's spikes
    classifyChannelEvents(events, spikes, electrodes) {
        const spikeWindow = electrodes === 'intracranial' ? 0.05 : 0.1;
        for (const event of events) event.features.classification = this.classifyEvent(event, { spikes, spikeWindow });
    },

    // ripples overlapped by a fast ripple on the same channel (Fedele 2017 "FRandR": any overlap)
    markRippleFastRipple(events) {
        const fast = events.filter(event => event.band?.key === 'fast_ripple');
        const ripples = events.filter(event => event.band?.key === 'ripple');
        for (const ripple of ripples) {
            const partner = fast.find(item => item.channelIndex === ripple.channelIndex && item.onset < ripple.offset && item.offset > ripple.onset);
            if (!partner) continue;
            for (const event of [ripple, partner]) {
                event.features.classification = event.features.classification || {};
                event.features.classification.cooccurrence = 'ripple_and_fast_ripple';
            }
        }
    },

    // ---------- agreement between two sets of markings ----------
    // Event matching is one-to-one per channel, best overlap first (pyHFO, mne-hfo). F1 is the headline because
    // it is symmetric and equals positive-specific agreement; kappa needs a definition of "no event", so two
    // variants are reported with their parameters (time bins; Zelmann 2012-style background windows).

    wilson(successes, total, z = 1.959964) {
        if (!total) return { low: null, high: null };
        const p = successes / total;
        const denominator = 1 + z * z / total;
        const centre = (p + z * z / (2 * total)) / denominator;
        const half = z * Math.sqrt(p * (1 - p) / total + z * z / (4 * total * total)) / denominator;
        return { low: Math.max(0, centre - half), high: Math.min(1, centre + half) };
    },

    spearman(x, y) {
        const n = x.length;
        if (n < 3) return null;
        const rank = values => {
            const order = values.map((value, index) => [value, index]).sort((a, b) => a[0] - b[0]);
            const ranks = new Array(n);
            for (let i = 0; i < n;) {
                let j = i;
                while (j + 1 < n && order[j + 1][0] === order[i][0]) j++;
                for (let k = i; k <= j; k++) ranks[order[k][1]] = (i + j) / 2 + 1;
                i = j + 1;
            }
            return ranks;
        };
        const rx = rank(x);
        const ry = rank(y);
        const mx = rx.reduce((a, b) => a + b, 0) / n;
        const my = ry.reduce((a, b) => a + b, 0) / n;
        let num = 0;
        let dx = 0;
        let dy = 0;
        for (let i = 0; i < n; i++) {
            num += (rx[i] - mx) * (ry[i] - my);
            dx += (rx[i] - mx) ** 2;
            dy += (ry[i] - my) ** 2;
        }
        return dx > 0 && dy > 0 ? num / Math.sqrt(dx * dy) : null;
    },

    kappa(a, b, c, d) {
        const n = a + b + c + d;
        if (!n) return null;
        const observed = (a + d) / n;
        const expected = ((a + b) * (a + c) + (c + d) * (b + d)) / (n * n);
        return expected < 1 ? (observed - expected) / (1 - expected) : null;
    },

    // events: [{ channelIndex, onset, offset }] in seconds
    compareMarkings(reference, comparison, options = {}) {
        const rule = options.rule || 'overlap';
        const duration = options.duration;
        const channels = options.channels || Array.from(new Set([...reference, ...comparison].map(event => event.channelIndex)));
        const binSeconds = (options.binMs || 10) / 1000;
        const windowSeconds = (options.windowMs || 100) / 1000;
        const guardSeconds = (options.guardMs || 25) / 1000;
        const matches = (x, y) => {
            const overlap = Math.min(x.offset, y.offset) - Math.max(x.onset, y.onset);
            const union = Math.max(x.offset, y.offset) - Math.min(x.onset, y.onset);
            const iou = union > 0 ? Math.max(0, overlap) / union : 0;
            const centreGap = Math.abs((x.onset + x.offset) / 2 - (y.onset + y.offset) / 2);
            const ok = rule === 'iou' ? iou >= (options.minIou || 0.2)
                : rule === 'centre' ? centreGap <= (options.centreMs || 50) / 1000
                    : overlap > 0;
            return ok ? { iou, centreGap } : null;
        };
        let tp = 0;
        let fn = 0;
        let fp = 0;
        let bins = { a: 0, b: 0, c: 0, d: 0 };
        let background = 0;
        const perChannel = [];
        const unmatchedReference = [];
        const unmatchedComparison = [];
        for (const channelIndex of channels) {
            const refs = reference.filter(event => event.channelIndex === channelIndex);
            const comps = comparison.filter(event => event.channelIndex === channelIndex);
            const pairs = [];
            for (let i = 0; i < refs.length; i++) {
                for (let j = 0; j < comps.length; j++) {
                    const match = matches(refs[i], comps[j]);
                    if (match) pairs.push([i, j, match.iou, match.centreGap]);
                }
            }
            pairs.sort((x, y) => y[2] - x[2] || x[3] - y[3]);
            const usedRef = new Set();
            const usedComp = new Set();
            for (const [i, j] of pairs) {
                if (usedRef.has(i) || usedComp.has(j)) continue;
                usedRef.add(i);
                usedComp.add(j);
            }
            const matched = usedRef.size;
            tp += matched;
            fn += refs.length - matched;
            fp += comps.length - matched;
            refs.forEach((event, index) => { if (!usedRef.has(index)) unmatchedReference.push(event); });
            comps.forEach((event, index) => { if (!usedComp.has(index)) unmatchedComparison.push(event); });
            perChannel.push({ channelIndex, reference: refs.length, comparison: comps.length, matched,
                f1: refs.length + comps.length ? 2 * matched / (refs.length + comps.length) : null });

            if (duration > 0) {
                // a bin counts as positive when at least half of it is covered by that set's events
                const count = Math.floor(duration / binSeconds);
                const cover = list => {
                    const covered = new Float64Array(count);
                    for (const event of list) {
                        const first = Math.max(0, Math.floor(event.onset / binSeconds));
                        const last = Math.min(count - 1, Math.floor(event.offset / binSeconds));
                        for (let k = first; k <= last; k++) {
                            covered[k] += Math.max(0, Math.min(event.offset, (k + 1) * binSeconds) - Math.max(event.onset, k * binSeconds));
                        }
                    }
                    return covered;
                };
                const coverRef = cover(refs);
                const coverComp = cover(comps);
                for (let k = 0; k < count; k++) {
                    const x = coverRef[k] >= binSeconds / 2;
                    const y = coverComp[k] >= binSeconds / 2;
                    if (x && y) bins.a++;
                    else if (x) bins.b++;
                    else if (y) bins.c++;
                    else bins.d++;
                }
                // background windows are those with no event of either set within the guard distance
                const windows = Math.floor(duration / windowSeconds);
                const busy = new Uint8Array(windows);
                for (const event of [...refs, ...comps]) {
                    const first = Math.max(0, Math.floor((event.onset - guardSeconds) / windowSeconds));
                    const last = Math.min(windows - 1, Math.ceil((event.offset + guardSeconds) / windowSeconds) - 1);
                    for (let k = first; k <= last; k++) busy[k] = 1;
                }
                for (let k = 0; k < windows; k++) if (!busy[k]) background++;
            }
        }
        const sensitivity = tp + fn ? tp / (tp + fn) : null;
        const precision = tp + fp ? tp / (tp + fp) : null;
        const binTotal = bins.a + bins.b + bins.c + bins.d;
        return {
            rule,
            tp,
            fn,
            fp,
            sensitivity,
            sensitivityInterval: this.wilson(tp, tp + fn),
            precision,
            precisionInterval: this.wilson(tp, tp + fp),
            f1: 2 * tp + fp + fn ? 2 * tp / (2 * tp + fp + fn) : null,
            jaccard: tp + fp + fn ? tp / (tp + fp + fn) : null,
            extraPerMinute: duration > 0 && channels.length ? fp / (duration / 60) / channels.length : null,
            binnedKappa: duration > 0 ? {
                kappa: this.kappa(bins.a, bins.b, bins.c, bins.d),
                observed: binTotal ? (bins.a + bins.d) / binTotal : null,
                prevalence: binTotal ? (2 * bins.a + bins.b + bins.c) / (2 * binTotal) : null,
                binMs: binSeconds * 1000
            } : null,
            eventKappa: duration > 0 ? { kappa: this.kappa(tp, fn, fp, background), windowMs: windowSeconds * 1000, guardMs: guardSeconds * 1000, background } : null,
            channelRho: this.spearman(perChannel.map(row => row.reference), perChannel.map(row => row.comparison)),
            perChannel,
            unmatchedReference,
            unmatchedComparison
        };
    },

    // ---------- gamma distribution (MNI and CS thresholds) ----------
    // Lanczos log-gamma, series/continued-fraction incomplete gamma (Numerical Recipes 6.2),
    // Halley-refined inverse, and the maximum-likelihood fit used by RIPPLELAB and MATLAB gamfit.

    gamma: {
        lanczos: [0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313,
            -176.61502916214059, 12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7],

        ln(x) {
            if (x < 0.5) return Math.log(Math.PI / Math.abs(Math.sin(Math.PI * x))) - this.ln(1 - x);
            const y = x - 1;
            let a = this.lanczos[0];
            const t = y + 7.5;
            for (let i = 1; i < 9; i++) a += this.lanczos[i] / (y + i);
            return 0.5 * Math.log(2 * Math.PI) + (y + 0.5) * Math.log(t) - t + Math.log(a);
        },

        digamma(x) {
            let result = 0;
            while (x < 6) { result -= 1 / x; x += 1; }
            const f = 1 / (x * x);
            return result + Math.log(x) - 0.5 / x - f * (1 / 12 - f * (1 / 120 - f * (1 / 252 - f * (1 / 240 - f / 132))));
        },

        trigamma(x) {
            let result = 0;
            while (x < 6) { result += 1 / (x * x); x += 1; }
            const f = 1 / (x * x);
            return result + 1 / x + f / 2 + (f / x) * (1 / 6 - f * (1 / 30 - f * (1 / 42 - f / 30)));
        },

        series(a, x) {
            let ap = a;
            let sum = 1 / a;
            let del = sum;
            for (let n = 0; n < 1000; n++) {
                ap += 1;
                del *= x / ap;
                sum += del;
                if (Math.abs(del) < Math.abs(sum) * 1e-16) break;
            }
            return sum * Math.exp(-x + a * Math.log(x) - this.ln(a));
        },

        continuedFraction(a, x) {
            const tiny = 1e-300;
            let b = x + 1 - a;
            let c = 1 / tiny;
            let d = 1 / b;
            let h = d;
            for (let i = 1; i < 1000; i++) {
                const an = -i * (i - a);
                b += 2;
                d = an * d + b;
                if (Math.abs(d) < tiny) d = tiny;
                c = b + an / c;
                if (Math.abs(c) < tiny) c = tiny;
                d = 1 / d;
                const del = d * c;
                h *= del;
                if (Math.abs(del - 1) < 1e-16) break;
            }
            return Math.exp(-x + a * Math.log(x) - this.ln(a)) * h;
        },

        lower(a, x) {
            if (x <= 0) return 0;
            return x < a + 1 ? this.series(a, x) : 1 - this.continuedFraction(a, x);
        },

        upper(a, x) {
            if (x <= 0) return 1;
            return x < a + 1 ? 1 - this.series(a, x) : this.continuedFraction(a, x);
        },

        normalInverse(p) {
            const a = [-3.969683028665376e1, 2.209460984245205e2, -2.759285104469687e2, 1.383577518672690e2, -3.066479806614716e1, 2.506628277459239];
            const b = [-5.447609879822406e1, 1.615858368580409e2, -1.556989798598866e2, 6.680131188771972e1, -1.328068155288572e1];
            const c = [-7.784894002430293e-3, -3.223964580411365e-1, -2.400758277161838, -2.549732539343734, 4.374664141464968, 2.938163982698783];
            const d = [7.784695709041462e-3, 3.224671290700398e-1, 2.445134137142996, 3.754408661907416];
            const low = 0.02425;
            if (p < low) {
                const q = Math.sqrt(-2 * Math.log(p));
                return (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
            }
            if (p > 1 - low) {
                const q = Math.sqrt(-2 * Math.log(1 - p));
                return -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
            }
            const q = p - 0.5;
            const r = q * q;
            return (((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q / (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1);
        },

        // x with P(a, x) = p for the unit-scale gamma
        inverse(a, p) {
            if (p <= 0) return 0;
            if (p >= 1) return Infinity;
            const z = this.normalInverse(p);
            let x = a * Math.pow(1 - 1 / (9 * a) + z * Math.sqrt(1 / (9 * a)), 3);
            if (!(x > 0)) x = Math.pow(p * Math.exp(this.ln(a + 1)), 1 / a);
            const useUpper = p > 0.5;
            const target = useUpper ? 1 - p : p;
            const lnA = this.ln(a);
            for (let i = 0; i < 100; i++) {
                const f = useUpper ? this.upper(a, x) - target : this.lower(a, x) - target;
                const pdf = Math.exp((a - 1) * Math.log(x) - x - lnA);
                if (pdf === 0) break;
                let step = f / pdf;
                if (useUpper) step = -step;
                const halley = step / (1 - 0.5 * step * ((a - 1) / x - 1));
                let next = x - (Number.isFinite(halley) ? halley : step);
                if (next <= 0) next = x / 2;
                if (Math.abs(next - x) < 1e-14 * x) { x = next; break; }
                x = next;
            }
            return x;
        },

        quantile(p, fit) {
            return this.inverse(fit.k, p) * fit.theta;
        },

        // maximum-likelihood shape and scale (Newton on ln k − ψ(k) = S); moments when MLE is undefined
        fit(values, indices = null) {
            let n = 0;
            let sum = 0;
            let logSum = 0;
            const count = indices ? indices.length : values.length;
            for (let j = 0; j < count; j++) {
                const v = indices ? values[indices[j]] : values[j];
                if (v > 0) { n++; sum += v; logSum += Math.log(v); }
            }
            if (n < 2) return null;
            const mean = sum / n;
            const S = Math.log(mean) - logSum / n;
            if (!(S > 1e-12)) return null;
            let k = (3 - S + Math.sqrt((S - 3) ** 2 + 24 * S)) / (12 * S);
            for (let i = 0; i < 50; i++) {
                const f = Math.log(k) - this.digamma(k) - S;
                const fp = 1 / k - this.trigamma(k);
                const next = k - f / fp;
                if (!(next > 0)) { k /= 2; continue; }
                if (Math.abs(next - k) < 1e-12 * k) { k = next; break; }
                k = next;
            }
            return { k, theta: mean / k };
        }
    },

    // ---------- time-frequency map for reviewing one event ----------

    morletMap(signal, start, end, sampleRate, options = {}) {
        const nyquist = sampleRate / 2;
        const fMin = Math.max(2, options.fMin || 10);
        const fMax = Math.min(options.fMax || nyquist * 0.9, nyquist * 0.95);
        const count = options.frequencies || 40;
        const freqs = new Float64Array(count);
        for (let k = 0; k < count; k++) freqs[k] = fMin * Math.pow(fMax / fMin, k / Math.max(1, count - 1));
        const length = Math.max(1, end - start);
        const step = Math.max(1, Math.floor(length / (options.columns || 220)));
        const columns = Math.ceil(length / step);
        const power = Array.from({ length: count }, () => new Float64Array(columns));

        for (let k = 0; k < count; k++) {
            const f = freqs[k];
            const sigma = 1 / f;
            const halfWidth = Math.ceil(3 * sigma * sampleRate);
            const kernelRe = new Float64Array(2 * halfWidth + 1);
            const kernelIm = new Float64Array(2 * halfWidth + 1);
            let norm = 0;
            for (let i = -halfWidth; i <= halfWidth; i++) {
                const t = i / sampleRate;
                const gauss = Math.exp(-(t * t) / (2 * sigma * sigma));
                kernelRe[i + halfWidth] = gauss * Math.cos(2 * Math.PI * f * t);
                kernelIm[i + halfWidth] = gauss * Math.sin(2 * Math.PI * f * t);
                norm += gauss;
            }
            for (let column = 0; column < columns; column++) {
                const center = start + column * step;
                let sumRe = 0;
                let sumIm = 0;
                for (let i = -halfWidth; i <= halfWidth; i++) {
                    const source = center + i;
                    if (source < 0 || source >= signal.length) continue;
                    sumRe += signal[source] * kernelRe[i + halfWidth];
                    sumIm += signal[source] * kernelIm[i + halfWidth];
                }
                power[k][column] = (sumRe * sumRe + sumIm * sumIm) / (norm * norm);
            }
        }

        // z-score each frequency row so the 1/f slope does not hide the event
        for (let k = 0; k < count; k++) {
            const row = power[k];
            const { mean, std } = this.meanStd(row);
            for (let column = 0; column < columns; column++) row[column] = std > 0 ? (row[column] - mean) / std : 0;
        }
        return { freqs, power, columns, step, start, end };
    }
};
