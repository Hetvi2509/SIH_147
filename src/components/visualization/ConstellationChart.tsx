import { useEffect, useRef } from 'react';
import { MOCK_CONSTELLATION } from '../../data/mockSignal';
import PlotToolbar from '../common/PlotToolbar';

const IDEAL_QPSK = [
  { i:  0.707, q:  0.707 },
  { i: -0.707, q:  0.707 },
  { i: -0.707, q: -0.707 },
  { i:  0.707, q: -0.707 },
];

export default function ConstellationChart({ height = 300 }: { height?: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef   = useRef<HTMLDivElement>(null);
  const points    = MOCK_CONSTELLATION();

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap   = wrapRef.current;
    if (!canvas || !wrap) return;

    const w = wrap.clientWidth || height;
    const h = height;
    canvas.width  = w;
    canvas.height = h;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // White background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, w, h);

    const cx    = w / 2;
    const cy    = h / 2;
    const scale = Math.min(w, h) * 0.37;

    // Grid circles
    ctx.strokeStyle = 'rgba(0,0,0,0.07)';
    ctx.lineWidth = 1;
    [0.5, 1.0].forEach((r) => {
      ctx.beginPath();
      ctx.arc(cx, cy, r * scale, 0, 2 * Math.PI);
      ctx.stroke();
    });

    // Axes
    ctx.strokeStyle = 'rgba(0,0,0,0.1)';
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 5]);
    ctx.beginPath(); ctx.moveTo(cx, 8); ctx.lineTo(cx, h - 8); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(8, cy); ctx.lineTo(w - 8, cy); ctx.stroke();
    ctx.setLineDash([]);

    // Axis labels
    ctx.fillStyle = '#94a3b8';
    ctx.font = '9px JetBrains Mono, monospace';
    ctx.textAlign = 'center';
    ctx.fillText('+I', w - 12, cy - 4);
    ctx.fillText('-I',    12, cy - 4);
    ctx.fillText('+Q', cx + 3, 13);
    ctx.fillText('-Q', cx + 3, h - 4);

    // Rx constellation points — semi-transparent blue
    ctx.globalAlpha = 0.6;
    points.forEach(({ i, q }) => {
      const px = cx + i * scale;
      const py = cy - q * scale;
      ctx.fillStyle = '#2563eb';
      ctx.beginPath();
      ctx.arc(px, py, 1.5, 0, 2 * Math.PI);
      ctx.fill();
    });
    ctx.globalAlpha = 1;

    // Ideal QPSK points — amber crosshairs
    const labels = ['00', '01', '11', '10'];
    IDEAL_QPSK.forEach(({ i, q }, idx) => {
      const px = cx + i * scale;
      const py = cy - q * scale;

      ctx.strokeStyle = '#d97706';
      ctx.lineWidth = 1.5;
      const s = 7;
      ctx.beginPath(); ctx.moveTo(px - s, py); ctx.lineTo(px + s, py); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(px, py - s); ctx.lineTo(px, py + s); ctx.stroke();

      ctx.fillStyle = '#d97706';
      ctx.font = '8px JetBrains Mono, monospace';
      ctx.textAlign = 'center';
      ctx.fillText(labels[idx], px, py - 12);
    });

    // Annotation
    ctx.fillStyle = '#94a3b8';
    ctx.font = '9px JetBrains Mono, monospace';
    ctx.textAlign = 'left';
    ctx.fillText('QPSK', 7, 13);
    ctx.fillText(`n = ${points.length}`, 7, 24);
    ctx.fillText('EVM 4.7%', 7, 35);

  }, [height, points]);

  return (
    <div className="chart-container">
      <div className="chart-header">
        <span className="chart-title">Constellation</span>
        <div style={{ display: 'flex', gap: 12, fontSize: '0.67rem', fontFamily: 'var(--font-mono)', color: 'var(--chart-label)' }}>
          <span style={{ color: '#2563eb' }}>● Rx</span>
          <span style={{ color: '#d97706' }}>+ Ideal</span>
          <span>EVM <span style={{ color: '#16a34a', fontWeight: 600 }}>4.7%</span></span>
        </div>
      </div>
      <PlotToolbar />
      <div ref={wrapRef} className="canvas-chart-wrapper" style={{ height, background: '#fff' }}>
        <canvas ref={canvasRef} style={{ width: '100%', height }} />
      </div>
    </div>
  );
}
