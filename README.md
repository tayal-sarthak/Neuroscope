# NeuroScope, an EEG Data Visualization/Analysis Platform for Researchers

NeuroScope is aimed at researchers who lack access to expensive EEG visualization software or an institutional license. There is no signup and no payment. Simply import a recording and begin reviewing and visualizing the data.

NeuroScope has been used to analyze 31,981+ EEG recordings.

NeuroScope is a complete local workspace for exploring, reviewing, analyzing, and exporting EEG data. Open the HTML file in any modern browser and start working immediately. Version 1.2.1

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

That is everything required on the hosted site. There are no dependencies to install and no build steps. Uploaded files can also be opened directly from `index.html`. The sample-data button uses `fetch`, so use the hosted site or a small static file server when testing that button locally.


## Supported File Formats

NeuroScope reads the following file formats directly in the browser:

- **EDF** (European Data Format), the most widely used clinical EEG format
- **BDF** (BioSemi Data Format), 24-bit resolution variant of EDF
- **CSV** and **TSV**, comma or tab separated data with automatic delimiter detection
- **JSON**, flexible structure supporting multiple channel layouts
- **TXT**, plain text with automatic separator detection

GDF, BrainVision, EEGLAB SET, CNT, and XDF files are not directly imported. NeuroScope rejects these files and gives conversion guidance instead of substituting generated data for an uploaded recording.

## Analysis Tabs

### Signals

The Signal Viewer is the core of NeuroScope. It displays multichannel EEG recordings on an interactive canvas and keeps review notes connected to exact points or time ranges.

**Key Features**
- Three trace-spacing modes: readable scrolling, compact scrolling, or every selected channel fitted into one view
- A reversible Focus view that gives the signal more screen space without changing the review state
- Real-time amplitude scaling (0.1x to 10x magnification)
- Flexible time window control from 0.5 seconds through the complete recording
- Scroll through the entire recording with the position slider
- Navigate long recordings from a complete-recording overview with viewport and annotation markers
- Pan horizontally with a trackpad or Shift + mouse wheel, use left and right arrow keys for time, and use up/down or Page Up/Page Down for scrollable channel sets
- Hover over the waveform for exact time, channel, and amplitude readouts
- Click to pin a time cursor or drag across the waveform to select a precise time range
- Right-click a selected range to add an annotation, classify an artifact, set the export scope, or download the range as CSV
- Create point or duration annotations directly from the active cursor or selected range
- Label eye blinks, muscle artifacts, bad electrodes, clinical events, uncertain regions, and general observations
- Save exclusion flags, affected channels, montage, raw or filtered state, and applied-filter details with each annotation
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
- Review workflow history, undo supported state changes, restore the raw signal, and export the history as JSON

Amplitude, time, color, grid, and polarity controls are in the sidebar. Montage, trace spacing, and Focus controls are beside the waveform. The status bar identifies whether the active signal is raw or filtered.

### Spectrum

Compute power spectral density with Welch or direct FFT methods. Compare up to eight selected channels on one chart and choose a linear or logarithmic power scale.

### Band power

Decompose signals into the five standard EEG frequency bands.

- Delta (0.5 to 4 Hz)
- Theta (4 to 8 Hz)
- Alpha (8 to 13 Hz)
- Beta (13 to 30 Hz)
- Gamma (30 to 100 Hz)

Compute the visible signal window or the complete recording. Each result records the time interval, channel count, and whether the source was raw or filtered. View absolute power in µV² or relative band percentages, compare channels, and download the computed table as CSV.

### Filtering

Design and apply digital filters to EEG signals. Four filter types are available.

- **Bandpass**, keep frequencies within a range
- **Highpass**, remove slow drifts below a cutoff
- **Lowpass**, remove high-frequency noise above a cutoff
- **Notch**, suppress power line interference at 50 or 60 Hz

The Filtering tab includes a channel selector, adjustable order from 2nd through 8th, parameter validation against the Nyquist frequency, a raw-versus-filtered preview, and a frequency-response chart in dB.

Choose **Preview channel** to inspect one channel. Choose **Apply to all channels** to make the filtered result active. Choose **Restore raw signal** to return to the original data.

### Spectrogram

Generate a time-frequency spectrogram with the Short-Time Fourier Transform. Choose the channel, window size from 128 to 1024 samples, maximum frequency, and color map. The result appears as a heatmap with a labeled color scale.

### Statistics

Compute statistics for every channel, including mean, standard deviation, variance, RMS amplitude, minimum, maximum, peak-to-peak, skewness, kurtosis, and zero crossings. A separate visible-window quality screen checks for possible flat signal, repeated extremes, and unusually large ranges. These flags are review prompts, not automatic rejection decisions. Statistics and quality results can be downloaded as CSV files.

### Topography

Visualize the spatial distribution of EEG values across the scalp. The map uses recognized 10-20 electrode labels and inverse-distance-weighted interpolation. Choose total power, individual band power, or RMS amplitude.

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

The Export Center estimates output size before a download begins and prevents overlapping export jobs. The default scope is the visible window instead of the complete recording so a download does not unexpectedly become much larger than the source file.

### Annotations

Add point or range annotations below the Signal Viewer. Each annotation records its time, type, affected channels, and note. Annotations can be edited, filtered, imported from NeuroScope CSV or compatible BIDS events TSV files, and opened from the signal display. They are included in review JSON, annotation CSV or JSON, and BIDS events exports.

An exclusion flag is saved as review metadata. It does not automatically remove samples from an analysis. A range annotation can also be exported with its affected signal in one JSON file.

## Signal Processing Details

All signal processing runs in the browser using JavaScript implementations included with NeuroScope.

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
api/
  analysis-complete.mjs Idempotent lifetime-counter increment endpoint
  stats.mjs             Public lifetime-counter read endpoint
lib/
  analysis-counter.mjs  Atomic Upstash Redis counter operations
README.md               This file
```

## Technical Notes

- The platform uses Chart.js for bar, line, and doughnut charts, loaded from a CDN
- PDF reports are generated with jsPDF, also loaded from a CDN
- The Inter typeface loads from Google Fonts for a modern look
- All canvases support HiDPI (Retina) rendering for sharp output on high-resolution displays
- The interface uses a light clinical color scheme with separate colors for channels and review states
- The sidebar remembers selected channels and display settings across tab switches

## Hosted Lifetime Counter

The hosted app counts one analysis after a recording has parsed successfully and the workspace has finished opening. User-selected recordings and the bundled sample both count. Failed imports and individual actions such as computing a spectrum, applying a filter, or opening another analysis tab do not count separately.

The browser sends only a newly generated random import ID to `POST /api/analysis-complete`. It does not send the recording, filename, patient metadata, channel labels, duration, or computed results. The request never blocks the EEG workspace and is retried once if the network response fails. Redis retains each random import ID for 24 hours so a retry cannot increment the counter twice.

`GET /api/stats` returns the current total:

```json
{
  "analyses": 31981
}
```

The Redis key initializes to the legacy baseline of `31,981` only when it does not already exist. Initialization, duplicate detection, rate limiting, and incrementing are performed atomically. The API permits up to 60 new import IDs per client-address fingerprint per hour; only a keyed, opaque fingerprint is stored for the rate-limit window.

### Vercel and Upstash setup

1. Open the NeuroScope project in Vercel and install an Upstash Redis integration from the Vercel Marketplace.
2. Create or select a Redis database and connect it to the project.
3. Confirm that Vercel added `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` to the environments that should run the counter. The API also accepts the older `KV_REST_API_URL` and `KV_REST_API_TOKEN` names.
4. Redeploy the project so the functions receive the new environment variables.
5. Open `/api/stats` on the deployment. A new database should return the baseline before the first new successful import increments it.

No `package.json` or Redis client dependency is required. The Vercel Functions call Upstash's REST API with the credentials kept exclusively on the server. `.env.example` documents the variables for local `vercel dev` use; never commit real tokens.

The app does not load Vercel Web Analytics or send custom Web Analytics events. Counter traffic uses only the two API functions described above.

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
