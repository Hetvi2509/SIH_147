import { useState, useRef, useCallback } from 'react';
import { Upload, File, CheckCircle, AlertCircle, X, Info } from 'lucide-react';
import { useAnalysis } from '../context/AnalysisContext';
import StatusBadge from '../components/common/StatusBadge';
import { formatFileSize, formatSampleRate, formatSamples, formatDuration } from '../utils/formatters';

type UploadState = 'idle' | 'dragging' | 'reading' | 'ready' | 'uploading' | 'error';

export default function FileUploadPage() {
  const { state, uploadFile, runAnalysis } = useAnalysis();
  const [uploadState, setUploadState] = useState<UploadState>(state.fileMetadata ? 'ready' : 'idle');
  const [localFile, setLocalFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(async (file: File) => {
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (!['iq', 'wav', 'bin'].includes(ext ?? '')) {
      setError(`Unsupported file type: .${ext}. Please upload .IQ, .WAV, or .BIN files.`);
      setUploadState('error');
      return;
    }
    setError(null);
    setLocalFile(file);
    setUploadState('reading');
    await new Promise((r) => setTimeout(r, 600));
    setUploadState('uploading');
    await uploadFile(file);
    setUploadState('ready');
  }, [uploadFile]);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const onFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const reset = () => {
    setUploadState('idle');
    setLocalFile(null);
    setError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const statusMap: Record<UploadState, { label: string; status: 'idle' | 'processing' | 'completed' | 'error' | 'ready' }> = {
    idle:      { label: 'WAITING FOR FILE',   status: 'idle' },
    dragging:  { label: 'RELEASE TO UPLOAD',  status: 'processing' },
    reading:   { label: 'READING METADATA',   status: 'processing' },
    ready:     { label: 'READY',              status: 'ready' },
    uploading: { label: 'UPLOADING',          status: 'processing' },
    error:     { label: 'ERROR',              status: 'error' },
  };

  const { label, status } = statusMap[uploadState];
  const meta = state.fileMetadata;

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-title"><Upload size={18} style={{ color: 'var(--accent-blue)' }} /> File Upload</div>
          <div className="page-subtitle">Upload .IQ or .WAV signal recordings</div>
        </div>
        <StatusBadge status={status} label={label} />
      </div>

      <div className="grid-2">
        {/* Drop zone */}
        <div>
          <input
            ref={fileInputRef}
            type="file"
          accept=".iq,.wav,.bin"
            style={{ display: 'none' }}
            onChange={onFileSelect}
          />
          <div
            className={`upload-zone ${uploadState === 'dragging' ? 'dragover' : ''} ${uploadState === 'ready' ? 'has-file' : ''}`}
            onDragOver={(e) => { e.preventDefault(); setUploadState('dragging'); }}
            onDragLeave={() => setUploadState(meta ? 'ready' : 'idle')}
            onDrop={onDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            {uploadState === 'ready' ? (
              <>
                <CheckCircle size={40} style={{ color: 'var(--color-success)', marginBottom: 12 }} />
                <div style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--color-success)', marginBottom: 4 }}>File Loaded</div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                  {localFile?.name ?? meta?.fileName}
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 6 }}>
                  Click to replace
                </div>
              </>
            ) : uploadState === 'error' ? (
              <>
                <AlertCircle size={40} style={{ color: 'var(--color-error)', marginBottom: 12 }} />
                <div style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--color-error)', marginBottom: 4 }}>Upload Error</div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{error}</div>
                <button className="btn btn-secondary btn-sm" onClick={(e) => { e.stopPropagation(); reset(); }} style={{ marginTop: 12 }}>
                  Try Again
                </button>
              </>
            ) : uploadState === 'reading' || uploadState === 'uploading' ? (
              <>
                <div style={{ fontSize: 32, marginBottom: 12 }}>⚙</div>
                <div style={{ fontSize: '0.9rem', color: 'var(--accent-cyan)' }}>
                  {uploadState === 'reading' ? 'Reading IQ metadata...' : 'Uploading signal...'}
                </div>
              </>
            ) : (
              <>
                <Upload size={40} style={{ color: 'var(--text-muted)', marginBottom: 12 }} />
                <div style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>
                  Drop .IQ, .WAV, or .BIN file here
                </div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: 14 }}>
                  or click to browse
                </div>
                <button className="btn btn-primary btn-sm" onClick={(e) => e.stopPropagation()}>
                  Browse Files
                </button>
              </>
            )}
          </div>

          {/* Format support info */}
          <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[
              { ext: '.IQ',  desc: 'Interleaved float32 IQ binary files', color: 'var(--accent-cyan)' },
              { ext: '.WAV', desc: 'PCM WAV files (Stereo: I/Q, Mono: real-valued signal)', color: 'var(--accent-blue)' },
              { ext: '.BIN', desc: 'Raw binary IQ — interleaved float32 (same format as .IQ)', color: 'var(--color-warning, #f59e0b)' },
            ].map(({ ext, desc, color }) => (
              <div key={ext} style={{ display: 'flex', gap: 10, padding: '8px 12px', background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-sm)' }}>
                <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, color, fontSize: '0.8rem', minWidth: 32 }}>{ext}</span>
                <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{desc}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Metadata panel */}
        <div>
          {meta ? (
            <div className="card">
              <div className="card-header">
                <span className="card-title">File Metadata</span>
                <StatusBadge status="completed" label="PARSED" size="sm" />
              </div>
              <table className="kv-table">
                <tbody>
                  <tr><td>File Name</td><td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem' }}>{meta.fileName}</td></tr>
                  <tr><td>File Type</td><td><span style={{ color: 'var(--accent-cyan)', fontFamily: 'var(--font-mono)' }}>{meta.fileType}</span></td></tr>
                  <tr><td>Format</td><td>{meta.format}</td></tr>
                  <tr><td>Layout</td><td>{meta.layout}</td></tr>
                  <tr><td>Data Type</td><td>{meta.dataType}</td></tr>
                  <tr><td>Endianness</td><td>{meta.endianness ?? 'N/A'}</td></tr>
                  <tr><td>File Size</td><td>{formatFileSize(meta.fileSize)}</td></tr>
                  <tr><td>Sample Rate</td><td style={{ color: 'var(--accent-cyan)' }}>{formatSampleRate(meta.sampleRate)}</td></tr>
                  <tr><td>Number of Samples</td><td>{formatSamples(meta.numSamples)}</td></tr>
                  <tr><td>Duration</td><td style={{ color: 'var(--accent-blue)' }}>{formatDuration(meta.duration)}</td></tr>
                  <tr><td>I/Q</td><td>Complex IQ</td></tr>
                </tbody>
              </table>

              {meta.fileType === 'WAV' && (
                <div style={{ marginTop: 12, padding: '8px 10px', background: 'rgba(33,150,243,0.07)', border: '1px solid rgba(33,150,243,0.2)', borderRadius: 'var(--radius-sm)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                    <Info size={12} style={{ color: 'var(--accent-blue)' }} />
                    <span style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--accent-blue)' }}>WAV File Interpretation</span>
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                    {(meta.channels ?? 1) >= 2
                      ? 'Stereo file detected → Interpreted as I/Q signal (Channel 1 = I, Channel 2 = Q)'
                      : 'Mono file detected → Treated as real-valued audio/RF signal (not complex I/Q)'
                    }
                  </div>
                </div>
              )}

              <div style={{ marginTop: 14, display: 'flex', gap: 8 }}>
                <button className="btn btn-primary" onClick={runAnalysis} style={{ flex: 1 }}>
                  ▶ Analyze Signal
                </button>
                <button className="btn btn-secondary btn-sm" onClick={reset}>
                  <X size={13} /> Remove
                </button>
              </div>
            </div>
          ) : (
            <div className="card" style={{ textAlign: 'center', padding: 40 }}>
              <File size={40} style={{ color: 'var(--text-muted)', opacity: 0.3, marginBottom: 12 }} />
              <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: 6 }}>No file selected</div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Upload a file to see its metadata</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
