import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { lstatSync, readFileSync, readlinkSync, realpathSync } from "node:fs";
import { resolve } from "node:path";

export type MobileCheckoutErrorCode =
  | "MOBILE_SHA_INVALID"
  | "MOBILE_NOT_WORKTREE"
  | "MOBILE_ROOT_MISMATCH"
  | "MOBILE_COMMIT_MISSING"
  | "MOBILE_HEAD_MISMATCH"
  | "MOBILE_TRACKED_DIRTY"
  | "MOBILE_RELEVANT_UNTRACKED";

export class MobileCheckoutError extends Error {
  constructor(readonly code: MobileCheckoutErrorCode, message: string) {
    super(`${code}: ${message}`);
    this.name = "MobileCheckoutError";
  }
}

const RELEVANT_UNTRACKED_PATHS = [
  ".cargo",
  ".github/scripts",
  ".github/workflows",
  "content",
  "crates",
  "apps/juris-mobile",
  "Cargo.toml",
  "Cargo.lock",
  "clippy.toml",
  "deny.toml",
  "rust-toolchain",
  "rust-toolchain.toml",
] as const;

const GENERATED_PREFIXES = [
  "apps/juris-mobile/.dart_tool/",
  "apps/juris-mobile/build/",
  "apps/juris-mobile/android/.gradle/",
  "apps/juris-mobile/android/build/",
  "apps/juris-mobile/ios/Pods/",
  "apps/juris-mobile/ios/.symlinks/",
  "apps/juris-mobile/ios/Flutter/ephemeral/",
] as const;

const GENERATED_EXACT_PATHS = new Set([
  "apps/juris-mobile/.flutter-plugins-dependencies",
  "apps/juris-mobile/android/app/src/main/java/io/flutter/plugins/GeneratedPluginRegistrant.java",
  "apps/juris-mobile/android/app/src/main/jniLibs/x86_64/libjuris_mobile_ffi.so",
  "apps/juris-mobile/android/gradle/wrapper/gradle-wrapper.jar",
  "apps/juris-mobile/android/gradlew",
  "apps/juris-mobile/android/gradlew.bat",
  "apps/juris-mobile/android/local.properties",
  "apps/juris-mobile/ios/Flutter/Generated.xcconfig",
  "apps/juris-mobile/ios/Flutter/flutter_export_environment.sh",
  "apps/juris-mobile/ios/Runner/GeneratedPluginRegistrant.h",
  "apps/juris-mobile/ios/Runner/GeneratedPluginRegistrant.m",
]);

type HeadTreeEntry = {
  mode: string;
  type: string;
  object: string;
  path: string;
};

type IndexEntry = {
  mode: string;
  object: string;
  stage: string;
  path: string;
};

export function verifyMobileCheckoutState(mobileRepo: string, expectedCommit: string): void {
  if (!/^[a-f0-9]{40}$/u.test(expectedCommit)) {
    throw new MobileCheckoutError("MOBILE_SHA_INVALID", "the parity lock must contain a full lowercase commit SHA");
  }

  const requestedRoot = resolve(mobileRepo);
  const inside = runGit(requestedRoot, ["rev-parse", "--is-inside-work-tree"], "MOBILE_NOT_WORKTREE");
  if (inside !== "true") throw new MobileCheckoutError("MOBILE_NOT_WORKTREE", `${requestedRoot} is not a Git worktree`);

  const reportedRoot = runGit(requestedRoot, ["rev-parse", "--show-toplevel"], "MOBILE_NOT_WORKTREE");
  if (normalizedRealPath(reportedRoot) !== normalizedRealPath(requestedRoot)) {
    throw new MobileCheckoutError("MOBILE_ROOT_MISMATCH", `expected ${requestedRoot}, Git reported ${reportedRoot}`);
  }

  runGit(requestedRoot, ["cat-file", "-e", `${expectedCommit}^{commit}`], "MOBILE_COMMIT_MISSING");
  const actualCommit = runGit(requestedRoot, ["rev-parse", "--verify", "HEAD^{commit}"], "MOBILE_NOT_WORKTREE");
  if (actualCommit !== expectedCommit) {
    throw new MobileCheckoutError("MOBILE_HEAD_MISMATCH", `expected ${expectedCommit}, got ${actualCommit}`);
  }

  verifyTrackedInputs(requestedRoot);
  const trackedState = runGit(requestedRoot, ["status", "--porcelain=v1", "-z", "--untracked-files=no"], "MOBILE_NOT_WORKTREE", false);
  if (trackedState.length > 0) {
    throw new MobileCheckoutError("MOBILE_TRACKED_DIRTY", "staged or tracked working-tree changes are present");
  }

  const untracked = splitNull(runGit(
    requestedRoot,
    ["ls-files", "--others", "-z", "--", ...RELEVANT_UNTRACKED_PATHS],
    "MOBILE_NOT_WORKTREE",
    false,
  )).filter(isRelevantUntrackedInput).sort();
  if (untracked.length > 0) {
    throw new MobileCheckoutError("MOBILE_RELEVANT_UNTRACKED", untracked.join(", "));
  }
}

export function withVerifiedMobileCheckout<T>(
  mobileRepo: string,
  expectedCommit: string,
  acceptEvidence: () => T,
): T {
  verifyMobileCheckoutState(mobileRepo, expectedCommit);
  return acceptEvidence();
}

function isRelevantUntrackedInput(path: string) {
  const normalized = path.split(String.fromCharCode(92)).join("/");
  if (GENERATED_PREFIXES.some((prefix) => normalized.startsWith(prefix))) return false;
  if (GENERATED_EXACT_PATHS.has(normalized)) return false;
  if (/^apps\/juris-mobile\/test\/failures\/.*_(?:testImage|masterImage|maskedDiff|isolatedDiff)\.png$/u.test(normalized)) return false;
  return true;
}

function splitNull(value: string) {
  return value.split(String.fromCharCode(0)).filter(Boolean);
}

function verifyTrackedInputs(mobileRepo: string) {
  const headEntries = parseHeadTree(runGit(
    mobileRepo,
    ["ls-tree", "-r", "-z", "--full-tree", "HEAD"],
    "MOBILE_NOT_WORKTREE",
    false,
  ));
  const indexEntries = parseIndex(runGit(
    mobileRepo,
    ["ls-files", "--stage", "-z"],
    "MOBILE_NOT_WORKTREE",
    false,
  ));

  if (headEntries.length !== indexEntries.length) {
    trackedDirty("the index path set differs from HEAD");
  }
  const indexByPath = new Map(indexEntries.map((entry) => [entry.path, entry]));
  for (const head of headEntries) {
    const index = indexByPath.get(head.path);
    if (!index
      || index.stage !== "0"
      || index.mode !== head.mode
      || index.object !== head.object) {
      trackedDirty(`the index entry differs from HEAD: ${head.path}`);
    }
  }

  const flaggedPaths = splitNull(runGit(
    mobileRepo,
    ["ls-files", "-v", "-z"],
    "MOBILE_NOT_WORKTREE",
    false,
  )).filter((entry) => !entry.startsWith("H "));
  if (flaggedPaths.length > 0) {
    trackedDirty(`assume-unchanged, skip-worktree, or nonstandard index flags are present: ${flaggedPaths.join(", ")}`);
  }

  const objectFormat = runGit(mobileRepo, ["rev-parse", "--show-object-format"], "MOBILE_NOT_WORKTREE");
  if (objectFormat !== "sha1" && objectFormat !== "sha256") {
    trackedDirty(`unsupported Git object format: ${objectFormat}`);
  }
  for (const entry of headEntries) {
    if (entry.type !== "blob") {
      trackedDirty(`unsupported tracked entry type ${entry.type}: ${entry.path}`);
    }
    const target = resolve(mobileRepo, entry.path);
    let bytes: Buffer;
    try {
      const stat = lstatSync(target);
      if (entry.mode === "120000" && stat.isSymbolicLink()) {
        bytes = readlinkSync(target, { encoding: "buffer" });
      } else {
        if (!stat.isFile()) trackedDirty(`tracked path is not a file: ${entry.path}`);
        bytes = readFileSync(target);
      }
    } catch (error) {
      if (error instanceof MobileCheckoutError) throw error;
      trackedDirty(`tracked path is missing or unreadable: ${entry.path}`);
    }
    const rawHash = createHash(objectFormat)
      .update(`blob ${bytes.length}\0`)
      .update(bytes)
      .digest("hex");
    if (rawHash !== entry.object) {
      trackedDirty(`tracked working-tree bytes differ from HEAD: ${entry.path}`);
    }
  }
}

function parseHeadTree(value: string): HeadTreeEntry[] {
  return splitNull(value).map((record) => {
    const tab = record.indexOf("\t");
    const fields = record.slice(0, tab).split(" ");
    if (tab < 0 || fields.length !== 3) trackedDirty("Git returned an invalid HEAD tree entry");
    return {
      mode: fields[0],
      type: fields[1],
      object: fields[2],
      path: record.slice(tab + 1),
    };
  });
}

function parseIndex(value: string): IndexEntry[] {
  return splitNull(value).map((record) => {
    const tab = record.indexOf("\t");
    const fields = record.slice(0, tab).split(" ");
    if (tab < 0 || fields.length !== 3) trackedDirty("Git returned an invalid index entry");
    return {
      mode: fields[0],
      object: fields[1],
      stage: fields[2],
      path: record.slice(tab + 1),
    };
  });
}

function trackedDirty(message: string): never {
  throw new MobileCheckoutError("MOBILE_TRACKED_DIRTY", message);
}

function normalizedRealPath(path: string) {
  const real = realpathSync.native(resolve(path));
  return process.platform === "win32" ? real.toLocaleLowerCase("en-US") : real;
}

function runGit(
  mobileRepo: string,
  args: string[],
  failureCode: MobileCheckoutErrorCode,
  trim = true,
) {
  const result = spawnSync("git", ["-C", mobileRepo, ...args], {
    encoding: "utf8",
    env: {
      ...process.env,
      GIT_NO_REPLACE_OBJECTS: "1",
      GIT_OPTIONAL_LOCKS: "0",
    },
    windowsHide: true,
  });
  if (result.error || result.status !== 0) {
    const detail = result.error?.message ?? ((result.stderr || result.stdout).trim() || `git exited with ${String(result.status)}`);
    throw new MobileCheckoutError(failureCode, detail);
  }
  return trim ? result.stdout.trim() : result.stdout;
}
