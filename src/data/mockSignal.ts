// ============================================================
// Mock Signal Data â€” QPSK Demo Scenario
// All values are internally consistent for a QPSK signal.
// ============================================================

import type {
  SpectrumPoint, TimePoint, FreqPoint, PhasePoint, ConstellationPoint, SignalPreview
} from '../types';

// ---------------------------------------------------------------
// Gaussian random number generator (Box-Muller)
// ---------------------------------------------------------------
function randn(mean = 0, std = 1): number {
  let u = 0, v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return mean + std * Math.sqrt(-2 * Math.floor(Math.log(u))) * Math.cos(2 * Math.PI * v);
}

function gauss(mean = 0, std = 1): number {
  let u = 0, v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return mean + std * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

// ---------------------------------------------------------------
// Spectrum / FFT Data (QPSK signal at 2.45 MHz center)
// Shape: sincÂ² envelope + noise floor
// ---------------------------------------------------------------
export function generateSpectrumData(numPoints = 512): SpectrumPoint[] {
  const data: SpectrumPoint[] = [];
  const centerMHz = 2.450;
  const bwMHz = 0.1854;
  const peakPower = -18.2;
  const noiseFloor = -72.4;

  for (let i = 0; i < numPoints; i++) {
    const freqMHz = centerMHz - 0.6 + (i / numPoints) * 1.2;
    const normalizedDist = (freqMHz - centerMHz) / (bwMHz / 2);
    const sincArg = Math.PI * normalizedDist;
    const sincVal = sincArg !== 0 ? Math.sin(sincArg) / sincArg : 1;
    const signalShape = sincVal * sincVal;

    const signalPower = noiseFloor + (peakPower - noiseFloor) * signalShape;
    const noise = noiseFloor + gauss(0, 0.8);
    const power = Math.max(signalPower, noise) + gauss(0, 0.3);

    data.push({
      freq: parseFloat(freqMHz.toFixed(4)),
      power: parseFloat(power.toFixed(2)),
      noise: parseFloat((noiseFloor + gauss(0, 0.5)).toFixed(2)),
    });
  }
  return data;
}

// ---------------------------------------------------------------
// I/Q Waveform Data (QPSK modulated baseband)
// ---------------------------------------------------------------
export function generateIQData(numPoints = 400): TimePoint[] {
  const data: TimePoint[] = [];
  const symbolRate = 250e3;     // 250 kSym/s
  const sampleRate = 2.4e6;    // 2.4 MS/s
  const samplesPerSymbol = sampleRate / symbolRate; // ~9.6

  // QPSK symbol phases: 45, 135, 225, 315 degrees
  const symbols = [
    { i: 1 / Math.SQRT2, q: 1 / Math.SQRT2 },
    { i: -1 / Math.SQRT2, q: 1 / Math.SQRT2 },
    { i: -1 / Math.SQRT2, q: -1 / Math.SQRT2 },
    { i: 1 / Math.SQRT2, q: -1 / Math.SQRT2 },
  ];

  const noiseStd = 0.05;  // ~18.7 dB SNR
  let currentSymbolIdx = Math.floor(Math.random() * 4);
  let symbolSampleCount = 0;

  for (let n = 0; n < numPoints; n++) {
    const t = n / sampleRate;

    if (symbolSampleCount >= samplesPerSymbol) {
      currentSymbolIdx = Math.floor(Math.random() * 4);
      symbolSampleCount = 0;
    }
    symbolSampleCount++;

    const sym = symbols[currentSymbolIdx];

    // Apply raised cosine filtering approximation (smooth transitions)
    const alpha = symbolSampleCount / samplesPerSymbol;
    const ramp = Math.sin((Math.PI * alpha) / 2);
    const iVal = sym.i * ramp + gauss(0, noiseStd);
    const qVal = sym.q * ramp + gauss(0, noiseStd);

    const amplitude = Math.sqrt(iVal * iVal + qVal * qVal);
    const phase = (Math.atan2(qVal, iVal) * 180) / Math.PI;

    data.push({
      time: parseFloat((t * 1e6).toFixed(3)), // microseconds
      i: parseFloat(iVal.toFixed(4)),
      q: parseFloat(qVal.toFixed(4)),
      amplitude: parseFloat(amplitude.toFixed(4)),
      phase: parseFloat(phase.toFixed(2)),
    });
  }
  return data;
}

// ---------------------------------------------------------------
// Frequency vs Time (small CFO drift: +2.8 kHz)
// ---------------------------------------------------------------
export function generateFreqVsTimeData(numPoints = 200): FreqPoint[] {
  const data: FreqPoint[] = [];
  const centerFreq = 2450;     // kHz (center)
  const cfo = 2.8;             // kHz

  for (let i = 0; i < numPoints; i++) {
    const t = (i / numPoints) * 4.37;
    // Small linear drift + thermal noise
    const freqDrift = gauss(0, 0.08);
    const freq = centerFreq + cfo + freqDrift;
    data.push({
      time: parseFloat(t.toFixed(3)),
      frequency: parseFloat(freq.toFixed(3)),
    });
  }
  return data;
}

// ---------------------------------------------------------------
// Phase vs Time (QPSK: 4 phase states + noise)
// ---------------------------------------------------------------
export function generatePhaseVsTimeData(numPoints = 300): PhasePoint[] {
  const data: PhasePoint[] = [];
  const qpskPhases = [45, 135, -135, -45]; // degrees
  const symbolRate = 250e3;
  const sampleRate = 2.4e6;
  const samplesPerSymbol = sampleRate / symbolRate;

  let currentPhase = qpskPhases[0];
  let sampleCount = 0;
  const phaseOffset = 13.4;

  for (let n = 0; n < numPoints; n++) {
    const t = n / sampleRate;

    if (sampleCount >= samplesPerSymbol) {
      currentPhase = qpskPhases[Math.floor(Math.random() * 4)];
      sampleCount = 0;
    }
    sampleCount++;

    const phase = currentPhase + phaseOffset + gauss(0, 3);
    data.push({
      time: parseFloat((t * 1e6).toFixed(3)),
      phase: parseFloat(phase.toFixed(2)),
    });
  }
  return data;
}

// ---------------------------------------------------------------
// Constellation Points (QPSK)
// ---------------------------------------------------------------
export function generateConstellationData(numPoints = 1500): ConstellationPoint[] {
  const idealSymbols = [
    { i: 0.707, q: 0.707 },
    { i: -0.707, q: 0.707 },
    { i: -0.707, q: -0.707 },
    { i: 0.707, q: -0.707 },
  ];

  const noiseStd = 0.045;  // matches ~18.7 dB SNR
  const points: ConstellationPoint[] = [];

  for (let n = 0; n < numPoints; n++) {
    const sym = idealSymbols[Math.floor(Math.random() * 4)];
    points.push({
      i: parseFloat((sym.i + gauss(0, noiseStd)).toFixed(4)),
      q: parseFloat((sym.q + gauss(0, noiseStd)).toFixed(4)),
    });
  }
  return points;
}

// ---------------------------------------------------------------
// Waterfall / Spectrogram Data (2D: time Ã— frequency)
// Returns a flat array of power values [time_bins Ã— freq_bins]
// ---------------------------------------------------------------
export function generateWaterfallData(
  timeBins = 100,
  freqBins = 256
): Float32Array {
  const data = new Float32Array(timeBins * freqBins);
  const centerBin = Math.floor(freqBins / 2);
  const sigWidthBins = Math.floor(freqBins * (0.1854 / 1.2)); // signal BW / total BW
  const noiseFloor = -72.4;
  const peakPower = -18.2;

  for (let t = 0; t < timeBins; t++) {
    for (let f = 0; f < freqBins; f++) {
      const dist = Math.abs(f - centerBin);
      const normalized = dist / (sigWidthBins / 2);
      const sincArg = Math.PI * normalized;
      const sincVal = sincArg !== 0 ? Math.sin(sincArg) / sincArg : 1;
      const shape = sincVal * sincVal;

      // Add time-varying amplitude (slight burst patterns)
      const timeEnvelope = 0.9 + 0.1 * Math.sin((2 * Math.PI * t) / 25);
      const signalPower = noiseFloor + (peakPower - noiseFloor) * shape * timeEnvelope;
      const noise = gauss(0, 1.2);

      data[t * freqBins + f] = Math.max(signalPower, noiseFloor) + noise;
    }
  }
  return data;
}

// ---------------------------------------------------------------
// Amplitude vs Time
// ---------------------------------------------------------------
export function generateAmplitudeData(numPoints = 300): Array<{ time: number; amplitude: number }> {
  return Array.from({ length: numPoints }, (_, i) => {
    const t = (i / numPoints) * 4.37;
    const amp = 0.707 + gauss(0, 0.025);
    return {
      time: parseFloat(t.toFixed(3)),
      amplitude: parseFloat(amp.toFixed(4)),
    };
  });
}

// ---------------------------------------------------------------
// Eye Diagram raw data (multiple overlaid traces)
// ---------------------------------------------------------------
export function generateEyeData(numTraces = 80, samplesPerTrace = 32): Array<Array<{ t: number; v: number }>> {
  const traces: Array<Array<{ t: number; v: number }>> = [];
  const noiseStd = 0.045;

  for (let tr = 0; tr < numTraces; tr++) {
    const startSymbol = Math.random() < 0.5 ? 0.707 : -0.707;
    const endSymbol = Math.random() < 0.5 ? 0.707 : -0.707;
    const trace: Array<{ t: number; v: number }> = [];

    for (let s = 0; s < samplesPerTrace; s++) {
      const alpha = s / (samplesPerTrace - 1);
      // Raised cosine interpolation
      const rcAlpha = (1 - Math.cos(Math.PI * alpha)) / 2;
      const v = startSymbol * (1 - rcAlpha) + endSymbol * rcAlpha + gauss(0, noiseStd);
      trace.push({ t: parseFloat((alpha * 2 - 1).toFixed(3)), v: parseFloat(v.toFixed(4)) });
    }
    traces.push(trace);
  }
  return traces;
}

// Export a seeded version so the data is stable on re-render
let _spectrumCache: SpectrumPoint[] | null = null;
let _iqCache: TimePoint[] | null = null;
let _freqCache: FreqPoint[] | null = null;
let _phaseCache: PhasePoint[] | null = null;
let _constellationCache: ConstellationPoint[] | null = null;
let _amplitudeCache: Array<{ time: number; amplitude: number }> | null = null;
let _waterfallCache: Float32Array | null = null;
let _eyeCache: Array<Array<{ t: number; v: number }>> | null = null;

let _livePreview: SignalPreview | null = null;

export function setLiveSignalPreview(preview: SignalPreview): void {
  _livePreview = preview;
}

export const MOCK_SPECTRUM = () => _livePreview?.spectrum ?? (_spectrumCache ??= generateSpectrumData());
export const MOCK_IQ = () => _livePreview?.iq ?? (_iqCache ??= generateIQData());
export const MOCK_FREQ_VS_TIME = () => _livePreview?.frequency ?? (_freqCache ??= generateFreqVsTimeData());
export const MOCK_PHASE_VS_TIME = () => _livePreview?.iq.map(({ time, phase }) => ({ time, phase })) ?? (_phaseCache ??= generatePhaseVsTimeData());
export const MOCK_CONSTELLATION = () => _livePreview?.iq.map(({ i, q }) => ({ i, q })) ?? (_constellationCache ??= generateConstellationData());
export const MOCK_AMPLITUDE = () => _livePreview?.iq.map(({ time, amplitude }) => ({ time, amplitude })) ?? (_amplitudeCache ??= generateAmplitudeData());
export const MOCK_WATERFALL = () => _livePreview ? Float32Array.from(_livePreview.waterfall.flat()) : (_waterfallCache ??= generateWaterfallData());
export const MOCK_EYE = () => _livePreview ? _livePreview.eye.map((trace) => trace.map((v, index) => ({ t: index / Math.max(trace.length - 1, 1) * 2 - 1, v }))) : (_eyeCache ??= generateEyeData());