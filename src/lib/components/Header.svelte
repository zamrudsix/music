<script lang="ts">
  import { onMount } from 'svelte';
  import { projectStore } from '../stores/project.svelte';
  import { 
    Sparkles, 
    Download, 
    Save, 
    FolderOpen, 
    Check,
    ChevronDown,
    Package,
    Sliders,
    FileJson,
    Loader2,
    FilePlus,
    ShieldCheck,
    Lock
  } from '@lucide/svelte';
  import { licenseManager } from '../../features/licensing';

  interface Props {
    onExport?: () => void;
    onOpenLicense?: () => void;
  }

  let { onExport, onOpenLicense }: Props = $props();
  let projectFileInput: HTMLInputElement;
  let showSaveDropdown = $state(false);
  let showNewProjectModal = $state(false);
  let isProcessing = $state(false);
  let statusMessage = $state<string | null>(null);


  async function handleOpenProject(e: Event) {
    const target = e.target as HTMLInputElement;
    if (target.files && target.files[0]) {
      const file = target.files[0];
      try {
        isProcessing = true;
        statusMessage = 'Opening project...';
        await projectStore.importProjectFile(file);
        statusMessage = 'Project loaded!';
        setTimeout(() => statusMessage = null, 3000);
      } catch (err: any) {
        alert('Failed to load project: ' + err.message);
      } finally {
        isProcessing = false;
        target.value = '';
      }
    }
  }

  async function handleSavePackage() {
    showSaveDropdown = false;
    try {
      isProcessing = true;
      statusMessage = 'Packing .beras bundle...';
      await projectStore.exportProjectPackage();
      statusMessage = 'Saved as .beras!';
      setTimeout(() => statusMessage = null, 3000);
    } catch (err: any) {
      alert('Failed to save project package: ' + err.message);
    } finally {
      isProcessing = false;
    }
  }

  async function handleSavePreset() {
    showSaveDropdown = false;
    try {
      statusMessage = 'Saving preset .bvp...';
      await projectStore.exportProjectPreset();
      statusMessage = 'Saved as .bvp!';
      setTimeout(() => statusMessage = null, 3000);
    } catch (err: any) {
      alert('Failed to save preset: ' + err.message);
    }
  }

  async function handleSaveJSON() {
    showSaveDropdown = false;
    projectStore.exportProjectJSON();
  }

  async function confirmNewProject() {
    showNewProjectModal = false;
    isProcessing = true;
    statusMessage = 'Creating new project...';
    try {
      await projectStore.createNewProject();
      statusMessage = 'New project created!';
      setTimeout(() => statusMessage = null, 3000);
    } catch (err: any) {
      alert('Failed to reset project: ' + err.message);
    } finally {
      isProcessing = false;
    }
  }

  onMount(() => {
    projectStore.loadFromDB();
  });
</script>

<header class="h-14 border-b border-neutral-800 bg-neutral-900/80 backdrop-blur-md px-4 flex items-center justify-between shrink-0 z-30 gap-2">
  <div class="flex items-center gap-3 shrink-0">
    <div class="w-8 h-8 rounded-lg overflow-hidden flex items-center justify-center shadow-lg shadow-cyan-500/20 border border-cyan-500/30 shrink-0">
      <img src="/logo.svg" alt="BeatCanvas Logo" class="w-full h-full object-cover" />
    </div>
    <div class="flex flex-col max-w-[200px] lg:max-w-[280px]">
      <div class="flex items-center gap-1.5">
        <input 
          type="text" 
          bind:value={projectStore.project.title}
          onchange={() => projectStore.saveToDB()}
          class="bg-transparent text-sm font-semibold text-neutral-100 hover:bg-neutral-800/60 focus:bg-neutral-800 px-1.5 py-0.5 rounded outline-none transition-colors border border-transparent focus:border-neutral-700 truncate"
        />
        <span class="text-[10px] px-1.5 py-0.5 rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 font-mono shrink-0">
          {projectStore.project.exportSettings.resolution}
        </span>
      </div>
      <div class="flex items-center gap-2 text-[10px] text-neutral-400 px-1.5 truncate">
        <span class="truncate">{projectStore.project.audio.fileName || 'No audio loaded'}</span>
        <span class="text-neutral-600 shrink-0">•</span>
        {#if projectStore.isAutosaving}
          <span class="text-cyan-400 flex items-center gap-1 animate-pulse shrink-0">Saving...</span>
        {:else}
          <span class="text-neutral-500 flex items-center gap-1 shrink-0">
            <Check class="w-2.5 h-2.5 text-emerald-500" />
            Auto-saved
          </span>
        {/if}
      </div>
    </div>
  </div>

  <!-- Project File Actions & Render Video -->
  <div class="flex items-center gap-2 shrink-0 z-10 ml-auto relative">
    {#if statusMessage}
      <span class="text-[11px] font-medium text-cyan-400 animate-in fade-in flex items-center gap-1 bg-cyan-950/60 border border-cyan-800/60 px-2.5 py-1 rounded-md">
        {#if isProcessing}
          <Loader2 class="w-3 h-3 animate-spin" />
        {/if}
        {statusMessage}
      </span>
    {/if}

    <!-- New Project Button -->
    <button 
      onclick={() => showNewProjectModal = true}
      class="px-2.5 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-xs font-medium flex items-center gap-1.5 transition-colors border border-neutral-700 cursor-pointer"
      title="Mulai Project Baru Bersih"
      disabled={isProcessing}
    >
      <FilePlus class="w-3.5 h-3.5 text-cyan-400" />
      New Project
    </button>

    <!-- Open Project Button -->
    <button 
      onclick={() => projectFileInput.click()}
      class="px-2.5 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-xs font-medium flex items-center gap-1.5 transition-colors border border-neutral-700 cursor-pointer"
      title="Open Project (.beras, .bvp, .json)"
      disabled={isProcessing}
    >
      <FolderOpen class="w-3.5 h-3.5 text-amber-400" />
      Open Project
    </button>
    <input 
      bind:this={projectFileInput} 
      type="file" 
      accept=".beras,.bvp,.json,application/json,application/octet-stream,application/zip" 
      class="hidden" 
      onchange={handleOpenProject} 
    />

    <!-- Save Project Split Button / Dropdown -->
    <div class="relative flex items-center">
      <button 
        onclick={handleSavePackage}
        class="px-2.5 py-1.5 rounded-l-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-medium flex items-center gap-1.5 transition-colors border border-neutral-700 border-r-0 cursor-pointer"
        title="Save Project Package (.beras) - Config + All Media Assets"
        disabled={isProcessing}
      >
        <Save class="w-3.5 h-3.5 text-cyan-400" />
        Save Project
      </button>

      <button
        onclick={() => showSaveDropdown = !showSaveDropdown}
        class="px-1.5 py-1.5 rounded-r-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-400 hover:text-neutral-200 text-xs transition-colors border border-neutral-700 cursor-pointer"
        title="Save Options (.beras bundle / .bvp preset / .json)"
        disabled={isProcessing}
      >
        <ChevronDown class="w-3.5 h-3.5" />
      </button>

      <!-- Dropdown Menu -->
      {#if showSaveDropdown}
        <div 
          class="absolute right-0 top-full mt-1.5 w-64 bg-neutral-900 border border-neutral-800 rounded-xl shadow-2xl p-1.5 z-50 flex flex-col gap-1 backdrop-blur-xl animate-in fade-in zoom-in-95"
        >
          <button
            onclick={handleSavePackage}
            class="w-full px-2.5 py-2 rounded-lg text-left hover:bg-neutral-800 flex items-start gap-2.5 transition-colors cursor-pointer group"
          >
            <div class="p-1 rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 group-hover:bg-cyan-500/20 mt-0.5">
              <Package class="w-4 h-4" />
            </div>
            <div class="flex-1 min-w-0">
              <div class="text-xs font-semibold text-neutral-200 flex items-center justify-between">
                <span>Save Package (.beras)</span>
                <span class="text-[9px] px-1 rounded bg-cyan-500/20 text-cyan-300 font-normal">Lengkap</span>
              </div>
              <p class="text-[10px] text-neutral-400 leading-snug mt-0.5">
                Menyimpan config + seluruh lagu, video, & gambar dalam 1 file mandiri.
              </p>
            </div>
          </button>

          <button
            onclick={handleSavePreset}
            class="w-full px-2.5 py-2 rounded-lg text-left hover:bg-neutral-800 flex items-start gap-2.5 transition-colors cursor-pointer group"
          >
            <div class="p-1 rounded bg-fuchsia-500/10 text-fuchsia-400 border border-fuchsia-500/20 group-hover:bg-fuchsia-500/20 mt-0.5">
              <Sliders class="w-4 h-4" />
            </div>
            <div class="flex-1 min-w-0">
              <div class="text-xs font-semibold text-neutral-200 flex items-center justify-between">
                <span>Save Style Preset (.bvp)</span>
                <span class="text-[9px] px-1 rounded bg-neutral-800 text-neutral-400 font-normal">Ringan</span>
              </div>
              <p class="text-[10px] text-neutral-400 leading-snug mt-0.5">
                Hanya gaya visual & spectrum (cocok untuk template lagu lain).
              </p>
            </div>
          </button>

          <button
            onclick={handleSaveJSON}
            class="w-full px-2.5 py-2 rounded-lg text-left hover:bg-neutral-800 flex items-start gap-2.5 transition-colors cursor-pointer group"
          >
            <div class="p-1 rounded bg-neutral-800 text-neutral-400 border border-neutral-700 mt-0.5">
              <FileJson class="w-4 h-4" />
            </div>
            <div class="flex-1 min-w-0">
              <div class="text-xs font-semibold text-neutral-200">
                Export JSON (.json)
              </div>
              <p class="text-[10px] text-neutral-400 leading-snug mt-0.5">
                Cadangan struktur data mentah.
              </p>
            </div>
          </button>
        </div>

        <!-- Click outside backdrop -->
        <div 
          role="button"
          tabindex="0"
          class="fixed inset-0 z-40 bg-transparent" 
          onclick={() => showSaveDropdown = false}
          onkeydown={(e) => { if (e.key === 'Escape') showSaveDropdown = false; }}
        ></div>
      {/if}
    </div>

    <!-- License Status Badge -->
    <button
      type="button"
      onclick={() => onOpenLicense?.()}
      class={`px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer border ${
        licenseManager.isLicensed
          ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20'
          : 'bg-amber-500/10 text-amber-400 border-amber-500/30 hover:bg-amber-500/20'
      }`}
      title={licenseManager.isLicensed ? 'Status: PRO Active (Permanen)' : 'Status: Free Edition (Klik untuk Aktivasi PRO)'}
    >
      {#if licenseManager.isLicensed}
        <ShieldCheck class="w-3.5 h-3.5 text-emerald-400" />
        <span class="tracking-wide text-[11px]">PRO</span>
      {:else}
        <Lock class="w-3.5 h-3.5 text-amber-400" />
        <span class="tracking-wide text-[11px]">FREE</span>
      {/if}
    </button>

    <!-- Export Video Button -->
    <button 
      onclick={() => onExport?.()}
      class="px-3.5 py-1.5 bg-gradient-to-r from-cyan-500 to-blue-600 bg-cyan-500 hover:bg-cyan-400 text-white text-xs font-semibold rounded-lg flex items-center gap-1.5 shadow-md shadow-cyan-500/20 transition-all active:scale-95 cursor-pointer ml-1"
    >
      <Download class="w-3.5 h-3.5" />
      Export Video
    </button>
  </div>
</header>


<!-- New Project Confirmation Modal -->
{#if showNewProjectModal}
  <div 
    class="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150"
  >
    <div 
      class="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 max-w-sm w-full shadow-2xl space-y-4 animate-in zoom-in-95 duration-150"
    >
      <div class="flex items-center gap-3">
        <div class="w-10 h-10 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 flex items-center justify-center shrink-0">
          <FilePlus class="w-5 h-5" />
        </div>
        <div>
          <h3 class="text-sm font-bold text-neutral-100">Mulai Project Baru?</h3>
          <p class="text-xs text-neutral-400 mt-0.5">Project saat ini akan di-reset ke kondisi awal bersih.</p>
        </div>
      </div>

      <p class="text-[11px] text-neutral-400 leading-relaxed bg-neutral-950 p-3 rounded-xl border border-neutral-800/80">
        ⚠️ Seluruh lagu, background, dan pengaturan yang belum disimpan ke file <span class="text-cyan-400 font-semibold">.beras</span> akan dibersihkan.
      </p>

      <div class="flex items-center justify-end gap-2 pt-2">
        <button 
          type="button"
          onclick={() => showNewProjectModal = false}
          class="px-3 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-xs font-medium border border-neutral-700 transition-colors cursor-pointer"
        >
          Batal
        </button>
        <button 
          type="button"
          onclick={confirmNewProject}
          class="px-3.5 py-1.5 rounded-lg bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white text-xs font-semibold shadow-md shadow-cyan-500/20 transition-all cursor-pointer"
        >
          Ya, Buat Project Baru
        </button>
      </div>
    </div>
  </div>
{/if}
