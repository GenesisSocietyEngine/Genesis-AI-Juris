const RECOVERY_KEY = "genesis-juris-stale-chunk-recovery:v1";
const RECOVERY_WINDOW_MS = 5 * 60 * 1000;
let localRecoveryCount = 0;

/** An awaited optional feature owns its failure. A global refresh here would
 * discard the open editor before that feature's catch can show recovery. */
export async function withLocalChunkRecovery<T>(load: () => Promise<T>): Promise<T> {
  localRecoveryCount += 1;
  try { return await load(); }
  finally { localRecoveryCount -= 1; }
}

export function hasLocalChunkRecovery() { return localRecoveryCount > 0; }

export function isStaleChunkError(value: unknown) {
  const message = value instanceof Error ? `${value.name} ${value.message}` : typeof value === "string" ? value : "";
  return /ChunkLoadError|Loading chunk|Failed to fetch dynamically imported module|Importing a module script failed|Unable to preload CSS|vite:preloadError/i.test(message);
}

export function recoverFromStaleChunk(storage: Pick<Storage, "getItem" | "setItem" | "removeItem">, reload: () => void, value: unknown, now = Date.now()) {
  if (hasLocalChunkRecovery()) return false;
  if (!isStaleChunkError(value)) return false;
  const previous = Number(storage.getItem(RECOVERY_KEY) ?? 0);
  if (Number.isFinite(previous) && previous > 0 && now - previous < RECOVERY_WINDOW_MS) {
    storage.removeItem(RECOVERY_KEY);
    return false;
  }
  storage.setItem(RECOVERY_KEY, String(now));
  reload();
  return true;
}

export function clearStaleChunkRecovery(storage: Pick<Storage, "removeItem">) {
  storage.removeItem(RECOVERY_KEY);
}
