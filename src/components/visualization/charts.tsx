import { useEffect, useRef } from 'react';
import {
  Area, CartesianGrid, ComposedChart, Line, LineChart, ReferenceLine, Scatter, ScatterChart, XAxis, YAxis,
} from 'recharts';
import {
  ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig,
} from '@/components/ui/chart';
import {
  MOCK_AMPLITUDE, MOCK_CONSTELLATION, MOCK_EYE, MOCK_FREQ_VS_TIME, MOCK_IQ, MOCK_PHASE_VS_TIME,
  MOCK_SPECTRUM, MOCK_WATERFALL,
} from '@/data/mockSignal';
import { AXIS_TICK, C, sliceWindow, type ZoomWindow } from '@/lib/chart';

export interface PlotProps { height: number; zoom: ZoomWindow; fc?: number }

const MARGIN = { top: 8, right: 16, left: 0, bottom: 4 };
const axisProps = { tickLine: false, axisLine: { stroke: C.axis }, tick: AXIS_TICK } as const;
const fill = (h: number) => ({ height: h, width: '100%', aspectRatio: 'auto' as const });

// ---------------------------------------------------------------- Recharts

export function IQPlot({ height, zoom }: PlotProps) {
  const data = sliceWindow(MOCK_IQ(), zoom);
  const config = {
    i: { label: 'I', color: C.orange },
    q: { label: 'Q', color: C.slate },
    amplitude: { label: '|A|', color: C.green },
  } satisfies ChartConfig;
  return (
    <ChartContainer config={config} className="aspect-auto" style={fill(height)}>
      <LineChart data={data} margin={MARGIN}>
        <CartesianGrid stroke={C.grid} vertical={false} />
        <XAxis dataKey="time" minTickGap={40} tickFormatter={(v) => Number(v).toFixed(0)} {...axisProps} label={{ value: 'Time (µs)', position: 'insideBottom', offset: -2, fill: C.label, fontSize: 12 }} height={36} />
        <YAxis domain={[-1.3, 1.3]} width={38} {...axisProps} />
        <ChartTooltip cursor={{ stroke: C.axis }} content={<ChartTooltipContent labelFormatter={(_, p) => `t = ${Number(p?.[0]?.payload?.time).toFixed(1)} µs`} />} />
        <ReferenceLine y={0} stroke={C.axis} />
        <Line dataKey="amplitude" type="monotone" stroke="var(--color-amplitude)" strokeWidth={1} strokeDasharray="3 3" dot={false} isAnimationActive={false} />
        <Line dataKey="i" type="linear" stroke="var(--color-i)" strokeWidth={1.4} dot={false} isAnimationActive={false} />
        <Line dataKey="q" type="linear" stroke="var(--color-q)" strokeWidth={1.4} dot={false} isAnimationActive={false} />
      </LineChart>
    </ChartContainer>
  );
}

export function SpectrumPlot({ height, zoom, fc = 2.45 }: PlotProps) {
  const data = sliceWindow(MOCK_SPECTRUM(), zoom);
  const config = { power: { label: 'Power (dBm)', color: C.orange }, noise: { label: 'Noise floor', color: C.axis } } satisfies ChartConfig;
  return (
    <ChartContainer config={config} className="aspect-auto" style={fill(height)}>
      <ComposedChart data={data} margin={MARGIN}>
        <defs>
          <linearGradient id="specFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={C.orange} stopOpacity={0.22} />
            <stop offset="100%" stopColor={C.orange} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke={C.grid} vertical={false} />
        <XAxis dataKey="freq" type="number" domain={['dataMin', 'dataMax']} minTickGap={40} tickFormatter={(v) => Number(v).toFixed(2)} {...axisProps} label={{ value: 'Frequency (MHz)', position: 'insideBottom', offset: -2, fill: C.label, fontSize: 12 }} height={36} />
        <YAxis domain={[-85, -10]} width={40} {...axisProps} />
        <ChartTooltip cursor={{ stroke: C.axis }} content={<ChartTooltipContent labelFormatter={(_, p) => `${Number(p?.[0]?.payload?.freq).toFixed(3)} MHz`} />} />
        <Area dataKey="power" type="monotone" stroke="none" fill="url(#specFill)" isAnimationActive={false} />
        <Line dataKey="noise" type="monotone" stroke="var(--color-noise)" strokeWidth={1} dot={false} isAnimationActive={false} />
        <Line dataKey="power" type="monotone" stroke="var(--color-power)" strokeWidth={1.5} dot={false} isAnimationActive={false} />
        <ReferenceLine x={fc} stroke={C.slate} strokeDasharray="4 4" label={{ value: 'Fc', position: 'top', fill: C.slate, fontSize: 11 }} />
      </ComposedChart>
    </ChartContainer>
  );
}

export function FreqPlot({ height, zoom, fc = 2.45 }: PlotProps) {
  const data = sliceWindow(MOCK_FREQ_VS_TIME(), zoom);
  const config = { frequency: { label: 'Frequency (kHz)', color: C.orange } } satisfies ChartConfig;
  const fcKhz = fc * 1000;
  return (
    <ChartContainer config={config} className="aspect-auto" style={fill(height)}>
      <LineChart data={data} margin={MARGIN}>
        <CartesianGrid stroke={C.grid} vertical={false} />
        <XAxis dataKey="time" minTickGap={40} tickFormatter={(v) => Number(v).toFixed(1)} {...axisProps} label={{ value: 'Time (s)', position: 'insideBottom', offset: -2, fill: C.label, fontSize: 12 }} height={36} />
        <YAxis domain={[fcKhz - 4, fcKhz + 6]} width={48} tickFormatter={(v) => Number(v).toFixed(0)} {...axisProps} />
        <ChartTooltip cursor={{ stroke: C.axis }} content={<ChartTooltipContent labelFormatter={(_, p) => `t = ${Number(p?.[0]?.payload?.time).toFixed(2)} s`} />} />
        <ReferenceLine y={fcKhz} stroke={C.slate} strokeDasharray="4 4" label={{ value: 'Fc', position: 'insideBottomRight', fill: C.slate, fontSize: 11 }} />
        <Line dataKey="frequency" type="monotone" stroke="var(--color-frequency)" strokeWidth={1.5} dot={false} isAnimationActive={false} />
      </LineChart>
    </ChartContainer>
  );
}

export function AmplitudePlot({ height, zoom }: PlotProps) {
  const data = sliceWindow(MOCK_AMPLITUDE(), zoom);
  const config = { amplitude: { label: 'Amplitude', color: C.orange } } satisfies ChartConfig;
  return (
    <ChartContainer config={config} className="aspect-auto" style={fill(height)}>
      <LineChart data={data} margin={MARGIN}>
        <CartesianGrid stroke={C.grid} vertical={false} />
        <XAxis dataKey="time" minTickGap={40} tickFormatter={(v) => Number(v).toFixed(1)} {...axisProps} label={{ value: 'Time (s)', position: 'insideBottom', offset: -2, fill: C.label, fontSize: 12 }} height={36} />
        <YAxis domain={[0.55, 0.85]} width={40} tickFormatter={(v) => Number(v).toFixed(2)} {...axisProps} />
        <ChartTooltip cursor={{ stroke: C.axis }} content={<ChartTooltipContent />} />
        <ReferenceLine y={0.707} stroke={C.slate} strokeDasharray="4 4" label={{ value: '1/√2', position: 'insideBottomRight', fill: C.slate, fontSize: 11 }} />
        <Line dataKey="amplitude" type="monotone" stroke="var(--color-amplitude)" strokeWidth={1.5} dot={false} isAnimationActive={false} />
      </LineChart>
    </ChartContainer>
  );
}

export function PhasePlot({ height, zoom }: PlotProps) {
  const data = sliceWindow(MOCK_PHASE_VS_TIME(), zoom);
  const config = { phase: { label: 'Phase (°)', color: C.orange } } satisfies ChartConfig;
  return (
    <ChartContainer config={config} className="aspect-auto" style={fill(height)}>
      <ScatterChart margin={MARGIN}>
        <CartesianGrid stroke={C.grid} vertical={false} />
        <XAxis type="number" dataKey="time" domain={['dataMin', 'dataMax']} minTickGap={40} tickFormatter={(v) => Number(v).toFixed(0)} {...axisProps} label={{ value: 'Time (µs)', position: 'insideBottom', offset: -2, fill: C.label, fontSize: 12 }} height={36} />
        <YAxis type="number" dataKey="phase" domain={[-200, 220]} width={44} tickFormatter={(v) => `${v}°`} {...axisProps} />
        <ChartTooltip cursor={{ stroke: C.axis }} content={<ChartTooltipContent />} />
        <Scatter data={data} fill="var(--color-phase)" fillOpacity={0.55} r={1.6} isAnimationActive={false} />
      </ScatterChart>
    </ChartContainer>
  );
}

// ------------------------------------------------------------------ Canvas

/** Sizes a canvas to its wrapper at device pixel ratio and redraws on resize. */
function useCanvas(height: number, draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void, deps: unknown[]) {
  const wrap = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const drawRef = useRef(draw);
  drawRef.current = draw;

  useEffect(() => {
    const el = wrap.current, cv = canvas.current;
    if (!el || !cv) return;
    const paint = () => {
      const w = el.clientWidth, dpr = window.devicePixelRatio || 1;
      cv.width = Math.round(w * dpr); cv.height = Math.round(height * dpr);
      cv.style.width = `${w}px`; cv.style.height = `${height}px`;
      const ctx = cv.getContext('2d');
      if (!ctx) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, height);
      ctx.font = '12px "Inter Variable", system-ui, sans-serif';
      drawRef.current(ctx, w, height);
    };
    paint();
    const ro = new ResizeObserver(paint);
    ro.observe(el);
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [height, ...deps]);

  return (
    <div ref={wrap} style={{ height }} className="w-full overflow-hidden">
      <canvas ref={canvas} className="block" />
    </div>
  );
}

const IDEAL_QPSK = [
  { i: 0.707, q: 0.707, bits: '00' }, { i: -0.707, q: 0.707, bits: '01' },
  { i: -0.707, q: -0.707, bits: '11' }, { i: 0.707, q: -0.707, bits: '10' },
];

export function ConstellationPlot({ height }: PlotProps) {
  const points = MOCK_CONSTELLATION();
  const ref = useCanvas(height, (ctx, w, h) => {
    const cx = w / 2, cy = h / 2, r = Math.min(w, h) * 0.38;
    ctx.strokeStyle = C.grid; ctx.lineWidth = 1;
    [0.5, 1].forEach((k) => { ctx.beginPath(); ctx.arc(cx, cy, k * r, 0, Math.PI * 2); ctx.stroke(); });
    ctx.strokeStyle = C.axis; ctx.setLineDash([3, 5]);
    ctx.beginPath(); ctx.moveTo(cx, 10); ctx.lineTo(cx, h - 10); ctx.moveTo(10, cy); ctx.lineTo(w - 10, cy); ctx.stroke();
    ctx.setLineDash([]);

    ctx.fillStyle = C.label; ctx.textAlign = 'center';
    ctx.fillText('I', w - 12, cy - 6); ctx.fillText('Q', cx + 10, 16);

    ctx.globalAlpha = 0.55; ctx.fillStyle = C.orange;
    points.forEach(({ i, q }) => { ctx.beginPath(); ctx.arc(cx + i * r, cy - q * r, 1.6, 0, Math.PI * 2); ctx.fill(); });
    ctx.globalAlpha = 1;

    ctx.strokeStyle = C.slate; ctx.lineWidth = 1.5; ctx.fillStyle = C.slate;
    IDEAL_QPSK.forEach(({ i, q, bits }) => {
      const x = cx + i * r, y = cy - q * r;
      ctx.beginPath(); ctx.moveTo(x - 6, y); ctx.lineTo(x + 6, y); ctx.moveTo(x, y - 6); ctx.lineTo(x, y + 6); ctx.stroke();
      ctx.fillText(bits, x, y - 12);
    });
  }, [points]);
  return ref;
}

export function EyePlot({ height }: PlotProps) {
  const traces = MOCK_EYE();
  return useCanvas(height, (ctx, w, h) => {
    const pad = { t: 10, b: 30, l: 40, r: 12 };
    const pw = w - pad.l - pad.r, ph = h - pad.t - pad.b, cy = pad.t + ph / 2, cx = pad.l + pw / 2;
    ctx.strokeStyle = C.grid; ctx.lineWidth = 1;
    [0.25, 0.5, 0.75].forEach((f) => {
      ctx.beginPath(); ctx.moveTo(pad.l + f * pw, pad.t); ctx.lineTo(pad.l + f * pw, pad.t + ph);
      ctx.moveTo(pad.l, pad.t + f * ph); ctx.lineTo(pad.l + pw, pad.t + f * ph); ctx.stroke();
    });
    ctx.strokeStyle = C.axis; ctx.strokeRect(pad.l, pad.t, pw, ph);

    ctx.globalAlpha = 0.22; ctx.strokeStyle = C.orange; ctx.lineWidth = 1;
    const amp = (ph / 2) * 0.82;
    traces.forEach((tr) => {
      ctx.beginPath();
      tr.forEach(({ t, v }, k) => { const x = pad.l + ((t + 1) / 2) * pw, y = cy - v * amp; k ? ctx.lineTo(x, y) : ctx.moveTo(x, y); });
      ctx.stroke();
    });
    ctx.globalAlpha = 1;

    ctx.fillStyle = C.label; ctx.textAlign = 'center';
    ctx.fillText('−T', pad.l, pad.t + ph + 16); ctx.fillText('0', cx, pad.t + ph + 16); ctx.fillText('+T', pad.l + pw, pad.t + ph + 16);
    ctx.textAlign = 'right';
    ctx.fillText('+1', pad.l - 6, pad.t + 12); ctx.fillText('0', pad.l - 6, cy + 4); ctx.fillText('−1', pad.l - 6, pad.t + ph);
  }, [traces]);
}

/** Warm sequential ramp: cream, orange, deep brown. Reads on white and keeps the theme. */
const RAMP: [number, number, number, number][] = [
  [0.0, 255, 248, 240], [0.3, 253, 200, 150], [0.55, 240, 120, 50], [0.8, 178, 58, 11], [1.0, 52, 20, 8],
];
export function ramp(p: number): [number, number, number] {
  const t = Math.max(0, Math.min(1, p));
  for (let k = 1; k < RAMP.length; k++) {
    if (t <= RAMP[k][0]) {
      const [t0, r0, g0, b0] = RAMP[k - 1], [t1, r1, g1, b1] = RAMP[k], u = (t - t0) / (t1 - t0);
      return [r0 + (r1 - r0) * u, g0 + (g1 - g0) * u, b0 + (b1 - b0) * u];
    }
  }
  return [52, 20, 8];
}

export function SpectrogramPlot({ height }: PlotProps) {
  const TB = 32, FB = 128;
  const data = MOCK_WATERFALL();
  return useCanvas(height, (ctx, w, h) => {
    const l = 46, r = 62, t = 8, b = 26, pw = w - l - r, ph = h - t - b;
    const img = ctx.createImageData(Math.max(1, Math.floor(pw)), Math.max(1, Math.floor(ph)));
    for (let y = 0; y < img.height; y++) {
      for (let x = 0; x < img.width; x++) {
        const v = data[Math.floor((y / img.height) * TB) * FB + Math.floor((x / img.width) * FB)];
        const [R, G, B] = ramp((v + 80) / 70);
        const o = (y * img.width + x) * 4;
        img.data[o] = R; img.data[o + 1] = G; img.data[o + 2] = B; img.data[o + 3] = 255;
      }
    }
    // putImageData ignores the DPR transform, so draw through a temp canvas.
    const tmp = document.createElement('canvas'); tmp.width = img.width; tmp.height = img.height;
    tmp.getContext('2d')!.putImageData(img, 0, 0);
    ctx.drawImage(tmp, l, t, pw, ph);
    ctx.strokeStyle = C.axis; ctx.strokeRect(l, t, pw, ph);

    ctx.fillStyle = C.label; ctx.textAlign = 'center';
    ['1.85', '2.15', '2.45', '2.75', '3.05'].forEach((s, k) => ctx.fillText(s, l + (k / 4) * pw, h - 8));
    ctx.textAlign = 'right';
    for (let k = 0; k <= 4; k++) ctx.fillText(`${(((4 - k) / 4) * 4.37).toFixed(1)}s`, l - 6, t + (k / 4) * ph + 4);

    for (let y = 0; y < ph; y++) { const [R, G, B] = ramp(1 - y / ph); ctx.fillStyle = `rgb(${R},${G},${B})`; ctx.fillRect(w - r + 10, t + y, 10, 1); }
    ctx.strokeStyle = C.axis; ctx.strokeRect(w - r + 10, t, 10, ph);
    ctx.fillStyle = C.label; ctx.textAlign = 'left';
    ctx.fillText('−10', w - r + 24, t + 10); ctx.fillText('−80', w - r + 24, t + ph);
  }, [data]);
}
