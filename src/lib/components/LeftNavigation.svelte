<script lang="ts">
  import { projectStore } from '../stores/project.svelte';
  import { featureRegistry } from '../../app/registry/featureRegistry';
  import { Download } from '@lucide/svelte';

  const items = [
    ...featureRegistry.map((f) => ({
      id: f.id,
      label: f.label,
      icon: f.icon,
    })),
    {
      id: 'tracklist-png',
      label: 'PNG Export',
      icon: Download,
    },
  ];
</script>

<aside class="w-[72px] shrink-0 bg-neutral-950/90 border-r border-neutral-800/80 flex flex-col items-center py-3 gap-1 z-20 select-none backdrop-blur-md overflow-y-auto no-scrollbar">
  {#each items as item}
    {@const Icon = item.icon}
    {@const isActive = projectStore.activeTab === item.id}
    <button
      onclick={() => projectStore.activeTab = item.id as any}
      class={`w-[60px] h-[58px] rounded-xl flex flex-col items-center justify-center gap-1 transition-all cursor-pointer relative group ${
        isActive
          ? 'bg-neutral-900 text-cyan-400 shadow-md shadow-cyan-500/10 border border-neutral-800'
          : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-900/50'
      }`}
      title={item.label}
    >
      {#if isActive}
        <!-- Active indicator bar on the left -->
        <span class="absolute left-0 top-2 bottom-2 w-1 bg-gradient-to-b from-cyan-400 to-blue-500 rounded-r-full shadow-sm shadow-cyan-400/50"></span>
      {/if}

      <Icon class={`w-5 h-5 transition-transform group-hover:scale-110 ${isActive ? 'text-cyan-400' : 'text-neutral-400'}`} />
      <span class={`text-[10px] font-medium tracking-tight truncate max-w-[56px] text-center ${isActive ? 'text-cyan-300 font-semibold' : 'text-neutral-400'}`}>
        {item.label}
      </span>
    </button>
  {/each}
</aside>
