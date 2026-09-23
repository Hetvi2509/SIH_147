import { CheckCircle, XCircle, AlertTriangle, HelpCircle } from 'lucide-react';
import type { FECResult, InterleaverResult, BERResult } from '../../types';
import { formatBER, formatSamples } from '../../utils/formatters';
import StatusBadge from '../common/StatusBadge';

interface FECPanelProps {
  fec: FECResult;
  interleaver: InterleaverResult;
  ber: BERResult;
}

const FEC_STATUS_COLOR: Record<string, string> = {
  successful: 'var(--color-success)',
  failed: 'var(--color-error)',
  unknown: 'var(--color-warning)',
  unsupported: 'var(--color-warning)',
  'not-detected': 'var(--text-muted)',
};

function DetectionBadge({ detected }: { detected: boolean | null }) {
  if (detected === true) return <span style={{ color: 'var(--color-success)', fontFamily: 'var(--font-mono)', fontSize: '0.82rem' }}>✓ Detected</span>;
  if (detected === false) return <span style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: '0.82rem' }}>○ Not Detected</span>;
  return <span style={{ color: 'var(--color-warning)', fontFamily: 'var(--font-mono)', fontSize: '0.82rem' }}>? Unknown</span>;
}

export default function FECPanel({ fec, interleaver, ber }: FECPanelProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* FEC section */}
      <div className="card card-sm">
        <div className="card-header">
          <span className="card-title">Forward Error Correction (FEC)</span>
          <DetectionBadge detected={fec.detected} />
        </div>
        {fec.detected ? (
          <table className="kv-table">
            <tbody>
              <tr><td>FEC Family</td><td style={{ color: 'var(--accent-cyan)', fontWeight: 600 }}>{fec.family}</td></tr>
              <tr><td>Code Rate</td><td>{fec.codeRate}</td></tr>
              {fec.constraintLength && <tr><td>Constraint Length</td><td>{fec.constraintLength}</td></tr>}
              <tr><td>Decoding Status</td><td style={{ color: FEC_STATUS_COLOR[fec.decodingStatus] }}>
                {fec.decodingStatus === 'successful' ? '✓ Successful' : fec.decodingStatus.replace('-', ' ')}
              </td></tr>
              {fec.decodedBits && <tr><td>Decoded Bits</td><td>{formatSamples(fec.decodedBits)}</td></tr>}
              {fec.errorBits != null && <tr><td>Corrected Errors</td><td style={{ color: 'var(--color-warning)' }}>{fec.errorBits}</td></tr>}
            </tbody>
          </table>
        ) : (
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
            {fec.detected === false
              ? 'No FEC encoding detected in this signal.'
              : 'FEC detection inconclusive — insufficient information or unsupported coding scheme.'
            }
          </div>
        )}
      </div>

      {/* Interleaver section */}
      <div className="card card-sm">
        <div className="card-header">
          <span className="card-title">Interleaver</span>
          <DetectionBadge detected={interleaver.detected} />
        </div>
        {interleaver.detected ? (
          <table className="kv-table">
            <tbody>
              <tr><td>Interleaver Type</td><td style={{ color: 'var(--accent-cyan)', fontWeight: 600 }}>{interleaver.type}</td></tr>
              {interleaver.depth && <tr><td>Depth</td><td>{interleaver.depth} bits</td></tr>}
              <tr><td>De-interleaving</td><td style={{ color: interleaver.deinterleavingStatus === 'completed' ? 'var(--color-success)' : 'var(--color-error)' }}>
                {interleaver.deinterleavingStatus === 'completed' ? '✓ Completed' : '✕ ' + interleaver.deinterleavingStatus}
              </td></tr>
            </tbody>
          </table>
        ) : (
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
            No interleaver detected.
          </div>
        )}
      </div>

      {/* BER comparison */}
      <div className="card card-sm">
        <div className="card-header">
          <span className="card-title">BER Analysis</span>
        </div>
        <div className="ber-comparison" style={{ marginBottom: 12 }}>
          <div className="ber-item">
            <div className="ber-label">Before FEC Decoding</div>
            <div className="ber-value before">{formatBER(ber.berBeforeFEC)}</div>
          </div>
          <div className="ber-item">
            <div className="ber-label">After FEC Decoding</div>
            <div className="ber-value after">{ber.berAfterFEC != null ? formatBER(ber.berAfterFEC) : 'N/A'}</div>
          </div>
        </div>
        <table className="kv-table">
          <tbody>
            <tr><td>Total Bits Analyzed</td><td>{formatSamples(ber.totalBits)}</td></tr>
            <tr><td>Error Bits (Raw)</td><td style={{ color: 'var(--color-warning)' }}>{formatSamples(ber.errorBits)}</td></tr>
            {ber.decodedBits && <tr><td>Decoded Bits</td><td style={{ color: 'var(--color-success)' }}>{formatSamples(ber.decodedBits)}</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
