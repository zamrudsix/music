<script lang="ts">
  import { projectStore } from '../../lib/stores/project.svelte';
  import { db } from '../../lib/db/database';
  import { backgroundManager } from './background.svelte';
  import BackdropCropModal from './BackdropCropModal.svelte';
  import type { BackgroundItem, BackgroundMotionEffect, TransitionType } from '../../lib/types/project';
  import { 
    Plus, 
    Trash2, 
    Activity, 
    Crop, 
    RefreshCw, 
    Sparkles, 
    FolderOpen, 
    FolderPlus,
    Image as ImageIcon, 
    Film,
    Check,
    Loader2
  } from '@lucide/svelte';
  import { isDesktop } from '../../lib/utils/platform';

  let croppingItem = $state<BackgroundItem | null>(null);
  let isImporting = $state(false);
  let importProgress = $state<{ current: number; total: number } | null>(null);
  let isSyncing = $state(false);
  let syncSuccessCount = $state<number | null>(null);

  async function importMediaPaths(filePaths: string[]) {
    if (!filePaths || filePaths.length === 0) return;

    isImporting = true;
    importProgress = { current: 0, total: filePaths.length };

    // Auto-switch to multi-image if multiple files are selected or items already exist
    if (filePaths.length > 1 || projectStore.project.background.items.length > 0) {
      if (!projectStore.project.background.type.startsWith('multi')) {
        projectStore.project.background.type = 'multi-image';
      }
    }

    const isMulti = projectStore.project.background.type.startsWith('multi');
    if (!isMulti) {
      for (const item of projectStore.project.background.items) {
        if (item.url && item.url.startsWith('blob:')) {
          URL.revokeObjectURL(item.url);
        }
        backgroundManager.releaseAsset(item.id);
      }
      projectStore.project.background.items = [];
    }

    const newItems: BackgroundItem[] = [];

    for (let i = 0; i < filePaths.length; i++) {
      const filePath = filePaths[i];
      importProgress = { current: i + 1, total: filePaths.length };

      const filename = filePath.split(/[/\\]/).pop() || `media-${i + 1}`;
      const ext = filename.split('.').pop()?.toLowerCase() || '';
      const isVideo = ['mp4', 'mov', 'webm'].includes(ext);
      const id = `bg-${Date.now()}-${i}-${Math.random().toString(36).substring(2, 7)}`;

      const newItem: BackgroundItem = {
        id,
        name: filename,
        type: isVideo ? 'video' : 'image',
        url: '',
        filePath,
        fileModifiedAt: Date.now(),
        duration: 5.0,
      };

      newItems.push(newItem);
      if (!isMulti) break;
    }

    // Immediately load first 2 items so preview canvas is live right away
    if (newItems[0]) {
      await backgroundManager.loadAsset(newItems[0]).catch(() => {});
    }
    if (newItems[1]) {
      await backgroundManager.loadAsset(newItems[1]).catch(() => {});
    }

    // Atomic update to avoid 260 UI thrashing cycles
    if (!isMulti) {
      projectStore.project.background.items = newItems;
    } else {
      projectStore.project.background.items = [...projectStore.project.background.items, ...newItems];
    }

    await projectStore.saveToDB();
    isImporting = false;
    importProgress = null;

    // Hanya preload sedikit item di depan biar tidak berat (sisanya on-demand)
    setTimeout(() => {
      newItems.slice(0, 4).forEach((it) => {
        backgroundManager.ensureAssetLoaded(it);
      });
    }, 200);
  }

  async function handleNativePickFiles() {
    if (!isDesktop()) return;
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      const extensions = ['jpg', 'jpeg', 'png', 'webp', 'gif', 'bmp', 'mp4', 'mov', 'webm'];
      const filePaths = await invoke<string[]>('select_media_files', {
        title: 'Pilih File Background (Bisa Ratusan Gambar)',
        filterName: 'Media Files (Images & Videos)',
        extensions,
        multiple: true,
      });

      if (filePaths && filePaths.length > 0) {
        await importMediaPaths(filePaths);
      }
    } catch (err: any) {
      alert('Gagal memilih file: ' + err.message);
    }
  }

  async function handleNativePickFolder() {
    if (!isDesktop()) return;
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      const filePaths = await invoke<string[]>('select_media_folder', {
        title: 'Pilih Folder Gambar/Video (Semua Gambar Terinput Otomatis)',
      });

      if (filePaths && filePaths.length > 0) {
        await importMediaPaths(filePaths);
      }
    } catch (err: any) {
      alert('Gagal memilih folder: ' + err.message);
    }
  }

  async function handleBackgroundUpload(e: Event) {
    const target = e.target as HTMLInputElement;
    if (!target.files || target.files.length === 0) return;

    isImporting = true;
    const totalFiles = target.files.length;
    importProgress = { current: 0, total: totalFiles };

    const isMulti = projectStore.project.background.type.startsWith('multi');
    if (!isMulti) {
      for (const item of projectStore.project.background.items) {
        if (item.url && item.url.startsWith('blob:')) {
          URL.revokeObjectURL(item.url);
        }
        backgroundManager.releaseAsset(item.id);
      }
      projectStore.project.background.items = [];
    }

    for (let i = 0; i < target.files.length; i++) {
      const file = target.files[i];
      importProgress = { current: i + 1, total: totalFiles };

      try {
        const id = 'bg-' + Math.random().toString(36).substring(2, 9);
        const url = URL.createObjectURL(file);
        const isVideo = file.type.startsWith('video');

        // Extract native path if available in desktop wrapper
        const nativePath = (file as any).path || (file as any).webkitRelativePath || undefined;

        const newItem: BackgroundItem = {
          id,
          name: file.name,
          type: isVideo ? 'video' : 'image',
          url,
          filePath: nativePath,
          fileModifiedAt: file.lastModified || Date.now(),
          file,
          duration: 5.0,
        };

        // Preload first 2 items immediately for instant preview; rest load on-demand
        if (i < 2) {
          await backgroundManager.loadAsset(newItem).catch(() => {});
        }

        // Hanya cache ke IndexedDB kalau tidak ada native path (browser mode)
        // Desktop: cukup simpan filePath, jangan simpan full file ke C:
        if (!nativePath) {
          try {
            await db.assets.put({
              id,
              projectId: projectStore.project.id,
              name: file.name,
              type: isVideo ? 'video' : 'image',
              blob: file,
              createdAt: Date.now(),
            });
          } catch (err) {
            console.warn('Could not cache asset in IndexedDB:', err);
          }
        }

        if (!isMulti) {
          projectStore.project.background.items = [newItem];
          break;
        } else {
          projectStore.project.background.items.push(newItem);
        }
      } catch (err) {
        console.warn(`Skipping corrupted file ${file.name}:`, err);
      }
    }

    projectStore.saveToDB();
    isImporting = false;
    importProgress = null;
    target.value = '';
  }

  function removeBackgroundItem(id: string) {
    const item = projectStore.project.background.items.find((i) => i.id === id);
    if (item?.url && item.url.startsWith('blob:')) {
      URL.revokeObjectURL(item.url);
    }
    backgroundManager.releaseAsset(id);
    projectStore.project.background.items = projectStore.project.background.items.filter((item) => item.id !== id);
    db.assets.delete(id).catch(() => {});
    projectStore.saveToDB();
  }

  function clearAllBackgrounds() {
    if (projectStore.project.background.items.length === 0) return;
    if (confirm(`Hapus semua ${projectStore.project.background.items.length} file background?`)) {
      for (const item of projectStore.project.background.items) {
        if (item.url && item.url.startsWith('blob:')) {
          URL.revokeObjectURL(item.url);
        }
        backgroundManager.releaseAsset(item.id);
        db.assets.delete(item.id).catch(() => {});
      }
      projectStore.project.background.items = [];
      projectStore.saveToDB();
    }
  }

  async function handleSyncFromDisk() {
    if (isSyncing) return;
    isSyncing = true;
    syncSuccessCount = null;
    try {
      const count = await backgroundManager.syncDiskAssets(projectStore.project.background.items);
      syncSuccessCount = count;
      setTimeout(() => { syncSuccessCount = null; }, 4000);
    } finally {
      isSyncing = false;
    }
  }

  const diskLinkedCount = $derived(
    projectStore.project.background.items.filter((item) => !!item.filePath).length
  );
</script>

<div class="space-y-4">
  <div>
    <span class="block text-neutral-400 mb-1.5 font-medium">Type</span>
    <select 
      bind:value={projectStore.project.background.type}
      onchange={() => projectStore.saveToDB()}
      class="w-full bg-neutral-950 border border-neutral-800 rounded-lg p-2 text-neutral-200 focus:border-cyan-500 outline-none cursor-pointer"
    >
      <option value="single-image">Single Image</option>
      <option value="multi-image">Multi Image (Slideshow)</option>
      <option value="single-video">Single Video</option>
      <option value="multi-video">Multi Video (Sequence)</option>
    </select>
  </div>

  <!-- Asset Uploader Header & Controls -->
  <div class="space-y-2">
    <div class="flex items-center justify-between">
      <span class="text-neutral-400 font-medium flex items-center gap-1.5">
        Background Assets 
        <span class="px-1.5 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400 font-mono text-[10px] font-bold">
          {projectStore.project.background.items.length}
        </span>
      </span>

      <div class="flex items-center gap-1.5">
        {#if diskLinkedCount > 0 && isDesktop()}
          <button 
            type="button"
            onclick={handleSyncFromDisk}
            disabled={isSyncing}
            class="px-2 py-1 rounded bg-neutral-900 border border-neutral-800 hover:border-cyan-500/40 text-neutral-300 hover:text-cyan-300 text-[11px] font-medium flex items-center gap-1 transition-colors cursor-pointer"
            title="Muat ulang gambar jika file di hard disk diganti/diubah"
          >
            <RefreshCw class={`w-3 h-3 ${isSyncing ? 'animate-spin text-cyan-400' : ''}`} />
            Sync Disk
          </button>
        {/if}

        {#if projectStore.project.background.items.length > 1}
          <button 
            type="button"
            onclick={() => projectStore.distributeBackgroundEvenly()}
            class="px-2 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-medium flex items-center gap-1 transition-colors cursor-pointer"
            title="Bagi semua gambar merata sepanjang durasi lagu (tidak ada sisa)"
          >
            Bagi Merata
          </button>
        {/if}
        {#if projectStore.project.background.items.length > 5}
          <button 
            type="button"
            onclick={clearAllBackgrounds}
            class="px-1.5 py-1 rounded text-neutral-500 hover:text-rose-400 hover:bg-neutral-900 text-[11px] transition-colors cursor-pointer"
            title="Hapus Semua File"
          >
            Clear All
          </button>
        {/if}

        {#if isDesktop()}
          <button
            type="button"
            onclick={handleNativePickFiles}
            disabled={isImporting}
            class="px-2 py-1 rounded-md bg-cyan-500 hover:bg-cyan-400 text-neutral-950 text-[11px] font-semibold flex items-center gap-1 transition-colors cursor-pointer shadow-sm shadow-cyan-500/20"
            title="Pilih satu atau banyak file sekaligus"
          >
            <FolderOpen class="w-3 h-3" />
            Pilih File
          </button>
          <button
            type="button"
            onclick={handleNativePickFolder}
            disabled={isImporting}
            class="px-2 py-1 rounded-md bg-amber-500 hover:bg-amber-400 text-neutral-950 text-[11px] font-semibold flex items-center gap-1 transition-colors cursor-pointer shadow-sm shadow-amber-500/20"
            title="Pilih satu folder (semua gambar/video di dalamnya langsung terinput otomatis)"
          >
            <FolderPlus class="w-3 h-3" />
            Pilih Folder
          </button>
        {:else}
          <label class="px-2.5 py-1 rounded-md bg-cyan-500 hover:bg-cyan-400 text-neutral-950 text-[11px] font-semibold flex items-center gap-1 cursor-pointer transition-colors shadow-sm shadow-cyan-500/20">
            <Plus class="w-3 h-3" />
            Add Media
            <input 
              type="file" 
              accept="image/*,video/*" 
              multiple={projectStore.project.background.type.startsWith('multi')}
              class="hidden" 
              onchange={handleBackgroundUpload} 
            />
          </label>
        {/if}
      </div>
    </div>

    <!-- Disk Sync Notification Badge -->
    {#if syncSuccessCount !== null}
      <div class="p-2 rounded-lg bg-emerald-950/40 border border-emerald-800/50 text-emerald-300 text-[11px] flex items-center gap-1.5 animate-in fade-in">
        <Check class="w-3.5 h-3.5 text-emerald-400 shrink-0" />
        <span>Berhasil sinkronisasi file dari disk ({syncSuccessCount} file diperbarui).</span>
      </div>
    {/if}

    <!-- Import Progress Indicator (Batch Upload) -->
    {#if isImporting && importProgress}
      <div class="p-2.5 rounded-lg bg-cyan-950/30 border border-cyan-800/40 text-cyan-300 text-xs space-y-1.5 animate-in fade-in">
        <div class="flex items-center justify-between font-medium">
          <span class="flex items-center gap-1.5">
            <Loader2 class="w-3.5 h-3.5 animate-spin text-cyan-400" />
            Mengimpor {importProgress.current} dari {importProgress.total} file...
          </span>
          <span class="font-mono text-[11px]">{Math.round((importProgress.current / importProgress.total) * 100)}%</span>
        </div>
        <div class="w-full h-1.5 bg-neutral-900 rounded-full overflow-hidden">
          <div 
            class="h-full bg-cyan-500 transition-all duration-100" 
            style={`width: ${(importProgress.current / importProgress.total) * 100}%`}
          ></div>
        </div>
      </div>
    {/if}

    <!-- Asset List Container -->
    <div class="space-y-1.5 max-h-56 overflow-y-auto pr-0.5">
      {#each projectStore.project.background.items as item, index}
        <div class="flex items-center justify-between p-2 rounded-lg bg-neutral-950 border border-neutral-800/90 text-xs group hover:border-neutral-700 transition-colors">
          <div class="flex items-center gap-2 min-w-0">
            <span class="text-[10px] font-mono text-neutral-500 w-5 shrink-0">{index + 1}.</span>
            {#if item.type === 'video'}
              <Film class="w-3.5 h-3.5 text-purple-400 shrink-0" />
            {:else}
              <ImageIcon class="w-3.5 h-3.5 text-cyan-400 shrink-0" />
            {/if}
            <div class="min-w-0">
              <span class="truncate block font-medium text-neutral-200 max-w-[170px]" title={item.name}>
                {item.name}
              </span>
              {#if item.filePath}
                <span class="text-[9px] text-neutral-500 truncate block max-w-[170px]" title={item.filePath}>
                  📁 {item.filePath.split(/[/\\]/).pop()}
                </span>
              {/if}
            </div>
          </div>

          <div class="flex items-center gap-1 opacity-80 group-hover:opacity-100 shrink-0">
            {#if item.filePath && isDesktop()}
              <button 
                type="button"
                onclick={() => backgroundManager.reloadAssetFromDisk(item)}
                class="p-1 rounded text-neutral-500 hover:text-cyan-300 hover:bg-neutral-800 cursor-pointer"
                title="Muat ulang file ini dari disk"
              >
                <RefreshCw class="w-3 h-3" />
              </button>
            {/if}

            <button 
              type="button"
              onclick={() => { croppingItem = item; }}
              class={`p-1 rounded cursor-pointer transition-colors ${
                item.crop 
                  ? 'text-cyan-400 bg-cyan-500/10 hover:bg-cyan-500/20' 
                  : 'text-neutral-500 hover:text-neutral-200 hover:bg-neutral-800'
              }`}
              title={item.crop ? 'Edit Crop (Aktif)' : 'Crop Media'}
            >
              <Crop class="w-3.5 h-3.5" />
            </button>
            <button 
              type="button"
              onclick={() => removeBackgroundItem(item.id)}
              class="p-1 rounded text-neutral-500 hover:text-rose-400 hover:bg-neutral-800 cursor-pointer"
              title="Remove"
            >
              <Trash2 class="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      {/each}

      {#if projectStore.project.background.items.length === 0}
        <div class="p-6 rounded-lg border border-dashed border-neutral-800 text-center text-neutral-500 text-xs space-y-1">
          <div>Belum ada file background.</div>
          <div class="text-[11px] text-neutral-600">Mendukung ratusan gambar sekaligus (Slideshow) bebas hambatan memory.</div>
        </div>
      {/if}
    </div>
  </div>

  {#if croppingItem}
    <BackdropCropModal 
      item={croppingItem} 
      onClose={() => { croppingItem = null; }} 
    />
  {/if}

  <!-- Motion & Camera Effects (Item 2) -->
  <div class="p-3.5 bg-neutral-950/70 rounded-xl border border-neutral-800/80 space-y-3">
    <div class="flex items-center justify-between">
      <div class="flex items-center gap-1.5 font-medium text-neutral-200 text-xs">
        <Sparkles class="w-3.5 h-3.5 text-amber-400" />
        Efek Gerak Gambar (Dynamic Motion)
      </div>
      <span class="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-300 font-medium">Ken Burns</span>
    </div>

    <div>
      <span class="block text-neutral-400 mb-1 text-[11px]">Gaya Animasi Gerak</span>
      <select 
        bind:value={projectStore.project.background.motionEffect}
        onchange={() => projectStore.saveToDB()}
        class="w-full bg-neutral-900 border border-neutral-800 rounded-lg p-2 text-xs text-neutral-200 focus:border-cyan-500 outline-none cursor-pointer"
      >
        <option value="random">🎲 Acak Otomatis Tiap Gambar (Recommended)</option>
        <option value="ken-burns">🎬 Ken Burns Cinematic Pan & Zoom</option>
        <option value="zoom-in">🔍 Slow Zoom In (Fokus Masuk)</option>
        <option value="zoom-out">🔎 Slow Zoom Out (Mundur Perlahan)</option>
        <option value="pan-left">⬅️ Geser ke Kiri (Pan Left)</option>
        <option value="pan-right">➡️ Geser ke Kanan (Pan Right)</option>
        <option value="pan-up">⬆️ Geser ke Atas (Pan Up)</option>
        <option value="pan-down">⬇️ Geser ke Bawah (Pan Down)</option>
        <option value="wobble">🌊 Breathing Sway & Floating</option>
        <option value="none">🛑 Diam (Statis Tanpa Gerak)</option>
      </select>
    </div>

    {#if projectStore.project.background.motionEffect !== 'none'}
      <div class="space-y-1">
        <div class="flex justify-between text-neutral-400 text-[11px]">
          <span>Intensitas Gerakan</span>
          <span>{Math.round((projectStore.project.background.motionIntensity ?? 1.0) * 100)}%</span>
        </div>
        <input 
          type="range" 
          min="0.2" 
          max="2.0" 
          step="0.1" 
          bind:value={projectStore.project.background.motionIntensity} 
          onchange={() => projectStore.saveToDB()} 
          class="w-full accent-amber-500 cursor-pointer" 
        />
      </div>
    {/if}
  </div>

  <!-- Transition Effects (Item 2) -->
  {#if projectStore.project.background.type.startsWith('multi')}
    <div class="p-3.5 bg-neutral-950/70 rounded-xl border border-neutral-800/80 space-y-3">
      <div>
        <span class="block text-neutral-400 mb-1.5 font-medium text-xs">Animasi Transisi Antar Gambar</span>
        <select 
          bind:value={projectStore.project.background.transition}
          onchange={() => projectStore.saveToDB()}
          class="w-full bg-neutral-900 border border-neutral-800 rounded-lg p-2 text-xs text-neutral-200 focus:border-cyan-500 outline-none cursor-pointer"
        >
          <option value="crossfade">✨ Smooth Crossfade</option>
          <option value="zoom">🔍 Zoom Transition</option>
          <option value="slide-left">⬅️ Slide ke Kiri</option>
          <option value="slide-right">➡️ Slide ke Kanan</option>
          <option value="fade">🌑 Dip to Black (Fade)</option>
          <option value="cut">⚡ Instant Cut</option>
        </select>
      </div>

      {#if projectStore.project.background.transition !== 'cut'}
        <div class="space-y-1">
          <div class="flex justify-between text-neutral-400 text-[11px]">
            <span>Durasi Transisi</span>
            <span>{(projectStore.project.background.transitionDuration || 1.0).toFixed(1)}s</span>
          </div>
          <input 
            type="range" 
            min="0.2" 
            max="2.5" 
            step="0.1" 
            bind:value={projectStore.project.background.transitionDuration} 
            onchange={() => projectStore.saveToDB()} 
            class="w-full accent-cyan-500 cursor-pointer" 
          />
        </div>
      {/if}

      <!-- Durasi Per Gambar (Slideshow speed) -->
      {#if projectStore.project.background.items.length > 0}
        <div class="space-y-1 pt-1 border-t border-neutral-800/60">
          <div class="flex justify-between text-neutral-400 text-[11px]">
            <span>Durasi Tampil Tiap Slide</span>
            <span>{(projectStore.project.background.items[0]?.duration || 5.0).toFixed(1)}s</span>
          </div>
          <input 
            type="range" 
            min="1.0" 
            max="30.0" 
            step="0.5" 
            value={projectStore.project.background.items[0]?.duration || 5.0} 
            oninput={(e) => {
              const dur = parseFloat((e.target as HTMLInputElement).value);
              projectStore.project.background.items.forEach((item) => { item.duration = dur; });
              projectStore.saveToDB();
            }} 
            class="w-full accent-cyan-500 cursor-pointer" 
          />
        </div>
      {/if}
    </div>
  {/if}

  <div>
    <span class="block text-neutral-400 mb-1.5 font-medium">Scale Mode</span>
    <div class="grid grid-cols-3 gap-1 bg-neutral-950 p-1 rounded-lg border border-neutral-800">
      {#each ['cover', 'contain', 'stretch'] as mode}
        <button 
          class={`py-1 rounded capitalize font-medium cursor-pointer ${projectStore.project.background.scaleMode === mode ? 'bg-neutral-800 text-cyan-400' : 'text-neutral-400 hover:text-neutral-200'}`}
          onclick={() => { projectStore.project.background.scaleMode = mode as any; projectStore.saveToDB(); }}
        >
          {mode}
        </button>
      {/each}
    </div>
  </div>

  <!-- Background Brightness Adjustment -->
  <div class="space-y-1.5">
    <div class="flex justify-between text-neutral-400 text-[11px]">
      <span>Background Brightness</span>
      <span>{Math.round((projectStore.project.background.brightness ?? 1.0) * 100)}%</span>
    </div>
    <input 
      type="range" 
      min="0.1" 
      max="2.0" 
      step="0.05" 
      bind:value={projectStore.project.background.brightness} 
      onchange={() => projectStore.saveToDB()} 
      class="w-full accent-cyan-500 cursor-pointer" 
    />
  </div>

  <!-- Follow Beat Toggle & Sensitivity -->
  <div class="p-3 bg-neutral-950/60 rounded-lg border border-neutral-800/80 space-y-2">
    <div class="flex items-center justify-between">
      <div>
        <div class="font-medium text-neutral-200 flex items-center gap-1.5">
          <Activity class="w-3.5 h-3.5 text-fuchsia-400" />
          Follow Beat
        </div>
        <div class="text-[11px] text-neutral-500">Auto pulse/scale on audio beat</div>
      </div>
      <input 
        type="checkbox" 
        bind:checked={projectStore.project.background.followBeat}
        onchange={() => projectStore.saveToDB()}
        class="accent-cyan-500 w-4 h-4 cursor-pointer"
      />
    </div>

    {#if projectStore.project.background.followBeat}
      <div>
        <div class="flex justify-between text-neutral-400 text-[11px] mb-1">
          <span>Beat Pulse Sensitivity</span>
          <span>{(projectStore.project.background.beatSensitivity ?? 1.0).toFixed(1)}x</span>
        </div>
        <input 
          type="range" 
          min="0.2" 
          max="3.0" 
          step="0.1" 
          bind:value={projectStore.project.background.beatSensitivity}
          onchange={() => projectStore.saveToDB()}
          class="w-full accent-fuchsia-500 cursor-pointer"
        />
      </div>
    {/if}
  </div>
</div>
