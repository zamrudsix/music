import { projectStore, registerAudioPlaybackStopper } from '../stores/project.svelte';

export class AudioEngine {
  private ctx: AudioContext | null = null;
  private source: AudioBufferSourceNode | null = null;
  private startTime: number = 0;
  private pauseOffset: number = 0;

  getAudioContext(): AudioContext {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    return this.ctx;
  }

  async play(buffer: AudioBuffer, offset: number = 0) {
    this.stop();
    const ctx = this.getAudioContext();
    if (ctx.state === 'suspended') {
      await ctx.resume();
    }

    this.source = ctx.createBufferSource();
    this.source.buffer = buffer;
    this.source.connect(ctx.destination);

    this.pauseOffset = Math.max(0, Math.min(offset, buffer.duration));
    this.startTime = ctx.currentTime - this.pauseOffset;

    this.source.start(0, this.pauseOffset);
    projectStore.isPlaying = true;

    this.source.onended = () => {
      if (this.getCurrentTime() >= buffer.duration) {
        projectStore.isPlaying = false;
        projectStore.currentTime = 0;
        this.pauseOffset = 0;
      }
    };
  }

  pause() {
    if (this.source) {
      this.pauseOffset = this.getCurrentTime();
      try {
        this.source.stop();
        this.source.disconnect();
      } catch (e) {}
      this.source = null;
    }
    projectStore.isPlaying = false;
  }

  stop() {
    if (this.source) {
      try {
        this.source.stop();
        this.source.disconnect();
      } catch (e) {}
      this.source = null;
    }
    projectStore.isPlaying = false;
  }

  seek(time: number, buffer: AudioBuffer | null) {
    this.pauseOffset = time;
    projectStore.currentTime = time;
    if (projectStore.isPlaying && buffer) {
      this.play(buffer, time);
    }
  }

  getCurrentTime(): number {
    if (!this.ctx || !projectStore.isPlaying) {
      return this.pauseOffset;
    }
    return Math.max(0, this.ctx.currentTime - this.startTime);
  }

  dispose() {
    this.stop();
    if (this.ctx) {
      this.ctx.close().catch(() => {});
      this.ctx = null;
    }
  }
}

export const audioEngine = new AudioEngine();

registerAudioPlaybackStopper(() => audioEngine.stop());
