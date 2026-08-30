import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  assertJudicialResultParity,
  assertMobileContractValues,
  assertWebContractValues,
} from "../scripts/parity-contract-assertions";

test("judicial-result parity requires explicit nulls and compares non-null runtime values", () => {
  const webRoutes = [{
    id: "judicial-route",
    initial: { judicial_result: null },
    commands: [{ snapshot: { judicial_result: "lost" } }],
  }];
  const exactMobileRoutes = [{
    id: "judicial-route",
    initial: { judicial_result: null },
    commands: [{ snapshot: { judicial_result: "lost" } }],
  }];
  assert.equal(assertJudicialResultParity(webRoutes, exactMobileRoutes), 1);

  const omittedMobileField = [{
    id: "judicial-route",
    initial: {},
    commands: [{ snapshot: { judicial_result: "lost" } }],
  }];
  assert.throws(
    () => assertJudicialResultParity(webRoutes, omittedMobileField),
    /missing and null are not equivalent/u,
  );

  const changedMobileValue = [{
    id: "judicial-route",
    initial: { judicial_result: null },
    commands: [{ snapshot: { judicial_result: "won" } }],
  }];
  assert.throws(
    () => assertJudicialResultParity(webRoutes, changedMobileValue),
    /judicial result/u,
  );
});

test("web parity-lock contracts fail for changed lock or authoritative values", () => {
  const lock = {
    webRuntimeRevision: "canonical-runtime-v1",
    playedCaseSchemaRevision: 3,
  };
  const authoritative = {
    webRuntimeRevision: "canonical-runtime-v1",
    playedCaseSchemaRevision: 3,
  };
  assert.doesNotThrow(() => assertWebContractValues(lock, authoritative));
  assert.throws(
    () => assertWebContractValues({ ...lock, playedCaseSchemaRevision: 4 }, authoritative),
    /played-case schema revision/u,
  );
  assert.throws(
    () => assertWebContractValues(lock, { ...authoritative, webRuntimeRevision: "canonical-runtime-v2" }),
    /web runtime revision/u,
  );
});

test("compiled mobile contract receipts fail for changed lock or runtime values", () => {
  const lock = {
    mobileSnapshotSchemaRevision: 1,
    mobileProjectionSchemaRevision: 1,
    mobileBridgeAbi: 1,
  };
  const receipt = {
    mobile_snapshot_schema_revision: 1,
    mobile_projection_schema_revision: 1,
    mobile_bridge_abi: 1,
  };
  assert.doesNotThrow(() => assertMobileContractValues(lock, receipt));
  assert.throws(
    () => assertMobileContractValues({ ...lock, mobileBridgeAbi: 2 }, receipt),
    /mobile bridge ABI/u,
  );
  assert.throws(
    () => assertMobileContractValues(lock, { ...receipt, mobile_snapshot_schema_revision: 2 }),
    /mobile snapshot schema revision/u,
  );
});

test("the compiled probe preserves the pinned lock and binds both judicial projections", () => {
  const verifier = readFileSync(new URL("../scripts/verify-mobile-parity.ts", import.meta.url), "utf8");
  const probe = readFileSync(new URL("../scripts/mobile-parity-probe.rs", import.meta.url), "utf8");

  assert.doesNotMatch(verifier, /generate-lockfile/u);
  assert.match(verifier, /"archive", "--format=tar"/u);
  assert.match(verifier, /"--package",\s+"juris-mobile-ffi"/u);
  assert.match(verifier, /archived Cargo\.lock byte identity/u);
  assert.match(verifier, /Cargo changed the pinned mobile lock/u);
  assert.match(probe, /required_nullable_string\(dossier, "judicial_result", context\)/u);
  assert.match(probe, /dossier_judicial_result != judicial_result/u);
});
