import { createHash } from "node:crypto";
import { Buffer } from "node:buffer";
import { execFileSync } from "node:child_process";
import { lstatSync, readFileSync, readdirSync, realpathSync } from "node:fs";
import { join, resolve } from "node:path";

// Versioned input policy, independent of Git availability. Evidence and test
// output are deliberately excluded. This is a source digest, not a bundle hash.
export const RELEASE_INPUTS = [
  "app", "worker", "build", "db", "public", "drizzle", "scripts/build-verified.sh", "scripts/sites-env.sh",
  "package.json", "package-lock.json", "vite.config.ts", "next.config.ts",
  "postcss.config.mjs", "tsconfig.json", ".node-version", ".npm-version", ".npmrc", ".gitattributes",
] as const;

export function buildReleaseIdentity(root: string, inputs: readonly string[] = RELEASE_INPUTS) {
  const files: Array<{ path: string; bytes: number; sha256: string }> = [];
  const blobs = new Map<string, string>();
  const gitBlob = (bytes: Buffer) => createHash("sha1").update(`blob ${bytes.length}\0`).update(bytes).digest("hex");
  function visit(path: string) {
    const absolute = join(root, path);
    const stat = lstatSync(absolute);
    if (stat.isSymbolicLink()) throw new Error(`Release input must not be a symbolic link: ${path}`);
    if (stat.isDirectory()) {
      for (const entry of readdirSync(absolute).sort()) visit(`${path}/${entry}`);
    } else if (stat.isFile()) {
      const bytes = readFileSync(absolute);
      blobs.set(path, gitBlob(bytes));
      files.push({ path, bytes: bytes.length, sha256: createHash("sha256").update(bytes).digest("hex") });
    } else throw new Error(`Unsupported release input: ${path}`);
  }
  for (const input of inputs) visit(input);
  if (lstatSync(join(root, ".openai")).isSymbolicLink() || lstatSync(join(root, ".openai/hosting.json")).isSymbolicLink()) {
    throw new Error("Hosting release input must not be a symbolic link");
  }
  const hostingBytes = readFileSync(join(root, ".openai/hosting.json"));
  blobs.set(".openai/hosting.json", gitBlob(hostingBytes));
  const { project_id: _projectId, ...hostingBindings } = JSON.parse(new TextDecoder().decode(hostingBytes));
  // Project identity is packaged separately: changing the target must not
  // masquerade as an application change, and still has an exact config hash.
  function canonical(value: unknown): unknown {
    if (Array.isArray(value)) return value.map(canonical);
    if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([key, item]) => [key, canonical(item)]));
    return value;
  }
  const canonicalHosting = Buffer.from(JSON.stringify(canonical(hostingBindings)));
  files.push({ path: ".openai/hosting.json:without-project-id", bytes: canonicalHosting.length,
    sha256: createHash("sha256").update(canonicalHosting).digest("hex") });
  files.sort((a, b) => a.path < b.path ? -1 : a.path > b.path ? 1 : 0);
  let sourceCommit = "unknown";
  try {
    const git = (...args: string[]) => execFileSync("git", ["-C", root, ...args], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
    const entries = git("ls-tree", "-rz", "HEAD", "--", ...inputs, ".openai/hosting.json").split("\0").filter(Boolean);
    const exact = entries.length === blobs.size && entries.every(entry => {
      const [metadata, path] = entry.split("\t");
      const [mode, type, oid] = metadata.split(" ");
      return ["100644", "100755"].includes(mode) && type === "blob" && blobs.get(path) === oid;
    });
    if (realpathSync(git("rev-parse", "--show-toplevel")) === realpathSync(resolve(root)) && exact) {
      const commit = git("rev-parse", "HEAD");
      if (/^[a-f0-9]{40}$/.test(commit)) sourceCommit = commit;
    }
  } catch { /* Source archives have a digest even when Git is unavailable. */ }
  return {
    schema: "genesis.juris.build-identity.v1" as const,
    inputPolicy: "web-source-v1" as const,
    applicationInputsSha256: createHash("sha256").update(JSON.stringify(files)).digest("hex"),
    hostingConfigSha256: createHash("sha256").update(hostingBytes).digest("hex"),
    sourceCommit,
    nodeVersion: process.version,
    files,
  };
}
