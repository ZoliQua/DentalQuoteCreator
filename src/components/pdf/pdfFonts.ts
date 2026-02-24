import jsPDF from 'jspdf';
import type { PdfFontFamily } from '../../types/settings';

interface FontConfig {
  loader: () => Promise<{ regular: string; bold: string }>;
  regularFile: string;
  boldFile: string;
}

const FONT_CONFIG: Record<PdfFontFamily, FontConfig> = {
  'Inter': {
    loader: async () => {
      const m = await import('./fonts/inter');
      return { regular: m.interRegularBase64, bold: m.interBoldBase64 };
    },
    regularFile: 'Inter-Regular.ttf',
    boldFile: 'Inter-Bold.ttf',
  },
  'JetBrains Mono': {
    loader: async () => {
      const m = await import('./fonts/jetbrainsMono');
      return { regular: m.jetbrainsMonoRegularBase64, bold: m.jetbrainsMonoBoldBase64 };
    },
    regularFile: 'JetBrainsMono-Regular.ttf',
    boldFile: 'JetBrainsMono-Bold.ttf',
  },
  'Noto Sans': {
    loader: async () => {
      const m = await import('./fonts/notoSans');
      return { regular: m.notoSansRegularBase64, bold: m.notoSansBoldBase64 };
    },
    regularFile: 'NotoSans-Regular.ttf',
    boldFile: 'NotoSans-Bold.ttf',
  },
  'Noto Serif': {
    loader: async () => {
      const m = await import('./fonts/notoSerif');
      return { regular: m.notoSerifRegularBase64, bold: m.notoSerifBoldBase64 };
    },
    regularFile: 'NotoSerif-Regular.ttf',
    boldFile: 'NotoSerif-Bold.ttf',
  },
  'Roboto': {
    loader: async () => {
      const [reg, bold] = await Promise.all([
        import('./fonts/robotoRegular'),
        import('./fonts/robotoBold'),
      ]);
      return { regular: reg.robotoRegularBase64, bold: bold.robotoBoldBase64 };
    },
    regularFile: 'Roboto-Regular.ttf',
    boldFile: 'Roboto-Bold.ttf',
  },
  'Source Sans 3': {
    loader: async () => {
      const m = await import('./fonts/sourceSans3');
      return { regular: m.sourceSans3RegularBase64, bold: m.sourceSans3BoldBase64 };
    },
    regularFile: 'SourceSans3-Regular.ttf',
    boldFile: 'SourceSans3-Bold.ttf',
  },
  'Source Serif 4': {
    loader: async () => {
      const m = await import('./fonts/sourceSerif4');
      return { regular: m.sourceSerif4RegularBase64, bold: m.sourceSerif4BoldBase64 };
    },
    regularFile: 'SourceSerif4-Regular.ttf',
    boldFile: 'SourceSerif4-Bold.ttf',
  },
};

const registeredFonts = new Set<PdfFontFamily>();

/**
 * Register the chosen font family (Regular + Bold) into the jsPDF virtual file system.
 * Uses dynamic imports so only the selected font is loaded (Vite code-split).
 * Returns the font family name to use in doc.setFont() calls.
 */
export async function registerPdfFonts(doc: jsPDF, fontFamily: PdfFontFamily = 'Roboto'): Promise<string> {
  const config = FONT_CONFIG[fontFamily];

  if (!registeredFonts.has(fontFamily)) {
    const { regular, bold } = await config.loader();
    doc.addFileToVFS(config.regularFile, regular);
    doc.addFont(config.regularFile, fontFamily, 'normal');
    doc.addFileToVFS(config.boldFile, bold);
    doc.addFont(config.boldFile, fontFamily, 'bold');
    registeredFonts.add(fontFamily);
  } else {
    // VFS is shared, but each doc instance needs addFont calls
    doc.addFont(config.regularFile, fontFamily, 'normal');
    doc.addFont(config.boldFile, fontFamily, 'bold');
  }

  doc.setFont(fontFamily, 'normal');
  return fontFamily;
}
