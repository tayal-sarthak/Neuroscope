# NeuroScope, an EEG Data Visualization/Analysis Platform for Researchers

A complete local workspace for exploring, analyzing, and understanding EEG data for all researchers. Open the HTML file in any modern browser and start working immediately. There are HUNDREDS of adjustable parameters to efficiently creating beautifully generated maps and charts. Version 1.2.1

## Gallery
These images were taken using patient CHB02_16.edf from the CHB-MIT database used on the filtering site, [NeuroScopeEEG.vercel.app](https://NeuroscopeEEG.vercel.app/), where the data can be found precisely here: https://physionet.org/content/chbmit/1.0.0/chb02/#files-panel. 

To test the same data for yourself, here is the download: https://physionet.org/files/chbmit/1.0.0/chb02/chb02_16.edf?download

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

1. Open [NeuroScopeEEG.vercel.app](https://NeuroscopeEEG.vercel.app/) in your browser (Chrome, Firefox, Safari, or Edge all work well)
2. Drag and drop your EEG file onto the upload area, or click to browse
3. Alternatively, click **"Explore with sample EEG data"** to load patient chb02_16.edf from the CHB-MIT Scalp EEG Database

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

## Sample Data Acknowledgement

The sample file `chb02_16.edf` included in this repository is obtained from the **CHB-MIT Scalp EEG Database**, hosted on [PhysioNet](https://physionet.org/content/chbmit/1.0.0/).

**Citations (required by the data license):**

> Shoeb, A. H. (2009). *Application of Machine Learning to Epileptic Seizure Onset Detection and Treatment*. PhD Thesis, Massachusetts Institute of Technology.

> Goldberger, A. L., Amaral, L. A. N., Glass, L., Hausdorff, J. M., Ivanov, P. Ch., Mark, R. G., Mietus, J. E., Moody, G. B., Peng, C.-K., & Stanley, H. E. (2000). "PhysioBank, PhysioToolkit, and PhysioNet: Components of a New Research Resource for Complex Physiologic Signals." *Circulation*, 101(23), e215–e220.

**Data License:** The CHB-MIT Scalp EEG Database is made available under the [Open Data Commons Attribution License v1.0 (ODC-By 1.0)](https://opendatacommons.org/licenses/by/1-0/).

## Citations
**If the diagrams from the website or this GitHub are used for a paper in any way, you must include a citation at the end of the paper AND star this repository:**

- **APA Style (7th Edition):** Tayal, S. (2026). *Neuroscope* (Version 1.2.1) [Computer software]. GitHub. https://github.com/tayal-sarthak/Neuroscope
- **MLA Style (9th Edition):** Tayal, Sarthak. *Neuroscope*. GitHub, 2026, https://github.com/tayal-sarthak/Neuroscope
- **Chicago Style (17th Edition):** Tayal, Sarthak. *Neuroscope*. GitHub, 2026. https://github.com/tayal-sarthak/Neuroscope

## License

The NeuroScope application source code is licensed under the **MIT License**.

The included sample data file (`chb02_16.edf`) is licensed separately under the **Open Data Commons Attribution License v1.0 (ODC-By 1.0)**.

### MIT License (Application Code)

Copyright (c) 2026 Sarthak Tayal

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

### ODC-By 1.0 (Sample EEG Data)

The sample data file `chb02_16.edf` is from the CHB-MIT Scalp EEG Database,
available at https://physionet.org/content/chbmit/1.0.0/, and is redistributed
under the [Open Data Commons Attribution License v1.0](https://opendatacommons.org/licenses/by/1-0/).
Attribution is provided to the original authors and PhysioNet as specified in
the "Sample Data Acknowledgement" section above.
