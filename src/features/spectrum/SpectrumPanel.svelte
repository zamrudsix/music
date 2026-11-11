<script lang="ts">
  import { projectStore } from '../../lib/stores/project.svelte';
  import { Move, Plus, Trash2, Copy, Sliders } from '@lucide/svelte';
  import { SPECTRUM_STYLE_CATEGORIES } from './styles';
  import type { SpectrumConfig } from '../../lib/types/project';

  // Ensure project overlays spectrums is initialized
  $effect.root(() => {
    if (!projectStore.project.overlays.spectrums || projectStore.project.overlays.spectrums.length === 0) {
      projectStore.project.overlays.spectrums = [{
        ...projectStore.project.overlays.spectrum,
        id: projectStore.project.overlays.spectrum.id || 'spectrum-default',
        name: projectStore.project.overlays.spectrum.name || 'Spectrum 1',
      }];
    }
  });

  let selectedSpectrumIndex = $state(0);

  // Active spectrum item being edited
  let activeSpectrum = $derived.by(() => {
    const list = projectStore.project.overlays.spectrums;
    if (list && list.length > 0) {
      const safeIdx = Math.min(selectedSpectrumIndex, list.length - 1);
      return list[safeIdx] || list[0];
    }
    return projectStore.project.overlays.spectrum;
  });

  function handleAddSpectrum() {
    const newSpec = projectStore.addSpectrum();
    if (projectStore.project.overlays.spectrums) {
      selectedSpectrumIndex = projectStore.project.overlays.spectrums.length - 1;
    }
  }

  function handleDuplicateSpectrum(id?: string) {
    if (!id) return;
    projectStore.duplicateSpectrum(id);
    if (projectStore.project.overlays.spectrums) {
      selectedSpectrumIndex = projectStore.project.overlays.spectrums.length - 1;
    }
  }

  function handleRemoveSpectrum(id?: string) {
    if (!id) return;
    projectStore.removeSpectrum(id);
    selectedSpectrumIndex = Math.max(0, selectedSpectrumIndex - 1);
  }
</script>

<div class="space-y-4">
  <!-- Multi Spectrum List / Tabs -->
  <div class="p-3 bg-neutral-950 rounded-xl border border-neutral-800 space-y-2.5">
    <div class="flex items-center justify-between">
      <div class="flex items-center gap-1.5 font-medium text-xs text-neutral-200">
        <Sliders class="w-3.5 h-3.5 text-cyan-400" />
        Daftar Spektrum ({projectStore.project.overlays.spectrums?.length || 1})
      </div>
      <button 
        type="button" 
        onclick={handleAddSpectrum}
        class="px-2 py-1 bg-cyan-500 hover:bg-cyan-400 text-neutral-950 font-semibold rounded text-[11px] flex items-center gap-1 transition-all cursor-pointer shadow-sm shadow-cyan-500/20"
        title="Tambah Layer Spectrum Baru"
      >
        <Plus class="w-3 h-3" />
        Tambah
      </button>
    </div>

    <!-- Multi-Spectrum Item Selector -->
    <div class="flex flex-wrap gap-1.5 pt-1">
      {#if projectStore.project.overlays.spectrums}
        {#each projectStore.project.overlays.spectrums as spec, idx}
          <button 
            type="button"
            onclick={() => selectedSpectrumIndex = idx}
            class="px-2.5 py-1 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 {selectedSpectrumIndex === idx ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm' : 'bg-neutral-900 text-neutral-400 hover:text-neutral-200 border border-neutral-800'}"
          >
            <span class="w-2 h-2 rounded-full {spec.enabled ? 'bg-cyan-400' : 'bg-neutral-600'}"></span>
            {spec.name || `Spectrum ${idx + 1}`}
          </button>
        {/each}
      {/if}
    </div>

    <!-- Actions for Active Spectrum -->
    {#if activeSpectrum}
      <div class="flex items-center justify-between pt-2 border-t border-neutral-900 text-xs">
        <input 
          type="text" 
          bind:value={activeSpectrum.name} 
          onchange={() => projectStore.saveToDB()}
          placeholder="Nama Spektrum"
          class="bg-neutral-900 border border-neutral-800 rounded px-2 py-1 text-[11px] text-neutral-200 outline-none focus:border-cyan-500 w-36"
        />

        <div class="flex items-center gap-1">
          <button 
            type="button" 
            onclick={() => handleDuplicateSpectrum(activeSpectrum.id)}
            class="p-1.5 text-neutral-400 hover:text-cyan-400 hover:bg-neutral-900 rounded transition-all cursor-pointer"
            title="Duplikat Spectrum Ini"
          >
            <Copy class="w-3.5 h-3.5" />
          </button>
          {#if (projectStore.project.overlays.spectrums?.length || 1) > 1}
            <button 
              type="button" 
              onclick={() => handleRemoveSpectrum(activeSpectrum.id)}
              class="p-1.5 text-neutral-400 hover:text-red-400 hover:bg-neutral-900 rounded transition-all cursor-pointer"
              title="Hapus Spectrum Ini"
            >
              <Trash2 class="w-3.5 h-3.5" />
            </button>
          {/if}
        </div>
      </div>
    {/if}
  </div>

  {#if activeSpectrum}
    <!-- Enable Toggle for Active Spectrum -->
    <div class="flex items-center justify-between">
      <span class="font-medium text-neutral-300">Aktifkan Spektrum Ini</span>
      <input 
        type="checkbox" 
        bind:checked={activeSpectrum.enabled}
        onchange={() => {
          projectStore.syncActiveSpectrum();
          projectStore.saveToDB(300);
        }}
        class="accent-cyan-500 w-4 h-4 cursor-pointer"
      />
    </div>

    <!-- Style Dropdown (Grouped 100 Styles) -->
    <div>
      <span class="block text-neutral-400 mb-1.5 font-medium">Style Visualizer</span>
      <select 
        value={activeSpectrum.style}
        onchange={(e) => {
          const nextStyle = e.currentTarget.value as any;
          if (activeSpectrum.style !== nextStyle) {
            activeSpectrum.style = nextStyle;
            projectStore.syncActiveSpectrum();
            projectStore.saveToDB(800);
          }
        }}
        class="w-full bg-neutral-950 border border-neutral-800 rounded-lg p-2 text-neutral-200 focus:border-cyan-500 outline-none cursor-pointer text-xs"
      >
        {#each SPECTRUM_STYLE_CATEGORIES as group}
          <optgroup label={group.category} class="bg-neutral-900 text-neutral-300 font-semibold">
            {#each group.styles as s}
              <option value={s} class="bg-neutral-950 text-neutral-200 font-normal">{s}</option>
            {/each}
          </optgroup>
        {/each}
      </select>
    </div>

    <!-- Position & Scale -->
    <div class="p-3 bg-neutral-950 rounded-xl border border-neutral-800 space-y-3">
      <div class="font-medium text-neutral-200 flex items-center gap-1.5">
        <Move class="w-3.5 h-3.5 text-cyan-400" />
        Posisi & Ukuran
      </div>

      <div>
        <div class="flex justify-between text-neutral-400 mb-1 text-[11px]">
          <span>Horizontal X</span>
          <span>{Math.round(activeSpectrum.x * 100)}%</span>
        </div>
        <input 
          type="range" 
          min="0.05" 
          max="0.95" 
          step="0.01" 
          bind:value={activeSpectrum.x}
          onchange={() => {
            projectStore.syncActiveSpectrum();
            projectStore.saveToDB(400);
          }}
          class="w-full accent-cyan-500 cursor-pointer"
        />
      </div>

      <div>
        <div class="flex justify-between text-neutral-400 mb-1 text-[11px]">
          <span>Vertical Y</span>
          <span>{Math.round(activeSpectrum.y * 100)}%</span>
        </div>
        <input 
          type="range" 
          min="0.05" 
          max="0.95" 
          step="0.01" 
          bind:value={activeSpectrum.y}
          onchange={() => {
            projectStore.syncActiveSpectrum();
            projectStore.saveToDB(400);
          }}
          class="w-full accent-cyan-500 cursor-pointer"
        />
      </div>

      <div>
        <div class="flex justify-between text-neutral-400 mb-1 text-[11px]">
          <span>Scale Size</span>
          <span>{(activeSpectrum.scale ?? 1.0).toFixed(2)}x</span>
        </div>
        <input 
          type="range" 
          min="0.2" 
          max="3.0" 
          step="0.05" 
          bind:value={activeSpectrum.scale}
          onchange={() => {
            projectStore.syncActiveSpectrum();
            projectStore.saveToDB(400);
          }}
          class="w-full accent-cyan-500 cursor-pointer"
        />
      </div>
    </div>

    <!-- Bar Count & Height -->
    <div class="grid grid-cols-2 gap-2">
      <div>
        <div class="flex justify-between text-neutral-400 mb-1 text-[11px]">
          <span>Jumlah Bar</span>
          <span>{activeSpectrum.barCount}</span>
        </div>
        <input 
          type="range" 
          min="16" 
          max="128" 
          step="4"
          bind:value={activeSpectrum.barCount}
          onchange={() => {
            projectStore.syncActiveSpectrum();
            projectStore.saveToDB(400);
          }}
          class="w-full accent-cyan-500 cursor-pointer"
        />
      </div>

      <div>
        <div class="flex justify-between text-neutral-400 mb-1 text-[11px]">
          <span>Tinggi Spektrum</span>
          <span>{activeSpectrum.height}px</span>
        </div>
        <input 
          type="range" 
          min="30" 
          max="350" 
          step="2"
          bind:value={activeSpectrum.height}
          onchange={() => {
            projectStore.syncActiveSpectrum();
            projectStore.saveToDB(400);
          }}
          class="w-full accent-cyan-500 cursor-pointer"
        />
      </div>
    </div>

    <!-- Colors -->
    <div class="grid grid-cols-2 gap-2">
      <div>
        <span class="block text-neutral-400 mb-1 text-xs">Primary Color</span>
        <div class="flex items-center gap-2 bg-neutral-950 p-1.5 rounded-lg border border-neutral-800">
          <input 
            type="color" 
            bind:value={activeSpectrum.color} 
            onchange={() => {
              projectStore.syncActiveSpectrum();
              projectStore.saveToDB(500);
            }} 
            class="w-6 h-6 bg-transparent border-0 cursor-pointer" 
          />
          <span class="font-mono text-[11px]">{activeSpectrum.color}</span>
        </div>
      </div>
      <div>
        <span class="block text-neutral-400 mb-1 text-xs">Secondary Color</span>
        <div class="flex items-center gap-2 bg-neutral-950 p-1.5 rounded-lg border border-neutral-800">
          <input 
            type="color" 
            bind:value={activeSpectrum.secondaryColor} 
            onchange={() => {
              projectStore.syncActiveSpectrum();
              projectStore.saveToDB(500);
            }} 
            class="w-6 h-6 bg-transparent border-0 cursor-pointer" 
          />
          <span class="font-mono text-[11px]">{activeSpectrum.secondaryColor}</span>
        </div>
      </div>
    </div>

    <!-- Mirror Mode -->
    <div class="p-3 bg-neutral-950/60 rounded-lg border border-neutral-800/80 flex items-center justify-between">
      <div>
        <span class="text-neutral-300 font-medium block text-xs">Mirror Mode</span>
        <span class="text-[10px] text-neutral-500 block">Spektrum simetris kiri & kanan</span>
      </div>
      <input 
        type="checkbox" 
        bind:checked={activeSpectrum.mirror}
        onchange={() => {
          projectStore.syncActiveSpectrum();
          projectStore.saveToDB(300);
        }}
        class="accent-cyan-500 w-4 h-4 cursor-pointer"
      />
    </div>

    <!-- Follow Beat -->
    <div class="p-3 bg-neutral-950/60 rounded-lg border border-neutral-800/80 space-y-2">
      <div class="flex items-center justify-between">
        <span class="text-neutral-300 font-medium text-xs">Follow Beat</span>
        <input 
          type="checkbox" 
          bind:checked={activeSpectrum.followBeat}
          onchange={() => {
            projectStore.syncActiveSpectrum();
            projectStore.saveToDB(300);
          }}
          class="accent-cyan-500 w-4 h-4 cursor-pointer"
        />
      </div>

      {#if activeSpectrum.followBeat}
        <div>
          <div class="flex justify-between text-neutral-400 text-[11px] mb-1">
            <span>Spectrum Beat Sensitivity</span>
            <span>{(activeSpectrum.beatSensitivity ?? 1.2).toFixed(1)}x</span>
          </div>
          <input 
            type="range" 
            min="0.2" 
            max="3.0" 
            step="0.1" 
            bind:value={activeSpectrum.beatSensitivity}
            onchange={() => {
              projectStore.syncActiveSpectrum();
              projectStore.saveToDB(400);
            }}
            class="w-full accent-cyan-500 cursor-pointer"
          />
        </div>
      {/if}
    </div>
  {/if}
</div>
