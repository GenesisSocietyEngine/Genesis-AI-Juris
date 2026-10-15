import { buildExampleProvenance } from "./example-provenance";
import { convertedSourceMaterial } from "./converted-source-material";
import type { StudioDraft } from "./types";

/** Exact declared template only. Older/unknown sources receive no substitute packet. */
export async function buildConvertedSourcePacket(draft: StudioDraft) {
  const reference = await buildExampleProvenance(draft);
  if (!reference || reference.status.integrityIssues.length || !reference.source.packageId.startsWith("converted:") || reference.source.version !== "2.4.0") return null;
  const material = convertedSourceMaterial(reference.source.caseId);
  const records = new Map(draft.nodes.map(node => [node.id, node]));
  return {
    format: "casevant-converted-reference-packet" as const, schemaVersion: 1,
    case: reference.case, template: reference.source,
    originalSource: { caseId: material.caseId, version: material.originalVersion, scenarioFingerprint: material.originalScenarioFingerprint },
    disclosure: "Original fictional simulation correspondence, not external documents, uploaded evidence or professional approval. Later messages remain hypothetical and unreceived. Document bodies listed as missing were not supplied. Graph links and matching text do not establish acceptance or source sufficiency.",
    professionalReview: "not_recorded" as const,
    workingContentChanged: reference.status.workingContentChanged,
    messages: material.messages.map(message => {
      const record = records.get(message.recordId);
      return { ...message, workingRecordState: !record ? "missing" as const : record.detail.includes(message.text) && record.detail.includes(message.citation) ? "body_and_reference_present" as const : "body_or_reference_changed" as const };
    }),
    missingDocuments: material.missingDocuments.map(document => ({ ...document, recordExists: records.has(document.recordId),
      workingPremises: document.premiseRecordIds.map(id => ({id,state:records.has(id)?"present" as const:"missing" as const})),
    })),
    excludedTrainingMessageIds: material.excludedTrainingMessageIds,
    excludedTrainingMessages: material.excludedTrainingMessages,
  };
}
export type ConvertedSourcePacket = NonNullable<Awaited<ReturnType<typeof buildConvertedSourcePacket>>>;

export async function prepareConvertedSourcePacketDownload(draft: StudioDraft, format: "md" | "json", current: () => boolean) {
  if (!current()) return null;
  const packet = await buildConvertedSourcePacket(draft);
  if (!current() || !packet) return null;
  const content = format === "json" ? JSON.stringify(packet, null, 2) + "\n"
    : ["# Converted case reference packet", packet.disclosure,
      `Template: ${packet.template.caseId} @ ${packet.template.version}; ${packet.template.fingerprint}`,
      `Working case: ${packet.case.caseId} @ ${packet.case.version}; ${packet.case.fingerprint}. Working content changed: ${packet.workingContentChanged}.`,
      `Original authored simulation: ${packet.originalSource.caseId} @ ${packet.originalSource.version}; ${packet.originalSource.scenarioFingerprint}`,
      "## Retained fictional messages", ...packet.messages.map(message => `### ${message.citation} — ${message.title}\n\nStatus: ${message.status}\n\nOrigin: ${message.origin}\n\nSender: ${message.sender ?? "Not supplied"}\n\n${message.text}\n\nExact UTF-8 body hash: ${message.contentSha256}\n\nWorking record: ${message.recordId}; ${message.workingRecordState}`),
      "## Missing original document bodies", ...packet.missingDocuments.map(document => `- ${document.id}: ${document.title} — body not supplied. Fictional opening availability: ${document.fictionalOpeningAvailability}. This is not an uploaded document or accepted passage. Original linked premise IDs: ${document.premiseRecordIds.join(", ") || "none recorded"}. Working premise states: ${document.workingPremises.map(premise => premise.id + "=" + premise.state).join(", ") || "none recorded"}.`),
      "## Reviewed training exclusions", ...packet.excludedTrainingMessages.map(message => `- ${message.id}: ${message.reason} Original record fingerprint: ${message.originalRecordFingerprint}`),
      "", "No professional review or evidence acceptance is recorded by this packet.", ""].join("\n\n");
  return { filename: draft.caseId.replace(/[^A-Za-z0-9_-]/g, "_").slice(0, 80) + "-reference-packet." + format,
    mime: format === "md" ? "text/markdown;charset=utf-8" : "application/json;charset=utf-8", content };
}

export function openConvertedMessageFragment(root: Pick<HTMLElement, "querySelector">, id: string) {
  if (!/^studio-message-[a-f0-9]{64}$/.test(id)) return false;
  const section = root.querySelector<HTMLElement>(`[id="${id}"]`);
  if (!section) return false;
  const details = section.closest("details"); if (details) details.open = true;
  section.focus(); section.scrollIntoView({block:"nearest",behavior:"auto"});
  return true;
}
