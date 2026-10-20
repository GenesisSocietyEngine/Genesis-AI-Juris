import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { posix, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { build, version as esbuildVersion } from "esbuild";

const entry = `export { readStudioAggregate } from './app/studio-aggregate';
export { readStudioDeviceDraft, writeStudioDeviceDraft } from './app/studio-device-storage';
export { snapshotStudioDraft, applyStudioSnapshot } from './app/studio-revisions';`;
const sha256 = (value: string | Uint8Array) => createHash("sha256").update(value).digest("hex");

/** Execute reviewed historical data modules directly from immutable Git blobs.
 * Never resolve relative imports against the current working tree. This is not
 * an old browser/Worker build and never reads browser storage or credentials. */
export async function buildPinnedStudioReader(root: string, commit: string, outputDirectory: string) {
  if (!/^[a-f0-9]{40}$/.test(commit)) throw new Error("An exact full Git commit is required");
  const git = (...args: string[]) => execFileSync("git", ["-C", root, ...args], { stdio: ["ignore", "pipe", "ignore"] });
  if (git("rev-parse", `${commit}^{commit}`).toString().trim() !== commit) throw new Error("Historical commit is unavailable");
  const files = new Map<string, Buffer>();
  function blob(path: string) {
    if (!files.has(path)) files.set(path, git("cat-file", "blob", `${commit}:${path}`));
    return files.get(path)!;
  }
  const result = await build({ stdin: { contents: entry, resolveDir: root, loader: "ts" }, bundle: true, write: false,
    platform: "node", format: "esm", packages: "external", logLevel: "silent", metafile: true,
    plugins: [{ name: "immutable-studio-source", setup(builder) {
      builder.onResolve({ filter: /^\./ }, args => {
        if (args.namespace !== "pinned-git" && args.importer !== "<stdin>") return;
        const base = args.namespace === "pinned-git" ? posix.dirname(args.importer) : ".";
        const path = posix.normalize(posix.join(base, args.path));
        if (path.startsWith("../") || path.startsWith("/") || path.includes(":")) throw new Error("Historical import escaped repository");
        for (const candidate of [path, path + ".ts", path + ".tsx", path + ".json", path + "/index.ts"]) {
          try { blob(candidate); return { path: candidate, namespace: "pinned-git" }; } catch { /* Try exact supported source extensions, never current files. */ }
        }
        throw new Error(`Missing historical module ${commit}:${path}`);
      });
      builder.onLoad({ filter: /.*/, namespace: "pinned-git" }, args => ({ contents: blob(args.path),
        loader: args.path.endsWith(".json") ? "json" : args.path.endsWith(".tsx") ? "tsx" : "ts", resolveDir: root }));
    } }],
  });
  const externalImports = [...new Set(Object.values(result.metafile.outputs).flatMap(value => value.imports.filter(item=>item.external).map(item=>item.path)))].sort();
  if (externalImports.some(path=>!path.startsWith("node:"))) throw new Error("Historical runtime package requires its own dependency-pinned execution environment");
  const modules = [...files].map(([path, bytes]) => ({ path, bytes: bytes.length, sha256: sha256(bytes) })).sort((a,b)=>a.path.localeCompare(b.path,"en"));
  const bytes = result.outputFiles[0].contents;
  mkdirSync(outputDirectory, { recursive: true });
  const output = resolve(outputDirectory, `${commit}.mjs`); writeFileSync(output, bytes);
  const api = await import(pathToFileURL(output).href + "?sha256=" + sha256(bytes));
  return { api, provenance: { commit, esbuildVersion, moduleSetSha256: sha256(JSON.stringify(modules)), bundleSha256: sha256(bytes), modules, externalImports,
    boundary: "pinned-original-data-modules; not historical browser, Worker, auth or server acceptance" } };
}
