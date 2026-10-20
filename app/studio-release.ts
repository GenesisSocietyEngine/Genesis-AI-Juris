import { packagedBuildIdentity, type BuildIdentity } from "./release-provenance";

export type StudioRelease = BuildIdentity & { schema: "casevant.studio-release.v1" };
export function readStudioRelease(value: unknown): StudioRelease | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const item = value as Record<string, unknown>;
  if (Object.keys(item).length !== 4 || item.schema !== "casevant.studio-release.v1"
    || typeof item.sourceCommit !== "string" || !/^[a-f0-9]{40}$/.test(item.sourceCommit)
    || typeof item.applicationInputsSha256 !== "string" || !/^[a-f0-9]{64}$/.test(item.applicationInputsSha256)
    || typeof item.hostingConfigSha256 !== "string" || !/^[a-f0-9]{64}$/.test(item.hostingConfigSha256)) return null;
  return { schema: item.schema, sourceCommit: item.sourceCommit, applicationInputsSha256: item.applicationInputsSha256, hostingConfigSha256: item.hostingConfigSha256 };
}
export function studioRelease(build = packagedBuildIdentity()): StudioRelease | null {
  return build ? readStudioRelease({ schema: "casevant.studio-release.v1", sourceCommit: build.sourceCommit, applicationInputsSha256: build.applicationInputsSha256, hostingConfigSha256: build.hostingConfigSha256 }) : null;
}
export function studioReleaseKey(value: StudioRelease): string {
  return value.applicationInputsSha256 + ":" + value.hostingConfigSha256;
}

/** Public build metadata only. No case/account data, credentials or redirects. */
export async function fetchStudioRelease(signal: AbortSignal): Promise<StudioRelease | null> {
  const response = await fetch("/api/studio-release", { signal, credentials: "omit", cache: "no-store", redirect: "error", headers: { Accept: "application/json" } });
  if (!response.ok || !response.headers.get("content-type")?.includes("application/json")) { await response.body?.cancel(); return null; }
  const size = response.headers.get("content-length");
  if (size !== null && (!/^\d+$/.test(size) || Number(size) > 1024)) { await response.body?.cancel(); return null; }
  // Bound bytes while reading, including responses without Content-Length.
  const reader = response.body?.getReader();
  if (!reader) return null;
  let bytes = 0; const chunks: Uint8Array[] = [];
  try {
    while (true) {
      const part = await reader.read();
      if (part.done) break;
      bytes += part.value.byteLength;
      if (bytes > 1024) { await reader.cancel(); return null; }
      chunks.push(part.value);
    }
    const body = new Uint8Array(bytes); let offset = 0;
    for (const chunk of chunks) { body.set(chunk, offset); offset += chunk.length; }
    return readStudioRelease(JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(body)));
  } catch { return null; }
  finally { reader.releaseLock(); }
}
