<script lang="ts">
  import { projectStore } from '../../lib/stores/project.svelte';
  import { Type, Plus, Trash2 } from '@lucide/svelte';
</script>

<div class="space-y-4">
  <div class="flex items-center justify-between">
    <span class="text-neutral-300 font-semibold flex items-center gap-1.5">
      <Type class="w-3.5 h-3.5 text-cyan-400" />
      Text Overlays ({projectStore.project.overlays.texts?.length || 0})
    </span>
    <div class="flex items-center gap-2">
      <label class="px-2 py-1 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-300 border border-neutral-700 text-xs font-medium flex items-center gap-1 cursor-pointer transition-colors" title="Upload custom font (.ttf)">
        <Plus class="w-3 h-3 text-cyan-400" />
        Upload .TTF
        <input 
          type="file" 
          accept=".ttf,.otf,.woff,.woff2" 
          class="hidden" 
          onchange={async (e) => {
            const target = e.target as HTMLInputElement;
            if (target.files && target.files[0]) {
              try {
                const name = await projectStore.addCustomFont(target.files[0]);
                alert(`Font "${name}" berhasil diunggah!`);
              } catch (err: any) {
                alert('Gagal memuat font: ' + err.message);
              }
              target.value = '';
            }
          }} 
        />
      </label>
      <button 
        onclick={() => projectStore.addTextOverlay()}
        class="px-2.5 py-1 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-neutral-950 text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer"
      >
        <Plus class="w-3.5 h-3.5" />
        Add Text
      </button>
    </div>
  </div>

  <div class="space-y-3 max-h-[calc(100vh-220px)] overflow-y-auto">
    {#each projectStore.project.overlays.texts || [] as item}
      <div class="p-3 bg-neutral-950 rounded-xl border border-neutral-800 space-y-3">
        <div class="flex items-center justify-between gap-2">
          <input 
            type="text" 
            bind:value={item.text}
            onchange={() => projectStore.saveToDB()}
            placeholder="Enter text..."
            class="flex-1 bg-neutral-900 border border-neutral-800 rounded px-2 py-1 text-xs text-neutral-200 focus:border-cyan-500 outline-none"
          />
          <button 
            onclick={() => projectStore.removeTextOverlay(item.id)}
            class="text-neutral-500 hover:text-rose-400 p-1 cursor-pointer"
            title="Delete"
          >
            <Trash2 class="w-3.5 h-3.5" />
          </button>
        </div>

        <!-- Font & Animation -->
        <div class="grid grid-cols-2 gap-2 text-[11px]">
          <div>
            <span class="text-neutral-500 block mb-1">Font Family</span>
            <select 
              bind:value={item.fontFamily}
              onchange={() => projectStore.saveToDB()}
              class="w-full bg-neutral-900 border border-neutral-800 rounded p-1.5 text-neutral-200 outline-none cursor-pointer"
            >
              <option value="Inter">Inter</option>
              <option value="Montserrat">Montserrat</option>
              <option value="Bebas Neue">Bebas Neue</option>
              <option value="Oswald">Oswald</option>
              <option value="Poppins">Poppins</option>
              <option value="Space Grotesk">Space Grotesk</option>
              <option value="Playfair Display">Playfair Display</option>
              <option value="Roboto Mono">Roboto Mono</option>
              {#if projectStore.project.customFonts}
                {#each projectStore.project.customFonts as cf}
                  <option value={cf.name}>{cf.name} (Custom)</option>
                {/each}
              {/if}
            </select>
          </div>

          <div>
            <span class="text-neutral-500 block mb-1">Animation</span>
            <select 
              bind:value={item.animation}
              onchange={() => projectStore.saveToDB()}
              class="w-full bg-neutral-900 border border-neutral-800 rounded p-1.5 text-neutral-200 outline-none cursor-pointer"
            >
              <option value="none">Static (None)</option>
              <option value="marquee-left">Running / Crawling Text (TV News)</option>
              <option value="pulse-beat">Pulse on Beat</option>
              <option value="floating">Gentle Floating</option>
              <option value="shimmer">Shimmer Fade</option>
              <option value="typewriter">Typing Animation</option>
              <option value="glow-pulse">Glow Pulse</option>
            </select>
          </div>
        </div>

        {#if item.animation === 'marquee-left'}
          <!-- Crawl Speed & Spacing Controls -->
          <div class="p-2 bg-neutral-900/70 rounded border border-cyan-500/30 space-y-2 text-[11px]">
            <div class="flex items-center justify-between text-cyan-400 font-medium">
              <span>Crawling Text (Running Text)</span>
              <span class="text-[10px] text-neutral-400 font-normal">Geser ke kiri tak terbatas</span>
            </div>

            <div>
              <div class="flex justify-between text-neutral-400 mb-0.5">
                <span>Kecepatan (Speed): {item.crawlSpeed || 160} px/s</span>
              </div>
              <input 
                type="range" 
                min="40" 
                max="500" 
                step="10" 
                bind:value={item.crawlSpeed} 
                onchange={() => projectStore.saveToDB()} 
                class="w-full accent-cyan-500 cursor-pointer" 
              />
            </div>

            <div>
              <div class="flex justify-between text-neutral-400 mb-0.5">
                <span>Jarak Antar Teks (Spacing): {item.crawlSpacing || 120} px</span>
              </div>
              <input 
                type="range" 
                min="30" 
                max="400" 
                step="10" 
                bind:value={item.crawlSpacing} 
                onchange={() => projectStore.saveToDB()} 
                class="w-full accent-cyan-500 cursor-pointer" 
              />
            </div>
          </div>
        {/if}

        <!-- Alignment & Font Size -->
        <div class="grid grid-cols-2 gap-2 text-[11px]">
          <div>
            <span class="text-neutral-500 block mb-1">Alignment</span>
            <select 
              bind:value={item.alignment}
              onchange={() => projectStore.saveToDB()}
              class="w-full bg-neutral-900 border border-neutral-800 rounded p-1.5 text-neutral-200 outline-none cursor-pointer"
            >
              <option value="left">Left</option>
              <option value="center">Center</option>
              <option value="right">Right</option>
            </select>
          </div>

          <div>
            <span class="text-neutral-500 block mb-1">Size: {item.fontSize}px</span>
            <input 
              type="range" 
              min="16" 
              max="140" 
              step="2" 
              bind:value={item.fontSize} 
              onchange={() => projectStore.saveToDB()} 
              class="w-full accent-cyan-500 cursor-pointer mt-1" 
            />
          </div>
        </div>

        <!-- Coordinates X and Y -->
        <div class="p-2 bg-neutral-900/60 rounded border border-neutral-800 space-y-2 text-[11px]">
          <div class="flex justify-between text-neutral-400">
            <span>Horizontal X ({Math.round(item.x * 100)}%)</span>
          </div>
          <input 
            type="range" 
            min="0.05" 
            max="0.95" 
            step="0.01" 
            bind:value={item.x} 
            onchange={() => projectStore.saveToDB()} 
            class="w-full accent-cyan-500 cursor-pointer" 
          />

          <div class="flex justify-between text-neutral-400">
            <span>Vertical Y ({Math.round(item.y * 100)}%)</span>
          </div>
          <input 
            type="range" 
            min="0.05" 
            max="0.95" 
            step="0.01" 
            bind:value={item.y} 
            onchange={() => projectStore.saveToDB()} 
            class="w-full accent-cyan-500 cursor-pointer" 
          />
        </div>

        <!-- Color, Opacity & Rotation -->
        <div class="grid grid-cols-2 gap-2 text-[11px]">
          <div>
            <span class="text-neutral-500 block mb-1">Text Color</span>
            <div class="flex items-center gap-1.5 bg-neutral-900 p-1 rounded border border-neutral-800">
              <input type="color" bind:value={item.color} onchange={() => projectStore.saveToDB()} class="w-5 h-5 bg-transparent border-0 cursor-pointer" />
              <span class="font-mono text-[10px]">{item.color}</span>
            </div>
          </div>

          <div>
            <span class="text-neutral-500 block mb-1">Opacity: {Math.round(item.opacity * 100)}%</span>
            <input type="range" min="0.1" max="1.0" step="0.05" bind:value={item.opacity} onchange={() => projectStore.saveToDB()} class="w-full accent-cyan-500 cursor-pointer mt-1" />
          </div>
        </div>

        <!-- Outline / Stroke Option -->
        <div class="space-y-1.5 pt-1.5 border-t border-neutral-900 text-[11px]">
          <div class="flex items-center justify-between">
            <span class="text-neutral-400">Text Outline / Stroke</span>
            <input type="checkbox" bind:checked={item.stroke} onchange={() => projectStore.saveToDB()} class="accent-cyan-500 w-3.5 h-3.5 cursor-pointer" />
          </div>

          {#if item.stroke}
            <div class="grid grid-cols-2 gap-2 pt-1">
              <div>
                <span class="text-neutral-500 block mb-0.5">Warna Outline</span>
                <div class="flex items-center gap-1.5 bg-neutral-900 p-1 rounded border border-neutral-800">
                  <input type="color" bind:value={item.strokeColor} onchange={() => projectStore.saveToDB()} class="w-4 h-4 bg-transparent border-0 cursor-pointer" />
                  <span class="font-mono text-[9px]">{item.strokeColor || '#000000'}</span>
                </div>
              </div>
              <div>
                <span class="text-neutral-500 block mb-0.5">Tebal: {item.strokeWidth || 4}px</span>
                <input type="range" min="1" max="16" step="1" bind:value={item.strokeWidth} onchange={() => projectStore.saveToDB()} class="w-full accent-cyan-500 cursor-pointer mt-1" />
              </div>
            </div>
          {/if}
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
              bind:value={item.startTime} 
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
              bind:value={item.endTime} 
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
              bind:value={item.transition} 
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
              bind:value={item.transitionDuration} 
              onchange={() => projectStore.saveToDB()} 
              class="w-full bg-neutral-900 border border-neutral-800 rounded px-2 py-1 text-neutral-200 outline-none"
            />
          </div>
        </div>

        <!-- Shadow & Follow Beat -->
        <div class="space-y-1.5 pt-2 border-t border-neutral-900 text-[11px]">
          <div class="flex items-center justify-between">
            <span class="text-neutral-400">Drop Shadow / Glow</span>
            <input type="checkbox" bind:checked={item.shadow} onchange={() => projectStore.saveToDB()} class="accent-cyan-500 w-3.5 h-3.5 cursor-pointer" />
          </div>

          <div class="flex items-center justify-between">
            <span class="text-neutral-400">Follow Audio Beat</span>
            <input type="checkbox" bind:checked={item.followBeat} onchange={() => projectStore.saveToDB()} class="accent-cyan-500 w-3.5 h-3.5 cursor-pointer" />
          </div>

          {#if item.followBeat}
            <div class="space-y-1 text-[11px] pt-1">
              <div class="flex justify-between text-neutral-400">
                <span>Beat Power (Sensitivity)</span>
                <span class="text-cyan-400 font-mono">{(item.beatSensitivity ?? 1.0).toFixed(1)}x</span>
              </div>
              <input 
                type="range" 
                min="0.2" 
                max="3.0" 
                step="0.1" 
                bind:value={item.beatSensitivity} 
                onchange={() => projectStore.saveToDB()} 
                class="w-full accent-cyan-500 cursor-pointer" 
              />
            </div>
          {/if}
        </div>
      </div>
    {/each}

    {#if !projectStore.project.overlays.texts || projectStore.project.overlays.texts.length === 0}
      <div class="p-6 text-center text-neutral-500 border border-dashed border-neutral-800 rounded-xl text-xs space-y-2">
        <Type class="w-6 h-6 mx-auto opacity-50" />
        <p>Belum ada Text Overlay.</p>
        <p class="text-[11px]">Klik "Add Text" di atas untuk menambahkan judul, watermark, atau catatan custom.</p>
      </div>
    {/if}
  </div>
</div>
