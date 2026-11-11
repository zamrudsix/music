import { db } from '../../lib/db/database';
import type { CustomFontItem } from '../../lib/types/project';

// Predefined remote TTF URLs for standard built-in visualizer typography
const BUILTIN_FONT_URLS: Record<string, string> = {
  'Bebas Neue': 'https://fonts.gstatic.com/s/bebasneue/v16/JTUSjIg69CK48gW7PXooxW4.ttf',
  'Inter': 'https://fonts.gstatic.com/s/inter/v20/UcCO3FwrK3iLTeHuS_nVMrMxCp50SjIw2boKoduKmMEVuGKYMZg.ttf',
  'Montserrat': 'https://fonts.gstatic.com/s/montserrat/v31/JTUHjIg1_i6t8kCHKm4532VJOt5-QNFgpCuM70w-.ttf',
  'Oswald': 'https://fonts.gstatic.com/s/oswald/v57/TK3_WkUHHAIjg75cFRf3bXL8LICs18NvgUE.ttf',
  'Poppins': 'https://fonts.gstatic.com/s/poppins/v24/pxiByp8kv8JHgFVrLEj6V1s.ttf',
  'Space Grotesk': 'https://fonts.gstatic.com/s/spacegrotesk/v22/V8mQoQDjQSkFtoMM3T6r8E7mF71Q-gOoraIAEj42Vksj.ttf',
  'Playfair Display': 'https://fonts.gstatic.com/s/playfairdisplay/v40/nuFRD-vYSZviVYUb_rj3ij__anPXDTnCjmHKM4nYO7KN_k-UbtY.ttf',
  'Roboto Mono': 'https://fonts.gstatic.com/s/robotomono/v31/L0xuDF4xlVMF-BfR8bXMIhJHg45mwgGEFl0_Of2PQw.ttf',
};

export class FontManager {
  private loadedFonts = new Set<string>();
  private fontBuffers = new Map<string, ArrayBuffer>();

  async registerFontFromBlob(name: string, blob: Blob): Promise<string> {
    const arrayBuffer = await blob.arrayBuffer();
    const cleanFontName = name.replace(/\.[^/.]+$/, '').trim();

    try {
      const fontFace = new FontFace(cleanFontName, arrayBuffer);
      await fontFace.load();
      document.fonts.add(fontFace);
      this.loadedFonts.add(cleanFontName);
      this.fontBuffers.set(cleanFontName, arrayBuffer.slice(0));
      console.log(`✅ Registered custom font: ${cleanFontName}`);
      return cleanFontName;
    } catch (err) {
      console.warn(`Failed to register custom font ${cleanFontName}:`, err);
      throw err;
    }
  }

  async registerFontFromArrayBuffer(name: string, arrayBuffer: ArrayBuffer): Promise<string> {
    const cleanFontName = name.replace(/\.[^/.]+$/, '').trim();
    try {
      const fontFace = new FontFace(cleanFontName, arrayBuffer);
      await fontFace.load();
      document.fonts.add(fontFace);
      this.loadedFonts.add(cleanFontName);
      this.fontBuffers.set(cleanFontName, arrayBuffer.slice(0));
      return cleanFontName;
    } catch (err) {
      console.warn(`Failed to register font ${cleanFontName}:`, err);
      throw err;
    }
  }

  getFontBuffer(name: string): ArrayBuffer | undefined {
    return this.fontBuffers.get(name);
  }

  /**
   * Pre-fetches and registers font buffer if needed (e.g. built-in Google fonts)
   */
  async ensureFontLoaded(fontName: string): Promise<void> {
    const cleanName = fontName.replace(/["']/g, '').trim();
    if (this.fontBuffers.has(cleanName)) return;

    const builtinUrl = BUILTIN_FONT_URLS[cleanName];
    if (builtinUrl) {
      try {
        const cached = await db.assets.get('builtin-font-' + cleanName);
        if (cached && cached.blob) {
          const buf = await cached.blob.arrayBuffer();
          this.fontBuffers.set(cleanName, buf.slice(0));
          return;
        }

        const resp = await fetch(builtinUrl);
        if (resp.ok) {
          const blob = await resp.blob();
          const buf = await blob.arrayBuffer();
          this.fontBuffers.set(cleanName, buf.slice(0));
          // Cache into indexedDB for offline access
          try {
            await db.assets.put({
              id: 'builtin-font-' + cleanName,
              projectId: 'global',
              name: cleanName,
              type: 'font',
              blob,
              createdAt: Date.now(),
            });
          } catch (e) {

            // non-critical
          }
          console.log(`✅ Loaded and cached font buffer for render: ${cleanName}`);
        }
      } catch (err) {
        console.warn(`Could not preload font buffer for ${cleanName}:`, err);
      }
    }
  }

  /**
   * Ensures all fonts used across project (lyrics, overlays, tracklist) are loaded
   */
  async prepareFontsForExport(fontNames: string[]): Promise<void> {
    const uniqueFonts = Array.from(new Set(fontNames.filter(Boolean)));
    await Promise.allSettled(uniqueFonts.map((name) => this.ensureFontLoaded(name)));
  }

  getAllFontBuffers(): Array<{ name: string; buffer: ArrayBuffer }> {
    const result: Array<{ name: string; buffer: ArrayBuffer }> = [];
    this.fontBuffers.forEach((buffer, name) => {
      result.push({ name, buffer: buffer.slice(0) });
    });
    return result;
  }

  async rehydrateFonts(customFonts?: CustomFontItem[]) {
    if (!customFonts || customFonts.length === 0) return;

    for (const fontItem of customFonts) {
      if (this.loadedFonts.has(fontItem.name)) continue;

      try {
        const stored = await db.assets.get('font-' + fontItem.name);
        if (stored && stored.blob) {
          await this.registerFontFromBlob(fontItem.name, stored.blob);
        } else if (fontItem.url) {
          const resp = await fetch(fontItem.url);
          const blob = await resp.blob();
          await this.registerFontFromBlob(fontItem.name, blob);
        }
      } catch (e) {
        console.warn('Failed to rehydrate font:', fontItem.name, e);
      }
    }
  }
}

export const fontManager = new FontManager();

