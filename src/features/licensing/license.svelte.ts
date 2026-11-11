import { isDesktop } from '../../lib/utils/platform';

export interface LicenseInfo {
  is_licensed: boolean;
  licensee: string | null;
  license_key: string | null;
  free_quota_remaining?: number;
  hwid?: string;
}

export class LicenseManager {
  public isLicensed = $state<boolean>(false);
  public licensee = $state<string | null>(null);
  public licenseKey = $state<string | null>(null);
  public hwid = $state<string>('');
  public freeQuotaRemaining = $state<number>(3);
  public isLoading = $state<boolean>(true);
  public errorMessage = $state<string | null>(null);
  public workerApiUrl = $state<string>('https://beras-license-server.beras-license-server.workers.dev');

  constructor() {
    this.init();
  }

  get isWatermarkFree(): boolean {
    return this.isLicensed || this.freeQuotaRemaining > 0;
  }

  async init() {
    this.isLoading = true;
    this.errorMessage = null;

    if (isDesktop()) {
      try {
        const { invoke } = await import('@tauri-apps/api/core');
        const info = await invoke<LicenseInfo>('get_license_info');
        this.isLicensed = info.is_licensed;
        this.licensee = info.licensee;
        this.licenseKey = info.license_key;
        this.hwid = info.hwid || '';
        this.freeQuotaRemaining = typeof info.free_quota_remaining === 'number' ? info.free_quota_remaining : 3;

        if (this.isLicensed && this.licensee) {
          this.sendHeartbeat();
        }
      } catch (err: any) {
        console.warn('Failed to get native license info:', err);
        this.fallbackWebInit();
      }
    } else {
      this.fallbackWebInit();
    }
    this.isLoading = false;
  }

  private fallbackWebInit() {
    const savedLicensee = localStorage.getItem('beras_web_licensee');
    const savedKey = localStorage.getItem('beras_web_license');
    if (savedLicensee && savedKey) {
      this.licensee = savedLicensee;
      this.licenseKey = savedKey;
      this.isLicensed = true;
    } else {
      this.isLicensed = false;
      this.licensee = null;
      this.licenseKey = null;
    }

    const savedQuota = localStorage.getItem('beras_web_free_quota');
    if (savedQuota !== null) {
      const parsed = parseInt(savedQuota, 10);
      this.freeQuotaRemaining = isNaN(parsed) ? 3 : parsed;
    } else {
      this.freeQuotaRemaining = 3;
      localStorage.setItem('beras_web_free_quota', '3');
    }
  }

  async consumeFreeQuota(): Promise<number> {
    if (this.isLicensed) return this.freeQuotaRemaining;

    if (isDesktop()) {
      try {
        const { invoke } = await import('@tauri-apps/api/core');
        const info = await invoke<LicenseInfo>('consume_free_export_quota');
        this.freeQuotaRemaining = typeof info.free_quota_remaining === 'number' ? info.free_quota_remaining : 0;
        return this.freeQuotaRemaining;
      } catch (err) {
        console.warn('Failed to consume native quota, using local fallback:', err);
      }
    }

    // Local fallback
    this.freeQuotaRemaining = Math.max(0, this.freeQuotaRemaining - 1);
    localStorage.setItem('beras_web_free_quota', this.freeQuotaRemaining.toString());
    return this.freeQuotaRemaining;
  }

  async activate(licensee: string, key: string): Promise<boolean> {
    this.errorMessage = null;
    const cleanId = licensee.trim();
    const cleanKey = key.trim();

    if (!cleanId) {
      this.errorMessage = 'Email / Username wajib diisi.';
      return false;
    }

    if (!cleanKey.startsWith('PRO-')) {
      this.errorMessage = 'Format Serial Key salah. Harus berawalan PRO-...';
      return false;
    }

    if (isDesktop()) {
      try {
        const { invoke } = await import('@tauri-apps/api/core');
        const info = await invoke<LicenseInfo>('activate_license', { 
          licensee: cleanId, 
          key: cleanKey 
        });
        this.isLicensed = info.is_licensed;
        this.licensee = info.licensee;
        this.licenseKey = info.license_key;
        if (typeof info.free_quota_remaining === 'number') {
          this.freeQuotaRemaining = info.free_quota_remaining;
        }

        // Silent single-device lock via Cloudflare Worker (jika url telah diset)
        this.syncWithCloud(cleanId, cleanKey, info.hwid || this.hwid);

        return true;
      } catch (err: any) {
        this.errorMessage = typeof err === 'string' ? err : (err.message || 'Gagal aktivasi lisensi.');
        return false;
      }
    } else {
      // Browser preview mode
      localStorage.setItem('beras_web_licensee', cleanId);
      localStorage.setItem('beras_web_license', cleanKey);
      this.isLicensed = true;
      this.licensee = cleanId;
      this.licenseKey = cleanKey;
      return true;
    }
  }

  /**
   * Mengirim sinyal heartbeat ringan ke Cloudflare Worker untuk pelacakan user aktif
   */
  async sendHeartbeat() {
    if (!this.workerApiUrl || !this.licensee) return;
    try {
      await fetch(`${this.workerApiUrl}/api/heartbeat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          licensee: this.licensee,
          hwid: this.hwid,
          version: '3.3.0',
          os: navigator.userAgent.includes('Mac') ? 'macOS' : 'Windows'
        })
      });
    } catch {
      // Silent ignore jika offline
    }
  }

  /**
   * Mendaftarkan binding perangkat ke Cloudflare Worker tanpa user perlu repot
   */
  async syncWithCloud(licensee: string, key: string, hwid: string) {
    if (!this.workerApiUrl) return;
    try {
      await fetch(`${this.workerApiUrl}/api/activate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          licensee,
          license_key: key,
          hwid,
          version: '3.3.0',
          os: navigator.userAgent.includes('Mac') ? 'macOS' : 'Windows'
        })
      });
    } catch {
      // Silent ignore jika offline
    }
  }
}

export const licenseManager = new LicenseManager();
