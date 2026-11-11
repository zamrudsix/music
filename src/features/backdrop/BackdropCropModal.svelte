<script lang="ts">
  import { projectStore } from '../../lib/stores/project.svelte';
  import type { BackgroundItem } from '../../lib/types/project';
  import { X, Check, RotateCcw, Crop, Ratio } from '@lucide/svelte';

  interface Props {
    item: BackgroundItem;
    onClose: () => void;
  }

  let { item, onClose }: Props = $props();

  let mediaContainer: HTMLDivElement | null = $state(null);
  let mediaElement: HTMLImageElement | HTMLVideoElement | null = $state(null);

  // Crop values normalized (0.0 to 1.0)
  let cropX = $state(0);
  let cropY = $state(0);
  let cropW = $state(1.0);
  let cropH = $state(1.0);

  $effect(() => {
    cropX = item.crop?.x ?? 0;
    cropY = item.crop?.y ?? 0;
    cropW = item.crop?.width ?? 1.0;
    cropH = item.crop?.height ?? 1.0;
  });

  // Aspect ratio lock: 'free' | '16:9' | '9:16' | '1:1' | '4:3'
  let activeRatio = $state<'free' | '16:9' | '9:16' | '1:1' | '4:3'>('free');

  let isDragging = $state(false);
  let dragHandle = $state<string | null>(null); // 'move' | 'tl' | 'tr' | 'bl' | 'br'
  let startMouseX = 0;
  let startMouseY = 0;
  let startCropX = 0;
  let startCropY = 0;
  let startCropW = 1.0;
  let startCropH = 1.0;

  let naturalWidth = $state(1920);
  let naturalHeight = $state(1080);

  function handleMediaLoaded(e: Event) {
    if (item.type === 'video') {
      const vid = e.target as HTMLVideoElement;
      naturalWidth = vid.videoWidth || 1920;
      naturalHeight = vid.videoHeight || 1080;
    } else {
      const img = e.target as HTMLImageElement;
      naturalWidth = img.naturalWidth || 1920;
      naturalHeight = img.naturalHeight || 1080;
    }
  }

  function applyPreset(ratio: 'free' | '16:9' | '9:16' | '1:1' | '4:3') {
    activeRatio = ratio;
    if (ratio === 'free') return;

    let targetAspect = 16 / 9;
    if (ratio === '9:16') targetAspect = 9 / 16;
    else if (ratio === '1:1') targetAspect = 1.0;
    else if (ratio === '4:3') targetAspect = 4 / 3;

    // Convert pixel aspect to normalized aspect
    const normalizedAspect = targetAspect * (naturalHeight / naturalWidth);

    let newW = 1.0;
    let newH = newW / normalizedAspect;

    if (newH > 1.0) {
      newH = 1.0;
      newW = newH * normalizedAspect;
    }

    cropW = Math.min(1.0, Math.max(0.05, newW));
    cropH = Math.min(1.0, Math.max(0.05, newH));
    cropX = Math.max(0, (1.0 - cropW) / 2);
    cropY = Math.max(0, (1.0 - cropH) / 2);
  }

  function resetCrop() {
    cropX = 0;
    cropY = 0;
    cropW = 1.0;
    cropH = 1.0;
    activeRatio = 'free';
  }

  function saveAndClose() {
    const isFull = cropX <= 0.001 && cropY <= 0.001 && cropW >= 0.999 && cropH >= 0.999;
    if (isFull) {
      delete item.crop;
    } else {
      item.crop = {
        x: Number(cropX.toFixed(4)),
        y: Number(cropY.toFixed(4)),
        width: Number(cropW.toFixed(4)),
        height: Number(cropH.toFixed(4)),
      };
    }
    projectStore.saveToDB();
    onClose();
  }

  function onPointerDown(e: MouseEvent | TouchEvent, handle: string) {
    e.preventDefault();
    e.stopPropagation();

    isDragging = true;
    dragHandle = handle;

    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

    startMouseX = clientX;
    startMouseY = clientY;
    startCropX = cropX;
    startCropY = cropY;
    startCropW = cropW;
    startCropH = cropH;

    window.addEventListener('mousemove', onPointerMove);
    window.addEventListener('mouseup', onPointerUp);
    window.addEventListener('touchmove', onPointerMove);
    window.addEventListener('touchend', onPointerUp);
  }

  function onPointerMove(e: MouseEvent | TouchEvent) {
    if (!isDragging || !mediaContainer) return;

    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

    const rect = mediaContainer.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;

    const deltaX = (clientX - startMouseX) / rect.width;
    const deltaY = (clientY - startMouseY) / rect.height;

    const minSize = 0.05;

    if (dragHandle === 'move') {
      let newX = startCropX + deltaX;
      let newY = startCropY + deltaY;

      newX = Math.max(0, Math.min(1.0 - cropW, newX));
      newY = Math.max(0, Math.min(1.0 - cropH, newY));

      cropX = newX;
      cropY = newY;
    } else if (dragHandle === 'br') {
      let newW = Math.max(minSize, Math.min(1.0 - startCropX, startCropW + deltaX));
      let newH = Math.max(minSize, Math.min(1.0 - startCropY, startCropH + deltaY));

      if (activeRatio !== 'free') {
        const targetAspect = activeRatio === '16:9' ? 16 / 9 : activeRatio === '9:16' ? 9 / 16 : activeRatio === '1:1' ? 1 : 4 / 3;
        const normAspect = targetAspect * (naturalHeight / naturalWidth);
        newH = newW / normAspect;
        if (startCropY + newH > 1.0) {
          newH = 1.0 - startCropY;
          newW = newH * normAspect;
        }
      }

      cropW = newW;
      cropH = newH;
    } else if (dragHandle === 'tl') {
      let newX = Math.min(startCropX + startCropW - minSize, Math.max(0, startCropX + deltaX));
      let newY = Math.min(startCropY + startCropH - minSize, Math.max(0, startCropY + deltaY));
      let newW = (startCropX + startCropW) - newX;
      let newH = (startCropY + startCropH) - newY;

      if (activeRatio !== 'free') {
        const targetAspect = activeRatio === '16:9' ? 16 / 9 : activeRatio === '9:16' ? 9 / 16 : activeRatio === '1:1' ? 1 : 4 / 3;
        const normAspect = targetAspect * (naturalHeight / naturalWidth);
        newH = newW / normAspect;
        newY = (startCropY + startCropH) - newH;
        if (newY < 0) {
          newY = 0;
          newH = startCropY + startCropH;
          newW = newH * normAspect;
          newX = (startCropX + startCropW) - newW;
        }
      }

      cropX = newX;
      cropY = newY;
      cropW = newW;
      cropH = newH;
    } else if (dragHandle === 'tr') {
      let newY = Math.min(startCropY + startCropH - minSize, Math.max(0, startCropY + deltaY));
      let newW = Math.max(minSize, Math.min(1.0 - startCropX, startCropW + deltaX));
      let newH = (startCropY + startCropH) - newY;

      if (activeRatio !== 'free') {
        const targetAspect = activeRatio === '16:9' ? 16 / 9 : activeRatio === '9:16' ? 9 / 16 : activeRatio === '1:1' ? 1 : 4 / 3;
        const normAspect = targetAspect * (naturalHeight / naturalWidth);
        newH = newW / normAspect;
        newY = (startCropY + startCropH) - newH;
        if (newY < 0) {
          newY = 0;
          newH = startCropY + startCropH;
          newW = newH * normAspect;
        }
      }

      cropY = newY;
      cropW = newW;
      cropH = newH;
    } else if (dragHandle === 'bl') {
      let newX = Math.min(startCropX + startCropW - minSize, Math.max(0, startCropX + deltaX));
      let newW = (startCropX + startCropW) - newX;
      let newH = Math.max(minSize, Math.min(1.0 - startCropY, startCropH + deltaY));

      if (activeRatio !== 'free') {
        const targetAspect = activeRatio === '16:9' ? 16 / 9 : activeRatio === '9:16' ? 9 / 16 : activeRatio === '1:1' ? 1 : 4 / 3;
        const normAspect = targetAspect * (naturalHeight / naturalWidth);
        newH = newW / normAspect;
        if (startCropY + newH > 1.0) {
          newH = 1.0 - startCropY;
          newW = newH * normAspect;
          newX = (startCropX + startCropW) - newW;
        }
      }

      cropX = newX;
      cropW = newW;
      cropH = newH;
    }
  }

  function onPointerUp() {
    isDragging = false;
    dragHandle = null;
    window.removeEventListener('mousemove', onPointerMove);
    window.removeEventListener('mouseup', onPointerUp);
    window.removeEventListener('touchmove', onPointerMove);
    window.removeEventListener('touchend', onPointerUp);
  }
</script>

<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
  <div class="w-full max-w-4xl bg-neutral-900 border border-neutral-800 rounded-2xl shadow-2xl flex flex-col overflow-hidden max-h-[92vh]">
    
    <!-- Modal Header -->
    <div class="flex items-center justify-between px-5 py-4 border-b border-neutral-800">
      <div class="flex items-center gap-2">
        <div class="p-2 rounded-lg bg-cyan-500/10 text-cyan-400">
          <Crop class="w-4 h-4" />
        </div>
        <div>
          <h2 class="text-sm font-semibold text-neutral-100">Crop Backdrop Media</h2>
          <p class="text-[11px] text-neutral-400 truncate max-w-md">{item.name} ({item.type})</p>
        </div>
      </div>
      <button 
        onclick={onClose}
        class="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-100 hover:bg-neutral-800 transition-colors cursor-pointer"
      >
        <X class="w-4 h-4" />
      </button>
    </div>

    <!-- Toolbar: Aspect Ratio Presets -->
    <div class="flex items-center justify-between px-5 py-2.5 bg-neutral-950 border-b border-neutral-800/80 text-xs">
      <div class="flex items-center gap-1.5">
        <span class="text-neutral-500 text-[11px] mr-1 flex items-center gap-1">
          <Ratio class="w-3 h-3" /> Rasio:
        </span>
        {#each ['free', '16:9', '9:16', '1:1', '4:3'] as ratio}
          <button
            onclick={() => applyPreset(ratio as any)}
            class={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors cursor-pointer ${
              activeRatio === ratio
                ? 'bg-cyan-500 text-neutral-950 font-semibold shadow'
                : 'bg-neutral-900 text-neutral-300 hover:bg-neutral-800 border border-neutral-800'
            }`}
          >
            {ratio === 'free' ? 'Bebas (Free)' : ratio}
          </button>
        {/each}
      </div>

      <button
        onclick={resetCrop}
        class="flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] text-neutral-400 hover:text-neutral-200 bg-neutral-900 border border-neutral-800 hover:bg-neutral-800 transition-colors cursor-pointer"
        title="Reset ke tampilan penuh"
      >
        <RotateCcw class="w-3 h-3" />
        Reset
      </button>
    </div>

    <!-- Media & Interactive Crop Area -->
    <div class="flex-1 min-h-[360px] max-h-[55vh] p-6 flex items-center justify-center bg-neutral-950/60 overflow-hidden select-none">
      <div 
        bind:this={mediaContainer}
        class="relative max-w-full max-h-full flex items-center justify-center border border-neutral-800 rounded-lg overflow-hidden shadow-inner"
        style="user-select: none;"
      >
        <!-- Media element (Image or Video) -->
        {#if item.type === 'video'}
          <!-- svelte-ignore a11y_media_has_caption -->
          <video 
            bind:this={mediaElement}
            src={item.url} 
            onloadedmetadata={handleMediaLoaded}
            autoplay 
            muted 
            loop 
            playsinline
            class="max-w-full max-h-[50vh] object-contain block pointer-events-none"
          ></video>
        {:else}
          <img 
            bind:this={mediaElement}
            src={item.url} 
            onload={handleMediaLoaded}
            alt={item.name}
            class="max-w-full max-h-[50vh] object-contain block pointer-events-none"
          />
        {/if}

        <!-- Dark Mask Outside Crop Area -->
        <div 
          class="absolute inset-0 pointer-events-none"
          style={`background: rgba(0, 0, 0, 0.6); clip-path: polygon(
            0% 0%, 0% 100%, 
            ${cropX * 100}% 100%, 
            ${cropX * 100}% ${cropY * 100}%, 
            ${(cropX + cropW) * 100}% ${cropY * 100}%, 
            ${(cropX + cropW) * 100}% ${(cropY + cropH) * 100}%, 
            ${cropX * 100}% ${(cropY + cropH) * 100}%, 
            ${cropX * 100}% 100%, 
            100% 100%, 100% 0%
          );`}
        ></div>

        <!-- Interactive Crop Box -->
        <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
        <div 
          class="absolute border-2 border-cyan-400 cursor-move transition-[box-shadow] shadow-lg shadow-cyan-500/20"
          style={`left: ${cropX * 100}%; top: ${cropY * 100}%; width: ${cropW * 100}%; height: ${cropH * 100}%;`}
          onmousedown={(e) => onPointerDown(e, 'move')}
          ontouchstart={(e) => onPointerDown(e, 'move')}
          role="region"
          aria-label="Crop Area"
        >
          <!-- Rule-of-Thirds Grid Lines -->
          <div class="absolute inset-0 pointer-events-none grid grid-cols-3 grid-rows-3 opacity-30">
            <div class="border-r border-b border-cyan-200"></div>
            <div class="border-r border-b border-cyan-200"></div>
            <div class="border-b border-cyan-200"></div>
            <div class="border-r border-b border-cyan-200"></div>
            <div class="border-r border-b border-cyan-200"></div>
            <div class="border-b border-cyan-200"></div>
            <div class="border-r border-b border-cyan-200"></div>
            <div class="border-r border-b border-cyan-200"></div>
            <div></div>
          </div>

          <!-- Corner Handles -->
          <button 
            type="button"
            class="absolute -top-1.5 -left-1.5 w-3.5 h-3.5 bg-cyan-400 border border-white rounded-xs cursor-nwse-resize shadow"
            onmousedown={(e) => onPointerDown(e, 'tl')}
            ontouchstart={(e) => onPointerDown(e, 'tl')}
            aria-label="Resize Top Left"
          ></button>
          <button 
            type="button"
            class="absolute -top-1.5 -right-1.5 w-3.5 h-3.5 bg-cyan-400 border border-white rounded-xs cursor-nesw-resize shadow"
            onmousedown={(e) => onPointerDown(e, 'tr')}
            ontouchstart={(e) => onPointerDown(e, 'tr')}
            aria-label="Resize Top Right"
          ></button>
          <button 
            type="button"
            class="absolute -bottom-1.5 -left-1.5 w-3.5 h-3.5 bg-cyan-400 border border-white rounded-xs cursor-nesw-resize shadow"
            onmousedown={(e) => onPointerDown(e, 'bl')}
            ontouchstart={(e) => onPointerDown(e, 'bl')}
            aria-label="Resize Bottom Left"
          ></button>
          <button 
            type="button"
            class="absolute -bottom-1.5 -right-1.5 w-3.5 h-3.5 bg-cyan-400 border border-white rounded-xs cursor-nwse-resize shadow"
            onmousedown={(e) => onPointerDown(e, 'br')}
            ontouchstart={(e) => onPointerDown(e, 'br')}
            aria-label="Resize Bottom Right"
          ></button>

          <!-- Current Dimension Badge -->
          <div class="absolute bottom-1 right-1 bg-black/75 px-1.5 py-0.5 rounded text-[9px] font-mono text-cyan-300 pointer-events-none">
            {Math.round(cropW * naturalWidth)} × {Math.round(cropH * naturalHeight)}
          </div>
        </div>
      </div>
    </div>

    <!-- Modal Footer -->
    <div class="flex items-center justify-between px-5 py-3.5 bg-neutral-950 border-t border-neutral-800">
      <div class="text-[11px] text-neutral-400">
        Area Crop: <span class="font-mono text-neutral-200">{Math.round(cropW * 100)}% × {Math.round(cropH * 100)}%</span> (X: {Math.round(cropX * 100)}%, Y: {Math.round(cropY * 100)}%)
      </div>
      <div class="flex items-center gap-2">
        <button
          onclick={onClose}
          class="px-4 py-1.5 rounded-lg border border-neutral-700 hover:bg-neutral-800 text-neutral-300 text-xs font-medium transition-colors cursor-pointer"
        >
          Batal
        </button>
        <button
          onclick={saveAndClose}
          class="px-4 py-1.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-neutral-950 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shadow-md shadow-cyan-500/20"
        >
          <Check class="w-3.5 h-3.5" />
          Simpan Crop
        </button>
      </div>
    </div>

  </div>
</div>
