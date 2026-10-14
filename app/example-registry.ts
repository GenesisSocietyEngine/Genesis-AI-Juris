import { CATEGORY_DEMOS, CATEGORY_DEMO_VERSION } from "./category-demos";
import { CONVERTED_EXAMPLES, CONVERTED_EXAMPLE_VERSION } from "./converted-example-descriptors";
import { bundledCataloguePresentation } from "./catalogue-fallback";
import { CANOPY_INDEPENDENT_VERSIONS } from "./canopy-example-versions";
import type { CanopyScenarioId } from "./canopy-fixture";
import type { CaseTypeId, LocalText, StudioDraft } from "./types";

export type ExampleId = `category:${CaseTypeId}` | `converted:${string}` | `canopy:${CanopyScenarioId}`;
type PreparedExample = { draft: StudioDraft; prompt: string };
export type ExampleDescriptor = {
  id: ExampleId;
  family: "category" | "converted" | "canopy";
  /** Group variants into one library card; this is never a working-case save key. */
  cardId: string;
  source: { caseId: string; version: string };
  category: CaseTypeId;
  title: LocalText;
  description: LocalText;
  topics: readonly string[];
  jurisdiction: LocalText;
  guidance: "canopy" | null;
  visible: boolean;
  prepare: (locale: "en" | "ru") => Promise<PreparedExample>;
};
const text = (en: string, ru = en): LocalText => ({ en, ru });

const categories: ExampleDescriptor[] = CATEGORY_DEMOS.map(demo => ({
  id: `category:${demo.caseTypeId}`, family: "category", cardId: demo.caseTypeId,
  source: { caseId: `demo_${demo.caseTypeId}`, version: CATEGORY_DEMO_VERSION },
  category: demo.caseTypeId, title: demo.title, description: demo.question,
  topics: ["category-demo"], jurisdiction: text("Fictional / unspecified", "Учебная / не указана"),
  guidance: null, visible: true,
  prepare: async locale => {
    const [{ buildCategoryDemo }, { categoryDemoPrompt }] = await Promise.all([
      import("./category-demo-draft"), import("./category-demo-prompts"),
    ]);
    return { draft: buildCategoryDemo(demo.caseTypeId, locale), prompt: categoryDemoPrompt(demo.caseTypeId, locale) };
  },
}));
const converted: ExampleDescriptor[] = Object.entries(CONVERTED_EXAMPLES).map(([id, spec]) => ({
  id: `converted:${id}`, family: "converted", cardId: id,
  source: { caseId: id, version: CONVERTED_EXAMPLE_VERSION }, category: spec.category,
  title: text(spec.title, bundledCataloguePresentation[id].titleRu),
  description: text(spec.description), topics: spec.topics,
  jurisdiction: text(spec.jurisdiction),
  guidance: null, visible: true,
  prepare: async locale => {
    const { buildConvertedExample } = await import("./converted-examples");
    const draft = buildConvertedExample(id, locale);
    return { draft, prompt: draft.premise };
  },
}));
export const CANOPY_EXAMPLE_VARIANTS = [
  { scenario: "base", label: text("Base", "Базовый"), description: text("Review a conditional 90-day pilot with outstanding evidence.", "Проверьте условия 90-дневного пилота и недостающие подтверждения.") },
  { scenario: "upside", label: text("Upside", "Благоприятный"), description: text("See how stronger demand and accepted evidence change the decision.", "Посмотрите, как подтверждённый спрос и новые доказательства меняют решение.") },
  { scenario: "hard_stop", label: text("Hard stop", "Стоп-условие"), description: text("Check why failed mandatory clearance blocks an attractive proposal.", "Проверьте, почему обязательное условие блокирует выгодное предложение.") },
  { scenario: "downside", label: text("Downside", "Неблагоприятный"), description: text("Test weaker demand, lower yield and higher energy costs.", "Проверьте снижение спроса и выхода продукции при росте энергозатрат.") },
] as const;
const canopy: ExampleDescriptor[] = [
  ...CANOPY_EXAMPLE_VARIANTS,
  { scenario: "hard_stop_unavailable" as const, label: text("Clearance unavailable", "Подтверждение недоступно"), description: text("Retained alternative: missing clearance does not assert a failed inspection.", "Сохранённая альтернатива: отсутствие подтверждения не означает провал проверки.") },
].map(variant => ({
  id: `canopy:${variant.scenario}`, family: "canopy", cardId: "canopy",
  source: { caseId: "project_canopy_managed_site_expansion" + (variant.scenario === "base" ? "" : "_" + variant.scenario), version: CANOPY_INDEPENDENT_VERSIONS[variant.scenario] },
  category: "general_advisory", title: text("Project Canopy"), description: variant.description,
  topics: ["Business expansion", "Investment decision", "Operational readiness"],
  jurisdiction: text("Fictional Gulf market"), guidance: "canopy",
  visible: variant.scenario !== "hard_stop_unavailable",
  prepare: async () => {
    const { buildCanopyPackage } = await import("./canopy-fixture");
    const draft = buildCanopyPackage(variant.scenario, true).draft;
    return { draft, prompt: draft.premise };
  },
}));

/** Metadata is safe to browse. Draft builders and their source bundles stay lazy. */
export const EXAMPLE_REGISTRY: readonly ExampleDescriptor[] = [...canopy, ...converted, ...categories];
export function exampleDescriptor(id: ExampleId): ExampleDescriptor {
  const descriptor = EXAMPLE_REGISTRY.find(item => item.id === id);
  if (!descriptor) throw new Error("Unknown example package");
  return descriptor;
}
export async function prepareExample(id: ExampleId, locale: "en" | "ru"): Promise<PreparedExample> {
  const descriptor = exampleDescriptor(id);
  const prepared = await descriptor.prepare(locale);
  if (prepared.draft.caseId !== descriptor.source.caseId || prepared.draft.version !== descriptor.source.version
    || prepared.draft.caseType?.id !== descriptor.category) throw new Error("Example registry/source mismatch");
  return prepared;
}

/** Explicit historical preparation; never substitute today's template for saved lineage. */
export async function prepareExampleVersion(id: ExampleId, locale: "en" | "ru", version: string): Promise<PreparedExample> {
  const descriptor = exampleDescriptor(id);
  if (version === descriptor.source.version) return prepareExample(id, locale);
  if (descriptor.family === "converted" && version === "2.2.0") {
    const { buildConvertedExample } = await import("./converted-examples");
    const draft = buildConvertedExample(descriptor.source.caseId, locale, undefined, version);
    return { draft, prompt: draft.premise };
  }
  throw new Error("Unsupported example version");
}
