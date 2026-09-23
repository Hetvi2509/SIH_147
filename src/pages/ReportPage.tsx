import { FileText, Download, CheckCircle } from 'lucide-react';
import { useAnalysis } from '../context/AnalysisContext';
import StatusBadge from '../components/common/StatusBadge';
import {
  formatFileSize, formatSampleRate, formatSamples, formatDuration,
  formatSNR, formatCFO, formatPhase, formatBER, formatPower
} from '../utils/formatters';

export default function ReportPage() {
  const { state, exportJSON, exportPDF, exportCSV } = useAnalysis();
  const { fileMetadata: meta, parameters: p, classification: cls, sync, demodulation: demod, fec, interleaver, ber, overallStatus } = state;

  const reportDate = new Date().toLocaleString();

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-title"><FileText size={18} style={{ color: 'var(--accent-blue)' }} /> Signal Analysis Report</div>
          <div className="page-subtitle">Generated: {reportDate}</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <StatusBadge status={overallStatus === 'completed' ? 'completed' : 'pending'} label={overallStatus === 'completed' ? 'ANALYSIS COMPLETE' : 'INCOMPLETE'} />
          <button className="btn btn-secondary btn-sm" onClick={exportCSV}>
            <Download size={12} /> CSV
          </button>
          <button className="btn btn-secondary btn-sm" onClick={exportJSON}>
            <Download size={12} /> JSON
          </button>
          <button className="btn btn-primary btn-sm" onClick={exportPDF}>
            <Download size={12} /> PDF Report
          </button>
        </div>
      </div>

      {/* Overall status banner */}
      {overallStatus === 'completed' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', background: 'var(--color-success-bg)', border: '1px solid rgba(76,175,80,0.3)', borderRadius: 'var(--radius-md)', marginBottom: 16 }}>
          <CheckCircle size={16} style={{ color: 'var(--color-success)' }} />
          <span style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--color-success)' }}>Analysis Completed Successfully</span>
          <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginLeft: 'auto' }}>All stages passed · {reportDate}</span>
        </div>
      )}

      {/* 1. Signal Summary */}
      <div className="report-section">
        <div className="report-section-title">1. Signal Summary</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '8px 20px' }}>
          {[
            { k: 'Signal File', v: meta?.fileName ?? 'N/A' },
            { k: 'Format', v: meta?.format ?? 'N/A' },
            { k: 'Sample Rate', v: meta ? formatSampleRate(meta.sampleRate) : 'N/A' },
            { k: 'Duration', v: meta ? formatDuration(meta.duration) : 'N/A' },
            { k: 'Detected Modulation', v: cls?.modulation ?? 'Unknown', accent: 'var(--accent-cyan)' },
            { k: 'Modulation Family', v: cls?.family ?? 'Unknown', accent: 'var(--accent-blue)' },
            { k: 'Confidence', v: cls ? `${cls.confidence.toFixed(1)}%` : 'N/A', accent: 'var(--color-success)' },
            { k: 'Overall Status', v: overallStatus === 'completed' ? 'Analysis Completed' : 'Incomplete', accent: 'var(--color-success)' },
          ].map(({ k, v, accent }) => (
            <div key={k} style={{ borderBottom: '1px solid var(--border-subtle)', paddingBottom: 8 }}>
              <div style={{ fontSize: '0.67rem', textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--text-muted)', marginBottom: 2 }}>{k}</div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.85rem', color: accent ?? 'var(--text-primary)' }}>{v}</div>
            </div>
          ))}
        </div>
      </div>

      {/* 2. File Information */}
      {meta && (
        <div className="report-section">
          <div className="report-section-title">2. File Information</div>
          <table className="kv-table">
            <tbody>
              <tr><td>File Name</td><td>{meta.fileName}</td></tr>
              <tr><td>File Type</td><td>{meta.fileType}</td></tr>
              <tr><td>Format</td><td>{meta.format}</td></tr>
              <tr><td>Layout</td><td>{meta.layout}</td></tr>
              <tr><td>Data Type</td><td>{meta.dataType}</td></tr>
              <tr><td>Endianness</td><td>{meta.endianness ?? 'N/A'}</td></tr>
              <tr><td>File Size</td><td>{formatFileSize(meta.fileSize)}</td></tr>
              <tr><td>Sample Rate</td><td>{formatSampleRate(meta.sampleRate)}</td></tr>
              <tr><td>Number of Samples</td><td>{formatSamples(meta.numSamples)}</td></tr>
              <tr><td>Duration</td><td>{formatDuration(meta.duration)}</td></tr>
            </tbody>
          </table>
        </div>
      )}

      {/* 3. Extracted Parameters */}
      {p && (
        <div className="report-section">
          <div className="report-section-title">3. Extracted Signal Parameters</div>
          <table className="kv-table">
            <tbody>
              <tr><td>Center Frequency</td><td style={{ color: 'var(--accent-cyan)' }}>{p.centerFrequency.toFixed(3)} MHz</td></tr>
              <tr><td>Bandwidth</td><td>{p.bandwidth.toFixed(1)} kHz</td></tr>
              <tr><td>Occupied Bandwidth</td><td>{p.occupiedBandwidth.toFixed(1)} kHz</td></tr>
              <tr><td>SNR</td><td style={{ color: 'var(--color-success)' }}>{formatSNR(p.snr)}</td></tr>
              <tr><td>Symbol Rate</td><td>{p.symbolRate} kSym/s</td></tr>
              <tr><td>Carrier Freq Offset (CFO)</td><td style={{ color: 'var(--color-warning)' }}>{formatCFO(p.cfo)}</td></tr>
              <tr><td>Phase Offset</td><td style={{ color: 'var(--color-warning)' }}>{formatPhase(p.phaseOffset)}</td></tr>
              <tr><td>EVM</td><td>{p.evm.toFixed(1)}% RMS</td></tr>
              <tr><td>Signal Power</td><td>{formatPower(p.signalPower)}</td></tr>
              <tr><td>Noise Power</td><td>{formatPower(p.noisePower)}</td></tr>
              <tr><td>Channel Condition</td><td>{p.channelCondition}</td></tr>
              <tr><td>Modulation Quality</td><td style={{ color: p.modulationQuality === 'Good' ? 'var(--color-success)' : 'var(--color-warning)' }}>{p.modulationQuality}</td></tr>
            </tbody>
          </table>
        </div>
      )}

      {/* 4. Modulation Classification */}
      {cls && (
        <div className="report-section">
          <div className="report-section-title">4. Modulation Classification</div>
          <table className="kv-table">
            <tbody>
              <tr><td>Detected Modulation</td><td style={{ color: 'var(--accent-cyan)', fontWeight: 700, fontSize: '0.95rem' }}>{cls.modulation}</td></tr>
              <tr><td>Modulation Family</td><td style={{ color: 'var(--accent-blue)' }}>{cls.family}</td></tr>
              <tr><td>Confidence</td><td style={{ color: 'var(--color-success)' }}>{cls.confidence.toFixed(1)}%</td></tr>
              <tr><td>AMC Model Version</td><td>{cls.modelVersion}</td></tr>
              <tr><td>Inference Time</td><td>{cls.inferenceTimeMs} ms</td></tr>
            </tbody>
          </table>
          <div style={{ marginTop: 10, fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            Top-K results: {cls.topK.map((r) => `${r.modulation} (${r.confidence.toFixed(1)}%)`).join(' · ')}
          </div>
        </div>
      )}

      {/* 5. Synchronization */}
      {sync && (
        <div className="report-section">
          <div className="report-section-title">5. Synchronization</div>
          <table className="kv-table">
            <tbody>
              <tr><td>Carrier Lock</td><td style={{ color: sync.carrierLocked ? 'var(--color-success)' : 'var(--color-error)' }}>{sync.carrierLocked ? '✓ Locked' : '✕ Failed'}</td></tr>
              <tr><td>Symbol Timing Lock</td><td style={{ color: sync.timingLocked ? 'var(--color-success)' : 'var(--color-error)' }}>{sync.timingLocked ? '✓ Locked' : '✕ Failed'}</td></tr>
              <tr><td>CFO Estimate</td><td style={{ color: 'var(--color-warning)' }}>{formatCFO(sync.cfoEstimate)}</td></tr>
              <tr><td>Phase Offset</td><td style={{ color: 'var(--color-warning)' }}>{formatPhase(sync.phaseOffset)}</td></tr>
              <tr><td>Timing Offset</td><td>{sync.timingOffset.toFixed(1)} samples</td></tr>
              <tr><td>Matched Filter</td><td style={{ color: sync.matchedFilterApplied ? 'var(--color-success)' : 'var(--color-warning)' }}>{sync.matchedFilterApplied ? '✓ Applied' : '○ Not Applied'}</td></tr>
            </tbody>
          </table>
        </div>
      )}

      {/* 6. Demodulation */}
      {demod && (
        <div className="report-section">
          <div className="report-section-title">6. Demodulation</div>
          <table className="kv-table">
            <tbody>
              <tr><td>Detected Modulation</td><td style={{ color: 'var(--accent-cyan)' }}>{demod.detectedModulation}</td></tr>
              <tr><td>Demodulator</td><td>{demod.demodulatorFamily}</td></tr>
              <tr><td>Status</td><td style={{ color: demod.status === 'successful' ? 'var(--color-success)' : 'var(--color-warning)' }}>{demod.status === 'successful' ? '✓ Successful' : '⚠ ' + demod.status}</td></tr>
              <tr><td>Recovered Symbols</td><td>{formatSamples(demod.recoveredSymbols)}</td></tr>
              <tr><td>Recovered Bits</td><td>{formatSamples(demod.recoveredBits)}</td></tr>
              <tr><td>BER (Before Decoding)</td><td style={{ color: 'var(--color-warning)' }}>{formatBER(demod.berBeforeDecoding)}</td></tr>
              <tr><td>BER (After Decoding)</td><td style={{ color: 'var(--color-success)' }}>{demod.berAfterDecoding != null ? formatBER(demod.berAfterDecoding) : 'N/A'}</td></tr>
            </tbody>
          </table>
        </div>
      )}

      {/* 7. FEC & Interleaver */}
      {fec && interleaver && (
        <div className="report-section">
          <div className="report-section-title">7. FEC & Interleaver</div>
          <table className="kv-table">
            <tbody>
              <tr><td>FEC Detected</td><td style={{ color: fec.detected ? 'var(--color-success)' : 'var(--text-muted)' }}>{fec.detected === true ? '✓ Yes' : fec.detected === false ? '○ No' : '? Unknown'}</td></tr>
              {fec.detected && <>
                <tr><td>FEC Family</td><td style={{ color: 'var(--accent-cyan)' }}>{fec.family}</td></tr>
                <tr><td>Code Rate</td><td>{fec.codeRate}</td></tr>
                <tr><td>Decoding</td><td style={{ color: fec.decodingStatus === 'successful' ? 'var(--color-success)' : 'var(--color-error)' }}>{fec.decodingStatus === 'successful' ? '✓ Successful' : fec.decodingStatus}</td></tr>
              </>}
              <tr><td>Interleaver Detected</td><td style={{ color: interleaver.detected ? 'var(--color-success)' : 'var(--text-muted)' }}>{interleaver.detected === true ? '✓ Yes' : '○ No'}</td></tr>
              {interleaver.detected && <>
                <tr><td>Interleaver Type</td><td>{interleaver.type}</td></tr>
                <tr><td>Depth</td><td>{interleaver.depth} bits</td></tr>
                <tr><td>De-interleaving</td><td style={{ color: 'var(--color-success)' }}>✓ {interleaver.deinterleavingStatus}</td></tr>
              </>}
            </tbody>
          </table>
        </div>
      )}

      {/* 8. BER Results */}
      {ber && (
        <div className="report-section">
          <div className="report-section-title">8. BER Results</div>
          <table className="kv-table">
            <tbody>
              <tr><td>BER Before FEC</td><td style={{ color: 'var(--color-warning)', fontWeight: 600 }}>{formatBER(ber.berBeforeFEC)}</td></tr>
              <tr><td>BER After FEC</td><td style={{ color: 'var(--color-success)', fontWeight: 600 }}>{ber.berAfterFEC != null ? formatBER(ber.berAfterFEC) : 'N/A'}</td></tr>
              <tr><td>Total Bits Analyzed</td><td>{formatSamples(ber.totalBits)}</td></tr>
              <tr><td>Error Bits (Raw)</td><td>{formatSamples(ber.errorBits)}</td></tr>
              {ber.decodedBits && <tr><td>Successfully Decoded Bits</td><td style={{ color: 'var(--color-success)' }}>{formatSamples(ber.decodedBits)}</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {/* Export */}
      <div className="card card-sm">
        <div className="card-header">
          <span className="card-title">Export Analysis Report</span>
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button className="btn btn-primary" onClick={exportPDF}>
            <Download size={13} /> Download PDF Report
          </button>
          <button className="btn btn-secondary" onClick={exportCSV}>
            <Download size={13} /> Export CSV
          </button>
          <button className="btn btn-secondary" onClick={exportJSON}>
            <Download size={13} /> Export JSON
          </button>
        </div>
        <div style={{ marginTop: 8, fontSize: '0.72rem', color: 'var(--text-muted)' }}>
          Note: PDF/CSV export requires backend connection. JSON export available in demo mode.
        </div>
      </div>
    </div>
  );
}
