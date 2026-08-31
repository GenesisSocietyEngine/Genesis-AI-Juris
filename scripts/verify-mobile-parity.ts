import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import {
  advanceCanonicalTime,
  CANONICAL_RUNTIME_REVISION,
  canonicalAvailableActionIds,
  createCanonicalRuntime,
  dispatchCanonicalAction,
  normalizeCanonicalRuntimeState,
  type CanonicalRuntimeState,
} from "../app/canonical-runtime";
import { PLAYED_CASE_SCHEMA_REVISION } from "../app/played-case-contract";
import { withVerifiedMobileCheckout } from "./mobile-checkout-guard";
import {
  assertJudicialResultParity,
  assertLockedReceiptMap,
  assertMobileContractValues,
  assertMobileRoundTripReceipt,
  assertParityFixtureMatrix,
  assertProjectedRouteMatrix,
  assertProjectedRouteParity,
  assertWebContractValues,
  judicialResultCoverage,
  type ParityFixtureManifest,
} from "./parity-contract-assertions";

type JsonObject = Record<string, unknown>;
type CanonicalBundleCase = {
  case_id: string;
  scenario_id: string;
  scenario_fingerprint: string;
  runtime_adapter?: string;
  scenario: {
    schema_version: string;
    metadata: { content_version: string };
    outcomes: Array<{ id: string }>;
  };
};
type CanonicalBundle = { bundle_version: number; catalog_version: number; cases: CanonicalBundleCase[] };
type LockIdentity = { caseId: string; version: string; fingerprint: string; schemaRevision: string };
type WorkflowEvidence = { run: number; commit: string; conclusion: string };
type ParityLock = {
  format: string;
  lockVersion: number;
  mobile: { repository: string; commit: string; appVersion: string; rustWorkspaceVersion: string };
  bundle: { webPath: string; mobilePath: string; bundleVersion: number; catalogVersion: number; sha256: string; mobileGitBlob: string };
  contracts: {
    scenarioSchemaRevision: string;
    runtimeAdapter: string;
    webRuntimeRevision: string;
    playedCaseSchemaRevision: number;
    mobileSaveSchemaId: string;
    mobileSaveSchemaRevision: number;
    mobileRuntimeCompatibility: string;
    mobileSnapshotSchemaRevision: number;
    mobileProjectionSchemaRevision: number;
    mobileBridgeAbi: number;
  };
  identities: LockIdentity[];
  fixtures: {
    path: string;
    schemaVersion: number;
    sha256: string;
    probePath: string;
    probeSha256: string;
    routeCount: number;
    checkpointCount: number;
    judicialResultCheckpoints: number;
    routeHashes: Record<string, string>;
    mobileSaveDigests?: Record<string, string>;
  };
  hostedEvidence: {
    rust: WorkflowEvidence;
    flutter: WorkflowEvidence;
    android: WorkflowEvidence;
    ios: WorkflowEvidence;
  };
};

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const argumentsList = process.argv.slice(2);
const lockOnly = argumentsList.includes("--lock-only");
const printLockData = argumentsList.includes("--print-lock-data");
const mobileArgumentIndex = argumentsList.indexOf("--mobile-repo");
const mobileArgument = mobileArgumentIndex >= 0 ? argumentsList[mobileArgumentIndex + 1] : undefined;

try {
  verifyParity();
} catch (error) {
  console.error(`Mobile parity gate failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
}

function verifyParity() {
  const lock = readJson<ParityLock>(join(projectRoot, "parity", "mobile-parity.lock.json"));
  equal(lock.format, "genesis-juris-mobile-parity-lock", "parity lock format");
  equal(lock.lockVersion, 2, "parity lock version");
  for (const [gate, evidence] of Object.entries(lock.hostedEvidence)) {
    truth(Number.isSafeInteger(evidence.run) && evidence.run > 0, `${gate} workflow run must be a positive integer`);
    equal(evidence.commit, lock.mobile.commit, `${gate} evidence commit`);
    equal(evidence.conclusion, "success", `${gate} workflow conclusion`);
  }
  assertWebContractValues(lock.contracts, {
    webRuntimeRevision: CANONICAL_RUNTIME_REVISION,
    playedCaseSchemaRevision: PLAYED_CASE_SCHEMA_REVISION,
  });

  const fixturePath = resolveInsideProject(lock.fixtures.path);
  const fixtureBytes = readFileSync(fixturePath);
  const fixtureHash = sha256(fixtureBytes);
  const fixtureManifest = JSON.parse(fixtureBytes.toString("utf8")) as unknown;
  if (!printLockData) equal(fixtureHash, lock.fixtures.sha256, "fixture manifest SHA-256");
  const probePath = resolveInsideProject(lock.fixtures.probePath);
  const probeBytes = readFileSync(probePath);
  equal(sha256(probeBytes), lock.fixtures.probeSha256, "mobile probe SHA-256");

  const webBundlePath = resolveInsideProject(lock.bundle.webPath);
  const webBundleBytes = readFileSync(webBundlePath);
  equal(sha256(webBundleBytes), lock.bundle.sha256, "web bundle SHA-256");
  const webBundle = JSON.parse(webBundleBytes.toString("utf8")) as CanonicalBundle;
  verifyBundleContract(webBundle, lock);

  const canonicalOutcomes = Object.fromEntries(webBundle.cases.map((item) => [
    item.case_id,
    item.scenario.outcomes.map((outcome) => outcome.id),
  ]));
  const fixtures = assertParityFixtureMatrix(fixtureManifest, {
    expectedRouteCount: lock.fixtures.routeCount,
    canonicalOutcomes,
  });
  equal(fixtures.schema_version, lock.fixtures.schemaVersion, "fixture schema version");
  const checkpointCount = fixtures.routes.reduce((sum, route) => sum + route.expected.checkpoint_count, 0);
  equal(checkpointCount, lock.fixtures.checkpointCount, "locked parity checkpoint count");

  const webRoutes = runWebRoutes(fixtures, webBundle);
  assertProjectedRouteMatrix(fixtures, webRoutes, "web");
  const judicialResultCheckpoints = judicialResultCoverage(webRoutes, "web parity routes");
  const routeHashes = Object.fromEntries(webRoutes.map((route) => [String(route.id), sha256(stableJson(route))]));
  if (!printLockData) {
    equal(judicialResultCheckpoints, lock.fixtures.judicialResultCheckpoints, "locked non-null judicial-result checkpoints");
    assertLockedReceiptMap(routeHashes, lock.fixtures.routeHashes, "locked web route projections");
  }

  if (lockOnly || (printLockData && !mobileArgument && !process.env.JURIS_MOBILE_REPO)) {
    if (printLockData) {
      console.log(JSON.stringify({ fixtureSha256: fixtureHash, checkpointCount, judicialResultCheckpoints, routeHashes }, null, 2));
    } else {
      console.log("PASS authoritative web contracts: app/canonical-runtime.ts and app/played-case-contract.ts");
      console.log(`PASS mobile parity lock: ${webRoutes.length} deterministic routes; bundle ${lock.bundle.sha256}`);
    }
    return;
  }

  const mobileRepo = resolveMobileRepo(mobileArgument, mobileArgumentIndex >= 0);
  const mobileBundlePath = resolveInsideMobileRepo(mobileRepo, lock.bundle.mobilePath);
  const mobileOutput = withVerifiedMobileCheckout(mobileRepo, lock.mobile.commit, () => {
    verifyMobileEvidence(mobileRepo, mobileBundlePath, webBundleBytes, lock);
    return runMobileProbe(
      mobileRepo,
      lock.mobile.commit,
      lock.bundle.mobilePath,
      fixtureBytes,
      probeBytes,
    );
  });
  equal(mobileOutput.schema_version, 1, "mobile probe schema version");
  equal(mobileOutput.runtime, "mobile-rust", "mobile probe runtime");
  truth(isObject(mobileOutput.contracts), "mobile probe contracts must be an object");
  assertMobileContractValues(lock.contracts, {
    mobile_snapshot_schema_revision: mobileOutput.contracts.mobile_snapshot_schema_revision,
    mobile_projection_schema_revision: mobileOutput.contracts.mobile_projection_schema_revision,
    mobile_bridge_abi: mobileOutput.contracts.mobile_bridge_abi,
  });
  truth(Array.isArray(mobileOutput.routes), "mobile probe routes must be an array");

  const mobileRoutes = (mobileOutput.routes as JsonObject[]).map(stripMobileRoundTrip);
  assertProjectedRouteMatrix(fixtures, mobileRoutes, "mobile");
  equal(assertJudicialResultParity(webRoutes, mobileRoutes), judicialResultCheckpoints, "judicial-result parity checkpoint count");
  assertProjectedRouteParity(webRoutes, mobileRoutes);
  const saveDigests = verifyMobileRoundTrips(mobileOutput.routes as JsonObject[], lock);
  if (!printLockData) {
    assertLockedReceiptMap(saveDigests, lock.fixtures.mobileSaveDigests ?? {}, "locked mobile save digests");
  }

  if (printLockData) {
    console.log(JSON.stringify({
      fixtureSha256: fixtureHash,
      checkpointCount,
      judicialResultCheckpoints,
      routeHashes,
      mobileSaveDigests: saveDigests,
      mobileContracts: mobileOutput.contracts,
    }, null, 2));
  } else {
    console.log("PASS authoritative mobile contracts: compiled MobileBridge snapshots and juris_mobile_bridge_abi_version()");
    console.log(`PASS cross-repository mobile parity: ${webRoutes.length} routes and every checkpoint match ${lock.mobile.commit}`);
  }
}

function verifyBundleContract(bundle: CanonicalBundle, lock: ParityLock) {
  equal(bundle.bundle_version, lock.bundle.bundleVersion, "canonical bundle version");
  equal(bundle.catalog_version, lock.bundle.catalogVersion, "canonical catalog version");
  equal(bundle.cases.length, lock.identities.length, "canonical identity count");
  const identities = bundle.cases.map((item) => ({
    caseId: item.case_id,
    version: item.scenario.metadata.content_version,
    fingerprint: item.scenario_fingerprint,
    schemaRevision: item.scenario.schema_version,
  })).sort(compareCaseId);
  equalStable(identities, [...lock.identities].sort(compareCaseId), "canonical identity tuples");
  for (const item of bundle.cases) {
    equal(item.scenario.schema_version, lock.contracts.scenarioSchemaRevision, `${item.case_id} scenario schema`);
    equal(item.runtime_adapter, lock.contracts.runtimeAdapter, `${item.case_id} runtime adapter`);
  }
}

function runWebRoutes(fixtures: ParityFixtureManifest, bundle: CanonicalBundle) {
  const cases = new Map(bundle.cases.map((item) => [item.case_id, item]));
  return fixtures.routes.map((route) => {
    const canonicalCase = cases.get(route.case_id);
    truth(canonicalCase, `fixture ${route.id} references an unknown case`);
    let state = createCanonicalRuntime(route.case_id, route.seed);
    const initial = projectWebSnapshot(state);
    const commands = route.commands.map((command) => {
      state = command.kind === "dispatch"
        ? dispatchCanonicalAction(state, command.action_id)
        : advanceCanonicalTime(state, command.minutes);
      return { command, snapshot: projectWebSnapshot(state) };
    });
    const encoded = JSON.stringify(state);
    const restored = normalizeCanonicalRuntimeState(JSON.parse(encoded), state.caseId, state.sourceFingerprint);
    truth(restored, `${route.id} web state round-trip was rejected`);
    equalStable(projectWebSnapshot(restored), projectWebSnapshot(state), `${route.id} web state round-trip`);
    return {
      id: route.id,
      case_id: route.case_id,
      seed: route.seed,
      identity: {
        case_id: canonicalCase.case_id,
        scenario_id: canonicalCase.scenario_id,
        version: canonicalCase.scenario.metadata.content_version,
        fingerprint: canonicalCase.scenario_fingerprint,
        schema_revision: canonicalCase.scenario.schema_version,
      },
      initial,
      commands,
    };
  });
}

function projectWebSnapshot(state: CanonicalRuntimeState) {
  const evidence = [...state.availableEvidence].sort();
  const actions = canonicalAvailableActionIds(state).sort();
  const deadlines = Object.keys(state.deadlineStatuses)
    .filter((id) => state.deadlineStatuses[id] !== null)
    .sort()
    .map((id) => ({ id, status: state.deadlineStatuses[id], due_minutes: state.deadlineDueMinutes[id] }));
  const inbox = [...state.visibleInbox]
    .sort()
    .map((id) => ({ id, resolved: state.resolvedInbox.includes(id) }));
  return canonicalize({
    stage: state.stageId,
    clock: state.clockMinutes,
    actions,
    resources: state.resources,
    numeric_metrics: state.numericMetrics,
    evidence,
    deadlines,
    inbox,
    judicial_result: state.judicialResult,
    outcome: state.outcomeId,
  });
}

function verifyMobileEvidence(mobileRepo: string, mobileBundlePath: string, webBundleBytes: Buffer, lock: ParityLock) {
  const pubspec = readFileSync(join(mobileRepo, "apps", "juris-mobile", "pubspec.yaml"), "utf8");
  equal(matchRequired(pubspec, /^version:\s*(\S+)\s*$/m, "Flutter app version"), lock.mobile.appVersion, "mobile app version");
  const cargoToml = readFileSync(join(mobileRepo, "Cargo.toml"), "utf8");
  equal(matchRequired(cargoToml, /\[workspace\.package\][\s\S]*?^version\s*=\s*"([^"]+)"/m, "Rust workspace version"), lock.mobile.rustWorkspaceVersion, "Rust workspace version");
  const mobileBytes = readFileSync(mobileBundlePath);
  equal(Buffer.compare(webBundleBytes, mobileBytes), 0, "web/mobile canonical bundle byte equality");
  equal(sha256(mobileBytes), lock.bundle.sha256, "mobile bundle SHA-256");
  equal(
    run("git", ["rev-parse", "--verify", `${lock.mobile.commit}:${lock.bundle.mobilePath}`], mobileRepo),
    lock.bundle.mobileGitBlob,
    "mobile bundle HEAD Git blob",
  );
  verifyBundleContract(JSON.parse(mobileBytes.toString("utf8")) as CanonicalBundle, lock);
}

function runMobileProbe(
  mobileRepo: string,
  mobileCommit: string,
  mobileBundleRelativePath: string,
  fixtureBytes: Buffer,
  probeBytes: Buffer,
): JsonObject {
  const probeRoot = mkdtempSync(join(tmpdir(), "genesis-juris-parity-"));
  const expectedParent = resolve(tmpdir());
  truth(dirname(resolve(probeRoot)) === expectedParent, "temporary parity probe path escaped the system temp directory");
  try {
    const sourceRoot = join(probeRoot, "mobile-source");
    const archivePath = join(probeRoot, "mobile-source.tar");
    mkdirSync(sourceRoot);
    run("git", ["archive", "--format=tar", "--output", archivePath, mobileCommit], mobileRepo);
    // Keep tar operands relative to its cwd. MSYS tar otherwise interprets a
    // Windows drive prefix such as C: as a remote archive host.
    run("tar", [
      "-xf",
      relative(probeRoot, archivePath),
      "-C",
      relative(probeRoot, sourceRoot),
    ], probeRoot);

    const exampleRoot = join(sourceRoot, "crates", "juris-mobile-ffi", "examples");
    mkdirSync(exampleRoot, { recursive: true });
    writeFileSync(join(exampleRoot, "genesis_juris_mobile_parity_probe.rs"), probeBytes);
    const fixturePath = join(probeRoot, "mobile-parity-fixtures.json");
    writeFileSync(fixturePath, fixtureBytes);
    const mobileBundlePath = resolveInsideMobileRepo(sourceRoot, mobileBundleRelativePath);
    const sourceLock = readFileSync(join(mobileRepo, "Cargo.lock"));
    const archivedLockPath = join(sourceRoot, "Cargo.lock");
    const archivedLock = readFileSync(archivedLockPath);
    equal(Buffer.compare(archivedLock, sourceLock), 0, "archived Cargo.lock byte identity");
    const cargo = process.env.CARGO?.trim() || "cargo";
    const encoded = run(cargo, [
      "run",
      "--quiet",
      "--package",
      "juris-mobile-ffi",
      "--example",
      "genesis_juris_mobile_parity_probe",
      "--locked",
      "--offline",
      "--",
      mobileBundlePath,
      fixturePath,
    ], sourceRoot, 10 * 60 * 1_000);
    equal(Buffer.compare(readFileSync(archivedLockPath), archivedLock), 0, "Cargo changed the pinned mobile lock");
    return JSON.parse(encoded) as JsonObject;
  } finally {
    if (dirname(resolve(probeRoot)) === expectedParent) rmSync(probeRoot, { recursive: true, force: true });
  }
}

function stripMobileRoundTrip(route: JsonObject) {
  const comparable = { ...route };
  delete comparable.round_trip;
  return comparable;
}

function verifyMobileRoundTrips(routes: JsonObject[], lock: ParityLock) {
  const digests: Record<string, string> = {};
  const saveContract = {
    mobileSaveSchemaId: lock.contracts.mobileSaveSchemaId,
    mobileSaveSchemaRevision: lock.contracts.mobileSaveSchemaRevision,
    mobileRuntimeCompatibility: lock.contracts.mobileRuntimeCompatibility,
  };
  for (const route of routes) {
    const id = requiredString(route.id, "mobile route id");
    digests[id] = assertMobileRoundTripReceipt(route, saveContract);
  }
  return digests;
}

function resolveMobileRepo(argument: string | undefined, argumentProvided: boolean) {
  if (argumentProvided) {
    if (!argument?.trim()) throw new Error("--mobile-repo requires a checkout path");
    return resolve(argument);
  }
  const environmentRoot = process.env.JURIS_MOBILE_REPO?.trim();
  if (environmentRoot) return resolve(environmentRoot);

  const candidates = [
    resolve(projectRoot, "..", "Genesis-AI-Juris"),
    "/workspace/Genesis-AI-Juris",
    process.platform === "win32" ? "C:\\PROJECTS\\Genesis-AI-Juris" : undefined,
  ].filter((value): value is string => Boolean(value));
  const found = candidates.map((value) => resolve(value)).find((value) => existsSync(join(value, ".git")));
  if (!found) throw new Error("mobile checkout not found; pass --mobile-repo or JURIS_MOBILE_REPO");
  return found;
}

function resolveInsideMobileRepo(mobileRepo: string, relativePath: string) {
  truth(!isAbsolute(relativePath), `locked mobile path must be relative: ${relativePath}`);
  const target = resolve(mobileRepo, ...relativePath.split("/"));
  const outward = relative(mobileRepo, target);
  truth(
    !isAbsolute(outward)
      && outward !== ".."
      && !outward.startsWith(`..${sep}`),
    `locked mobile path escapes the checkout: ${relativePath}`,
  );
  return target;
}

function resolveInsideProject(relativePath: string) {
  truth(!isAbsolute(relativePath), `locked project path must be relative: ${relativePath}`);
  const target = resolve(projectRoot, relativePath);
  const outward = relative(projectRoot, target);
  truth(!isAbsolute(outward) && outward !== ".." && !outward.startsWith(`..${sep}`), `locked path escapes project: ${relativePath}`);
  return target;
}

function run(command: string, args: string[], cwd: string, timeout = 60_000) {
  const result = spawnSync(command, args, {
    cwd,
    encoding: "utf8",
    env: { ...process.env, GIT_NO_REPLACE_OBJECTS: "1", GIT_OPTIONAL_LOCKS: "0" },
    timeout,
    windowsHide: true,
  });
  if (result.error) throw new Error(`${command} failed to start: ${result.error.message}`);
  if (result.status !== 0) throw new Error(`${command} ${args.join(" ")} failed (${result.status}): ${(result.stderr || result.stdout).trim()}`);
  return result.stdout.trim();
}

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, "utf8")) as T;
}

function sha256(value: string | Buffer) {
  return createHash("sha256").update(value).digest("hex");
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (isObject(value)) return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonicalize(value[key])]));
  return value;
}

function stableJson(value: unknown) {
  return JSON.stringify(canonicalize(value));
}

function equalStable(actual: unknown, expected: unknown, label: string) {
  if (stableJson(actual) !== stableJson(expected)) {
    throw new Error(`${label} mismatch\nexpected ${stableJson(expected)}\nactual   ${stableJson(actual)}`);
  }
}

function equal(actual: unknown, expected: unknown, label: string) {
  if (actual !== expected) throw new Error(`${label}: expected ${String(expected)}, got ${String(actual)}`);
}

function truth(value: unknown, message: string): asserts value {
  if (!value) throw new Error(message);
}

function compareCaseId(left: LockIdentity, right: LockIdentity) {
  return left.caseId.localeCompare(right.caseId);
}

function matchRequired(source: string, pattern: RegExp, label: string) {
  const match = source.match(pattern);
  if (!match?.[1]) throw new Error(`could not read ${label}`);
  return match[1];
}

function isObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requiredString(value: unknown, label: string) {
  if (typeof value !== "string") throw new Error(`${label} must be a string`);
  return value;
}
