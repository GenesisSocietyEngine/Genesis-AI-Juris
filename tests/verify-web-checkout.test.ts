import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { verifyWebCheckout } from "../scripts/verify-web-checkout";

function git(root: string, ...argumentsList: string[]) {
  const result = spawnSync("git", argumentsList, { cwd: root, encoding: "utf8", windowsHide: true });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  return result.stdout.trim();
}

test("web checkout receipts bind clean HEAD and raw tracked bytes and reject drift", () => {
  const root = mkdtempSync(join(tmpdir(), "juris-web-checkout-"));
  try {
    git(root, "init");
    git(root, "config", "user.name", "GENESIS test");
    git(root, "config", "user.email", "test@example.invalid");
    writeFileSync(join(root, "tracked.txt"), "alpha\n", "utf8");
    git(root, "add", "tracked.txt");
    git(root, "commit", "-m", "fixture");
    const head = git(root, "rev-parse", "HEAD");

    const receipt = verifyWebCheckout(root, head);
    assert.equal(receipt.head, head);
    assert.equal(receipt.trackedFileCount, 1);
    assert.match(receipt.trackedByteSha256, /^[a-f0-9]{64}$/u);
    assert.throws(() => verifyWebCheckout(root, "0".repeat(40)), /HEAD mismatch/u);

    writeFileSync(join(root, "tracked.txt"), "changed\n", "utf8");
    assert.throws(() => verifyWebCheckout(root, head), /contains tracked, staged, or untracked changes/u);
    git(root, "checkout", "--", "tracked.txt");
    writeFileSync(join(root, "untracked.txt"), "untracked\n", "utf8");
    assert.throws(() => verifyWebCheckout(root, head), /contains tracked, staged, or untracked changes/u);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
