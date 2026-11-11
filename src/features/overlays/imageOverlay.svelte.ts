import type { ImageOverlayItem } from '../../lib/types/project';
import { computeOverlayTransition } from '../../lib/utils/transition';
import { isDesktop } from '../../lib/utils/platform';

export class ImageOverlayManager {
  private imageCache = new Map<string, HTMLImageElement | ImageBitmap>();
  private readonly MAX_DIM = 1280;

  async reloadAssetFromDisk(item: ImageOverlayItem): Promise<boolean> {
    if (!isDesktop() || !item.filePath) return false;
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      const bytes = await invoke<ArrayBuffer | Uint8Array | number[]>('read_media_file', { path: item.filePath });
      if (!bytes) return false;
      const u8 = bytes instanceof ArrayBuffer
        ? new Uint8Array(bytes)
        : bytes instanceof Uint8Array
          ? bytes
          : new Uint8Array(bytes);
      if (u8.length === 0) return false;

      const ext = item.filePath.split('.').pop()?.toLowerCase() || '';
      let mime = 'image/png';
      if (ext === 'jpg' || ext === 'jpeg') mime = 'image/jpeg';
      else if (ext === 'webp') mime = 'image/webp';
      else if (ext === 'gif') mime = 'image/gif';

      const blob = new Blob([u8.buffer as ArrayBuffer], { type: mime });
      if (item.url && item.url.startsWith('blob:')) {
        URL.revokeObjectURL(item.url);
      }
      item.url = URL.createObjectURL(blob);
      item.file = new File([blob], item.name, { type: mime });
      item.fileModifiedAt = Date.now();

      this.releaseAsset(item.id);
      await this.preloadImage(item);
      return true;
    } catch (e) {
      console.warn('Could not reload image overlay from disk:', item.filePath, e);
      return false;
    }
  }

  async preloadImage(item: ImageOverlayItem): Promise<HTMLImageElement | ImageBitmap> {
    if ((!item.url || item.url.trim() === '') && item.filePath) {
      await this.reloadAssetFromDisk(item);
    }
    const existing = this.imageCache.get(item.id);
    if (existing && (existing instanceof HTMLImageElement ? (existing.complete && existing.naturalWidth > 0) : true)) {
      return existing;
    }
    if (existing) {
      this.releaseAsset(item.id);
    }

    try {
      const blob = await fetch(item.url).then(r => r.blob()).catch(() => null);
      if (blob) {
        const bitmap = await createImageBitmap(blob, {
          resizeWidth: this.MAX_DIM,
          resizeHeight: this.MAX_DIM,
          resizeQuality: 'medium',
        }).catch(() => null);
        if (bitmap) {
          this.imageCache.set(item.id, bitmap);
          return bitmap;
        }
      }
    } catch {}

    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.src = item.url;
      img.onload = () => {
        this.imageCache.set(item.id, img);
        resolve(img);
      };
      img.onerror = (err) => {
        console.warn('Failed to load image overlay:', item.name, err);
        reject(err);
      };
    });
  }

  releaseAsset(id: string) {
    const img = this.imageCache.get(id);
    if (img) {
      if (img instanceof HTMLImageElement) {
        img.src = '';
      } else if ('close' in img) {
        try { (img as ImageBitmap).close(); } catch {}
      }
      this.imageCache.delete(id);
    }
  }

  purgeUnused(activeIds: Set<string>) {
    for (const [id, img] of this.imageCache.entries()) {
      if (!activeIds.has(id)) {
        img.src = '';
        this.imageCache.delete(id);
      }
    }
  }

  render(
    ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
    width: number,
    height: number,
    items: ImageOverlayItem[],
    currentTime: number = 0,
    rawBeatFactor: number = 1.0
  ) {
    if (!items || items.length === 0) return;

    const scaleFactor = Math.min(width / 1920, height / 1080);

    for (const item of items) {
      const transState = computeOverlayTransition(
        currentTime,
        item.startTime,
        item.endTime,
        item.transition,
        item.transitionDuration,
        height
      );
      if (!transState.isVisible) continue;

      let img = this.imageCache.get(item.id);
      if (!img) {
        if (!item.url && item.filePath) {
          this.reloadAssetFromDisk(item).catch(() => {});
        } else if (item.url) {
          this.preloadImage(item).catch(() => {});
        }
        continue;
      }

      const sensitivity = item.beatSensitivity ?? 1.0;
      const beatFactor = 1.0 + (rawBeatFactor - 1.0) * sensitivity;

      const isFull = !!item.isFullScreen;
      const posX = isFull ? width / 2 : (item.x ?? 0.5) * width;
      let posY = (isFull ? height / 2 : (item.y ?? 0.5) * height) + transState.offsetY;
      let rawOpacity = typeof item.opacity === 'number' && Number.isFinite(item.opacity) ? item.opacity : 1.0;
      let drawAlpha = Math.max(0, Math.min(1, rawOpacity * transState.alphaMultiplier));
      let animScale = 1.0 * transState.scaleMultiplier;

      // Animation options
      if (item.animation === 'floating') {
        posY += Math.sin(currentTime * 2.5 + (item.x ?? 0.5) * 10) * 12 * scaleFactor;
      } else if (item.animation === 'pulse-beat') {
        if (item.followBeat) {
          animScale *= 1.0 + (beatFactor - 1.0) * 0.15;
        } else {
          animScale *= 1.0 + Math.sin(currentTime * 3) * 0.05;
        }
      } else if (item.animation === 'shimmer') {
        drawAlpha *= (0.6 + Math.sin(currentTime * 4) * 0.4);
      } else if (item.animation === 'glow-pulse') {
        drawAlpha *= (0.75 + Math.sin(currentTime * 5) * 0.25);
      }
      drawAlpha = Math.max(0, Math.min(1, drawAlpha));

      const beatScale = item.followBeat ? 1 + (beatFactor - 1) * 0.25 : 1.0;
      const naturalW = img.naturalWidth || 200;
      const naturalH = img.naturalHeight || 200;

      let drawW: number;
      let drawH: number;

      if (isFull) {
        const fitMode = item.fitMode || 'cover';
        if (fitMode === 'fill') {
          drawW = width * animScale * beatScale;
          drawH = height * animScale * beatScale;
        } else if (fitMode === 'fit') {
          const s = Math.min(width / naturalW, height / naturalH);
          drawW = naturalW * s * animScale * beatScale;
          drawH = naturalH * s * animScale * beatScale;
        } else {
          // cover (default)
          const s = Math.max(width / naturalW, height / naturalH);
          drawW = naturalW * s * animScale * beatScale;
          drawH = naturalH * s * animScale * beatScale;
        }
      } else {
        const baseScale = (item.scale ?? 1.0) * scaleFactor;
        const scale = baseScale * beatScale * animScale;
        drawW = naturalW * scale;
        drawH = naturalH * scale;
      }

      ctx.save();
      ctx.globalAlpha = drawAlpha;
      ctx.globalCompositeOperation = (item.blendMode as GlobalCompositeOperation) || 'source-over';
      ctx.translate(posX, posY);

      if (item.rotation) {
        ctx.rotate((item.rotation * Math.PI) / 180);
      }

      ctx.drawImage(img, -drawW / 2, -drawH / 2, drawW, drawH);
      ctx.restore();
    }
  }
}

export const imageOverlayManager = new ImageOverlayManager();
