import { Cpu } from 'lucide-react';
import { useAnalysis } from '../context/AnalysisContext';
import ModulationResult from '../components/modulation/ModulationResult';
import ConstellationChart from '../components/visualization/ConstellationChart';
import StatusBadge from '../components/common/StatusBadge';

export default function ModulationPage() {
  const { state } = useAnalysis();
  const { classification } = state;

  if (!classification) {
    return (
      <div className="page">
        <div className="empty-state">
          <div className="empty-state-title">No classification result</div>
          <div className="empty-state-desc">Analyze a signal to run the modulation classifier.</div>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-title"><Cpu size={18} style={{ color: 'var(--accent-blue)' }} /> Automatic Modulation Classification</div>
          <div className="page-subtitle">AI-powered modulation detection and family classification</div>
        </div>
        <StatusBadge status="completed" label="ANALYSIS COMPLETE" />
      </div>

      <div className="grid-2">
        {/* Classification results */}
        <div>
          <ModulationResult result={classification} />
        </div>

        {/* Constellation diagram */}
        <div>
          <ConstellationChart height={340} />
          <div className="card card-sm" style={{ marginTop: 12 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              {[
                { label: 'Detected', value: classification.modulation, color: 'var(--accent-cyan)' },
                { label: 'Family', value: classification.family, color: 'var(--accent-blue)' },
                { label: 'Confidence', value: `${classification.confidence.toFixed(1)}%`, color: 'var(--color-success)' },
                { label: 'EVM', value: `${state.parameters?.evm ?? '--'}% RMS`, color: 'var(--text-primary)' },
              ].map(({ label, value, color }) => (
                <div key={label} style={{ borderBottom: '1px solid var(--border-subtle)', paddingBottom: 8 }}>
                  <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 2 }}>{label}</div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.9rem', fontWeight: 600, color }}>{value}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Supported modulation classes */}
      <div className="card card-sm" style={{ marginTop: 16 }}>
        <div className="card-header">
          <span className="card-title">Supported Modulation Classes</span>
          <span className="ai-badge">AMC Engine Â· 14 Classes</span>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {[
            { name: 'OOK',   family: 'ASK' },
            { name: 'PAM',   family: 'ASK' },
            { name: '2FSK',  family: 'FSK' },
            { name: '4FSK',  family: 'FSK' },
            { name: 'CPFSK', family: 'FSK' },
            { name: 'GMSK',  family: 'FSK' },
            { name: 'BPSK',  family: 'PSK' },
            { name: 'QPSK',  family: 'PSK' },
            { name: '8PSK',  family: 'PSK' },
            { name: '16QAM', family: 'QAM' },
            { name: '64QAM', family: 'QAM' },
            { name: 'AM',    family: 'AM'  },
            { name: 'FM',    family: 'FM'  },
            { name: 'NOISE', family: 'None'},
          ].map(({ name, family }) => {
            const isActive = name === classification.modulation;
            return (
              <span
                key={name}
                className="chip"
                title={`Family: ${family}`}
                style={{
                  background: isActive ? 'rgba(0,229,255,0.12)' : undefined,
                  borderColor: isActive ? 'var(--accent-cyan)' : undefined,
                  color: isActive ? 'var(--accent-cyan)' : undefined,
                  fontWeight: isActive ? 600 : undefined,
                }}
              >
                {isActive ? 'âœ“ ' : ''}{name}
              </span>
            );
          })}
        </div>
      </div>
    </div>
  );
}
