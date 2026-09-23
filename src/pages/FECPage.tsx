import { Shield } from 'lucide-react';
import { useAnalysis } from '../context/AnalysisContext';
import FECPanel from '../components/fec/FECPanel';
import StatusBadge from '../components/common/StatusBadge';
import { MOCK_INTERLEAVER, MOCK_BER } from '../data/mockAnalysis';

export default function FECPage() {
  const { state } = useAnalysis();
  const { fec, interleaver, ber } = state;

  if (!fec || !interleaver || !ber) {
    return (
      <div className="page">
        <div className="empty-state">
          <div className="empty-state-title">No FEC data available</div>
          <div className="empty-state-desc">Analyze a signal to detect FEC and interleaver.</div>
        </div>
      </div>
    );
  }

  const fecStatus = fec.decodingStatus === 'successful' ? 'completed' : fec.decodingStatus === 'unknown' ? 'warning' : fec.detected === false ? 'idle' : 'error';

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-title"><Shield size={18} style={{ color: 'var(--accent-blue)' }} /> FEC / Interleaver</div>
          <div className="page-subtitle">Forward error correction detection, decoding, and BER analysis</div>
        </div>
        <StatusBadge
          status={fecStatus}
          label={fec.detected === true ? `FEC: ${fec.family}` : fec.detected === false ? 'NO FEC DETECTED' : 'FEC UNKNOWN'}
        />
      </div>

      <FECPanel fec={fec} interleaver={interleaver} ber={ber} />
    </div>
  );
}
