/**
 * Clean up Origin Private File System (OPFS) temporary render files.
 * Prevents hidden gigabyte cache accumulation in Drive C (Windows AppData WebView2 / macOS cache).
 */
export async function sweepOpfsTempFiles(): Promise<number> {
  let cleanedCount = 0;
  try {
    if (typeof navigator !== 'undefined' && navigator.storage && typeof navigator.storage.getDirectory === 'function') {
      const root = await navigator.storage.getDirectory();
      // Iterate over entries and delete all temporary render files
      const asyncIterator = (root as any).entries?.bind(root) || (root as any).values?.bind(root) || (root as any)[Symbol.asyncIterator]?.bind(root);
      if (typeof asyncIterator === 'function') {
        // @ts-ignore
        for await (const entry of asyncIterator()) {
          const name = Array.isArray(entry) ? entry[0] : (entry?.name || '');
          if (typeof name === 'string' && name.startsWith('render_') && name.endsWith('.mp4')) {
            try {
              await root.removeEntry(name);
              cleanedCount++;
            } catch (delErr) {
              // Might be locked; ignore
            }
          }
        }
      }
    }
  } catch (err) {
    console.warn('[Storage] OPFS sweep warning:', err);
  }
  return cleanedCount;
}
