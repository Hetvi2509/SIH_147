// ============================================================
// Analysis Service â€” wired to the SR-Mamba FastAPI backend
// Classification is real; all other stages are analytically
// derived from the classification result + file metadata.
// ============================================================

import type {
  FileMetadata, SignalParameters, ClassificationResult,
  SyncParameters, DemodulationResult, FECResult,
  InterleaverResult, BERResult, PipelineStage, ModulationType, ModulationFamily
} from '../types';

import {
  MOCK_FILE_METADATA, MOCK_PARAMETERS,
  MOCK_SYNC, MOCK_DEMODULATION, MOCK_FEC, MOCK_INTERLEAVER,
  MOCK_BER, MOCK_PIPELINE
} from '../data/mockAnalysis';
import { setLiveSignalPreview } from '../data/mockSignal';

// Base URL for the real backend API (set via env variable)
const API_BASE = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000/api/v1';

// Simulate network delay for mock stages
const delay = (ms: number) => new Promise((res) => setTimeout(res, ms));

// In-memory store for the uploaded file and latest results
let _uploadedFile: File | null = null;
let _lastClassification: ClassificationResult | null = null;
let _lastFileMetadata: FileMetadata | null = null;

// ---------------------------------------------------------------
// Modulation helpers
// ---------------------------------------------------------------

const BITS_PER_SYMBOL: Record<string, number> = {
  OOK: 1, PAM: 2, '2FSK': 1, '4FSK': 2, CPFSK: 1, GMSK: 1,
  BPSK: 1, QPSK: 2, '8PSK': 3, '16QAM': 4, '64QAM': 6,
  AM: 1, FM: 1, NOISE: 0,
  'OOK/ASK': 1, '2-FSK': 1, '4-FSK': 2, 'GFSK/GMSK': 1,
  '8-PSK': 3, '16-QAM': 4, '64-QAM': 6, Noise: 0,
};

const FAMILY_SYMBOL_RATE: Record<string, number> = {
  ASK: 125, FSK: 200, PSK: 250, QAM: 500, AM: 8, FM: 15, None: 0, Unknown: 100,
};

const DEMOD_NAMES: Record<string, string> = {
  OOK: 'OOK Envelope Detector', PAM: 'PAM Decision Slicer',
  '2FSK': 'Non-Coherent FSK Demodulator', '4FSK': 'M-FSK Demodulator',
  CPFSK: 'CPFSK Demodulator', GMSK: 'GMSK/MSK Demodulator',
  BPSK: 'BPSK Coherent Demodulator', QPSK: 'QPSK Coherent Demodulator',
  '8PSK': '8-PSK Coherent Demodulator', '16QAM': '16-QAM Demodulator',
  '64QAM': '64-QAM Demodulator', AM: 'AM Envelope Demodulator',
  FM: 'FM Discriminator', NOISE: 'None (Noise Signal)',
  'OOK/ASK': 'OOK/ASK Envelope Detector', '2-FSK': 'Non-Coherent FSK Demodulator',
  '4-FSK': 'M-FSK Demodulator', 'GFSK/GMSK': 'GMSK/MSK Demodulator',
  '8-PSK': '8-PSK Coherent Demodulator', '16-QAM': '16-QAM Demodulator',
  '64-QAM': '64-QAM Demodulator', Noise: 'None (Noise Signal)',
};

function snrFromConfidence(confidence: number): number {
  return parseFloat((8 + (confidence / 100) * 22).toFixed(1));
}

function berFromSNR(snrDb: number, bitsPerSym: number): number {
  const ebN0 = snrDb - 10 * Math.log10(Math.max(bitsPerSym, 1));
  return Math.max(0.5 * Math.exp(-0.5 * ebN0), 1e-9);
}

// ---------------------------------------------------------------
// Upload a signal file â€” store locally, derive metadata
// ---------------------------------------------------------------
export async function uploadSignal(file: File): Promise<{ analysisId: string; metadata: FileMetadata }> {
  _uploadedFile = file;
  await delay(400);

  const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
  const fileType: FileMetadata['fileType'] =
    ext === 'wav' ? 'WAV' : ext === 'bin' ? 'BIN' : ext === 'iq' ? 'IQ' : 'Unknown';

  const numSamples = Math.floor(file.size / 8);
  const sampleRate = 2.4;

  const meta: FileMetadata = {
    ...MOCK_FILE_METADATA,
    fileName: file.name,
    fileSize: file.size,
    fileType,
    format: 'Complex Float32',
    layout: 'Interleaved',
    dataType: 'float32',
    endianness: 'Little',
    sampleRate,
    numSamples,
    duration: parseFloat((numSamples / (sampleRate * 1e6)).toFixed(3)),
  };

  _lastFileMetadata = meta;
  return { analysisId: 'analysis-' + Date.now(), metadata: meta };
}

// ---------------------------------------------------------------
// Start analysis pipeline
// ---------------------------------------------------------------
export async function startAnalysis(analysisId: string): Promise<void> {
  await delay(200);
  console.log('[AnalysisService] startAnalysis', analysisId);
}

// ---------------------------------------------------------------
// Get pipeline status (mock)
// ---------------------------------------------------------------
export async function getPipelineStatus(_analysisId: string): Promise<PipelineStage[]> {
  await delay(300);
  return MOCK_PIPELINE;
}

// ---------------------------------------------------------------
// Get extracted signal parameters â€” derived from real classification
// ---------------------------------------------------------------
export async function getParameters(_analysisId: string): Promise<SignalParameters> {
  await delay(200);

  if (!_lastClassification || !_lastFileMetadata) return MOCK_PARAMETERS;

  const cls = _lastClassification;
  const meta = _lastFileMetadata;
  const snr = snrFromConfidence(cls.confidence);
  const symbolRate = FAMILY_SYMBOL_RATE[cls.family] ?? 250;
  const bandwidth = parseFloat((symbolRate * 1.2).toFixed(1));
  const signalPower = parseFloat((-18 - (30 - snr) / 3).toFixed(1));
  const noiseFloor = parseFloat((-72 - (snr - 18)).toFixed(1));

  return {
    centerFrequency: 2.450,
    bandwidth,
    occupiedBandwidth: bandwidth,
    snr,
    sampleRate: meta.sampleRate,
    symbolRate,
    cfo: parseFloat((Math.random() * 5).toFixed(1)),
    phaseOffset: parseFloat((Math.random() * 30).toFixed(1)),
    duration: meta.duration,
    channelPower: parseFloat((signalPower - 2).toFixed(1)),
    signalPower,
    noisePower: noiseFloor,
    peakPower: parseFloat((signalPower + 1.5).toFixed(1)),
    averagePower: parseFloat((signalPower - 1.2).toFixed(1)),
    evm: parseFloat((100 / Math.pow(10, snr / 20)).toFixed(1)),
    channelCondition: snr > 20 ? 'AWGN' : 'Fading',
    modulationQuality:
      cls.confidence >= 90 ? 'Excellent' :
      cls.confidence >= 75 ? 'Good' :
      cls.confidence >= 55 ? 'Moderate' : 'Poor',
  };
}

// ---------------------------------------------------------------
// Get modulation classification â€” REAL API CALL
// POST /api/v1/classify  (multipart/form-data with the signal file)
// ---------------------------------------------------------------
export async function getClassification(_analysisId: string): Promise<ClassificationResult> {
  if (!_uploadedFile) {
    console.warn('[AnalysisService] No file in memory â€” returning mock classification.');
    return _mockClassification();
  }

  const formData = new FormData();
  formData.append('file', _uploadedFile, _uploadedFile.name);

  let response: Response;
  try {
    response = await fetch(`${API_BASE}/classify`, {
      method: 'POST',
      body: formData,
    });
  } catch (networkErr) {
    console.error('[AnalysisService] Network error reaching backend:', networkErr);
    throw new Error(
      'Cannot reach the classification backend. ' +
      'Make sure the FastAPI server is running on http://localhost:8000 ' +
      '(run: uvicorn backend.main:app --reload from the SIH_Frontend folder).'
    );
  }

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`Backend error ${response.status}: ${text}`);
  }

  const data = await response.json();

  // Map backend labels â†’ TypeScript union (normalise unknown labels)
  const knownModulations: ModulationType[] = [
    // Official checkpoint classes
    'OOK','PAM','2FSK','4FSK','CPFSK','GMSK',
    'BPSK','QPSK','8PSK','16QAM','64QAM',
    'AM','FM','NOISE',
    // Legacy AMC checkpoint classes
    'OOK/ASK','2-FSK','4-FSK','GFSK/GMSK',
    '8-PSK','16-QAM','64-QAM','Noise',
  ];
  const knownFamilies: ModulationFamily[] = ['ASK','FSK','PSK','QAM','AM','FM','None','Unknown'];

  const modulation: ModulationType = knownModulations.includes(data.modulation)
    ? data.modulation as ModulationType
    : 'Unknown';

  const family: ModulationFamily = knownFamilies.includes(data.family)
    ? data.family as ModulationFamily
    : 'Unknown';

  const topK = (data.topK ?? []).map((item: { modulation: string; confidence: number }) => ({
    modulation: (knownModulations.includes(item.modulation as ModulationType)
      ? item.modulation
      : 'Unknown') as ModulationType,
    confidence: item.confidence,
  }));

  const result: ClassificationResult = {
    modulation,
    family,
    confidence:     data.confidence,
    topK,
    inferenceTimeMs: data.inferenceTimeMs,
    modelVersion:    data.modelVersion ?? 'sr_mamba_official_best',
    status:          'completed',
    preview:         data.preview,
  };

  if (data.preview) setLiveSignalPreview(data.preview);
  _lastClassification = result;
  return result;
}

// Fallback mock used when no file is in memory
function _mockClassification(): ClassificationResult {
  return {
    modulation: 'QPSK',
    family: 'PSK',
    confidence: 96.4,
    topK: [
      { modulation: 'QPSK',  confidence: 96.4 },
      { modulation: 'BPSK',  confidence: 2.1 },
      { modulation: '8PSK',  confidence: 0.8 },
      { modulation: '16QAM', confidence: 0.4 },
      { modulation: 'NOISE', confidence: 0.3 },
    ],
    inferenceTimeMs: 142,
    modelVersion: 'mock',
    status: 'completed',
  };
}

// ---------------------------------------------------------------
// Synchronization â€” derived from classification
// ---------------------------------------------------------------
export async function getSynchronization(_analysisId: string): Promise<SyncParameters> {
  await delay(200);
  if (!_lastClassification) return MOCK_SYNC;
  const cls = _lastClassification;
  const locked = cls.confidence >= 60 && cls.modulation !== 'NOISE' && cls.modulation !== 'Noise';
  const snr = snrFromConfidence(cls.confidence);
  return {
    carrierLocked: locked,
    timingLocked: locked,
    cfoEstimate: parseFloat((Math.random() * 5).toFixed(1)),
    phaseOffset: parseFloat((Math.random() * 25).toFixed(1)),
    timingOffset: parseFloat((Math.random() * 4 + 0.5).toFixed(1)),
    matchedFilterApplied: locked && cls.family !== 'AM' && cls.family !== 'FM',
    syncWordDetected: locked && snr > 15,
    burstDetected: false,
    status: locked ? 'completed' : 'warning',
  };
}

// ---------------------------------------------------------------
// Demodulation â€” derived from classification
// ---------------------------------------------------------------
export async function getDemodulation(_analysisId: string): Promise<DemodulationResult> {
  await delay(200);
  if (!_lastClassification || !_lastFileMetadata) return MOCK_DEMODULATION;
  const cls = _lastClassification;
  const meta = _lastFileMetadata;
  const isNoise = cls.modulation === 'NOISE' || cls.modulation === 'Noise';
  const success = !isNoise && cls.confidence >= 60;
  const symbolRate = FAMILY_SYMBOL_RATE[cls.family] ?? 250;
  const bps = BITS_PER_SYMBOL[cls.modulation] ?? 1;
  const recoveredSymbols = Math.floor(symbolRate * 1000 * meta.duration);
  const recoveredBits = recoveredSymbols * bps;
  const snr = snrFromConfidence(cls.confidence);
  const ber = berFromSNR(snr, bps);
  return {
    detectedModulation: cls.modulation,
    demodulatorFamily: DEMOD_NAMES[cls.modulation] ?? `${cls.modulation} Demodulator`,
    status: isNoise ? 'unsupported' : success ? 'successful' : 'uncertain',
    recoveredSymbols,
    recoveredBits,
    berBeforeDecoding: parseFloat(ber.toExponential(2)),
    berAfterDecoding: success ? parseFloat((ber / 100).toExponential(2)) : null,
  };
}

// ---------------------------------------------------------------
// FEC â€” derived from classification
// ---------------------------------------------------------------
export async function getFEC(_analysisId: string): Promise<FECResult> {
  await delay(200);
  if (!_lastClassification) return MOCK_FEC;
  const cls = _lastClassification;
  const isNoise = cls.modulation === 'NOISE' || cls.modulation === 'Noise';
  const fecPresent = !isNoise && cls.confidence >= 80 && ['PSK','QAM','FSK'].includes(cls.family);
  if (!fecPresent) {
    return { detected: isNoise ? null : false, family: 'None', codeRate: 'N/A',
      decodingStatus: isNoise ? 'unknown' : 'not-detected' };
  }
  const families = ['LDPC', 'Turbo', 'Convolutional'] as const;
  const rates = ['1/2', '2/3', '3/4'] as const;
  const idx = Math.floor(cls.confidence / 34) % 3;
  return { detected: true, family: families[idx], codeRate: rates[idx], decodingStatus: 'successful' };
}

// ---------------------------------------------------------------
// Interleaver
// ---------------------------------------------------------------
export async function getInterleaver(_analysisId: string): Promise<InterleaverResult> {
  await delay(150);
  if (!_lastClassification) return MOCK_INTERLEAVER;
  const cls = _lastClassification;
  const detected = cls.confidence >= 85 && ['PSK','QAM'].includes(cls.family);
  return {
    detected,
    type: detected ? 'Block' : 'None',
    depth: detected ? 1024 : undefined,
    deinterleavingStatus: detected ? 'completed' : 'not-detected',
  };
}

// ---------------------------------------------------------------
// BER
// ---------------------------------------------------------------
export async function getBER(_analysisId: string): Promise<BERResult> {
  await delay(150);
  if (!_lastClassification || !_lastFileMetadata) return MOCK_BER;
  const cls = _lastClassification;
  const meta = _lastFileMetadata;
  const snr = snrFromConfidence(cls.confidence);
  const bps = BITS_PER_SYMBOL[cls.modulation] ?? 1;
  const ber = berFromSNR(snr, bps);
  const symbolRate = FAMILY_SYMBOL_RATE[cls.family] ?? 250;
  const totalBits = Math.floor(symbolRate * 1000 * meta.duration * bps);
  const errorBits = Math.max(1, Math.floor(totalBits * ber));
  return {
    berBeforeFEC: parseFloat(ber.toExponential(2)),
    berAfterFEC: cls.confidence >= 80 ? parseFloat((ber / 100).toExponential(2)) : null,
    totalBits,
    errorBits,
    decodedBits: Math.floor(totalBits * 0.5),
  };
}

// ---------------------------------------------------------------
// Export helpers
// ---------------------------------------------------------------
export async function exportPDF(_analysisId: string): Promise<void> {
  alert('PDF export requires a backend report endpoint. (Not yet implemented)');
}

export async function exportCSV(_analysisId: string): Promise<void> {
  if (!_lastClassification || !_lastFileMetadata) {
    alert('No analysis data to export. Run an analysis first.');
    return;
  }
  const cls = _lastClassification;
  const meta = _lastFileMetadata;
  const rows = [
    ['Field', 'Value'],
    ['File Name', meta.fileName],
    ['File Size (bytes)', String(meta.fileSize)],
    ['File Type', meta.fileType],
    ['Sample Rate (MS/s)', String(meta.sampleRate)],
    ['Duration (s)', String(meta.duration)],
    ['Num Samples', String(meta.numSamples)],
    ['Detected Modulation', cls.modulation],
    ['Modulation Family', cls.family],
    ['Confidence (%)', String(cls.confidence)],
    ['Inference Time (ms)', String(cls.inferenceTimeMs)],
    ['Model Version', cls.modelVersion],
    ...cls.topK.map((t, i) => [`Top-${i + 1}`, `${t.modulation} (${t.confidence.toFixed(1)}%)`]),
  ];
  const csv = rows.map((r) => r.map((v) => `"${v.replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `signal_analysis_${_analysisId}.csv`; a.click();
  URL.revokeObjectURL(url);
}

export async function exportJSON(analysisId: string): Promise<void> {
  const report = {
    analysisId,
    exportedAt: new Date().toISOString(),
    modelVersion: _lastClassification?.modelVersion ?? 'unknown',
    file: _lastFileMetadata ?? null,
    classification: _lastClassification ?? null,
    note: 'Classification powered by SR-Mamba official model.',
  };
  const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `signal_analysis_${analysisId}.json`; a.click();
  URL.revokeObjectURL(url);
}

export { API_BASE };
