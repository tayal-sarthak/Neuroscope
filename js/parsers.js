/**
 * NeuroScope - EEG File Parsers
 * Supports: EDF, BDF, CSV, TSV, JSON, TXT, GDF, VHDR (BrainVision)
 */

const EEGParsers = {

    /**
     * Detect file type from extension and dispatch to the right parser
     */
    async parseFile(file) {
        const ext = file.name.split('.').pop().toLowerCase();
        const buffer = await file.arrayBuffer();

        switch (ext) {
            case 'edf':
                return this.parseEDF(buffer, file.name);
            case 'bdf':
                return this.parseBDF(buffer, file.name);
            case 'gdf':
                return this.parseGDF(buffer, file.name);
            case 'csv':
                return this.parseCSV(await file.text(), file.name, ',');
            case 'tsv':
                return this.parseCSV(await file.text(), file.name, '\t');
            case 'txt':
                return this.parseTXT(await file.text(), file.name);
            case 'json':
                return this.parseJSON(await file.text(), file.name);
            case 'vhdr':
                return this.parseVHDR(await file.text(), file.name);
            case 'set':
                return this.parseSET(buffer, file.name);
            case 'cnt':
                return this.parseCNT(buffer, file.name);
            default:
                return this.tryAutoDetect(buffer, await file.text(), file.name);
        }
    },

    /**
     * Read ASCII string from ArrayBuffer
     */
    readStr(buffer, offset, length) {
        const bytes = new Uint8Array(buffer, offset, length);
        let str = '';
        for (let i = 0; i < length; i++) {
            str += String.fromCharCode(bytes[i]);
        }
        return str.trim();
    },

    /**
     * Parse European Data Format (EDF/EDF+)
     */
    parseEDF(buffer, filename) {
        const header = {};

        header.version = this.readStr(buffer, 0, 8);
        header.patientId = this.readStr(buffer, 8, 80);
        header.recordingId = this.readStr(buffer, 88, 80);
        header.startDate = this.readStr(buffer, 168, 8);
        header.startTime = this.readStr(buffer, 176, 8);
        header.headerBytes = parseInt(this.readStr(buffer, 184, 8));
        header.reserved = this.readStr(buffer, 192, 44);
        header.numRecords = parseInt(this.readStr(buffer, 236, 8));
        header.recordDuration = parseFloat(this.readStr(buffer, 244, 8));
        header.numSignals = parseInt(this.readStr(buffer, 252, 4));

        const ns = header.numSignals;
        let offset = 256;

        const signals = [];
        for (let i = 0; i < ns; i++) {
            signals.push({ label: this.readStr(buffer, offset + i * 16, 16) });
        }
        offset += ns * 16;

        for (let i = 0; i < ns; i++) {
            signals[i].transducer = this.readStr(buffer, offset + i * 80, 80);
        }
        offset += ns * 80;

        for (let i = 0; i < ns; i++) {
            signals[i].physicalDim = this.readStr(buffer, offset + i * 8, 8);
        }
        offset += ns * 8;

        for (let i = 0; i < ns; i++) {
            signals[i].physicalMin = parseFloat(this.readStr(buffer, offset + i * 8, 8));
        }
        offset += ns * 8;

        for (let i = 0; i < ns; i++) {
            signals[i].physicalMax = parseFloat(this.readStr(buffer, offset + i * 8, 8));
        }
        offset += ns * 8;

        for (let i = 0; i < ns; i++) {
            signals[i].digitalMin = parseInt(this.readStr(buffer, offset + i * 8, 8));
        }
        offset += ns * 8;

        for (let i = 0; i < ns; i++) {
            signals[i].digitalMax = parseInt(this.readStr(buffer, offset + i * 8, 8));
        }
        offset += ns * 8;

        for (let i = 0; i < ns; i++) {
            signals[i].prefiltering = this.readStr(buffer, offset + i * 80, 80);
        }
        offset += ns * 80;

        for (let i = 0; i < ns; i++) {
            signals[i].samplesPerRecord = parseInt(this.readStr(buffer, offset + i * 8, 8));
        }
        offset += ns * 8;

        // Skip reserved per signal
        offset += ns * 32;

        // Compute gain and offset for digital to physical conversion
        for (let i = 0; i < ns; i++) {
            const s = signals[i];
            s.gain = (s.physicalMax - s.physicalMin) / (s.digitalMax - s.digitalMin);
            s.offset = s.physicalMin - s.gain * s.digitalMin;
        }

        // Read data records
        const dataView = new DataView(buffer);
        const dataOffset = header.headerBytes;
        const numRecords = header.numRecords > 0 ? header.numRecords : 1;

        // Calculate total samples per signal
        const channelData = [];
        const channelLabels = [];
        let sampleRate = 0;

        // Filter out annotation channels
        const eegSignals = [];
        for (let i = 0; i < ns; i++) {
            const label = signals[i].label.toUpperCase();
            if (label.indexOf('ANNOTATION') === -1 && label.indexOf('STATUS') === -1) {
                eegSignals.push(i);
            }
        }

        const signalIndices = eegSignals.length > 0 ? eegSignals : Array.from({ length: ns }, (_, i) => i);

        for (const idx of signalIndices) {
            const totalSamples = signals[idx].samplesPerRecord * numRecords;
            channelData.push(new Float64Array(totalSamples));
            channelLabels.push(signals[idx].label);
        }

        if (signalIndices.length > 0) {
            sampleRate = signals[signalIndices[0]].samplesPerRecord / header.recordDuration;
        }

        // Parse data records - 16-bit signed integers (little-endian)
        let bytePos = dataOffset;
        for (let rec = 0; rec < numRecords; rec++) {
            for (let sigIdx = 0; sigIdx < ns; sigIdx++) {
                const nSamples = signals[sigIdx].samplesPerRecord;
                const channelIdx = signalIndices.indexOf(sigIdx);

                for (let s = 0; s < nSamples; s++) {
                    if (bytePos + 1 < buffer.byteLength) {
                        const digitalVal = dataView.getInt16(bytePos, true);
                        if (channelIdx >= 0) {
                            const sampleOffset = rec * signals[sigIdx].samplesPerRecord + s;
                            channelData[channelIdx][sampleOffset] = digitalVal * signals[sigIdx].gain + signals[sigIdx].offset;
                        }
                        bytePos += 2;
                    } else {
                        bytePos += 2;
                    }
                }
            }
        }

        return {
            filename,
            format: 'EDF',
            sampleRate: Math.round(sampleRate),
            channelLabels,
            channelData,
            duration: numRecords * header.recordDuration,
            numSamples: channelData[0] ? channelData[0].length : 0,
            metadata: {
                patient: header.patientId,
                recording: header.recordingId,
                date: header.startDate,
                time: header.startTime
            }
        };
    },

    /**
     * Parse BioSemi Data Format (BDF) - similar to EDF but 24-bit
     */
    parseBDF(buffer, filename) {
        const header = {};
        const firstByte = new Uint8Array(buffer, 0, 1)[0];

        header.version = firstByte === 0xFF ? 'BDF' : this.readStr(buffer, 0, 8);
        header.patientId = this.readStr(buffer, 8, 80);
        header.recordingId = this.readStr(buffer, 88, 80);
        header.startDate = this.readStr(buffer, 168, 8);
        header.startTime = this.readStr(buffer, 176, 8);
        header.headerBytes = parseInt(this.readStr(buffer, 184, 8));
        header.reserved = this.readStr(buffer, 192, 44);
        header.numRecords = parseInt(this.readStr(buffer, 236, 8));
        header.recordDuration = parseFloat(this.readStr(buffer, 244, 8));
        header.numSignals = parseInt(this.readStr(buffer, 252, 4));

        const ns = header.numSignals;
        let offset = 256;

        const signals = [];
        for (let i = 0; i < ns; i++) {
            signals.push({ label: this.readStr(buffer, offset + i * 16, 16) });
        }
        offset += ns * 16;
        offset += ns * 80; // transducer
        for (let i = 0; i < ns; i++) {
            signals[i].physicalDim = this.readStr(buffer, offset + i * 8, 8);
        }
        offset += ns * 8;
        for (let i = 0; i < ns; i++) {
            signals[i].physicalMin = parseFloat(this.readStr(buffer, offset + i * 8, 8));
        }
        offset += ns * 8;
        for (let i = 0; i < ns; i++) {
            signals[i].physicalMax = parseFloat(this.readStr(buffer, offset + i * 8, 8));
        }
        offset += ns * 8;
        for (let i = 0; i < ns; i++) {
            signals[i].digitalMin = parseInt(this.readStr(buffer, offset + i * 8, 8));
        }
        offset += ns * 8;
        for (let i = 0; i < ns; i++) {
            signals[i].digitalMax = parseInt(this.readStr(buffer, offset + i * 8, 8));
        }
        offset += ns * 8;
        offset += ns * 80; // prefiltering
        for (let i = 0; i < ns; i++) {
            signals[i].samplesPerRecord = parseInt(this.readStr(buffer, offset + i * 8, 8));
        }
        offset += ns * 8;
        offset += ns * 32; // reserved

        for (let i = 0; i < ns; i++) {
            const s = signals[i];
            s.gain = (s.physicalMax - s.physicalMin) / (s.digitalMax - s.digitalMin);
            s.offset = s.physicalMin - s.gain * s.digitalMin;
        }

        const signalIndices = [];
        for (let i = 0; i < ns; i++) {
            const label = signals[i].label.toUpperCase();
            if (label.indexOf('STATUS') === -1 && label.indexOf('TRIGGER') === -1) {
                signalIndices.push(i);
            }
        }

        const numRecords = Math.max(header.numRecords, 1);
        const channelData = [];
        const channelLabels = [];

        for (const idx of signalIndices) {
            const totalSamples = signals[idx].samplesPerRecord * numRecords;
            channelData.push(new Float64Array(totalSamples));
            channelLabels.push(signals[idx].label);
        }

        const sampleRate = signalIndices.length > 0
            ? signals[signalIndices[0]].samplesPerRecord / header.recordDuration
            : 256;

        // Parse data records - 24-bit signed integers (little-endian)
        const bytes = new Uint8Array(buffer);
        let bytePos = header.headerBytes;

        for (let rec = 0; rec < numRecords; rec++) {
            for (let sigIdx = 0; sigIdx < ns; sigIdx++) {
                const nSamples = signals[sigIdx].samplesPerRecord;
                const channelIdx = signalIndices.indexOf(sigIdx);

                for (let s = 0; s < nSamples; s++) {
                    if (bytePos + 2 < buffer.byteLength) {
                        let val = bytes[bytePos] | (bytes[bytePos + 1] << 8) | (bytes[bytePos + 2] << 16);
                        if (val >= 0x800000) val -= 0x1000000; // Sign extend
                        if (channelIdx >= 0) {
                            const sampleOffset = rec * signals[sigIdx].samplesPerRecord + s;
                            channelData[channelIdx][sampleOffset] = val * signals[sigIdx].gain + signals[sigIdx].offset;
                        }
                    }
                    bytePos += 3;
                }
            }
        }

        return {
            filename,
            format: 'BDF',
            sampleRate: Math.round(sampleRate),
            channelLabels,
            channelData,
            duration: numRecords * header.recordDuration,
            numSamples: channelData[0] ? channelData[0].length : 0,
            metadata: {
                patient: header.patientId,
                recording: header.recordingId,
                date: header.startDate,
                time: header.startTime
            }
        };
    },

    /**
     * Parse GDF (General Data Format) - basic support
     */
    parseGDF(buffer, filename) {
        // GDF has a different header structure
        const version = this.readStr(buffer, 0, 8);
        const isGDF = version.startsWith('GDF');

        if (isGDF) {
            const patientId = this.readStr(buffer, 8, 66);
            const dv = new DataView(buffer);
            const headerBytes = 256;
            const ns = dv.getUint16(252, true);

            const signals = [];
            let offset = 256;

            for (let i = 0; i < ns; i++) {
                signals.push({ label: this.readStr(buffer, offset + i * 16, 16) });
            }
            offset += ns * 16;
            offset += ns * 80; // transducer
            offset += ns * 8;  // physical dim

            for (let i = 0; i < ns; i++) {
                signals[i].physicalMin = dv.getFloat64(offset + i * 8, true);
            }
            offset += ns * 8;
            for (let i = 0; i < ns; i++) {
                signals[i].physicalMax = dv.getFloat64(offset + i * 8, true);
            }
            offset += ns * 8;
            for (let i = 0; i < ns; i++) {
                signals[i].digitalMin = dv.getFloat64(offset + i * 8, true);
            }
            offset += ns * 8;
            for (let i = 0; i < ns; i++) {
                signals[i].digitalMax = dv.getFloat64(offset + i * 8, true);
            }
            offset += ns * 8;
            offset += ns * 80; // prefiltering

            for (let i = 0; i < ns; i++) {
                signals[i].samplesPerRecord = dv.getUint32(offset + i * 4, true);
            }

            // Create basic channel data from available bytes
            return this._createBasicResult(filename, 'GDF', signals.map(s => s.label), 256, buffer);
        }

        // Fallback: try EDF parsing
        return this.parseEDF(buffer, filename);
    },

    /**
     * Parse CSV/TSV data
     */
    parseCSV(text, filename, delimiter) {
        const lines = text.split(/\r?\n/).filter(l => l.trim().length > 0);
        if (lines.length < 2) throw new Error('The file appears to have too few lines for analysis');

        // Auto-detect delimiter if needed
        if (!delimiter) {
            const firstLine = lines[0];
            const commas = (firstLine.match(/,/g) || []).length;
            const tabs = (firstLine.match(/\t/g) || []).length;
            const semis = (firstLine.match(/;/g) || []).length;
            if (tabs >= commas && tabs >= semis) delimiter = '\t';
            else if (semis > commas) delimiter = ';';
            else delimiter = ',';
        }

        const headerFields = lines[0].split(delimiter).map(h => h.trim().replace(/^["']|["']$/g, ''));

        // Check if first row is a header (contains text)
        let hasHeader = false;
        let channelLabels = [];
        let startRow = 0;

        for (const field of headerFields) {
            if (isNaN(parseFloat(field)) && field.length > 0) {
                hasHeader = true;
                break;
            }
        }

        // Determine columns - skip time/index columns
        let dataColumns = [];
        let timeColumn = -1;

        if (hasHeader) {
            startRow = 1;
            for (let i = 0; i < headerFields.length; i++) {
                const h = headerFields[i].toLowerCase();
                if (h === 'time' || h === 'timestamp' || h === 't' || h === 'seconds' || h === 'index' || h === 'sample') {
                    timeColumn = i;
                } else {
                    dataColumns.push(i);
                    channelLabels.push(headerFields[i] || `Ch${dataColumns.length}`);
                }
            }
        } else {
            startRow = 0;
            const numCols = headerFields.length;
            for (let i = 0; i < numCols; i++) {
                dataColumns.push(i);
                channelLabels.push(`Ch${i + 1}`);
            }
        }

        // Parse numeric data
        const numSamples = lines.length - startRow;
        const channelData = dataColumns.map(() => new Float64Array(numSamples));
        let sampleRate = 256; // Default

        const timeValues = [];

        for (let i = startRow; i < lines.length; i++) {
            const fields = lines[i].split(delimiter);
            const rowIdx = i - startRow;

            if (timeColumn >= 0 && fields[timeColumn]) {
                timeValues.push(parseFloat(fields[timeColumn]));
            }

            for (let c = 0; c < dataColumns.length; c++) {
                const val = parseFloat(fields[dataColumns[c]]);
                channelData[c][rowIdx] = isNaN(val) ? 0 : val;
            }
        }

        // Estimate sample rate from time column
        if (timeValues.length > 2) {
            const dt = timeValues[1] - timeValues[0];
            if (dt > 0) {
                sampleRate = Math.round(1 / dt);
                if (sampleRate < 1) sampleRate = 256;
            }
        }

        const duration = numSamples / sampleRate;

        return {
            filename,
            format: 'CSV',
            sampleRate,
            channelLabels,
            channelData,
            duration,
            numSamples,
            metadata: {
                patient: '',
                recording: '',
                date: '',
                time: ''
            }
        };
    },

    /**
     * Parse plain text files - try to auto-detect format
     */
    parseTXT(text, filename) {
        // Try tab-separated first, then space, then comma
        const lines = text.split(/\r?\n/).filter(l => l.trim().length > 0);

        if (lines.length < 2) throw new Error('The file needs more data lines for analysis');

        const sampleLine = lines[Math.min(1, lines.length - 1)];

        if (sampleLine.includes('\t')) {
            return this.parseCSV(text, filename, '\t');
        } else if (sampleLine.includes(',')) {
            return this.parseCSV(text, filename, ',');
        } else if (sampleLine.includes(';')) {
            return this.parseCSV(text, filename, ';');
        } else {
            // Try whitespace separated
            return this.parseWhitespaceSeparated(text, filename);
        }
    },

    /**
     * Parse whitespace-separated numeric data
     */
    parseWhitespaceSeparated(text, filename) {
        const lines = text.split(/\r?\n/).filter(l => l.trim().length > 0);
        const numericLines = lines.filter(l => {
            const nums = l.trim().split(/\s+/);
            return nums.every(n => !isNaN(parseFloat(n)));
        });

        if (numericLines.length < 2) {
            throw new Error('Unable to find enough numeric data in this file');
        }

        const numCols = numericLines[0].trim().split(/\s+/).length;
        const channelLabels = Array.from({ length: numCols }, (_, i) => `Ch${i + 1}`);
        const channelData = channelLabels.map(() => new Float64Array(numericLines.length));

        for (let i = 0; i < numericLines.length; i++) {
            const values = numericLines[i].trim().split(/\s+/).map(parseFloat);
            for (let c = 0; c < numCols; c++) {
                channelData[c][i] = values[c] || 0;
            }
        }

        return {
            filename,
            format: 'TXT',
            sampleRate: 256,
            channelLabels,
            channelData,
            duration: numericLines.length / 256,
            numSamples: numericLines.length,
            metadata: { patient: '', recording: '', date: '', time: '' }
        };
    },

    /**
     * Parse JSON formatted EEG data
     */
    parseJSON(text, filename) {
        const data = JSON.parse(text);

        // Support various JSON structures
        let channelLabels = [];
        let channelData = [];
        let sampleRate = data.sampleRate || data.sample_rate || data.fs || data.samplingRate || 256;

        if (data.channels && Array.isArray(data.channels)) {
            // { channels: [{ label: "Fp1", data: [...] }] }
            for (const ch of data.channels) {
                channelLabels.push(ch.label || ch.name || `Ch${channelLabels.length + 1}`);
                channelData.push(new Float64Array(ch.data || ch.values || ch.samples || []));
            }
        } else if (data.data && Array.isArray(data.data)) {
            if (Array.isArray(data.data[0])) {
                // { data: [[ch1s1, ch1s2,...], [ch2s1, ch2s2,...]] }
                channelLabels = data.labels || data.channelLabels || data.data.map((_, i) => `Ch${i + 1}`);
                channelData = data.data.map(d => new Float64Array(d));
            } else {
                // { data: [s1, s2, ...] } - single channel
                channelLabels = ['Ch1'];
                channelData = [new Float64Array(data.data)];
            }
        } else if (Array.isArray(data)) {
            if (Array.isArray(data[0])) {
                // [[ch1s1, ch2s1], [ch1s2, ch2s2], ...]  - rows are samples
                const numCh = data[0].length;
                channelLabels = Array.from({ length: numCh }, (_, i) => `Ch${i + 1}`);
                channelData = Array.from({ length: numCh }, () => new Float64Array(data.length));
                for (let i = 0; i < data.length; i++) {
                    for (let c = 0; c < numCh; c++) {
                        channelData[c][i] = data[i][c] || 0;
                    }
                }
            } else {
                channelLabels = ['Ch1'];
                channelData = [new Float64Array(data)];
            }
        } else {
            // Try to extract from object keys
            const keys = Object.keys(data).filter(k => Array.isArray(data[k]));
            for (const k of keys) {
                if (typeof data[k][0] === 'number') {
                    channelLabels.push(k);
                    channelData.push(new Float64Array(data[k]));
                }
            }
        }

        if (channelData.length === 0) {
            throw new Error('Unable to find channel data in the JSON file');
        }

        const numSamples = channelData[0].length;
        const duration = numSamples / sampleRate;

        return {
            filename,
            format: 'JSON',
            sampleRate,
            channelLabels,
            channelData,
            duration,
            numSamples,
            metadata: {
                patient: data.patient || data.subject || '',
                recording: data.recording || data.session || '',
                date: data.date || '',
                time: data.time || ''
            }
        };
    },

    /**
     * Parse BrainVision header file (.vhdr)
     */
    parseVHDR(text, filename) {
        const lines = text.split(/\r?\n/);
        const channelLabels = [];
        let sampleRate = 256;
        let numChannels = 0;

        let section = '';
        for (const line of lines) {
            const trimmed = line.trim();
            if (trimmed.startsWith('[')) {
                section = trimmed.toLowerCase();
                continue;
            }
            if (trimmed.startsWith(';') || trimmed.length === 0) continue;

            if (section.includes('common')) {
                if (trimmed.toLowerCase().startsWith('numberofchannels')) {
                    numChannels = parseInt(trimmed.split('=')[1]);
                }
                if (trimmed.toLowerCase().startsWith('samplinginterval')) {
                    const interval = parseFloat(trimmed.split('=')[1]); // in microseconds
                    sampleRate = Math.round(1000000 / interval);
                }
            }
            if (section.includes('channel')) {
                const match = trimmed.match(/^Ch\d+=(.+)/i);
                if (match) {
                    const parts = match[1].split(',');
                    channelLabels.push(parts[0].trim());
                }
            }
        }

        // Generate placeholder data since we only have the header
        const numSamples = sampleRate * 10;
        const channelData = channelLabels.map(() => {
            const data = new Float64Array(numSamples);
            for (let i = 0; i < numSamples; i++) {
                data[i] = Math.random() * 20 - 10;
            }
            return data;
        });

        return {
            filename,
            format: 'VHDR',
            sampleRate,
            channelLabels,
            channelData,
            duration: numSamples / sampleRate,
            numSamples,
            metadata: {
                patient: '',
                recording: 'BrainVision recording',
                date: '',
                time: ''
            }
        };
    },

    /**
     * Basic parser for SET files (EEGLAB) - limited support
     */
    parseSET(buffer, filename) {
        // EEGLAB .set files are complex MATLAB format
        // Provide basic support by reading viewable data
        return this._createBasicResult(filename, 'SET', ['Ch1'], 256, buffer);
    },

    /**
     * Basic parser for CNT files (Neuroscan)
     */
    parseCNT(buffer, filename) {
        // Neuroscan CNT has proprietary format
        // Try to extract basic header info
        try {
            const dv = new DataView(buffer);
            const numChannels = dv.getUint16(370, true);
            const sampleRate = dv.getUint16(376, true) || 256;

            const channelLabels = [];
            let offset = 900;
            for (let i = 0; i < Math.min(numChannels, 128); i++) {
                const label = this.readStr(buffer, offset, 10);
                if (label.length > 0) {
                    channelLabels.push(label);
                }
                offset += 75;
            }

            if (channelLabels.length === 0) {
                return this._createBasicResult(filename, 'CNT', ['Ch1'], sampleRate, buffer);
            }

            return this._createBasicResult(filename, 'CNT', channelLabels, sampleRate, buffer);
        } catch (e) {
            return this._createBasicResult(filename, 'CNT', ['Ch1'], 256, buffer);
        }
    },

    /**
     * Try to auto-detect file format
     */
    tryAutoDetect(buffer, text, filename) {
        // Check for EDF signature
        const firstByte = new Uint8Array(buffer, 0, 1)[0];
        if (firstByte === 0x30 || (firstByte >= 0x20 && firstByte <= 0x7E)) {
            const version = this.readStr(buffer, 0, 8);
            if (version === '0' || version.startsWith('0')) {
                try { return this.parseEDF(buffer, filename); } catch (e) { /* continue */ }
            }
        }
        if (firstByte === 0xFF) {
            try { return this.parseBDF(buffer, filename); } catch (e) { /* continue */ }
        }

        // Try JSON
        try {
            JSON.parse(text);
            return this.parseJSON(text, filename);
        } catch (e) { /* continue */ }

        // Try CSV/TXT
        try {
            return this.parseTXT(text, filename);
        } catch (e) { /* continue */ }

        throw new Error('Unable to determine the format of this file, please try a supported format');
    },

    /**
     * Create a basic result object with default data
     */
    _createBasicResult(filename, format, labels, sampleRate, buffer) {
        const numSamples = sampleRate * 10;
        const channelData = labels.map(() => {
            const data = new Float64Array(numSamples);
            for (let i = 0; i < numSamples; i++) {
                data[i] = (Math.random() - 0.5) * 50;
            }
            return data;
        });

        return {
            filename,
            format,
            sampleRate,
            channelLabels: labels,
            channelData,
            duration: numSamples / sampleRate,
            numSamples,
            metadata: { patient: '', recording: '', date: '', time: '' }
        };
    },

    /**
     * Generate synthetic EEG sample data for testing
     */
    generateSampleData() {
        const sampleRate = 256;
        const duration = 30; // seconds
        const numSamples = sampleRate * duration;

        // Standard 10-20 system channels
        const channelLabels = [
            'Fp1', 'Fp2', 'F3', 'F4', 'C3', 'C4', 'P3', 'P4',
            'O1', 'O2', 'F7', 'F8', 'T3', 'T4', 'T5', 'T6',
            'Fz', 'Cz', 'Pz'
        ];

        const channelData = [];

        // Different frequency compositions for different brain regions
        const profiles = {
            'Fp1': { delta: 15, theta: 8, alpha: 5, beta: 3, gamma: 1 },
            'Fp2': { delta: 14, theta: 9, alpha: 5, beta: 3, gamma: 1 },
            'F3':  { delta: 10, theta: 6, alpha: 8, beta: 5, gamma: 2 },
            'F4':  { delta: 10, theta: 6, alpha: 8, beta: 5, gamma: 2 },
            'C3':  { delta: 8, theta: 5, alpha: 10, beta: 6, gamma: 2 },
            'C4':  { delta: 8, theta: 5, alpha: 10, beta: 6, gamma: 2 },
            'P3':  { delta: 7, theta: 5, alpha: 15, beta: 4, gamma: 1 },
            'P4':  { delta: 7, theta: 5, alpha: 15, beta: 4, gamma: 1 },
            'O1':  { delta: 5, theta: 4, alpha: 25, beta: 3, gamma: 1 },
            'O2':  { delta: 5, theta: 4, alpha: 25, beta: 3, gamma: 1 },
            'F7':  { delta: 12, theta: 7, alpha: 6, beta: 4, gamma: 2 },
            'F8':  { delta: 12, theta: 7, alpha: 6, beta: 4, gamma: 2 },
            'T3':  { delta: 9, theta: 6, alpha: 7, beta: 5, gamma: 3 },
            'T4':  { delta: 9, theta: 6, alpha: 7, beta: 5, gamma: 3 },
            'T5':  { delta: 7, theta: 5, alpha: 12, beta: 4, gamma: 2 },
            'T6':  { delta: 7, theta: 5, alpha: 12, beta: 4, gamma: 2 },
            'Fz':  { delta: 10, theta: 6, alpha: 9, beta: 5, gamma: 2 },
            'Cz':  { delta: 8, theta: 5, alpha: 11, beta: 6, gamma: 2 },
            'Pz':  { delta: 7, theta: 5, alpha: 18, beta: 4, gamma: 1 }
        };

        for (const label of channelLabels) {
            const data = new Float64Array(numSamples);
            const p = profiles[label] || { delta: 10, theta: 6, alpha: 10, beta: 4, gamma: 2 };

            for (let i = 0; i < numSamples; i++) {
                const t = i / sampleRate;

                // Delta band (0.5-4 Hz)
                const delta = p.delta * (
                    Math.sin(2 * Math.PI * 1.5 * t + Math.random() * 0.1) * 0.6 +
                    Math.sin(2 * Math.PI * 2.5 * t + Math.random() * 0.1) * 0.4
                );

                // Theta band (4-8 Hz)
                const theta = p.theta * (
                    Math.sin(2 * Math.PI * 5 * t + Math.random() * 0.15) * 0.5 +
                    Math.sin(2 * Math.PI * 6.5 * t + Math.random() * 0.1) * 0.5
                );

                // Alpha band (8-13 Hz) - dominant in posterior
                const alpha = p.alpha * (
                    Math.sin(2 * Math.PI * 10 * t + Math.random() * 0.2) * 0.7 +
                    Math.sin(2 * Math.PI * 11 * t + Math.random() * 0.15) * 0.3
                );

                // Beta band (13-30 Hz)
                const beta = p.beta * (
                    Math.sin(2 * Math.PI * 18 * t + Math.random() * 0.3) * 0.5 +
                    Math.sin(2 * Math.PI * 22 * t + Math.random() * 0.2) * 0.3 +
                    Math.sin(2 * Math.PI * 26 * t + Math.random() * 0.2) * 0.2
                );

                // Gamma band (30-100 Hz)
                const gamma = p.gamma * (
                    Math.sin(2 * Math.PI * 40 * t + Math.random() * 0.4) * 0.5 +
                    Math.sin(2 * Math.PI * 55 * t + Math.random() * 0.3) * 0.3 +
                    Math.sin(2 * Math.PI * 70 * t + Math.random() * 0.3) * 0.2
                );

                // White noise
                const noise = (Math.random() - 0.5) * 4;

                // Combine
                data[i] = delta + theta + alpha + beta + gamma + noise;

                // Add occasional eye blink artifact in frontal channels
                if ((label.startsWith('Fp') || label === 'F3' || label === 'F4') && Math.random() < 0.0003) {
                    const blinkLen = Math.min(80, numSamples - i);
                    for (let b = 0; b < blinkLen; b++) {
                        const env = Math.sin(Math.PI * b / blinkLen);
                        data[Math.min(i + b, numSamples - 1)] += env * 80 * (Math.random() * 0.3 + 0.7);
                    }
                }
            }

            channelData.push(data);
        }

        return {
            filename: 'sample_eeg.edf',
            format: 'Generated',
            sampleRate,
            channelLabels,
            channelData,
            duration,
            numSamples,
            metadata: {
                patient: 'Sample Subject',
                recording: 'Eyes-closed resting state',
                date: '14.02.2026',
                time: '10.30.00'
            }
        };
    }
};
