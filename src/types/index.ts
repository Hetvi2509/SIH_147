// ============================================================
// RF Signal Analysis Dashboard â€” Type Definitions
// ============================================================

export type AnalysisStage =
  | 'file-input'
  | 'preprocessing'
  | 'parameter-extraction'
  | 'modulation-classification'
  | 'synchronization'
  | 'demodulation'
  | 'fec-interleaver'
  | 'final-report';

export type StageStatus = 'pending' | 'processing' | 'completed' | 'warning' | 'failed';

// These labels match both the SR-Mamba official (14-class) and legacy AMC (12-class) checkpoints
export type ModulationType =
  // Official checkpoint classes
  | 'OOK' | 'PAM' | '2FSK' | '4FSK' | 'CPFSK' | 'GMSK'
  | 'BPSK' | 'QPSK' | '8PSK' | '16QAM' | '64QAM'
  | 'AM' | 'FM' | 'NOISE'
  // Legacy AMC checkpoint classes
  | 'OOK/ASK' | '2-FSK' | '4-FSK' | 'GFSK/GMSK'
  | '8-PSK' | '16-QAM' | '64-QAM' | 'Noise' | 'Unknown';

export type ModulationFamily = 'ASK' | 'FSK' | 'PSK' | 'QAM' | 'AM' | 'FM' | 'None' | 'Unknown';

export type IQFormat = 'Complex Float32' | 'Complex Float64' | 'Complex Int16' | 'Complex Int8' | 'Unknown';

export type IQLayout = 'Interleaved' | 'Separate' | 'Unknown';

export type ChannelCondition = 'AWGN' | 'Fading' | 'Unknown';

export type FECFamily = 'LDPC' | 'Turbo' | 'Convolutional' | 'Reed-Solomon' | 'Polar' | 'None' | 'Unknown';

export type InterleaverType = 'Block' | 'Convolutional' | 'Random' | 'None' | 'Unknown';

export interface FileMetadata {
  fileName: string;
  fileSize: number;
  fileType: 'IQ' | 'WAV' | 'BIN' | 'Unknown';
  format: IQFormat;
  layout: IQLayout;
  sampleRate: number;        // MS/s
  numSamples: number;
  duration: number;          // seconds
  dataType: string;
  endianness?: 'Little' | 'Big';
  channels?: number;         // WAV channels
  wavInterpretation?: 'Mono' | 'Stereo-IQ' | 'Unknown';
}

export interface SignalParameters {
  centerFrequency: number;   // MHz
  bandwidth: number;         // kHz
  occupiedBandwidth: number; // kHz
  snr: number;               // dB
  sampleRate: number;        // MS/s
  symbolRate: number;        // kSym/s
  cfo: number;               // kHz (carrier freq offset)
  phaseOffset: number;       // degrees
  duration: number;          // seconds
  channelPower: number;      // dBm
  signalPower: number;       // dBm
  noisePower: number;        // dBm
  peakPower: number;         // dBm
  averagePower: number;      // dBm
  evm: number;               // % RMS
  channelCondition: ChannelCondition;
  modulationQuality: 'Excellent' | 'Good' | 'Moderate' | 'Poor' | 'Unknown';
}

export interface ClassificationResult {
  modulation: ModulationType;
  family: ModulationFamily;
  confidence: number;         // 0-100
  topK: Array<{ modulation: ModulationType; confidence: number }>;
  inferenceTimeMs: number;
  modelVersion: string;
  status: 'ready' | 'running' | 'completed' | 'failed';
  preview?: SignalPreview;
}

export interface SyncParameters {
  carrierLocked: boolean;
  timingLocked: boolean;
  cfoEstimate: number;        // kHz
  phaseOffset: number;        // degrees
  timingOffset: number;       // samples
  matchedFilterApplied: boolean;
  syncWordDetected: boolean;
  burstDetected: boolean;
  status: StageStatus;
}

export interface DemodulationResult {
  detectedModulation: ModulationType;
  demodulatorFamily: string;
  status: 'successful' | 'failed' | 'uncertain' | 'unsupported' | 'sync-required';
  recoveredSymbols: number;
  recoveredBits: number;
  berBeforeDecoding: number;
  berAfterDecoding: number | null;
}

export interface FECResult {
  detected: boolean | null;
  family: FECFamily;
  codeRate: string;
  constraintLength?: number;
  decodingStatus: 'successful' | 'failed' | 'unknown' | 'unsupported' | 'not-detected';
  decodedBits?: number;
  errorBits?: number;
}

export interface InterleaverResult {
  detected: boolean | null;
  type: InterleaverType;
  depth?: number;
  deinterleavingStatus: 'completed' | 'failed' | 'unknown' | 'not-detected';
}

export interface BERResult {
  berBeforeFEC: number;
  berAfterFEC: number | null;
  totalBits: number;
  errorBits: number;
  decodedBits?: number;
}

export interface PipelineStage {
  id: AnalysisStage;
  name: string;
  status: StageStatus;
  duration?: number;   // ms
  timestamp?: string;
  message?: string;
}

export interface AnalysisState {
  fileMetadata: FileMetadata | null;
  parameters: SignalParameters | null;
  classification: ClassificationResult | null;
  sync: SyncParameters | null;
  demodulation: DemodulationResult | null;
  fec: FECResult | null;
  interleaver: InterleaverResult | null;
  ber: BERResult | null;
  pipeline: PipelineStage[];
  analysisId: string | null;
  isLoading: boolean;
  error: string | null;
  overallStatus: 'idle' | 'uploading' | 'analyzing' | 'completed' | 'error';
  segmentStart: number;
  segmentEnd: number;
}

// Chart data point types
export interface SpectrumPoint { freq: number; power: number; noise: number }
export interface SignalPreview {
  iq: TimePoint[];
  spectrum: SpectrumPoint[];
  frequency: FreqPoint[];
  waterfall: number[][];
  eye: number[][];
  sampleCount: number;
  meanAmplitude: number;
  paprDb: number;
}
export interface TimePoint { time: number; i: number; q: number; amplitude: number; phase: number }
export interface FreqPoint { time: number; frequency: number }
export interface PhasePoint { time: number; phase: number }
export interface ConstellationPoint { i: number; q: number }
