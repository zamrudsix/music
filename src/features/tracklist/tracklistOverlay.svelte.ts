import type { TracklistOverlayConfig, AudioTrackItem } from '../../lib/types/project';

interface CachedTrackItem {
  inactiveCanvas: OffscreenCanvas;
  activeCanvas: OffscreenCanvas;
  width: number;
  height: number;
  anchorX: number;
  anchorY: number;
}

interface CachedTracklistTitle {
  canvas: OffscreenCanvas;
  width: number;
  height: number;
  anchorX: number;
  anchorY: number;
  heightOffset: number;
}

export class TracklistOverlayRenderer {
  private itemCache = new Map<number, CachedTrackItem>();
  private titleCache: CachedTracklistTitle | null = null;

  clearCache() {
    this.itemCache.clear();
    this.titleCache = null;
  }

  prepareCache(
    canvasWidth: number,
    canvasHeight: number,
    config: TracklistOverlayConfig | undefined,
    tracks: AudioTrackItem[] | undefined
  ) {
    this.clearCache();
    if (!config || !config.enabled || !tracks || tracks.length === 0) return;

    const scaleFactor = Math.min(canvasWidth / 1920, canvasHeight / 1080);
    const font = config.fontFamily || 'Inter';
    const baseFontSize = (config.fontSize || 26) * scaleFactor;
    const shadowPad = Math.ceil(24 * scaleFactor);

    // 1. Prepare Title Cache (Header Title + Underline)
    if (config.showTitle && config.title) {
      const titleSize = (config.titleFontSize || 38) * scaleFactor;
      const measureCanvas = new OffscreenCanvas(1, 1);
      const mCtx = measureCanvas.getContext('2d');
      if (mCtx) {
        const titleFont = `bold ${titleSize}px "${font}", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
        mCtx.font = titleFont;
        const titleMetrics = mCtx.measureText(config.title);

        const tWidth = Math.max(1, Math.ceil(titleMetrics.width) + shadowPad * 2 + Math.ceil(260 * scaleFactor));
        const tHeight = Math.max(1, Math.ceil(titleSize * 1.6) + shadowPad * 2 + Math.ceil(36 * scaleFactor));

        const tCanvas = new OffscreenCanvas(tWidth, tHeight);
        const tCtx = tCanvas.getContext('2d');
        if (tCtx) {
          tCtx.font = titleFont;
          tCtx.textAlign = config.alignment || 'left';
          tCtx.textBaseline = 'middle';

          let anchorX = shadowPad;
          if (config.alignment === 'center') anchorX = tWidth / 2;
          else if (config.alignment === 'right') anchorX = tWidth - shadowPad;
          const anchorY = shadowPad + titleSize / 2;

          if (config.shadow) {
            tCtx.shadowColor = config.shadowColor || 'rgba(0, 0, 0, 0.9)';
            tCtx.shadowBlur = 10 * scaleFactor;
            tCtx.shadowOffsetX = 2 * scaleFactor;
            tCtx.shadowOffsetY = 3 * scaleFactor;
          }

          if (config.stroke) {
            tCtx.strokeStyle = config.strokeColor || '#000000';
            tCtx.lineWidth = (config.strokeWidth || 3) * scaleFactor;
            tCtx.lineJoin = 'round';
            tCtx.strokeText(config.title, anchorX, anchorY);
          }

          tCtx.fillStyle = config.accentColor || '#38bdf8';
          tCtx.fillText(config.title, anchorX, anchorY);

          // Accent underline
          tCtx.shadowColor = 'transparent';
          tCtx.shadowBlur = 0;
          tCtx.strokeStyle = config.accentColor || '#38bdf8';
          tCtx.lineWidth = 2.5 * scaleFactor;
          tCtx.beginPath();
          const lineY = anchorY + titleSize / 2 + 10 * scaleFactor;
          if (config.alignment === 'center') {
            tCtx.moveTo(anchorX - 120 * scaleFactor, lineY);
            tCtx.lineTo(anchorX + 120 * scaleFactor, lineY);
          } else if (config.alignment === 'right') {
            tCtx.moveTo(anchorX - 240 * scaleFactor, lineY);
            tCtx.lineTo(anchorX, lineY);
          } else {
            tCtx.moveTo(anchorX, lineY);
            tCtx.lineTo(anchorX + 240 * scaleFactor, lineY);
          }
          tCtx.stroke();

          this.titleCache = {
            canvas: tCanvas,
            width: tWidth,
            height: tHeight,
            anchorX,
            anchorY,
            heightOffset: titleSize + (34 * scaleFactor),
          };
        }
      }
    }

    // 2. Prepare Items Cache (Inactive & Active versions)
    tracks.forEach((track, idx) => {
      const cleanName = track.name.replace(/\.[^/.]+$/, '').trim();
      const numPrefix = config.showNumbers ? `${(idx + 1).toString().padStart(2, '0')}. ` : '';
      const durSuffix = config.showDuration && track.duration ? ` (${this.formatDuration(track.duration)})` : '';
      const fullText = `${numPrefix}${cleanName}${durSuffix}`;

      const measureCanvas = new OffscreenCanvas(1, 1);
      const mCtx = measureCanvas.getContext('2d');
      if (!mCtx) return;

      const activeFont = `bold ${baseFontSize}px "${font}", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
      const inactiveFont = `500 ${baseFontSize}px "${font}", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;

      mCtx.font = activeFont;
      const activeMetrics = mCtx.measureText(fullText);

      const outlinePadding = config.stroke ? Math.ceil((config.strokeWidth || 3) * scaleFactor * 2) : 0;
      const iWidth = Math.max(1, Math.ceil(activeMetrics.width) + shadowPad * 2 + Math.ceil(50 * scaleFactor) + outlinePadding);
      const iHeight = Math.max(1, Math.ceil(baseFontSize * 1.6) + shadowPad * 2 + outlinePadding);

      let anchorX = shadowPad;
      if (config.alignment === 'center') anchorX = iWidth / 2;
      else if (config.alignment === 'right') anchorX = iWidth - shadowPad;
      const anchorY = iHeight / 2;

      // Inactive Canvas
      const inCanvas = new OffscreenCanvas(iWidth, iHeight);
      const inCtx = inCanvas.getContext('2d');
      if (inCtx) {
        inCtx.font = inactiveFont;
        inCtx.textAlign = config.alignment || 'left';
        inCtx.textBaseline = 'middle';
        if (config.shadow) {
          inCtx.shadowColor = config.shadowColor || 'rgba(0, 0, 0, 0.9)';
          inCtx.shadowBlur = 6 * scaleFactor;
          inCtx.shadowOffsetX = 2 * scaleFactor;
          inCtx.shadowOffsetY = 2 * scaleFactor;
        }
        if (config.stroke) {
          inCtx.strokeStyle = config.strokeColor || '#000000';
          inCtx.lineWidth = (config.strokeWidth || 3) * scaleFactor;
          inCtx.lineJoin = 'round';
          inCtx.strokeText(fullText, anchorX, anchorY);
        }
        inCtx.fillStyle = config.color || '#ffffff';
        inCtx.fillText(fullText, anchorX, anchorY);
      }

      // Active Canvas (Clean Drop Shadow without glowing halo)
      const actCanvas = new OffscreenCanvas(iWidth, iHeight);
      const actCtx = actCanvas.getContext('2d');
      if (actCtx) {
        actCtx.font = activeFont;
        actCtx.textAlign = config.alignment || 'left';
        actCtx.textBaseline = 'middle';
        if (config.shadow) {
          // Drop shadow preserved (clean, non-glow dark shadow)
          actCtx.shadowColor = config.shadowColor || 'rgba(0, 0, 0, 0.9)';
          actCtx.shadowBlur = 6 * scaleFactor;
          actCtx.shadowOffsetX = 2 * scaleFactor;
          actCtx.shadowOffsetY = 2 * scaleFactor;
        }
        if (config.stroke) {
          actCtx.strokeStyle = config.strokeColor || '#000000';
          actCtx.lineWidth = (config.strokeWidth || 3) * scaleFactor;
          actCtx.lineJoin = 'round';
          actCtx.strokeText(fullText, anchorX, anchorY);
        }
        actCtx.fillStyle = config.activeColor || '#38bdf8';
        actCtx.fillText(fullText, anchorX, anchorY);
      }

      if (inCanvas && actCanvas) {
        this.itemCache.set(idx, {
          inactiveCanvas: inCanvas,
          activeCanvas: actCanvas,
          width: iWidth,
          height: iHeight,
          anchorX,
          anchorY,
        });
      }
    });
  }

  render(
    ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
    canvasWidth: number,
    canvasHeight: number,
    config: TracklistOverlayConfig | undefined,
    tracks: AudioTrackItem[] | undefined,
    currentTime: number,
    rawBeatFactor: number = 1.0
  ) {
    if (!config || !config.enabled || !tracks || tracks.length === 0) return;

    const scaleFactor = Math.min(canvasWidth / 1920, canvasHeight / 1080);

    // 1. Calculate Active Playing Track Index & Progress
    let accumulatedTime = 0;
    let activeTrackIndex = -1;
    let trackProgress = 0;
    const trackRanges: Array<{ index: number; name: string; start: number; end: number; duration: number }> = [];

    tracks.forEach((t, idx) => {
      const dur = t.duration || 0;
      const start = accumulatedTime;
      const end = accumulatedTime + dur;
      const cleanName = t.name.replace(/\.[^/.]+$/, '').trim();

      trackRanges.push({
        index: idx + 1,
        name: cleanName,
        start,
        end,
        duration: dur,
      });

      if (currentTime >= start && (currentTime < end || idx === tracks.length - 1)) {
        activeTrackIndex = idx;
        trackProgress = dur > 0 ? (currentTime - start) / dur : 0;
      }

      accumulatedTime = end;
    });

    if (activeTrackIndex === -1 && tracks.length > 0) {
      activeTrackIndex = 0;
    }

    const sens = config.beatSensitivity ?? 1.0;
    const beatFactor = 1.0 + (rawBeatFactor - 1.0) * sens;

    ctx.save();
    ctx.globalAlpha = config.opacity ?? 1.0;
    ctx.textAlign = config.alignment || 'left';
    ctx.textBaseline = 'middle';

    const startX = (config.x ?? 0.08) * canvasWidth;
    let currentY = (config.y ?? 0.15) * canvasHeight;
    const font = config.fontFamily || 'Inter';
    const baseFontSize = (config.fontSize || 26) * scaleFactor;
    const lineSpacing = (config.lineSpacing || 44) * scaleFactor;

    // 2. Render Header Title
    if (this.titleCache) {
      ctx.drawImage(
        this.titleCache.canvas,
        startX - this.titleCache.anchorX,
        currentY - this.titleCache.anchorY
      );
      currentY += this.titleCache.heightOffset;
    } else if (config.showTitle && config.title) {
      const titleSize = (config.titleFontSize || 38) * scaleFactor;
      ctx.font = `bold ${titleSize}px "${font}", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
      ctx.fillStyle = config.accentColor || '#38bdf8';

      if (config.shadow) {
        ctx.shadowColor = config.shadowColor || 'rgba(0, 0, 0, 0.9)';
        ctx.shadowBlur = 10 * scaleFactor;
        ctx.shadowOffsetX = 2 * scaleFactor;
        ctx.shadowOffsetY = 3 * scaleFactor;
      }

      ctx.fillText(config.title, startX, currentY);
      currentY += titleSize + (18 * scaleFactor);

      ctx.strokeStyle = config.accentColor || '#38bdf8';
      ctx.lineWidth = 2.5 * scaleFactor;
      ctx.beginPath();
      if (config.alignment === 'center') {
        ctx.moveTo(startX - 120 * scaleFactor, currentY - 8 * scaleFactor);
        ctx.lineTo(startX + 120 * scaleFactor, currentY - 8 * scaleFactor);
      } else if (config.alignment === 'right') {
        ctx.moveTo(startX - 240 * scaleFactor, currentY - 8 * scaleFactor);
        ctx.lineTo(startX, currentY - 8 * scaleFactor);
      } else {
        ctx.moveTo(startX, currentY - 8 * scaleFactor);
        ctx.lineTo(startX + 240 * scaleFactor, currentY - 8 * scaleFactor);
      }
      ctx.stroke();

      currentY += 16 * scaleFactor;
    }

    // 3. Render Each Track Item
    trackRanges.forEach((tr, idx) => {
      const isActive = idx === activeTrackIndex;
      const cached = this.itemCache.get(idx);

      // Fast-path: Zero-overhead GPU blit from cached canvas
      if (cached) {
        let lineAlpha = isActive ? 1.0 : 0.65;
        let animScale = 1.0;
        let itemX = startX;

        if (isActive) {
          const anim = config.nowPlayingAnimation || 'glow-badge';
          if (anim === 'glow-badge') {
            lineAlpha = 0.85 + Math.sin(currentTime * 5) * 0.15;
          } else if (anim === 'bounce-pulse') {
            if (config.followBeat) {
              animScale = 1.0 + (beatFactor - 1.0) * 0.22;
            } else {
              animScale = 1.0 + Math.sin(currentTime * 4) * 0.08;
            }
          } else if (anim === 'sliding-accent') {
            const slideOffset = Math.sin(currentTime * 3) * 6 * scaleFactor;
            itemX += config.alignment === 'right' ? -slideOffset : slideOffset;
          }
        }

        ctx.save();
        ctx.globalAlpha = lineAlpha;

        if (animScale !== 1.0) {
          ctx.translate(itemX, currentY);
          ctx.scale(animScale, animScale);
          ctx.drawImage(
            isActive ? cached.activeCanvas : cached.inactiveCanvas,
            -cached.anchorX,
            -cached.anchorY
          );
        } else {
          ctx.drawImage(
            isActive ? cached.activeCanvas : cached.inactiveCanvas,
            itemX - cached.anchorX,
            currentY - cached.anchorY
          );
        }

        // Equalizer indicator if configured
        if (isActive && config.nowPlayingAnimation === 'equalizer-indicator') {
          this.renderMiniEqualizer(
            ctx,
            itemX,
            currentY,
            baseFontSize,
            config.activeColor || '#38bdf8',
            currentTime,
            beatFactor,
            config.alignment,
            scaleFactor
          );
        }

        // Glow badge marker indicator
        if (isActive && config.nowPlayingAnimation === 'glow-badge') {
          this.renderNowPlayingIndicator(
            ctx,
            itemX,
            currentY,
            baseFontSize,
            config.activeColor || '#38bdf8',
            currentTime,
            config.alignment,
            scaleFactor
          );
        }

        ctx.restore();
        currentY += lineSpacing;
        return;
      }

      // Dynamic Fallback
      let lineFontSize = baseFontSize;
      let lineAlpha = isActive ? 1.0 : 0.65;
      let itemY = currentY;
      let itemX = startX;

      const numPrefix = config.showNumbers ? `${tr.index.toString().padStart(2, '0')}. ` : '';
      const durSuffix = config.showDuration ? ` (${this.formatDuration(tr.duration)})` : '';
      const fullText = `${numPrefix}${tr.name}${durSuffix}`;

      ctx.save();

      if (isActive) {
        const anim = config.nowPlayingAnimation || 'glow-badge';
        if (anim === 'bounce-pulse') {
          if (config.followBeat) {
            lineFontSize = baseFontSize * (1.0 + (beatFactor - 1.0) * 0.22);
          } else {
            lineFontSize = baseFontSize * (1.0 + Math.sin(currentTime * 4) * 0.08);
          }
        } else if (anim === 'glow-badge') {
          lineAlpha = 0.85 + Math.sin(currentTime * 5) * 0.15;
        } else if (anim === 'sliding-accent') {
          const slideOffset = Math.sin(currentTime * 3) * 6 * scaleFactor;
          itemX += config.alignment === 'right' ? -slideOffset : slideOffset;
        } else if (anim === 'karaoke-gradient') {
          lineFontSize = baseFontSize * (1.0 + (beatFactor - 1.0) * 0.1);
        }
      }

      ctx.font = `${isActive ? 'bold' : '500'} ${lineFontSize}px "${font}", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;

      if (config.shadow) {
        ctx.shadowColor = config.shadowColor || 'rgba(0, 0, 0, 0.9)';
        ctx.shadowBlur = 6 * scaleFactor;
        ctx.shadowOffsetX = 2 * scaleFactor;
        ctx.shadowOffsetY = 2 * scaleFactor;
      }

      ctx.globalAlpha = lineAlpha;

      if (isActive && config.nowPlayingAnimation === 'equalizer-indicator') {
        this.renderMiniEqualizer(ctx, itemX, itemY, lineFontSize, config.activeColor || '#38bdf8', currentTime, beatFactor, config.alignment, scaleFactor);
      }

      if (config.stroke) {
        ctx.save();
        ctx.strokeStyle = config.strokeColor || '#000000';
        ctx.lineWidth = (config.strokeWidth ?? 3) * scaleFactor;
        ctx.lineJoin = 'round';
        ctx.miterLimit = 2;
        ctx.strokeText(fullText, itemX, itemY);
        ctx.restore();
      }

      if (isActive) {
        ctx.fillStyle = config.activeColor || '#38bdf8';
      } else {
        ctx.fillStyle = config.color || '#ffffff';
      }

      ctx.fillText(fullText, itemX, itemY);

      if (isActive && config.nowPlayingAnimation === 'glow-badge') {
        this.renderNowPlayingIndicator(ctx, itemX, itemY, lineFontSize, config.activeColor || '#38bdf8', currentTime, config.alignment, scaleFactor);
      }

      ctx.restore();
      currentY += lineSpacing;
    });

    ctx.restore();
  }

  /**
   * Animated audio equalizer bars icon rendered beside the active track
   */
  private renderMiniEqualizer(
    ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
    x: number,
    y: number,
    fontSize: number,
    color: string,
    time: number,
    beatFactor: number,
    alignment: 'left' | 'center' | 'right',
    scaleFactor: number
  ) {
    const barWidth = 3 * scaleFactor;
    const gap = 2 * scaleFactor;
    const numBars = 3;
    const iconW = numBars * barWidth + (numBars - 1) * gap;
    const iconX = alignment === 'right' ? x + (15 * scaleFactor) : x - iconW - (12 * scaleFactor);

    ctx.save();
    ctx.fillStyle = color;
    for (let b = 0; b < numBars; b++) {
      const barH = (Math.sin(time * 8 + b * 2) * 0.4 + 0.6) * fontSize * 0.7 * (beatFactor > 1.1 ? 1.3 : 1.0);
      const bx = iconX + b * (barWidth + gap);
      const by = y + (fontSize * 0.35) - barH;
      ctx.fillRect(bx, by, barWidth, barH);
    }
    ctx.restore();
  }

  /**
   * Glowing pulsing dot beside active track
   */
  private renderNowPlayingIndicator(
    ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
    x: number,
    y: number,
    fontSize: number,
    color: string,
    time: number,
    alignment: 'left' | 'center' | 'right',
    scaleFactor: number
  ) {
    const dotRadius = (3.5 + Math.sin(time * 5) * 1.5) * scaleFactor;
    const dotX = alignment === 'right' ? x + (18 * scaleFactor) : x - (18 * scaleFactor);
    ctx.save();
    // Layered soft glow halo without shadowBlur Gaussian lag
    ctx.fillStyle = color;
    ctx.globalAlpha = 0.35;
    ctx.beginPath();
    ctx.arc(dotX, y, dotRadius * 1.6, 0, Math.PI * 2);
    ctx.fill();

    ctx.globalAlpha = 1.0;
    ctx.beginPath();
    ctx.arc(dotX, y, dotRadius, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  private formatDuration(seconds: number): string {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }
}

export const tracklistOverlayRenderer = new TracklistOverlayRenderer();
