import type { LyricConfig, LyricSegment } from '../../lib/types/project';

export class LyricRenderer {
  private lastIndex: number = 0;
  private wordsWidthCache = new Map<string, { totalWidth: number; wordWidths: number[]; fontKey: string }>();

  render(
    ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
    width: number,
    height: number,
    config: LyricConfig,
    segments: LyricSegment[],
    currentTime: number,
    rawBeatFactor: number = 1.0
  ) {
    if (!config.enabled || !segments || segments.length === 0) return;

    const scaleFactor = Math.min(width / 1920, height / 1080);

    // Fast O(1) locality search with fallback for large tracklist subtitle sets
    let activeSeg: LyricSegment | undefined = undefined;
    const totalSegs = segments.length;

    // Check last cached index first
    if (this.lastIndex >= totalSegs) this.lastIndex = 0;
    const candidate = segments[this.lastIndex];
    if (candidate && currentTime >= (candidate.start - 0.05) && currentTime <= (candidate.end + 0.15)) {
      activeSeg = candidate;
    } else {
      let found = false;
      const scanStart = Math.max(0, this.lastIndex - 2);
      const scanEnd = Math.min(totalSegs, this.lastIndex + 10);
      for (let i = scanStart; i < scanEnd; i++) {
        const s = segments[i];
        if (currentTime >= (s.start - 0.05) && currentTime <= (s.end + 0.15)) {
          activeSeg = s;
          this.lastIndex = i;
          found = true;
          break;
        }
      }

      if (!found) {
        for (let i = 0; i < totalSegs; i++) {
          const s = segments[i];
          if (currentTime >= (s.start - 0.05) && currentTime <= (s.end + 0.15)) {
            activeSeg = s;
            this.lastIndex = i;
            break;
          }
          if (s.start > currentTime + 0.5) break;
        }
      }
    }

    if (!activeSeg) return;

    // Apply independent sensitivity multiplier
    const sensitivity = config.beatSensitivity ?? 1.0;
    const beatFactor = 1.0 + (rawBeatFactor - 1.0) * sensitivity;

    ctx.save();

    let posX = (config.x ?? 0.5) * width;
    let posY = (config.y !== undefined) ? config.y * height : (
      config.position === 'top' ? height * 0.15 :
      config.position === 'center' ? height * 0.5 :
      height * 0.85
    );

    const baseFontSize = (config.fontSize || 36) * scaleFactor;
    let finalFontSize = config.followBeat 
      ? baseFontSize * (1 + (beatFactor - 1) * 0.2) 
      : baseFontSize;

    // Global line animation override if configured
    if (config.animation === 'pulse-beat') {
      finalFontSize = config.followBeat 
        ? finalFontSize * (1 + (beatFactor - 1) * 0.15)
        : finalFontSize * (1 + Math.sin(currentTime * 4) * 0.08);
    } else if (config.animation === 'floating') {
      posY += Math.sin(currentTime * 2.5) * 10 * scaleFactor;
    }

    // Select custom font family
    const font = config.fontFamily || 'Inter';
    ctx.font = `bold ${finalFontSize}px "${font}", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
    ctx.textBaseline = 'middle';

    const segDuration = Math.max(0.1, activeSeg.end - activeSeg.start);
    const segElapsed = Math.max(0, currentTime - activeSeg.start);
    const segProgress = Math.min(1.0, segElapsed / segDuration);

    const style = config.style || 'karaoke';
    const enableGlow = config.glow !== false; // Default true
    const hasStroke = !!config.stroke;
    const strokeColor = config.strokeColor || '#000000';
    const strokeWidth = (config.strokeWidth || 4) * scaleFactor;

    const renderTextWithEffects = (text: string, x: number, y: number, isHighlighted: boolean = false) => {
      ctx.save();
      if (enableGlow) {
        ctx.shadowColor = isHighlighted ? (config.glowColor || config.highlightColor || '#38bdf8') : (config.glowColor || 'rgba(0, 0, 0, 0.9)');
        ctx.shadowBlur = (isHighlighted ? 14 : 8) * scaleFactor;
      } else {
        ctx.shadowColor = 'transparent';
        ctx.shadowBlur = 0;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 0;
      }

      if (hasStroke) {
        ctx.strokeStyle = strokeColor;
        ctx.lineWidth = strokeWidth;
        ctx.lineJoin = 'round';
        ctx.strokeText(text, x, y);
      }

      ctx.fillText(text, x, y);
      ctx.restore();
    };

    const alignment = config.alignment || 'center';

    // 1. KARAOKE STYLE (Per-word synced highlighting)
    // Check if activeSeg.words matches activeSeg.text; if not, re-align words
    let words = activeSeg.words;
    if (words && words.length > 0) {
      const wordsJoined = words.map((w) => w.word).join(' ').trim();
      if (wordsJoined !== activeSeg.text.trim()) {
        const textParts = activeSeg.text.trim().split(/\s+/).filter(Boolean);
        const wCount = textParts.length;
        const totalDur = Math.max(0.1, activeSeg.end - activeSeg.start);
        words = textParts.map((t, idx) => ({
          word: t,
          start: activeSeg.start + (idx / wCount) * totalDur,
          end: activeSeg.start + ((idx + 1) / wCount) * totalDur,
        }));
      }
    }

    // Determine anchor X based on alignment and position
    // posX is normalized 0..1 (default 0.5 center).
    // If alignment is left, posX defines the left starting edge.
    // If alignment is right, posX defines the right bounding edge.
    // If alignment is center, posX defines the center line.
    let anchorX = posX;
    if (alignment === 'left') {
      // If user hasn't nudged posX from default center (0.45..0.55), default to clean left margin
      if (Math.abs(config.x - 0.5) < 0.05) {
        anchorX = width * 0.10;
      }
    } else if (alignment === 'right') {
      // If user hasn't nudged posX from default center (0.45..0.55), default to clean right margin
      if (Math.abs(config.x - 0.5) < 0.05) {
        anchorX = width * 0.90;
      }
    }

    if (style === 'karaoke' && words && words.length > 0) {
      const fontKey = ctx.font;
      const cacheKey = activeSeg.id;
      let cachedMetrics = this.wordsWidthCache.get(cacheKey);

      if (!cachedMetrics || cachedMetrics.fontKey !== fontKey || cachedMetrics.wordWidths.length !== words.length) {
        const wordWidths = words.map((w, idx) => {
          const wordText = w.word + (idx < words.length - 1 ? ' ' : '');
          return ctx.measureText(wordText).width;
        });
        const totalWidth = wordWidths.reduce((acc, val) => acc + val, 0);
        cachedMetrics = { totalWidth, wordWidths, fontKey };
        this.wordsWidthCache.set(cacheKey, cachedMetrics);
        if (this.wordsWidthCache.size > 100) {
          const firstKey = this.wordsWidthCache.keys().next().value;
          if (firstKey) this.wordsWidthCache.delete(firstKey);
        }
      }

      const totalWidth = cachedMetrics.totalWidth;
      let currentDrawX = alignment === 'left' ? anchorX : (alignment === 'right' ? anchorX - totalWidth : anchorX - totalWidth / 2);

      ctx.textAlign = 'left';

      for (let i = 0; i < words.length; i++) {
        const wObj = words[i];
        const isCurrentWord = currentTime >= wObj.start && currentTime <= wObj.end;
        const isPastWord = currentTime > wObj.end;
        const wordText = wObj.word + (i < words.length - 1 ? ' ' : '');
        const wordWidth = cachedMetrics.wordWidths[i];

        ctx.save();

        if (isCurrentWord) {
          const wordProgress = (currentTime - wObj.start) / Math.max(0.01, wObj.end - wObj.start);
          const bounceScale = 1 + Math.sin(wordProgress * Math.PI) * 0.15;

          ctx.fillStyle = config.highlightColor || '#38bdf8';
          ctx.translate(currentDrawX + wordWidth / 2, posY);
          ctx.scale(bounceScale, bounceScale);
          renderTextWithEffects(wordText, -wordWidth / 2, 0, true);
        } else if (isPastWord) {
          ctx.fillStyle = config.highlightColor || '#38bdf8';
          renderTextWithEffects(wordText, currentDrawX, posY, true);
        } else {
          ctx.fillStyle = config.color || '#94a3b8';
          renderTextWithEffects(wordText, currentDrawX, posY, false);
        }

        ctx.restore();
        currentDrawX += wordWidth;
      }
    } 
    // 2. FADE-LINE STYLE
    else if (style === 'fade-line') {
      let alpha = 1.0;
      const fadeInWindow = Math.min(0.35, segDuration * 0.25);
      const fadeOutWindow = Math.min(0.35, segDuration * 0.25);

      if (segElapsed < fadeInWindow) {
        alpha = segElapsed / fadeInWindow;
      } else if (currentTime > activeSeg.end - fadeOutWindow) {
        alpha = Math.max(0, (activeSeg.end - currentTime) / fadeOutWindow);
      }

      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.textAlign = alignment;
      ctx.fillStyle = config.highlightColor || config.color || '#ffffff';
      renderTextWithEffects(activeSeg.text, anchorX, posY, true);
      ctx.restore();
    }
    // 3. TYPEWRITER STYLE
    else if (style === 'typewriter') {
      const fullText = activeSeg.text;
      const charCount = Math.max(1, Math.min(fullText.length, Math.floor(segProgress * fullText.length * 1.2)));
      const visibleText = fullText.slice(0, charCount);

      ctx.save();
      ctx.textAlign = alignment;
      ctx.fillStyle = config.highlightColor || config.color || '#ffffff';
      renderTextWithEffects(visibleText, anchorX, posY, false);
      ctx.restore();
    }
    // 4. BOUNCE-WORD / BEAT BOUNCE STYLE
    else if (style === 'bounce-word') {
      const bounce = Math.sin(currentTime * 6) * 10 * (config.followBeat ? beatFactor : 1.0) * scaleFactor;
      const scale = 1.0 + (config.followBeat ? (beatFactor - 1.0) * 0.25 : Math.sin(currentTime * 5) * 0.08);

      ctx.save();
      ctx.translate(anchorX, posY + bounce);
      ctx.scale(scale, scale);
      ctx.textAlign = alignment;
      ctx.fillStyle = config.highlightColor || config.color || '#38bdf8';
      renderTextWithEffects(activeSeg.text, 0, 0, true);
      ctx.restore();
    }
    // 5. BOTTOM-BAR / CLASSIC SUBTITLE STYLE
    else if (style === 'bottom-bar') {
      ctx.save();
      const textMetrics = ctx.measureText(activeSeg.text);
      const textWidth = textMetrics.width;
      const padX = 28 * scaleFactor;
      const padY = 14 * scaleFactor;
      const barHeight = finalFontSize + padY * 2;
      const barWidth = textWidth + padX * 2;

      // Draw rounded translucent backdrop according to alignment
      ctx.fillStyle = 'rgba(10, 10, 15, 0.78)';
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.4)';
      ctx.lineWidth = 1.5 * scaleFactor;
      
      let rx = anchorX - barWidth / 2;
      let textX = anchorX;
      if (alignment === 'left') {
        rx = anchorX - padX;
        textX = anchorX;
      } else if (alignment === 'right') {
        rx = anchorX - textWidth - padX;
        textX = anchorX;
      }
      const ry = posY - barHeight / 2;
      const radius = 12 * scaleFactor;

      ctx.beginPath();
      ctx.roundRect(rx, ry, barWidth, barHeight, radius);
      ctx.fill();
      ctx.stroke();

      // Text inside bar
      ctx.textAlign = alignment;
      ctx.fillStyle = config.highlightColor || config.color || '#ffffff';
      renderTextWithEffects(activeSeg.text, textX, posY, false);
      ctx.restore();
    }
    // DEFAULT FALLBACK
    else {
      ctx.textAlign = alignment;
      ctx.fillStyle = config.color || '#ffffff';
      renderTextWithEffects(activeSeg.text, anchorX, posY, false);
    }

    ctx.restore();
  }
}
