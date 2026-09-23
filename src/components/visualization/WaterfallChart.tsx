import { useEffect, useRef } from 'react';
import { MOCK_WATERFALL } from '../../data/mockSignal';
import PlotToolbar from '../common/PlotToolbar';

const TIME_BINS = 32;
const FREQ_BINS = 128;

// Thermal colormap suitable for both light and dark â€” low=blue, high=yellow/white
function powerToColor(normalized: number): [number, number, number] {
  const p = Math.max(0, Math.min(1, normalized));
  let r: number, g: number, b: number;
  if (p < 0.2) {
    const t = p / 0.2;
    r = Math.round(20 + 20 * t);
    g = Math.round(30 + 40 * t);
    b = Math.round(100 + 100 * t);
  } else if (p < 0.4) {
    const t = (p - 0.2) / 0.2;
    r = Math.round(40 + 60 * t);
    g = Math.round(70 + 80 * t);
    b = Math.round(200 - 80 * t);
  } else if (p < 0.65) {
    const t = (p - 0.4) / 0.25;
    r = Math.round(100 + 130 * t);
    g = Math.round(150 + 80 * t);
    b = Math.round(120 - 90 * t);
  } else if (p < 0.85) {
    const t = (p - 0.65) / 0.2;
    r = Math.round(230 + 20 * t);
    g = Math.round(230 - 10 * t);
    b = Math.round(30 - 20 * t);
  } else {
    const t = (p - 0.85) / 0.15;
    r = 250;
    g = Math.round(220 + 35 * t);
    b = Math.round(10 + 245 * t);
  }
  return [r, g, b];
}

export default function WaterfallChart({ height = 320 }: { height?: number }) {
  const canvasRef   = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const w = container.clientWidth || 600;
    const h = height - 40;
    canvas.width  = w;
    canvas.height = h;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const data = MOCK_WATERFALL();
    const minPower = -80, maxPower = -10, range = maxPower - minPower;

    // Light gray background behind spectrogram
    ctx.fillStyle = '#f4f5f6';
    ctx.fillRect(0, 0, w, h);

    const lp = 44, rp = 28, tp = 6, bp = 22;
    const plotW = w - lp - rp;
    const plotH = h - tp - bp;

    // Draw pixel data
    const imgData = ctx.createImageData(plotW, plotH);
    const pix = imgData.data;
    const cellW = plotW / FREQ_BINS;
    const cellH = plotH / TIME_BINS;

    for (let t = 0; t < TIME_BINS; t++) {
      for (let f = 0; f < FREQ_BINS; f++) {
        const power = data[t * FREQ_BINS + f];
        const norm  = (power - minPower) / range;
        const [r, g, b] = powerToColor(norm);
        const px = Math.floor(f * cellW);
        const py = Math.floor(t * cellH);
        const pw = Math.max(1, Math.ceil(cellW));
        const ph = Math.max(1, Math.ceil(cellH));
        for (let dy = 0; dy < ph; dy++) {
          for (let dx = 0; dx < pw; dx++) {
            const idx = ((py + dy) * plotW + (px + dx)) * 4;
            if (idx < pix.length - 3) {
              pix[idx] = r; pix[idx+1] = g; pix[idx+2] = b; pix[idx+3] = 255;
            }
          }
        }
      }
    }
    ctx.putImageData(imgData, lp, tp);

    // Border
    ctx.strokeStyle = '#d0d4d8';
    ctx.lineWidth = 1;
    ctx.strokeRect(lp, tp, plotW, plotH);

    // X-axis labels
    ctx.fillStyle = '#8892a0';
    ctx.font = '9px JetBrains Mono, monospace';
    ctx.textAlign = 'center';
    const freqLabels = ['1.85','2.05','2.25','2.45','2.65','2.85','3.05'];
    freqLabels.forEach((label, i) => {
      const x = lp + (i / (freqLabels.length - 1)) * plotW;
      ctx.fillText(label, x, h - 8);
    });

    // Y-axis labels
    ctx.textAlign = 'right';
    for (let i = 0; i <= 4; i++) {
      const y = tp + (i / 4) * plotH;
      const t = ((4 - i) / 4) * 4.37;
      ctx.fillText(`${t.toFixed(1)}s`, lp - 3, y + 3);
    }

    // Fc marker
    const fcX = lp + (FREQ_BINS / 2 / FREQ_BINS) * plotW;
    ctx.strokeStyle = 'rgba(217,119,6,0.7)';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 3]);
    ctx.beginPath(); ctx.moveTo(fcX, tp); ctx.lineTo(fcX, tp + plotH); ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = '#d97706';
    ctx.textAlign = 'center';
    ctx.font = '8px JetBrains Mono, monospace';
    ctx.fillText('Fc', fcX, tp - 1);

    // Color legend
    const lx = w - rp + 4;
    const lh = plotH;
    for (let y = 0; y < lh; y++) {
      const [r, g, b] = powerToColor(1 - y / lh);
      ctx.fillStyle = `rgb(${r},${g},${b})`;
      ctx.fillRect(lx, tp + y, 10, 1);
    }
    ctx.strokeStyle = '#d0d4d8';
    ctx.lineWidth = 1;
    ctx.strokeRect(lx, tp, 10, lh);
    ctx.fillStyle = '#8892a0';
    ctx.font = '8px JetBrains Mono, monospace';
    ctx.textAlign = 'left';
    ctx.fillText('âˆ’10', lx + 12, tp + 8);
    ctx.fillText('âˆ’80', lx + 12, tp + lh);

  }, [height]);

  return (
    <div className="chart-container">
      <div className="chart-header">
        <span className="chart-title">Spectrogram / Waterfall</span>
        <div style={{ display: 'flex', gap: 12, fontSize: '0.67rem', fontFamily: 'var(--font-mono)', color: 'var(--chart-label)' }}>
          <span>Range <span style={{ color: 'var(--text-secondary)' }}>1.85 â€“ 3.05 MHz</span></span>
          <span>Duration <span style={{ color: 'var(--text-secondary)' }}>4.37 s</span></span>
          <span>Scale <span style={{ color: 'var(--text-secondary)' }}>âˆ’80 to âˆ’10 dBm</span></span>
        </div>
      </div>
      <PlotToolbar />
      <div ref={containerRef} className="canvas-chart-wrapper" style={{ height, background: '#f4f5f6' }}>
        <canvas ref={canvasRef} style={{ width: '100%', height }} />
      </div>
    </div>
  );
}
