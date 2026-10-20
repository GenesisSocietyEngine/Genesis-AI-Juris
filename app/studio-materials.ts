import { buildConvertedSourcePacket } from "./converted-source-packet";
import { buildStudioSourcePacket } from "./studio-source-packet";
import { studioOverview } from "./studio-overview";
import { casePublicationFingerprint } from "./case-integrity";
import type { StudioDraft } from "./types";

export type StudioMaterial = {
  id: string; title: string; kind: "working" | "reference" | "missing" | "url";
  text: string | null; note: string; nodeIds: string[]; selected: boolean;
};
/** A reading projection. Original documents that were never supplied have no invented body. */
export async function studioMaterials(draft: StudioDraft, locale: "en" | "ru"): Promise<StudioMaterial[]> {
  const materials: StudioMaterial[] = draft.nodes.filter(node => node.type === "evidence").map(node => ({
    id: `working:${node.id}`, title: node.title, kind: "working", text: node.detail,
    note: locale === "en" ? "Working evidence record · review is separate" : "Рабочая запись материала · проверка отдельно",
    nodeIds: [node.id, ...draft.links.flatMap(link => link.from === node.id ? [link.to] : link.to === node.id ? [link.from] : [])], selected: true,
  }));
  const overview = studioOverview(draft, locale);
  if (overview.referenceScenario) {
    const packet = buildStudioSourcePacket(draft, locale);
    for (const document of packet.manifest.documents) materials.push({
      id: `canopy:${document.id}:v${document.version}`, title: `${document.id} v${document.version} — ${document.title}`,
      kind: "reference", text: document.text, note: locale === "en" ? "Fictional reference · " + (document.selected ? "selected version" : "retained version") : "Вымышленный источник · " + (document.selected ? "выбранная версия" : "прежняя версия"), selected: document.selected,
      nodeIds: [...new Set(overview.references.filter(ref => ref.document === document.id && ref.version === document.version).map(ref => ref.nodeId))],
    });
  }
  const converted = await buildConvertedSourcePacket(draft);
  if (converted) {
    for (const message of converted.messages) materials.push({ id: `message:${message.id}`, title: `${message.citation} — ${message.title}`,
      kind: "reference", text: message.text, note: message.status === "hypothetical_later_correspondence_not_received" ? (locale === "en" ? "Hypothetical later correspondence · not received" : "Гипотетическая поздняя переписка · не получена") : (locale === "en" ? "Fictional opening correspondence" : "Вымышленная исходная переписка"), selected: true,
      nodeIds: draft.nodes.some(node => node.id === message.recordId) ? [message.recordId] : [] });
    for (const document of converted.missingDocuments) materials.push({ id: `missing:${document.id}`, title: document.title,
      kind: "missing", text: null, note: locale === "en" ? "Original body not supplied. No file is available." : "Исходный текст не предоставлен. Файл недоступен.",
      selected: true, nodeIds: [document.recordId, ...document.premiseRecordIds].filter(id => draft.nodes.some(node => node.id === id)) });
  }
  for (const [index, url] of (draft.classification?.sourceUrls ?? []).entries()) materials.push({ id: `url:${index}`, title: url,
    kind: "url", text: null, note: locale === "en" ? "URL only · source body not attached" : "Только URL · текст источника не приложен", selected: true, nodeIds: [] });
  return materials;
}

export async function materialHash(text: string) {
  return "sha256:" + Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text))), byte => byte.toString(16).padStart(2, "0")).join("");
}
export function materialFilename(material: StudioMaterial, index: number) {
  return `${String(index + 1).padStart(3, "0")}-${material.id.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 100)}.txt`;
}
export async function studioMaterialsArchive(draft: StudioDraft, materials: StudioMaterial[], current: () => boolean) {
  if (!current()) return null;
  const { zipSync, strToU8 } = await import("fflate");
  const files: Record<string, Uint8Array> = {};
  const entries = await Promise.all(materials.map(async (material, index) => {
    const filename = material.text === null ? null : materialFilename(material, index);
    const contentSha256 = material.text === null ? null : await materialHash(material.text);
    if (filename) files[filename] = strToU8(material.text!);
    return { ...material, text: undefined, filename, contentSha256 };
  }));
  if (!current()) return null;
  files["manifest.json"] = strToU8(JSON.stringify({ format: "casevant-materials", schemaVersion: 1,
    caseId: draft.caseId, version: draft.version, fingerprint: casePublicationFingerprint(draft),
    disclosure: "Working records and illustrative references; no evidence acceptance or professional approval. Missing source bodies and URLs have no fabricated file. Includes retained reference versions.", entries }, null, 2) + "\n");
  const size = Object.values(files).reduce((total, bytes) => total + bytes.byteLength, 0);
  if (size > 8_000_000) throw new Error("Material archive exceeds 8 MB");
  const bytes = zipSync(files);
  return current() ? bytes : null;
}
