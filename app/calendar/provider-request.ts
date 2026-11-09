/** workerd accepts manual/follow, not redirect:error. Keep tokens on the original origin.
 * Callers must treat every non-2xx response, including a redirect, as unsuccessful. */
export function providerRequest(transport: typeof fetch, url: string, init: RequestInit, timeout: number) {
  return transport(url, { ...init, redirect: "manual", signal: AbortSignal.timeout(timeout) });
}
