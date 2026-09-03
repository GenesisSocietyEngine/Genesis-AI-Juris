import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  advanceCanonicalTime,
  canonicalAvailableActionIds,
  createCanonicalRuntime,
  dispatchCanonicalAction,
  normalizeCanonicalRuntimeState,
  type CanonicalRuntimeState,
} from "../app/canonical-runtime";
import {
  assertLockedReceiptMap,
  assertMobileRoundTripReceipt,
  assertParityFixtureMatrix,
  assertProjectedRouteMatrix,
  assertProjectedRouteParity,
  type ParityFixtureManifest,
} from "../scripts/parity-contract-assertions";

type JsonObject = Record<string, unknown>;
type Bundle = {
  cases: Array<{
    case_id: string;
    scenario_id: string;
    scenario_fingerprint: string;
    scenario: { metadata: { content_version: string }; schema_version: string; outcomes: Array<{ id: string }> };
  }>;
};

const fixtureValue = JSON.parse(
  readFileSync(new URL("../parity/mobile-parity-fixtures.json", import.meta.url), "utf8"),
) as unknown;
const bundle = JSON.parse(
  readFileSync(new URL("../app/canonical-case-bundle.json", import.meta.url), "utf8"),
) as Bundle;
const canonicalOutcomes = Object.fromEntries(bundle.cases.map((item) => [
  item.case_id,
  item.scenario.outcomes.map((outcome) => outcome.id),
]));
const requirements = { expectedRouteCount: 18, canonicalOutcomes };
const fixture = assertParityFixtureMatrix(fixtureValue, requirements);

const newRouteIds = new Set([
  "failed-erp-inactivity-termination",
  "failed-erp-procedural-default",
  "failed-erp-first-instance-final",
  "failed-erp-mixed-accepted",
  "failed-erp-appeal-win",
  "failed-erp-appeal-loss",
  "failed-erp-cassation-dismissed",
  "failed-erp-remitted-rehearing",
  "logistics-negotiated",
]);

test("v53 matrix has 18 routes, nine distinct additions, all outcomes, and 290 checkpoints", () => {
  assert.equal(fixture.routes.length, 18);
  assert.equal(fixture.routes.reduce((sum, route) => sum + route.expected.checkpoint_count, 0), 290);
  assert.equal(fixture.routes.filter((route) => newRouteIds.has(route.id)).length, 9);
  assert.equal(new Set(fixture.routes.flatMap((route) => (
    route.expected.outcome === null ? [] : [`${route.case_id}:${route.expected.outcome}`]
  ))).size, 17);
  const remittal = fixture.routes.find((route) => route.id === "failed-erp-remitted-rehearing");
  assert.ok(remittal);
  assert.ok(Object.hasOwn(remittal.expected, "outcome"));
  assert.equal(remittal.expected.outcome, null);
});

test("all 18 web routes reach their declared final state and normalize losslessly", () => {
  const routes = executeWebMatrix(fixture);
  assertProjectedRouteMatrix(fixture, routes, "test web");
});

test("matrix rejects wrong counts, duplicates, unknown cases, missing expectations, and missing save/load assertions", () => {
  expectFixtureFailure((manifest) => {
    manifest.schema_version += 1;
  }, /fixture schema version/u);
  expectFixtureFailure((manifest) => {
    manifest.matrix.version += 1;
  }, /matrix version/u);
  expectFixtureFailure((manifest) => {
    manifest.routes.pop();
  }, /route count/u);
  expectFixtureFailure((manifest) => {
    manifest.routes.push(structuredClone(manifest.routes[0]));
  }, /route count/u);
  expectFixtureFailure((manifest) => {
    manifest.routes[1].id = manifest.routes[0].id;
  }, /duplicate parity route id/u);
  expectFixtureFailure((manifest) => {
    manifest.routes[1].commands = structuredClone(manifest.routes[0].commands);
  }, /duplicate.*command path/u);
  expectFixtureFailure((manifest) => {
    manifest.routes[1].branch = manifest.routes[0].branch;
  }, /duplicate.*branch/u);
  expectFixtureFailure((manifest) => {
    manifest.routes[0].case_id = "unknown_case";
  }, /unknown canonical case/u);
  expectFixtureFailure((manifest) => {
    delete (manifest.routes[0].expected as Partial<typeof manifest.routes[0]["expected"]>).outcome;
  }, /expected outcome is missing/u);
  expectFixtureFailure((manifest) => {
    delete (manifest.routes[0].expected as Partial<typeof manifest.routes[0]["expected"]>).checkpoint_count;
  }, /expected checkpoint count/u);
  expectFixtureFailure((manifest) => {
    (manifest.routes[0].serialization as { mobile_save_load: boolean }).mobile_save_load = false;
  }, /mobile save\/load assertion/u);
});

test("checkpoint, judicial-result, and mobile-projection mutations fail exact parity", () => {
  const webRoutes = executeWebMatrix(fixture);
  const changedCheckpoint = structuredClone(webRoutes);
  const firstCommands = changedCheckpoint[0].commands as JsonObject[];
  const firstSnapshot = firstCommands[0].snapshot as JsonObject;
  firstSnapshot.clock = Number(firstSnapshot.clock) + 1;
  assert.throws(() => assertProjectedRouteParity(webRoutes, changedCheckpoint), /route projections mismatch/u);

  const changedJudicial = structuredClone(webRoutes);
  const prepared = changedJudicial.find((route) => route.id === "failed-erp-prepared");
  assert.ok(prepared);
  const preparedCommands = prepared.commands as JsonObject[];
  (preparedCommands.at(-1)!.snapshot as JsonObject).judicial_result = "lost";
  assert.throws(() => assertProjectedRouteParity(webRoutes, changedJudicial), /route projections mismatch/u);

  const changedProjection = structuredClone(webRoutes);
  const projectionCommands = changedProjection[0].commands as JsonObject[];
  (projectionCommands[0].snapshot as JsonObject).resources = { corrupted: 1 };
  assert.throws(() => assertProjectedRouteParity(webRoutes, changedProjection), /route projections mismatch/u);
});

test("route hashes, save digests, restored snapshots, and save revisions are locked", () => {
  assert.throws(
    () => assertLockedReceiptMap({ route: "changed" }, { route: "locked" }, "route hashes"),
    /route hashes mismatch/u,
  );
  assert.throws(
    () => assertLockedReceiptMap({ route: "locked" }, { route: "changed" }, "save digests"),
    /save digests mismatch/u,
  );

  const route = executeWebMatrix(fixture)[0];
  const commands = route.commands as JsonObject[];
  const finalSnapshot = commands.at(-1)!.snapshot as JsonObject;
  const receipt = {
    ...route,
    identity: { scenario_id: "scenario", fingerprint: "fingerprint" },
    round_trip: {
      inspection: { scenario_id: "scenario", scenario_fingerprint: "fingerprint" },
      loaded_snapshot: structuredClone(finalSnapshot),
      matches_final: true,
      resaved_matches: true,
      save: {
        schema_id: "genesis.ai-juris.command-log",
        schema_version: 1,
        runtime_compatibility: "scenario-runtime-v2",
        scenario_id: "scenario",
        scenario_fingerprint: "fingerprint",
        seed: route.seed,
        command_count: commands.length,
        final_state_digest: createHash("sha256").update("receipt").digest("hex"),
      },
    },
  };
  const saveLock = {
    mobileSaveSchemaId: "genesis.ai-juris.command-log",
    mobileSaveSchemaRevision: 1,
    mobileRuntimeCompatibility: "scenario-runtime-v2",
  };
  assert.doesNotThrow(() => assertMobileRoundTripReceipt(receipt, saveLock));

  const changedLoaded = structuredClone(receipt);
  (changedLoaded.round_trip.loaded_snapshot as JsonObject).clock =
    Number((changedLoaded.round_trip.loaded_snapshot as JsonObject).clock) + 1;
  assert.throws(() => assertMobileRoundTripReceipt(changedLoaded, saveLock), /loaded snapshot mismatch/u);

  const changedResave = structuredClone(receipt);
  changedResave.round_trip.resaved_matches = false;
  assert.throws(() => assertMobileRoundTripReceipt(changedResave, saveLock), /re-saved command-log assertion/u);
  assert.throws(
    () => assertMobileRoundTripReceipt(receipt, { ...saveLock, mobileSaveSchemaRevision: 2 }),
    /save schema revision/u,
  );
});

function expectFixtureFailure(mutator: (manifest: ParityFixtureManifest) => void, pattern: RegExp) {
  const changed = structuredClone(fixture);
  mutator(changed);
  assert.throws(() => assertParityFixtureMatrix(changed, requirements), pattern);
}

function executeWebMatrix(manifest: ParityFixtureManifest): JsonObject[] {
  const cases = new Map(bundle.cases.map((item) => [item.case_id, item]));
  return manifest.routes.map((route) => {
    const canonicalCase = cases.get(route.case_id);
    assert.ok(canonicalCase);
    let state = createCanonicalRuntime(route.case_id, route.seed);
    const initial = projectState(state);
    const commands = route.commands.map((command) => {
      state = command.kind === "dispatch"
        ? dispatchCanonicalAction(state, command.action_id)
        : advanceCanonicalTime(state, command.minutes);
      return { command, snapshot: projectState(state) };
    });
    const restored = normalizeCanonicalRuntimeState(
      JSON.parse(JSON.stringify(state)),
      state.caseId,
      state.sourceFingerprint,
    );
    assert.ok(restored);
    assert.deepEqual(projectState(restored), projectState(state));
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

function projectState(state: CanonicalRuntimeState): JsonObject {
  return {
    stage: state.stageId,
    clock: state.clockMinutes,
    actions: canonicalAvailableActionIds(state).sort(),
    resources: canonicalize(state.resources),
    numeric_metrics: canonicalize(state.numericMetrics),
    evidence: [...state.availableEvidence].sort(),
    deadlines: Object.keys(state.deadlineStatuses)
      .filter((id) => state.deadlineStatuses[id] !== null)
      .sort()
      .map((id) => ({
        id,
        status: state.deadlineStatuses[id],
        due_minutes: state.deadlineDueMinutes[id],
      })),
    inbox: [...state.visibleInbox].sort().map((id) => ({
      id,
      resolved: state.resolvedInbox.includes(id),
    })),
    judicial_result: state.judicialResult,
    outcome: state.outcomeId,
  };
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (typeof value === "object" && value !== null) {
    const object = value as JsonObject;
    return Object.fromEntries(Object.keys(object).sort().map((key) => [key, canonicalize(object[key])]));
  }
  return value;
}
