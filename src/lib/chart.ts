import { useCallback, useState } from 'react';

/** Canvas can't read CSS variables directly; these mirror the --chart-* tokens in index.css. */
export const C = {
  orange: '#e8642a',
  orangeSoft: 'rgba(232,100,42,0.14)',
  slate: '#3d4a5c',
  green: '#3f9b6e',
  amber: '#d9982b',
  grid: 'rgba(60,45,30,0.08)',
  axis: 'rgba(60,45,30,0.22)',
  label: '#7a7368',
  ink: '#241f1a',
} as const;

export const AXIS_TICK = { fill: C.label, fontSize: 12 } as const;

/** Visible window of a series, as fractions of its length. */
export interface ZoomWindow { start: number; end: number }

export const FULL_WINDOW: ZoomWindow = { start: 0, end: 1 };

export function sliceWindow<T>(data: T[], w: ZoomWindow): T[] {
  if (w.start === 0 && w.end === 1) return data;
  const a = Math.floor(w.start * data.length);
  const b = Math.max(a + 8, Math.ceil(w.end * data.length));
  return data.slice(a, b);
}

export function useZoom() {
  const [win, setWin] = useState<ZoomWindow>(FULL_WINDOW);

  const zoomIn = useCallback(() => setWin((w) => {
    const span = (w.end - w.start) / 2;
    if (span < 0.04) return w;
    const mid = (w.start + w.end) / 2;
    return { start: mid - span / 2, end: mid + span / 2 };
  }), []);

  const zoomOut = useCallback(() => setWin((w) => {
    const span = Math.min(1, (w.end - w.start) * 2);
    const mid = (w.start + w.end) / 2;
    const start = Math.min(Math.max(0, mid - span / 2), 1 - span);
    return { start, end: start + span };
  }), []);

  const reset = useCallback(() => setWin(FULL_WINDOW), []);
  const zoomed = win.start !== 0 || win.end !== 1;

  return { win, zoomIn, zoomOut, reset, zoomed };
}
