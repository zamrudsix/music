<script lang="ts">
  import { projectStore } from '../../lib/stores/project.svelte';
  import { SubtitleService } from './subtitle';
  import { Sparkles, Languages, FolderOpen, Type, Move, Plus, AlignLeft, AlignCenter, AlignRight } from '@lucide/svelte';

  let { onOpenLyrics }: { onOpenLyrics?: () => void } = $props();
  let sidebarSubtitleInput = $state<HTMLInputElement>();

  async function handleSidebarImportSubtitle(e: Event) {
    const target = e.target as HTMLInputElement;
    if (target.files && target.files[0]) {
      const file = target.files[0];
      try {
        const text = await file.text();
        const parsed = SubtitleService.parseSubtitleText(text);
        if (!parsed || parsed.length === 0) {
          alert('Tidak ada baris subtitle valid di file ini.');
          return;
        }

        projectStore.project.lyrics.segments = parsed;
        projectStore.project.lyrics.config.enabled = true;
        projectStore.saveToDB();
        alert(`Berhasil memuat ${parsed.length} baris subtitle!`);
      } catch (err: any) {
        alert('Gagal membaca file subtitle: ' + err.message);
      }
      target.value = '';
    }
  }
</script>

<div class="space-y-4">
  <div class="flex items-center justify-between">
    <span class="font-medium text-neutral-300">Enable Lyrics</span>
    <input 
      type="checkbox" 
      bind:checked={projectStore.project.lyrics.config.enabled}
      onchange={() => projectStore.saveToDB()}
      class="accent-cyan-500 w-4 h-4 cursor-pointer"
    />
  </div>

  <!-- STT Auto Lyrics & Subtitle Management -->
  <div class="p-3 bg-gradient-to-r from-cyan-950/40 to-indigo-950/40 rounded-xl border border-cyan-800/30 space-y-2.5">
    <div class="flex items-center justify-between">
      <div class="font-medium text-cyan-200 flex items-center gap-1.5">
        <Sparkles class="w-3.5 h-3.5 text-cyan-400" />
        Groq Whisper STT & Subtitle
      </div>
      <span class="text-[10px] px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-300 font-mono">
        {projectStore.project.lyrics.segments.length} Lines
      </span>
    </div>
    <p class="text-[11px] text-neutral-400">Transkripsi otomatis, edit kata, atau impor subtitle .SRT / .VTT eksternal.</p>
    
    <!-- Bahasa Audio Transkripsi -->
    <div class="space-y-1">
      <div class="flex items-center justify-between text-[11px]">
        <span class="text-neutral-300 font-medium flex items-center gap-1.5">
          <Languages class="w-3.5 h-3.5 text-cyan-400" />
          Bahasa Lagu
        </span>
        <span class="text-[10px] text-neutral-500 font-mono">Whisper AI</span>
      </div>
      <select 
        bind:value={projectStore.project.lyrics.config.language}
        onchange={() => projectStore.saveToDB()}
        class="w-full bg-neutral-900 border border-neutral-700/80 rounded-lg px-2.5 py-1.5 text-xs text-neutral-200 focus:border-cyan-500 outline-none cursor-pointer"
      >
        <option value="id">🇮🇩 Bahasa Indonesia</option>
        <option value="en">🇺🇸 English</option>
        <option value="ja">🇯🇵 Japanese (日本語)</option>
        <option value="ko">🇰🇷 Korean (한국어)</option>
        <option value="auto">🌐 Auto Detect (Otomatis)</option>
        <option value="ms">🇲🇾 Bahasa Melayu</option>
        <option value="ar">🇸🇦 Arabic (العربية)</option>
        <option value="zh">🇨🇳 Chinese (中文)</option>
        <option value="es">🇪🇸 Spanish (Español)</option>
        <option value="fr">🇫🇷 French (Français)</option>
        <option value="de">🇩🇪 German (Deutsch)</option>
        <option value="pt">🇵🇹 Portuguese (Português)</option>
        <option value="ru">🇷🇺 Russian (Русский)</option>
        <option value="th">🇹🇭 Thai (ไทย)</option>
        <option value="vi">🇻🇳 Vietnamese (Tiếng Việt)</option>
        <option value="tl">🇵🇭 Tagalog (Filipino)</option>
      </select>
    </div>

    <div class="grid grid-cols-2 gap-2 pt-1">
      <button 
        type="button"
        onclick={() => sidebarSubtitleInput?.click()}
        class="py-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 font-medium rounded-lg flex items-center justify-center gap-1.5 border border-neutral-700 shadow-sm transition-all cursor-pointer text-xs"
        title="Import file subtitle .srt atau .vtt"
      >
        <FolderOpen class="w-3.5 h-3.5 text-cyan-400" />
        Import .SRT
      </button>
      <input 
        bind:this={sidebarSubtitleInput}
        type="file" 
        accept=".srt,.vtt,text/plain"
        class="hidden" 
        onchange={handleSidebarImportSubtitle}
      />

      <button 
        onclick={() => onOpenLyrics?.()}
        class="py-2 bg-cyan-500 hover:bg-cyan-400 text-neutral-950 font-semibold rounded-lg flex items-center justify-center gap-1.5 shadow-md shadow-cyan-500/20 transition-all cursor-pointer text-xs"
      >
        <Type class="w-3.5 h-3.5" />
        Transcribe / Edit
      </button>
    </div>
  </div>

  <div>
    <div class="flex items-center justify-between mb-1.5">
      <span class="block text-neutral-400 font-medium">Typography / Font Family</span>
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
                projectStore.project.lyrics.config.fontFamily = name;
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
      bind:value={projectStore.project.lyrics.config.fontFamily}
      onchange={() => projectStore.saveToDB()}
      class="w-full bg-neutral-950 border border-neutral-800 rounded-lg p-2 text-neutral-200 focus:border-cyan-500 outline-none cursor-pointer"
    >
      <option value="Inter">Inter (Clean Sans)</option>
      <option value="Montserrat">Montserrat (Modern Bold)</option>
      <option value="Bebas Neue">Bebas Neue (Tall Impact)</option>
      <option value="Oswald">Oswald (Condensed)</option>
      <option value="Poppins">Poppins (Rounded)</option>
      <option value="Space Grotesk">Space Grotesk (Tech)</option>
      <option value="Playfair Display">Playfair Display (Serif)</option>
      <option value="Roboto Mono">Roboto Mono (Monospace)</option>
      {#if projectStore.project.customFonts}
        {#each projectStore.project.customFonts as cf}
          <option value={cf.name}>{cf.name} (Custom)</option>
        {/each}
      {/if}
    </select>
  </div>

  <div>
    <span class="block text-neutral-400 mb-1.5 font-medium">Style</span>
    <select 
      bind:value={projectStore.project.lyrics.config.style}
      onchange={() => projectStore.saveToDB()}
      class="w-full bg-neutral-950 border border-neutral-800 rounded-lg p-2 text-neutral-200 focus:border-cyan-500 outline-none cursor-pointer"
    >
      <option value="karaoke">Karaoke Highlight</option>
      <option value="fade-line">Fade In/Out per Line</option>
      <option value="typewriter">Typewriter Effect</option>
      <option value="bounce-word">Bounce on Beat</option>
      <option value="bottom-bar">Classic Bottom Bar</option>
    </select>
  </div>

  <!-- Text Alignment -->
  <div>
    <span class="block text-neutral-400 mb-1.5 font-medium">Text Alignment</span>
    <div class="grid grid-cols-3 gap-2 bg-neutral-950 p-1 rounded-lg border border-neutral-800">
      <button 
        type="button" 
        onclick={() => {
          projectStore.project.lyrics.config.alignment = 'left';
          projectStore.saveToDB();
        }}
        class="flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-md text-xs font-medium transition-all {projectStore.project.lyrics.config.alignment === 'left' ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/40' : 'text-neutral-400 hover:text-neutral-200'}"
      >
        <AlignLeft class="w-3.5 h-3.5" />
        Kiri
      </button>
      <button 
        type="button" 
        onclick={() => {
          projectStore.project.lyrics.config.alignment = 'center';
          projectStore.saveToDB();
        }}
        class="flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-md text-xs font-medium transition-all {(!projectStore.project.lyrics.config.alignment || projectStore.project.lyrics.config.alignment === 'center') ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/40' : 'text-neutral-400 hover:text-neutral-200'}"
      >
        <AlignCenter class="w-3.5 h-3.5" />
        Tengah
      </button>
      <button 
        type="button" 
        onclick={() => {
          projectStore.project.lyrics.config.alignment = 'right';
          projectStore.saveToDB();
        }}
        class="flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-md text-xs font-medium transition-all {projectStore.project.lyrics.config.alignment === 'right' ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/40' : 'text-neutral-400 hover:text-neutral-200'}"
      >
        <AlignRight class="w-3.5 h-3.5" />
        Kanan
      </button>
    </div>
  </div>

  <!-- Position & Scale -->
  <div class="p-3 bg-neutral-950 rounded-xl border border-neutral-800 space-y-3">
    <div class="font-medium text-neutral-200 flex items-center gap-1.5">
      <Move class="w-3.5 h-3.5 text-cyan-400" />
      Position & Font Size (Interactive)
    </div>

    <div>
      <div class="flex justify-between text-neutral-400 mb-1 text-[11px]">
        <span>Horizontal X</span>
        <span>{Math.round(projectStore.project.lyrics.config.x * 100)}%</span>
      </div>
      <input 
        type="range" 
        min="0.1" 
        max="0.9" 
        step="0.01" 
        bind:value={projectStore.project.lyrics.config.x}
        onchange={() => projectStore.saveToDB()}
        class="w-full accent-cyan-500 cursor-pointer"
      />
    </div>

    <div>
      <div class="flex justify-between text-neutral-400 mb-1 text-[11px]">
        <span>Vertical Y</span>
        <span>{Math.round(projectStore.project.lyrics.config.y * 100)}%</span>
      </div>
      <input 
        type="range" 
        min="0.1" 
        max="0.95" 
        step="0.01" 
        bind:value={projectStore.project.lyrics.config.y}
        onchange={() => projectStore.saveToDB()}
        class="w-full accent-cyan-500 cursor-pointer"
      />
    </div>

    <div>
      <div class="flex justify-between text-neutral-400 mb-1 text-[11px]">
        <span>Font Size</span>
        <span>{projectStore.project.lyrics.config.fontSize}px</span>
      </div>
      <input 
        type="range" 
        min="18" 
        max="96" 
        bind:value={projectStore.project.lyrics.config.fontSize}
        onchange={() => projectStore.saveToDB()}
        class="w-full accent-cyan-500 cursor-pointer"
      />
    </div>
  </div>

  <!-- Colors, Outline & Glow Controls -->
  <div class="p-3 bg-neutral-950 rounded-xl border border-neutral-800 space-y-2.5 text-[11px]">
    <div class="grid grid-cols-2 gap-2">
      <div>
        <span class="block text-neutral-400 mb-1">Base Color</span>
        <div class="flex items-center gap-2 bg-neutral-900 p-1.5 rounded-lg border border-neutral-800">
          <input type="color" bind:value={projectStore.project.lyrics.config.color} onchange={() => projectStore.saveToDB()} class="w-5 h-5 bg-transparent border-0 cursor-pointer" />
          <span class="font-mono text-[10px]">{projectStore.project.lyrics.config.color}</span>
        </div>
      </div>
      <div>
        <span class="block text-neutral-400 mb-1">Highlight Color</span>
        <div class="flex items-center gap-2 bg-neutral-900 p-1.5 rounded-lg border border-neutral-800">
          <input type="color" bind:value={projectStore.project.lyrics.config.highlightColor} onchange={() => projectStore.saveToDB()} class="w-5 h-5 bg-transparent border-0 cursor-pointer" />
          <span class="font-mono text-[10px]">{projectStore.project.lyrics.config.highlightColor}</span>
        </div>
      </div>
    </div>

    <!-- Glow Effect Toggle -->
    <div class="flex items-center justify-between pt-1.5 border-t border-neutral-900">
      <div>
        <span class="text-neutral-300 font-medium block">Efek Glow Lirik</span>
        <span class="text-[10px] text-neutral-500 block">Efek cahaya pendar / neon pada teks</span>
      </div>
      <input 
        type="checkbox" 
        bind:checked={projectStore.project.lyrics.config.glow}
        onchange={() => projectStore.saveToDB()}
        class="accent-cyan-500 w-3.5 h-3.5 cursor-pointer"
      />
    </div>

    <!-- Outline / Stroke Toggle -->
    <div class="space-y-2 pt-1.5 border-t border-neutral-900">
      <div class="flex items-center justify-between">
        <div>
          <span class="text-neutral-300 font-medium block">Text Outline / Stroke</span>
          <span class="text-[10px] text-neutral-500 block">Garis tepi luar teks lirik</span>
        </div>
        <input 
          type="checkbox" 
          bind:checked={projectStore.project.lyrics.config.stroke}
          onchange={() => projectStore.saveToDB()}
          class="accent-cyan-500 w-3.5 h-3.5 cursor-pointer"
        />
      </div>

      {#if projectStore.project.lyrics.config.stroke}
        <div class="grid grid-cols-2 gap-2 pt-1">
          <div>
            <span class="text-neutral-500 block mb-1">Warna Garis</span>
            <div class="flex items-center gap-1.5 bg-neutral-900 p-1 rounded border border-neutral-800">
              <input type="color" bind:value={projectStore.project.lyrics.config.strokeColor} onchange={() => projectStore.saveToDB()} class="w-4 h-4 bg-transparent border-0 cursor-pointer" />
              <span class="font-mono text-[9px]">{projectStore.project.lyrics.config.strokeColor || '#000000'}</span>
            </div>
          </div>
          <div>
            <span class="text-neutral-500 block mb-1">Ketebalan: {projectStore.project.lyrics.config.strokeWidth || 4}px</span>
            <input type="range" min="1" max="16" step="1" bind:value={projectStore.project.lyrics.config.strokeWidth} onchange={() => projectStore.saveToDB()} class="w-full accent-cyan-500 cursor-pointer mt-1" />
          </div>
        </div>
      {/if}
    </div>
  </div>

  <!-- Follow Beat -->
  <div class="p-3 bg-neutral-950/60 rounded-lg border border-neutral-800/80 space-y-2">
    <div class="flex items-center justify-between">
      <span class="text-neutral-300 font-medium">Follow Beat (Bounce)</span>
      <input 
        type="checkbox" 
        bind:checked={projectStore.project.lyrics.config.followBeat}
        onchange={() => projectStore.saveToDB()}
        class="accent-cyan-500 w-4 h-4 cursor-pointer"
      />
    </div>

    {#if projectStore.project.lyrics.config.followBeat}
      <div>
        <div class="flex justify-between text-neutral-400 text-[11px] mb-1">
          <span>Bounce Sensitivity</span>
          <span>{(projectStore.project.lyrics.config.beatSensitivity ?? 1.0).toFixed(1)}x</span>
        </div>
        <input 
          type="range" 
          min="0.2" 
          max="3.0" 
          step="0.1" 
          bind:value={projectStore.project.lyrics.config.beatSensitivity}
          onchange={() => projectStore.saveToDB()}
          class="w-full accent-cyan-500 cursor-pointer"
        />
      </div>
    {/if}
  </div>
</div>
