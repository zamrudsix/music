<script lang="ts">
  import { projectStore } from '../stores/project.svelte';
  import { getFeatureById } from '../../app/registry/featureRegistry';

  let { onOpenLyrics }: { onOpenLyrics?: () => void } = $props();

  const currentFeature = $derived(getFeatureById(projectStore.activeTab));
</script>

{#if currentFeature}
  {@const Icon = currentFeature.icon}
  {@const PanelComponent = currentFeature.component}

  <aside class="w-80 border-l border-neutral-800 bg-neutral-900/90 flex flex-col shrink-0 h-full overflow-y-auto select-none text-xs">
    <!-- Dynamic Tab Header Title -->
    <div class="p-4 border-b border-neutral-800 flex items-center justify-between">
      <div class="flex items-center gap-2">
        <Icon class="w-4 h-4 text-cyan-400" />
        <span class="font-semibold text-neutral-200">{currentFeature.headerTitle}</span>
      </div>
    </div>

    <!-- Encapsulated Feature Capsule Content -->
    <div class="p-4 space-y-6 flex-1">
      <PanelComponent {onOpenLyrics} />
    </div>
  </aside>
{/if}
