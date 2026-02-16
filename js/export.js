// neuroScope: export multiple formats
const EEGExport = {

    // dl file content
    downloadFile(content, filename, mimeType) {
        const blob = new Blob([content], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    },

    // dl blob
    downloadBlob(blob, filename) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    },

    // export eeg csv
    exportCSV(eegData) {
        const { channelLabels, channelData, sampleRate } = eegData;
        const numSamples = channelData[0].length;

        let csv = 'Time,' + channelLabels.join(',') + '\n';

        for (let i = 0; i < numSamples; i++) {
            const time = (i / sampleRate).toFixed(6);
            const values = channelData.map(ch => ch[i].toFixed(4));
            csv += time + ',' + values.join(',') + '\n';
        }

        const baseName = eegData.filename.replace(/\.[^.]+$/, '');
        this.downloadFile(csv, `${baseName}_data.csv`, 'text/csv');
    },

    // export filtered csv
    exportFilteredCSV(eegData, filteredData) {
        const { channelLabels, sampleRate } = eegData;
        const data = filteredData || eegData.channelData;
        const numSamples = data[0].length;

        let csv = 'Time,' + channelLabels.join(',') + '\n';

        for (let i = 0; i < numSamples; i++) {
            const time = (i / sampleRate).toFixed(6);
            const values = data.map(ch => ch[i].toFixed(4));
            csv += time + ',' + values.join(',') + '\n';
        }

        const baseName = eegData.filename.replace(/\.[^.]+$/, '');
        this.downloadFile(csv, `${baseName}_filtered.csv`, 'text/csv');
    },

    // export json
    exportJSON(eegData, analysisResults = {}) {
        const output = {
            metadata: {
                filename: eegData.filename,
                format: eegData.format,
                sampleRate: eegData.sampleRate,
                duration: eegData.duration,
                numSamples: eegData.numSamples,
                numChannels: eegData.channelLabels.length,
                channelLabels: eegData.channelLabels,
                patient: eegData.metadata.patient,
                recording: eegData.metadata.recording,
                date: eegData.metadata.date,
                time: eegData.metadata.time,
                exportedAt: new Date().toISOString()
            },
            channels: eegData.channelLabels.map((label, i) => ({
                label,
                data: Array.from(eegData.channelData[i])
            }))
        };

        if (analysisResults.statistics) {
            output.statistics = analysisResults.statistics;
        }
        if (analysisResults.bandPowers) {
            output.bandPowers = analysisResults.bandPowers;
        }

        const jsonStr = JSON.stringify(output, null, 2);
        const baseName = eegData.filename.replace(/\.[^.]+$/, '');
        this.downloadFile(jsonStr, `${baseName}_export.json`, 'application/json');
    },

    // export canvas png
    exportPNG(canvasId, filename) {
        const canvas = document.getElementById(canvasId);
        if (!canvas) return;

        canvas.toBlob(blob => {
            this.downloadBlob(blob, filename);
        }, 'image/png');
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
        const { jsPDF } = window.jspdf;
        if (!jsPDF) {
            console.error('jspdf load failed');
            return;
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

        // line
        doc.setDrawColor(226, 232, 240);
        doc.line(margin, y, pageWidth - margin, y);
        y += 10;

        // Recording Info
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

            // table header
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

        // add canvas imgs
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

        // Footer
        const totalPages = doc.getNumberOfPages();
        for (let i = 1; i <= totalPages; i++) {
            doc.setPage(i);
            doc.setFontSize(8);
            doc.setTextColor(148, 163, 184);
            doc.text(`NeuroScope EEG Analysis Report - Page ${i} of ${totalPages}`, pageWidth / 2, 290, { align: 'center' });
        }

        const baseName = eegData.filename.replace(/\.[^.]+$/, '');
        doc.save(`${baseName}_report.pdf`);
    },

    // export SVG from canvas
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

    // export time range CSV
    exportTimeRangeCSV(eegData, filteredData, startTime, endTime) {
        const { channelLabels, sampleRate } = eegData;
        const data = filteredData || eegData.channelData;

        const startSample = Math.max(0, Math.floor(startTime * sampleRate));
        const endSample = Math.min(data[0].length, Math.ceil(endTime * sampleRate));

        let csv = 'Time_seconds,' + channelLabels.join(',') + '\n';

        for (let i = startSample; i < endSample; i++) {
            const time = (i / sampleRate).toFixed(6);
            const values = data.map(ch => ch[i].toFixed(4));
            csv += time + ',' + values.join(',') + '\n';
        }

        const baseName = eegData.filename.replace(/\.[^.]+$/, '');
        const startStr = startTime.toFixed(1).replace('.', '_');
        const endStr = endTime.toFixed(1).replace('.', '_');
        this.downloadFile(csv, `${baseName}_${startStr}s_to_${endStr}s.csv`, 'text/csv');
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

        // Add relative power rows
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

    // export high resolution PNG
    exportHighResPNG(canvas, filename, multiplier) {
        const tempCanvas = document.createElement('canvas');
        const ctx = tempCanvas.getContext('2d');
        tempCanvas.width = canvas.width * multiplier;
        tempCanvas.height = canvas.height * multiplier;
        ctx.scale(multiplier, multiplier);
        ctx.drawImage(canvas, 0, 0);

        tempCanvas.toBlob(blob => {
            if (blob) this.downloadBlob(blob, filename);
        }, 'image/png');
    },

    // export MATLAB-compatible JSON
    exportMATLABJSON(eegData, filteredData, analysisResults) {
        const output = {
            version: '1.0',
            generator: 'NeuroScope EEG Analysis Platform',
            timestamp: new Date().toISOString(),
            recording: {
                filename: eegData.filename,
                format: eegData.format,
                sampleRate: eegData.sampleRate,
                duration: eegData.duration,
                numSamples: eegData.numSamples,
                numChannels: eegData.channelLabels.length,
                channelLabels: eegData.channelLabels,
                patient: eegData.metadata.patient,
                recording: eegData.metadata.recording,
                date: eegData.metadata.date,
                time: eegData.metadata.time
            },
            data: {
                raw: eegData.channelLabels.map((label, i) => ({
                    channel: label,
                    samples: Array.from(eegData.channelData[i])
                }))
            }
        };

        if (filteredData) {
            output.data.filtered = eegData.channelLabels.map((label, i) => ({
                channel: label,
                samples: Array.from(filteredData[i])
            }));
        }

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
        const baseName = eegData.filename.replace(/\.[^.]+$/, '');
        this.downloadFile(jsonStr, `${baseName}_matlab.json`, 'application/json');
    }
};
