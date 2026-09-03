import { createHash } from "node:crypto";
import { lstatSync, readFileSync, readlinkSync, realpathSync } from "node:fs";
import { resolve, sep } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

export type WebCheckoutReceipt = {
  format: "genesis-juris-web-checkout-receipt";
  head: string;
  tree: string;
  trackedFileCount: number;
  trackedByteSha256: string;
};

export function verifyWebCheckout(repository: string, expectedHead: string): WebCheckoutReceipt {
  if (!/^[a-f0-9]{40}$/.test(expectedHead)) {
    throw new Error("expected web HEAD must be an exact lowercase 40-character Git SHA");
  }
  const root = realpathSync(resolve(repository));
  const gitRoot = realpathSync(runGit(root, ["rev-parse", "--show-toplevel"]).trim());
  if (gitRoot.toLowerCase() !== root.toLowerCase()) throw new Error("web checkout path is not the exact Git root");

  const head = runGit(root, ["rev-parse", "HEAD"]).trim();
  if (head !== expectedHead) throw new Error(`web HEAD mismatch: expected ${expectedHead}, received ${head}`);

  const status = runGit(root, ["status", "--porcelain=v1", "--untracked-files=all", "--ignore-submodules=none"]);
  if (status.length !== 0) throw new Error(`web checkout contains tracked, staged, or untracked changes:\n${status.trimEnd()}`);

  assertGitSuccess(root, ["diff-files", "--quiet", "--ignore-submodules=none", "--"]);
  assertGitSuccess(root, ["diff-index", "--cached", "--quiet", "HEAD", "--"]);
  const submodules = runGit(root, ["submodule", "status", "--recursive"]);
  if (submodules.split(/\r?\n/u).some((line) => /^[-+U]/u.test(line))) {
    throw new Error("web checkout contains an uninitialized, divergent, or conflicted submodule");
  }

  const records = runGit(root, ["ls-files", "--stage", "-z"])
    .split("\0")
    .filter(Boolean)
    .map((record) => {
      const separator = record.indexOf("\t");
      if (separator < 0) throw new Error("invalid tracked-file record");
      const metadata = record.slice(0, separator).split(" ");
      const path = record.slice(separator + 1);
      if (metadata.length !== 3 || metadata[2] !== "0" || !path) throw new Error("web index contains an unmerged or invalid tracked-file record");
      return { mode: metadata[0], path };
    })
    .sort((left, right) => left.path.localeCompare(right.path, "en"));

  const digest = createHash("sha256");
  for (const record of records) {
    const target = resolve(root, ...record.path.split("/"));
    const outward = target.slice(root.length);
    if (target !== root && !outward.startsWith(sep)) throw new Error(`tracked path escapes the web checkout: ${record.path}`);
    const stat = lstatSync(target);
    const bytes = stat.isSymbolicLink() ? Buffer.from(readlinkSync(target), "utf8") : readFileSync(target);
    digest.update(`${record.mode.length}:${record.mode}${Buffer.byteLength(record.path, "utf8")}:${record.path}${bytes.length}:`, "utf8");
    digest.update(bytes);
  }

  return {
    format: "genesis-juris-web-checkout-receipt",
    head,
    tree: runGit(root, ["rev-parse", "HEAD^{tree}"]).trim(),
    trackedFileCount: records.length,
    trackedByteSha256: digest.digest("hex"),
  };
}

function runGit(repository: string, argumentsList: string[]) {
  const result = spawnSync("git", argumentsList, { cwd: repository, encoding: "utf8", windowsHide: true });
  if (result.status !== 0) throw new Error(`git ${argumentsList.join(" ")} failed (${result.status}): ${(result.stderr || result.stdout).trim()}`);
  return result.stdout;
}

function assertGitSuccess(repository: string, argumentsList: string[]) {
  const result = spawnSync("git", argumentsList, { cwd: repository, encoding: "utf8", windowsHide: true });
  if (result.status !== 0) throw new Error(`git ${argumentsList.join(" ")} reported checkout drift`);
}

function cliArguments(argumentsList: string[]) {
  const repoIndex = argumentsList.indexOf("--repo");
  const headIndex = argumentsList.indexOf("--expected-head");
  if (repoIndex < 0 || headIndex < 0 || !argumentsList[repoIndex + 1] || !argumentsList[headIndex + 1]) {
    throw new Error("usage: verify-web-checkout.ts --repo <path> --expected-head <40-character SHA>");
  }
  return { repository: argumentsList[repoIndex + 1], expectedHead: argumentsList[headIndex + 1] };
}

if (resolve(process.argv[1] ?? "") === fileURLToPath(import.meta.url)) {
  try {
    const input = cliArguments(process.argv.slice(2));
    process.stdout.write(`${JSON.stringify(verifyWebCheckout(input.repository, input.expectedHead))}\n`);
  } catch (error) {
    process.stderr.write(`Web checkout verification failed: ${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  }
}
