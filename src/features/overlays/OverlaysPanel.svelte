<script lang="ts">
  import { projectStore } from '../../lib/stores/project.svelte';
  import { db } from '../../lib/db/database';
  import { imageOverlayManager } from './imageOverlay.svelte';
  import { videoOverlayManager } from './videoOverlay.svelte';
  import type { ImageOverlayItem, VideoOverlayItem } from '../../lib/types/project';
  import { Video, UploadCloud, Plus, Trash2, Maximize } from '@lucide/svelte';

  async function handleImageOverlayUpload(e: Event) {
    const target = e.target as HTMLInputElement;
    if (!target.files || target.files.length === 0) return;

    for (let i = 0; i < target.files.length; i++) {
      const file = target.files[i];
      const id = 'overlay-' + Math.random().toString(36).substring(2, 9);
      const url = URL.createObjectURL(file);

      const newItem: ImageOverlayItem = {
        id,
        name: file.name,
        url,
        file,
        x: 0.5,
        y: 0.5,
        scale: 0.5,
        opacity: 1.0,
        blendMode: 'source-over',
        rotation: 0,
        animation: 'none',
        followBeat: false,
        beatSensitivity: 1.0,
      };

      await imageOverlayManager.preloadImage(newItem);

      try {
        await db.assets.put({
          id,
          projectId: projectStore.project.id,
          name: file.name,
          type: 'image',
          blob: file,
          createdAt: Date.now(),
        });
      } catch (err) {
        console.warn('Could not cache overlay in IndexedDB:', err);
      }

      projectStore.project.overlays.images.push(newItem);
    }
    projectStore.saveToDB();
  }

  function removeImageOverlay(id: string) {
    const item = projectStore.project.overlays.images.find((img) => img.id === id);
    if (item?.url && item.url.startsWith('blob:')) {
      URL.revokeObjectURL(item.url);
    }
    imageOverlayManager.releaseAsset(id);
    projectStore.project.overlays.images = projectStore.project.overlays.images.filter((img) => img.id !== id);
    db.assets.delete(id).catch(() => {});
    projectStore.saveToDB();
  }

  async function handleVideoOverlayUpload(e: Event) {
    const target = e.target as HTMLInputElement;
    if (!target.files || target.files.length === 0) return;

    for (let i = 0; i < target.files.length; i++) {
      const file = target.files[i];
      const id = 'vid-overlay-' + Math.random().toString(36).substring(2, 9);
      const url = URL.createObjectURL(file);

      const newItem: VideoOverlayItem = {
        id,
        name: file.name,
        url,
        file,
        x: 0.5,
        y: 0.5,
        scale: 0.6,
        opacity: 1.0,
        blendMode: 'screen',
        chromaKey: {
          enabled: false,
          color: '#00ff00',
          similarity: 0.4,
          smoothness: 0.1,
        },
        animation: 'none',
        followBeat: false,
        beatSensitivity: 1.0,
      };

      await videoOverlayManager.loadVideo(newItem);

      try {
        await db.assets.put({
          id,
          projectId: projectStore.project.id,
          name: file.name,
          type: 'video',
          blob: file,
          createdAt: Date.now(),
        });
      } catch (err) {
        console.warn('Could not cache video in IndexedDB:', err);
      }

      if (!projectStore.project.overlays.videos) {
        projectStore.project.overlays.videos = [];
      }
      projectStore.project.overlays.videos.push(newItem);
    }
    projectStore.saveToDB();
  }

  function removeVideoOverlay(id: string) {
    const item = projectStore.project.overlays.videos?.find((v) => v.id === id);
    if (item?.url && item.url.startsWith('blob:')) {
      URL.revokeObjectURL(item.url);
    }
    videoOverlayManager.releaseAsset(id);
    projectStore.project.overlays.videos = projectStore.project.overlays.videos.filter((v) => v.id !== id);
    db.assets.delete(id).catch(() => {});
    projectStore.saveToDB();
  }
</script>

<div class="space-y-6">
  <!-- VIDEO OVERLAYS -->
  <div class="space-y-3">
    <div class="flex items-center justify-between">
      <span class="text-neutral-300 font-semibold flex items-center gap-1.5">
        <Video class="w-3.5 h-3.5 text-cyan-400" />
        Video Overlays ({projectStore.project.overlays.videos?.length || 0})
      </span>
      <label class="px-2 py-1 rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 text-[11px] font-medium flex items-center gap-1 cursor-pointer hover:bg-cyan-500/20 transition-colors">
        <Plus class="w-3 h-3" />
        Add Video
        <input 
          type="file" 
          accept="video/*" 
          multiple 
          class="hidden" 
          onchange={handleVideoOverlayUpload} 
        />
      </label>
    </div>

    <div class="space-y-3 max-h-72 overflow-y-auto">
      {#each projectStore.project.overlays.videos || [] as vid}
        <div class="p-3 bg-neutral-950 rounded-xl border border-neutral-800 space-y-2.5">
          <div class="flex items-center justify-between">
            <span class="truncate font-medium text-cyan-300 text-xs">{vid.name}</span>
            <button onclick={() => removeVideoOverlay(vid.id)} class="text-neutral-500 hover:text-rose-400 p-1 cursor-pointer">
              <Trash2 class="w-3.5 h-3.5" />
            </button>
          </div>

          <div>
            <span class="text-neutral-500 block mb-1 text-[10px]">Blend Mode</span>
            <select 
              bind:value={vid.blendMode}
              onchange={() => projectStore.saveToDB()}
              class="w-full bg-neutral-900 border border-neutral-800 rounded p-1.5 text-neutral-200 text-[11px] outline-none"
            >
              <option value="source-over">Normal</option>
              <option value="screen">Screen (Hide Black)</option>
              <option value="lighten">Lighten</option>
              <option value="multiply">Multiply (Hide White)</option>
              <option value="overlay">Overlay</option>
              <option value="color-dodge">Color Dodge</option>
            </select>
            {#if !vid.blendMode || vid.blendMode === 'source-over'}
              <div class="mt-1.5 p-2 rounded bg-amber-500/10 border border-amber-500/30 text-[10px] space-y-1">
                <div class="text-amber-300 font-semibold flex items-center gap-1">
                  💡 Tips Backdrop Tertutup:
                </div>
                <div class="text-neutral-300 leading-relaxed">
                  Jika video berlatar hitam (hujan, partikel, bids, dll), gunakan <b class="text-cyan-300">Screen (Hide Black)</b> agar backdrop di belakang tidak tertutup hitam.
                </div>
                <button 
                  type="button" 
                  onclick={() => { vid.blendMode = 'screen'; projectStore.saveToDB(); }}
                  class="mt-0.5 px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300 font-semibold border border-cyan-500/40 hover:bg-cyan-500/30 cursor-pointer"
                >
                  Ubah ke Screen Sekarang
                </button>
              </div>
            {/if}
          </div>

          <!-- Chroma Key -->
          <div class="p-2 rounded bg-neutral-900/60 border border-neutral-800 space-y-2">
            <div class="flex items-center justify-between">
              <span class="text-neutral-300 font-medium text-[11px]">Chroma Key (Green Screen)</span>
              <input type="checkbox" bind:checked={vid.chromaKey.enabled} onchange={() => projectStore.saveToDB()} class="accent-emerald-500 w-3.5 h-3.5 cursor-pointer" />
            </div>

            {#if vid.chromaKey.enabled}
              <div class="grid grid-cols-2 gap-2">
                <div>
                  <span class="text-neutral-500 block mb-1 text-[10px]">Key Color</span>
                  <div class="flex items-center gap-1.5 bg-neutral-950 p-1 rounded border border-neutral-800">
                    <input type="color" bind:value={vid.chromaKey.color} onchange={() => projectStore.saveToDB()} class="w-5 h-5 bg-transparent border-0 cursor-pointer" />
                    <span class="font-mono text-[10px]">{vid.chromaKey.color}</span>
                  </div>
                </div>
                <div>
                  <span class="text-neutral-500 block mb-1 text-[10px]">Tolerance: {Math.round(vid.chromaKey.similarity * 100)}%</span>
                  <input type="range" min="0.05" max="0.8" step="0.02" bind:value={vid.chromaKey.similarity} onchange={() => projectStore.saveToDB()} class="w-full accent-emerald-500 cursor-pointer" />
                </div>
              </div>
            {/if}
          </div>

          <!-- Full Screen Mode -->
          <div class="p-2 rounded bg-neutral-900/60 border border-neutral-800 space-y-2">
            <label class="flex items-center justify-between cursor-pointer">
              <span class="text-neutral-300 font-medium text-[11px] flex items-center gap-1.5">
                <Maximize class="w-3.5 h-3.5 text-cyan-400" />
                Layar Penuh (Full Screen)
              </span>
              <input 
                type="checkbox" 
                bind:checked={vid.isFullScreen} 
                onchange={() => {
                  if (vid.isFullScreen && !vid.fitMode) vid.fitMode = 'cover';
                  projectStore.saveToDB();
                }} 
                class="accent-cyan-500 w-4 h-4 cursor-pointer" 
              />
            </label>

            {#if vid.isFullScreen}
              <div>
                <span class="text-neutral-500 block mb-1 text-[10px]">Fit Mode (Gaya Layar Penuh)</span>
                <select 
                  bind:value={vid.fitMode}
                  onchange={() => projectStore.saveToDB()}
                  class="w-full bg-neutral-950 border border-neutral-800 rounded p-1 text-neutral-200 text-[11px] outline-none"
                >
                  <option value="cover">Cover (Penuh Tanpa Garis Hitam)</option>
                  <option value="fill">Fill (Regang Pas 100% Layar)</option>
                  <option value="fit">Fit (Seluruh Video Terlihat Proporsional)</option>
                </select>
              </div>
            {/if}
          </div>

          {#if !vid.isFullScreen}
            <div class="grid grid-cols-2 gap-2 text-[11px]">
              <div>
                <span class="text-neutral-500 block mb-1">X: {Math.round(vid.x * 100)}%</span>
                <input type="range" min="0.0" max="1.0" step="0.01" bind:value={vid.x} onchange={() => projectStore.saveToDB()} class="w-full accent-cyan-500 cursor-pointer" />
              </div>
              <div>
                <span class="text-neutral-500 block mb-1">Y: {Math.round(vid.y * 100)}%</span>
                <input type="range" min="0.0" max="1.0" step="0.01" bind:value={vid.y} onchange={() => projectStore.saveToDB()} class="w-full accent-cyan-500 cursor-pointer" />
              </div>
            </div>

            <!-- Scale & Animation Mode -->
            <div class="grid grid-cols-2 gap-2 text-[11px]">
              <div>
                <span class="text-neutral-500 block mb-1">Scale: {vid.scale.toFixed(2)}x</span>
                <input type="range" min="0.1" max="5.0" step="0.05" bind:value={vid.scale} onchange={() => projectStore.saveToDB()} class="w-full accent-cyan-500 cursor-pointer" />
              </div>
              <div>
                <span class="text-neutral-500 block mb-1">Animation</span>
                <select 
                  bind:value={vid.animation}
                  onchange={() => projectStore.saveToDB()}
                  class="w-full bg-neutral-900 border border-neutral-800 rounded p-1.5 text-neutral-200 outline-none cursor-pointer"
                >
                  <option value="none">Static (None)</option>
                  <option value="pulse-beat">Pulse on Beat</option>
                  <option value="floating">Gentle Floating</option>
                  <option value="shimmer">Shimmer Fade</option>
                  <option value="glow-pulse">Glow Pulse</option>
                </select>
              </div>
            </div>
          {:else}
            <div class="text-[11px]">
              <span class="text-neutral-500 block mb-1">Animation</span>
              <select 
                bind:value={vid.animation}
                onchange={() => projectStore.saveToDB()}
                class="w-full bg-neutral-900 border border-neutral-800 rounded p-1.5 text-neutral-200 outline-none cursor-pointer"
              >
                <option value="none">Static (None)</option>
                <option value="pulse-beat">Pulse on Beat</option>
                <option value="floating">Gentle Floating</option>
                <option value="shimmer">Shimmer Fade</option>
                <option value="glow-pulse">Glow Pulse</option>
              </select>
            </div>
          {/if}

          <div class="space-y-1 text-[11px]">
            <span class="text-neutral-500 block">Opacity: {Math.round((vid.opacity ?? 1.0) * 100)}%</span>
            <input 
              type="range" 
              min="0.0" 
              max="1.0" 
              step="0.01" 
              bind:value={vid.opacity} 
              oninput={() => {
                if (typeof vid.opacity === 'string') vid.opacity = parseFloat(vid.opacity);
              }}
              onchange={() => projectStore.saveToDB()} 
              class="w-full accent-cyan-500 cursor-pointer" 
            />
          </div>

          <!-- Start & End Time (Muncul & Menghilang) -->
          <div class="grid grid-cols-2 gap-2 text-[11px] pt-1.5 border-t border-neutral-900">
            <div>
              <span class="text-neutral-500 block mb-0.5">Muncul (detik)</span>
              <input 
                type="number" 
                min="0" 
                step="0.5" 
                placeholder="0s" 
                bind:value={vid.startTime} 
                onchange={() => projectStore.saveToDB()} 
                class="w-full bg-neutral-900 border border-neutral-800 rounded px-2 py-1 text-neutral-200 outline-none"
              />
            </div>
            <div>
              <span class="text-neutral-500 block mb-0.5">Hilang (detik)</span>
              <input 
                type="number" 
                min="0" 
                step="0.5" 
                placeholder="Semua" 
                bind:value={vid.endTime} 
                onchange={() => projectStore.saveToDB()} 
                class="w-full bg-neutral-900 border border-neutral-800 rounded px-2 py-1 text-neutral-200 outline-none"
              />
            </div>
          </div>

          <!-- Transition Animation -->
          <div class="grid grid-cols-2 gap-2 text-[11px] pt-1.5 border-t border-neutral-900">
            <div>
              <span class="text-neutral-500 block mb-0.5">Transisi</span>
              <select 
                bind:value={vid.transition} 
                onchange={() => projectStore.saveToDB()} 
                class="w-full bg-neutral-900 border border-neutral-800 rounded p-1 text-neutral-200 outline-none cursor-pointer text-[10px]"
              >
                <option value="none">None</option>
                <option value="fade">Fade</option>
                <option value="zoom">Zoom</option>
                <option value="slide-up">Slide Up</option>
                <option value="slide-down">Slide Down</option>
              </select>
            </div>
            <div>
              <span class="text-neutral-500 block mb-0.5">Durasi Transisi</span>
              <input 
                type="number" 
                min="0.1" 
                max="3.0" 
                step="0.1" 
                placeholder="0.5s" 
                bind:value={vid.transitionDuration} 
                onchange={() => projectStore.saveToDB()} 
                class="w-full bg-neutral-900 border border-neutral-800 rounded px-2 py-1 text-neutral-200 outline-none"
              />
            </div>
          </div>
        </div>
      {/each}

      {#if !projectStore.project.overlays.videos || projectStore.project.overlays.videos.length === 0}
        <div class="p-3 text-center text-neutral-500 border border-dashed border-neutral-800 rounded-xl text-[11px]">
          No video overlays added. Add Chroma Key green screen / blend videos.
        </div>
      {/if}
    </div>
  </div>

  <!-- IMAGE OVERLAYS -->
  <div class="space-y-3 pt-3 border-t border-neutral-800">
    <div class="flex items-center justify-between">
      <span class="text-neutral-300 font-semibold flex items-center gap-1.5">
        <UploadCloud class="w-3.5 h-3.5 text-cyan-400" />
        Image Overlays ({projectStore.project.overlays.images.length})
      </span>
      <label class="px-2 py-1 rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 text-[11px] font-medium flex items-center gap-1 cursor-pointer hover:bg-cyan-500/20 transition-colors">
        <Plus class="w-3 h-3" />
        Add Image
        <input 
          type="file" 
          accept="image/*" 
          multiple 
          class="hidden" 
          onchange={handleImageOverlayUpload} 
        />
      </label>
    </div>

    <div class="space-y-3 max-h-72 overflow-y-auto">
      {#each projectStore.project.overlays.images as img}
        <div class="p-3 bg-neutral-950 rounded-xl border border-neutral-800 space-y-3">
          <div class="flex items-center justify-between">
            <span class="truncate font-medium text-neutral-200 text-xs">{img.name}</span>
            <button 
              onclick={() => removeImageOverlay(img.id)}
              class="text-neutral-500 hover:text-rose-400 p-1 cursor-pointer"
            >
              <Trash2 class="w-3.5 h-3.5" />
            </button>
          </div>

          <div>
            <span class="text-neutral-500 block mb-1 text-[10px]">Blend Mode</span>
            <select 
              bind:value={img.blendMode}
              onchange={() => projectStore.saveToDB()}
              class="w-full bg-neutral-900 border border-neutral-800 rounded p-1.5 text-neutral-200 text-[11px] outline-none"
            >
              <option value="source-over">Normal</option>
              <option value="screen">Screen (Hilangkan Hitam / Scratches)</option>
              <option value="lighten">Lighten</option>
              <option value="multiply">Multiply (Hilangkan Putih)</option>
              <option value="overlay">Overlay</option>
              <option value="color-dodge">Color Dodge</option>
            </select>
            {#if !img.blendMode || img.blendMode === 'source-over'}
              <div class="mt-1.5 p-2 rounded bg-amber-500/10 border border-amber-500/30 text-[10px] space-y-1">
                <div class="text-amber-300 font-semibold flex items-center gap-1">
                  💡 Tips Backdrop Tertutup:
                </div>
                <div class="text-neutral-300 leading-relaxed">
                  Jika gambar berlatar hitam (scratches, dust, tekstur), gunakan <b class="text-cyan-300">Screen (Hide Black)</b> agar backdrop di belakang tidak tertutup hitam.
                </div>
                <button 
                  type="button" 
                  onclick={() => { img.blendMode = 'screen'; projectStore.saveToDB(); }}
                  class="mt-0.5 px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300 font-semibold border border-cyan-500/40 hover:bg-cyan-500/30 cursor-pointer"
                >
                  Ubah ke Screen Sekarang
                </button>
              </div>
            {/if}
          </div>

          <!-- Full Screen Mode -->
          <div class="p-2 rounded bg-neutral-900/60 border border-neutral-800 space-y-2">
            <label class="flex items-center justify-between cursor-pointer">
              <span class="text-neutral-300 font-medium text-[11px] flex items-center gap-1.5">
                <Maximize class="w-3.5 h-3.5 text-cyan-400" />
                Layar Penuh (Full Screen)
              </span>
              <input 
                type="checkbox" 
                bind:checked={img.isFullScreen} 
                onchange={() => {
                  if (img.isFullScreen && !img.fitMode) img.fitMode = 'cover';
                  projectStore.saveToDB();
                }} 
                class="accent-cyan-500 w-4 h-4 cursor-pointer" 
              />
            </label>

            {#if img.isFullScreen}
              <div>
                <span class="text-neutral-500 block mb-1 text-[10px]">Fit Mode (Gaya Layar Penuh)</span>
                <select 
                  bind:value={img.fitMode}
                  onchange={() => projectStore.saveToDB()}
                  class="w-full bg-neutral-950 border border-neutral-800 rounded p-1 text-neutral-200 text-[11px] outline-none"
                >
                  <option value="cover">Cover (Penuh Tanpa Garis Hitam)</option>
                  <option value="fill">Fill (Regang Pas 100% Layar)</option>
                  <option value="fit">Fit (Seluruh Gambar Terlihat Proporsional)</option>
                </select>
              </div>
            {/if}
          </div>

          {#if !img.isFullScreen}
            <div class="grid grid-cols-2 gap-2 text-[11px]">
              <div>
                <span class="text-neutral-500 block mb-1">X: {Math.round(img.x * 100)}%</span>
                <input type="range" min="0.0" max="1.0" step="0.01" bind:value={img.x} onchange={() => projectStore.saveToDB()} class="w-full accent-cyan-500 cursor-pointer" />
              </div>
              <div>
                <span class="text-neutral-500 block mb-1">Y: {Math.round(img.y * 100)}%</span>
                <input type="range" min="0.0" max="1.0" step="0.01" bind:value={img.y} onchange={() => projectStore.saveToDB()} class="w-full accent-cyan-500 cursor-pointer" />
              </div>
            </div>

            <!-- Scale & Animation Mode -->
            <div class="grid grid-cols-2 gap-2 text-[11px]">
              <div>
                <span class="text-neutral-500 block mb-1">Scale: {img.scale.toFixed(2)}x</span>
                <input type="range" min="0.1" max="5.0" step="0.05" bind:value={img.scale} onchange={() => projectStore.saveToDB()} class="w-full accent-cyan-500 cursor-pointer" />
              </div>
              <div>
                <span class="text-neutral-500 block mb-1">Animation</span>
                <select 
                  bind:value={img.animation}
                  onchange={() => projectStore.saveToDB()}
                  class="w-full bg-neutral-900 border border-neutral-800 rounded p-1.5 text-neutral-200 outline-none cursor-pointer"
                >
                  <option value="none">Static (None)</option>
                  <option value="pulse-beat">Pulse on Beat</option>
                  <option value="floating">Gentle Floating</option>
                  <option value="shimmer">Shimmer Fade</option>
                  <option value="glow-pulse">Glow Pulse</option>
                </select>
              </div>
            </div>
          {:else}
            <div class="text-[11px]">
              <span class="text-neutral-500 block mb-1">Animation</span>
              <select 
                bind:value={img.animation}
                onchange={() => projectStore.saveToDB()}
                class="w-full bg-neutral-900 border border-neutral-800 rounded p-1.5 text-neutral-200 outline-none cursor-pointer"
              >
                <option value="none">Static (None)</option>
                <option value="pulse-beat">Pulse on Beat</option>
                <option value="floating">Gentle Floating</option>
                <option value="shimmer">Shimmer Fade</option>
                <option value="glow-pulse">Glow Pulse</option>
              </select>
            </div>
          {/if}

          <div class="space-y-1 text-[11px]">
            <span class="text-neutral-500 block">Opacity: {Math.round((img.opacity ?? 1.0) * 100)}%</span>
            <input 
              type="range" 
              min="0.0" 
              max="1.0" 
              step="0.01" 
              bind:value={img.opacity} 
              oninput={() => {
                if (typeof img.opacity === 'string') img.opacity = parseFloat(img.opacity);
              }}
              onchange={() => projectStore.saveToDB()} 
              class="w-full accent-cyan-500 cursor-pointer" 
            />
          </div>

          <div class="flex items-center justify-between pt-1 border-t border-neutral-900">
            <span class="text-[11px] text-neutral-400">Pulse on Beat (Audio reactive)</span>
            <input type="checkbox" bind:checked={img.followBeat} onchange={() => projectStore.saveToDB()} class="accent-cyan-500 w-3.5 h-3.5 cursor-pointer" />
          </div>

          {#if img.followBeat}
            <div class="space-y-1 text-[11px] pt-1">
              <div class="flex justify-between text-neutral-400">
                <span>Beat Power (Sensitivity)</span>
                <span class="text-cyan-400 font-mono">{(img.beatSensitivity ?? 1.0).toFixed(1)}x</span>
              </div>
              <input 
                type="range" 
                min="0.2" 
                max="3.0" 
                step="0.1" 
                bind:value={img.beatSensitivity} 
                onchange={() => projectStore.saveToDB()} 
                class="w-full accent-cyan-500 cursor-pointer" 
              />
            </div>
          {/if}

          <!-- Start & End Time (Muncul & Menghilang) -->
          <div class="grid grid-cols-2 gap-2 text-[11px] pt-1.5 border-t border-neutral-900">
            <div>
              <span class="text-neutral-500 block mb-0.5">Muncul (detik)</span>
              <input 
                type="number" 
                min="0" 
                step="0.5" 
                placeholder="0s" 
                bind:value={img.startTime} 
                onchange={() => projectStore.saveToDB()} 
                class="w-full bg-neutral-900 border border-neutral-800 rounded px-2 py-1 text-neutral-200 outline-none"
              />
            </div>
            <div>
              <span class="text-neutral-500 block mb-0.5">Hilang (detik)</span>
              <input 
                type="number" 
                min="0" 
                step="0.5" 
                placeholder="Semua" 
                bind:value={img.endTime} 
                onchange={() => projectStore.saveToDB()} 
                class="w-full bg-neutral-900 border border-neutral-800 rounded px-2 py-1 text-neutral-200 outline-none"
              />
            </div>
          </div>

          <!-- Transition Animation -->
          <div class="grid grid-cols-2 gap-2 text-[11px] pt-1.5 border-t border-neutral-900">
            <div>
              <span class="text-neutral-500 block mb-0.5">Transisi</span>
              <select 
                bind:value={img.transition} 
                onchange={() => projectStore.saveToDB()} 
                class="w-full bg-neutral-900 border border-neutral-800 rounded p-1 text-neutral-200 outline-none cursor-pointer text-[10px]"
              >
                <option value="none">None</option>
                <option value="fade">Fade</option>
                <option value="zoom">Zoom</option>
                <option value="slide-up">Slide Up</option>
                <option value="slide-down">Slide Down</option>
              </select>
            </div>
            <div>
              <span class="text-neutral-500 block mb-0.5">Durasi Transisi</span>
              <input 
                type="number" 
                min="0.1" 
                max="3.0" 
                step="0.1" 
                placeholder="0.5s" 
                bind:value={img.transitionDuration} 
                onchange={() => projectStore.saveToDB()} 
                class="w-full bg-neutral-900 border border-neutral-800 rounded px-2 py-1 text-neutral-200 outline-none"
              />
            </div>
          </div>
        </div>
      {/each}
    </div>
  </div>
</div>
