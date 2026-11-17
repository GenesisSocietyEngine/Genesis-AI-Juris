/** Private EU service binding. The gateway scans these bytes with local clamd. */
export type ScanService = Pick<Fetcher, "fetch">;
type ScannerBindings = {
  EU_PORTAL_CLAMAV?: ScanService;
  PORTAL_SCANNER_ORIGIN?: string;
  PORTAL_SCANNER_CLIENT_ID?: string;
  PORTAL_SCANNER_CLIENT_SECRET?: string;
  PORTAL_SCANNER_REQUIRED?: string;
};

export function configuredScanner(bindings: ScannerBindings): ScanService | undefined {
  if (bindings.EU_PORTAL_CLAMAV) return bindings.EU_PORTAL_CLAMAV;
  const { PORTAL_SCANNER_ORIGIN: origin, PORTAL_SCANNER_CLIENT_ID: id, PORTAL_SCANNER_CLIENT_SECRET: secret } = bindings;
  if (!origin && !id && !secret && !bindings.PORTAL_SCANNER_REQUIRED) return;
  return {
    async fetch(_input, init) {
      if (!origin || !id || !secret) throw Error("Incomplete private scanner configuration");
      const url = new URL(origin);
      if (url.protocol !== "https:" || url.origin !== origin) throw Error("Invalid scanner origin");
      const headers = new Headers(init?.headers);
      headers.set("CF-Access-Client-Id", id);
      headers.set("CF-Access-Client-Secret", secret);
      return fetch(new URL("/scan", url), { ...init, headers, redirect: "error" });
    },
  };
}

export async function scanPortalBytes(service: ScanService, bytes: Uint8Array<ArrayBuffer>, digest: string) {
  try {
    const response = await service.fetch("https://scanner.internal/scan", {
      method: "POST",
      body: bytes,
      headers: { "Content-Type": "application/octet-stream" },
      redirect: "error",
      signal: AbortSignal.timeout(15000),
    });
    if (response.status !== 200) return "unavailable";
    const result = await response.json<{ digest?: string; verdict?: string }>();
    if (result?.digest === digest && (result.verdict === "clean" || result.verdict === "infected"))
      return result.verdict;
  } catch {
    // Transport failures and incomplete verdicts leave the upload private.
  }
  return "unavailable";
}
