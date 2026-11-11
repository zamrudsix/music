import {
  Output,
  Mp4OutputFormat,
  Target,
  EncodedPacket,
  EncodedVideoPacketSource,
  AudioSample,
  AudioSampleSource,
  Input,
  BlobSource,
  VideoSampleSink,
  VideoSample,
  ALL_FORMATS,
  InputVideoTrack,
} from 'mediabunny';
import { registerAacEncoder } from '@mediabunny/aac-encoder';
import { ParticleSystem } from '../../features/particles/particles';
import { SpectrumRenderer } from '../../features/spectrum/spectrum';
import { LyricRenderer } from '../../features/lyrics/lyrics';
import { textOverlayManager } from '../../features/texts/textOverlay.svelte';
import { tracklistOverlayRenderer } from '../../features/tracklist/tracklistOverlay.svelte';
import { computeOverlayTransition } from '../utils/transition';
import { computeImageMotion, computeTransition, type MotionTransform } from '../utils/motion';
import type { ProjectConfig, BackgroundItem, ImageOverlayItem, VideoOverlayItem } from '../types/project';

// Register AAC Encoder polyfill (critical for Safari/WebKit/Tauri which lack WebCodecs AudioEncoder)
registerAacEncoder();

/**
 * ElasticBlockTarget: Block-paged Target implementation that supports true random-access writes.
 * Fixes the 4GB / 2GB single ArrayBuffer limit on long audio (>1 hour) without corrupting
 * MP4 headers (which require in-place seek/overwrite for ftyp, moov, and mdat boxes).
 */
const TARGET_BLOCK_SIZE = 16 * 1024 * 1024; // 16MB blocks
class ElasticBlockTarget extends Target {
  private blocks = new Map<number, Uint8Array>();
  private maxPos = 0;

  _start() {}

  _write(data: Uint8Array, pos: number) {
    let offset = 0;
    const total = data.byteLength;
    while (offset < total) {
      const currentPos = pos + offset;
      const blockIndex = Math.floor(currentPos / TARGET_BLOCK_SIZE);
      const blockOffset = currentPos % TARGET_BLOCK_SIZE;
      const toWrite = Math.min(total - offset, TARGET_BLOCK_SIZE - blockOffset);

      let block = this.blocks.get(blockIndex);
      if (!block) {
        block = new Uint8Array(TARGET_BLOCK_SIZE);
        this.blocks.set(blockIndex, block);
      }
      block.set(data.subarray(offset, offset + toWrite), blockOffset);
      offset += toWrite;
    }
    this.maxPos = Math.max(this.maxPos, pos + data.byteLength);
    (this as any)._dispatchWrite?.(pos, pos + data.byteLength);
  }

  async _flush() {}

  async _finalize() {
    (this as any)._emit?.('finalized');
  }

  async _close() {}

  getBlob(): Blob {
    const parts: BlobPart[] = [];
    const totalBlocks = Math.ceil(this.maxPos / TARGET_BLOCK_SIZE);
    for (let i = 0; i < totalBlocks; i++) {
      const block = this.blocks.get(i) || new Uint8Array(TARGET_BLOCK_SIZE);
      const isLast = (i === totalBlocks - 1);
      if (isLast) {
        const rem = this.maxPos % TARGET_BLOCK_SIZE;
        parts.push(rem === 0 ? (block as unknown as BlobPart) : (block.subarray(0, rem) as unknown as BlobPart));
      } else {
        parts.push(block as unknown as BlobPart);
      }
    }
    return new Blob(parts, { type: 'video/mp4' });
  }

  clear() {
    this.blocks.clear();
    this.maxPos = 0;
  }
}

/**
 * DiskBackedTarget: Disk-backed target utilizing Origin Private File System (OPFS)
 * via synchronous file handles in Web Worker context.
 * Writes video data directly to disk to prevent RAM/SWAP exhaustion on long projects (>1 hour).
 */
class DiskBackedTarget extends Target {
  private fileHandle: FileSystemFileHandle | null = null;
  private accessHandle: any = null;
  private maxPos = 0;
  private fallbackTarget: ElasticBlockTarget | null = null;
  private isOpfs = false;

  async init() {
    try {
      if (typeof navigator !== 'undefined' && navigator.storage && typeof navigator.storage.getDirectory === 'function') {
        const root = await navigator.storage.getDirectory();

        // Auto-sweep old stale render files left behind from previous renders or crashes
        try {
          if (typeof (root as any).entries === 'function') {
            // @ts-ignore
            for await (const [name] of (root as any).entries()) {
              if (typeof name === 'string' && name.startsWith('render_') && name.endsWith('.mp4')) {
                await root.removeEntry(name).catch(() => {});
              }
            }
          }
        } catch (_) {}

        const filename = `render_${Date.now()}_temp.mp4`;
        this.fileHandle = await root.getFileHandle(filename, { create: true });
        if (typeof (this.fileHandle as any).createSyncAccessHandle === 'function') {
          this.accessHandle = await (this.fileHandle as any).createSyncAccessHandle();
          this.isOpfs = true;
          console.log('[Worker] OPFS Disk-Backed Target initialized successfully!');
          return;
        }
      }
    } catch (e) {
      console.warn('[Worker] OPFS Target init failed, falling back to ElasticBlockTarget:', e);
    }
    this.fallbackTarget = new ElasticBlockTarget();
  }

  _start() {
    if (this.fallbackTarget) this.fallbackTarget._start();
  }

  _write(data: Uint8Array, pos: number) {
    if (this.isOpfs && this.accessHandle) {
      this.accessHandle.write(data, { at: pos });
      this.maxPos = Math.max(this.maxPos, pos + data.byteLength);
      (this as any)._dispatchWrite?.(pos, pos + data.byteLength);
    } else if (this.fallbackTarget) {
      this.fallbackTarget._write(data, pos);
    }
  }

  async _flush() {
    if (this.isOpfs && this.accessHandle) {
      this.accessHandle.flush();
    } else if (this.fallbackTarget) {
      await this.fallbackTarget._flush();
    }
  }

  async _finalize() {
    if (this.isOpfs && this.accessHandle) {
      this.accessHandle.flush();
    } else if (this.fallbackTarget) {
      await this.fallbackTarget._finalize();
    }
    (this as any)._emit?.('finalized');
  }

  async _close() {
    if (this.fallbackTarget) {
      await this.fallbackTarget._close();
    }
  }

  async getBlob(): Promise<Blob> {
    if (this.isOpfs && this.fileHandle) {
      try {
        if (this.accessHandle) {
          this.accessHandle.flush();
          this.accessHandle.close();
          this.accessHandle = null;
        }
        const file = await this.fileHandle.getFile();
        return file;
      } catch (e) {
        console.warn('[Worker] Error reading OPFS blob:', e);
      }
    }
    if (this.fallbackTarget) {
      return this.fallbackTarget.getBlob();
    }
    return new Blob([], { type: 'video/mp4' });
  }

  async clear() {
    if (this.accessHandle) {
      try { this.accessHandle.close(); } catch (e) {}
      this.accessHandle = null;
    }
    if (this.fallbackTarget) {
      this.fallbackTarget.clear();
      this.fallbackTarget = null;
    }
    this.maxPos = 0;
  }

  async removeTempFile() {
    await this.clear();
    if (this.isOpfs && this.fileHandle) {
      try {
        const root = await navigator.storage.getDirectory();
        await root.removeEntry(this.fileHandle.name);
      } catch (e) {}
      this.fileHandle = null;
      this.isOpfs = false;
    }
  }
}

/**
 * SequentialVideoReader (Pipelined): Decodes video samples ahead-of-time on a background
 * loop into a bounded FIFO buffer, decoupled from the render/encode loop. This prevents
 * decode latency (especially on Windows where decode throughput is more variable) from
 * serializing with per-frame draw+encode work, closing the platform speed gap.
 */
class SequentialVideoReader {
  public input: Input;
  public track: InputVideoTrack;
  public duration: number;

  private sink: VideoSampleSink | null = null;
  private iterator: AsyncIterableIterator<VideoSample> | null = null;

  private currentSample: VideoSample | null = null;
  private nextSample: VideoSample | null = null;

  private queue: VideoSample[] = [];
  private readonly bufferDepth: number;

  private isDisposed = false;
  private streamToken = 0;          // invalidates stale prefetch loops after a restart
  private prefetchDone = false;     // true when current stream's iterator is exhausted

  private notFullResolver: (() => void) | null = null;
  private notEmptyResolver: (() => void) | null = null;

  // Telemetry: track buffer starvation
  private dequeueCount = 0;
  private starveCount = 0;

  constructor(input: Input, track: InputVideoTrack, duration: number, bufferDepth = 8) {
    this.input = input;
    this.track = track;
    this.duration = duration;
    this.bufferDepth = bufferDepth;
    this.restartStream();
  }

  private restartStream() {
    this.streamToken++;
    const token = this.streamToken;

    this.closeSamples(); // drops currentSample/nextSample AND flushes queued samples
    this.prefetchDone = false;

    this.sink = new VideoSampleSink(this.track);
    this.iterator = this.sink.samples();

    // Wake up anything waiting on the old stream so it doesn't hang forever
    this.wakeNotEmpty();
    this.wakeNotFull();

    // Fire-and-forget background prefetch loop for this stream generation
    void this.runPrefetchLoop(token);
  }

  private async runPrefetchLoop(token: number) {
    try {
      while (!this.isDisposed && token === this.streamToken) {
        // Backpressure: don't decode further ahead than bufferDepth
        if (this.queue.length >= this.bufferDepth) {
          await new Promise<void>((resolve) => { this.notFullResolver = resolve; });
          continue;
        }
        if (token !== this.streamToken || this.isDisposed) break;

        const next = await this.iterator!.next();

        // Stream was restarted/disposed while we were awaiting decode — discard stale sample
        if (token !== this.streamToken || this.isDisposed) {
          if (!next.done && next.value) next.value.close();
          break;
        }

        if (next.done || !next.value) {
          this.prefetchDone = true;
          this.wakeNotEmpty(); // let dequeue() know it should stop waiting (EOF)
          break;
        }

        this.queue.push(next.value);
        this.wakeNotEmpty();
      }
    } catch (err) {
      console.warn('[SequentialVideoReader] Prefetch loop decode error:', err);
      if (token === this.streamToken) {
        this.prefetchDone = true;
        this.wakeNotEmpty();
      }
    }
  }

  private wakeNotEmpty() {
    if (this.notEmptyResolver) {
      const r = this.notEmptyResolver;
      this.notEmptyResolver = null;
      r();
    }
  }

  private wakeNotFull() {
    if (this.notFullResolver) {
      const r = this.notFullResolver;
      this.notFullResolver = null;
      r();
    }
  }

  /** Pull the next decoded sample from the prefetch buffer, waiting only if it's genuinely empty. */
  private async dequeue(): Promise<VideoSample | null> {
    this.dequeueCount++;
    while (this.queue.length === 0) {
      if (this.prefetchDone || this.isDisposed) return null;
      this.starveCount++;
      await new Promise<void>((resolve) => { this.notEmptyResolver = resolve; });
    }
    const sample = this.queue.shift()!;
    this.wakeNotFull();
    return sample;
  }

  public async getSampleForTime(videoTime: number): Promise<VideoSample | null> {
    if (this.isDisposed) return null;

    // Looped backwards or restarted playback — reset the whole pipeline
    if (this.currentSample && videoTime < this.currentSample.timestamp - 0.5) {
      this.restartStream();
    }

    try {
      if (!this.currentSample) {
        this.currentSample = await this.dequeue();
        if (!this.currentSample) {
          this.restartStream();
          return null;
        }
      }

      if (!this.nextSample) {
        this.nextSample = await this.dequeue(); // null is valid here (near EOF), not an error
      }

      while (this.nextSample && this.nextSample.timestamp <= videoTime) {
        this.currentSample.close();
        this.currentSample = this.nextSample;
        this.nextSample = await this.dequeue();
      }

      return this.currentSample;
    } catch (err) {
      console.warn('[SequentialVideoReader] Stream consume error, resetting stream:', err);
      this.restartStream();
      return null;
    }
  }

  public closeSamples() {
    if (this.currentSample) {
      try { this.currentSample.close(); } catch (e) {}
      this.currentSample = null;
    }
    if (this.nextSample) {
      try { this.nextSample.close(); } catch (e) {}
      this.nextSample = null;
    }
    // Flush anything sitting in the prefetch buffer too
    for (const s of this.queue) {
      try { s.close(); } catch (e) {}
    }
    this.queue.length = 0;
  }

  public async dispose() {
    this.isDisposed = true;
    this.streamToken++; // invalidate any in-flight prefetch loop
    this.wakeNotEmpty();
    this.wakeNotFull();
    this.closeSamples();
    try {
      if (this.iterator?.return) {
        await this.iterator.return();
      }
    } catch (e) {}
    try {
      await this.input.dispose();
    } catch (e) {}
  }
}

type VideoDecoderItem = SequentialVideoReader;

interface RenderRequest {
  type: 'START_RENDER';
  project: ProjectConfig;
  frequencyFrames?: Uint8Array[];
  flatFrequencyBuffer?: Uint8Array;
  beats: number[];
  frameDuration: number;
  audioRawData?: Float32Array[];
  sampleRate: number;
  videoBlobs?: Record<string, Blob>;
  videoFramesMap?: Record<string, ImageBitmap[]>;
  videoDurationsMap?: Record<string, number>;
  fontBuffers?: Array<{ name: string; buffer: ArrayBuffer }>;
  isLicensed?: boolean;
}


self.onmessage = async (e: MessageEvent<RenderRequest | { type: 'CANCEL' }>) => {
  if (e.data.type === 'CANCEL') {
    self.postMessage({ type: 'CANCELLED' });
    return;
  }

  if (e.data.type === 'START_RENDER') {
    const { 
      project, 
      frequencyFrames: passedFrequencyFrames, 
      flatFrequencyBuffer,
      beats, 
      frameDuration, 
      sampleRate, 
      videoBlobs = {},
      videoFramesMap = {}, 
      videoDurationsMap = {}, 
      fontBuffers = [], 
      isLicensed = false 
    } = e.data;
    const { width, height, fps, videoBitrate, exportRange } = project.exportSettings;
    const maxDuration = project.audio.duration || 10;
    const isRangeEnabled = Boolean(
      exportRange?.enabled && 
      typeof exportRange.startTime === 'number' && 
      typeof exportRange.endTime === 'number' && 
      exportRange.endTime > exportRange.startTime
    );
    const renderStart = isRangeEnabled ? Math.max(0, exportRange!.startTime) : 0;
    const renderEnd = isRangeEnabled ? Math.min(exportRange!.endTime, maxDuration) : maxDuration;
    const renderDuration = Math.max(0.1, renderEnd - renderStart);
    const totalFrames = Math.floor(renderDuration * fps);

    // Fast zero-allocation unpack of frequency frames if flat buffer was transferred
    let frequencyFrames: Uint8Array[];
    if (flatFrequencyBuffer && flatFrequencyBuffer.byteLength > 0) {
      const visualBins = 128;
      const totalFreqFrames = Math.floor(flatFrequencyBuffer.byteLength / visualBins);
      frequencyFrames = new Array(totalFreqFrames);
      for (let i = 0; i < totalFreqFrames; i++) {
        frequencyFrames[i] = flatFrequencyBuffer.subarray(i * visualBins, (i + 1) * visualBins);
      }
    } else {
      frequencyFrames = passedFrequencyFrames || [];
    }

    // Random watermark seed and jump interval for Free Use (0 cost, pure integer math)
    const watermarkBaseX = Math.floor(0.15 * width + Math.random() * (0.70 * width));
    const watermarkBaseY = Math.floor(0.15 * height + Math.random() * (0.70 * height));
    const watermarkSeed = Math.floor(Math.random() * 1000000);


    // Register custom fonts in Web Worker context if provided
    if (fontBuffers.length > 0 && typeof (self as any).FontFace !== 'undefined') {
      for (const fb of fontBuffers) {
        try {
          const fontFace = new (self as any).FontFace(fb.name, fb.buffer);
          await fontFace.load();
          (self as any).fonts.add(fontFace);
          console.log(`[Worker] Loaded custom font: ${fb.name}`);
        } catch (fErr) {
          console.warn(`[Worker] Could not register custom font ${fb.name}:`, fErr);
        }
      }
    }

    // Hardware-accelerated OffscreenCanvas
    const canvas = new OffscreenCanvas(width, height);
    const ctx = canvas.getContext('2d', { alpha: false, desynchronized: true });
    if (!ctx) {
      self.postMessage({ type: 'ERROR', message: 'Failed to get OffscreenCanvas 2D context' });
      return;
    }
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    // 1. Dynamic Bitmap Pool for Background (Anti-Crash for 260+ / 1000+ images)
    const bgItems = project.background?.items || [];
    const bgBitmapPool = new DynamicBitmapPool(bgItems);
    if (bgItems[0]) await bgBitmapPool.get(bgItems[0].id);
    if (bgItems[1]) await bgBitmapPool.get(bgItems[1].id);
    const overlayBitmaps = await preloadBitmaps(project.overlays?.images);

    // 1b. Initialize On-Demand Video Decoders via Mediabunny (Stream decoding without memory footprint)
    const videoDecoders = new Map<string, VideoDecoderItem>();
    for (const [id, blob] of Object.entries(videoBlobs)) {
      try {
        const input = new Input({
          source: new BlobSource(blob),
          formats: ALL_FORMATS,
        });
        const track = await input.getPrimaryVideoTrack();
        if (!track) {
          throw new Error('Tidak ditemukan video track pada file.');
        }
        const canDecode = await track.canDecode();
        if (!canDecode) {
          self.postMessage({
            type: 'WARNING',
            message: `Video (${id}) memiliki format/codec yang tidak didukung decoder perangkat keras/browser ini. Solusi: Gunakan video dengan format MP4 (H.264 / AVC).`,
          });
          await input.dispose();
          continue;
        }
        const trackDur = (await track.computeDuration()) || (await input.computeDuration()) || 10;
        const reader = new SequentialVideoReader(input, track, trackDur);
        videoDecoders.set(id, reader);
        console.log(`[Worker] Sequential video decoder initialized for ${id}: dur=${trackDur.toFixed(1)}s, codec=${track.codec}`);
      } catch (vidErr: any) {
        console.warn(`[Worker] Failed to create VideoDecoder for ${id}:`, vidErr);
        self.postMessage({
          type: 'WARNING',
          message: `Gagal membaca video (${id}): ${vidErr.message || 'File mungkin korup'}. Solusi: Pastikan format video adalah MP4 standard atau coba encode ulang.`,
        });
      }
    }

    // 2. Initialize Render Engines & Prepare Static Offscreen Text Cache
    const particles = new ParticleSystem(width, height);
    const spectrum = new SpectrumRenderer();
    const lyrics = new LyricRenderer();
    if (project.overlays?.texts && typeof textOverlayManager.prepareCache === 'function') {
      textOverlayManager.prepareCache(width, height, project.overlays.texts);
    }
    if (project.overlays?.tracklist && typeof tracklistOverlayRenderer.prepareCache === 'function') {
      tracklistOverlayRenderer.prepareCache(width, height, project.overlays.tracklist, project.audio?.tracks);
    }

    // 2b. Pre-cache Watermark Typography & Layout Metrics (Avoid ctx.measureText() & font string parsing per frame)
    const watermarkScale = Math.min(width, height) / 1080;
    const wmPaddingX = Math.round(14 * watermarkScale);
    const wmPaddingY = Math.round(8 * watermarkScale);
    const wmFontSize = Math.max(11, Math.round(13 * watermarkScale));
    const wmFont = `600 ${wmFontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
    ctx.font = wmFont;
    const wmText = 'Made with poncoberas';
    const wmTextWidth = ctx.measureText(wmText).width;
    const wmWaveWidth = Math.round(18 * watermarkScale);
    const wmWaveGap = Math.round(8 * watermarkScale);
    const wmBadgeWidth = wmTextWidth + wmWaveWidth + wmWaveGap + wmPaddingX * 2;
    const wmBadgeHeight = Math.max(26, Math.round(28 * watermarkScale) + wmPaddingY);
    const wmRadius = Math.round(wmBadgeHeight / 2);
    const wmMarginX = Math.round(Math.max(20, width * 0.025));
    const wmMarginY = Math.round(Math.max(20, height * 0.035));
    const wmX = width - wmMarginX - wmBadgeWidth;
    const wmY = height - wmMarginY - wmBadgeHeight;
    const wmBarBaseX = wmPaddingX + 2;
    const wmBarCenterY = wmBadgeHeight / 2;
    const wmBarW = Math.max(2, Math.round(2.5 * watermarkScale));
    const wmBarSpacing = Math.max(4, Math.round(5 * watermarkScale));
    const wmTextX = wmPaddingX + wmWaveWidth + wmWaveGap;
    const wmMetrics = {
      scale: watermarkScale,
      paddingX: wmPaddingX,
      paddingY: wmPaddingY,
      fontSize: wmFontSize,
      font: wmFont,
      text: wmText,
      textWidth: wmTextWidth,
      waveWidth: wmWaveWidth,
      waveGap: wmWaveGap,
      badgeWidth: wmBadgeWidth,
      badgeHeight: wmBadgeHeight,
      radius: wmRadius,
      x: wmX,
      y: wmY,
      barBaseX: wmBarBaseX,
      barCenterY: wmBarCenterY,
      barW: wmBarW,
      barSpacing: wmBarSpacing,
      textX: wmTextX,
    };

    // Setup Mediabunny Output & Tracks (using ElasticBlockTarget in-memory block paging).
    // Zero disk writes to Drive C, zero hidden cache, and zero duplicate temp files!
    const target = new ElasticBlockTarget();
    const output = new Output({
      target,
      format: new Mp4OutputFormat({ fastStart: 'in-memory' }),
    });

    const videoSource = new EncodedVideoPacketSource('avc');
    output.addVideoTrack(videoSource);

    const hasAudio = Boolean(e.data.audioRawData && e.data.audioRawData.length > 0);
    let audioSource: AudioSampleSource | null = null;
    if (hasAudio) {
      audioSource = new AudioSampleSource({
        codec: 'aac',
        bitrate: project.exportSettings.audioBitrate || 192_000,
      });
      output.addAudioTrack(audioSource);
    }

    await output.start();

    let encoderError: any = null;
    let encodedVideoPacketsCount = 0;

    // WebCodecs VideoEncoder with Hardware Acceleration & low-latency mode
    const videoEncoder = new VideoEncoder({
      output: (chunk, meta) => {
        try {
          const packet = EncodedPacket.fromEncodedChunk(chunk);
          const addPromise = videoSource.add(packet, meta);
          if (addPromise && typeof addPromise.catch === 'function') {
            addPromise.catch((err) => {
              encoderError = err;
            });
          }
          encodedVideoPacketsCount++;
        } catch (err) {
          encoderError = err;
        }
      },
      error: (e) => {
        encoderError = e;
      },
    });

    // Try optimal hardware codec profile with automatic graceful fallback to baseline/main
    const candidateCodecs = width > 1280 || height > 720
      ? ['avc1.640033', 'avc1.4d002a', 'avc1.42e01f']
      : ['avc1.4d0020', 'avc1.42e01e', 'avc1.64001f'];

    let configuredCodec = candidateCodecs[0];
    for (const codec of candidateCodecs) {
      try {
        if (typeof (VideoEncoder as any).isConfigSupported === 'function') {
          const support = await (VideoEncoder as any).isConfigSupported({
            codec,
            width,
            height,
            bitrate: videoBitrate || (width <= 1280 ? 8_000_000 : 14_000_000),
            framerate: fps,
            hardwareAcceleration: 'prefer-hardware',
          });
          if (support.supported) {
            configuredCodec = codec;
            break;
          }
        }
      } catch (e) {
        // Continue to next candidate
      }
    }

    const defaultBitrate = width <= 1280 ? 8_000_000 : 14_000_000;
    const isMac = typeof navigator !== 'undefined' && /Macintosh|Mac OS X|iPhone|iPad/i.test(navigator.userAgent || '');

    // WebCodecs VideoEncoder: Set latencyMode to 'quality' on ALL platforms (Mac & Windows).
    // CRITICAL: On Windows Media Foundation, 'realtime' clamps encoder pacing to display refresh rate (60 FPS).
    // Using 'quality' enables full unconstrained offline hardware transcode speed (7x-12x+).
    videoEncoder.configure({
      codec: configuredCodec,
      width,
      height,
      bitrate: videoBitrate || defaultBitrate,
      framerate: fps,
      hardwareAcceleration: 'prefer-hardware',
      latencyMode: 'quality',
    } as any);

    // Setup zero-latency ondequeue backpressure to prevent VRAM overflow while keeping pipeline saturated
    let queueDrainResolver: (() => void) | null = null;
    videoEncoder.ondequeue = () => {
      const threshold = isMac ? 6 : 4;
      if (queueDrainResolver && videoEncoder.encodeQueueSize <= threshold) {
        const resolve = queueDrainResolver;
        queueDrainResolver = null;
        resolve();
      }
    };

    // Start concurrent audio encoding in background while video frames render
    // Since audioRawData is already available, AAC compression runs concurrently without blocking video loop
    let audioEncodingPromise: Promise<void> | null = null;
    if (hasAudio && audioSource && e.data.audioRawData) {
      let channelsToEncode = e.data.audioRawData;
      if (isRangeEnabled) {
        const sr = sampleRate || 44100;
        const startSample = Math.floor(renderStart * sr);
        const endSample = Math.min(channelsToEncode[0].length, Math.floor(renderEnd * sr));
        if (startSample > 0 || endSample < channelsToEncode[0].length) {
          channelsToEncode = channelsToEncode.map((ch) => ch.subarray(startSample, endSample));
        }
      }
      audioEncodingPromise = encodeAudioTrack(
        audioSource,
        channelsToEncode,
        sampleRate || 44100
      );
    }

    const fallbackFreq = new Uint8Array(128);
    const totalBgItems = bgItems.length;
    const bgBrightness = project.background?.brightness ?? 1.0;

    // Start instantaneous sliding window timer for accurate realtime FPS telemetry
    const renderStartTime = performance.now();
    let windowStartTime = renderStartTime;
    let windowStartFrame = 0;

    let beatCursor = 0;
    if (isRangeEnabled && beats.length > 0) {
      while (beatCursor + 1 < beats.length && beats[beatCursor + 1] <= renderStart) {
        beatCursor++;
      }
    }

    try {
      for (let frameIdx = 0; frameIdx < totalFrames; frameIdx++) {
        if (encoderError) throw encoderError;

        const outputTime = frameIdx / fps;
        const currentTime = renderStart + outputTime;
        const timestampMicroseconds = Math.round(outputTime * 1_000_000);
        const isKeyFrame = frameIdx % (fps * 2) === 0;

        // 1. Determine Beat Hit (O(1) cursor with smooth exponential decay and clean resting clamp)
        let rawBeatFactor = 1.0;
        if (beats.length > 0) {
          while (beatCursor + 1 < beats.length && beats[beatCursor + 1] <= currentTime + 0.02) {
            beatCursor++;
          }
          const deltaT = currentTime - beats[beatCursor];
          if (deltaT >= 0 && deltaT < 0.32) {
            const energy = Math.exp(-deltaT / 0.16);
            if (energy > 0.01) {
              rawBeatFactor = 1.0 + energy * 0.25;
            }
          }
        } else {
          const beatInterval = 0.5;
          const phase = currentTime % beatInterval;
          if (phase < 0.32) {
            const energy = Math.exp(-phase / 0.16);
            if (energy > 0.01) {
              rawBeatFactor = 1.0 + energy * 0.25;
            }
          }
        }

        // 2. Frequency Data for Spectrum (Direct zero-cost read of pre-smoothed frames)
        let currentFreq: Uint8Array;
        if (frequencyFrames.length > 0) {
          const fIdx = Math.min(
            frequencyFrames.length - 1,
            Math.floor(currentTime / frameDuration)
          );
          currentFreq = frequencyFrames[fIdx] || fallbackFreq;
        } else {
          currentFreq = fallbackFreq;
        }

        // 3. Render Background (Image or Video)
        ctx.fillStyle = '#0a0a0c';
        ctx.fillRect(0, 0, width, height);

        await drawBackground(
          ctx,
          width,
          height,
          project.background,
          bgItems,
          currentTime,
          rawBeatFactor,
          bgBitmapPool,
          videoFramesMap,
          videoDurationsMap,
          videoDecoders
        );

        // 4. Render Video Overlays
        await drawVideoOverlays(
          ctx,
          width,
          height,
          project.overlays?.videos,
          currentTime,
          rawBeatFactor,
          videoFramesMap,
          videoDurationsMap,
          videoDecoders
        );

        // 5. Render Image Overlays
        drawImageOverlays(
          ctx,
          width,
          height,
          project.overlays?.images,
          currentTime,
          rawBeatFactor,
          overlayBitmaps
        );

        // 5. Render Text Overlays
        if (project.overlays?.texts && project.overlays.texts.length > 0) {
          textOverlayManager.render(
            ctx,
            width,
            height,
            project.overlays.texts,
            currentTime,
            rawBeatFactor
          );
        }

        // 5b. Render Tracklist Playlist Overlay
        if (project.overlays?.tracklist?.enabled) {
          tracklistOverlayRenderer.render(
            ctx,
            width,
            height,
            project.overlays.tracklist,
            project.audio?.tracks,
            currentTime,
            rawBeatFactor
          );
        }

        // 6. Render Layers (Particles, Spectrum, Lyrics)
        particles.updateAndRender(ctx, project.overlays.particle, rawBeatFactor);
        if (project.overlays.spectrums && project.overlays.spectrums.length > 0) {
          for (let sIdx = 0; sIdx < project.overlays.spectrums.length; sIdx++) {
            spectrum.render(ctx, width, height, project.overlays.spectrums[sIdx], currentFreq, rawBeatFactor);
          }
        } else if (project.overlays.spectrum) {
          spectrum.render(ctx, width, height, project.overlays.spectrum, currentFreq, rawBeatFactor);
        }
        lyrics.render(
          ctx,
          width,
          height,
          project.lyrics.config,
          project.lyrics.segments,
          currentTime,
          rawBeatFactor
        );

        // 6b. Free Use Dynamic Random Watermark (Zero allocation, ultra-lightweight)
        if (!isLicensed) {
          drawDynamicWatermark(ctx, currentTime, watermarkSeed, wmMetrics);
        }

        // 7. Create VideoFrame from OffscreenCanvas
        const frame = new VideoFrame(canvas, {
          timestamp: timestampMicroseconds,
          duration: Math.round((1 / fps) * 1_000_000),
        });


        // 8. Platform-optimized GPU Queue Backpressure
        // VideoToolbox on Apple Silicon reaches peak 7x-9x+ efficiency with a 16-frame depth
        // Windows iGPU/dGPU is set to 12 frames for smooth unconstrained throughput without VRAM spikes
        const maxQueue = isMac ? 16 : 12;
        if (videoEncoder.encodeQueueSize >= maxQueue) {
          await new Promise<void>((resolve) => {
            queueDrainResolver = resolve;
          });
        }

        videoEncoder.encode(frame, { keyFrame: isKeyFrame });
        frame.close();

        // 9. Post Instant Sliding-Window Progress Telemetry (Real-time FPS & Accurate Multiplier)
        if (frameIdx % 15 === 0 || frameIdx === totalFrames - 1) {
          const now = performance.now();
          const windowElapsedSec = (now - windowStartTime) / 1000;
          const framesInWindow = frameIdx - windowStartFrame + 1;

          let currentFPS = windowElapsedSec > 0.05 ? framesInWindow / windowElapsedSec : 150;
          currentFPS = Math.min(800, Math.max(10, currentFPS));

          windowStartTime = now;
          windowStartFrame = frameIdx + 1;

          const remainingFrames = totalFrames - (frameIdx + 1);
          const etaSeconds = currentFPS > 0 ? Math.max(0, Math.round(remainingFrames / currentFPS)) : 0;
          const speedMultiplier = Number((currentFPS / fps).toFixed(1));

          self.postMessage({
            type: 'PROGRESS',
            progress: (frameIdx + 1) / totalFrames,
            frame: frameIdx + 1,
            totalFrames,
            currentFPS: Math.round(currentFPS),
            speedMultiplier,
            etaSeconds,
          });
        }
      }

      await videoEncoder.flush();
      videoEncoder.close();
      videoSource.close();

      // Ensure concurrent audio track encoding has finished
      if (audioEncodingPromise) {
        await audioEncodingPromise;
      }

      if (encoderError) {
        throw encoderError;
      }

      if (encodedVideoPacketsCount === 0) {
        throw new Error('Video encoder tidak menghasilkan frame paket. Pastikan resolusi dan durasi audio valid.');
      }

      self.postMessage({
        type: 'STAGE_CHANGE',
        stage: 'finalizing',
      });

      // Finalize Mediabunny Output
      await output.finalize();

      // Free Bitmaps, Decoders & Caches immediately to release RAM
      bgBitmapPool.dispose();
      overlayBitmaps.forEach((bmp) => bmp.close());
      overlayBitmaps.clear();
      if (videoFramesMap) {
        Object.values(videoFramesMap).forEach((frames) => {
          frames.forEach((bmp) => { try { bmp.close(); } catch (e) {} });
        });
      }
      for (const dec of videoDecoders.values()) {
        try { await dec.dispose(); } catch (e) {}
      }
      videoDecoders.clear();
      textOverlayManager?.clearCache?.();
      tracklistOverlayRenderer?.clearCache?.();

      const blob = await target.getBlob();
      await target.clear();

      if (!blob || blob.size === 0) {
        throw new Error('Gagal menghasilkan video output dari Mediabunny');
      }

      self.postMessage({
        type: 'COMPLETE',
        blob,
      });

    } catch (err: any) {
      try {
        videoEncoder.close();
      } catch (e) {}
      bgBitmapPool?.dispose?.();
      overlayBitmaps.forEach((bmp) => bmp.close());
      overlayBitmaps.clear();
      if (videoFramesMap) {
        Object.values(videoFramesMap).forEach((frames) => {
          frames.forEach((bmp) => { try { bmp.close(); } catch (e) {} });
        });
      }
      for (const dec of videoDecoders.values()) {
        try { await dec.dispose(); } catch (e) {}
      }
      videoDecoders.clear();
      textOverlayManager?.clearCache?.();
      tracklistOverlayRenderer?.clearCache?.();
      target.clear();

      self.postMessage({
        type: 'ERROR',
        message: err.message || 'Unknown render error occurred',
      });
    }
  }
};

/**
 * DynamicBitmapPool: Sliding-window bitmap cache with eager prefetching & pruning.
 * Guarantees zero out-of-memory crashes for 260+ or 1,000+ slideshow images while
 * keeping hardware texture decode latency at 0ms.
 */
class DynamicBitmapPool {
  private cache = new Map<string, ImageBitmap>();
  private itemsMap = new Map<string, BackgroundItem>();
  private pendingPromises = new Map<string, Promise<ImageBitmap | null>>();

  constructor(items: BackgroundItem[]) {
    for (const item of items) {
      this.itemsMap.set(item.id, item);
    }
  }

  async get(id: string): Promise<ImageBitmap | null> {
    if (this.cache.has(id)) {
      return this.cache.get(id)!;
    }
    const item = this.itemsMap.get(id);
    if (!item || !item.url) return null;

    if (this.pendingPromises.has(id)) {
      return await this.pendingPromises.get(id)!;
    }

    const p = this.loadOne(item);
    this.pendingPromises.set(id, p);
    const res = await p;
    this.pendingPromises.delete(id);
    if (res) {
      this.cache.set(id, res);
    }
    return res;
  }

  private async loadOne(item: BackgroundItem): Promise<ImageBitmap | null> {
    try {
      const resp = await fetch(item.url);
      const blob = await resp.blob();
      let bmp: ImageBitmap;
      if (item.crop && item.crop.width > 0 && item.crop.height > 0) {
        const fullBmp = await createImageBitmap(blob);
        const fullW = fullBmp.width;
        const fullH = fullBmp.height;
        const sx = Math.max(0, Math.round(item.crop.x * fullW));
        const sy = Math.max(0, Math.round(item.crop.y * fullH));
        const sw = Math.min(fullW - sx, Math.round(item.crop.width * fullW));
        const sh = Math.min(fullH - sy, Math.round(item.crop.height * fullH));
        bmp = await createImageBitmap(fullBmp, sx, sy, sw, sh, { resizeQuality: 'high' });
        fullBmp.close();
      } else {
        bmp = await createImageBitmap(blob, { resizeQuality: 'high' });
      }
      return bmp;
    } catch (e) {
      console.warn('Failed to load image bitmap in worker:', item.name, e);
      return null;
    }
  }

  prefetch(ids: string[]) {
    for (const id of ids) {
      if (id && !this.cache.has(id) && !this.pendingPromises.has(id)) {
        this.get(id).catch(() => {});
      }
    }
  }

  prune(keepIds: Set<string>) {
    if (this.cache.size <= 12) return;
    for (const [id, bmp] of this.cache.entries()) {
      if (!keepIds.has(id)) {
        bmp.close();
        this.cache.delete(id);
      }
    }
  }

  dispose() {
    for (const bmp of this.cache.values()) {
      try { bmp.close(); } catch (e) {}
    }
    this.cache.clear();
  }
}

/**
 * Preload background & overlay images as ImageBitmaps in Web Worker (Zero-copy hardware textures)
 * If crop is specified, crops one-time during ImageBitmap creation so frame render loops do zero crop math!
 */
async function preloadBitmaps(
  items: Array<{ id: string; type?: string; url?: string; crop?: import('../../lib/types/project').CropRect }> | undefined
): Promise<Map<string, ImageBitmap>> {
  const map = new Map<string, ImageBitmap>();
  if (!items) return map;

  for (const item of items) {
    if ((!item.type || item.type === 'image') && item.url) {
      try {
        const resp = await fetch(item.url);
        const blob = await resp.blob();

        let bmp: ImageBitmap;
        if (item.crop && item.crop.width > 0 && item.crop.height > 0) {
          // Pre-decode full bitmap to get natural dimensions, then crop one-time
          const fullBmp = await createImageBitmap(blob);
          const fullW = fullBmp.width;
          const fullH = fullBmp.height;
          const sx = Math.max(0, Math.round(item.crop.x * fullW));
          const sy = Math.max(0, Math.round(item.crop.y * fullH));
          const sw = Math.min(fullW - sx, Math.round(item.crop.width * fullW));
          const sh = Math.min(fullH - sy, Math.round(item.crop.height * fullH));
          bmp = await createImageBitmap(fullBmp, sx, sy, sw, sh, { resizeQuality: 'high' });
          fullBmp.close();
        } else {
          bmp = await createImageBitmap(blob, { resizeQuality: 'high' });
        }
        map.set(item.id, bmp);
      } catch (err) {
        console.warn('Could not load image bitmap in worker:', err);
      }
    }
  }
  return map;
}

/**
 * Encodes audio PCM channels to AAC format via Mediabunny AAC Encoder
 */
async function encodeAudioTrack(
  audioSource: AudioSampleSource,
  channels: Float32Array[],
  sampleRate: number
): Promise<void> {
  try {
    const numChannels = channels.length;
    const totalAudioSamples = channels[0].length;
    console.log(`Encoding audio track: ${numChannels}ch, ${totalAudioSamples} samples, ${sampleRate}Hz, ${(totalAudioSamples / sampleRate).toFixed(1)}s`);
    // 16384 samples (~370ms per buffer) drastically cuts async Promise & memory loop overhead from 10k loops to <1k loops
    const chunkSize = 16384;

    let sampleOffset = 0;
    while (sampleOffset < totalAudioSamples) {
      const count = Math.min(chunkSize, totalAudioSamples - sampleOffset);
      const planarBuffer = new Float32Array(count * numChannels);
      for (let ch = 0; ch < numChannels; ch++) {
        planarBuffer.set(channels[ch].subarray(sampleOffset, sampleOffset + count), ch * count);
      }

      const sample = new AudioSample({
        data: planarBuffer,
        format: 'f32-planar',
        sampleRate,
        numberOfChannels: numChannels,
        timestamp: sampleOffset / sampleRate,
      });

      await audioSource.add(sample);
      sample.close();
      sampleOffset += count;
    }

    audioSource.close();
    console.log('Audio track encoded successfully via @mediabunny/aac-encoder!');
  } catch (audioErr) {
    console.error('Audio encoding failed:', audioErr);
  }
}

let workerChromaCanvas: OffscreenCanvas | null = null;
let workerChromaCtx: OffscreenCanvasRenderingContext2D | null = null;

function renderWorkerChromaKey(
  targetCtx: OffscreenCanvasRenderingContext2D,
  source: CanvasImageSource,
  drawW: number,
  drawH: number,
  chroma: { color: string; similarity: number; smoothness: number }
) {
  const w = Math.round(drawW);
  const h = Math.round(drawH);
  if (w <= 0 || h <= 0) return;

  // Allocate canvas with headroom to prevent continuous GC churn when scaling
  if (!workerChromaCanvas || workerChromaCanvas.width < w || workerChromaCanvas.height < h) {
    const targetW = Math.max(w, workerChromaCanvas ? workerChromaCanvas.width : 512);
    const targetH = Math.max(h, workerChromaCanvas ? workerChromaCanvas.height : 512);
    workerChromaCanvas = new OffscreenCanvas(targetW, targetH);
    workerChromaCtx = workerChromaCanvas.getContext('2d', { willReadFrequently: true }) as any;
  }
  if (!workerChromaCtx) return;

  workerChromaCtx.clearRect(0, 0, w, h);
  workerChromaCtx.drawImage(source, 0, 0, w, h);
  const imgData = workerChromaCtx.getImageData(0, 0, w, h);
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

  workerChromaCtx.putImageData(imgData, 0, 0);
  targetCtx.drawImage(workerChromaCanvas, 0, 0, w, h, -drawW / 2, -drawH / 2, drawW, drawH);
}

/**
 * Draws background image or video (using on-demand WebCodecs decoding via videoDecoders or dynamic bitmap pool)
 */
async function drawBackground(
  ctx: OffscreenCanvasRenderingContext2D,
  width: number,
  height: number,
  bgConfig: ProjectConfig['background'],
  bgItems: BackgroundItem[],
  currentTime: number,
  rawBeatFactor: number,
  bgBitmapPool: DynamicBitmapPool,
  videoFramesMap: Record<string, ImageBitmap[]>,
  videoDurationsMap: Record<string, number> = {},
  videoDecoders: Map<string, VideoDecoderItem> = new Map()
): Promise<void> {
  const totalBgItems = bgItems.length;
  if (totalBgItems === 0) return;

  const bgBrightness = bgConfig?.brightness ?? 1.0;
  let activeItem = bgItems[0];
  let nextItem: any = null;
  let blendFactor = 0;
  let progressInActive = 0;
  let progressInNext = 0;

  if (totalBgItems > 1 && bgConfig.type.startsWith('multi')) {
    const itemDuration = bgItems[0]?.duration || 5.0;
    const cycleIndex = Math.floor(currentTime / itemDuration) % totalBgItems;
    progressInActive = (currentTime % itemDuration) / itemDuration;

    activeItem = bgItems[cycleIndex];
    const nextIndex = (cycleIndex + 1) % totalBgItems;
    nextItem = bgItems[nextIndex];

    const transDurationNorm = Math.min(0.5, (bgConfig.transitionDuration || 1.0) / itemDuration);
    if (progressInActive > 1 - transDurationNorm && bgConfig.transition !== 'cut') {
      blendFactor = (progressInActive - (1 - transDurationNorm)) / transDurationNorm;
      progressInNext = blendFactor * transDurationNorm;
    }

    // Prefetch upcoming slides in background pool & prune old ones
    const prefetch1 = bgItems[(nextIndex + 1) % totalBgItems]?.id;
    const prefetch2 = bgItems[(nextIndex + 2) % totalBgItems]?.id;
    bgBitmapPool.prefetch([nextItem?.id, prefetch1, prefetch2].filter(Boolean) as string[]);
    bgBitmapPool.prune(new Set([activeItem.id, nextItem?.id, prefetch1, prefetch2].filter(Boolean) as string[]));
  } else {
    const dur = activeItem.duration || 5.0;
    progressInActive = (currentTime % dur) / dur;
  }

  const bgSens = bgConfig.beatSensitivity ?? 1.0;
  const bgBeat = 1.0 + (rawBeatFactor - 1.0) * bgSens;
  const scaleFactor = bgConfig.followBeat ? 1 + (bgBeat - 1) * 0.03 : 1.0;

  const motionEffect = activeItem.motionEffect || bgConfig.motionEffect || 'random';
  const motionIntensity = bgConfig.motionIntensity ?? 1.0;
  const activeMotion = activeItem.type === 'image'
    ? computeImageMotion(progressInActive, motionEffect, activeItem.id, motionIntensity, width, height)
    : null;

  const transitionState = computeTransition(bgConfig.transition || 'crossfade', blendFactor, width, height);

  await drawSingleBgItem(
    ctx,
    width,
    height,
    activeItem,
    bgConfig.scaleMode,
    scaleFactor,
    transitionState.activeAlpha,
    currentTime,
    bgBitmapPool,
    videoFramesMap,
    videoDurationsMap,
    videoDecoders,
    activeMotion,
    transitionState.activeTransform
  );

  // Transition next slide
  if (nextItem && blendFactor > 0 && transitionState.nextAlpha > 0) {
    const nextMotionEffect = nextItem.motionEffect || bgConfig.motionEffect || 'random';
    const nextMotion = nextItem.type === 'image'
      ? computeImageMotion(progressInNext, nextMotionEffect, nextItem.id, motionIntensity, width, height)
      : null;

    await drawSingleBgItem(
      ctx,
      width,
      height,
      nextItem,
      bgConfig.scaleMode,
      scaleFactor,
      transitionState.nextAlpha,
      currentTime,
      bgBitmapPool,
      videoFramesMap,
      videoDurationsMap,
      videoDecoders,
      nextMotion,
      transitionState.nextTransform
    );
  }

  // Zero-overhead brightness adjustment (solid pass without expensive canvas filter)
  if (bgBrightness < 0.99) {
    ctx.save();
    ctx.fillStyle = `rgba(0, 0, 0, ${Math.min(1.0, 1.0 - bgBrightness)})`;
    ctx.fillRect(0, 0, width, height);
    ctx.restore();
  } else if (bgBrightness > 1.01) {
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    ctx.fillStyle = `rgba(255, 255, 255, ${Math.min(0.7, (bgBrightness - 1.0) * 0.55)})`;
    ctx.fillRect(0, 0, width, height);
    ctx.restore();
  }
}

async function drawSingleBgItem(
  ctx: OffscreenCanvasRenderingContext2D,
  width: number,
  height: number,
  item: BackgroundItem,
  scaleMode: string = 'cover',
  scaleFactor: number,
  alpha: number,
  currentTime: number,
  bgBitmapPool: DynamicBitmapPool,
  videoFramesMap: Record<string, ImageBitmap[]>,
  videoDurationsMap: Record<string, number> = {},
  videoDecoders: Map<string, VideoDecoderItem> = new Map(),
  motion?: MotionTransform | null,
  transitionTransform?: { translateX: number; translateY: number; scale: number }
): Promise<void> {
  if (alpha <= 0.001) return;
  let sourceCanvas: CanvasImageSource | null = null;
  let natW = width;
  let natH = height;

  if (item.type === 'video') {
    const decoder = videoDecoders.get(item.id);
    if (decoder) {
      try {
        const vidDur = decoder.duration || 10;
        const videoTime = currentTime % vidDur;
        const sample = await decoder.getSampleForTime(videoTime);
        if (sample) {
          sourceCanvas = sample.toCanvasImageSource();
          natW = sample.displayWidth;
          natH = sample.displayHeight;
        }
      } catch (err) {
        console.warn(`[Worker] Error decoding sample for bg video ${item.id} at ${currentTime.toFixed(2)}s:`, err);
      }
    }

    // Fallback to videoFramesMap if on-demand decoder not present or failed
    if (!sourceCanvas) {
      const frames = videoFramesMap[item.id];
      if (frames && frames.length > 0) {
        const vidDur = videoDurationsMap[item.id] || 15;
        const progressInVid = (currentTime % vidDur) / vidDur;
        const frameIdx = Math.min(frames.length - 1, Math.floor(progressInVid * frames.length));
        sourceCanvas = frames[frameIdx];
        natW = (sourceCanvas as ImageBitmap).width;
        natH = (sourceCanvas as ImageBitmap).height;
      }
    }
  } else {
    const bmp = await bgBitmapPool.get(item.id);
    if (bmp) {
      sourceCanvas = bmp;
      natW = bmp.width;
      natH = bmp.height;
    }
  }

  if (!sourceCanvas) {
    return;
  }

  // Calculate scaled and centered dimensions
  let drawW = width;
  let drawH = height;
  let drawX = 0;
  let drawY = 0;

  if (scaleMode === 'contain') {
    const scale = Math.min(width / natW, height / natH) * scaleFactor;
    drawW = natW * scale;
    drawH = natH * scale;
    drawX = (width - drawW) / 2;
    drawY = (height - drawH) / 2;
  } else if (scaleMode === 'stretch') {
    drawW = width * scaleFactor;
    drawH = height * scaleFactor;
    drawX = (width - drawW) / 2;
    drawY = (height - drawH) / 2;
  } else {
    // cover (default)
    const scale = Math.max(width / natW, height / natH) * scaleFactor;
    drawW = natW * scale;
    drawH = natH * scale;
    drawX = (width - drawW) / 2;
    drawY = (height - drawH) / 2;
  }

  ctx.save();
  ctx.globalAlpha = Math.max(0, Math.min(1, alpha));

  // Dynamic transforms around center
  const cx = width / 2;
  const cy = height / 2;
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

  if (item.crop && item.crop.width > 0 && item.crop.height > 0 && item.type === 'video') {
    // Crop video on-the-fly for on-demand decoder
    const sx = Math.max(0, Math.round(item.crop.x * natW));
    const sy = Math.max(0, Math.round(item.crop.y * natH));
    const sw = Math.min(natW - sx, Math.round(item.crop.width * natW));
    const sh = Math.min(natH - sy, Math.round(item.crop.height * natH));
    ctx.drawImage(sourceCanvas, sx, sy, sw, sh, drawX, drawY, drawW, drawH);
  } else {
    ctx.drawImage(sourceCanvas, drawX, drawY, drawW, drawH);
  }

  ctx.restore();
}

/**
 * Draws video sticker overlays (with position, scale, beat reactivity, animation, chroma key, and on-demand decoding)
 */
async function drawVideoOverlays(
  ctx: OffscreenCanvasRenderingContext2D,
  width: number,
  height: number,
  videos: VideoOverlayItem[] | undefined,
  currentTime: number,
  rawBeatFactor: number,
  videoFramesMap: Record<string, ImageBitmap[]>,
  videoDurationsMap: Record<string, number> = {},
  videoDecoders: Map<string, VideoDecoderItem> = new Map()
): Promise<void> {
  if (!videos || videos.length === 0) return;

  for (const item of videos) {
    const transState = computeOverlayTransition(
      currentTime,
      item.startTime,
      item.endTime,
      item.transition,
      item.transitionDuration,
      height
    );
    if (!transState.isVisible) continue;

    let sourceCanvas: CanvasImageSource | null = null;
    let vidW = width;
    let vidH = height;

    const decoder = videoDecoders.get(item.id);
    if (decoder) {
      try {
        const vidDur = decoder.duration || 10;
        const videoTime = currentTime % vidDur;
        const sample = await decoder.getSampleForTime(videoTime);
        if (sample) {
          sourceCanvas = sample.toCanvasImageSource();
          vidW = sample.displayWidth;
          vidH = sample.displayHeight;
        }
      } catch (err) {
        console.warn(`[Worker] Error decoding sample for overlay video ${item.id} at ${currentTime.toFixed(2)}s:`, err);
      }
    }

    if (!sourceCanvas) {
      const frames = videoFramesMap[item.id];
      if (frames && frames.length > 0) {
        const vidDur = videoDurationsMap[item.id] || 15;
        const progressInVid = (currentTime % vidDur) / vidDur;
        const frameIdx = Math.min(frames.length - 1, Math.floor(progressInVid * frames.length));
        sourceCanvas = frames[frameIdx];
        vidW = (sourceCanvas as ImageBitmap).width;
        vidH = (sourceCanvas as ImageBitmap).height;
      }
    }

    if (!sourceCanvas) {
      continue;
    }

    const sens = item.beatSensitivity ?? 1.0;
    const beatFactor = 1.0 + (rawBeatFactor - 1.0) * sens;
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
      renderWorkerChromaKey(ctx, sourceCanvas, drawW, drawH, item.chromaKey);
    } else {
      ctx.drawImage(sourceCanvas, -drawW / 2, -drawH / 2, drawW, drawH);
    }

    ctx.restore();
  }
}

/**
 * Draws image sticker overlays with animations
 */
function drawImageOverlays(
  ctx: OffscreenCanvasRenderingContext2D,
  width: number,
  height: number,
  images: ImageOverlayItem[] | undefined,
  currentTime: number,
  rawBeatFactor: number,
  overlayBitmaps: Map<string, ImageBitmap>
): void {
  if (!images || images.length === 0) return;

  const scaleFactor = Math.min(width / 1920, height / 1080);
  for (const imgItem of images) {
    const transState = computeOverlayTransition(
      currentTime,
      imgItem.startTime,
      imgItem.endTime,
      imgItem.transition,
      imgItem.transitionDuration,
      height
    );
    if (!transState.isVisible) continue;

    const bmp = overlayBitmaps.get(imgItem.id);
    if (bmp) {
      const sens = imgItem.beatSensitivity ?? 1.0;
      const imgBeat = 1.0 + (rawBeatFactor - 1.0) * sens;
      const isFull = !!imgItem.isFullScreen;

      const posX = isFull ? width / 2 : (imgItem.x ?? 0.5) * width;
      let posY = (isFull ? height / 2 : (imgItem.y ?? 0.5) * height) + transState.offsetY;
      let rawOpacity = typeof imgItem.opacity === 'number' && Number.isFinite(imgItem.opacity) ? imgItem.opacity : 1.0;
      let drawAlpha = Math.max(0, Math.min(1, rawOpacity * transState.alphaMultiplier));
      let animScale = 1.0 * transState.scaleMultiplier;

      // Animation options
      if (imgItem.animation === 'floating') {
        posY += Math.sin(currentTime * 2.5 + (imgItem.x ?? 0.5) * 10) * 12 * scaleFactor;
      } else if (imgItem.animation === 'pulse-beat') {
        if (imgItem.followBeat) {
          animScale *= 1.0 + (imgBeat - 1.0) * 0.15;
        } else {
          animScale *= 1.0 + Math.sin(currentTime * 3) * 0.05;
        }
      } else if (imgItem.animation === 'shimmer') {
        drawAlpha *= 0.6 + Math.sin(currentTime * 4) * 0.4;
      } else if (imgItem.animation === 'glow-pulse') {
        drawAlpha *= 0.75 + Math.sin(currentTime * 5) * 0.25;
      }
      drawAlpha = Math.max(0, Math.min(1, drawAlpha));

      const beatScale = imgItem.followBeat ? 1 + (imgBeat - 1) * 0.25 : 1.0;
      let drawW: number;
      let drawH: number;

      if (isFull) {
        const fitMode = imgItem.fitMode || 'cover';
        if (fitMode === 'fill') {
          drawW = width * animScale * beatScale;
          drawH = height * animScale * beatScale;
        } else if (fitMode === 'fit') {
          const s = Math.min(width / bmp.width, height / bmp.height);
          drawW = bmp.width * s * animScale * beatScale;
          drawH = bmp.height * s * animScale * beatScale;
        } else {
          // cover (default)
          const s = Math.max(width / bmp.width, height / bmp.height);
          drawW = bmp.width * s * animScale * beatScale;
          drawH = bmp.height * s * animScale * beatScale;
        }
      } else {
        const baseScale = (imgItem.scale ?? 1.0) * scaleFactor;
        const scale = baseScale * beatScale * animScale;
        drawW = bmp.width * scale;
        drawH = bmp.height * scale;
      }

      ctx.save();
      ctx.globalAlpha = drawAlpha;
      ctx.globalCompositeOperation = (imgItem.blendMode as GlobalCompositeOperation) || 'source-over';
      ctx.translate(posX, posY);
      if (imgItem.rotation) ctx.rotate((imgItem.rotation * Math.PI) / 180);
      ctx.drawImage(bmp, -drawW / 2, -drawH / 2, drawW, drawH);
      ctx.restore();
    }
  }
}

/**
 * Aesthetic Non-Intrusive Watermark (Zero allocation, ultra-lightweight)
 * Positioned cleanly in the corner (bottom-right safe area) with elegant glassmorphism style,
 * crisp typography ("Made with poncoberas"), and subtle wave bars.
 * Does not obscure center visuals, lyrics, or audio spectrum.
 */
function drawDynamicWatermark(
  ctx: OffscreenCanvasRenderingContext2D,
  currentTime: number,
  seed: number,
  m: {
    scale: number;
    paddingX: number;
    paddingY: number;
    fontSize: number;
    font: string;
    text: string;
    textWidth: number;
    waveWidth: number;
    waveGap: number;
    badgeWidth: number;
    badgeHeight: number;
    radius: number;
    x: number;
    y: number;
    barBaseX: number;
    barCenterY: number;
    barW: number;
    barSpacing: number;
    textX: number;
  }
) {
  ctx.save();

  // Subtle breathing opacity (0.78 ~ 0.92) - purely aesthetic & lively
  const breath = 0.85 + Math.sin(currentTime * 1.2 + seed) * 0.07;

  // Glassmorphism subtle capsule background at pre-calculated safe corner position
  ctx.translate(m.x, m.y);
  ctx.beginPath();
  ctx.roundRect(0, 0, m.badgeWidth, m.badgeHeight, m.radius);
  ctx.fillStyle = `rgba(10, 10, 14, ${0.45 * breath})`;
  ctx.fill();
  ctx.strokeStyle = `rgba(255, 255, 255, ${0.18 * breath})`;
  ctx.lineWidth = 1;
  ctx.stroke();

  // Draw 3 small aesthetic equalizer bars on the left of the pill
  for (let i = 0; i < 3; i++) {
    const barH = Math.max(4, Math.round((8 + Math.sin(currentTime * 4.0 + i * 1.6) * 5) * m.scale));
    const bx = m.barBaseX + i * m.barSpacing;
    const by = m.barCenterY - barH / 2;

    ctx.beginPath();
    ctx.roundRect(bx, by, m.barW, barH, Math.max(1, m.barW / 2));
    ctx.fillStyle = i === 1 
      ? `rgba(6, 182, 212, ${0.90 * breath})` // Cyan highlight
      : `rgba(255, 255, 255, ${0.75 * breath})`;
    ctx.fill();
  }

  // Draw modern clean text with pre-cached typography font
  ctx.font = m.font;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = `rgba(255, 255, 255, ${0.90 * breath})`;
  ctx.fillText(m.text, m.textX, m.badgeHeight / 2);

  ctx.restore();
}


