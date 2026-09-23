import { BarChart2 } from 'lucide-react';
import VisualizationWorkspace from '../components/visualization/VisualizationWorkspace';
import { useAnalysis } from '../context/AnalysisContext';

export default function VisualizationsPage() {
  const { state } = useAnalysis();

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-title"><BarChart2 size={18} style={{ color: 'var(--accent-blue)' }} /> Signal Visualizations</div>
          <div className="page-subtitle">
            Multi-domain signal analysis workspace
            {state.fileMetadata && (
              <span style={{ marginLeft: 12, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
                · {state.fileMetadata.fileName}
              </span>
            )}
          </div>
        </div>
        {/* Segment info */}
        {state.fileMetadata && (
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Segment:</span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--text-primary)' }}>
              {state.segmentStart.toFixed(2)}s – {state.segmentEnd.toFixed(2)}s
            </span>
          </div>
        )}
      </div>

      {/* Timeline selector */}
      <div className="timeline-selector" style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <div style={{ fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--text-muted)' }}>
            Signal Timeline
          </div>
          <div style={{ display: 'flex', gap: 12, fontSize: '0.72rem', fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>
            <span>Start: <span style={{ color: 'var(--accent-blue)' }}>{state.segmentStart.toFixed(2)} s</span></span>
            <span>End: <span style={{ color: 'var(--accent-blue)' }}>{state.segmentEnd.toFixed(2)} s</span></span>
            <span>Duration: <span style={{ color: 'var(--text-primary)' }}>{(state.segmentEnd - state.segmentStart).toFixed(2)} s</span></span>
          </div>
        </div>
        <div className="timeline-track">
          <div
            className="timeline-selection"
            style={{
              left: `${(state.segmentStart / (state.fileMetadata?.duration ?? 4.37)) * 100}%`,
              width: `${((state.segmentEnd - state.segmentStart) / (state.fileMetadata?.duration ?? 4.37)) * 100}%`,
            }}
          />
          {/* Time markers */}
          {[0, 0.25, 0.5, 0.75, 1].map((t) => {
            const dur = state.fileMetadata?.duration ?? 4.37;
            return (
              <div key={t} style={{ position: 'absolute', left: `${t * 100}%`, top: 0, bottom: 0, borderLeft: '1px solid rgba(37,54,80,0.5)' }}>
                <span style={{ position: 'absolute', bottom: -16, left: 2, fontSize: '0.6rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', whiteSpace: 'nowrap' }}>
                  {(t * dur).toFixed(2)}s
                </span>
              </div>
            );
          })}
        </div>
        <div style={{ marginTop: 24 }} />
      </div>

      {/* Full visualization workspace */}
      <VisualizationWorkspace defaultTab="spectrum" />
    </div>
  );
}
