/**
 * NeuroScope - Signal Analysis Engine
 * FFT, Filtering, Band Power, Statistics, Spectrogram
 */

const EEGAnalysis = {

    /**
     * Compute FFT using Cooley-Tukey radix-2 algorithm
     * Returns complex array [re, im, re, im, ...]
     */
    fft(signal) {
        const n = signal.length;
        const N = this.nextPow2(n);

        // Zero-pad to next power of 2
        const re = new Float64Array(N);
        const im = new Float64Array(N);
        for (let i = 0; i < n; i++) re[i] = signal[i];

        this._fftRecursive(re, im, N);
        return { re, im, N };
    },

    /**
     * In-place FFT (Cooley-Tukey iterative)
     */
    _fftRecursive(re, im, N) {
        // Bit reversal
        let j = 0;
        for (let i = 0; i < N; i++) {
            if (j > i) {
                [re[i], re[j]] = [re[j], re[i]];
                [im[i], im[j]] = [im[j], im[i]];
            }
            let m = N >> 1;
            while (m >= 1 && j >= m) {
                j -= m;
                m >>= 1;
            }
            j += m;
        }

        // Butterfly operations
        for (let len = 2; len <= N; len *= 2) {
            const halfLen = len / 2;
            const angle = -2 * Math.PI / len;
            const wRe = Math.cos(angle);
            const wIm = Math.sin(angle);

            for (let i = 0; i < N; i += len) {
                let curRe = 1, curIm = 0;
                for (let k = 0; k < halfLen; k++) {
                    const idx1 = i + k;
                    const idx2 = i + k + halfLen;

                    const tRe = curRe * re[idx2] - curIm * im[idx2];
                    const tIm = curRe * im[idx2] + curIm * re[idx2];

                    re[idx2] = re[idx1] - tRe;
                    im[idx2] = im[idx1] - tIm;
                    re[idx1] += tRe;
                    im[idx1] += tIm;

                    const newRe = curRe * wRe - curIm * wIm;
                    curIm = curRe * wIm + curIm * wRe;
                    curRe = newRe;
                }
            }
        }
    },

    /**
     * Compute Power Spectral Density using Welch method
     */
    welchPSD(signal, sampleRate, windowSize = 256, overlap = 0.5, windowType = 'hanning') {
        const n = signal.length;
        const step = Math.floor(windowSize * (1 - overlap));
        const numSegments = Math.floor((n - windowSize) / step) + 1;

        if (numSegments < 1) {
            return this.directPSD(signal, sampleRate, windowType);
        }

        const N = this.nextPow2(windowSize);
        const window = this.getWindow(windowSize, windowType);

        // Window power normalization
        let windowPower = 0;
        for (let i = 0; i < windowSize; i++) windowPower += window[i] * window[i];
        windowPower /= windowSize;

        const psd = new Float64Array(N / 2 + 1);

        for (let seg = 0; seg < numSegments; seg++) {
            const start = seg * step;
            const segData = new Float64Array(N);

            for (let i = 0; i < windowSize; i++) {
                segData[i] = signal[start + i] * window[i];
            }

            const { re, im } = this.fft(segData);

            for (let i = 0; i <= N / 2; i++) {
                const mag2 = re[i] * re[i] + im[i] * im[i];
                psd[i] += mag2;
            }
        }

        // Normalize
        const freqRes = sampleRate / N;
        for (let i = 0; i <= N / 2; i++) {
            psd[i] = (2 * psd[i]) / (numSegments * sampleRate * windowPower * windowSize);
        }
        psd[0] /= 2;
        if (N / 2 < psd.length) psd[N / 2] /= 2;

        // Build frequency axis
        const freqs = new Float64Array(N / 2 + 1);
        for (let i = 0; i <= N / 2; i++) {
            freqs[i] = i * freqRes;
        }

        return { freqs, psd };
    },

    /**
     * Direct PSD computation (for short signals)
     */
    directPSD(signal, sampleRate, windowType = 'hanning') {
        const n = signal.length;
        const N = this.nextPow2(n);
        const window = this.getWindow(n, windowType);
        const windowed = new Float64Array(N);

        for (let i = 0; i < n; i++) {
            windowed[i] = signal[i] * window[i];
        }

        const { re, im } = this.fft(windowed);

        const psd = new Float64Array(N / 2 + 1);
        const freqs = new Float64Array(N / 2 + 1);
        const freqRes = sampleRate / N;

        for (let i = 0; i <= N / 2; i++) {
            psd[i] = (2 * (re[i] * re[i] + im[i] * im[i])) / (sampleRate * n);
            freqs[i] = i * freqRes;
        }

        return { freqs, psd };
    },

    /**
     * Compute band powers from PSD
     */
    computeBandPowers(freqs, psd) {
        const bands = {
            delta: { low: 0.5, high: 4, power: 0 },
            theta: { low: 4, high: 8, power: 0 },
            alpha: { low: 8, high: 13, power: 0 },
            beta:  { low: 13, high: 30, power: 0 },
            gamma: { low: 30, high: 100, power: 0 }
        };

        const freqRes = freqs.length > 1 ? freqs[1] - freqs[0] : 1;

        for (let i = 0; i < freqs.length; i++) {
            const f = freqs[i];
            for (const band of Object.values(bands)) {
                if (f >= band.low && f < band.high) {
                    band.power += psd[i] * freqRes;
                }
            }
        }

        return bands;
    },

    /**
     * Compute spectrogram (Short-Time Fourier Transform)
     */
    computeSpectrogram(signal, sampleRate, windowSize = 256, overlap = 0.75, maxFreq = 50) {
        const step = Math.max(1, Math.floor(windowSize * (1 - overlap)));
        const n = signal.length;
        if (!signal || n < windowSize) {
            return { spectrogram: [], times: [], freqs: [] };
        }

        const numFrames = Math.max(0, Math.floor((n - windowSize) / step) + 1);
        const N = this.nextPow2(windowSize);
        const window = this.getWindow(windowSize, 'hanning');

        const freqRes = sampleRate / N;
        const maxBin = Math.min(Math.floor(maxFreq / freqRes), N / 2);
        const numFreqBins = maxBin + 1;

        const spectrogram = [];
        const times = [];
        const freqs = [];

        for (let i = 0; i < numFreqBins; i++) {
            freqs.push(i * freqRes);
        }

        for (let frame = 0; frame < numFrames; frame++) {
            const start = frame * step;
            times.push(start / sampleRate);

            const segData = new Float64Array(N);
            for (let i = 0; i < windowSize; i++) {
                segData[i] = signal[start + i] * window[i];
            }

            const { re, im } = this.fft(segData);
            const power = new Float64Array(numFreqBins);

            for (let i = 0; i < numFreqBins; i++) {
                power[i] = 10 * Math.log10((re[i] * re[i] + im[i] * im[i]) / N + 1e-20);
            }

            spectrogram.push(power);
        }

        return { spectrogram, times, freqs };
    },

    /**
     * Apply Butterworth IIR filter
     */
    butterworth(signal, sampleRate, lowCut, highCut, order = 4, type = 'bandpass') {
        let filtered = new Float64Array(signal);

        const nyquist = sampleRate / 2;
        const clampFreq = (f) => {
            if (!isFinite(f)) return Math.min(1, nyquist * 0.25);
            return Math.min(Math.max(f, 1e-6), nyquist * 0.999);
        };

        let low = clampFreq(lowCut);
        let high = clampFreq(highCut);
        if (type === 'bandpass' && low > high) {
            const tmp = low;
            low = high;
            high = tmp;
        }

        if (type === 'bandpass') {
            filtered = this._biquadCascade(filtered, sampleRate, low, 'highpass', order);
            filtered = this._biquadCascade(filtered, sampleRate, high, 'lowpass', order);
        } else if (type === 'highpass') {
            filtered = this._biquadCascade(filtered, sampleRate, low, 'highpass', order);
        } else if (type === 'lowpass') {
            filtered = this._biquadCascade(filtered, sampleRate, high, 'lowpass', order);
        } else if (type === 'notch') {
            filtered = this._notchFilter(filtered, sampleRate, low, 2);
        }

        return filtered;
    },

    /**
     * Apply cascaded second-order sections (biquad)
     */
    _biquadCascade(signal, sampleRate, freq, type, order) {
        let data = new Float64Array(signal);
        const numSections = Math.ceil(order / 2);

        for (let section = 0; section < numSections; section++) {
            const Q = 1 / (2 * Math.cos(Math.PI * (2 * section + 1) / (2 * order)));
            const coeffs = this._biquadCoeffs(sampleRate, freq, type, Q);

            // Forward pass
            data = this._applyBiquad(data, coeffs);
            // Backward pass (zero-phase)
            data = data.reverse();
            data = this._applyBiquad(data, coeffs);
            data = data.reverse();
        }

        return data;
    },

    /**
     * Compute biquad filter coefficients
     */
    _biquadCoeffs(sampleRate, freq, type, Q) {
        const w0 = 2 * Math.PI * freq / sampleRate;
        const alpha = Math.sin(w0) / (2 * Q);
        const cosW0 = Math.cos(w0);

        let b0, b1, b2, a0, a1, a2;

        if (type === 'lowpass') {
            b0 = (1 - cosW0) / 2;
            b1 = 1 - cosW0;
            b2 = (1 - cosW0) / 2;
            a0 = 1 + alpha;
            a1 = -2 * cosW0;
            a2 = 1 - alpha;
        } else { // highpass
            b0 = (1 + cosW0) / 2;
            b1 = -(1 + cosW0);
            b2 = (1 + cosW0) / 2;
            a0 = 1 + alpha;
            a1 = -2 * cosW0;
            a2 = 1 - alpha;
        }

        return {
            b0: b0 / a0, b1: b1 / a0, b2: b2 / a0,
            a1: a1 / a0, a2: a2 / a0
        };
    },

    /**
     * Apply biquad filter to signal
     */
    _applyBiquad(signal, c) {
        const n = signal.length;
        const out = new Float64Array(n);
        let x1 = 0, x2 = 0, y1 = 0, y2 = 0;

        for (let i = 0; i < n; i++) {
            const x0 = signal[i];
            out[i] = c.b0 * x0 + c.b1 * x1 + c.b2 * x2 - c.a1 * y1 - c.a2 * y2;
            x2 = x1; x1 = x0;
            y2 = y1; y1 = out[i];
        }

        return out;
    },

    /**
     * Notch filter at specific frequency
     */
    _notchFilter(signal, sampleRate, freq, bandwidth) {
        const w0 = 2 * Math.PI * freq / sampleRate;
        const Q = freq / bandwidth;
        const alpha = Math.sin(w0) / (2 * Q);
        const cosW0 = Math.cos(w0);

        const a0 = 1 + alpha;
        const coeffs = {
            b0: 1 / a0,
            b1: -2 * cosW0 / a0,
            b2: 1 / a0,
            a1: -2 * cosW0 / a0,
            a2: (1 - alpha) / a0
        };

        // Forward-backward for zero phase
        let data = this._applyBiquad(signal, coeffs);
        data = data.reverse();
        data = this._applyBiquad(data, coeffs);
        data = data.reverse();

        return data;
    },

    /**
     * Compute the frequency response of a filter configuration
     * Returns magnitude in dB at each frequency bin
     */
    computeFrequencyResponse(sampleRate, lowCut, highCut, order, type) {
        const nyquist = sampleRate / 2;
        const numPoints = 512;
        const freqs = new Float64Array(numPoints);
        const magnitude = new Float64Array(numPoints);

        for (let i = 0; i < numPoints; i++) {
            // Log-spaced from 0.1 Hz to Nyquist
            const frac = i / (numPoints - 1);
            freqs[i] = 0.1 * Math.pow(nyquist / 0.1, frac);

            const w = 2 * Math.PI * freqs[i] / sampleRate;
            let totalMag = 1;

            if (type === 'bandpass') {
                totalMag *= this._cascadeResponse(w, sampleRate, lowCut, 'highpass', order);
                totalMag *= this._cascadeResponse(w, sampleRate, highCut, 'lowpass', order);
            } else if (type === 'highpass') {
                totalMag *= this._cascadeResponse(w, sampleRate, lowCut, 'highpass', order);
            } else if (type === 'lowpass') {
                totalMag *= this._cascadeResponse(w, sampleRate, highCut, 'lowpass', order);
            } else if (type === 'notch') {
                totalMag *= this._notchResponse(w, sampleRate, lowCut, 2);
            }

            // Zero-phase doubles the dB response
            magnitude[i] = 20 * Math.log10(Math.max(totalMag * totalMag, 1e-10));
        }

        return { freqs, magnitude };
    },

    /**
     * Compute cascade biquad magnitude response at a given angular frequency
     */
    _cascadeResponse(w, sampleRate, freq, type, order) {
        const numSections = Math.ceil(order / 2);
        let totalMag = 1;

        for (let section = 0; section < numSections; section++) {
            const Q = 1 / (2 * Math.cos(Math.PI * (2 * section + 1) / (2 * order)));
            const coeffs = this._biquadCoeffs(sampleRate, freq, type, Q);

            // H(e^jw) = (b0 + b1*e^-jw + b2*e^-2jw) / (1 + a1*e^-jw + a2*e^-2jw)
            const cosw = Math.cos(w);
            const sinw = Math.sin(w);
            const cos2w = Math.cos(2 * w);
            const sin2w = Math.sin(2 * w);

            const numRe = coeffs.b0 + coeffs.b1 * cosw + coeffs.b2 * cos2w;
            const numIm = -(coeffs.b1 * sinw + coeffs.b2 * sin2w);
            const denRe = 1 + coeffs.a1 * cosw + coeffs.a2 * cos2w;
            const denIm = -(coeffs.a1 * sinw + coeffs.a2 * sin2w);

            const numMag = Math.sqrt(numRe * numRe + numIm * numIm);
            const denMag = Math.sqrt(denRe * denRe + denIm * denIm);

            totalMag *= denMag > 0 ? numMag / denMag : 0;
        }

        return totalMag;
    },

    /**
     * Compute notch filter magnitude response at a given angular frequency
     */
    _notchResponse(w, sampleRate, freq, bandwidth) {
        const w0 = 2 * Math.PI * freq / sampleRate;
        const Q = freq / bandwidth;
        const alpha = Math.sin(w0) / (2 * Q);
        const cosW0 = Math.cos(w0);
        const a0 = 1 + alpha;

        const b0 = 1 / a0;
        const b1 = -2 * cosW0 / a0;
        const b2 = 1 / a0;
        const a1 = -2 * cosW0 / a0;
        const a2 = (1 - alpha) / a0;

        const cosw = Math.cos(w);
        const sinw = Math.sin(w);
        const cos2w = Math.cos(2 * w);
        const sin2w = Math.sin(2 * w);

        const numRe = b0 + b1 * cosw + b2 * cos2w;
        const numIm = -(b1 * sinw + b2 * sin2w);
        const denRe = 1 + a1 * cosw + a2 * cos2w;
        const denIm = -(a1 * sinw + a2 * sin2w);

        const numMag = Math.sqrt(numRe * numRe + numIm * numIm);
        const denMag = Math.sqrt(denRe * denRe + denIm * denIm);

        return denMag > 0 ? numMag / denMag : 0;
    },

    /**
     * Compute comprehensive statistics for a channel
     */
    computeStatistics(signal) {
        const n = signal.length;
        if (n === 0) return {};

        let sum = 0, sumSq = 0;
        let min = Infinity, max = -Infinity;
        let zeroCrossings = 0;

        for (let i = 0; i < n; i++) {
            sum += signal[i];
            sumSq += signal[i] * signal[i];
            if (signal[i] < min) min = signal[i];
            if (signal[i] > max) max = signal[i];
            if (i > 0 && ((signal[i] >= 0 && signal[i - 1] < 0) || (signal[i] < 0 && signal[i - 1] >= 0))) {
                zeroCrossings++;
            }
        }

        const mean = sum / n;
        const variance = sumSq / n - mean * mean;
        const std = Math.sqrt(Math.max(0, variance));
        const rms = Math.sqrt(sumSq / n);

        // Skewness and kurtosis
        let m3 = 0, m4 = 0;
        for (let i = 0; i < n; i++) {
            const d = signal[i] - mean;
            m3 += d * d * d;
            m4 += d * d * d * d;
        }
        const skewness = std > 0 ? (m3 / n) / (std * std * std) : 0;
        const kurtosis = std > 0 ? (m4 / n) / (std * std * std * std) - 3 : 0;

        return {
            mean,
            std,
            variance,
            rms,
            min,
            max,
            peakToPeak: max - min,
            skewness,
            kurtosis,
            zeroCrossings
        };
    },

    /**
     * Compute Hjorth parameters (Activity, Mobility, Complexity)
     */
    hjorthParameters(signal) {
        const n = signal.length;
        if (n < 3) return { activity: 0, mobility: 0, complexity: 0 };

        // First derivative
        const d1 = new Float64Array(n - 1);
        for (let i = 0; i < n - 1; i++) d1[i] = signal[i + 1] - signal[i];

        // Second derivative
        const d2 = new Float64Array(n - 2);
        for (let i = 0; i < n - 2; i++) d2[i] = d1[i + 1] - d1[i];

        const var0 = this._variance(signal);
        const var1 = this._variance(d1);
        const var2 = this._variance(d2);

        const activity = var0;
        const mobility = var1 > 0 ? Math.sqrt(var1 / var0) : 0;
        const complexity = var1 > 0 ? Math.sqrt(var2 / var1) / mobility : 0;

        return { activity, mobility, complexity };
    },

    _variance(arr) {
        let sum = 0, sumSq = 0;
        for (let i = 0; i < arr.length; i++) {
            sum += arr[i];
            sumSq += arr[i] * arr[i];
        }
        const mean = sum / arr.length;
        return sumSq / arr.length - mean * mean;
    },

    /**
     * Compute coherence between two channels
     */
    coherence(signal1, signal2, sampleRate, windowSize = 256) {
        const psd1 = this.welchPSD(signal1, sampleRate, windowSize);
        const psd2 = this.welchPSD(signal2, sampleRate, windowSize);

        // Cross spectral density
        const n = Math.min(signal1.length, signal2.length);
        const step = Math.floor(windowSize * 0.5);
        const numSegments = Math.floor((n - windowSize) / step) + 1;
        const N = this.nextPow2(windowSize);
        const window = this.getWindow(windowSize, 'hanning');

        const csdRe = new Float64Array(N / 2 + 1);
        const csdIm = new Float64Array(N / 2 + 1);

        for (let seg = 0; seg < numSegments; seg++) {
            const start = seg * step;

            const seg1 = new Float64Array(N);
            const seg2 = new Float64Array(N);

            for (let i = 0; i < windowSize; i++) {
                seg1[i] = signal1[start + i] * window[i];
                seg2[i] = signal2[start + i] * window[i];
            }

            const fft1 = this.fft(seg1);
            const fft2 = this.fft(seg2);

            for (let i = 0; i <= N / 2; i++) {
                // Cross spectrum = conj(FFT1) * FFT2
                csdRe[i] += fft1.re[i] * fft2.re[i] + fft1.im[i] * fft2.im[i];
                csdIm[i] += -fft1.im[i] * fft2.re[i] + fft1.re[i] * fft2.im[i];
            }
        }

        // Magnitude squared coherence
        const coh = new Float64Array(psd1.freqs.length);
        for (let i = 0; i < coh.length; i++) {
            const csdMag2 = csdRe[i] * csdRe[i] + csdIm[i] * csdIm[i];
            const denom = psd1.psd[i] * psd2.psd[i];
            coh[i] = denom > 0 ? csdMag2 / (denom * numSegments * numSegments) : 0;
        }

        return { freqs: psd1.freqs, coherence: coh };
    },

    /**
     * Re-reference signals (average reference montage)
     */
    averageReference(channelData) {
        const numChannels = channelData.length;
        const numSamples = channelData[0].length;
        const result = channelData.map(ch => new Float64Array(ch));

        for (let s = 0; s < numSamples; s++) {
            let avg = 0;
            for (let c = 0; c < numChannels; c++) {
                avg += channelData[c][s];
            }
            avg /= numChannels;
            for (let c = 0; c < numChannels; c++) {
                result[c][s] -= avg;
            }
        }

        return result;
    },

    /**
     * Bipolar montage
     */
    bipolarMontage(channelData, channelLabels) {
        const pairs = [];
        const newData = [];
        const newLabels = [];

        // Create logical bipolar pairs based on standard longitudinal montage
        const bipolarChains = [
            ['Fp1', 'F3'], ['F3', 'C3'], ['C3', 'P3'], ['P3', 'O1'],
            ['Fp2', 'F4'], ['F4', 'C4'], ['C4', 'P4'], ['P4', 'O2'],
            ['Fp1', 'F7'], ['F7', 'T3'], ['T3', 'T5'], ['T5', 'O1'],
            ['Fp2', 'F8'], ['F8', 'T4'], ['T4', 'T6'], ['T6', 'O2'],
            ['Fz', 'Cz'], ['Cz', 'Pz']
        ];

        const labelMap = {};
        channelLabels.forEach((label, idx) => {
            labelMap[label.toUpperCase()] = idx;
        });

        for (const [ch1, ch2] of bipolarChains) {
            const idx1 = labelMap[ch1.toUpperCase()];
            const idx2 = labelMap[ch2.toUpperCase()];
            if (idx1 !== undefined && idx2 !== undefined) {
                const diff = new Float64Array(channelData[idx1].length);
                for (let i = 0; i < diff.length; i++) {
                    diff[i] = channelData[idx1][i] - channelData[idx2][i];
                }
                newData.push(diff);
                newLabels.push(`${ch1}-${ch2}`);
            }
        }

        // Fallback if standard channels are missing: sequential pairs
        if (newData.length === 0) {
            for (let i = 0; i < channelData.length - 1; i++) {
                const diff = new Float64Array(channelData[i].length);
                for (let j = 0; j < diff.length; j++) {
                    diff[j] = channelData[i][j] - channelData[i + 1][j];
                }
                newData.push(diff);
                newLabels.push(`${channelLabels[i]}-${channelLabels[i + 1]}`);
            }
        }

        return { channelData: newData, channelLabels: newLabels };
    },

    // ========== Utility Functions ==========

    nextPow2(n) {
        let p = 1;
        while (p < n) p *= 2;
        return p;
    },

    getWindow(size, type) {
        const w = new Float64Array(size);
        switch (type) {
            case 'hanning':
                for (let i = 0; i < size; i++) w[i] = 0.5 * (1 - Math.cos(2 * Math.PI * i / (size - 1)));
                break;
            case 'hamming':
                for (let i = 0; i < size; i++) w[i] = 0.54 - 0.46 * Math.cos(2 * Math.PI * i / (size - 1));
                break;
            case 'blackman':
                for (let i = 0; i < size; i++) {
                    w[i] = 0.42 - 0.5 * Math.cos(2 * Math.PI * i / (size - 1)) + 0.08 * Math.cos(4 * Math.PI * i / (size - 1));
                }
                break;
            case 'rectangular':
            default:
                w.fill(1);
                break;
        }
        return w;
    },

    /**
     * Downsample signal for display
     */
    downsample(signal, factor) {
        if (factor <= 1) return signal;
        const n = Math.ceil(signal.length / factor);
        const out = new Float64Array(n);
        for (let i = 0; i < n; i++) {
            const start = Math.floor(i * factor);
            const end = Math.min(Math.floor((i + 1) * factor), signal.length);
            let min = Infinity, max = -Infinity;
            for (let j = start; j < end; j++) {
                if (signal[j] < min) min = signal[j];
                if (signal[j] > max) max = signal[j];
            }
            // Use min/max alternation to preserve peaks
            out[i] = i % 2 === 0 ? max : min;
        }
        return out;
    }
};
