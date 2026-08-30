type JsonObject = Record<string, unknown>;

export type WebContractLock = {
  webRuntimeRevision: string;
  playedCaseSchemaRevision: number;
};

export type MobileContractLock = {
  mobileSnapshotSchemaRevision: number;
  mobileProjectionSchemaRevision: number;
  mobileBridgeAbi: number;
};

export type MobileContractReceipt = {
  mobile_snapshot_schema_revision: unknown;
  mobile_projection_schema_revision: unknown;
  mobile_bridge_abi: unknown;
};

const JUDICIAL_RESULTS = new Set(["won", "lost", "partially_won", "dismissed"]);

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
    const webId = requiredString(webRoute.id, "web route id");
    const mobileId = requiredString(mobileRoute.id, "mobile route id");
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

function requiredObject(value: unknown, label: string): JsonObject {
  if (typeof value !== "object" || value === null || Array.isArray(value)) throw new Error(`${label} must be an object`);
  return value as JsonObject;
}

function requiredString(value: unknown, label: string) {
  if (typeof value !== "string") throw new Error(`${label} must be a string`);
  return value;
}

function equalContract(actual: unknown, expected: unknown, label: string) {
  if (actual !== expected) throw new Error(`${label}: expected ${String(expected)}, got ${String(actual)}`);
}
