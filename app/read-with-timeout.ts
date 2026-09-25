/** Bound read-only requests, including response-body delivery. Never replay writes. */
export class ReadTimeoutError extends Error {
  constructor() { super("The read request timed out."); this.name = "ReadTimeoutError"; }
}

export async function readWithTimeout<T>(read: (signal: AbortSignal) => Promise<T>, options: { signal?: AbortSignal; timeoutMs?: number } = {}): Promise<T> {
  const controller = new AbortController();
  let rejectAbort: (reason: unknown) => void = () => {};
  const aborted = new Promise<never>((_, reject) => { rejectAbort = reject; });
  const cancel = () => {
    const reason = options.signal?.reason ?? new DOMException("Read cancelled", "AbortError");
    controller.abort(reason); rejectAbort(reason);
  };
  const timer = setTimeout(() => {
    const error = new ReadTimeoutError();
    controller.abort(error); rejectAbort(error);
  }, options.timeoutMs ?? 15000);
  options.signal?.addEventListener("abort", cancel, { once: true });
  try {
    options.signal?.throwIfAborted();
    return await Promise.race([read(controller.signal), aborted]);
  } finally {
    clearTimeout(timer);
    options.signal?.removeEventListener("abort", cancel);
  }
}
