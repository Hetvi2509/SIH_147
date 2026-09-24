import { Font } from '@react-pdf/renderer';
import inter400 from '@fontsource/inter/files/inter-latin-400-normal.woff?url';
import inter500 from '@fontsource/inter/files/inter-latin-500-normal.woff?url';
import inter600 from '@fontsource/inter/files/inter-latin-600-normal.woff?url';

/** Inter for text, Open Runde for display numerals and glyphs Inter's Latin subset lacks (superscripts, arrows). */
let registered = false;
export function registerFonts() {
  if (registered) return;
  registered = true;
  Font.register({
    family: 'Inter',
    fonts: [
      { src: inter400, fontWeight: 400 },
      { src: inter500, fontWeight: 500 },
      { src: inter600, fontWeight: 600 },
    ],
  });
  Font.register({ family: 'Runde', src: `${window.location.origin}/fonts/OpenRunde-Regular.otf` });
  Font.registerHyphenationCallback((word) => [word]);
}

export const T = {
  orange: '#d9501b',
  orangeSoft: '#fdf0e8',
  ink: '#241f1a',
  ink2: '#5b5349',
  muted: '#8a8177',
  line: '#e6e0d8',
  faint: '#f6f3ee',
  green: '#2f7d55',
  greenSoft: '#e8f4ec',
  amber: '#a86a12',
  red: '#b3261e',
  slate: '#3d4a5c',
  chartOrange: '#e8642a',
  chartGreen: '#3f9b6e',
  chartAmber: '#d9982b',
  grid: '#eee9e2',
} as const;
