import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { reportPdfFixtures } from "./report-pdf-fixtures";

const PROJECT_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

test("PDF corpus contains the single exact locked Bhopal decision-memorandum fixture", () => {
  const fixtures = reportPdfFixtures();
  assert.equal(fixtures.length, 47);
  assert.equal(fixtures.filter((fixture) => fixture.family === "golden").length, 32);
  assert.equal(fixtures.filter((fixture) => fixture.family === "long-content").length, 2);

  const matches = fixtures.filter((fixture) => fixture.parityFixtureId === "bhopal-en");
  assert.equal(matches.length, 1);
  const fixture = matches[0];
  assert.equal(fixture.id, "golden-bhopal-decision-memorandum");
  assert.equal(fixture.family, "bhopal");
  assert.equal(fixture.language, "en");
  assert.equal(fixture.audience, "internal");
  assert.equal(fixture.draft.caseId, "fixture_bhopal_en");
  assert.equal(fixture.draft.title, "Layout fixture: bhopal-en");
  assert.equal(fixture.draft.version, "1.0.0");
  assert.equal(fixture.draft.caseType?.id, "general_advisory");

  const lock = JSON.parse(readFileSync(resolve(PROJECT_ROOT, "parity/report-graph-layout-fixtures.v1.json"), "utf8")) as {
    fixtures: Array<{ id: string; input: { nodes: unknown[]; edges: unknown[] } }>;
  };
  const locked = lock.fixtures.find((candidate) => candidate.id === "bhopal-en");
  assert.ok(locked);
  const compareIds = <T extends { id: string }>(left: T, right: T) =>
    left.id < right.id ? -1 : left.id > right.id ? 1 : 0;
  const nodes = fixture.draft.nodes
    .map(({ id, type, title, detail }) => ({ detail, id, title, type }))
    .sort(compareIds);
  const edges = fixture.draft.links
    .map((link) => ({
      annotations: [],
      detail: link.rule?.detail ?? "",
      from: link.from,
      id: link.id,
      label: link.rule?.label ?? "",
      result: link.rule?.result ?? "",
      to: link.to,
    }))
    .sort(compareIds);
  assert.equal(nodes.length, 8);
  assert.equal(edges.length, 9);
  assert.deepEqual(nodes, locked.input.nodes);
  assert.deepEqual(edges, locked.input.edges);
  assert.ok(fixture.draft.links.every((link) => link.rule?.repeatability === undefined));
});
