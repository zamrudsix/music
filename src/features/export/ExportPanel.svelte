<script lang="ts">
  import { projectStore } from '../../lib/stores/project.svelte';
  import { isDesktop } from '../../lib/utils/platform';
  import { FolderOpen, RotateCcw } from '@lucide/svelte';

  async function handleSelectFolder() {
    if (!isDesktop()) return;
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      const folder = await invoke<string | null>('select_folder', { title: 'Pilih Folder Tujuan Export Video' });
      if (folder) {
        projectStore.project.exportSettings.customExportDir = folder;
        localStorage.setItem('beras_custom_export_dir', folder);
        projectStore.saveToDB();
      }
    } catch (e: any) {
      alert('Gagal memilih folder: ' + e.message);
    }
  }

  function handleResetFolder() {
    projectStore.project.exportSettings.customExportDir = undefined;
    localStorage.removeItem('beras_custom_export_dir');
    projectStore.saveToDB();
  }
</script>

<div class="space-y-4">
  <div>
    <span class="block text-neutral-400 mb-1.5 font-medium">Resolution & Aspect</span>
    <select 
      value={projectStore.project.exportSettings.resolution}
      onchange={(e) => projectStore.updateExportResolution(e.currentTarget.value as any)}
      class="w-full bg-neutral-950 border border-neutral-800 rounded-lg p-2 text-neutral-200 focus:border-cyan-500 outline-none cursor-pointer"
    >
      <option value="1280x720">16:9 HD (720p - 1280x720) 🚀 Super Cepat</option>
      <option value="1920x1080">16:9 Landscape (1080p - 1920x1080) Full HD</option>
      <option value="720x1280">9:16 Portrait (720p - 720x1280) TikTok Cepat</option>
      <option value="1080x1920">9:16 Portrait (1080p - 1080x1920) Reels/Shorts</option>
      <option value="1080x1080">1:1 Square (1080x1080) Instagram</option>
    </select>
  </div>

  <div>
    <span class="block text-neutral-400 mb-1.5 font-medium">Frame Rate</span>
    <div class="grid grid-cols-3 gap-2">
      <button 
        class={`py-2 rounded-lg border font-semibold cursor-pointer text-xs ${projectStore.project.exportSettings.fps === 24 ? 'border-cyan-500 bg-cyan-500/10 text-cyan-400' : 'border-neutral-800 bg-neutral-950 text-neutral-400'}`}
        onclick={() => { projectStore.project.exportSettings.fps = 24; projectStore.saveToDB(); }}
      >
        24 FPS 🎬
      </button>
      <button 
        class={`py-2 rounded-lg border font-semibold cursor-pointer text-xs ${projectStore.project.exportSettings.fps === 30 ? 'border-cyan-500 bg-cyan-500/10 text-cyan-400' : 'border-neutral-800 bg-neutral-950 text-neutral-400'}`}
        onclick={() => { projectStore.project.exportSettings.fps = 30; projectStore.saveToDB(); }}
      >
        30 FPS
      </button>
      <button 
        class={`py-2 rounded-lg border font-semibold cursor-pointer text-xs ${projectStore.project.exportSettings.fps === 60 ? 'border-cyan-500 bg-cyan-500/10 text-cyan-400' : 'border-neutral-800 bg-neutral-950 text-neutral-400'}`}
        onclick={() => { projectStore.project.exportSettings.fps = 60; projectStore.saveToDB(); }}
      >
        60 FPS
      </button>
    </div>
  </div>

  <div class="p-3 bg-neutral-950/60 rounded-lg border border-neutral-800 text-[11px] text-neutral-400 space-y-1">
    <div class="text-neutral-300 font-medium">Native High-Performance Render Engine</div>
    <div>Rendering chunked off-thread di Web Worker dengan GPU Hardware acceleration & zero memory leak.</div>
  </div>
</div>
