<script lang="ts">
  import { onMount } from 'svelte';
  import { projectStore } from '../../lib/stores/project.svelte';
  import { Download, Sparkles, Image, Type, Palette, Plus, Trash2, RefreshCw } from '@lucide/svelte';

  let canvasRef: HTMLCanvasElement;

  // Tracklist State
  let hookTitle = $state('BEST CHILL BEATS 2026');
  let hookSubtitle = $state('Lofi & Electronic Moods • Album Tracklist');
  let customTracks = $state<string[]>([]);
  let autoSyncTracks = $state<boolean>(true);

  let width = $state(1920);
  let height = $state(1080);

  let fontFamily = $state('Inter');
  let fontSize = $state(28);
  let titleFontSize = $state(54);
  let fontColor = $state('#ffffff');
  let accentColor = $state('#38bdf8');
  let alignment = $state<'left' | 'center' | 'right'>('center');
  let posX = $state(0.5); // 0 to 1 normalized X
  let posY = $state(0.12); // 0 to 1 normalized Y
  let lineSpacing = $state(44);
  let newTrackInput = $state('');

  // Derived active tracks: dynamically pulled from imported audio files if available
  function formatSeconds(sec: number): string {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }

  function getActiveTracks(): string[] {
    if (autoSyncTracks && projectStore.project.audio.tracks && projectStore.project.audio.tracks.length > 0) {
      return projectStore.project.audio.tracks.map((t, idx) => {
        const cleanName = t.name.replace(/\.[^/.]+$/, ""); // strip extension
        return `${(idx + 1).toString().padStart(2, '0')}. ${cleanName} (${formatSeconds(t.duration)})`;
      });
    }
    return customTracks.length > 0 ? customTracks : [
      '01. Midnight Drive (03:42)',
      '02. Neon Horizon (02:58)',
      '03. Coffee in Tokyo (04:15)',
      '04. Starlight Echoes (03:10)',
      '05. Sunset in Kyoto (03:55)',
      '06. Rain on Glass (02:45)',
    ];
  }

  function addTrack() {
    if (newTrackInput.trim()) {
      autoSyncTracks = false;
      customTracks.push(newTrackInput.trim());
      newTrackInput = '';
      renderCanvas();
    }
  }

  function removeTrack(index: number) {
    autoSyncTracks = false;
    customTracks.splice(index, 1);
    renderCanvas();
  }

  export function renderCanvas() {
    if (!canvasRef) return;
    const ctx = canvasRef.getContext('2d');
    if (!ctx) return;

    // 1. Clear with true transparent alpha channel
    ctx.clearRect(0, 0, width, height);

    ctx.save();
    ctx.textAlign = alignment;
    ctx.textBaseline = 'top';

    const startX = posX * width;
    let currentY = posY * height;

    // 2. Draw Hook Title with Selected Font
    ctx.font = `900 ${titleFontSize}px "${fontFamily}", sans-serif`;
    ctx.fillStyle = accentColor;
    ctx.shadowColor = 'rgba(0, 0, 0, 0.9)';
    ctx.shadowBlur = 16;
    ctx.shadowOffsetY = 4;
    ctx.fillText(hookTitle, startX, currentY);

    // 3. Draw Subtitle
    currentY += titleFontSize + 12;
    ctx.font = `600 ${Math.round(titleFontSize * 0.45)}px "${fontFamily}", sans-serif`;
    ctx.fillStyle = fontColor;
    ctx.shadowBlur = 10;
    ctx.fillText(hookSubtitle, startX, currentY);

    // Divider Line
    currentY += 40;
    ctx.strokeStyle = accentColor;
    ctx.lineWidth = 3;
    ctx.shadowBlur = 8;
    ctx.shadowColor = accentColor;
    ctx.beginPath();
    if (alignment === 'center') {
      ctx.moveTo(startX - 200, currentY);
      ctx.lineTo(startX + 200, currentY);
    } else if (alignment === 'left') {
      ctx.moveTo(startX, currentY);
      ctx.lineTo(startX + 400, currentY);
    } else {
      ctx.moveTo(startX - 400, currentY);
      ctx.lineTo(startX, currentY);
    }
    ctx.stroke();

    currentY += 40;

    // 4. Draw Tracklist lines
    ctx.font = `500 ${fontSize}px "${fontFamily}", monospace, sans-serif`;
    ctx.fillStyle = fontColor;
    ctx.shadowColor = 'rgba(0, 0, 0, 0.95)';
    ctx.shadowBlur = 12;

    const currentTracks = getActiveTracks();
    for (const track of currentTracks) {
      ctx.fillText(track, startX, currentY);
      currentY += lineSpacing;
    }

    ctx.restore();
  }

  function downloadPNG() {
    if (!canvasRef) return;
    renderCanvas();
    const dataURL = canvasRef.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = dataURL;
    a.download = `tracklist_transparent_${width}x${height}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  onMount(() => {
    renderCanvas();
  });

  $effect(() => {
    // Re-render when any reactive state changes
    hookTitle;
    hookSubtitle;
    projectStore.project.audio.tracks?.length;
    customTracks.length;
    autoSyncTracks;
    width;
    height;
    fontFamily;
    fontSize;
    titleFontSize;
    fontColor;
    accentColor;
    alignment;
    posX;
    posY;
    lineSpacing;
    renderCanvas();
  });
</script>



<div class="flex-1 flex overflow-hidden bg-neutral-950 text-xs">
  <!-- Settings Panel -->
  <div class="w-84 border-r border-neutral-800 bg-neutral-900/90 p-5 space-y-5 overflow-y-auto shrink-0 select-none">
    <div class="flex items-center gap-2 pb-3 border-b border-neutral-800">
      <Image class="w-4 h-4 text-cyan-400" />
      <span class="font-semibold text-neutral-200">Tracklist PNG Generator</span>
    </div>

    <!-- Titles input -->
    <div class="space-y-3">
      <div>
        <span class="block text-neutral-400 mb-1 font-medium">Hook / Main Title</span>
        <input 
          type="text" 
          bind:value={hookTitle}
          class="w-full bg-neutral-950 border border-neutral-800 rounded-lg p-2 text-neutral-100 focus:border-cyan-500 outline-none"
        />
      </div>

      <div>
        <span class="block text-neutral-400 mb-1 font-medium">Subtitle / Album Info</span>
        <input 
          type="text" 
          bind:value={hookSubtitle}
          class="w-full bg-neutral-950 border border-neutral-800 rounded-lg p-2 text-neutral-100 focus:border-cyan-500 outline-none"
        />
      </div>
    </div>

    <!-- Typography & Alignment -->
    <div class="space-y-3">

      <div>
        <div class="flex items-center justify-between mb-1">
          <span class="block text-neutral-400 font-medium">Typography / Font Style</span>
          <label class="text-[10px] text-cyan-400 hover:text-cyan-300 flex items-center gap-1 cursor-pointer" title="Upload custom font (.ttf)">
            <Plus class="w-3 h-3" />
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
                    fontFamily = name;
                    renderCanvas();
                    alert(`Font "${name}" berhasil diunggah dan dipilih!`);
                  } catch (err: any) {
                    alert('Gagal memuat font: ' + err.message);
                  }
                  target.value = '';
                }
              }} 
            />
          </label>
        </div>
        <select 
          bind:value={fontFamily}
          class="w-full bg-neutral-950 border border-neutral-800 rounded-lg p-2 text-neutral-100 focus:border-cyan-500 outline-none cursor-pointer"
        >
          <option value="Inter">Inter (Clean Modern Sans)</option>
          <option value="Montserrat">Montserrat (Geometric Heavy)</option>
          <option value="Bebas Neue">Bebas Neue (Tall Bold Impact)</option>
          <option value="Oswald">Oswald (Condensed Poster)</option>
          <option value="Poppins">Poppins (Rounded Pop)</option>
          <option value="Space Grotesk">Space Grotesk (Tech / Cyber)</option>
          <option value="Playfair Display">Playfair Display (Elegant Serif)</option>
          <option value="Roboto Mono">Roboto Mono (Retro Monospace)</option>
          {#if projectStore.project.customFonts}
            {#each projectStore.project.customFonts as cf}
              <option value={cf.name}>{cf.name} (Custom)</option>
            {/each}
          {/if}
        </select>
      </div>

      <div>
        <span class="block text-neutral-400 mb-1 font-medium">Text Alignment</span>
        <div class="grid grid-cols-3 gap-1 bg-neutral-950 p-1 rounded-lg border border-neutral-800">
          {#each ['left', 'center', 'right'] as align}
            <button 
              class={`py-1.5 rounded capitalize font-medium cursor-pointer ${alignment === align ? 'bg-neutral-800 text-cyan-400' : 'text-neutral-400 hover:text-neutral-200'}`}
              onclick={() => { 
                alignment = align as any;
                if (align === 'left') posX = 0.15;
                else if (align === 'center') posX = 0.5;
                else if (align === 'right') posX = 0.85;
                renderCanvas(); 
              }}
            >
              {align}
            </button>
          {/each}
        </div>
      </div>
    </div>

    <!-- Position Coordinates & Spacing -->
    <div class="p-3 bg-neutral-950 rounded-xl border border-neutral-800 space-y-3">
      <span class="font-semibold text-neutral-300 block">Koordinat Posisi & Jarak</span>
      <div class="grid grid-cols-2 gap-2">
        <div>
          <span class="text-neutral-400 block mb-1 text-[11px]">X Coordinate: {Math.round(posX * 100)}%</span>
          <input type="range" min="0.05" max="0.95" step="0.01" bind:value={posX} class="w-full accent-cyan-500 cursor-pointer" />
        </div>
        <div>
          <span class="text-neutral-400 block mb-1 text-[11px]">Y Coordinate: {Math.round(posY * 100)}%</span>
          <input type="range" min="0.05" max="0.9" step="0.01" bind:value={posY} class="w-full accent-cyan-500 cursor-pointer" />
        </div>
      </div>

      <div>
        <span class="text-neutral-400 block mb-1 text-[11px]">Line Spacing: {lineSpacing}px</span>
        <input type="range" min="24" max="80" step="2" bind:value={lineSpacing} class="w-full accent-cyan-500 cursor-pointer" />
      </div>
    </div>



    <!-- Resolution & Size -->
    <div class="space-y-3">
      <div>
        <span class="block text-neutral-400 mb-1 font-medium">Export Resolution</span>
        <div class="grid grid-cols-2 gap-2">
          <button 
            class={`py-2 rounded-lg border font-semibold cursor-pointer ${width === 1920 ? 'border-cyan-500 bg-cyan-500/10 text-cyan-400' : 'border-neutral-800 bg-neutral-950 text-neutral-400'}`}
            onclick={() => { width = 1920; height = 1080; }}
          >
            1920x1080 (16:9)
          </button>
          <button 
            class={`py-2 rounded-lg border font-semibold cursor-pointer ${width === 1080 && height === 1920 ? 'border-cyan-500 bg-cyan-500/10 text-cyan-400' : 'border-neutral-800 bg-neutral-950 text-neutral-400'}`}
            onclick={() => { width = 1080; height = 1920; }}
          >
            1080x1920 (9:16)
          </button>
        </div>
      </div>

      <div class="grid grid-cols-2 gap-2">
        <div>
          <span class="block text-neutral-400 mb-1">Title Size</span>
          <input type="range" min="32" max="90" bind:value={titleFontSize} class="w-full accent-cyan-500 cursor-pointer" />
        </div>
        <div>
          <span class="block text-neutral-400 mb-1">Track Size</span>
          <input type="range" min="16" max="48" bind:value={fontSize} class="w-full accent-cyan-500 cursor-pointer" />
        </div>
      </div>
    </div>

    <!-- Colors -->
    <div class="grid grid-cols-2 gap-2">
      <div>
        <span class="block text-neutral-400 mb-1">Accent Color</span>
        <div class="flex items-center gap-2 bg-neutral-950 p-1.5 rounded-lg border border-neutral-800">
          <input type="color" bind:value={accentColor} class="w-6 h-6 bg-transparent border-0 cursor-pointer" />
          <span class="font-mono text-[11px]">{accentColor}</span>
        </div>
      </div>
      <div>
        <span class="block text-neutral-400 mb-1">Text Color</span>
        <div class="flex items-center gap-2 bg-neutral-950 p-1.5 rounded-lg border border-neutral-800">
          <input type="color" bind:value={fontColor} class="w-6 h-6 bg-transparent border-0 cursor-pointer" />
          <span class="font-mono text-[11px]">{fontColor}</span>
        </div>
      </div>
    </div>

    <!-- Tracks List Editor -->
    <div class="space-y-2">
      <div class="flex items-center justify-between">
        <span class="block text-neutral-400 font-medium">Track List ({getActiveTracks().length})</span>
        {#if projectStore.project.audio.tracks && projectStore.project.audio.tracks.length > 0}
          <button 
            onclick={() => { autoSyncTracks = true; customTracks = []; renderCanvas(); }}
            class="text-[10px] text-cyan-400 hover:text-cyan-300 flex items-center gap-1 cursor-pointer"
            title="Auto-sync with timeline tracks"
          >
            <RefreshCw class="w-3 h-3" />
            {autoSyncTracks ? 'Synced to Timeline' : 'Sync Timeline'}
          </button>
        {/if}
      </div>

      <div class="flex gap-1.5">
        <input 
          type="text" 
          placeholder="Custom track name..."
          bind:value={newTrackInput}
          onkeydown={(e) => e.key === 'Enter' && addTrack()}
          class="flex-1 bg-neutral-950 border border-neutral-800 rounded-lg p-2 text-neutral-100 text-xs focus:border-cyan-500 outline-none"
        />
        <button 
          onclick={addTrack}
          class="px-3 bg-cyan-500 hover:bg-cyan-400 text-neutral-950 font-bold rounded-lg transition-colors cursor-pointer"
        >
          <Plus class="w-4 h-4" />
        </button>
      </div>

      <div class="space-y-1 max-h-48 overflow-y-auto">
        {#each getActiveTracks() as track, idx}
          <div class="flex items-center justify-between p-1.5 bg-neutral-950 rounded-lg border border-neutral-800 group">
            <span class="truncate text-neutral-300 font-mono text-[11px]">{track}</span>
            <button 
              onclick={() => removeTrack(idx)}
              class="text-neutral-500 hover:text-rose-400 p-1 cursor-pointer"
            >
              <Trash2 class="w-3 h-3" />
            </button>
          </div>
        {/each}
      </div>
    </div>


    <!-- Download Action -->
    <button 
      onclick={downloadPNG}
      class="w-full py-2.5 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-semibold rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-cyan-500/20 transition-all active:scale-95 cursor-pointer"
    >
      <Download class="w-4 h-4" />
      Download Transparent PNG
    </button>
  </div>

  <!-- Realtime Checkerboard Transparent Preview -->
  <div class="flex-1 flex flex-col items-center justify-center p-8 bg-[#121316] relative overflow-hidden">
    <div class="text-[11px] text-neutral-400 mb-3 flex items-center gap-2">
      <span class="w-2 h-2 rounded-full bg-cyan-400"></span>
      Transparent Canvas Preview (Checkerboard Pattern)
    </div>

    <!-- Checkerboard Container -->
    <div 
      class="relative shadow-2xl rounded-xl overflow-hidden border border-neutral-800 flex items-center justify-center"
      style={`
        aspect-ratio: ${width} / ${height}; 
        max-height: 85%; 
        max-width: 90%;
        background-image: linear-gradient(45deg, #1c1d22 25%, transparent 25%), 
                          linear-gradient(-45deg, #1c1d22 25%, transparent 25%), 
                          linear-gradient(45deg, transparent 75%, #1c1d22 75%), 
                          linear-gradient(-45deg, transparent 75%, #1c1d22 75%);
        background-size: 20px 20px;
        background-position: 0 0, 0 10px, 10px -10px, -10px 0px;
      `}
    >
      <canvas 
        bind:this={canvasRef}
        {width}
        {height}
        class="w-full h-full object-contain block"
      ></canvas>
    </div>
  </div>
</div>
