<script lang="ts">
  import { projectStore } from '../../lib/stores/project.svelte';
  import { 
    Music, 
    Plus, 
    Trash2, 
    ChevronUp, 
    ChevronDown, 
    ListMusic, 
    X, 
    RotateCcw,
    Sparkles,
    Volume2
  } from '@lucide/svelte';

  let isOpen = $state(false);
  let fileInput = $state<HTMLInputElement | null>(null);

  export function open() {

    isOpen = true;
  }

  export function close() {
    isOpen = false;
  }

  async function handleAudioUpload(e: Event) {
    const target = e.target as HTMLInputElement;
    if (!target.files || target.files.length === 0) return;

    await projectStore.addAudioTracks(target.files);
  }

  let isConfirmingClear = $state(false);
  let clearTimer: any = null;

  async function handleClearAll() {
    if (!isConfirmingClear) {
      isConfirmingClear = true;
      if (clearTimer) clearTimeout(clearTimer);
      clearTimer = setTimeout(() => {
        isConfirmingClear = false;
      }, 4000);
    } else {
      isConfirmingClear = false;
      if (clearTimer) clearTimeout(clearTimer);
      await projectStore.clearAllAudioTracks();
    }
  }
</script>

{#if isOpen}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div 
    class="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150 select-none"
    onclick={(e) => e.target === e.currentTarget && close()}
  >
    <div class="bg-neutral-900 border border-neutral-800 rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
      <!-- Modal Header -->
      <div class="p-4 border-b border-neutral-800 flex items-center justify-between bg-neutral-950/60">
        <div class="flex items-center gap-2.5">
          <div class="w-8 h-8 rounded-lg bg-cyan-500/20 text-cyan-400 flex items-center justify-center border border-cyan-500/30">
            <ListMusic class="w-4 h-4" />
          </div>
          <div>
            <h3 class="font-bold text-sm text-neutral-100">Susunan Urutan Lagu (Playlist Manager)</h3>
            <p class="text-[11px] text-neutral-400">Atur urutan lagu, tambah MP3 baru, atau bersihkan daftar audio.</p>
          </div>
        </div>
        <button 
          onclick={close}
          class="w-7 h-7 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 flex items-center justify-center transition-colors cursor-pointer"
        >
          <X class="w-4 h-4" />
        </button>
      </div>

      <!-- Action Toolbar -->
      <div class="p-3 bg-neutral-950/80 border-b border-neutral-800/80 flex items-center justify-between">
        <div class="flex items-center gap-2">
          <button 
            onclick={() => fileInput?.click()}
            class="px-3 py-1.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-neutral-950 font-semibold text-xs flex items-center gap-1.5 shadow-md shadow-cyan-500/20 transition-all active:scale-95 cursor-pointer"
          >
            <Plus class="w-3.5 h-3.5" />
            Tambah MP3 / WAV
          </button>

          <input 
            bind:this={fileInput} 
            type="file" 
            accept="audio/*" 
            multiple 
            class="hidden" 
            onchange={handleAudioUpload} 
          />

          {#if projectStore.project.audio.tracks && projectStore.project.audio.tracks.length > 0}
            <button 
              onclick={handleClearAll}
              class={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all cursor-pointer flex items-center gap-1.5 ${
                isConfirmingClear 
                  ? 'bg-rose-600 text-white border-rose-500 shadow-md shadow-rose-600/30 animate-pulse' 
                  : 'bg-neutral-800 hover:bg-rose-950/60 text-neutral-300 hover:text-rose-400 border-neutral-700'
              }`}
            >
              <Trash2 class="w-3.5 h-3.5" />
              {isConfirmingClear ? 'Yakin Hapus Semua? (Klik Lagi)' : 'Bersihkan Semua Lagu'}
            </button>
          {/if}
        </div>

        <span class="text-xs font-mono text-cyan-400">
          Total: {projectStore.project.audio.tracks?.length || 0} Lagu • {Math.floor(projectStore.project.audio.duration / 60)}:{(Math.floor(projectStore.project.audio.duration % 60)).toString().padStart(2, '0')}
        </span>
      </div>

      <!-- Track List Items -->
      <div class="flex-1 p-4 space-y-2 overflow-y-auto min-h-0 bg-neutral-900/50">
        {#each projectStore.project.audio.tracks || [] as track, idx}
          <div class="flex items-center justify-between p-3 rounded-xl bg-neutral-950 border border-neutral-800/90 text-xs hover:border-neutral-700 transition-colors group">
            <div class="flex items-center gap-3 min-w-0">
              <span class="font-mono text-cyan-400 font-bold w-6 text-center text-sm">{idx + 1}.</span>
              <div class="min-w-0">
                <div class="font-semibold text-neutral-100 truncate text-xs">{track.name}</div>
                <div class="text-[10px] text-neutral-500 font-mono flex items-center gap-2 mt-0.5">
                  <span>Durasi: {Math.floor(track.duration / 60)}:{(Math.floor(track.duration % 60)).toString().padStart(2, '0')}</span>
                  <span>•</span>
                  <span>Ukuran: {(track.fileSize / (1024 * 1024)).toFixed(1)} MB</span>
                </div>
              </div>
            </div>

            <!-- Reorder & Delete Actions -->
            <div class="flex items-center gap-1.5 shrink-0">
              <button 
                disabled={idx === 0}
                onclick={() => projectStore.moveAudioTrackUp(idx)}
                class="p-1.5 rounded-lg bg-neutral-900 hover:bg-neutral-800 text-neutral-300 hover:text-cyan-400 border border-neutral-800 disabled:opacity-20 cursor-pointer transition-all"
                title="Pindah ke Atas"
              >
                <ChevronUp class="w-4 h-4" />
              </button>
              <button 
                disabled={idx === (projectStore.project.audio.tracks?.length || 1) - 1}
                onclick={() => projectStore.moveAudioTrackDown(idx)}
                class="p-1.5 rounded-lg bg-neutral-900 hover:bg-neutral-800 text-neutral-300 hover:text-cyan-400 border border-neutral-800 disabled:opacity-20 cursor-pointer transition-all"
                title="Pindah ke Bawah"
              >
                <ChevronDown class="w-4 h-4" />
              </button>
              <button 
                onclick={() => projectStore.removeAudioTrack(track.id)}
                class="p-1.5 rounded-lg bg-neutral-900 hover:bg-rose-950 text-neutral-400 hover:text-rose-400 border border-neutral-800 cursor-pointer transition-all ml-1"
                title="Hapus Lagu"
              >
                <Trash2 class="w-4 h-4" />
              </button>
            </div>
          </div>
        {/each}

        {#if !projectStore.project.audio.tracks || projectStore.project.audio.tracks.length === 0}
          <div class="p-10 border border-dashed border-neutral-800 rounded-2xl text-center space-y-2">
            <Music class="w-8 h-8 text-neutral-600 mx-auto" />
            <div class="text-neutral-300 font-semibold text-sm">Belum Ada Lagu yang Diimpor</div>
            <p class="text-neutral-500 text-xs max-w-sm mx-auto">Klik tombol "Tambah MP3 / WAV" di atas untuk menambahkan daftar lagu yang ingin digabung menjadi visualizer.</p>
          </div>
        {/if}
      </div>

      <!-- Modal Footer -->
      <div class="p-3 border-t border-neutral-800 bg-neutral-950 flex items-center justify-end">
        <button 
          onclick={close}
          class="px-5 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-200 font-semibold text-xs transition-colors cursor-pointer"
        >
          Selesai
        </button>
      </div>
    </div>
  </div>
{/if}
