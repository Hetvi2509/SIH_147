import { Svg, Path, Line, Rect, Circle, G, Text as SvgText } from '@react-pdf/renderer';
import { T } from './theme';

export interface Pt { x: number; y: number }
export interface Series { data: Pt[]; color: string; width?: number; dash?: string }
export interface RefLine { value: number; label?: string; color?: string }

const M = { l: 44, r: 10, t: 8, b: 30 };

function extent(vals: number[]): [number, number] {
  let lo = Infinity, hi = -Infinity;
  for (const v of vals) { if (v < lo) lo = v; if (v > hi) hi = v; }
  return lo === hi ? [lo - 1, hi + 1] : [lo, hi];
}

function ticks(lo: number, hi: number, n = 5): number[] {
  return Array.from({ length: n }, (_, i) => lo + ((hi - lo) * i) / (n - 1));
}

const fmt = (v: number, d?: number) => {
  const a = Math.abs(v);
  const digits = d ?? (a >= 100 ? 0 : a >= 10 ? 1 : 2);
  return v.toFixed(digits).replace(/^-/, '−');
};

function decimate<T>(a: T[], max = 320): T[] {
  if (a.length <= max) return a;
  const step = Math.ceil(a.length / max);
  return a.filter((_, i) => i % step === 0);
}

interface AxesProps {
  width: number; height: number;
  xDomain: [number, number]; yDomain: [number, number];
  xLabel: string; yLabel: string;
  xFmt?: (v: number) => string; yFmt?: (v: number) => string;
  xTicks?: number[]; yTicks?: number[];
  children: (sx: (v: number) => number, sy: (v: number) => number) => React.ReactNode;
}

function Axes({ width, height, xDomain, yDomain, xLabel, yLabel, xFmt = fmt, yFmt = fmt, xTicks, yTicks, children }: AxesProps) {
  const pw = width - M.l - M.r, ph = height - M.t - M.b;
  const sx = (v: number) => M.l + ((v - xDomain[0]) / (xDomain[1] - xDomain[0])) * pw;
  const sy = (v: number) => M.t + ph - ((v - yDomain[0]) / (yDomain[1] - yDomain[0])) * ph;
  const xt = xTicks ?? ticks(xDomain[0], xDomain[1], 6);
  const yt = yTicks ?? ticks(yDomain[0], yDomain[1], 5);
  return (
    <Svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      <Rect x={M.l} y={M.t} width={pw} height={ph} fill="#ffffff" />
      {yt.map((v) => (
        <G key={`y${v}`}>
          <Line x1={M.l} x2={M.l + pw} y1={sy(v)} y2={sy(v)} stroke={T.grid} strokeWidth={0.6} />
          <SvgText x={M.l - 4} y={sy(v) + 2.5} fill={T.muted} textAnchor="end" style={{ fontFamily: 'Inter', fontSize: 6.5 }}>{yFmt(v)}</SvgText>
        </G>
      ))}
      {xt.map((v) => (
        <SvgText key={`x${v}`} x={sx(v)} y={M.t + ph + 10} fill={T.muted} textAnchor="middle" style={{ fontFamily: 'Inter', fontSize: 6.5 }}>{xFmt(v)}</SvgText>
      ))}
      <Line x1={M.l} x2={M.l + pw} y1={M.t + ph} y2={M.t + ph} stroke={T.line} strokeWidth={0.8} />
      <Line x1={M.l} x2={M.l} y1={M.t} y2={M.t + ph} stroke={T.line} strokeWidth={0.8} />
      <SvgText x={M.l + pw / 2} y={height - 3} fill={T.ink2} textAnchor="middle" style={{ fontFamily: 'Inter', fontSize: 7 }}>{xLabel}</SvgText>
      <SvgText x={7} y={M.t + ph / 2} fill={T.ink2} textAnchor="middle" transform={`rotate(-90 7 ${M.t + ph / 2})`} style={{ fontFamily: 'Inter', fontSize: 7 }}>{yLabel}</SvgText>
      {children(sx, sy)}
    </Svg>
  );
}

interface LinePlotProps {
  width: number; height: number; series: Series[];
  xLabel: string; yLabel: string;
  yDomain?: [number, number]; xDomain?: [number, number];
  xFmt?: (v: number) => string; yFmt?: (v: number) => string;
  xTicks?: number[]; yTicks?: number[];
  hLines?: RefLine[]; vLines?: RefLine[];
  area?: boolean;
}

export function LinePlot({ width, height, series, xLabel, yLabel, yDomain, xDomain, xFmt, yFmt, xTicks, yTicks, hLines = [], vLines = [], area }: LinePlotProps) {
  const all = series.flatMap((s) => s.data);
  const xd = xDomain ?? extent(all.map((p) => p.x));
  const yd = yDomain ?? extent(all.map((p) => p.y));
  return (
    <Axes width={width} height={height} xDomain={xd} yDomain={yd} xLabel={xLabel} yLabel={yLabel} xFmt={xFmt} yFmt={yFmt} xTicks={xTicks} yTicks={yTicks}>
      {(sx, sy) => (
        <>
          {area && series[0] && (() => {
            const d = decimate(series[0].data);
            const path = d.map((p, i) => `${i ? 'L' : 'M'}${sx(p.x).toFixed(1)} ${sy(p.y).toFixed(1)}`).join(' ');
            return <Path d={`${path} L${sx(d[d.length - 1].x).toFixed(1)} ${sy(yd[0]).toFixed(1)} L${sx(d[0].x).toFixed(1)} ${sy(yd[0]).toFixed(1)} Z`} fill={series[0].color} fillOpacity={0.1} />;
          })()}
          {hLines.map((l) => (
            <G key={`h${l.value}`}>
              <Line x1={M.l} x2={width - M.r} y1={sy(l.value)} y2={sy(l.value)} stroke={l.color ?? T.slate} strokeWidth={0.7} strokeDasharray="3 3" />
              {l.label && <SvgText x={width - M.r - 2} y={sy(l.value) - 2.5} fill={l.color ?? T.slate} textAnchor="end" style={{ fontFamily: 'Inter', fontSize: 6.5 }}>{l.label}</SvgText>}
            </G>
          ))}
          {vLines.map((l) => (
            <G key={`v${l.value}`}>
              <Line x1={sx(l.value)} x2={sx(l.value)} y1={M.t} y2={height - M.b} stroke={l.color ?? T.slate} strokeWidth={0.7} strokeDasharray="3 3" />
              {l.label && <SvgText x={sx(l.value) + 3} y={M.t + 8} fill={l.color ?? T.slate} style={{ fontFamily: 'Inter', fontSize: 6.5 }}>{l.label}</SvgText>}
            </G>
          ))}
          {series.map((s, k) => {
            const d = decimate(s.data);
            return (
              <Path
                key={k}
                d={d.map((p, i) => `${i ? 'L' : 'M'}${sx(p.x).toFixed(1)} ${sy(p.y).toFixed(1)}`).join(' ')}
                stroke={s.color} strokeWidth={s.width ?? 1} strokeDasharray={s.dash} fill="none"
              />
            );
          })}
        </>
      )}
    </Axes>
  );
}

export function ScatterPlot({ width, height, points, xLabel, yLabel, yDomain, xFmt, yFmt, yTicks }: {
  width: number; height: number; points: Pt[]; xLabel: string; yLabel: string; yDomain: [number, number];
  xFmt?: (v: number) => string; yFmt?: (v: number) => string; yTicks?: number[];
}) {
  const xd = extent(points.map((p) => p.x));
  return (
    <Axes width={width} height={height} xDomain={xd} yDomain={yDomain} xLabel={xLabel} yLabel={yLabel} xFmt={xFmt} yFmt={yFmt} yTicks={yTicks}>
      {(sx, sy) => <>{decimate(points, 400).map((p, i) => <Circle key={i} cx={sx(p.x)} cy={sy(p.y)} r={1.1} fill={T.chartOrange} fillOpacity={0.55} />)}</>}
    </Axes>
  );
}

export function ConstellationPdf({ size, points }: { size: number; points: { i: number; q: number }[] }) {
  const c = size / 2, r = size * 0.36;
  const ideal = [[0.707, 0.707], [-0.707, 0.707], [-0.707, -0.707], [0.707, -0.707]];
  return (
    <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <Rect x={0} y={0} width={size} height={size} fill="#ffffff" />
      <Circle cx={c} cy={c} r={r} stroke={T.grid} strokeWidth={0.7} fill="none" />
      <Circle cx={c} cy={c} r={r / 2} stroke={T.grid} strokeWidth={0.7} fill="none" />
      <Line x1={6} x2={size - 6} y1={c} y2={c} stroke={T.line} strokeWidth={0.7} strokeDasharray="2 3" />
      <Line x1={c} x2={c} y1={6} y2={size - 6} stroke={T.line} strokeWidth={0.7} strokeDasharray="2 3" />
      <SvgText x={size - 8} y={c - 4} fill={T.muted} textAnchor="end" style={{ fontFamily: 'Inter', fontSize: 7 }}>I</SvgText>
      <SvgText x={c + 5} y={11} fill={T.muted} style={{ fontFamily: 'Inter', fontSize: 7 }}>Q</SvgText>
      {decimate(points, 900).map((p, k) => <Circle key={k} cx={c + p.i * r} cy={c - p.q * r} r={0.9} fill={T.chartOrange} fillOpacity={0.5} />)}
      {ideal.map(([i, q], k) => (
        <G key={k}>
          <Line x1={c + i * r - 4} x2={c + i * r + 4} y1={c - q * r} y2={c - q * r} stroke={T.slate} strokeWidth={1} />
          <Line x1={c + i * r} x2={c + i * r} y1={c - q * r - 4} y2={c - q * r + 4} stroke={T.slate} strokeWidth={1} />
        </G>
      ))}
    </Svg>
  );
}

export function EyePdf({ width, height, traces }: { width: number; height: number; traces: { t: number; v: number }[][] }) {
  const pw = width - M.l - M.r, ph = height - M.t - M.b;
  const sx = (t: number) => M.l + ((t + 1) / 2) * pw;
  const sy = (v: number) => M.t + ph / 2 - v * (ph / 2) * 0.82;
  return (
    <Svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      <Rect x={M.l} y={M.t} width={pw} height={ph} fill="#ffffff" stroke={T.line} strokeWidth={0.8} />
      <Line x1={M.l} x2={M.l + pw} y1={M.t + ph / 2} y2={M.t + ph / 2} stroke={T.grid} strokeWidth={0.6} />
      <Line x1={M.l + pw / 2} x2={M.l + pw / 2} y1={M.t} y2={M.t + ph} stroke={T.grid} strokeWidth={0.6} />
      {traces.slice(0, 60).map((tr, k) => (
        <Path key={k} d={tr.map((p, i) => `${i ? 'L' : 'M'}${sx(p.t).toFixed(1)} ${sy(p.v).toFixed(1)}`).join(' ')} stroke={T.chartOrange} strokeWidth={0.6} strokeOpacity={0.3} fill="none" />
      ))}
      {[['−T', M.l], ['0', M.l + pw / 2], ['+T', M.l + pw]].map(([l, x]) => (
        <SvgText key={String(l)} x={Number(x)} y={M.t + ph + 10} fill={T.muted} textAnchor="middle" style={{ fontFamily: 'Inter', fontSize: 6.5 }}>{String(l)}</SvgText>
      ))}
      <SvgText x={M.l + pw / 2} y={height - 3} fill={T.ink2} textAnchor="middle" style={{ fontFamily: 'Inter', fontSize: 7 }}>Symbol period</SvgText>
    </Svg>
  );
}
