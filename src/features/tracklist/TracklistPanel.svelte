<script lang="ts">
  import { projectStore } from '../../lib/stores/project.svelte';
  import { Sparkles, Move } from '@lucide/svelte';

  const tl = $derived(projectStore.project.overlays.tracklist);
</script>

{#if tl}
  <div class="space-y-4">
    <div class="flex items-center justify-between">
      <div>
        <span class="font-medium text-neutral-200 block">Enable Tracklist Overlay</span>
        <span class="text-[11px] text-neutral-500">Tampilkan semua judul lagu di video</span>
      </div>
      <input 
        type="checkbox" 
        bind:checked={tl.enabled}
        onchange={() => projectStore.saveToDB()}
        class="accent-cyan-500 w-4 h-4 cursor-pointer"
      />
    </div>

    <!-- Active Songs Count Info -->
    <div class="p-2.5 bg-neutral-950 rounded-lg border border-neutral-800 flex items-center justify-between text-[11px]">
      <span class="text-neutral-400">Total Lagu di Playlist:</span>
      <span class="font-semibold text-cyan-400">{projectStore.project.audio.tracks?.length || 0} Tracks</span>
    </div>

    <!-- Header Title Settings -->
    <div class="p-3 bg-neutral-950 rounded-xl border border-neutral-800 space-y-2.5">
      <div class="flex items-center justify-between">
        <span class="font-medium text-neutral-200">Tracklist Header Title</span>
        <input 
          type="checkbox" 
          bind:checked={tl.showTitle}
          onchange={() => projectStore.saveToDB()}
          class="accent-cyan-500 w-3.5 h-3.5 cursor-pointer"
        />
      </div>

      {#if tl.showTitle}
        <input 
          type="text" 
          bind:value={tl.title}
          onchange={() => projectStore.saveToDB()}
          placeholder="TRACKLIST / PLAYLIST"
          class="w-full bg-neutral-900 border border-neutral-800 rounded px-2.5 py-1.5 text-neutral-200 outline-none focus:border-cyan-500"
        />

        <div>
          <div class="flex justify-between text-neutral-400 mb-1 text-[11px]">
            <span>Header Font Size</span>
            <span>{tl.titleFontSize || 36}px</span>
          </div>
          <input 
            type="range" 
            min="20" 
            max="72" 
            bind:value={tl.titleFontSize} 
            onchange={() => projectStore.saveToDB()} 
            class="w-full accent-cyan-500 cursor-pointer" 
          />
        </div>
      {/if}
    </div>

    <!-- Now Playing Animation Selector -->
    <div class="p-3 bg-gradient-to-r from-cyan-950/30 to-indigo-950/30 rounded-xl border border-cyan-800/30 space-y-2.5">
      <div class="flex items-center gap-1.5 font-semibold text-cyan-300">
        <Sparkles class="w-3.5 h-3.5 text-cyan-400" />
        Now Playing Animation
      </div>
      <p class="text-[11px] text-neutral-400">Animasi eksklusif hanya pada judul lagu yang sedang aktif diputar.</p>
      
      <select 
        bind:value={tl.nowPlayingAnimation}
        onchange={() => projectStore.saveToDB()}
        class="w-full bg-neutral-900 border border-neutral-800 rounded-lg p-2 text-neutral-200 focus:border-cyan-500 outline-none cursor-pointer text-xs"
      >
        <option value="glow-badge">✨ Glow & Pulsing Badge Dot</option>
        <option value="equalizer-indicator">📊 Animated Mini Equalizer Bars</option>
        <option value="bounce-pulse">💥 Bounce / Scale on Beat</option>
        <option value="sliding-accent">➡️ Dynamic Subtle Slide</option>
        <option value="karaoke-gradient">🎵 Highlight Glow Only</option>
      </select>
    </div>

    <!-- Typography & Styling -->
    <div>
      <span class="block text-neutral-400 mb-1.5 font-medium">Font Family</span>
      <select 
        bind:value={tl.fontFamily}
        onchange={() => projectStore.saveToDB()}
        class="w-full bg-neutral-950 border border-neutral-800 rounded-lg p-2 text-neutral-200 focus:border-cyan-500 outline-none cursor-pointer"
      >
        <option value="Inter">Inter (Modern Clean)</option>
        <option value="Montserrat">Montserrat (Bold Modern)</option>
        <option value="Bebas Neue">Bebas Neue (Tall Impact)</option>
        <option value="Oswald">Oswald (Condensed)</option>
        <option value="Poppins">Poppins (Rounded)</option>
        <option value="Space Grotesk">Space Grotesk (Futuristic)</option>
        <option value="Playfair Display">Playfair Display (Serif)</option>
        <option value="Roboto Mono">Roboto Mono (Monospace)</option>
      </select>
    </div>

    <div class="grid grid-cols-2 gap-2">
      <div>
        <span class="block text-neutral-400 mb-1">Alignment</span>
        <select 
          bind:value={tl.alignment}
          onchange={() => projectStore.saveToDB()}
          class="w-full bg-neutral-950 border border-neutral-800 rounded-lg p-2 text-neutral-200 focus:border-cyan-500 outline-none cursor-pointer"
        >
          <option value="left">Left</option>
          <option value="center">Center</option>
          <option value="right">Right</option>
        </select>
      </div>
      <div>
        <span class="block text-neutral-400 mb-1">Track Font Size ({tl.fontSize}px)</span>
        <input 
          type="range" 
          min="16" 
          max="64" 
          bind:value={tl.fontSize} 
          onchange={() => projectStore.saveToDB()} 
          class="w-full accent-cyan-500 cursor-pointer mt-2" 
        />
      </div>
    </div>

    <!-- Position Coordinates & Line Spacing -->
    <div class="p-3 bg-neutral-950 rounded-xl border border-neutral-800 space-y-3">
      <div class="font-medium text-neutral-200 flex items-center gap-1.5">
        <Move class="w-3.5 h-3.5 text-cyan-400" />
        Position & Spacing (Interactive)
      </div>

      <div>
        <div class="flex justify-between text-neutral-400 mb-1 text-[11px]">
          <span>Horizontal X</span>
          <span>{Math.round(tl.x * 100)}%</span>
        </div>
        <input 
          type="range" 
          min="0.02" 
          max="0.8" 
          step="0.01" 
          bind:value={tl.x}
          onchange={() => projectStore.saveToDB()}
          class="w-full accent-cyan-500 cursor-pointer"
        />
      </div>

      <div>
        <div class="flex justify-between text-neutral-400 mb-1 text-[11px]">
          <span>Vertical Y</span>
          <span>{Math.round(tl.y * 100)}%</span>
        </div>
        <input 
          type="range" 
          min="0.05" 
          max="0.8" 
          step="0.01" 
          bind:value={tl.y}
          onchange={() => projectStore.saveToDB()}
          class="w-full accent-cyan-500 cursor-pointer"
        />
      </div>

      <div>
        <div class="flex justify-between text-neutral-400 mb-1 text-[11px]">
          <span>Line Spacing / Gap</span>
          <span>{tl.lineSpacing}px</span>
        </div>
        <input 
          type="range" 
          min="24" 
          max="90" 
          step="2" 
          bind:value={tl.lineSpacing}
          onchange={() => projectStore.saveToDB()}
          class="w-full accent-cyan-500 cursor-pointer"
        />
      </div>
    </div>

    <!-- Color Settings (Inactive, Active, Header Accent) -->
    <div class="grid grid-cols-3 gap-2">
      <div>
        <span class="block text-neutral-400 mb-1 text-[10px]">Track Color</span>
        <div class="flex items-center gap-1 bg-neutral-950 p-1 rounded border border-neutral-800">
          <input type="color" bind:value={tl.color} onchange={() => projectStore.saveToDB()} class="w-5 h-5 bg-transparent border-0 cursor-pointer" />
          <span class="font-mono text-[9px] truncate">{tl.color}</span>
        </div>
      </div>
      <div>
        <span class="block text-cyan-400 mb-1 text-[10px]">Active Now Playing</span>
        <div class="flex items-center gap-1 bg-neutral-950 p-1 rounded border border-cyan-800/40">
          <input type="color" bind:value={tl.activeColor} onchange={() => projectStore.saveToDB()} class="w-5 h-5 bg-transparent border-0 cursor-pointer" />
          <span class="font-mono text-[9px] truncate">{tl.activeColor}</span>
        </div>
      </div>
      <div>
        <span class="block text-neutral-400 mb-1 text-[10px]">Header Accent</span>
        <div class="flex items-center gap-1 bg-neutral-950 p-1 rounded border border-neutral-800">
          <input type="color" bind:value={tl.accentColor} onchange={() => projectStore.saveToDB()} class="w-5 h-5 bg-transparent border-0 cursor-pointer" />
          <span class="font-mono text-[9px] truncate">{tl.accentColor}</span>
        </div>
      </div>
    </div>

    <!-- Format Options (Numbers, Durations, Beat Reaction) -->
    <div class="p-3 bg-neutral-950 rounded-xl border border-neutral-800 space-y-2 text-[11px]">
      <div class="flex items-center justify-between">
        <span class="text-neutral-300">Show Track Numbers (01, 02...)</span>
        <input type="checkbox" bind:checked={tl.showNumbers} onchange={() => projectStore.saveToDB()} class="accent-cyan-500 w-3.5 h-3.5 cursor-pointer" />
      </div>

      <div class="flex items-center justify-between">
        <span class="text-neutral-300">Show Track Duration (03:45)</span>
        <input type="checkbox" bind:checked={tl.showDuration} onchange={() => projectStore.saveToDB()} class="accent-cyan-500 w-3.5 h-3.5 cursor-pointer" />
      </div>

      <div class="flex items-center justify-between">
        <span class="text-neutral-300">Drop Shadow</span>
        <input type="checkbox" bind:checked={tl.shadow} onchange={() => projectStore.saveToDB()} class="accent-cyan-500 w-3.5 h-3.5 cursor-pointer" />
      </div>

      <div class="flex items-center justify-between">
        <span class="text-neutral-300">Text Outline / Stroke</span>
        <input type="checkbox" bind:checked={tl.stroke} onchange={() => projectStore.saveToDB()} class="accent-cyan-500 w-3.5 h-3.5 cursor-pointer" />
      </div>

      {#if tl.stroke}
        <div class="pl-2 pt-1 border-l-2 border-cyan-500/30 space-y-2">
          <div class="flex items-center justify-between">
            <span class="text-neutral-400 text-[10px]">Outline Color</span>
            <div class="flex items-center gap-1 bg-neutral-900 px-1.5 py-0.5 rounded border border-neutral-800">
              <input type="color" bind:value={tl.strokeColor} onchange={() => projectStore.saveToDB()} class="w-4 h-4 bg-transparent border-0 cursor-pointer" />
              <span class="font-mono text-[9px] text-neutral-300">{tl.strokeColor || '#000000'}</span>
            </div>
          </div>
          <div>
            <div class="flex justify-between text-neutral-400 text-[10px] mb-1">
              <span>Outline Width</span>
              <span>{tl.strokeWidth ?? 3}px</span>
            </div>
            <input 
              type="range" 
              min="1" 
              max="10" 
              step="1" 
              bind:value={tl.strokeWidth}
              onchange={() => projectStore.saveToDB()}
              class="w-full accent-cyan-500 cursor-pointer"
            />
          </div>
        </div>
      {/if}

      <div class="flex items-center justify-between">
        <span class="text-neutral-300">Follow Audio Beat</span>
        <input type="checkbox" bind:checked={tl.followBeat} onchange={() => projectStore.saveToDB()} class="accent-cyan-500 w-3.5 h-3.5 cursor-pointer" />
      </div>
    </div>
  </div>
{/if}
