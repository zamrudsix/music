<script lang="ts">
  import { projectStore } from '../stores/project.svelte';
  import { audioEngine } from '../audio/player';
  import { 
    Upload, 
    Music, 
    Activity, 
    Loader2, 
    Plus, 
    Trash2, 
    ListMusic,
    Scissors,
    Image as ImageIcon
  } from '@lucide/svelte';
  import type { ImageOverlayItem } from '../types/project';

  interface Props {
    onOpenPlaylist?: () => void;
    onOpenExport?: () => void;
  }

  let { onOpenPlaylist, onOpenExport }: Props = $props();

  function formatTime(sec: number): string {
    const s = Math.max(0, Math.floor(sec));
    const m = Math.floor(s / 60);
    const rem = s % 60;
    return `${m}:${rem.toString().padStart(2, '0')}`;
  }

  let fileInput: HTMLInputElement;
  let isConfirmingDelete = $state(false);
  let deleteTimer: any = null;

  // Drag state for CapCut-style image overlay clips
  let dragging = $state<{
    id: string;
    type: 'move' | 'left' | 'right';
    startX: number;
    startTime: number;
    endTime: number;
    timelineWidth: number;
    totalDuration: number;
  } | null>(null);

  let timelineContainer: HTMLDivElement | null = null;

  function handleDeleteAllTracks() {
    if (!isConfirmingDelete) {
      isConfirmingDelete = true;
      if (deleteTimer) clearTimeout(deleteTimer);
      deleteTimer = setTimeout(() => {
        isConfirmingDelete = false;
      }, 3500);
    } else {
      isConfirmingDelete = false;
      if (deleteTimer) clearTimeout(deleteTimer);
      projectStore.clearAllAudioTracks();
    }
  }

  async function handleAudioUpload(e: Event) {
    const target = e.target as HTMLInputElement;
    if (!target.files || target.files.length === 0) return;

    await projectStore.addAudioTracks(target.files);
  }

  let isScrubbing = $state(false);

  function seekFromEvent(e: PointerEvent | MouseEvent) {
    e.stopPropagation();
    e.preventDefault();
    if (!projectStore.audioBuffer || !timelineContainer) return;
    const rect = timelineContainer.getBoundingClientRect();
    const x = Math.max(0, Math.min(rect.width, e.clientX - rect.left));
    const progress = x / rect.width;
    const targetTime = progress * (projectStore.project.audio.duration || 1);
    // Update UI immediately
    projectStore.currentTime = targetTime;
    audioEngine.seek(targetTime, projectStore.audioBuffer);
  }

  function handleTimelineClick(e: MouseEvent) {
    if (dragging) return;
    seekFromEvent(e);
  }

  function onTimelinePointerDown(e: PointerEvent) {
    if (dragging) return;
    isScrubbing = true;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    seekFromEvent(e);
  }

  function onTimelinePointerMove(e: PointerEvent) {
    if (isScrubbing) {
      seekFromEvent(e);
    } else {
      onPointerMove(e);
    }
  }

  function onTimelinePointerUp(e: PointerEvent) {
    if (isScrubbing) {
      isScrubbing = false;
      try { (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId); } catch {}
    }
    onPointerUp(e);
  }

  function getImageStartEnd(img: ImageOverlayItem, totalDur: number): { start: number; end: number } {
    const start = typeof img.startTime === 'number' && Number.isFinite(img.startTime) ? Math.max(0, img.startTime) : 0;
    const end = typeof img.endTime === 'number' && Number.isFinite(img.endTime) && img.endTime > start
      ? Math.min(totalDur, img.endTime)
      : totalDur;
    return { start, end };
  }

  function onImagePointerDown(e: PointerEvent, img: ImageOverlayItem, edge: 'left' | 'right' | 'move') {
    e.stopPropagation();
    e.preventDefault();

    const totalDur = projectStore.project.audio.duration || 1;
    const { start, end } = getImageStartEnd(img, totalDur);

    const rect = timelineContainer?.getBoundingClientRect();
    if (!rect) return;

    dragging = {
      id: img.id,
      type: edge,
      startX: e.clientX,
      startTime: start,
      endTime: end,
      timelineWidth: rect.width,
      totalDuration: totalDur,
    };

    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }

  function onPointerMove(e: PointerEvent) {
    if (!dragging) return;

    const dx = e.clientX - dragging.startX;
    const deltaSec = (dx / dragging.timelineWidth) * dragging.totalDuration;

    const img = projectStore.project.overlays.images.find(i => i.id === dragging!.id);
    if (!img) return;

    let newStart = dragging.startTime;
    let newEnd = dragging.endTime;

    if (dragging.type === 'left') {
      newStart = Math.max(0, Math.min(dragging.endTime - 0.2, dragging.startTime + deltaSec));
    } else if (dragging.type === 'right') {
      newEnd = Math.min(dragging.totalDuration, Math.max(dragging.startTime + 0.2, dragging.endTime + deltaSec));
    } else {
      // move
      const duration = dragging.endTime - dragging.startTime;
      newStart = Math.max(0, Math.min(dragging.totalDuration - duration, dragging.startTime + deltaSec));
      newEnd = newStart + duration;
    }

    img.startTime = Math.round(newStart * 10) / 10;
    img.endTime = Math.round(newEnd * 10) / 10;
  }

  function onPointerUp(e: PointerEvent) {
    if (dragging) {
      projectStore.saveToDB();
      dragging = null;
    }
    try {
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {}
  }
</script>

<div class="h-48 border-t border-neutral-800 bg-neutral-900/95 flex flex-col shrink-0 select-none z-20">
  <!-- Timeline Header / Controls -->
  <div class="h-8 border-b border-neutral-800/80 px-3 sm:px-4 flex items-center justify-between text-xs text-neutral-400">
    <div class="flex items-center gap-2 sm:gap-3">
      <span class="font-semibold text-neutral-200 flex items-center gap-1.5 text-[11px] sm:text-xs">
        <Music class="w-3.5 h-3.5 text-cyan-400" />
        Multi-Track Audio ({projectStore.project.audio.tracks?.length || 0})
      </span>

      <button 
        onclick={() => fileInput.click()}
        class="px-2 py-0.5 sm:px-2.5 sm:py-1 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-[10px] sm:text-[11px] font-medium flex items-center gap-1.5 transition-colors border border-neutral-700 cursor-pointer"
      >
        <Plus class="w-3 h-3 text-cyan-400" />
        <span>Add MP3 / WAV</span>
      </button>
      <input 
        bind:this={fileInput} 
        type="file" 
        accept="audio/*" 
        multiple
        class="hidden" 
        onchange={handleAudioUpload} 
      />

      <button 
        onclick={() => onOpenPlaylist?.()}
        class="px-2 py-0.5 sm:px-2.5 sm:py-1 rounded text-[10px] sm:text-[11px] font-medium flex items-center gap-1.5 transition-colors border cursor-pointer bg-neutral-800 hover:bg-neutral-700 text-cyan-300 border-neutral-700"
      >
        <ListMusic class="w-3 h-3 text-cyan-400" />
        <span>Playlist ({projectStore.project.audio.tracks?.length || 0})</span>
      </button>

      <!-- Potong Durasi MP3 / Render Range button -->
      <button 
        onclick={() => onOpenExport?.()}
        class={`px-2 py-0.5 sm:px-2.5 sm:py-1 rounded text-[10px] sm:text-[11px] font-medium flex items-center gap-1.5 transition-all border cursor-pointer ${
          projectStore.project.exportSettings.exportRange?.enabled 
            ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/50 shadow-sm shadow-cyan-950 font-semibold' 
            : 'bg-neutral-800 hover:bg-neutral-700 text-neutral-300 border-neutral-700'
        }`}
        title="Atur durasi render partial (potong durasi MP3 untuk diekspor)"
      >
        <Scissors class="w-3 h-3 text-cyan-400" />
        <span>
          {#if projectStore.project.exportSettings.exportRange?.enabled}
            Potong: {formatTime(projectStore.project.exportSettings.exportRange.startTime)} - {formatTime(projectStore.project.exportSettings.exportRange.endTime)} ({Math.round(projectStore.project.exportSettings.exportRange.endTime - projectStore.project.exportSettings.exportRange.startTime)}s)
          {:else}
            Potong Durasi MP3
          {/if}
        </span>
      </button>
    </div>

    <!-- Audio Track Summary & Counter -->
    <div class="flex items-center gap-2 sm:gap-3">
      {#if projectStore.project.audio.tracks && projectStore.project.audio.tracks.length > 0}
        <button 
          onclick={() => projectStore.undo()}
          class="px-1.5 py-0.5 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-[10px] flex items-center gap-1 border border-neutral-700"
          title="Undo (Ctrl+Z)"
        >
          ↩ Undo
        </button>
        <div class="flex items-center gap-1.5 text-[10px] sm:text-[11px] text-cyan-400 font-mono">
          <span class="text-neutral-400">Posisi:</span>
          <span class="text-cyan-300">{Math.floor(projectStore.currentTime / 60)}:{(Math.floor(projectStore.currentTime % 60)).toString().padStart(2, '0')}</span>
          <span class="text-neutral-600">/</span>
          <span>Total:</span>
          <input 
            type="text" 
            value={Math.floor(projectStore.project.audio.duration / 60) + ':' + (Math.floor(projectStore.project.audio.duration % 60)).toString().padStart(2, '0')}
            onchange={(e) => {
              const val = (e.target as HTMLInputElement).value.trim();
              const parts = val.split(':');
              let seconds = 0;
              if (parts.length === 2) {
                seconds = (parseInt(parts[0]) || 0) * 60 + (parseInt(parts[1]) || 0);
              } else {
                seconds = parseFloat(val) || 0;
              }
              const max = projectStore.project.audio.duration || 0;
              seconds = Math.max(0, Math.min(max, seconds));
              projectStore.currentTime = seconds;
              if (projectStore.audioBuffer) {
                audioEngine.seek(seconds, projectStore.audioBuffer);
              }
            }}
            class="w-12 bg-neutral-800 border border-neutral-700 rounded px-1 py-0.5 text-cyan-300 outline-none focus:border-cyan-500"
            title="Ketik waktu (mm:ss) lalu Enter untuk lompat"
          />
        </div>
        <button 
          onclick={handleDeleteAllTracks}
          class={`flex items-center gap-1 text-[10px] sm:text-[11px] px-1.5 py-0.5 rounded transition-all cursor-pointer ${
            isConfirmingDelete 
              ? 'bg-rose-600 text-white animate-pulse' 
              : 'text-neutral-500 hover:text-rose-400'
          }`}
          title="Hapus Semua Lagu"
        >
          <Trash2 class="w-3.5 h-3.5" />
          {#if isConfirmingDelete}
            <span>Yakin Hapus?</span>
          {/if}
        </button>
      {/if}
    </div>
  </div>

  <!-- Tracks & Waveform Area -->
  <div class="flex-1 p-2 sm:p-2.5 flex flex-col gap-1.5 overflow-hidden relative">

    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div 
      bind:this={timelineContainer}
      class="h-10 w-full bg-neutral-950/80 rounded-lg border border-neutral-800 relative cursor-pointer overflow-hidden group"
      onclick={handleTimelineClick}
      onpointerdown={onTimelinePointerDown}
      onpointermove={onTimelinePointerMove}
      onpointerup={onTimelinePointerUp}
      onpointercancel={onTimelinePointerUp}
    >
      {#if projectStore.isProcessingAudio}
        <div class="absolute inset-0 flex items-center justify-center gap-2 bg-neutral-950/90 text-cyan-400 text-xs">
          <Loader2 class="w-3.5 h-3.5 animate-spin" />
          <span class="text-[11px]">Combining Audio & Analyzing... {Math.round(projectStore.analysisProgress * 100)}%</span>
        </div>
      {:else if projectStore.beats.length > 0}
        <!-- Real Beat Markers on Timeline -->
        <div class="absolute inset-0 pointer-events-none">
          {#each projectStore.beats as beat}
            <div 
              class="absolute top-0 bottom-0 w-[1px] bg-fuchsia-500/40"
              style={`left: ${(beat / projectStore.project.audio.duration) * 100}%;`}
            ></div>
          {/each}
        </div>

        <!-- Waveform ticks -->
        <div class="absolute inset-0 flex items-center justify-around px-2 opacity-50 group-hover:opacity-75 transition-opacity pointer-events-none">
          {#each Array(100) as _, i}
            {@const frameIdx = Math.floor((i / 100) * projectStore.frequencyFrames.length)}
            {@const freqVal = projectStore.frequencyFrames[frameIdx] ? projectStore.frequencyFrames[frameIdx][0] : 10}
            <div 
              class="w-1 bg-cyan-400 rounded-full transition-all" 
              style={`height: ${Math.max(3, (freqVal / 255) * 26)}px;`}
            ></div>
          {/each}
        </div>
      {:else}
        <div class="absolute inset-0 flex items-center justify-center text-neutral-500 text-[11px] px-2 text-center">
          Drop audio files atau klik "Add MP3 / WAV" untuk memuat waveform
        </div>
      {/if}

      <!-- Partial Export Shading & Active Render Zone Indicator -->
      {#if projectStore.project.exportSettings.exportRange?.enabled && projectStore.project.audio.duration > 0}
        {@const dur = projectStore.project.audio.duration}
        {@const startSec = Math.max(0, projectStore.project.exportSettings.exportRange.startTime)}
        {@const endSec = Math.min(dur, projectStore.project.exportSettings.exportRange.endTime)}
        {@const startPct = Math.min(100, Math.max(0, (startSec / dur) * 100))}
        {@const endPct = Math.min(100, Math.max(0, (endSec / dur) * 100))}
        <!-- Left dimmed area -->
        {#if startPct > 0}
          <div 
            class="absolute top-0 bottom-0 left-0 bg-neutral-950/70 pointer-events-none border-r border-cyan-500/60 z-10"
            style={`width: ${startPct}%;`}
          ></div>
        {/if}
        <!-- Right dimmed area -->
        {#if endPct < 100}
          <div 
            class="absolute top-0 bottom-0 right-0 bg-neutral-950/70 pointer-events-none border-l border-cyan-500/60 z-10"
            style={`left: ${endPct}%;`}
          ></div>
        {/if}
        <!-- Active render zone overlay -->
        <div 
          class="absolute top-0 bottom-0 pointer-events-none bg-cyan-500/15 border-t-2 border-b-2 border-cyan-400 z-10"
          style={`left: ${startPct}%; width: ${Math.max(0, endPct - startPct)}%;`}
        >
          <span class="absolute top-0.5 left-1 text-[8px] font-mono text-cyan-300 font-bold px-1 rounded bg-neutral-950/90 border border-cyan-500/30 pointer-events-none">
            ✂️ Render: {formatTime(startSec)} - {formatTime(endSec)} ({Math.round(endSec - startSec)}s)
          </span>
        </div>
      {/if}

      <!-- Playhead indicator -->
      {#if projectStore.project.audio.duration > 0}
        <div 
          class="absolute top-0 bottom-0 w-0.5 bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.8)] z-10 pointer-events-none"
          style={`left: ${(projectStore.currentTime / projectStore.project.audio.duration) * 100}%;`}
        >
          <div class="w-2.5 h-2.5 bg-cyan-400 rounded-sm -translate-x-[4px] -translate-y-0.5 transform rotate-45"></div>
        </div>
      {/if}
    </div>

    <!-- Image Overlays Track (CapCut-style drag) -->
    {#if projectStore.project.overlays.images && projectStore.project.overlays.images.length > 0 && projectStore.project.audio.duration > 0}
      {@const totalDur = projectStore.project.audio.duration}
      <div class="h-8 w-full bg-neutral-950/60 rounded-lg border border-neutral-800/80 relative overflow-hidden">
        <div class="absolute left-1 top-0.5 text-[9px] text-fuchsia-400 font-medium flex items-center gap-1 pointer-events-none z-10">
          <ImageIcon class="w-3 h-3" />
          Images
        </div>
        {#each projectStore.project.overlays.images as img, idx (img.id)}
          {@const { start, end } = getImageStartEnd(img, totalDur)}
          {@const leftPct = (start / totalDur) * 100}
          {@const widthPct = Math.max(0.5, ((end - start) / totalDur) * 100)}
          <div
            class="absolute top-1 bottom-1 rounded bg-fuchsia-500/80 border border-fuchsia-400/60 hover:bg-fuchsia-500 cursor-move flex items-center justify-center text-[8px] text-white font-medium truncate px-1 select-none"
            style={`left: ${leftPct}%; width: ${widthPct}%;`}
            title={`${img.name}\n${formatTime(start)} → ${formatTime(end)} (${(end - start).toFixed(1)}s)\nDrag tengah: pindah | Drag ujung: ubah durasi`}
            onpointerdown={(e) => onImagePointerDown(e, img, 'move')}
          >
            <!-- Left resize handle -->
            <div
              class="absolute left-0 top-0 bottom-0 w-1.5 cursor-ew-resize hover:bg-white/40 rounded-l"
              onpointerdown={(e) => onImagePointerDown(e, img, 'left')}
            ></div>
            <span class="pointer-events-none truncate">{img.name.replace(/\.[^/.]+$/, '')}</span>
            <!-- Right resize handle -->
            <div
              class="absolute right-0 top-0 bottom-0 w-1.5 cursor-ew-resize hover:bg-white/40 rounded-r"
              onpointerdown={(e) => onImagePointerDown(e, img, 'right')}
            ></div>
          </div>
        {/each}
      </div>
    {/if}

    <!-- Multi-track Layer Overview (Compact single line) -->
    <div class="grid grid-cols-4 gap-1.5 text-[10px]">
      <div class="px-2 py-1 rounded bg-neutral-950/80 border border-neutral-800/80 flex items-center justify-between text-neutral-400">
        <span class="truncate">🎬 Background</span>
        <span class="text-neutral-500 truncate ml-1">{projectStore.project.background.type}</span>
      </div>
      <div class="px-2 py-1 rounded bg-neutral-950/80 border border-neutral-800/80 flex items-center justify-between text-neutral-400">
        <span>📊 Spectrum</span>
        <span class={projectStore.project.overlays.spectrum.enabled ? 'text-cyan-400 font-medium' : 'text-neutral-600'}>
          {projectStore.project.overlays.spectrum.enabled ? 'Active' : 'Off'}
        </span>
      </div>
      <div class="px-2 py-1 rounded bg-neutral-950/80 border border-neutral-800/80 flex items-center justify-between text-neutral-400">
        <span>✨ Particles</span>
        <span class={projectStore.project.overlays.particle.enabled ? 'text-cyan-400 font-medium' : 'text-neutral-600'}>
          {projectStore.project.overlays.particle.enabled ? 'Active' : 'Off'}
        </span>
      </div>
      <div class="px-2 py-1 rounded bg-neutral-950/80 border border-neutral-800/80 flex items-center justify-between text-neutral-400">
        <span>🎤 Lyrics</span>
        <span class={projectStore.project.lyrics.config.enabled ? 'text-cyan-400 font-medium' : 'text-neutral-600'}>
          {projectStore.project.lyrics.config.enabled ? 'Active' : 'Off'}
        </span>
      </div>
    </div>
  </div>
</div>
