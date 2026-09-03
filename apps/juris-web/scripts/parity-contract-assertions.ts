type JsonObject = Record<string, unknown>;

export const PARITY_FIXTURE_SCHEMA_VERSION = 2;
export const PARITY_MATRIX_VERSION = 1;
export const V53_PARITY_ROUTE_COUNT = 18;
export const PARITY_ROUTE_CLASSES = ["success", "adverse", "boundary", "alternative"] as const;
export const REQUIRED_HOSTED_EVIDENCE_GATES = ["android", "flutter", "ios", "rust"] as const;

export type ParityCommand =
  | { kind: "dispatch"; action_id: string }
  | { kind: "advance_time"; minutes: number };

export type ParityFixtureRoute = {
  id: string;
  case_id: string;
  seed: number;
  route_class: (typeof PARITY_ROUTE_CLASSES)[number];
  branch: string;
  risk: string;
  commands: ParityCommand[];
  expected: {
    stage: string;
    clock: number;
    outcome: string | null;
    judicial_result: string | null;
    checkpoint_count: number;
  };
  serialization: {
    web_normalize: true;
    mobile_save_load: true;
    mobile_resave: true;
  };
};

export type ParityFixtureManifest = {
  schema_version: number;
  matrix: {
    version: number;
    route_count: number;
    required_route_classes: string[];
  };
  routes: ParityFixtureRoute[];
};

export type ParityMatrixRequirements = {
  expectedRouteCount: number;
  canonicalOutcomes: Record<string, readonly string[]>;
};

export type WebContractLock = {
  webRuntimeRevision: string;
  playedCaseSchemaRevision: number;
};

export type MobileContractLock = {
  mobileSnapshotSchemaRevision: number;
  mobileProjectionSchemaRevision: number;
  mobileBridgeAbi: number;
};

export type MobileSaveContractLock = {
  mobileSaveSchemaId: string;
  mobileSaveSchemaRevision: number;
  mobileRuntimeCompatibility: string;
};

export type MobileContractReceipt = {
  mobile_snapshot_schema_revision: unknown;
  mobile_projection_schema_revision: unknown;
  mobile_bridge_abi: unknown;
};

export type HostedWorkflowEvidence = {
  run: number;
  commit: string;
  conclusion: "success";
};

export function assertHostedWorkflowEvidence(value: unknown, expectedCommit: string) {
  const hostedEvidence = requiredObject(value, "hosted workflow evidence");
  equalStructured(Object.keys(hostedEvidence).sort(), [...REQUIRED_HOSTED_EVIDENCE_GATES], "hosted workflow evidence exact keys");
  const result = {} as Record<(typeof REQUIRED_HOSTED_EVIDENCE_GATES)[number], HostedWorkflowEvidence>;
  for (const gate of REQUIRED_HOSTED_EVIDENCE_GATES) {
    const evidence = requiredObject(hostedEvidence[gate], `${gate} workflow evidence`);
    const run = requiredPositiveInteger(evidence.run, `${gate} workflow run`);
    const commit = requiredNonEmptyString(evidence.commit, `${gate} evidence commit`);
    equalContract(commit, expectedCommit, `${gate} evidence commit`);
    equalContract(evidence.conclusion, "success", `${gate} workflow conclusion`);
    result[gate] = { run, commit, conclusion: "success" };
  }
  return result;
}

const JUDICIAL_RESULTS = new Set(["won", "lost", "partially_won", "dismissed"]);
const ROUTE_CLASSES = new Set<string>(PARITY_ROUTE_CLASSES);

export function assertWebContractValues(
  lock: WebContractLock,
  authoritative: { webRuntimeRevision: string; playedCaseSchemaRevision: number },
) {
  equalContract(lock.webRuntimeRevision, authoritative.webRuntimeRevision, "web runtime revision");
  equalContract(lock.playedCaseSchemaRevision, authoritative.playedCaseSchemaRevision, "played-case schema revision");
}

export function assertMobileContractValues(lock: MobileContractLock, receipt: MobileContractReceipt) {
  equalContract(receipt.mobile_snapshot_schema_revision, lock.mobileSnapshotSchemaRevision, "mobile snapshot schema revision");
  equalContract(receipt.mobile_projection_schema_revision, lock.mobileProjectionSchemaRevision, "mobile projection schema revision");
  equalContract(receipt.mobile_bridge_abi, lock.mobileBridgeAbi, "mobile bridge ABI");
}

export function assertParityFixtureMatrix(
  value: unknown,
  requirements: ParityMatrixRequirements,
): ParityFixtureManifest {
  equalContract(requirements.expectedRouteCount, V53_PARITY_ROUTE_COUNT, "v53 locked route count");
  const manifest = requiredObject(value, "parity fixture manifest");
  equalContract(manifest.schema_version, PARITY_FIXTURE_SCHEMA_VERSION, "parity fixture schema version");
  const matrix = requiredObject(manifest.matrix, "parity matrix");
  equalContract(matrix.version, PARITY_MATRIX_VERSION, "parity matrix version");
  equalContract(matrix.route_count, requirements.expectedRouteCount, "declared parity route count");
  const declaredClasses = requiredStringArray(matrix.required_route_classes, "required parity route classes");
  equalStructured(
    [...declaredClasses].sort(),
    [...PARITY_ROUTE_CLASSES].sort(),
    "required parity route classes",
  );

  const routes = requiredArray(manifest.routes, "parity fixture routes");
  equalContract(routes.length, requirements.expectedRouteCount, "parity route count");
  const canonicalCaseIds = Object.keys(requirements.canonicalOutcomes);
  if (canonicalCaseIds.length === 0) throw new Error("canonical outcome contract contains no cases");
  const canonicalCases = new Set(canonicalCaseIds);
  const routeIds = new Set<string>();
  const commandPaths = new Set<string>();
  const branches = new Set<string>();
  const coveredCases = new Set<string>();
  const coveredClasses = new Set<string>();
  const coveredOutcomes = new Map(canonicalCaseIds.map((caseId) => [caseId, new Set<string>()]));

  for (let routeIndex = 0; routeIndex < routes.length; routeIndex += 1) {
    const route = requiredObject(routes[routeIndex], `parity route ${routeIndex + 1}`);
    const id = requiredNonEmptyString(route.id, `parity route ${routeIndex + 1} id`);
    if (routeIds.has(id)) throw new Error(`duplicate parity route id \`${id}\``);
    routeIds.add(id);
    const caseId = requiredNonEmptyString(route.case_id, `${id} case id`);
    if (!canonicalCases.has(caseId)) throw new Error(`${id} references unknown canonical case \`${caseId}\``);
    coveredCases.add(caseId);
    requiredNonNegativeInteger(route.seed, `${id} seed`);
    const routeClass = requiredNonEmptyString(route.route_class, `${id} route class`);
    if (!ROUTE_CLASSES.has(routeClass)) throw new Error(`${id} route class \`${routeClass}\` is not supported`);
    coveredClasses.add(routeClass);
    const branch = requiredNonEmptyString(route.branch, `${id} branch`);
    const branchKey = `${caseId}\u0000${branch}`;
    if (branches.has(branchKey)) {
      throw new Error(`${id} duplicates canonical branch \`${branch}\` for ${caseId}`);
    }
    branches.add(branchKey);
    requiredNonEmptyString(route.risk, `${id} risk`);

    const commands = requiredArray(route.commands, `${id} commands`);
    if (commands.length === 0) throw new Error(`${id} commands must not be empty`);
    const normalizedCommands = commands.map((command, commandIndex) =>
      normalizeFixtureCommand(command, `${id} command ${commandIndex + 1}`));
    const commandPath = `${caseId}\u0000${stableJson(normalizedCommands)}`;
    if (commandPaths.has(commandPath)) {
      throw new Error(`${id} duplicates an existing command path for ${caseId}`);
    }
    commandPaths.add(commandPath);

    const expected = requiredObject(route.expected, `${id} expected final state`);
    const stage = requiredNonEmptyString(expected.stage, `${id} expected stage`);
    requiredNonNegativeInteger(expected.clock, `${id} expected clock`);
    equalContract(
      requiredPositiveInteger(expected.checkpoint_count, `${id} expected checkpoint count`),
      commands.length + 1,
      `${id} expected checkpoint count`,
    );
    if (!Object.hasOwn(expected, "outcome")) throw new Error(`${id} expected outcome is missing`);
    const outcome = requiredNullableString(expected.outcome, `${id} expected outcome`);
    if (stage === "resolved" && outcome === null) {
      throw new Error(`${id} resolved route must declare a non-null expected outcome`);
    }
    if (outcome !== null) {
      const knownOutcomes = requirements.canonicalOutcomes[caseId];
      if (!knownOutcomes.includes(outcome)) {
        throw new Error(`${id} expected outcome \`${outcome}\` is not canonical for ${caseId}`);
      }
      coveredOutcomes.get(caseId)!.add(outcome);
    }
    if (!Object.hasOwn(expected, "judicial_result")) {
      throw new Error(`${id} expected judicial result is missing; missing and null are not equivalent`);
    }
    requiredJudicialResult(expected, `${id} expected final state`);

    const serialization = requiredObject(route.serialization, `${id} serialization assertions`);
    equalContract(serialization.web_normalize, true, `${id} web normalization assertion`);
    equalContract(serialization.mobile_save_load, true, `${id} mobile save/load assertion`);
    equalContract(serialization.mobile_resave, true, `${id} mobile re-save assertion`);
  }

  for (const caseId of canonicalCaseIds) {
    if (!coveredCases.has(caseId)) throw new Error(`parity matrix does not cover canonical case \`${caseId}\``);
    for (const outcome of requirements.canonicalOutcomes[caseId]) {
      if (!coveredOutcomes.get(caseId)!.has(outcome)) {
        throw new Error(`parity matrix does not cover canonical outcome \`${caseId}:${outcome}\``);
      }
    }
  }
  for (const routeClass of PARITY_ROUTE_CLASSES) {
    if (!coveredClasses.has(routeClass)) throw new Error(`parity matrix does not cover route class \`${routeClass}\``);
  }

  return value as ParityFixtureManifest;
}

export function assertProjectedRouteMatrix(
  fixtures: ParityFixtureManifest,
  routes: JsonObject[],
  label: string,
) {
  equalContract(routes.length, fixtures.routes.length, `${label} route count`);
  for (let routeIndex = 0; routeIndex < fixtures.routes.length; routeIndex += 1) {
    const fixture = fixtures.routes[routeIndex];
    const route = requiredObject(routes[routeIndex], `${label} route ${routeIndex + 1}`);
    equalContract(route.id, fixture.id, `${label} route id`);
    equalContract(route.case_id, fixture.case_id, `${fixture.id} ${label} case id`);
    equalContract(route.seed, fixture.seed, `${fixture.id} ${label} seed`);
    const initial = requiredObject(route.initial, `${fixture.id} ${label} initial checkpoint`);
    assertCheckpointShape(initial, `${fixture.id} ${label} initial checkpoint`);
    const commands = requiredArray(route.commands, `${fixture.id} ${label} command checkpoints`);
    equalContract(commands.length, fixture.commands.length, `${fixture.id} ${label} command checkpoint count`);
    for (let commandIndex = 0; commandIndex < commands.length; commandIndex += 1) {
      const checkpoint = requiredObject(commands[commandIndex], `${fixture.id} ${label} command ${commandIndex + 1}`);
      equalStructured(
        checkpoint.command,
        fixture.commands[commandIndex],
        `${fixture.id} ${label} command ${commandIndex + 1}`,
      );
      assertCheckpointShape(
        requiredObject(checkpoint.snapshot, `${fixture.id} ${label} command ${commandIndex + 1} checkpoint`),
        `${fixture.id} ${label} command ${commandIndex + 1} checkpoint`,
      );
    }
    equalContract(commands.length + 1, fixture.expected.checkpoint_count, `${fixture.id} ${label} checkpoint count`);
    const finalSnapshot = commands.length === 0
      ? initial
      : requiredObject(
        requiredObject(commands[commands.length - 1], `${fixture.id} ${label} final command`).snapshot,
        `${fixture.id} ${label} final checkpoint`,
      );
    equalContract(finalSnapshot.stage, fixture.expected.stage, `${fixture.id} ${label} final stage`);
    equalContract(finalSnapshot.clock, fixture.expected.clock, `${fixture.id} ${label} final clock`);
    equalContract(finalSnapshot.outcome, fixture.expected.outcome, `${fixture.id} ${label} final outcome`);
    equalContract(
      finalSnapshot.judicial_result,
      fixture.expected.judicial_result,
      `${fixture.id} ${label} final judicial result`,
    );
  }
}

export function assertProjectedRouteParity(webRoutes: JsonObject[], mobileRoutes: JsonObject[]) {
  equalStructured(mobileRoutes, webRoutes, "web and Rust route projections");
}

export function assertLockedReceiptMap(
  actual: Record<string, string>,
  expected: Record<string, string>,
  label: string,
) {
  equalStructured(actual, expected, label);
}

export function assertMobileRoundTripReceipt(route: JsonObject, lock: MobileSaveContractLock) {
  const id = requiredNonEmptyString(route.id, "mobile route id");
  const commands = requiredArray(route.commands, `${id} mobile commands`);
  const initial = requiredObject(route.initial, `${id} mobile initial snapshot`);
  const finalSnapshot = commands.length === 0
    ? initial
    : requiredObject(
      requiredObject(commands[commands.length - 1], `${id} mobile final command`).snapshot,
      `${id} mobile final snapshot`,
    );
  const roundTrip = requiredObject(route.round_trip, `${id} mobile round-trip`);
  equalContract(roundTrip.matches_final, true, `${id} mobile loaded snapshot assertion`);
  equalContract(roundTrip.resaved_matches, true, `${id} mobile re-saved command-log assertion`);
  equalStructured(roundTrip.loaded_snapshot, finalSnapshot, `${id} mobile loaded snapshot`);
  const identity = requiredObject(route.identity, `${id} mobile identity`);
  const inspection = requiredObject(roundTrip.inspection, `${id} mobile save inspection`);
  equalContract(inspection.scenario_id, identity.scenario_id, `${id} inspected save scenario`);
  equalContract(inspection.scenario_fingerprint, identity.fingerprint, `${id} inspected save fingerprint`);
  const save = requiredObject(roundTrip.save, `${id} mobile save summary`);
  equalContract(save.schema_id, lock.mobileSaveSchemaId, `${id} mobile save schema ID`);
  equalContract(save.schema_version, lock.mobileSaveSchemaRevision, `${id} mobile save schema revision`);
  equalContract(save.runtime_compatibility, lock.mobileRuntimeCompatibility, `${id} mobile runtime compatibility`);
  equalContract(save.scenario_id, identity.scenario_id, `${id} mobile save scenario`);
  equalContract(save.scenario_fingerprint, identity.fingerprint, `${id} mobile save fingerprint`);
  equalContract(save.seed, route.seed, `${id} mobile save seed`);
  equalContract(save.command_count, commands.length, `${id} mobile command-log length`);
  return requiredNonEmptyString(save.final_state_digest, `${id} mobile final-state digest`);
}

export function judicialResultCoverage(routes: JsonObject[], label: string) {
  let nonNullCheckpoints = 0;
  for (const route of routes) {
    for (const checkpoint of routeCheckpoints(route, label)) {
      const value = requiredJudicialResult(checkpoint.snapshot, `${label} ${checkpoint.name}`);
      if (value !== null) nonNullCheckpoints += 1;
    }
  }
  if (nonNullCheckpoints === 0) throw new Error(`${label} has no non-null judicial-result checkpoint`);
  return nonNullCheckpoints;
}

export function assertJudicialResultParity(webRoutes: JsonObject[], mobileRoutes: JsonObject[]) {
  if (webRoutes.length !== mobileRoutes.length) throw new Error("judicial-result route count mismatch");
  let nonNullCheckpoints = 0;
  for (let routeIndex = 0; routeIndex < webRoutes.length; routeIndex += 1) {
    const webRoute = webRoutes[routeIndex];
    const mobileRoute = mobileRoutes[routeIndex];
    const webId = requiredNonEmptyString(webRoute.id, "web route id");
    const mobileId = requiredNonEmptyString(mobileRoute.id, "mobile route id");
    equalContract(mobileId, webId, "judicial-result route id");
    const webCheckpoints = routeCheckpoints(webRoute, `web route ${webId}`);
    const mobileCheckpoints = routeCheckpoints(mobileRoute, `mobile route ${mobileId}`);
    if (webCheckpoints.length !== mobileCheckpoints.length) {
      throw new Error(`${webId} judicial-result checkpoint count mismatch`);
    }
    for (let index = 0; index < webCheckpoints.length; index += 1) {
      const webCheckpoint = webCheckpoints[index];
      const mobileCheckpoint = mobileCheckpoints[index];
      equalContract(mobileCheckpoint.name, webCheckpoint.name, `${webId} judicial-result checkpoint`);
      const webValue = requiredJudicialResult(webCheckpoint.snapshot, `web ${webId} ${webCheckpoint.name}`);
      const mobileValue = requiredJudicialResult(mobileCheckpoint.snapshot, `mobile ${mobileId} ${mobileCheckpoint.name}`);
      equalContract(mobileValue, webValue, `${webId} ${webCheckpoint.name} judicial result`);
      if (webValue !== null) nonNullCheckpoints += 1;
    }
  }
  if (nonNullCheckpoints === 0) throw new Error("judicial-result parity has no non-null checkpoint");
  return nonNullCheckpoints;
}

function routeCheckpoints(route: JsonObject, label: string) {
  const initial = requiredObject(route.initial, `${label} initial snapshot`);
  if (!Array.isArray(route.commands)) throw new Error(`${label} commands must be an array`);
  return [
    { name: "initial", snapshot: initial },
    ...route.commands.map((entry, index) => {
      const command = requiredObject(entry, `${label} command ${index + 1}`);
      return {
        name: `command ${index + 1}`,
        snapshot: requiredObject(command.snapshot, `${label} command ${index + 1} snapshot`),
      };
    }),
  ];
}

function assertCheckpointShape(snapshot: JsonObject, label: string) {
  requiredNonEmptyString(snapshot.stage, `${label} stage`);
  requiredNonNegativeInteger(snapshot.clock, `${label} clock`);
  requiredArray(snapshot.actions, `${label} actions`);
  requiredObject(snapshot.resources, `${label} resources`);
  requiredObject(snapshot.numeric_metrics, `${label} numeric metrics`);
  requiredArray(snapshot.evidence, `${label} evidence`);
  requiredArray(snapshot.deadlines, `${label} deadlines`);
  requiredArray(snapshot.inbox, `${label} inbox`);
  requiredJudicialResult(snapshot, label);
  if (!Object.hasOwn(snapshot, "outcome")) throw new Error(`${label} outcome is missing`);
  requiredNullableString(snapshot.outcome, `${label} outcome`);
}

function normalizeFixtureCommand(value: unknown, label: string): ParityCommand {
  const command = requiredObject(value, label);
  const kind = requiredNonEmptyString(command.kind, `${label} kind`);
  if (kind === "dispatch") {
    return { kind, action_id: requiredNonEmptyString(command.action_id, `${label} action id`) };
  }
  if (kind === "advance_time") {
    const minutes = requiredPositiveInteger(command.minutes, `${label} minutes`);
    if (minutes > 1_440) throw new Error(`${label} minutes exceeds the 1,440-minute runtime limit`);
    return { kind, minutes };
  }
  throw new Error(`${label} has unknown command kind \`${kind}\``);
}

function requiredJudicialResult(snapshot: JsonObject, label: string): string | null {
  if (!Object.hasOwn(snapshot, "judicial_result")) {
    throw new Error(`${label} must contain judicial_result; missing and null are not equivalent`);
  }
  const value = snapshot.judicial_result;
  if (value === null) return null;
  if (typeof value !== "string" || !JUDICIAL_RESULTS.has(value)) {
    throw new Error(`${label} judicial_result is invalid`);
  }
  return value;
}

function requiredArray(value: unknown, label: string): unknown[] {
  if (!Array.isArray(value)) throw new Error(`${label} must be an array`);
  return value;
}

function requiredStringArray(value: unknown, label: string) {
  return requiredArray(value, label).map((item, index) => requiredNonEmptyString(item, `${label} item ${index + 1}`));
}

function requiredObject(value: unknown, label: string): JsonObject {
  if (typeof value !== "object" || value === null || Array.isArray(value)) throw new Error(`${label} must be an object`);
  return value as JsonObject;
}

function requiredNonEmptyString(value: unknown, label: string) {
  if (typeof value !== "string" || value.trim().length === 0) throw new Error(`${label} must be a non-empty string`);
  return value;
}

function requiredNullableString(value: unknown, label: string) {
  if (value === null) return null;
  return requiredNonEmptyString(value, label);
}

function requiredNonNegativeInteger(value: unknown, label: string) {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) {
    throw new Error(`${label} must be a non-negative safe integer`);
  }
  return value;
}

function requiredPositiveInteger(value: unknown, label: string) {
  const integer = requiredNonNegativeInteger(value, label);
  if (integer === 0) throw new Error(`${label} must be positive`);
  return integer;
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (typeof value === "object" && value !== null) {
    const object = value as JsonObject;
    return Object.fromEntries(Object.keys(object).sort().map((key) => [key, canonicalize(object[key])]));
  }
  return value;
}

function stableJson(value: unknown) {
  return JSON.stringify(canonicalize(value));
}

function equalStructured(actual: unknown, expected: unknown, label: string) {
  if (stableJson(actual) !== stableJson(expected)) {
    throw new Error(`${label} mismatch\nexpected ${stableJson(expected)}\nactual   ${stableJson(actual)}`);
  }
}

function equalContract(actual: unknown, expected: unknown, label: string) {
  if (actual !== expected) throw new Error(`${label}: expected ${String(expected)}, got ${String(actual)}`);
}
