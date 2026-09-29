import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { buildReleaseIdentity, RELEASE_INPUTS } from "../build/release-identity";
import { sites } from "../build/sites-vite-plugin";
import type { ResolvedConfig } from "vite";
import { releaseProvenanceRecord } from "../app/release-provenance";

test("source identity catches hidden edits, DB changes and archives without claiming a parent Git commit", () => {
  const root = mkdtempSync(join(tmpdir(), "juris-provenance-"));
  const git = (...args: string[]) => execFileSync("git", ["-C", root, ...args], { stdio: "pipe", encoding: "utf8" }).trim();
  const setup = (where: string) => {
    mkdirSync(join(where, "db"), { recursive: true });
    mkdirSync(join(where, ".openai"), { recursive: true });
    writeFileSync(join(where, "db/schema.ts"), "export const revision = 1;\n");
    writeFileSync(join(where, ".openai/hosting.json"), JSON.stringify({ d1: "DB", project_id: "production", r2: "DOCUMENTS" }));
  };
  try {
    setup(root);
    const archive = buildReleaseIdentity(root, ["db"]);
    assert.equal(archive.sourceCommit, "unknown");
    git("init"); git("config", "user.email", "synthetic@example.invalid"); git("config", "user.name", "Synthetic test");
    git("config", "core.autocrlf", "false"); git("add", "."); git("commit", "-m", "synthetic fixture");
    const clean = buildReleaseIdentity(root, ["db"]);
    assert.equal(clean.sourceCommit, git("rev-parse", "HEAD"));
    assert.equal(clean.applicationInputsSha256, archive.applicationInputsSha256);
    git("update-index", "--assume-unchanged", "db/schema.ts");
    writeFileSync(join(root, "db/schema.ts"), "export const revision = 1;\r\n");
    assert.equal(buildReleaseIdentity(root, ["db"]).sourceCommit, "unknown");
    assert.notEqual(buildReleaseIdentity(root, ["db"]).applicationInputsSha256, clean.applicationInputsSha256);
    setup(root);
    writeFileSync(join(root, ".gitignore"), "db/ignored.ts\n");
    writeFileSync(join(root, "db/ignored.ts"), "export const hidden = true;");
    assert.equal(buildReleaseIdentity(root, ["db"]).sourceCommit, "unknown");
    rmSync(join(root, "db/ignored.ts"));
    writeFileSync(join(root, ".openai/hosting.json"), JSON.stringify({ r2: "DOCUMENTS", project_id: "review", d1: "DB" }));
    const review = buildReleaseIdentity(root, ["db"]);
    assert.equal(review.applicationInputsSha256, clean.applicationInputsSha256);
    assert.notEqual(review.hostingConfigSha256, clean.hostingConfigSha256);
    const nested = join(root, "archive"); setup(nested);
    assert.equal(buildReleaseIdentity(nested, ["db"]).sourceCommit, "unknown");
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("stale mutable labels cannot replace packaged identity; only validated release fields are logged", () => {
  const id = "550e8400-e29b-41d4-a716-446655440000";
  const build = { applicationInputsSha256: "a".repeat(64), hostingConfigSha256: "b".repeat(64), sourceCommit: "c".repeat(40) };
  const record = releaseProvenanceRecord(id, { GENESIS_DEPLOYMENT_VERSION: "78", GENESIS_WEB_COMMIT: "d".repeat(40), CF_VERSION_METADATA: { id: "provider-id" } }, build)!;
  assert.equal(record.packagedSourceCommit, build.sourceCommit);
  assert.equal(record.packagedApplicationInputsSha256, build.applicationInputsSha256);
  assert.equal(record.configuredDeploymentLabel, "78");
  assert.equal(record.providerVersionId, "provider-id");
  assert.equal(releaseProvenanceRecord("private@example.test", {}, build), null);
  const invalid = releaseProvenanceRecord(id, { GENESIS_DEPLOYMENT_VERSION: "secret\nemail@example.test" }, { ...build, sourceCommit: "malformed" })!;
  assert.equal(invalid.configuredDeploymentLabel, "unknown");
  assert.equal(invalid.packagedSourceCommit, "unknown");
  assert.equal(releaseProvenanceRecord(id, {})!.packagedApplicationInputsSha256, "unknown");
});

test("packaging writes the captured identity and rejects input changes during compilation", async () => {
  const root = mkdtempSync(join(tmpdir(), "juris-package-"));
  try {
    for (const input of RELEASE_INPUTS) {
      if (["app", "worker", "build", "db", "public", "drizzle"].includes(input)) mkdirSync(join(root, input));
      else { mkdirSync(join(root, input, ".."), { recursive: true }); writeFileSync(join(root, input), "fixture\n"); }
    }
    mkdirSync(join(root, ".openai")); writeFileSync(join(root, ".openai/hosting.json"), '{"d1":"DB","project_id":"synthetic"}');
    const identity = buildReleaseIdentity(root);
    const plugin = sites(identity);
    if (typeof plugin.configResolved !== "function" || typeof plugin.closeBundle !== "function") throw new Error("Expected packaging hooks");
    plugin.configResolved.call({} as never, { root } as ResolvedConfig);
    const closeBundle = plugin.closeBundle;
    await closeBundle.call({} as never);
    assert.deepEqual(JSON.parse(readFileSync(join(root, "dist/.openai/release-provenance.json"), "utf8")), identity);
    writeFileSync(join(root, "db/new-schema.ts"), "export const changed = true;\n");
    await assert.rejects(() => Promise.resolve(closeBundle.call({} as never)), /Release inputs changed during compilation/);
    assert.deepEqual(JSON.parse(readFileSync(join(root, "dist/.openai/release-provenance.json"), "utf8")), identity);
  } finally { rmSync(root, { recursive: true, force: true }); }
});
