import type { AnalysisState } from '@/types';
import { MOCK_WATERFALL } from '@/data/mockSignal';
import { ramp } from '@/components/visualization/charts';

/** Spectrogram as a PNG data URL. A raster is right for 4096 cells; everything else is drawn as vector. */
function spectrogramImage(): string | undefined {
  try {
    const TB = 32, FB = 128, data = MOCK_WATERFALL();
    const cv = document.createElement('canvas');
    cv.width = 512; cv.height = 224;
    const ctx = cv.getContext('2d');
    if (!ctx) return undefined;
    const img = ctx.createImageData(cv.width, cv.height);
    for (let y = 0; y < cv.height; y++) {
      for (let x = 0; x < cv.width; x++) {
        const v = data[Math.floor((y / cv.height) * TB) * FB + Math.floor((x / cv.width) * FB)];
        const [r, g, b] = ramp((v + 80) / 70);
        const o = (y * cv.width + x) * 4;
        img.data[o] = r; img.data[o + 1] = g; img.data[o + 2] = b; img.data[o + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    return cv.toDataURL('image/png');
  } catch { return undefined; }
}

/** Builds the report and triggers a download. The PDF library is loaded on demand. */
export async function downloadReportPdf(state: AnalysisState): Promise<void> {
  const [{ pdf }, { default: ReportDocument }, { registerFonts }, React] = await Promise.all([
    import('@react-pdf/renderer'),
    import('./ReportDocument'),
    import('./theme'),
    import('react'),
  ]);
  registerFonts();
  const doc = React.createElement(ReportDocument, { state, spectrogram: spectrogramImage() });
  const blob = await pdf(doc as never).toBlob();
  const name = (state.fileMetadata?.fileName ?? 'signal').replace(/\.[^.]+$/, '');
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `signal-analysis-report_${name}.pdf`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}
