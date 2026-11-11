import type { VideoOverlayItem } from '../../lib/types/project';
import { computeOverlayTransition } from '../../lib/utils/transition';
import { isDesktop } from '../../lib/utils/platform';

export class VideoOverlayManager {
  private videoElements = new Map<string, HTMLVideoElement>();
  private tempCanvas: HTMLCanvasElement | OffscreenCanvas | null = null;
  private tempCtx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null = null;

  async reloadAssetFromDisk(item: VideoOverlayItem): Promise<boolean> {
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

      const blob = new Blob([u8.buffer as ArrayBuffer], { type: 'video/mp4' });
      if (item.url && item.url.startsWith('blob:')) {
        URL.revokeObjectURL(item.url);
      }
      item.url = URL.createObjectURL(blob);
      item.file = new File([blob], item.name, { type: 'video/mp4' });
      item.fileModifiedAt = Date.now();

      this.releaseAsset(item.id);
      await this.loadVideo(item);
      return true;
    } catch (e) {
      console.warn('Could not reload video overlay from disk:', item.filePath, e);
      return false;
    }
  }

  async loadVideo(item: VideoOverlayItem): Promise<HTMLVideoElement> {
    if ((!item.url || item.url.trim() === '') && item.filePath) {
      await this.reloadAssetFromDisk(item);
    }
    if (this.videoElements.has(item.id)) {
      return this.videoElements.get(item.id)!;
    }
    const vid = document.createElement('video');
    vid.crossOrigin = 'anonymous';
    vid.src = item.url;
    vid.muted = true;
    vid.playsInline = true;
    vid.loop = true;
    await new Promise((resolve) => {
      vid.onloadeddata = resolve;
    });
    this.videoElements.set(item.id, vid);
    return vid;
  }

  releaseAsset(id: string) {
    const vid = this.videoElements.get(id);
    if (vid) {
      vid.pause();
      vid.removeAttribute('src');
      vid.load();
      this.videoElements.delete(id);
    }
  }

  getVideoElement(id: string): HTMLVideoElement | undefined {
    return this.videoElements.get(id);
  }

  purgeUnused(activeIds: Set<string>) {
    for (const [id, vid] of this.videoElements.entries()) {
      if (!activeIds.has(id)) {
        vid.pause();
        vid.removeAttribute('src');
        vid.load();
        this.videoElements.delete(id);
      }
    }
  }

  syncPlayback(isPlaying: boolean, currentTime: number) {
    this.videoElements.forEach((vid) => {
      const duration = vid.duration || 10;
      const targetTime = currentTime % duration;
      // Compute circular loop difference to prevent 4.98s fake drift on loop boundaries
      let drift = Math.abs(vid.currentTime - targetTime);
      if (drift > duration / 2) {
        drift = duration - drift;
      }

      if (isPlaying) {
        if (vid.paused) vid.play().catch(() => {});
        // Only seek if circular drift exceeds 0.5s and video is not currently seeking
        if (!vid.seeking && drift > 0.5) {
          vid.currentTime = targetTime;
        }
      } else {
        if (!vid.paused) vid.pause();
        // When paused / scrubbing, seek cleanly if drift exceeds 0.1s
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
    items: VideoOverlayItem[],
    currentTime: number,
    beatFactorMap: Record<string, number>
  ) {
    if (!items || items.length === 0) return;

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

      let vid = this.videoElements.get(item.id);
      if (!vid || vid.readyState < 2) {
        if (!item.url && item.filePath) {
          this.reloadAssetFromDisk(item).catch(() => {});
        } else if (item.url && (!vid || vid.readyState === 0)) {
          this.loadVideo(item).catch(() => {});
        }
        continue;
      }

      const beatFactor = beatFactorMap[item.id] ?? 1.0;
      const isFull = !!item.isFullScreen;
      const posX = isFull ? width / 2 : (item.x ?? 0.5) * width;
      let posY = (isFull ? height / 2 : (item.y ?? 0.5) * height) + transState.offsetY;
      let rawOpacity = typeof item.opacity === 'number' && Number.isFinite(item.opacity) ? item.opacity : 1.0;
      let drawAlpha = Math.max(0, Math.min(1, rawOpacity * transState.alphaMultiplier));
      let animScale = 1.0 * transState.scaleMultiplier;

      // Animation options
      if (item.animation === 'floating') {
        posY += Math.sin(currentTime * 2.5 + (item.x ?? 0.5) * 10) * 12;
      } else if (item.animation === 'pulse-beat') {
        if (item.followBeat) {
          animScale *= 1.0 + (beatFactor - 1.0) * 0.15;
        } else {
          animScale *= 1.0 + Math.sin(currentTime * 3) * 0.05;
        }
      } else if (item.animation === 'shimmer') {
        drawAlpha *= 0.6 + Math.sin(currentTime * 4) * 0.4;
      } else if (item.animation === 'glow-pulse') {
        drawAlpha *= 0.75 + Math.sin(currentTime * 5) * 0.25;
      }
      drawAlpha = Math.max(0, Math.min(1, drawAlpha));

      const beatScale = item.followBeat ? 1 + (beatFactor - 1) * 0.2 : 1.0;
      const vidW = vid.videoWidth || 640;
      const vidH = vid.videoHeight || 360;

      let drawW: number;
      let drawH: number;

      if (isFull) {
        const fitMode = item.fitMode || 'cover';
        if (fitMode === 'fill') {
          drawW = width * animScale * beatScale;
          drawH = height * animScale * beatScale;
        } else if (fitMode === 'fit') {
          const s = Math.min(width / vidW, height / vidH);
          drawW = vidW * s * animScale * beatScale;
          drawH = vidH * s * animScale * beatScale;
        } else {
          // cover (default)
          const s = Math.max(width / vidW, height / vidH);
          drawW = vidW * s * animScale * beatScale;
          drawH = vidH * s * animScale * beatScale;
        }
      } else {
        const baseScale = item.scale ?? 1.0;
        const scale = baseScale * beatScale * animScale;
        drawW = vidW * scale;
        drawH = vidH * scale;
      }

      ctx.save();
      ctx.globalAlpha = drawAlpha;
      ctx.globalCompositeOperation = (item.blendMode as GlobalCompositeOperation) || 'source-over';
      ctx.translate(posX, posY);

      if (item.chromaKey?.enabled) {
        this.renderChromaKey(ctx, vid, drawW, drawH, item.chromaKey);
      } else {
        ctx.drawImage(vid, -drawW / 2, -drawH / 2, drawW, drawH);
      }

      ctx.restore();
    }
  }

  private renderChromaKey(
    targetCtx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
    vid: HTMLVideoElement,
    drawW: number,
    drawH: number,
    chroma: { color: string; similarity: number; smoothness: number }
  ) {
    const w = Math.round(drawW);
    const h = Math.round(drawH);
    if (w <= 0 || h <= 0) return;

    // Allocate canvas with headroom to prevent continuous GC churn when scaling
    if (!this.tempCanvas || this.tempCanvas.width < w || this.tempCanvas.height < h) {
      const targetW = Math.max(w, this.tempCanvas ? this.tempCanvas.width : 512);
      const targetH = Math.max(h, this.tempCanvas ? this.tempCanvas.height : 512);
      this.tempCanvas = typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(targetW, targetH) : document.createElement('canvas');
      this.tempCanvas.width = targetW;
      this.tempCanvas.height = targetH;
      this.tempCtx = this.tempCanvas.getContext('2d', { willReadFrequently: true }) as any;
    }

    if (!this.tempCtx) return;

    this.tempCtx.clearRect(0, 0, this.tempCanvas.width, this.tempCanvas.height);
    this.tempCtx.drawImage(vid, 0, 0, w, h);
    const imgData = this.tempCtx.getImageData(0, 0, w, h);
    const data = imgData.data;

    const targetR = parseInt(chroma.color.slice(1, 3), 16) || 0;
    const targetG = parseInt(chroma.color.slice(3, 5), 16) || 255;
    const targetB = parseInt(chroma.color.slice(5, 7), 16) || 0;

    const simThreshold = (chroma.similarity || 0.4) * 255;
    const smooth = (chroma.smoothness || 0.1) * 255;

    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];

      const diff = Math.sqrt((r - targetR) ** 2 + (g - targetG) ** 2 + (b - targetB) ** 2);

      if (diff < simThreshold) {
        data[i + 3] = 0;
      } else if (diff < simThreshold + smooth) {
        data[i + 3] = Math.round(((diff - simThreshold) / smooth) * 255);
      }
    }

    this.tempCtx.putImageData(imgData, 0, 0);
    targetCtx.drawImage(this.tempCanvas as any, 0, 0, w, h, -drawW / 2, -drawH / 2, drawW, drawH);
  }
}

export const videoOverlayManager = new VideoOverlayManager();
