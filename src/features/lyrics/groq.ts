import type { LyricSegment } from '../../lib/types/project';
import { AudioAnalyzer } from '../../lib/audio/analyzer';

export interface GroqWord {
  word: string;
  start: number;
  end: number;
}

export interface GroqTranscriptionResponse {
  task: string;
  language: string;
  duration: number;
  text: string;
  segments?: Array<{
    id: number;
    start: number;
    end: number;
    text: string;
    words?: GroqWord[];
  }>;
  words?: GroqWord[];
}

export class GroqService {
  /**
   * Transcribes a single audio chunk (<= 25MB) with Whisper Turbo with auto-retry and 120s timeout.
   */
  private static async transcribeChunk(
    file: File | Blob,
    apiKey: string,
    model: string,
    signal?: AbortSignal,
    retries: number = 2,
    language?: string
  ): Promise<GroqTranscriptionResponse> {
    for (let attempt = 0; attempt <= retries; attempt++) {
      const formData = new FormData();
      formData.append('file', file, (file as File).name || 'chunk.wav');
      formData.append('model', model);
      formData.append('response_format', 'verbose_json');
      formData.append('timestamp_granularities[]', 'word');
      formData.append('timestamp_granularities[]', 'segment');
      formData.append('temperature', '0.0'); // Deterministic decoding to eliminate hallucinations on silent/music parts
      if (language && language !== 'auto') {
        formData.append('language', language);
      }

      // Generous 120s timeout to prevent premature disconnect on large chunks
      const timeoutController = new AbortController();
      const timeoutId = setTimeout(() => timeoutController.abort(), 120000);
      const combinedSignal = signal ? AbortSignal.any([signal, timeoutController.signal]) : timeoutController.signal;

      try {
        const response = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${apiKey}`,
          },
          body: formData,
          signal: combinedSignal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          const errData = await response.json().catch(() => ({}));
          throw new Error(errData?.error?.message || `Groq API Error: ${response.status} ${response.statusText}`);
        }

        const data: GroqTranscriptionResponse = await response.json();
        return data;
      } catch (err: any) {
        clearTimeout(timeoutId);
        if (signal?.aborted) {
          throw new Error('Transkripsi dibatalkan oleh pengguna.');
        }
        if (err.name === 'AbortError') {
          if (attempt < retries) {
            console.warn(`Attempt ${attempt + 1} timed out, retrying in 2s...`);
            await new Promise((r) => setTimeout(r, 2000));
            continue;
          }
          throw new Error('Koneksi ke Groq API timeout (120 detik). Cek koneksi internet Anda.');
        }
        if (attempt < retries && (err.name === 'TypeError' || err.message.includes('fetch'))) {
          // Network fluctuation retry
          await new Promise((r) => setTimeout(r, 2000));
          continue;
        }
        throw err;
      }
    }
    throw new Error('Gagal terhubung ke Groq API setelah percobaan ulang.');
  }

  /**
   * Transcribes multi-song/long audio seamlessly with auto-chunking & time offset stitching.
   */
  static async transcribeAudioBuffer(
    audioBuffer: AudioBuffer,
    apiKey: string,
    model: string = 'whisper-large-v3-turbo',
    signal?: AbortSignal,
    onProgress?: (status: string, percent: number) => void,
    language: string = 'auto'
  ): Promise<LyricSegment[]> {
    if (!apiKey) throw new Error('Groq API Key diperlukan.');

    const totalDuration = audioBuffer.duration;
    // Chunk size: 3 minutes (180s) to guarantee Whisper never hits the 448-token generation ceiling on dense audio
    const maxChunkDuration = 180; 

    if (totalDuration <= maxChunkDuration) {
      onProgress?.('Mengompres audio (16kHz Mono)...', 20);
      const wavBlob = AudioAnalyzer.audioBufferToWavBlob(audioBuffer, 16000);
      onProgress?.(`Mengirim audio ke Groq (${model})...`, 40);
      const data = await this.transcribeChunk(wavBlob, apiKey, model, signal, 2, language);
      onProgress?.('Menyusun timestamps kata...', 90);
      return this.buildPrecisionLyricSegments(data, 0);
    }

    // Multi-chunk splitting for long playlists (e.g. 15 - 60+ minutes)
    const numChunks = Math.ceil(totalDuration / maxChunkDuration);
    const allSegments: LyricSegment[] = [];
    const sampleRate = audioBuffer.sampleRate;
    const channels = audioBuffer.numberOfChannels;

    for (let c = 0; c < numChunks; c++) {
      if (signal?.aborted) throw new Error('Transkripsi dibatalkan oleh pengguna.');

      const startTime = c * maxChunkDuration;
      const endTime = Math.min(totalDuration, (c + 1) * maxChunkDuration);
      const startSample = Math.floor(startTime * sampleRate);
      const endSample = Math.floor(endTime * sampleRate);
      const chunkLength = endSample - startSample;

      const baseProgress = Math.round((c / numChunks) * 80);
      onProgress?.(`Memproses bagian ${c + 1}/${numChunks} (${Math.round(startTime)}s - ${Math.round(endTime)}s)...`, baseProgress + 10);

      // Create slice AudioBuffer
      const tempCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const chunkBuffer = tempCtx.createBuffer(channels, chunkLength, sampleRate);
      for (let ch = 0; ch < channels; ch++) {
        chunkBuffer.getChannelData(ch).set(audioBuffer.getChannelData(ch).subarray(startSample, endSample));
      }
      await tempCtx.close();

      const wavBlob = AudioAnalyzer.audioBufferToWavBlob(chunkBuffer, 16000);
      const data = await this.transcribeChunk(wavBlob, apiKey, model, signal, 2, language);
      const chunkSegments = this.buildPrecisionLyricSegments(data, startTime);
      allSegments.push(...chunkSegments);
    }

    onProgress?.('Selesai!', 100);
    return allSegments;
  }

  /**
   * Fallback for direct File/Blob upload
   */
  static async transcribeAudio(
    file: File | Blob,
    apiKey: string,
    model: string = 'whisper-large-v3-turbo',
    signal?: AbortSignal,
    onProgress?: (status: string, percent: number) => void,
    language: string = 'auto'
  ): Promise<LyricSegment[]> {
    onProgress?.(`Mengirim audio ke Groq (${model})...`, 40);
    const data = await this.transcribeChunk(file, apiKey, model, signal, 2, language);
    onProgress?.('Menyusun timestamps kata...', 90);
    return this.buildPrecisionLyricSegments(data, 0);
  }

  /**
   * Builds high-precision lyric phrases with timeOffset support for chunk stitching.
   */
  private static buildPrecisionLyricSegments(
    data: GroqTranscriptionResponse,
    timeOffset: number = 0
  ): LyricSegment[] {
    let allWords: GroqWord[] = [];

    if (data.words && data.words.length > 0) {
      allWords = data.words;
    } else if (data.segments && data.segments.length > 0) {
      for (const seg of data.segments) {
        if (seg.words && seg.words.length > 0) {
          allWords.push(...seg.words);
        }
      }
    }

    if (allWords.length > 0) {
      const segments: LyricSegment[] = [];
      let currentChunk: GroqWord[] = [];
      let segIndex = 0;

      for (let i = 0; i < allWords.length; i++) {
        const w = allWords[i];
        currentChunk.push(w);

        const isLastWord = i === allWords.length - 1;
        const nextWord = !isLastWord ? allWords[i + 1] : null;

        const hasLongPause = nextWord ? (nextWord.start - w.end) > 0.85 : false;
        const hasPunctuation = /[.,!?;:]$/.test(w.word.trim()) && currentChunk.length >= 3;
        const isMaxLength = currentChunk.length >= 7;

        if (isLastWord || hasLongPause || hasPunctuation || isMaxLength) {
          const start = currentChunk[0].start + timeOffset;
          const end = currentChunk[currentChunk.length - 1].end + timeOffset;
          const text = currentChunk.map((item) => item.word.trim()).join(' ');

          if (!GroqService.isHallucination(text)) {
            segments.push({
              id: `seg-${Math.round(start * 100)}-${segIndex++}`,
              text,
              start,
              end: Math.max(start + 0.5, end),
              words: currentChunk.map((item) => ({
                word: item.word.trim(),
                start: item.start + timeOffset,
                end: item.end + timeOffset,
              })),
            });
          }

          currentChunk = [];
        }
      }

      return segments;
    }

    if (data.segments && data.segments.length > 0) {
      return data.segments
        .filter((seg) => !GroqService.isHallucination(seg.text))
        .map((seg, idx) => ({
          id: `seg-${Math.round((seg.start + timeOffset) * 100)}-${idx}`,
          text: seg.text.trim(),
          start: seg.start + timeOffset,
          end: seg.end + timeOffset,
          words: seg.words?.map((w) => ({
            word: w.word.trim(),
            start: w.start + timeOffset,
            end: w.end + timeOffset,
          })),
        }));
    }

    if (data.text && !GroqService.isHallucination(data.text)) {
      return [
        {
          id: `seg-${Math.round(timeOffset * 100)}`,
          text: data.text.trim(),
          start: timeOffset,
          end: timeOffset + (data.duration || 10),
        },
      ];
    }

    return [];
  }

  /**
   * Filters common Whisper hallucinations that occur during silent or instrumental sections.
   */
  private static isHallucination(text: string): boolean {
    if (!text || !text.trim()) return true;
    const clean = text.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim();

    const hallucinationPhrases = [
      'terima kasih',
      'terimakasih',
      'terima kasih sudah menonton',
      'terima kasih telah menonton',
      'selamat menonton',
      'selamat menyaksikan',
      'sampai jumpa',
      'sampai jumpa lagi',
      'jangan lupa subscribe',
      'like dan subscribe',
      'like and subscribe',
      'atau subscribe',
      'dan subscribe',
      'thank you for watching',
      'thanks for watching',
      'subscribe to my channel',
      'please subscribe',
      'bye bye',
      'see you next time',
      'subtitles by',
      'transcribed by',
      'translated by',
      'gracias por ver',
      'suscribete al canal',
      'suscribete',
      'suscríbete',
      'obrigado por assistir',
    ];

    return hallucinationPhrases.some((phrase) => clean === phrase || clean.startsWith(phrase + ' ') || clean.endsWith(' ' + phrase));
  }
}
