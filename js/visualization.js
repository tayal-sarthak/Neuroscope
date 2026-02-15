/**
 * NeuroScope - Visualization Module
 * Signal viewer, spectrum charts, topographic maps, spectrogram
 */

const EEGVisualization = {

    // Channel colors for multi-channel display
    channelColors: [
        '#4A90D9', '#E74C3C', '#2ECC71', '#F39C12', '#9B59B6',
        '#1ABC9C', '#E67E22', '#3498DB', '#E91E63', '#00BCD4',
        '#8BC34A', '#FF5722', '#607D8B', '#795548', '#CDDC39',
        '#FF9800', '#673AB7', '#009688', '#F44336'
    ],

    bandColors: {
        delta: '#8B5CF6',
        theta: '#06B6D4',
        alpha: '#10B981',
        beta: '#F59E0B',
        gamma: '#EF4444'
    },

    /**
     * Draw multi-channel EEG signals on canvas
     */
    drawSignals(canvas, eegData, options = {}) {
        const ctx = canvas.getContext('2d');
        const dpr = window.devicePixelRatio || 1;
        const rect = canvas.parentElement.getBoundingClientRect();

        canvas.width = rect.width * dpr;
        canvas.height = (options.height || 500) * dpr;
        canvas.style.width = rect.width + 'px';
        canvas.style.height = (options.height || 500) + 'px';
        ctx.scale(dpr, dpr);

        const width = rect.width;
        const height = options.height || 500;

        const {
            channelData, channelLabels, sampleRate,
            selectedChannels = null,
            amplitudeScale = 1,
            timeWindow = 10,
            timeOffset = 0,
            montage = 'monopolar'
        } = { ...eegData, ...options };

        // Determine which channels to draw
        const channels = selectedChannels || Array.from({ length: channelLabels.length }, (_, i) => i);
        const numChannels = channels.length;
        if (numChannels === 0) return;

        // Clear
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, width, height);

        const leftMargin = 70;
        const rightMargin = 20;
        const topMargin = 10;
        const bottomMargin = 30;

        const plotWidth = width - leftMargin - rightMargin;
        const plotHeight = height - topMargin - bottomMargin;
        const channelHeight = plotHeight / numChannels;

        // Time range
        const startSample = Math.floor(timeOffset * sampleRate);
        const samplesInView = Math.floor(timeWindow * sampleRate);
        const endSample = Math.min(startSample + samplesInView, channelData[0].length);

        // Downsample for display if needed
        const maxPoints = plotWidth * 2;
        const decimation = Math.max(1, Math.floor((endSample - startSample) / maxPoints));

        // Draw grid lines
        ctx.strokeStyle = '#F1F5F9';
        ctx.lineWidth = 1;

        // Horizontal grid (between channels)
        for (let i = 0; i <= numChannels; i++) {
            const y = topMargin + i * channelHeight;
            ctx.beginPath();
            ctx.moveTo(leftMargin, y);
            ctx.lineTo(width - rightMargin, y);
            ctx.stroke();
        }

        // Time grid
        const timeGridStep = this._niceTimeStep(timeWindow);
        const startTime = Math.ceil(timeOffset / timeGridStep) * timeGridStep;

        ctx.strokeStyle = '#F1F5F9';
        ctx.fillStyle = '#94A3B8';
        ctx.font = '10px Inter, sans-serif';
        ctx.textAlign = 'center';

        for (let t = startTime; t <= timeOffset + timeWindow; t += timeGridStep) {
            const x = leftMargin + ((t - timeOffset) / timeWindow) * plotWidth;
            ctx.beginPath();
            ctx.moveTo(x, topMargin);
            ctx.lineTo(x, height - bottomMargin);
            ctx.stroke();

            ctx.fillText(t.toFixed(1) + 's', x, height - bottomMargin + 14);
        }

        // Draw signals
        for (let ch = 0; ch < numChannels; ch++) {
            const chIdx = channels[ch];
            const data = channelData[chIdx];
            const centerY = topMargin + (ch + 0.5) * channelHeight;
            const color = this.channelColors[chIdx % this.channelColors.length];

            // Channel label
            ctx.fillStyle = '#64748B';
            ctx.font = '11px Inter, sans-serif';
            ctx.textAlign = 'right';
            ctx.fillText(channelLabels[chIdx], leftMargin - 8, centerY + 4);

            // Draw signal trace
            ctx.strokeStyle = color;
            ctx.lineWidth = 1;
            ctx.beginPath();

            let first = true;
            for (let s = startSample; s < endSample; s += decimation) {
                const x = leftMargin + ((s - startSample) / samplesInView) * plotWidth;
                const y = centerY - (data[s] * amplitudeScale * channelHeight * 0.003);
                const clampedY = Math.max(topMargin + ch * channelHeight + 2, Math.min(topMargin + (ch + 1) * channelHeight - 2, y));

                if (first) {
                    ctx.moveTo(x, clampedY);
                    first = false;
                } else {
                    ctx.lineTo(x, clampedY);
                }
            }
            ctx.stroke();
        }

        // Draw borders
        ctx.strokeStyle = '#E2E8F0';
        ctx.lineWidth = 1;
        ctx.strokeRect(leftMargin, topMargin, plotWidth, plotHeight);

        // Scale bar
        const scaleBarHeight = 50;
        const scaleBarAmplitude = (scaleBarHeight / (channelHeight * 0.003 * amplitudeScale));
        ctx.strokeStyle = '#94A3B8';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(width - rightMargin + 5, topMargin + 10);
        ctx.lineTo(width - rightMargin + 5, topMargin + 10 + scaleBarHeight);
        ctx.stroke();

        ctx.fillStyle = '#94A3B8';
        ctx.font = '9px Inter, sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText(scaleBarAmplitude.toFixed(0) + 'uV', width - rightMargin + 8, topMargin + 10 + scaleBarHeight / 2 + 3);

        // Update labels container
        this._updateChannelLabels(channels, channelLabels, channelHeight, topMargin);
    },

    _updateChannelLabels(channels, labels, channelHeight, topMargin) {
        const container = document.getElementById('viewer-labels');
        if (!container) return;
        container.innerHTML = '';
        // Labels are drawn on canvas, so container stays empty
    },

    _niceTimeStep(timeWindow) {
        const approxSteps = 8;
        const rough = timeWindow / approxSteps;
        const mag = Math.pow(10, Math.floor(Math.log10(rough)));
        const normalized = rough / mag;

        let step;
        if (normalized < 1.5) step = 1;
        else if (normalized < 3.5) step = 2;
        else if (normalized < 7.5) step = 5;
        else step = 10;

        return step * mag;
    },

    /**
     * Draw filtered vs original signal comparison
     */
    drawFilterComparison(canvas, originalData, filteredData, channelLabel, sampleRate, options = {}) {
        const ctx = canvas.getContext('2d');
        const dpr = window.devicePixelRatio || 1;
        const rect = canvas.parentElement.getBoundingClientRect();

        canvas.width = rect.width * dpr;
        canvas.height = (options.height || 400) * dpr;
        canvas.style.width = rect.width + 'px';
        canvas.style.height = (options.height || 400) + 'px';
        ctx.scale(dpr, dpr);

        const width = rect.width;
        const height = options.height || 400;
        const margin = { left: 60, right: 20, top: 30, bottom: 40 };

        // Clear
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, width, height);

        const plotW = width - margin.left - margin.right;
        const plotH = height - margin.top - margin.bottom;
        const halfH = plotH / 2;

        // Show first 5 seconds or less
        const showSamples = Math.min(originalData.length, sampleRate * 5);
        const decimation = Math.max(1, Math.floor(showSamples / (plotW * 2)));

        // Find amplitude range
        let maxAmp = 0;
        for (let i = 0; i < showSamples; i++) {
            maxAmp = Math.max(maxAmp, Math.abs(originalData[i]), Math.abs(filteredData[i]));
        }
        maxAmp = maxAmp || 1;

        // Title
        ctx.fillStyle = '#64748B';
        ctx.font = '11px Inter, sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText(`Channel: ${channelLabel}`, margin.left, 18);

        // Legend
        ctx.fillStyle = '#94A3B8';
        ctx.fillRect(width - 180, 8, 10, 10);
        ctx.fillStyle = '#64748B';
        ctx.fillText('Original', width - 165, 17);

        ctx.fillStyle = '#4A90D9';
        ctx.fillRect(width - 90, 8, 10, 10);
        ctx.fillStyle = '#64748B';
        ctx.fillText('Filtered', width - 75, 17);

        // Draw original (gray)
        ctx.strokeStyle = 'rgba(148, 163, 184, 0.5)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (let s = 0; s < showSamples; s += decimation) {
            const x = margin.left + (s / showSamples) * plotW;
            const y = margin.top + halfH - (originalData[s] / maxAmp) * halfH * 0.8;
            if (s === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        }
        ctx.stroke();

        // Draw filtered (blue)
        ctx.strokeStyle = '#4A90D9';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        for (let s = 0; s < showSamples; s += decimation) {
            const x = margin.left + (s / showSamples) * plotW;
            const y = margin.top + halfH - (filteredData[s] / maxAmp) * halfH * 0.8;
            if (s === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        }
        ctx.stroke();

        // Zero line
        ctx.strokeStyle = '#E2E8F0';
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(margin.left, margin.top + halfH);
        ctx.lineTo(width - margin.right, margin.top + halfH);
        ctx.stroke();
        ctx.setLineDash([]);

        // Axes
        ctx.strokeStyle = '#E2E8F0';
        ctx.lineWidth = 1;
        ctx.strokeRect(margin.left, margin.top, plotW, plotH);

        // Time labels
        ctx.fillStyle = '#94A3B8';
        ctx.font = '10px Inter, sans-serif';
        ctx.textAlign = 'center';
        const timeLen = showSamples / sampleRate;
        for (let i = 0; i <= 5; i++) {
            const t = (i / 5) * timeLen;
            const x = margin.left + (i / 5) * plotW;
            ctx.fillText(t.toFixed(1) + 's', x, height - margin.bottom + 16);
        }

        // Amplitude labels
        ctx.textAlign = 'right';
        ctx.fillText('+' + maxAmp.toFixed(0), margin.left - 6, margin.top + 12);
        ctx.fillText('0', margin.left - 6, margin.top + halfH + 4);
        ctx.fillText('-' + maxAmp.toFixed(0), margin.left - 6, height - margin.bottom - 2);
    },

    /**
     * Draw filter frequency response (magnitude vs frequency)
     */
    drawFrequencyResponse(canvas, freqs, magnitude, options = {}) {
        const ctx = canvas.getContext('2d');
        const dpr = window.devicePixelRatio || 1;
        const rect = canvas.parentElement.getBoundingClientRect();

        const width = rect.width;
        const height = options.height || 320;

        canvas.width = width * dpr;
        canvas.height = height * dpr;
        canvas.style.width = width + 'px';
        canvas.style.height = height + 'px';
        ctx.scale(dpr, dpr);

        const margin = { left: 55, right: 20, top: 20, bottom: 45 };
        const plotW = width - margin.left - margin.right;
        const plotH = height - margin.top - margin.bottom;

        // Clear
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, width, height);

        // Find freq range for x-axis (log scale)
        const fMin = freqs[0];
        const fMax = freqs[freqs.length - 1];
        const logMin = Math.log10(Math.max(fMin, 0.1));
        const logMax = Math.log10(fMax);

        // Y-axis: dB range, typically -80 to 5 dB
        const dbMin = -80;
        const dbMax = 5;

        // Draw grid
        ctx.strokeStyle = '#F1F5F9';
        ctx.lineWidth = 1;

        // Horizontal grid lines (dB)
        ctx.fillStyle = '#94A3B8';
        ctx.font = '9px Inter, sans-serif';
        ctx.textAlign = 'right';
        for (let db = dbMin; db <= dbMax; db += 10) {
            const yy = margin.top + plotH - ((db - dbMin) / (dbMax - dbMin)) * plotH;
            ctx.beginPath();
            ctx.moveTo(margin.left, yy);
            ctx.lineTo(margin.left + plotW, yy);
            ctx.stroke();
            ctx.fillText(db + ' dB', margin.left - 5, yy + 3);
        }

        // Vertical grid lines (frequency, log scale)
        ctx.textAlign = 'center';
        const freqTicks = [0.1, 0.5, 1, 2, 5, 10, 20, 50, 100, 200, 500];
        for (const ft of freqTicks) {
            if (ft < fMin || ft > fMax) continue;
            const xx = margin.left + ((Math.log10(ft) - logMin) / (logMax - logMin)) * plotW;
            ctx.beginPath();
            ctx.moveTo(xx, margin.top);
            ctx.lineTo(xx, margin.top + plotH);
            ctx.stroke();
            ctx.fillText(ft >= 1 ? ft.toFixed(0) : ft.toFixed(1), xx, height - margin.bottom + 14);
        }

        // X-axis label
        ctx.fillStyle = '#64748B';
        ctx.font = '10px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('Frequency (Hz)', margin.left + plotW / 2, height - 5);

        // Y-axis label
        ctx.save();
        ctx.translate(12, margin.top + plotH / 2);
        ctx.rotate(-Math.PI / 2);
        ctx.fillText('Magnitude (dB)', 0, 0);
        ctx.restore();

        // Draw -3 dB reference line
        const y3db = margin.top + plotH - ((-3 - dbMin) / (dbMax - dbMin)) * plotH;
        ctx.strokeStyle = '#F59E0B';
        ctx.lineWidth = 1;
        ctx.setLineDash([6, 4]);
        ctx.beginPath();
        ctx.moveTo(margin.left, y3db);
        ctx.lineTo(margin.left + plotW, y3db);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = '#F59E0B';
        ctx.font = '9px Inter, sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText('-3 dB', margin.left + plotW + 2, y3db + 3);

        // Draw pass-band shading
        if (options.filterType && options.params) {
            ctx.fillStyle = 'rgba(74, 144, 217, 0.06)';
            const p = options.params;
            let shadeLeft = margin.left;
            let shadeRight = margin.left + plotW;

            if (options.filterType === 'bandpass') {
                shadeLeft = margin.left + ((Math.log10(Math.max(p.low, fMin)) - logMin) / (logMax - logMin)) * plotW;
                shadeRight = margin.left + ((Math.log10(Math.min(p.high, fMax)) - logMin) / (logMax - logMin)) * plotW;
            } else if (options.filterType === 'highpass') {
                shadeLeft = margin.left + ((Math.log10(Math.max(p.low, fMin)) - logMin) / (logMax - logMin)) * plotW;
            } else if (options.filterType === 'lowpass') {
                shadeRight = margin.left + ((Math.log10(Math.min(p.high, fMax)) - logMin) / (logMax - logMin)) * plotW;
            }

            ctx.fillRect(shadeLeft, margin.top, shadeRight - shadeLeft, plotH);
        }

        // Draw magnitude response curve
        ctx.strokeStyle = '#4A90D9';
        ctx.lineWidth = 2;
        ctx.beginPath();
        let first = true;
        for (let i = 0; i < freqs.length; i++) {
            const f = freqs[i];
            if (f <= 0) continue;
            const xx = margin.left + ((Math.log10(f) - logMin) / (logMax - logMin)) * plotW;
            const db = Math.max(dbMin, Math.min(dbMax, magnitude[i]));
            const yy = margin.top + plotH - ((db - dbMin) / (dbMax - dbMin)) * plotH;

            if (first) { ctx.moveTo(xx, yy); first = false; }
            else ctx.lineTo(xx, yy);
        }
        ctx.stroke();

        // Draw 0 dB line
        const y0db = margin.top + plotH - ((0 - dbMin) / (dbMax - dbMin)) * plotH;
        ctx.strokeStyle = '#CBD5E1';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(margin.left, y0db);
        ctx.lineTo(margin.left + plotW, y0db);
        ctx.stroke();

        // Axes border
        ctx.strokeStyle = '#E2E8F0';
        ctx.lineWidth = 1;
        ctx.strokeRect(margin.left, margin.top, plotW, plotH);
    },

    /**
     * Draw spectrogram on canvas
     */
    drawSpectrogram(canvas, spectrogramData, options = {}) {
        const { spectrogram, times, freqs } = spectrogramData;
        const colormap = options.colormap || 'viridis';

        const ctx = canvas.getContext('2d');
        const dpr = window.devicePixelRatio || 1;
        const rect = canvas.parentElement.getBoundingClientRect();

        const canvasW = (rect.width - 80);
        const canvasH = 300;

        canvas.width = canvasW * dpr;
        canvas.height = canvasH * dpr;
        canvas.style.width = canvasW + 'px';
        canvas.style.height = canvasH + 'px';
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

        const margin = { left: 50, right: 10, top: 10, bottom: 30 };
        const plotW = canvasW - margin.left - margin.right;
        const plotH = canvasH - margin.top - margin.bottom;

        // Clear
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, canvasW, canvasH);

        if (!spectrogram || spectrogram.length === 0 || !spectrogram[0] || spectrogram[0].length === 0) {
            // Axes only
            ctx.strokeStyle = '#64748B';
            ctx.lineWidth = 1;
            ctx.strokeRect(margin.left, margin.top, plotW, plotH);
            return;
        }

        // Find value range
        let minVal = Infinity, maxVal = -Infinity;
        for (const frame of spectrogram) {
            for (const val of frame) {
                if (isFinite(val)) {
                    if (val < minVal) minVal = val;
                    if (val > maxVal) maxVal = val;
                }
            }
        }

        const numFrames = spectrogram.length;
        const numBins = spectrogram[0].length;

        // Draw spectrogram pixels on an offscreen canvas.
        // putImageData ignores transforms, so drawImage is used for HiDPI correctness.
        const off = document.createElement('canvas');
        off.width = Math.max(1, Math.ceil(plotW));
        off.height = Math.max(1, Math.ceil(plotH));
        const offCtx = off.getContext('2d');
        const imgData = offCtx.createImageData(off.width, off.height);

        for (let y = 0; y < off.height; y++) {
            const b = Math.min(numBins - 1, Math.max(0, Math.floor((1 - y / Math.max(1, off.height - 1)) * (numBins - 1))));
            for (let x = 0; x < off.width; x++) {
                const f = Math.min(numFrames - 1, Math.max(0, Math.floor((x / Math.max(1, off.width - 1)) * (numFrames - 1))));
                const val = spectrogram[f][b];
                const norm = isFinite(val) ? (val - minVal) / (maxVal - minVal + 1e-10) : 0;
                const color = this._colormap(norm, colormap);
                const idx = (y * off.width + x) * 4;
                imgData.data[idx] = color[0];
                imgData.data[idx + 1] = color[1];
                imgData.data[idx + 2] = color[2];
                imgData.data[idx + 3] = 255;
            }
        }

        offCtx.putImageData(imgData, 0, 0);
        ctx.drawImage(off, margin.left, margin.top, plotW, plotH);

        // Axes
        ctx.strokeStyle = '#64748B';
        ctx.lineWidth = 1;
        ctx.strokeRect(margin.left, margin.top, plotW, plotH);

        // Time labels
        ctx.fillStyle = '#64748B';
        ctx.font = '10px Inter, sans-serif';
        ctx.textAlign = 'center';
        const numTimeLabels = 6;
        for (let i = 0; i <= numTimeLabels; i++) {
            const t = times[0] + (i / numTimeLabels) * (times[times.length - 1] - times[0]);
            const x = margin.left + (i / numTimeLabels) * plotW;
            ctx.fillText(t.toFixed(1) + 's', x, canvasH - margin.bottom + 16);
        }

        // Frequency labels
        ctx.textAlign = 'right';
        const numFreqLabels = 5;
        for (let i = 0; i <= numFreqLabels; i++) {
            const f = (i / numFreqLabels) * freqs[freqs.length - 1];
            const y = margin.top + plotH - (i / numFreqLabels) * plotH;
            ctx.fillText(f.toFixed(0) + ' Hz', margin.left - 4, y + 3);
        }

        // Axis labels
        ctx.save();
        ctx.translate(12, margin.top + plotH / 2);
        ctx.rotate(-Math.PI / 2);
        ctx.textAlign = 'center';
        ctx.fillText('Frequency (Hz)', 0, 0);
        ctx.restore();
    },

    /**
     * Draw colorbar for spectrogram
     */
    drawColorbar(canvas, minVal, maxVal, colormap = 'viridis') {
        const ctx = canvas.getContext('2d');
        const dpr = window.devicePixelRatio || 1;

        canvas.width = 40 * dpr;
        canvas.height = 300 * dpr;
        canvas.style.width = '40px';
        canvas.style.height = '300px';
        ctx.scale(dpr, dpr);

        const barW = 15;
        const barH = 260;
        const barX = 2;
        const barY = 20;

        for (let i = 0; i < barH; i++) {
            const norm = 1 - i / barH;
            const color = this._colormap(norm, colormap);
            ctx.fillStyle = `rgb(${color[0]},${color[1]},${color[2]})`;
            ctx.fillRect(barX, barY + i, barW, 1);
        }

        ctx.strokeStyle = '#64748B';
        ctx.strokeRect(barX, barY, barW, barH);

        ctx.fillStyle = '#64748B';
        ctx.font = '9px Inter, sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText(maxVal.toFixed(0), barX + barW + 3, barY + 8);
        ctx.fillText(((maxVal + minVal) / 2).toFixed(0), barX + barW + 3, barY + barH / 2 + 3);
        ctx.fillText(minVal.toFixed(0), barX + barW + 3, barY + barH);
        ctx.fillText('dB', barX + barW + 3, barY - 6);
    },

    /**
     * Draw topographic head map
     */
    drawTopoMap(canvas, channelLabels, values, options = {}) {
        const ctx = canvas.getContext('2d');
        const dpr = window.devicePixelRatio || 1;
        const size = 500;

        canvas.width = size * dpr;
        canvas.height = size * dpr;
        canvas.style.width = size + 'px';
        canvas.style.height = size + 'px';
        ctx.scale(dpr, dpr);

        const cx = size / 2;
        const cy = size / 2;
        const headRadius = size * 0.38;

        // 10-20 electrode positions (normalized -1 to 1)
        const electrodePositions = {
            'FP1': [-0.31, -0.95], 'FPZ': [0, -0.95], 'FP2': [0.31, -0.95],
            'F7': [-0.81, -0.59], 'F3': [-0.39, -0.59], 'FZ': [0, -0.59],
            'F4': [0.39, -0.59], 'F8': [0.81, -0.59],
            'T3': [-1, 0], 'T7': [-1, 0], 'C3': [-0.5, 0], 'CZ': [0, 0],
            'C4': [0.5, 0], 'T4': [1, 0], 'T8': [1, 0],
            'T5': [-0.81, 0.59], 'P7': [-0.81, 0.59],
            'P3': [-0.39, 0.59], 'PZ': [0, 0.59],
            'P4': [0.39, 0.59], 'T6': [0.81, 0.59], 'P8': [0.81, 0.59],
            'O1': [-0.31, 0.95], 'OZ': [0, 0.95], 'O2': [0.31, 0.95],
            'AF3': [-0.35, -0.77], 'AF4': [0.35, -0.77],
            'FC1': [-0.25, -0.3], 'FC2': [0.25, -0.3],
            'FC5': [-0.66, -0.3], 'FC6': [0.66, -0.3],
            'CP1': [-0.25, 0.3], 'CP2': [0.25, 0.3],
            'CP5': [-0.66, 0.3], 'CP6': [0.66, 0.3],
            'PO3': [-0.25, 0.77], 'PO4': [0.25, 0.77]
        };

        // Map channels to positions
        const electrodes = [];
        for (let i = 0; i < channelLabels.length; i++) {
            const label = channelLabels[i].toUpperCase().replace(/[\s-]/g, '');
            const pos = electrodePositions[label];
            if (pos) {
                electrodes.push({
                    x: cx + pos[0] * headRadius,
                    y: cy + pos[1] * headRadius,
                    value: values[i],
                    label: channelLabels[i]
                });
            }
        }

        if (electrodes.length === 0) {
            // Place electrodes in a circle
            for (let i = 0; i < channelLabels.length; i++) {
                const angle = (i / channelLabels.length) * 2 * Math.PI - Math.PI / 2;
                const r = headRadius * 0.7;
                electrodes.push({
                    x: cx + r * Math.cos(angle),
                    y: cy + r * Math.sin(angle),
                    value: values[i],
                    label: channelLabels[i]
                });
            }
        }

        // Find value range
        let minVal = Infinity, maxVal = -Infinity;
        for (const e of electrodes) {
            if (e.value < minVal) minVal = e.value;
            if (e.value > maxVal) maxVal = e.value;
        }
        const range = maxVal - minVal || 1;

        // Clear and draw white background
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, size, size);

        // Create interpolated map
        const resolution = 2;
        for (let px = cx - headRadius; px <= cx + headRadius; px += resolution) {
            for (let py = cy - headRadius; py <= cy + headRadius; py += resolution) {
                const dx = px - cx;
                const dy = py - cy;
                const dist = Math.sqrt(dx * dx + dy * dy);

                if (dist <= headRadius) {
                    // Inverse distance weighted interpolation
                    let weightSum = 0;
                    let valueSum = 0;

                    for (const e of electrodes) {
                        const d = Math.sqrt((px - e.x) ** 2 + (py - e.y) ** 2);
                        const w = 1 / (d * d + 1);
                        weightSum += w;
                        valueSum += w * e.value;
                    }

                    const interpolated = valueSum / weightSum;
                    const norm = (interpolated - minVal) / range;
                    const color = this._topoColormap(norm);

                    ctx.fillStyle = `rgba(${color[0]},${color[1]},${color[2]},0.85)`;
                    ctx.fillRect(px, py, resolution, resolution);
                }
            }
        }

        // Head outline
        ctx.strokeStyle = '#2C3E50';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(cx, cy, headRadius, 0, 2 * Math.PI);
        ctx.stroke();

        // Nose
        ctx.beginPath();
        ctx.moveTo(cx - 12, cy - headRadius);
        ctx.lineTo(cx, cy - headRadius - 16);
        ctx.lineTo(cx + 12, cy - headRadius);
        ctx.stroke();

        // Ears
        ctx.beginPath();
        ctx.ellipse(cx - headRadius - 6, cy, 6, 16, 0, 0, 2 * Math.PI);
        ctx.stroke();
        ctx.beginPath();
        ctx.ellipse(cx + headRadius + 6, cy, 6, 16, 0, 0, 2 * Math.PI);
        ctx.stroke();

        // Electrode positions
        for (const e of electrodes) {
            ctx.fillStyle = '#1E293B';
            ctx.beginPath();
            ctx.arc(e.x, e.y, 4, 0, 2 * Math.PI);
            ctx.fill();

            ctx.fillStyle = '#1E293B';
            ctx.font = 'bold 9px Inter, sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(e.label, e.x, e.y - 8);
        }
    },

    /**
     * Draw topography colorbar
     */
    drawTopoColorbar(canvas, minVal, maxVal) {
        const ctx = canvas.getContext('2d');
        const dpr = window.devicePixelRatio || 1;

        canvas.width = 40 * dpr;
        canvas.height = 300 * dpr;
        canvas.style.width = '40px';
        canvas.style.height = '300px';
        ctx.scale(dpr, dpr);

        const barW = 15;
        const barH = 260;
        const barX = 2;
        const barY = 20;

        for (let i = 0; i < barH; i++) {
            const norm = 1 - i / barH;
            const color = this._topoColormap(norm);
            ctx.fillStyle = `rgb(${color[0]},${color[1]},${color[2]})`;
            ctx.fillRect(barX, barY + i, barW, 1);
        }

        ctx.strokeStyle = '#64748B';
        ctx.strokeRect(barX, barY, barW, barH);

        ctx.fillStyle = '#64748B';
        ctx.font = '9px Inter, sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText(maxVal.toFixed(1), barX + barW + 3, barY + 8);
        ctx.fillText(((maxVal + minVal) / 2).toFixed(1), barX + barW + 3, barY + barH / 2 + 3);
        ctx.fillText(minVal.toFixed(1), barX + barW + 3, barY + barH);
    },

    // ========== Color Maps ==========

    _colormap(t, name) {
        t = Math.max(0, Math.min(1, t));

        switch (name) {
            case 'viridis':
                return this._viridis(t);
            case 'plasma':
                return this._plasma(t);
            case 'hot':
                return this._hot(t);
            case 'cool':
                return this._cool(t);
            default:
                return this._viridis(t);
        }
    },

    _viridis(t) {
        const r = Math.round(Math.max(0, Math.min(255, (68 + t * (253 - 68)) * (t < 0.5 ? 0.5 + t : 1))));
        const g = Math.round(Math.max(0, Math.min(255, 1 + t * 254 * (0.3 + 0.7 * Math.sin(t * Math.PI)))));
        const b = Math.round(Math.max(0, Math.min(255, 84 + (1 - t) * 171 * (1 - t * 0.5))));

        // Better viridis approximation
        const r2 = Math.round(68 + t * t * 187);
        const g2 = Math.round(2 + t * 220 * Math.sin(t * 1.2 + 0.2));
        const b2 = Math.round(85 + (0.5 - Math.abs(t - 0.5)) * 170);

        return [
            Math.max(0, Math.min(255, r2)),
            Math.max(0, Math.min(255, g2)),
            Math.max(0, Math.min(255, b2))
        ];
    },

    _plasma(t) {
        const r = Math.round(Math.max(0, Math.min(255, 13 + t * 242)));
        const g = Math.round(Math.max(0, Math.min(255, 8 + Math.sin(t * Math.PI) * 200)));
        const b = Math.round(Math.max(0, Math.min(255, 135 + (0.3 - Math.abs(t - 0.3)) * 400)));
        return [r, g, b];
    },

    _hot(t) {
        const r = Math.round(Math.min(255, t * 3 * 255));
        const g = Math.round(Math.max(0, Math.min(255, (t - 0.33) * 3 * 255)));
        const b = Math.round(Math.max(0, Math.min(255, (t - 0.67) * 3 * 255)));
        return [r, g, b];
    },

    _cool(t) {
        return [
            Math.round(t * 255),
            Math.round((1 - t) * 255),
            255
        ];
    },

    _topoColormap(t) {
        // Blue -> Cyan -> Green -> Yellow -> Red
        t = Math.max(0, Math.min(1, t));
        let r, g, b;

        if (t < 0.25) {
            const s = t / 0.25;
            r = 0; g = Math.round(s * 150); b = Math.round(180 + s * 75);
        } else if (t < 0.5) {
            const s = (t - 0.25) / 0.25;
            r = 0; g = Math.round(150 + s * 105); b = Math.round(255 - s * 155);
        } else if (t < 0.75) {
            const s = (t - 0.5) / 0.25;
            r = Math.round(s * 255); g = 255; b = Math.round(100 - s * 100);
        } else {
            const s = (t - 0.75) / 0.25;
            r = 255; g = Math.round(255 - s * 200); b = 0;
        }

        return [r, g, b];
    },

    // ========== Chart.js Wrappers ==========

    _chartInstances: {},

    destroyChart(id) {
        if (this._chartInstances[id]) {
            this._chartInstances[id].destroy();
            delete this._chartInstances[id];
        }
    },

    /**
     * Create a line chart for PSD
     */
    createSpectrumChart(canvasId, freqs, psdDatasets, options = {}) {
        this.destroyChart(canvasId);
        const canvas = document.getElementById(canvasId);
        if (!canvas) return;

        const datasets = psdDatasets.map((ds, i) => ({
            label: ds.label,
            data: Array.from(ds.psd).map((v, idx) => ({ x: freqs[idx], y: options.logScale ? 10 * Math.log10(v + 1e-20) : v })),
            borderColor: this.channelColors[i % this.channelColors.length],
            borderWidth: 1.5,
            pointRadius: 0,
            tension: 0.2,
            fill: false
        }));

        const maxFreq = options.maxFreq || 60;

        this._chartInstances[canvasId] = new Chart(canvas, {
            type: 'line',
            data: { datasets },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                animation: { duration: 500 },
                plugins: {
                    title: {
                        display: true,
                        text: 'Power Spectral Density',
                        font: { family: 'Inter', size: 14, weight: '600' },
                        color: '#1E293B'
                    },
                    legend: {
                        position: 'top',
                        labels: { font: { family: 'Inter', size: 11 }, usePointStyle: true, boxWidth: 6 }
                    }
                },
                scales: {
                    x: {
                        type: 'linear',
                        title: { display: true, text: 'Frequency (Hz)', font: { family: 'Inter' } },
                        min: 0,
                        max: maxFreq,
                        grid: { color: '#F1F5F9' }
                    },
                    y: {
                        title: { display: true, text: options.logScale ? 'Power (dB)' : 'Power (uV^2/Hz)', font: { family: 'Inter' } },
                        grid: { color: '#F1F5F9' }
                    }
                }
            }
        });
    },

    /**
     * Create band power bar chart
     */
    createBandPowerChart(canvasId, channelLabels, bandData, displayType = 'absolute') {
        this.destroyChart(canvasId);
        const canvas = document.getElementById(canvasId);
        if (!canvas) return;

        const bandNames = ['Delta', 'Theta', 'Alpha', 'Beta', 'Gamma'];
        const bandKeys = ['delta', 'theta', 'alpha', 'beta', 'gamma'];
        const colors = [this.bandColors.delta, this.bandColors.theta, this.bandColors.alpha, this.bandColors.beta, this.bandColors.gamma];

        const datasets = bandKeys.map((key, bi) => ({
            label: bandNames[bi],
            data: bandData.map(bd => {
                if (displayType === 'relative') {
                    const total = bandKeys.reduce((s, k) => s + bd[k].power, 0);
                    return total > 0 ? (bd[key].power / total) * 100 : 0;
                }
                return bd[key].power;
            }),
            backgroundColor: colors[bi] + '99',
            borderColor: colors[bi],
            borderWidth: 1
        }));

        this._chartInstances[canvasId] = new Chart(canvas, {
            type: 'bar',
            data: {
                labels: channelLabels,
                datasets
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                animation: { duration: 500 },
                plugins: {
                    title: {
                        display: true,
                        text: displayType === 'relative' ? 'Relative Band Power (%)' : 'Absolute Band Power',
                        font: { family: 'Inter', size: 14, weight: '600' },
                        color: '#1E293B'
                    },
                    legend: {
                        position: 'top',
                        labels: { font: { family: 'Inter', size: 11 }, usePointStyle: true, boxWidth: 8 }
                    }
                },
                scales: {
                    x: { grid: { color: '#F1F5F9' }, ticks: { font: { family: 'Inter', size: 10 } } },
                    y: {
                        title: { display: true, text: displayType === 'relative' ? '%' : 'uV^2', font: { family: 'Inter' } },
                        grid: { color: '#F1F5F9' }
                    }
                }
            }
        });
    },

    /**
     * Create band power pie/doughnut chart
     */
    createBandPieChart(canvasId, bandPowers) {
        this.destroyChart(canvasId);
        const canvas = document.getElementById(canvasId);
        if (!canvas) return;

        const bandNames = ['Delta', 'Theta', 'Alpha', 'Beta', 'Gamma'];
        const bandKeys = ['delta', 'theta', 'alpha', 'beta', 'gamma'];
        const colors = [this.bandColors.delta, this.bandColors.theta, this.bandColors.alpha, this.bandColors.beta, this.bandColors.gamma];

        const total = bandKeys.reduce((s, k) => s + bandPowers[k].power, 0);
        const data = bandKeys.map(k => total > 0 ? (bandPowers[k].power / total * 100) : 0);

        this._chartInstances[canvasId] = new Chart(canvas, {
            type: 'doughnut',
            data: {
                labels: bandNames,
                datasets: [{
                    data,
                    backgroundColor: colors.map(c => c + 'CC'),
                    borderColor: colors,
                    borderWidth: 2
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                animation: { duration: 500 },
                plugins: {
                    title: {
                        display: true,
                        text: 'Average Band Distribution',
                        font: { family: 'Inter', size: 14, weight: '600' },
                        color: '#1E293B'
                    },
                    legend: {
                        position: 'right',
                        labels: { font: { family: 'Inter', size: 12 }, padding: 16 }
                    }
                }
            }
        });
    },

    /**
     * Create stats bar chart (RMS or variance)
     */
    createStatsChart(canvasId, labels, values, title, color = '#4A90D9') {
        this.destroyChart(canvasId);
        const canvas = document.getElementById(canvasId);
        if (!canvas) return;

        this._chartInstances[canvasId] = new Chart(canvas, {
            type: 'bar',
            data: {
                labels,
                datasets: [{
                    label: title,
                    data: values,
                    backgroundColor: color + '66',
                    borderColor: color,
                    borderWidth: 1.5,
                    borderRadius: 4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                animation: { duration: 500 },
                plugins: {
                    title: {
                        display: true,
                        text: title,
                        font: { family: 'Inter', size: 14, weight: '600' },
                        color: '#1E293B'
                    },
                    legend: { display: false }
                },
                scales: {
                    x: { grid: { color: '#F1F5F9' }, ticks: { font: { family: 'Inter', size: 10 } } },
                    y: { grid: { color: '#F1F5F9' }, beginAtZero: true }
                }
            }
        });
    }
};
