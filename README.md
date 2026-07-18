# NeuroScope, an EEG Data Visualization/Analysis Platform for Researchers

A local-first workspace for exploring, annotating, analyzing, and exporting EEG recordings. NeuroScope is designed first for EEG researchers and clinicians, while keeping the workflow approachable for students and general users. Open the HTML file in any modern browser and start working immediately. Version 1.2.1

For a screen-by-screen sitemap and exact workflow guide, see [APP_WALKTHROUGH.md](APP_WALKTHROUGH.md).

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

There are zero dependencies to install and zero build steps. Uploaded files can be opened directly from `index.html`. The bundled sample-data button uses `fetch`, so run the folder through any small static file server when testing that button locally, or use the hosted site.


## Supported File Formats

NeuroScope currently has verified browser import paths for these formats:

- **EDF** (European Data Format), the most widely used clinical EEG format
- **BDF** (BioSemi Data Format), 24-bit resolution variant of EDF
- **CSV** and **TSV**, comma or tab separated data with automatic delimiter detection
- **JSON**, flexible structure supporting multiple channel layouts
- **TXT**, plain text with automatic separator detection

GDF, BrainVision, EEGLAB SET, CNT, and XDF files are rejected with conversion guidance until their binary import paths are fully verified. NeuroScope never substitutes generated samples for an uploaded recording.

## Analysis Tabs

### Signals

The Signal viewer is NeuroScope’s main review surface for multichannel EEG recordings. Inspect raw waveforms, move through time, and keep review decisions tied to exact points or ranges.

**Key Features**
- Multi-channel simultaneous display with independent vertical scaling per channel
- Real-time amplitude scaling (0.1x to 10x magnification)
- Flexible time window control from 0.5 seconds through the complete recording
- Scroll through the entire recording with the position slider
- Navigate long recordings from a compact full-duration overview with viewport and annotation markers
- Pan horizontally with a trackpad or Shift + mouse wheel, or use the left and right arrow keys
- Hover over the waveform for exact time, channel, and amplitude readouts
- Click to pin a time cursor or drag across the waveform to select a precise time range
- Right-click a selected range to add an annotation, preclassify an artifact, set the Export center scope, or download the range as CSV; right-click elsewhere for point-specific review actions
- Create point or duration annotations directly from the active cursor or selected range
- Label eye blinks, muscle artifacts, bad electrodes, clinical events, uncertain regions, and general observations
- Preserve exclusion flags, affected channels, montage, raw/filtered state, and applied-filter provenance with each annotation
- Download an annotated signal range and its research note together as JSON
- Edit, filter, import, and step between annotations with previous/next controls or N/P shortcuts
- Export the current viewer range without re-entering start and end times
- Channel selection and deselection with checkboxes in the sidebar
- Mark channels bad manually and carry that status into session and BIDS exports
- Choose channel-color, signal-blue, or clinical-ink traces; standard, fine, or hidden grids; and normal or inverted polarity
- Multiple montage views (monopolar, average reference, bipolar)
- Automatic grid rendering with time markers and channel separators
- HiDPI (Retina) display support for crisp rendering
- Real-time updates as filters are applied
- Use one collapsible Review dock for quality screening, annotations, and history instead of three stacked panels
- Screen the complete recording on a clickable quality timeline for flat signal, large amplitude, clipping, line noise, possible muscle artifact, and existing annotations
- Review before-and-after workflow history, undo supported state changes, restore raw signal, and export the provenance log as JSON

Display controls remain in the sidebar while you review. The Signal viewer re-renders when the active state changes between raw and filtered data, while the status bar identifies which state is active.

### Spectrum

Estimate power spectral density with Welch or direct FFT methods. Compare up to the first eight selected channels on one chart and choose a linear or logarithmic power scale.

### Band power

Decompose signals into the five standard EEG frequency bands.

- Delta (0.5 to 4 Hz)
- Theta (4 to 8 Hz)
- Alpha (8 to 13 Hz)
- Beta (13 to 30 Hz)
- Gamma (30 to 100 Hz)

Compute either the visible signal window or complete recording, with the visible window as the safer review default. Each run records its exact interval, channel count, and raw/filtered source. View absolute power in µV² or relative band percentages with channel comparison and average-distribution charts, then download the computed table as CSV.

### Filtering

Design and apply digital filters to clean your EEG signals. Four filter types are available.

- **Bandpass**, keep frequencies within a range
- **Highpass**, remove slow drifts below a cutoff
- **Lowpass**, remove high-frequency noise above a cutoff
- **Notch**, suppress power line interference at 50 or 60 Hz

The Filtering tab includes a channel selector, adjustable order (2nd through 8th), parameter validation against the Nyquist frequency, a raw-versus-filtered preview, and a frequency-response chart showing magnitude in dB on a logarithmic frequency axis.

Choose **Preview channel** to inspect one channel, then **Apply to all channels** to make that result the active filtered signal. The workspace and filter status bars identify the current state. Choose **Restore raw signal** to remove the applied filtered result.

### Spectrogram

Generate a time-frequency spectrogram using the Short-Time Fourier Transform. Choose the analysis channel, window size (128 to 1024 samples), maximum frequency, and color map (Viridis, Plasma, Hot, or Cool). The spectrogram renders as a full-width heatmap with a labeled colorbar.

### Statistics

Compute comprehensive statistical measures for every channel, including mean, standard deviation, variance, RMS amplitude, min, max, peak-to-peak, skewness, kurtosis, and zero crossing count. A separate visible-window quality review screens for possible flat signal, repeated extremes, and unusually large ranges while clearly labeling results as manual-review prompts rather than automatic rejection. Download statistics and quality metrics as CSV files.

### Topography

Visualize the spatial distribution of brain activity across the scalp using a topographic heat map. The map follows the 10-20 electrode placement system with inverse-distance-weighted interpolation. Choose from metrics such as total power, individual band powers, or RMS amplitude.

### Export

Download your processed data and visualizations in multiple formats.

- **Scoped signal CSV**, selected or all channels, raw or filtered signal, adjustable time range and precision
- **Scoped data JSON**, recording metadata plus only the requested signal slice
- **Current visualization PNG**, Retina-safe export of the visualization currently on screen
- **PDF**, a multi-page report with recording info, statistics table, and embedded visualizations
- **Spectrum CSV**, frequency and power columns
- **Statistics CSV**, all computed measures
- **Annotations CSV**, point and duration observations with channel associations
- **BIDS events TSV**, onset, duration, trial type, channel, and description fields
- **BIDS channels TSV**, EEG channel names, units, and manually reviewed good/bad status
- **Quality review CSV**, visible-window screening metrics and review flags
- **Annotations JSON**, a machine-readable annotation sidecar
- **Restorable review JSON**, recording provenance, selected and bad channels, view settings, and annotations without duplicating raw samples

The Export center shows an estimated output size before a download begins and prevents multiple overlapping export jobs. The default scope is the initial visible window rather than the complete recording, which avoids unexpectedly generating files many times larger than the source EDF.

### Annotations

Attach point- or range-linked annotations directly below the signal viewer. An annotation records timing, type, channel scope, and a free-text note. Annotations can be edited, filtered, imported from NeuroScope CSV or compatible BIDS events TSV columns, and traversed from the viewer. They are included in review JSON, annotation CSV/JSON, and BIDS events exports.

Exclusion flags are currently provenance metadata: they are exported but do not automatically remove samples from analyses. Range annotations can also export the affected signal and annotation together in one JSON bundle.

## Signal Processing Details

All signal processing runs entirely in the browser using custom JavaScript implementations.

- **FFT** uses an iterative Cooley-Tukey radix-2 algorithm with bit-reversal permutation
- **Power Spectral Density** uses Welch estimation with overlapping Hann-windowed segments
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
APP_WALKTHROUGH.md       Screen map and end-to-end app guide
```

## Technical Notes

- The platform uses Chart.js for bar, line, and doughnut charts, loaded from a CDN
- PDF reports are generated with jsPDF, also loaded from a CDN
- The Inter typeface loads from Google Fonts for a modern look
- All canvases support HiDPI (Retina) rendering for sharp output on high-resolution displays
- The interface uses clinical ink, signal blue, teal review states, and a distinct colorblind-conscious channel palette
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
