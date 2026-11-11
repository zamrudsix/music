/**
 * Platform Detection Helper
 * Safely identifies whether the application is running inside a native desktop wrapper (Tauri)
 * or inside a standard web browser (Chrome, Safari, Edge, Firefox).
 */

export const isDesktop = (): boolean => {
  if (typeof window === 'undefined') return false;
  return Boolean((window as any).isTauri || (window as any).__TAURI_INTERNALS__);
};

export const isWindows = (): boolean => {
  if (typeof navigator === 'undefined') return false;
  return /Windows|Win32|Win64/i.test(navigator.userAgent || '');
};

export const setWindowTitle = async (title: string): Promise<void> => {
  if (isDesktop()) {
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      await invoke('set_window_title', { title });
      return;
    } catch {}
  }
  if (typeof document !== 'undefined') {
    document.title = title;
  }
};

export const minimizeWindow = async (): Promise<void> => {
  if (isDesktop()) {
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      await invoke('minimize_window');
    } catch (e) {
      console.warn('Failed to minimize window:', e);
    }
  }
};

export const unminimizeWindow = async (): Promise<void> => {
  if (isDesktop()) {
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      await invoke('unminimize_window');
    } catch (e) {
      console.warn('Failed to unminimize window:', e);
    }
  }
};
