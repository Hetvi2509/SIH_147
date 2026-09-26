// ============================================================
// Analysis Service — wired to the SR-Mamba FastAPI backend
// Classification is real; all other stages are analytically
// derived from the classification result + file metadata.
// ============================================================

import type {
  FileMetadata, SignalParameters, ClassificationResult,
  SyncParameters, DemodulationResult, FECResult,
  InterleaverResult, BERResult, BitStreamResult, AnalysisState, PipelineStage, ModulationType, ModulationFamily
} from '../types';

import {
  MOCK_FILE_METADATA, MOCK_PARAMETERS,
  MOCK_SYNC, MOCK_DEMODULATION, MOCK_FEC, MOCK_INTERLEAVER,
  MOCK_BER, MOCK_BITSTREAM, MOCK_PIPELINE, USE_STATIC_DATA
} from '../data/mockAnalysis';
import { setLiveSignalPreview } from '../data/mockSignal';
import { getAuthToken } from '../lib/auth';

// Base URL for the real backend API (set via env variable)
const API_BASE = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000/api/v1';

// Simulate network delay for mock stages
const delay = (ms: number) => new Promise((res) => setTimeout(res, ms));

// In-memory store for the uploaded file and latest results
let _uploadedFile: File | null = null;
let _lastClassification: ClassificationResult | null = null;
let _lastFileMetadata: FileMetadata | null = null;
interface RawDemod {
  ok: boolean;
  reason?: string;
  sps?: number;
  bitsPerSymbol?: number;
  nBits?: number;
  nSymbols?: number;
  berEstimate?: number;
}
type BitstreamFecResult = { demod: RawDemod; fec: FECResult; interleaver: InterleaverResult; bitStream: BitStreamResult };
let _bitstreamFecCache: BitstreamFecResult | null = null;
let _bitstreamFecPromise: Promise<BitstreamFecResult> | null = null;

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
// Upload a signal file — store locally, derive metadata
// ---------------------------------------------------------------
export async function uploadSignal(file: File): Promise<{ analysisId: string; metadata: FileMetadata }> {
  _uploadedFile = file;
  _bitstreamFecCache = null;
  _bitstreamFecPromise = null;
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
}

// ---------------------------------------------------------------
// Get pipeline status (mock)
// ---------------------------------------------------------------
export async function getPipelineStatus(_analysisId: string): Promise<PipelineStage[]> {
  await delay(300);
  return MOCK_PIPELINE;
}

// ---------------------------------------------------------------
// Get extracted signal parameters — derived from real classification
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
// Get modulation classification — REAL API CALL
// POST /api/v1/classify  (multipart/form-data with the signal file)
// ---------------------------------------------------------------
export async function getClassification(_analysisId: string): Promise<ClassificationResult> {
  if (USE_STATIC_DATA || !_uploadedFile) {
    console.warn('[AnalysisService] No file in memory — returning mock classification.');
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

  // Map backend labels → TypeScript union (normalise unknown labels)
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
// Synchronization — derived from classification
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
// Demodulation — REAL API CALL (via getBitstreamFecAnalysis, cached alongside
// FEC/interleaver/bit-stream). Bits + LLRs come from codem_demodulation.pt
// (backend/codem_demod.py), not a confidence-derived formula.
// ---------------------------------------------------------------
export async function getDemodulation(_analysisId: string): Promise<DemodulationResult> {
  if (!_lastClassification || !_lastFileMetadata) return MOCK_DEMODULATION;
  const cls = _lastClassification;
  const isNoise = cls.modulation === 'NOISE' || cls.modulation === 'Noise';

  const { demod, fec, bitStream } = await getBitstreamFecAnalysis();

  if (isNoise || !demod.ok) {
    return {
      detectedModulation: cls.modulation,
      demodulatorFamily: DEMOD_NAMES[cls.modulation] ?? `${cls.modulation} Demodulator`,
      status: 'unsupported',
      recoveredSymbols: 0,
      recoveredBits: 0,
      berBeforeDecoding: 0,
      berAfterDecoding: null,
    };
  }

  const berBeforeDecoding = demod.berEstimate ?? 0;
  const fecSuccessful = fec.decodingStatus === 'successful' && fec.decodedBits;
  const berAfterDecoding = fecSuccessful
    ? (fec.errorBits ?? 0) / (fec.decodedBits as number)
    : null;

  return {
    detectedModulation: cls.modulation,
    demodulatorFamily: DEMOD_NAMES[cls.modulation] ?? `${cls.modulation} Demodulator`,
    status: fecSuccessful ? 'successful' : berBeforeDecoding <= 0.4 ? 'uncertain' : 'failed',
    recoveredSymbols: demod.nSymbols ?? 0,
    recoveredBits: demod.nBits ?? bitStream.recovered.totalBits,
    berBeforeDecoding: parseFloat(berBeforeDecoding.toExponential(2)),
    berAfterDecoding: berAfterDecoding !== null ? parseFloat(berAfterDecoding.toExponential(2)) : null,
  };
}

// ---------------------------------------------------------------
// FEC + interleaver + bit-stream — REAL API CALL
// POST /api/v1/bitstream-fec (multipart/form-data with the signal file +
// the classified modulation). Runs the actual fec_interlevaer/fec/slate_api.py
// Viterbi decode + de-interleaving and bit_stream_anaylsis Tier 1 frame/CRC
// recovery on bits blindly demodulated from the uploaded signal.
// ---------------------------------------------------------------
function getBitstreamFecAnalysis(): Promise<BitstreamFecResult> {
  if (_bitstreamFecCache) return Promise.resolve(_bitstreamFecCache);
  if (_bitstreamFecPromise) return _bitstreamFecPromise;

  const mockResult: BitstreamFecResult = {
    demod: { ok: false, reason: 'mock data' },
    fec: MOCK_FEC, interleaver: MOCK_INTERLEAVER, bitStream: MOCK_BITSTREAM,
  };
  if (USE_STATIC_DATA || !_uploadedFile || !_lastClassification) {
    return Promise.resolve(mockResult);
  }

  const formData = new FormData();
  formData.append('file', _uploadedFile, _uploadedFile.name);
  formData.append('modulation', _lastClassification.modulation);
  formData.append('family', _lastClassification.family);

  _bitstreamFecPromise = fetch(`${API_BASE}/bitstream-fec`, { method: 'POST', body: formData })
    .then(async (response) => {
      if (!response.ok) {
        const text = await response.text().catch(() => '');
        throw new Error(`Backend error ${response.status}: ${text}`);
      }
      const data = await response.json();
      const result: BitstreamFecResult = {
        demod: data.demod as RawDemod,
        fec: data.fec as FECResult, interleaver: data.interleaver as InterleaverResult, bitStream: data.bitstream as BitStreamResult,
      };
      _bitstreamFecCache = result;
      return result;
    })
    .catch((err) => {
      console.error('[AnalysisService] bitstream-fec request failed:', err);
      _bitstreamFecPromise = null;
      return mockResult;
    });

  return _bitstreamFecPromise;
}

export async function getFEC(_analysisId: string): Promise<FECResult> {
  return (await getBitstreamFecAnalysis()).fec;
}

export async function getInterleaver(_analysisId: string): Promise<InterleaverResult> {
  return (await getBitstreamFecAnalysis()).interleaver;
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
// Bit stream analysis — real recovered data + correlation, from Tier 1 of
// bit_stream_anaylsis run on blindly-demodulated bits (see getBitstreamFecAnalysis).
// ---------------------------------------------------------------
export async function getBitStream(_analysisId: string): Promise<BitStreamResult> {
  if (!_lastClassification || !_lastFileMetadata) return MOCK_BITSTREAM;
  return (await getBitstreamFecAnalysis()).bitStream;
}

// ---------------------------------------------------------------
// Export helpers
// ---------------------------------------------------------------
export async function exportPDF(_analysisId: string, snapshot: AnalysisState): Promise<void> {
  if (!snapshot.classification) {
    alert('No analysis data to export. Run an analysis first.');
    return;
  }
  const { downloadReportPdf } = await import('../report/generatePdf');
  await downloadReportPdf(snapshot);
}

function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = name; a.click();
  URL.revokeObjectURL(url);
}

export async function exportCSV(analysisId: string, s: AnalysisState): Promise<void> {
  const cls = s.classification ?? _lastClassification;
  const meta = s.fileMetadata ?? _lastFileMetadata;
  if (!cls || !meta) {
    alert('No analysis data to export. Run an analysis first.');
    return;
  }
  const bs = s.bitStream;
  const rows: string[][] = [
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
    ...(bs ? [
      ['Recovered Bits (total)', String(bs.recovered.totalBits)],
      ['Recovered Bits (valid)', String(bs.recovered.validBits)],
      ['Recovered Bits (invalid)', String(bs.recovered.invalidBits)],
      ['Recovered Data Preview (bits)', bs.recovered.bitPreview],
      ['Recovered Data Preview (hex)', bs.recovered.hexPreview],
      ['Correlation Score', bs.correlation.score.toFixed(3)],
      ['Correlation Peak Lag (symbols)', String(bs.correlation.peakLag)],
      ['Correlation Reference', bs.correlation.reference],
      ['Correlation Sidelobe Ratio (dB)', String(bs.correlation.sidelobeRatioDb)],
    ] : []),
  ];
  const csv = rows.map((r) => r.map((v) => `"${v.replace(/"/g, '""')}"`).join(',')).join('\n');
  download(new Blob([csv], { type: 'text/csv' }), `signal_analysis_${analysisId}.csv`);
}

export async function exportJSON(analysisId: string, s: AnalysisState): Promise<void> {
  const report = {
    analysisId,
    exportedAt: new Date().toISOString(),
    modelVersion: (s.classification ?? _lastClassification)?.modelVersion ?? 'unknown',
    file: s.fileMetadata ?? _lastFileMetadata ?? null,
    parameters: s.parameters,
    classification: s.classification ?? _lastClassification ?? null,
    synchronization: s.sync,
    demodulation: s.demodulation,
    fec: s.fec,
    interleaver: s.interleaver,
    ber: s.ber,
    bitStreamAnalysis: s.bitStream
      ? { recoveredData: s.bitStream.recovered, correlation: s.bitStream.correlation }
      : null,
    note: 'Classification powered by SR-Mamba official model.',
  };
  download(new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' }), `signal_analysis_${analysisId}.json`);
}

export { API_BASE };

// ---------------------------------------------------------------
// History — full run snapshots stored in Postgres (backend/history.py),
// so past analyses (data + graphs) can be revisited later.
// ---------------------------------------------------------------
export interface HistorySnapshot {
  fileMetadata: FileMetadata | null;
  parameters: SignalParameters | null;
  classification: ClassificationResult | null;
  sync: SyncParameters | null;
  demodulation: DemodulationResult | null;
  fec: FECResult | null;
  interleaver: InterleaverResult | null;
  ber: BERResult | null;
  bitStream: BitStreamResult | null;
}

/** Cheap, table-ready fields, stored alongside the full snapshot so the history list never has
 *  to fetch the (much larger) preview/graph payload just to render a row. */
export interface HistorySummary {
  id: number;
  fileName: string;
  modulation: string;
  confidence: number;
  createdAt: number;
  family: string | null;
  snr: number | null;
  symbolRate: number | null;
  duration: number | null;
  sampleRate: number | null;
  recoveredBits: number | null;
  berAfter: number | null;
  demodStatus: string | null;
  fecDetected: boolean | null;
  fecFamily: string | null;
}

function authHeaders(): Record<string, string> {
  const token = getAuthToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function buildSummary(s: AnalysisState): Omit<HistorySummary, 'id' | 'fileName' | 'modulation' | 'confidence' | 'createdAt'> {
  return {
    family: s.classification?.family ?? null,
    snr: s.parameters?.snr ?? null,
    symbolRate: s.parameters?.symbolRate ?? null,
    duration: s.fileMetadata?.duration ?? null,
    sampleRate: s.fileMetadata?.sampleRate ?? null,
    recoveredBits: s.demodulation?.recoveredBits ?? null,
    berAfter: s.demodulation?.berAfterDecoding ?? null,
    demodStatus: s.demodulation?.status ?? null,
    fecDetected: s.fec?.detected ?? null,
    fecFamily: s.fec?.family ?? null,
  };
}

/** Fire-and-forget: persists a completed run so it shows up in /history. Never throws. */
export async function saveAnalysisToHistory(s: AnalysisState): Promise<void> {
  const cls = s.classification;
  const meta = s.fileMetadata;
  if (!cls || !meta || !getAuthToken()) return;
  const snapshot: HistorySnapshot = {
    fileMetadata: meta, parameters: s.parameters, classification: cls, sync: s.sync,
    demodulation: s.demodulation, fec: s.fec, interleaver: s.interleaver, ber: s.ber, bitStream: s.bitStream,
  };
  try {
    await fetch(`${API_BASE}/history`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({
        fileName: meta.fileName, modulation: cls.modulation, confidence: cls.confidence,
        summary: buildSummary(s), data: snapshot,
      }),
    });
  } catch (err) {
    console.error('[AnalysisService] Failed to save analysis to history:', err);
  }
}

export async function listAnalysisHistory(): Promise<HistorySummary[]> {
  const res = await fetch(`${API_BASE}/history`, { headers: authHeaders() });
  if (!res.ok) throw new Error(`Failed to load history (${res.status}).`);
  return res.json();
}

export async function getAnalysisHistoryEntry(id: number): Promise<HistorySummary & { data: HistorySnapshot }> {
  const res = await fetch(`${API_BASE}/history/${id}`, { headers: authHeaders() });
  if (!res.ok) throw new Error(`Failed to load analysis (${res.status}).`);
  return res.json();
}

export async function deleteAnalysisHistoryEntry(id: number): Promise<void> {
  const res = await fetch(`${API_BASE}/history/${id}`, { method: 'DELETE', headers: authHeaders() });
  if (!res.ok) throw new Error(`Failed to delete analysis (${res.status}).`);
}
