import { useEffect, useRef } from 'react';
import { MOCK_EYE } from '../../data/mockSignal';
import PlotToolbar from '../common/PlotToolbar';

export default function EyeDiagram({ height = 280 }: { height?: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef   = useRef<HTMLDivElement>(null);
  const traces    = MOCK_EYE();

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap   = wrapRef.current;
    if (!canvas || !wrap) return;

    const w = wrap.clientWidth || 600;
    const h = height;
    canvas.width  = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, w, h);

    const pad = { top: 14, bottom: 28, left: 40, right: 14 };
    const plotW = w - pad.left - pad.right;
    const plotH = h - pad.top - pad.bottom;
    const cx    = pad.left + plotW / 2;
    const cy    = pad.top  + plotH / 2;

    // Grid
    ctx.strokeStyle = 'rgba(0,0,0,0.06)';
    ctx.lineWidth = 1;
    [0.25, 0.5, 0.75].forEach((f) => {
      const x = pad.left + f * plotW;
      ctx.beginPath(); ctx.moveTo(x, pad.top); ctx.lineTo(x, pad.top + plotH); ctx.stroke();
    });
    [0.25, 0.5, 0.75].forEach((f) => {
      const y = pad.top + f * plotH;
      ctx.beginPath(); ctx.moveTo(pad.left, y); ctx.lineTo(pad.left + plotW, y); ctx.stroke();
    });

    // Border
    ctx.strokeStyle = '#d0d4d8';
    ctx.lineWidth = 1;
    ctx.strokeRect(pad.left, pad.top, plotW, plotH);

    // Axes
    ctx.strokeStyle = 'rgba(0,0,0,0.1)';
    ctx.setLineDash([3, 5]);
    ctx.beginPath(); ctx.moveTo(cx, pad.top); ctx.lineTo(cx, pad.top + plotH); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(pad.left, cy); ctx.lineTo(pad.left + plotW, cy); ctx.stroke();
    ctx.setLineDash([]);

    // Eye opening markers
    const eyeY1 = cy - 0.50 * (plotH / 2) * 0.95;
    const eyeY2 = cy + 0.50 * (plotH / 2) * 0.95;
    ctx.strokeStyle = 'rgba(217,119,6,0.25)';
    ctx.setLineDash([4, 5]);
    ctx.beginPath(); ctx.moveTo(pad.left, eyeY1); ctx.lineTo(pad.left + plotW, eyeY1); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(pad.left, eyeY2); ctx.lineTo(pad.left + plotW, eyeY2); ctx.stroke();
    ctx.setLineDash([]);

    // Traces — blue semi-transparent
    const ampScale = plotH / 2 * 0.82;
    ctx.lineWidth = 0.8;
    ctx.globalAlpha = 0.22;

    traces.forEach((trace) => {
      ctx.strokeStyle = '#2563eb';
      ctx.beginPath();
      trace.forEach(({ t, v }, i) => {
        const x = pad.left + ((t + 1) / 2) * plotW;
        const y = cy - v * ampScale;
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      });
      ctx.stroke();
    });
    ctx.globalAlpha = 1;

    // Decision level
    ctx.strokeStyle = 'rgba(220,38,38,0.25)';
    ctx.lineWidth = 1;
    ctx.setLineDash([2, 5]);
    ctx.beginPath(); ctx.moveTo(pad.left, cy); ctx.lineTo(pad.left + plotW, cy); ctx.stroke();
    ctx.setLineDash([]);

    // Axis labels
    ctx.fillStyle = '#8892a0';
    ctx.font = '9px JetBrains Mono, monospace';
    ctx.textAlign = 'center';
    ctx.fillText('-T', pad.left,         pad.top + plotH + 14);
    ctx.fillText('0',  cx,               pad.top + plotH + 14);
    ctx.fillText('+T', pad.left + plotW, pad.top + plotH + 14);
    ctx.fillText('Symbol Period', cx, h - 1);
    ctx.textAlign = 'right';
    ctx.fillText('+1', pad.left - 3, pad.top + 10);
    ctx.fillText(' 0', pad.left - 3, cy + 4);
    ctx.fillText('-1', pad.left - 3, pad.top + plotH);

    // Info
    ctx.fillStyle = '#8892a0';
    ctx.textAlign = 'left';
    ctx.fillText('eye = 0.88', pad.left + 4, pad.top + 12);
    ctx.fillText('250 kSym/s', pad.left + 4, pad.top + 22);

  }, [height, traces]);

  return (
    <div className="chart-container">
      <div className="chart-header">
        <span className="chart-title">Eye Diagram</span>
        <div style={{ display: 'flex', gap: 12, fontSize: '0.67rem', fontFamily: 'var(--font-mono)', color: 'var(--chart-label)' }}>
          <span>eye <span style={{ color: '#16a34a', fontWeight: 600 }}>0.88</span></span>
          <span>margin <span style={{ color: 'var(--text-secondary)' }}>±0.12T</span></span>
        </div>
      </div>
      <PlotToolbar />
      <div ref={wrapRef} className="canvas-chart-wrapper" style={{ height, background: '#fff' }}>
        <canvas ref={canvasRef} style={{ width: '100%', height }} />
      </div>
    </div>
  );
}
