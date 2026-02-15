/**
 * NeuroScope - Main Application Controller
 * State management, UI event handling, and workflow orchestration
 */

const App = {
    // Application state
    state: {
        eegData: null,
        filteredData: null,
        selectedChannels: [],
        activeTab: 'viewer',
        amplitudeScale: 1,
        timeWindow: 10,
        timeOffset: 0,
        analysisResults: {},
        isLoaded: false
    },

    /**
     * Initialize the application
     */
    init() {
        // Hide loading screen after a brief delay
        setTimeout(() => {
            document.getElementById('loading-screen').classList.add('hidden');
        }, 1200);

        this.bindEvents();
        this.bindSidebarControls();
        this.bindTabNavigation();
        this.bindAnalysisControls();
        this.bindExportControls();
        this.bindFilterControls();
    },

    // ========== Event Binding ==========

    bindEvents() {
        const dropZone = document.getElementById('drop-zone');
        const fileInput = document.getElementById('file-input');
        const sampleBtn = document.getElementById('sample-data-btn');
        const newFileBtn = document.getElementById('new-file-btn');
        const logoBtn = document.getElementById('logo-btn');

        // File upload - click
        dropZone.addEventListener('click', () => fileInput.click());

        // File input change
        fileInput.addEventListener('change', (e) => {
            if (e.target.files.length > 0) {
                this.loadFile(e.target.files[0]);
            }
        });

        // Drag and drop
        dropZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            dropZone.classList.add('drag-over');
        });

        dropZone.addEventListener('dragleave', () => {
            dropZone.classList.remove('drag-over');
        });

        dropZone.addEventListener('drop', (e) => {
            e.preventDefault();
            dropZone.classList.remove('drag-over');
            if (e.dataTransfer.files.length > 0) {
                this.loadFile(e.dataTransfer.files[0]);
            }
        });

        // Sample data
        sampleBtn.addEventListener('click', () => this.loadSampleData());

        // New file
        newFileBtn.addEventListener('click', () => this.resetToUpload());

        // Logo click
        logoBtn.addEventListener('click', () => {
            if (this.state.isLoaded) {
                this.switchTab('viewer');
            }
        });

        // Window resize
        window.addEventListener('resize', () => {
            if (this.state.isLoaded) {
                this.debounce('resize', () => this.refreshCurrentView(), 250);
            }
        });
    },

    bindSidebarControls() {
        // Amplitude scale
        document.getElementById('amplitude-scale').addEventListener('input', (e) => {
            this.state.amplitudeScale = parseFloat(e.target.value);
            document.getElementById('amplitude-value').textContent = this.state.amplitudeScale.toFixed(1) + 'x';
            this.refreshSignalViewer();
        });

        // Time window
        document.getElementById('time-window').addEventListener('input', (e) => {
            this.state.timeWindow = parseInt(e.target.value);
            document.getElementById('time-window-value').textContent = this.state.timeWindow + 's';
            this.updateTimeOffsetRange();
            this.refreshSignalViewer();
        });

        // Time offset
        document.getElementById('time-offset').addEventListener('input', (e) => {
            this.state.timeOffset = parseFloat(e.target.value);
            document.getElementById('time-offset-value').textContent = this.state.timeOffset.toFixed(1) + 's';
            this.refreshSignalViewer();
        });

        // Select all / deselect all channels
        document.getElementById('select-all-ch').addEventListener('click', () => {
            this.state.selectedChannels = Array.from({ length: this.state.eegData.channelLabels.length }, (_, i) => i);
            this.updateChannelCheckboxes();
            this.refreshSignalViewer();
        });

        document.getElementById('deselect-all-ch').addEventListener('click', () => {
            this.state.selectedChannels = [];
            this.updateChannelCheckboxes();
            this.refreshSignalViewer();
        });
    },

    bindTabNavigation() {
        const navBtns = document.querySelectorAll('.nav-btn');
        navBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const tab = btn.getAttribute('data-tab');
                this.switchTab(tab);
            });
        });
    },

    bindAnalysisControls() {
        // Spectrum
        document.getElementById('spectrum-compute').addEventListener('click', () => this.computeSpectrum());

        // Band power
        document.getElementById('bands-compute').addEventListener('click', () => this.computeBandPowers());
        document.getElementById('bands-display').addEventListener('change', () => {
            if (this.state.analysisResults.bandPowers) {
                this.renderBandPowerCharts();
            }
        });

        // Time-frequency
        document.getElementById('timefreq-compute').addEventListener('click', () => this.computeSpectrogram());

        // Statistics
        document.getElementById('stats-compute').addEventListener('click', () => this.computeStatistics());
        document.getElementById('stats-download-csv').addEventListener('click', () => {
            if (this.state.analysisResults.statistics) {
                EEGExport.exportStatsCSV(this.state.eegData.channelLabels, this.state.analysisResults.statistics);
                this.showToast('Statistics CSV downloaded', 'success');
            }
        });

        // Topography
        document.getElementById('topo-compute').addEventListener('click', () => this.computeTopography());

        // Viewer controls
        document.getElementById('viewer-zoom-in').addEventListener('click', () => {
            const tw = document.getElementById('time-window');
            tw.value = Math.max(1, parseInt(tw.value) - 2);
            tw.dispatchEvent(new Event('input'));
        });

        document.getElementById('viewer-zoom-out').addEventListener('click', () => {
            const tw = document.getElementById('time-window');
            tw.value = Math.min(30, parseInt(tw.value) + 2);
            tw.dispatchEvent(new Event('input'));
        });

        document.getElementById('viewer-fit').addEventListener('click', () => {
            if (this.state.eegData) {
                const tw = document.getElementById('time-window');
                tw.value = Math.min(30, Math.ceil(this.state.eegData.duration));
                tw.dispatchEvent(new Event('input'));
                const to = document.getElementById('time-offset');
                to.value = 0;
                to.dispatchEvent(new Event('input'));
            }
        });

        // Montage
        document.getElementById('montage-select').addEventListener('change', () => this.refreshSignalViewer());
    },

    bindFilterControls() {
        // Filter type buttons
        document.querySelectorAll('.filter-type-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.filter-type-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');

                const type = btn.getAttribute('data-filter');
                const showNotch = type === 'notch';
                const showLow = (type === 'bandpass' || type === 'highpass');
                const showHigh = (type === 'bandpass' || type === 'lowpass');

                document.getElementById('filter-low-group').style.display = showLow ? '' : 'none';
                document.getElementById('filter-high-group').style.display = showHigh ? '' : 'none';
                document.getElementById('filter-notch-group').style.display = showNotch ? '' : 'none';
            });
        });

        document.getElementById('filter-preview').addEventListener('click', () => this.previewFilter());
        document.getElementById('filter-apply').addEventListener('click', () => this.applyFilter());
        document.getElementById('filter-reset').addEventListener('click', () => this.resetFilter());
    },

    bindExportControls() {
        document.getElementById('export-csv').addEventListener('click', () => {
            if (this.state.eegData) {
                EEGExport.exportCSV(this.state.eegData);
                this.showToast('CSV file downloaded', 'success');
            }
        });

        document.getElementById('export-json').addEventListener('click', () => {
            if (this.state.eegData) {
                EEGExport.exportJSON(this.state.eegData, this.state.analysisResults);
                this.showToast('JSON file downloaded', 'success');
            }
        });

        document.getElementById('export-png').addEventListener('click', () => {
            EEGExport.exportPNG('viewer-canvas', 'eeg_signals.png');
            this.showToast('PNG image downloaded', 'success');
        });

        document.getElementById('export-pdf').addEventListener('click', () => {
            if (this.state.eegData) {
                EEGExport.exportPDF(this.state.eegData, this.state.analysisResults);
                this.showToast('PDF report downloaded', 'success');
            }
        });

        document.getElementById('export-filtered-csv').addEventListener('click', () => {
            if (this.state.eegData) {
                EEGExport.exportFilteredCSV(this.state.eegData, this.state.filteredData);
                this.showToast('Filtered CSV downloaded', 'success');
            }
        });

        document.getElementById('export-spectrum-csv').addEventListener('click', () => {
            if (this.state.analysisResults.spectrumData) {
                const sd = this.state.analysisResults.spectrumData;
                EEGExport.exportSpectrumCSV(sd.freqs, sd.datasets, this.state.eegData.channelLabels);
                this.showToast('Spectrum CSV downloaded', 'success');
            } else {
                this.showToast('Please compute the spectrum first', 'info');
            }
        });
    },

    // ========== File Loading ==========

    async loadFile(file) {
        const progress = document.getElementById('upload-progress');
        const progressBar = document.getElementById('upload-progress-bar');
        const progressText = document.getElementById('upload-progress-text');

        progress.classList.add('active');
        progressBar.classList.add('indeterminate');
        progressText.textContent = 'Reading your file';

        try {
            const eegData = await EEGParsers.parseFile(file);
            progressText.textContent = 'Processing signal data';

            // Small delay for visual feedback
            await new Promise(r => setTimeout(r, 400));

            this.state.eegData = eegData;
            this.state.filteredData = null;
            this.state.analysisResults = {};
            this.initializeDashboard();

            this.showToast(`Loaded ${eegData.channelLabels.length} channels from ${file.name}`, 'success');
        } catch (err) {
            this.showToast(`Unable to read this file. ${err.message}`, 'error');
            progress.classList.remove('active');
            progressBar.classList.remove('indeterminate');
        }
    },

    loadSampleData() {
        const progress = document.getElementById('upload-progress');
        const progressBar = document.getElementById('upload-progress-bar');
        const progressText = document.getElementById('upload-progress-text');

        progress.classList.add('active');
        progressBar.classList.add('indeterminate');
        progressText.textContent = 'Generating sample EEG data';

        setTimeout(() => {
            const eegData = EEGParsers.generateSampleData();
            this.state.eegData = eegData;
            this.state.filteredData = null;
            this.state.analysisResults = {};
            this.initializeDashboard();

            this.showToast('Sample EEG data loaded with 19 channels', 'success');
        }, 600);
    },

    // ========== Dashboard Initialization ==========

    initializeDashboard() {
        const data = this.state.eegData;
        this.state.isLoaded = true;

        // Select all channels by default
        this.state.selectedChannels = Array.from({ length: data.channelLabels.length }, (_, i) => i);

        // Update file display
        document.getElementById('file-name-display').textContent = data.filename;
        document.getElementById('file-badge').classList.add('visible');
        document.getElementById('new-file-btn').classList.add('visible');
        document.getElementById('main-nav').classList.add('visible');

        // Update recording info
        document.getElementById('info-channels').textContent = data.channelLabels.length;
        document.getElementById('info-srate').textContent = data.sampleRate + ' Hz';
        document.getElementById('info-duration').textContent = data.duration.toFixed(1) + 's';
        document.getElementById('info-samples').textContent = data.numSamples.toLocaleString();
        document.getElementById('info-format').textContent = data.format;

        // Build channel list
        this.buildChannelList();

        // Populate time-frequency channel dropdown
        this.populateChannelDropdown('timefreq-channel', data.channelLabels);

        // Populate filter channel dropdown
        this.populateChannelDropdown('filter-channel', data.channelLabels);

        // Set time controls
        const maxTime = Math.max(0, data.duration - 1);
        document.getElementById('time-offset').max = maxTime;
        this.state.timeWindow = Math.min(10, Math.ceil(data.duration));
        document.getElementById('time-window').value = this.state.timeWindow;
        document.getElementById('time-window-value').textContent = this.state.timeWindow + 's';
        this.state.timeOffset = 0;
        document.getElementById('time-offset').value = 0;
        document.getElementById('time-offset-value').textContent = '0.0s';

        // Hide upload, show dashboard
        document.getElementById('upload-section').classList.add('hidden');
        document.getElementById('dashboard').classList.add('visible');

        // Reset upload progress
        document.getElementById('upload-progress').classList.remove('active');
        document.getElementById('upload-progress-bar').classList.remove('indeterminate');

        // Switch to viewer and render
        this.switchTab('viewer');

        // Draw signals after a brief delay for DOM rendering
        requestAnimationFrame(() => {
            this.refreshSignalViewer();
        });
    },

    buildChannelList() {
        const container = document.getElementById('channel-list');
        container.innerHTML = '';

        this.state.eegData.channelLabels.forEach((label, idx) => {
            const item = document.createElement('label');
            item.className = 'channel-item';

            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.checked = true;
            checkbox.dataset.channelIdx = idx;
            checkbox.addEventListener('change', () => {
                if (checkbox.checked) {
                    if (!this.state.selectedChannels.includes(idx)) {
                        this.state.selectedChannels.push(idx);
                        this.state.selectedChannels.sort((a, b) => a - b);
                    }
                } else {
                    this.state.selectedChannels = this.state.selectedChannels.filter(i => i !== idx);
                }
                this.refreshSignalViewer();
            });

            const colorDot = document.createElement('span');
            colorDot.className = 'ch-color';
            colorDot.style.backgroundColor = EEGVisualization.channelColors[idx % EEGVisualization.channelColors.length];

            const nameSpan = document.createElement('span');
            nameSpan.className = 'ch-name';
            nameSpan.textContent = label;

            item.appendChild(checkbox);
            item.appendChild(colorDot);
            item.appendChild(nameSpan);
            container.appendChild(item);
        });
    },

    updateChannelCheckboxes() {
        const checkboxes = document.querySelectorAll('#channel-list input[type="checkbox"]');
        checkboxes.forEach(cb => {
            const idx = parseInt(cb.dataset.channelIdx);
            cb.checked = this.state.selectedChannels.includes(idx);
        });
    },

    populateChannelDropdown(selectId, labels) {
        const select = document.getElementById(selectId);
        select.innerHTML = '';
        labels.forEach((label, i) => {
            const opt = document.createElement('option');
            opt.value = i;
            opt.textContent = label;
            select.appendChild(opt);
        });
    },

    // ========== Tab Navigation ==========

    switchTab(tab) {
        this.state.activeTab = tab;

        // Update nav buttons
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.classList.toggle('active', btn.getAttribute('data-tab') === tab);
        });

        // Update tab content
        document.querySelectorAll('.tab-content').forEach(tc => {
            tc.classList.toggle('active', tc.id === `tab-${tab}`);
        });

        // Refresh view if needed
        if (tab === 'viewer' && this.state.isLoaded) {
            requestAnimationFrame(() => this.refreshSignalViewer());
        }
    },

    // ========== Signal Viewer ==========

    refreshSignalViewer() {
        if (!this.state.eegData) return;

        const canvas = document.getElementById('viewer-canvas');
        const data = this.state.eegData;
        const montage = document.getElementById('montage-select').value;

        let displayData = data.channelData;
        let displayLabels = data.channelLabels;

        if (this.state.filteredData) {
            displayData = this.state.filteredData;
        }

        if (montage === 'average') {
            displayData = EEGAnalysis.averageReference(displayData);
        } else if (montage === 'bipolar') {
            const bipolar = EEGAnalysis.bipolarMontage(displayData, displayLabels);
            displayData = bipolar.channelData;
            displayLabels = bipolar.channelLabels;
        }

        EEGVisualization.drawSignals(canvas, {
            channelData: displayData,
            channelLabels: displayLabels,
            sampleRate: data.sampleRate
        }, {
            selectedChannels: montage === 'bipolar' ? Array.from({ length: displayData.length }, (_, i) => i) : this.state.selectedChannels,
            amplitudeScale: this.state.amplitudeScale,
            timeWindow: this.state.timeWindow,
            timeOffset: this.state.timeOffset,
            height: 500
        });
    },

    updateTimeOffsetRange() {
        if (!this.state.eegData) return;
        const maxOffset = Math.max(0, this.state.eegData.duration - this.state.timeWindow);
        const slider = document.getElementById('time-offset');
        slider.max = maxOffset;
        if (this.state.timeOffset > maxOffset) {
            this.state.timeOffset = maxOffset;
            slider.value = maxOffset;
            document.getElementById('time-offset-value').textContent = maxOffset.toFixed(1) + 's';
        }
    },

    // ========== Spectrum Analysis ==========

    computeSpectrum() {
        if (!this.state.eegData) return;

        const data = this.state.filteredData || this.state.eegData.channelData;
        const sampleRate = this.state.eegData.sampleRate;
        const method = document.getElementById('spectrum-method').value;
        const windowType = document.getElementById('spectrum-window').value;
        const maxFreq = parseInt(document.getElementById('spectrum-max-freq').value);
        const scale = document.getElementById('spectrum-scale').value;

        const channels = this.state.selectedChannels.length > 0
            ? this.state.selectedChannels.slice(0, 8) // Limit to 8 for readability
            : [0];

        const datasets = [];
        let freqs = null;

        for (const chIdx of channels) {
            const result = method === 'welch'
                ? EEGAnalysis.welchPSD(data[chIdx], sampleRate, 256, 0.5, windowType)
                : EEGAnalysis.directPSD(data[chIdx], sampleRate, windowType);

            if (!freqs) freqs = result.freqs;

            datasets.push({
                label: this.state.eegData.channelLabels[chIdx],
                psd: result.psd
            });
        }

        // Store for export
        this.state.analysisResults.spectrumData = { freqs, datasets };

        // Render chart
        EEGVisualization.createSpectrumChart('spectrum-chart', freqs, datasets, {
            maxFreq,
            logScale: scale === 'log'
        });

        this.showToast('Spectrum analysis complete', 'success');
    },

    // ========== Band Power ==========

    computeBandPowers() {
        if (!this.state.eegData) return;

        const data = this.state.filteredData || this.state.eegData.channelData;
        const sampleRate = this.state.eegData.sampleRate;
        const channels = this.state.selectedChannels.length > 0 ? this.state.selectedChannels : [0];

        const allBandPowers = [];
        let avgBands = null;

        for (const chIdx of channels) {
            const psd = EEGAnalysis.welchPSD(data[chIdx], sampleRate);
            const bands = EEGAnalysis.computeBandPowers(psd.freqs, psd.psd);
            allBandPowers.push(bands);

            if (!avgBands) {
                avgBands = JSON.parse(JSON.stringify(bands));
            } else {
                for (const key of Object.keys(bands)) {
                    avgBands[key].power += bands[key].power;
                }
            }
        }

        // Average
        if (avgBands) {
            for (const key of Object.keys(avgBands)) {
                avgBands[key].power /= channels.length;
            }
        }

        this.state.analysisResults.bandPowers = allBandPowers;
        this.state.analysisResults.avgBandPowers = avgBands;

        // Update band cards
        const bandKeys = ['delta', 'theta', 'alpha', 'beta', 'gamma'];
        for (const key of bandKeys) {
            const el = document.getElementById(`band-${key}`);
            if (el && avgBands) {
                el.textContent = avgBands[key].power.toFixed(2) + ' uV\u00B2';
            }
        }

        this.renderBandPowerCharts();
        this.showToast('Band power analysis complete', 'success');
    },

    renderBandPowerCharts() {
        const displayType = document.getElementById('bands-display').value;
        const channels = this.state.selectedChannels.length > 0 ? this.state.selectedChannels : [0];
        const labels = channels.map(i => this.state.eegData.channelLabels[i]);

        EEGVisualization.createBandPowerChart(
            'bands-bar-chart',
            labels,
            this.state.analysisResults.bandPowers,
            displayType
        );

        if (this.state.analysisResults.avgBandPowers) {
            EEGVisualization.createBandPieChart(
                'bands-pie-chart',
                this.state.analysisResults.avgBandPowers
            );
        }
    },

    // ========== Filtering ==========

    previewFilter() {
        if (!this.state.eegData) return;

        const filterType = document.querySelector('.filter-type-btn.active').getAttribute('data-filter');
        const chIdx = parseInt(document.getElementById('filter-channel').value) || 0;
        const sampleRate = this.state.eegData.sampleRate;

        const params = this.getFilterParams(filterType);
        if (!this.validateFilterParams(params, filterType, sampleRate)) return;

        // Only filter a short clip for preview (max 10 seconds from the start)
        const previewLen = Math.min(this.state.eegData.channelData[chIdx].length, Math.floor(sampleRate * 10));
        const originalClip = this.state.eegData.channelData[chIdx].slice(0, previewLen);
        const filteredClip = EEGAnalysis.butterworth(originalClip, sampleRate, params.low, params.high, params.order, filterType);

        // Check for NaN in the result
        let hasNaN = false;
        for (let i = 0; i < filteredClip.length; i++) {
            if (!isFinite(filteredClip[i])) { hasNaN = true; break; }
        }
        if (hasNaN) {
            this.showToast('Filter produced unstable output, try a lower order or different cutoff', 'error');
            return;
        }

        EEGVisualization.drawFilterComparison(
            document.getElementById('filter-canvas'),
            originalClip,
            filteredClip,
            this.state.eegData.channelLabels[chIdx],
            sampleRate,
            { height: 320 }
        );

        // Draw frequency response
        this.drawFilterResponse(filterType, params, sampleRate);

        this.showToast('Filter preview ready', 'info');
    },

    applyFilter() {
        if (!this.state.eegData) return;

        const filterType = document.querySelector('.filter-type-btn.active').getAttribute('data-filter');
        const params = this.getFilterParams(filterType);
        const sampleRate = this.state.eegData.sampleRate;

        if (!this.validateFilterParams(params, filterType, sampleRate)) return;

        // Show processing overlay
        const overlay = document.getElementById('filter-processing');
        overlay.style.display = 'flex';

        // Defer to let the overlay paint before the heavy filtering runs
        setTimeout(() => {
            try {
                const sourceData = this.state.eegData.channelData;
                const filtered = sourceData.map(ch =>
                    EEGAnalysis.butterworth(ch, sampleRate, params.low, params.high, params.order, filterType)
                );

                // Check stability on the first channel
                let stable = true;
                for (let i = 0; i < Math.min(filtered[0].length, 1000); i++) {
                    if (!isFinite(filtered[0][i])) { stable = false; break; }
                }

                if (!stable) {
                    overlay.style.display = 'none';
                    this.showToast('Filter produced unstable output, try a lower order or different cutoff', 'error');
                    return;
                }

                this.state.filteredData = filtered;

                // Build a human-readable filter description
                let desc = '';
                if (filterType === 'bandpass') desc = `Bandpass ${params.low} - ${params.high} Hz, order ${params.order}`;
                else if (filterType === 'highpass') desc = `Highpass above ${params.low} Hz, order ${params.order}`;
                else if (filterType === 'lowpass') desc = `Lowpass below ${params.high} Hz, order ${params.order}`;
                else if (filterType === 'notch') desc = `Notch at ${params.low} Hz`;

                // Update status bar
                this.updateFilterStatus(desc);

                // Auto-render comparison for the selected channel
                const chIdx = parseInt(document.getElementById('filter-channel').value) || 0;
                const previewLen = Math.min(sourceData[chIdx].length, Math.floor(sampleRate * 10));
                const originalClip = sourceData[chIdx].slice(0, previewLen);
                const filteredClip = filtered[chIdx].slice(0, previewLen);

                EEGVisualization.drawFilterComparison(
                    document.getElementById('filter-canvas'),
                    originalClip,
                    filteredClip,
                    this.state.eegData.channelLabels[chIdx],
                    sampleRate,
                    { height: 320 }
                );

                this.drawFilterResponse(filterType, params, sampleRate);
                this.refreshSignalViewer();
                this.showToast('Filter applied to all channels', 'success');
            } catch (err) {
                this.showToast('Filter encountered an error, try different settings', 'error');
            } finally {
                overlay.style.display = 'none';
            }
        }, 50);
    },

    resetFilter() {
        this.state.filteredData = null;
        this.updateFilterStatus(null);
        this.refreshSignalViewer();

        // Clear the filter canvases
        const canvas = document.getElementById('filter-canvas');
        const ctx = canvas.getContext('2d');
        canvas.width = canvas.width; // clears
        const respCanvas = document.getElementById('filter-response-canvas');
        respCanvas.width = respCanvas.width;

        this.showToast('Signals restored to original', 'info');
    },

    updateFilterStatus(description) {
        const statusEl = document.getElementById('filter-status');
        const textEl = document.getElementById('filter-status-text');
        if (description) {
            statusEl.classList.add('active-filter');
            textEl.textContent = description;
        } else {
            statusEl.classList.remove('active-filter');
            textEl.textContent = 'Original signal, no filter applied';
        }
    },

    validateFilterParams(params, filterType, sampleRate) {
        const nyquist = sampleRate / 2;

        if (filterType === 'bandpass') {
            if (params.low >= params.high) {
                this.showToast('Low cutoff must be less than high cutoff', 'error');
                return false;
            }
            if (params.high >= nyquist) {
                this.showToast('High cutoff must be below Nyquist (' + nyquist.toFixed(0) + ' Hz)', 'error');
                return false;
            }
            if (params.low < 0.05) {
                this.showToast('Low cutoff must be at least 0.05 Hz', 'error');
                return false;
            }
        } else if (filterType === 'highpass') {
            if (params.low >= nyquist) {
                this.showToast('Cutoff must be below Nyquist (' + nyquist.toFixed(0) + ' Hz)', 'error');
                return false;
            }
        } else if (filterType === 'lowpass') {
            if (params.high >= nyquist) {
                this.showToast('Cutoff must be below Nyquist (' + nyquist.toFixed(0) + ' Hz)', 'error');
                return false;
            }
        } else if (filterType === 'notch') {
            if (params.low >= nyquist) {
                this.showToast('Notch frequency must be below Nyquist (' + nyquist.toFixed(0) + ' Hz)', 'error');
                return false;
            }
        }

        return true;
    },

    drawFilterResponse(filterType, params, sampleRate) {
        const response = EEGAnalysis.computeFrequencyResponse(sampleRate, params.low, params.high, params.order, filterType);
        EEGVisualization.drawFrequencyResponse(
            document.getElementById('filter-response-canvas'),
            response.freqs,
            response.magnitude,
            { height: 320, filterType, params }
        );
    },

    getFilterParams(filterType) {
        let low = parseFloat(document.getElementById('filter-low').value);
        let high = parseFloat(document.getElementById('filter-high').value);
        const order = parseInt(document.getElementById('filter-order').value);

        if (filterType === 'notch') {
            const notchFreq = parseFloat(document.getElementById('filter-notch-freq').value);
            low = notchFreq;
            high = notchFreq;
        }

        return { low, high, order };
    },

    // ========== Spectrogram ==========

    computeSpectrogram() {
        if (!this.state.eegData) return;

        const chIdx = parseInt(document.getElementById('timefreq-channel').value);
        const windowSize = parseInt(document.getElementById('timefreq-winsize').value);
        const maxFreq = parseInt(document.getElementById('timefreq-max-freq').value);
        const colormap = document.getElementById('timefreq-colormap').value;

        const data = this.state.filteredData || this.state.eegData.channelData;
        const sampleRate = this.state.eegData.sampleRate;

        const result = EEGAnalysis.computeSpectrogram(data[chIdx], sampleRate, windowSize, 0.75, maxFreq);

        EEGVisualization.drawSpectrogram(
            document.getElementById('spectrogram-canvas'),
            result,
            { colormap }
        );

        // Find min/max for colorbar
        let minVal = Infinity, maxVal = -Infinity;
        for (const frame of result.spectrogram) {
            for (const v of frame) {
                if (isFinite(v)) {
                    if (v < minVal) minVal = v;
                    if (v > maxVal) maxVal = v;
                }
            }
        }

        EEGVisualization.drawColorbar(
            document.getElementById('spectrogram-colorbar'),
            minVal, maxVal, colormap
        );

        this.showToast('Spectrogram generated', 'success');
    },

    // ========== Statistics ==========

    computeStatistics() {
        if (!this.state.eegData) return;

        const data = this.state.filteredData || this.state.eegData.channelData;
        const labels = this.state.eegData.channelLabels;
        const statsArray = [];

        const tbody = document.getElementById('stats-tbody');
        tbody.innerHTML = '';

        for (let i = 0; i < labels.length; i++) {
            const stats = EEGAnalysis.computeStatistics(data[i]);
            statsArray.push(stats);

            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${labels[i]}</td>
                <td>${stats.mean.toFixed(3)}</td>
                <td>${stats.std.toFixed(3)}</td>
                <td>${stats.variance.toFixed(3)}</td>
                <td>${stats.rms.toFixed(3)}</td>
                <td>${stats.min.toFixed(3)}</td>
                <td>${stats.max.toFixed(3)}</td>
                <td>${stats.peakToPeak.toFixed(3)}</td>
                <td>${stats.skewness.toFixed(3)}</td>
                <td>${stats.kurtosis.toFixed(3)}</td>
                <td>${stats.zeroCrossings}</td>
            `;
            tbody.appendChild(row);
        }

        this.state.analysisResults.statistics = statsArray;

        // RMS chart
        EEGVisualization.createStatsChart(
            'stats-rms-chart',
            labels,
            statsArray.map(s => s.rms),
            'RMS Amplitude per Channel',
            '#4A90D9'
        );

        // Variance chart
        EEGVisualization.createStatsChart(
            'stats-variance-chart',
            labels,
            statsArray.map(s => s.variance),
            'Variance per Channel',
            '#10B981'
        );

        this.showToast('Statistical analysis complete', 'success');
    },

    // ========== Topography ==========

    computeTopography() {
        if (!this.state.eegData) return;

        const metric = document.getElementById('topo-metric').value;
        const data = this.state.filteredData || this.state.eegData.channelData;
        const labels = this.state.eegData.channelLabels;
        const sampleRate = this.state.eegData.sampleRate;

        const values = [];

        for (let i = 0; i < labels.length; i++) {
            if (metric === 'rms') {
                const stats = EEGAnalysis.computeStatistics(data[i]);
                values.push(stats.rms);
            } else {
                const psd = EEGAnalysis.welchPSD(data[i], sampleRate);
                const bands = EEGAnalysis.computeBandPowers(psd.freqs, psd.psd);

                if (metric === 'power') {
                    const total = Object.values(bands).reduce((s, b) => s + b.power, 0);
                    values.push(total);
                } else if (bands[metric]) {
                    values.push(bands[metric].power);
                } else {
                    values.push(0);
                }
            }
        }

        EEGVisualization.drawTopoMap(
            document.getElementById('topo-canvas'),
            labels,
            values
        );

        let minVal = Math.min(...values);
        let maxVal = Math.max(...values);
        EEGVisualization.drawTopoColorbar(
            document.getElementById('topo-colorbar'),
            minVal,
            maxVal
        );

        this.showToast('Topographic map generated', 'success');
    },

    // ========== Navigation ==========

    resetToUpload() {
        this.state.eegData = null;
        this.state.filteredData = null;
        this.state.analysisResults = {};
        this.state.isLoaded = false;
        this.state.selectedChannels = [];

        document.getElementById('upload-section').classList.remove('hidden');
        document.getElementById('dashboard').classList.remove('visible');
        document.getElementById('main-nav').classList.remove('visible');
        document.getElementById('file-badge').classList.remove('visible');
        document.getElementById('new-file-btn').classList.remove('visible');

        // Reset file input
        document.getElementById('file-input').value = '';

        // Destroy charts
        const chartIds = ['spectrum-chart', 'bands-bar-chart', 'bands-pie-chart', 'stats-rms-chart', 'stats-variance-chart'];
        chartIds.forEach(id => EEGVisualization.destroyChart(id));
    },

    refreshCurrentView() {
        switch (this.state.activeTab) {
            case 'viewer': this.refreshSignalViewer(); break;
        }
    },

    // ========== Utilities ==========

    _debounceTimers: {},
    debounce(key, fn, delay) {
        clearTimeout(this._debounceTimers[key]);
        this._debounceTimers[key] = setTimeout(fn, delay);
    },

    showToast(message, type = 'info') {
        const container = document.getElementById('toast-container');
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;

        let icon = '';
        if (type === 'success') icon = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>';
        else if (type === 'error') icon = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>';
        else icon = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>';

        toast.innerHTML = icon + '<span>' + message + '</span>';
        container.appendChild(toast);

        setTimeout(() => {
            toast.classList.add('removing');
            setTimeout(() => toast.remove(), 300);
        }, 3500);
    }
};

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => App.init());
