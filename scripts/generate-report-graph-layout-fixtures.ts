import { readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { canonicalFingerprint } from "../app/case-integrity";
import {
  buildReportGraphLayout,
  REPORT_GRAPH_LAYOUT_ALGORITHM_VERSION,
  REPORT_GRAPH_LAYOUT_RENDERER_VERSION,
  REPORT_GRAPH_LAYOUT_SCHEMA_VERSION,
  type ReportGraphLanguage,
  type ReportGraphLayoutInput,
} from "../app/report-graph-layout";
import type { StudioNodeType } from "../app/types";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const outputPath = resolve(scriptDirectory, "../parity/report-graph-layout-fixtures.v1.json");
const fixtureHash = (kind: string, id: string) => canonicalFingerprint({ fixture: id, kind });

type FixtureNode = { detail: string; id: string; title: string; type: StudioNodeType };
type FixtureEdge = ReportGraphLayoutInput["edges"][number];
type FixtureDefinition = { id: string; input: ReportGraphLayoutInput; tags: string[] };

function node(id: string, type: StudioNodeType, title: string, detail = "") : FixtureNode {
  return { detail, id, title, type };
}

function edge(id: string, from: string, to: string, label = "", detail = "", result = "", annotations: string[] = []): FixtureEdge {
  return { annotations, detail, from, id, label, result, to };
}

function input(id: string, language: ReportGraphLanguage, nodes: FixtureNode[], edges: FixtureEdge[]): ReportGraphLayoutInput {
  return {
    caseRef: { fingerprint: fixtureHash("case", id), id: `fixture_${id.replaceAll("-", "_")}`, title: `Layout fixture: ${id}`, version: "1.0.0" },
    edges: [...edges].sort((left, right) => asciiCompare(left.id, right.id)),
    nodes: [...nodes].sort((left, right) => asciiCompare(left.id, right.id)),
    presentation: { language, redactedNodeIds: [], sourceEdgeCount: edges.length, sourceNodeCount: nodes.length },
    profileRef: { id: "decision_memorandum", kind: "legal_advisory" },
    reportRef: { contentFingerprint: fixtureHash("report", id), modelRendererVersion: "1.0.0", modelSchemaVersion: 1 },
  };
}

function bhopalFixture(): FixtureDefinition {
  const nodes = [
    node("release", "trigger", "Methyl isocyanate release", "A catastrophic release exposed surrounding communities in Bhopal."),
    node("company", "actor", "Union Carbide corporate interests", "The operator and parent-company responsibility positions require assessment."),
    node("government", "actor", "Government of India", "Public authorities represented affected interests in the settlement process."),
    node("harm", "fact", "Mass death and long-term morbidity", "Immediate casualties and continuing health consequences frame the remedy."),
    node("record", "evidence", "Exposure and health-impact record", "Exposure evidence and longitudinal health data affect compensation adequacy."),
    node("response", "decision", "Choose the accountability and remediation response", "Compare settlement finality, further remediation, and enforceable prevention."),
    node("credible", "outcome", "Evidence-led remediation and prevention", "Address documented harm and strengthen enforceable preparedness."),
    node("inadequate", "outcome", "Under-compensation and unresolved risk", "Underestimated exposure leaves affected communities and future sites exposed."),
  ];
  const edges = [
    edge("e01", "release", "company", "Identify operator responsibility"),
    edge("e02", "release", "government", "Open the public response"),
    edge("e03", "release", "harm", "Document harm"),
    edge("e04", "harm", "record", "Build the exposure record"),
    edge("e05", "company", "response", "Assess responsibility"),
    edge("e06", "government", "response", "Assess settlement options"),
    edge("e07", "record", "response", "Test compensation assumptions"),
    edge("e08", "response", "credible", "Pursue remediation"),
    edge("e09", "response", "inadequate", "Accept under-supported resolution"),
  ];
  return { id: "bhopal-en", input: input("bhopal-en", "en", nodes, edges), tags: ["bhopal", "en", "fan-in", "fan-out"] };
}

function deepFixture(): FixtureDefinition {
  const nodes = Array.from({ length: 26 }, (_, index) => node(
    `deep_${String(index + 1).padStart(2, "0")}`,
    index === 0 ? "trigger" : index === 25 ? "outcome" : index % 5 === 0 ? "decision" : "fact",
    `Deep review stage ${index + 1}`,
    "A complete layer-safe step in a deliberately deep review chain.",
  ));
  const edges = Array.from({ length: 25 }, (_, index) => edge(`deep_edge_${String(index + 1).padStart(2, "0")}`, nodes[index].id, nodes[index + 1].id, `Advance to stage ${index + 2}`));
  return { id: "deep-en", input: input("deep-en", "en", nodes, edges), tags: ["deep", "en"] };
}

function wideFixture(): FixtureDefinition {
  const nodes = [node("wide_root", "trigger", "Wide review root", "One issue fans out across nine independently visible branches.")];
  for (let index = 1; index <= 9; index += 1) nodes.push(node(`wide_${String(index).padStart(2, "0")}`, "outcome", `Parallel branch ${index}`, `Branch ${index} stays in the same topological layer.`));
  const edges = nodes.slice(1).map((target, index) => edge(`wide_edge_${String(index + 1).padStart(2, "0")}`, "wide_root", target.id, `Branch ${index + 1}`));
  return { id: "wide-en", input: input("wide-en", "en", nodes, edges), tags: ["en", "wide"] };
}

function disconnectedFixture(): FixtureDefinition {
  const nodes: FixtureNode[] = [];
  const edges: FixtureEdge[] = [];
  for (const prefix of ["alpha", "beta"]) {
    for (let index = 1; index <= 7; index += 1) nodes.push(node(`${prefix}_${String(index).padStart(2, "0")}`, index === 1 ? "trigger" : index === 7 ? "outcome" : "fact", `${prefix} component stage ${index}`, `Disconnected ${prefix} component content.`));
    for (let index = 1; index < 7; index += 1) edges.push(edge(`${prefix}_edge_${String(index).padStart(2, "0")}`, `${prefix}_${String(index).padStart(2, "0")}`, `${prefix}_${String(index + 1).padStart(2, "0")}`));
  }
  return { id: "disconnected-en", input: input("disconnected-en", "en", nodes, edges), tags: ["disconnected", "en"] };
}

function cyclicFixture(): FixtureDefinition {
  const nodes = [
    node("cycle_a", "trigger", "Cycle repair A"),
    node("cycle_b", "decision", "Cycle repair B"),
    node("cycle_c", "fact", "Cycle repair C"),
    node("cycle_end", "outcome", "Cycle repair terminal"),
  ];
  const edges = [
    edge("cycle_ab", "cycle_a", "cycle_b"),
    edge("cycle_bc", "cycle_b", "cycle_c"),
    edge("cycle_ca", "cycle_c", "cycle_a"),
    edge("cycle_ce", "cycle_c", "cycle_end"),
  ];
  return { id: "cyclic-repair-en", input: input("cyclic-repair-en", "en", nodes, edges), tags: ["cyclic-repair", "en"] };
}

function russianUnicodeFixture(): FixtureDefinition {
  const longTitle = `Полное название узла ${"сверхдлинныйнеразрывныйюникодтокен".repeat(5)}`.slice(0, 200);
  const longDetail = `${"Подробное описание доказательств и применимого правового анализа должно оставаться полностью доступным в реестре. ".repeat(45)}КОНЕЦ-ПОЛНОГО-ОПИСАНИЯ`.slice(0, 4_000);
  const nodes = [
    node("ru_start", "trigger", "Начало проверки", "Исходная точка русскоязычного отчета."),
    node("ru_long", "evidence", longTitle, longDetail),
    node("ru_end", "outcome", "Завершение проверки", "Итог сохраняет полные ссылки на материалы."),
  ];
  const edges = [edge("ru_01", "ru_start", "ru_long", "Проверить"), edge("ru_02", "ru_long", "ru_end", "Завершить")];
  return { id: "unicode-ru", input: input("unicode-ru", "ru", nodes, edges), tags: ["long-detail", "long-title", "ru"] };
}

function maximumFixture(): FixtureDefinition {
  const nodes = Array.from({ length: 200 }, (_, index) => node(
    `max_${String(index + 1).padStart(3, "0")}`,
    index === 0 ? "trigger" : index === 199 ? "outcome" : index % 11 === 0 ? "decision" : "fact",
    `Maximum bounded node ${index + 1}`,
    "Compact content for the maximum-node deterministic pagination contract.",
  ));
  const edges = Array.from({ length: 199 }, (_, index) => edge(`max_edge_${String(index + 1).padStart(3, "0")}`, nodes[Math.floor(index / 2)].id, nodes[index + 1].id));
  return { id: "max-node-en", input: input("max-node-en", "en", nodes, edges), tags: ["en", "max-node-stress"] };
}

function asciiCompare(left: string, right: string) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function asciiOrdered(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(asciiOrdered);
  if (value === null || typeof value !== "object") return value;
  return Object.fromEntries(Object.entries(value as Record<string, unknown>).sort(([left], [right]) => asciiCompare(left, right)).map(([key, item]) => [key, asciiOrdered(item)]));
}

async function generatedContract() {
  const definitions = [bhopalFixture(), deepFixture(), wideFixture(), disconnectedFixture(), cyclicFixture(), russianUnicodeFixture(), maximumFixture()];
  const fixtures = definitions.map((definition) => {
    const layout = buildReportGraphLayout(definition.input);
    return {
      expected: {
        connectors: layout.crossPageConnectorPairs.map((pair) => ({
          adjacencyRecordId: pair.adjacencyRecordId,
          edgeId: pair.edgeId,
          fromPageId: pair.fromPageId,
          id: pair.id,
          incomingId: pair.incoming.id,
          outgoingId: pair.outgoing.id,
          toPageId: pair.toPageId,
        })),
        layoutFingerprint: layout.layoutFingerprint,
        nodePages: layout.nodes.map((node) => ({ nodeId: node.id, pageId: node.pageId })).sort((left, right) => asciiCompare(left.nodeId, right.nodeId)),
      },
      id: definition.id,
      input: definition.input,
      tags: [...definition.tags].sort(asciiCompare),
    };
  });
  const fontSourceHashes = buildReportGraphLayout(definitions[0].input).typography.fontSourceHashes;
  return {
    fixtures,
    fontSourceHashes,
    format: "genesis-juris-report-graph-layout-fixtures",
    layoutAlgorithmVersion: REPORT_GRAPH_LAYOUT_ALGORITHM_VERSION,
    layoutRendererVersion: REPORT_GRAPH_LAYOUT_RENDERER_VERSION,
    layoutSchemaVersion: REPORT_GRAPH_LAYOUT_SCHEMA_VERSION,
    schemaVersion: 1,
  };
}

async function main() {
  const args = process.argv.slice(2);
  if (args.some((argument) => argument !== "--check") || args.filter((argument) => argument === "--check").length > 1) throw new Error("usage: generate-report-graph-layout-fixtures.ts [--check]");
  const output = `${JSON.stringify(asciiOrdered(await generatedContract()), null, 2)}\n`;
  if (args[0] === "--check") {
    const current = await readFile(outputPath, "utf8");
    if (current !== output) throw new Error(`${outputPath} is stale; regenerate the locked layout fixtures`);
    console.log(`verified ${outputPath}`);
    return;
  }
  await writeFile(outputPath, output, "utf8");
  console.log(`wrote ${outputPath}`);
}

await main();
