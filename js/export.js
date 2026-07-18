// export multiple formats
const EEGExport = {

    downloadFile(content, filename, mimeType) {
        try {
            const blob = new Blob(Array.isArray(content) ? content : [content], { type: mimeType });
            return this.downloadBlob(blob, filename);
        } catch (error) {
            console.error('Download preparation failed', error);
            return false;
        }
    },

    _csvCell(value) {
        let text = String(value ?? '');
        if (/^[=+\-@]/.test(text)) text = "'" + text;
        if (/[",\r\n]/.test(text)) text = '"' + text.replace(/"/g, '""') + '"';
        return text;
    },

    _tsvCell(value) {
        return String(value ?? 'n/a').replace(/[\t\r\n]+/g, ' ').trim() || 'n/a';
    },

    _buildSignalCSV(channelLabels, data, sampleRate, startSample = 0, endSample = data[0].length, decimals = 4) {
        const chunks = ['Time_seconds,' + channelLabels.map(label => this._csvCell(label)).join(',') + '\n'];
        const rowsPerChunk = 2000;
        for (let chunkStart = startSample; chunkStart < endSample; chunkStart += rowsPerChunk) {
            const chunkEnd = Math.min(endSample, chunkStart + rowsPerChunk);
            const rows = [];
            for (let i = chunkStart; i < chunkEnd; i++) {
                const values = data.map(ch => Number.isFinite(ch[i]) ? ch[i].toFixed(decimals) : '');
                rows.push((i / sampleRate).toFixed(6) + ',' + values.join(','));
            }
            chunks.push(rows.join('\n') + '\n');
        }
        return chunks;
    },

    _resolveSignalScope(eegData, options = {}) {
        const allIndices = Array.from({ length: eegData.channelLabels.length }, (_, index) => index);
        const requestedIndices = Array.isArray(options.channelIndices) && options.channelIndices.length
            ? options.channelIndices
            : allIndices;
        const channelIndices = requestedIndices.filter(index => Number.isInteger(index) && index >= 0 && index < eegData.channelLabels.length);
        const sourceData = options.data || eegData.channelData;
        const startTime = Math.max(0, Number(options.startTime) || 0);
        const requestedEnd = Number(options.endTime);
        const endTime = Number.isFinite(requestedEnd) ? Math.min(eegData.duration, requestedEnd) : eegData.duration;
        const startSample = Math.max(0, Math.floor(startTime * eegData.sampleRate));
        const endSample = Math.min(eegData.numSamples, Math.ceil(endTime * eegData.sampleRate));
        const decimals = Math.min(8, Math.max(0, parseInt(options.decimals, 10) || 4));
        return {
            channelIndices,
            channelLabels: channelIndices.map(index => eegData.channelLabels[index]),
            data: channelIndices.map(index => sourceData[index]),
            startTime,
            endTime,
            startSample,
            endSample,
            decimals,
            sourceLabel: options.sourceLabel || 'raw'
        };
    },

    estimateSignalExport(eegData, options = {}, format = 'csv') {
        const scope = this._resolveSignalScope(eegData, options);
        const rows = Math.max(0, scope.endSample - scope.startSample);
        const values = rows * scope.channelIndices.length;
        const bytesPerValue = format === 'json' ? scope.decimals + 10 : scope.decimals + 7;
        const timeBytes = rows * 11;
        return Math.max(0, values * bytesPerValue + timeBytes + scope.channelLabels.join(',').length + 128);
    },

    _safeBaseName(filename) {
        return String(filename || 'neuroscope').replace(/\.[^.]+$/, '').replace(/[^a-z0-9._-]+/gi, '_');
    },

    _triggerDownload(blob, filename) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.setTimeout(() => URL.revokeObjectURL(url), 1000);
        return true;
    },

    downloadBlob(blob, filename) {
        if (!(blob instanceof Blob) || blob.size === 0) return false;
        try {
            return this._triggerDownload(blob, filename);
        } catch (error) {
            console.error('Download failed', error);
            return false;
        }
    },

    exportCSV(eegData, options = {}) {
        const scope = this._resolveSignalScope(eegData, options);
        if (scope.endSample <= scope.startSample || scope.channelIndices.length === 0) return false;
        const csv = this._buildSignalCSV(scope.channelLabels, scope.data, eegData.sampleRate, scope.startSample, scope.endSample, scope.decimals);
        return this.downloadFile(csv, `${this._safeBaseName(eegData.filename)}_${scope.startTime.toFixed(2)}s-${scope.endTime.toFixed(2)}s.csv`, 'text/csv;charset=utf-8');
    },

    exportFilteredCSV(eegData, filteredData, options = {}) {
        if (!filteredData) return false;
        return this.exportCSV(eegData, { ...options, data: filteredData, sourceLabel: 'filtered' });
    },

    // export json
    exportJSON(eegData, analysisResults = {}, options = {}) {
        const scope = this._resolveSignalScope(eegData, options);
        if (scope.endSample <= scope.startSample || scope.channelIndices.length === 0) return false;
        const output = {
            metadata: {
                filename: eegData.filename,
                format: eegData.format,
                sampleRate: eegData.sampleRate,
                recordingDuration: eegData.duration,
                duration: scope.endTime - scope.startTime,
                numSamples: scope.endSample - scope.startSample,
                numChannels: scope.channelLabels.length,
                channelLabels: scope.channelLabels,
                startTime: scope.startTime,
                endTime: scope.endTime,
                signalSource: scope.sourceLabel,
                patient: eegData.metadata.patient,
                recording: eegData.metadata.recording,
                date: eegData.metadata.date,
                time: eegData.metadata.time,
                exportedAt: new Date().toISOString()
            },
            channels: scope.channelLabels.map((label, i) => ({
                label,
                data: Array.from(scope.data[i].slice(scope.startSample, scope.endSample))
            }))
        };

        if (analysisResults.statistics) {
            output.statistics = analysisResults.statistics;
        }
        if (analysisResults.bandPowers) {
            output.bandPowers = analysisResults.bandPowers;
        }

        const jsonStr = JSON.stringify(output, null, 2);
        return this.downloadFile(jsonStr, `${this._safeBaseName(eegData.filename)}_export.json`, 'application/json');
    },

    // export canvas png
    exportPNG(canvasId, filename) {
        const canvas = document.getElementById(canvasId);
        if (!canvas || canvas.width === 0 || canvas.height === 0) return Promise.resolve(false);
        return new Promise(resolve => {
            canvas.toBlob(blob => resolve(blob ? this.downloadBlob(blob, filename) : false), 'image/png');
        });
    },

    // export spectrum csv
    exportSpectrumCSV(freqs, psdDatasets, channelLabels) {
        let csv = 'Frequency_Hz';
        const usedLabels = [];

        for (let i = 0; i < psdDatasets.length; i++) {
            const label = psdDatasets[i].label || channelLabels[i] || `Ch${i + 1}`;
            csv += `,${label}_Power`;
            usedLabels.push(label);
        }
        csv += '\n';

        for (let f = 0; f < freqs.length; f++) {
            csv += freqs[f].toFixed(4);
            for (const ds of psdDatasets) {
                csv += ',' + (ds.psd[f] || 0).toFixed(8);
            }
            csv += '\n';
        }

        this.downloadFile(csv, 'spectrum_data.csv', 'text/csv');
    },

    // export stats csv
    exportStatsCSV(channelLabels, statsArray) {
        let csv = 'Channel,Mean_uV,Std_Dev,Variance,RMS,Min,Max,Peak_to_Peak,Skewness,Kurtosis,Zero_Crossings\n';

        for (let i = 0; i < channelLabels.length; i++) {
            const s = statsArray[i];
            csv += `${channelLabels[i]},${s.mean.toFixed(4)},${s.std.toFixed(4)},${s.variance.toFixed(4)},`;
            csv += `${s.rms.toFixed(4)},${s.min.toFixed(4)},${s.max.toFixed(4)},${s.peakToPeak.toFixed(4)},`;
            csv += `${s.skewness.toFixed(4)},${s.kurtosis.toFixed(4)},${s.zeroCrossings}\n`;
        }

        this.downloadFile(csv, 'statistics.csv', 'text/csv');
    },

    // export pdf
    exportPDF(eegData, analysisResults = {}) {
        const jsPDF = window.jspdf && window.jspdf.jsPDF;
        if (!jsPDF) {
            console.error('jspdf load failed');
            return false;
        }

        const doc = new jsPDF('p', 'mm', 'a4');
        const pageWidth = doc.internal.pageSize.getWidth();
        const margin = 15;
        let y = 20;

        // title
        doc.setFontSize(22);
        doc.setTextColor(74, 144, 217);
        doc.text('NeuroScope Analysis Report', margin, y);
        y += 12;

        // subtitle
        doc.setFontSize(10);
        doc.setTextColor(100, 116, 139);
        doc.text(`Generated on ${new Date().toLocaleDateString()} at ${new Date().toLocaleTimeString()}`, margin, y);
        y += 10;

        doc.setDrawColor(226, 232, 240);
        doc.line(margin, y, pageWidth - margin, y);
        y += 10;
        doc.setFontSize(14);
        doc.setTextColor(30, 41, 59);
        doc.text('Recording Information', margin, y);
        y += 8;

        doc.setFontSize(10);
        doc.setTextColor(71, 85, 105);
        const info = [
            ['File', eegData.filename],
            ['Format', eegData.format],
            ['Sample Rate', `${eegData.sampleRate} Hz`],
            ['Duration', `${eegData.duration.toFixed(1)} seconds`],
            ['Channels', `${eegData.channelLabels.length}`],
            ['Total Samples', `${eegData.numSamples}`],
            ['Patient', eegData.metadata.patient || 'Unspecified'],
            ['Date', eegData.metadata.date || 'Unspecified']
        ];

        for (const [label, value] of info) {
            doc.setTextColor(100, 116, 139);
            doc.text(`${label}`, margin, y);
            doc.setTextColor(30, 41, 59);
            doc.text(value, margin + 40, y);
            y += 6;
        }

        y += 5;

        // channel list
        doc.setFontSize(14);
        doc.setTextColor(30, 41, 59);
        doc.text('Channels', margin, y);
        y += 7;

        doc.setFontSize(9);
        doc.setTextColor(71, 85, 105);
        const chList = eegData.channelLabels.join(', ');
        const lines = doc.splitTextToSize(chList, pageWidth - 2 * margin);
        doc.text(lines, margin, y);
        y += lines.length * 5 + 5;

        // stats
        if (analysisResults.statistics && analysisResults.statistics.length > 0) {
            if (y > 240) { doc.addPage(); y = 20; }

            doc.setFontSize(14);
            doc.setTextColor(30, 41, 59);
            doc.text('Statistical Summary', margin, y);
            y += 8;

            doc.setFontSize(8);
            doc.setFillColor(235, 243, 252);
            doc.rect(margin, y - 4, pageWidth - 2 * margin, 7, 'F');

            const cols = ['Channel', 'Mean', 'Std', 'RMS', 'Min', 'Max', 'P-P'];
            const colWidths = [25, 22, 22, 22, 22, 22, 22];
            let xPos = margin + 2;

            doc.setTextColor(46, 109, 180);
            for (let c = 0; c < cols.length; c++) {
                doc.text(cols[c], xPos, y);
                xPos += colWidths[c];
            }
            y += 6;

            doc.setTextColor(71, 85, 105);
            for (let i = 0; i < Math.min(analysisResults.statistics.length, 25); i++) {
                const s = analysisResults.statistics[i];
                xPos = margin + 2;

                if (y > 280) { doc.addPage(); y = 20; }

                const row = [
                    eegData.channelLabels[i],
                    s.mean.toFixed(2),
                    s.std.toFixed(2),
                    s.rms.toFixed(2),
                    s.min.toFixed(2),
                    s.max.toFixed(2),
                    s.peakToPeak.toFixed(2)
                ];

                for (let c = 0; c < row.length; c++) {
                    doc.text(row[c], xPos, y);
                    xPos += colWidths[c];
                }
                y += 5;
            }
        }

        const canvasIds = ['viewer-canvas', 'spectrum-chart', 'topo-canvas'];
        for (const cId of canvasIds) {
            const canvas = document.getElementById(cId);
            if (canvas && canvas.width > 0 && canvas.height > 0) {
                try {
                    if (y > 200) { doc.addPage(); y = 20; }
                    const imgData = canvas.toDataURL('image/png');
                    const imgW = pageWidth - 2 * margin;
                    const imgH = (canvas.height / canvas.width) * imgW;
                    doc.addImage(imgData, 'PNG', margin, y, imgW, Math.min(imgH, 100));
                    y += Math.min(imgH, 100) + 10;
                } catch (e) {
                    // canvas tainted skip
                }
            }
        }

        const totalPages = doc.getNumberOfPages();
        for (let i = 1; i <= totalPages; i++) {
            doc.setPage(i);
            doc.setFontSize(8);
            doc.setTextColor(148, 163, 184);
            doc.text(`NeuroScope EEG Analysis Report - Page ${i} of ${totalPages}`, pageWidth / 2, 290, { align: 'center' });
        }

        const baseName = eegData.filename.replace(/\.[^.]+$/, '');
        doc.save(`${baseName}_report.pdf`);
        return true;
    },

    exportSVG(canvasId, filename) {
        const canvas = document.getElementById(canvasId);
        if (!canvas) return;

        const width = canvas.width;
        const height = canvas.height;
        const dataUrl = canvas.toDataURL('image/png');

        const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"
     width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <title>NeuroScope EEG Signal Visualization</title>
  <desc>Generated by NeuroScope EEG Data Analysis Platform</desc>
  <image width="${width}" height="${height}" xlink:href="${dataUrl}"/>
</svg>`;

        this.downloadFile(svg, filename, 'image/svg+xml');
    },

    exportTimeRangeCSV(eegData, filteredData, startTime, endTime) {
        const { channelLabels, sampleRate } = eegData;
        const data = filteredData || eegData.channelData;

        const startSample = Math.max(0, Math.floor(startTime * sampleRate));
        const endSample = Math.min(data[0].length, Math.ceil(endTime * sampleRate));

        if (!Number.isFinite(startTime) || !Number.isFinite(endTime) || endSample <= startSample) return false;
        const csv = this._buildSignalCSV(channelLabels, data, sampleRate, startSample, endSample);

        const baseName = this._safeBaseName(eegData.filename);
        const startStr = startTime.toFixed(1).replace('.', '_');
        const endStr = endTime.toFixed(1).replace('.', '_');
        return this.downloadFile(csv, `${baseName}_${startStr}s_to_${endStr}s.csv`, 'text/csv;charset=utf-8');
    },

    // export band power CSV
    exportBandPowerCSV(channelLabels, bandPowers) {
        const bandNames = ['delta', 'theta', 'alpha', 'beta', 'gamma'];
        const bandRanges = {
            delta: '0.5 to 4 Hz',
            theta: '4 to 8 Hz',
            alpha: '8 to 13 Hz',
            beta: '13 to 30 Hz',
            gamma: '30 to 100 Hz'
        };

        let csv = 'Channel';
        for (const name of bandNames) {
            csv += `,${name}_power_uV2,${name}_range`;
        }
        csv += ',total_power_uV2';
        csv += '\n';

        for (let i = 0; i < channelLabels.length; i++) {
            csv += channelLabels[i];
            const bp = bandPowers[i];
            let total = 0;
            for (const name of bandNames) {
                const power = bp[name].power;
                total += power;
                csv += `,${power.toFixed(6)},${bandRanges[name]}`;
            }
            csv += `,${total.toFixed(6)}`;
            csv += '\n';
        }

        csv += '\n';
        csv += 'Channel';
        for (const name of bandNames) {
            csv += `,${name}_relative_percent`;
        }
        csv += '\n';

        for (let i = 0; i < channelLabels.length; i++) {
            csv += channelLabels[i];
            const bp = bandPowers[i];
            const total = bandNames.reduce((s, k) => s + bp[k].power, 0);
            for (const name of bandNames) {
                const pct = total > 0 ? (bp[name].power / total * 100) : 0;
                csv += `,${pct.toFixed(4)}`;
            }
            csv += '\n';
        }

        this.downloadFile(csv, 'band_power_analysis.csv', 'text/csv');
    },

    exportHighResPNG(canvas, filename, multiplier) {
        if (!canvas || canvas.width === 0 || canvas.height === 0) return Promise.resolve(false);
        const rect = canvas.getBoundingClientRect();
        const targetWidth = Math.max(1, Math.round(rect.width * multiplier));
        const targetHeight = Math.max(1, Math.round(rect.height * multiplier));
        const tempCanvas = document.createElement('canvas');
        const ctx = tempCanvas.getContext('2d');
        tempCanvas.width = targetWidth;
        tempCanvas.height = targetHeight;
        ctx.drawImage(canvas, 0, 0, targetWidth, targetHeight);

        return new Promise(resolve => {
            tempCanvas.toBlob(blob => resolve(blob ? this.downloadBlob(blob, filename) : false), 'image/png');
        });
    },

    // export MATLAB-compatible JSON
    exportMATLABJSON(eegData, filteredData, analysisResults, options = {}) {
        const scope = this._resolveSignalScope(eegData, options);
        if (scope.endSample <= scope.startSample || scope.channelIndices.length === 0) return false;
        const output = {
            version: '1.0',
            generator: 'NeuroScope EEG Analysis Platform',
            timestamp: new Date().toISOString(),
            recording: {
                filename: eegData.filename,
                format: eegData.format,
                sampleRate: eegData.sampleRate,
                duration: eegData.duration,
                numSamples: scope.endSample - scope.startSample,
                numChannels: scope.channelLabels.length,
                channelLabels: scope.channelLabels,
                startTime: scope.startTime,
                endTime: scope.endTime,
                signalSource: scope.sourceLabel,
                patient: eegData.metadata.patient,
                recording: eegData.metadata.recording,
                date: eegData.metadata.date,
                time: eegData.metadata.time
            },
            data: {
                signal: scope.channelLabels.map((label, i) => ({
                    channel: label,
                    samples: Array.from(scope.data[i].slice(scope.startSample, scope.endSample))
                }))
            }
        };

        if (analysisResults.statistics) {
            output.analysis = output.analysis || {};
            output.analysis.statistics = analysisResults.statistics;
        }

        if (analysisResults.bandPowers) {
            output.analysis = output.analysis || {};
            output.analysis.bandPowers = analysisResults.bandPowers;
        }

        if (analysisResults.avgBandPowers) {
            output.analysis = output.analysis || {};
            output.analysis.averageBandPowers = analysisResults.avgBandPowers;
        }

        if (analysisResults.spectrumData) {
            output.analysis = output.analysis || {};
            output.analysis.spectrum = {
                frequencies: Array.from(analysisResults.spectrumData.freqs),
                channels: analysisResults.spectrumData.datasets.map(ds => ({
                    channel: ds.label,
                    psd: Array.from(ds.psd)
                }))
            };
        }

        const jsonStr = JSON.stringify(output, null, 2);
        const baseName = this._safeBaseName(eegData.filename);
        return this.downloadFile(jsonStr, `${baseName}_matlab.json`, 'application/json');
    },

    exportSessionManifest(eegData, state) {
        const manifest = {
            schemaVersion: 1,
            exportedAt: new Date().toISOString(),
            application: 'NeuroScope',
            recording: {
                filename: eegData.filename,
                format: eegData.format,
                sampleRate: eegData.sampleRate,
                duration: eegData.duration,
                numSamples: eegData.numSamples,
                channelLabels: eegData.channelLabels,
                metadata: eegData.metadata
            },
            workspace: {
                processingState: state.filteredData ? 'filtered' : 'raw',
                selectedChannels: state.selectedChannels.map(index => ({ index, label: eegData.channelLabels[index] })),
                badChannels: (state.badChannels || []).map(index => ({ index, label: eegData.channelLabels[index] })),
                amplitudeScale: state.amplitudeScale,
                timeWindow: state.timeWindow,
                timeOffset: state.timeOffset,
                montage: document.getElementById('montage-select')?.value || 'monopolar',
                tracePalette: state.tracePalette || 'channel',
                viewerGrid: state.viewerGrid || 'standard',
                invertPolarity: Boolean(state.invertPolarity)
            },
            annotations: state.annotations || [],
            analysesAvailable: Object.keys(state.analysisResults || {})
        };
        return this.downloadFile(JSON.stringify(manifest, null, 2), `${this._safeBaseName(eegData.filename)}_session.json`, 'application/json');
    },

    exportAnnotationsCSV(eegData, annotations) {
        const rows = ['Onset_seconds,Duration_seconds,Type,Channels,Description,Created_at'];
        for (const annotation of annotations) {
            rows.push([
                Number(annotation.onset ?? annotation.time ?? 0).toFixed(3),
                Number(annotation.duration || 0).toFixed(3),
                this._csvCell(annotation.type),
                this._csvCell(annotation.channels?.join('|') || ''),
                this._csvCell(annotation.note),
                this._csvCell(annotation.createdAt)
            ].join(','));
        }
        return this.downloadFile(rows.join('\n') + '\n', `${this._safeBaseName(eegData.filename)}_annotations.csv`, 'text/csv;charset=utf-8');
    },

    exportBIDSEventsTSV(eegData, annotations) {
        const rows = ['onset\tduration\ttrial_type\tchannel\tdescription'];
        const sorted = annotations.slice().sort((a, b) => (a.onset ?? a.time ?? 0) - (b.onset ?? b.time ?? 0));
        for (const annotation of sorted) {
            rows.push([
                Number(annotation.onset ?? annotation.time ?? 0).toFixed(3),
                Number(annotation.duration || 0).toFixed(3),
                this._tsvCell(annotation.type),
                this._tsvCell(annotation.channels?.join('|') || 'n/a'),
                this._tsvCell(annotation.note)
            ].join('\t'));
        }
        return this.downloadFile(rows.join('\n') + '\n', `${this._safeBaseName(eegData.filename)}_events.tsv`, 'text/tab-separated-values;charset=utf-8');
    },

    exportBIDSChannelsTSV(eegData, badChannels = []) {
        const bad = new Set(badChannels);
        const rows = ['name\ttype\tunits\tstatus\tstatus_description'];
        eegData.channelLabels.forEach((label, index) => {
            const isBad = bad.has(index);
            rows.push([
                this._tsvCell(label),
                'EEG',
                'uV',
                isBad ? 'bad' : 'good',
                isBad ? 'Marked bad during manual NeuroScope review' : 'n/a'
            ].join('\t'));
        });
        return this.downloadFile(rows.join('\n') + '\n', `${this._safeBaseName(eegData.filename)}_channels.tsv`, 'text/tab-separated-values;charset=utf-8');
    },

    exportQualityCSV(eegData, qualityResults) {
        const rows = ['Channel,Start_seconds,End_seconds,Peak_to_peak_uV,Flat_transition_percent,Repeated_extreme_percent,Review_flags'];
        for (const result of qualityResults) {
            rows.push([
                this._csvCell(result.label),
                Number(result.startTime || 0).toFixed(3),
                Number(result.endTime || 0).toFixed(3),
                Number(result.peakToPeak || 0).toFixed(4),
                (Number(result.flatRatio || 0) * 100).toFixed(4),
                (Number(result.repeatedExtremeRatio || 0) * 100).toFixed(4),
                this._csvCell(result.flags?.join('|') || '')
            ].join(','));
        }
        return this.downloadFile(rows.join('\n') + '\n', `${this._safeBaseName(eegData.filename)}_quality_review.csv`, 'text/csv;charset=utf-8');
    },

    exportAnnotationsJSON(eegData, annotations) {
        const output = {
            schemaVersion: 1,
            recording: eegData.filename,
            duration: eegData.duration,
            exportedAt: new Date().toISOString(),
            annotations
        };
        return this.downloadFile(JSON.stringify(output, null, 2), `${this._safeBaseName(eegData.filename)}_annotations.json`, 'application/json');
    },

    exportAnnotatedSignalBundle(eegData, filteredData, annotation) {
        if (!eegData || !annotation || Number(annotation.duration) <= 0) return false;
        const startTime = Math.max(0, Number(annotation.onset) || 0);
        const endTime = Math.min(eegData.duration, startTime + Number(annotation.duration));
        const startSample = Math.max(0, Math.floor(startTime * eegData.sampleRate));
        const endSample = Math.min(eegData.numSamples, Math.ceil(endTime * eegData.sampleRate));
        if (endSample <= startSample) return false;

        const affectedLabels = Array.isArray(annotation.channels) && annotation.channels.length
            ? new Set(annotation.channels)
            : null;
        const channelIndices = eegData.channelLabels
            .map((label, index) => ({ label, index }))
            .filter(item => !affectedLabels || affectedLabels.has(item.label));
        if (!channelIndices.length) return false;

        const useFiltered = annotation.workspaceSnapshot?.signalState === 'filtered' && filteredData;
        const sourceData = useFiltered ? filteredData : eegData.channelData;
        const output = {
            schemaVersion: 1,
            application: 'NeuroScope',
            exportedAt: new Date().toISOString(),
            recording: {
                filename: eegData.filename,
                format: eegData.format,
                sampleRate: eegData.sampleRate,
                duration: eegData.duration
            },
            annotation,
            exclusionPolicy: annotation.excludeFromAnalysis
                ? 'Flagged as metadata only; NeuroScope did not remove samples from analyses'
                : 'Not flagged for exclusion',
            signal: {
                source: useFiltered ? 'filtered' : 'raw',
                startTime,
                endTime,
                channels: channelIndices.map(({ label, index }) => ({
                    label,
                    data: Array.from(sourceData[index].slice(startSample, endSample))
                }))
            }
        };
        const range = `${startTime.toFixed(3)}s-${endTime.toFixed(3)}s`;
        return this.downloadFile(
            JSON.stringify(output, null, 2),
            `${this._safeBaseName(eegData.filename)}_${range}_annotated_signal.json`,
            'application/json'
        );
    }
};
