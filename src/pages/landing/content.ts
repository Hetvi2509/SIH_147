import {
  ArrowsClockwise, Binary, ChartLineUp, Cpu, FileArrowDown, FileArrowUp, Gauge, Graph, ShieldCheck,
  SlidersHorizontal, WaveSine, Waves, FileText,
} from '@phosphor-icons/react';
import type { Icon } from '@phosphor-icons/react';

export interface Step { icon: Icon; title: string; text: string }
export interface Feature { icon: Icon; title: string; text: string }

/** The nine stages the app actually runs, in order. */
export const PIPELINE: Step[] = [
  { icon: FileArrowUp, title: 'Ingest', text: 'Load an IQ, WAV or BIN recording and read its format.' },
  { icon: Waves, title: 'Preprocess', text: 'Normalize the samples and prepare them for analysis.' },
  { icon: SlidersHorizontal, title: 'Extract parameters', text: 'Center frequency, bandwidth, SNR, symbol rate and offsets.' },
  { icon: Cpu, title: 'Recognize modulation', text: 'Classify the scheme and report confidence for each class.' },
  { icon: ArrowsClockwise, title: 'Synchronize', text: 'Recover the carrier and symbol timing.' },
  { icon: WaveSine, title: 'Demodulate', text: 'Turn synchronized symbols into bits.' },
  { icon: ShieldCheck, title: 'Decode FEC', text: 'Detect coding and interleaving, then correct errors.' },
  { icon: Binary, title: 'Analyze the bit stream', text: 'Inspect recovered data and correlate it with a reference.' },
  { icon: FileText, title: 'Report', text: 'Collect every stage into one exportable report.' },
];

export const FEATURES: Feature[] = [
  { icon: Cpu, title: 'Automatic modulation recognition', text: 'A trained classifier identifies the scheme across 14 classes and shows how decisive the result is, class by class.' },
  { icon: Gauge, title: 'Signal measurements', text: 'Center frequency, bandwidth, SNR, EVM, power and offsets, measured once and reused by every later stage.' },
  { icon: ArrowsClockwise, title: 'Synchronization', text: 'Carrier and symbol-timing recovery with lock status, so demodulation starts from clean symbols.' },
  { icon: ShieldCheck, title: 'FEC and interleaver detection', text: 'Finds the coding family and rate, undoes interleaving, and reports the bit error rate before and after.' },
  { icon: Binary, title: 'Reliable data recovery', text: 'Recovered bits with valid and invalid counts, plus correlation against a reference sequence.' },
  { icon: ChartLineUp, title: 'Multi-domain visualization', text: 'Waveform, spectrum, spectrogram, constellation and eye diagram side by side, each with a detail view.' },
];

export const STATS: { value: string; label: string }[] = [
  { value: '14', label: 'modulation classes' },
  { value: '9', label: 'pipeline stages' },
  { value: '3', label: 'input formats' },
  { value: '3', label: 'export formats' },
];

export const FAMILIES: { name: string; items: string[] }[] = [
  { name: 'ASK', items: ['OOK', 'PAM'] },
  { name: 'FSK', items: ['2FSK', '4FSK', 'CPFSK', 'GMSK'] },
  { name: 'PSK', items: ['BPSK', 'QPSK', '8PSK'] },
  { name: 'QAM', items: ['16QAM', '64QAM'] },
  { name: 'Analog', items: ['AM', 'FM'] },
  { name: 'Reference', items: ['NOISE'] },
];

export const IO = {
  inputs: [
    { icon: FileArrowUp, title: '.iq', text: 'Interleaved float32 I/Q' },
    { icon: WaveSine, title: '.wav', text: 'Stereo I/Q or mono signal' },
    { icon: Graph, title: '.bin', text: 'Raw binary I/Q' },
  ],
  outputs: [
    { icon: FileText, title: 'PDF report', text: 'Every stage, with charts' },
    { icon: FileArrowDown, title: 'CSV', text: 'Flat results for spreadsheets' },
    { icon: FileArrowDown, title: 'JSON', text: 'Structured results for tooling' },
  ],
};
