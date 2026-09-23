import { Sliders } from 'lucide-react';
import { useAnalysis } from '../context/AnalysisContext';
import ParameterCard from '../components/common/ParameterCard';
import StatusBadge from '../components/common/StatusBadge';
import {
  formatCFO, formatPhase, formatSNR, formatSampleRate,
  formatSymbolRate, formatPower, formatEVM
} from '../utils/formatters';

export default function ParametersPage() {
  const { state } = useAnalysis();
  const p = state.parameters;

  if (!p) {
    return (
      <div className="page">
        <div className="empty-state">
          <div className="empty-state-title">No parameters available</div>
          <div className="empty-state-desc">Upload and analyze a signal to extract parameters.</div>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-title"><Sliders size={18} style={{ color: 'var(--accent-blue)' }} /> Signal Parameters</div>
          <div className="page-subtitle">Automatically extracted RF signal characteristics</div>
        </div>
        <StatusBadge status="completed" label="EXTRACTED" />
      </div>

      {/* Primary parameters */}
      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', marginBottom: 8 }}>
          Primary Measurements
        </div>
        <div className="grid-auto">
          <ParameterCard label="Center Frequency" value={`${p.centerFrequency.toFixed(3)}`} unit="MHz" accent="cyan" highlight />
          <ParameterCard label="Sample Rate" value={formatSampleRate(p.sampleRate)} />
          <ParameterCard label="Bandwidth" value={`${p.bandwidth.toFixed(1)}`} unit="kHz" />
          <ParameterCard label="Occupied BW" value={`${p.occupiedBandwidth.toFixed(1)}`} unit="kHz" />
          <ParameterCard label="SNR" value={formatSNR(p.snr)} accent="success" />
          <ParameterCard label="Symbol Rate" value={`${p.symbolRate}`} unit="kSym/s" accent="cyan" />
          <ParameterCard label="Signal Duration" value={`${p.duration.toFixed(2)}`} unit="s" />
          <ParameterCard label="I/Q Format" value={state.fileMetadata?.format ?? 'Unknown'} />
        </div>
      </div>

      {/* Carrier offsets */}
      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', marginBottom: 8 }}>
          Carrier Offset & Phase
        </div>
        <div className="grid-auto">
          <ParameterCard label="Freq Offset (CFO)" value={formatCFO(p.cfo)} accent="warning" sub="Carrier frequency offset" />
          <ParameterCard label="Phase Offset" value={formatPhase(p.phaseOffset)} accent="warning" sub="Estimated carrier phase" />
          <ParameterCard label="EVM" value={formatEVM(p.evm)} sub="Error Vector Magnitude" />
          <ParameterCard label="Modulation Quality" value={p.modulationQuality} accent={p.modulationQuality === 'Good' || p.modulationQuality === 'Excellent' ? 'success' : p.modulationQuality === 'Moderate' ? 'warning' : 'error'} />
        </div>
      </div>

      {/* Power measurements */}
      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', marginBottom: 8 }}>
          Power Measurements
        </div>
        <div className="grid-auto">
          <ParameterCard label="Channel Power" value={formatPower(p.channelPower)} sub="Total in-band power" />
          <ParameterCard label="Signal Power" value={formatPower(p.signalPower)} accent="info" />
          <ParameterCard label="Noise Power" value={formatPower(p.noisePower)} sub="Noise floor" />
          <ParameterCard label="Peak Power" value={formatPower(p.peakPower)} />
          <ParameterCard label="Average Power" value={formatPower(p.averagePower)} />
        </div>
      </div>

      {/* Channel condition */}
      <div className="card card-sm">
        <div className="card-header">
          <span className="card-title">Channel Condition</span>
        </div>
        <div style={{ display: 'flex', gap: 16 }}>
          <div>
            <div className="param-label">Condition</div>
            <div className="param-value" style={{ color: 'var(--accent-cyan)' }}>{p.channelCondition}</div>
          </div>
          <div>
            <div className="param-label">Modulation Quality</div>
            <div className="param-value" style={{ color: p.modulationQuality === 'Good' ? 'var(--color-success)' : 'var(--color-warning)' }}>
              {p.modulationQuality}
            </div>
          </div>
          <div>
            <div className="param-label">SNR</div>
            <div className="param-value" style={{ color: 'var(--color-success)' }}>{formatSNR(p.snr)}</div>
          </div>
        </div>
        <div style={{ marginTop: 12, padding: '8px 10px', background: 'var(--color-success-bg)', border: '1px solid rgba(76,175,80,0.2)', borderRadius: 'var(--radius-sm)', fontSize: '0.78rem', color: 'var(--color-success)' }}>
          ✓ Signal quality sufficient for reliable classification and demodulation.
        </div>
      </div>
    </div>
  );
}
