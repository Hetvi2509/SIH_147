import { FileText, CheckCircle } from 'lucide-react';
import type { FileMetadata } from '../../types';
import { formatFileSize, formatSampleRate, formatSamples, formatDuration } from '../../utils/formatters';

interface FileInfoCardProps {
  metadata: FileMetadata;
  onAnalyze?: () => void;
  isAnalyzing?: boolean;
}

export default function FileInfoCard({ metadata, onAnalyze, isAnalyzing }: FileInfoCardProps) {
  return (
    <div className="file-info-card">
      <div className="file-info-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 36, height: 36, background: 'var(--bg-panel)',
            border: '1px solid var(--border-default)', borderRadius: 'var(--radius-sm)',
            display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}>
            <FileText size={18} style={{ color: 'var(--accent-blue)' }} />
          </div>
          <div>
            <div className="file-name-display">{metadata.fileName}</div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', marginTop: 1 }}>
              {metadata.fileType} Â· {metadata.format} Â· {formatFileSize(metadata.fileSize)}
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <CheckCircle size={13} style={{ color: 'var(--color-success)' }} />
            <span style={{ fontSize: '0.75rem', color: 'var(--color-success)' }}>File Loaded Successfully</span>
          </div>
          {onAnalyze && (
            <button
              className="btn btn-primary"
              onClick={onAnalyze}
              disabled={isAnalyzing}
              style={{ minWidth: 120 }}
            >
              {isAnalyzing ? 'âš™ Analyzing...' : 'â–¶ Analyze Signal'}
            </button>
          )}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '8px 16px' }}>
        {[
          { k: 'Format', v: metadata.format },
          { k: 'Layout', v: metadata.layout },
          { k: 'Data Type', v: metadata.dataType },
          { k: 'Endianness', v: metadata.endianness ?? 'N/A' },
          { k: 'Sample Rate', v: formatSampleRate(metadata.sampleRate) },
          { k: 'Samples', v: formatSamples(metadata.numSamples) },
          { k: 'Duration', v: formatDuration(metadata.duration) },
          { k: 'File Size', v: formatFileSize(metadata.fileSize) },
          ...(metadata.fileType === 'WAV' ? [{ k: 'WAV Channels', v: String(metadata.channels ?? 1) }, { k: 'Interpretation', v: metadata.wavInterpretation ?? 'Unknown' }] : []),
        ].map(({ k, v }) => (
          <div key={k} style={{ borderBottom: '1px solid var(--border-subtle)', paddingBottom: 6 }}>
            <div style={{ fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--text-muted)', marginBottom: 2 }}>{k}</div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.82rem', color: 'var(--text-primary)' }}>{v}</div>
          </div>
        ))}
      </div>

      {metadata.fileType === 'WAV' && (
        <div style={{
          marginTop: 12, padding: '8px 10px',
          background: 'var(--color-info-bg)', border: '1px solid rgba(33,150,243,0.2)',
          borderRadius: 'var(--radius-sm)', fontSize: '0.75rem', color: 'var(--accent-blue)'
        }}>
          â„¹ WAV file: {metadata.channels === 2 ? 'Stereo â€” interpreted as I/Q (Ch1=I, Ch2=Q)' : 'Mono â€” audio/non-IQ signal detected'}
        </div>
      )}
    </div>
  );
}
