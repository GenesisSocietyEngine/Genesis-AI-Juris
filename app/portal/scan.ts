/** Private EU service binding. The gateway scans these bytes with local clamd. */
export type ScanService = Pick<Fetcher, "fetch">;

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
