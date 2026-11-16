import type { ParticleConfig } from '../../lib/types/project';

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  baseSize: number;
  alpha: number;
  color: string;
  rotation: number;
  vRot: number;
  shape?: 'star' | 'circle' | 'square' | 'petal' | 'triangle' | 'diamond' | 'line' | 'lightning' | 'snow' | 'fire' | 'spark';
}

const CONFETTI_COLORS = ['#38bdf8', '#f43f5e', '#fbbf24', '#34d399', '#a855f7', '#ec4899', '#f97316'];
const SPARK_COLORS = ['#ffedd5', '#fed7aa', '#fef08a', '#f59e0b', '#ef4444'];
const BOKEH_COLORS = ['#67e8f9', '#a78bfa', '#f472b6', '#fde047', '#6ee7b7'];

export class ParticleSystem {
  particles: Particle[] = [];
  width: number = 1920;
  height: number = 1080;
  currentPreset: string = '';

  constructor(width: number, height: number) {
    this.resize(width, height);
  }

  resize(width: number, height: number) {
    this.width = width;
    this.height = height;
  }

  init(config: ParticleConfig) {
    this.currentPreset = config.preset;
    const targetCount = config.count;
    
    // In-place mutate existing particles to prevent GC lag
    const existingLen = this.particles.length;
    if (existingLen > targetCount) {
      this.particles.length = targetCount;
    }

    for (let i = 0; i < targetCount; i++) {
      if (i < existingLen) {
        this.resetParticle(this.particles[i], config);
      } else {
        this.particles.push(this.createParticle(config));
      }
    }
  }

  private resetParticle(p: Particle, config: ParticleConfig): Particle {
    const scaleFactor = Math.min(this.width / 1920, this.height / 1080);
    const baseSize = (config.size || 6) * scaleFactor;
    let size = Math.max(1, (Math.random() * 0.8 + 0.4) * baseSize);
    let vx = (Math.random() - 0.5) * config.speed * 2 * scaleFactor;
    let vy = (Math.random() - 0.5) * config.speed * 2 * scaleFactor;
    let color = config.color || '#ffffff';
    let rotation = Math.random() * Math.PI * 2;
    let vRot = (Math.random() - 0.5) * 0.08;
    let shape: Particle['shape'] = 'circle';

    const preset = config.preset;

    if (preset === 'bokeh') {
      size = Math.max(8 * scaleFactor, (Math.random() * 1.5 + 0.8) * baseSize * 2.5);
      vx = (Math.random() - 0.5) * config.speed * 0.6 * scaleFactor;
      vy = -Math.abs((Math.random() * 0.6 + 0.2) * config.speed * scaleFactor);
      color = config.color && config.color !== '#ffffff' 
        ? config.color 
        : BOKEH_COLORS[Math.floor(Math.random() * BOKEH_COLORS.length)];
    } else if (preset === 'confetti' || preset === 'Confetti') {
      size = Math.max(3 * scaleFactor, (Math.random() * 0.8 + 0.6) * baseSize * 1.5);
      vx = (Math.random() - 0.5) * config.speed * 2.5 * scaleFactor;
      vy = (Math.random() * 1.8 + 0.8) * config.speed * scaleFactor;
      vRot = (Math.random() - 0.5) * 0.15;
      color = CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)];
      shape = 'square';
    } else if (preset === 'snow' || preset === 'Salju') {
      size = Math.max(1.5 * scaleFactor, (Math.random() * 0.9 + 0.3) * baseSize);
      vx = Math.sin(Math.random() * Math.PI * 2) * config.speed * 0.7 * scaleFactor;
      vy = (Math.random() * 1.2 + 0.8) * config.speed * scaleFactor;
      color = config.color || '#ffffff';
    } else if (preset === 'Gentle Snow') {
      size = Math.max(1.2 * scaleFactor, (Math.random() * 0.6 + 0.2) * baseSize);
      vx = (Math.random() - 0.5) * config.speed * 0.4 * scaleFactor;
      vy = (Math.random() * 0.6 + 0.4) * config.speed * scaleFactor;
      color = config.color || '#e0f2fe';
    } else if (preset === 'sparks' || preset === 'Percikan Api' || preset === 'Beat Spark') {
      size = Math.max(1.5 * scaleFactor, (Math.random() * 0.7 + 0.3) * baseSize);
      vx = (Math.random() - 0.5) * config.speed * 4.5 * scaleFactor;
      vy = -Math.abs((Math.random() * 3.5 + 1.2) * config.speed * scaleFactor);
      color = config.color && config.color !== '#ffffff'
        ? config.color
        : SPARK_COLORS[Math.floor(Math.random() * SPARK_COLORS.length)];
      shape = 'star';
    } else if (preset === 'Sparkles') {
      size = Math.max(2 * scaleFactor, (Math.random() * 0.9 + 0.3) * baseSize);
      vx = (Math.random() - 0.5) * config.speed * 1.2 * scaleFactor;
      vy = (Math.random() - 0.5) * config.speed * 1.2 * scaleFactor;
      color = config.color && config.color !== '#ffffff' ? config.color : '#fef08a';
      shape = 'star';
    } else if (preset === 'Stars') {
      size = Math.max(1.5 * scaleFactor, (Math.random() * 0.8 + 0.2) * baseSize);
      vx = (Math.random() - 0.5) * config.speed * 0.2 * scaleFactor;
      vy = (Math.random() - 0.5) * config.speed * 0.2 * scaleFactor;
      color = config.color || '#ffffff';
      shape = 'star';
    } else if (preset === 'Asap' || preset === 'Kabut') {
      size = Math.max(15 * scaleFactor, (Math.random() * 2 + 1) * baseSize * 3);
      vx = (Math.random() - 0.5) * config.speed * 0.5 * scaleFactor;
      vy = -Math.abs((Math.random() * 0.8 + 0.2) * config.speed * scaleFactor);
      color = config.color && config.color !== '#ffffff' ? config.color : '#94a3b8';
    } else if (preset === 'Hujan Neon') {
      size = Math.max(2 * scaleFactor, (Math.random() * 0.6 + 0.4) * baseSize);
      vx = (Math.random() - 0.2) * config.speed * 0.5 * scaleFactor;
      vy = (Math.random() * 3.5 + 4.0) * config.speed * scaleFactor;
      color = config.color && config.color !== '#ffffff' ? config.color : '#38bdf8';
    } else if (preset === 'NCS Particles') {
      size = Math.max(2 * scaleFactor, (Math.random() * 0.8 + 0.3) * baseSize);
      const angle = Math.random() * Math.PI * 2;
      const spd = (Math.random() * 2 + 1) * config.speed * scaleFactor;
      vx = Math.cos(angle) * spd;
      vy = Math.sin(angle) * spd;
      color = config.color && config.color !== '#ffffff' ? config.color : '#38bdf8';
    } else if (preset === 'Particles Rise') {
      size = Math.max(1.5 * scaleFactor, (Math.random() * 0.8 + 0.4) * baseSize);
      vx = (Math.random() - 0.5) * config.speed * 0.8 * scaleFactor;
      vy = -Math.abs((Math.random() * 2 + 0.8) * config.speed * scaleFactor);
      color = config.color || '#ffffff';
    } else if (preset === 'Particle Burst') {
      size = Math.max(2 * scaleFactor, (Math.random() * 0.8 + 0.3) * baseSize);
      const ang = Math.random() * Math.PI * 2;
      const mag = (Math.random() * 4 + 1.5) * config.speed * scaleFactor;
      vx = Math.cos(ang) * mag;
      vy = Math.sin(ang) * mag;
      color = config.color && config.color !== '#ffffff' ? config.color : '#f43f5e';
    } else if (preset === 'Vortex Particles' || preset === 'Orbit Dust' || preset === 'Galaxy Dust') {
      size = Math.max(1.8 * scaleFactor, (Math.random() * 0.8 + 0.3) * baseSize);
      vx = (Math.random() - 0.5) * config.speed * scaleFactor;
      vy = (Math.random() - 0.5) * config.speed * scaleFactor;
      color = config.color && config.color !== '#ffffff' ? config.color : '#a855f7';
    } else if (preset === 'Ponco Neon Dust') {
      p.vx = (Math.random() - 0.5) * 0.4;
      p.vy = -Math.random() * 0.6;
      p.size = Math.random() * 2 + 1;
      p.color = `hsl(${180 + Math.random() * 40}, 100%, 60%)`;
      (p as any).shape = 'triangle';
    } else if (preset === 'Ponco Fireflies') {
      p.vx = Math.sin(Math.random() * 6) * 0.3;
      p.vy = Math.cos(Math.random() * 6) * 0.2;
      p.size = Math.random() * 3 + 1;
      p.color = `hsl(${40 + Math.random() * 20}, 100%, 60%)`;
      (p as any).shape = 'square';
    } else if (preset === 'Ponco Galaxy Dust') {
      p.vx = (Math.random() - 0.5) * 0.2;
      p.vy = (Math.random() - 0.5) * 0.2;
      p.size = Math.random() * 1.5 + 0.5;
      p.color = `hsl(${Math.random() * 360}, 80%, 70%)`;
      (p as any).shape = 'diamond';
    } else if (preset === 'Ponco Rain Glow') {
      p.vx = 0;
      p.vy = Math.random() * 2 + 1;
      p.size = Math.random() * 1 + 0.5;
      p.color = `hsl(200, 100%, 60%)`;
      (p as any).shape = 'line';
    } else if (preset === 'Ponco Spark Burst') {
      const a = Math.random() * Math.PI * 2;
      const s = Math.random() * 2 + 0.5;
      p.vx = Math.cos(a) * s;
      p.vy = Math.sin(a) * s;
      p.size = Math.random() * 2 + 1;
      p.color = `hsl(${Math.random() * 60}, 100%, 60%)`;
      (p as any).shape = 'spark';
    } else if (preset === 'Ponco Lightning') {
      p.vx = (Math.random() - 0.5) * 1;
      p.vy = Math.random() * 3;
      p.size = Math.random() * 4 + 2;
      p.color = `hsl(200, 100%, 80%)`;
      (p as any).shape = 'lightning';
    } else if (preset === 'Ponco Snow') {
      p.vx = (Math.random() - 0.5) * 0.3;
      p.vy = Math.random() * 0.8 + 0.3;
      p.size = Math.random() * 3 + 1;
      p.color = '#ffffff';
      (p as any).shape = 'snow';
    } else if (preset === 'Ponco Fire') {
      p.vx = (Math.random() - 0.5) * 0.5;
      p.vy = -Math.random() * 1.5 - 0.5;
      p.size = Math.random() * 4 + 2;
      p.color = `hsl(${Math.random() * 30}, 100%, 50%)`;
      (p as any).shape = 'fire';
    } else if (preset === 'Ponco Fireflies') {
      p.vx = Math.sin(Math.random() * 6) * 0.3;
      p.vy = Math.cos(Math.random() * 6) * 0.2;
      p.size = Math.random() * 3 + 1;
      p.color = `hsl(${40 + Math.random() * 20}, 100%, 60%)`;
    } else if (preset === 'Ponco Galaxy Dust') {
      p.vx = (Math.random() - 0.5) * 0.2;
      p.vy = (Math.random() - 0.5) * 0.2;
      p.size = Math.random() * 1.5 + 0.5;
      p.color = `hsl(${Math.random() * 360}, 80%, 70%)`;
    } else if (preset === 'Ponco Rain Glow') {
      p.vx = 0;
      p.vy = Math.random() * 2 + 1;
      p.size = Math.random() * 1 + 0.5;
      p.color = `hsl(200, 100%, 60%)`;
    } else if (preset === 'Ponco Spark Burst') {
      const a = Math.random() * Math.PI * 2;
      const s = Math.random() * 2 + 0.5;
      p.vx = Math.cos(a) * s;
      p.vy = Math.sin(a) * s;
      p.size = Math.random() * 2 + 1;
      p.color = `hsl(${Math.random() * 60}, 100%, 60%)`;
    } else if (preset === 'Ponco Triangles') {
      p.vx = (Math.random() - 0.5) * 0.5;
      p.vy = -Math.random() * 0.8;
      p.size = Math.random() * 6 + 3;
      p.color = `hsl(${Math.random() * 60}, 100%, 55%)`;
      (p as any).shape = 'triangle';
    } else if (preset === 'Ponco Squares') {
      p.vx = (Math.random() - 0.5) * 0.4;
      p.vy = Math.random() * 0.6;
      p.size = Math.random() * 5 + 2;
      p.color = `hsl(${180 + Math.random() * 40}, 100%, 55%)`;
      (p as any).shape = 'square';
    } else if (preset === 'Ponco Diamonds') {
      p.vx = (Math.random() - 0.5) * 0.3;
      p.vy = (Math.random() - 0.5) * 0.3;
      p.size = Math.random() * 5 + 2;
      p.color = `hsl(${280 + Math.random() * 40}, 100%, 60%)`;
      (p as any).shape = 'diamond';
    } else if (preset === 'Meteor Shower') {
      size = Math.max(2 * scaleFactor, (Math.random() * 0.7 + 0.3) * baseSize);
      vx = -Math.abs((Math.random() * 2.5 + 2) * config.speed * scaleFactor);
      vy = (Math.random() * 2.5 + 2) * config.speed * scaleFactor;
      color = config.color && config.color !== '#ffffff' ? config.color : '#fbbf24';
    } else if (preset === 'Audio Sphere' || preset === 'Interactive Orbit') {
      size = Math.max(2 * scaleFactor, (Math.random() * 1.2 + 0.4) * baseSize);
      const ang = Math.random() * Math.PI * 2;
      vx = Math.cos(ang) * config.speed * 0.8 * scaleFactor;
      vy = Math.sin(ang) * config.speed * 0.8 * scaleFactor;
      color = config.color && config.color !== '#ffffff' ? config.color : `hsl(${200 + Math.random()*80}, 90%, 65%)`;
      shape = 'circle';
    } else if (preset === 'Frequency Swarm' || preset === 'Audio Cloud' || preset === 'Color Shift Swarm') {
      size = Math.max(1.5 * scaleFactor, (Math.random() * 1.0 + 0.3) * baseSize);
      vx = (Math.random() - 0.5) * config.speed * 1.5 * scaleFactor;
      vy = (Math.random() - 0.5) * config.speed * 1.5 * scaleFactor;
      color = `hsl(${Math.random()*360}, 85%, 60%)`;
      shape = Math.random() > 0.7 ? 'star' : 'circle';
    } else if (preset === 'Beat Explosion' || preset === 'Circular Burst' || preset === 'Shockwave Rings') {
      size = Math.max(2 * scaleFactor, (Math.random() * 1.5 + 0.5) * baseSize);
      const ang = Math.random() * Math.PI * 2;
      const mag = (Math.random() * 3 + 1) * config.speed * scaleFactor;
      vx = Math.cos(ang) * mag;
      vy = Math.sin(ang) * mag;
      color = config.color && config.color !== '#ffffff' ? config.color : '#f43f5e';
      shape = 'spark';
    } else if (preset === 'Rising Bubbles' || preset === 'Particle Fountain' || preset === 'Music Note Rain') {
      size = Math.max(3 * scaleFactor, (Math.random() * 1.4 + 0.6) * baseSize * 1.5);
      vx = (Math.random() - 0.5) * config.speed * 0.4 * scaleFactor;
      vy = -Math.abs((Math.random() * 0.8 + 0.4) * config.speed * scaleFactor);
      color = config.color && config.color !== '#ffffff' ? config.color : '#67e8f9';
      shape = 'circle';
    } else if (preset === 'Neon Fireflies' || preset === 'Treble Sparkles') {
      size = Math.max(1.2 * scaleFactor, (Math.random() * 0.6 + 0.2) * baseSize);
      vx = (Math.random() - 0.5) * config.speed * 0.7 * scaleFactor;
      vy = (Math.random() - 0.5) * config.speed * 0.7 * scaleFactor;
      color = `hsl(${100 + Math.random()*60}, 100%, 65%)`;
      shape = 'star';
    } else if (preset === 'Galaxy Spiral' || preset === 'Gravity Well' || preset === 'Magnetic Flow') {
      size = Math.max(1.8 * scaleFactor, (Math.random() * 0.9 + 0.3) * baseSize);
      vx = (Math.random() - 0.5) * config.speed * scaleFactor;
      vy = (Math.random() - 0.5) * config.speed * scaleFactor;
      color = config.color && config.color !== '#ffffff' ? config.color : '#a855f7';
      shape = 'circle';
    } else if (preset === 'Bass Pulse' || preset === 'Midrange Drift' || preset === 'Waveform Dust') {
      size = Math.max(2.5 * scaleFactor, (Math.random() * 1.1 + 0.5) * baseSize);
      vx = (Math.random() - 0.5) * config.speed * 0.9 * scaleFactor;
      vy = (Math.random() - 0.5) * config.speed * 0.9 * scaleFactor;
      color = config.color && config.color !== '#ffffff' ? config.color : '#f59e0b';
      shape = 'circle';
    } else if (preset === 'Trail Comets') {
      size = Math.max(2 * scaleFactor, (Math.random() * 0.8 + 0.4) * baseSize);
      vx = (Math.random() - 0.3) * config.speed * 1.8 * scaleFactor;
      vy = (Math.random() - 0.5) * config.speed * 0.6 * scaleFactor;
      color = '#fbbf24';
      shape = 'line';
    } else {
      // floating-dust, Bintik (Dust)
      if (config.gravity === 'up') vy = -Math.abs(vy) - 0.5 * config.speed * scaleFactor;
      else if (config.gravity === 'down') vy = Math.abs(vy) + 0.5 * config.speed * scaleFactor;
    }

    p.x = Math.random() * this.width;
    p.y = Math.random() * this.height;
    p.vx = vx;
    p.vy = vy;
    p.size = size;
    p.baseSize = size;
    p.alpha = Math.random() * (config.opacity ?? 0.8) + 0.2;
    p.color = color;
    p.rotation = rotation;
    p.vRot = vRot;
    p.shape = shape;
    return p;
  }

  private createParticle(config: ParticleConfig): Particle {
    const p: Particle = {
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      size: 0,
      baseSize: 0,
      alpha: 1,
      color: '#ffffff',
      rotation: 0,
      vRot: 0,
      shape: 'circle',
    };
    return this.resetParticle(p, config);
  }


  updateAndRender(
    ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
    config: ParticleConfig,
    rawBeatFactor: number = 1.0,
    isMoving: boolean = true
  ) {
    if (!config.enabled) return;

    if (this.particles.length !== config.count || this.currentPreset !== config.preset) {
      this.init(config);
    }

    const scaleFactor = Math.min(this.width / 1920, this.height / 1080);
    const sensitivity = config.beatSensitivity ?? 1.0;
    // When paused, beat factor resting state is 1.0
    const beatFactor = isMoving ? (1.0 + (rawBeatFactor - 1.0) * sensitivity) : 1.0;

    ctx.save();

    // When paused, temporarily zero out velocities so NO particles advance their coordinates!
    let savedVelocities: Float32Array | null = null;
    if (!isMoving) {
      savedVelocities = new Float32Array(this.particles.length * 3);
      for (let i = 0; i < this.particles.length; i++) {
        const pt = this.particles[i];
        savedVelocities[i * 3] = pt.vx;
        savedVelocities[i * 3 + 1] = pt.vy;
        savedVelocities[i * 3 + 2] = pt.vRot;
        pt.vx = 0;
        pt.vy = 0;
        pt.vRot = 0;
      }
    }

    const effectiveConfig = isMoving ? config : { ...config, speed: 0 };
    const p = config.preset;

    if (p === 'bokeh') {
      this.renderBokeh(ctx, effectiveConfig, beatFactor, scaleFactor);
    } else if (p === 'confetti' || p === 'Confetti') {
      this.renderConfetti(ctx, effectiveConfig, beatFactor, scaleFactor);
    } else if (p === 'snow' || p === 'Salju' || p === 'Gentle Snow') {
      this.renderSnow(ctx, effectiveConfig, beatFactor, scaleFactor);
    } else if (p === 'sparks' || p === 'Percikan Api' || p === 'Beat Spark') {
      this.renderSparks(ctx, effectiveConfig, beatFactor, scaleFactor);
    } else if (p === 'Hujan Neon') {
      this.renderNeonRain(ctx, effectiveConfig, beatFactor, scaleFactor);
    } else if (p === 'Meteor Shower') {
      this.renderMeteor(ctx, effectiveConfig, beatFactor, scaleFactor);
    } else if (p === 'Asap' || p === 'Kabut') {
      this.renderSmoke(ctx, effectiveConfig, beatFactor, scaleFactor);
    } else if (p === 'Vortex Particles' || p === 'Orbit Dust' || p === 'Galaxy Dust') {
      this.renderVortex(ctx, effectiveConfig, beatFactor, scaleFactor);
    } else if (p === 'Sparkles' || p === 'Stars') {
      this.renderSparkles(ctx, effectiveConfig, beatFactor, scaleFactor);
    } else if (p === 'NCS Particles' || p === 'Particle Burst') {
      this.renderBurst(ctx, effectiveConfig, beatFactor, scaleFactor);
    } else if (p === 'Beat Explosion' || p === 'Circular Burst' || p === 'Shockwave Rings') {
      this.renderBurst(ctx, effectiveConfig, beatFactor, scaleFactor);
    } else if (p === 'Galaxy Spiral' || p === 'Gravity Well' || p === 'Magnetic Flow' || p === 'Interactive Orbit' || p === 'Audio Sphere') {
      this.renderVortex(ctx, effectiveConfig, beatFactor, scaleFactor);
    } else if (p === 'Neon Fireflies' || p === 'Treble Sparkles' || p === 'Frequency Swarm' || p === 'Color Shift Swarm') {
      this.renderSparkles(ctx, effectiveConfig, beatFactor, scaleFactor);
    } else if (p === 'Rising Bubbles' || p === 'Particle Fountain' || p === 'Music Note Rain') {
      this.renderFloatingDust(ctx, effectiveConfig, beatFactor, scaleFactor); // uses gravity up-like
    } else if (p === 'Trail Comets' || p === 'Meteor Shower') {
      this.renderMeteor(ctx, effectiveConfig, beatFactor, scaleFactor);
    } else if (p === 'Bass Pulse' || p === 'Midrange Drift' || p === 'Waveform Dust' || p === 'Audio Cloud') {
      this.renderFloatingDust(ctx, effectiveConfig, beatFactor, scaleFactor);
    } else {
      // floating-dust, Bintik (Dust), Particles Rise, and remaining new styles
      this.renderFloatingDust(ctx, effectiveConfig, beatFactor, scaleFactor);
    }

    // Restore particle velocities if they were zeroed out
    if (savedVelocities) {
      for (let i = 0; i < this.particles.length; i++) {
        const pt = this.particles[i];
        pt.vx = savedVelocities[i * 3];
        pt.vy = savedVelocities[i * 3 + 1];
        pt.vRot = savedVelocities[i * 3 + 2];
      }
    }

    ctx.restore();
  }

  private renderNeonRain(
    ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
    config: ParticleConfig,
    beatFactor: number,
    scaleFactor: number
  ) {
    ctx.strokeStyle = config.color || '#38bdf8';
    ctx.lineWidth = 1.8 * scaleFactor;
    for (let i = 0; i < this.particles.length; i++) {
      const p = this.particles[i];
      p.y += p.vy * (config.followBeat ? 1 + (beatFactor - 1) * 0.5 : 1.0);
      p.x += p.vx;
      if (p.y > this.height + 40 * scaleFactor) {
        p.y = -40 * scaleFactor;
        p.x = Math.random() * this.width;
      }
      ctx.globalAlpha = p.alpha * (config.opacity ?? 0.8);
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(p.x - p.vx * 2, p.y + p.size * 5 * scaleFactor);
      ctx.stroke();
    }
  }

  private renderMeteor(
    ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
    config: ParticleConfig,
    beatFactor: number,
    scaleFactor: number
  ) {
    ctx.strokeStyle = config.color || '#fbbf24';
    ctx.lineWidth = 2 * scaleFactor;
    for (let i = 0; i < this.particles.length; i++) {
      const p = this.particles[i];
      p.x += p.vx * (config.followBeat ? 1 + (beatFactor - 1) * 0.7 : 1.0);
      p.y += p.vy * (config.followBeat ? 1 + (beatFactor - 1) * 0.7 : 1.0);
      if (p.x < -100 * scaleFactor || p.y > this.height + 100 * scaleFactor) {
        p.x = this.width + Math.random() * 200 * scaleFactor;
        p.y = -Math.random() * 100 * scaleFactor;
      }
      ctx.globalAlpha = p.alpha * (config.opacity ?? 0.8);
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(p.x - p.vx * 3.5, p.y - p.vy * 3.5);
      ctx.stroke();
    }
  }

  private renderSmoke(
    ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
    config: ParticleConfig,
    beatFactor: number,
    scaleFactor: number
  ) {
    ctx.fillStyle = config.color || '#94a3b8';
    for (let i = 0; i < this.particles.length; i++) {
      const p = this.particles[i];
      p.x += p.vx * 0.8;
      p.y += p.vy * (config.followBeat ? 1 + (beatFactor - 1) * 0.3 : 1.0);
      if (p.y < -100 * scaleFactor) {
        p.y = this.height + 50 * scaleFactor;
        p.x = Math.random() * this.width;
      }
      const sz = p.baseSize * (config.followBeat ? 1 + (beatFactor - 1) * 0.2 : 1.0);
      ctx.globalAlpha = p.alpha * (config.opacity ?? 0.4) * 0.3;
      ctx.beginPath();
      
      const shape = (p as any).shape || 'circle';
      if (shape === 'triangle') {
        ctx.beginPath();
        ctx.moveTo(p.x, p.y - sz);
        ctx.lineTo(p.x + sz, p.y + sz);
        ctx.lineTo(p.x - sz, p.y + sz);
        ctx.closePath();
        ctx.fillStyle = p.color;
        ctx.fill();
      } else if (shape === 'square') {
        ctx.fillStyle = p.color;
        ctx.fillRect(p.x - sz, p.y - sz, sz * 2, sz * 2);
      } else if (shape === 'diamond') {
        ctx.beginPath();
        ctx.moveTo(p.x, p.y - sz);
        ctx.lineTo(p.x + sz, p.y);
        ctx.lineTo(p.x, p.y + sz);
        ctx.lineTo(p.x - sz, p.y);
        ctx.closePath();
        ctx.fillStyle = p.color;
        ctx.fill();
      } else if (shape === 'lightning') {
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x + sz, p.y + sz * 2);
        ctx.lineTo(p.x - sz * 0.5, p.y + sz);
        ctx.lineTo(p.x + sz * 0.3, p.y + sz * 3);
        ctx.strokeStyle = p.color;
        ctx.lineWidth = 1.5;
        ctx.stroke();
      } else if (shape === 'snow') {
        ctx.beginPath();
        for (let i = 0; i < 6; i++) {
          const a = (i / 6) * Math.PI * 2;
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(p.x + Math.cos(a) * sz, p.y + Math.sin(a) * sz);
        }
        ctx.strokeStyle = p.color;
        ctx.lineWidth = 1;
        ctx.stroke();
      } else if (shape === 'fire') {
        ctx.beginPath();
        ctx.moveTo(p.x, p.y - sz);
        ctx.quadraticCurveTo(p.x + sz, p.y, p.x, p.y + sz);
        ctx.quadraticCurveTo(p.x - sz, p.y, p.x, p.y - sz);
        ctx.fillStyle = p.color;
        ctx.fill();
      } else if (shape === 'star') {
        ctx.beginPath();
        for (let i = 0; i < 5; i++) {
          const a = (i / 5) * Math.PI * 2 - Math.PI / 2;
          const r = i % 2 === 0 ? sz : sz * 0.4;
          ctx.lineTo(p.x + Math.cos(a) * r, p.y + Math.sin(a) * r);
        }
        ctx.closePath();
        ctx.fillStyle = p.color;
        ctx.fill();
      } else {
        ctx.beginPath();
        ctx.arc(p.x, p.y, sz, 0, Math.PI * 2);
        ctx.fillStyle = p.color;
        ctx.fill();
      }

      // ctx.arc(p.x, p.y, sz, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  private renderVortex(
    ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
    config: ParticleConfig,
    beatFactor: number,
    scaleFactor: number
  ) {
    const cx = this.width / 2;
    const cy = this.height / 2;
    ctx.fillStyle = config.color || '#a855f7';
    for (let i = 0; i < this.particles.length; i++) {
      const p = this.particles[i];
      const dx = p.x - cx;
      const dy = p.y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;
      const angle = Math.atan2(dy, dx) + (0.015 * config.speed) * (config.followBeat ? 1 + (beatFactor - 1) * 0.5 : 1.0);
      const newDist = dist > 40 * scaleFactor ? dist - 0.4 * config.speed * scaleFactor : Math.random() * (this.width * 0.45);
      p.x = cx + Math.cos(angle) * newDist;
      p.y = cy + Math.sin(angle) * newDist;
      ctx.globalAlpha = p.alpha * (config.opacity ?? 0.8);
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.baseSize * (config.followBeat ? 1 + (beatFactor - 1) * 0.3 : 1.0), 0, Math.PI * 2);
      ctx.fill();
    }
  }

  private renderSparkles(
    ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
    config: ParticleConfig,
    beatFactor: number,
    scaleFactor: number
  ) {
    ctx.fillStyle = config.color || '#fef08a';
    ctx.globalAlpha = config.opacity ?? 0.8;
    const beatMult = config.followBeat ? 1 + (beatFactor - 1) * 0.4 : 1.0;
    const count = this.particles.length;

    ctx.beginPath();
    for (let i = 0; i < count; i++) {
      const p = this.particles[i];
      p.rotation += 0.05;
      p.x += p.vx;
      p.y += p.vy;
      if (p.x < 0) p.x = this.width;
      if (p.x > this.width) p.x = 0;
      if (p.y < 0) p.y = this.height;
      if (p.y > this.height) p.y = 0;
      const sz = p.baseSize * (1 + Math.sin(p.rotation) * 0.4) * beatMult;
      ctx.moveTo(p.x + sz, p.y);
      ctx.arc(p.x, p.y, sz, 0, Math.PI * 2);
    }
    ctx.fill();
  }

  private renderBurst(
    ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
    config: ParticleConfig,
    beatFactor: number,
    scaleFactor: number
  ) {
    const cx = this.width / 2;
    const cy = this.height / 2;
    ctx.fillStyle = config.color || '#38bdf8';
    ctx.globalAlpha = config.opacity ?? 0.85;
    const posBeat = config.followBeat ? 1 + (beatFactor - 1) * 0.8 : 1.0;
    const sizeMult = config.followBeat ? 1 + (beatFactor - 1) * 0.4 : 1.0;
    const count = this.particles.length;

    ctx.beginPath();
    for (let i = 0; i < count; i++) {
      const p = this.particles[i];
      p.x += p.vx * posBeat;
      p.y += p.vy * posBeat;
      if (p.x < 0 || p.x > this.width || p.y < 0 || p.y > this.height) {
        p.x = cx + (Math.random() - 0.5) * 50 * scaleFactor;
        p.y = cy + (Math.random() - 0.5) * 50 * scaleFactor;
      }
      const sz = p.baseSize * sizeMult;
      ctx.moveTo(p.x + sz, p.y);
      ctx.arc(p.x, p.y, sz, 0, Math.PI * 2);
    }
    ctx.fill();
  }

  private renderBokeh(
    ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
    config: ParticleConfig,
    beatFactor: number,
    scaleFactor: number
  ) {
    for (let i = 0; i < this.particles.length; i++) {
      const p = this.particles[i];
      p.x += p.vx * (config.followBeat ? 1 + (beatFactor - 1) * 0.35 : 1.0);
      p.y += p.vy * (config.followBeat ? 1 + (beatFactor - 1) * 0.35 : 1.0);

      if (p.x < -60 * scaleFactor) p.x = this.width + 60 * scaleFactor;
      if (p.x > this.width + 60 * scaleFactor) p.x = -60 * scaleFactor;
      if (p.y < -60 * scaleFactor) p.y = this.height + 60 * scaleFactor;
      if (p.y > this.height + 60 * scaleFactor) p.y = -60 * scaleFactor;

      const currentSize = config.followBeat ? p.baseSize * (1 + (beatFactor - 1) * 0.35) : p.baseSize;
      ctx.fillStyle = p.color;

      // Outer halo
      ctx.globalAlpha = p.alpha * (config.opacity ?? 0.6) * 0.25;
      ctx.beginPath();
      ctx.arc(p.x, p.y, currentSize * 1.4, 0, Math.PI * 2);
      ctx.fill();

      // Inner core
      ctx.globalAlpha = p.alpha * (config.opacity ?? 0.6) * 0.75;
      ctx.beginPath();
      ctx.arc(p.x, p.y, currentSize, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  private renderConfetti(
    ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
    config: ParticleConfig,
    beatFactor: number,
    scaleFactor: number
  ) {
    for (let i = 0; i < this.particles.length; i++) {
      const p = this.particles[i];
      p.x += (p.vx + Math.sin(p.rotation) * 0.8 * scaleFactor) * (config.followBeat ? 1 + (beatFactor - 1) * 0.4 : 1.0);
      p.y += p.vy * (config.followBeat ? 1 + (beatFactor - 1) * 0.4 : 1.0);
      p.rotation += p.vRot;

      if (p.x < -30 * scaleFactor) p.x = this.width + 30 * scaleFactor;
      if (p.x > this.width + 30 * scaleFactor) p.x = -30 * scaleFactor;
      if (p.y > this.height + 30 * scaleFactor) {
        p.y = -30 * scaleFactor;
        p.x = Math.random() * this.width;
      }

      const currentSize = config.followBeat ? p.baseSize * (1 + (beatFactor - 1) * 0.25) : p.baseSize;
      ctx.globalAlpha = p.alpha * (config.opacity ?? 0.8);
      ctx.fillStyle = p.color;

      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rotation);
      ctx.fillRect(-currentSize, -currentSize * 0.4, currentSize * 2, currentSize * 0.8);
      ctx.restore();
    }
  }

  private renderSnow(
    ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
    config: ParticleConfig,
    beatFactor: number,
    scaleFactor: number
  ) {
    ctx.fillStyle = config.color || '#ffffff';
    const beatMult = config.followBeat ? 1 + (beatFactor - 1) * 0.2 : 1.0;
    const count = this.particles.length;

    // Batched single path to eliminate hundreds of individual fill calls
    ctx.globalAlpha = config.opacity ?? 0.8;
    ctx.beginPath();
    for (let i = 0; i < count; i++) {
      const p = this.particles[i];
      p.rotation += p.vRot;
      p.x += (p.vx + Math.sin(p.rotation * 2) * 0.6 * scaleFactor) * beatMult;
      p.y += p.vy * beatMult;

      if (p.x < -20 * scaleFactor) p.x = this.width + 20 * scaleFactor;
      if (p.x > this.width + 20 * scaleFactor) p.x = -20 * scaleFactor;
      if (p.y > this.height + 20 * scaleFactor) {
        p.y = -20 * scaleFactor;
        p.x = Math.random() * this.width;
      }

      const currentSize = config.followBeat ? p.baseSize * beatMult : p.baseSize;
      ctx.moveTo(p.x + currentSize, p.y);
      ctx.arc(p.x, p.y, currentSize, 0, Math.PI * 2);
    }
    ctx.fill();
  }

  private renderSparks(
    ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
    config: ParticleConfig,
    beatFactor: number,
    scaleFactor: number
  ) {
    const beatMult = config.followBeat ? 1 + (beatFactor - 1) * 0.8 : 1.0;
    const count = this.particles.length;

    ctx.globalAlpha = config.opacity ?? 0.9;
    ctx.strokeStyle = config.color || '#fbbf24';
    ctx.beginPath();
    for (let i = 0; i < count; i++) {
      const p = this.particles[i];
      p.x += p.vx * beatMult;
      p.y += p.vy * beatMult;

      if (p.x < -30 * scaleFactor) p.x = this.width + 30 * scaleFactor;
      if (p.x > this.width + 30 * scaleFactor) p.x = -30 * scaleFactor;
      if (p.y < -30 * scaleFactor) {
        p.y = this.height + 30 * scaleFactor;
        p.x = Math.random() * this.width;
      }

      ctx.moveTo(p.x, p.y);
      ctx.lineTo(p.x - p.vx * 3, p.y - p.vy * 3);
    }
    ctx.lineWidth = Math.max(1.5 * scaleFactor, (config.size || 6) * 0.5 * scaleFactor);
    ctx.stroke();
  }

  private renderFloatingDust(
    ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
    config: ParticleConfig,
    beatFactor: number,
    scaleFactor: number
  ) {
    ctx.fillStyle = config.color || '#ffffff';
    const beatMult = config.followBeat ? 1 + (beatFactor - 1) * 0.35 : 1.0;
    const sizeMult = config.followBeat ? 1 + (beatFactor - 1) * 0.25 : 1.0;
    const count = this.particles.length;

    // Batched single-path dispatch (1 draw call vs 300 individual calls)
    ctx.globalAlpha = config.opacity ?? 0.8;
    ctx.beginPath();
    for (let i = 0; i < count; i++) {
      const p = this.particles[i];
      p.x += p.vx * beatMult;
      p.y += p.vy * beatMult;

      if (p.x < -20 * scaleFactor) p.x = this.width + 20 * scaleFactor;
      if (p.x > this.width + 20 * scaleFactor) p.x = -20 * scaleFactor;
      if (p.y < -20 * scaleFactor) p.y = this.height + 20 * scaleFactor;
      if (p.y > this.height + 20 * scaleFactor) p.y = -20 * scaleFactor;

      const currentSize = p.baseSize * sizeMult;
      ctx.moveTo(p.x + currentSize, p.y);
      ctx.arc(p.x, p.y, currentSize, 0, Math.PI * 2);
    }
    ctx.fill();
  }
}
