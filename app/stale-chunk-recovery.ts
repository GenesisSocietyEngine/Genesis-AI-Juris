const RECOVERY_KEY = "genesis-juris-stale-chunk-recovery:v1";
const RECOVERY_WINDOW_MS = 5 * 60 * 1000;

export function isStaleChunkError(value: unknown) {
  const message = value instanceof Error ? `${value.name} ${value.message}` : typeof value === "string" ? value : "";
  return /ChunkLoadError|Loading chunk|Failed to fetch dynamically imported module|Importing a module script failed|vite:preloadError/i.test(message);
}

export function recoverFromStaleChunk(storage: Pick<Storage, "getItem" | "setItem" | "removeItem">, reload: () => void, value: unknown, now = Date.now()) {
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
