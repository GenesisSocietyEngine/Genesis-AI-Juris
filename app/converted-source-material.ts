import bundle from "./canonical-case-bundle.json";
import { canonicalFingerprint, sha256 } from "./case-integrity";
import { convertedGameplayId } from "./converted-training-policy";

type LegacySource = { case_id: string; scenario_fingerprint: string; scenario: {
  metadata: {content_version:string};
  evidence: Array<{id:string;title?:string;description?:string;initially_available?:boolean;supports_facts?:string[]}>;
  inbox_items: Array<{id:string;sender?:string;subject?:string;body?:string;initially_visible?:boolean}>;
} };
const originals = bundle.cases as unknown as readonly LegacySource[];
export function convertedMessageCitation(caseId: string, messageId: string) {
  const source = originals.find(item => item.case_id === caseId);
  if (!source) throw new Error("Unknown source case");
  return `SIM-${messageId} v${source.scenario.metadata.content_version} § body`;
}
export function convertedMessageFragment(caseId: string, messageId: string, version: string) {
  return "studio-message-" + sha256(JSON.stringify([caseId, messageId, version, "body"]));
}

/** Original authored simulation messages, never reconstructed external documents. */
export function convertedSourceMaterial(caseId: string) {
  const source = originals.find(item => item.case_id === caseId);
  if (!source) throw new Error("Unknown source case");
  const version = source.scenario.metadata.content_version;
  return {
    caseId, originalVersion: version, originalScenarioFingerprint: source.scenario_fingerprint,
    messages: source.scenario.inbox_items.filter(item => typeof item.body === "string" && item.body.length && !convertedGameplayId(item.id)).map(item => ({
      id: "SIM-" + item.id, originalId: item.id, version, section: "body" as const,
      sender: item.sender ?? null, title: item.subject ?? item.id, text: item.body!,
      contentSha256: "sha256:" + sha256(item.body!),
      origin: "original_fictional_simulation_correspondence" as const,
      status: item.initially_visible ? "fictional_opening_correspondence" as const : "hypothetical_later_correspondence_not_received" as const,
      recordId: "inbox-" + item.id, citation: convertedMessageCitation(caseId, item.id),
      fragmentId: convertedMessageFragment(caseId, item.id, version),
    })),
    missingDocuments: source.scenario.evidence.map(item => ({
      id: item.id, title: item.title ?? item.id, description: item.description ?? null,
      version: null, section: null, contentSha256: null,
      originalBodySupplied: false as const, fictionalOpeningAvailability: Boolean(item.initially_available),
      recordId: "evidence-" + item.id, premiseRecordIds: (item.supports_facts ?? []).map(id => "fact-" + id),
    })),
    excludedTrainingMessageIds: source.scenario.inbox_items.filter(item => convertedGameplayId(item.id)).map(item => item.id),
    excludedTrainingMessages: source.scenario.inbox_items.filter(item => convertedGameplayId(item.id)).map(item => ({
      id: item.id, originalRecordFingerprint: canonicalFingerprint(item),
      reason: "Training-only inactivity warning or termination. Excluded from the professional reference packet; the original record remains intact in the simulation and detailed projection audit.",
    })),
  };
}
