/** A same-origin invalidation signal, never an authentication credential or grant. */
export type SessionBoundary = "suspend" | "revoke";
export const SESSION_BOUNDARY_KEY = "genesis-juris-session-boundary-v1";
const localEvent = "genesis-juris-session-boundary";

function boundary(value: unknown): SessionBoundary | null {
  if (!value || typeof value !== "object") return null;
  const message = value as { version?: unknown; phase?: unknown; nonce?: unknown };
  return message.version === 1 && typeof message.nonce === "string" && message.nonce.length < 128
    && (message.phase === "suspend" || message.phase === "revoke") ? message.phase : null;
}

export function publishSessionBoundary(phase: SessionBoundary) {
  if (typeof window === "undefined") return;
  const message = { version: 1, phase, nonce: `${Date.now()}-${Math.random()}` };
  window.dispatchEvent(new CustomEvent(localEvent, { detail: message }));
  // Other already-open tabs receive this even while they remain active.
  // The key contains no identity, case content, token or authorization result.
  try { window.localStorage.setItem(SESSION_BOUNDARY_KEY, JSON.stringify(message)); }
  catch { /* Per-operation server checks remain mandatory if storage is unavailable. */ }
}

export function subscribeSessionBoundary(listener: (phase: SessionBoundary) => void) {
  if (typeof window === "undefined") return () => {};
  const local = (event: Event) => { const phase = boundary((event as CustomEvent).detail); if (phase) listener(phase); };
  const storage = (event: StorageEvent) => {
    if (event.key !== SESSION_BOUNDARY_KEY || !event.newValue) return;
    try { const phase = boundary(JSON.parse(event.newValue)); if (phase) listener(phase); } catch { /* Not an authority signal. */ }
  };
  window.addEventListener(localEvent, local);
  window.addEventListener("storage", storage);
  return () => { window.removeEventListener(localEvent, local); window.removeEventListener("storage", storage); };
}
