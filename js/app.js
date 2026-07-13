// state mgmt, ui events, workflow
const App = {
    state: {
        eegData: null,
        filteredData: null,
        selectedChannels: [],
        badChannels: [],
        activeTab: 'viewer',
        amplitudeScale: 1,
        tracePalette: 'channel',
        viewerGrid: 'standard',
        invertPolarity: false,
        timeWindow: 10,
        timeOffset: 0,
        analysisResults: {},
        filterPreviewData: null,
        annotations: [],
        annotationFilter: 'all',
        editingAnnotationId: null,
        viewerCursorTime: null,
        viewerSelection: null,
        viewerHover: null,
        viewerDisplay: null,
        viewerDragStart: null,
        exportBusy: false,
        isLoaded: false
    },

    init() {
        this.loadHostedTelemetry();
        setTimeout(() => {
            document.getElementById('loading-screen').classList.add('hidden');
        }, 1200);

        this.bindEvents();
        this.bindSidebarControls();
        this.bindTabNavigation();
        this.bindAnalysisControls();
        this.bindExportControls();
        this.bindFilterControls();
        this.bindMobileControls();
        this.bindAnnotationControls();
        this.bindViewerInteractions();
        this.bindKeyboardHelp();
    },

    loadHostedTelemetry() {
        if (!window.location.hostname.endsWith('.vercel.app')) return;
        const script = document.createElement('script');
        script.defer = true;
        script.src = '/_vercel/insights/script.js';
        document.head.appendChild(script);
    },


    bindEvents() {
        const dropZone = document.getElementById('drop-zone');
        const fileInput = document.getElementById('file-input');
        const sampleBtn = document.getElementById('sample-data-btn');
        const newFileBtn = document.getElementById('new-file-btn');
        const logoBtn = document.getElementById('logo-btn');

        dropZone.addEventListener('click', () => fileInput.click());

        fileInput.addEventListener('change', (e) => {
            if (e.target.files.length > 0) {
                this.loadFile(e.target.files[0]);
            }
        });


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


        sampleBtn.addEventListener('click', () => this.loadSampleData());


        newFileBtn.addEventListener('click', () => this.resetToUpload());


        logoBtn.addEventListener('click', () => {
            if (this.state.isLoaded) {
                this.switchTab('viewer');
            }
        });


        window.addEventListener('resize', () => {
            if (this.state.isLoaded) {
                this.debounce('resize', () => this.refreshCurrentView(), 250);
            }
        });
    },

    bindSidebarControls() {
        document.getElementById('channel-search').addEventListener('input', (event) => {
            const query = event.target.value.trim().toLowerCase();
            document.querySelectorAll('#channel-list .channel-item').forEach(item => {
                item.hidden = query.length > 0 && !item.dataset.channelLabel.includes(query);
            });
        });
        
        document.getElementById('amplitude-scale').addEventListener('input', (e) => {
            this.state.amplitudeScale = parseFloat(e.target.value);
            document.getElementById('amplitude-value').textContent = this.state.amplitudeScale.toFixed(1) + 'x';
            this.refreshSignalViewer();
            this.refreshFilterComparison();
        });


        document.getElementById('time-window').addEventListener('input', (e) => {
            this.state.timeWindow = parseFloat(e.target.value);
            document.getElementById('time-window-value').textContent = this.state.timeWindow + 's';
            this.updateTimeOffsetRange();
            this.refreshSignalViewer();
            this.refreshFilterComparison();
        });


        document.getElementById('time-offset').addEventListener('input', (e) => {
            this.state.timeOffset = parseFloat(e.target.value);
            document.getElementById('time-offset-value').textContent = this.state.timeOffset.toFixed(1) + 's';
            this.refreshSignalViewer();
            this.refreshFilterComparison();
        });


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


        document.getElementById('jump-to-time-btn').addEventListener('click', () => {
            const targetTime = parseFloat(document.getElementById('jump-to-time').value);
            if (this.state.eegData && isFinite(targetTime)) {
                const maxOffset = Math.max(0, this.state.eegData.duration - this.state.timeWindow);
                const clamped = Math.max(0, Math.min(targetTime, maxOffset));
                this.state.timeOffset = clamped;
                document.getElementById('time-offset').value = clamped;
                document.getElementById('time-offset-value').textContent = clamped.toFixed(1) + 's';
                this.refreshSignalViewer();
            }
        });


        document.getElementById('time-precision').addEventListener('change', () => {
            this.refreshSignalViewer();
        });

        document.getElementById('trace-palette').addEventListener('change', (event) => {
            this.state.tracePalette = event.target.value;
            this.refreshSignalViewer();
        });
        document.getElementById('viewer-grid').addEventListener('change', (event) => {
            this.state.viewerGrid = event.target.value;
            this.refreshSignalViewer();
        });
        document.getElementById('invert-polarity').addEventListener('change', (event) => {
            this.state.invertPolarity = event.target.checked;
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
        
        document.getElementById('spectrum-compute').addEventListener('click', () => this.computeSpectrum());


        document.getElementById('bands-compute').addEventListener('click', () => this.computeBandPowers());
        document.getElementById('bands-display').addEventListener('change', () => {
            if (this.state.analysisResults.bandPowers) {
                this.renderBandPowerCharts();
            }
        });


        document.getElementById('timefreq-compute').addEventListener('click', () => this.computeSpectrogram());


        document.getElementById('stats-compute').addEventListener('click', () => this.computeStatistics());
        document.getElementById('quality-scan').addEventListener('click', () => this.computeSignalQuality());
        document.getElementById('quality-mark-flagged').addEventListener('click', () => {
            const flagged = this.state.analysisResults.quality?.filter(item => item.flags.length).map(item => item.index) || [];
            this.state.badChannels = Array.from(new Set([...this.state.badChannels, ...flagged])).sort((a, b) => a - b);
            this.syncBadChannelUI();
            this.updateChannelSelectionCount();
            this.refreshSignalViewer();
            this.showToast(`${flagged.length} flagged ${flagged.length === 1 ? 'channel' : 'channels'} marked as bad`, 'info');
        });
        document.getElementById('stats-download-csv').addEventListener('click', () => {
            if (this.state.analysisResults.statistics) {
                EEGExport.exportStatsCSV(this.state.eegData.channelLabels, this.state.analysisResults.statistics);
                this.showToast('Statistics CSV downloaded', 'success');
            }
        });


        document.getElementById('topo-compute').addEventListener('click', () => this.computeTopography());


        document.getElementById('viewer-zoom-in').addEventListener('click', () => {
            const tw = document.getElementById('time-window');
            tw.value = Math.max(0.5, parseFloat(tw.value) - 1);
            tw.dispatchEvent(new Event('input'));
        });

        document.getElementById('viewer-zoom-out').addEventListener('click', () => {
            const tw = document.getElementById('time-window');
            const max = parseFloat(tw.max) || 120;
            tw.value = Math.min(max, parseFloat(tw.value) + 1);
            tw.dispatchEvent(new Event('input'));
        });

        document.getElementById('viewer-fit').addEventListener('click', () => {
            if (this.state.eegData) {
                const tw = document.getElementById('time-window');
                tw.value = Math.max(0.5, this.state.eegData.duration);
                tw.dispatchEvent(new Event('input'));
                const to = document.getElementById('time-offset');
                to.value = 0;
                to.dispatchEvent(new Event('input'));
            }
        });


        document.getElementById('montage-select').addEventListener('change', () => this.refreshSignalViewer());
    },

    bindFilterControls() {
        
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

    //  mobile Controls 

    _mobileMoreOpen: false,

    bindMobileControls() {
        const sidebarToggle = document.getElementById('mobile-sidebar-toggle');
        const sidebar = document.getElementById('sidebar');
        const overlay = document.getElementById('mobile-sidebar-overlay');

        // sidebar
        if (sidebarToggle) {
            sidebarToggle.addEventListener('click', () => {
                this.toggleMobileSidebar();
            });
        }

        if (overlay) {
            overlay.addEventListener('click', () => {
                this.closeMobileSidebar();
            });
        }
        document.querySelectorAll('.mobile-nav-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const tab = btn.getAttribute('data-tab');
                if (tab === 'more') {
                    this.toggleMobileMoreMenu();
                    return;
                }
                this.closeMobileMoreMenu();
                this.switchTab(tab);
            });
        });
        document.querySelectorAll('.mobile-more-item').forEach(btn => {
            btn.addEventListener('click', () => {
                const tab = btn.getAttribute('data-tab');
                this.closeMobileMoreMenu();
                this.switchTab(tab);
            });
        });
        document.addEventListener('click', (e) => {
            if (this._mobileMoreOpen) {
                const moreMenu = document.getElementById('mobile-more-menu');
                const moreBtn = document.getElementById('mobile-nav-more-btn');
                if (!moreMenu.contains(e.target) && !moreBtn.contains(e.target)) {
                    this.closeMobileMoreMenu();
                }
            }
        });
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.closeMobileSidebar();
                this.closeMobileMoreMenu();
            }
        });
    },

    toggleMobileSidebar() {
        const sidebar = document.getElementById('sidebar');
        const overlay = document.getElementById('mobile-sidebar-overlay');
        if (sidebar.classList.contains('mobile-open')) {
            this.closeMobileSidebar();
        } else {
            sidebar.classList.add('mobile-open');
            overlay.classList.add('active');
            document.body.style.overflow = 'hidden';
        }
    },

    closeMobileSidebar() {
        const sidebar = document.getElementById('sidebar');
        const overlay = document.getElementById('mobile-sidebar-overlay');
        sidebar.classList.remove('mobile-open');
        overlay.classList.remove('active');
        document.body.style.overflow = '';
    },

    toggleMobileMoreMenu() {
        if (this._mobileMoreOpen) {
            this.closeMobileMoreMenu();
        } else {
            document.getElementById('mobile-more-menu').classList.add('visible');
            this._mobileMoreOpen = true;
        }
    },

    closeMobileMoreMenu() {
        document.getElementById('mobile-more-menu').classList.remove('visible');
        this._mobileMoreOpen = false;
    },

    updateMobileNav(tab) {
        const primaryTabs = ['viewer', 'spectrum', 'bands', 'filter'];
        const moreTabs = ['timefreq', 'stats', 'topo', 'export'];

        document.querySelectorAll('.mobile-nav-btn').forEach(btn => {
            const btnTab = btn.getAttribute('data-tab');
            if (btnTab === 'more') {
                btn.classList.toggle('active', moreTabs.includes(tab));
            } else {
                btn.classList.toggle('active', btnTab === tab);
            }
        });

        document.querySelectorAll('.mobile-more-item').forEach(btn => {
            btn.classList.toggle('active', btn.getAttribute('data-tab') === tab);
        });
    },

    bindAnnotationControls() {
        const form = document.getElementById('annotation-form');
        const importInput = document.getElementById('annotation-import-input');
        document.getElementById('annotation-import-btn').addEventListener('click', () => importInput.click());
        importInput.addEventListener('change', async () => {
            const file = importInput.files?.[0];
            if (file) await this.importAnnotations(file);
            importInput.value = '';
        });
        document.getElementById('add-annotation-btn').addEventListener('click', () => this.openAnnotationForm());
        document.getElementById('annotation-cancel').addEventListener('click', () => {
            form.hidden = true;
            form.reset();
            this.state.editingAnnotationId = null;
            document.getElementById('annotation-submit').textContent = 'Save note';
        });
        document.getElementById('annotation-filter').addEventListener('change', (event) => {
            this.state.annotationFilter = event.target.value;
            this.renderAnnotations();
        });
        form.addEventListener('submit', (event) => {
            event.preventDefault();
            if (!this.state.eegData) return;

            const onset = parseFloat(document.getElementById('annotation-onset').value);
            const duration = parseFloat(document.getElementById('annotation-duration').value);
            const note = document.getElementById('annotation-note').value.trim();
            if (!Number.isFinite(onset) || !Number.isFinite(duration) || onset < 0 || duration < 0 || onset + duration > this.state.eegData.duration || !note) {
                this.showToast('Enter a valid onset, duration, and note before saving', 'error');
                return;
            }

            const channelMode = document.getElementById('annotation-channels').value;
            const channels = channelMode === 'selected'
                ? this.state.selectedChannels.map(index => this.state.eegData.channelLabels[index])
                : [];

            const existing = this.state.annotations.find(item => item.id === this.state.editingAnnotationId);
            const annotation = {
                id: existing?.id || window.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`,
                onset,
                duration,
                type: document.getElementById('annotation-type').value,
                channels,
                note,
                createdAt: existing?.createdAt || new Date().toISOString(),
                updatedAt: existing ? new Date().toISOString() : undefined
            };
            if (existing) {
                this.state.annotations = this.state.annotations.map(item => item.id === existing.id ? annotation : item);
            } else {
                this.state.annotations.push(annotation);
            }
            this.state.annotations.sort((a, b) => a.onset - b.onset);
            const edited = Boolean(existing);
            this.state.editingAnnotationId = null;
            form.hidden = true;
            form.reset();
            document.getElementById('annotation-duration').value = '0';
            document.getElementById('annotation-submit').textContent = 'Save note';
            this.renderAnnotations();
            this.showToast(edited ? 'Recording note updated' : 'Recording note saved', 'success');
        });
    },

    openAnnotationForm(range = null) {
        if (!this.state.eegData) return;
        const form = document.getElementById('annotation-form');
        this.state.editingAnnotationId = null;
        document.getElementById('annotation-submit').textContent = 'Save note';
        const selectedRange = range || this.state.viewerSelection;
        const onset = selectedRange?.start ?? this.state.viewerCursorTime ?? this.state.timeOffset;
        const duration = selectedRange ? Math.max(0, selectedRange.end - selectedRange.start) : 0;
        document.getElementById('annotation-onset').value = onset.toFixed(3);
        document.getElementById('annotation-duration').value = duration.toFixed(3);
        form.hidden = false;
        document.getElementById('annotation-note').focus();
    },

    async importAnnotations(file) {
        if (!this.state.eegData) return;
        try {
            const text = await file.text();
            const delimiter = file.name.toLowerCase().endsWith('.tsv') || text.split(/\r?\n/, 1)[0].includes('\t') ? '\t' : ',';
            const rows = EEGParsers.parseDelimitedRows(text, delimiter);
            if (rows.length < 2) throw new Error('The file does not contain annotation rows');
            const headers = rows[0].map(value => value.trim().toLowerCase());
            const column = (...names) => names.map(name => headers.indexOf(name)).find(index => index >= 0) ?? -1;
            const onsetIndex = column('onset', 'onset_seconds', 'time', 'time_seconds');
            if (onsetIndex < 0) throw new Error('An onset column is required');
            const durationIndex = column('duration', 'duration_seconds');
            const typeIndex = column('trial_type', 'type');
            const channelsIndex = column('channel', 'channels');
            const noteIndex = column('description', 'note');
            const createdIndex = column('created_at');
            const existing = new Set(this.state.annotations.map(item => `${item.onset}|${item.duration}|${item.type}|${item.note}`));
            let imported = 0;
            let skipped = 0;

            for (const row of rows.slice(1)) {
                const onset = Number(row[onsetIndex]);
                const duration = durationIndex >= 0 ? Number(row[durationIndex] || 0) : 0;
                const typeValue = typeIndex >= 0 ? row[typeIndex] : 'observation';
                const type = ['observation', 'bad_artifact', 'clinical_event', 'signal_quality'].includes(typeValue) ? typeValue : 'observation';
                const note = noteIndex >= 0 ? row[noteIndex].trim() : typeValue.replace(/_/g, ' ');
                if (!Number.isFinite(onset) || !Number.isFinite(duration) || onset < 0 || duration < 0 || onset + duration > this.state.eegData.duration || !note) {
                    skipped++;
                    continue;
                }
                const channelsValue = channelsIndex >= 0 ? row[channelsIndex] : '';
                const channels = channelsValue && channelsValue.toLowerCase() !== 'n/a'
                    ? channelsValue.split('|').map(value => value.trim()).filter(Boolean)
                    : [];
                const signature = `${onset}|${duration}|${type}|${note}`;
                if (existing.has(signature)) {
                    skipped++;
                    continue;
                }
                existing.add(signature);
                this.state.annotations.push({
                    id: window.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`,
                    onset,
                    duration,
                    type,
                    channels,
                    note,
                    createdAt: createdIndex >= 0 && row[createdIndex] ? row[createdIndex] : new Date().toISOString(),
                    importedFrom: file.name
                });
                imported++;
            }

            this.state.annotations.sort((a, b) => a.onset - b.onset);
            this.renderAnnotations();
            this.showToast(`Imported ${imported} notes${skipped ? ` · skipped ${skipped}` : ''}`, imported ? 'success' : 'info');
        } catch (error) {
            this.showToast(`Could not import notes: ${error.message}`, 'error');
        }
    },

    editAnnotation(annotation) {
        const form = document.getElementById('annotation-form');
        this.state.editingAnnotationId = annotation.id;
        document.getElementById('annotation-onset').value = annotation.onset.toFixed(3);
        document.getElementById('annotation-duration').value = annotation.duration.toFixed(3);
        document.getElementById('annotation-type').value = annotation.type;
        document.getElementById('annotation-channels').value = annotation.channels?.length ? 'selected' : '';
        document.getElementById('annotation-note').value = annotation.note;
        document.getElementById('annotation-submit').textContent = 'Update note';
        form.hidden = false;
        form.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        document.getElementById('annotation-note').focus();
    },

    renderAnnotations() {
        const list = document.getElementById('annotation-list');
        const count = this.state.annotations.length;
        const visibleAnnotations = this.state.annotationFilter === 'all'
            ? this.state.annotations
            : this.state.annotations.filter(item => item.type === this.state.annotationFilter);
        document.getElementById('annotation-count').textContent = visibleAnnotations.length === count
            ? `${count} ${count === 1 ? 'note' : 'notes'}`
            : `${visibleAnnotations.length} of ${count}`;
        document.getElementById('previous-note').disabled = count === 0;
        document.getElementById('next-note').disabled = count === 0;
        list.replaceChildren();

        if (visibleAnnotations.length === 0) {
            const empty = document.createElement('p');
            empty.className = 'annotation-empty';
            empty.textContent = count ? 'No notes match this filter.' : 'No notes yet. Add one from the signal toolbar.';
            list.appendChild(empty);
            this.refreshSignalOverlay();
            return;
        }

        for (const annotation of visibleAnnotations) {
            const row = document.createElement('article');
            row.className = 'annotation-row';

            const jump = document.createElement('button');
            jump.type = 'button';
            jump.className = 'annotation-time';
            const end = annotation.onset + annotation.duration;
            jump.textContent = annotation.duration > 0
                ? `${annotation.onset.toFixed(2)}–${end.toFixed(2)} s`
                : `${annotation.onset.toFixed(2)} s`;
            jump.title = 'Jump signal viewer to this time';
            jump.addEventListener('click', () => {
                this.setTimeOffset(annotation.onset);
            });

            const content = document.createElement('div');
            content.className = 'annotation-content';
            const meta = document.createElement('strong');
            const channelText = annotation.channels?.length ? ` · ${annotation.channels.join(', ')}` : '';
            meta.textContent = annotation.type.replace(/_/g, ' ') + channelText;
            const note = document.createElement('p');
            note.textContent = annotation.note;
            content.append(meta, note);

            const actions = document.createElement('div');
            actions.className = 'annotation-row-actions';
            const edit = document.createElement('button');
            edit.type = 'button';
            edit.className = 'annotation-edit';
            edit.textContent = 'Edit';
            edit.addEventListener('click', () => this.editAnnotation(annotation));

            const remove = document.createElement('button');
            remove.type = 'button';
            remove.className = 'annotation-remove';
            remove.textContent = 'Remove';
            remove.addEventListener('click', () => {
                this.state.annotations = this.state.annotations.filter(item => item.id !== annotation.id);
                this.renderAnnotations();
            });

            actions.append(edit, remove);
            row.append(jump, content, actions);
            list.appendChild(row);
        }
        this.refreshSignalOverlay();
    },

    jumpToAnnotation(direction) {
        if (!this.state.annotations.length) return;
        const notes = this.state.annotations.slice().sort((a, b) => a.onset - b.onset);
        const anchor = this.state.viewerCursorTime ?? this.state.timeOffset;
        const target = direction > 0
            ? notes.find(note => note.onset > anchor + 0.001) || notes[0]
            : notes.slice().reverse().find(note => note.onset < anchor - 0.001) || notes[notes.length - 1];
        this.state.viewerCursorTime = target.onset;
        this.state.viewerSelection = target.duration > 0
            ? { start: target.onset, end: target.onset + target.duration }
            : null;
        this.setTimeOffset(Math.max(0, target.onset - this.state.timeWindow * 0.15));
        this.updateViewerSelectionBar();
        this.refreshSignalOverlay();
    },

    bindViewerInteractions() {
        const overlay = document.getElementById('viewer-interaction-canvas');
        const overview = document.getElementById('viewer-overview-canvas');
        const tooltip = document.getElementById('viewer-hover-tooltip');

        const moveFromOverview = (event) => {
            if (!this.state.eegData) return;
            const rect = overview.getBoundingClientRect();
            const ratio = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
            this.setTimeOffset(ratio * this.state.eegData.duration - this.state.timeWindow / 2);
        };
        overview.addEventListener('pointerdown', (event) => {
            overview.setPointerCapture?.(event.pointerId);
            moveFromOverview(event);
        });
        overview.addEventListener('pointermove', (event) => {
            if (event.buttons === 1) moveFromOverview(event);
        });
        overview.addEventListener('keydown', (event) => {
            if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
            event.preventDefault();
            const direction = event.key === 'ArrowLeft' ? -1 : 1;
            this.setTimeOffset(this.state.timeOffset + direction * this.state.timeWindow);
        });

        overlay.addEventListener('pointerdown', (event) => {
            if (event.button !== 0 || !this.state.eegData) return;
            const point = this.getViewerPoint(event);
            if (!point) return;
            overlay.setPointerCapture?.(event.pointerId);
            this.state.viewerDragStart = point.time;
            this.state.viewerSelection = null;
            this.state.viewerCursorTime = null;
            this.updateViewerSelectionBar();
            this.refreshSignalOverlay();
        });

        overlay.addEventListener('pointermove', (event) => {
            if (!this.state.eegData) return;
            const point = this.getViewerPoint(event);
            if (!point) {
                tooltip.hidden = true;
                return;
            }
            this.state.viewerHover = point;
            this.updateViewerTooltip(point, event);
            if (this.state.viewerDragStart !== null) {
                this.state.viewerSelection = {
                    start: Math.min(this.state.viewerDragStart, point.time),
                    end: Math.max(this.state.viewerDragStart, point.time)
                };
                this.updateViewerSelectionBar();
            }
            this.refreshSignalOverlay();
        });

        overlay.addEventListener('pointerup', (event) => {
            if (this.state.viewerDragStart === null) return;
            const point = this.getViewerPoint(event);
            if (point) {
                const distance = Math.abs(point.time - this.state.viewerDragStart);
                if (distance < Math.max(0.005, this.state.timeWindow / 500)) {
                    this.state.viewerCursorTime = point.time;
                    this.state.viewerSelection = null;
                }
            }
            this.state.viewerDragStart = null;
            this.updateViewerSelectionBar();
            this.refreshSignalOverlay();
        });

        overlay.addEventListener('pointerleave', () => {
            if (this.state.viewerDragStart === null) {
                this.state.viewerHover = null;
                tooltip.hidden = true;
                this.refreshSignalOverlay();
            }
        });

        overlay.addEventListener('wheel', (event) => {
            const horizontalIntent = event.shiftKey || Math.abs(event.deltaX) > Math.abs(event.deltaY);
            if (!horizontalIntent || !this.state.eegData) return;
            event.preventDefault();
            const delta = Math.abs(event.deltaX) > 0 ? event.deltaX : event.deltaY;
            this.setTimeOffset(this.state.timeOffset + (delta / 500) * this.state.timeWindow);
        }, { passive: false });

        overlay.addEventListener('keydown', (event) => {
            if (!this.state.eegData) return;
            if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
                event.preventDefault();
                const direction = event.key === 'ArrowLeft' ? -1 : 1;
                this.setTimeOffset(this.state.timeOffset + direction * this.state.timeWindow * 0.1);
            } else if (event.key.toLowerCase() === 'a') {
                event.preventDefault();
                this.openAnnotationForm();
            } else if (event.key.toLowerCase() === 'n') {
                event.preventDefault();
                this.jumpToAnnotation(1);
            } else if (event.key.toLowerCase() === 'p') {
                event.preventDefault();
                this.jumpToAnnotation(-1);
            } else if (event.key === '+' || event.key === '=') {
                event.preventDefault();
                document.getElementById('viewer-zoom-in').click();
            } else if (event.key === '-' || event.key === '_') {
                event.preventDefault();
                document.getElementById('viewer-zoom-out').click();
            } else if (event.key === 'Escape') {
                this.state.viewerSelection = null;
                this.state.viewerCursorTime = null;
                this.updateViewerSelectionBar();
                this.refreshSignalOverlay();
            }
        });

        document.getElementById('selection-annotate').addEventListener('click', () => this.openAnnotationForm(this.state.viewerSelection));
        document.getElementById('selection-export').addEventListener('click', () => this.exportViewerSelection());
        document.getElementById('selection-clear').addEventListener('click', () => {
            this.state.viewerSelection = null;
            this.state.viewerCursorTime = null;
            this.updateViewerSelectionBar();
            this.refreshSignalOverlay();
        });
        document.getElementById('previous-note').addEventListener('click', () => this.jumpToAnnotation(-1));
        document.getElementById('next-note').addEventListener('click', () => this.jumpToAnnotation(1));
    },

    bindKeyboardHelp() {
        const dialog = document.getElementById('keyboard-help-dialog');
        const open = () => {
            if (!dialog.open) dialog.showModal?.();
        };
        document.getElementById('keyboard-help-btn').addEventListener('click', open);
        document.getElementById('keyboard-help-close').addEventListener('click', () => dialog.close());
        dialog.addEventListener('click', (event) => {
            if (event.target === dialog) dialog.close();
        });
        document.addEventListener('keydown', (event) => {
            const target = event.target;
            const isTyping = target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement;
            if (!isTyping && event.key === '?') {
                event.preventDefault();
                open();
            }
        });
    },

    getViewerPoint(event) {
        const overlay = document.getElementById('viewer-interaction-canvas');
        const display = this.state.viewerDisplay;
        if (!display || display.channels.length === 0) return null;
        const rect = overlay.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;
        const geometry = EEGVisualization.getSignalPlotGeometry(rect.width, rect.height);
        if (x < geometry.left || x > geometry.right || y < geometry.top || y > geometry.bottom) return null;

        const ratio = (x - geometry.left) / geometry.width;
        const time = Math.min(this.state.eegData.duration, this.state.timeOffset + ratio * this.state.timeWindow);
        const channelPosition = Math.min(display.channels.length - 1, Math.max(0, Math.floor((y - geometry.top) / geometry.height * display.channels.length)));
        const channelIndex = display.channels[channelPosition];
        const sample = Math.min(display.data[channelIndex].length - 1, Math.max(0, Math.round(time * this.state.eegData.sampleRate)));
        return {
            x,
            y,
            time,
            channel: display.labels[channelIndex],
            amplitude: display.data[channelIndex][sample]
        };
    },

    updateViewerTooltip(point, event) {
        const tooltip = document.getElementById('viewer-hover-tooltip');
        const container = document.getElementById('viewer-canvas-container').getBoundingClientRect();
        tooltip.textContent = `${point.time.toFixed(3)} s · ${point.channel} · ${point.amplitude.toFixed(2)} µV`;
        tooltip.style.left = `${Math.min(container.width - 210, Math.max(8, event.clientX - container.left + 12))}px`;
        tooltip.style.top = `${Math.max(8, event.clientY - container.top - 34)}px`;
        tooltip.hidden = false;
    },

    updateViewerSelectionBar() {
        const bar = document.getElementById('viewer-selection-bar');
        const selection = this.state.viewerSelection;
        const cursor = this.state.viewerCursorTime;
        bar.hidden = !selection && cursor === null;
        if (bar.hidden) return;
        const exportButton = document.getElementById('selection-export');
        const annotateButton = document.getElementById('selection-annotate');
        if (selection) {
            const duration = selection.end - selection.start;
            document.getElementById('viewer-selection-time').textContent = `${selection.start.toFixed(3)}–${selection.end.toFixed(3)} s`;
            document.getElementById('viewer-selection-detail').textContent = `${duration.toFixed(3)} s selected · ${this.state.selectedChannels.length} channels`;
            exportButton.disabled = false;
            annotateButton.textContent = 'Annotate range';
        } else {
            document.getElementById('viewer-selection-time').textContent = `Cursor at ${cursor.toFixed(3)} s`;
            document.getElementById('viewer-selection-detail').textContent = 'Pinned point · press A or choose Add note';
            exportButton.disabled = true;
            annotateButton.textContent = 'Add note';
        }
    },

    setTimeOffset(value) {
        if (!this.state.eegData) return;
        const maxOffset = Math.max(0, this.state.eegData.duration - this.state.timeWindow);
        this.state.timeOffset = Math.max(0, Math.min(value, maxOffset));
        document.getElementById('time-offset').value = this.state.timeOffset;
        document.getElementById('time-offset-value').textContent = this.state.timeOffset.toFixed(1) + 's';
        this.refreshSignalViewer();
        this.refreshFilterComparison();
    },

    refreshSignalOverlay() {
        if (!this.state.eegData) return;
        EEGVisualization.drawSignalOverlay(document.getElementById('viewer-interaction-canvas'), {
            timeOffset: this.state.timeOffset,
            timeWindow: this.state.timeWindow,
            hover: this.state.viewerHover,
            cursorTime: this.state.viewerCursorTime,
            selection: this.state.viewerSelection,
            annotations: this.state.annotations
        });
    },

    exportViewerSelection() {
        if (!this.state.viewerSelection) return;
        const options = this.getExportOptions({
            startTime: this.state.viewerSelection.start,
            endTime: this.state.viewerSelection.end,
            channelScope: 'selected'
        });
        this.runExport(document.getElementById('selection-export'), () => EEGExport.exportCSV(this.state.eegData, options), 'Selected range CSV download started');
    },

    bindExportControls() {
        ['export-channel-scope', 'export-signal-source', 'export-start-time', 'export-end-time', 'export-precision'].forEach(id => {
            document.getElementById(id).addEventListener('input', () => this.updateExportEstimate());
        });

        document.getElementById('export-csv').addEventListener('click', event => {
            if (!this.state.eegData) return;
            const options = this.getExportOptions();
            this.runExport(event.currentTarget, () => EEGExport.exportCSV(this.state.eegData, options), 'Scoped CSV download started');
        });

        document.getElementById('export-json').addEventListener('click', event => {
            if (!this.state.eegData) return;
            const options = this.getExportOptions();
            this.runExport(event.currentTarget, () => EEGExport.exportJSON(this.state.eegData, this.state.analysisResults, options), 'Scoped JSON download started');
        });

        document.getElementById('export-png').addEventListener('click', event => {
            this.runExport(event.currentTarget, () => EEGExport.exportPNG('viewer-canvas', 'eeg_signals.png'), 'PNG download started');
        });

        document.getElementById('export-pdf').addEventListener('click', event => {
            if (!this.state.eegData) return;
            this.runExport(
                event.currentTarget,
                () => EEGExport.exportPDF(this.state.eegData, this.state.analysisResults),
                'PDF report download started',
                'PDF export is unavailable because the PDF library did not load'
            );
        });

        document.getElementById('export-filtered-csv').addEventListener('click', event => {
            if (!this.state.eegData) return;
            if (!this.state.filteredData) {
                this.showToast('Apply a filter before exporting processed signal data', 'info');
                return;
            }
            const options = this.getExportOptions({ data: this.state.filteredData, sourceLabel: 'filtered' });
            this.runExport(event.currentTarget, () => EEGExport.exportFilteredCSV(this.state.eegData, this.state.filteredData, options), 'Processed CSV download started');
        });

        document.getElementById('export-spectrum-csv').addEventListener('click', () => {
            if (this.state.analysisResults.spectrumData) {
                const sd = this.state.analysisResults.spectrumData;
                EEGExport.exportSpectrumCSV(sd.freqs, sd.datasets, this.state.eegData.channelLabels);
                this.showToast('Spectrum CSV downloaded', 'success');
            } else {
                this.showToast('Compute the spectrum first to export this data', 'info');
            }
        });


        document.getElementById('export-svg').addEventListener('click', () => {
            if (this.state.eegData) {
                EEGExport.exportSVG('viewer-canvas', 'eeg_signals.svg');
                this.showToast('SVG image downloaded', 'success');
            }
        });


        document.getElementById('export-use-viewer-range').addEventListener('click', () => {
            if (!this.state.eegData) return;
            const selection = this.state.viewerSelection;
            const start = selection?.start ?? this.state.timeOffset;
            const end = selection?.end ?? Math.min(this.state.eegData.duration, this.state.timeOffset + this.state.timeWindow);
            document.getElementById('export-start-time').value = start.toFixed(3);
            document.getElementById('export-end-time').value = end.toFixed(3);
            this.updateExportEstimate();
            this.showToast(selection ? 'Viewer selection copied to export scope' : 'Visible viewer window copied to export scope', 'success');
        });


        document.getElementById('export-band-power-csv').addEventListener('click', () => {
            if (this.state.analysisResults.bandPowers && this.state.eegData) {
                const channels = this.state.selectedChannels.length > 0 ? this.state.selectedChannels : [0];
                const labels = channels.map(i => this.state.eegData.channelLabels[i]);
                EEGExport.exportBandPowerCSV(labels, this.state.analysisResults.bandPowers);
                this.showToast('Band power CSV downloaded', 'success');
            } else {
                this.showToast('Compute band powers first to export this data', 'info');
            }
        });


        document.getElementById('export-hires-png').addEventListener('click', event => {
            const dpiMultiplier = parseInt(document.getElementById('export-dpi').value) || 3;
            const canvas = this.getCurrentVisualizationCanvas();
            if (!canvas) {
                this.showToast('Generate some visualizations first, then export them', 'info');
                return;
            }
            this.runExport(event.currentTarget, () => EEGExport.exportHighResPNG(canvas, `${canvas.id}_highres.png`, dpiMultiplier), 'High-resolution PNG download started');
        });


        document.getElementById('export-matlab-json').addEventListener('click', event => {
            if (!this.state.eegData) return;
            const options = this.getExportOptions();
            this.runExport(event.currentTarget, () => EEGExport.exportMATLABJSON(this.state.eegData, this.state.filteredData, this.state.analysisResults, options), 'MATLAB-compatible JSON download started');
        });

        document.getElementById('export-session-json').addEventListener('click', event => {
            if (!this.state.eegData) return;
            this.runExport(event.currentTarget, () => EEGExport.exportSessionManifest(this.state.eegData, this.state), 'Session manifest download started');
        });
        const sessionInput = document.getElementById('import-session-input');
        document.getElementById('import-session-json').addEventListener('click', () => sessionInput.click());
        sessionInput.addEventListener('change', async () => {
            const file = sessionInput.files?.[0];
            if (file) await this.importSessionManifest(file);
            sessionInput.value = '';
        });

        document.getElementById('export-annotations-csv').addEventListener('click', event => {
            if (!this.state.eegData) return;
            if (this.state.annotations.length === 0) {
                this.showToast('Add at least one recording note before exporting annotations', 'info');
                return;
            }
            this.runExport(event.currentTarget, () => EEGExport.exportAnnotationsCSV(this.state.eegData, this.state.annotations), 'Annotations CSV download started');
        });

        document.getElementById('export-bids-events').addEventListener('click', event => {
            if (!this.state.eegData || this.state.annotations.length === 0) {
                this.showToast('Add at least one point or range annotation before exporting BIDS events', 'info');
                return;
            }
            this.runExport(event.currentTarget, () => EEGExport.exportBIDSEventsTSV(this.state.eegData, this.state.annotations), 'BIDS events TSV download started');
        });

        document.getElementById('export-bids-channels').addEventListener('click', event => {
            if (!this.state.eegData) return;
            this.runExport(event.currentTarget, () => EEGExport.exportBIDSChannelsTSV(this.state.eegData, this.state.badChannels), 'BIDS channels TSV download started');
        });

        document.getElementById('export-quality-csv').addEventListener('click', event => {
            const quality = this.state.analysisResults.quality;
            if (!quality?.length) {
                this.showToast('Run a signal quality review before exporting its metrics', 'info');
                return;
            }
            this.runExport(event.currentTarget, () => EEGExport.exportQualityCSV(this.state.eegData, quality), 'Quality review CSV download started');
        });

        document.getElementById('export-annotations-json').addEventListener('click', event => {
            if (!this.state.eegData || !this.state.annotations.length) {
                this.showToast('Add or import at least one recording note first', 'info');
                return;
            }
            this.runExport(event.currentTarget, () => EEGExport.exportAnnotationsJSON(this.state.eegData, this.state.annotations), 'Annotations JSON download started');
        });
    },



    setImportProgress(value, label) {
        const progress = document.getElementById('upload-progress');
        const progressBar = document.getElementById('upload-progress-bar');
        progress.classList.add('active');
        progressBar.classList.remove('indeterminate');
        progressBar.style.setProperty('--progress', `${Math.max(0, Math.min(100, value))}%`);
        progressBar.setAttribute('aria-valuenow', String(Math.round(value)));
        document.getElementById('upload-progress-text').textContent = label;
    },

    async importSessionManifest(file) {
        if (!this.state.eegData) return;
        try {
            const manifest = JSON.parse(await file.text());
            if (!manifest?.recording || !manifest?.workspace || !Array.isArray(manifest.annotations)) {
                throw new Error('This is not a NeuroScope review manifest');
            }
            const recording = manifest.recording;
            const current = this.state.eegData;
            const labelsMatch = Array.isArray(recording.channelLabels)
                && recording.channelLabels.length === current.channelLabels.length
                && recording.channelLabels.every((label, index) => label === current.channelLabels[index]);
            if (!labelsMatch || Number(recording.sampleRate) !== Number(current.sampleRate)) {
                throw new Error('Channel labels or sample rate do not match the loaded recording');
            }

            const workspace = manifest.workspace;
            const selected = (workspace.selectedChannels || []).map(item => Number(item.index)).filter(index => Number.isInteger(index) && index >= 0 && index < current.channelLabels.length);
            const bad = (workspace.badChannels || []).map(item => Number(item.index)).filter(index => Number.isInteger(index) && index >= 0 && index < current.channelLabels.length);
            this.state.selectedChannels = selected.length ? Array.from(new Set(selected)).sort((a, b) => a - b) : [];
            this.state.badChannels = Array.from(new Set(bad)).sort((a, b) => a - b);
            this.state.annotations = manifest.annotations.filter(annotation => {
                const onset = Number(annotation.onset);
                const duration = Number(annotation.duration || 0);
                return Number.isFinite(onset) && Number.isFinite(duration) && onset >= 0 && duration >= 0 && onset + duration <= current.duration;
            }).map(annotation => ({
                ...annotation,
                id: annotation.id || window.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`,
                onset: Number(annotation.onset),
                duration: Number(annotation.duration || 0)
            })).sort((a, b) => a.onset - b.onset);

            const amplitude = Math.max(0.1, Math.min(10, Number(workspace.amplitudeScale) || 1));
            const windowSize = Math.max(0.5, Math.min(current.duration, Number(workspace.timeWindow) || 10));
            this.state.amplitudeScale = amplitude;
            this.state.timeWindow = windowSize;
            this.state.tracePalette = ['channel', 'blue', 'ink'].includes(workspace.tracePalette) ? workspace.tracePalette : 'channel';
            this.state.viewerGrid = ['standard', 'fine', 'off'].includes(workspace.viewerGrid) ? workspace.viewerGrid : 'standard';
            this.state.invertPolarity = Boolean(workspace.invertPolarity);
            document.getElementById('amplitude-scale').value = amplitude;
            document.getElementById('amplitude-value').textContent = `${amplitude.toFixed(1)}x`;
            document.getElementById('time-window').value = windowSize;
            document.getElementById('time-window-value').textContent = `${windowSize}s`;
            document.getElementById('trace-palette').value = this.state.tracePalette;
            document.getElementById('viewer-grid').value = this.state.viewerGrid;
            document.getElementById('invert-polarity').checked = this.state.invertPolarity;
            document.getElementById('montage-select').value = ['monopolar', 'bipolar', 'average'].includes(workspace.montage) ? workspace.montage : 'monopolar';
            this.updateTimeOffsetRange();
            this.setTimeOffset(Number(workspace.timeOffset) || 0);
            this.updateChannelCheckboxes();
            this.syncBadChannelUI();
            this.renderAnnotations();
            this.refreshSignalViewer();
            const filteredNotice = workspace.processingState === 'filtered'
                ? ' Filtered samples are not stored in review manifests, so the current raw signal remains active.'
                : '';
            this.showToast(`Review restored: ${this.state.annotations.length} notes and ${this.state.badChannels.length} bad channels.${filteredNotice}`, 'success');
        } catch (error) {
            this.showToast(`Could not restore review: ${error.message}`, 'error');
        }
    },

    resetImportProgress() {
        const progress = document.getElementById('upload-progress');
        const progressBar = document.getElementById('upload-progress-bar');
        progress.classList.remove('active');
        progressBar.classList.remove('indeterminate');
        progressBar.style.setProperty('--progress', '0%');
        progressBar.setAttribute('aria-valuenow', '0');
    },

    async loadFile(file) {
        this.setImportProgress(12, 'Reading your file');
        await new Promise(requestAnimationFrame);

        try {
            const eegData = await EEGParsers.parseFile(file);
            this.setImportProgress(78, 'Validating channels and metadata');
            await new Promise(requestAnimationFrame);

            this.state.eegData = eegData;
            this.state.filteredData = null;
            this.state.analysisResults = {};
            this.state.annotations = [];
            this.state.badChannels = [];
            this.setImportProgress(100, 'Recording ready');
            this.initializeDashboard();

            this.showToast(`Loaded ${eegData.channelLabels.length} channels from ${file.name}`, 'success');
        } catch (err) {
            this.showToast(`There was an issue reading this file, ${err.message}`, 'error');
            this.resetImportProgress();
        }
    },

    async loadSampleData() {
        this.setImportProgress(10, 'Loading sample EEG data (chb02_16.edf)');
        await new Promise(requestAnimationFrame);

        try {
            const response = await fetch('chb02_16.edf');
            if (!response.ok) throw new Error('Could not fetch sample file');
            const buffer = await response.arrayBuffer();
            this.setImportProgress(62, 'Parsing EDF records');
            await new Promise(requestAnimationFrame);

            const eegData = EEGParsers.parseEDF(buffer, 'chb02_16.edf');
            this.state.eegData = eegData;
            this.state.filteredData = null;
            this.state.analysisResults = {};
            this.state.annotations = [];
            this.state.badChannels = [];
            this.setImportProgress(100, 'Recording ready');
            this.initializeDashboard();

            this.showToast(`Sample data loaded: ${eegData.channelLabels.length} channels from CHB-MIT database`, 'success');
        } catch (err) {
            this.showToast(`Could not load sample data: ${err.message}`, 'error');
            this.resetImportProgress();
        }
    },



    initializeDashboard() {
        const data = this.state.eegData;
        this.state.isLoaded = true;
        this.state.viewerCursorTime = null;
        this.state.viewerSelection = null;
        this.state.viewerHover = null;
        this.state.viewerDragStart = null;
        this.state.annotationFilter = 'all';
        this.state.editingAnnotationId = null;
        window.scrollTo(0, 0);

        // all channels default
        this.state.selectedChannels = Array.from({ length: data.channelLabels.length }, (_, i) => i);

        document.getElementById('file-name-display').textContent = data.filename;
        document.getElementById('file-badge').classList.add('visible');
        document.getElementById('new-file-btn').classList.add('visible');
        document.getElementById('main-nav').classList.add('visible');
        document.getElementById('workspace-status').classList.add('visible');

        document.getElementById('info-channels').textContent = data.channelLabels.length;
        document.getElementById('info-srate').textContent = data.sampleRate + ' Hz';
        document.getElementById('info-duration').textContent = data.duration.toFixed(1) + 's';
        document.getElementById('info-samples').textContent = data.numSamples.toLocaleString();
        document.getElementById('info-format').textContent = data.format;

        this.buildChannelList();
        document.getElementById('annotation-filter').value = 'all';
        this.renderAnnotations();

        this.populateChannelDropdown('timefreq-channel', data.channelLabels);

        this.populateChannelDropdown('filter-channel', data.channelLabels);

        // time controls
        const maxTime = Math.max(0, data.duration - 0.5);
        document.getElementById('time-offset').max = maxTime;
        this.state.timeWindow = Math.min(10, Math.ceil(data.duration));
        document.getElementById('time-window').value = this.state.timeWindow;
        document.getElementById('time-window-value').textContent = this.state.timeWindow + 's';
        document.getElementById('time-window').max = Math.max(0.5, data.duration);
        this.state.timeOffset = 0;
        document.getElementById('time-offset').value = 0;
        document.getElementById('time-offset-value').textContent = '0.0s';
        document.getElementById('jump-to-time').max = Math.max(0, data.duration);

        document.getElementById('export-end-time').max = data.duration;
        document.getElementById('export-end-time').value = Math.min(10, data.duration).toFixed(1);
        document.getElementById('export-start-time').max = data.duration;
        document.getElementById('export-start-time').value = '0';
        document.getElementById('export-channel-scope').value = 'selected';
        document.getElementById('export-signal-source').value = 'current';
        this.updateExportEstimate();
        document.getElementById('quality-table-wrap').hidden = true;
        document.getElementById('quality-tbody').replaceChildren();
        document.getElementById('quality-summary').textContent = 'No quality review run yet.';
        document.getElementById('quality-mark-flagged').disabled = true;

        document.getElementById('upload-section').classList.add('hidden');
        document.getElementById('dashboard').classList.add('visible');

        document.getElementById('mobile-bottom-nav').classList.add('visible');

        this.resetImportProgress();

        this.switchTab('viewer');

        requestAnimationFrame(() => {
            this.refreshSignalViewer();
        });
    },

    buildChannelList() {
        const container = document.getElementById('channel-list');
        container.innerHTML = '';

        this.state.eegData.channelLabels.forEach((label, idx) => {
            const item = document.createElement('div');
            item.className = 'channel-item';
            item.dataset.channelLabel = label.toLowerCase();

            const selectionLabel = document.createElement('label');
            selectionLabel.className = 'channel-select-label';

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
                this.updateChannelSelectionCount();
                this.refreshSignalViewer();
            });

            const colorDot = document.createElement('span');
            colorDot.className = 'ch-color';
            colorDot.style.backgroundColor = EEGVisualization.channelColors[idx % EEGVisualization.channelColors.length];

            const nameSpan = document.createElement('span');
            nameSpan.className = 'ch-name';
            nameSpan.textContent = label;

            selectionLabel.append(checkbox, colorDot, nameSpan);

            const badButton = document.createElement('button');
            badButton.type = 'button';
            badButton.className = 'channel-bad-toggle';
            badButton.textContent = '!';
            badButton.title = `Mark ${label} as a bad channel`;
            badButton.setAttribute('aria-label', `Mark ${label} as a bad channel`);
            badButton.setAttribute('aria-pressed', 'false');
            badButton.addEventListener('click', () => {
                const isBad = this.state.badChannels.includes(idx);
                this.state.badChannels = isBad
                    ? this.state.badChannels.filter(index => index !== idx)
                    : [...this.state.badChannels, idx].sort((a, b) => a - b);
                item.classList.toggle('is-bad', !isBad);
                badButton.setAttribute('aria-pressed', String(!isBad));
                badButton.title = `${!isBad ? 'Restore' : 'Mark'} ${label} ${!isBad ? 'to usable' : 'as a bad channel'}`;
                this.updateChannelSelectionCount();
                this.refreshSignalViewer();
            });

            item.append(selectionLabel, badButton);
            container.appendChild(item);
        });
        document.getElementById('channel-search').value = '';
        this.updateChannelSelectionCount();
    },

    updateChannelCheckboxes() {
        const checkboxes = document.querySelectorAll('#channel-list input[type="checkbox"]');
        checkboxes.forEach(cb => {
            const idx = parseInt(cb.dataset.channelIdx);
            cb.checked = this.state.selectedChannels.includes(idx);
        });
        this.updateChannelSelectionCount();
    },

    syncBadChannelUI() {
        document.querySelectorAll('#channel-list .channel-item').forEach((item, index) => {
            const isBad = this.state.badChannels.includes(index);
            item.classList.toggle('is-bad', isBad);
            const button = item.querySelector('.channel-bad-toggle');
            if (button) button.setAttribute('aria-pressed', String(isBad));
        });
    },

    updateChannelSelectionCount() {
        const total = this.state.eegData?.channelLabels.length || 0;
        const selected = this.state.selectedChannels.length;
        const count = document.getElementById('channel-selection-count');
        if (count) count.textContent = `${selected} / ${total}`;
        const status = document.getElementById('status-channels');
        if (status) {
            const bad = this.state.badChannels.length;
            status.textContent = bad ? `${selected} selected · ${bad} bad` : `${selected} selected`;
        }
    },

    updateWorkspaceStatus() {
        if (!this.state.eegData) return;
        const montage = document.getElementById('montage-select').value;
        document.getElementById('status-source').textContent = this.state.eegData.filename;
        document.getElementById('status-processing').textContent = this.state.filteredData ? 'Filtered' : 'Raw';
        document.getElementById('status-montage').textContent = montage === 'average' ? 'Average reference' : montage[0].toUpperCase() + montage.slice(1);
        document.getElementById('status-time').textContent = `${this.state.timeOffset.toFixed(1)}–${Math.min(this.state.eegData.duration, this.state.timeOffset + this.state.timeWindow).toFixed(1)} s`;
        this.updateChannelSelectionCount();
    },

    reportExport(success, successMessage, errorMessage = 'The download could not be prepared') {
        if (success) this.showToast(successMessage, 'success');
        else this.showToast(errorMessage, 'error');
    },

    getExportOptions(overrides = {}) {
        if (!this.state.eegData) return overrides;
        const channelScope = overrides.channelScope || document.getElementById('export-channel-scope').value;
        const source = document.getElementById('export-signal-source').value;
        const channelIndices = channelScope === 'all'
            ? Array.from({ length: this.state.eegData.channelLabels.length }, (_, index) => index)
            : this.state.selectedChannels.slice();
        let data = this.state.eegData.channelData;
        let sourceLabel = 'raw';
        if ((source === 'current' || source === 'filtered') && this.state.filteredData) {
            data = this.state.filteredData;
            sourceLabel = 'filtered';
        }
        return {
            channelIndices,
            data,
            sourceLabel,
            startTime: parseFloat(document.getElementById('export-start-time').value),
            endTime: parseFloat(document.getElementById('export-end-time').value),
            decimals: parseInt(document.getElementById('export-precision').value, 10),
            ...overrides
        };
    },

    updateExportEstimate() {
        if (!this.state.eegData) return;
        const options = this.getExportOptions();
        const output = document.getElementById('export-size-estimate');
        const duration = options.endTime - options.startTime;
        const filteredOption = document.querySelector('#export-signal-source option[value="filtered"]');
        filteredOption.disabled = !this.state.filteredData;
        document.getElementById('export-filtered-csv').disabled = !this.state.filteredData;

        if (!Number.isFinite(duration) || duration <= 0 || options.channelIndices.length === 0) {
            output.textContent = 'Choose at least one channel and a valid time range';
            output.classList.add('error');
            return;
        }

        output.classList.remove('error');
        const csvBytes = EEGExport.estimateSignalExport(this.state.eegData, options, 'csv');
        const jsonBytes = EEGExport.estimateSignalExport(this.state.eegData, options, 'json');
        output.textContent = `Estimated CSV ${this.formatBytes(csvBytes)} · JSON ${this.formatBytes(jsonBytes)} · ${options.channelIndices.length} channels · ${duration.toFixed(2)} s`;
    },

    formatBytes(bytes) {
        if (bytes < 1024) return `${Math.round(bytes)} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    },

    async runExport(button, producer, successMessage, errorMessage = 'The download could not be prepared') {
        if (this.state.exportBusy) {
            this.showToast('Another export is still being prepared', 'info');
            return;
        }
        this.state.exportBusy = true;
        const originalText = button?.textContent || '';
        if (button) {
            button.disabled = true;
            button.textContent = 'Preparing…';
            button.setAttribute('aria-busy', 'true');
        }
        await new Promise(requestAnimationFrame);
        try {
            const success = await producer();
            this.reportExport(success, successMessage, errorMessage);
        } catch (error) {
            console.error('Export failed', error);
            this.showToast(errorMessage, 'error');
        } finally {
            this.state.exportBusy = false;
            if (button) {
                button.disabled = false;
                button.textContent = originalText;
                button.removeAttribute('aria-busy');
            }
            this.updateExportEstimate();
        }
    },

    getCurrentVisualizationCanvas() {
        const canvasByTab = {
            viewer: 'viewer-canvas',
            spectrum: 'spectrum-chart',
            bands: 'bands-bar-chart',
            filter: 'filter-canvas',
            timefreq: 'spectrogram-canvas',
            stats: 'stats-rms-chart',
            topo: 'topo-canvas'
        };
        const canvas = document.getElementById(canvasByTab[this.state.activeTab]);
        return canvas && canvas.width > 0 && canvas.height > 0 ? canvas : null;
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



    switchTab(tab) {
        this.state.activeTab = tab;

        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.classList.toggle('active', btn.getAttribute('data-tab') === tab);
        });

        document.querySelectorAll('.tab-content').forEach(tc => {
            tc.classList.toggle('active', tc.id === `tab-${tab}`);
        });

        this.updateMobileNav(tab);

        this.closeMobileSidebar();
        if (tab === 'viewer' && this.state.isLoaded) {
            requestAnimationFrame(() => this.refreshSignalViewer());
        }
    },



    refreshFilterComparison() {
        if (!this.state.filterPreviewData) return;
        const { originalClip, filteredClip, channelLabel, sampleRate } = this.state.filterPreviewData;
        const filterH = window.innerWidth <= 768 ? 220 : 320;
        EEGVisualization.drawFilterComparison(
            document.getElementById('filter-canvas'),
            originalClip,
            filteredClip,
            channelLabel,
            sampleRate,
            {
                height: filterH,
                timeWindow: this.state.timeWindow,
                timeOffset: this.state.timeOffset,
                amplitudeScale: this.state.amplitudeScale
            }
        );
    },



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

        const displayChannels = montage === 'bipolar'
            ? Array.from({ length: displayData.length }, (_, i) => i)
            : this.state.selectedChannels;
        this.state.viewerDisplay = {
            data: displayData,
            labels: displayLabels,
            channels: displayChannels
        };

        EEGVisualization.drawSignals(canvas, {
            channelData: displayData,
            channelLabels: displayLabels,
            sampleRate: data.sampleRate
        }, {
            selectedChannels: displayChannels,
            amplitudeScale: this.state.amplitudeScale,
            badChannels: montage === 'monopolar' ? this.state.badChannels : [],
            tracePalette: this.state.tracePalette,
            gridMode: this.state.viewerGrid,
            invertPolarity: this.state.invertPolarity,
            timeWindow: this.state.timeWindow,
            timeOffset: this.state.timeOffset,
            timePrecision: parseInt(document.getElementById('time-precision').value) || 1,
            height: window.innerWidth <= 768 ? 350 : 500
        });
        const overviewChannel = displayChannels[0];
        EEGVisualization.drawSignalOverview(document.getElementById('viewer-overview-canvas'), {
            signal: overviewChannel === undefined ? null : displayData[overviewChannel],
            duration: data.duration,
            label: overviewChannel === undefined ? 'No channel selected' : displayLabels[overviewChannel]
        }, {
            timeOffset: this.state.timeOffset,
            timeWindow: this.state.timeWindow,
            annotations: this.state.annotations
        });
        document.getElementById('viewer-overview-channel').textContent = overviewChannel === undefined
            ? 'No channel selected'
            : displayLabels[overviewChannel];

        // upd time display
        const precision = parseInt(document.getElementById('time-precision').value) || 1;
        const startT = this.state.timeOffset.toFixed(precision);
        const endT = Math.min(data.duration, this.state.timeOffset + this.state.timeWindow).toFixed(precision);
        const timeRangeEl = document.getElementById('viewer-time-range');
        if (timeRangeEl) {
            timeRangeEl.textContent = startT + 's to ' + endT + 's';
        }
        this.refreshSignalOverlay();
        this.updateWorkspaceStatus();
        this.updateExportEstimate();
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



    computeSpectrum() {
        if (!this.state.eegData) return;

        const data = this.state.filteredData || this.state.eegData.channelData;
        const sampleRate = this.state.eegData.sampleRate;
        const method = document.getElementById('spectrum-method').value;
        const windowType = document.getElementById('spectrum-window').value;
        const maxFreq = parseInt(document.getElementById('spectrum-max-freq').value);
        const scale = document.getElementById('spectrum-scale').value;

        const channels = this.state.selectedChannels.length > 0
            ? this.state.selectedChannels.slice(0, 8) 
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

        this.state.analysisResults.spectrumData = { freqs, datasets };

        EEGVisualization.createSpectrumChart('spectrum-chart', freqs, datasets, {
            maxFreq,
            logScale: scale === 'log'
        });

        this.showToast('Spectrum analysis complete', 'success');
    },



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

        // average
        if (avgBands) {
            for (const key of Object.keys(avgBands)) {
                avgBands[key].power /= channels.length;
            }
        }

        this.state.analysisResults.bandPowers = allBandPowers;
        this.state.analysisResults.avgBandPowers = avgBands;

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



    previewFilter() {
        if (!this.state.eegData) return;

        const filterType = document.querySelector('.filter-type-btn.active').getAttribute('data-filter');
        const chIdx = parseInt(document.getElementById('filter-channel').value) || 0;
        const sampleRate = this.state.eegData.sampleRate;

        const params = this.getFilterParams(filterType);
        if (!this.validateFilterParams(params, filterType, sampleRate)) return;

        const originalClip = this.state.eegData.channelData[chIdx];
        const filteredClip = EEGAnalysis.butterworth(originalClip, sampleRate, params.low, params.high, params.order, filterType);

        let hasNaN = false;
        for (let i = 0; i < filteredClip.length; i++) {
            if (!isFinite(filteredClip[i])) { hasNaN = true; break; }
        }
        if (hasNaN) {
            this.showToast('Filter produced unstable output, try a lower order or different cutoff', 'error');
            return;
        }

        this.state.filterPreviewData = {
            originalClip,
            filteredClip,
            channelLabel: this.state.eegData.channelLabels[chIdx],
            sampleRate
        };

        const filterH = window.innerWidth <= 768 ? 220 : 320;
        EEGVisualization.drawFilterComparison(
            document.getElementById('filter-canvas'),
            originalClip,
            filteredClip,
            this.state.eegData.channelLabels[chIdx],
            sampleRate,
            {
                height: filterH,
                timeWindow: this.state.timeWindow,
                timeOffset: this.state.timeOffset,
                amplitudeScale: this.state.amplitudeScale
            }
        );

        this.drawFilterResponse(filterType, params, sampleRate);

        this.showToast('Filter preview ready', 'info');
    },

    applyFilter() {
        if (!this.state.eegData) return;

        const filterType = document.querySelector('.filter-type-btn.active').getAttribute('data-filter');
        const params = this.getFilterParams(filterType);
        const sampleRate = this.state.eegData.sampleRate;

        if (!this.validateFilterParams(params, filterType, sampleRate)) return;

        const overlay = document.getElementById('filter-processing');
        overlay.style.display = 'flex';

        setTimeout(() => {
            try {
                const sourceData = this.state.eegData.channelData;
                const filtered = sourceData.map(ch =>
                    EEGAnalysis.butterworth(ch, sampleRate, params.low, params.high, params.order, filterType)
                );
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

                let desc = '';
                if (filterType === 'bandpass') desc = `Bandpass ${params.low} - ${params.high} Hz, order ${params.order}`;
                else if (filterType === 'highpass') desc = `Highpass above ${params.low} Hz, order ${params.order}`;
                else if (filterType === 'lowpass') desc = `Lowpass below ${params.high} Hz, order ${params.order}`;
                else if (filterType === 'notch') desc = `Notch at ${params.low} Hz`;

                this.updateFilterStatus(desc);

                const chIdx = parseInt(document.getElementById('filter-channel').value) || 0;
                const originalClip = sourceData[chIdx];
                const filteredClip = filtered[chIdx];

                this.state.filterPreviewData = {
                    originalClip,
                    filteredClip,
                    channelLabel: this.state.eegData.channelLabels[chIdx],
                    sampleRate
                };

                EEGVisualization.drawFilterComparison(
                    document.getElementById('filter-canvas'),
                    originalClip,
                    filteredClip,
                    this.state.eegData.channelLabels[chIdx],
                    sampleRate,
                    {
                        height: window.innerWidth <= 768 ? 220 : 320,
                        timeWindow: this.state.timeWindow,
                        timeOffset: this.state.timeOffset,
                        amplitudeScale: this.state.amplitudeScale
                    }
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
        this.state.filterPreviewData = null;
        this.updateFilterStatus(null);
        this.refreshSignalViewer();

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
            textEl.textContent = 'Viewing the original signal';
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
                this.showToast('High cutoff must be below Nyquist at ' + nyquist.toFixed(0) + ' Hz', 'error');
                return false;
            }
            if (params.low < 0.05) {
                this.showToast('Low cutoff must be at least 0.05 Hz', 'error');
                return false;
            }
        } else if (filterType === 'highpass') {
            if (params.low >= nyquist) {
                this.showToast('Cutoff must be below Nyquist at ' + nyquist.toFixed(0) + ' Hz', 'error');
                return false;
            }
        } else if (filterType === 'lowpass') {
            if (params.high >= nyquist) {
                this.showToast('Cutoff must be below Nyquist at ' + nyquist.toFixed(0) + ' Hz', 'error');
                return false;
            }
        } else if (filterType === 'notch') {
            if (params.low >= nyquist) {
                this.showToast('Notch frequency must be below Nyquist at ' + nyquist.toFixed(0) + ' Hz', 'error');
                return false;
            }
        }

        return true;
    },

    drawFilterResponse(filterType, params, sampleRate) {
        const response = EEGAnalysis.computeFrequencyResponse(sampleRate, params.low, params.high, params.order, filterType);
        const filterH = window.innerWidth <= 768 ? 220 : 320;
        EEGVisualization.drawFrequencyResponse(
            document.getElementById('filter-response-canvas'),
            response.freqs,
            response.magnitude,
            { height: filterH, filterType, params }
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

        EEGVisualization.createStatsChart(
            'stats-rms-chart',
            labels,
            statsArray.map(s => s.rms),
            'RMS Amplitude per Channel',
            '#4A90D9'
        );

        // variance chart
        EEGVisualization.createStatsChart(
            'stats-variance-chart',
            labels,
            statsArray.map(s => s.variance),
            'Variance per Channel',
            '#10B981'
        );

        this.showToast('Statistical analysis complete', 'success');
    },

    computeSignalQuality() {
        if (!this.state.eegData) return;
        const data = this.state.filteredData || this.state.eegData.channelData;
        const sampleRate = this.state.eegData.sampleRate;
        const start = Math.max(0, Math.floor(this.state.timeOffset * sampleRate));
        const end = Math.min(this.state.eegData.numSamples, Math.ceil((this.state.timeOffset + this.state.timeWindow) * sampleRate));
        const results = this.state.eegData.channelLabels.map((label, index) => ({
            index,
            label,
            startTime: this.state.timeOffset,
            endTime: Math.min(this.state.eegData.duration, this.state.timeOffset + this.state.timeWindow),
            ...EEGAnalysis.computeSignalQuality(data[index].subarray(start, end))
        }));
        this.state.analysisResults.quality = results;

        const tbody = document.getElementById('quality-tbody');
        tbody.replaceChildren();
        for (const result of results) {
            const row = document.createElement('tr');
            if (result.flags.length) row.className = 'quality-flagged';
            const values = [
                result.label,
                `${result.peakToPeak.toFixed(2)} µV`,
                `${(result.flatRatio * 100).toFixed(2)}%`,
                `${(result.repeatedExtremeRatio * 100).toFixed(2)}%`,
                result.flags.length ? result.flags.join(' · ') : 'No obvious issue'
            ];
            for (const value of values) {
                const cell = document.createElement('td');
                cell.textContent = value;
                row.appendChild(cell);
            }
            tbody.appendChild(row);
        }

        const flagged = results.filter(result => result.flags.length).length;
        document.getElementById('quality-table-wrap').hidden = false;
        document.getElementById('quality-summary').textContent = `${results.length} channels reviewed from ${this.state.timeOffset.toFixed(2)}–${Math.min(this.state.eegData.duration, this.state.timeOffset + this.state.timeWindow).toFixed(2)} s · ${flagged} flagged for manual review`;
        document.getElementById('quality-mark-flagged').disabled = flagged === 0;
        this.showToast('Signal quality review complete', 'success');
    },



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



    resetToUpload() {
        this.state.eegData = null;
        this.state.filteredData = null;
        this.state.analysisResults = {};
        this.state.annotations = [];
        this.state.annotationFilter = 'all';
        this.state.editingAnnotationId = null;
        this.state.viewerCursorTime = null;
        this.state.viewerSelection = null;
        this.state.viewerHover = null;
        this.state.viewerDisplay = null;
        this.state.viewerDragStart = null;
        this.state.isLoaded = false;
        this.state.selectedChannels = [];
        this.state.badChannels = [];
        window.scrollTo(0, 0);

        document.getElementById('upload-section').classList.remove('hidden');
        document.getElementById('dashboard').classList.remove('visible');
        document.getElementById('main-nav').classList.remove('visible');
        document.getElementById('file-badge').classList.remove('visible');
        document.getElementById('new-file-btn').classList.remove('visible');
        document.getElementById('workspace-status').classList.remove('visible');
        document.getElementById('annotation-form').hidden = true;
        document.getElementById('viewer-selection-bar').hidden = true;
        document.getElementById('viewer-hover-tooltip').hidden = true;
        this.renderAnnotations();

        // hide mobile elements
        document.getElementById('mobile-bottom-nav').classList.remove('visible');
        this.closeMobileSidebar();
        this.closeMobileMoreMenu();

        document.getElementById('file-input').value = '';
        const chartIds = ['spectrum-chart', 'bands-bar-chart', 'bands-pie-chart', 'stats-rms-chart', 'stats-variance-chart'];
        chartIds.forEach(id => EEGVisualization.destroyChart(id));
    },

    refreshCurrentView() {
        switch (this.state.activeTab) {
            case 'viewer': this.refreshSignalViewer(); break;
        }
    },


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

        const iconWrap = document.createElement('span');
        iconWrap.className = 'toast-icon';
        iconWrap.innerHTML = icon;
        const messageWrap = document.createElement('span');
        messageWrap.textContent = String(message);
        toast.append(iconWrap, messageWrap);
        container.appendChild(toast);

        setTimeout(() => {
            toast.classList.add('removing');
            setTimeout(() => toast.remove(), 300);
        }, 3500);
    }
};
document.addEventListener('DOMContentLoaded', () => App.init());
