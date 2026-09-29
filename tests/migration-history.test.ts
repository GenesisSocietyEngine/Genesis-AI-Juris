import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdirSync, mkdtempSync } from "node:fs";
import { resolve } from "node:path";
import { execFileSync, spawnSync } from "node:child_process";
import { MIGRATION_HISTORY_REVISIONS, verifyMigrationHistory } from "../scripts/verify-migration-history.mjs";

test("migration preflight verifies the real required historical objects", () => {
  assert.deepEqual(verifyMigrationHistory().revisions, Object.values(MIGRATION_HISTORY_REVISIONS));
});

test("Git repository inspection failures are distinct from missing historical commits", () => {
  const output = resolve(".artifacts/migration-history-tests");
  mkdirSync(output, { recursive: true });
  const fixture = mkdtempSync(resolve(output, "inaccessible-"));
  assert.throws(() => verifyMigrationHistory(resolve(fixture, "absent")),
    /could not inspect the Git repository[\s\S]*missing history has not been established/);
});

test("missing-history preflight fails before migration setup with both exact revisions and a remedy", () => {
  const output = resolve(".artifacts/migration-history-tests");
  mkdirSync(output, { recursive: true });
  const empty = mkdtempSync(resolve(output, "missing-"));
  execFileSync("git", ["init", "--quiet", empty], { windowsHide: true });
  const result = spawnSync(process.execPath, [resolve("scripts/verify-migration-history.mjs"), "--repo", empty], {
    encoding: "utf8", windowsHide: true,
  });
  assert.equal(result.status, 1);
  assert.equal(result.stdout, "");
  for (const revision of Object.values(MIGRATION_HISTORY_REVISIONS)) assert.ok(result.stderr.includes(`missing ${revision}`));
  assert.match(result.stderr, /fetch-depth: 0/);
  assert.match(result.stderr, /git fetch --unshallow/);
  assert.match(result.stderr, /remote actually contains both revisions/);
  assert.match(result.stderr, /Do not skip compatibility assertions/);
});
