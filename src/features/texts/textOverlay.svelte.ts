import type { TextOverlayItem } from '../../lib/types/project';
import { computeOverlayTransition } from '../../lib/utils/transition';

interface CachedTextOverlay {
  canvas: OffscreenCanvas;
  width: number;
  height: number;
  anchorX: number;
  anchorY: number;
  contentWidth: number; // pure measured text width
}

export class TextOverlayManager {
  private cache = new Map<string, CachedTextOverlay>();

  clearCache() {
    this.cache.clear();
  }

  cacheItem(
    canvasWidth: number,
    canvasHeight: number,
    item: TextOverlayItem
  ) {
    if (!item.text) return;
    if (item.animation === 'typewriter' || item.animation === 'glow-pulse') {
      return;
    }

    const scaleFactor = Math.min(canvasWidth / 1920, canvasHeight / 1080);
    const baseFontSize = (item.fontSize || 36) * scaleFactor;
    const font = item.fontFamily || 'Inter';
    const customShadowBlur = 8 * scaleFactor;
    const customShadowColor = item.shadowColor || 'rgba(0, 0, 0, 0.9)';
    const shadowOffsetX = 2 * scaleFactor;
    const shadowOffsetY = 3 * scaleFactor;

    const pad = Math.ceil(customShadowBlur * 2.5 + Math.max(Math.abs(shadowOffsetX), Math.abs(shadowOffsetY)) + 16 * scaleFactor);

    // Measure font dimensions
    const measureCanvas = new OffscreenCanvas(1, 1);
    const mCtx = measureCanvas.getContext('2d');
    if (!mCtx) return;

    const fontStr = `bold ${baseFontSize}px "${font}", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
    mCtx.font = fontStr;
    const metrics = mCtx.measureText(item.text);

    const textWidth = Math.ceil(metrics.width);
    const textHeight = Math.ceil(baseFontSize * 1.4);
    const cWidth = Math.max(1, textWidth + pad * 2);
    const cHeight = Math.max(1, textHeight + pad * 2);

    const cachedCanvas = new OffscreenCanvas(cWidth, cHeight);
    const cCtx = cachedCanvas.getContext('2d');
    if (!cCtx) return;

    // If marquee-left, we anchor at left edge for seamless repetitive tiling
    const isMarquee = item.animation === 'marquee-left';
    cCtx.textAlign = isMarquee ? 'left' : (item.alignment || 'center');
    cCtx.textBaseline = 'middle';
    cCtx.font = fontStr;

    let anchorX = pad;
    if (!isMarquee) {
      if (item.alignment === 'center') anchorX = cWidth / 2;
      else if (item.alignment === 'right') anchorX = cWidth - pad;
    }
    const anchorY = cHeight / 2;

    if (item.shadow) {
      cCtx.shadowColor = customShadowColor;
      cCtx.shadowBlur = customShadowBlur;
      cCtx.shadowOffsetX = shadowOffsetX;
      cCtx.shadowOffsetY = shadowOffsetY;
    }

    if (item.stroke) {
      cCtx.strokeStyle = item.strokeColor || '#000000';
      cCtx.lineWidth = (item.strokeWidth || 4) * scaleFactor;
      cCtx.lineJoin = 'round';
      cCtx.strokeText(item.text, anchorX, anchorY);
    }

    cCtx.fillStyle = item.color || '#ffffff';
    cCtx.fillText(item.text, anchorX, anchorY);

    this.cache.set(item.id, {
      canvas: cachedCanvas,
      width: cWidth,
      height: cHeight,
      anchorX,
      anchorY,
      contentWidth: textWidth,
    });
  }

  prepareCache(
    canvasWidth: number,
    canvasHeight: number,
    texts: TextOverlayItem[]
  ) {
    this.cache.clear();
    if (!texts || texts.length === 0) return;

    for (const item of texts) {
      this.cacheItem(canvasWidth, canvasHeight, item);
    }
  }

  render(
    ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
    canvasWidth: number,
    canvasHeight: number,
    texts: TextOverlayItem[],
    currentTime: number,
    rawBeatFactor: number = 1.0
  ) {
    if (!texts || texts.length === 0) return;

    // Relative reference scale: Default canvas resolution is 1920x1080
    const scaleFactor = Math.min(canvasWidth / 1920, canvasHeight / 1080);

    for (const item of texts) {
      if (!item.text) continue;

      const transState = computeOverlayTransition(
        currentTime,
        item.startTime,
        item.endTime,
        item.transition,
        item.transitionDuration,
        canvasHeight
      );
      if (!transState.isVisible) continue;

      const sensitivity = item.beatSensitivity ?? 1.0;
      const beatFactor = 1.0 + (rawBeatFactor - 1.0) * sensitivity;

      // 1. Check or Auto-Create Cached Texture (Zero-cost GPU blit)
      let cached = this.cache.get(item.id);
      if (!cached && item.animation !== 'typewriter' && item.animation !== 'glow-pulse') {
        this.cacheItem(canvasWidth, canvasHeight, item);
        cached = this.cache.get(item.id);
      }

      if (cached && item.animation !== 'typewriter' && item.animation !== 'glow-pulse') {
        const posX = item.x * canvasWidth;
        let posY = item.y * canvasHeight + transState.offsetY;
        let drawAlpha = (item.opacity ?? 1.0) * transState.alphaMultiplier;
        let animScale = 1.0 * transState.scaleMultiplier;

        if (item.animation === 'marquee-left') {
          // Infinite TV News Crawling Text to the left
          const speed = (item.crawlSpeed || 160) * scaleFactor;
          const spacing = (item.crawlSpacing || 120) * scaleFactor;
          const unitWidth = cached.contentWidth + spacing;
          
          if (unitWidth > 0) {
            // Continuous leftward offset based on time
            const shift = (currentTime * speed) % unitWidth;
            
            ctx.save();
            ctx.globalAlpha = drawAlpha;
            // Clip to horizontal full span with margin around text height to avoid bleeding
            ctx.beginPath();
            ctx.rect(0, posY - cached.height / 2, canvasWidth, cached.height);
            ctx.clip();

            // Start tiling from the shifted left position until covering past canvasWidth
            let curX = -shift;
            while (curX < canvasWidth + unitWidth) {
              ctx.drawImage(cached.canvas, curX - cached.anchorX, posY - cached.anchorY);
              curX += unitWidth;
            }
            ctx.restore();
            continue;
          }
        } else if (item.animation === 'floating') {
          posY += Math.sin(currentTime * 2.5 + item.x * 10) * 12 * scaleFactor;
        } else if (item.animation === 'pulse-beat') {
          if (item.followBeat) {
            animScale *= 1 + (beatFactor - 1) * 0.15;
          } else {
            animScale *= 1 + Math.sin(currentTime * 3) * 0.05;
          }
        } else if (item.animation === 'shimmer') {
          drawAlpha *= (0.6 + Math.sin(currentTime * 4) * 0.4);
        }

        ctx.save();
        ctx.globalAlpha = drawAlpha;
        ctx.translate(posX, posY);
        if (item.rotation) {
          ctx.rotate((item.rotation * Math.PI) / 180);
        }
        if (animScale !== 1.0) {
          ctx.scale(animScale, animScale);
        }
        ctx.drawImage(cached.canvas, -cached.anchorX, -cached.anchorY);
        ctx.restore();
        continue;
      }

      const posX = item.x * canvasWidth;
      let posY = item.y * canvasHeight + transState.offsetY;
      const baseFontSize = (item.fontSize || 36) * scaleFactor * transState.scaleMultiplier;
      let finalFontSize = baseFontSize;
      let drawAlpha = (item.opacity ?? 1.0) * transState.alphaMultiplier;
      let displayText = item.text;
      let customShadowBlur = 8 * scaleFactor;
      let customShadowColor = item.shadowColor || 'rgba(0, 0, 0, 0.9)';

      // 1. Process Animations
      if (item.animation === 'pulse-beat') {
        if (item.followBeat) {
          finalFontSize = baseFontSize * (1 + (beatFactor - 1) * 0.15);
        } else {
          finalFontSize = baseFontSize * (1 + Math.sin(currentTime * 3) * 0.05);
        }
      } else if (item.animation === 'floating') {
        const floatOffset = Math.sin(currentTime * 2.5 + item.x * 10) * 12 * scaleFactor;
        posY += floatOffset;
      } else if (item.animation === 'shimmer') {
        const shimmerAlpha = 0.6 + Math.sin(currentTime * 4) * 0.4;
        drawAlpha *= shimmerAlpha;
      } else if (item.animation === 'glow-pulse') {
        // Dynamic glowing pulsating aura effect
        const pulse = 0.5 + 0.5 * Math.sin(currentTime * 4.5);
        const beatBoost = item.followBeat ? (beatFactor - 1.0) * 1.5 : 0;
        
        customShadowBlur = (10 + (pulse * 14) + (beatBoost * 12)) * scaleFactor;
        customShadowColor = item.accentColor || item.color || '#38bdf8';
        drawAlpha = Math.min(1.0, drawAlpha * (0.8 + 0.2 * pulse + beatBoost * 0.2));
        finalFontSize = baseFontSize * (1.0 + (pulse * 0.04) + (beatBoost * 0.06));
      } else if (item.animation === 'typewriter') {
        const loopDuration = 4.5;
        const typingDuration = 3.0;
        const progressInLoop = (currentTime % loopDuration);
        if (progressInLoop < typingDuration) {
          const charCount = Math.max(1, Math.floor((progressInLoop / typingDuration) * item.text.length));
          displayText = item.text.slice(0, charCount);
        } else {
          displayText = item.text;
        }
      }

      ctx.save();
      ctx.globalAlpha = drawAlpha;
      ctx.textAlign = item.alignment || 'center';
      ctx.textBaseline = 'middle';

      const font = item.fontFamily || 'Inter';
      ctx.font = `bold ${finalFontSize}px "${font}", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;

      // 2. Position & Rotation
      ctx.translate(posX, posY);
      if (item.rotation) {
        ctx.rotate((item.rotation * Math.PI) / 180);
      }

      // 3. Shadow / Glow
      if (item.shadow || item.animation === 'glow-pulse') {
        ctx.shadowColor = customShadowColor;
        ctx.shadowBlur = customShadowBlur;
        ctx.shadowOffsetX = item.animation === 'glow-pulse' ? 0 : 2 * scaleFactor;
        ctx.shadowOffsetY = item.animation === 'glow-pulse' ? 0 : 3 * scaleFactor;
      }

      // 4. Draw Text
      if (item.stroke) {
        ctx.strokeStyle = item.strokeColor || '#000000';
        ctx.lineWidth = (item.strokeWidth || 4) * scaleFactor;
        ctx.lineJoin = 'round';
        ctx.strokeText(displayText, 0, 0);
      }

      ctx.fillStyle = item.color || '#ffffff';
      ctx.fillText(displayText, 0, 0);

      ctx.restore();
    }
  }
}

export const textOverlayManager = new TextOverlayManager();
