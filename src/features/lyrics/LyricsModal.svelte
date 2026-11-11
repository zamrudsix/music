<script lang="ts">
  import { projectStore } from '../../lib/stores/project.svelte';
  import { taskQueuePool } from './taskQueue.svelte';
  import { GroqService } from './groq';
  import { SubtitleService } from './subtitle';
  import type { LyricSegment } from '../../lib/types/project';
  import { 
    FileText, 
    X, 
    Upload, 
    Play, 
    Key, 
    Sliders, 
    AlertCircle, 
    Loader2, 
    Trash2, 
    ArrowRight,
    Zap,
    Ban,
    Download,
    FolderOpen,
    CheckCircle2,
    Languages
  } from '@lucide/svelte';

  let showModal = $state(false);
  let selectedTab = $state<'single' | 'batch'>('single');
  let isSingleLoading = $state(false);
  let singleStatusText = $state('Preparing...');
  let singleProgressPercent = $state(0);
  let singleError = $state<string | null>(null);
  let singleSuccessMsg = $state<string | null>(null);
  let abortController: AbortController | null = null;
  let subtitleFileInput = $state<HTMLInputElement>();
  let showClearConfirm = $state(false);

  let selectedLanguage = $state('id');

  const supportedLanguages = [
    { code: 'id', label: '🇮🇩 Indonesian (ID)' },
    { code: 'en', label: '🇺🇸 English (EN)' },
    { code: 'ja', label: '🇯🇵 Japanese (JA)' },
    { code: 'ko', label: '🇰🇷 Korean (KO)' },
    { code: 'auto', label: '🌐 Auto Detect' },
    { code: 'ms', label: '🇲🇾 Malay (MS)' },
    { code: 'ar', label: '🇸🇦 Arabic (AR)' },
    { code: 'zh', label: '🇨🇳 Chinese (ZH)' },
    { code: 'es', label: '🇪🇸 Spanish (ES)' },
    { code: 'fr', label: '🇫🇷 French (FR)' },
    { code: 'de', label: '🇩🇪 German (DE)' },
    { code: 'pt', label: '🇵🇹 Portuguese (PT)' },
    { code: 'ru', label: '🇷🇺 Russian (RU)' },
    { code: 'th', label: '🇹🇭 Thai (TH)' },
    { code: 'vi', label: '🇻🇳 Vietnamese (VI)' },
    { code: 'tl', label: '🇵🇭 Tagalog (TL)' },
  ];

  export function open() {
    showModal = true;
    singleError = null;
    singleSuccessMsg = null;
    singleProgressPercent = 0;
  }

  export function close() {
    if (isSingleLoading) {
      cancelSingleTranscribe();
    }
    showModal = false;
  }

  function cancelSingleTranscribe() {
    if (abortController) {
      abortController.abort();
      abortController = null;
    }
    isSingleLoading = false;
    singleProgressPercent = 0;
    singleStatusText = 'Cancelled';
  }

  async function handleSingleTranscribe() {
    if (!taskQueuePool.apiKey) {
      singleError = 'Please enter your Groq API Key first.';
      return;
    }
    if (!projectStore.audioBuffer && !projectStore.project.audio.tracks?.length && !projectStore.project.audio.url) {
      singleError = 'Please upload a track in the timeline first, or select a file.';
      return;
    }

    isSingleLoading = true;
    singleError = null;
    singleSuccessMsg = null;
    singleProgressPercent = 10;
    singleStatusText = 'Preparing audio payload...';

    abortController = new AbortController();

    try {
      let segments: LyricSegment[];
      let trackFileName = projectStore.project.audio.fileName || 'track_subtitles';

        const lang = projectStore.project.lyrics.config.language || selectedLanguage || 'id';

        if (projectStore.audioBuffer) {
          segments = await GroqService.transcribeAudioBuffer(
            projectStore.audioBuffer,
            taskQueuePool.apiKey,
            'whisper-large-v3-turbo',
            abortController.signal,
            (status: string, percent: number) => {
              singleStatusText = status;
              singleProgressPercent = percent;
            },
            lang
          );
        } else {
          let blob: Blob | null = null;
          if (projectStore.project.audio.tracks && projectStore.project.audio.tracks[0]?.file) {
            blob = projectStore.project.audio.tracks[0].file;
            trackFileName = projectStore.project.audio.tracks[0].name;
          } else if (projectStore.project.audio.url) {
            const res = await fetch(projectStore.project.audio.url);
            blob = await res.blob();
          }

          if (!blob) throw new Error('Audio data is not available. Please re-import track.');

          segments = await GroqService.transcribeAudio(
            blob,
            taskQueuePool.apiKey,
            'whisper-large-v3-turbo',
            abortController.signal,
            (status: string, percent: number) => {
              singleStatusText = status;
              singleProgressPercent = percent;
            },
            lang
          );
        }

      projectStore.project.lyrics.segments = segments;
      singleProgressPercent = 100;
      singleStatusText = 'Done! Auto-downloading SRT...';

      // Auto-download SRT subtitle corresponding to track name and track sequence
      try {
        SubtitleService.downloadSRT(segments, trackFileName, projectStore.project.audio.tracks);
      } catch (srtErr) {
        console.warn('Auto SRT download failed:', srtErr);
      }

      setTimeout(() => {
        close();
      }, 700);
    } catch (err: any) {
      if (err.name === 'AbortError') {
        singleError = 'Transcription cancelled by user.';
      } else {
        singleError = err.message || 'Failed to transcribe audio.';
      }
    } finally {
      isSingleLoading = false;
      abortController = null;
    }
  }

  async function handleImportSubtitleFile(e: Event) {
    const target = e.target as HTMLInputElement;
    if (target.files && target.files[0]) {
      const file = target.files[0];
      try {
        const text = await file.text();
        const parsed = SubtitleService.parseSubtitleText(text);
        if (!parsed || parsed.length === 0) {
          throw new Error('Tidak ada baris subtitle valid yang ditemukan di file.');
        }

        projectStore.project.lyrics.segments = parsed;
        projectStore.project.lyrics.config.enabled = true;
        projectStore.saveToDB();

        singleError = null;
        singleSuccessMsg = `Berhasil mengimpor ${parsed.length} baris subtitle dari ${file.name}!`;
        setTimeout(() => {
          singleSuccessMsg = null;
        }, 4000);
      } catch (err: any) {
        singleError = 'Gagal membaca subtitle: ' + (err.message || err);
      }
      target.value = '';
    }
  }

  function handleBatchUpload(e: Event) {
    const target = e.target as HTMLInputElement;
    if (target.files && target.files.length > 0) {
      taskQueuePool.addFiles(target.files);
    }
  }

  function applyBatchResultToProject(result: any) {
    projectStore.project.lyrics.segments = result;
    close();
  }

  function handleSegmentTextChange(seg: LyricSegment, newText: string) {
    seg.text = newText;
    const wordsList = newText.trim().split(/\s+/).filter(Boolean);
    if (wordsList.length > 0) {
      const duration = Math.max(0.1, seg.end - seg.start);
      seg.words = wordsList.map((w, idx) => ({
        word: w,
        start: seg.start + (idx / wordsList.length) * duration,
        end: seg.start + ((idx + 1) / wordsList.length) * duration,
      }));
    } else {
      seg.words = [];
    }
    projectStore.saveToDB();
  }

  function handleSegmentStartChange(seg: LyricSegment, newStartVal: number) {
    const start = Math.max(0, Number(newStartVal) || 0);
    seg.start = start;
    if (seg.end <= start) {
      seg.end = start + 1.0;
    }
    handleSegmentTextChange(seg, seg.text);
  }

  function handleSegmentEndChange(seg: LyricSegment, newEndVal: number) {
    const end = Math.max(seg.start + 0.1, Number(newEndVal) || (seg.start + 1.0));
    seg.end = end;
    handleSegmentTextChange(seg, seg.text);
  }

  async function manualDownloadSRT() {
    if (!projectStore.project.lyrics.segments || projectStore.project.lyrics.segments.length === 0) return;
    const trackFileName = projectStore.project.audio.fileName || 'track_subtitles';
    try {
      const savedPath = await SubtitleService.downloadSRT(projectStore.project.lyrics.segments, trackFileName, projectStore.project.audio.tracks);
      singleSuccessMsg = savedPath ? `File .SRT tersimpan di: ${savedPath}` : 'File .SRT berhasil diunduh!';
      setTimeout(() => {
        singleSuccessMsg = null;
      }, 5000);
    } catch (err: any) {
      singleError = 'Gagal mendownload SRT: ' + (err.message || err);
    }
  }

  function handleClearLyrics() {
    projectStore.clearLyrics();
    showClearConfirm = false;
    singleSuccessMsg = 'Semua segmen lirik berhasil dibersihkan.';
    setTimeout(() => {
      singleSuccessMsg = null;
    }, 3000);
  }
</script>

{#if showModal}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div 
    class="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
    onclick={(e) => e.target === e.currentTarget && close()}
  >
    <div class="bg-neutral-900 border border-neutral-800 rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col text-neutral-100 animate-in fade-in zoom-in-95 duration-200 max-h-[85vh]">
      
      <!-- Header -->
      <div class="p-5 border-b border-neutral-800 flex items-center justify-between bg-neutral-950/60">
        <div class="flex items-center gap-3">
          <div class="w-9 h-9 rounded-xl bg-gradient-to-tr from-cyan-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-cyan-500/20">
            <Zap class="w-5 h-5 text-white" />
          </div>
          <div>
            <div class="flex items-center gap-2">
              <h2 class="text-sm font-semibold text-neutral-100">Groq Whisper STT & Subtitle Manager</h2>
              <span class="text-[10px] font-mono px-2 py-0.5 rounded-full bg-cyan-950 text-cyan-400 border border-cyan-800/60">SRT / VTT Import & Export</span>
            </div>
            <p class="text-[11px] text-neutral-400">Transcribe audio, import custom subtitle (.srt/.vtt), or batch process playlist</p>
          </div>
        </div>
        <button 
          onclick={close}
          class="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800 transition-colors cursor-pointer"
        >
          <X class="w-4 h-4" />
        </button>
      </div>

      <!-- API Key & Settings Bar -->
      <div class="p-4 bg-neutral-950/80 border-b border-neutral-800 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div class="flex items-center gap-2 flex-1 min-w-[240px]">
          <Key class="w-4 h-4 text-cyan-400 shrink-0" />
          <input 
            type="password" 
            placeholder="Enter Groq API Key (gsk_...)"
            value={taskQueuePool.apiKey}
            oninput={(e) => taskQueuePool.setApiKey(e.currentTarget.value)}
            class="w-full bg-neutral-900 border border-neutral-800 rounded-lg px-2.5 py-1.5 text-xs text-neutral-200 placeholder-neutral-500 focus:border-cyan-500 outline-none"
          />
        </div>

        <div class="flex items-center gap-3">
          <div class="flex items-center gap-1.5">
            <Sliders class="w-3.5 h-3.5 text-fuchsia-400" />
            <span class="text-neutral-400">Concurrency:</span>
            <input 
              type="number" 
              min="1" 
              max="10" 
              bind:value={taskQueuePool.concurrencyLimit}
              class="w-12 bg-neutral-900 border border-neutral-800 rounded px-1.5 py-1 text-center text-xs text-neutral-200"
            />
          </div>

          <!-- Mode switch -->
          <div class="flex bg-neutral-900 p-0.5 rounded-lg border border-neutral-800">
            <button 
              class={`px-2.5 py-1 rounded text-xs font-medium cursor-pointer ${selectedTab === 'single' ? 'bg-neutral-800 text-cyan-400' : 'text-neutral-400'}`}
              onclick={() => selectedTab = 'single'}
            >
              Current Track
            </button>
            <button 
              class={`px-2.5 py-1 rounded text-xs font-medium cursor-pointer ${selectedTab === 'batch' ? 'bg-neutral-800 text-cyan-400' : 'text-neutral-400'}`}
              onclick={() => selectedTab = 'batch'}
            >
              Batch Queue ({taskQueuePool.tasks.length})
            </button>
          </div>
        </div>
      </div>

      <!-- Main Body -->
      <div class="p-5 overflow-y-auto space-y-4 flex-1 text-xs">
        {#if selectedTab === 'single'}
          <div class="space-y-4">
            <div class="p-4 rounded-xl bg-neutral-950 border border-neutral-800 space-y-3.5">
              <!-- Track Info & Import Subtitle -->
              <div class="flex items-center justify-between gap-3">
                <div class="flex items-center gap-3 min-w-0">
                  <div class="w-9 h-9 rounded-lg bg-neutral-800 flex items-center justify-center text-neutral-400 shrink-0">
                    <FileText class="w-4 h-4 text-cyan-400" />
                  </div>
                  <div class="min-w-0">
                    <div class="font-medium text-neutral-200 truncate">
                      {projectStore.project.audio.fileName || 'No timeline audio loaded'}
                    </div>
                    <div class="text-[11px] text-neutral-500 font-mono">
                      Model: whisper-large-v3-turbo • Per-Word Timestamps
                    </div>
                  </div>
                </div>

                <!-- Import Subtitle (.srt / .vtt) -->
                <button 
                  type="button"
                  onclick={() => subtitleFileInput?.click()}
                  class="px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 border border-neutral-700 font-medium rounded-lg flex items-center gap-1.5 transition-all cursor-pointer text-xs shrink-0"
                  title="Import external .srt or .vtt subtitle file"
                >
                  <FolderOpen class="w-3.5 h-3.5 text-cyan-400" />
                  Import .SRT
                </button>
                <input 
                  bind:this={subtitleFileInput}
                  type="file" 
                  accept=".srt,.vtt,text/plain"
                  class="hidden"
                  onchange={handleImportSubtitleFile}
                />
              </div>

              <!-- Dedicated Language Selector & Transcribe Action Bar -->
              <div class="p-3 rounded-xl bg-neutral-900 border border-neutral-800/80 flex items-center justify-between gap-3 flex-wrap sm:flex-nowrap">
                <div class="flex items-center gap-2.5 min-w-[200px]">
                  <div class="w-7 h-7 rounded-lg bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 flex items-center justify-center shrink-0">
                    <Languages class="w-4 h-4" />
                  </div>
                  <div>
                    <span class="text-xs font-semibold text-neutral-200 block">Bahasa Lagu / Audio</span>
                    <span class="text-[10px] text-neutral-400 block">Pilih bahasa audio agar transkripsi lirik akurat</span>
                  </div>
                </div>

                <div class="flex items-center gap-2">
                  <select
                    bind:value={projectStore.project.lyrics.config.language}
                    onchange={() => projectStore.saveToDB()}
                    class="px-3 py-2 bg-neutral-950 border border-neutral-700 text-neutral-200 font-medium rounded-lg text-xs outline-none focus:border-cyan-500 transition-colors cursor-pointer"
                    title="Pilih Bahasa Audio untuk Transkripsi"
                  >
                    {#each supportedLanguages as lang}
                      <option value={lang.code}>{lang.label}</option>
                    {/each}
                  </select>

                  {#if isSingleLoading}
                    <button 
                      onclick={cancelSingleTranscribe}
                      class="px-3.5 py-2 bg-rose-950/60 hover:bg-rose-900 text-rose-300 border border-rose-800/80 font-semibold rounded-lg flex items-center gap-1.5 transition-all cursor-pointer text-xs"
                    >
                      <Ban class="w-3.5 h-3.5" />
                      Cancel
                    </button>
                  {:else}
                    <button 
                      onclick={handleSingleTranscribe}
                      disabled={!projectStore.project.audio.tracks?.length && !projectStore.project.audio.url && !projectStore.audioBuffer}
                      class="px-4 py-2 bg-gradient-to-r from-cyan-500 to-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-semibold rounded-lg flex items-center gap-2 shadow-lg shadow-cyan-500/20 transition-all active:scale-95 cursor-pointer text-xs shrink-0"
                    >
                      <Play class="w-3.5 h-3.5 fill-current" />
                      Auto Transcribe
                    </button>
                  {/if}
                </div>
              </div>

              <!-- Real-time Progress Bar & Status -->
              {#if isSingleLoading}
                <div class="space-y-1.5 pt-2 border-t border-neutral-800/80 animate-in fade-in">
                  <div class="flex items-center justify-between text-[11px]">
                    <span class="text-cyan-400 flex items-center gap-1.5 font-medium">
                      <Loader2 class="w-3.5 h-3.5 animate-spin" />
                      {singleStatusText}
                    </span>
                    <span class="font-mono text-cyan-300 font-bold">{singleProgressPercent}%</span>
                  </div>
                  <div class="w-full h-2 bg-neutral-800 rounded-full overflow-hidden">
                    <div 
                      class="h-full bg-gradient-to-r from-cyan-500 to-indigo-500 transition-all duration-300 rounded-full shadow-[0_0_10px_rgba(6,182,212,0.6)]"
                      style={`width: ${singleProgressPercent}%;`}
                    ></div>
                  </div>
                </div>
              {/if}
            </div>

            {#if singleSuccessMsg}
              <div class="p-3 bg-emerald-950/30 border border-emerald-800/40 rounded-xl flex items-center gap-2 text-emerald-300 text-xs animate-in fade-in">
                <CheckCircle2 class="w-4 h-4 text-emerald-400 shrink-0" />
                <span>{singleSuccessMsg}</span>
              </div>
            {/if}

            {#if singleError}
              <div class="p-3 bg-rose-950/20 border border-rose-800/30 rounded-xl flex items-center gap-2 text-rose-300 text-xs">
                <AlertCircle class="w-4 h-4 text-rose-400 shrink-0" />
                <span>{singleError}</span>
              </div>
            {/if}

            <!-- Current Lyrics Preview / Editor -->
            <div class="space-y-2">
              <div class="flex items-center justify-between">
                <span class="font-medium text-neutral-300">Active Lyric Segments ({projectStore.project.lyrics.segments.length})</span>
                <div class="flex items-center gap-2">
                  {#if projectStore.project.lyrics.segments.length > 0}
                    <button 
                      onclick={manualDownloadSRT}
                      class="text-[11px] text-cyan-400 hover:text-cyan-300 flex items-center gap-1 cursor-pointer bg-cyan-950/40 hover:bg-cyan-950 px-2 py-0.5 rounded border border-cyan-800/40 transition-colors"
                      title="Download SRT Subtitle"
                    >
                      <Download class="w-3 h-3" />
                      Download .SRT
                    </button>
                    {#if showClearConfirm}
                      <div class="flex items-center gap-1 bg-rose-950/80 border border-rose-700/80 px-2 py-0.5 rounded animate-in fade-in">
                        <span class="text-[10px] text-rose-200">Yakin hapus?</span>
                        <button 
                          onclick={handleClearLyrics}
                          class="text-[10px] bg-rose-600 hover:bg-rose-500 text-white font-bold px-1.5 py-0.2 rounded cursor-pointer"
                        >
                          Ya, Hapus
                        </button>
                        <button 
                          onclick={() => { showClearConfirm = false; }}
                          class="text-[10px] text-neutral-400 hover:text-white px-1 cursor-pointer"
                        >
                          Batal
                        </button>
                      </div>
                    {:else}
                      <button 
                        onclick={() => { showClearConfirm = true; }}
                        class="text-[11px] text-rose-400 hover:text-rose-300 flex items-center gap-1 cursor-pointer bg-rose-950/40 hover:bg-rose-950 px-2 py-0.5 rounded border border-rose-800/40 transition-colors"
                      >
                        <Trash2 class="w-3 h-3" />
                        Bersihkan Lirik
                      </button>
                    {/if}
                  {/if}
                </div>
              </div>

              <div class="space-y-1.5 max-h-56 overflow-y-auto">
                {#each projectStore.project.lyrics.segments as seg, idx}
                  <div class="p-2.5 bg-neutral-950 rounded-lg border border-neutral-800 flex items-start justify-between gap-3 group">
                    <div class="flex-1 min-w-0">
                      <div class="flex items-center gap-2 mb-1.5 flex-wrap">
                        <div class="flex items-center gap-1 bg-neutral-900 border border-neutral-800 rounded px-1.5 py-0.5 text-[10px] text-neutral-300">
                          <span class="text-neutral-500 font-mono">Mulai:</span>
                          <input 
                            type="number" 
                            step="0.1" 
                            min="0" 
                            value={Number(seg.start.toFixed(2))} 
                            onchange={(e) => handleSegmentStartChange(seg, Number(e.currentTarget.value))}
                            class="w-14 bg-transparent text-cyan-400 font-mono text-center outline-none focus:text-white"
                          />
                          <span class="text-neutral-500">s</span>
                        </div>

                        <div class="flex items-center gap-1 bg-neutral-900 border border-neutral-800 rounded px-1.5 py-0.5 text-[10px] text-neutral-300">
                          <span class="text-neutral-500 font-mono">Selesai:</span>
                          <input 
                            type="number" 
                            step="0.1" 
                            min="0" 
                            value={Number(seg.end.toFixed(2))} 
                            onchange={(e) => handleSegmentEndChange(seg, Number(e.currentTarget.value))}
                            class="w-14 bg-transparent text-cyan-400 font-mono text-center outline-none focus:text-white"
                          />
                          <span class="text-neutral-500">s</span>
                        </div>

                        {#if seg.words}
                          <span class="text-[10px] text-neutral-500 font-mono">{seg.words.length} kata</span>
                        {/if}
                      </div>
                      <input 
                        type="text" 
                        value={seg.text} 
                        oninput={(e) => handleSegmentTextChange(seg, e.currentTarget.value)}
                        onchange={(e) => handleSegmentTextChange(seg, e.currentTarget.value)}
                        class="w-full bg-transparent text-neutral-200 text-xs outline-none border-b border-transparent focus:border-neutral-700"
                      />
                    </div>
                    <button 
                      onclick={() => {
                        projectStore.project.lyrics.segments.splice(idx, 1);
                        projectStore.saveToDB();
                      }}
                      class="text-neutral-500 hover:text-rose-400 p-1 cursor-pointer"
                    >
                      <Trash2 class="w-3.5 h-3.5" />
                    </button>
                  </div>
                {/each}

                {#if projectStore.project.lyrics.segments.length === 0}
                  <div class="p-6 text-center text-neutral-500 border border-dashed border-neutral-800 rounded-xl space-y-1">
                    <div>Belum ada lirik aktif.</div>
                    <div class="text-[11px] text-neutral-600">Klik "Import .SRT" untuk memuat file subtitle eksternal atau "Auto Transcribe" via Groq.</div>
                  </div>
                {/if}
              </div>
            </div>
          </div>

        <!-- BATCH TAB -->
        {:else}
          <div class="space-y-4">
            <div class="flex items-center justify-between">
              <div>
                <span class="font-medium text-neutral-200">Concurrent Batch Pool</span>
                <p class="text-[11px] text-neutral-400">Process up to {taskQueuePool.concurrencyLimit} songs simultaneously with whisper-large-v3-turbo</p>
              </div>

              <div class="flex items-center gap-2">
                <label class="px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 rounded-lg flex items-center gap-1.5 cursor-pointer transition-colors border border-neutral-700">
                  <Upload class="w-3.5 h-3.5" />
                  Add Audio Files
                  <input 
                    type="file" 
                    accept="audio/*" 
                    multiple 
                    class="hidden" 
                    onchange={handleBatchUpload} 
                  />
                </label>

                <button 
                  onclick={() => taskQueuePool.startQueue()}
                  disabled={taskQueuePool.isRunning || taskQueuePool.tasks.length === 0}
                  class="px-4 py-1.5 bg-gradient-to-r from-cyan-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 disabled:opacity-50 text-white font-semibold rounded-lg flex items-center gap-1.5 shadow-md shadow-cyan-500/20 transition-all cursor-pointer"
                >
                  {#if taskQueuePool.isRunning}
                    <Loader2 class="w-3.5 h-3.5 animate-spin" />
                    Queue Running...
                  {:else}
                    <Play class="w-3.5 h-3.5 fill-current" />
                    Start Batch Queue
                  {/if}
                </button>
              </div>
            </div>

            <!-- Task List -->
            <div class="space-y-2 max-h-64 overflow-y-auto">
              {#each taskQueuePool.tasks as task}
                <div class="p-3 bg-neutral-950 rounded-xl border border-neutral-800 space-y-2">
                  <div class="flex items-center justify-between">
                    <div class="flex items-center gap-2 min-w-0">
                      <span class="truncate font-medium text-neutral-200">{task.name}</span>
                      <span class={`text-[9px] px-1.5 py-0.5 rounded font-mono uppercase ${
                        task.status === 'completed' ? 'bg-emerald-950 text-emerald-400 border border-emerald-800' :
                        task.status === 'processing' ? 'bg-cyan-950 text-cyan-400 border border-cyan-800' :
                        task.status === 'failed' ? 'bg-rose-950 text-rose-400 border border-rose-800' :
                        'bg-neutral-800 text-neutral-400'
                      }`}>
                        {task.status}
                      </span>
                    </div>

                    <div class="flex items-center gap-2">
                      {#if task.status === 'completed' && task.result}
                        <button 
                          onclick={() => SubtitleService.downloadSRT(task.result!, task.name)}
                          class="px-2.5 py-1 bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 rounded-lg text-[11px] font-medium flex items-center gap-1 transition-colors border border-cyan-500/20 cursor-pointer"
                          title="Download Subtitle SRT"
                        >
                          <Download class="w-3 h-3" />
                          .SRT
                        </button>
                        <button 
                          onclick={() => applyBatchResultToProject(task.result)}
                          class="px-2.5 py-1 bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 rounded-lg text-[11px] font-medium flex items-center gap-1 transition-colors border border-cyan-500/20 cursor-pointer"
                        >
                          Use in Visualizer
                          <ArrowRight class="w-3 h-3" />
                        </button>
                      {/if}

                      <button 
                        onclick={() => taskQueuePool.removeTask(task.id)}
                        class="text-neutral-500 hover:text-rose-400 p-1 cursor-pointer"
                      >
                        <Trash2 class="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {#if task.status === 'processing'}
                    <div class="w-full h-1.5 bg-neutral-800 rounded-full overflow-hidden">
                      <div 
                        class="h-full bg-cyan-500 transition-all duration-300 rounded-full"
                        style={`width: ${task.progress * 100}%;`}
                      ></div>
                    </div>
                  {/if}

                  {#if task.error}
                    <div class="text-[10px] text-rose-400">{task.error}</div>
                  {/if}
                </div>
              {/each}

              {#if taskQueuePool.tasks.length === 0}
                <div class="p-6 text-center text-neutral-500 border border-dashed border-neutral-800 rounded-xl">
                  No batch tasks added. Click "Add Audio Files" above to queue multiple songs.
                </div>
              {/if}
            </div>
          </div>
        {/if}
      </div>

      <!-- Footer -->
      <div class="p-4 border-t border-neutral-800 bg-neutral-950/60 flex items-center justify-between text-xs">
        <div class="text-neutral-400 text-[11px]">
          API Keys stored securely in local browser storage.
        </div>
        <button 
          onclick={close}
          class="px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 font-medium rounded-xl transition-colors cursor-pointer"
        >
          Close
        </button>
      </div>
    </div>
  </div>
{/if}
