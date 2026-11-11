import type { BackgroundConfig, BackgroundItem, ScaleMode } from '../../lib/types/project';
import { computeImageMotion, computeTransition, type MotionTransform } from '../../lib/utils/motion';
import { isDesktop } from '../../lib/utils/platform';

export class BackgroundManager {
  private imageCache = new Map<string, HTMLImageElement | ImageBitmap>();
  private videoCache = new Map<string, HTMLVideoElement>();
  private loadingSet = new Set<string>();
  private lruOrder: string[] = [];
  private readonly maxCachedImages = 24; // Turunkan dari 128 biar ringan
  private lastRenderedMedia: HTMLImageElement | HTMLVideoElement | ImageBitmap | null = null;

  // Max dimension untuk preview (export selalu full)
  private getPreviewMaxDim(quality: string = 'medium'): number {
    switch (quality) {
      case 'full': return 3840;
      case 'high': return 1920;
      case 'medium': return 1280;
      case 'low': return 720;
      default: return 1280;
    }
  }

  async loadAsset(item: BackgroundItem): Promise<HTMLImageElement | HTMLVideoElement | ImageBitmap> {
    if ((!item.url || item.url.trim() === '') && item.filePath && isDesktop()) {
      await this.reloadAssetFromDisk(item);
    }

    if (item.type === 'image') {
      const existing = this.imageCache.get(item.id);
      if (existing && (existing instanceof HTMLImageElement ? existing.complete && existing.naturalWidth > 0 : true)) {
        this.touchLRU(item.id);
        return existing;
      }
      if (existing) {
        this.releaseAsset(item.id);
      }

      this.loadingSet.add(item.id);
      try {
        // Prefer createImageBitmap dengan resize biar ringan
        const blob = await fetch(item.url).then(r => r.blob()).catch(() => null);
        if (blob) {
          const maxDim = this.getPreviewMaxDim((typeof localStorage !== 'undefined' ? localStorage.getItem('preview_quality') : null) || 'medium');
        const bitmap = await createImageBitmap(blob, {
            resizeWidth: maxDim,
            resizeHeight: maxDim,
            resizeQuality: maxDim >= 1920 ? 'high' : 'medium',
          }).catch(() => null);
          if (bitmap) {
            this.loadingSet.delete(item.id);
            this.imageCache.set(item.id, bitmap);
            this.touchLRU(item.id);
            this.pruneLRU();
            return bitmap;
          }
        }

        // Fallback ke Image biasa
        return await new Promise((resolve, reject) => {
          const img = new Image();
          img.crossOrigin = 'anonymous';
          img.src = item.url;
          img.onload = () => {
            this.loadingSet.delete(item.id);
            this.imageCache.set(item.id, img);
            this.touchLRU(item.id);
            this.pruneLRU();
            resolve(img);
          };
          img.onerror = (err) => {
            this.loadingSet.delete(item.id);
            reject(err);
          };
        });
      } catch (err) {
        this.loadingSet.delete(item.id);
        throw err;
      }
    } else {
      // Video: jangan decode full dulu
      const existing = this.videoCache.get(item.id);
      if (existing && existing.readyState >= 1) {
        return existing;
      }
      if (existing) {
        this.releaseAsset(item.id);
      }
      const vid = document.createElement('video');
      vid.crossOrigin = 'anonymous';
      vid.src = item.url;
      vid.muted = true;
      vid.playsInline = true;
      vid.loop = true;
      vid.preload = 'metadata'; // Hanya metadata dulu, bukan full buffer
      await new Promise((resolve) => {
        const done = () => {
          vid.removeEventListener('loadedmetadata', done);
          resolve(undefined);
        };
        vid.addEventListener('loadedmetadata', done);
        setTimeout(done, 3000); // timeout biar tidak hang
      });
      this.videoCache.set(item.id, vid);
      return vid;
    }
  }

  private touchLRU(id: string) {
    this.lruOrder = this.lruOrder.filter((k) => k !== id);
    this.lruOrder.push(id);
  }

  private pruneLRU(keepIds?: Set<string>) {
    while (this.imageCache.size > this.maxCachedImages && this.lruOrder.length > 0) {
      const oldestId = this.lruOrder.shift();
      if (!oldestId) break;
      if (keepIds && keepIds.has(oldestId)) {
        this.lruOrder.push(oldestId);
        continue;
      }
      const img = this.imageCache.get(oldestId);
      if (img) {
        img.src = '';
        this.imageCache.delete(oldestId);
      }
    }
  }

  ensureAssetLoaded(item: BackgroundItem) {
    if (!item) return;
    if (!item.url && !item.filePath) return;
    if (item.type === 'image') {
      if (!this.imageCache.has(item.id) && !this.loadingSet.has(item.id)) {
        this.loadAsset(item).catch(() => {});
      } else if (this.imageCache.has(item.id)) {
        this.touchLRU(item.id);
      }
    } else if (item.type === 'video') {
      if (!this.videoCache.has(item.id) && !this.loadingSet.has(item.id)) {
        this.loadAsset(item).catch(() => {});
      }
    }
  }

  getVideoElement(id: string): HTMLVideoElement | undefined {
    return this.videoCache.get(id);
  }

  releaseAsset(id: string) {
    if (this.imageCache.has(id)) {
      const img = this.imageCache.get(id);
      if (img === this.lastRenderedMedia) this.lastRenderedMedia = null;
      if (img instanceof HTMLImageElement) {
        img.src = '';
      } else if (img && 'close' in img) {
        try { (img as ImageBitmap).close(); } catch {}
      }
      this.imageCache.delete(id);
    }
    this.lruOrder = this.lruOrder.filter((k) => k !== id);
    this.loadingSet.delete(id);

    if (this.videoCache.has(id)) {
      const vid = this.videoCache.get(id);
      if (vid === this.lastRenderedMedia) this.lastRenderedMedia = null;
      if (vid) {
        vid.pause();
        vid.removeAttribute('src');
        vid.load();
      }
      this.videoCache.delete(id);
    }
  }

  purgeUnused(activeIds: Set<string>) {
    for (const [id, img] of this.imageCache.entries()) {
      if (!activeIds.has(id)) {
        if ('src' in img) img.src = '';
        this.imageCache.delete(id);
      }
    }
    this.lruOrder = this.lruOrder.filter((id) => activeIds.has(id));
    for (const [id, vid] of this.videoCache.entries()) {
      if (!activeIds.has(id)) {
        vid.pause();
        vid.removeAttribute('src');
        vid.load();
        this.videoCache.delete(id);
      }
    }
  }

  syncPlayback(isPlaying: boolean, currentTime: number) {
    this.videoCache.forEach((vid) => {
      const duration = vid.duration || 10;
      const targetTime = currentTime % duration;
      // Compute circular loop difference to prevent seek storm on loop boundaries
      let drift = Math.abs(vid.currentTime - targetTime);
      if (drift > duration / 2) {
        drift = duration - drift;
      }

      if (isPlaying) {
        if (vid.paused) {
          vid.play().catch(() => {});
        }
        if (!vid.seeking && drift > 0.5) {
          vid.currentTime = targetTime;
        }
      } else {
        if (!vid.paused) {
          vid.pause();
        }
        if (!vid.seeking && drift > 0.1) {
          vid.currentTime = targetTime;
        }
      }
    });
  }

  render(
    ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
    width: number,
    height: number,
    config: BackgroundConfig,
    currentTime: number,
    rawBeatFactor: number = 1.0
  ) {
    const sensitivity = config.beatSensitivity ?? 1.0;
    const beatFactor = 1.0 + (rawBeatFactor - 1.0) * sensitivity;
    const bgScaleFactor = config.followBeat ? 1 + (beatFactor - 1) * 0.03 : 1.0;
    const brightness = config.brightness ?? 1.0;

    ctx.save();
    ctx.fillStyle = '#0a0a0c';
    ctx.fillRect(0, 0, width, height);
    ctx.restore();

    if (!config.items || config.items.length === 0) {
      const bgGrad = ctx.createRadialGradient(
        width / 2,
        height / 2,
        50,
        width / 2,
        height / 2,
        Math.max(width, height) / 1.5
      );
      bgGrad.addColorStop(0, beatFactor > 1.05 ? 'rgba(35, 25, 75, 0.45)' : 'rgba(20, 18, 50, 0.25)');
      bgGrad.addColorStop(1, 'rgba(10, 10, 12, 1)');
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, width, height);
      return;
    }

    const totalItems = config.items.length;
    let activeItem: BackgroundItem;
    let nextItem: BackgroundItem | null = null;
    let blendFactor = 0;
    let progressInActive = 0;
    let progressInNext = 0;

    if (totalItems === 1 || config.type === 'single-image' || config.type === 'single-video') {
      activeItem = config.items[0];
      const dur = activeItem.duration || 5.0;
      progressInActive = (currentTime % dur) / dur;
      this.ensureAssetLoaded(activeItem);
    } else {
      const itemDuration = config.items[0]?.duration || 5.0;
      const cycleIndex = Math.floor(currentTime / itemDuration) % totalItems;
      progressInActive = (currentTime % itemDuration) / itemDuration;

      activeItem = config.items[cycleIndex];
      const nextIndex = (cycleIndex + 1) % totalItems;
      nextItem = config.items[nextIndex];
      progressInNext = 0;

      // On-demand lazy load and prefetch
      this.ensureAssetLoaded(activeItem);
      if (nextItem) this.ensureAssetLoaded(nextItem);
      const prefetchIndex = (nextIndex + 1) % totalItems;
      if (config.items[prefetchIndex]) {
        this.ensureAssetLoaded(config.items[prefetchIndex]);
      }

      // Calculate transition blend factor
      const transDurationNorm = Math.min(0.5, (config.transitionDuration || 1.0) / itemDuration);
      if (progressInActive > 1 - transDurationNorm && config.transition !== 'cut') {
        blendFactor = (progressInActive - (1 - transDurationNorm)) / transDurationNorm;
        progressInNext = blendFactor * transDurationNorm;
      }
    }

    // Motion & Transition computation
    const motionEffect = activeItem.motionEffect || config.motionEffect || 'random';
    const motionIntensity = config.motionIntensity ?? 1.0;
    const activeMotion = activeItem.type === 'image'
      ? computeImageMotion(progressInActive, motionEffect, activeItem.id, motionIntensity, width, height)
      : null;

    const transitionState = computeTransition(config.transition || 'crossfade', blendFactor, width, height);

    // Draw active item
    this.drawMediaItem(
      ctx,
      width,
      height,
      activeItem,
      config.scaleMode,
      bgScaleFactor,
      transitionState.activeAlpha,
      activeMotion,
      transitionState.activeTransform
    );

    // Draw next item if transitioning
    if (nextItem && blendFactor > 0 && transitionState.nextAlpha > 0) {
      const nextMotionEffect = nextItem.motionEffect || config.motionEffect || 'random';
      const nextMotion = nextItem.type === 'image'
        ? computeImageMotion(progressInNext, nextMotionEffect, nextItem.id, motionIntensity, width, height)
        : null;

      this.drawMediaItem(
        ctx,
        width,
        height,
        nextItem,
        config.scaleMode,
        bgScaleFactor,
        transitionState.nextAlpha,
        nextMotion,
        transitionState.nextTransform
      );
    }

    // Zero-overhead brightness adjustment
    if (brightness < 0.99) {
      ctx.save();
      ctx.fillStyle = `rgba(0, 0, 0, ${Math.min(1.0, 1.0 - brightness)})`;
      ctx.fillRect(0, 0, width, height);
      ctx.restore();
    } else if (brightness > 1.01) {
      ctx.save();
      ctx.globalCompositeOperation = 'screen';
      ctx.fillStyle = `rgba(255, 255, 255, ${Math.min(0.7, (brightness - 1.0) * 0.55)})`;
      ctx.fillRect(0, 0, width, height);
      ctx.restore();
    }
  }

  private drawMediaItem(
    ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
    canvasWidth: number,
    canvasHeight: number,
    item: BackgroundItem,
    scaleMode: ScaleMode,
    scaleMultiplier: number,
    alpha: number,
    motion?: MotionTransform | null,
    transitionTransform?: { translateX: number; translateY: number; scale: number }
  ) {
    if (alpha <= 0.001) return;

    let media = item.type === 'image' ? this.imageCache.get(item.id) : this.videoCache.get(item.id);
    if (!media) {
      if (this.lastRenderedMedia) {
        media = this.lastRenderedMedia;
      } else {
        return;
      }
    } else {
      this.lastRenderedMedia = media;
    }

    const fullNatW = (media as HTMLImageElement).naturalWidth || (media as HTMLVideoElement).videoWidth || canvasWidth;
    const fullNatH = (media as HTMLImageElement).naturalHeight || (media as HTMLVideoElement).videoHeight || canvasHeight;

    let sx = 0;
    let sy = 0;
    let sw = fullNatW;
    let sh = fullNatH;

    if (item.crop && item.crop.width > 0 && item.crop.height > 0) {
      sx = Math.max(0, Math.round(item.crop.x * fullNatW));
      sy = Math.max(0, Math.round(item.crop.y * fullNatH));
      sw = Math.min(fullNatW - sx, Math.round(item.crop.width * fullNatW));
      sh = Math.min(fullNatH - sy, Math.round(item.crop.height * fullNatH));
    }

    const naturalWidth = sw;
    const naturalHeight = sh;

    let drawWidth = canvasWidth;
    let drawHeight = canvasHeight;
    let drawX = 0;
    let drawY = 0;

    if (scaleMode === 'cover') {
      const scale = Math.max(canvasWidth / naturalWidth, canvasHeight / naturalHeight) * scaleMultiplier;
      drawWidth = naturalWidth * scale;
      drawHeight = naturalHeight * scale;
      drawX = (canvasWidth - drawWidth) / 2;
      drawY = (canvasHeight - drawHeight) / 2;
    } else if (scaleMode === 'contain') {
      const scale = Math.min(canvasWidth / naturalWidth, canvasHeight / naturalHeight) * scaleMultiplier;
      drawWidth = naturalWidth * scale;
      drawHeight = naturalHeight * scale;
      drawX = (canvasWidth - drawWidth) / 2;
      drawY = (canvasHeight - drawHeight) / 2;
    } else {
      // stretch
      drawWidth = canvasWidth * scaleMultiplier;
      drawHeight = canvasHeight * scaleMultiplier;
      drawX = (canvasWidth - drawWidth) / 2;
      drawY = (canvasHeight - drawHeight) / 2;
    }

    ctx.save();
    ctx.globalAlpha = Math.max(0, Math.min(1, alpha));

    // Dynamic transforms around center
    const cx = canvasWidth / 2;
    const cy = canvasHeight / 2;
    ctx.translate(cx, cy);

    if (transitionTransform) {
      if (transitionTransform.translateX || transitionTransform.translateY) {
        ctx.translate(transitionTransform.translateX, transitionTransform.translateY);
      }
      if (transitionTransform.scale && transitionTransform.scale !== 1.0) {
        ctx.scale(transitionTransform.scale, transitionTransform.scale);
      }
    }

    if (motion) {
      if (motion.translateX || motion.translateY) {
        ctx.translate(motion.translateX, motion.translateY);
      }
      if (motion.scale && motion.scale !== 1.0) {
        ctx.scale(motion.scale, motion.scale);
      }
      if (motion.rotation) {
        ctx.rotate(motion.rotation);
      }
    }

    ctx.translate(-cx, -cy);

    ctx.drawImage(media, sx, sy, sw, sh, drawX, drawY, drawWidth, drawHeight);
    ctx.restore();
  }

  /**
   * Reload an asset directly from disk (Item 3: File Json tidak mengunci asset)
   */
  async reloadAssetFromDisk(item: BackgroundItem): Promise<boolean> {
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
      let mime = 'image/jpeg';
      if (ext === 'png') mime = 'image/png';
      else if (ext === 'webp') mime = 'image/webp';
      else if (ext === 'gif') mime = 'image/gif';
      else if (ext === 'mp4') mime = 'video/mp4';

      const blob = new Blob([u8.buffer as ArrayBuffer], { type: mime });
      if (item.url && item.url.startsWith('blob:')) {
        URL.revokeObjectURL(item.url);
      }
      item.url = URL.createObjectURL(blob);
      item.file = new File([blob], item.name, { type: mime });
      item.fileModifiedAt = Date.now();

      this.releaseAsset(item.id);
      await this.loadAsset(item);

      // Refresh DB cache
      try {
        const { db } = await import('../../lib/db/database');
        await db.assets.put({
          id: item.id,
          projectId: 'default-project',
          name: item.name,
          type: item.type,
          blob,
          createdAt: Date.now(),
        });
      } catch {}

      return true;
    } catch (e) {
      console.warn(`Failed to reload ${item.name} from disk (${item.filePath}):`, e);
      return false;
    }
  }

  /**
   * Check and reload all assets that have changed on disk
   */
  async syncDiskAssets(items: BackgroundItem[]): Promise<number> {
    if (!isDesktop() || !items || items.length === 0) return 0;
    let reloadedCount = 0;
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      for (const item of items) {
        if (!item.filePath) continue;
        try {
          const info = await invoke<{ exists: boolean; size: number; modified_ms: number; filename: string }>('get_file_info', { path: item.filePath });
          if (info && info.exists) {
            const hasChanged = !item.fileModifiedAt || info.modified_ms > item.fileModifiedAt;
            if (hasChanged) {
              const ok = await this.reloadAssetFromDisk(item);
              if (ok) reloadedCount++;
            }
          }
        } catch {}
      }
    } catch (err) {
      console.warn('Sync disk assets error:', err);
    }
    return reloadedCount;
  }
}

export const backgroundManager = new BackgroundManager();
