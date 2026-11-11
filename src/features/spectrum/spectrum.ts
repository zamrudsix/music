import type { SpectrumConfig } from '../../lib/types/project';

// Color palette presets for multi-color spectrum styles
const RAINBOW_PALETTE = ['#f43f5e', '#f97316', '#fbbf24', '#22c55e', '#06b6d4', '#3b82f6', '#a855f7'];
const FIRE_PALETTE = ['#ef4444', '#f97316', '#f59e0b', '#fbbf24', '#fef08a'];
const GALAXY_PALETTE = ['#4c1d95', '#7c3aed', '#c084fc', '#e879f9', '#38bdf8'];
const NEON_PALETTE = ['#00f5d4', '#7b2cbf', '#f72585', '#4cc9f0', '#fee440'];
const PRISM_PALETTE = ['#e0e7ff', '#a5b4fc', '#818cf8', '#6366f1', '#4f46e5'];

export class SpectrumRenderer {
  // Reusable static Uint8Array mirror buffer to guarantee zero heap allocation per frame
  private mirrorBuffer = new Uint8Array(512);

  render(
    ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
    width: number,
    height: number,
    config: SpectrumConfig,
    frequencies: Uint8Array,
    rawBeatFactor: number = 1.0
  ) {
    if (!config.enabled || frequencies.length === 0) return;

    const scaleFactor = Math.min(width / 1920, height / 1080);
    const sensitivity = config.beatSensitivity ?? 1.0;
    const beatFactor = 1.0 + (rawBeatFactor - 1.0) * sensitivity;
    const spectrumBeatMultiplier = config.followBeat ? 1 + (beatFactor - 1) * 0.35 : 1.0;

    ctx.save();
    ctx.globalAlpha = config.opacity;

    const posX = (config.x ?? 0.5) * width;
    const posY = (config.y ?? 0.5) * height;
    const scale = (config.scale ?? 1.0) * scaleFactor;

    const count = Math.min(config.barCount, frequencies.length);

    // Symmetrical mirror data if enabled (Zero-allocation Uint8Array copy)
    let freqData: Uint8Array = frequencies;
    if (config.mirror && count > 2) {
      if (this.mirrorBuffer.length < count) {
        this.mirrorBuffer = new Uint8Array(Math.max(count, 512));
      }
      const half = Math.ceil(count / 2);
      for (let i = 0; i < half; i++) {
        const srcVal = frequencies[Math.floor((i / half) * (frequencies.length / 2))] || 0;
        this.mirrorBuffer[half - 1 - i] = srcVal;
        if (half + i < count) {
          this.mirrorBuffer[half + i] = srcVal;
        }
      }
      freqData = this.mirrorBuffer;
    }

    const style = config.style;

    // Dispatch by category / family to maximize Canvas 2D render speed
    if (this.isBarsFamily(style)) {
      this.renderBars(ctx, width, height, posX, posY, scale, scaleFactor, config, freqData, count, spectrumBeatMultiplier, style);
    } else if (this.isLEDFamily(style)) {
      this.renderLED(ctx, width, height, posX, posY, scale, scaleFactor, config, freqData, count, beatFactor, spectrumBeatMultiplier, style);
    } else if (this.isRadialFamily(style)) {
      this.renderRadial(ctx, width, height, posX, posY, scale, scaleFactor, config, freqData, count, beatFactor, spectrumBeatMultiplier, style);
    } else if (this.isWaveFamily(style)) {
      this.renderWave(ctx, width, height, posX, posY, scale, scaleFactor, config, freqData, count, spectrumBeatMultiplier, style);
    } else if (this.isMirrorFamily(style)) {
      this.renderMirror(ctx, width, height, posX, posY, scale, scaleFactor, config, freqData, count, spectrumBeatMultiplier, style);
    } else if (this.isNCSFamily(style)) {
      this.renderNCS(ctx, width, height, posX, posY, scale, scaleFactor, config, freqData, count, beatFactor, spectrumBeatMultiplier, style);
    } else if (this.isScientificFamily(style)) {
      this.renderScientific(ctx, width, height, posX, posY, scale, scaleFactor, config, freqData, count, spectrumBeatMultiplier, style);
    } else if (this.isGeometricFamily(style)) {
      this.renderGeometric(ctx, width, height, posX, posY, scale, scaleFactor, config, freqData, count, beatFactor, spectrumBeatMultiplier, style);
    } else if (this.isAvantGardeFamily(style)) {
      this.renderAvantGarde(ctx, width, height, posX, posY, scale, scaleFactor, config, freqData, count, beatFactor, spectrumBeatMultiplier, style);
    } else {
      this.renderSpecialFX(ctx, width, height, posX, posY, scale, scaleFactor, config, freqData, count, beatFactor, spectrumBeatMultiplier, style);
    }

    ctx.restore();
  }

  // Helper classifiers
  private isBarsFamily(s: string): boolean {
    return s === 'bars' || s.startsWith('Bars') || s.startsWith('Bar ') || s === 'Octave Bars' || s === 'Lumi Bars' || s === 'Outline' || s === 'Alpha Bars' || s === 'Matrix Rain';
  }

  private isLEDFamily(s: string): boolean {
    return s === 'digital-eq' || s.startsWith('LED');
  }

  private isRadialFamily(s: string): boolean {
    return s === 'circular' || s === 'radial-bars' || s === 'dots-ring' || s === 'double-circular' || s === 'pulse-rings' || s.startsWith('Radial') || s === 'Cardioid Heart' || s === 'Astroid Star' || s === 'Infinity Loop' || s === 'Phyllotaxis' || s === 'Maurer Rose' || s === 'Butterfly Curve' || s === 'Epicycloid Gear' || s === 'Hypotrochoid' || s === 'Involute Spiral';
  }

  private isWaveFamily(s: string): boolean {
    return s === 'waveform' || s === 'neon-wave' || s.startsWith('Graph') || s === 'Wave Mirror' || s === 'Asap Wave' || s === 'Ripple Waves' || s === 'Harmonograph' || s === 'Pendulum Wave' || s === 'Hyperbolic Wings' || s === 'Catenary Arch' || s === 'Fourier Epicycles';
  }

  private isMirrorFamily(s: string): boolean {
    return s === 'center-bars' || s.startsWith('Mirror') || s.startsWith('Dual');
  }

  private isNCSFamily(s: string): boolean {
    return s.startsWith('NCS') || s.startsWith('Jonten');
  }

  private isScientificFamily(s: string): boolean {
    return s === 'Mel Scale' || s === 'Bark Scale' || s === 'Discrete FFT' || s === 'A-Weight' || s.startsWith('Reflex') || s === 'Fade Peaks' || s.startsWith('Octave') || s === 'Chladni Plate' || s === 'Quantum Orbit' || s === 'Lorenz Chaos' || s === 'Clifford Attractor';
  }

  private isGeometricFamily(s: string): boolean {
    return s.startsWith('Spiral') || s === 'Galaxy Spiral' || s === 'DNA Helix' || s === 'Vortex' || s === 'Orbit Rings' || s === 'Deep Tunnel' || s === 'Hex Pulse' || s === 'Lissajous' || s === 'Spectrum Arc' || s === 'Neon Flower' || s === 'Warp Speed' || s === 'Diamond Lattice' || s === 'Cyber Grid' || s === 'Superformula' || s === 'Sine Sphere' || s === 'Hex Lattice' || s === 'Spirograph' || s === 'Tesseract 4D' || s === 'Torus Knot' || s === 'Superellipse' || s === 'Black Hole Accretion';
  }

  private isAvantGardeFamily(s: string): boolean {
    return s === 'Wormhole Lensing' || s === 'Magnetic Pulsar' || s === 'Julia Morph' || s === 'Barnsley Fern' || s === 'Double Pendulum' || s === 'Klein Bottle 4D' || s === 'Hopf Fibration' || s === 'Mobius Ribbon' || s === 'Sonoluminescence' || s === 'Lichtenberg Tree' || s === 'Rubens Soundtube';
  }

  // 1. Bars Family Renderer
  private renderBars(
    ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
    width: number,
    height: number,
    posX: number,
    posY: number,
    scale: number,
    scaleFactor: number,
    config: SpectrumConfig,
    freqData: Uint8Array | Float32Array,
    count: number,
    multiplier: number,
    style: string
  ) {
    const totalWidth = width * 0.72 * (config.scale ?? 1.0);
    const startX = posX - totalWidth / 2;
    const isThin = style === 'Bars Thin';
    const isDense = style === 'Bars Dense';
    const isFat = style === 'Bars Fat';
    const gap = isDense ? 1.5 * scaleFactor : (isThin ? 5 * scaleFactor : (isFat ? 2 * scaleFactor : 3.5 * scaleFactor));
    const barWidth = isThin 
      ? Math.max(1.5 * scaleFactor, 2.5 * scaleFactor)
      : Math.max(2 * scaleFactor, totalWidth / count - gap);
    const isRound = style === 'Bars Round' || isFat;
    const isOutline = style === 'Outline';
    const isAlpha = style === 'Alpha Bars';
    const isMatrix = style === 'Matrix Rain';
    const isLumi = style === 'Lumi Bars';
    const isLevelColor = style === 'Bar Level Color';
    const isIndexColor = style === 'Bar Index Color';
    const isStandardBars = !isMatrix && !isLumi && !isLevelColor && !isIndexColor;
    const time = Date.now() * 0.003;

    // Fast Single Shared Gradient (created once per frame for standard bars, not 64-128x per frame)
    let sharedGrad: CanvasGradient | null = null;
    if (isStandardBars) {
      const maxH = Math.max(10, config.height * scale * multiplier);
      sharedGrad = ctx.createLinearGradient(0, posY, 0, posY - maxH);
      sharedGrad.addColorStop(0, config.color);
      sharedGrad.addColorStop(1, config.secondaryColor);
    }

    for (let i = 0; i < count; i++) {
      let rawVal = freqData[i] / 255;
      
      // Octave Bars: logarithmic octave frequency grouping formula
      if (style === 'Octave Bars') {
        const oct = Math.pow(2, (i / count) * 4);
        const idx = Math.min(count - 1, Math.floor((oct / 16) * count));
        rawVal = (freqData[idx] || 0) / 255;
      }

      const barHeight = Math.max(4 * scaleFactor, rawVal * config.height * scale * multiplier);
      const x = startX + i * (barWidth + gap);
      const y = posY - barHeight;

      if (isMatrix) {
        // Matrix Rain EQ: discrete dropping phosphor glyph blocks
        const blocks = 10;
        const blockH = barHeight / blocks;
        const dropOffset = Math.floor((time * 8 + i * 3) % blocks);
        for (let b = 0; b < blocks; b++) {
          const by = posY - (b + 1) * blockH;
          const isDrop = b === dropOffset;
          ctx.fillStyle = isDrop ? '#ffffff' : (b % 2 === 0 ? '#22c55e' : '#15803d');
          ctx.fillRect(x, by, barWidth, blockH - 1.5 * scaleFactor);
        }
        continue;
      }

      // Color computation without allocating gradients inside loop
      let fillColor: string | CanvasGradient = config.color;
      if (isLevelColor) {
        fillColor = rawVal > 0.75 ? config.secondaryColor : config.color;
      } else if (isIndexColor) {
        fillColor = i % 2 === 0 ? config.color : config.secondaryColor;
      } else if (isLumi) {
        const lum = Math.floor(rawVal * 255);
        fillColor = `rgba(${lum}, 245, 255, ${0.4 + rawVal * 0.6})`;
      } else if (sharedGrad) {
        fillColor = sharedGrad;
      }

      ctx.fillStyle = fillColor;

      if (isAlpha) {
        ctx.globalAlpha = config.opacity * (0.2 + rawVal * 0.8);
      }

      if (isOutline) {
        ctx.strokeStyle = typeof fillColor === 'string' ? fillColor : config.color;
        ctx.lineWidth = Math.max(1.5 * scaleFactor, 2 * scaleFactor);
        ctx.strokeRect(x, y, barWidth, barHeight);
      } else if (isRound && typeof ctx.roundRect === 'function') {
        ctx.beginPath();
        ctx.roundRect(x, y, barWidth, barHeight, [barWidth / 2, barWidth / 2, 0, 0]);
        ctx.fill();
      } else {
        ctx.fillRect(x, y, barWidth, barHeight);
      }

      // Peak dots for Bars Peak Neon
      if (style === 'Bars Peak Neon') {
        ctx.fillStyle = config.secondaryColor;
        ctx.fillRect(x, y - 6 * scaleFactor, barWidth, 3 * scaleFactor);
      }
    }
  }

  // 2. LED Family Renderer
  private renderLED(
    ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
    width: number,
    height: number,
    posX: number,
    posY: number,
    scale: number,
    scaleFactor: number,
    config: SpectrumConfig,
    freqData: Uint8Array | Float32Array,
    count: number,
    beatFactor: number,
    multiplier: number,
    style: string
  ) {
    const totalWidth = width * 0.75 * (config.scale ?? 1.0);
    const startX = posX - totalWidth / 2;
    const barWidth = Math.max(3 * scaleFactor, totalWidth / count - (3 * scaleFactor));
    const totalBlocks = 16;
    const blockGap = 2.5 * scaleFactor;
    const blockHeight = (config.height * scale * 0.8) / totalBlocks;
    const isMirror = style === 'LED Mirror';
    const isPrism = style === 'LED Prism';
    const isFire = style === 'LED Fire';
    const isGalaxy = style === 'LED Galaxy';
    const isDigitalEq = style === 'digital-eq';

    for (let i = 0; i < count; i++) {
      const val = freqData[i] / 255;
      const litBlocks = Math.round(val * totalBlocks * (config.followBeat ? 1 + (beatFactor - 1) * 0.3 : 1.0));
      const x = startX + i * (barWidth + (3 * scaleFactor));

      for (let b = 0; b < totalBlocks; b++) {
        const y = isMirror 
          ? posY + (b % 2 === 0 ? 1 : -1) * (Math.floor(b / 2) + 1) * (blockHeight + blockGap)
          : posY - (b + 1) * (blockHeight + blockGap);
        const isLit = b < litBlocks;

        if (isLit) {
          const ratio = b / totalBlocks;
          if (isPrism) {
            ctx.fillStyle = PRISM_PALETTE[Math.floor(ratio * PRISM_PALETTE.length)] || config.color;
          } else if (isFire) {
            ctx.fillStyle = FIRE_PALETTE[Math.floor(ratio * FIRE_PALETTE.length)] || config.secondaryColor;
          } else if (isGalaxy) {
            ctx.fillStyle = GALAXY_PALETTE[Math.floor(ratio * GALAXY_PALETTE.length)] || config.color;
          } else if (isDigitalEq) {
            // Classic studio VU meter: Green -> Yellow -> Red
            ctx.fillStyle = ratio > 0.85 ? '#ef4444' : (ratio > 0.65 ? '#eab308' : '#22c55e');
          } else {
            ctx.fillStyle = ratio > 0.75 ? config.secondaryColor : config.color;
          }
          ctx.globalAlpha = config.opacity;
        } else {
          ctx.fillStyle = '#1e1e24';
          ctx.globalAlpha = config.opacity * 0.18;
        }

        if (typeof ctx.roundRect === 'function') {
          ctx.beginPath();
          ctx.roundRect(x, y, barWidth, blockHeight, 1.5 * scaleFactor);
          ctx.fill();
        } else {
          ctx.fillRect(x, y, barWidth, blockHeight);
        }
      }
    }
  }

  // 3. Radial Family Renderer
  private renderRadial(
    ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
    width: number,
    height: number,
    posX: number,
    posY: number,
    scale: number,
    scaleFactor: number,
    config: SpectrumConfig,
    freqData: Uint8Array | Float32Array,
    count: number,
    beatFactor: number,
    multiplier: number,
    style: string
  ) {
    const baseRadius = config.radius * scale * (config.followBeat ? 1 + (beatFactor - 1) * 0.08 : 1.0);
    const angleStep = (Math.PI * 2) / count;
    const isSpin = style === 'Radial Spin';
    const isInvert = style === 'Radial Invert';
    const isDots = style === 'dots-ring';
    const isPulse = style === 'pulse-rings';
    const isDual = style === 'Radial Dual';
    const isRadialLED = style === 'Radial LED';
    const isOutline = style === 'Radial Outline';
    const isDoubleCircular = style === 'double-circular';
    const spinOffset = isSpin ? (Date.now() * 0.001) % (Math.PI * 2) : 0;
    const time = Date.now() * 0.002;

    if (style === 'Cardioid Heart') {
      // Cardioid heart curve: r = a(1 - sin(theta))
      ctx.beginPath();
      ctx.strokeStyle = config.color;
      ctx.lineWidth = 3 * scaleFactor;
      for (let i = 0; i < count; i++) {
        const theta = (i / count) * Math.PI * 2;
        const val = freqData[i] / 255;
        const heartR = (baseRadius * 0.7 * (1 - Math.sin(theta)) + val * 45 * scale) * multiplier;
        const x = posX + Math.cos(theta) * heartR;
        const y = posY - Math.sin(theta) * heartR;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.stroke();
      return;
    }

    if (style === 'Astroid Star') {
      // Astroid hypocycloid: x = a cos^3(t), y = a sin^3(t)
      ctx.beginPath();
      ctx.strokeStyle = config.secondaryColor;
      ctx.lineWidth = 2.5 * scaleFactor;
      for (let i = 0; i < count; i++) {
        const t = (i / count) * Math.PI * 2;
        const val = freqData[i] / 255;
        const r = (baseRadius * 1.2 + val * 50 * scale) * multiplier;
        const cosT = Math.cos(t);
        const sinT = Math.sin(t);
        const x = posX + (cosT * cosT * cosT) * r;
        const y = posY + (sinT * sinT * sinT) * r;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.stroke();
      return;
    }

    if (style === 'Infinity Loop') {
      // Bernoulli lemniscate: (x^2 + y^2)^2 = 2a^2(x^2 - y^2)
      ctx.beginPath();
      ctx.strokeStyle = config.color;
      ctx.lineWidth = 3 * scaleFactor;
      const a = baseRadius * 1.3 * multiplier;
      for (let i = 0; i <= count; i++) {
        const t = (i / count) * Math.PI * 2;
        const val = freqData[i % count] / 255;
        const denom = 1 + Math.sin(t) * Math.sin(t);
        const scaleMod = 1 + val * 0.4;
        const x = posX + ((a * Math.cos(t)) / denom) * scaleMod;
        const y = posY + ((a * Math.sin(t) * Math.cos(t)) / denom) * scaleMod;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
      return;
    }

    if (style === 'Phyllotaxis') {
      // Golden angle spiral phyllotaxis
      const goldenAngle = 137.5 * (Math.PI / 180);
      for (let i = 0; i < count; i++) {
        const val = freqData[i] / 255;
        const ang = i * goldenAngle + time;
        const dist = Math.sqrt(i) * 16 * scale * (1 + val * 0.35 * multiplier);
        const x = posX + Math.cos(ang) * dist;
        const y = posY + Math.sin(ang) * dist;
        ctx.fillStyle = i % 2 === 0 ? config.color : config.secondaryColor;
        ctx.beginPath();
        ctx.arc(x, y, Math.max(2 * scaleFactor, (2 + val * 4.5) * scaleFactor), 0, Math.PI * 2);
        ctx.fill();
      }
      return;
    }

    if (style === 'Maurer Rose') {
      // Maurer rose connecting vertices of a rose curve
      const n = 6;
      const d = 71;
      ctx.beginPath();
      ctx.strokeStyle = config.color;
      ctx.lineWidth = 1.5 * scaleFactor;
      for (let i = 0; i < count; i++) {
        const k = (i * d) * (Math.PI / 180);
        const val = freqData[i % count] / 255;
        const r = (baseRadius * Math.sin(n * k) + val * 35 * scale) * multiplier;
        const x = posX + Math.cos(k) * r;
        const y = posY + Math.sin(k) * r;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
      return;
    }

    if (style === 'Butterfly Curve') {
      // Temple Fay Butterfly curve
      ctx.beginPath();
      ctx.strokeStyle = config.secondaryColor;
      ctx.lineWidth = 2 * scaleFactor;
      for (let i = 0; i <= count; i++) {
        const t = (i / count) * Math.PI * 24;
        const val = freqData[i % count] / 255;
        const r = (Math.exp(Math.cos(t)) - 2 * Math.cos(4 * t) - Math.pow(Math.sin(t / 12), 5)) * baseRadius * 0.35 * (1 + val * 0.4 * multiplier);
        const x = posX + Math.sin(t) * r;
        const y = posY - Math.cos(t) * r;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
      return;
    }

    if (style === 'Epicycloid Gear') {
      // Epicycloid cog gear
      const k = 7;
      ctx.beginPath();
      ctx.strokeStyle = config.color;
      ctx.lineWidth = 2.5 * scaleFactor;
      for (let i = 0; i <= count; i++) {
        const t = (i / count) * Math.PI * 2;
        const val = freqData[i % count] / 255;
        const r = (baseRadius * 0.8 + (Math.sin(k * t) > 0 ? 1 : -1) * (15 * scale + val * 25 * scale)) * multiplier;
        const x = posX + Math.cos(t + time) * r;
        const y = posY + Math.sin(t + time) * r;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.stroke();
      return;
    }

    if (style === 'Hypotrochoid') {
      // Hypotrochoid roulette curve: R=5, r=3, d=5
      const R = baseRadius * 0.65;
      const r = R * 0.6;
      const d = R * 0.85;
      ctx.beginPath();
      ctx.strokeStyle = config.secondaryColor;
      ctx.lineWidth = 2 * scaleFactor;
      const steps = Math.min(250, count * 2);
      for (let i = 0; i <= steps; i++) {
        const theta = (i / steps) * Math.PI * 6 + time;
        const val = (freqData[i % count] || 0) / 255;
        const dist = d * (1 + val * 0.5 * multiplier);
        const x = posX + (R - r) * Math.cos(theta) + dist * Math.cos(((R - r) / r) * theta);
        const y = posY + (R - r) * Math.sin(theta) - dist * Math.sin(((R - r) / r) * theta);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
      return;
    }

    if (style === 'Involute Spiral') {
      // Involute of circle: x = a(cos t + t sin t), y = a(sin t - t cos t)
      const a = (baseRadius * 0.12) * multiplier;
      ctx.beginPath();
      ctx.strokeStyle = config.color;
      ctx.lineWidth = 2 * scaleFactor;
      const maxT = Math.PI * 5;
      for (let i = 0; i < count; i++) {
        const t = (i / count) * maxT;
        const val = freqData[i] / 255;
        const curA = a * (1 + val * 0.4);
        const x = posX + curA * (Math.cos(t + time) + t * Math.sin(t + time));
        const y = posY + curA * (Math.sin(t + time) - t * Math.cos(t + time));
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
      return;
    }

    if (isPulse) {
      const avgBass = ((freqData[0] || 0) + (freqData[1] || 0) + (freqData[2] || 0)) / (3 * 255);
      const ringCount = 6;
      for (let r = 0; r < ringCount; r++) {
        const ringProg = (r + 1) / ringCount;
        const curR = (baseRadius * 0.5 + ringProg * config.height * 0.8) * (1 + avgBass * 0.35 * multiplier);
        ctx.strokeStyle = r % 2 === 0 ? config.color : config.secondaryColor;
        ctx.lineWidth = Math.max(1.5 * scaleFactor, (4 - r * 0.5) * scaleFactor);
        ctx.globalAlpha = config.opacity * (1 - ringProg * 0.65);
        ctx.beginPath();
        ctx.arc(posX, posY, curR, 0, Math.PI * 2);
        ctx.stroke();
      }
      return;
    }

    if (isDoubleCircular) {
      // Inner circle and outer circle counter-rotating
      const half = Math.floor(count / 2);
      ctx.lineWidth = 2.5 * scaleFactor;
      ctx.lineCap = 'round';
      for (let i = 0; i < half; i++) {
        const val = freqData[i] / 255;
        const h = Math.max(3 * scaleFactor, val * config.height * 0.6 * scale * multiplier);
        const ang = (i / half) * Math.PI * 2;

        // Inner circle
        const rIn = baseRadius * 0.6;
        ctx.strokeStyle = config.color;
        ctx.beginPath();
        ctx.moveTo(posX + Math.cos(ang) * rIn, posY + Math.sin(ang) * rIn);
        ctx.lineTo(posX + Math.cos(ang) * (rIn + h), posY + Math.sin(ang) * (rIn + h));
        ctx.stroke();

        // Outer circle
        const rOut = baseRadius * 1.1;
        ctx.strokeStyle = config.secondaryColor;
        ctx.beginPath();
        ctx.moveTo(posX + Math.cos(-ang) * rOut, posY + Math.sin(-ang) * rOut);
        ctx.lineTo(posX + Math.cos(-ang) * (rOut + h), posY + Math.sin(-ang) * (rOut + h));
        ctx.stroke();
      }
      return;
    }

    if (isDual || isRadialLED || isDots || isOutline) {
      for (let i = 0; i < count; i++) {
        const val = freqData[i] / 255;
        const barHeight = Math.max(3 * scaleFactor, val * config.height * scale * multiplier);
        const angle = i * angleStep + spinOffset;
        const dir = isInvert ? -1 : 1;

        if (isDual) {
          // Dual inward and outward ray
          const xOut = posX + Math.cos(angle) * (baseRadius + barHeight);
          const yOut = posY + Math.sin(angle) * (baseRadius + barHeight);
          const xIn = posX + Math.cos(angle) * Math.max(5, baseRadius - barHeight * 0.5);
          const yIn = posY + Math.sin(angle) * Math.max(5, baseRadius - barHeight * 0.5);
          ctx.strokeStyle = i % 2 === 0 ? config.color : config.secondaryColor;
          ctx.lineWidth = Math.max(2 * scaleFactor, 3 * scaleFactor);
          ctx.beginPath();
          ctx.moveTo(xIn, yIn);
          ctx.lineTo(xOut, yOut);
          ctx.stroke();
        } else if (isRadialLED) {
          // Segmented LED radial dots along each ray
          const segments = 6;
          const litSegs = Math.round(val * segments);
          for (let s = 1; s <= segments; s++) {
            const r = baseRadius + (s / segments) * barHeight;
            const x = posX + Math.cos(angle) * r;
            const y = posY + Math.sin(angle) * r;
            ctx.fillStyle = s <= litSegs ? (s > 4 ? config.secondaryColor : config.color) : 'rgba(30,30,36,0.3)';
            ctx.beginPath();
            ctx.arc(x, y, 2 * scaleFactor, 0, Math.PI * 2);
            ctx.fill();
          }
        } else if (isDots) {
          const x2 = posX + Math.cos(angle) * (baseRadius + dir * barHeight);
          const y2 = posY + Math.sin(angle) * (baseRadius + dir * barHeight);
          ctx.fillStyle = i % 2 === 0 ? config.color : config.secondaryColor;
          ctx.beginPath();
          ctx.arc(x2, y2, Math.max(2 * scaleFactor, (2 + val * 5) * scaleFactor), 0, Math.PI * 2);
          ctx.fill();
        } else if (isOutline) {
          // Hollow arc outline bounding the peak
          const x1 = posX + Math.cos(angle) * baseRadius;
          const y1 = posY + Math.sin(angle) * baseRadius;
          const x2 = posX + Math.cos(angle) * (baseRadius + dir * barHeight);
          const y2 = posY + Math.sin(angle) * (baseRadius + dir * barHeight);
          ctx.strokeStyle = config.color;
          ctx.lineWidth = 1.5 * scaleFactor;
          ctx.strokeRect(x2 - 2 * scaleFactor, y2 - 2 * scaleFactor, 4 * scaleFactor, 4 * scaleFactor);
          ctx.beginPath();
          ctx.moveTo(x1, y1);
          ctx.lineTo(x2, y2);
          ctx.stroke();
        }
      }
      return;
    }

    // High-performance Path Batching for standard radial bars (2 draw calls instead of count draw calls)
    if (!isDual && !isRadialLED && !isDots && !isOutline) {
      const lineWidth = Math.max(2 * scaleFactor, (Math.PI * 2 * baseRadius) / count - (2 * scaleFactor));
      const dir = isInvert ? -1 : 1;
      ctx.lineWidth = lineWidth;
      ctx.lineCap = 'round';

      // Pass 1: Even bars (primary color)
      ctx.beginPath();
      ctx.strokeStyle = config.color;
      for (let i = 0; i < count; i += 2) {
        const val = freqData[i] / 255;
        const barHeight = Math.max(3 * scaleFactor, val * config.height * scale * multiplier);
        const angle = i * angleStep + spinOffset;
        const x1 = posX + Math.cos(angle) * baseRadius;
        const y1 = posY + Math.sin(angle) * baseRadius;
        const x2 = posX + Math.cos(angle) * (baseRadius + dir * barHeight);
        const y2 = posY + Math.sin(angle) * (baseRadius + dir * barHeight);
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
      }
      ctx.stroke();

      // Pass 2: Odd bars (secondary color)
      ctx.beginPath();
      ctx.strokeStyle = config.secondaryColor;
      for (let i = 1; i < count; i += 2) {
        const val = freqData[i] / 255;
        const barHeight = Math.max(3 * scaleFactor, val * config.height * scale * multiplier);
        const angle = i * angleStep + spinOffset;
        const x1 = posX + Math.cos(angle) * baseRadius;
        const y1 = posY + Math.sin(angle) * baseRadius;
        const x2 = posX + Math.cos(angle) * (baseRadius + dir * barHeight);
        const y2 = posY + Math.sin(angle) * (baseRadius + dir * barHeight);
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
      }
      ctx.stroke();
    }
  }

  // 4. Wave & Graph Family Renderer
  private renderWave(
    ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
    width: number,
    height: number,
    posX: number,
    posY: number,
    scale: number,
    scaleFactor: number,
    config: SpectrumConfig,
    freqData: Uint8Array | Float32Array,
    count: number,
    multiplier: number,
    style: string
  ) {
    const totalWidth = width * 0.78 * (config.scale ?? 1.0);
    const startX = posX - totalWidth / 2;
    const stepX = totalWidth / Math.max(1, count - 1);
    const isThin = style === 'Graph Thin';
    const isMirror = style === 'Wave Mirror';
    const isNeonWave = style === 'neon-wave';
    const isAsapWave = style === 'Asap Wave';
    const isRipple = style === 'Ripple Waves';
    const time = Date.now() * 0.003;

    if (style === 'Harmonograph') {
      // 2-pendulum harmonograph figure
      ctx.beginPath();
      ctx.strokeStyle = config.color;
      ctx.lineWidth = 2 * scaleFactor;
      const f1 = 2, f2 = 3;
      for (let i = 0; i < count; i++) {
        const val = freqData[i] / 255;
        const t = (i / count) * Math.PI * 4 + time;
        const amp = (totalWidth * 0.4 + val * 40 * scale) * multiplier;
        const x = posX + Math.sin(f1 * t) * amp;
        const y = posY + Math.sin(f2 * t + Math.PI / 3) * (amp * 0.6);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
      return;
    }

    if (style === 'Pendulum Wave') {
      // Array of uncoupled pendulums with progressing natural frequencies
      for (let i = 0; i < count; i++) {
        const val = freqData[i] / 255;
        const freq = 1.0 + (i / count) * 1.5;
        const angle = Math.sin(time * freq) * (0.6 + val * 0.5 * multiplier);
        const len = 60 * scale + (i / count) * 40 * scale;
        const xTop = startX + i * stepX;
        const yTop = posY - 40 * scaleFactor;
        const xBob = xTop + Math.sin(angle) * len;
        const yBob = yTop + Math.cos(angle) * len;

        ctx.strokeStyle = 'rgba(255,255,255,0.2)';
        ctx.lineWidth = 1 * scaleFactor;
        ctx.beginPath();
        ctx.moveTo(xTop, yTop);
        ctx.lineTo(xBob, yBob);
        ctx.stroke();

        ctx.fillStyle = i % 2 === 0 ? config.color : config.secondaryColor;
        ctx.beginPath();
        ctx.arc(xBob, yBob, Math.max(2 * scaleFactor, (2.5 + val * 4) * scaleFactor), 0, Math.PI * 2);
        ctx.fill();
      }
      return;
    }

    if (style === 'Hyperbolic Wings') {
      // Twin hyperbolic asymptotic curves opening outward
      ctx.lineWidth = 2.5 * scaleFactor;
      for (let side = -1; side <= 1; side += 2) {
        ctx.strokeStyle = side === -1 ? config.color : config.secondaryColor;
        ctx.beginPath();
        for (let i = 0; i < count; i++) {
          const val = freqData[i] / 255;
          const u = (i / count) * 2 - 1; // -1 .. 1
          const x = posX + side * (Math.cosh(u * 1.5) * 50 * scale + val * 40 * scale * multiplier);
          const y = posY + Math.sinh(u * 1.5) * 60 * scale;
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
      return;
    }

    if (style === 'Catenary Arch') {
      // Hanging catenary curve y = a * cosh(x/a) inverted into an acoustic arch
      const a = (totalWidth * 0.28) * (config.scale ?? 1.0);
      ctx.beginPath();
      ctx.strokeStyle = config.color;
      ctx.lineWidth = 3 * scaleFactor;
      for (let i = 0; i < count; i++) {
        const val = freqData[i] / 255;
        const xOffset = ((i / (count - 1)) - 0.5) * totalWidth;
        const catY = a * (Math.cosh(xOffset / a) - 1);
        const y = posY + catY * 0.45 - val * config.height * 0.7 * scale * multiplier;
        const x = posX + xOffset;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
      return;
    }

    if (style === 'Fourier Epicycles') {
      // Nested rotating Fourier epicycles drawing an audio harmonic curve
      ctx.lineWidth = 2 * scaleFactor;
      const harmonics = 4;
      ctx.beginPath();
      ctx.strokeStyle = config.secondaryColor;
      for (let i = 0; i < count; i++) {
        const val = freqData[i] / 255;
        const theta = (i / count) * Math.PI * 2;
        let curX = posX + ((i / count) - 0.5) * totalWidth;
        let curY = posY;
        for (let h = 1; h <= harmonics; h++) {
          const hVal = (freqData[(i * h) % count] || 0) / 255;
          const hAmp = (25 * scale / h + hVal * 20 * scale) * multiplier;
          curX += Math.cos(theta * h + time * h) * (hAmp * 0.4);
          curY += Math.sin(theta * h + time * h) * hAmp;
        }
        if (i === 0) ctx.moveTo(curX, curY);
        else ctx.lineTo(curX, curY);
      }
      ctx.stroke();
      return;
    }

    if (isRipple) {
      // Concentric expanding ripple waves modulated by frequencies
      ctx.lineWidth = 2 * scaleFactor;
      for (let w = 1; w <= 5; w++) {
        const val = (freqData[w * 3 % count] || 0) / 255;
        const r = (w * 28 * scale + Math.sin(time * 2 + w) * 8 * scale) * (1 + val * 0.5 * multiplier);
        ctx.strokeStyle = w % 2 === 0 ? config.color : config.secondaryColor;
        ctx.globalAlpha = config.opacity * (1 - w * 0.16);
        ctx.beginPath();
        ctx.arc(posX, posY, r, 0, Math.PI * 2);
        ctx.stroke();
      }
      return;
    }

    if (isAsapWave) {
      // Turbulent multi-harmonic wave with phase modulation
      ctx.beginPath();
      ctx.strokeStyle = config.color;
      ctx.lineWidth = 3 * scaleFactor;
      for (let i = 0; i < count; i++) {
        const val = freqData[i] / 255;
        const wave1 = Math.sin(i * 0.15 + time) * 20 * scaleFactor;
        const wave2 = Math.sin(i * 0.3 - time * 1.5) * 12 * scaleFactor;
        const h = val * config.height * scale * multiplier + wave1 + wave2;
        const x = startX + i * stepX;
        const y = posY - h;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
      return;
    }

    // Standard waveform / Graph Thin / Neon Wave / Wave Mirror
    ctx.beginPath();
    ctx.strokeStyle = config.color;
    ctx.lineWidth = isThin ? 1.5 * scaleFactor : (isNeonWave ? 5 * scaleFactor : 3.5 * scaleFactor * multiplier);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    for (let i = 0; i < count; i++) {
      const val = (freqData[i] / 255);
      const h = val * config.height * scale * multiplier;
      const x = startX + i * stepX;
      const y = posY - h;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    if (isMirror) {
      ctx.beginPath();
      ctx.strokeStyle = config.secondaryColor;
      for (let i = 0; i < count; i++) {
        const val = (freqData[i] / 255);
        const h = val * config.height * scale * multiplier;
        const x = startX + i * stepX;
        const y = posY + h;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
  }

  // 5. Mirror & Dual Family Renderer
  private renderMirror(
    ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
    width: number,
    height: number,
    posX: number,
    posY: number,
    scale: number,
    scaleFactor: number,
    config: SpectrumConfig,
    freqData: Uint8Array | Float32Array,
    count: number,
    multiplier: number,
    style: string
  ) {
    const totalWidth = width * 0.75 * (config.scale ?? 1.0);
    const startX = posX - totalWidth / 2;
    const barWidth = Math.max(2.5 * scaleFactor, totalWidth / count - (3 * scaleFactor));
    const isDualH = style === 'Dual Horizontal';
    const isDualV = style === 'Dual Vertical';
    const isDualOverlay = style === 'Dual Overlay';
    const isMirrorOuter = style === 'Mirror Outer';

    if (isDualOverlay) {
      // Dual layer overlapping bars with cross-blended opacity
      for (let i = 0; i < count; i++) {
        const val = freqData[i] / 255;
        const h1 = Math.max(3 * scaleFactor, val * config.height * scale * multiplier);
        const h2 = Math.max(3 * scaleFactor, (freqData[count - 1 - i] / 255) * config.height * scale * multiplier);
        const x = startX + i * (barWidth + 3 * scaleFactor);

        ctx.fillStyle = config.color;
        ctx.globalAlpha = config.opacity * 0.65;
        ctx.fillRect(x, posY - h1, barWidth, h1);

        ctx.fillStyle = config.secondaryColor;
        ctx.globalAlpha = config.opacity * 0.65;
        ctx.fillRect(x + 2 * scaleFactor, posY - h2, barWidth, h2);
      }
      return;
    }

    if (isMirrorOuter) {
      // Mirror radiating outward from center to left and right edges
      const half = Math.floor(count / 2);
      const halfW = totalWidth / 2;
      for (let i = 0; i < half; i++) {
        const val = freqData[i] / 255;
        const h = Math.max(3 * scaleFactor, val * config.height * scale * multiplier);
        const xLeft = posX - (i / half) * halfW;
        const xRight = posX + (i / half) * halfW;

        ctx.fillStyle = config.color;
        ctx.fillRect(xLeft, posY - h, barWidth, h);
        ctx.fillStyle = config.secondaryColor;
        ctx.fillRect(xRight, posY - h, barWidth, h);
      }
      return;
    }

    for (let i = 0; i < count; i++) {
      const val = freqData[i] / 255;
      const halfH = Math.max(3 * scaleFactor, val * config.height * 0.55 * scale * multiplier);
      const x = startX + i * (barWidth + 3 * scaleFactor);

      if (isDualH) {
        // Horizontal left-right mirrors with opposing polarity
        ctx.fillStyle = config.color;
        ctx.fillRect(posX - (i + 1) * (barWidth + 2), posY - halfH, barWidth, halfH * 2);
        ctx.fillStyle = config.secondaryColor;
        ctx.fillRect(posX + i * (barWidth + 2), posY - halfH, barWidth, halfH * 2);
      } else if (isDualV) {
        // Top and bottom dual separated stacks
        ctx.fillStyle = config.color;
        ctx.fillRect(x, posY - halfH - 8 * scaleFactor, barWidth, halfH);
        ctx.fillStyle = config.secondaryColor;
        ctx.fillRect(x, posY + 8 * scaleFactor, barWidth, halfH);
      } else {
        // Center mirror top-down (center-bars)
        // Pass 1: Top half bars
        ctx.fillStyle = config.color;
        for (let j = 0; j < count; j++) {
          const v = freqData[j] / 255;
          const h = Math.max(3 * scaleFactor, v * config.height * 0.55 * scale * multiplier);
          const barX = startX + j * (barWidth + 3 * scaleFactor);
          ctx.fillRect(barX, posY - h, barWidth, h);
        }
        // Pass 2: Bottom half bars
        ctx.fillStyle = config.secondaryColor;
        for (let j = 0; j < count; j++) {
          const v = freqData[j] / 255;
          const h = Math.max(3 * scaleFactor, v * config.height * 0.55 * scale * multiplier);
          const barX = startX + j * (barWidth + 3 * scaleFactor);
          ctx.fillRect(barX, posY, barWidth, h);
        }
        return;
      }
    }
  }

  // 6. NCS & EDM Signature Family
  private renderNCS(
    ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
    width: number,
    height: number,
    posX: number,
    posY: number,
    scale: number,
    scaleFactor: number,
    config: SpectrumConfig,
    freqData: Uint8Array | Float32Array,
    count: number,
    beatFactor: number,
    multiplier: number,
    style: string
  ) {
    const bassVal = (freqData[0] || 0) / 255;
    const circleRadius = (config.radius * scale) * (1 + bassVal * 0.25 * multiplier);
    const angleStep = (Math.PI * 2) / count;
    const time = Date.now() * 0.003;

    if (style === 'Jonten Spark') {
      // High-energy electric lightning sparks leaping from central circle
      ctx.fillStyle = '#0a0a10';
      ctx.beginPath();
      ctx.arc(posX, posY, circleRadius, 0, Math.PI * 2);
      ctx.fill();

      for (let i = 0; i < count; i += 2) {
        const val = freqData[i] / 255;
        const ang = i * angleStep;
        const sparkDist = circleRadius + val * config.height * 1.2 * scale * multiplier;
        const midR = circleRadius + (sparkDist - circleRadius) * 0.5;
        const jitterAng = ang + (Math.sin(time * 5 + i) * 0.15);

        ctx.strokeStyle = val > 0.5 ? '#ffffff' : config.secondaryColor;
        ctx.lineWidth = 1.5 * scaleFactor;
        ctx.beginPath();
        ctx.moveTo(posX + Math.cos(ang) * circleRadius, posY + Math.sin(ang) * circleRadius);
        ctx.lineTo(posX + Math.cos(jitterAng) * midR, posY + Math.sin(jitterAng) * midR);
        ctx.lineTo(posX + Math.cos(ang) * sparkDist, posY + Math.sin(ang) * sparkDist);
        ctx.stroke();
      }
      return;
    }

    if (style === 'Jonten Ring') {
      // Concentric neon resonant rings modulated by frequencies
      for (let r = 1; r <= 4; r++) {
        const val = (freqData[r * 4 % count] || 0) / 255;
        const curR = circleRadius * (0.5 + r * 0.35) * (1 + val * 0.2);
        ctx.strokeStyle = r % 2 === 0 ? config.color : config.secondaryColor;
        ctx.lineWidth = (3 - r * 0.5) * scaleFactor;
        ctx.beginPath();
        ctx.arc(posX, posY, curR, 0, Math.PI * 2);
        ctx.stroke();
      }
      return;
    }

    if (style === 'Jonten NFC') {
      // Hexagonal NFC tag geometric ring pulsing with audio
      ctx.beginPath();
      ctx.strokeStyle = config.secondaryColor;
      ctx.lineWidth = 3 * scaleFactor;
      for (let s = 0; s <= 6; s++) {
        const ang = (s / 6) * Math.PI * 2;
        const val = (freqData[s % count] || 0) / 255;
        const r = circleRadius * (1 + val * 0.35);
        const x = posX + Math.cos(ang) * r;
        const y = posY + Math.sin(ang) * r;
        if (s === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
      return;
    }

    if (style === 'NCS Pulse') {
      // Pulsating audio shockwaves radiating outward
      const pulseCount = 3;
      for (let p = 0; p < pulseCount; p++) {
        const prog = ((time * 0.8 + p / pulseCount) % 1.0);
        const r = circleRadius + prog * config.height * scale * multiplier;
        ctx.strokeStyle = config.color;
        ctx.globalAlpha = config.opacity * (1 - prog);
        ctx.lineWidth = (3 * (1 - prog) + 1) * scaleFactor;
        ctx.beginPath();
        ctx.arc(posX, posY, r, 0, Math.PI * 2);
        ctx.stroke();
      }
    }

    // Classic NCS / NCS Radial / NCS Mirror
    ctx.fillStyle = '#111118';
    ctx.strokeStyle = config.secondaryColor;
    ctx.lineWidth = 3 * scaleFactor;
    ctx.beginPath();
    ctx.arc(posX, posY, circleRadius, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    for (let i = 0; i < count; i++) {
      const val = freqData[i] / 255;
      const h = Math.max(4 * scaleFactor, val * config.height * scale * multiplier);
      const angle = i * angleStep;

      const x1 = posX + Math.cos(angle) * circleRadius;
      const y1 = posY + Math.sin(angle) * circleRadius;
      const x2 = posX + Math.cos(angle) * (circleRadius + h);
      const y2 = posY + Math.sin(angle) * (circleRadius + h);

      ctx.strokeStyle = i % 2 === 0 ? config.color : config.secondaryColor;
      ctx.lineWidth = Math.max(2.5 * scaleFactor, (Math.PI * 2 * circleRadius) / count - (2 * scaleFactor));
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();

      if (style === 'NCS Mirror') {
        // Internal inward spike
        const inH = Math.min(circleRadius * 0.45, h * 0.4);
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(posX + Math.cos(angle) * (circleRadius - inH), posY + Math.sin(angle) * (circleRadius - inH));
        ctx.stroke();
      }
    }
  }

  // 7. Scientific & Scales Family
  private renderScientific(
    ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
    width: number,
    height: number,
    posX: number,
    posY: number,
    scale: number,
    scaleFactor: number,
    config: SpectrumConfig,
    freqData: Uint8Array | Float32Array,
    count: number,
    multiplier: number,
    style: string
  ) {
    const totalWidth = width * 0.72 * (config.scale ?? 1.0);
    const startX = posX - totalWidth / 2;
    const barWidth = Math.max(2 * scaleFactor, totalWidth / count - (3 * scaleFactor));
    const time = Date.now() * 0.002;

    if (style === 'Chladni Plate') {
      // 2D Chladni resonance plate nodal lines: w = a sin(nx)sin(my) - b sin(mx)sin(ny)
      const n = 3, m = 5;
      const gridSteps = 16;
      const halfW = (config.radius * 2.2 * scale) / 2;
      ctx.fillStyle = config.color;
      for (let gx = 0; gx <= gridSteps; gx++) {
        for (let gy = 0; gy <= gridSteps; gy++) {
          const u = (gx / gridSteps) * Math.PI;
          const v = (gy / gridSteps) * Math.PI;
          const val = (freqData[(gx * 3 + gy) % count] || 0) / 255;
          const chladni = Math.sin(n * u) * Math.sin(m * v) - Math.sin(m * u) * Math.sin(n * v);
          if (Math.abs(chladni) < 0.35 + val * 0.2) {
            const px = posX - halfW + (gx / gridSteps) * halfW * 2;
            const py = posY - halfW + (gy / gridSteps) * halfW * 2;
            ctx.beginPath();
            ctx.arc(px, py, Math.max(1.5 * scaleFactor, 2.5 * scaleFactor), 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }
      return;
    }

    if (style === 'Quantum Orbit') {
      // Quantum orbital probability lobes (p-orbital & d-orbital harmonic shapes)
      const lobes = 4;
      ctx.lineWidth = 2 * scaleFactor;
      for (let l = 0; l < lobes; l++) {
        ctx.strokeStyle = l % 2 === 0 ? config.color : config.secondaryColor;
        ctx.beginPath();
        const baseAng = (l / lobes) * Math.PI * 2;
        for (let i = 0; i < Math.floor(count / lobes); i++) {
          const t = (i / Math.floor(count / lobes)) * Math.PI;
          const val = freqData[i] / 255;
          const r = Math.sin(t) * (config.radius * 1.4 * scale + val * 45 * scale * multiplier);
          const curAng = baseAng + (t - Math.PI / 2) * 0.5;
          const x = posX + Math.cos(curAng) * r;
          const y = posY + Math.sin(curAng) * r;
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
      return;
    }

    if (style === 'Lorenz Chaos') {
      // Lorenz strange attractor butterfly lobes
      let lx = 0.1, ly = 0, lz = 0;
      const dt = 0.012;
      const sigma = 10, rho = 28, beta = 8 / 3;
      ctx.beginPath();
      ctx.strokeStyle = config.secondaryColor;
      ctx.lineWidth = 1.5 * scaleFactor;
      const lorenzScale = 4.5 * scale * (1 + (freqData[0] || 0) / 512);

      for (let i = 0; i < count * 2; i++) {
        const dx = sigma * (ly - lx) * dt;
        const dy = (lx * (rho - lz) - ly) * dt;
        const dz = (lx * ly - beta * lz) * dt;
        lx += dx; ly += dy; lz += dz;

        const val = freqData[i % count] / 255;
        const px = posX + lx * lorenzScale + Math.sin(time + i * 0.05) * (val * 15 * scaleFactor);
        const py = posY + (lz - 25) * lorenzScale;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.stroke();
      return;
    }

    if (style === 'Clifford Attractor') {
      // Clifford chaotic fractal attractor: x_{n+1} = sin(a y) + c cos(a x), y_{n+1} = sin(b x) + d cos(b y)
      const a = -1.4, b = 1.6, c = 1.0, d = 0.7;
      let cx = 0.1, cy = 0.1;
      const cliffScale = config.radius * 0.5 * scale * multiplier;
      ctx.fillStyle = config.secondaryColor;
      for (let i = 0; i < count * 4; i++) {
        const nextX = Math.sin(a * cy) + c * Math.cos(a * cx);
        const nextY = Math.sin(b * cx) + d * Math.cos(b * cy);
        cx = nextX;
        cy = nextY;
        const val = (freqData[i % count] || 0) / 255;
        const px = posX + cx * cliffScale * (1 + val * 0.25);
        const py = posY + cy * cliffScale * (1 + val * 0.25);
        ctx.fillRect(px, py, 2 * scaleFactor, 2 * scaleFactor);
      }
      return;
    }

    for (let i = 0; i < count; i++) {
      // Frequency weighting mapping
      let weight = 1.0;
      if (style === 'Mel Scale') {
        weight = Math.log10(1 + (i / count) * 9);
      } else if (style === 'Bark Scale') {
        const z = (i / count) * 24;
        weight = ((26.81 * z) / (1960 + z)) - 0.53;
        weight = Math.max(0.2, Math.min(1.5, weight * 0.15 + 0.8));
      } else if (style === 'A-Weight') {
        // A-weighting curve approximation: human ear Fletcher-Munson midrange sensitivity
        weight = 0.4 + Math.sin((i / count) * Math.PI) * 0.8;
      } else if (style === 'Discrete FFT') {
        // Raw discrete FFT impulses with stem points
        weight = 1.0;
      }
      
      const val = Math.min(1.0, (freqData[i] / 255) * weight);
      const barHeight = Math.max(3 * scaleFactor, val * config.height * scale * multiplier);
      const x = startX + i * (barWidth + 3 * scaleFactor);

      if (style === 'Discrete FFT') {
        // Discrete stem lines with node heads
        ctx.strokeStyle = config.color;
        ctx.lineWidth = 1.5 * scaleFactor;
        ctx.beginPath();
        ctx.moveTo(x + barWidth / 2, posY);
        ctx.lineTo(x + barWidth / 2, posY - barHeight);
        ctx.stroke();

        ctx.fillStyle = config.secondaryColor;
        ctx.beginPath();
        ctx.arc(x + barWidth / 2, posY - barHeight, 3 * scaleFactor, 0, Math.PI * 2);
        ctx.fill();
        continue;
      }

      ctx.fillStyle = config.color;
      ctx.fillRect(x, posY - barHeight, barWidth, barHeight);

      // Reflex floor reflection
      if (style === 'Reflex Floor') {
        ctx.fillStyle = config.secondaryColor;
        ctx.globalAlpha = config.opacity * 0.32;
        ctx.fillRect(x, posY, barWidth, barHeight * 0.45);
        ctx.globalAlpha = config.opacity;
      }

      if (style === 'Fade Peaks') {
        // High-vis peak line
        ctx.fillStyle = config.secondaryColor;
        ctx.fillRect(x, posY - barHeight - 4 * scaleFactor, barWidth, 2 * scaleFactor);
      }
    }
  }

  // 8. Geometric & 3D Family
  private renderGeometric(
    ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
    width: number,
    height: number,
    posX: number,
    posY: number,
    scale: number,
    scaleFactor: number,
    config: SpectrumConfig,
    freqData: Uint8Array | Float32Array,
    count: number,
    beatFactor: number,
    multiplier: number,
    style: string
  ) {
    const time = Date.now() * 0.002;

    if (style === 'Superformula') {
      // Gielis Superformula: r = ( |cos(m*t/4)/a|^n2 + |sin(m*t/4)/b|^n3 )^(-1/n1)
      const m = 5, n1 = 0.5, n2 = 1.7, n3 = 1.7;
      ctx.beginPath();
      ctx.strokeStyle = config.color;
      ctx.lineWidth = 2.5 * scaleFactor;
      for (let i = 0; i <= count; i++) {
        const phi = (i / count) * Math.PI * 2;
        const val = freqData[i % count] / 255;
        const t1 = Math.pow(Math.abs(Math.cos(m * phi / 4)), n2);
        const t2 = Math.pow(Math.abs(Math.sin(m * phi / 4)), n3);
        const r = Math.pow(t1 + t2, -1 / n1) * (config.radius * 0.8 * scale + val * 40 * scale) * multiplier;
        const x = posX + Math.cos(phi + time) * r;
        const y = posY + Math.sin(phi + time) * r;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.stroke();
      return;
    }

    if (style === 'Sine Sphere') {
      // 3D wireframe sphere projection with longitudinal audio distortion
      const latLines = 6;
      ctx.lineWidth = 1.5 * scaleFactor;
      for (let lat = 1; lat <= latLines; lat++) {
        const phi = (lat / (latLines + 1)) * Math.PI;
        const rLat = Math.sin(phi) * config.radius * 1.3 * scale;
        const yLat = posY + Math.cos(phi) * config.radius * 0.8 * scale;
        ctx.strokeStyle = lat % 2 === 0 ? config.color : config.secondaryColor;
        ctx.beginPath();
        for (let i = 0; i <= count; i++) {
          const theta = (i / count) * Math.PI * 2;
          const val = (freqData[i % count] || 0) / 255;
          const curR = rLat * (1 + val * 0.3 * multiplier);
          const x = posX + Math.cos(theta + time) * curR;
          const y = yLat + Math.sin(theta + time) * (curR * 0.3);
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
      return;
    }

    if (style === 'Hex Lattice') {
      // Honeycomb hexagonal tessellation where each cell scale modulates with audio
      const hexR = 24 * scale;
      const cols = 7, rows = 5;
      const wStep = hexR * 1.732;
      const hStep = hexR * 1.5;
      const startHexX = posX - (cols / 2) * wStep;
      const startHexY = posY - (rows / 2) * hStep;

      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const idx = (r * cols + c) % count;
          const val = freqData[idx] / 255;
          const cx = startHexX + c * wStep + (r % 2 === 1 ? wStep / 2 : 0);
          const cy = startHexY + r * hStep;
          const curR = hexR * (0.4 + val * 0.6 * multiplier);

          ctx.strokeStyle = (r + c) % 2 === 0 ? config.color : config.secondaryColor;
          ctx.lineWidth = 1.5 * scaleFactor;
          ctx.beginPath();
          for (let s = 0; s <= 6; s++) {
            const a = (s / 6) * Math.PI * 2;
            const x = cx + Math.cos(a) * curR;
            const y = cy + Math.sin(a) * curR;
            if (s === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
          }
          ctx.stroke();
        }
      }
      return;
    }

    if (style === 'Spirograph') {
      // Hypotrochoid / Epitrochoid spirograph
      const R = config.radius * 1.2 * scale;
      const r = R * 0.38;
      const d = r * 1.4;
      ctx.beginPath();
      ctx.strokeStyle = config.secondaryColor;
      ctx.lineWidth = 2 * scaleFactor;
      for (let i = 0; i <= count * 2; i++) {
        const theta = (i / (count * 2)) * Math.PI * 16;
        const val = freqData[i % count] / 255;
        const curD = d * (1 + val * 0.5 * multiplier);
        const x = posX + (R - r) * Math.cos(theta + time) + curD * Math.cos(((R - r) / r) * (theta + time));
        const y = posY + (R - r) * Math.sin(theta + time) - curD * Math.sin(((R - r) / r) * (theta + time));
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
      return;
    }

    if (style === 'Tesseract 4D') {
      // 4D hypercube projected to 2D rotating on planes
      const sz1 = 40 * scale * multiplier;
      const sz2 = sz1 * (0.45 + (freqData[0] || 0) / 512);
      ctx.lineWidth = 2 * scaleFactor;

      // Outer cube
      ctx.strokeStyle = config.color;
      ctx.strokeRect(posX - sz1, posY - sz1, sz1 * 2, sz1 * 2);

      // Inner cube
      ctx.strokeStyle = config.secondaryColor;
      ctx.strokeRect(posX - sz2, posY - sz2, sz2 * 2, sz2 * 2);

      // 4D hyper-edges connecting 8 vertices
      ctx.strokeStyle = 'rgba(255,255,255,0.4)';
      ctx.lineWidth = 1 * scaleFactor;
      const corners = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
      for (const [cx, cy] of corners) {
        ctx.beginPath();
        ctx.moveTo(posX + cx * sz1, posY + cy * sz1);
        ctx.lineTo(posX + cx * sz2, posY + cy * sz2);
        ctx.stroke();
      }
      return;
    }

    if (style === 'Spiral') {
      // Archimedean spiral
      const angleStep = 0.15;
      ctx.beginPath();
      ctx.strokeStyle = config.color;
      ctx.lineWidth = 2.5 * scaleFactor;
      for (let i = 0; i < count; i++) {
        const val = freqData[i] / 255;
        const r = (i * 3.5 * scale + val * 35 * scale) * multiplier;
        const ang = i * angleStep;
        const x = posX + Math.cos(ang) * r;
        const y = posY + Math.sin(ang) * r;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    } else if (style === 'Galaxy Spiral') {
      // Dual-arm logarithmic galaxy spiral
      const arms = 2;
      ctx.lineWidth = 2 * scaleFactor;
      for (let a = 0; a < arms; a++) {
        ctx.strokeStyle = a === 0 ? config.color : config.secondaryColor;
        ctx.beginPath();
        for (let i = 0; i < count; i++) {
          const val = freqData[i] / 255;
          const theta = i * 0.12 + (a * Math.PI);
          const r = Math.exp(0.06 * i) * 12 * scale * (1 + val * 0.3 * multiplier);
          const x = posX + Math.cos(theta) * r;
          const y = posY + Math.sin(theta) * r;
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
    } else if (style === 'DNA Helix') {
      // Intertwined double helix strands with rungs
      const totalWidth = width * 0.72 * (config.scale ?? 1.0);
      const startX = posX - totalWidth / 2;
      const stepX = totalWidth / Math.max(1, count - 1);
      const time = Date.now() * 0.003;

      for (let i = 0; i < count; i++) {
        const val = freqData[i] / 255;
        const x = startX + i * stepX;
        const amp = (28 * scale + val * 55 * scale) * multiplier;
        const waveAngle = i * 0.28 + time;
        const y1 = posY + Math.sin(waveAngle) * amp;
        const y2 = posY - Math.sin(waveAngle) * amp;

        // Helix connecting rungs
        if (i % 3 === 0) {
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
          ctx.lineWidth = 1.5 * scaleFactor;
          ctx.beginPath();
          ctx.moveTo(x, y1);
          ctx.lineTo(x, y2);
          ctx.stroke();
        }

        // Nodes on strand 1 & 2
        ctx.fillStyle = config.color;
        ctx.beginPath();
        ctx.arc(x, y1, Math.max(2 * scaleFactor, (2 + val * 4) * scaleFactor), 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = config.secondaryColor;
        ctx.beginPath();
        ctx.arc(x, y2, Math.max(2 * scaleFactor, (2 + val * 4) * scaleFactor), 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (style === 'Lissajous') {
      // 3D Lissajous resonant figure
      ctx.beginPath();
      ctx.strokeStyle = config.color;
      ctx.lineWidth = 2.5 * scaleFactor;
      const a = 3;
      const b = 4;
      const time = Date.now() * 0.0015;
      const baseR = config.radius * 1.5 * scale * multiplier;

      for (let i = 0; i < count; i++) {
        const val = freqData[i] / 255;
        const t = (i / count) * Math.PI * 2 + time;
        const r = baseR * (1 + val * 0.4);
        const x = posX + Math.sin(a * t + Math.PI / 2) * r;
        const y = posY + Math.sin(b * t) * (r * 0.85);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.stroke();
    } else if (style === 'Neon Flower') {
      // Rose curve / flower petals modulated by audio
      const petals = 6;
      const time = Date.now() * 0.001;
      ctx.beginPath();
      ctx.strokeStyle = config.secondaryColor;
      ctx.lineWidth = 2.5 * scaleFactor;
      for (let theta = 0; theta <= Math.PI * 2; theta += 0.04) {
        const idx = Math.floor(((theta / (Math.PI * 2)) * count)) % count;
        const val = freqData[idx] / 255;
        const r = (config.radius * scale * Math.cos(petals * theta) + val * 60 * scale) * multiplier;
        const x = posX + Math.cos(theta + time) * Math.abs(r);
        const y = posY + Math.sin(theta + time) * Math.abs(r);
        if (theta === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.stroke();
    } else if (style === 'Warp Speed') {
      // 3D Starfield streaming outward powered by audio
      const time = Date.now() * 0.002;
      for (let i = 0; i < count; i++) {
        const val = freqData[i] / 255;
        const ang = (i / count) * Math.PI * 2 + Math.sin(i);
        const speed = 1.0 + val * 2.0 * multiplier;
        const dist = ((i * 17 + time * 120 * speed) % (config.radius * 2.5 * scale));
        const x = posX + Math.cos(ang) * dist;
        const y = posY + Math.sin(ang) * dist;
        const trailLen = Math.max(3 * scaleFactor, val * 25 * scaleFactor * multiplier);

        ctx.strokeStyle = i % 2 === 0 ? config.color : config.secondaryColor;
        ctx.lineWidth = Math.max(1.5 * scaleFactor, (1.5 + val * 2.5) * scaleFactor);
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + Math.cos(ang) * trailLen, y + Math.sin(ang) * trailLen);
        ctx.stroke();
      }
    } else if (style === 'Cyber Grid') {
      // Perspective synthwave horizon grid
      const gridW = width * 0.8 * (config.scale ?? 1.0);
      const startX = posX - gridW / 2;
      const lines = 12;
      ctx.strokeStyle = config.color;
      ctx.lineWidth = 1.5 * scaleFactor;

      // Perspective vertical ribs
      for (let i = 0; i <= lines; i++) {
        const val = (freqData[Math.floor((i / lines) * count)] || 0) / 255;
        const bottomX = startX + (i / lines) * gridW;
        const topX = posX + ((i / lines) - 0.5) * (gridW * 0.35);
        ctx.beginPath();
        ctx.moveTo(topX, posY - config.height * 0.2 * scale);
        ctx.lineTo(bottomX, posY + config.height * 0.6 * scale + val * 20 * scaleFactor);
        ctx.stroke();
      }
      // Horizontal cross rungs
      for (let j = 1; j <= 6; j++) {
        const frac = j / 6;
        const y = posY + (frac * frac) * config.height * 0.6 * scale;
        const curW = gridW * (0.35 + frac * 0.65);
        ctx.beginPath();
        ctx.moveTo(posX - curW / 2, y);
        ctx.lineTo(posX + curW / 2, y);
        ctx.stroke();
      }
    } else if (style === 'Spectrum Arc') {
      // Wide sweeping semicircle arc
      const arcRadius = config.radius * 1.3 * scale;
      const startAngle = Math.PI * 0.8;
      const endAngle = Math.PI * 2.2;
      const totalSweep = endAngle - startAngle;

      for (let i = 0; i < count; i++) {
        const val = freqData[i] / 255;
        const ang = startAngle + (i / count) * totalSweep;
        const h = Math.max(3 * scaleFactor, val * config.height * scale * multiplier);
        const x1 = posX + Math.cos(ang) * arcRadius;
        const y1 = posY + Math.sin(ang) * arcRadius;
        const x2 = posX + Math.cos(ang) * (arcRadius + h);
        const y2 = posY + Math.sin(ang) * (arcRadius + h);

        ctx.strokeStyle = i % 2 === 0 ? config.color : config.secondaryColor;
        ctx.lineWidth = Math.max(2 * scaleFactor, 3 * scaleFactor);
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
      }
    } else if (style === 'Orbit Rings') {
      // Orbital tilted ellipses rotating around center
      const rings = 4;
      const time = Date.now() * 0.001;
      for (let r = 1; r <= rings; r++) {
        const val = (freqData[r * 3 % count] || 0) / 255;
        const rx = (r * 35 * scale) * (1 + val * 0.3 * multiplier);
        const ry = rx * 0.45;
        const rot = time * 0.5 + (r * Math.PI / rings);

        ctx.save();
        ctx.translate(posX, posY);
        ctx.rotate(rot);
        ctx.strokeStyle = r % 2 === 0 ? config.color : config.secondaryColor;
        ctx.lineWidth = 2 * scaleFactor;
        ctx.beginPath();
        ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }
    } else if (style === 'Deep Tunnel') {
      // Rectangular 3D wireframe tunnel receding to infinity
      const depth = 8;
      const time = Date.now() * 0.002;
      for (let d = 1; d <= depth; d++) {
        const prog = ((d / depth) + time * 0.2) % 1.0;
        const val = (freqData[Math.floor(prog * count)] || 0) / 255;
        const sz = (prog * config.radius * 2.8 * scale) * (1 + val * 0.2 * multiplier);
        ctx.strokeStyle = d % 2 === 0 ? config.color : config.secondaryColor;
        ctx.lineWidth = 1.5 * scaleFactor;
        ctx.strokeRect(posX - sz / 2, posY - (sz * 0.6) / 2, sz, sz * 0.6);
      }
    } else if (style === 'Vortex') {
      // Swirling logarithmic spiral vortex
      const rings = 8;
      const time = Date.now() * 0.002;
      for (let r = 1; r <= rings; r++) {
        const val = (freqData[r % count] || 0) / 255;
        const rad = (r * 22 * scale) * (1 + val * 0.4 * multiplier);
        ctx.strokeStyle = r % 2 === 0 ? config.color : config.secondaryColor;
        ctx.lineWidth = 2 * scaleFactor;
        ctx.beginPath();
        ctx.arc(posX, posY, rad, time + r * 0.2, time + r * 0.2 + Math.PI * 1.5);
        ctx.stroke();
      }
    } else if (style === 'Torus Knot') {
      // (p, q) = (2, 3) Torus Knot in 3D projection
      const p = 2, q = 3;
      const rMajor = config.radius * 0.75 * scale * multiplier;
      const rMinor = rMajor * 0.4;
      const time = Date.now() * 0.002;
      ctx.beginPath();
      ctx.strokeStyle = config.color;
      ctx.lineWidth = 2.5 * scaleFactor;
      const knotSteps = Math.min(300, count * 2);
      for (let i = 0; i <= knotSteps; i++) {
        const phi = (i / knotSteps) * Math.PI * 2 * q;
        const val = (freqData[i % count] || 0) / 255;
        const rCurrent = rMajor + (rMinor + val * 20 * scale) * Math.cos(q * phi);
        const x3d = rCurrent * Math.cos(p * phi + time);
        const y3d = (rMinor + val * 20 * scale) * Math.sin(q * phi);
        const z3d = rCurrent * Math.sin(p * phi + time);
        const projX = posX + x3d;
        const projY = posY + y3d * 0.8 + z3d * 0.35;
        if (i === 0) ctx.moveTo(projX, projY);
        else ctx.lineTo(projX, projY);
      }
      ctx.stroke();
    } else if (style === 'Superellipse') {
      // Lame Superellipse |x/a|^n + |y/b|^n = 1
      const a = config.radius * 1.3 * scale * multiplier;
      const b = a * 0.7;
      const n = 2.5 + ((freqData[0] || 0) / 255) * 4.0; // dynamically morphs from ellipse to squircle
      ctx.beginPath();
      ctx.strokeStyle = config.secondaryColor;
      ctx.lineWidth = 3 * scaleFactor;
      for (let i = 0; i <= count; i++) {
        const theta = (i / count) * Math.PI * 2;
        const cosT = Math.cos(theta);
        const sinT = Math.sin(theta);
        const x = posX + Math.sign(cosT) * Math.pow(Math.abs(cosT), 2 / n) * a;
        const y = posY + Math.sign(sinT) * Math.pow(Math.abs(sinT), 2 / n) * b;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.stroke();
    } else if (style === 'Black Hole Accretion') {
      // Gravitational lensing event horizon & tilted relativistic accretion disk
      const time = Date.now() * 0.002;
      const rHorizon = config.radius * 0.45 * scale * multiplier;
      // Black hole shadow (opaque center)
      ctx.fillStyle = '#050508';
      ctx.beginPath();
      ctx.arc(posX, posY, rHorizon, 0, Math.PI * 2);
      ctx.fill();
      // Gravitational photon ring
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2 * scaleFactor;
      ctx.stroke();
      // Accretion disk rings
      for (let ring = 1; ring <= 4; ring++) {
        const rx = (rHorizon * 1.5 + ring * 18 * scale);
        const ry = rx * 0.38;
        const val = (freqData[ring * 4 % count] || 0) / 255;
        ctx.save();
        ctx.translate(posX, posY);
        ctx.rotate(-0.35); // tilt angle
        ctx.strokeStyle = ring % 2 === 0 ? config.color : config.secondaryColor;
        ctx.lineWidth = (2 + val * 3) * scaleFactor;
        ctx.beginPath();
        ctx.ellipse(0, 0, rx * (1 + val * 0.2), ry * (1 + val * 0.2), 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }
    } else {
      // Hex Pulse / Diamond Lattice
      const baseR = config.radius * scale * multiplier;
      const sides = style === 'Diamond Lattice' ? 4 : 6;
      ctx.beginPath();
      ctx.strokeStyle = config.color;
      ctx.lineWidth = 3 * scaleFactor;
      for (let s = 0; s <= sides; s++) {
        const ang = (s / sides) * Math.PI * 2 + (style === 'Diamond Lattice' ? Math.PI / 4 : 0);
        const val = (freqData[s % count] || 0) / 255;
        const rad = baseR + val * config.height * 0.4 * scale;
        const x = posX + Math.cos(ang) * rad;
        const y = posY + Math.sin(ang) * rad;
        if (s === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
  }

  // 9. Special FX & Energy Fields
  private renderSpecialFX(
    ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
    width: number,
    height: number,
    posX: number,
    posY: number,
    scale: number,
    scaleFactor: number,
    config: SpectrumConfig,
    freqData: Uint8Array | Float32Array,
    count: number,
    beatFactor: number,
    multiplier: number,
    style: string
  ) {
    if (style === 'Api Bars') {
      // Flame lick jagged bars with fiery particle peaks
      const totalWidth = width * 0.75 * (config.scale ?? 1.0);
      const startX = posX - totalWidth / 2;
      const barWidth = Math.max(3 * scaleFactor, totalWidth / count - (3 * scaleFactor));
      const time = Date.now() * 0.006;

      for (let i = 0; i < count; i++) {
        const val = freqData[i] / 255;
        const flicker = Math.sin(time + i * 1.5) * 8 * scaleFactor;
        const barH = Math.max(5 * scaleFactor, val * config.height * scale * multiplier + flicker);
        const x = startX + i * (barWidth + 3 * scaleFactor);

        // Gradient flame body
        const grad = ctx.createLinearGradient(x, posY, x, posY - barH);
        grad.addColorStop(0, '#f97316');
        grad.addColorStop(0.65, '#ef4444');
        grad.addColorStop(1, '#fef08a');
        ctx.fillStyle = grad;

        // Jagged flame shape
        ctx.beginPath();
        ctx.moveTo(x, posY);
        ctx.lineTo(x, posY - barH * 0.85);
        ctx.lineTo(x + barWidth * 0.5, posY - barH);
        ctx.lineTo(x + barWidth, posY - barH * 0.85);
        ctx.lineTo(x + barWidth, posY);
        ctx.closePath();
        ctx.fill();

        // Spark sparkler above peak
        if (val > 0.4) {
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(x + barWidth * 0.5 - 1.5 * scaleFactor, posY - barH - (4 + Math.random() * 8) * scaleFactor, 3 * scaleFactor, 3 * scaleFactor);
        }
      }
    } else if (style === 'Api Radial') {
      // Radial sunburst flame blades
      const baseRadius = config.radius * scale;
      const angleStep = (Math.PI * 2) / count;
      const time = Date.now() * 0.005;

      for (let i = 0; i < count; i++) {
        const val = freqData[i] / 255;
        const flicker = Math.sin(time + i * 2) * 6 * scaleFactor;
        const flameLen = Math.max(4 * scaleFactor, val * config.height * scale * multiplier + flicker);
        const ang = i * angleStep;

        const x1 = posX + Math.cos(ang) * baseRadius;
        const y1 = posY + Math.sin(ang) * baseRadius;
        const x2 = posX + Math.cos(ang) * (baseRadius + flameLen);
        const y2 = posY + Math.sin(ang) * (baseRadius + flameLen);

        ctx.strokeStyle = val > 0.6 ? '#fef08a' : (val > 0.3 ? '#f97316' : '#ef4444');
        ctx.lineWidth = Math.max(2 * scaleFactor, (Math.PI * 2 * baseRadius) / count - (2 * scaleFactor));
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
      }
    } else if (style === 'Plasma Ring') {
      // Electric arcing plasma discharge rays around circle
      const radius = config.radius * scale;
      const time = Date.now() * 0.004;
      for (let i = 0; i < count; i += 2) {
        const val = freqData[i] / 255;
        const angle = (i / count) * Math.PI * 2;
        const len = radius + val * config.height * scale * multiplier;
        const midR = radius + (len - radius) * 0.5;
        const jitter = Math.sin(time * 6 + i * 2) * 6 * scaleFactor;

        ctx.strokeStyle = config.color;
        ctx.lineWidth = 2 * scaleFactor;
        ctx.beginPath();
        ctx.moveTo(posX + Math.cos(angle) * radius, posY + Math.sin(angle) * radius);
        ctx.lineTo(posX + Math.cos(angle + 0.03) * midR + jitter, posY + Math.sin(angle + 0.03) * midR + jitter);
        ctx.lineTo(posX + Math.cos(angle) * len, posY + Math.sin(angle) * len);
        ctx.stroke();
      }
    } else if (style === 'Starburst') {
      // 8-point diffraction star spikes with audio expansion
      const spikes = 8;
      for (let s = 0; s < spikes; s++) {
        const val = (freqData[s * 2 % count] || 0) / 255;
        const ang = (s / spikes) * Math.PI * 2;
        const spikeLen = (config.radius * scale + val * config.height * 1.5 * scale) * multiplier;

        ctx.strokeStyle = s % 2 === 0 ? config.color : config.secondaryColor;
        ctx.lineWidth = 2.5 * scaleFactor;
        ctx.beginPath();
        ctx.moveTo(posX, posY);
        ctx.lineTo(posX + Math.cos(ang) * spikeLen, posY + Math.sin(ang) * spikeLen);
        ctx.stroke();
      }
    } else if (style === 'Aurora') {
      // Layered undulating translucent northern lights
      const totalWidth = width * 0.85 * (config.scale ?? 1.0);
      const startX = posX - totalWidth / 2;
      const time = Date.now() * 0.002;

      for (let layer = 0; layer < 3; layer++) {
        ctx.save();
        ctx.globalAlpha = config.opacity * (0.35 + layer * 0.15);
        ctx.fillStyle = layer === 0 ? config.color : (layer === 1 ? config.secondaryColor : '#06b6d4');
        ctx.beginPath();
        ctx.moveTo(startX, posY + 40 * scaleFactor);

        for (let i = 0; i < count; i++) {
          const val = freqData[i] / 255;
          const x = startX + (i / (count - 1)) * totalWidth;
          const wave = Math.sin(time * 2 + i * 0.15 + layer) * 20 * scaleFactor;
          const y = posY - val * config.height * 0.7 * scale * multiplier + wave;
          ctx.lineTo(x, y);
        }

        ctx.lineTo(startX + totalWidth, posY + 40 * scaleFactor);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }
    } else if (style === 'Kaleidoscope') {
      // 8-fold radial reflection symmetry
      const segments = 8;
      const anglePerSeg = (Math.PI * 2) / segments;
      const baseR = config.radius * 0.7 * scale;

      for (let s = 0; s < segments; s++) {
        ctx.save();
        ctx.translate(posX, posY);
        ctx.rotate(s * anglePerSeg);

        for (let i = 0; i < Math.floor(count / segments); i++) {
          const val = freqData[i] / 255;
          const h = val * config.height * 0.5 * scale * multiplier;
          const rad = baseR + i * 6 * scale;

          ctx.strokeStyle = i % 2 === 0 ? config.color : config.secondaryColor;
          ctx.lineWidth = 2 * scaleFactor;
          ctx.beginPath();
          ctx.arc(0, 0, rad, 0, (val * 0.3) + 0.05);
          ctx.stroke();
        }
        ctx.restore();
      }
    } else if (style === 'Radar Sweep') {
      const r = config.radius * scale * multiplier;
      ctx.strokeStyle = config.color;
      ctx.lineWidth = 2 * scaleFactor;
      ctx.beginPath();
      ctx.arc(posX, posY, r, 0, Math.PI * 2);
      ctx.stroke();
      const sweepAngle = (Date.now() * 0.002) % (Math.PI * 2);
      ctx.beginPath();
      ctx.moveTo(posX, posY);
      ctx.lineTo(posX + Math.cos(sweepAngle) * r, posY + Math.sin(sweepAngle) * r);
      ctx.stroke();
    } else if (style === 'Plasma Orb') {
      // Tesla coil plasma orb with wandering energetic filaments
      const orbRadius = config.radius * 0.7 * scale * multiplier;
      const time = Date.now() * 0.003;
      // Core glass orb boundary
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
      ctx.lineWidth = 1.5 * scaleFactor;
      ctx.beginPath();
      ctx.arc(posX, posY, orbRadius, 0, Math.PI * 2);
      ctx.stroke();
      // Filaments arcing from center electrode to surface
      const filamentCount = Math.min(16, count);
      for (let f = 0; f < filamentCount; f++) {
        const val = (freqData[f % count] || 0) / 255;
        const targetAng = (f / filamentCount) * Math.PI * 2 + Math.sin(time + f) * 0.3;
        const destX = posX + Math.cos(targetAng) * orbRadius;
        const destY = posY + Math.sin(targetAng) * orbRadius;
        ctx.strokeStyle = f % 2 === 0 ? config.color : config.secondaryColor;
        ctx.lineWidth = (1 + val * 2) * scaleFactor;
        ctx.beginPath();
        ctx.moveTo(posX, posY);
        // 3-segment lightning jitter
        const midX1 = posX + (destX - posX) * 0.33 + Math.sin(time * 3 + f * 1.5) * 12 * scaleFactor;
        const midY1 = posY + (destY - posY) * 0.33 + Math.cos(time * 3 + f * 1.5) * 12 * scaleFactor;
        const midX2 = posX + (destX - posX) * 0.66 + Math.sin(time * 2 + f) * 10 * scaleFactor;
        const midY2 = posY + (destY - posY) * 0.66 + Math.cos(time * 2 + f) * 10 * scaleFactor;
        ctx.lineTo(midX1, midY1);
        ctx.lineTo(midX2, midY2);
        ctx.lineTo(destX, destY);
        ctx.stroke();
        // Glow node on glass surface
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(destX, destY, (2 + val * 3) * scaleFactor, 0, Math.PI * 2);
        ctx.fill();
      }
    } else {
      // Default fallback: neon waves
      this.renderWave(ctx, width, height, posX, posY, scale, scaleFactor, config, freqData, count, multiplier, style);
    }
  }

  // 10. Avant-Garde & Quantum Physics Family Renderer
  private renderAvantGarde(
    ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
    width: number,
    height: number,
    posX: number,
    posY: number,
    scale: number,
    scaleFactor: number,
    config: SpectrumConfig,
    freqData: Uint8Array | Float32Array,
    count: number,
    beatFactor: number,
    multiplier: number,
    style: string
  ) {
    const time = Date.now() * 0.002;
    const baseRadius = config.radius * scale * multiplier;

    if (style === 'Wormhole Lensing') {
      // Einstein-Rosen wormhole throat with curved gravitational spacetime grid
      const rings = 10;
      const spokes = 16;
      const throatRadius = baseRadius * 0.35;
      const avgBass = ((freqData[0] || 0) + (freqData[1] || 0) + (freqData[2] || 0)) / (3 * 255);
      
      // Central singularity dark horizon
      ctx.fillStyle = '#020205';
      ctx.beginPath();
      ctx.arc(posX, posY, throatRadius * (1 + avgBass * 0.2), 0, Math.PI * 2);
      ctx.fill();

      // Curved spacetime circles receding into throat
      ctx.lineWidth = 1.5 * scaleFactor;
      for (let r = 1; r <= rings; r++) {
        const u = r / rings;
        const val = (freqData[(r * 4) % count] || 0) / 255;
        // Hyperbolic gravitational lensing metric: r' = throat + u^2 * maxRadius
        const rad = throatRadius + (u * u) * config.height * 1.5 * scale * (1 + val * 0.25);
        ctx.strokeStyle = r % 2 === 0 ? config.color : config.secondaryColor;
        ctx.globalAlpha = config.opacity * (0.3 + u * 0.7);
        ctx.beginPath();
        ctx.arc(posX, posY, rad, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Gravitational light deflection geodesic spokes
      for (let s = 0; s < spokes; s++) {
        const theta = (s / spokes) * Math.PI * 2 + time * 0.2;
        ctx.beginPath();
        ctx.strokeStyle = config.secondaryColor;
        ctx.globalAlpha = config.opacity * 0.45;
        for (let r = 0; r <= rings; r++) {
          const u = r / rings;
          const rad = throatRadius + (u * u) * config.height * 1.5 * scale;
          // Frame dragging rotation swirl around wormhole
          const swirl = theta + (1 - u) * 1.2;
          const x = posX + Math.cos(swirl) * rad;
          const y = posY + Math.sin(swirl) * rad;
          if (r === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
      ctx.globalAlpha = config.opacity;
    } else if (style === 'Magnetic Pulsar') {
      // Rapidly rotating neutron star with twin relativistic emission cones
      const starRadius = baseRadius * 0.4;
      const spinAngle = time * 3.5;
      const avgTreble = ((freqData[Math.floor(count * 0.7)] || 0) + (freqData[Math.floor(count * 0.85)] || 0)) / (2 * 255);

      // Core neutron star with magnetic field glow
      ctx.fillStyle = config.color;
      ctx.beginPath();
      ctx.arc(posX, posY, starRadius, 0, Math.PI * 2);
      ctx.fill();

      // Twin relativistic radiation cones (North & South magnetic poles)
      const coneLength = config.height * 1.6 * scale * (1 + avgTreble * 0.6);
      const coneSpread = 0.28 + avgTreble * 0.2;
      ctx.lineWidth = 2 * scaleFactor;

      for (let pole = -1; pole <= 1; pole += 2) {
        const poleAngle = spinAngle + (pole === 1 ? 0 : Math.PI);
        const tipX = posX + Math.cos(poleAngle) * starRadius;
        const tipY = posY + Math.sin(poleAngle) * starRadius;
        const leftX = posX + Math.cos(poleAngle - coneSpread) * coneLength;
        const leftY = posY + Math.sin(poleAngle - coneSpread) * coneLength;
        const rightX = posX + Math.cos(poleAngle + coneSpread) * coneLength;
        const rightY = posY + Math.sin(poleAngle + coneSpread) * coneLength;

        ctx.strokeStyle = config.secondaryColor;
        ctx.beginPath();
        ctx.moveTo(tipX, tipY);
        ctx.lineTo(leftX, leftY);
        ctx.lineTo(rightX, rightY);
        ctx.closePath();
        ctx.stroke();

        // High-energy particle beam pulses along cone axis
        for (let b = 1; b <= 4; b++) {
          const bDist = (b / 4) * coneLength;
          const bx = posX + Math.cos(poleAngle) * bDist;
          const by = posY + Math.sin(poleAngle) * bDist;
          ctx.fillStyle = '#ffffff';
          ctx.beginPath();
          ctx.arc(bx, by, (2 + b * 1.2) * scaleFactor, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    } else if (style === 'Julia Morph') {
      // Dynamic Julia Set slice boundary z -> z^2 + c
      const maxIter = 12;
      const cr = -0.7 + Math.sin(time) * 0.12 + ((freqData[2] || 0) / 255) * 0.15;
      const ci = 0.27015 + Math.cos(time * 0.7) * 0.08 + ((freqData[10] || 0) / 255) * 0.12;
      const juliaScale = baseRadius * 1.4;
      const step = Math.max(1, Math.floor(count / 32));

      ctx.fillStyle = config.color;
      for (let i = 0; i < count; i += step) {
        const theta = (i / count) * Math.PI * 2;
        let zx = Math.cos(theta) * 1.1;
        let zy = Math.sin(theta) * 1.1;
        let iter = 0;
        while (zx * zx + zy * zy < 4 && iter < maxIter) {
          const tmp = zx * zx - zy * zy + cr;
          zy = 2 * zx * zy + ci;
          zx = tmp;
          iter++;
        }
        const val = freqData[i] / 255;
        const rDist = (iter / maxIter) * juliaScale * (1 + val * 0.35);
        const px = posX + Math.cos(theta) * rDist;
        const py = posY + Math.sin(theta) * rDist;
        ctx.fillRect(px - scaleFactor, py - scaleFactor, 2.5 * scaleFactor, 2.5 * scaleFactor);
      }
    } else if (style === 'Barnsley Fern') {
      // Iterated Function System (IFS) Barnsley Fern affine transformation
      let bx = 0, by = 0;
      const fernPoints = Math.min(600, count * 6);
      const fernScale = (config.height * 0.8 * scale * multiplier) / 10;
      const avgMid = (freqData[Math.floor(count * 0.4)] || 0) / 255;
      ctx.fillStyle = config.color;

      for (let p = 0; p < fernPoints; p++) {
        const r = Math.sin(p * 9301 + 49297) * 0.5 + 0.5; // deterministic pseudo-random without heap alloc
        let nx = 0, ny = 0;
        if (r < 0.01) {
          nx = 0;
          ny = 0.16 * by;
        } else if (r < 0.86) {
          nx = 0.85 * bx + (0.04 + avgMid * 0.03) * by;
          ny = -0.04 * bx + 0.85 * by + 1.6;
        } else if (r < 0.93) {
          nx = 0.2 * bx - 0.26 * by;
          ny = 0.23 * bx + 0.22 * by + 1.6;
        } else {
          nx = -0.15 * bx + 0.28 * by;
          ny = 0.26 * bx + 0.24 * by + 0.44;
        }
        bx = nx;
        by = ny;
        const scrX = posX + bx * fernScale * 2.2;
        const scrY = posY + (config.height * 0.4 * scale) - by * fernScale;
        ctx.fillRect(scrX, scrY, 1.5 * scaleFactor, 1.5 * scaleFactor);
      }
    } else if (style === 'Double Pendulum') {
      // Chaotic double pendulum trajectory trace
      const l1 = config.radius * 0.6 * scale;
      const l2 = config.radius * 0.5 * scale;
      const bassKick = ((freqData[1] || 0) / 255) * 2.0;
      const th1 = Math.sin(time * 1.8) * 1.2 + bassKick * 0.4;
      const th2 = Math.cos(time * 2.5) * 1.8 + Math.sin(time * 0.7) * 0.8;

      const x1 = posX + Math.sin(th1) * l1;
      const y1 = posY + Math.cos(th1) * l1;
      const x2 = x1 + Math.sin(th2) * l2;
      const y2 = y1 + Math.cos(th2) * l2;

      // Pendulum rigid rods
      ctx.strokeStyle = 'rgba(255,255,255,0.4)';
      ctx.lineWidth = 2 * scaleFactor;
      ctx.beginPath();
      ctx.moveTo(posX, posY);
      ctx.lineTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();

      // Bob 1 & Bob 2
      ctx.fillStyle = config.color;
      ctx.beginPath();
      ctx.arc(x1, y1, 5 * scaleFactor, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = config.secondaryColor;
      ctx.beginPath();
      ctx.arc(x2, y2, (6 + bassKick * 4) * scaleFactor, 0, Math.PI * 2);
      ctx.fill();

      // Audio harmonic phosphor orbital tail behind Bob 2
      ctx.beginPath();
      ctx.strokeStyle = config.secondaryColor;
      ctx.lineWidth = 1.5 * scaleFactor;
      const trail = 24;
      for (let t = 0; t < trail; t++) {
        const val = (freqData[t % count] || 0) / 255;
        const ptTime = time - t * 0.05;
        const pth1 = Math.sin(ptTime * 1.8) * 1.2;
        const pth2 = Math.cos(ptTime * 2.5) * 1.8;
        const tx1 = posX + Math.sin(pth1) * l1;
        const ty1 = posY + Math.cos(pth1) * l1;
        const tx2 = tx1 + Math.sin(pth2) * (l2 + val * 25 * scale);
        const ty2 = ty1 + Math.cos(pth2) * (l2 + val * 25 * scale);
        if (t === 0) ctx.moveTo(tx2, ty2);
        else ctx.lineTo(tx2, ty2);
      }
      ctx.stroke();
    } else if (style === 'Klein Bottle 4D') {
      // 4D Klein Bottle non-orientable surface immersion
      ctx.beginPath();
      ctx.strokeStyle = config.color;
      ctx.lineWidth = 2 * scaleFactor;
      const steps = Math.min(180, count * 2);
      const kbRadius = baseRadius * 0.7;

      for (let i = 0; i <= steps; i++) {
        const u = (i / steps) * Math.PI * 2;
        const v = u * 2 + time;
        const val = (freqData[i % count] || 0) / 255;
        // Parametric Klein surface: r = 4*(1 - cos(u)/2)
        const rFactor = 4 * (1 - Math.cos(u) / 2);
        let kx = 0, ky = 0;
        if (u < Math.PI) {
          kx = 6 * Math.cos(u) * (1 + Math.sin(u)) + rFactor * Math.cos(u) * Math.cos(v);
          ky = 16 * Math.sin(u) + rFactor * Math.sin(u) * Math.cos(v);
        } else {
          kx = 6 * Math.cos(u) * (1 + Math.sin(u)) + rFactor * Math.cos(v + Math.PI);
          ky = 16 * Math.sin(u);
        }
        const scrX = posX + (kx * kbRadius * 0.04) * (1 + val * 0.25);
        const scrY = posY - (ky * kbRadius * 0.04) * (1 + val * 0.25);
        if (i === 0) ctx.moveTo(scrX, scrY);
        else ctx.lineTo(scrX, scrY);
      }
      ctx.stroke();
    } else if (style === 'Hopf Fibration') {
      // S^3 -> S^2 Hopf fibration nested Villarceau circles
      const torusR = baseRadius * 0.85;
      const tubeR = torusR * 0.4;
      const numFibers = 12;
      ctx.lineWidth = 1.5 * scaleFactor;

      for (let f = 0; f < numFibers; f++) {
        const fiberAngle = (f / numFibers) * Math.PI * 2 + time * 0.5;
        const val = (freqData[(f * 4) % count] || 0) / 255;
        ctx.strokeStyle = f % 2 === 0 ? config.color : config.secondaryColor;
        ctx.beginPath();
        // Villarceau bitangent circle tilted at torus inclination angle
        ctx.save();
        ctx.translate(posX, posY);
        ctx.rotate(fiberAngle);
        ctx.scale(1.0, 0.45 + val * 0.25);
        ctx.arc(torusR * 0.4, 0, tubeR * (1 + val * 0.3), 0, Math.PI * 2);
        ctx.restore();
        ctx.stroke();
      }
    } else if (style === 'Mobius Ribbon') {
      // 3D Twisted Möbius strip loop
      ctx.lineWidth = 2 * scaleFactor;
      const segs = Math.min(150, count);
      const mR = baseRadius * 0.85;
      const mW = 28 * scale;

      for (let side = -1; side <= 1; side += 2) {
        ctx.strokeStyle = side === -1 ? config.color : config.secondaryColor;
        ctx.beginPath();
        for (let i = 0; i <= segs; i++) {
          const u = (i / segs) * Math.PI * 2;
          const val = (freqData[i % count] || 0) / 255;
          const v = side * (mW + val * 35 * scale);
          const x3d = (mR + v * Math.cos(u / 2)) * Math.cos(u + time);
          const y3d = (mR + v * Math.cos(u / 2)) * Math.sin(u + time);
          const z3d = v * Math.sin(u / 2);
          const projX = posX + x3d;
          const projY = posY + y3d * 0.5 + z3d * 0.8;
          if (i === 0) ctx.moveTo(projX, projY);
          else ctx.lineTo(projX, projY);
        }
        ctx.stroke();
      }
    } else if (style === 'Sonoluminescence') {
      // Cavitation bubble compression shockwave and core plasma flash
      const avgBass = ((freqData[0] || 0) + (freqData[1] || 0) + (freqData[2] || 0)) / (3 * 255);
      const isCollapse = avgBass > 0.65;
      const bubbleR = baseRadius * (isCollapse ? 0.3 : (0.8 + avgBass * 0.4));

      // Surrounding fluid acoustic wave rings
      ctx.lineWidth = 2 * scaleFactor;
      for (let w = 1; w <= 5; w++) {
        const rWave = bubbleR + w * 22 * scale;
        ctx.strokeStyle = config.secondaryColor;
        ctx.globalAlpha = config.opacity * (1 - w * 0.18);
        ctx.beginPath();
        ctx.arc(posX, posY, rWave, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.globalAlpha = config.opacity;

      // Bubble boundary
      ctx.strokeStyle = config.color;
      ctx.lineWidth = 3 * scaleFactor;
      ctx.beginPath();
      ctx.arc(posX, posY, bubbleR, 0, Math.PI * 2);
      ctx.stroke();

      // Plasma flash upon collapse
      if (isCollapse) {
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(posX, posY, 14 * scaleFactor, 0, Math.PI * 2);
        ctx.fill();
        // Radiative heat rays
        for (let ray = 0; ray < 8; ray++) {
          const ang = (ray / 8) * Math.PI * 2 + time * 2;
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 1.5 * scaleFactor;
          ctx.beginPath();
          ctx.moveTo(posX, posY);
          ctx.lineTo(posX + Math.cos(ang) * (bubbleR * 1.8), posY + Math.sin(ang) * (bubbleR * 1.8));
          ctx.stroke();
        }
      }
    } else if (style === 'Lichtenberg Tree') {
      // High-voltage dielectric breakdown fractal branches from edges to center
      const branches = 8;
      ctx.strokeStyle = config.color;
      ctx.lineWidth = 1.8 * scaleFactor;

      for (let b = 0; b < branches; b++) {
        const baseAng = (b / branches) * Math.PI * 2;
        const outerX = posX + Math.cos(baseAng) * (config.height * 0.9 * scale);
        const outerY = posY + Math.sin(baseAng) * (config.height * 0.9 * scale);
        let curX = outerX;
        let curY = outerY;
        const segments = 6;

        ctx.beginPath();
        ctx.moveTo(curX, curY);
        for (let s = 1; s <= segments; s++) {
          const prog = s / segments;
          const val = (freqData[(b * segments + s) % count] || 0) / 255;
          const targetX = outerX + (posX - outerX) * prog;
          const targetY = outerY + (posY - outerY) * prog;
          // Perpendicular electrostatic jitter
          const perpAng = baseAng + Math.PI / 2;
          const jitter = Math.sin(time * 4 + b * 3 + s) * (18 * scaleFactor + val * 20 * scaleFactor);
          curX = targetX + Math.cos(perpAng) * jitter;
          curY = targetY + Math.sin(perpAng) * jitter;
          ctx.lineTo(curX, curY);
        }
        ctx.lineTo(posX, posY);
        ctx.stroke();
      }
    } else if (style === 'Rubens Soundtube') {
      // Rubens standing acoustic wave flame tube
      const totalWidth = width * 0.8 * (config.scale ?? 1.0);
      const startX = posX - totalWidth / 2;
      const stepX = totalWidth / Math.max(1, count - 1);
      const tubeY = posY + 30 * scaleFactor;

      // Acoustic tube pipe body
      ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
      ctx.fillRect(startX, tubeY, totalWidth, 8 * scaleFactor);

      // Standing flame heights at nodes and antinodes
      const standingWaveHarmonics = 3;
      ctx.fillStyle = config.color;
      for (let i = 0; i < count; i++) {
        const x = startX + i * stepX;
        const prog = i / (count - 1);
        const standingPressure = Math.abs(Math.sin(prog * Math.PI * standingWaveHarmonics));
        const val = freqData[i] / 255;
        const flameHeight = (10 * scaleFactor + standingPressure * 45 * scaleFactor * (1 + val * 0.7)) * multiplier;

        ctx.beginPath();
        ctx.moveTo(x - 2 * scaleFactor, tubeY);
        ctx.lineTo(x, tubeY - flameHeight);
        ctx.lineTo(x + 2 * scaleFactor, tubeY);
        ctx.closePath();
        ctx.fill();

        // White-hot flame tip
        if (flameHeight > 30 * scaleFactor) {
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(x - 1 * scaleFactor, tubeY - flameHeight - 3 * scaleFactor, 2 * scaleFactor, 2 * scaleFactor);
          ctx.fillStyle = config.color;
        }
      }
    } else {
      this.renderWave(ctx, width, height, posX, posY, scale, scaleFactor, config, freqData, count, multiplier, style);
    }
  }
}

