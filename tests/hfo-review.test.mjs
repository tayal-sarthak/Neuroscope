import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';
import { webcrypto } from 'node:crypto';

async function workspace(overrides = {}) {
    const nodes = new Map();
    const element = () => ({
        value: '', textContent: '', hidden: false, disabled: false, dataset: {},
        style: { setProperty() {} }, classList: { add() {}, remove() {}, toggle() {} },
        listeners: {}, addEventListener(name, fn) { this.listeners[name] = fn; },
        setAttribute() {}, replaceChildren() {}, append() {}, appendChild() {},
        querySelector() { return element(); }
    });
    const document = {
        addEventListener() {}, querySelectorAll() { return []; }, createElement: element,
        getElementById(id) { if (!nodes.has(id)) nodes.set(id, element()); return nodes.get(id); }
    };
    const context = {
        console, document, performance, setTimeout, clearTimeout,
        window: { crypto: webcrypto }, ...overrides
    };
    context.globalThis = context;
    const sources = await Promise.all(['parsers', 'analysis', 'hfo', 'export', 'app', 'hfo-review'].map(name => readFile(new URL(`../js/${name}.js`, import.meta.url), 'utf8')));
    vm.runInNewContext(sources.join('\n') + '\n;globalThis.app = App; globalThis.exporter = EEGExport; globalThis.detector = EEGHFO;', context);
    const { app, exporter, detector } = context;
    app.state.eegData = { filename: 'test.edf', sampleRate: 1000, duration: 5, numSamples: 5000, channelLabels: ['C3', 'C4'], channelData: [new Float64Array(5000), new Float64Array(5000)] };
    app.state.selectedChannels = [0, 1];
    app.state.analysisResults = {};
    app.state.hfo = app.createHFOState();
    app.refreshHFOView = () => {};
    app.renderHFOSettings = () => {};
    app.updateHFOBandNote = () => {};
    app.recordHistory = () => {};
    app.showToast = () => {};
    app.scrollHFORowIntoView = () => {};
    app.getHFOLinePlan = () => ({ frequency: null, notches: [], components: [] });
    document.getElementById('hfo-band-low').value = 80;
    document.getElementById('hfo-band-high').value = 250;
    const downloads = [];
    exporter.downloadFile = (content, filename) => { downloads.push({ content, filename }); return true; };
    return { app, exporter, detector, document, downloads };
}

const event = (extra = {}) => ({ id: 'event-1', channelIndex: 0, channel: 'C3', onset: 1, offset: 1.05, source: 'detector', status: 'pending', label: 'hfo', band: { key: 'ripple', low: 80, high: 250 }, features: {}, ...extra });

test('restored HFO settings preserve intracranial defaults, line mode and review view', async () => {
    const { app, document } = await workspace();
    Object.assign(app.state.hfo, { electrodes: 'intracranial', params: app.normalizeHFOParams('zurich', 'intracranial', {}), window: 2, display: 'raw', scale: 'shared', gain: 3, viewStart: 1, filter: 'accepted', order: 'strength' });
    app.state.hfo.line.mode = 'off';
    app.state.hfo.events = [event({ status: 'accepted' })];
    const saved = JSON.parse(JSON.stringify(app.getHFOSessionData()));
    app.state.hfo.electrodes = 'scalp';
    assert.equal(app.restoreHFOSession(saved), 1);
    assert.equal(app.state.hfo.electrodes, 'intracranial');
    assert.equal(app.state.hfo.params.amplitudeCeilingUv, 0);
    assert.equal(app.state.hfo.line.mode, 'off');
    for (const key of ['window', 'display', 'scale', 'gain', 'viewStart', 'filter', 'order']) assert.equal(app.state.hfo[key], saved.settings[key]);
    assert.equal(document.getElementById('hfo-window').value, 2);
});

test('incomplete sessions normalize runs, features, duplicate IDs and invalid bands before export', async () => {
    const { app, exporter, downloads } = await workspace();
    const saved = {
        settings: { detector: 'zurich', params: { epochSec: 0, minPeaks: 'bad', minSnr: null } },
        run: { id: 'run-1', detector: 'zurich', band: { key: 'ripple', low: 80, high: 250 } },
        events: [event({ runId: 'run-1', features: { peakAmplitude: 'bad', rawPeakToPeak: null, cycles: 6, flags: 'bad', subBand: [100, 110] }, band: { low: 200, high: 80 } }), event({ features: { flags: [null, '', 'near a sharp transient'] } }), null]
    };
    assert.equal(app.restoreHFOSession(saved), 2);
    const events = app.state.hfo.events;
    assert.notEqual(events[0].id, events[1].id);
    assert.equal(events[0].features.peakAmplitude, undefined);
    assert.equal(events[0].features.rawPeakToPeak, undefined);
    assert.equal(events[0].features.cycles, 6);
    assert.deepEqual(Array.from(events[0].features.subBand), [100, 110]);
    assert.deepEqual(Array.from(events[1].features.flags), ['near a sharp transient']);
    assert.equal(events[0].band.low, 80);
    assert.equal(app.state.hfo.params.epochSec, 300);
    assert.ok(app.state.analysisResults.hfo.run);
    assert.equal(exporter.exportHFOEventsCSV(app.state.eegData, events, app.state.hfo.run), true);
    assert.equal(downloads.length, 1);
    app.restoreHFOSession({ run: { detector: 'unknown' }, events: [event()] });
    assert.equal(app.state.hfo.run, null);
});

test('detection snapshots the detector when settings change between channels', async () => {
    let app;
    const fixture = await workspace({ setTimeout(fn) { app.state.hfo.detector = 'ste'; fn(); } });
    app = fixture.app;
    const calls = [];
    fixture.detector.detectChannel = (raw, fs, config) => { calls.push(config.detector); return { events: [], stats: {} }; };
    await app.runHFODetection();
    assert.deepEqual(calls, ['zurich', 'zurich']);
    assert.equal(app.state.hfo.run.detector, 'zurich');
});

test('a recording reset cancels detection without changing the replacement state or progress', async () => {
    let app, replacement;
    const fixture = await workspace({ setTimeout(fn) {
        replacement = app.createHFOState();
        replacement.busy = true;
        app.state.hfo = replacement;
        fixture.document.getElementById('hfo-run').textContent = 'Replacement run';
        fn();
    } });
    app = fixture.app;
    fixture.detector.detectChannel = () => { throw new Error('stale recording processed'); };
    await app.runHFODetection();
    assert.equal(app.state.hfo, replacement);
    assert.equal(replacement.run, null);
    assert.equal(replacement.busy, true);
    assert.equal(fixture.document.getElementById('hfo-run').textContent, 'Replacement run');
    assert.equal(app.state.analysisResults.hfo, undefined);
});

test('export trial types use the event band and only the matching detector run', async () => {
    const { exporter } = await workspace();
    const limitedRun = { id: 'limited-run', bandLimited: true };
    assert.equal(exporter.hfoTrialType(event({ source: 'reviewer', runId: limitedRun.id }), limitedRun), 'ripple');
    assert.equal(exporter.hfoTrialType(event({ runId: 'old-run' }), limitedRun), 'ripple');
    assert.equal(exporter.hfoTrialType(event({ runId: limitedRun.id }), limitedRun), 'hfo_band_limited');
    assert.equal(exporter.hfoTrialType(event({ source: 'reviewer', band: { key: 'ripple', low: 80, high: 102 } }), null), 'hfo_band_limited');
    assert.equal(exporter.hfoTrialType(event({ source: 'reviewer', label: 'artifact' }), limitedRun), 'artifact');
});

test('BIDS export excludes pending and rejected detector candidates', async () => {
    const { app, exporter, downloads } = await workspace();
    exporter.exportBIDSEventsTSV(app.state.eegData, [], [event(), event({ status: 'rejected' }), event({ status: 'accepted' }), event({ source: 'reviewer', label: 'artifact' })]);
    const rows = downloads[0].content.trim().split('\n');
    assert.equal(rows.length, 3);
    assert.match(rows[1], /ripple/);
    assert.match(rows[2], /artifact.*true/);
});

test('hand-mark measurements use recording-relative peak times and retain band-limited flags', async () => {
    const { app } = await workspace();
    const signal = app.state.eegData.channelData[0];
    for (let i = 2000; i < 2100; i++) signal[i] = 10 * Math.sin(2 * Math.PI * 90 * i / 1000);
    const features = app.measureHFOSegment(0, 2, 2.1, { key: 'ripple', low: 80, high: 102 });
    assert.ok(features.peakTime >= 2 && features.peakTime < 2.1, `peak time ${features.peakTime}`);
    assert.deepEqual(Array.from(features.flags), ['band-limited']);
});

test('cancelled pointer gestures roll back resize and never create a hand mark', async () => {
    const { app, document } = await workspace();
    app.bindHFOCanvas();
    const cancel = document.getElementById('hfo-interaction-canvas').listeners.pointercancel;
    app.state.hfo.events = [event({ source: 'reviewer', onset: 0.8 })];
    app.state.hfo.drag = { mode: 'resize', id: 'event-1', previous: { onset: 1, offset: 1.05, features: {} } };
    cancel({ type: 'pointercancel' });
    assert.equal(app.state.hfo.events[0].onset, 1);
    assert.equal(app.state.hfo.undo.length, 0);
    app.state.hfo.drag = { mode: 'mark' };
    cancel({ type: 'pointercancel' });
    assert.equal(app.state.hfo.events.length, 1);
});

test('repeating a review decision advances without toggling or adding an undo record', async () => {
    const { app } = await workspace();
    app.state.hfo.events = [event({ status: 'accepted' }), event({ id: 'event-2', onset: 2, offset: 2.1 })];
    app.state.hfo.selectedId = 'event-1';
    app.decideHFOEvent('accepted');
    assert.equal(app.state.hfo.events[0].status, 'accepted');
    assert.equal(app.state.hfo.undo.length, 0);
    assert.equal(app.state.hfo.selectedId, 'event-2');
    app.decideHFOEvent('rejected');
    app.undoHFO();
    assert.equal(app.state.hfo.events[1].status, 'pending');
});

test('session import rejects another recording before changing workspace state', async () => {
    const { app } = await workspace();
    const original = app.state.selectedChannels;
    const notices = [];
    app.showToast = message => notices.push(message);
    await app.importSessionManifest({ text: async () => JSON.stringify({ recording: { ...app.state.eegData, filename: 'other.edf' }, workspace: {}, annotations: [] }) });
    assert.equal(app.state.selectedChannels, original);
    assert.match(notices[0], /different recording/);
});

test('restoring a review session clears an active filter and tolerates incomplete channel selections', async () => {
    const { app } = await workspace();
    for (const method of ['updateFilterStatus', 'updateTimeOffsetRange', 'setTimeOffset', 'updateChannelCheckboxes', 'syncBadChannelUI', 'renderAnnotations', 'renderAnalysisHistory', 'refreshSignalViewer']) app[method] = () => {};
    app.state.filteredData = [new Float64Array(5000)];
    app.state.activeFilter = { description: 'Old filter' };
    app.state.analysisResults.qualityTimeline = {};
    let notice;
    app.showToast = message => { notice = message; };
    await app.importSessionManifest({ text: async () => JSON.stringify({ recording: app.state.eegData, workspace: { processingState: 'filtered', selectedChannels: [null, { index: 1 }], badChannels: 'invalid' }, annotations: [null] }) });
    assert.equal(app.state.filteredData, null);
    assert.equal(app.state.activeFilter, null);
    assert.equal(app.state.analysisResults.qualityTimeline, undefined);
    assert.deepEqual(Array.from(app.state.selectedChannels), [1]);
    assert.match(notice, /Review restored/);
});

test('JSON exports keep both channels when electrode labels repeat', async () => {
    const { app } = await workspace();
    app.state.eegData.channelLabels = ['T8-P8', 'T8-P8'];
    app.state.hfo.run = {
        channels: [0, 1], stats: { 0: { filteredStd: 1 }, 1: { filteredStd: 2 } }
    };
    const output = app.getHFOExportData();
    assert.equal(Object.keys(output.run.stats).length, 2);
    assert.equal(output.run.stats[0].filteredStd, 1);
    assert.equal(output.run.stats[1].filteredStd, 2);
    assert.equal(output.run.stats[0].channel, 'T8-P8');
    assert.equal(output.run.stats[1].channelIndex, 1);
});

test('conflicting duration limits stop detection before processing a channel', async () => {
    const { app, detector } = await workspace();
    app.state.hfo.params.minDurationMs = 300;
    app.state.hfo.params.maxDurationMs = 200;
    detector.detectChannel = () => { throw new Error('invalid settings processed'); };
    let notice;
    app.showToast = message => { notice = message; };
    await app.runHFODetection();
    assert.equal(app.state.hfo.run, null);
    assert.match(notice, /longest event/);
});

test('imported BIDS and NeuroScope markings map onto channels and feed the comparison', async () => {
    const { app } = await workspace();
    const file = (name, text) => ({ name, text: async () => text });
    const tsv = 'onset\tduration\ttrial_type\tchannel\n1.00\t0.05\thfo\tC3\n2.00\t0.04\tripple_C4\tn/a\n3\t0.05\thfo\tFz\n';
    await app.importHFOMarkings(file('rater2_events.tsv', tsv));
    const imported = app.state.hfo.imported;
    assert.equal(imported.events.length, 2);
    assert.equal(imported.skipped, 1);
    assert.deepEqual(JSON.parse(JSON.stringify(imported.events.map(item => [item.channelIndex, item.onset, Number(item.offset.toFixed(3))]))), [[0, 1, 1.05], [1, 2, 2.04]]);
    assert.equal(app.state.hfo.compare.comparison, 'imported');

    const csv = 'channel,onset_s,offset_s,decision\nC3,1.01,1.06,accepted\nC4,4,4.05,rejected\n';
    await app.importHFOMarkings(file('neuroscope.csv', csv));
    assert.equal(app.state.hfo.imported.events.length, 1);

    app.state.hfo.events = [event({ status: 'accepted' })];
    app.state.hfo.compare = { reference: 'review', comparison: 'imported', rule: 'overlap' };
    app.renderHFOAgreement();
    const result = app.state.hfo.lastAgreement;
    assert.equal(result.comparison, 'imported');
    assert.equal(result.tp, 1);
    assert.equal(result.f1, 1);
});
