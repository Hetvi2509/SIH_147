import { Waves } from 'lucide-react';
import { useAnalysis } from '../context/AnalysisContext';
import DemodPanel from '../components/demodulation/DemodPanel';
import IQWaveform from '../components/visualization/IQWaveform';
import ConstellationChart from '../components/visualization/ConstellationChart';
import StatusBadge from '../components/common/StatusBadge';

export default function DemodulationPage() {
  const { state } = useAnalysis();
  const { demodulation } = state;

  if (!demodulation) {
    return (
      <div className="page">
        <div className="empty-state">
          <div className="empty-state-title">No demodulation data</div>
          <div className="empty-state-desc">Analyze a signal to run the demodulator.</div>
        </div>
      </div>
    );
  }

  const statusBadge = demodulation.status === 'successful' ? 'completed' : demodulation.status === 'uncertain' ? 'warning' : 'error';

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-title"><Waves size={18} style={{ color: 'var(--accent-blue)' }} /> Demodulation</div>
          <div className="page-subtitle">Symbol recovery, bit extraction, and BER estimation</div>
        </div>
        <StatusBadge status={statusBadge} label={demodulation.status.toUpperCase().replace('-', ' ')} />
      </div>

      <div className="grid-2" style={{ marginBottom: 16 }}>
        <DemodPanel demod={demodulation} />
        <div>
          <ConstellationChart height={320} />
        </div>
      </div>

      <IQWaveform height={240} showAmplitude />
    </div>
  );
}
