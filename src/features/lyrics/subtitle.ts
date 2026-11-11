import type { LyricSegment, AudioTrackItem } from '../../lib/types/project';
import { isDesktop } from '../../lib/utils/platform';

export class SubtitleService {
  /**
   * Converts lyric segments into standard SubRip (.srt) subtitle format.
   * If tracks are provided, injects song title headers at the beginning of each track's timing.
   */
  static segmentsToSRT(segments: LyricSegment[], tracks?: AudioTrackItem[]): string {
    if (!segments || segments.length === 0) return '';

    // If tracks are provided and more than 1 track exists, inject song title headers into segments
    if (tracks && tracks.length > 0) {
      return this.generatePlaylistSRT(segments, tracks);
    }

    return segments
      .map((seg, idx) => {
        const index = idx + 1;
        const start = this.formatSRTTime(seg.start);
        const end = this.formatSRTTime(seg.end);
        const text = seg.text || '';
        return `${index}\n${start} --> ${end}\n${text}\n`;
      })
      .join('\n');
  }

  /**
   * Generates playlist SRT with clear song titles and sequence headers (e.g. [1. Judul Lagu])
   */
  private static generatePlaylistSRT(segments: LyricSegment[], tracks: AudioTrackItem[]): string {
    let accumulatedTime = 0;
    const trackRanges: Array<{ index: number; name: string; start: number; end: number }> = [];

    tracks.forEach((t, idx) => {
      const start = accumulatedTime;
      const end = accumulatedTime + (t.duration || 0);
      const cleanName = t.name.replace(/\.[^/.]+$/, '').trim();
      trackRanges.push({
        index: idx + 1,
        name: cleanName,
        start,
        end,
      });
      accumulatedTime = end;
    });

    // Create virtual entries combining title announcements and lyric segments
    interface SRTEntry {
      start: number;
      end: number;
      text: string;
    }

    const srtEntries: SRTEntry[] = [];

    // Add track headers at the beginning of each song
    trackRanges.forEach((tr) => {
      const headerEnd = Math.min(tr.end, tr.start + 4.5);
      srtEntries.push({
        start: tr.start,
        end: headerEnd,
        text: `🎵 [Track ${tr.index}: ${tr.name}]`,
      });
    });

    // Add regular lyric segments
    segments.forEach((seg) => {
      srtEntries.push({
        start: seg.start,
        end: seg.end,
        text: seg.text || '',
      });
    });

    // Sort all entries chronologically
    srtEntries.sort((a, b) => a.start - b.start || a.end - b.end);

    return srtEntries
      .map((entry, idx) => {
        const index = idx + 1;
        const start = this.formatSRTTime(entry.start);
        const end = this.formatSRTTime(entry.end);
        return `${index}\n${start} --> ${end}\n${entry.text}\n`;
      })
      .join('\n');
  }

  /**
   * Formats seconds into 00:00:00,000 (SRT format)
   */
  private static formatSRTTime(seconds: number): string {
    const s = Math.max(0, seconds);
    const hrs = Math.floor(s / 3600);
    const mins = Math.floor((s % 3600) / 60);
    const secs = Math.floor(s % 60);
    const millis = Math.floor((s - Math.floor(s)) * 1000);

    return (
      String(hrs).padStart(2, '0') +
      ':' +
      String(mins).padStart(2, '0') +
      ':' +
      String(secs).padStart(2, '0') +
      ',' +
      String(millis).padStart(3, '0')
    );
  }

  /**
   * Parses time string (00:01:23,456 or 00:01:23.456 or 01:23.45) to seconds
   */
  private static parseTimeToSeconds(timeStr: string): number {
    const cleaned = timeStr.trim().replace(',', '.');
    const parts = cleaned.split(':');
    if (parts.length === 3) {
      const hrs = parseFloat(parts[0]) || 0;
      const mins = parseFloat(parts[1]) || 0;
      const secs = parseFloat(parts[2]) || 0;
      return hrs * 3600 + mins * 60 + secs;
    } else if (parts.length === 2) {
      const mins = parseFloat(parts[0]) || 0;
      const secs = parseFloat(parts[1]) || 0;
      return mins * 60 + secs;
    }
    return parseFloat(cleaned) || 0;
  }

  /**
   * Parses standard SRT or VTT content string into LyricSegment[]
   */
  static parseSubtitleText(content: string): LyricSegment[] {
    if (!content || !content.trim()) return [];

    const normalized = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    // Split by double newline or block patterns
    const blocks = normalized.split(/\n\s*\n/);
    const segments: LyricSegment[] = [];

    let segIndex = 0;

    for (const block of blocks) {
      const lines = block.trim().split('\n').map((l) => l.trim()).filter(Boolean);
      if (lines.length === 0) continue;

      // Check if line 0 is WEBVTT header
      if (lines[0].toUpperCase().startsWith('WEBVTT') || lines[0].toUpperCase().startsWith('NOTE')) {
        continue;
      }

      let timeLineIdx = -1;
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].includes('-->')) {
          timeLineIdx = i;
          break;
        }
      }

      if (timeLineIdx === -1) continue;

      const timeLine = lines[timeLineIdx];
      const [startStr, endStr] = timeLine.split('-->').map((s) => s.trim().split(' ')[0]);

      const start = this.parseTimeToSeconds(startStr);
      const end = this.parseTimeToSeconds(endStr);
      const textLines = lines.slice(timeLineIdx + 1).join(' ').replace(/<[^>]+>/g, '').trim();

      if (!textLines) continue;

      const words = textLines.split(/\s+/).map((w, wIdx, arr) => {
        const wordDur = (end - start) / Math.max(1, arr.length);
        return {
          word: w,
          start: start + wIdx * wordDur,
          end: start + (wIdx + 1) * wordDur,
        };
      });

      segments.push({
        id: `imported-seg-${Math.round(start * 100)}-${segIndex++}`,
        text: textLines,
        start,
        end: Math.max(start + 0.3, end),
        words,
      });
    }

    return segments.sort((a, b) => a.start - b.start);
  }

  /**
   * Triggers client-side or native desktop download of the .srt file with track titles info.
   */
  static async downloadSRT(segments: LyricSegment[], filename: string, tracks?: AudioTrackItem[]): Promise<string | null> {
    const srtContent = this.segmentsToSRT(segments, tracks);
    if (!srtContent) return null;

    let baseName = filename.replace(/\.[^/.]+$/, '').replace(/[^a-zA-Z0-9_\- ]/g, '_').trim() || 'subtitles';
    
    // If multiple tracks exist in playlist, construct informative filename
    if (tracks && tracks.length > 1) {
      const firstTitle = tracks[0].name.replace(/\.[^/.]+$/, '').trim();
      baseName = `${tracks.length}_Lagu_Playlist_${firstTitle}_etc`;
    }

    const finalFilename = `${baseName}.srt`;

    // Native Desktop App Save (Tauri)
    if (isDesktop()) {
      try {
        const { invoke } = await import('@tauri-apps/api/core');
        const savedPath = await invoke<string>('save_text_file', {
          filename: finalFilename,
          content: srtContent,
        });
        console.log('SRT file saved natively on desktop:', savedPath);
        return savedPath;
      } catch (err) {
        console.warn('Native desktop save_text_file failed, falling back to browser download:', err);
      }
    }

    // Standard Browser Fallback
    const blob = new Blob([srtContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = finalFilename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 4000);
    return null;
  }
}
