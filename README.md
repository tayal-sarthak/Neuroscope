# NeuroScope, An EEG Data Analysis Platform

A complete local workspace for exploring, analyzing, and understanding EEG data for all researchers. Open the HTML file in any modern browser and start working immediately. There are HUNDREDS of adjustable parameters to efficiently creating beautifully generated maps and charts.

## Gallery
These images were taken using Patient CHB02_16.edf from the CHB-MIT database into Neuroscope, found precisely here: _https://physionet.org/content/chbmit/1.0.0/chb02/#files-panel_
![Digital Filtering](/images/DigitalFiltering.png)

![Signal Viewer](/images/SignalViewer.png)

![Topographic Mapping](/images/TopographicMapping.png)

![Spectral Analysis](/images/StatisticalAnalysis.png)

![Band Power Analysis](/images/BandPowerAnalysis.png)

![Spectrogram](/images/Spectrogram.png)

![Power Spectrum](/images/PowerSpectrum.png)

![Export Center](/images/ExportCenter.png)

![Normal Dashboard](/images/normalDashboard.png)
## Getting Started

1. Open dataPlatform.vercel.app in your browser (Chrome, Firefox, Safari, or Edge all work well)
2. Drag and drop your EEG file onto the upload area, or click to browse
3. Alternatively, click the sample data button to explore with synthetic 19-channel EEG

That is everything you need. There are zero dependencies to install, zero servers to run, and zero build steps required.


## Supported File Formats

NeuroScope reads a wide range of EEG file formats directly in the browser.

- **EDF** (European Data Format), the most widely used clinical EEG format
- **BDF** (BioSemi Data Format), 24-bit resolution variant of EDF
- **GDF** (General Data Format), a more modern biosignal container
- **CSV** and **TSV**, comma or tab separated data with automatic delimiter detection
- **JSON**, flexible structure supporting multiple channel layouts
- **TXT**, plain text with automatic separator detection
- **VHDR**, BrainVision header format
- **SET**, EEGLAB dataset format
- **CNT**, Neuroscan continuous data

## Analysis Tabs

### Signals

The Signal Viewer is the core of NeuroScope, offering a powerful canvas-based display for multi-channel EEG recordings. Browse your raw EEG waveforms with complete interactive control.

**Key Features**
- Multi-channel simultaneous display with independent vertical scaling per channel
- Real-time amplitude scaling (0.1x to 10x magnification)
- Flexible time window control (1 to 30 seconds visible at once)
- Scroll through the entire recording with the position slider
- Channel selection and deselection with checkboxes in the sidebar
- Color-coded traces for visual channel identification
- Multiple montage views (monopolar, average reference, bipolar)
- Automatic grid rendering with time markers and channel separators
- HiDPI (Retina) display support for crisp rendering
- Real-time updates as filters are applied

All controls are located in the sidebar for easy access while viewing. The Signal Viewer automatically re-renders when you switch between filtered and original data, enabling rapid comparison during analysis.

### Spectrum

Compute the power spectral density using the Welch method. View frequency content for each selected channel on a shared chart. Choose between linear and logarithmic display scales.

### Band Power

Decompose signals into the five standard EEG frequency bands.

- Delta (0.5 to 4 Hz)
- Theta (4 to 8 Hz)
- Alpha (8 to 13 Hz)
- Beta (13 to 30 Hz)
- Gamma (30 to 100 Hz)

View absolute or relative power with bar charts and a doughnut breakdown.

### Filtering

Design and apply digital filters to clean your EEG signals. Four filter types are available.

- **Bandpass**, keep frequencies within a range
- **Highpass**, remove slow drifts below a cutoff
- **Lowpass**, remove high-frequency noise above a cutoff
- **Notch**, suppress power line interference at 50 or 60 Hz

The filter tab includes a channel selector, adjustable order (2nd through 8th), parameter validation against the Nyquist frequency, a real-time signal comparison preview (original versus filtered), and a frequency response chart showing the magnitude curve in dB on a logarithmic frequency axis.

Click Preview to see the effect on a single channel, then Apply to All Channels to filter every channel at once. A status bar at the top of the tab shows what filter is currently active. Click Reset to Original to restore the unfiltered data.

### Spectrogram

Generate a time-frequency spectrogram using the Short-Time Fourier Transform. Choose the analysis channel, window size (128 to 1024 samples), maximum frequency, and color map (Viridis, Plasma, Hot, or Cool). The spectrogram renders as a full-width heatmap with a labeled colorbar.

### Statistics

Compute comprehensive statistical measures for every channel, including mean, standard deviation, variance, RMS amplitude, min, max, peak-to-peak, skewness, kurtosis, and zero crossing count. Results appear in a sortable table with RMS and variance bar charts. Download the statistics as a CSV file.

### Topography

Visualize the spatial distribution of brain activity across the scalp using a topographic heat map. The map follows the 10-20 electrode placement system with inverse-distance-weighted interpolation. Choose from metrics such as total power, individual band powers, or RMS amplitude.

### Export

Download your processed data and visualizations in multiple formats.

- **CSV**, raw or filtered channel data
- **JSON**, full metadata and analysis results
- **PNG**, screenshot of the current signal viewer
- **PDF**, a multi-page report with recording info, statistics table, and embedded visualizations
- **Spectrum CSV**, frequency and power columns
- **Statistics CSV**, all computed measures

## Signal Processing Details

All signal processing runs entirely in the browser using custom JavaScript implementations.

- **FFT** uses an iterative Cooley-Tukey radix-2 algorithm with bit-reversal permutation
- **Power Spectral Density** relies on the Welch method with overlapping Hanning-windowed segments
- **Filters** are cascaded biquad (second-order section) Butterworth IIR filters with forward-backward zero-phase filtering
- **Spectrogram** computes an overlapping Short-Time Fourier Transform with configurable window and overlap

## Project Structure

```
index.html              Main application entry point
css/
  styles.css            Complete visual design system
js/
  parsers.js            EEG file format parsers
  analysis.js           Signal processing engine
  visualization.js      Canvas rendering and charts
  export.js             Data and report export
  app.js                Application controller and state management
README.md               This file
```

## Technical Notes

- The platform uses Chart.js for bar, line, and doughnut charts, loaded from a CDN
- PDF reports are generated with jsPDF, also loaded from a CDN
- The Inter typeface loads from Google Fonts for a modern look
- All canvases support HiDPI (Retina) rendering for sharp output on high-resolution displays
- The color scheme uses white and light blue tones with a primary accent of #4A90D9
- The sidebar remembers selected channels and display settings across tab switches

## Browser Compatibility

NeuroScope works in all modern browsers that support ES6, Canvas 2D, and the File API. For the best experience, use a recent version of Chrome, Firefox, Safari, or Edge.

## License

MIT License

Copyright (c) 2026

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
