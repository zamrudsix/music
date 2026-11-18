import type { ProjectConfig, AudioTrackItem, TextOverlayItem, SpectrumConfig } from '../types/project';
import { db } from '../db/database';
import { AudioAnalyzer } from '../audio/analyzer';
import { backgroundManager } from '../../features/backdrop';
import { imageOverlayManager, videoOverlayManager } from '../../features/overlays';
import { fontManager } from '../../features/texts';
import { zipSync, unzipSync, strToU8, strFromU8 } from 'fflate';
import { isDesktop } from '../utils/platform';

let audioPlaybackStopper: (() => void) | null = null;
export function registerAudioPlaybackStopper(cb: () => void) {
  audioPlaybackStopper = cb;
}

/**
 * Decode audio at a controlled sample rate to avoid allocating enormous PCM
 * buffers for long music files. Tries low sample rates first (22.05 → 16 → 8 kHz),
 * then falls back to the browser default. After a successful decode, the buffer
 * is immediately reduced to 16 kHz mono to keep peak and retained memory low.
 */
async function decodeAudioDataResilient(source: Blob | ArrayBuffer): Promise<AudioBuffer> {
  const arrayBuf = source instanceof Blob ? await source.arrayBuffer() : source;
  const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
  if (!AudioCtxClass) throw new Error('Browser ini tidak mendukung Web Audio API.');

  const tryDecode = async (sampleRate?: number): Promise<AudioBuffer> => {
    let ctx: AudioContext | null = null;
    try {
      ctx = sampleRate != null ? new AudioCtxClass({ sampleRate }) : new AudioCtxClass();
      if (ctx.state === 'suspended') await ctx.resume().catch(() => {});
      // decodeAudioData may detach its input buffer; always pass a fresh copy.
      const bufferCopy = arrayBuf.slice(0);
      const decoded = await new Promise<AudioBuffer>((resolve, reject) => {
        let settled = false;
        const finish = (fn: (value: any) => void, value: any) => {
          if (settled) return;
          settled = true;
          fn(value);
        };
        try {
          const result = ctx!.decodeAudioData(
            bufferCopy,
            (buffer) => finish(resolve, buffer),
            (error) => finish(reject, error || new Error('Format audio tidak dapat dibaca.'))
          );
          if (result && typeof result.then === 'function') {
            result.then((buffer) => finish(resolve, buffer))
              .catch((error) => finish(reject, error));
          }
        } catch (error) {
          finish(reject, error);
        }
      });
      return decoded;
    } finally {
      if (ctx && ctx.state !== 'closed') await ctx.close().catch(() => {});
    }
  };

  const rates: (number | undefined)[] = [22050, 16000, 8000, undefined];
  let lastError: unknown;
  let decoded: AudioBuffer | null = null;

  for (const rate of rates) {
    try {
      decoded = await tryDecode(rate);
      break;
    } catch (error) {
      lastError = error;
    }
  }

  if (!decoded) {
    const detail = lastError instanceof Error ? lastError.message : String(lastError || 'unknown error');
    throw new Error(
      `Audio tidak dapat di-decode (dicoba 22.05/16/8 kHz dan rate default). File mungkin rusak atau melebihi kapasitas memori perangkat. Detail: ${detail}`
    );
  }

  // Immediately reduce to 16 kHz mono to free memory for long tracks
  return reduceTo16kMono(decoded);
}

/**
 * Resample + mix-down to 16 kHz mono using OfflineAudioContext.
 * No-op if the buffer is already ≤16 kHz and mono.
 */
async function reduceTo16kMono(buffer: AudioBuffer): Promise<AudioBuffer> {
  if (buffer.sampleRate <= 16000 && buffer.numberOfChannels === 1) return buffer;

  const targetRate = 16000;
  const targetLength = Math.max(1, Math.round(buffer.duration * targetRate));
  const OfflineCtx = window.OfflineAudioContext || (window as any).webkitOfflineAudioContext;
  if (!OfflineCtx) return buffer; // best-effort fallback

  try {
    const offline = new OfflineCtx(1, targetLength, targetRate);
    const source = offline.createBufferSource();
    source.buffer = buffer;
    source.connect(offline.destination);
    source.start(0);
    return await offline.startRendering();
  } catch {
    // If resampling fails, return the original (caller already succeeded at decoding)
    return buffer;
  }
}

const DEFAULT_PROJECT: ProjectConfig = {
  id: 'default-project',
  title: 'Untitled Track Visualizer',
  createdAt: Date.now(),
  updatedAt: Date.now(),
  audio: {
    fileName: '',
    fileSize: 0,
    duration: 0,
    beatSensitivity: 1.2,
    tracks: [],
  },
  background: {
    type: 'single-image',
    items: [],
    transition: 'crossfade',
    transitionDuration: 1.0,
    scaleMode: 'cover',
    brightness: 1.0,
    followBeat: false,
    beatSensitivity: 1.0,
    motionEffect: 'random',
    motionIntensity: 1.0,
  },
  overlays: {
    particle: {
      enabled: true,
      preset: 'floating-dust',
      count: 60,
      size: 4,
      speed: 1.0,
      color: '#ffffff',
      opacity: 0.6,
      gravity: 'float',
      followBeat: true,
      beatSensitivity: 1.0,
      bassSensitivity: 1.0,
      trebleSensitivity: 1.0,
      glow: true,
      rainbow: false,
    },
    spectrum: {
      id: 'spectrum-default',
      name: 'Spectrum 1',
      enabled: true,
      style: 'circular',
      barCount: 64,
      color: '#38bdf8',
      secondaryColor: '#ec4899',
      height: 120,
      radius: 140,
      opacity: 0.9,
      mirror: false,
      followBeat: true,
      beatSensitivity: 1.2,
      x: 0.5,
      y: 0.5,
      scale: 1.0,
    },
    spectrums: [
      {
        id: 'spectrum-default',
        name: 'Spectrum 1',
        enabled: true,
        style: 'circular',
        barCount: 64,
        color: '#38bdf8',
        secondaryColor: '#ec4899',
        height: 120,
        radius: 140,
        opacity: 0.9,
        mirror: false,
        followBeat: true,
        beatSensitivity: 1.2,
        x: 0.5,
        y: 0.5,
        scale: 1.0,
      }
    ],
    images: [],
    videos: [],
    texts: [],
    tracklist: {
      enabled: false,
      title: 'TRACKLIST',
      showTitle: true,
      fontFamily: 'Inter',
      fontSize: 26,
      titleFontSize: 36,
      color: '#ffffff',
      activeColor: '#38bdf8',
      accentColor: '#38bdf8',
      x: 0.08,
      y: 0.15,
      alignment: 'left',
      lineSpacing: 42,
      opacity: 1.0,
      shadow: true,
      shadowColor: 'rgba(0, 0, 0, 0.9)',
      stroke: false,
      strokeColor: '#000000',
      strokeWidth: 3,
      nowPlayingAnimation: 'glow-badge',
      followBeat: true,
      beatSensitivity: 1.0,
      showNumbers: true,
      showDuration: true,
    },
    layerOrder: ['background', 'videos', 'images', 'texts', 'spectrum', 'particle', 'lyrics'],
  },
  lyrics: {
    segments: [],
    config: {
      enabled: true,
      style: 'karaoke',
      fontFamily: 'Inter',
      fontSize: 36,
      color: '#e2e8f0',
      highlightColor: '#38bdf8',
      position: 'bottom',
      alignment: 'center',
      x: 0.5,
      y: 0.85,
      animation: 'none',
      followBeat: false,
      beatSensitivity: 1.0,
      language: 'id',
      glow: true,
      stroke: false,
      strokeColor: '#000000',
      strokeWidth: 4,
    },
  },
  customFonts: [],
  exportSettings: {
    resolution: '1920x1080',
    width: 1920,
    height: 1080,
    fps: 30,
    format: 'mp4',
    videoBitrate: 8_000_000,
    bitrateMode: 'variable',
    keyframeIntervalSeconds: 2,
    audioBitrate: 192_000,
    exportRange: {
      enabled: false,
      startTime: 0,
      endTime: 30,
    },
  },
};

class ProjectState {
  project = $state<ProjectConfig>(structuredClone(DEFAULT_PROJECT));
  private undoStack: ProjectConfig[] = [];
  private readonly MAX_UNDO = 30;
  private originalAudioBackup: { buffer: AudioBuffer | null; tracks: any[] } | null = null;

  pushUndo() {
    try {
      const snap = structuredClone(this.project);
      this.undoStack.push(snap);
      if (this.undoStack.length > this.MAX_UNDO) this.undoStack.shift();
    } catch {}
  }

  async undo() {
    if (!this.originalAudioBackup && this.undoStack.length === 0) return;

    // Restore project config if we have a snapshot
    const prev = this.undoStack.pop();
    if (prev) {
      this.project = structuredClone(prev);
    }

    // Always restore original audio duration if backup exists
    if (this.originalAudioBackup && this.originalAudioBackup.buffer) {
      this.audioBuffer = this.originalAudioBackup.buffer;
      this.project.audio.duration = this.audioBuffer.duration;
      this.project.audio.tracks = this.originalAudioBackup.tracks.map(t => ({...t}));
      this.trackBuffers.clear();
      if (this.project.audio.tracks?.[0]) {
        this.trackBuffers.set(this.project.audio.tracks[0].id, this.audioBuffer);
      }
      // Reset any active trim range
      if (this.project.exportSettings.exportRange) {
        this.project.exportSettings.exportRange.enabled = false;
        this.project.exportSettings.exportRange.startTime = 0;
        this.project.exportSettings.exportRange.endTime = this.audioBuffer.duration;
      }
    }
    await this.saveToDB();
    alert(`Undo: durasi kembali ke ${Math.round(this.project.audio.duration)} detik`);
  }

  /**
   * Permanently trim audio to the current exportRange.
   * Remaining audio outside the range is deleted.
   */
  async trimAudioToRange() {
    const range = this.project.exportSettings.exportRange;
    if (!range || !range.enabled || !this.audioBuffer) return;

    this.pushUndo();
    // Backup original audio before first trim
    if (!this.originalAudioBackup && this.audioBuffer) {
      this.originalAudioBackup = {
        buffer: this.audioBuffer,
        tracks: (this.project.audio.tracks || []).map(t => ({
          id: t.id,
          name: t.name,
          fileSize: t.fileSize,
          duration: t.duration,
          url: t.url,
          filePath: t.filePath,
        })),
      };
    }

    const start = Math.max(0, range.startTime);
    const end = Math.min(this.audioBuffer.duration, range.endTime);
    if (end - start < 0.05) return;

    const sampleRate = this.audioBuffer.sampleRate;
    const channels = this.audioBuffer.numberOfChannels;
    const startSample = Math.floor(start * sampleRate);
    const endSample = Math.floor(end * sampleRate);
    const length = Math.max(1, endSample - startSample);

    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const newBuffer = ctx.createBuffer(channels, length, sampleRate);

    for (let c = 0; c < channels; c++) {
      const oldData = this.audioBuffer.getChannelData(c);
      const newData = newBuffer.getChannelData(c);
      newData.set(oldData.subarray(startSample, startSample + length));
    }

    // Replace the main buffer permanently
    this.audioBuffer = newBuffer;
    this.project.audio.duration = newBuffer.duration;
    this.project.audio.fileName = `Trimmed (${newBuffer.duration.toFixed(2)}s)`;

    // Clear original tracks so rebuildMergedAudio doesn't restore full audio
    this.project.audio.tracks = [];
    this.trackBuffers.clear();

    // Create a single virtual track from the trimmed buffer
    const trackId = 'trimmed-' + Date.now();
    this.project.audio.tracks = [{
      id: trackId,
      name: `Trimmed Audio (${newBuffer.duration.toFixed(2)}s)`,
      fileSize: length * channels * 4,
      duration: newBuffer.duration,
    }];
    this.trackBuffers.set(trackId, newBuffer);

    // Reset range
    range.startTime = 0;
    range.endTime = newBuffer.duration;
    range.enabled = false;

    this.beats = [];
    this.frequencyFrames = [];
    this.currentTime = 0;

    await this.saveToDB();
    alert(`Audio dipotong permanen menjadi ${newBuffer.duration.toFixed(2)} detik. Sisa dihapus.`);
  }

  currentTime = $state<number>(0);
  isPlaying = $state<boolean>(false);
  activeTab = $state<'background' | 'particles' | 'spectrum' | 'lyrics' | 'images' | 'texts' | 'tracklist-overlay' | 'tracklist-png' | 'export'>('background');
  selectedLayer = $state<string | null>(null);
  audioBuffer = $state<AudioBuffer | null>(null);
  beats = $state<number[]>([]);
  flatFrequencyBuffer: Uint8Array | null = null;
  frequencyFrames: Uint8Array[] = [];
  frameDuration = $state<number>(0.0116);
  isProcessingAudio = $state<boolean>(false);
  analysisProgress = $state<number>(0);
  isAutosaving = $state<boolean>(false);
  lastSavedTime = $state<number | null>(null);

  private trackBuffers = new Map<string, AudioBuffer>();

  async addAudioTracks(files: FileList | File[]) {
    this.isProcessingAudio = true;
    this.analysisProgress = 0.05;
    try {
      const fileArray = Array.from(files);
      const total = fileArray.length;

      for (let i = 0; i < total; i++) {
        const file = fileArray[i];
        this.analysisProgress = 0.05 + (i / total) * 0.4;
        const url = URL.createObjectURL(file);

        const trackId = 'track-' + Math.random().toString(36).substring(2, 9);
        const decodedBuffer = await decodeAudioDataResilient(file);

        const newTrack: AudioTrackItem = {
          id: trackId,
          name: file.name,
          fileSize: file.size,
          duration: decodedBuffer.duration,
          url,
          file,
        };

        this.trackBuffers.set(trackId, decodedBuffer);

        try {
          await db.assets.put({
            id: trackId,
            projectId: this.project.id,
            name: file.name,
            type: 'audio',
            blob: file,
            createdAt: Date.now(),
          });
        } catch (err) {
          console.warn('Could not cache audio in IndexedDB:', err);
        }

        if (!this.project.audio.tracks) {
          this.project.audio.tracks = [];
        }
        this.project.audio.tracks.push(newTrack);
      }

      // Rebuild & analyze only ONCE after all files are added
      await this.rebuildMergedAudio();
      await this.saveToDB();
    } catch (e: any) {
      alert('Failed to load audio tracks: ' + e.message);
    } finally {
      this.isProcessingAudio = false;
    }
  }

  async addAudioTrack(file: File) {
    await this.addAudioTracks([file]);
  }

  async rebuildMergedAudio() {
    if (!this.project.audio.tracks || this.project.audio.tracks.length === 0) {
      this.audioBuffer = null;
      this.beats = [];
      this.frequencyFrames = [];
      this.project.audio.fileName = '';
      this.project.audio.duration = 0;
      return;
    }

    const buffers: AudioBuffer[] = [];

    for (const t of this.project.audio.tracks) {
      let b = this.trackBuffers.get(t.id);
      if (!b) {
        try {
          if (t.file) {
            b = await decodeAudioDataResilient(t.file);
            this.trackBuffers.set(t.id, b);
          } else if (t.url) {
            const resp = await fetch(t.url);
            const blob = await resp.blob();
            b = await decodeAudioDataResilient(blob);
            this.trackBuffers.set(t.id, b);
          }
        } catch (err) {
          console.warn('Could not decode individual track:', t.name, err);
        }
      }
      if (b) buffers.push(b);
    }

    if (buffers.length > 0) {
      const merged = AudioAnalyzer.concatenateAudioBuffers(buffers);
      this.audioBuffer = merged;
      this.project.audio.fileName = `${this.project.audio.tracks.length} Tracks Combined (${Math.round(merged.duration)}s)`;
      this.project.audio.duration = merged.duration;
      // Always keep a fresh original backup when audio is loaded
      this.originalAudioBackup = {
        buffer: merged,
        tracks: (this.project.audio.tracks || []).map(t => ({
          id: t.id,
          name: t.name,
          fileSize: t.fileSize,
          duration: t.duration,
          url: t.url,
          filePath: t.filePath,
        })),
      };
      this.project.updatedAt = Date.now();

      // Free individual track buffers from memory immediately!
      // Once merged, trackBuffers are duplicate RAM (saves ~500MB RAM on 12 tracks)
      this.trackBuffers.clear();

      const analysis = await AudioAnalyzer.extractBeatMap(
        merged,
        this.project.audio.beatSensitivity,
        (prog) => {
          this.analysisProgress = prog;
        }
      );
      this.beats = analysis.beatMap.beats;
      this.frequencyFrames = analysis.frequencyFrames;
      this.flatFrequencyBuffer = analysis.flatFrequencyBuffer;
      this.frameDuration = analysis.frameDuration;
    }
  }

  async moveAudioTrackUp(index: number) {
    if (!this.project.audio.tracks || index <= 0) return;
    const tracks = this.project.audio.tracks;
    const temp = tracks[index];
    tracks[index] = tracks[index - 1];
    tracks[index - 1] = temp;
    await this.rebuildMergedAudio();
    this.saveToDB();
  }

  async moveAudioTrackDown(index: number) {
    if (!this.project.audio.tracks || index >= this.project.audio.tracks.length - 1) return;
    const tracks = this.project.audio.tracks;
    const temp = tracks[index];
    tracks[index] = tracks[index + 1];
    tracks[index + 1] = temp;
    await this.rebuildMergedAudio();
    await this.saveToDB();
  }

  async removeAudioTrack(trackId: string) {
    if (!this.project.audio.tracks) return;
    const track = this.project.audio.tracks.find((t) => t.id === trackId);
    if (track?.url && track.url.startsWith('blob:')) {
      URL.revokeObjectURL(track.url);
    }
    this.project.audio.tracks = this.project.audio.tracks.filter((t) => t.id !== trackId);
    this.trackBuffers.delete(trackId);
    try {
      await db.assets.delete(trackId);
    } catch (e) {}

    if (this.project.audio.tracks.length === 0) {
      await this.clearAllAudioTracks();
      return;
    }

    await this.rebuildMergedAudio();
    await this.saveToDB();
  }

  async clearAllAudioTracks() {
    audioPlaybackStopper?.();
    for (const t of this.project.audio.tracks || []) {
      if (t.url && t.url.startsWith('blob:')) {
        URL.revokeObjectURL(t.url);
      }
      try {
        await db.assets.delete(t.id);
      } catch (e) {}
    }
    this.trackBuffers.clear();
    this.project.audio.tracks = [];
    this.project.audio.fileName = '';
    this.project.audio.duration = 0;
    this.project.audio.url = '';
    this.audioBuffer = null;
    this.beats = [];
    this.frequencyFrames = [];
    this.currentTime = 0;
    this.isPlaying = false;
    await this.saveToDB();
  }

  /**
   * Reset and create a fresh project without remnants of previous assets
   */
  async createNewProject() {
    audioPlaybackStopper?.();

    // Revoke previous object URLs
    for (const t of this.project.audio.tracks || []) {
      if (t.url?.startsWith('blob:')) URL.revokeObjectURL(t.url);
    }
    for (const bg of this.project.background.items || []) {
      if (bg.url?.startsWith('blob:')) URL.revokeObjectURL(bg.url);
    }
    for (const img of this.project.overlays.images || []) {
      if (img.url?.startsWith('blob:')) URL.revokeObjectURL(img.url);
    }
    for (const vid of this.project.overlays.videos || []) {
      if (vid.url?.startsWith('blob:')) URL.revokeObjectURL(vid.url);
    }

    // Clear assets from IndexedDB
    try {
      await db.assets.clear();
      await db.projects.clear();
    } catch (e) {
      console.warn('Could not clear IndexedDB on new project:', e);
    }

    this.trackBuffers.clear();
    this.audioBuffer = null;
    this.beats = [];
    this.frequencyFrames = [];
    this.currentTime = 0;
    this.isPlaying = false;

    try {
      backgroundManager.releaseAsset?.(this.project.id);
    } catch (e) {}

    const freshId = 'project-' + Date.now();
    this.project = {
      ...structuredClone(DEFAULT_PROJECT),
      id: freshId,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    await this.saveToDB();
  }

  clearLyrics() {
    this.project.lyrics.segments = [];
    this.saveToDB();
  }

  addSpectrum() {
    if (!this.project.overlays.spectrums) {
      this.project.overlays.spectrums = [{ ...this.project.overlays.spectrum }];
    }
    const idx = this.project.overlays.spectrums.length + 1;
    const newSpectrum: SpectrumConfig = {
      ...structuredClone(DEFAULT_PROJECT.overlays.spectrum),
      id: 'spectrum-' + Math.random().toString(36).substring(2, 9),
      name: `Spectrum ${idx}`,
      color: idx % 2 === 0 ? '#ec4899' : '#38bdf8',
      secondaryColor: idx % 2 === 0 ? '#38bdf8' : '#a855f7',
      y: Math.min(0.85, 0.4 + (idx - 1) * 0.15),
    };
    this.project.overlays.spectrums.push(newSpectrum);
    this.syncActiveSpectrum();
    this.saveToDB();
    return newSpectrum;
  }

  duplicateSpectrum(spectrumId: string) {
    if (!this.project.overlays.spectrums) {
      this.project.overlays.spectrums = [{ ...this.project.overlays.spectrum }];
    }
    const target = this.project.overlays.spectrums.find(s => s.id === spectrumId);
    if (!target) return;
    const idx = this.project.overlays.spectrums.length + 1;
    const clone: SpectrumConfig = {
      ...structuredClone(target),
      id: 'spectrum-' + Math.random().toString(36).substring(2, 9),
      name: `${target.name || 'Spectrum'} (Copy)`,
      y: Math.min(0.9, target.y + 0.05),
    };
    this.project.overlays.spectrums.push(clone);
    this.syncActiveSpectrum();
    this.saveToDB();
    return clone;
  }

  removeSpectrum(spectrumId: string) {
    if (!this.project.overlays.spectrums) return;
    // Always keep at least 1 spectrum
    if (this.project.overlays.spectrums.length <= 1) {
      return;
    }
    this.project.overlays.spectrums = this.project.overlays.spectrums.filter(s => s.id !== spectrumId);
    this.syncActiveSpectrum();
    this.saveToDB();
  }

  syncActiveSpectrum() {
    if (this.project.overlays.spectrums && this.project.overlays.spectrums.length > 0) {
      this.project.overlays.spectrum = this.project.overlays.spectrums[0];
    }
  }

  addTextOverlay() {
    if (!this.project.overlays.texts) {
      this.project.overlays.texts = [];
    }
    const newText: TextOverlayItem = {
      id: 'text-' + Math.random().toString(36).substring(2, 9),
      text: 'Sample Text Overlay',
      fontFamily: 'Inter',
      fontSize: 48,
      color: '#ffffff',
      accentColor: '#38bdf8',
      x: 0.5,
      y: 0.3,
      alignment: 'center',
      opacity: 1.0,
      rotation: 0,
      shadow: true,
      shadowColor: 'rgba(0, 0, 0, 0.9)',
      animation: 'floating',
      followBeat: true,
      beatSensitivity: 1.0,
      startTime: 0,
      endTime: 0,
      transition: 'none',
      transitionDuration: 0.5,
    };
    this.project.overlays.texts.push(newText);
    this.saveToDB();
  }

  removeTextOverlay(id: string) {
    if (!this.project.overlays.texts) return;
    this.project.overlays.texts = this.project.overlays.texts.filter((t) => t.id !== id);
    this.saveToDB();
  }

  updateExportResolution(res: ProjectConfig['exportSettings']['resolution']) {
    this.project.exportSettings.resolution = res;
    const [w, h] = res.split('x').map(Number);
    this.project.exportSettings.width = w;
    this.project.exportSettings.height = h;
    this.saveToDB();
  }

  private saveDebounceTimer: any = null;

  async saveToDB(debounceMs: number = 0) {
    if (debounceMs > 0) {
      if (this.saveDebounceTimer) {
        clearTimeout(this.saveDebounceTimer);
      }
      this.saveDebounceTimer = setTimeout(() => {
        this.saveDebounceTimer = null;
        this.saveToDB(0);
      }, debounceMs);
      return;
    }

    if (this.saveDebounceTimer) {
      clearTimeout(this.saveDebounceTimer);
      this.saveDebounceTimer = null;
    }

    this.isAutosaving = true;
    try {
      const plainConfig = $state.snapshot(this.project) as unknown as ProjectConfig;
      await db.projects.put({
        id: this.project.id,
        title: this.project.title,
        config: plainConfig,
        updatedAt: Date.now(),
      });
      this.lastSavedTime = Date.now();
    } catch (e) {
      console.warn('Autosave to IndexedDB failed:', e);
    } finally {
      this.isAutosaving = false;
    }
  }

  async loadFromDB(): Promise<boolean> {
    try {
      const stored = await db.projects.get('default-project');
      if (stored && stored.config) {
        this.project = {
          ...structuredClone(DEFAULT_PROJECT),
          ...stored.config,
          audio: {
            ...DEFAULT_PROJECT.audio,
            ...stored.config.audio,
            tracks: stored.config.audio?.tracks || [],
          },
          background: {
            ...DEFAULT_PROJECT.background,
            ...stored.config.background,
            items: stored.config.background?.items || [],
            brightness: stored.config.background?.brightness ?? 1.0,
          },
          overlays: {
            ...DEFAULT_PROJECT.overlays,
            ...stored.config.overlays,
            spectrum: {
              ...DEFAULT_PROJECT.overlays.spectrum,
              ...stored.config.overlays?.spectrum,
            },
            spectrums: Array.isArray(stored.config.overlays?.spectrums) && stored.config.overlays.spectrums.length > 0
              ? stored.config.overlays.spectrums.map((s, idx) => ({
                  ...DEFAULT_PROJECT.overlays.spectrum,
                  ...s,
                  id: s.id || `spectrum-${idx}-${Date.now()}`,
                  name: s.name || `Spectrum ${idx + 1}`
                }))
              : [{
                  ...DEFAULT_PROJECT.overlays.spectrum,
                  ...(stored.config.overlays?.spectrum || {})
                }],
            images: stored.config.overlays?.images || [],
            videos: stored.config.overlays?.videos || [],
            texts: stored.config.overlays?.texts || [],
            tracklist: {
              ...DEFAULT_PROJECT.overlays.tracklist!,
              ...stored.config.overlays?.tracklist,
            },
          },
          lyrics: {
            ...DEFAULT_PROJECT.lyrics,
            ...stored.config.lyrics,
            segments: stored.config.lyrics?.segments || [],
            config: {
              ...DEFAULT_PROJECT.lyrics.config,
              ...stored.config.lyrics?.config,
            },
          },
        };

        // Rehydrate all saved Assets from IndexedDB (Audio, Backgrounds, Overlays)
        await this.rehydrateAssetsFromDB();

        this.lastSavedTime = stored.updatedAt;
        return true;
      }
    } catch (e) {
      console.warn('Failed to load project from IndexedDB:', e);
    }
    return false;
  }

  async rehydrateAssetsFromDB() {
    try {
      // 1. Rehydrate Audio Tracks & Decoded Buffers
      if (this.project.audio.tracks && this.project.audio.tracks.length > 0) {
        for (const track of this.project.audio.tracks) {
          const storedAsset = await db.assets.get(track.id);
          if (storedAsset && storedAsset.blob) {
            const url = URL.createObjectURL(storedAsset.blob);
            track.url = url;
            track.file = new File([storedAsset.blob], track.name, { type: storedAsset.blob.type });
            try {
              const decodedBuffer = await decodeAudioDataResilient(storedAsset.blob);
              this.trackBuffers.set(track.id, decodedBuffer);
            } catch (err) {
              console.warn('Could not decode cached audio track:', track.name, err);
            }
          }
        }
        await this.rebuildMergedAudio();
      }

      // 2. Rehydrate Background Media (Disk-First to support Item 3: File Json tidak mengunci asset)
      if (this.project.background.items && this.project.background.items.length > 0) {
        for (let i = 0; i < this.project.background.items.length; i++) {
          const item = this.project.background.items[i];
          let loadedFromDisk = false;

          if (isDesktop() && item.filePath) {
            try {
              const { invoke } = await import('@tauri-apps/api/core');
              const bytes = await invoke<number[] | Uint8Array>('read_media_file', { path: item.filePath });
              if (bytes && (bytes as any).length > 0) {
                const u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
                const ext = item.filePath.split('.').pop()?.toLowerCase() || '';
                let mime = item.type === 'video' ? 'video/mp4' : 'image/jpeg';
                if (ext === 'png') mime = 'image/png';
                else if (ext === 'webp') mime = 'image/webp';
                else if (ext === 'gif') mime = 'image/gif';

                const blob = new Blob([u8.buffer as ArrayBuffer], { type: mime });
                item.url = URL.createObjectURL(blob);
                item.file = new File([blob], item.name, { type: mime });
                item.fileModifiedAt = Date.now();
                loadedFromDisk = true;

                // Sync fresh version to DB cache
                await db.assets.put({
                  id: item.id,
                  projectId: this.project.id,
                  name: item.name,
                  type: item.type,
                  blob,
                  createdAt: Date.now(),
                }).catch(() => {});

                if (i < 2) {
                  await backgroundManager.loadAsset(item).catch(() => {});
                }
              }
            } catch (diskErr) {
              console.warn(`Could not load bg asset from disk (${item.filePath}), fallback to IndexedDB:`, diskErr);
            }
          }

          if (!loadedFromDisk) {
            const storedAsset = await db.assets.get(item.id);
            if (storedAsset && storedAsset.blob) {
              item.url = URL.createObjectURL(storedAsset.blob);
              item.file = new File([storedAsset.blob], item.name, { type: storedAsset.blob.type });
              if (i < 2) {
                await backgroundManager.loadAsset(item).catch((err) => {
                  console.warn('Could not preload background asset:', item.name, err);
                });
              }
            }
          }
        }
      }

      // 3. Rehydrate Image Overlays & Preload to ImageOverlayManager
      if (this.project.overlays.images && this.project.overlays.images.length > 0) {
        for (const img of this.project.overlays.images) {
          const storedAsset = await db.assets.get(img.id);
          if (storedAsset && storedAsset.blob) {
            img.url = URL.createObjectURL(storedAsset.blob);
            img.file = new File([storedAsset.blob], img.name, { type: storedAsset.blob.type });
            await imageOverlayManager.preloadImage(img).catch((err) => {
              console.warn('Could not preload overlay asset:', img.name, err);
            });
          }
        }
      }

      // 4. Rehydrate Video Overlays
      if (this.project.overlays.videos && this.project.overlays.videos.length > 0) {
        for (const vid of this.project.overlays.videos) {
          const storedAsset = await db.assets.get(vid.id);
          if (storedAsset && storedAsset.blob) {
            vid.url = URL.createObjectURL(storedAsset.blob);
            vid.file = new File([storedAsset.blob], vid.name, { type: storedAsset.blob.type });
            await videoOverlayManager.loadVideo(vid).catch((err) => {
              console.warn('Could not preload video overlay asset:', vid.name, err);
            });
          }
        }
      }

      // 5. Rehydrate Custom Fonts
      if (this.project.customFonts && this.project.customFonts.length > 0) {
        await fontManager.rehydrateFonts(this.project.customFonts);
      }
    } catch (err) {
      console.warn('Asset rehydration error:', err);
    }
  }

  async addCustomFont(file: File): Promise<string> {
    const fontName = file.name.replace(/\.[^/.]+$/, '').trim();
    await fontManager.registerFontFromBlob(fontName, file);

    const assetId = 'font-' + fontName;
    try {
      await db.assets.put({
        id: assetId,
        projectId: this.project.id,
        name: file.name,
        type: 'font',
        blob: file,
        createdAt: Date.now(),
      });
    } catch (e) {
      console.warn('Failed to cache font in db:', e);
    }

    if (!this.project.customFonts) {
      this.project.customFonts = [];
    }
    if (!this.project.customFonts.some((f) => f.name === fontName)) {
      this.project.customFonts.push({ name: fontName });
    }
    await this.saveToDB();
    return fontName;
  }

  async removeCustomFont(name: string) {
    if (!this.project.customFonts) return;
    this.project.customFonts = this.project.customFonts.filter((f) => f.name !== name);
    await db.assets.delete('font-' + name).catch(() => {});
    await this.saveToDB();
  }

  /**
   * Export all-in-one Project Package (.beras) containing project.json + all binary media assets
   */
  async exportProjectPackage(): Promise<void> {
    const files: Record<string, Uint8Array> = {};
    const sanitized = (this.project.title || 'project').toLowerCase().replace(/[^a-z0-9_-]/g, '_');

    const manifestAssets: Array<{ id: string; name: string; type: string; path: string }> = [];
    const assetEntries: Array<{ id: string; name: string; type: string }> = [];

    if (this.project.audio?.tracks) {
      for (const track of this.project.audio.tracks) {
        assetEntries.push({ id: track.id, name: track.name, type: 'audio' });
      }
    }
    if (this.project.background?.items) {
      for (const item of this.project.background.items) {
        assetEntries.push({ id: item.id, name: item.name, type: item.type || 'image' });
      }
    }
    if (this.project.overlays?.images) {
      for (const img of this.project.overlays.images) {
        assetEntries.push({ id: img.id, name: img.name, type: 'image' });
      }
    }
    if (this.project.overlays?.videos) {
      for (const vid of this.project.overlays.videos) {
        assetEntries.push({ id: vid.id, name: vid.name, type: 'video' });
      }
    }

    for (const asset of assetEntries) {
      try {
        const stored = await db.assets.get(asset.id);
        if (stored && stored.blob) {
          const buffer = await stored.blob.arrayBuffer();
          const cleanName = asset.name.replace(/[^a-zA-Z0-9._-]/g, '_');
          const entryPath = `assets/${asset.id}_${cleanName}`;
          files[entryPath] = new Uint8Array(buffer);
          manifestAssets.push({
            id: asset.id,
            name: asset.name,
            type: asset.type,
            path: entryPath,
          });
        }
      } catch (err) {
        console.warn('Could not archive asset:', asset.name, err);
      }
    }

    const bundleData = {
      format: 'beras-visualizer-project',
      version: '1.0.0',
      exportedAt: Date.now(),
      project: $state.snapshot(this.project),
      manifest: manifestAssets,
    };
    files['project.json'] = strToU8(JSON.stringify(bundleData, null, 2));

    const zipped = zipSync(files, { level: 0 });
    const blob = new Blob([zipped], { type: 'application/octet-stream' });
    await saveBlobDesktopOrBrowser(blob, `${sanitized}.beras`);
  }

  /**
   * Export visual styling preset (.bvp) without media assets
   */
  async exportProjectPreset(): Promise<void> {
    const sanitized = (this.project.title || 'preset').toLowerCase().replace(/[^a-z0-9_-]/g, '_');
    const presetData = {
      format: 'beras-visualizer-preset',
      version: '1.0.0',
      exportedAt: Date.now(),
      project: $state.snapshot(this.project),
    };
    const jsonStr = JSON.stringify(presetData, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    await saveBlobDesktopOrBrowser(blob, `${sanitized}.bvp`);
  }

  exportProjectJSON() {
    const snapshot = $state.snapshot(this.project);
    const jsonStr = JSON.stringify(snapshot, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const sanitized = (this.project.title || 'project').toLowerCase().replace(/[^a-z0-9_-]/g, '_');
    saveBlobDesktopOrBrowser(blob, `${sanitized}_config.json`);
  }

  /**
   * Universal project opener: loads .beras (package), .bvp (preset), or legacy .json
   */
  async importProjectFile(file: File): Promise<void> {
    const isBeras = file.name.endsWith('.beras') || file.name.endsWith('.zip');
    if (isBeras) {
      const buffer = await file.arrayBuffer();
      const unzipped = unzipSync(new Uint8Array(buffer));

      const projectJsonBytes = unzipped['project.json'];
      if (!projectJsonBytes) {
        throw new Error('Format paket .beras tidak valid (project.json tidak ditemukan)');
      }

      const bundle = JSON.parse(strFromU8(projectJsonBytes));
      const config: ProjectConfig = bundle.project || bundle;
      const manifest: Array<{ id: string; name: string; type: string; path: string }> = bundle.manifest || [];

      // Restore assets into IndexedDB
      for (const assetMeta of manifest) {
        const fileBytes = unzipped[assetMeta.path];
        if (fileBytes) {
          let mime = 'application/octet-stream';
          if (assetMeta.type === 'audio') mime = 'audio/mpeg';
          else if (assetMeta.type === 'video') mime = 'video/mp4';
          else if (assetMeta.type === 'image') mime = 'image/png';

          const assetBlob = new Blob([fileBytes], { type: mime });
          await db.assets.put({
            id: assetMeta.id,
            projectId: config.id || this.project.id,
            name: assetMeta.name,
            type: assetMeta.type as any,
            blob: assetBlob,
            createdAt: Date.now(),
          });
        }
      }

      this.project = {
        ...structuredClone(DEFAULT_PROJECT),
        ...config,
      };

      await this.rehydrateAssetsFromDB();
      await this.saveToDB();
    } else {
      // .bvp or .json (preset / config only)
      const text = await file.text();
      const parsed = JSON.parse(text);
      const config = parsed.project || parsed;

      this.project = {
        ...structuredClone(DEFAULT_PROJECT),
        ...config,
      };

      await this.rehydrateAssetsFromDB();
      await this.saveToDB();
    }
  }

  importProjectJSON(file: File): Promise<void> {
    return this.importProjectFile(file);
  }
}

async function saveBlobDesktopOrBrowser(blob: Blob, filename: string): Promise<void> {
  if (isDesktop()) {
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      const chunkSize = 4 * 1024 * 1024;
      const totalSize = blob.size;
      let offset = 0;

      while (offset < totalSize) {
        const isFirst = offset === 0;
        const end = Math.min(offset + chunkSize, totalSize);
        const isLast = end >= totalSize;
        const slice = blob.slice(offset, end);
        const arrayBuf = await slice.arrayBuffer();

        let binary = '';
        const bytes = new Uint8Array(arrayBuf);
        const len = bytes.byteLength;
        const subChunkSize = 8192;
        for (let i = 0; i < len; i += subChunkSize) {
          binary += String.fromCharCode.apply(
            null,
            bytes.subarray(i, Math.min(i + subChunkSize, len)) as any
          );
        }
        const base64Chunk = btoa(binary);

        const customDir = projectStore?.project?.exportSettings?.customExportDir || localStorage.getItem('beras_custom_export_dir') || undefined;

        await invoke('save_video_chunk', {
          filename,
          base64Chunk,
          isFirst,
          isLast,
          customDir,
        });

        offset = end;
      }
      return;
    } catch (e) {
      console.warn('Desktop native save failed, using browser download fallback:', e);
    }
  }

  // Browser download fallback
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

export const projectStore = new ProjectState();
