import { caseFingerprint } from "./case-integrity";
import { CANOPY_DISCLOSURE, CANOPY_SOURCES, canopyDeclaration, canopySourceText } from "./canopy-fixture";
import { studioOverview } from "./studio-overview";
import type { StudioDraft } from "./types";

/** Reference fixture material only: never substitutes for uploaded or accepted evidence. */
export function buildStudioSourcePacket(draft: StudioDraft, language: "en" | "ru") {
  const overview = studioOverview(draft, language);
  if (!overview.referenceScenario) throw new Error("No verified reference packet for this case");
  const scenario = canopyDeclaration(overview.referenceScenario);
  const versions: Record<string, number> = { D03: scenario.d03, D06: scenario.d06, D07: 2, D08: scenario.d08 };
  const selected = CANOPY_SOURCES.filter(source => source.version === (versions[source.id] ?? 1));
  const status = language === "en"
    ? "Fictional reference material. Not uploaded evidence, an executed outcome or professional approval. The selected versions follow the source scenario; amendments to this working case require reassessment."
    : "Вымышленные эталонные материалы. Это не загруженные доказательства, результат исполнения или профессиональное утверждение. Выбранные версии относятся к исходному сценарию; изменения рабочего кейса требуют пересмотра.";
  const documents = CANOPY_SOURCES.map(source => ({
    id: source.id, version: source.version, title: source.title,
    selected: selected.some(item => item.id === source.id && item.version === source.version),
    sections: { ...source.sections }, text: canopySourceText(source),
  }));
  const manifest = {
    format: "casevant-reference-source-packet", schemaVersion: 1,
    case: { caseId: draft.caseId, version: draft.version, fingerprint: caseFingerprint(draft), exampleSource: draft.exampleSource ?? null },
    sourceScenario: { id: scenario.id, version: scenario.version },
    language, status, disclosure: CANOPY_DISCLOSURE,
    selectedVersions: selected.map(source => ({ document: source.id, version: source.version })),
    documents,
  };
  const heading = language === "en" ? "Complete reference source packet" : "Полный пакет эталонных источников";
  const selectedHeading = language === "en" ? "Selected immutable versions" : "Выбранные неизменяемые версии";
  const historyHeading = language === "en" ? "Retained version history" : "Сохранённая история версий";
  const markdown = [`# ${heading}`, status, CANOPY_DISCLOSURE,
    `Case: ${draft.caseId} v${draft.version}`, `Fingerprint: ${manifest.case.fingerprint}`,
    `Source scenario: ${scenario.id} v${scenario.version}`, `## ${selectedHeading}`,
    ...selected.map(source => canopySourceText(source)), `## ${historyHeading}`,
    ...documents.filter(source => !source.selected).map(source => source.text),
  ].join("\n\n") + "\n";
  const safeId = draft.caseId.replace(/[^A-Za-z0-9_-]/g, "_").slice(0, 80);
  return { manifest, markdown, json: JSON.stringify(manifest, null, 2) + "\n", filename: `${safeId}-reference-sources` };
}

export async function prepareStudioSourcePacketDownload(draft: StudioDraft, language: "en" | "ru", format: "md" | "json", current: () => boolean) {
  if (!current()) return null;
  const packet = buildStudioSourcePacket(draft, language);
  // SHA-256 binds exact UTF-8 document bytes independently of graph citations.
  const encoder = new TextEncoder();
  const documents = await Promise.all(packet.manifest.documents.map(async source => ({ ...source,
    contentSha256: "sha256:" + Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", encoder.encode(source.text))), value => value.toString(16).padStart(2, "0")).join(""),
  })));
  if (!current()) return null;
  const manifest = { ...packet.manifest, documents };
  const hashes = documents.map(source => `${source.id} v${source.version}: ${source.contentSha256}`).join("\n");
  return {
    filename: `${packet.filename}.${format}`,
    mime: format === "md" ? "text/markdown;charset=utf-8" : "application/json;charset=utf-8",
    content: format === "md" ? packet.markdown + "\n## SHA-256\n\n" + hashes + "\n" : JSON.stringify(manifest, null, 2) + "\n",
  };
}
