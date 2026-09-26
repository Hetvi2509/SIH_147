import type { ComponentType } from 'react';
import type { SignalParameters } from '@/types';
import { formatCFO } from '@/utils/formatters';
import type { GraphInfo } from '@/components/common/InfoTip';
import {
  AmplitudePlot, ConstellationPlot, EyePlot, FreqPlot, IQPlot, PhasePlot, SpectrogramPlot, SpectrumPlot,
  type PlotProps,
} from './charts';

export type ChartId = 'iq' | 'spectrum' | 'waterfall' | 'constellation' | 'eye' | 'freq-time' | 'amplitude' | 'phase-time';

interface ChartDef {
  title: string;
  info: GraphInfo;
  Plot: ComponentType<PlotProps>;
  /** Only Recharts plots are zoomable; canvas plots are rendered at full extent. */
  zoomable: boolean;
  /** Header readouts, taken from the measured parameters when they exist. */
  meta: (p: SignalParameters | null) => [string, string][];
}

const dash = '—';

export const CHARTS: Record<ChartId, ChartDef> = {
  iq: {
    title: 'I/Q waveform',
    info: { what: 'The in-phase (I) and quadrature (Q) parts of the signal over time, plus its envelope.', use: 'check signal integrity and symbol transitions before classification.' }, Plot: IQPlot, zoomable: true,
    meta: (p) => [['Sample rate', p ? `${p.sampleRate} MS/s` : dash], ['Peak', p ? `${p.peakPower.toFixed(1)} dBm` : dash]],
  },
  spectrum: {
    title: 'FFT / spectrum',
    info: { what: 'Signal power across frequency.', use: 'locate the carrier and measure bandwidth, peak level and SNR.' }, Plot: SpectrumPlot, zoomable: true,
    meta: (p) => [
      ['Fc', p ? `${p.centerFrequency.toFixed(3)} MHz` : dash],
      ['BW', p ? `${p.bandwidth.toFixed(1)} kHz` : dash],
      ['SNR', p ? `${p.snr.toFixed(1)} dB` : dash],
    ],
  },
  waterfall: {
    title: 'Spectrogram',
    info: { what: 'How the spectrum changes over time. Colour shows power.', use: 'spot bursts, drift and hopping that a single spectrum hides.' }, Plot: SpectrogramPlot, zoomable: false,
    meta: (p) => [['Span', '1.85–3.05 MHz'], ['Duration', p ? `${p.duration.toFixed(2)} s` : dash]],
  },
  constellation: {
    title: 'Constellation',
    info: { what: 'Received symbols plotted as I against Q. Crosses mark the ideal points.', use: 'give the classifier its main evidence; cluster spread sets the EVM.' }, Plot: ConstellationPlot, zoomable: false,
    meta: (p) => [['EVM', p ? `${p.evm.toFixed(1)} %` : dash], ['Phase offset', p ? `${p.phaseOffset.toFixed(1)}°` : dash]],
  },
  eye: {
    title: 'Eye diagram',
    info: { what: 'The symbol waveform folded over one symbol period.', use: 'judge timing and noise margin. A wide-open eye means clean symbol decisions.' }, Plot: EyePlot, zoomable: false,
    meta: (p) => [['Symbol rate', p ? `${p.symbolRate} kSym/s` : dash]],
  },
  'freq-time': {
    title: 'Frequency vs time',
    info: { what: 'Instantaneous frequency over time.', use: 'show carrier offset and drift for synchronization.' }, Plot: FreqPlot, zoomable: true,
    meta: (p) => [['Carrier offset', p ? formatCFO(p.cfo) : dash]],
  },
  amplitude: {
    title: 'Amplitude vs time',
    info: { what: 'The signal envelope over time.', use: 'confirm power is stable and tell amplitude-based schemes apart.' }, Plot: AmplitudePlot, zoomable: true,
    meta: (p) => [['Avg power', p ? `${p.averagePower.toFixed(1)} dBm` : dash], ['Peak', p ? `${p.peakPower.toFixed(1)} dBm` : dash]],
  },
  'phase-time': {
    title: 'Phase vs time',
    info: { what: 'Instantaneous phase over time.', use: 'show the phase states and offset that carrier recovery must remove.' }, Plot: PhasePlot, zoomable: true,
    meta: (p) => [['Offset', p ? `${p.phaseOffset.toFixed(1)}°` : dash]],
  },
};

export const CHART_ORDER: ChartId[] = ['iq', 'spectrum', 'waterfall', 'constellation', 'eye', 'freq-time', 'amplitude', 'phase-time'];
