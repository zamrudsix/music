<script lang="ts">
  import { projectStore } from '../../lib/stores/project.svelte';
  import { videoExporter } from './exporter.svelte';
  import { 
    Download, 
    X, 
    CheckCircle2, 
    AlertCircle, 
    Loader2, 
    Film, 
    Sliders, 
    Cpu,
    Sparkles,
    Gauge,
    Hourglass,
    Zap,
    Minimize2,
    Maximize2,
    Clock,
    ShieldAlert,
    Lock,
    FolderOpen,
    RotateCcw,
    Scissors
  } from '@lucide/svelte';
  import { licenseManager } from '../licensing';
  import { isWindows, isDesktop } from '../../lib/utils/platform';
  import { sweepOpfsTempFiles } from '../../lib/utils/storage';

  interface Props {
    onOpenLicense?: () => void;
  }

  let { onOpenLicense }: Props = $props();

  let exportedBlob = $state<Blob | null>(null);
  let savedFilePath = $state<string | null>(null);
  let showModal = $state(false);

  export function open() {
    showModal = true;
    exportedBlob = null;
    savedFilePath = null;
    videoExporter.errorMessage = null;
    if (!projectStore.project.exportSettings.customExportDir) {
      const saved = localStorage.getItem('beras_custom_export_dir');
      if (saved) {
        projectStore.project.exportSettings.customExportDir = saved;
      }
    }
    if (!projectStore.project.exportSettings.exportRange) {
      const totalDur = Math.max(1, Math.round(projectStore.project.audio.duration || 30));
      projectStore.project.exportSettings.exportRange = {
        enabled: false,
        startTime: 0,
        endTime: Math.min(30, totalDur),
      };
    }
  }

  let startInputStr = $state('0:00');
  let endInputStr = $state('0:30');

  $effect(() => {
    const range = projectStore.project.exportSettings.exportRange;
    if (range) {
      startInputStr = secondsToTimeString(range.startTime);
      endInputStr = secondsToTimeString(range.endTime);
    }
  });

  function secondsToTimeString(sec: number): string {
    const s = Math.max(0, Math.floor(sec));
    const m = Math.floor(s / 60);
    const rem = s % 60;
    return `${m}:${rem.toString().padStart(2, '0')}`;
  }

  function parseTimeToSeconds(input: string, fallback: number = 0): number {
    if (!input) return fallback;
    const str = input.trim();
    if (!str) return fallback;

    // Handle mm:ss or hh:mm:ss format
    if (str.includes(':')) {
      const parts = str.split(':').map((p) => parseFloat(p.trim()));
      if (parts.some((p) => isNaN(p))) return fallback;
      if (parts.length === 2) {
        return Math.max(0, Math.round(parts[0] * 60 + parts[1]));
      } else if (parts.length === 3) {
        return Math.max(0, Math.round(parts[0] * 3600 + parts[1] * 60 + parts[2]));
      }
    } else if (str.includes('.')) {
      const parts = str.split('.').map((p) => parseFloat(p.trim()));
      // Numpad format e.g. 6.00 or 6.30 (minutes.seconds)
      if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1]) && parts[1] < 60) {
        return Math.max(0, Math.round(parts[0] * 60 + parts[1]));
      }
    }

    const num = parseFloat(str);
    if (isNaN(num)) return fallback;
    return Math.max(0, Math.round(num));
  }

  function handleStartInputChange() {
    const range = projectStore.project.exportSettings.exportRange;
    if (!range) return;
    const parsed = parseTimeToSeconds(startInputStr, range.startTime);
    range.startTime = Math.max(0, Math.min(parsed, Math.max(0, range.endTime - 1)));
    startInputStr = secondsToTimeString(range.startTime);
    projectStore.saveToDB();
  }

  function handleEndInputChange() {
    const range = projectStore.project.exportSettings.exportRange;
    if (!range) return;
    const maxDur = Math.round(projectStore.project.audio.duration || 3600);
    const parsed = parseTimeToSeconds(endInputStr, range.endTime);
    range.endTime = Math.min(maxDur, Math.max(range.startTime + 1, parsed));
    endInputStr = secondsToTimeString(range.endTime);
    projectStore.saveToDB();
  }

  function setPartialRangePreset(type: '30s' | '1m' | '3m' | '5m' | 'round-minute' | 'nudge-minus' | 'nudge-plus' | 'preview' | 'full') {
    const totalDur = Math.max(1, Math.round(projectStore.project.audio.duration || 30));
    if (!projectStore.project.exportSettings.exportRange) {
      projectStore.project.exportSettings.exportRange = { enabled: true, startTime: 0, endTime: totalDur };
    }
    const range = projectStore.project.exportSettings.exportRange;
    range.enabled = true;
    if (type === '30s') {
      range.startTime = 0;
      range.endTime = Math.min(30, totalDur);
    } else if (type === '1m') {
      range.startTime = 0;
      range.endTime = Math.min(60, totalDur);
    } else if (type === '3m') {
      range.startTime = 0;
      range.endTime = Math.min(180, totalDur);
    } else if (type === '5m') {
      range.startTime = 0;
      range.endTime = Math.min(300, totalDur);
    } else if (type === 'round-minute') {
      const roundedMin = Math.floor(totalDur / 60) * 60;
      range.startTime = 0;
      range.endTime = Math.max(60, Math.min(roundedMin, totalDur));
    } else if (type === 'nudge-minus') {
      range.endTime = Math.max(range.startTime + 5, range.endTime - 30);
    } else if (type === 'nudge-plus') {
      range.endTime = Math.min(totalDur, range.endTime + 30);
    } else if (type === 'preview') {
      const cur = Math.max(0, Math.floor(projectStore.currentTime));
      range.startTime = Math.min(cur, Math.max(0, totalDur - 5));
      range.endTime = Math.min(totalDur, range.startTime + 30);
    } else if (type === 'full') {
      range.startTime = 0;
      range.endTime = totalDur;
    }
    startInputStr = secondsToTimeString(range.startTime);
    endInputStr = secondsToTimeString(range.endTime);
    projectStore.saveToDB();
  }

  async function handleSelectExportFolder() {
    if (!isDesktop()) return;
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      const folder = await invoke<string | null>('select_folder', { title: 'Pilih Folder Tujuan Export Video (JANGAN di C:)' });
      if (folder) {
        const lower = folder.toLowerCase();
        if (lower.startsWith('c:') || lower.startsWith('c:\\') || lower.startsWith('c:/')) {
          alert('Dilarang menggunakan drive C:/. Silakan pilih folder di drive lain (D:, E:, F:, dll).');
          return;
        }
        projectStore.project.exportSettings.customExportDir = folder;
        localStorage.setItem('beras_custom_export_dir', folder);
        projectStore.saveToDB();
      }
    } catch (e: any) {
      alert('Gagal memilih folder: ' + e.message);
    }
  }

  function handleResetExportFolder() {
    projectStore.project.exportSettings.customExportDir = undefined;
    localStorage.removeItem('beras_custom_export_dir');
    projectStore.saveToDB();
  }

  export function close() {
    if (videoExporter.isExporting) {
      videoExporter.cancelExport();
    }
    if (exportedBlob) {
      exportedBlob = null;
    }
    savedFilePath = null;
    showModal = false;
    sweepOpfsTempFiles().catch(() => {});
  }

  async function openSavedFileLocation() {
    if (!savedFilePath) return;
    if (isDesktop()) {
      try {
        const { invoke } = await import('@tauri-apps/api/core');
        await invoke('open_in_explorer', { path: savedFilePath });
      } catch (e) {
        console.warn('Could not open file location:', e);
      }
    }
  }

  async function handleStartExport(e?: Event) {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    try {
      exportedBlob = await videoExporter.startExport();
      if (exportedBlob) {
        await handleDownload();
      }
    } catch (err: any) {
      console.error('Export error caught:', err);
    }
  }

  async function handleDownload(e?: Event) {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    if (exportedBlob) {
      const sanitizedTitle = (projectStore.project.title || 'visualizer')
        .toLowerCase()
        .replace(/[^a-z0-9_-]/g, '_');
      const now = new Date();
      const pad = (n: number) => n.toString().padStart(2, '0');
      const timestamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
      savedFilePath = await videoExporter.downloadBlob(exportedBlob, `${timestamp}_${sanitizedTitle}.mp4`);
    }
  }

  function formatDuration(seconds: number): string {
    if (seconds <= 0) return '0s';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    if (m > 0) {
      return `${m}m ${s}s`;
    }
    return `${s}s`;
  }

  function formatETA(seconds: number): string {
    if (seconds <= 0) return 'Loading...';
    return formatDuration(seconds);
  }
</script>

{#if showModal}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div 
    class="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-200"
  >
    <div class="bg-neutral-900 border border-neutral-800 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[88vh] text-neutral-100 animate-in zoom-in-95 duration-200">
      
      <!-- Header (Fixed) -->
      <div class="p-4 sm:p-5 border-b border-neutral-800 flex items-center justify-between bg-neutral-950/60 shrink-0">
        <div class="flex items-center gap-3">
          <div class="w-9 h-9 rounded-xl bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-500/20 shrink-0">
            <Film class="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 class="text-sm font-semibold text-neutral-100">Export Video</h2>
            <p class="text-[10px] sm:text-[11px] text-neutral-400">High performance client-side offline GPU encoding</p>
          </div>
        </div>
        <button 
          type="button"
          onclick={close}
          class="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800 transition-colors cursor-pointer shrink-0"
        >
          <X class="w-4 h-4" />
        </button>
      </div>

      <!-- Content (Scrollable) -->
      <div class="p-4 sm:p-6 space-y-4 sm:space-y-5 flex-1 overflow-y-auto min-h-0">
        
        <!-- Free Watermark & Quota Notification Notice -->
        {#if !licenseManager.isLicensed}
          {#if licenseManager.freeQuotaRemaining > 0}
            <div class="p-3.5 bg-gradient-to-r from-cyan-950/60 to-blue-950/40 border border-cyan-500/30 rounded-xl flex items-center justify-between text-xs text-cyan-200">
              <div class="flex items-center gap-2.5">
                <div class="w-7 h-7 rounded-lg bg-cyan-500/20 text-cyan-300 flex items-center justify-center shrink-0">
                  <Sparkles class="w-4 h-4" />
                </div>
                <div>
                  <div class="font-bold text-cyan-100 flex items-center gap-1.5">
                    <span>Bonus Kuota Free: Bebas Watermark</span>
                    <span class="text-[10px] px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 font-mono font-bold">
                      {licenseManager.freeQuotaRemaining} Ekspor Tersisa
                    </span>
                  </div>
                  <div class="text-[11px] text-neutral-300 mt-0.5">
                    Hasil render otomatis bersih tanpa watermark!
                  </div>
                </div>
              </div>
              <button
                type="button"
                onclick={() => onOpenLicense?.()}
                class="px-2.5 py-1 bg-cyan-500/10 hover:bg-cyan-500/25 text-cyan-300 font-medium rounded-lg text-[11px] transition-colors cursor-pointer border border-cyan-500/30 shrink-0"
              >
                Info Lisensi
              </button>
            </div>
          {:else}
            <div class="p-3 bg-neutral-900/90 border border-neutral-800 rounded-xl flex items-center justify-between text-xs text-neutral-300">
              <div class="flex items-center gap-2.5">
                <ShieldAlert class="w-4 h-4 text-amber-400 shrink-0" />
                <div>
                  <span class="font-semibold text-neutral-200">Mode Free Edition:</span>
                  <span class="text-neutral-400 ml-1">Menyertakan watermark elegan di sudut video.</span>
                </div>
              </div>
              <button
                type="button"
                onclick={() => onOpenLicense?.()}
                class="px-2.5 py-1 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 font-semibold rounded-lg text-[11px] transition-colors cursor-pointer border border-amber-500/30 shrink-0"
              >
                Hapus Watermark (PRO)
              </button>
            </div>
          {/if}
        {/if}

        <!-- Video Specs & Direct Resolution Quick Selector -->
        {#if !videoExporter.isExporting && !exportedBlob}

          <div class="space-y-3.5 p-3.5 bg-neutral-950 rounded-xl border border-neutral-800 text-xs">
            <!-- Partial Export (Potong Panjang MP3 / Custom Duration) -->
            <div class="p-3 rounded-xl bg-neutral-900/90 border border-neutral-800 text-xs space-y-2.5">
              <div class="flex items-center justify-between">
                <span class="text-neutral-200 font-semibold flex items-center gap-1.5 text-xs">
                  <Scissors class="w-3.5 h-3.5 text-cyan-400" />
                  Durasi Render Video (Potong Panjang MP3):
                </span>
                <div class="flex items-center gap-1 bg-neutral-950 p-0.5 rounded-lg border border-neutral-800">
                  <button
                    type="button"
                    onclick={() => {
                      if (!projectStore.project.exportSettings.exportRange) {
                        projectStore.project.exportSettings.exportRange = { enabled: false, startTime: 0, endTime: Math.round(projectStore.project.audio.duration || 30) };
                      }
                      projectStore.project.exportSettings.exportRange.enabled = false;
                      projectStore.saveToDB();
                    }}
                    class={`px-2.5 py-1 rounded text-[11px] font-medium transition-colors cursor-pointer ${!projectStore.project.exportSettings.exportRange?.enabled ? 'bg-cyan-500/20 text-cyan-300 font-bold border border-cyan-500/40' : 'text-neutral-400 hover:text-neutral-200'}`}
                  >
                    Semua Lagu ({secondsToTimeString(projectStore.project.audio.duration || 10)})
                  </button>
                  <button
                    type="button"
                    onclick={() => {
                      if (!projectStore.project.exportSettings.exportRange) {
                        projectStore.project.exportSettings.exportRange = { enabled: true, startTime: 0, endTime: Math.min(30, Math.round(projectStore.project.audio.duration || 30)) };
                      }
                      projectStore.project.exportSettings.exportRange.enabled = true;
                      projectStore.saveToDB();
                    }}
                    class={`px-2.5 py-1 rounded text-[11px] font-medium transition-colors cursor-pointer ${projectStore.project.exportSettings.exportRange?.enabled ? 'bg-cyan-500/20 text-cyan-300 font-bold border border-cyan-500/40' : 'text-neutral-400 hover:text-neutral-200'}`}
                  >
                    ✂️ Potong Sebagian
                  </button>
                </div>
              </div>

              {#if projectStore.project.exportSettings.exportRange?.enabled}
                <div class="p-3 rounded-lg bg-neutral-950/80 border border-neutral-800 space-y-2.5 animate-in fade-in">
                  <div class="grid grid-cols-2 gap-3 text-[11px]">
                    <div>
                      <div class="flex items-center justify-between mb-1">
                        <span class="text-neutral-300 font-medium text-[11px]">Waktu Mulai:</span>
                        <span class="text-cyan-400 font-mono text-xs font-bold">{secondsToTimeString(projectStore.project.exportSettings.exportRange.startTime)} ({projectStore.project.exportSettings.exportRange.startTime}s)</span>
                      </div>
                      <input 
                        type="text"
                        bind:value={startInputStr}
                        onchange={handleStartInputChange}
                        onblur={handleStartInputChange}
                        onkeydown={(e) => { if (e.key === 'Enter') handleStartInputChange(); }}
                        class="w-full bg-neutral-900 border border-neutral-700/80 rounded px-2.5 py-1.5 text-neutral-100 outline-none text-xs font-mono focus:border-cyan-500"
                        placeholder="0:00 atau 0"
                      />
                      <span class="text-[9px] text-neutral-500 mt-0.5 block">Format: 0:00 atau detik</span>
                    </div>
                    <div>
                      <div class="flex items-center justify-between mb-1">
                        <span class="text-neutral-300 font-medium text-[11px]">Waktu Selesai:</span>
                        <span class="text-cyan-400 font-mono text-xs font-bold">{secondsToTimeString(projectStore.project.exportSettings.exportRange.endTime)} ({projectStore.project.exportSettings.exportRange.endTime}s)</span>
                      </div>
                      <input 
                        type="text"
                        bind:value={endInputStr}
                        onchange={handleEndInputChange}
                        onblur={handleEndInputChange}
                        onkeydown={(e) => { if (e.key === 'Enter') handleEndInputChange(); }}
                        class="w-full bg-neutral-900 border border-neutral-700/80 rounded px-2.5 py-1.5 text-neutral-100 outline-none text-xs font-mono focus:border-cyan-500"
                        placeholder="6:00 atau 360"
                      />
                      <span class="text-[9px] text-neutral-500 mt-0.5 block">Format: 6:00 atau detik</span>
                    </div>
                  </div>

                  <!-- Quick Presets -->
                  <div class="flex items-center gap-1.5 flex-wrap pt-1 border-t border-neutral-800">
                    <span class="text-neutral-400 text-[10px] font-medium">Preset Cepat:</span>
                    {#if Math.floor((projectStore.project.audio.duration || 0) / 60) > 0}
                      {@const roundMin = Math.floor((projectStore.project.audio.duration || 0) / 60) * 60}
                      <button 
                        type="button" 
                        onclick={() => setPartialRangePreset('round-minute')}
                        class="px-2.5 py-1 rounded bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 text-[10px] font-bold transition-colors cursor-pointer border border-cyan-500/40"
                        title={`Jadikan durasi genap ${secondsToTimeString(roundMin)}`}
                      >
                        ⚡ Bulatkan ke {secondsToTimeString(roundMin)}
                      </button>
                    {/if}
                    <button 
                      type="button" 
                      onclick={() => setPartialRangePreset('30s')}
                      class="px-2.5 py-1 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-[10px] font-semibold transition-colors cursor-pointer border border-neutral-700"
                    >
                      30 Detik
                    </button>
                    <button 
                      type="button" 
                      onclick={() => setPartialRangePreset('1m')}
                      class="px-2.5 py-1 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-[10px] font-semibold transition-colors cursor-pointer border border-neutral-700"
                    >
                      1 Menit
                    </button>
                    {#if (projectStore.project.audio.duration || 0) >= 180}
                      <button 
                        type="button" 
                        onclick={() => setPartialRangePreset('3m')}
                        class="px-2.5 py-1 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-[10px] font-semibold transition-colors cursor-pointer border border-neutral-700"
                      >
                        3 Menit
                      </button>
                    {/if}
                    {#if (projectStore.project.audio.duration || 0) >= 300}
                      <button 
                        type="button" 
                        onclick={() => setPartialRangePreset('5m')}
                        class="px-2.5 py-1 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-[10px] font-semibold transition-colors cursor-pointer border border-neutral-700"
                      >
                        5 Menit
                      </button>
                    {/if}
                    <button 
                      type="button" 
                      onclick={() => setPartialRangePreset('nudge-minus')}
                      class="px-2 py-1 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-[10px] font-semibold transition-colors cursor-pointer border border-neutral-700"
                      title="Kurangi 30 detik dari waktu selesai"
                    >
                      -30s
                    </button>
                    <button 
                      type="button" 
                      onclick={() => setPartialRangePreset('nudge-plus')}
                      class="px-2 py-1 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-[10px] font-semibold transition-colors cursor-pointer border border-neutral-700"
                      title="Tambah 30 detik ke waktu selesai"
                    >
                      +30s
                    </button>
                    <button 
                      type="button" 
                      onclick={() => setPartialRangePreset('preview')}
                      class="px-2.5 py-1 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-[10px] font-semibold transition-colors cursor-pointer border border-neutral-700"
                      title="Mulai dari posisi kursor preview saat ini"
                    >
                      Posisi Saat Ini (+30s)
                    </button>
                  </div>

                  <!-- Summary badge -->
                  <div class="text-[11px] text-cyan-300 bg-cyan-950/40 border border-cyan-800/40 rounded p-2 flex items-center justify-between font-medium">
                    <span>
                      🎯 Durasi Render: <b>{Math.max(1, Math.round(projectStore.project.exportSettings.exportRange.endTime - projectStore.project.exportSettings.exportRange.startTime))} detik</b>
                      ({secondsToTimeString(projectStore.project.exportSettings.exportRange.startTime)} s/d {secondsToTimeString(projectStore.project.exportSettings.exportRange.endTime)})
                    </span>
                    <span class="text-neutral-400 font-mono text-[10px]">
                      ~{Math.round(Math.max(1, projectStore.project.exportSettings.exportRange.endTime - projectStore.project.exportSettings.exportRange.startTime) * projectStore.project.exportSettings.fps)} frame
                    </span>
                  </div>
                </div>
              {/if}
            </div>

            <div class="flex items-center justify-between pt-1">
              <span class="text-neutral-300 font-semibold flex items-center gap-1.5">
                <Maximize2 class="w-3.5 h-3.5 text-cyan-400" />
                Pilih Resolusi Render:
              </span>
              <span class="text-[10px] font-mono text-cyan-400 bg-cyan-950/60 px-2 py-0.5 rounded border border-cyan-800/60">
                {projectStore.project.exportSettings.width}x{projectStore.project.exportSettings.height}
              </span>
            </div>

            <div class="grid grid-cols-2 gap-2">
              <button 
                type="button"
                onclick={() => projectStore.updateExportResolution('1280x720')}
                class={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${projectStore.project.exportSettings.resolution === '1280x720' ? 'border-cyan-500 bg-cyan-500/10 text-cyan-300 shadow-sm' : 'border-neutral-800 bg-neutral-900/60 text-neutral-400 hover:border-neutral-700'}`}
              >
                <div class="font-bold flex items-center justify-between text-xs">
                  <span>720p HD (16:9)</span>
                  <span class="text-[9px] px-1 rounded bg-amber-500/20 text-amber-300 font-semibold uppercase">Super Cepat 🚀</span>
                </div>
                <div class="text-[10px] text-neutral-500 mt-0.5">1280x720 • Speed hingga 7x–12x</div>
              </button>

              <button 
                type="button"
                onclick={() => projectStore.updateExportResolution('1920x1080')}
                class={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${projectStore.project.exportSettings.resolution === '1920x1080' ? 'border-cyan-500 bg-cyan-500/10 text-cyan-300 shadow-sm' : 'border-neutral-800 bg-neutral-900/60 text-neutral-400 hover:border-neutral-700'}`}
              >
                <div class="font-bold flex items-center justify-between text-xs">
                  <span>1080p FHD (16:9)</span>
                  <span class="text-[9px] px-1 rounded bg-cyan-500/20 text-cyan-300 font-semibold uppercase">Crisp Ultra</span>
                </div>
                <div class="text-[10px] text-neutral-500 mt-0.5">1920x1080 • Kualitas YouTube Maksimal</div>
              </button>
            </div>

            <!-- Other Formats Selector -->
            <div class="flex items-center justify-between pt-1 border-t border-neutral-900 text-[11px]">
              <span class="text-neutral-500">Format Lainnya:</span>
              <div class="flex gap-1.5">
                <button 
                  type="button"
                  onclick={() => projectStore.updateExportResolution('720x1280')}
                  class={`px-2 py-0.5 rounded text-[10px] font-medium border cursor-pointer ${projectStore.project.exportSettings.resolution === '720x1280' ? 'border-cyan-500 bg-cyan-500/20 text-cyan-300' : 'border-neutral-800 text-neutral-400'}`}
                >
                  720p TikTok (9:16)
                </button>
                <button 
                  type="button"
                  onclick={() => projectStore.updateExportResolution('1080x1920')}
                  class={`px-2 py-0.5 rounded text-[10px] font-medium border cursor-pointer ${projectStore.project.exportSettings.resolution === '1080x1920' ? 'border-cyan-500 bg-cyan-500/20 text-cyan-300' : 'border-neutral-800 text-neutral-400'}`}
                >
                  1080p Reels (9:16)
                </button>
                <button 
                  type="button"
                  onclick={() => projectStore.updateExportResolution('1080x1080')}
                  class={`px-2 py-0.5 rounded text-[10px] font-medium border cursor-pointer ${projectStore.project.exportSettings.resolution === '1080x1080' ? 'border-cyan-500 bg-cyan-500/20 text-cyan-300' : 'border-neutral-800 text-neutral-400'}`}
                >
                  Square (1:1)
                </button>
              </div>
            </div>

            <!-- Frame Rate Quick Selector -->
            <div class="flex items-center justify-between pt-2 border-t border-neutral-900 text-[11px]">
              <span class="text-neutral-500 flex items-center gap-1">
                <Film class="w-3 h-3 text-cyan-400" />
                Frame Rate:
              </span>
              <div class="flex gap-1.5">
                <button 
                  type="button"
                  onclick={() => { projectStore.project.exportSettings.fps = 24; projectStore.saveToDB(); }}
                  class={`px-2.5 py-0.5 rounded text-[10px] font-semibold border cursor-pointer ${projectStore.project.exportSettings.fps === 24 ? 'border-cyan-500 bg-cyan-500/20 text-cyan-300' : 'border-neutral-800 text-neutral-400 hover:border-neutral-700'}`}
                >
                  24 FPS 🎬 (Tercepat)
                </button>
                <button 
                  type="button"
                  onclick={() => { projectStore.project.exportSettings.fps = 30; projectStore.saveToDB(); }}
                  class={`px-2.5 py-0.5 rounded text-[10px] font-semibold border cursor-pointer ${projectStore.project.exportSettings.fps === 30 ? 'border-cyan-500 bg-cyan-500/20 text-cyan-300' : 'border-neutral-800 text-neutral-400 hover:border-neutral-700'}`}
                >
                  30 FPS (Standar)
                </button>
                <button 
                  type="button"
                  onclick={() => { projectStore.project.exportSettings.fps = 60; projectStore.saveToDB(); }}
                  class={`px-2.5 py-0.5 rounded text-[10px] font-semibold border cursor-pointer ${projectStore.project.exportSettings.fps === 60 ? 'border-cyan-500 bg-cyan-500/20 text-cyan-300' : 'border-neutral-800 text-neutral-400 hover:border-neutral-700'}`}
                >
                  60 FPS (Smooth)
                </button>
              </div>
            </div>

            <!-- Windows Turbo Mode: Auto-minimize toggle with warning -->
            {#if isWindows()}
              <div class="mt-3 p-2.5 rounded-xl bg-cyan-950/20 border border-cyan-800/40 text-xs flex flex-col gap-2">
                <label class="flex items-center gap-2.5 cursor-pointer select-none">
                  <input 
                    type="checkbox"
                    checked={videoExporter.autoMinimizeOnWindows}
                    onchange={(e) => videoExporter.toggleAutoMinimize(e.currentTarget.checked)}
                    class="rounded border-neutral-700 text-cyan-500 focus:ring-cyan-500/20 bg-neutral-900 w-4 h-4 cursor-pointer accent-cyan-500"
                  />
                  <div class="flex items-center gap-1.5 font-semibold text-cyan-300 text-[11px]">
                    <Zap class="w-3.5 h-3.5 text-cyan-400" />
                    Mode Turbo Windows (Auto-minimize saat render)
                  </div>
                </label>
                <div class="text-[10px] text-neutral-400 pl-6 leading-relaxed">
                  ⚠️ <b>Perhatian:</b> Jendela aplikasi akan otomatis diminimize ke taskbar agar GPU tidak terbatasi oleh VSync layar. 
                  Anda tetap dapat memantau progres render secara live langsung dari <b class="text-neutral-300">judul jendela di Taskbar Windows</b>. Jendela otomatis terbuka kembali saat selesai.
                </div>
              </div>
            {/if}

            <!-- Custom Export Destination Folder (Item 4) -->
            <div class="mt-3 p-3 rounded-xl bg-neutral-950/80 border border-neutral-800 text-xs space-y-2">
              <div class="flex items-center justify-between text-neutral-300 font-medium">
                <span class="flex items-center gap-1.5 text-[11px]">
                  <FolderOpen class="w-3.5 h-3.5 text-cyan-400" />
                  Folder Tujuan Simpan Video:
                </span>
                {#if projectStore.project.exportSettings.customExportDir}
                  <button 
                    type="button" 
                    onclick={handleResetExportFolder}
                    class="text-[10px] text-neutral-500 hover:text-cyan-400 flex items-center gap-1 cursor-pointer transition-colors"
                  >
                    <RotateCcw class="w-2.5 h-2.5" />
                    Reset Default
                  </button>
                {/if}
              </div>

              <div class="flex items-center gap-2">
                <div class="flex-1 p-2 rounded-lg bg-neutral-900 border border-neutral-800 text-[11px] text-neutral-300 truncate font-mono select-all" title={projectStore.project.exportSettings.customExportDir || 'Default: Auto non-C: drive (poncoberas)'}>
                  {projectStore.project.exportSettings.customExportDir || '📁 Auto non-C: (poncoberas)'}
                </div>
                {#if isDesktop()}
                  <button 
                    type="button"
                    onclick={handleSelectExportFolder}
                    class="px-3 py-2 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-cyan-300 text-[11px] font-semibold flex items-center gap-1 transition-colors cursor-pointer shrink-0 border border-neutral-700"
                  >
                    <FolderOpen class="w-3.5 h-3.5 text-cyan-400" />
                    Pilih Folder...
                  </button>
                {/if}
              </div>
            </div>
          </div>
        {:else}
          <!-- Video Specs Card During Render -->
          <div class="grid grid-cols-3 gap-3 p-3 bg-neutral-950/80 rounded-xl border border-neutral-800/80 text-xs">
            <div>
              <span class="text-neutral-500 text-[10px] block uppercase">Resolution</span>
              <span class="font-semibold text-neutral-200">{projectStore.project.exportSettings.resolution}</span>
            </div>
            <div>
              <span class="text-neutral-500 text-[10px] block uppercase">Frame Rate</span>
              <span class="font-semibold text-neutral-200">{projectStore.project.exportSettings.fps} FPS</span>
            </div>
            <div>
              <span class="text-neutral-500 text-[10px] block uppercase">Duration</span>
              <span class="font-semibold text-neutral-200">
                {#if projectStore.project.exportSettings.exportRange?.enabled}
                  {Math.round(projectStore.project.exportSettings.exportRange.endTime - projectStore.project.exportSettings.exportRange.startTime)}s ({secondsToTimeString(projectStore.project.exportSettings.exportRange.startTime)} - {secondsToTimeString(projectStore.project.exportSettings.exportRange.endTime)})
                {:else}
                  {Math.round(projectStore.project.audio.duration || 10)}s
                {/if}
              </span>
            </div>
          </div>
        {/if}

        <!-- Progress or Status -->
        {#if videoExporter.isExporting}
          <div class="space-y-3.5 p-4 bg-neutral-950 rounded-xl border border-cyan-800/40 shadow-lg shadow-cyan-950/30 animate-in fade-in">
            <div class="flex items-center justify-between text-xs">
              <span class="text-neutral-200 font-semibold flex items-center gap-2">
                <Loader2 class="w-4 h-4 text-cyan-400 animate-spin" />
                {#if videoExporter.stage === 'preparing'}
                  Menyiapkan Media & Audio...
                {:else if videoExporter.stage === 'encoding_audio'}
                  Mengompres Audio Track (AAC)...
                {:else if videoExporter.stage === 'finalizing'}
                  Menyusun & Menyimpan File MP4 (Mohon tunggu, jangan tutup aplikasi)...
                {:else}
                  Encoding Video Frames...
                {/if}
              </span>
              <span class="font-mono text-cyan-400 font-bold text-sm">{Math.round(videoExporter.progress * 100)}%</span>
            </div>

            {#if videoExporter.stage === 'finalizing'}
              <div class="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-300 text-[11px] flex items-center gap-2 animate-pulse">
                <Hourglass class="w-4 h-4 shrink-0 text-amber-400" />
                <span><b>Sedang Menggabungkan Audio & Video:</b> Mohon jangan tutup aplikasi sampai file MP4 selesai disimpan.</span>
              </div>
            {/if}

            <!-- Progress Bar -->
            <div class="w-full h-3 bg-neutral-800 rounded-full overflow-hidden p-0.5 border border-neutral-700/50">
              <div 
                class="h-full bg-gradient-to-r from-cyan-500 via-indigo-500 to-fuchsia-500 transition-all duration-150 rounded-full shadow-[0_0_12px_rgba(6,182,212,0.6)]"
                style={`width: ${videoExporter.progress * 100}%;`}
              ></div>
            </div>

            <!-- Speed, Elapsed & ETA Telemetry Dashboard (4 Columns) -->
            <div class="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
              <div class="p-2 rounded-lg bg-neutral-900 border border-neutral-800/80 flex items-center gap-2">
                <Gauge class="w-4 h-4 text-cyan-400 shrink-0" />
                <div class="min-w-0">
                  <div class="text-[9px] text-neutral-500 uppercase font-medium">Speed Render</div>
                  <div class="font-mono text-xs font-bold text-cyan-300">
                    {videoExporter.currentFPS} FPS <span class="text-[10px] text-neutral-400 font-normal">({videoExporter.speedMultiplier}x)</span>
                  </div>
                </div>
              </div>

              <div class="p-2 rounded-lg bg-neutral-900 border border-neutral-800/80 flex items-center gap-2">
                <Clock class="w-4 h-4 text-emerald-400 shrink-0" />
                <div class="min-w-0">
                  <div class="text-[9px] text-neutral-500 uppercase font-medium">Waktu Berjalan</div>
                  <div class="font-mono text-xs font-bold text-emerald-300">
                    {formatDuration(videoExporter.elapsedSeconds)}
                  </div>
                </div>
              </div>

              <div class="p-2 rounded-lg bg-neutral-900 border border-neutral-800/80 flex items-center gap-2">
                <Hourglass class="w-4 h-4 text-amber-400 shrink-0" />
                <div class="min-w-0">
                  <div class="text-[9px] text-neutral-500 uppercase font-medium">Sisa Estimasi</div>
                  <div class="font-mono text-xs font-bold text-amber-300">
                    {formatETA(videoExporter.etaSeconds)}
                  </div>
                </div>
              </div>

              <div class="p-2 rounded-lg bg-neutral-900 border border-neutral-800/80 flex items-center gap-2">
                <Film class="w-4 h-4 text-indigo-400 shrink-0" />
                <div class="min-w-0">
                  <div class="text-[9px] text-neutral-500 uppercase font-medium">Progres Frame</div>
                  <div class="font-mono text-xs font-bold text-neutral-200 truncate">
                    {videoExporter.currentFrame}/{videoExporter.totalFrames}
                  </div>
                </div>
              </div>
            </div>
          </div>
        {:else if exportedBlob}
          <div class="p-4 bg-emerald-950/20 border border-emerald-800/30 rounded-xl flex items-center gap-3 text-emerald-300 text-xs animate-in zoom-in-95">
            <CheckCircle2 class="w-6 h-6 text-emerald-400 shrink-0" />
            <div class="flex-1 min-w-0">
              <div class="font-semibold text-emerald-200 text-sm">Video Selesai & Auto Downloaded!</div>
              <div class="text-[11px] text-emerald-400/80 mt-0.5">
                Total waktu render: <strong>{formatDuration(videoExporter.finalRenderTimeSeconds)}</strong> • Ukuran file: {(exportedBlob.size / (1024 * 1024)).toFixed(2)} MB
              </div>
              {#if savedFilePath}
                <div class="mt-2 text-[11px] bg-emerald-950/60 p-2.5 rounded-lg border border-emerald-800/40 text-emerald-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div class="break-all select-all font-mono text-[10px]">
                    📁 <strong>{savedFilePath}</strong>
                  </div>
                  <button
                    type="button"
                    onclick={openSavedFileLocation}
                    class="px-2.5 py-1 bg-emerald-700/60 hover:bg-emerald-600 text-white rounded text-[10px] font-semibold shrink-0 cursor-pointer transition-colors"
                  >
                    Buka di Folder
                  </button>
                </div>
              {/if}
            </div>
          </div>
        {:else if videoExporter.errorMessage}
          <div class="p-4 bg-rose-950/20 border border-rose-800/30 rounded-xl flex items-center gap-3 text-rose-300 text-xs animate-in zoom-in-95">
            <AlertCircle class="w-4 h-4 text-rose-400 shrink-0" />
            <div>
              <div class="font-semibold text-rose-200">Render Gagal</div>
              <div class="text-[11px] text-rose-400/80 mt-0.5">{videoExporter.errorMessage}</div>
            </div>
          </div>
        {/if}

        {#if videoExporter.warningMessage}
          <div class="p-3.5 bg-amber-950/30 border border-amber-800/40 rounded-xl flex items-start gap-2.5 text-amber-300 text-xs animate-in zoom-in-95">
            <AlertCircle class="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <div class="space-y-1">
              <div class="font-semibold text-amber-200">Perhatian Video Background:</div>
              <div class="text-[11px] text-amber-300/90 leading-relaxed whitespace-pre-line">{videoExporter.warningMessage}</div>
            </div>
          </div>
        {/if}
      </div>

      <!-- Footer Buttons (Fixed) -->
      <div class="p-4 sm:p-5 border-t border-neutral-800 bg-neutral-950/60 flex items-center justify-end gap-2.5 sm:gap-3 shrink-0">
        <button 
          type="button"
          onclick={close}
          class="px-3.5 py-2 rounded-xl text-xs font-medium text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800 transition-colors cursor-pointer"
        >
          {exportedBlob ? 'Tutup & Bersihkan RAM' : 'Batal'}
        </button>

        {#if videoExporter.isExporting}
          <button 
            type="button"
            onclick={() => videoExporter.cancelExport()}
            class="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold shadow-lg shadow-rose-600/20 transition-colors cursor-pointer"
          >
            Cancel Render
          </button>
        {:else}
          {#if exportedBlob}
            <button 
              type="button"
              onclick={handleDownload}
              class="px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 bg-emerald-500 hover:bg-emerald-400 text-white text-xs font-semibold flex items-center gap-2 shadow-lg shadow-emerald-500/20 transition-all active:scale-95 cursor-pointer"
            >
              <Download class="w-4 h-4" />
              Download Lagi
            </button>
          {/if}
          <button 
            type="button"
            onclick={handleStartExport}
            class="px-5 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 bg-cyan-500 hover:bg-cyan-400 text-white text-xs font-semibold flex items-center gap-2 shadow-lg shadow-cyan-500/20 transition-all active:scale-95 cursor-pointer"
          >
            <Sparkles class="w-4 h-4" />
            {#if licenseManager.isLicensed}
              Mulai Render MP4 (PRO)
            {:else if licenseManager.freeQuotaRemaining > 0}
              Mulai Render ({licenseManager.freeQuotaRemaining} Kuota Bebas Watermark)
            {:else}
              Mulai Render MP4
            {/if}
          </button>
        {/if}
      </div>
    </div>
  </div>
{/if}
