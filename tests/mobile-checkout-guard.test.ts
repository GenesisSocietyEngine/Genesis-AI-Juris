import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import {
  appendFileSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import { tmpdir } from "node:os";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  MobileCheckoutError,
  verifyMobileCheckoutState,
  withVerifiedMobileCheckout,
  type MobileCheckoutErrorCode,
} from "../scripts/mobile-checkout-guard";

type CheckoutFixture = {
  root: string;
  repository: string;
  worktree: string;
  commit: string;
};

test("an exact clean detached mobile worktree succeeds", () => {
  const fixture = createCheckoutFixture();
  try {
    assert.equal(statSync(join(fixture.worktree, ".git")).isFile(), true);
    assert.doesNotThrow(() => verifyMobileCheckoutState(fixture.worktree, fixture.commit));
  } finally {
    removeFixture(fixture.root);
  }
});

test("a clean mobile worktree at the wrong HEAD fails", () => {
  const fixture = createCheckoutFixture();
  try {
    appendFileSync(join(fixture.repository, "content", "tracked.txt"), "second commit\n");
    git(fixture.repository, ["add", "content/tracked.txt"]);
    git(fixture.repository, ["commit", "-m", "second"]);
    const secondCommit = git(fixture.repository, ["rev-parse", "HEAD"]);
    const secondWorktree = join(fixture.root, "wrong-head");
    git(fixture.repository, ["worktree", "add", "--detach", secondWorktree, secondCommit]);
    assertGuardCode(() => verifyMobileCheckoutState(secondWorktree, fixture.commit), "MOBILE_HEAD_MISMATCH");
  } finally {
    removeFixture(fixture.root);
  }
});

test("a tracked line-ending-only modification fails before parity evidence is accepted", () => {
  const fixture = createCheckoutFixture();
  try {
    let evidenceAccepted = false;
    writeFileSync(join(fixture.worktree, "content", "tracked.txt"), "line one\r\nline two\r\n");
    assert.throws(
      () => withVerifiedMobileCheckout(fixture.worktree, fixture.commit, () => { evidenceAccepted = true; }),
      (error: unknown) => error instanceof MobileCheckoutError
        && error.code === "MOBILE_TRACKED_DIRTY"
        && /working-tree bytes differ from HEAD/u.test(error.message),
    );
    assert.equal(evidenceAccepted, false);
  } finally {
    removeFixture(fixture.root);
  }
});

test("assume-unchanged and skip-worktree index flags fail even when bytes are unchanged", () => {
  for (const flag of ["--assume-unchanged", "--skip-worktree"]) {
    const fixture = createCheckoutFixture();
    try {
      git(fixture.worktree, ["update-index", flag, "content/tracked.txt"]);
      assert.equal(git(fixture.worktree, ["status", "--porcelain=v1", "--untracked-files=no"]), "");
      assertGuardCode(() => verifyMobileCheckoutState(fixture.worktree, fixture.commit), "MOBILE_TRACKED_DIRTY");
    } finally {
      removeFixture(fixture.root);
    }
  }
});

test("a staged mobile modification fails", () => {
  const fixture = createCheckoutFixture();
  try {
    appendFileSync(join(fixture.worktree, "content", "tracked.txt"), "staged\n");
    git(fixture.worktree, ["add", "content/tracked.txt"]);
    assertGuardCode(() => verifyMobileCheckoutState(fixture.worktree, fixture.commit), "MOBILE_TRACKED_DIRTY");
  } finally {
    removeFixture(fixture.root);
  }
});

test("relevant untracked mobile source, fixtures, assets, tests, and overrides fail", () => {
  const paths = [
    "crates/rogue/src/lib.rs",
    "content/traces/rogue.commands.json",
    "apps/juris-mobile/assets/case_catalog/rogue.json",
    "apps/juris-mobile/test/rogue_test.dart",
    "apps/juris-mobile/pubspec_overrides.yaml",
  ];
  for (const relativePath of paths) {
    const fixture = createCheckoutFixture();
    try {
      const target = join(fixture.worktree, ...relativePath.split("/"));
      mkdirSync(dirname(target), { recursive: true });
      writeFileSync(target, "untracked release input\n");
      assertGuardCode(() => verifyMobileCheckoutState(fixture.worktree, fixture.commit), "MOBILE_RELEVANT_UNTRACKED");
    } finally {
      removeFixture(fixture.root);
    }
  }
});

test("known generated mobile outputs do not make the source checkout dirty", () => {
  const fixture = createCheckoutFixture();
  try {
    const generated = [
      "apps/juris-mobile/.dart_tool/generated.json",
      "apps/juris-mobile/build/result.bin",
      "apps/juris-mobile/test/failures/example_testImage.png",
      "apps/juris-mobile/test/failures/example_masterImage.png",
    ];
    for (const relativePath of generated) {
      const target = join(fixture.worktree, ...relativePath.split("/"));
      mkdirSync(dirname(target), { recursive: true });
      writeFileSync(target, "generated\n");
    }
    assert.doesNotThrow(() => verifyMobileCheckoutState(fixture.worktree, fixture.commit));
  } finally {
    removeFixture(fixture.root);
  }
});

test("an explicit non-Git mobile root never falls back to an environment checkout", () => {
  const fixture = createCheckoutFixture();
  try {
    const nonGitRoot = join(fixture.root, "not-a-checkout");
    mkdirSync(nonGitRoot);
    const verifier = fileURLToPath(new URL("../scripts/verify-mobile-parity.ts", import.meta.url));
    const result = spawnSync(
      process.execPath,
      ["--import", "tsx", verifier, "--mobile-repo", nonGitRoot],
      {
        cwd: dirname(dirname(verifier)),
        encoding: "utf8",
        env: { ...process.env, JURIS_MOBILE_REPO: fixture.worktree },
        windowsHide: true,
      },
    );
    assert.notEqual(result.status, 0);
    assert.match(`${result.stderr}\n${result.stdout}`, /MOBILE_NOT_WORKTREE/u);
  } finally {
    removeFixture(fixture.root);
  }
});

function createCheckoutFixture(): CheckoutFixture {
  const root = mkdtempSync(join(tmpdir(), "genesis-juris-mobile-guard-"));
  const repository = join(root, "repository");
  const worktree = join(root, "detached");
  mkdirSync(join(repository, "content"), { recursive: true });
  git(repository, ["init"]);
  git(repository, ["config", "user.name", "Codex Test"]);
  git(repository, ["config", "user.email", "codex-test@example.invalid"]);
  git(repository, ["config", "core.autocrlf", "false"]);
  writeFileSync(
    join(repository, ".gitattributes"),
    "* text=auto eol=lf\ncontent/tracked.txt text eol=lf\n",
  );
  writeFileSync(join(repository, "content", "tracked.txt"), "line one\nline two\n");
  git(repository, ["add", "."]);
  git(repository, ["commit", "-m", "baseline"]);
  const commit = git(repository, ["rev-parse", "HEAD"]);
  git(repository, ["worktree", "add", "--detach", worktree, commit]);
  return { root, repository, worktree, commit };
}

function git(cwd: string, args: string[]) {
  return execFileSync("git", ["-C", cwd, ...args], {
    encoding: "utf8",
    env: { ...process.env, GIT_OPTIONAL_LOCKS: "0", GIT_NO_REPLACE_OBJECTS: "1" },
    windowsHide: true,
  }).trim();
}

function assertGuardCode(callback: () => unknown, expected: MobileCheckoutErrorCode) {
  assert.throws(callback, (error: unknown) => error instanceof MobileCheckoutError && error.code === expected);
}

function removeFixture(root: string) {
  const resolvedRoot = resolve(root);
  const resolvedTemp = resolve(tmpdir());
  assert.equal(dirname(resolvedRoot), resolvedTemp, "checkout-guard fixture escaped the system temp directory");
  rmSync(resolvedRoot, { recursive: true, force: true });
}
