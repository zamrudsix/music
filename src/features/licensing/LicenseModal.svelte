<script lang="ts">
  import { licenseManager } from './license.svelte';
  import { isDesktop } from '../../lib/utils/platform';
  import { 
    ShieldCheck, 
    Key, 
    Copy, 
    Check, 
    X, 
    AlertCircle, 
    CreditCard, 
    Sparkles, 
    Lock, 
    User,
    ExternalLink, 
    Loader2, 
    Send 
  } from '@lucide/svelte';

  let showModal = $state(false);
  let inputLicensee = $state('');
  let inputKey = $state('');
  let copiedRekening = $state(false);
  let copiedTelegram = $state(false);
  let isSubmitting = $state(false);
  let successMessage = $state<string | null>(null);

  async function openTelegramUrl(e?: MouseEvent) {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    const url = 'https://t.me/nurdiyantodyas';
    if (isDesktop()) {
      try {
        const { invoke } = await import('@tauri-apps/api/core');
        await invoke('open_external_url', { url });
        return;
      } catch (invokeErr) {
        console.warn('Native open_external_url failed, trying plugin-opener:', invokeErr);
        try {
          const { openUrl } = await import('@tauri-apps/plugin-opener');
          await openUrl(url);
          return;
        } catch (openerErr) {
          console.warn('Plugin opener also failed:', openerErr);
        }
      }
    }
    window.open(url, '_blank', 'noopener,noreferrer');
  }

  export function open() {
    showModal = true;
    inputLicensee = licenseManager.licensee || '';
    inputKey = '';
    successMessage = null;
    licenseManager.errorMessage = null;
  }

  export function close() {
    showModal = false;
  }

  async function copyToClipboard(text: string, type: 'rekening' | 'telegram') {
    try {
      await navigator.clipboard.writeText(text);
      if (type === 'rekening') {
        copiedRekening = true;
        setTimeout(() => copiedRekening = false, 2500);
      } else {
        copiedTelegram = true;
        setTimeout(() => copiedTelegram = false, 2500);
      }
    } catch (err) {
      console.warn('Clipboard failed:', err);
    }
  }

  async function handleActivate() {
    if (!inputLicensee.trim() || !inputKey.trim()) return;
    isSubmitting = true;
    try {
      const ok = await licenseManager.activate(inputLicensee, inputKey);
      if (ok) {
        successMessage = `Lisensi PRO Berhasil Diaktifkan untuk ${licenseManager.licensee}! Watermark dinonaktifkan permanen.`;
        setTimeout(() => {
          showModal = false;
        }, 2200);
      }
    } finally {
      isSubmitting = false;
    }
  }
</script>

{#if showModal}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div 
    class="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-200"
    onclick={(e) => e.target === e.currentTarget && close()}
  >
    <div class="bg-neutral-900 border border-neutral-800 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[88vh] text-neutral-100 animate-in zoom-in-95 duration-200">
      
      <!-- Header (Fixed) -->
      <div class="p-4 sm:p-5 border-b border-neutral-800 flex items-center justify-between bg-neutral-950/60 shrink-0">
        <div class="flex items-center gap-3 min-w-0">
          <div class={`w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center shadow-lg shrink-0 ${licenseManager.isLicensed ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'}`}>
            {#if licenseManager.isLicensed}
              <ShieldCheck class="w-5 h-5" />
            {:else}
              <Lock class="w-5 h-5" />
            {/if}
          </div>
          <div class="min-w-0">
            <div class="flex items-center gap-2 flex-wrap">
              <h2 class="text-xs sm:text-sm font-bold text-neutral-100 truncate">Aktivasi Lisensi Beras Visualizer</h2>
              {#if licenseManager.isLicensed}
                <span class="text-[9px] sm:text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-semibold uppercase tracking-wider">
                  PRO Active
                </span>
              {:else if licenseManager.freeQuotaRemaining > 0}
                <span class="text-[9px] sm:text-[10px] px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 font-semibold uppercase tracking-wider">
                  Free Quota: {licenseManager.freeQuotaRemaining} Tersisa
                </span>
              {:else}
                <span class="text-[9px] sm:text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30 font-semibold uppercase tracking-wider">
                  Free Edition
                </span>
              {/if}
            </div>
            <p class="text-[10px] sm:text-[11px] text-neutral-400 mt-0.5 truncate">
              {#if licenseManager.isLicensed}
                Aplikasi berlisensi penuh atas nama <span class="text-emerald-300 font-medium">{licenseManager.licensee}</span>. Bebas watermark permanen.
              {:else if licenseManager.freeQuotaRemaining > 0}
                Anda memiliki {licenseManager.freeQuotaRemaining} token render gratis tanpa watermark.
              {:else}
                Ekspor gratis menyertakan watermark minimalis "Made with Beras Visualizer".
              {/if}
            </p>
          </div>
        </div>
        <button 
          type="button"
          onclick={close}
          class="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800 transition-colors cursor-pointer shrink-0 ml-2"
        >
          <X class="w-4 h-4" />
        </button>
      </div>

      <!-- Content (Scrollable) -->
      <div class="p-4 sm:p-6 space-y-4 sm:space-y-5 flex-1 overflow-y-auto min-h-0">
        
        {#if successMessage}
          <div class="p-3 bg-emerald-950/60 border border-emerald-800/80 rounded-xl text-xs text-emerald-300 flex items-center gap-2.5">
            <Check class="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{successMessage}</span>
          </div>
        {/if}

        {#if licenseManager.errorMessage}
          <div class="p-3.5 bg-rose-950/60 border border-rose-800/80 rounded-xl text-xs text-rose-300 flex items-center gap-2.5">
            <AlertCircle class="w-4 h-4 text-rose-400 shrink-0" />
            <span>{licenseManager.errorMessage}</span>
          </div>
        {/if}

        <!-- Status Lisensi Saat Ini (Jika sudah aktif) -->
        {#if licenseManager.isLicensed}
          <div class="bg-emerald-950/30 border border-emerald-800/40 rounded-xl p-4 space-y-2 text-xs">
            <div class="flex items-center gap-2 text-emerald-400 font-semibold">
              <ShieldCheck class="w-4 h-4" />
              <span>Status Lisensi PRO Terverifikasi</span>
            </div>
            <div class="space-y-1 text-neutral-300">
              <div>Pemilik Lisensi: <span class="font-mono text-emerald-300 font-medium">{licenseManager.licensee}</span></div>
              <div class="text-[11px] text-neutral-400">Seluruh fitur rendering, video HD/4K 60FPS, dan ekspor tanpa watermark aktif selamanya.</div>
            </div>
          </div>
        {/if}

        <!-- Form Aktivasi -->
        <div class="bg-neutral-950/70 border border-neutral-800 rounded-xl p-4 space-y-3.5">
          <div class="flex items-center gap-2 text-xs font-semibold text-neutral-200">
            <Key class="w-4 h-4 text-cyan-400" />
            <span>Masukkan Lisensi Anda:</span>
          </div>

          <div class="space-y-2.5">
            <div>
              <label for="licensee-input" class="text-[11px] font-medium text-neutral-400 flex items-center gap-1.5 mb-1">
                <User class="w-3 h-3 text-neutral-500" />
                <span>Email atau Username Terdaftar:</span>
              </label>
              <input 
                id="licensee-input"
                type="text" 
                bind:value={inputLicensee}
                placeholder="contoh: budi@gmail.com atau @username_anda"
                class="w-full bg-neutral-900 border border-neutral-800 focus:border-cyan-500 rounded-xl px-3.5 py-2.5 text-xs text-neutral-100 placeholder:text-neutral-600 outline-none transition-all"
                disabled={isSubmitting || licenseManager.isLicensed}
              />
            </div>

            <div>
              <label for="license-input" class="text-[11px] font-medium text-neutral-400 flex items-center gap-1.5 mb-1">
                <Key class="w-3 h-3 text-neutral-500" />
                <span>Serial Key Ed25519:</span>
              </label>
              <input 
                id="license-input"
                type="text" 
                bind:value={inputKey}
                placeholder="PRO-..."
                class="w-full bg-neutral-900 border border-neutral-800 focus:border-cyan-500 rounded-xl px-3.5 py-2.5 font-mono text-xs text-neutral-100 placeholder:text-neutral-600 outline-none transition-all"
                disabled={isSubmitting || licenseManager.isLicensed}
                onkeydown={(e) => { if (e.key === 'Enter') handleActivate(); }}
              />
            </div>

            <button 
              type="button"
              onclick={handleActivate}
              disabled={isSubmitting || !inputLicensee.trim() || !inputKey.trim() || licenseManager.isLicensed}
              class="w-full mt-1 py-2.5 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-semibold rounded-xl shadow-md shadow-cyan-500/20 transition-all cursor-pointer flex items-center justify-center gap-1.5"
            >
              {#if isSubmitting}
                <Loader2 class="w-3.5 h-3.5 animate-spin" />
                <span>Memvalidasi Tanda Tangan Kriptografi...</span>
              {:else if licenseManager.isLicensed}
                <Check class="w-3.5 h-3.5 text-emerald-300" />
                <span>Teraktivasi (PRO)</span>
              {:else}
                <Sparkles class="w-3.5 h-3.5" />
                <span>Aktivasi Sekarang</span>
              {/if}
            </button>
          </div>
        </div>

        <!-- Pembayaran Mandiri & Kontak Box -->
        {#if !licenseManager.isLicensed}
          <div class="bg-gradient-to-br from-neutral-950 to-neutral-900 border border-neutral-800 rounded-xl p-4 space-y-3">
            <div class="flex items-center gap-2 text-xs font-semibold text-neutral-200">
              <CreditCard class="w-4 h-4 text-amber-400" />
              <span>Beli Lisensi / Hubungi Developer:</span>
            </div>
            
            <div class="bg-neutral-900/90 border border-neutral-800/80 rounded-lg p-3 flex items-center justify-between">
              <div class="space-y-0.5">
                <div class="text-[10px] text-neutral-400 uppercase tracking-wider">Bank Mandiri</div>
                <div class="text-sm font-bold font-mono text-neutral-100 tracking-wider">
                  1540015755162
                </div>
                <div class="text-xs text-amber-400 font-medium">a.n nurdiyanto</div>
              </div>
              <button 
                type="button"
                onclick={() => copyToClipboard('1540015755162', 'rekening')}
                class="px-2.5 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-[11px] rounded-lg border border-neutral-700 flex items-center gap-1 transition-colors cursor-pointer"
              >
                {#if copiedRekening}
                  <Check class="w-3 h-3 text-emerald-400" />
                  <span class="text-emerald-400">Tersalin</span>
                {:else}
                  <Copy class="w-3 h-3 text-neutral-400" />
                  <span>Salin Rekening</span>
                {/if}
              </button>
            </div>

            <!-- Telegram Contact Box -->
            <div class="bg-cyan-950/40 border border-cyan-800/60 rounded-lg p-3 flex items-center justify-between">
              <div class="flex items-center gap-2.5">
                <div class="w-8 h-8 rounded-lg bg-cyan-500/20 text-cyan-400 flex items-center justify-center">
                  <Send class="w-4 h-4" />
                </div>
                <div class="space-y-0.5">
                  <div class="text-[10px] text-cyan-400 uppercase font-semibold tracking-wider">Konfirmasi Pembelian / Giveaway</div>
                  <div class="text-xs font-bold text-neutral-100">Telegram: <span class="text-cyan-300 font-mono">@nurdiyantodyas</span></div>
                </div>
              </div>
              <div class="flex items-center gap-1.5">
                <button 
                  type="button"
                  onclick={() => copyToClipboard('@nurdiyantodyas', 'telegram')}
                  class="px-2 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-[10px] rounded-lg border border-neutral-700 flex items-center gap-1 transition-colors cursor-pointer"
                  title="Salin username Telegram"
                >
                  {#if copiedTelegram}
                    <Check class="w-3 h-3 text-emerald-400" />
                    <span class="text-emerald-400">Tersalin</span>
                  {:else}
                    <Copy class="w-3 h-3 text-neutral-400" />
                    <span>Salin</span>
                  {/if}
                </button>
                <button 
                  type="button"
                  onclick={openTelegramUrl}
                  class="px-2.5 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white text-[10px] font-semibold rounded-lg flex items-center gap-1 transition-colors cursor-pointer"
                >
                  <span>Buka</span>
                  <ExternalLink class="w-2.5 h-2.5" />
                </button>
              </div>
            </div>

            <div class="text-[11px] text-neutral-400 leading-relaxed space-y-1">
              <p>1. Lakukan transfer pembayaran ke rekening Mandiri.</p>
              <p>2. Konfirmasi ke Telegram dengan mengirimkan bukti transfer & nama/email Anda.</p>
              <p>3. Anda akan langsung menerima Serial Key resmi tanpa perlu repot mencocokkan HWID.</p>
            </div>
          </div>
        {/if}

      </div>

      <!-- Footer (Fixed) -->
      <div class="p-3.5 sm:p-4 bg-neutral-950/80 border-t border-neutral-800 flex items-center justify-between text-[11px] text-neutral-500 shrink-0">
        <span class="truncate">Lisensi Permanen (Lifetime) & Bebas Watermark</span>
        <button 
          type="button"
          onclick={close}
          class="px-3.5 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 font-medium transition-colors cursor-pointer ml-2 shrink-0"
        >
          Tutup
        </button>
      </div>

    </div>
  </div>
{/if}
