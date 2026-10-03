// hfo review tab: detection runs, candidate decisions, hand marks, drawing
Object.assign(App, {

    hfoStatusStyles: {
        pending: { stroke: '#B36A00', fill: 'rgba(179, 106, 0, 0.08)', dash: [4, 3], width: 1.5 },
        accepted: { stroke: '#0F8A5F', fill: 'rgba(15, 138, 95, 0.11)', dash: [], width: 1.75 },
        rejected: { stroke: '#8A99AA', fill: null, dash: [2, 3], width: 1.25 },
        reviewer: { stroke: '#315AEF', fill: 'rgba(49, 90, 239, 0.11)', dash: [], width: 1.75 },
        artifact: { stroke: '#C73E4D', fill: 'rgba(199, 62, 77, 0.09)', dash: [], width: 1.75 },
        uncertain: { stroke: '#7C4DCE', fill: 'rgba(124, 77, 206, 0.09)', dash: [6, 2], width: 1.75 }
    },

    hfoStatusLabels: {
        pending: 'To review',
        accepted: 'Accepted',
        rejected: 'Rejected',
        reviewer: 'Hand-marked'
    },

    hfoStateLabels: {
        unknown: 'state not specified',
        nrem: 'NREM sleep',
        rem: 'REM sleep',
        wake: 'wakefulness',
        mixed: 'mixed sleep and wake'
    },

    hfoReviewerLabels: {
        hfo: 'HFO',
        artifact: 'Artifact',
        uncertain: 'Uncertain'
    },

    createHFOState() {
        const detector = EEGHFO.defaultDetector;
        return {
            detector,
            electrodes: 'scalp',
            bandKey: 'ripple',
            params: EEGHFO.defaultParams(detector, 'scalp'),
            paramsByDetector: {},
            consensusMembers: ['zurich', 'ste', 'ellenrieder'],
            line: { mode: 'auto', checked: false, detected: null, spectrum: null },
            run: null,
            events: [],
            screened: [],
            duplicates: null,
            recordingState: 'unknown',
            showScreened: false,
            selectedScreened: null,
            tableView: 'events',
            imported: null,
            compare: { reference: 'review', comparison: 'detector', rule: 'overlap' },
            channelFilter: null,
            selectedId: null,
            filter: 'all',
            classFilter: 'all',
            order: 'time',
            viewStart: 0,
            window: 1,
            display: 'filtered',
            scale: 'channel',
            gain: 1,
            undo: [],
            busy: false,
            confirmReplace: false,
            listLimit: 300,
            drag: null,
            hoverId: null,
            referenceStd: {},
            traceCache: null
        };
    },

    // ---------- setup ----------

    bindHFOControls() {
        this.state.hfo = this.createHFOState();
        const detectorSelect = document.getElementById('hfo-detector');
        detectorSelect.replaceChildren(...[...Object.entries(EEGHFO.detectors), ['consensus', EEGHFO.consensusDetector]].map(([key, detector]) => {
            const option = document.createElement('option');
            option.value = key;
            option.textContent = detector.label;
            return option;
        }));
        detectorSelect.value = this.state.hfo.detector;
        detectorSelect.addEventListener('change', () => {
            const hfo = this.state.hfo;
            // each detector keeps its own edited settings while you switch between them
            hfo.paramsByDetector[hfo.detector] = hfo.params;
            hfo.detector = detectorSelect.value;
            hfo.params = hfo.paramsByDetector[hfo.detector] || EEGHFO.defaultParams(hfo.detector, hfo.electrodes);
            hfo.confirmReplace = false;
            this.renderHFOSettings();
            this.updateHFOBandNote();
        });
        document.getElementById('hfo-electrodes').addEventListener('change', (event) => {
            const hfo = this.state.hfo;
            hfo.electrodes = event.target.value === 'intracranial' ? 'intracranial' : 'scalp';
            hfo.paramsByDetector = {};
            hfo.params = EEGHFO.defaultParams(hfo.detector, hfo.electrodes);
            hfo.confirmReplace = false;
            this.renderHFOSettings();
        });
        document.getElementById('hfo-state').addEventListener('change', (event) => {
            const value = event.target.value;
            this.state.hfo.recordingState = Object.hasOwn(this.hfoStateLabels, value) ? value : 'unknown';
            if (this.state.hfo.run) this.state.hfo.run.recordingState = this.state.hfo.recordingState;
            this.updateHFOBandNote();
            this.renderHFOMethods();
        });
        document.getElementById('hfo-methods-toggle').addEventListener('click', () => {
            const panel = document.getElementById('hfo-methods');
            panel.hidden = !panel.hidden;
            document.getElementById('hfo-methods-toggle').setAttribute('aria-expanded', String(!panel.hidden));
            this.renderHFOMethods();
        });
        document.getElementById('hfo-methods-copy').addEventListener('click', async () => {
            const text = this.buildHFOMethodsText();
            try {
                await navigator.clipboard.writeText(text);
                this.showToast('Methods text copied', 'success');
            } catch {
                const range = document.createRange();
                range.selectNodeContents(document.getElementById('hfo-methods-text'));
                const selection = window.getSelection();
                selection.removeAllRanges();
                selection.addRange(range);
                this.showToast('Copying was blocked; the text is selected so you can copy it yourself', 'info');
            }
        });
        document.getElementById('hfo-show-screened').addEventListener('change', (event) => {
            this.state.hfo.showScreened = event.target.checked;
            if (!event.target.checked) this.state.hfo.selectedScreened = null;
            this.refreshHFOView();
        });
        document.querySelectorAll('[data-hfo-view]').forEach(button => {
            button.addEventListener('click', () => {
                this.state.hfo.tableView = button.dataset.hfoView;
                this.renderHFOTable();
            });
        });
        document.getElementById('hfo-promote').addEventListener('click', () => this.promoteHFOScreened());
        ['hfo-compare-reference', 'hfo-compare-comparison', 'hfo-compare-rule'].forEach(id => {
            document.getElementById(id).addEventListener('change', () => {
                const compare = this.state.hfo.compare;
                compare.reference = document.getElementById('hfo-compare-reference').value;
                compare.comparison = document.getElementById('hfo-compare-comparison').value;
                compare.rule = document.getElementById('hfo-compare-rule').value;
                this.renderHFOAgreement();
            });
        });
        const importInput = document.getElementById('hfo-import-markings-input');
        document.getElementById('hfo-import-markings').addEventListener('click', () => importInput.click());
        importInput.addEventListener('change', async () => {
            const file = importInput.files?.[0];
            if (file) await this.importHFOMarkings(file);
            importInput.value = '';
        });
        document.getElementById('hfo-channel-export').addEventListener('click', () => this.exportHFOChannelSummary());
        document.getElementById('hfo-channel-clear').addEventListener('click', () => {
            this.state.hfo.channelFilter = null;
            this.renderHFOTable();
        });
        document.getElementById('hfo-line').addEventListener('change', (event) => {
            this.state.hfo.line.mode = event.target.value;
            this.state.hfo.confirmReplace = false;
            this.updateHFOBandNote();
        });

        document.getElementById('hfo-band').addEventListener('change', (event) => {
            this.state.hfo.bandKey = event.target.value;
            this.state.hfo.confirmReplace = false;
            this.applyHFOBandPreset();
        });
        ['hfo-band-low', 'hfo-band-high'].forEach(id => {
            document.getElementById(id).addEventListener('change', () => {
                document.getElementById('hfo-band').value = 'custom';
                this.state.hfo.bandKey = 'custom';
                this.state.hfo.referenceStd = {};
                this.updateHFOBandNote();
                this.refreshHFOView();
            });
        });

        const settingsToggle = document.getElementById('hfo-settings-toggle');
        settingsToggle.addEventListener('click', () => {
            const panel = document.getElementById('hfo-settings');
            panel.hidden = !panel.hidden;
            settingsToggle.setAttribute('aria-expanded', String(!panel.hidden));
        });
        document.getElementById('hfo-settings-reset').addEventListener('click', () => {
            this.state.hfo.params = EEGHFO.defaultParams(this.state.hfo.detector, this.state.hfo.electrodes);
            this.renderHFOSettings();
        });
        document.getElementById('hfo-run').addEventListener('click', () => this.runHFODetection());

        document.getElementById('hfo-window').addEventListener('change', (event) => {
            const center = this.state.hfo.viewStart + this.state.hfo.window / 2;
            this.state.hfo.window = Number(event.target.value) || 1;
            this.setHFOViewStart(center - this.state.hfo.window / 2);
        });
        document.getElementById('hfo-display').addEventListener('change', (event) => {
            this.state.hfo.display = event.target.value === 'raw' ? 'raw' : 'filtered';
            this.refreshHFOView();
        });
        document.getElementById('hfo-scale').addEventListener('change', (event) => {
            this.state.hfo.scale = event.target.value === 'shared' ? 'shared' : 'channel';
            this.refreshHFOView();
        });
        document.getElementById('hfo-gain-down').addEventListener('click', () => this.stepHFOGain(-1));
        document.getElementById('hfo-gain-up').addEventListener('click', () => this.stepHFOGain(1));
        document.getElementById('hfo-page-back').addEventListener('click', () => this.pageHFO(-1));
        document.getElementById('hfo-page-forward').addEventListener('click', () => this.pageHFO(1));

        document.querySelectorAll('.hfo-filter-btn').forEach(button => {
            button.addEventListener('click', () => {
                this.state.hfo.filter = button.dataset.hfoFilter;
                this.state.hfo.listLimit = 300;
                this.renderHFOTable();
            });
        });
        document.getElementById('hfo-class-filter').addEventListener('change', (event) => {
            this.state.hfo.classFilter = event.target.value;
            this.state.hfo.listLimit = 300;
            this.renderHFOTable();
        });
        document.getElementById('hfo-order').addEventListener('change', (event) => {
            this.state.hfo.order = ['time', 'strength', 'channel'].includes(event.target.value) ? event.target.value : 'time';
            this.state.hfo.listLimit = 300;
            this.renderHFOTable();
        });
        document.getElementById('hfo-undo').addEventListener('click', () => this.undoHFO());
        document.getElementById('hfo-export-csv').addEventListener('click', () => this.exportHFOEvents());

        document.getElementById('hfo-accept').addEventListener('click', () => this.decideHFOEvent('accepted'));
        document.getElementById('hfo-reject').addEventListener('click', () => this.decideHFOEvent('rejected'));
        document.getElementById('hfo-delete').addEventListener('click', () => this.deleteHFOEvent());
        document.getElementById('hfo-event-label').addEventListener('change', (event) => this.labelHFOEvent(event.target.value));

        this.bindHFOCanvas();
        this.bindHFORaster();
        this.bindHFOKeyboard();
        this.renderHFOSettings();
    },

    resetHFOForRecording() {
        const previous = this.state.hfo || this.createHFOState();
        const next = this.createHFOState();
        next.detector = previous.detector;
        next.electrodes = previous.electrodes;
        next.params = previous.params;
        next.bandKey = previous.bandKey;
        next.window = previous.window;
        next.display = previous.display;
        next.scale = previous.scale;
        next.paramsByDetector = previous.paramsByDetector || {};
        next.consensusMembers = previous.consensusMembers || next.consensusMembers;
        next.showScreened = Boolean(previous.showScreened);
        next.line.mode = previous.line?.mode || 'auto';
        next.recordingState = 'unknown';
        this.state.hfo = next;
        document.getElementById('hfo-run').textContent = 'Run detection';
        document.getElementById('hfo-run-status').hidden = true;
        document.getElementById('hfo-screening').hidden = true;
        this.applyHFOBandPreset({ silent: true });
        this.syncHFOAnalysisResult();
    },

    applyHFOBandPreset(options = {}) {
        const hfo = this.state.hfo;
        const select = document.getElementById('hfo-band');
        select.value = hfo.bandKey;
        if (hfo.bandKey !== 'custom') {
            const range = this.getHFOBandRange(hfo.bandKey);
            document.getElementById('hfo-band-low').value = range.low;
            document.getElementById('hfo-band-high').value = range.high;
        }
        const dual = hfo.bandKey === 'ripple_fr';
        document.getElementById('hfo-band-low').disabled = dual;
        document.getElementById('hfo-band-high').disabled = dual;
        hfo.referenceStd = {};
        this.updateHFOBandNote();
        if (!options.silent) this.refreshHFOView();
    },

    // published band, clipped to what the sampling rate can represent
    getHFOBandRange(bandKey) {
        if (bandKey === 'ripple_fr') {
            const [ripple, fast] = EEGHFO.dualBands(this.state.eegData?.sampleRate || 2000);
            return { low: ripple.low, high: Math.max(fast.low + EEGHFO.minBandWidth, fast.high), publishedHigh: 500, ceiling: fast.high };
        }
        const preset = EEGHFO.bands[bandKey] || EEGHFO.bands.ripple;
        const sampleRate = this.state.eegData?.sampleRate || 2000;
        const ceiling = EEGHFO.usableCeiling(sampleRate);
        return {
            low: preset.low,
            high: Math.max(preset.low, Math.min(preset.high, ceiling)),
            publishedHigh: preset.high,
            ceiling
        };
    },

    readHFOBand() {
        const low = Number(document.getElementById('hfo-band-low').value);
        const high = Number(document.getElementById('hfo-band-high').value);
        return { key: this.state.hfo.bandKey, low, high };
    },

    validateHFOBand(band) {
        const sampleRate = this.state.eegData.sampleRate;
        const ceiling = EEGHFO.hardCeiling(sampleRate);
        if (!Number.isFinite(band.low) || !Number.isFinite(band.high) || band.low <= 0) {
            return 'Enter a lower and upper band edge in hertz.';
        }
        if (band.high <= band.low) return 'The upper band edge must be above the lower edge.';
        if (band.high > ceiling) {
            return `At ${this.formatHz(sampleRate)} sampling, edges above ${ceiling} Hz sit too close to the Nyquist frequency (${this.formatHz(sampleRate / 2)}) to filter reliably.`;
        }
        if (band.high - band.low < EEGHFO.minBandWidth) return `Use a band at least ${EEGHFO.minBandWidth} Hz wide so the filter can resolve oscillations.`;
        return null;
    },

    // line frequency from the menu, or detected once per recording from harmonic peaks
    getHFOLinePlan(band) {
        const hfo = this.state.hfo;
        const data = this.state.eegData;
        if (!hfo.line.checked) {
            const detection = EEGHFO.detectLineFrequency(data.channelData, data.sampleRate);
            hfo.line.checked = true;
            hfo.line.detected = detection.frequency;
            hfo.line.spectrum = detection.spectrum;
        }
        const mode = hfo.line.mode;
        const frequency = mode === 'auto' ? hfo.line.detected : mode === 'off' ? null : Number(mode);
        const notches = frequency && !this.validateHFOBand(band)
            ? EEGHFO.planNotches(frequency, hfo.line.spectrum, data.sampleRate, band)
            : [];
        const components = EEGHFO.presentLineComponents(frequency, hfo.line.spectrum, data.sampleRate);
        return { mode, frequency, detected: hfo.line.detected, notches, components };
    },

    describeHFOLinePlan(plan) {
        const notchText = plan.notches.length
            ? `Notching ${plan.notches.map(item => `${item.frequency.toFixed(item.frequency % 1 ? 1 : 0)} Hz${item.aliased ? ` (alias of ${item.harmonic * plan.frequency} Hz)` : ''}`).join(', ')} before detection.`
            : 'No line harmonics fall inside the band.';
        if (plan.mode === 'off') return 'Line noise is not notched. Harmonics inside the band can produce false candidates.';
        if (plan.mode === 'auto' && !plan.frequency) return 'No 50 or 60 Hz line noise stands out in this recording, so nothing is notched.';
        return `${plan.mode === 'auto' ? `${plan.frequency} Hz line noise detected.` : `${plan.frequency} Hz line noise.`} ${notchText}`;
    },

    formatHz(value) {
        return `${Number(value).toLocaleString(undefined, { maximumFractionDigits: 1 })} Hz`;
    },

    updateHFOBandNote() {
        const note = document.getElementById('hfo-band-note');
        const run = document.getElementById('hfo-run');
        if (!note) return;
        if (!this.state.eegData) {
            note.replaceChildren();
            return;
        }
        const hfo = this.state.hfo;
        const sampleRate = this.state.eegData.sampleRate;
        const assessment = EEGHFO.assessSampling(sampleRate, hfo.bandKey === 'custom' ? null : hfo.bandKey);
        const band = this.readHFOBand();
        const error = this.validateHFOBand(band);
        const parts = [];
        let tone = assessment.tone;
        if (assessment.headline) parts.push(['strong', assessment.headline]);
        if (assessment.message) parts.push(['span', ` ${assessment.message}`]);
        if (error && tone !== 'blocked') {
            tone = 'blocked';
            parts.push(['strong', ' Band:'], ['span', ` ${error}`]);
        } else if (!error && band.high > EEGHFO.usableCeiling(sampleRate)) {
            if (tone === 'info') tone = 'warning';
            parts.push(['strong', ' Near Nyquist:'], ['span', ` the recording's anti-alias filter often attenuates activity above ${EEGHFO.usableCeiling(sampleRate)} Hz.`]);
        }
        const detector = EEGHFO.detectorDefinition(hfo.detector);
        const availability = EEGHFO.detectorAvailability(hfo.detector, sampleRate, band.key === 'ripple_fr' ? null : band);
        if (!availability.available) {
            tone = 'blocked';
            parts.unshift(['strong', 'Detector unavailable. '], ['span', `${availability.reason} `]);
        } else if (detector.fixedBand) {
            parts.push(['strong', ' Band:'], ['span', ` ${detector.short} always uses its own ${detector.fixedBand.low}–${Math.min(detector.fixedBand.high, EEGHFO.hardCeiling(sampleRate))} Hz band, so the band setting above is ignored.`]);
        }
        this.refreshHFODetectorOptions();
        if (tone !== 'blocked') {
            const plan = this.getHFOLinePlan(band);
            parts.push(['span', ` ${this.describeHFOLinePlan(plan)}`]);
            document.getElementById('hfo-line-detail').textContent = this.describeHFOLinePlan(plan);
            const lineSelect = document.getElementById('hfo-line');
            const autoOption = lineSelect.querySelector('option[value="auto"]');
            autoOption.textContent = plan.detected ? `Detect from recording (${plan.detected} Hz)` : 'Detect from recording (none found)';
        }
        if (hfo.recordingState === 'wake' || hfo.recordingState === 'mixed') {
            parts.push(['strong', ' State:'], ['span', ' most HFO studies analyse 5–10 min of NREM sleep, where pathological HFOs are most frequent; awake recordings carry more muscle activity, so rates are not comparable.']);
        } else if (hfo.recordingState === 'unknown') {
            parts.push(['strong', ' State:'], ['span', ' unknown. HFO rates change with sleep stage and time of night, so rates from different states are not comparable.']);
        }
        const prefiltering = this.state.eegData.metadata?.prefiltering;
        if (Array.isArray(prefiltering) && !prefiltering.length) {
            parts.push(['strong', ' Acquisition filter:'], ['span', ' not documented in the EDF header, so activity near Nyquist may be attenuated, or folded down from above it.']);
        }
        if (this.state.eegData.duration < 600) {
            parts.push(['strong', ' Length:'], ['span', ` ${(this.state.eegData.duration / 60).toFixed(1)} min. Rates from under 10 minutes are unstable (Zelmann et al. 2009).`]);
        }
        parts.push(['span', ' Detection runs on the raw recorded channels; the Filtering tab does not change it.']);
        note.dataset.tone = tone || 'info';
        note.replaceChildren(...parts.map(([tag, text]) => {
            const element = document.createElement(tag);
            element.textContent = text;
            return element;
        }));
        if (run && !hfo.busy) run.disabled = tone === 'blocked';
    },

    refreshHFODetectorOptions() {
        const data = this.state.eegData;
        const select = document.getElementById('hfo-detector');
        for (const option of select.options || []) {
            const definition = EEGHFO.detectorDefinition(option.value);
            const availability = data ? EEGHFO.detectorAvailability(option.value, data.sampleRate) : { available: true };
            option.textContent = availability.available ? definition.label : `${definition.label} (${availability.short})`;
        }
    },

    hfoParamsFor(detector) {
        const hfo = this.state.hfo;
        if (detector === hfo.detector) return hfo.params;
        return hfo.paramsByDetector[detector] || EEGHFO.defaultParams(detector, hfo.electrodes);
    },

    renderHFOConsensusMembers(detector) {
        const hfo = this.state.hfo;
        const container = document.getElementById('hfo-consensus-members');
        container.hidden = !detector.consensus;
        if (!detector.consensus) return;
        const heading = document.createElement('p');
        heading.className = 'hfo-consensus-heading';
        heading.textContent = 'Detectors to compare. Each uses its own settings; choose one above to edit them.';
        const options = Object.entries(EEGHFO.detectors).map(([key, definition]) => {
            const label = document.createElement('label');
            label.className = 'hfo-consensus-option';
            const input = document.createElement('input');
            input.type = 'checkbox';
            input.value = key;
            input.checked = hfo.consensusMembers.includes(key);
            const availability = this.state.eegData ? EEGHFO.detectorAvailability(key, this.state.eegData.sampleRate) : { available: true };
            input.disabled = !availability.available;
            input.addEventListener('change', () => {
                const chosen = new Set(hfo.consensusMembers);
                if (input.checked) chosen.add(key);
                else chosen.delete(key);
                hfo.consensusMembers = Object.keys(EEGHFO.detectors).filter(item => chosen.has(item));
                hfo.confirmReplace = false;
            });
            const text = document.createElement('span');
            text.textContent = availability.available ? definition.label : `${definition.label} (${availability.short})`;
            label.append(input, text);
            return label;
        });
        container.replaceChildren(heading, ...options);
    },

    renderHFOSettings() {
        const hfo = this.state.hfo;
        const detector = EEGHFO.detectorDefinition(hfo.detector);
        this.renderHFOConsensusMembers(detector);
        const fields = document.getElementById('hfo-settings-fields');
        const defaults = EEGHFO.defaultParams(hfo.detector, hfo.electrodes);
        document.getElementById('hfo-electrodes').value = hfo.electrodes;
        document.getElementById('hfo-line').value = hfo.line.mode;
        fields.replaceChildren();
        for (const param of detector.params) {
            const field = document.createElement('div');
            field.className = 'hfo-field';
            const id = `hfo-param-${param.key}`;
            const label = document.createElement('label');
            label.htmlFor = id;
            label.textContent = param.unit ? `${param.label} (${param.unit})` : param.label;
            const input = document.createElement('input');
            input.type = 'number';
            input.id = id;
            input.className = 'toolbar-input';
            input.min = param.min;
            input.max = param.max;
            input.step = param.step;
            input.value = hfo.params[param.key];
            const help = document.createElement('small');
            help.textContent = `${param.help} Default: ${defaults[param.key]}${param.unit ? ` ${param.unit}` : ''}.`;
            field.classList.toggle('is-changed', Number(hfo.params[param.key]) !== Number(defaults[param.key]));
            input.addEventListener('change', () => {
                const value = Number(input.value);
                if (!Number.isFinite(value) || value < param.min || value > param.max) {
                    input.value = hfo.params[param.key];
                    this.showToast(`${param.label} must be between ${param.min} and ${param.max}${param.unit ? ` ${param.unit}` : ''}.`, 'error');
                    return;
                }
                hfo.params[param.key] = value;
                hfo.confirmReplace = false;
                field.classList.toggle('is-changed', value !== Number(defaults[param.key]));
            });
            field.append(label, input, help);
            fields.appendChild(field);
        }
        document.getElementById('hfo-settings-citation').textContent = detector.citation;
    },

    // ---------- detection ----------

    async runHFODetection() {
        const data = this.state.eegData;
        const hfo = this.state.hfo;
        if (!data || hfo.busy) return;

        const detector = EEGHFO.detectorDefinition(hfo.detector);
        let band = this.readHFOBand();
        const bandError = this.validateHFOBand(band);
        const assessment = EEGHFO.assessSampling(data.sampleRate, band.key === 'custom' ? null : band.key);
        if (assessment.tone === 'blocked' || bandError) {
            this.showToast(bandError || assessment.message, 'error');
            return;
        }
        const availability = EEGHFO.detectorAvailability(hfo.detector, data.sampleRate, band.key === 'ripple_fr' ? null : band);
        if (!availability.available) {
            this.showToast(availability.reason, 'error');
            return;
        }
        if (detector.fixedBand) band = { key: 'ripple', low: detector.fixedBand.low, high: Math.min(detector.fixedBand.high, EEGHFO.hardCeiling(data.sampleRate)) };
        const scope = document.getElementById('hfo-channel-scope').value;
        const requested = scope === 'all'
            ? data.channelLabels.map((_, index) => index)
            : this.state.selectedChannels.slice();
        if (!requested.length) {
            this.showToast('Select at least one channel in the sidebar, or choose All channels.', 'info');
            return;
        }
        // a channel that repeats another (or its inverse) would double every event and rate
        if (!hfo.duplicates) hfo.duplicates = EEGHFO.findDuplicateChannels(data.channelData, data.sampleRate);
        const requestedSet = new Set(requested);
        const skippedDuplicates = hfo.duplicates.filter(item => requestedSet.has(item.index) && requestedSet.has(item.of));
        const channels = requested.filter(index => !skippedDuplicates.some(item => item.index === index));

        const reviewed = hfo.events.filter(event => event.source === 'detector' && event.status !== 'pending').length;
        const runButton = document.getElementById('hfo-run');
        if (reviewed > 0 && !hfo.confirmReplace) {
            hfo.confirmReplace = true;
            runButton.textContent = `Replace ${reviewed} reviewed`;
            this.showToast(`Running again replaces the current candidates, including ${reviewed} you reviewed. Hand-marked events are kept. Select Replace ${reviewed} reviewed to continue.`, 'info');
            return;
        }
        hfo.confirmReplace = false;

        const params = { ...hfo.params };
        let consensus = null;
        if (detector.consensus) {
            const members = hfo.consensusMembers.filter(key => Object.hasOwn(EEGHFO.detectors, key) && EEGHFO.detectorAvailability(key, data.sampleRate).available);
            if (members.length < 2) {
                this.showToast('Choose at least two detectors to compare in Detector settings.', 'error');
                return;
            }
            if (params.minAgreement > members.length) {
                this.showToast(`At most ${members.length} detectors can agree, because ${members.length} are selected.`, 'error');
                return;
            }
            consensus = {
                members: members.map(key => ({ detector: key, params: { ...this.hfoParamsFor(key) } })),
                minAgreement: params.minAgreement,
                toleranceMs: params.toleranceMs
            };
        }
        const durationChecks = consensus ? consensus.members.map(member => member.params) : [params];
        if (durationChecks.some(item => item.maxDurationMs < item.minDurationMs)) {
            this.showToast('The longest event must be at least as long as the shortest event.', 'error');
            return;
        }
        const linePlan = this.getHFOLinePlan(band);
        const runBands = band.key === 'ripple_fr' ? EEGHFO.dualBands(data.sampleRate) : [band];
        const bandPlans = runBands.map(item => ({ band: item, plan: this.getHFOLinePlan(item) }));
        // fast ripples are shorter: the Zurich detector uses 10–100 ms for them (Fedele 2017)
        const paramsFor = (item, base) => item.key === 'fast_ripple' && run.detector === 'zurich'
            ? { ...base, minDurationMs: Math.min(base.minDurationMs, 10), maxDurationMs: Math.min(base.maxDurationMs, 100) }
            : base;
        const run = {
            id: this.createHFOId(),
            detector: hfo.detector,
            detectorLabel: detector.label,
            citation: detector.citation,
            band: { key: band.key, low: band.low, high: band.high },
            bands: runBands.map(item => ({ ...item })),
            params,
            consensus,
            channels: channels.slice(),
            skippedDuplicates: skippedDuplicates.map(item => ({ ...item })),
            sampleRate: data.sampleRate,
            electrodes: hfo.electrodes,
            recordingState: hfo.recordingState,
            bandLimited: assessment.limited,
            lineFrequency: linePlan.frequency,
            notches: Array.from(new Set(bandPlans.flatMap(item => item.plan.notches.map(notch => notch.frequency)))),
            signal: 'raw',
            montage: 'as recorded',
            startedAt: new Date().toISOString(),
            finishedAt: null,
            stats: {}
        };

        hfo.busy = true;
        runButton.disabled = true;
        runButton.textContent = 'Detecting…';
        const status = document.getElementById('hfo-run-status');
        const progress = document.getElementById('hfo-run-progress');
        const bar = document.getElementById('hfo-run-progress-bar');
        status.hidden = false;
        document.getElementById('hfo-run-status-title').textContent = `${detector.short} · ${band.low}–${band.high} Hz`;
        const started = performance.now();
        const detected = [];
        const screened = [];
        const channelSpikes = new Map();

        try {
            for (let i = 0; i < channels.length; i++) {
                const channelIndex = channels[i];
                const label = data.channelLabels[channelIndex];
                const percent = Math.round(i / channels.length * 100);
                document.getElementById('hfo-run-status-detail').textContent = `${label} · channel ${i + 1} of ${channels.length}`;
                progress.setAttribute('aria-valuenow', String(percent));
                bar.style.setProperty('--progress', `${percent}%`);
                await new Promise(resolve => setTimeout(resolve, 0));
                // A recording/session reset cancels this run before it can publish stale results.
                if (this.state.eegData !== data || this.state.hfo !== hfo) return;

                const channelEvents = [];
                for (const { band: runBand, plan } of bandPlans) {
                    const result = EEGHFO.detectChannel(data.channelData[channelIndex], data.sampleRate, {
                        detector: run.detector,
                        band: runBand,
                        params: paramsFor(runBand, params),
                        notches: plan.notches,
                        lineFrequency: plan.frequency,
                        lineComponents: plan.components,
                        bandLimited: runBands.length > 1 ? EEGHFO.assessSampling(data.sampleRate, runBand.key).limited : assessment.limited,
                        consensus: consensus && {
                            ...consensus,
                            members: consensus.members.map(member => ({ ...member, params: paramsFor(runBand, member.params) }))
                        }
                    });
                    if (runBand === bandPlans[0].band) run.stats[channelIndex] = result.stats;
                    else run.stats[channelIndex] = { ...run.stats[channelIndex], fastRipple: result.stats };
                    for (const item of result.screened || []) {
                        if (screened.length >= 60000) break;
                        screened.push({
                            id: `screened-${channelIndex}-${runBand.key}-${item.start}`,
                            channelIndex,
                            channel: label,
                            onset: item.start / data.sampleRate,
                            offset: item.end / data.sampleRate,
                            stage: item.stage,
                            reason: item.reason,
                            criteria: item.criteria
                        });
                    }
                    for (const event of result.events) {
                        channelEvents.push({
                            id: this.createHFOId(),
                            runId: run.id,
                            channelIndex,
                            channel: label,
                            onset: event.start / data.sampleRate,
                            offset: event.end / data.sampleRate,
                            source: 'detector',
                            status: 'pending',
                            label: 'hfo',
                            band: { key: runBand.key, low: runBand.low, high: runBand.high },
                            features: event.features,
                            createdAt: new Date().toISOString(),
                            reviewedAt: null
                        });
                    }
                }
                // spikes on this channel feed the spike-association label
                const spikes = EEGHFO.detectSpikes(data.channelData[channelIndex], data.sampleRate, { lineFrequency: linePlan.frequency });
                run.stats[channelIndex].spikes = spikes.length;
                run.stats[channelIndex].spikeRate = spikes.length / (data.duration / 60);
                channelSpikes.set(channelIndex, spikes);
                detected.push(...channelEvents);
            }
            progress.setAttribute('aria-valuenow', '100');
            bar.style.setProperty('--progress', '100%');
            EEGHFO.flagMultichannel(detected, channels.length, data.sampleRate);
            for (const [channelIndex, spikes] of channelSpikes) {
                EEGHFO.classifyChannelEvents(detected.filter(event => event.channelIndex === channelIndex), spikes, hfo.electrodes);
            }
            EEGHFO.markRippleFastRipple(detected);
            hfo.spikes = channelSpikes;
            this.renderHFOScreening(run, detected.length);

            run.finishedAt = new Date().toISOString();
            hfo.run = run;
            hfo.screened = screened;
            hfo.selectedScreened = null;
            hfo.channelFilter = null;
            hfo.events = hfo.events.filter(event => event.source === 'reviewer').concat(detected);
            this.sortHFOEvents();
            hfo.undo = [];
            hfo.referenceStd = {};
            hfo.filter = 'all';
            hfo.listLimit = 300;
            const channelsWithEvents = new Set(detected.map(event => event.channelIndex)).size;
            const seconds = ((performance.now() - started) / 1000).toFixed(1);
            this.recordHistory(
                'hfo_detection',
                `Detected ${detected.length} HFO ${detected.length === 1 ? 'candidate' : 'candidates'} with ${detector.short}`,
                reviewed ? `${reviewed} reviewed candidates replaced` : 'No candidates',
                `${band.low}–${band.high} Hz · ${channels.length} ${channels.length === 1 ? 'channel' : 'channels'}`,
                null
            );
            const first = this.getHFONeighbor(null, 1, { pendingOnly: true });
            if (first) this.selectHFOEvent(first.id, { reveal: true });
            else {
                hfo.selectedId = null;
                this.refreshHFOView();
            }
            this.showToast(detected.length
                ? `${detected.length} ${detected.length === 1 ? 'candidate' : 'candidates'} on ${channelsWithEvents} ${channelsWithEvents === 1 ? 'channel' : 'channels'} in ${seconds} s · press Y or N to review`
                : `No candidates crossed the threshold on ${channels.length} ${channels.length === 1 ? 'channel' : 'channels'}`,
            detected.length ? 'success' : 'info');
        } catch (error) {
            console.error('HFO detection failed', error);
            this.showToast(`HFO detection stopped: ${error.message}`, 'error');
        } finally {
            hfo.busy = false;
            if (this.state.hfo === hfo && this.state.eegData === data) {
                status.hidden = true;
                runButton.textContent = 'Run detection';
                this.updateHFOBandNote();
                this.syncHFOAnalysisResult();
            }
        }
    },

    renderHFOScreening(run, kept) {
        const totals = {};
        for (const stats of Object.values(run.stats)) {
            for (const [key, value] of Object.entries(stats.screening || {})) totals[key] = (totals[key] || 0) + value;
        }
        const names = {
            duration: 'duration',
            peaks: 'too few oscillation peaks',
            spectral: 'spectral check',
            amplitude: 'amplitude ceiling',
            snr: 'signal-to-noise',
            ratio: 'wide/narrow ratio',
            rms: 'narrowband RMS',
            agreement: 'too few detectors agreeing'
        };
        const removed = Object.entries(names)
            .filter(([key]) => totals[key])
            .map(([key, label]) => `${totals[key].toLocaleString()} ${label}`);
        const line = document.getElementById('hfo-screening');
        const found = run.consensus ? 'detections from all members' : 'threshold crossings';
        const labels = this.state.eegData.channelLabels;
        const duplicates = (run.skippedDuplicates || []).map(item => `${labels[item.index]} (${item.inverted ? 'inverted copy' : 'copy'} of ${labels[item.of]})`);
        line.textContent = `Last run: ${(totals.crossings || 0).toLocaleString()} ${found} → ${kept.toLocaleString()} candidates.${removed.length ? ` Screened out by ${removed.join(', ')}.` : ''}${duplicates.length ? ` Skipped duplicate channels: ${duplicates.join(', ')}.` : ''} Turn on Near-misses to see what was set aside and why.`;
        line.hidden = false;
        run.screening = totals;
    },

    createHFOId() {
        return window.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    },

    sortHFOEvents() {
        this.state.hfo.events.sort((a, b) => a.onset - b.onset || a.channelIndex - b.channelIndex);
    },

    // ---------- review state ----------

    hfoVisualStatus(event) {
        if (event.source === 'reviewer') {
            if (event.label === 'artifact') return 'artifact';
            if (event.label === 'uncertain') return 'uncertain';
            return 'reviewer';
        }
        return event.status;
    },

    hfoFilterMatches(event, filter) {
        if (filter === 'all') return true;
        if (filter === 'reviewer') return event.source === 'reviewer';
        return event.source === 'detector' && event.status === filter;
    },

    getHFOEvent(id) {
        return this.state.hfo.events.find(event => event.id === id) || null;
    },

    // review order shared by the table and J/K stepping
    orderedHFOEvents(events) {
        const order = this.state.hfo.order;
        if (order === 'time') return events;
        const sorted = events.slice();
        if (order === 'strength') {
            const strength = event => event.features?.backgroundRatio ?? -1;
            sorted.sort((a, b) => strength(b) - strength(a) || a.onset - b.onset);
        } else {
            sorted.sort((a, b) => a.channelIndex - b.channelIndex || a.onset - b.onset);
        }
        return sorted;
    },

    getHFONeighbor(fromEvent, direction, options = {}) {
        const events = this.orderedHFOEvents(this.state.hfo.events.filter(event => {
            const hfo = this.state.hfo;
            const scoped = this.hfoClassMatches(event, hfo.classFilter) && (hfo.channelFilter === null || event.channelIndex === hfo.channelFilter);
            if (options.pendingOnly) return scoped && event.source === 'detector' && event.status === 'pending';
            return scoped && this.hfoFilterMatches(event, hfo.filter);
        }));
        if (!events.length) return null;
        if (!fromEvent) return direction > 0 ? events[0] : events[events.length - 1];
        let index = events.indexOf(fromEvent);
        if (index < 0) {
            // the current event left this list (for example it was just decided); resume from where it sat
            const all = this.orderedHFOEvents(this.state.hfo.events);
            const position = all.indexOf(fromEvent);
            const following = all.slice(position + 1).find(event => events.includes(event));
            if (direction > 0) return following || (options.wrap === false ? null : events[0]);
            const preceding = all.slice(0, Math.max(0, position)).reverse().find(event => events.includes(event));
            return preceding || (options.wrap === false ? null : events[events.length - 1]);
        }
        index += direction;
        if (index >= 0 && index < events.length) return events[index];
        if (options.wrap === false) return null;
        return direction > 0 ? events[0] : events[events.length - 1];
    },

    selectHFOEvent(id, options = {}) {
        const hfo = this.state.hfo;
        const event = id ? this.getHFOEvent(id) : null;
        hfo.selectedId = event ? event.id : null;
        if (event || !options.keepScreened) hfo.selectedScreened = null;
        if (event && options.reveal) {
            if (!this.state.selectedChannels.includes(event.channelIndex)) {
                this.state.selectedChannels = [...this.state.selectedChannels, event.channelIndex].sort((a, b) => a - b);
                this.updateChannelCheckboxes();
                this.showToast(`${event.channel} was added to the selected channels so the event is visible`, 'info');
            }
            const visibleStart = hfo.viewStart + hfo.window * 0.1;
            const visibleEnd = hfo.viewStart + hfo.window * 0.9;
            if (event.onset < visibleStart || event.offset > visibleEnd) {
                this.setHFOViewStart((event.onset + event.offset) / 2 - hfo.window / 2, { refresh: false });
            }
        }
        this.refreshHFOView();
        if (event && options.reveal) this.scrollHFORowIntoView(event.channelIndex);
    },

    stepHFOEvent(direction) {
        const current = this.getHFOEvent(this.state.hfo.selectedId);
        const next = this.getHFONeighbor(current, direction);
        if (next) this.selectHFOEvent(next.id, { reveal: true });
    },

    pushHFOUndo(entry) {
        const undo = this.state.hfo.undo;
        undo.push(entry);
        if (undo.length > 300) undo.shift();
    },

    decideHFOEvent(status) {
        const hfo = this.state.hfo;
        const event = this.getHFOEvent(hfo.selectedId);
        if (!event || event.source !== 'detector') return;
        // repeating a decision keeps it and moves on; U is the explicit way back to "to review"
        if (event.status !== status) {
            this.pushHFOUndo({ type: 'status', id: event.id, previous: event.status, previousReviewedAt: event.reviewedAt });
            event.status = status;
            event.reviewedAt = new Date().toISOString();
            this.syncHFOAnalysisResult();
        }
        const next = this.getHFONeighbor(event, 1, { pendingOnly: true, wrap: false })
            || this.getHFONeighbor(null, 1, { pendingOnly: true });
        if (next) {
            this.selectHFOEvent(next.id, { reveal: true });
            return;
        }
        this.showToast('Every candidate in this run has a decision', 'success');
        this.refreshHFOView();
    },

    resetHFODecision() {
        const event = this.getHFOEvent(this.state.hfo.selectedId);
        if (!event || event.source !== 'detector' || event.status === 'pending') return;
        this.pushHFOUndo({ type: 'status', id: event.id, previous: event.status, previousReviewedAt: event.reviewedAt });
        event.status = 'pending';
        event.reviewedAt = null;
        this.syncHFOAnalysisResult();
        this.refreshHFOView();
    },

    labelHFOEvent(label) {
        const event = this.getHFOEvent(this.state.hfo.selectedId);
        if (!event || event.source !== 'reviewer' || !this.hfoReviewerLabels[label] || event.label === label) return;
        this.pushHFOUndo({ type: 'label', id: event.id, previous: event.label });
        event.label = label;
        this.syncHFOAnalysisResult();
        this.refreshHFOView();
    },

    addHFOMarks(onset, offset, channelIndices, options = {}) {
        const data = this.state.eegData;
        const hfo = this.state.hfo;
        const minimum = 2 / data.sampleRate;
        const start = Math.max(0, Math.min(onset, offset));
        const end = Math.min(data.duration, Math.max(onset, offset));
        if (end - start < minimum || !channelIndices.length) return;
        const band = this.readHFOBand();
        const created = channelIndices.map(channelIndex => {
            const event = {
                id: this.createHFOId(),
                runId: null,
                channelIndex,
                channel: data.channelLabels[channelIndex],
                onset: start,
                offset: end,
                source: 'reviewer',
                status: 'accepted',
                label: 'hfo',
                band: { key: band.key, low: band.low, high: band.high },
                features: this.measureHFOSegment(channelIndex, start, end, band),
                createdAt: new Date().toISOString(),
                reviewedAt: new Date().toISOString()
            };
            hfo.events.push(event);
            return event;
        });
        this.sortHFOEvents();
        this.pushHFOUndo({ type: 'add', ids: created.map(event => event.id) });
        this.syncHFOAnalysisResult();
        this.selectHFOEvent(created[0].id);
        if (!options.silent && hfo.events.filter(event => event.source === 'reviewer').length === created.length) {
            this.showToast(created.length === 1
                ? 'Event marked. It stays until you delete it; change its label in the panel on the right.'
                : `${created.length} events marked, one per channel`, 'success');
        }
    },

    measureHFOSegment(channelIndex, onset, offset, band) {
        const data = this.state.eegData;
        const sampleRate = data.sampleRate;
        const pad = Math.round(0.5 * sampleRate);
        const start = Math.max(0, Math.floor(onset * sampleRate) - pad);
        const end = Math.min(data.numSamples, Math.ceil(offset * sampleRate) + pad);
        const raw = data.channelData[channelIndex].subarray(start, end);
        const valid = !this.validateHFOBand(band);
        const filtered = valid ? EEGHFO.bandpass(raw, sampleRate, band.low, band.high) : raw;
        const background = this.state.hfo.run?.stats?.[channelIndex]?.filteredStd || EEGHFO.meanStd(filtered).std;
        const features = EEGHFO.describeEvent(raw, filtered,
            Math.floor(onset * sampleRate) - start,
            Math.ceil(offset * sampleRate) - start,
            sampleRate, band, { backgroundStd: background, offsetSamples: start });
        const preset = EEGHFO.bands[band.key];
        features.flags = preset && (band.low > preset.low || band.high < preset.high) ? ['band-limited'] : [];
        return features;
    },

    // a near-miss the reviewer believes is real becomes a hand mark that remembers where it came from
    promoteHFOScreened() {
        const hfo = this.state.hfo;
        const item = hfo.selectedScreened;
        if (!item) return;
        this.addHFOMarks(item.onset, item.offset, [item.channelIndex], { silent: true });
        const mark = this.getHFOEvent(hfo.selectedId);
        if (mark) mark.promotedFrom = { stage: item.stage, reason: item.reason, detector: hfo.run?.detector || null };
        hfo.screened = hfo.screened.filter(entry => entry !== item);
        hfo.selectedScreened = null;
        this.syncHFOAnalysisResult();
        this.refreshHFOView();
        this.showToast('Near-miss marked as an HFO. The detector setting that set it aside is kept with the mark.', 'success');
    },

    // exact-enough 95% Poisson interval (Byar's approximation; exact upper bound at zero)
    poissonInterval(count) {
        const z = 1.959964;
        if (count <= 0) return { low: 0, high: 3.689 };
        const low = count * Math.pow(1 - 1 / (9 * count) - z / (3 * Math.sqrt(count)), 3);
        const next = count + 1;
        const high = next * Math.pow(1 - 1 / (9 * next) + z / (3 * Math.sqrt(next)), 3);
        return { low: Math.max(0, low), high };
    },

    hfoChannelSummary() {
        const hfo = this.state.hfo;
        const data = this.state.eegData;
        if (!data) return [];
        const minutes = data.duration / 60;
        const channels = new Set(hfo.run?.channels || []);
        for (const event of hfo.events) channels.add(event.channelIndex);
        return Array.from(channels).sort((a, b) => a - b).map(channelIndex => {
            const own = hfo.events.filter(event => event.channelIndex === channelIndex);
            const counts = { candidates: 0, pending: 0, accepted: 0, rejected: 0, marked: 0, artifact: 0 };
            for (const event of own) {
                if (event.source === 'detector') {
                    counts.candidates++;
                    counts[event.status]++;
                } else if (event.label === 'hfo') counts.marked++;
                else if (event.label === 'artifact') counts.artifact++;
            }
            const confirmed = counts.accepted + counts.marked;
            const interval = this.poissonInterval(confirmed);
            const stats = hfo.run?.stats?.[channelIndex];
            return {
                channelIndex,
                channel: data.channelLabels[channelIndex],
                minutes,
                analysed: !hfo.run || hfo.run.channels.includes(channelIndex),
                ...counts,
                confirmed,
                confirmedRate: confirmed / minutes,
                confirmedLow: interval.low / minutes,
                confirmedHigh: interval.high / minutes,
                candidateRate: counts.candidates / minutes,
                reviewedShare: counts.candidates ? (counts.accepted + counts.rejected) / counts.candidates : null,
                spikeRate: Number.isFinite(stats?.spikeRate) ? stats.spikeRate : null,
                spikeCandidates: own.filter(event => event.features?.classification?.primary === 'spike_hfo').length
            };
        });
    },

    exportHFOChannelSummary() {
        const rows = this.hfoChannelSummary();
        if (!rows.length) {
            this.showToast('Run detection or mark an event before downloading the channel summary.', 'info');
            return;
        }
        this.runExport(document.getElementById('hfo-channel-export'), () => EEGExport.exportHFOChannelSummaryCSV(this.state.eegData, rows, this.state.hfo.run), 'HFO channel summary CSV download started');
    },

    deleteHFOEvent() {
        const hfo = this.state.hfo;
        const event = this.getHFOEvent(hfo.selectedId);
        if (!event || event.source !== 'reviewer') return;
        const index = hfo.events.indexOf(event);
        const next = this.getHFONeighbor(event, 1, { wrap: false }) || this.getHFONeighbor(event, -1, { wrap: false });
        hfo.events.splice(index, 1);
        this.pushHFOUndo({ type: 'delete', events: [event] });
        hfo.selectedId = next?.id || null;
        this.syncHFOAnalysisResult();
        this.refreshHFOView();
    },

    undoHFO() {
        const hfo = this.state.hfo;
        const entry = hfo.undo.pop();
        if (!entry) return;
        if (entry.type === 'status') {
            const event = this.getHFOEvent(entry.id);
            if (event) {
                event.status = entry.previous;
                event.reviewedAt = entry.previousReviewedAt;
                hfo.selectedId = event.id;
            }
        } else if (entry.type === 'label') {
            const event = this.getHFOEvent(entry.id);
            if (event) {
                event.label = entry.previous;
                hfo.selectedId = event.id;
            }
        } else if (entry.type === 'bounds') {
            const event = this.getHFOEvent(entry.id);
            if (event) {
                event.onset = entry.previous.onset;
                event.offset = entry.previous.offset;
                event.features = entry.previous.features;
                hfo.selectedId = event.id;
            }
        } else if (entry.type === 'add') {
            const removed = new Set(entry.ids);
            hfo.events = hfo.events.filter(event => !removed.has(event.id));
            if (removed.has(hfo.selectedId)) hfo.selectedId = null;
        } else if (entry.type === 'delete') {
            hfo.events.push(...entry.events);
            this.sortHFOEvents();
            hfo.selectedId = entry.events[0].id;
        }
        this.syncHFOAnalysisResult();
        const selected = this.getHFOEvent(hfo.selectedId);
        if (selected) this.selectHFOEvent(selected.id, { reveal: true });
        else this.refreshHFOView();
    },

    hfoCounts() {
        const counts = { all: 0, pending: 0, accepted: 0, rejected: 0, reviewer: 0 };
        for (const event of this.state.hfo.events) {
            counts.all++;
            if (event.source === 'reviewer') counts.reviewer++;
            else counts[event.status]++;
        }
        return counts;
    },

    syncHFOAnalysisResult() {
        const hfo = this.state.hfo;
        if (!hfo || (!hfo.run && !hfo.events.length)) {
            if (this.state.analysisResults) delete this.state.analysisResults.hfo;
            return;
        }
        this.state.analysisResults.hfo = this.getHFOExportData();
    },

    getHFOExportData() {
        const hfo = this.state.hfo;
        const run = hfo.run ? { ...hfo.run } : null;
        if (run) {
            run.channels = run.channels.map(index => ({ index, label: this.state.eegData.channelLabels[index] }));
            // Recorded labels can repeat, including in the bundled CHB-MIT sample.
            // Keep the channel index as the key so no measurements are overwritten.
            run.stats = Object.fromEntries(Object.entries(run.stats).map(([index, stats]) => [index, {
                ...stats, channelIndex: Number(index), channel: this.state.eegData.channelLabels[index]
            }]));
        }
        return {
            run,
            counts: this.hfoCounts(),
            events: hfo.events.map(event => ({ ...event, features: { ...event.features } }))
        };
    },

    // ---------- view state ----------

    setHFOViewStart(value, options = {}) {
        const hfo = this.state.hfo;
        const duration = this.state.eegData?.duration || 0;
        hfo.viewStart = Math.max(0, Math.min(value, Math.max(0, duration - hfo.window)));
        if (options.refresh !== false) this.refreshHFOView();
    },

    pageHFO(direction) {
        this.setHFOViewStart(this.state.hfo.viewStart + direction * this.state.hfo.window * 0.9);
    },

    stepHFOGain(direction) {
        const steps = [0.25, 0.5, 0.75, 1, 1.5, 2, 3, 4, 6, 8];
        const hfo = this.state.hfo;
        const index = steps.findIndex(step => step >= hfo.gain - 1e-9);
        const next = steps[Math.max(0, Math.min(steps.length - 1, (index < 0 ? 3 : index) + direction))];
        hfo.gain = next;
        this.refreshHFOView();
    },

    getHFODisplayChannels() {
        return this.state.selectedChannels.slice();
    },

    scrollHFORowIntoView(channelIndex) {
        const geometry = this.state.hfo.geometry;
        const scroll = document.getElementById('hfo-canvas-scroll');
        if (!geometry || !scroll) return;
        const row = geometry.channels.indexOf(channelIndex);
        if (row < 0) return;
        const top = geometry.top + row * geometry.rowHeight;
        const bottom = top + geometry.rowHeight;
        if (top < scroll.scrollTop + geometry.top) scroll.scrollTop = Math.max(0, top - geometry.top - 4);
        else if (bottom > scroll.scrollTop + scroll.clientHeight) scroll.scrollTop = bottom - scroll.clientHeight + 4;
    },

    // ---------- rendering ----------

    refreshHFOView() {
        if (!this.state.eegData || !this.state.hfo) return;
        if (this.state.activeTab !== 'hfo') {
            this.renderHFOTable();
            return;
        }
        const hfo = this.state.hfo;
        const precision = hfo.window <= 2 ? 3 : 2;
        document.getElementById('hfo-time-range').textContent = `${hfo.viewStart.toFixed(precision)}–${Math.min(this.state.eegData.duration, hfo.viewStart + hfo.window).toFixed(precision)} s`;
        document.getElementById('hfo-gain-value').textContent = `${hfo.gain}×`;
        document.getElementById('hfo-window').value = String(hfo.window);
        document.getElementById('hfo-display').value = hfo.display;
        document.getElementById('hfo-scale').value = hfo.scale;
        this.drawHFOTraces();
        this.drawHFOOverlay();
        this.drawHFORaster();
        this.renderHFOInspector();
        this.renderHFOTable();
    },

    hfoGeometry(width, channelCount) {
        const scroll = document.getElementById('hfo-canvas-scroll');
        const available = Math.max(220, parseFloat(getComputedStyle(scroll).maxHeight) || 470);
        const top = 4;
        const rowHeight = channelCount ? Math.max(38, Math.min(96, (available - top - 6) / channelCount)) : 60;
        const left = 78;
        const right = Math.max(left + 40, width - 14);
        return {
            width,
            left,
            right,
            plotWidth: right - left,
            top,
            rowHeight,
            height: Math.round(top + Math.max(1, channelCount) * rowHeight + 6)
        };
    },

    // smallest round step that leaves room for a label between gridlines
    hfoTimeStep(geometry) {
        const steps = [0.001, 0.002, 0.005, 0.01, 0.02, 0.05, 0.1, 0.2, 0.5, 1, 2, 5, 10, 20, 30, 60];
        const window = this.state.hfo.window;
        const minimum = Math.max(window / 12, window * 52 / Math.max(1, geometry.plotWidth));
        return steps.find(step => step >= minimum) || 60;
    },

    // time labels live outside the scrolling stage so they stay visible on long montages
    drawHFOAxis(geometry) {
        const hfo = this.state.hfo;
        const canvas = document.getElementById('hfo-axis-canvas');
        const height = 20;
        const dpr = window.devicePixelRatio || 1;
        canvas.width = Math.round(geometry.width * dpr);
        canvas.height = Math.round(height * dpr);
        canvas.style.width = `${geometry.width}px`;
        canvas.style.height = `${height}px`;
        const ctx = canvas.getContext('2d');
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, geometry.width, height);
        const step = this.hfoTimeStep(geometry);
        const decimals = step < 0.01 ? 3 : step < 0.1 ? 2 : step < 1 ? 1 : 0;
        ctx.font = '10px Inter, sans-serif';
        ctx.fillStyle = '#5E7085';
        ctx.textAlign = 'center';
        for (let t = Math.ceil(hfo.viewStart / step) * step; t <= hfo.viewStart + hfo.window + 1e-9; t += step) {
            const x = geometry.left + (t - hfo.viewStart) / hfo.window * geometry.plotWidth;
            ctx.fillText(`${t.toFixed(decimals)} s`, Math.min(geometry.width - 18, Math.max(geometry.left + 10, x)), 13);
        }
    },

    // reference amplitude per channel: whole-channel stats from the run, or a 30 s excerpt
    getHFOReferenceStd(channelIndex, display) {
        const hfo = this.state.hfo;
        const band = this.readHFOBand();
        if (display === 'filtered' && hfo.run && hfo.run.band.low === band.low && hfo.run.band.high === band.high && hfo.run.stats[channelIndex]) {
            return hfo.run.stats[channelIndex].filteredStd;
        }
        const key = `${display}|${band.low}|${band.high}|${channelIndex}`;
        if (hfo.referenceStd[key] !== undefined) return hfo.referenceStd[key];
        const data = this.state.eegData;
        const length = Math.min(data.numSamples, Math.round(30 * data.sampleRate));
        let segment = data.channelData[channelIndex].subarray(0, length);
        if (display === 'filtered' && !this.validateHFOBand(band)) segment = EEGHFO.bandpass(segment, data.sampleRate, band.low, band.high);
        const std = EEGHFO.meanStd(segment).std || 1;
        hfo.referenceStd[key] = std;
        return std;
    },

    getHFOTraceSegments(channels) {
        const hfo = this.state.hfo;
        const data = this.state.eegData;
        const band = this.readHFOBand();
        const bandValid = !this.validateHFOBand(band);
        const display = hfo.display === 'filtered' && bandValid ? 'filtered' : 'raw';
        const key = [display, hfo.viewStart, hfo.window, band.low, band.high, channels.join(',')].join('|');
        if (hfo.traceCache?.key === key) return hfo.traceCache;

        const sampleRate = data.sampleRate;
        const pad = display === 'filtered' ? Math.round(0.5 * sampleRate) : 0;
        const start = Math.max(0, Math.floor(hfo.viewStart * sampleRate));
        const end = Math.min(data.numSamples, Math.ceil((hfo.viewStart + hfo.window) * sampleRate) + 1);
        const fetchStart = Math.max(0, start - pad);
        const fetchEnd = Math.min(data.numSamples, end + pad);
        const segments = new Map();
        for (const channelIndex of channels) {
            const raw = data.channelData[channelIndex].subarray(fetchStart, fetchEnd);
            const values = display === 'filtered' ? EEGHFO.bandpass(raw, sampleRate, band.low, band.high) : raw;
            let mean = 0;
            if (display === 'raw') {
                for (let i = start - fetchStart; i < end - fetchStart; i++) mean += values[i];
                mean /= Math.max(1, end - start);
            }
            segments.set(channelIndex, { values, offset: start - fetchStart, mean });
        }
        hfo.traceCache = { key, display, start, end, segments };
        return hfo.traceCache;
    },

    drawHFOTraces() {
        const hfo = this.state.hfo;
        const data = this.state.eegData;
        const canvas = document.getElementById('hfo-canvas');
        const stage = canvas.parentElement;
        const channels = this.getHFODisplayChannels();
        const width = Math.max(320, stage.clientWidth);
        const geometry = this.hfoGeometry(width, channels.length);
        geometry.channels = channels;
        hfo.geometry = geometry;

        const dpr = window.devicePixelRatio || 1;
        canvas.width = Math.round(width * dpr);
        canvas.height = Math.round(geometry.height * dpr);
        canvas.style.width = `${width}px`;
        canvas.style.height = `${geometry.height}px`;
        const ctx = canvas.getContext('2d');
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, width, geometry.height);

        const toX = time => geometry.left + (time - hfo.viewStart) / hfo.window * geometry.plotWidth;
        const step = this.hfoTimeStep(geometry);
        this.drawHFOAxis(geometry);
        ctx.strokeStyle = '#EEF2F6';
        ctx.lineWidth = 1;
        for (let t = Math.ceil(hfo.viewStart / step) * step; t <= hfo.viewStart + hfo.window + 1e-9; t += step) {
            const x = Math.round(toX(t)) + 0.5;
            ctx.beginPath();
            ctx.moveTo(x, geometry.top);
            ctx.lineTo(x, geometry.height);
            ctx.stroke();
        }

        if (!channels.length) {
            ctx.fillStyle = '#506176';
            ctx.font = '13px Inter, sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('Select channels in the sidebar to review them here', width / 2, geometry.top + geometry.rowHeight / 2 + 4);
            return;
        }

        const traces = this.getHFOTraceSegments(channels);
        const channelReference = new Map(channels.map(index => [index, this.getHFOReferenceStd(index, traces.display) || 1]));
        const references = Array.from(channelReference.values()).sort((a, b) => a - b);
        const shared = references.length ? references[Math.floor(references.length / 2)] : 1;
        const spread = traces.display === 'filtered' ? 7 : 4;
        const scaleFor = channelIndex => (geometry.rowHeight * 0.46) / ((hfo.scale === 'channel' ? channelReference.get(channelIndex) : shared) * spread / hfo.gain);
        const pixelsPerMicrovolt = scaleFor(channels[0]);
        const analyzed = new Set(hfo.run?.channels || []);
        const samplesPerPixel = (traces.end - traces.start) / geometry.plotWidth;

        channels.forEach((channelIndex, row) => {
            const top = geometry.top + row * geometry.rowHeight;
            const center = top + geometry.rowHeight / 2;
            if (row > 0) {
                ctx.strokeStyle = '#EEF2F6';
                ctx.beginPath();
                ctx.moveTo(geometry.left, Math.round(top) + 0.5);
                ctx.lineTo(geometry.right, Math.round(top) + 0.5);
                ctx.stroke();
            }
            const isBad = this.state.badChannels.includes(channelIndex);
            const notAnalyzed = hfo.run && !analyzed.has(channelIndex);
            ctx.fillStyle = isBad ? '#A51D35' : notAnalyzed ? '#8A99AA' : '#14233A';
            ctx.font = `${notAnalyzed ? 400 : 600} 11px Inter, sans-serif`;
            ctx.textAlign = 'right';
            ctx.fillText(data.channelLabels[channelIndex], geometry.left - 10, center + 4);

            const segment = traces.segments.get(channelIndex);
            const pixelsPerMicrovolt = scaleFor(channelIndex);
            const minY = top + 1;
            const maxY = top + geometry.rowHeight - 1;
            const clamp = y => Math.max(minY, Math.min(maxY, y));
            ctx.strokeStyle = notAnalyzed ? '#8A99AA' : '#1E3350';
            ctx.lineWidth = 1;
            ctx.setLineDash(isBad ? [4, 3] : []);
            ctx.beginPath();
            if (samplesPerPixel > 2) {
                // min/max per pixel column keeps short high-frequency bursts visible
                for (let px = 0; px < geometry.plotWidth; px++) {
                    const a = traces.start + Math.floor(px * samplesPerPixel);
                    const b = Math.min(traces.end, traces.start + Math.floor((px + 1) * samplesPerPixel));
                    let low = Infinity;
                    let high = -Infinity;
                    for (let s = a; s < Math.max(a + 1, b); s++) {
                        const value = segment.values[s - traces.start + segment.offset] - segment.mean;
                        if (value < low) low = value;
                        if (value > high) high = value;
                    }
                    const x = geometry.left + px + 0.5;
                    ctx.moveTo(x, clamp(center - high * pixelsPerMicrovolt));
                    ctx.lineTo(x, clamp(center - low * pixelsPerMicrovolt) + 0.01);
                }
            } else {
                for (let s = traces.start; s < traces.end; s++) {
                    const value = segment.values[s - traces.start + segment.offset] - segment.mean;
                    const x = toX(s / data.sampleRate);
                    const y = clamp(center - value * pixelsPerMicrovolt);
                    if (s === traces.start) ctx.moveTo(x, y);
                    else ctx.lineTo(x, y);
                }
            }
            ctx.stroke();
            ctx.setLineDash([]);
        });

        if (hfo.scale === 'channel') {
            const label = `Each row ±${(spread / hfo.gain).toFixed(spread / hfo.gain < 2 ? 1 : 0)} SD of its own background`;
            ctx.font = '600 9px Inter, sans-serif';
            const labelWidth = ctx.measureText(label).width;
            ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
            ctx.fillRect(geometry.right - labelWidth - 8, geometry.top + 1, labelWidth + 8, 13);
            ctx.fillStyle = '#506176';
            ctx.textAlign = 'right';
            ctx.fillText(label, geometry.right - 4, geometry.top + 11);
            return;
        }
        // amplitude scale bar in the first row
        const target = (geometry.rowHeight * 0.4) / pixelsPerMicrovolt;
        const magnitude = Math.pow(10, Math.floor(Math.log10(target)));
        const nice = [1, 2, 5, 10].map(f => f * magnitude).filter(v => v <= target).pop() || magnitude;
        const barHeight = nice * pixelsPerMicrovolt;
        const barX = geometry.right - 2;
        ctx.strokeStyle = '#506176';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(barX, geometry.top + 4);
        ctx.lineTo(barX, geometry.top + 4 + barHeight);
        ctx.stroke();
        ctx.fillStyle = '#506176';
        ctx.font = '600 9px Inter, sans-serif';
        ctx.textAlign = 'right';
        ctx.fillText(`${nice >= 1 ? nice.toFixed(0) : nice.toPrecision(1)} µV`, barX - 4, geometry.top + 4 + Math.min(barHeight, geometry.rowHeight * 0.4) / 2 + 3);
    },

    hfoEventRect(event, geometry) {
        const hfo = this.state.hfo;
        const row = geometry.channels.indexOf(event.channelIndex);
        if (row < 0) return null;
        const toX = time => geometry.left + (time - hfo.viewStart) / hfo.window * geometry.plotWidth;
        let x1 = toX(event.onset) - 2;
        let x2 = toX(event.offset) + 2;
        if (x2 - x1 < 8) {
            const middle = (x1 + x2) / 2;
            x1 = middle - 4;
            x2 = middle + 4;
        }
        if (x2 < geometry.left || x1 > geometry.right) return null;
        const top = geometry.top + row * geometry.rowHeight + 3;
        return { x1, x2, y1: top, y2: top + geometry.rowHeight - 6, row };
    },

    drawHFOOverlay() {
        const hfo = this.state.hfo;
        const base = document.getElementById('hfo-canvas');
        const canvas = document.getElementById('hfo-interaction-canvas');
        const geometry = hfo.geometry;
        if (!geometry) return;
        const width = geometry.width;
        const height = geometry.height;
        const dpr = window.devicePixelRatio || 1;
        canvas.width = Math.round(width * dpr);
        canvas.height = Math.round(height * dpr);
        canvas.style.width = `${width}px`;
        canvas.style.height = `${height}px`;
        canvas.style.left = `${base.offsetLeft}px`;
        canvas.style.top = `${base.offsetTop}px`;
        const ctx = canvas.getContext('2d');
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, width, height);
        ctx.save();
        ctx.beginPath();
        ctx.rect(geometry.left, geometry.top, geometry.plotWidth, height - geometry.top);
        ctx.clip();

        const end = hfo.viewStart + hfo.window;
        if (hfo.showScreened) {
            ctx.setLineDash([2, 2]);
            for (const item of hfo.screened) {
                if (item.offset < hfo.viewStart || item.onset > end) continue;
                const rect = this.hfoEventRect(item, geometry);
                if (!rect) continue;
                const chosen = hfo.selectedScreened === item;
                ctx.strokeStyle = chosen ? '#14233A' : item === hfo.hoverScreened ? '#506176' : 'rgba(104, 122, 143, 0.75)';
                ctx.lineWidth = chosen ? 1.75 : 1;
                ctx.fillStyle = chosen ? 'rgba(20, 35, 58, 0.06)' : 'transparent';
                this.roundRect(ctx, rect.x1, rect.y1 + 2, rect.x2 - rect.x1, rect.y2 - rect.y1 - 4, 4);
                if (chosen) ctx.fill();
                ctx.stroke();
            }
            ctx.setLineDash([]);
        }
        let selectedRect = null;
        let selectedEvent = null;
        for (const event of hfo.events) {
            if (event.offset < hfo.viewStart || event.onset > end) continue;
            const rect = this.hfoEventRect(event, geometry);
            if (!rect) continue;
            if (event.id === hfo.selectedId) {
                selectedRect = rect;
                selectedEvent = event;
                continue;
            }
            this.paintHFOBox(ctx, rect, this.hfoVisualStatus(event), { hover: event.id === hfo.hoverId });
        }
        if (selectedRect) {
            this.paintHFOBox(ctx, selectedRect, this.hfoVisualStatus(selectedEvent), { selected: true });
        }

        const drag = hfo.drag;
        if (drag?.mode === 'mark') {
            const x1 = Math.min(drag.x0, drag.x);
            const x2 = Math.max(drag.x0, drag.x);
            const rows = this.hfoDragRows(drag);
            const y1 = geometry.top + rows[0] * geometry.rowHeight + 3;
            const y2 = geometry.top + (rows[rows.length - 1] + 1) * geometry.rowHeight - 3;
            ctx.fillStyle = 'rgba(49, 90, 239, 0.12)';
            ctx.strokeStyle = '#315AEF';
            ctx.lineWidth = 1.5;
            ctx.setLineDash([]);
            this.roundRect(ctx, x1, y1, x2 - x1, y2 - y1, 5);
            ctx.fill();
            ctx.stroke();
            const duration = Math.abs(drag.time - drag.time0) * 1000;
            ctx.fillStyle = '#2546C7';
            ctx.font = '600 10px Inter, sans-serif';
            ctx.textAlign = 'left';
            ctx.fillText(`${duration.toFixed(0)} ms${rows.length > 1 ? ` · ${rows.length} channels` : ''}`, x1 + 2, Math.max(geometry.top + 10, y1 - 4));
        }
        ctx.restore();

        if (selectedRect && selectedEvent) {
            const tag = this.hfoTagText(selectedEvent);
            ctx.font = '600 10px Inter, sans-serif';
            const textWidth = ctx.measureText(tag).width;
            const tagX = Math.min(geometry.right - textWidth - 8, Math.max(geometry.left, selectedRect.x1));
            const above = selectedRect.y1 - 16 >= geometry.top - 2;
            const tagY = above ? selectedRect.y1 - 15 : selectedRect.y2 + 2;
            ctx.fillStyle = '#14233A';
            this.roundRect(ctx, tagX, tagY, textWidth + 8, 14, 3);
            ctx.fill();
            ctx.fillStyle = '#FFFFFF';
            ctx.textAlign = 'left';
            ctx.fillText(tag, tagX + 4, tagY + 10);
        }
    },

    hfoTagText(event) {
        const frequency = event.features?.peakFrequency;
        const duration = (event.offset - event.onset) * 1000;
        const prefix = event.source === 'reviewer' ? this.hfoReviewerLabels[event.label] : this.hfoStatusLabels[event.status];
        return `${prefix} · ${duration.toFixed(0)} ms${frequency ? ` · ${frequency.toFixed(0)} Hz` : ''}`;
    },

    paintHFOBox(ctx, rect, status, options = {}) {
        const style = this.hfoStatusStyles[status] || this.hfoStatusStyles.pending;
        const width = rect.x2 - rect.x1;
        const height = rect.y2 - rect.y1;
        if (options.selected) {
            ctx.strokeStyle = 'rgba(20, 35, 58, 0.22)';
            ctx.lineWidth = 5;
            ctx.setLineDash([]);
            this.roundRect(ctx, rect.x1 - 1, rect.y1 - 1, width + 2, height + 2, 6);
            ctx.stroke();
        }
        if (style.fill) {
            ctx.fillStyle = style.fill;
            this.roundRect(ctx, rect.x1, rect.y1, width, height, 5);
            ctx.fill();
        }
        ctx.strokeStyle = style.stroke;
        ctx.lineWidth = style.width + (options.selected ? 0.75 : options.hover ? 0.5 : 0);
        ctx.setLineDash(style.dash);
        this.roundRect(ctx, rect.x1, rect.y1, width, height, 5);
        ctx.stroke();
        ctx.setLineDash([]);
        if (status === 'rejected') {
            ctx.strokeStyle = 'rgba(138, 153, 170, 0.75)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(rect.x1 + 3, rect.y2 - 3);
            ctx.lineTo(rect.x2 - 3, rect.y1 + 3);
            ctx.stroke();
        }
    },

    roundRect(ctx, x, y, width, height, radius) {
        const r = Math.max(0, Math.min(radius, width / 2, height / 2));
        ctx.beginPath();
        ctx.moveTo(x + r, y);
        ctx.arcTo(x + width, y, x + width, y + height, r);
        ctx.arcTo(x + width, y + height, x, y + height, r);
        ctx.arcTo(x, y + height, x, y, r);
        ctx.arcTo(x, y, x + width, y, r);
        ctx.closePath();
    },

    drawHFORaster() {
        const hfo = this.state.hfo;
        const data = this.state.eegData;
        const canvas = document.getElementById('hfo-raster-canvas');
        const width = Math.max(1, canvas.parentElement.clientWidth - 24);
        const height = 46;
        const dpr = window.devicePixelRatio || 1;
        canvas.width = Math.round(width * dpr);
        canvas.height = Math.round(height * dpr);
        canvas.style.width = `${width}px`;
        canvas.style.height = `${height}px`;
        const ctx = canvas.getContext('2d');
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.fillStyle = '#F8FAFC';
        ctx.fillRect(0, 0, width, height);

        // one lane per decision so overlapping ticks stay legible
        const lanes = [['pending', 'To review'], ['accepted', 'Accepted'], ['rejected', 'Rejected'], ['reviewer', 'Hand-marked']];
        const laneHeight = (height - 6) / lanes.length;
        lanes.forEach(([status], laneIndex) => {
            const style = this.hfoStatusStyles[status];
            ctx.fillStyle = style.stroke;
            ctx.globalAlpha = status === 'rejected' ? 0.55 : 0.9;
            for (const event of hfo.events) {
                const visual = event.source === 'reviewer' ? 'reviewer' : event.status;
                if (visual !== status) continue;
                const x = event.onset / data.duration * width;
                ctx.fillRect(Math.floor(x), 3 + laneIndex * laneHeight + 1, Math.max(1.5, (event.offset - event.onset) / data.duration * width), laneHeight - 2);
            }
        });
        ctx.globalAlpha = 1;

        const viewportX = hfo.viewStart / data.duration * width;
        const viewportWidth = Math.max(3, hfo.window / data.duration * width);
        ctx.fillStyle = 'rgba(49, 90, 239, 0.12)';
        ctx.fillRect(viewportX, 0, viewportWidth, height);
        ctx.strokeStyle = '#315AEF';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(viewportX + 0.75, 0.75, Math.max(1, viewportWidth - 1.5), height - 1.5);

        const selected = this.getHFOEvent(hfo.selectedId);
        if (selected) {
            const x = (selected.onset + selected.offset) / 2 / data.duration * width;
            ctx.fillStyle = '#14233A';
            ctx.beginPath();
            ctx.moveTo(x - 4, 0);
            ctx.lineTo(x + 4, 0);
            ctx.lineTo(x, 5);
            ctx.closePath();
            ctx.fill();
        }

        const counts = this.hfoCounts();
        document.getElementById('hfo-raster-summary').textContent = counts.all
            ? `${counts.pending} to review · ${counts.accepted} accepted · ${counts.rejected} rejected · ${counts.reviewer} hand-marked`
            : 'No events yet';
    },

    renderHFOCriteria(criteria, byDetector) {
        const list = document.getElementById('hfo-criteria');
        const item = (entry) => {
            const li = document.createElement('li');
            li.className = entry.pass ? 'is-pass' : 'is-fail';
            const mark = document.createElement('span');
            mark.className = 'hfo-criterion-mark';
            mark.textContent = entry.pass ? '✓' : '✕';
            mark.setAttribute('aria-label', entry.pass ? 'met' : 'not met');
            const label = document.createElement('span');
            label.className = 'hfo-criterion-label';
            label.textContent = entry.label;
            const value = document.createElement('span');
            value.className = 'hfo-criterion-value';
            const number = entry.value === null ? '—'
                : Number.isInteger(entry.value) || Math.abs(entry.value) >= 100 ? entry.value.toFixed(0)
                    : Math.abs(entry.value) >= 10 ? entry.value.toFixed(1) : entry.value.toFixed(2);
            value.textContent = `${number}${entry.unit ? ` ${entry.unit}` : ''}`;
            const rule = document.createElement('span');
            rule.className = 'hfo-criterion-rule';
            rule.textContent = entry.rule;
            li.append(mark, label, value, rule);
            return li;
        };
        const nodes = (criteria || []).map(item);
        for (const [detector, entries] of Object.entries(byDetector || {})) {
            const heading = document.createElement('li');
            heading.className = 'hfo-criteria-group';
            heading.textContent = EEGHFO.detectors[detector]?.label || detector;
            nodes.push(heading, ...(entries || []).map(item));
        }
        list.replaceChildren(...nodes);
        document.getElementById('hfo-why').hidden = nodes.length === 0;
    },

    renderHFOScreenedInspector(item) {
        document.getElementById('hfo-inspector-empty').hidden = true;
        document.getElementById('hfo-inspector-body').hidden = false;
        document.getElementById('hfo-event-channel').textContent = item.channel;
        document.getElementById('hfo-event-time').textContent = `${item.onset.toFixed(3)}–${item.offset.toFixed(3)} s · ${((item.offset - item.onset) * 1000).toFixed(0)} ms`;
        const status = document.getElementById('hfo-event-status');
        status.dataset.status = 'screened';
        status.textContent = 'Near-miss';
        document.getElementById('hfo-decision').hidden = true;
        document.getElementById('hfo-manual-tools').hidden = true;
        document.getElementById('hfo-screened-tools').hidden = false;
        document.getElementById('hfo-screened-reason').textContent = `Set aside: ${item.reason}.`;
        document.getElementById('hfo-why-heading').textContent = 'Why it was set aside';
        this.renderHFOCriteria(item.criteria, null);
        document.getElementById('hfo-features').replaceChildren();
        const band = this.state.hfo.run?.band || this.readHFOBand();
        this.drawHFODetail({ ...item, band });
    },

    renderHFOInspector() {
        const hfo = this.state.hfo;
        const event = this.getHFOEvent(hfo.selectedId);
        const empty = document.getElementById('hfo-inspector-empty');
        const body = document.getElementById('hfo-inspector-body');
        if (!event && hfo.selectedScreened) {
            this.renderHFOScreenedInspector(hfo.selectedScreened);
            return;
        }
        document.getElementById('hfo-screened-tools').hidden = true;
        document.getElementById('hfo-why-heading').textContent = event?.source === 'reviewer' ? 'Measured on your mark' : 'Why it was flagged';
        empty.hidden = Boolean(event);
        body.hidden = !event;
        if (!event) return;

        const visual = event.source === 'reviewer' ? 'reviewer' : event.status;
        document.getElementById('hfo-event-channel').textContent = event.channel;
        const duration = (event.offset - event.onset) * 1000;
        document.getElementById('hfo-event-time').textContent = `${event.onset.toFixed(3)}–${event.offset.toFixed(3)} s · ${duration.toFixed(0)} ms`;
        const status = document.getElementById('hfo-event-status');
        status.dataset.status = visual;
        status.textContent = event.source === 'reviewer' ? `Hand-marked · ${this.hfoReviewerLabels[event.label]}` : this.hfoStatusLabels[event.status];

        const isDetector = event.source === 'detector';
        const accept = document.getElementById('hfo-accept');
        const reject = document.getElementById('hfo-reject');
        accept.disabled = !isDetector;
        reject.disabled = !isDetector;
        accept.setAttribute('aria-pressed', String(isDetector && event.status === 'accepted'));
        reject.setAttribute('aria-pressed', String(isDetector && event.status === 'rejected'));
        document.getElementById('hfo-decision').hidden = !isDetector;
        document.getElementById('hfo-manual-tools').hidden = isDetector;
        document.getElementById('hfo-event-label').value = event.label;

        const features = event.features || {};
        const run = hfo.run;
        const rows = [
            ...(features.classification?.primary ? [['Class (advisory)', this.hfoClassText(event, true), true]] : []),
            ['Peak frequency', features.peakFrequency ? `${features.peakFrequency.toFixed(0)} Hz` : '—'],
            ['Cycles', features.cycles ? features.cycles.toFixed(1) : '—'],
            ['Band-passed peak', features.peakAmplitude !== undefined ? `${features.peakAmplitude.toFixed(2)} µV` : '—'],
            ['Above background', features.backgroundRatio ? `${features.backgroundRatio.toFixed(1)} SD` : '—'],
            ['Raw peak-to-peak', features.rawPeakToPeak !== undefined ? `${features.rawPeakToPeak.toFixed(1)} µV` : '—'],
            ['Band', `${event.band.low}–${event.band.high} Hz`]
        ];
        // the band-limited banner already covers every event; only event-specific checks are listed
        const checks = (features.flags || []).filter(flag => flag !== 'band-limited');
        if (checks.length) rows.push(['Check before accepting', checks.map(flag => flag[0].toUpperCase() + flag.slice(1)).join(' · '), true]);
        const source = isDetector && run && event.runId === run.id
            ? this.describeHFORunSettings(run)
            : event.promotedFrom ? `Marked by hand from a near-miss (${event.promotedFrom.reason})` : event.source === 'reviewer' ? 'Marked by hand in this session' : 'Detector run';
        rows.push(['Source', source, true]);
        this.renderHFOCriteria(features.criteria, features.criteriaByDetector);
        const list = document.getElementById('hfo-features');
        list.replaceChildren(...rows.map(([term, value, wide]) => {
            const wrapper = document.createElement('div');
            if (wide) wrapper.className = 'hfo-feature-wide';
            const dt = document.createElement('dt');
            dt.textContent = term;
            const dd = document.createElement('dd');
            dd.textContent = value;
            wrapper.append(dt, dd);
            return wrapper;
        }));
        this.drawHFODetail(event);
    },

    describeHFORunSettings(run) {
        if (run.detector === 'consensus' && run.consensus) {
            const names = run.consensus.members.map(member => EEGHFO.detectors[member.detector]?.short || member.detector);
            return `Consensus of ${names.join(', ')}; at least ${run.consensus.minAgreement} must agree`;
        }
        const defaults = EEGHFO.defaultParams(run.detector, run.electrodes);
        const detector = EEGHFO.detectorDefinition(run.detector);
        const changed = detector.params
            .filter(param => Number(run.params[param.key]) !== Number(defaults[param.key]))
            .map(param => `${param.label.toLowerCase()} ${run.params[param.key]}${param.unit ? ` ${param.unit}` : ''}`);
        const electrodes = run.electrodes === 'intracranial' ? 'intracranial' : 'scalp';
        return `${run.detectorLabel}, ${changed.length ? `${electrodes} defaults except ${changed.join(', ')}` : `${electrodes} defaults`}`;
    },

    buildHFOMethodsText() {
        const hfo = this.state.hfo;
        const data = this.state.eegData;
        const run = hfo.run;
        if (!data || !run) return '';
        const labels = data.channelLabels;
        const counts = this.hfoCounts();
        const minutes = data.duration / 60;
        const detector = EEGHFO.detectorDefinition(run.detector);
        const memberText = run.consensus
            ? ` combining ${run.consensus.members.map(member => `${EEGHFO.detectors[member.detector].label} (${Object.entries(member.params).map(([key, value]) => `${key} ${value}`).join(', ')})`).join('; ')}, keeping events found by at least ${run.consensus.minAgreement} of ${run.consensus.members.length} detectors (overlap tolerance ${run.consensus.toleranceMs} ms)`
            : ` with ${Object.entries(run.params).map(([key, value]) => `${key} ${value}`).join(', ')}`;
        const lineText = run.lineFrequency
            ? `${run.lineFrequency} Hz line noise was ${run.notches?.length ? `notched at ${run.notches.join(', ')} Hz (harmonics and aliases inside the band)` : 'present but no harmonic fell inside the band'}`
            : 'no line-noise notch was applied';
        const duplicates = (run.skippedDuplicates || []).map(item => `${labels[item.index]} (${item.inverted ? 'inverted ' : ''}duplicate of ${labels[item.of]})`);
        const bandName = run.band.key === 'fast_ripple' ? 'fast ripple' : run.band.key === 'ripple' ? 'ripple' : 'HFO';
        const reviewed = counts.accepted + counts.rejected;
        const reviewText = reviewed || counts.reviewer
            ? `One reviewer inspected candidates in NeuroScope using band-passed and raw traces and a time–frequency map, accepting ${counts.accepted} and rejecting ${counts.rejected}${counts.pending ? `, with ${counts.pending} not yet reviewed` : ''}, and marked ${counts.reviewer} further ${counts.reviewer === 1 ? 'event' : 'events'} by hand.`
            : 'The candidates have not yet been reviewed.';
        const sentences = [
            `HFO candidates were detected in NeuroScope on ${run.channels.length} channels of ${data.filename} (${data.sampleRate} Hz sampling; channels analysed as recorded, ${run.electrodes} electrodes; ${minutes.toFixed(1)} min per channel; ${this.hfoStateLabels[run.recordingState || 'unknown']}).`,
            `Signals were band-passed at ${run.band.low}–${run.band.high} Hz with a 4th-order zero-phase Butterworth filter${run.bandLimited ? `; because of the sampling rate the ${bandName} band was truncated, so events are reported as band-limited fast activity rather than ${bandName}s` : ''}; ${lineText}.`,
            `Detection used ${detector.label}${memberText}.`,
            duplicates.length ? `Duplicate channels were analysed once (${duplicates.join(', ')}).` : '',
            `The detector proposed ${counts.all - counts.reviewer} candidates.`,
            reviewText,
            reviewed ? `Of reviewed candidates, ${Math.round(counts.accepted / reviewed * 100)}% were accepted.` : '',
            run.band.key === 'ripple' ? 'Fast ripples were not analysed in this run.' : run.band.key === 'fast_ripple' ? 'Ripples were not analysed in this run.' : '',
            'Rates are events per minute per channel over the analysed time, with 95% Poisson intervals.'
        ];
        return sentences.filter(Boolean).join(' ');
    },

    renderHFOMethods() {
        const toggle = document.getElementById('hfo-methods-toggle');
        const hasRun = Boolean(this.state.hfo?.run);
        toggle.disabled = !hasRun;
        if (!hasRun) document.getElementById('hfo-methods').hidden = true;
        document.getElementById('hfo-methods-text').textContent = this.buildHFOMethodsText();
    },

    drawHFODetail(event) {
        const data = this.state.eegData;
        const canvas = document.getElementById('hfo-detail-canvas');
        const width = Math.max(200, canvas.parentElement.clientWidth);
        const panels = { raw: 64, filtered: 64, tf: 104 };
        const gap = 14;
        const height = panels.raw + panels.filtered + panels.tf + gap * 3 + 14;
        const dpr = window.devicePixelRatio || 1;
        canvas.width = Math.round(width * dpr);
        canvas.height = Math.round(height * dpr);
        canvas.style.width = `${width}px`;
        canvas.style.height = `${height}px`;
        const ctx = canvas.getContext('2d');
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, width, height);

        const sampleRate = data.sampleRate;
        const duration = event.offset - event.onset;
        const span = Math.min(1, Math.max(0.3, duration * 5));
        const center = (event.onset + event.offset) / 2;
        const viewStart = Math.max(0, Math.min(data.duration - span, center - span / 2));
        const pad = Math.round(0.5 * sampleRate);
        const start = Math.max(0, Math.floor(viewStart * sampleRate));
        const end = Math.min(data.numSamples, Math.ceil((viewStart + span) * sampleRate));
        const fetchStart = Math.max(0, start - pad);
        const fetchEnd = Math.min(data.numSamples, end + pad);
        const raw = data.channelData[event.channelIndex].subarray(fetchStart, fetchEnd);
        const band = event.band;
        const filtered = EEGHFO.bandpass(raw, sampleRate, band.low, band.high);
        const left = 4;
        const plotWidth = width - left - 4;
        const toX = sample => left + (sample - start) / Math.max(1, end - start - 1) * plotWidth;
        const eventX1 = toX(event.onset * sampleRate);
        const eventX2 = toX(event.offset * sampleRate);

        const drawTrace = (values, top, panelHeight, label, color) => {
            let mean = 0;
            for (let s = start; s < end; s++) mean += values[s - fetchStart];
            mean /= Math.max(1, end - start);
            let peak = 0;
            for (let s = start; s < end; s++) peak = Math.max(peak, Math.abs(values[s - fetchStart] - mean));
            peak = peak || 1;
            ctx.fillStyle = 'rgba(49, 90, 239, 0.08)';
            ctx.fillRect(eventX1, top, Math.max(2, eventX2 - eventX1), panelHeight);
            ctx.strokeStyle = color;
            ctx.lineWidth = 1;
            ctx.beginPath();
            for (let s = start; s < end; s++) {
                const x = toX(s);
                const y = top + panelHeight / 2 - (values[s - fetchStart] - mean) / peak * panelHeight * 0.46;
                if (s === start) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
            }
            ctx.stroke();
            ctx.fillStyle = '#506176';
            ctx.font = '600 9.5px Inter, sans-serif';
            ctx.textAlign = 'left';
            ctx.fillText(label, left, top - 3);
            ctx.textAlign = 'right';
            ctx.fillText(`±${peak.toFixed(peak >= 10 ? 0 : 1)} µV`, width - 4, top - 3);
        };

        let y = 12;
        drawTrace(raw, y, panels.raw, 'Raw', '#1E3350');
        y += panels.raw + gap;
        drawTrace(filtered, y, panels.filtered, `Band-passed ${band.low}–${band.high} Hz`, '#2546C7');
        y += panels.filtered + gap;

        const nyquist = sampleRate / 2;
        const fMin = Math.max(4, Math.min(20, band.low / 4));
        const fMax = Math.min(nyquist * 0.92, Math.max(band.high * 1.3, band.low * 2));
        const map = EEGHFO.morletMap(raw, start - fetchStart, end - fetchStart, sampleRate, { fMin, fMax, frequencies: 36, columns: Math.round(plotWidth) });
        const image = ctx.createImageData(Math.max(1, map.columns), map.freqs.length);
        for (let k = 0; k < map.freqs.length; k++) {
            const rowIndex = map.freqs.length - 1 - k;
            for (let column = 0; column < map.columns; column++) {
                const value = Math.max(0, Math.min(1, (map.power[k][column] + 0.5) / 4.5));
                const [r, g, b] = this.hfoColormap(value);
                const index = (rowIndex * map.columns + column) * 4;
                image.data[index] = r;
                image.data[index + 1] = g;
                image.data[index + 2] = b;
                image.data[index + 3] = 255;
            }
        }
        const offscreen = document.createElement('canvas');
        offscreen.width = image.width;
        offscreen.height = image.height;
        offscreen.getContext('2d').putImageData(image, 0, 0);
        ctx.imageSmoothingEnabled = true;
        ctx.drawImage(offscreen, left, y, plotWidth, panels.tf);
        const freqToY = f => y + panels.tf - Math.log(f / fMin) / Math.log(fMax / fMin) * panels.tf;
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
        ctx.setLineDash([3, 3]);
        ctx.lineWidth = 1;
        [band.low, Math.min(band.high, fMax)].forEach(f => {
            const lineY = freqToY(f);
            ctx.beginPath();
            ctx.moveTo(left, lineY);
            ctx.lineTo(left + plotWidth, lineY);
            ctx.stroke();
        });
        ctx.setLineDash([]);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
        ctx.strokeRect(eventX1, y + 0.5, Math.max(2, eventX2 - eventX1), panels.tf - 1);
        ctx.fillStyle = '#506176';
        ctx.font = '600 9.5px Inter, sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText('Time–frequency (Morlet, z-scored)', left, y - 3);
        ctx.textAlign = 'right';
        ctx.fillText(`${fMin.toFixed(0)}–${fMax.toFixed(0)} Hz`, width - 4, y - 3);
        ctx.fillStyle = '#FFFFFF';
        ctx.font = '600 9px Inter, sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText(`${band.low}`, left + 3, freqToY(band.low) - 3);

        y += panels.tf + 12;
        ctx.fillStyle = '#506176';
        ctx.font = '9.5px Inter, sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText(`${viewStart.toFixed(3)} s`, left, y);
        ctx.textAlign = 'right';
        ctx.fillText(`${(viewStart + span).toFixed(3)} s`, width - 4, y);
    },

    // viridis, sampled at nine stops
    hfoColormap(t) {
        const stops = [
            [68, 1, 84], [72, 40, 120], [62, 74, 137], [49, 104, 142], [38, 130, 142],
            [31, 158, 137], [53, 183, 121], [110, 206, 88], [181, 222, 43], [253, 231, 37]
        ];
        const position = Math.max(0, Math.min(1, t)) * (stops.length - 1);
        const index = Math.min(stops.length - 2, Math.floor(position));
        const fraction = position - index;
        const a = stops[index];
        const b = stops[index + 1];
        return [0, 1, 2].map(channel => Math.round(a[channel] + (b[channel] - a[channel]) * fraction));
    },

    renderHFOTable() {
        const hfo = this.state.hfo;
        if (!hfo) return;
        const counts = this.hfoCounts();
        document.querySelectorAll('[data-hfo-count]').forEach(element => {
            element.textContent = String(counts[element.dataset.hfoCount] ?? 0);
        });
        document.querySelectorAll('.hfo-filter-btn').forEach(button => {
            const active = button.dataset.hfoFilter === hfo.filter;
            button.classList.toggle('active', active);
            button.setAttribute('aria-pressed', String(active));
        });
        document.getElementById('hfo-undo').disabled = hfo.undo.length === 0;
        this.renderHFOMethods();
        document.getElementById('hfo-export-csv').disabled = counts.all === 0;

        document.querySelectorAll('[data-hfo-view]').forEach(button => {
            const active = button.dataset.hfoView === hfo.tableView;
            button.classList.toggle('active', active);
            button.setAttribute('aria-pressed', String(active));
        });
        const showChannels = hfo.tableView === 'channels';
        const showAgreement = hfo.tableView === 'agreement';
        const showEvents = !showChannels && !showAgreement;
        document.getElementById('hfo-events-panel').hidden = !showEvents;
        document.getElementById('hfo-channels-panel').hidden = !showChannels;
        document.getElementById('hfo-agreement-panel').hidden = !showAgreement;
        document.getElementById('hfo-filter').hidden = !showEvents;
        document.getElementById('hfo-order-group').hidden = !showEvents;
        document.getElementById('hfo-class-group').hidden = !showEvents;
        document.getElementById('hfo-channel-export').hidden = !showChannels;
        document.getElementById('hfo-export-csv').hidden = !showEvents;
        if (showChannels) {
            this.renderHFOChannelTable();
            return;
        }
        if (showAgreement) {
            this.renderHFOAgreement();
            return;
        }
        const channelNote = document.getElementById('hfo-channel-filter-note');
        channelNote.hidden = hfo.channelFilter === null;
        if (hfo.channelFilter !== null) document.getElementById('hfo-channel-filter-label').textContent = this.state.eegData.channelLabels[hfo.channelFilter];

        const tbody = document.getElementById('hfo-tbody');
        document.getElementById('hfo-order').value = hfo.order;
        document.getElementById('hfo-class-filter').value = hfo.classFilter;
        const visible = this.orderedHFOEvents(hfo.events.filter(event => this.hfoFilterMatches(event, hfo.filter)
            && this.hfoClassMatches(event, hfo.classFilter)
            && (hfo.channelFilter === null || event.channelIndex === hfo.channelFilter)));
        const empty = document.getElementById('hfo-table-empty');
        empty.hidden = visible.length > 0;
        if (!visible.length) {
            empty.textContent = counts.all
                ? 'No events match this filter.'
                : hfo.run ? 'The detector found no candidates with these settings. Lower the threshold in Detector settings, or mark events by hand.' : 'Events appear here after detection, along with any you mark by hand.';
        }
        const rows = visible.slice(0, hfo.listLimit).map(event => {
            const row = document.createElement('tr');
            const visual = event.source === 'reviewer' ? 'reviewer' : event.status;
            row.dataset.eventId = event.id;
            if (event.id === hfo.selectedId) row.classList.add('is-selected');
            if (visual === 'rejected') row.classList.add('is-rejected');
            const features = event.features || {};
            const cells = [
                `${event.onset.toFixed(3)}`,
                event.channel,
                `${((event.offset - event.onset) * 1000).toFixed(0)} ms`,
                features.peakFrequency ? `${features.peakFrequency.toFixed(0)} Hz` : '—',
                features.peakAmplitude !== undefined ? `${features.peakAmplitude.toFixed(2)} µV` : '—',
                features.cycles ? features.cycles.toFixed(1) : '—',
                this.hfoClassText(event),
                this.hfoSourceText(event)
            ];
            for (const value of cells) {
                const cell = document.createElement('td');
                cell.textContent = value;
                row.appendChild(cell);
            }
            const statusCell = document.createElement('td');
            const status = document.createElement('span');
            status.className = 'hfo-row-status';
            status.dataset.status = visual;
            const swatch = document.createElement('span');
            swatch.className = 'hfo-row-swatch';
            swatch.setAttribute('aria-hidden', 'true');
            const text = document.createElement('span');
            text.textContent = event.source === 'reviewer' ? this.hfoReviewerLabels[event.label] : this.hfoStatusLabels[event.status];
            status.append(swatch, text);
            statusCell.appendChild(status);
            row.appendChild(statusCell);
            return row;
        });
        if (visible.length > hfo.listLimit) {
            const row = document.createElement('tr');
            const cell = document.createElement('td');
            cell.colSpan = 9;
            cell.className = 'hfo-row-more';
            cell.textContent = `Showing ${hfo.listLimit} of ${visible.length} events.`;
            const more = document.createElement('button');
            more.type = 'button';
            more.className = 'btn-tiny';
            more.textContent = 'Show 300 more';
            more.addEventListener('click', (clickEvent) => {
                clickEvent.stopPropagation();
                hfo.listLimit += 300;
                this.renderHFOTable();
            });
            cell.appendChild(more);
            row.appendChild(cell);
            rows.push(row);
        }
        tbody.replaceChildren(...rows);
        const selectedRow = tbody.querySelector('tr.is-selected');
        if (selectedRow && this.state.activeTab === 'hfo') {
            const wrap = tbody.closest('.hfo-table-wrap');
            const rowTop = selectedRow.offsetTop;
            if (rowTop < wrap.scrollTop + 30 || rowTop > wrap.scrollTop + wrap.clientHeight - 30) {
                wrap.scrollTop = Math.max(0, rowTop - wrap.clientHeight / 2);
            }
        }
    },

    hfoClassLabels: {
        hfo: 'HFO',
        spike_hfo: 'HFO on spike',
        false_ripple: 'Possible false ripple',
        artifact: 'Possible artifact'
    },

    hfoClassKey(event) {
        const classification = event.features?.classification;
        if (!classification?.primary) return null;
        return classification.primary;
    },

    hfoClassText(event, detailed = false) {
        const classification = event.features?.classification;
        if (!classification?.primary) return event.source === 'reviewer' ? '—' : 'Not classified';
        let text = this.hfoClassLabels[classification.primary] || classification.primary;
        if (classification.cooccurrence === 'ripple_and_fast_ripple') text += ' · R+FR';
        if (!detailed) return text;
        const details = [];
        if (classification.primary === 'artifact') details.push(...classification.artifacts.map(item => `${item.kind}: ${item.reason}`));
        if (classification.primary === 'false_ripple') details.push(classification.evidence.join(', '));
        if (classification.spike?.associated) details.push(`spike ${classification.spike.lagMs >= 0 ? `${classification.spike.lagMs} ms after` : `${-classification.spike.lagMs} ms before`} onset (window ±${classification.spike.windowMs} ms)`);
        if (classification.cooccurrence === 'ripple_and_fast_ripple') details.push('a fast ripple overlaps a ripple on this channel');
        if (classification.bandClass) details.push(`peak frequency class: ${classification.bandClass.replace(/_/g, ' ')}`);
        return details.length ? `${text}. ${details.join('; ')}.` : text;
    },

    hfoClassMatches(event, filter) {
        if (filter === 'all') return true;
        if (filter === 'cooccurrence') return event.features?.classification?.cooccurrence === 'ripple_and_fast_ripple';
        return this.hfoClassKey(event) === filter;
    },

    hfoSourceText(event) {
        if (event.source === 'reviewer') return event.promotedFrom ? 'Hand-marked (near-miss)' : 'Hand-marked';
        const foundBy = event.features?.foundBy;
        if (Array.isArray(foundBy) && foundBy.length) {
            const total = this.state.hfo.run?.consensus?.members.length || foundBy.length;
            return `${foundBy.length} of ${total}: ${foundBy.map(key => EEGHFO.detectors[key]?.short || key).join(', ')}`;
        }
        const detector = this.state.hfo.run && event.runId === this.state.hfo.run.id ? EEGHFO.detectorDefinition(this.state.hfo.run.detector) : null;
        return detector ? detector.short : 'Detector';
    },

    renderHFOChannelTable() {
        const hfo = this.state.hfo;
        const rows = this.hfoChannelSummary().sort((a, b) => b.confirmedRate - a.confirmedRate || b.candidateRate - a.candidateRate);
        const tbody = document.getElementById('hfo-channel-tbody');
        const empty = document.getElementById('hfo-channel-empty');
        empty.hidden = rows.length > 0;
        const maxRate = Math.max(1e-9, ...rows.map(row => Math.max(row.confirmedHigh, row.candidateRate)));
        const decimals = value => value >= 10 ? 1 : 2;
        tbody.replaceChildren(...rows.map(row => {
            const tr = document.createElement('tr');
            tr.dataset.channelIndex = String(row.channelIndex);
            if (!row.analysed) tr.classList.add('is-rejected');
            const cells = [
                row.channel,
                `${row.candidates}`,
                `${row.accepted} / ${row.rejected} / ${row.pending}`,
                `${row.marked}${row.artifact ? ` (+${row.artifact} artifact)` : ''}`,
                row.reviewedShare === null ? '—' : `${Math.round(row.reviewedShare * 100)}%`
            ];
            for (const value of cells) {
                const td = document.createElement('td');
                td.textContent = value;
                tr.appendChild(td);
            }
            const rateCell = document.createElement('td');
            rateCell.className = 'hfo-rate-cell';
            const text = document.createElement('span');
            text.textContent = `${row.confirmedRate.toFixed(decimals(row.confirmedRate))} /min (${row.confirmedLow.toFixed(decimals(row.confirmedLow))}–${row.confirmedHigh.toFixed(decimals(row.confirmedHigh))})`;
            const bar = document.createElement('span');
            bar.className = 'hfo-rate-bar';
            bar.setAttribute('aria-hidden', 'true');
            const interval = document.createElement('span');
            interval.className = 'hfo-rate-interval';
            interval.style.left = `${row.confirmedLow / maxRate * 100}%`;
            interval.style.width = `${Math.max(0.5, (row.confirmedHigh - row.confirmedLow) / maxRate * 100)}%`;
            const point = document.createElement('span');
            point.className = 'hfo-rate-point';
            point.style.left = `${row.confirmedRate / maxRate * 100}%`;
            const candidates = document.createElement('span');
            candidates.className = 'hfo-rate-candidates';
            candidates.style.left = `${row.candidateRate / maxRate * 100}%`;
            bar.append(interval, candidates, point);
            rateCell.append(text, bar);
            tr.appendChild(rateCell);
            const candidateCell = document.createElement('td');
            candidateCell.textContent = `${row.candidateRate.toFixed(decimals(row.candidateRate))} /min`;
            tr.appendChild(candidateCell);
            const spikeCell = document.createElement('td');
            spikeCell.textContent = row.spikeRate === null ? '—' : `${row.spikeRate.toFixed(1)} /min · ${row.spikeCandidates} on spikes`;
            tr.appendChild(spikeCell);
            return tr;
        }));
        const minutes = this.state.eegData.duration / 60;
        const skipped = (hfo.run?.skippedDuplicates || []).map(item => `${this.state.eegData.channelLabels[item.index]} repeats ${this.state.eegData.channelLabels[item.of]}${item.inverted ? ' (inverted)' : ''}`);
        document.getElementById('hfo-channel-caption').textContent = `${skipped.length ? `Not listed: ${skipped.join('; ')}, so it was not analysed twice. ` : ''}Rates use the full ${minutes.toFixed(1)} min analysed on each channel. Confirmed = accepted candidates plus hand-marked HFOs, with a 95% Poisson interval. Rates depend on the detector, band, sampling rate, montage, and sleep or wake state; compare channels within one run, not across recordings.${hfo.run?.bandLimited ? ' This run is band-limited: do not compare these rates with published ripple rates.' : ''}`;
    },

    // ---------- agreement between two sets of markings ----------

    hfoMarkingSets() {
        const hfo = this.state.hfo;
        const sets = [];
        const confirmed = hfo.events.filter(event => (event.source === 'detector' && event.status === 'accepted') || (event.source === 'reviewer' && event.label === 'hfo'));
        sets.push({ key: 'review', label: `Your review: accepted + hand-marked (${confirmed.length})`, events: confirmed });
        const candidates = hfo.events.filter(event => event.source === 'detector');
        if (candidates.length || hfo.run) sets.push({ key: 'detector', label: `Detector candidates (${candidates.length})`, events: candidates });
        const consensusMembers = hfo.run?.consensus?.members || [];
        for (const member of consensusMembers) {
            const found = candidates.filter(event => event.features?.foundBy?.includes(member.detector));
            sets.push({ key: `member:${member.detector}`, label: `Consensus events found by ${EEGHFO.detectors[member.detector]?.short || member.detector} (${found.length})`, events: found });
        }
        if (hfo.imported) sets.push({ key: 'imported', label: `Imported: ${hfo.imported.name} (${hfo.imported.events.length})`, events: hfo.imported.events });
        return sets;
    },

    renderHFOAgreement() {
        const hfo = this.state.hfo;
        const data = this.state.eegData;
        const sets = this.hfoMarkingSets();
        const compare = hfo.compare;
        if (!sets.some(set => set.key === compare.reference)) compare.reference = sets[0]?.key;
        if (!sets.some(set => set.key === compare.comparison)) compare.comparison = (sets.find(set => set.key !== compare.reference) || sets[0])?.key;
        for (const [id, value] of [['hfo-compare-reference', compare.reference], ['hfo-compare-comparison', compare.comparison]]) {
            const select = document.getElementById(id);
            select.replaceChildren(...sets.map(set => {
                const option = document.createElement('option');
                option.value = set.key;
                option.textContent = set.label;
                return option;
            }));
            select.value = value;
        }
        document.getElementById('hfo-compare-rule').value = compare.rule;
        document.getElementById('hfo-import-note').textContent = hfo.imported
            ? `${hfo.imported.name}: ${hfo.imported.events.length} events on matching channels${hfo.imported.skipped ? `, ${hfo.imported.skipped} ${hfo.imported.skipped === 1 ? 'row' : 'rows'} skipped (unknown channel or time)` : ''}.`
            : 'Import a NeuroScope HFO CSV, a BIDS events TSV, or any CSV with channel, onset, and offset or duration columns to compare another reviewer or tool.';
        const reference = sets.find(set => set.key === compare.reference);
        const comparison = sets.find(set => set.key === compare.comparison);
        const metrics = document.getElementById('hfo-agreement-metrics');
        const tbody = document.getElementById('hfo-agreement-tbody');
        if (!reference || !comparison || reference.key === comparison.key) {
            metrics.replaceChildren();
            tbody.replaceChildren();
            document.getElementById('hfo-agreement-context').textContent = 'Choose two different sets to compare.';
            return;
        }
        const channels = Array.from(new Set([...(hfo.run?.channels || []), ...reference.events.map(event => event.channelIndex), ...comparison.events.map(event => event.channelIndex)]));
        const result = EEGHFO.compareMarkings(reference.events, comparison.events, { rule: compare.rule, duration: data.duration, channels });
        hfo.lastAgreement = { reference: reference.key, comparison: comparison.key, tp: result.tp, fn: result.fn, fp: result.fp, f1: result.f1 };
        const percent = value => value === null ? '—' : `${(value * 100).toFixed(0)}%`;
        const interval = range => range.low === null ? '' : ` (${(range.low * 100).toFixed(0)}–${(range.high * 100).toFixed(0)}%)`;
        const fixed = value => value === null || value === undefined ? '—' : value.toFixed(2);
        const fine = value => value === null || value === undefined ? '—' : `${(value * 100).toFixed(value < 0.01 ? 2 : 1)}%`;
        const rows = [
            ['Matched', `${result.tp}`, 'events in both sets'],
            ['Only in reference', `${result.fn}`, 'missed by the compared set'],
            ['Only in compared', `${result.fp}`, 'extra in the compared set'],
            ['F1', fixed(result.f1), 'symmetric agreement; 1 = identical'],
            ['Sensitivity', `${percent(result.sensitivity)}${interval(result.sensitivityInterval)}`, 'reference events the compared set found'],
            ['Precision', `${percent(result.precision)}${interval(result.precisionInterval)}`, 'compared events that match the reference'],
            ['Jaccard', fixed(result.jaccard), 'matched ÷ all events'],
            ['Kappa, 10 ms bins', fixed(result.binnedKappa?.kappa), `events cover ${fine(result.binnedKappa?.prevalence)} of the bins`],
            ['Kappa, event windows', fixed(result.eventKappa?.kappa), `${(result.eventKappa?.background ?? 0).toLocaleString()} empty 100 ms windows, 25 ms guard`],
            ['Channel-rate agreement', result.channelRho === null ? '—' : `ρ ${result.channelRho.toFixed(2)}`, 'Spearman correlation of per-channel counts']
        ];
        metrics.replaceChildren(...rows.map(([term, value, note]) => {
            const wrapper = document.createElement('div');
            const dt = document.createElement('dt');
            dt.textContent = term;
            const dd = document.createElement('dd');
            dd.textContent = value;
            const small = document.createElement('small');
            small.textContent = note;
            wrapper.append(dt, dd, small);
            return wrapper;
        }));
        tbody.replaceChildren(...result.perChannel.sort((a, b) => (b.reference + b.comparison) - (a.reference + a.comparison)).map(row => {
            const tr = document.createElement('tr');
            for (const value of [data.channelLabels[row.channelIndex], row.reference, row.comparison, row.matched, row.f1 === null ? '—' : row.f1.toFixed(2)]) {
                const td = document.createElement('td');
                td.textContent = String(value);
                tr.appendChild(td);
            }
            return tr;
        }));
        document.getElementById('hfo-agreement-context').textContent = 'For context, experts agree only modestly on single HFOs: mean pairwise kappa was 0.40 among six raters (Spring et al. 2017) and 0.32 in a follow-up, which estimated that 17 independent raters are needed to reach 0.8 (Spring et al. 2018). Agreement on channel rates is much higher (ICC up to 0.99; Nariai et al. 2018). Kappa depends on how "no event" time is counted, so F1 is the more comparable number.';
    },

    async importHFOMarkings(file) {
        const data = this.state.eegData;
        if (!data) return;
        try {
            const text = await file.text();
            const firstLine = text.split(/\r?\n/, 1)[0];
            const delimiter = file.name.toLowerCase().endsWith('.tsv') || firstLine.includes('\t') ? '\t' : ',';
            const rows = EEGParsers.parseDelimitedRows(text, delimiter);
            if (rows.length < 2) throw new Error('the file has no rows');
            const headers = rows[0].map(value => value.trim().toLowerCase());
            const column = (...names) => names.map(name => headers.indexOf(name)).find(index => index >= 0) ?? -1;
            const channelColumn = column('channel', 'channels', 'ch_name', 'chan', 'electrode');
            const onsetColumn = column('onset_s', 'onset', 'start_s', 'start', 'time');
            const offsetColumn = column('offset_s', 'offset', 'end_s', 'end');
            const durationColumn = column('duration_s', 'duration');
            const durationMsColumn = column('duration_ms');
            const typeColumn = column('trial_type', 'type', 'label');
            const decisionColumn = column('decision', 'status');
            if (onsetColumn < 0) throw new Error('add an onset column');
            const normalise = label => String(label || '').trim().toUpperCase().replace(/\s+/g, '').replace(/^EEG/, '');
            const lookup = new Map(data.channelLabels.map((label, index) => [normalise(label), index]));
            const events = [];
            let skipped = 0;
            for (const row of rows.slice(1)) {
                if (!row.length || row.every(cell => !String(cell).trim())) continue;
                if (decisionColumn >= 0 && ['rejected', 'pending'].includes(String(row[decisionColumn]).trim().toLowerCase())) continue;
                let channelName = channelColumn >= 0 ? row[channelColumn] : '';
                // BIDS derivatives from the Zurich data encode the channel in the trial type, e.g. ripple_AHR3-4
                if ((!channelName || channelName === 'n/a') && typeColumn >= 0) channelName = String(row[typeColumn]).replace(/^(ripple|fr|frandr|fast_ripple|hfo)_/i, '');
                const channelIndex = lookup.get(normalise(channelName));
                const onset = Number(row[onsetColumn]);
                let offset = offsetColumn >= 0 ? Number(row[offsetColumn]) : NaN;
                if (!Number.isFinite(offset) && durationColumn >= 0) offset = onset + Number(row[durationColumn]);
                if (!Number.isFinite(offset) && durationMsColumn >= 0) offset = onset + Number(row[durationMsColumn]) / 1000;
                if (channelIndex === undefined || !Number.isFinite(onset) || !Number.isFinite(offset) || offset <= onset || onset < 0 || offset > data.duration + 1e-6) {
                    skipped++;
                    continue;
                }
                events.push({ channelIndex, channel: data.channelLabels[channelIndex], onset, offset });
            }
            if (!events.length) throw new Error('no rows matched a channel in this recording');
            this.state.hfo.imported = { name: file.name, events, skipped };
            this.state.hfo.compare.comparison = 'imported';
            this.renderHFOAgreement();
            this.showToast(`Imported ${events.length} markings from ${file.name}${skipped ? ` · ${skipped} skipped` : ''}`, 'success');
        } catch (error) {
            this.showToast(`Markings could not be imported: ${error.message}`, 'error');
        }
    },

    // ---------- interaction ----------

    getHFOPoint(event) {
        const canvas = document.getElementById('hfo-interaction-canvas');
        const geometry = this.state.hfo.geometry;
        if (!geometry || !this.state.eegData) return null;
        const rect = canvas.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;
        const clampedX = Math.max(geometry.left, Math.min(geometry.right, x));
        const time = this.state.hfo.viewStart + (clampedX - geometry.left) / geometry.plotWidth * this.state.hfo.window;
        const row = Math.floor((y - geometry.top) / geometry.rowHeight);
        return {
            x: clampedX,
            rawX: x,
            y,
            time: Math.max(0, Math.min(this.state.eegData.duration, time)),
            row: Math.max(0, Math.min(geometry.channels.length - 1, row)),
            inPlot: x >= geometry.left && x <= geometry.right && y >= geometry.top && row < geometry.channels.length
        };
    },

    hitHFOEvent(point) {
        const hfo = this.state.hfo;
        const geometry = hfo.geometry;
        if (!geometry || !point.inPlot) return null;
        let best = null;
        for (const event of hfo.events) {
            const rect = this.hfoEventRect(event, geometry);
            if (!rect || point.rawX < rect.x1 - 2 || point.rawX > rect.x2 + 2 || point.y < rect.y1 || point.y > rect.y2) continue;
            const edge = event.source === 'reviewer'
                ? (Math.abs(point.rawX - rect.x1) <= 5 ? 'start' : Math.abs(point.rawX - rect.x2) <= 5 ? 'end' : null)
                : null;
            if (!best || edge || event.id === hfo.selectedId) best = { event, rect, edge };
            if (edge) break;
        }
        return best;
    },

    hitHFOScreened(point) {
        const hfo = this.state.hfo;
        if (!hfo.showScreened || !hfo.geometry || !point.inPlot) return null;
        for (const item of hfo.screened) {
            const rect = this.hfoEventRect(item, hfo.geometry);
            if (rect && point.rawX >= rect.x1 - 2 && point.rawX <= rect.x2 + 2 && point.y >= rect.y1 && point.y <= rect.y2) return item;
        }
        return null;
    },

    hfoDragRows(drag) {
        const first = Math.min(drag.row0, drag.row);
        const last = Math.max(drag.row0, drag.row);
        return Array.from({ length: last - first + 1 }, (_, index) => first + index);
    },

    bindHFOCanvas() {
        const canvas = document.getElementById('hfo-interaction-canvas');
        const tooltip = document.getElementById('hfo-hover-tooltip');
        const container = document.getElementById('hfo-canvas-container');

        canvas.addEventListener('pointerdown', (event) => {
            if (event.button !== 0 || !this.state.eegData) return;
            const point = this.getHFOPoint(event);
            if (!point?.inPlot) return;
            canvas.focus({ preventScroll: true });
            canvas.setPointerCapture?.(event.pointerId);
            const hit = this.hitHFOEvent(point);
            const hfo = this.state.hfo;
            if (hit?.edge) {
                hfo.selectedId = hit.event.id;
                hfo.drag = {
                    mode: 'resize',
                    id: hit.event.id,
                    edge: hit.edge,
                    previous: { onset: hit.event.onset, offset: hit.event.offset, features: hit.event.features }
                };
            } else {
                hfo.drag = { mode: 'press', x0: point.x, y0: point.y, x: point.x, time0: point.time, time: point.time, row0: point.row, row: point.row, hit };
            }
        });

        canvas.addEventListener('pointermove', (event) => {
            const hfo = this.state.hfo;
            if (!this.state.eegData || !hfo.geometry) return;
            const point = this.getHFOPoint(event);
            if (!point) return;
            const drag = hfo.drag;
            if (drag?.mode === 'press' && Math.abs(point.x - drag.x0) > 4) drag.mode = 'mark';
            if (drag?.mode === 'mark') {
                drag.x = point.x;
                drag.time = point.time;
                drag.row = point.row;
                tooltip.hidden = true;
                this.drawHFOOverlay();
                return;
            }
            if (drag?.mode === 'resize') {
                const target = this.getHFOEvent(drag.id);
                if (!target) return;
                const minimum = 2 / this.state.eegData.sampleRate;
                if (drag.edge === 'start') target.onset = Math.min(point.time, target.offset - minimum);
                else target.offset = Math.max(point.time, target.onset + minimum);
                this.drawHFOOverlay();
                return;
            }
            const hit = point.inPlot ? this.hitHFOEvent(point) : null;
            const near = hit ? null : this.hitHFOScreened(point);
            const hoverId = hit?.event.id || null;
            canvas.dataset.cursor = hit?.edge ? 'resize' : hit || near ? 'pointer' : '';
            if (hoverId !== hfo.hoverId || near !== hfo.hoverScreened) {
                hfo.hoverId = hoverId;
                hfo.hoverScreened = near;
                this.drawHFOOverlay();
            }
            if (hit || near) {
                const bounds = container.getBoundingClientRect();
                tooltip.textContent = hit ? `${hit.event.channel} · ${this.hfoTagText(hit.event)}` : `${near.channel} · near-miss: ${near.reason}`;
                tooltip.style.left = `${Math.min(bounds.width - 240, Math.max(8, event.clientX - bounds.left + 12))}px`;
                tooltip.style.top = `${Math.max(8, event.clientY - bounds.top - 34)}px`;
                tooltip.hidden = false;
            } else {
                tooltip.hidden = true;
            }
        });

        const finish = (event) => {
            const hfo = this.state.hfo;
            const drag = hfo.drag;
            if (!drag) return;
            hfo.drag = null;
            if (event?.type === 'pointercancel') {
                const target = drag.mode === 'resize' && this.getHFOEvent(drag.id);
                if (target) Object.assign(target, drag.previous);
                this.refreshHFOView();
                return;
            }
            if (drag.mode === 'mark') {
                const rows = this.hfoDragRows(drag);
                const channels = rows.map(row => hfo.geometry.channels[row]).filter(index => index !== undefined);
                this.addHFOMarks(drag.time0, drag.time, channels);
                return;
            }
            if (drag.mode === 'resize') {
                const target = this.getHFOEvent(drag.id);
                const moved = target && (target.onset !== drag.previous.onset || target.offset !== drag.previous.offset);
                if (moved) {
                    target.features = this.measureHFOSegment(target.channelIndex, target.onset, target.offset, target.band);
                    this.pushHFOUndo({ type: 'bounds', id: target.id, previous: drag.previous });
                    this.syncHFOAnalysisResult();
                }
                this.refreshHFOView();
                return;
            }
            if (event?.type === 'pointercancel') return;
            if (!drag.hit) {
                const near = this.hitHFOScreened({ rawX: drag.x0, y: drag.y0, inPlot: true });
                if (near) {
                    hfo.selectedId = null;
                    hfo.selectedScreened = near;
                    this.refreshHFOView();
                    return;
                }
            }
            this.selectHFOEvent(drag.hit?.event.id || null);
        };
        canvas.addEventListener('pointerup', finish);
        canvas.addEventListener('pointercancel', finish);
        canvas.addEventListener('pointerleave', () => {
            const hfo = this.state.hfo;
            tooltip.hidden = true;
            if (!hfo.drag && hfo.hoverId) {
                hfo.hoverId = null;
                this.drawHFOOverlay();
            }
        });
        canvas.addEventListener('wheel', (event) => {
            const horizontal = event.shiftKey || Math.abs(event.deltaX) > Math.abs(event.deltaY);
            if (!horizontal || !this.state.eegData) return;
            event.preventDefault();
            const delta = Math.abs(event.deltaX) > 0 ? event.deltaX : event.deltaY;
            this.setHFOViewStart(this.state.hfo.viewStart + delta / 500 * this.state.hfo.window);
        }, { passive: false });

        document.getElementById('hfo-tbody').addEventListener('click', (event) => {
            const row = event.target.closest('tr[data-event-id]');
            if (row) this.selectHFOEvent(row.dataset.eventId, { reveal: true });
        });
        document.getElementById('hfo-channel-tbody').addEventListener('click', (event) => {
            const row = event.target.closest('tr[data-channel-index]');
            if (!row) return;
            const hfo = this.state.hfo;
            hfo.channelFilter = Number(row.dataset.channelIndex);
            hfo.tableView = 'events';
            hfo.listLimit = 300;
            this.renderHFOTable();
        });
    },

    bindHFORaster() {
        const raster = document.getElementById('hfo-raster-canvas');
        const move = (event) => {
            if (!this.state.eegData) return;
            const rect = raster.getBoundingClientRect();
            const ratio = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
            this.setHFOViewStart(ratio * this.state.eegData.duration - this.state.hfo.window / 2);
        };
        raster.addEventListener('pointerdown', (event) => {
            raster.setPointerCapture?.(event.pointerId);
            move(event);
        });
        raster.addEventListener('pointermove', (event) => {
            if (event.buttons === 1) move(event);
        });
        raster.addEventListener('keydown', (event) => {
            if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
            event.preventDefault();
            this.pageHFO(event.key === 'ArrowLeft' ? -1 : 1);
        });
    },

    bindHFOKeyboard() {
        document.addEventListener('keydown', (event) => {
            if (this.state.activeTab !== 'hfo' || !this.state.eegData || event.defaultPrevented) return;
            const target = event.target;
            if (target instanceof HTMLInputElement || target instanceof HTMLSelectElement || target instanceof HTMLTextAreaElement) return;
            if (document.querySelector('dialog[open]')) return;
            const key = event.key.toLowerCase();
            const command = event.metaKey || event.ctrlKey;
            let handled = true;
            if (command && key === 'z') this.undoHFO();
            else if (command || event.altKey) handled = false;
            else if (key === 'j') this.stepHFOEvent(1);
            else if (key === 'k') this.stepHFOEvent(-1);
            else if (key === 'y' || key === 'a') this.decideHFOEvent('accepted');
            else if (key === 'n' || key === 'r') this.decideHFOEvent('rejected');
            else if (key === 'u') this.resetHFODecision();
            else if (key === 'm' && this.state.hfo.selectedScreened) this.promoteHFOScreened();
            else if (event.key === 'Delete' || event.key === 'Backspace') this.deleteHFOEvent();
            else if (event.key === 'ArrowLeft') this.pageHFO(-1);
            else if (event.key === 'ArrowRight') this.pageHFO(1);
            else if (event.key === '+' || event.key === '=') this.stepHFOGain(1);
            else if (event.key === '-' || event.key === '_') this.stepHFOGain(-1);
            else if (event.key === 'Escape' && (this.state.hfo.selectedId || this.state.hfo.selectedScreened)) this.selectHFOEvent(null);
            else handled = false;
            if (handled) event.preventDefault();
        });
    },

    // ---------- exports and sessions ----------

    exportHFOEvents() {
        const hfo = this.state.hfo;
        if (!this.state.eegData || !hfo.events.length) {
            this.showToast('Run detection or mark an event before downloading HFO events.', 'info');
            return;
        }
        const button = document.getElementById('hfo-export-csv');
        this.runExport(button, () => EEGExport.exportHFOEventsCSV(this.state.eegData, hfo.events, hfo.run), 'HFO events CSV download started');
    },

    getHFOSessionData() {
        const hfo = this.state.hfo;
        if (!hfo || (!hfo.run && !hfo.events.length)) return null;
        return {
            schemaVersion: 1,
            run: hfo.run,
            events: hfo.events,
            settings: {
                detector: hfo.detector, electrodes: hfo.electrodes,
                bandKey: hfo.bandKey, band: this.readHFOBand(), params: hfo.params,
                lineMode: hfo.line.mode, window: hfo.window, display: hfo.display,
                scale: hfo.scale, gain: hfo.gain, viewStart: hfo.viewStart,
                filter: hfo.filter, order: hfo.order,
                consensusMembers: hfo.consensusMembers,
                paramsByDetector: hfo.paramsByDetector,
                recordingState: hfo.recordingState
            }
        };
    },

    isKnownHFODetector(key) {
        return key === 'consensus' || Object.hasOwn(EEGHFO.detectors, key);
    },

    normalizeHFOCriteria(list) {
        if (!Array.isArray(list)) return [];
        return list.filter(item => item && typeof item.label === 'string').slice(0, 24).map(item => ({
            key: typeof item.key === 'string' ? item.key : '',
            label: item.label,
            value: Number.isFinite(item.value) ? item.value : null,
            unit: typeof item.unit === 'string' ? item.unit : '',
            rule: typeof item.rule === 'string' ? item.rule : '',
            pass: Boolean(item.pass)
        }));
    },

    normalizeHFOParams(detector, electrodes, saved) {
        const params = EEGHFO.defaultParams(detector, electrodes);
        for (const param of EEGHFO.detectorDefinition(detector).params) {
            const value = saved?.[param.key];
            if (Number.isFinite(value) && value >= param.min && value <= param.max) params[param.key] = value;
        }
        if (params.maxDurationMs < params.minDurationMs) params.maxDurationMs = params.minDurationMs;
        return params;
    },

    normalizeHFOBand(saved, fallback) {
        if (!saved || this.validateHFOBand(saved)) return { ...fallback };
        return {
            key: Object.hasOwn(EEGHFO.bands, saved.key) ? saved.key : 'custom',
            low: saved.low, high: saved.high
        };
    },

    restoreHFOSession(saved) {
        this.resetHFOForRecording();
        if (!saved || !Array.isArray(saved.events)) {
            this.refreshHFOView();
            return 0;
        }
        const data = this.state.eegData;
        const hfo = this.state.hfo;
        const settings = saved.settings || {};
        if (this.isKnownHFODetector(settings.detector)) {
            hfo.detector = settings.detector;
            hfo.electrodes = (settings.electrodes || saved.run?.electrodes) === 'intracranial' ? 'intracranial' : 'scalp';
            hfo.params = this.normalizeHFOParams(hfo.detector, hfo.electrodes, settings.params);
            if (Array.isArray(settings.consensusMembers)) {
                const members = settings.consensusMembers.filter(key => Object.hasOwn(EEGHFO.detectors, key));
                if (members.length) hfo.consensusMembers = Object.keys(EEGHFO.detectors).filter(key => members.includes(key));
            }
            if (settings.paramsByDetector && typeof settings.paramsByDetector === 'object') {
                for (const [key, value] of Object.entries(settings.paramsByDetector)) {
                    if (this.isKnownHFODetector(key) && key !== hfo.detector) hfo.paramsByDetector[key] = this.normalizeHFOParams(key, hfo.electrodes, value);
                }
            }
            hfo.line.mode = ['auto', 'off', '50', '60'].includes(settings.lineMode) ? settings.lineMode : 'auto';
            hfo.bandKey = Object.hasOwn(EEGHFO.bands, settings.bandKey) || settings.bandKey === 'custom' ? settings.bandKey : 'ripple';
            document.getElementById('hfo-detector').value = hfo.detector;
            this.applyHFOBandPreset({ silent: true });
            if (hfo.bandKey === 'custom' && settings.band && !this.validateHFOBand(settings.band)) {
                document.getElementById('hfo-band-low').value = settings.band.low;
                document.getElementById('hfo-band-high').value = settings.band.high;
            }
            this.renderHFOSettings();
        }
        hfo.recordingState = Object.hasOwn(this.hfoStateLabels, settings.recordingState) ? settings.recordingState : 'unknown';
        document.getElementById('hfo-state').value = hfo.recordingState;
        hfo.window = [0.5, 1, 2, 5, 10].includes(settings.window) ? settings.window : 1;
        hfo.display = settings.display === 'raw' ? 'raw' : 'filtered';
        hfo.scale = settings.scale === 'shared' ? 'shared' : 'channel';
        hfo.gain = Number.isFinite(settings.gain) ? Math.max(0.25, Math.min(8, settings.gain)) : 1;
        hfo.viewStart = Number.isFinite(settings.viewStart) ? Math.max(0, Math.min(data.duration - hfo.window, settings.viewStart)) : 0;
        hfo.filter = ['all', 'pending', 'accepted', 'rejected', 'reviewer'].includes(settings.filter) ? settings.filter : 'all';
        hfo.order = ['time', 'strength', 'channel'].includes(settings.order) ? settings.order : 'time';
        document.getElementById('hfo-window').value = hfo.window;
        document.getElementById('hfo-display').value = hfo.display;
        document.getElementById('hfo-scale').value = hfo.scale;

        const run = saved.run;
        if (run && this.isKnownHFODetector(run.detector) && run.band && !this.validateHFOBand(run.band)) {
            const electrodes = run.electrodes === 'intracranial' ? 'intracranial' : 'scalp';
            const members = Array.isArray(run.consensus?.members)
                ? run.consensus.members.filter(member => member && Object.hasOwn(EEGHFO.detectors, member.detector))
                    .map(member => ({ detector: member.detector, params: this.normalizeHFOParams(member.detector, electrodes, member.params) }))
                : [];
            hfo.run = {
                ...run,
                consensus: run.detector === 'consensus' && members.length
                    ? { members, minAgreement: Math.min(members.length, Math.max(1, Number(run.consensus.minAgreement) || 2)), toleranceMs: Number(run.consensus.toleranceMs) || 0 }
                    : null,
                id: typeof run.id === 'string' && run.id ? run.id : this.createHFOId(),
                detectorLabel: EEGHFO.detectorDefinition(run.detector).label,
                electrodes,
                band: this.normalizeHFOBand(run.band, this.readHFOBand()),
                params: this.normalizeHFOParams(run.detector, electrodes, run.params),
                channels: Array.isArray(run.channels) ? [...new Set(run.channels.filter(index => Number.isInteger(index) && index >= 0 && index < data.channelLabels.length))] : [],
                skippedDuplicates: Array.isArray(run.skippedDuplicates)
                    ? run.skippedDuplicates.filter(item => item && [item.index, item.of].every(index => Number.isInteger(index) && index >= 0 && index < data.channelLabels.length))
                        .map(item => ({ index: item.index, of: item.of, inverted: Boolean(item.inverted) }))
                    : [],
                stats: Object.fromEntries(Object.entries(run.stats || {}).filter(([index, stats]) =>
                    Number.isInteger(Number(index)) && Number(index) >= 0 && Number(index) < data.channelLabels.length
                    && stats && Number.isFinite(stats.filteredStd) && stats.filteredStd > 0)),
                notches: Array.isArray(run.notches) ? run.notches.filter(value => Number.isFinite(value) && value > 0 && value < data.sampleRate / 2) : []
            };
        }
        const fallbackBand = hfo.run?.band || this.readHFOBand();
        const ids = new Set();
        hfo.events = saved.events.filter(event => event && Number.isInteger(event.channelIndex)
            && event.channelIndex >= 0 && event.channelIndex < data.channelLabels.length
            && Number.isFinite(event.onset) && Number.isFinite(event.offset)
            && event.onset >= 0 && event.offset <= data.duration && event.offset > event.onset
            && ['detector', 'reviewer'].includes(event.source)
            && ['pending', 'accepted', 'rejected'].includes(event.status))
            .map(event => {
                const id = typeof event.id === 'string' && event.id && !ids.has(event.id) ? event.id : this.createHFOId();
                ids.add(id);
                const features = Object.fromEntries(Object.entries(event.features || {}).filter(([, value]) => Number.isFinite(value)));
                features.flags = Array.isArray(event.features?.flags) ? event.features.flags.filter(flag => typeof flag === 'string' && flag.length) : [];
                if (Array.isArray(event.features?.subBand) && event.features.subBand.length === 2 && event.features.subBand.every(Number.isFinite)) {
                    features.subBand = event.features.subBand.slice();
                }
                features.criteria = this.normalizeHFOCriteria(event.features?.criteria);
                const classification = event.features?.classification;
                if (classification && typeof classification === 'object' && Object.hasOwn(this.hfoClassLabels, classification.primary)) {
                    features.classification = {
                        primary: classification.primary,
                        spike: classification.spike && typeof classification.spike === 'object'
                            ? { associated: Boolean(classification.spike.associated), lagMs: Number.isFinite(classification.spike.lagMs) ? classification.spike.lagMs : null, windowMs: Number.isFinite(classification.spike.windowMs) ? classification.spike.windowMs : null }
                            : { associated: false },
                        artifacts: Array.isArray(classification.artifacts) ? classification.artifacts.filter(item => item && typeof item.kind === 'string').map(item => ({ kind: item.kind, reason: String(item.reason || '') })) : [],
                        evidence: Array.isArray(classification.evidence) ? classification.evidence.filter(item => typeof item === 'string') : [],
                        bandClass: typeof classification.bandClass === 'string' ? classification.bandClass : null,
                        cooccurrence: classification.cooccurrence === 'ripple_and_fast_ripple' ? classification.cooccurrence : undefined
                    };
                }
                if (Array.isArray(event.features?.foundBy)) {
                    features.foundBy = event.features.foundBy.filter(key => Object.hasOwn(EEGHFO.detectors, key));
                }
                if (event.features?.criteriaByDetector && typeof event.features.criteriaByDetector === 'object') {
                    features.criteriaByDetector = Object.fromEntries(Object.entries(event.features.criteriaByDetector)
                        .filter(([key]) => Object.hasOwn(EEGHFO.detectors, key))
                        .map(([key, list]) => [key, this.normalizeHFOCriteria(list)]));
                }
                return {
                    ...event, id,
                    channel: data.channelLabels[event.channelIndex],
                    label: Object.hasOwn(this.hfoReviewerLabels, event.label) ? event.label : 'hfo',
                    band: this.normalizeHFOBand(event.band, fallbackBand),
                    features
                };
            });
        this.sortHFOEvents();
        this.updateHFOBandNote();
        this.syncHFOAnalysisResult();
        this.refreshHFOView();
        return hfo.events.length;
    }
});
