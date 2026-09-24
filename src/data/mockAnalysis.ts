// ============================================================
// Mock Analysis State — Default QPSK Demo Scenario
// ============================================================

import { buildBitStream } from './bitStream';
import type {
  FileMetadata, SignalParameters, ClassificationResult,
  SyncParameters, DemodulationResult, FECResult,
  InterleaverResult, BERResult, BitStreamResult, PipelineStage, AnalysisState, StageStatus,
} from '../types';

export const MOCK_FILE_METADATA: FileMetadata = {
  fileName: 'capture_qpsk_001.iq',
  fileSize: 26000000, // ~24.8 MB (10485760 samples × 4 bytes × 2 channels)
  fileType: 'IQ',
  format: 'Complex Float32',
  layout: 'Interleaved',
  sampleRate: 2.4,
  numSamples: 10485760,
  duration: 4.37,
  dataType: 'float32',
  endianness: 'Little',
};

export const MOCK_PARAMETERS: SignalParameters = {
  centerFrequency: 2.450,
  bandwidth: 185.4,
  occupiedBandwidth: 185.4,
  sampleRate: 2.4,
  snr: 18.7,
  symbolRate: 250,
  cfo: 2.8,
  phaseOffset: 13.4,
  duration: 4.37,
  channelPower: -21.1,
  signalPower: -18.2,
  noisePower: -72.4,
  peakPower: -16.8,
  averagePower: -19.4,
  evm: 4.7,
  channelCondition: 'AWGN',
  modulationQuality: 'Good',
};

export const MOCK_CLASSIFICATION: ClassificationResult = {
  modulation: 'QPSK',
  family: 'PSK',
  confidence: 96.4,
  topK: [
    { modulation: 'QPSK',    confidence: 96.4 },
    { modulation: 'BPSK',    confidence: 2.1 },
    { modulation: '8-PSK',   confidence: 0.8 },
    { modulation: '16-QAM',  confidence: 0.4 },
    { modulation: 'Noise',   confidence: 0.3 },
  ],
  inferenceTimeMs: 142,
  modelVersion: 'sr_mamba_amc_best',
  status: 'completed',
};

export const MOCK_SYNC: SyncParameters = {
  carrierLocked: true,
  timingLocked: true,
  cfoEstimate: 2.8,
  phaseOffset: 13.4,
  timingOffset: 2.3,
  matchedFilterApplied: true,
  syncWordDetected: true,
  burstDetected: false,
  status: 'completed',
};

export const MOCK_DEMODULATION: DemodulationResult = {
  detectedModulation: 'QPSK',
  demodulatorFamily: 'QPSK Coherent Demodulator',
  status: 'successful',
  recoveredSymbols: 1245892,
  recoveredBits: 2491784,
  berBeforeDecoding: 2.4e-2,
  berAfterDecoding: 3.1e-5,
};

export const MOCK_FEC: FECResult = {
  detected: true,
  family: 'LDPC',
  codeRate: '1/2',
  constraintLength: undefined,
  decodingStatus: 'successful',
  decodedBits: 1245892,
  errorBits: 39,
};

export const MOCK_INTERLEAVER: InterleaverResult = {
  detected: true,
  type: 'Block',
  depth: 1024,
  deinterleavingStatus: 'completed',
};

export const MOCK_BER: BERResult = {
  berBeforeFEC: 2.4e-2,
  berAfterFEC: 3.1e-5,
  totalBits: 2491784,
  errorBits: 77,
  decodedBits: 1245892,
};

export const MOCK_BITSTREAM: BitStreamResult = buildBitStream({
  totalBits: 2491784,
  invalidBits: 77,
  score: 0.94,
  encoding: 'QPSK, Gray-mapped',
});

export const MOCK_PIPELINE: PipelineStage[] = [
  { id: 'file-input', name: 'File Input', status: 'completed', duration: 48, timestamp: '10:01:22' },
  { id: 'preprocessing', name: 'Preprocessing', status: 'completed', duration: 312, timestamp: '10:01:22' },
  { id: 'parameter-extraction', name: 'Parameter Extraction', status: 'completed', duration: 891, timestamp: '10:01:23' },
  { id: 'modulation-classification', name: 'Modulation Classification', status: 'completed', duration: 142, timestamp: '10:01:24' },
  { id: 'synchronization', name: 'Synchronization', status: 'completed', duration: 524, timestamp: '10:01:24' },
  { id: 'demodulation', name: 'Demodulation', status: 'completed', duration: 218, timestamp: '10:01:25' },
  { id: 'fec-interleaver', name: 'FEC / Interleaver', status: 'completed', duration: 183, timestamp: '10:01:25' },
  { id: 'bit-stream-analysis', name: 'Bit Stream Analysis', status: 'completed', duration: 96, timestamp: '10:01:25' },
  { id: 'final-report', name: 'Final Report', status: 'completed', duration: 44, timestamp: '10:01:25' },
];

export const MOCK_INITIAL_STATE: AnalysisState = {
  fileMetadata: null,
  parameters: null,
  classification: null,
  sync: null,
  demodulation: null,
  fec: null,
  interleaver: null,
  ber: null,
  bitStream: null,
  pipeline: MOCK_PIPELINE.map((s) => ({ ...s, status: 'pending' as StageStatus })),
  analysisId: null,
  isLoading: false,
  error: null,
  overallStatus: 'idle',
  segmentStart: 0,
  segmentEnd: 0,
};

// Frontend-only mode: set VITE_USE_STATIC_DATA=true in .env.local
export const USE_STATIC_DATA = import.meta.env.VITE_USE_STATIC_DATA === 'true';

export const MOCK_COMPLETED_STATE: AnalysisState = {
  fileMetadata: MOCK_FILE_METADATA,
  parameters: MOCK_PARAMETERS,
  classification: MOCK_CLASSIFICATION,
  sync: MOCK_SYNC,
  demodulation: MOCK_DEMODULATION,
  fec: MOCK_FEC,
  interleaver: MOCK_INTERLEAVER,
  ber: MOCK_BER,
  bitStream: MOCK_BITSTREAM,
  pipeline: MOCK_PIPELINE,
  analysisId: 'analysis-static',
  isLoading: false,
  error: null,
  overallStatus: 'completed',
  segmentStart: 0,
  segmentEnd: MOCK_FILE_METADATA.duration,
};
