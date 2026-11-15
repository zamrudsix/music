import { db } from '../../lib/db/database';
import type { CustomFontItem } from '../../lib/types/project';

// Predefined remote TTF URLs for standard + creative built-in visualizer typography
const BUILTIN_FONT_URLS: Record<string, string> = {
  // Original clean / modern
  'Bebas Neue': 'https://fonts.gstatic.com/s/bebasneue/v16/JTUSjIg69CK48gW7PXooxW4.ttf',
  'Inter': 'https://fonts.gstatic.com/s/inter/v20/UcCO3FwrK3iLTeHuS_nVMrMxCp50SjIw2boKoduKmMEVuGKYMZg.ttf',
  'Montserrat': 'https://fonts.gstatic.com/s/montserrat/v31/JTUHjIg1_i6t8kCHKm4532VJOt5-QNFgpCuM70w-.ttf',
  'Oswald': 'https://fonts.gstatic.com/s/oswald/v57/TK3_WkUHHAIjg75cFRf3bXL8LICs18NvgUE.ttf',
  'Poppins': 'https://fonts.gstatic.com/s/poppins/v24/pxiByp8kv8JHgFVrLEj6V1s.ttf',
  'Space Grotesk': 'https://fonts.gstatic.com/s/spacegrotesk/v22/V8mQoQDjQSkFtoMM3T6r8E7mF71Q-gOoraIAEj42Vksj.ttf',
  'Playfair Display': 'https://fonts.gstatic.com/s/playfairdisplay/v40/nuFRD-vYSZviVYUb_rj3ij__anPXDTnCjmHKM4nYO7KN_k-UbtY.ttf',
  'Roboto Mono': 'https://fonts.gstatic.com/s/robotomono/v31/L0xuDF4xlVMF-BfR8bXMIhJHg45mwgGEFl0_Of2PQw.ttf',

  // Bold / Impact / Display
  'Anton': 'https://fonts.gstatic.com/s/anton/v27/1Ptgg87LROyAm0K08i4g.ttf',
  'Archivo Black': 'https://fonts.gstatic.com/s/archivoblack/v21/HTxqL289NzCGg4MzN6KJ7eW6OYuP_x7yx3A.ttf',
  'Righteous': 'https://fonts.gstatic.com/s/righteous/v17/1cXxaUPXBpj2rGoU7C9WiHGA.ttf',
  'Bangers': 'https://fonts.gstatic.com/s/bangers/v24/FeVQS0BTqb0h60ACL5la2bxii28.ttf',
  'Rubik': 'https://fonts.gstatic.com/s/rubik/v28/iJWZBXyIfDnIV5PNhY1KTN7Z-Yh-B4i1UA.ttf',

  // Handwritten / Script / Fun
  'Pacifico': 'https://fonts.gstatic.com/s/pacifico/v22/FwZY7-Qmy14u9lezJ-6H6MmBp0u-.ttf',
  'Permanent Marker': 'https://fonts.gstatic.com/s/permanentmarker/v16/Fh4uPib9Iyv2ucM6pGQMWimMp004La2Cfw.ttf',
  'Pacifico': 'https://fonts.gstatic.com/s/pacifico/v22/FwZY7-Qmy14u9lezJ-6H6MmBp0u-.ttf',
  'Dancing Script': 'https://fonts.gstatic.com/s/dancingscript/v25/If2cXTr6YS-AZTq9ZjY.ttf',
  'Great Vibes': 'https://fonts.gstatic.com/s/greatvibes/v18/RWmMoKWR9v4ksMfaWd_JN9XFiaQ.ttf',
  'Lobster': 'https://fonts.gstatic.com/s/lobster/v30/neILzCirqoswsqX9zoKmM.ttf',
  'Satisfy': 'https://fonts.gstatic.com/s/satisfy/v17/rP2Hp2yn6lkG50LoCZOIHQ.ttf',
  'Caveat': 'https://fonts.gstatic.com/s/caveat/v17/WnznHAc5bAfYB2QRah7pcpNvOx-pjcB.ttf',
  'Indie Flower': 'https://fonts.gstatic.com/s/indieflower/v21/m8JVjfNVeKWVnh3QMuKkFcZlbkGG1dKE.ttf',
  'Amatic SC': 'https://fonts.gstatic.com/s/amaticsc/v26/TUZyzwprpvBS1mzmAoa.ttf',
  'Shadows Into Light': 'https://fonts.gstatic.com/s/shadowsintolight/v19/UqyNK9UOIntux_czAvDQx_ZcHqZXBNQzdcD5.ttf',
  'Kalam': 'https://fonts.gstatic.com/s/kalam/v16/YA9dr0Wd4kDdMthQOCfzsw.ttf',
  'Caveat': 'https://fonts.gstatic.com/s/caveat/v17/WnznHAc5bAfYB2QRah7pcpNvOx-pjfJ9eIWpZA.ttf',
  'Lobster': 'https://fonts.gstatic.com/s/lobster/v30/neILzCirqoswsqX9zoKmM4MwWJU.ttf',
  'Comfortaa': 'https://fonts.gstatic.com/s/comfortaa/v45/1Pt_g8LJRfWJmhDAuUsSQamb1W0lwk4S4WjMPrQVIT9c2c8.ttf',

  // Futuristic / Tech / Special
  'Orbitron': 'https://fonts.gstatic.com/s/orbitron/v31/yMJMMIlzdpvBhQQL_SC3X9yhF25-T1nyGy6BoWgz.ttf',
  'Press Start 2P': 'https://fonts.gstatic.com/s/pressstart2p/v15/e3t4euO8T-267oIAQAu6jDQyK3nVivNm4I81.ttf',
  'Creepster': 'https://fonts.gstatic.com/s/creepster/v13/AlZy_zVUqJz4yMrniH4hdXf4XB0f74.ttf',
  'Special Elite': 'https://fonts.gstatic.com/s/specialelite/v18/XLYgIZbkc4mQLL5i2lB5AxQQvQ.ttf',
  'Monoton': 'https://fonts.gstatic.com/s/monoton/v19/5h1aiZUrOngCibe4fkULkQ.ttf',

  // Extra 30 fonts (Arial-like, Serif, etc.)
  'Roboto': 'https://fonts.gstatic.com/s/roboto/v51/KFOMCnqEu92Fr1ME7kSn66aGLdTylUAMQXC89YmC2DPNWubEbWmT.ttf',
  'Open Sans': 'https://fonts.gstatic.com/s/opensans/v44/memSYaGs126MiZpBA-UvWbX2vVnXBbObj2OVZyOOSr4dVJWUgsjZ0C4n.ttf',
  'Lato': 'https://fonts.gstatic.com/s/lato/v25/S6uyw4BMUTPHvxk.ttf',
  'Nunito': 'https://fonts.gstatic.com/s/nunito/v32/XRXI3I6Li01BKofiOc5wtlZ2di8HDLshRTM.ttf',
  'Source Sans 3': 'https://fonts.gstatic.com/s/sourcesans3/v20/nwpBtKy2OAdR1K-IwhWudF-R9QMylBJAV3Bo8Ky461EN.ttf',
  'Ubuntu': 'https://fonts.gstatic.com/s/ubuntu/v21/4iCs6KVjbNBYlgo6eA.ttf',
  'Merriweather': 'https://fonts.gstatic.com/s/merriweather/v33/u-4D0qyriQwlOrhSvowK_l5UcA6zuSYEqOzpPe3HOZJ5eX1WtLaQwmYiScCmDxhtNOKl8yDr3icqEw.ttf',
  'Lora': 'https://fonts.gstatic.com/s/lora/v37/0QI6MX1D_JOuGQbT0gvTJPa787weuyJG.ttf',
  'PT Serif': 'https://fonts.gstatic.com/s/ptserif/v19/EJRVQgYoZZY2vCFuvDFR.ttf',
  'Crimson Text': 'https://fonts.gstatic.com/s/crimsontext/v19/wlp2gwHKFkZgtmSR3NB0oRJvaA.ttf',
  'Libre Baskerville': 'https://fonts.gstatic.com/s/librebaskerville/v24/kmKUZrc3Hgbbcjq75U4uslyuy4kn0olVQ-LglH6T17uj8Q4SCQ.ttf',
  'Noto Serif': 'https://fonts.gstatic.com/s/notoserif/v33/ga6iaw1J5X9T9RW6j9bNVls-hfgvz8JcMofYTa32J4wsL2JAlAhZqFCjwA.ttf',
  'Work Sans': 'https://fonts.gstatic.com/s/worksans/v24/QGY_z_wNahGAdqQ43RhVcIgYT2Xz5u32K0nXNig.ttf',
  'DM Sans': 'https://fonts.gstatic.com/s/dmsans/v17/rP2tp2ywxg089UriI5-g4vlH9VoD8CmcqZG40F9JadbnoEwAopxhTg.ttf',
  'Karla': 'https://fonts.gstatic.com/s/karla/v33/qkBIXvYC6trAT55ZBi1ueQVIjQTD-JqqFA.ttf',
  'Mulish': 'https://fonts.gstatic.com/s/mulish/v18/1Ptyg83HX_SGhgqO0yLcmjzUAuWexZNRwaA.ttf',
  'Barlow': 'https://fonts.gstatic.com/s/barlow/v13/7cHpv4kjgoGqM7EPCw.ttf',
  'Heebo': 'https://fonts.gstatic.com/s/heebo/v28/NGSpv5_NC0k9P_v6ZUCbLRAHxK1EiSyccg.ttf',
  'Manrope': 'https://fonts.gstatic.com/s/manrope/v23/xn7_YHE41ni1AdIRqAuZuw1Bx9mbZk79FO_F.ttf',
  'Outfit': 'https://fonts.gstatic.com/s/outfit/v15/QGYyz_MVcBeNP4NjuGObqx1XmO1I4TC1C4E.ttf',
  'Figtree': 'https://fonts.gstatic.com/s/figtree/v9/_Xmz-HUzqDCFdgfMsYiV_F7wfS-Bs_d_QF5e.ttf',
  'Sora': 'https://fonts.gstatic.com/s/sora/v17/xMQOuFFYT72X5wkB_18qmnndmSdSnn-K.ttf',
  'Josefin Sans': 'https://fonts.gstatic.com/s/josefinsans/v34/Qw3PZQNVED7rKGKxtqIqX5E-AVSJrOCfjY46_DjQXME.ttf',
  'Quicksand': 'https://fonts.gstatic.com/s/quicksand/v37/6xK-dSZaM9iE8KbpRA_LJ3z8mH9BOJvgkP8o18E.ttf',
  'Raleway': 'https://fonts.gstatic.com/s/raleway/v37/1Ptxg8zYS_SKggPN4iEgvnHyvveLxVvaooCP.ttf',
  'Cabin': 'https://fonts.gstatic.com/s/cabin/v35/u-4X0qWljRw-PfU81xCKCpdpbgZJl6XFpfEd7eA9BIxxkV2EL7E.ttf',
  'Hind': 'https://fonts.gstatic.com/s/hind/v18/5aU69_a8oxmIRG4.ttf',
  'Titillium Web': 'https://fonts.gstatic.com/s/titilliumweb/v19/NaPecZTIAOhVxoMyOr9n_E7fRMQ.ttf',
  'Fira Sans': 'https://fonts.gstatic.com/s/firasans/v18/va9E4kDNxMZdWfMOD5VfkA.ttf',
  'Noto Sans': 'https://fonts.gstatic.com/s/notosans/v42/o-0mIpQlx3QUlC5A4PNB6Ryti20_6n1iPHjcz6L1SoM-jCpoiyD9A99d.ttf',
  'IBM Plex Sans': 'https://fonts.gstatic.com/s/ibmplexsans/v23/zYXGKVElMYYaJe8bpLHnCwDKr932-G7dytD-Dmu1swZSAXcomDVmadSD6llzAA.ttf',
  'IBM Plex Serif': 'https://fonts.gstatic.com/s/ibmplexserif/v20/jizDREVNn1dOx-zrZ2X3pZvkThUY.ttf',
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

