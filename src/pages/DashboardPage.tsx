import { useNavigate } from 'react-router-dom';
import { ArrowRight, FileText, Activity } from 'lucide-react';
import { useAnalysis } from '../context/AnalysisContext';
import StatusCards from '../components/dashboard/StatusCards';
import PipelineStepper from '../components/dashboard/PipelineStepper';
import VisualizationWorkspace from '../components/visualization/VisualizationWorkspace';
import ParameterCard from '../components/common/ParameterCard';
import StatusBadge from '../components/common/StatusBadge';
import {
  formatCFO, formatPhase, formatSNR, formatSampleRate,
  formatFileSize, formatSamples, formatDuration, formatBER
} from '../utils/formatters';

export default function DashboardPage() {
  const { state, runAnalysis } = useAnalysis();
  const navigate = useNavigate();
  const { fileMetadata: meta, parameters: p, classification: cls, ber, pipeline, overallStatus } = state;
  const isAnalyzing = overallStatus === 'analyzing';

  return (
    <div className="page">
      {/* Page header */}
      <div className="page-header">
        <div>
          <div className="page-title">Dashboard</div>
          <div className="page-subtitle">Overview — pipeline status, parameters, signal preview</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {overallStatus === 'completed' && (
            <StatusBadge status="completed" label="Analysis complete" />
          )}
          {overallStatus === 'analyzing' && (
            <StatusBadge status="processing" label="Analyzing..." />
          )}
          {(overallStatus === 'idle' || overallStatus === 'uploading') && (
            <StatusBadge status="idle" label="No analysis yet" />
          )}
          {overallStatus === 'error' && (
            <StatusBadge status="error" label="Analysis failed" />
          )}
        </div>
      </div>

      {/* File info row — not a giant hero card */}
      {meta ? (
        <div className="card card-sm" style={{ marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
            {/* Left: file identity */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <FileText size={14} style={{ color: 'var(--blue)', flexShrink: 0 }} />
              <div>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.88rem', color: 'var(--text-primary)', fontWeight: 500 }}>
                  {meta.fileName}
                </span>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', marginLeft: 10 }}>
                  {meta.fileType} · {meta.format} · {formatFileSize(meta.fileSize)}
                </span>
              </div>
            </div>

            {/* Right: key file metrics + action */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <div style={{ display: 'flex', gap: 16, fontSize: '0.73rem', fontFamily: 'var(--font-mono)' }}>
                <span style={{ color: 'var(--text-muted)' }}>fs <span style={{ color: 'var(--text-secondary)' }}>{formatSampleRate(meta.sampleRate)}</span></span>
                <span style={{ color: 'var(--text-muted)' }}>n <span style={{ color: 'var(--text-secondary)' }}>{formatSamples(meta.numSamples)}</span></span>
                <span style={{ color: 'var(--text-muted)' }}>T <span style={{ color: 'var(--text-secondary)' }}>{formatDuration(meta.duration)}</span></span>
              </div>
              <button
                className="btn btn-primary btn-sm"
                onClick={runAnalysis}
                disabled={isAnalyzing}
              >
                {isAnalyzing ? '⚙ Analyzing...' : '▶ Analyze'}
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="card card-sm" style={{ marginBottom: 12, textAlign: 'center', padding: '28px 20px' }}>
          <div style={{ color: 'var(--text-muted)', marginBottom: 8, fontSize: '0.85rem' }}>No signal loaded</div>
          <button className="btn btn-primary btn-sm" onClick={() => navigate('/upload')}>
            Upload .IQ / .WAV file
          </button>
        </div>
      )}

      {/* Error banner */}
      {state.error && (
        <div style={{
          padding: '10px 14px', marginBottom: 12,
          background: 'rgba(239,83,80,0.08)',
          border: '1px solid rgba(239,83,80,0.3)',
          borderRadius: 'var(--radius-md)',
          fontSize: '0.82rem', color: 'var(--color-error)',
          display: 'flex', gap: 8, alignItems: 'flex-start',
        }}>
          <span style={{ flexShrink: 0 }}>⚠</span>
          <span>{state.error}</span>
        </div>
      )}

      {/* Stage status overview */}
      <div style={{ marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 6 }}>
          <span style={{ fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-muted)', fontWeight: 600 }}>
            Analysis Stages
          </span>
          <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
            {overallStatus === 'completed' ? '8 / 8 complete' : `${pipeline.filter(s => s.status === 'completed').length} / ${pipeline.length} complete`}
          </span>
        </div>
        <StatusCards />
      </div>

      {/* Pipeline */}
      <div className="card card-sm" style={{ marginBottom: 12 }}>
        <div className="card-header">
          <span className="card-title">Processing Pipeline</span>
          <StatusBadge
            status={overallStatus === 'completed' ? 'completed' : overallStatus === 'analyzing' ? 'processing' : 'idle'}
            label={overallStatus === 'completed' ? '8 stages OK' : overallStatus === 'analyzing' ? 'Running' : 'Idle'}
            size="sm"
          />
        </div>
        <PipelineStepper stages={pipeline} />
      </div>

      {/* Two-column: params + quick result */}
      {p && (
        <div className="grid-2" style={{ marginBottom: 12 }}>
          {/* Parameters */}
          <div className="card card-sm">
            <div className="card-header">
              <span className="card-title">Key Parameters</span>
              <button className="btn btn-ghost btn-sm" onClick={() => navigate('/parameters')}>
                All params <ArrowRight size={10} />
              </button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 14px' }}>
              {[
                { k: 'Center Freq',   v: `${p.centerFrequency.toFixed(3)} MHz`, hi: true },
                { k: 'Sample Rate',   v: meta ? formatSampleRate(meta.sampleRate) : '--' },
                { k: 'Bandwidth',     v: `${p.bandwidth.toFixed(1)} kHz` },
                { k: 'Symbol Rate',   v: `${p.symbolRate} kSym/s` },
                { k: 'SNR',           v: formatSNR(p.snr),   color: 'var(--green)' },
                { k: 'CFO',           v: formatCFO(p.cfo),   color: 'var(--amber)' },
                { k: 'Phase Offset',  v: formatPhase(p.phaseOffset), color: 'var(--amber)' },
                { k: 'EVM',          v: `${p.evm.toFixed(1)}% rms` },
              ].map(({ k, v, hi, color }) => (
                <div key={k} style={{ borderBottom: '1px solid var(--border-faint)', paddingBottom: 5 }}>
                  <div style={{ fontSize: '0.6rem', textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--text-muted)', marginBottom: 1 }}>{k}</div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.84rem', fontWeight: hi ? 500 : 400, color: color ?? (hi ? 'var(--text-bright)' : 'var(--text-primary)') }}>{v}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Results summary */}
          <div className="card card-sm">
            <div className="card-header">
              <span className="card-title">Classification Result</span>
              {cls && (
                <button className="btn btn-ghost btn-sm" onClick={() => navigate('/modulation')}>
                  Detail <ArrowRight size={10} />
                </button>
              )}
            </div>
            {cls ? (
              <>
                <div style={{ marginBottom: 14 }}>
                  <div style={{ fontSize: '0.6rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', marginBottom: 3 }}>Detected</div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: '2rem', fontWeight: 700, color: 'var(--text-bright)', lineHeight: 1 }}>
                    {cls.modulation}
                  </div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 4, fontFamily: 'var(--font-mono)' }}>
                    {cls.family} family · model {cls.modelVersion} · {cls.inferenceTimeMs}ms
                  </div>
                </div>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.68rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', marginBottom: 4 }}>
                    <span>Confidence</span>
                    <span style={{ color: 'var(--green)' }}>{cls.confidence.toFixed(1)}%</span>
                  </div>
                  <div style={{ height: 5, background: 'var(--bg-base)', borderRadius: 1, overflow: 'hidden' }}>
                    <div style={{ width: `${cls.confidence}%`, height: '100%', background: 'var(--blue)', borderRadius: 1 }} />
                  </div>
                </div>
                {ber && (
                  <div style={{ marginTop: 12, paddingTop: 10, borderTop: '1px solid var(--border-faint)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <div>
                        <div style={{ fontSize: '0.6rem', textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--text-muted)', marginBottom: 1 }}>BER before FEC</div>
                        <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.83rem', color: 'var(--amber)' }}>{formatBER(ber.berBeforeFEC)}</div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: '0.6rem', textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--text-muted)', marginBottom: 1 }}>BER after FEC</div>
                        <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.83rem', color: 'var(--green)' }}>{ber.berAfterFEC != null ? formatBER(ber.berAfterFEC) : 'N/A'}</div>
                      </div>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div style={{ color: 'var(--text-muted)', fontSize: '0.82rem', fontStyle: 'italic' }}>
                Classification not run yet.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Signal preview */}
      <div style={{ marginBottom: 2 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
          <span style={{ fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-muted)', fontWeight: 600 }}>
            Signal Preview
          </span>
          <button className="btn btn-ghost btn-sm" onClick={() => navigate('/visualizations')}>
            Full workspace <ArrowRight size={10} />
          </button>
        </div>
        <VisualizationWorkspace defaultTab="spectrum" />
      </div>
    </div>
  );
}
