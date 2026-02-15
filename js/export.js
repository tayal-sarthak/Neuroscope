/**
 * NeuroScope - Export Module
 * Export data and visualizations in multiple formats
 */

const EEGExport = {

    /**
     * Download a file with given content
     */
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

    /**
     * Download a blob
     */
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

    /**
     * Export raw EEG data as CSV
     */
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

    /**
     * Export filtered data as CSV
     */
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

    /**
     * Export data as JSON
     */
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

    /**
     * Export canvas as PNG
     */
    exportPNG(canvasId, filename) {
        const canvas = document.getElementById(canvasId);
        if (!canvas) return;

        canvas.toBlob(blob => {
            this.downloadBlob(blob, filename);
        }, 'image/png');
    },

    /**
     * Export spectrum data as CSV
     */
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

    /**
     * Export statistics as CSV
     */
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

    /**
     * Export PDF report
     */
    exportPDF(eegData, analysisResults = {}) {
        const { jsPDF } = window.jspdf;
        if (!jsPDF) {
            console.error('jsPDF library failed to load');
            return;
        }

        const doc = new jsPDF('p', 'mm', 'a4');
        const pageWidth = doc.internal.pageSize.getWidth();
        const margin = 15;
        let y = 20;

        // Title
        doc.setFontSize(22);
        doc.setTextColor(74, 144, 217);
        doc.text('NeuroScope Analysis Report', margin, y);
        y += 12;

        // Subtitle
        doc.setFontSize(10);
        doc.setTextColor(100, 116, 139);
        doc.text(`Generated on ${new Date().toLocaleDateString()} at ${new Date().toLocaleTimeString()}`, margin, y);
        y += 10;

        // Line
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
            ['Patient', eegData.metadata.patient || 'Unknown'],
            ['Date', eegData.metadata.date || 'Unknown']
        ];

        for (const [label, value] of info) {
            doc.setTextColor(100, 116, 139);
            doc.text(`${label}:`, margin, y);
            doc.setTextColor(30, 41, 59);
            doc.text(value, margin + 40, y);
            y += 6;
        }

        y += 5;

        // Channel list
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

        // Statistics
        if (analysisResults.statistics && analysisResults.statistics.length > 0) {
            if (y > 240) { doc.addPage(); y = 20; }

            doc.setFontSize(14);
            doc.setTextColor(30, 41, 59);
            doc.text('Statistical Summary', margin, y);
            y += 8;

            // Table header
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

        // Add canvas images if available
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
                    // Canvas tainted or empty, skip
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
    }
};
