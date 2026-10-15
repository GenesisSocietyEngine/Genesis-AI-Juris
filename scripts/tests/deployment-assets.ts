import { createHash } from "node:crypto";
import { lstatSync, readFileSync, realpathSync } from "node:fs";
import { extname, isAbsolute, relative, resolve, sep } from "node:path";
import { buildReleaseIdentity } from "../../build/release-identity";

export type DeploymentAsset = { path: string; bytes: number; sha256: string; mime: string };
const mimeTypes: Record<string, string[]> = { ".js": ["text/javascript", "application/javascript"], ".css": ["text/css"], ".wasm": ["application/wasm"] };
export function deploymentOrigin(value: string) {
  let url: URL;
  try { url = new URL(value); } catch { throw new Error("Use a valid deployment origin"); }
  const local = url.protocol === "http:" && ["127.0.0.1", "localhost", "[::1]"].includes(url.hostname);
  if ((!local && url.protocol !== "https:") || url.username || url.password || url.search || url.hash || url.pathname !== "/") throw new Error("Use an HTTPS origin without credentials, query or path; HTTP is allowed only for local verification.");
  return url.origin;
}
function assetPath(value: unknown): asserts value is string {
  if (typeof value !== "string" || !value.startsWith("_next/static/") || !/^[A-Za-z0-9_./~@+-]+$/.test(value) || value.split("/").some(part => !part || part === "." || part === "..")) throw new Error("Invalid or external deployment asset path");
}
/** Verify local inventory without discovering URLs from a remote page. */
export function inventoryDeploymentAssets(clientRoot: string, manifest: unknown): DeploymentAsset[] {
  if (!manifest || typeof manifest !== "object" || Array.isArray(manifest)) throw new Error("Missing build asset manifest");
  const paths = new Set<string>();
  for (const item of Object.values(manifest)) {
    if (!item || typeof item !== "object" || Array.isArray(item)) throw new Error("Malformed build asset entry");
    const row = item as Record<string, unknown>;
    for (const list of [row.css, row.assets]) if (list !== undefined && !Array.isArray(list)) throw new Error("Malformed build asset list");
    for (const path of [row.file, ...(row.css as unknown[] ?? []), ...(row.assets as unknown[] ?? [])]) { assetPath(path); paths.add(path); }
  }
  if (!paths.size) throw new Error("Empty build asset manifest");
  if (lstatSync(clientRoot).isSymbolicLink()) throw new Error("Deployment client root cannot be a symlink");
  const root = realpathSync(clientRoot);
  return [...paths].sort().map(path => {
    let file = root;
    for (const part of path.split("/")) { file = resolve(file, part); if (lstatSync(file).isSymbolicLink()) throw new Error("Deployment assets cannot contain symlinks"); }
    const rel = relative(root, realpathSync(file));
    if (rel === ".." || rel.startsWith(".." + sep) || isAbsolute(rel) || !lstatSync(file).isFile()) throw new Error("Deployment asset escaped client root");
    const mime = mimeTypes[extname(path)];
    if (!mime) throw new Error("Unreviewed deployment asset type");
    const content = readFileSync(file);
    if (!content.length) throw new Error("Empty deployment asset");
    return { path: "/" + path, bytes: content.length, sha256: createHash("sha256").update(content).digest("hex"), mime: mime[0] };
  });
}
export function deploymentBuild(root: string, expectedCommit: string) {
  if (!/^[a-f0-9]{40}$/.test(expectedCommit)) throw new Error("Expected exact lowercase source commit");
  const built = JSON.parse(readFileSync(resolve(root, "dist/.openai/release-provenance.json"), "utf8"));
  const current = buildReleaseIdentity(root);
  if (built.schema !== current.schema || built.inputPolicy !== current.inputPolicy || built.sourceCommit !== expectedCommit || current.sourceCommit !== expectedCommit || built.applicationInputsSha256 !== current.applicationInputsSha256 || built.hostingConfigSha256 !== current.hostingConfigSha256) throw new Error("Build, checkout and expected release identities differ; rebuild exact source");
  const manifest = JSON.parse(readFileSync(resolve(root, "dist/client/.vite/manifest.json"), "utf8"));
  return { sourceCommit: expectedCommit, applicationInputsSha256: built.applicationInputsSha256 as string, hostingConfigSha256: built.hostingConfigSha256 as string, assets: inventoryDeploymentAssets(resolve(root, "dist/client"), manifest) };
}
export type AssetResult = DeploymentAsset & { status: number | null; verified: boolean; reason: string; receivedBytes: number; receivedSha256?: string };
/** Static HTTP acceptance only: no cookies, application APIs, browser or writes. */
export async function verifyDeploymentAssets(origin: string, assets: DeploymentAsset[], options: { fetcher?: typeof fetch; concurrency?: number; timeoutMs?: number } = {}) {
  const base = deploymentOrigin(origin), fetcher = options.fetcher ?? fetch;
  const concurrency = options.concurrency ?? 6, timeoutMs = options.timeoutMs ?? 15000;
  if (!assets.length || !Number.isSafeInteger(concurrency) || concurrency < 1 || concurrency > 8 || !Number.isSafeInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 30000) throw new Error("Invalid static verification bounds");
  // Validate the complete inventory before making even one request.
  for (const asset of assets) { if (!asset.path.startsWith("/_next/static/")) throw new Error("Invalid deployment request path"); assetPath(asset.path.slice(1)); if (!Number.isSafeInteger(asset.bytes) || asset.bytes < 1 || !/^[a-f0-9]{64}$/.test(asset.sha256) || mimeTypes[extname(asset.path)]?.[0] !== asset.mime) throw new Error("Invalid expected asset identity"); }
  const results: AssetResult[] = new Array(assets.length); let next = 0;
  async function check(asset: DeploymentAsset): Promise<AssetResult> {
    const result: AssetResult = { ...asset, status: null, verified: false, reason: "request_failed", receivedBytes: 0 };
    try {
      const response = await fetcher(base + asset.path, { method: "GET", redirect: "manual", credentials: "omit", signal: AbortSignal.timeout(timeoutMs) });
      result.status = response.status;
      const reject = async (reason: string) => { result.reason = reason; await response.body?.cancel(); return result; };
      if (response.status !== 200) return await reject("http_status");
      const contentType = (response.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase();
      if (!(mimeTypes[extname(asset.path)] ?? []).includes(contentType)) return await reject("content_type");
      if (!response.body) return await reject("missing_body");
      const reader = response.body.getReader(), digest = createHash("sha256");
      while (true) {
        const part = await reader.read(); if (part.done) break;
        result.receivedBytes += part.value.byteLength;
        if (result.receivedBytes > asset.bytes) { result.reason = "body_too_large"; await reader.cancel(); return result; }
        digest.update(part.value);
      }
      result.receivedSha256 = digest.digest("hex");
      result.verified = result.receivedBytes === asset.bytes && result.receivedSha256 === asset.sha256;
      result.reason = result.verified ? "exact_bytes" : "content_mismatch";
    } catch (error) { result.reason = error instanceof Error && ["TimeoutError", "AbortError"].includes(error.name) ? "timeout" : "request_failed"; }
    return result;
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, assets.length) }, async () => { while (next < assets.length) { const index = next++; results[index] = await check(assets[index]); } }));
  return { format: "casevant-deployment-static-acceptance", version: 1, origin: base, verifiedAt: new Date().toISOString(), passed: results.every(result => result.verified), assetCount: results.length, verifiedCount: results.filter(result => result.verified).length, deployedSourceVerified: false, browserHydrationVerified: false, authenticatedWorkflowsVerified: false, assets: results };
}
