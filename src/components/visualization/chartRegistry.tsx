import type { ComponentType } from 'react';
import type { SignalParameters } from '@/types';
import { formatCFO } from '@/utils/formatters';
import {
  AmplitudePlot, ConstellationPlot, EyePlot, FreqPlot, IQPlot, PhasePlot, SpectrogramPlot, SpectrumPlot,
  type PlotProps,
} from './charts';

export type ChartId = 'iq' | 'spectrum' | 'waterfall' | 'constellation' | 'eye' | 'freq-time' | 'amplitude' | 'phase-time';

interface ChartDef {
  title: string;
  Plot: ComponentType<PlotProps>;
  /** Only Recharts plots are zoomable; canvas plots are rendered at full extent. */
  zoomable: boolean;
  /** Header readouts, taken from the measured parameters when they exist. */
  meta: (p: SignalParameters | null) => [string, string][];
}

const dash = '—';

export const CHARTS: Record<ChartId, ChartDef> = {
  iq: {
    title: 'I/Q waveform', Plot: IQPlot, zoomable: true,
    meta: (p) => [['Sample rate', p ? `${p.sampleRate} MS/s` : dash], ['Peak', p ? `${p.peakPower.toFixed(1)} dBm` : dash]],
  },
  spectrum: {
    title: 'FFT / spectrum', Plot: SpectrumPlot, zoomable: true,
    meta: (p) => [
      ['Fc', p ? `${p.centerFrequency.toFixed(3)} MHz` : dash],
      ['BW', p ? `${p.bandwidth.toFixed(1)} kHz` : dash],
      ['SNR', p ? `${p.snr.toFixed(1)} dB` : dash],
    ],
  },
  waterfall: {
    title: 'Spectrogram', Plot: SpectrogramPlot, zoomable: false,
    meta: (p) => [['Span', '1.85–3.05 MHz'], ['Duration', p ? `${p.duration.toFixed(2)} s` : dash]],
  },
  constellation: {
    title: 'Constellation', Plot: ConstellationPlot, zoomable: false,
    meta: (p) => [['EVM', p ? `${p.evm.toFixed(1)} %` : dash], ['Phase offset', p ? `${p.phaseOffset.toFixed(1)}°` : dash]],
  },
  eye: {
    title: 'Eye diagram', Plot: EyePlot, zoomable: false,
    meta: (p) => [['Symbol rate', p ? `${p.symbolRate} kSym/s` : dash]],
  },
  'freq-time': {
    title: 'Frequency vs time', Plot: FreqPlot, zoomable: true,
    meta: (p) => [['Carrier offset', p ? formatCFO(p.cfo) : dash]],
  },
  amplitude: {
    title: 'Amplitude vs time', Plot: AmplitudePlot, zoomable: true,
    meta: (p) => [['Avg power', p ? `${p.averagePower.toFixed(1)} dBm` : dash], ['Peak', p ? `${p.peakPower.toFixed(1)} dBm` : dash]],
  },
  'phase-time': {
    title: 'Phase vs time', Plot: PhasePlot, zoomable: true,
    meta: (p) => [['Offset', p ? `${p.phaseOffset.toFixed(1)}°` : dash]],
  },
};

export const CHART_ORDER: ChartId[] = ['iq', 'spectrum', 'waterfall', 'constellation', 'eye', 'freq-time', 'amplitude', 'phase-time'];
