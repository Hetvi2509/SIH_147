import { CheckCircle } from 'lucide-react';
import type { ClassificationResult } from '../../types';
import ConfidenceBar from '../common/ConfidenceBar';
import StatusBadge from '../common/StatusBadge';

interface ModulationResultProps {
  result: ClassificationResult;
}

const FAMILY_COLORS: Record<string, string> = {
  PSK:     'var(--blue)',
  QAM:     '#9e7acc',
  FSK:     'var(--amber)',
  ASK:     'var(--green)',
  AM:      'var(--red)',
  FM:      'var(--cyan)',
  None:    'var(--text-muted)',
  Unknown: 'var(--text-muted)',
};

export default function ModulationResult({ result }: ModulationResultProps) {
  const familyColor = FAMILY_COLORS[result.family] ?? 'var(--text-muted)';

  return (
    <div>
      {/* Model info — plain table row, no AI badge theatrics */}
      <div className="model-info" style={{ marginBottom: 12 }}>
        <div className="model-info-item">
          <div className="model-info-label">AMC Model</div>
          <div className="model-info-value">AMC / {result.modelVersion}</div>
        </div>
        <div className="model-info-item">
          <div className="model-info-label">Inference</div>
          <div className="model-info-value">{result.inferenceTimeMs} ms</div>
        </div>
        <div className="model-info-item">
          <div className="model-info-label">Status</div>
          <div className="model-info-value">
            <StatusBadge status="completed" label="Ready" size="sm" />
          </div>
        </div>
        <div className="model-info-item">
          <div className="model-info-label">Segment</div>
          <div className="model-info-value">0.00 – 4.37 s</div>
        </div>
      </div>

      {/* Main result */}
      <div className="modulation-result-card" style={{ marginBottom: 12 }}>
        <div className="modulation-detected-label">Detected Modulation</div>
        <div className="modulation-type">{result.modulation}</div>
        <div style={{ marginTop: 6 }}>
          <span
            className="modulation-family-badge"
            style={{ borderColor: `${familyColor}44`, color: familyColor, background: `${familyColor}12` }}
          >
            {result.family} Family
          </span>
        </div>
        <div className="modulation-confidence">
          {result.confidence.toFixed(1)}%
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 400, marginLeft: 6 }}>
            confidence
          </span>
        </div>
        {result.confidence >= 90 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, justifyContent: 'center', marginTop: 8 }}>
            <CheckCircle size={12} style={{ color: '#5cb87a' }} />
            <span style={{ fontSize: '0.72rem', color: '#5cb87a' }}>High-confidence classification</span>
          </div>
        )}
        {result.confidence < 70 && (
          <div style={{ fontSize: '0.72rem', color: 'var(--amber)', marginTop: 8 }}>
            ⚠ Low confidence — check SNR or signal segment
          </div>
        )}
      </div>

      {/* Top-K predictions */}
      <div className="card card-sm">
        <div className="card-header">
          <span className="card-title">Classification Probabilities</span>
          <span style={{ fontSize: '0.67rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
            top-{result.topK.length}
          </span>
        </div>
        {result.topK.map((item, idx) => (
          <ConfidenceBar
            key={item.modulation}
            modulation={item.modulation}
            confidence={item.confidence}
            isTop={idx === 0}
            maxWidth={100}
          />
        ))}
      </div>
    </div>
  );
}
