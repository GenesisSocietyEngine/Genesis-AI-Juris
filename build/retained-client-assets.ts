import { createHash } from "node:crypto";
import { existsSync, lstatSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { inventoryDeploymentAssets, retainedDeploymentAssets } from "./deployment-assets";

function buildMetadata(dist: string, expected: string) {
  if (!/^[a-f0-9]{40}$/.test(expected)) throw new Error("Use an exact source commit");
  const filename = resolve(dist, ".openai/release-provenance.json");
  const hostingPath = resolve(dist, ".openai/hosting.json");
  for (const path of [dist, resolve(dist, ".openai"), filename, hostingPath]) if (lstatSync(path).isSymbolicLink()) throw new Error("Artifact metadata cannot contain symlinks");
  const metadata = JSON.parse(readFileSync(filename, "utf8"));
  if (metadata.schema !== "genesis.juris.build-identity.v1" || metadata.sourceCommit !== expected || !/^[a-f0-9]{64}$/.test(metadata.applicationInputsSha256) || !/^[a-f0-9]{64}$/.test(metadata.hostingConfigSha256)) throw new Error("Previous/current artifact source metadata differs");
  const hostingBytes = readFileSync(hostingPath), hosting = JSON.parse(new TextDecoder().decode(hostingBytes));
  if (createHash("sha256").update(hostingBytes).digest("hex") !== metadata.hostingConfigSha256 || typeof hosting.project_id !== "string" || !hosting.project_id) throw new Error("Artifact hosting identity differs");
  return { ...metadata, projectId: hosting.project_id as string };
}
/** Reversible build-output operation only. No cases, worker modules, fixed URLs or old retention chains. */
export function retainPreviousClientAssets(currentDist: string, previousDist: string, currentCommit: string, previousCommit: string) {
  currentDist = resolve(currentDist); previousDist = resolve(previousDist);
  if (currentDist === previousDist || currentCommit === previousCommit) throw new Error("Previous and current builds must be distinct");
  const current = buildMetadata(currentDist, currentCommit), previous = buildMetadata(previousDist, previousCommit);
  if (current.projectId !== previous.projectId) throw new Error("Previous assets belong to a different Site");
  const filename = resolve(currentDist, ".openai/retained-client-assets.json");
  if (existsSync(filename) && lstatSync(filename).isSymbolicLink()) throw new Error("Retention receipt cannot be a symlink");
  const manifest = (dist: string) => JSON.parse(readFileSync(resolve(dist, "client/.vite/manifest.json"), "utf8"));
  const currentAssets = inventoryDeploymentAssets(resolve(currentDist, "client"), manifest(currentDist));
  const previousAssets = inventoryDeploymentAssets(resolve(previousDist, "client"), manifest(previousDist));
  const currentPaths = new Map(currentAssets.map(asset => [asset.path, asset]));
  const copies: Array<{ destination: string; bytes: Buffer }> = [];
  // Validate and detach all source bytes/collisions before changing any output.
  for (const asset of previousAssets) {
    const oldBytes = readFileSync(resolve(previousDist, "client", asset.path.slice(1)));
    if (createHash("sha256").update(oldBytes).digest("hex") !== asset.sha256) throw new Error("Previous asset changed during preparation");
    const path = asset.path.slice(1), destination = resolve(currentDist, "client", path);
    if (currentPaths.has(asset.path) && currentPaths.get(asset.path)!.sha256 !== asset.sha256) throw new Error("Immutable asset URL collision; rebuild rather than overwriting");
    let parent = resolve(currentDist, "client");
    for (const part of path.split("/")) { parent = resolve(parent, part); if (existsSync(parent) && lstatSync(parent).isSymbolicLink()) throw new Error("Retention destination cannot contain symlinks"); }
    if (existsSync(destination)) {
      if (!lstatSync(destination).isFile() || createHash("sha256").update(readFileSync(destination)).digest("hex") !== asset.sha256) throw new Error("Existing immutable asset bytes cannot be replaced");
    } else copies.push({ destination, bytes: oldBytes });
  }
  const receipt = { format: "casevant-retained-client-assets", version: 1, currentSourceCommit: current.sourceCommit, previousSourceCommit: previous.sourceCommit, previousApplicationInputsSha256: previous.applicationInputsSha256, previousHostingConfigSha256: previous.hostingConfigSha256, policy: "immediately-previous-current-manifest-only", assets: previousAssets };
  for (const copy of copies) { mkdirSync(dirname(copy.destination), { recursive: true }); writeFileSync(copy.destination, copy.bytes, { flag: "wx" }); }
  writeFileSync(filename, JSON.stringify(receipt, null, 2) + "\n");
  retainedDeploymentAssets(currentDist, currentCommit);
  return { currentSourceCommit: currentCommit, previousSourceCommit: previousCommit, previousAssets: previousAssets.length, newlyRetainedAssets: copies.length, receipt: filename };
}
