import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  REPORT_GRAPH_LAYOUT_ALGORITHM_VERSION,
  REPORT_GRAPH_LAYOUT_RENDERER_VERSION,
  REPORT_GRAPH_LAYOUT_SCHEMA_VERSION,
} from "../app/report-graph-contract";

function readJson(relativePath: string): unknown {
  return JSON.parse(
    readFileSync(new URL(relativePath, import.meta.url), "utf8"),
  );
}

const rawManifest = readJson("../app/report-manifest.v1.json");
const rawPlaybooks = readJson("../app/case-type-playbooks.v1.json");
const rawProfiles = readJson("../app/report-profiles.v1.json");

type CaseReference = { registry: string; id: string; version: string };
type ManifestOutput = {
  caseType: CaseReference;
  profileId: string;
  primary: boolean;
};
type ReportManifest = {
  format: string;
  schemaVersion: number;
  manifest: string;
  reportModel: { schemaVersion: number };
  semanticRenderer: {
    profileRegistry: string;
    profileSchemaVersion: number;
    rendererVersion: string;
  };
  layout: {
    scope: string;
    layoutSchemaVersion: number;
    layoutAlgorithmVersion: string;
    layoutRendererVersion: string;
  };
  outputs: ManifestOutput[];
};
type ProfileRegistry = {
  format: string;
  schemaVersion: number;
  registry: string;
  rendererVersion: string;
  profiles: Array<{ id: string; caseTypes: string[] }>;
};
type PlaybookRegistry = {
  playbooks: Array<{
    caseType: { id: string; version: string };
    outputs: Array<{ id: string; primary: boolean }>;
  }>;
};

function validateManifest(value: unknown) {
  const manifest = value as ReportManifest;
  const profiles = rawProfiles as ProfileRegistry;
  const playbooks = rawPlaybooks as PlaybookRegistry;
  if (
    !manifest ||
    manifest.format !== "genesis-juris-report-manifest" ||
    manifest.schemaVersion !== 1 ||
    manifest.manifest !== "genesis-juris-report-manifest" ||
    manifest.reportModel?.schemaVersion !== 1 ||
    manifest.semanticRenderer?.profileRegistry !==
      "genesis-juris-report-profiles" ||
    manifest.semanticRenderer?.profileSchemaVersion !== 1 ||
    manifest.semanticRenderer?.rendererVersion !== "1.0.0" ||
    manifest.layout?.scope !== "presentation_only" ||
    manifest.layout?.layoutSchemaVersion !==
      REPORT_GRAPH_LAYOUT_SCHEMA_VERSION ||
    manifest.layout?.layoutAlgorithmVersion !==
      REPORT_GRAPH_LAYOUT_ALGORITHM_VERSION ||
    manifest.layout?.layoutRendererVersion !==
      REPORT_GRAPH_LAYOUT_RENDERER_VERSION ||
    !Array.isArray(manifest.outputs)
  ) {
    throw new Error("Unsupported report manifest");
  }
  const profileBindings = new Set(
    profiles.profiles.flatMap((profile) =>
      profile.caseTypes.map((caseType) => `${caseType}:${profile.id}`),
    ),
  );
  const expected = new Map<string, boolean>();
  for (const playbook of playbooks.playbooks) {
    for (const output of playbook.outputs) {
      const key = `${playbook.caseType.id}:${output.id}`;
      if (expected.has(key)) {
        throw new Error(`Duplicate playbook output ${key}`);
      }
      expected.set(key, output.primary);
    }
  }
  const declared = new Map<string, boolean>();
  for (const output of manifest.outputs) {
    if (
      output.caseType.registry !== "genesis-juris-case-types" ||
      output.caseType.version !== "1.0.0" ||
      !profileBindings.has(`${output.caseType.id}:${output.profileId}`)
    ) {
      throw new Error("Unsupported report output binding");
    }
    const key = `${output.caseType.id}:${output.profileId}`;
    if (declared.has(key)) throw new Error(`Duplicate report output ${key}`);
    declared.set(key, output.primary);
  }
  if (
    declared.size !== expected.size ||
    [...expected].some(([key, primary]) => declared.get(key) !== primary)
  ) {
    throw new Error("Report manifest coverage is incomplete");
  }
  return manifest;
}

test("v62 report manifest covers every v61 playbook output exactly once", () => {
  const profiles = rawProfiles as ProfileRegistry;
  const playbooks = rawPlaybooks as PlaybookRegistry;
  const manifest = validateManifest(rawManifest);

  assert.equal(profiles.format, "genesis-juris-report-profile-registry");
  assert.equal(profiles.schemaVersion, 1);
  assert.equal(profiles.registry, "genesis-juris-report-profiles");
  assert.equal(profiles.rendererVersion, "1.0.0");
  assert.equal(playbooks.playbooks.length, 9);
  assert.equal(
    playbooks.playbooks.reduce(
      (count, playbook) => count + playbook.outputs.length,
      0,
    ),
    22,
  );
  assert.equal(manifest.outputs.length, 22);
  assert.equal(
    new Set(manifest.outputs.map((output) => output.profileId)).size,
    19,
  );
});

test("v62 report manifest rejects duplicate outputs and unknown versions", () => {
  const duplicate = structuredClone(rawManifest) as ReportManifest;
  duplicate.outputs.push(structuredClone(duplicate.outputs[0]));
  assert.throws(() => validateManifest(duplicate), /Duplicate report output/);

  const unknownLayout = structuredClone(rawManifest) as ReportManifest;
  unknownLayout.layout.layoutRendererVersion = "3.0.0";
  assert.throws(
    () => validateManifest(unknownLayout),
    /Unsupported report manifest/,
  );

  const unknownCase = structuredClone(rawManifest) as ReportManifest;
  unknownCase.outputs[0].caseType.version = "2.0.0";
  assert.throws(
    () => validateManifest(unknownCase),
    /Unsupported report output binding/,
  );
});
