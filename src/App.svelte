<script lang="ts">
  import { projectStore } from './lib/stores/project.svelte';
  import Header from './lib/components/Header.svelte';
  import PreviewCanvas from './lib/components/PreviewCanvas.svelte';
  import Sidebar from './lib/components/Sidebar.svelte';
  import Timeline from './lib/components/Timeline.svelte';
  import LeftNavigation from './lib/components/LeftNavigation.svelte';
  import { ExportModal } from './features/export';
  import { LyricsModal } from './features/lyrics';
  import { PlaylistModal } from './features/playlist';
  import { TracklistGenerator } from './features/tracklist';
  import { LicenseModal } from './features/licensing';
  import { sweepOpfsTempFiles } from './lib/utils/storage';

  import { onMount, onDestroy } from 'svelte';

  let exportModalRef: ReturnType<typeof ExportModal>;
  let lyricsModalRef: ReturnType<typeof LyricsModal>;
  let playlistModalRef: ReturnType<typeof PlaylistModal>;
  let licenseModalRef: ReturnType<typeof LicenseModal>;

  export function openExport() {
    exportModalRef?.open();
  }

  export function openLyrics() {
    lyricsModalRef?.open();
  }

  export function openPlaylist() {
    playlistModalRef?.open();
  }

  export function openLicense() {
    licenseModalRef?.open();
  }

  onMount(() => {
    projectStore.loadFromDB();
    sweepOpfsTempFiles().catch(() => {});

    // 1. Intercept Reload, Tab Close, Window Close, URL navigation
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      // If user has active tracks, lyrics, or modified configs, prompt confirmation
      const hasContent = (projectStore.project.audio.tracks && projectStore.project.audio.tracks.length > 0) ||
                         (projectStore.project.lyrics.segments && projectStore.project.lyrics.segments.length > 0) ||
                         (projectStore.project.background.items && projectStore.project.background.items.length > 0);

      if (hasContent) {
        e.preventDefault();
        e.returnValue = ''; // Standard browser confirmation trigger
        return '';
      }
    };

    // 2. Intercept History Back / Forward (PopState)
    const handlePopState = (e: PopStateEvent) => {
      const confirmed = window.confirm('Apakah Anda yakin ingin meninggalkan halaman visualizer? Progres yang belum diexport mungkin hilang.');
      if (!confirmed) {
        history.pushState(null, '', window.location.href);
      }
    };

    // Push initial state so back button is trapped
    history.pushState(null, '', window.location.href);

    // 3. Intercept all internal / external hyperlink clicks
    const handleDocumentClick = (e: MouseEvent) => {
      const target = (e.target as HTMLElement).closest('a');
      if (target && target.href && !target.href.startsWith('javascript:')) {
        const confirmed = window.confirm('Apakah Anda yakin ingin berpindah ke tautan lain dan meninggalkan visualizer?');
        if (!confirmed) {
          e.preventDefault();
          e.stopPropagation();
        }
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('popstate', handlePopState);
    document.addEventListener('click', handleDocumentClick, true);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('popstate', handlePopState);
      document.removeEventListener('click', handleDocumentClick, true);
    };
  });

</script>

<div class="flex flex-col w-full h-full bg-neutral-950 text-neutral-100 overflow-hidden font-sans">
  <Header onExport={openExport} onOpenLicense={openLicense} />
  
  <div class="flex-1 flex overflow-hidden min-h-0">
    <LeftNavigation />

    {#if projectStore.activeTab === 'tracklist-png'}
      <TracklistGenerator />
    {:else}
      <main class="flex-1 flex flex-col min-w-0 bg-neutral-950 overflow-hidden">
        <PreviewCanvas />
      </main>
      <Sidebar onOpenLyrics={openLyrics} />
    {/if}
  </div>

  {#if projectStore.activeTab !== 'tracklist-png'}
    <Timeline onOpenPlaylist={openPlaylist} onOpenExport={openExport} />
  {/if}
  <ExportModal bind:this={exportModalRef} onOpenLicense={openLicense} />
  <LyricsModal bind:this={lyricsModalRef} />
  <PlaylistModal bind:this={playlistModalRef} />
  <LicenseModal bind:this={licenseModalRef} />
</div>






