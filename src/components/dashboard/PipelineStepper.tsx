import {
  CheckCircle, Loader2, AlertTriangle, XCircle, Circle
} from 'lucide-react';
import type { PipelineStage } from '../../types';

const STAGE_ICONS: Record<string, React.ReactNode> = {
  'file-input': '📁',
  'preprocessing': '⚙',
  'parameter-extraction': '📊',
  'modulation-classification': '🤖',
  'synchronization': '🔁',
  'demodulation': '📡',
  'fec-interleaver': '🛡',
  'final-report': '📄',
};

function StageIcon({ status }: { status: PipelineStage['status'] }) {
  switch (status) {
    case 'completed': return <CheckCircle size={13} />;
    case 'processing': return <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} />;
    case 'warning': return <AlertTriangle size={13} />;
    case 'failed': return <XCircle size={13} />;
    default: return <Circle size={13} />;
  }
}

interface PipelineStepperProps {
  stages: PipelineStage[];
}

export default function PipelineStepper({ stages }: PipelineStepperProps) {
  return (
    <div>
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
      <div className="pipeline">
        {stages.map((stage) => (
          <div key={stage.id} className={`pipeline-stage ${stage.status}`}>
            <div className="pipeline-icon">
              <StageIcon status={stage.status} />
            </div>
            <div className="pipeline-label">{stage.name}</div>
            {stage.duration !== undefined && (
              <div className="pipeline-duration">
                {stage.status === 'completed' ? `${stage.duration}ms` : stage.status === 'processing' ? '...' : '—'}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
