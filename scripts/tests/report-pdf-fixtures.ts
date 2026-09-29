import { caseTypePlaybook } from "../../app/case-type-playbooks";
import { caseTypeReference } from "../../app/case-type-reference";
import type { CaseTypeId, StudioDraft, StudioLink, StudioNode, StudioNodeType } from "../../app/types";

export type ReportPdfFixture = {
  id: string;
  family: string;
  tags: string[];
  parityFixtureId?: string;
  language: "en" | "ru";
  audience: "internal" | "client";
  draft: StudioDraft;
  minimumPages?: number;
};

const PRIMARY_TYPES: CaseTypeId[] = [
  "general_advisory",
  "litigation_strategy",
  "contract_review",
  "tax_planning",
  "compliance",
  "erp_incident",
  "investigation",
  "training_simulation",
];

const NODE_TYPES: StudioNodeType[] = ["trigger", "actor", "fact", "evidence", "decision", "deadline", "entity", "tax_rule", "cash_flow", "outcome"];
const FIXED_UPDATED_AT = "2026-09-01T09:00:00.000Z";

function node(id: string, index: number, title: string, detail: string, type = NODE_TYPES[index % NODE_TYPES.length]): StudioNode {
  return { id, type, title, detail, x: (index % 6) * 210, y: Math.floor(index / 6) * 145 };
}

function edge(from: string, to: string, index: number, language: "en" | "ru" = "en"): StudioLink {
  const label = language === "en" ? `Route ${String(index + 1).padStart(3, "0")}` : `Маршрут ${String(index + 1).padStart(3, "0")}`;
  return {
    id: `edge-${String(index + 1).padStart(3, "0")}`,
    from,
    to,
    rule: {
      label,
      detail: language === "en" ? "Preserve the directed review path." : "Сохранить направленный путь проверки.",
      result: language === "en" ? "Continue to the named record." : "Перейти к указанной записи.",
      repeatability: "once",
    },
  };
}

function draft(id: string, title: string, premise: string, nodes: StudioNode[], links: StudioLink[], caseType: CaseTypeId = "general_advisory"): StudioDraft {
  return {
    caseId: id,
    version: "1.0.0",
    caseType: caseTypeReference(caseType),
    parent: null,
    title,
    jurisdiction: "Belgium / European Union",
    role: "Responsible professional reviewer",
    premise,
    classification: {
      domain: caseType === "tax_planning" ? "tax" : "general",
      practiceArea: "Report graph layout verification",
      difficulty: "Expert",
      tags: ["v62", "pdf", "layout", "governed"],
      taxTopics: caseType === "tax_planning" ? ["lawful planning"] : [],
      complianceOnly: true,
      purpose: "compliance_review",
      legalAsOf: "2026-09-01",
      sourceUrls: ["https://eur-lex.europa.eu/", "https://example.com/verified-authority"],
    },
    nodes,
    links,
    editHistory: [
      { id: "private-prompt", role: "author", source: "prompt", action: "prompt_submitted", message: "SECRET RAW PROMPT MUST NOT APPEAR", createdAt: "2026-09-01T08:00:00.000Z" },
      { id: "review-record", role: "author", source: "visual", action: "node_updated", message: "Fixture evidence reviewed.", createdAt: FIXED_UPDATED_AT },
    ],
    updatedAt: FIXED_UPDATED_AT,
  };
}

function goldenDraft(id: CaseTypeId, stress = false, language: "en" | "ru" = "en"): StudioDraft {
  const playbook = caseTypePlaybook(caseTypeReference(id));
  let index = 0;
  const nodes = playbook.requiredNodeGroups.flatMap((group) => Array.from({ length: group.minimum }, () => {
    const type = group.types[0] as StudioNodeType;
    const current = index;
    index += 1;
    const groupLabel = group.label[language];
    return node(`${type}-${index}`, current, `${groupLabel} ${index}`, stress
      ? (language === "en"
        ? "A long governed professional record with source, owner, date, limitation, verification status and reviewer qualification. "
        : "Подробная контролируемая профессиональная запись с источником, владельцем, датой, ограничением, статусом проверки и квалификацией рецензента. ").repeat(18)
      : language === "en"
        ? `Reviewable ${groupLabel.toLowerCase()} with source, owner, date, limitation and verification status.`
        : `Проверяемая запись «${groupLabel.toLowerCase()}» с источником, владельцем, датой, ограничением и статусом проверки.`, type);
  }));
  if (stress) {
    for (let extra = 0; extra < 28; extra += 1) {
      const current = nodes.length;
      nodes.push(node(`fact-stress-${extra + 1}`, current, `Extended governed record ${extra + 1}`,
        "Extended evidence narrative with qualifications, assumptions, provenance and reviewer notes. ".repeat(20), "fact"));
    }
  }
  const links = nodes.slice(1).map((item, linkIndex) => edge(nodes[linkIndex].id, item.id, linkIndex, language));
  return draft(
    `${id}_${stress ? "long_stress" : "golden"}`,
    `${playbook.label[language]} - ${language === "en" ? "governed fixture" : "контролируемый сценарий"}`,
    stress
      ? (language === "en"
        ? "A long professional matter used to verify stable pagination, complete registers, cross-page graph markers and readable graph appendices. "
        : "Объёмный профессиональный материал для проверки стабильной пагинации, полных реестров, межстраничных маркеров графа и читаемых приложений. ").repeat(14)
      : language === "en"
        ? "A professional matter used to verify a versioned, explainable, testable and reusable decision package."
        : "Профессиональный материал для проверки версионируемого, объяснимого, тестируемого и повторно используемого пакета решений.",
    nodes,
    links,
    id,
  );
}

function chainFixture(id: string, count: number, language: "en" | "ru" = "en") {
  const nodes = Array.from({ length: count }, (_, index) => node(
    `${id}-node-${index + 1}`,
    index,
    language === "en" ? `Deep review stage ${String(index + 1).padStart(2, "0")}` : `Этап глубокой проверки ${String(index + 1).padStart(2, "0")}`,
    language === "en" ? "A complete sequential record retained for deterministic pagination." : "Полная последовательная запись для детерминированной разбивки на страницы.",
  ));
  const links = nodes.slice(1).map((item, index) => edge(nodes[index].id, item.id, index, language));
  return draft(id, language === "en" ? "Deep graph stress" : "Проверка глубокой схемы", "A directed chain that must retain every edge and page transition.", nodes, links);
}

function wideFixture() {
  const roots = Array.from({ length: 8 }, (_, index) => node(`wide-root-${index + 1}`, index, `Wide source lane ${index + 1}`, "Independent source lane for width compaction.", index === 0 ? "trigger" : "fact"));
  const middle = Array.from({ length: 12 }, (_, index) => node(`wide-middle-${index + 1}`, roots.length + index, `Wide analysis lane ${index + 1}`, "Parallel analysis record that must remain inside the printable frame.", "decision"));
  const outcomes = Array.from({ length: 8 }, (_, index) => node(`wide-outcome-${index + 1}`, roots.length + middle.length + index, `Wide outcome lane ${index + 1}`, "Parallel outcome retained after graph compaction.", "outcome"));
  const nodes = [...roots, ...middle, ...outcomes];
  const pairs: Array<[string, string]> = [];
  middle.forEach((item, index) => pairs.push([roots[index % roots.length].id, item.id]));
  outcomes.forEach((item, index) => pairs.push([middle[index].id, item.id], [middle[(index + 4) % middle.length].id, item.id]));
  return draft("wide_graph_stress", "Wide layered graph stress", "A broad three-layer graph used to verify horizontal compaction and full-width graph placement.", nodes, pairs.map((pair, index) => edge(pair[0], pair[1], index)));
}

function fanFixture(direction: "out" | "in", language: "en" | "ru" = "en") {
  const center = node(`fan-${direction}-center`, 0, language === "en" ? `Fan-${direction} control point` : `Центр сведения входящих связей`, "The central graph record.", direction === "out" ? "trigger" : "decision");
  const leaves = Array.from({ length: 18 }, (_, index) => node(
    `fan-${direction}-leaf-${index + 1}`,
    index + 1,
    language === "en" ? `Fan ${direction} branch ${index + 1}` : `Входящая ветвь ${index + 1}`,
    language === "en" ? "A parallel governed branch." : "Параллельная контролируемая ветвь.",
    direction === "out" ? "outcome" : "evidence",
  ));
  const links = leaves.map((leaf, index) => edge(direction === "out" ? center.id : leaf.id, direction === "out" ? leaf.id : center.id, index, language));
  return draft(`fan_${direction}_stress_${language}`, language === "en" ? `Fan-${direction} graph stress` : "Проверка сведения входящих связей", "A high-degree graph used to verify routing and marker pairing.", [center, ...leaves], links);
}

function disconnectedFixture() {
  const nodes = Array.from({ length: 24 }, (_, index) => node(`disconnected-${index + 1}`, index, `Disconnected component record ${index + 1}`, "One of four intentionally disconnected governed components."));
  const links: StudioLink[] = [];
  for (let component = 0; component < 4; component += 1) {
    for (let offset = 1; offset < 6; offset += 1) {
      const from = component * 6 + offset - 1;
      const to = component * 6 + offset;
      links.push(edge(nodes[from].id, nodes[to].id, links.length));
    }
  }
  return draft("disconnected_graph_stress", "Disconnected graph stress", "Four disconnected components must remain explicit and must never be interleaved.", nodes, links);
}

function cyclicFixture() {
  const nodes = Array.from({ length: 16 }, (_, index) => node(`cycle-node-${index + 1}`, index, `Cyclic repair record ${index + 1}`, "A cycle member retained while the layout derives a deterministic repair order."));
  const pairs: Array<[string, string]> = nodes.slice(1).map((item, index) => [nodes[index].id, item.id]);
  pairs.push([nodes[15].id, nodes[4].id], [nodes[10].id, nodes[2].id], [nodes[7].id, nodes[12].id]);
  return draft("cyclic_repair_stress", "Cyclic repair graph stress", "A cyclic authored graph used to verify deterministic strongly connected component repair without losing canonical direction.", nodes, pairs.map((pair, index) => edge(pair[0], pair[1], index)));
}

function longTitleFixture(language: "en" | "ru") {
  const phrase = language === "en"
    ? "Complete cross-border evidential review title preserving every authored word through Unicode-safe wrapping"
    : "Полное название трансграничной проверки доказательств с сохранением каждого слова при переносе Юникода";
  const titleSuffix = language === "en" ? "governed record" : "управляемая запись";
  const nodes = Array.from({ length: 12 }, (_, index) => node(`long-title-${language}-${index + 1}`, index, `${phrase} - ${titleSuffix} ${index + 1}`,
    language === "en" ? "The detail is deliberately short so title wrapping is isolated." : "Описание намеренно короткое для отдельной проверки переноса названия."));
  return draft(`long_title_stress_${language}`, language === "en" ? "Long title graph stress" : "Проверка длинных названий", "Every authored title must be present without clipping or ellipsis.", nodes, nodes.slice(1).map((item, index) => edge(nodes[index].id, item.id, index, language)));
}

function longDetailFixture() {
  const detail = "Подробная проверяемая запись включает источник, владельца, дату, ограничение, неопределённость и статус независимой проверки. ".repeat(16);
  const nodes = Array.from({ length: 14 }, (_, index) => node(`long-detail-ru-${index + 1}`, index, `Запись с полным описанием ${index + 1}`, `${detail}Номер записи ${index + 1}.`));
  return draft("long_detail_stress_ru", "Проверка длинных описаний", "Каждое описание должно переноситься без многоточия и оставаться в границах карточки.", nodes, nodes.slice(1).map((item, index) => edge(nodes[index].id, item.id, index, "ru")));
}

function unicodeFixture(language: "en" | "ru") {
  const titles = language === "en"
    ? ["Café evidence € 1,250", "São Paulo authority review", "naïve assumption challenged", "Coöperative entity record", "Final résumé approved"]
    : ["Исходная проверка фактов", "Организация и её полномочия", "Доказательство получено", "Решение проверено", "Итоговый вывод утверждён"];
  const nodes = titles.map((title, index) => node(`unicode-${language}-${index + 1}`, index, title,
    language === "en" ? "Unicode text remains searchable and measurable." : "Текст Юникода остаётся доступным для поиска и измерения."));
  return draft(`unicode_${language}_stress`, language === "en" ? "English Unicode graph stress" : "Русская проверка Юникода", "Unicode extraction and font metrics must remain exact.", nodes, nodes.slice(1).map((item, index) => edge(nodes[index].id, item.id, index, language)));
}

function maxNodeFixture() {
  const nodes = Array.from({ length: 200 }, (_, index) => node(`max-node-${String(index + 1).padStart(3, "0")}`, index,
    `Maximum envelope record ${String(index + 1).padStart(3, "0")}`, "Bounded record at the supported 200-node pilot envelope."));
  const links: StudioLink[] = [];
  for (let index = 1; index < nodes.length; index += 1) {
    links.push(edge(nodes[Math.floor((index - 1) / 2)].id, nodes[index].id, links.length));
  }
  return draft("maximum_200_node_stress", "Maximum 200-node graph stress", "The supported maximum node envelope must paginate deterministically with every record and edge preserved.", nodes, links);
}

function bhopalParityFixture() {
  const records: Array<[StudioNodeType, string, string]> = [
    ["trigger", "Methyl isocyanate release", "A catastrophic release exposed surrounding communities in Bhopal."],
    ["actor", "Union Carbide corporate interests", "The operator and parent-company responsibility positions require assessment."],
    ["actor", "Government of India", "Public authorities represented affected interests in the settlement process."],
    ["fact", "Mass death and long-term morbidity", "Immediate casualties and continuing health consequences frame the remedy."],
    ["evidence", "Exposure and health-impact record", "Exposure evidence and longitudinal health data affect compensation adequacy."],
    ["decision", "Choose the accountability and remediation response", "Compare settlement finality, further remediation, and enforceable prevention."],
    ["outcome", "Evidence-led remediation and prevention", "Address documented harm and strengthen enforceable preparedness."],
    ["outcome", "Under-compensation and unresolved risk", "Underestimated exposure leaves affected communities and future sites exposed."],
  ];
  const nodeIds = ["release", "company", "government", "harm", "record", "response", "credible", "inadequate"];
  const nodes = records.map(([type, title, detail], index) => node(nodeIds[index], index, title, detail, type));
  const edgeRecords: Array<[string, string, string, string]> = [
    ["e01", "release", "company", "Identify operator responsibility"],
    ["e02", "release", "government", "Open the public response"],
    ["e03", "release", "harm", "Document harm"],
    ["e04", "harm", "record", "Build the exposure record"],
    ["e05", "company", "response", "Assess responsibility"],
    ["e06", "government", "response", "Assess settlement options"],
    ["e07", "record", "response", "Test compensation assumptions"],
    ["e08", "response", "credible", "Pursue remediation"],
    ["e09", "response", "inadequate", "Accept under-supported resolution"],
  ];
  const links: StudioLink[] = edgeRecords.map(([id, from, to, label]) => ({ id, from, to, rule: { detail: "", label, result: "" } }));
  return draft("fixture_bhopal_en", "Layout fixture: bhopal-en",
    "A governed decision memorandum fixture locked to the canonical eight-node Bhopal parity graph.",
    nodes, links, "general_advisory");
}

export function reportPdfFixtures(): ReportPdfFixture[] {
  const fixtures: ReportPdfFixture[] = [];
  for (const id of PRIMARY_TYPES) {
    for (const language of ["en", "ru"] as const) {
      for (const audience of ["internal", "client"] as const) {
        fixtures.push({
          id: `golden-${id}-${language}-${audience}`,
          family: "golden",
          tags: ["golden", id, language, audience],
          language,
          audience,
          draft: goldenDraft(id, false, language),
        });
      }
    }
  }

  for (const id of ["litigation_strategy", "training_simulation"] as const) {
    fixtures.push({ id: `long-content-${id}`, family: "long-content", tags: ["long-content", id, "en", "internal"], language: "en", audience: "internal", draft: goldenDraft(id, true), minimumPages: 10 });
  }

  fixtures.push({
    id: "golden-bhopal-decision-memorandum",
    family: "bhopal",
    tags: ["golden", "release-blocking", "bhopal", "parity", "en", "internal"],
    parityFixtureId: "bhopal-en",
    language: "en",
    audience: "internal",
    draft: bhopalParityFixture(),
  });

  const stress: Array<[string, string, "en" | "ru", StudioDraft]> = [
    ["stress-deep", "deep", "en", chainFixture("deep_graph_stress", 36)],
    ["stress-wide", "wide", "en", wideFixture()],
    ["stress-fan-out", "fan-out", "en", fanFixture("out")],
    ["stress-fan-in-ru", "fan-in", "ru", fanFixture("in", "ru")],
    ["stress-disconnected", "disconnected", "en", disconnectedFixture()],
    ["stress-cyclic-repair", "cyclic-repair", "en", cyclicFixture()],
    ["stress-long-title-en", "long-title", "en", longTitleFixture("en")],
    ["stress-long-title-ru", "long-title", "ru", longTitleFixture("ru")],
    ["stress-long-detail-ru", "long-detail", "ru", longDetailFixture()],
    ["stress-unicode-en", "unicode-en", "en", unicodeFixture("en")],
    ["stress-unicode-ru", "unicode-ru", "ru", unicodeFixture("ru")],
    ["stress-max-200", "max-node", "en", maxNodeFixture()],
  ];
  for (const [id, family, language, value] of stress) {
    fixtures.push({ id, family, tags: ["stress", "release-blocking", family, language, "internal"], language, audience: "internal", draft: value });
  }
  return fixtures;
}
