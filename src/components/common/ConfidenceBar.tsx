interface ConfidenceBarProps {
  modulation: string;
  confidence: number;
  isTop?: boolean;
  maxWidth?: number;
}

export default function ConfidenceBar({ modulation, confidence, isTop = false, maxWidth = 100 }: ConfidenceBarProps) {
  const fillWidth = (confidence / maxWidth) * 100;
  const fillColor = isTop ? 'var(--blue)' : confidence > 5 ? 'var(--border-strong)' : 'var(--border-faint)';

  return (
    <div className={`confidence-item ${isTop ? 'top' : ''}`}>
      <span className="confidence-label">{modulation}</span>
      <div className="confidence-bar-track">
        <div
          className={`confidence-bar-fill ${isTop ? '' : 'secondary'}`}
          style={{ width: `${fillWidth}%`, background: fillColor }}
        />
      </div>
      <span className="confidence-pct">{confidence.toFixed(1)}%</span>
    </div>
  );
}
