/** Reproduce a supplied canonical Markdown report locally, without changing the
 * case, authorizing a review, contacting an API or persisting it to production. */
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { createHash } from "node:crypto";
import { parseCaseMarkdown } from "../app/case-markdown";
import { caseFingerprint, casePublicationFingerprint } from "../app/case-integrity";
import { primaryCaseOutput } from "../app/case-type-playbooks";
import { createCaseReportPreview } from "../app/case-report";
import { snapshotStudioDraft } from "../app/studio-revisions";

const [input, output] = process.argv.slice(2);
if (!input || !output) throw new Error("Usage: verify-canonical-case-pdf.ts INPUT.md OUTPUT.pdf");
const source = await readFile(resolve(input), "utf8");
const parsed = await parseCaseMarkdown(source);
if (!parsed) throw new Error("The file does not contain a canonical case");
const { draft, fingerprint } = parsed;
const original = JSON.stringify(draft), profile = primaryCaseOutput(draft.caseType);
const originalSnapshot = JSON.stringify(snapshotStudioDraft(draft));
const blob = await createCaseReportPreview(draft, {
  language: "en", profileId: profile.id, profileLabel: profile.label.en, audience: "internal", confidentiality: "draft",
  preparedBy: "", preparedFor: "", matterReference: "", includeEconomics: true, includeRegisters: true,
  includeSources: true, includeAuditTrail: true, includeTechnicalIds: false, generatedAt: "2026-09-15T15:30:00.000Z",
  currentFingerprint: fingerprint, workspaceFingerprint: null, currentPublicationFingerprint: casePublicationFingerprint(draft),
  workspacePublicationFingerprint: null, privateCase: false, reportReceiptStorageScope: null, persistReportReceiptOnDevice: false,
  status: "draft", reviewerName: "", reviewerApproved: false, redactedNodeIds: [],
}, { canGenerate: true });
const bytes = Buffer.from(await blob.arrayBuffer());
if (blob.type !== "application/pdf" || bytes.subarray(0, 5).toString() !== "%PDF-") throw new Error("Not a PDF");
if (JSON.stringify(draft) !== original || caseFingerprint(draft) !== fingerprint) throw new Error("Report mutated the source");
if (JSON.stringify(snapshotStudioDraft(draft)) !== originalSnapshot) throw new Error("Report changed the authoring snapshot");
await mkdir(dirname(resolve(output)), { recursive: true });
await writeFile(resolve(output), bytes);
console.log(JSON.stringify({ sourceSha256: createHash("sha256").update(source).digest("hex"), fingerprint, nodes: draft.nodes.length, links: draft.links.length, bytes: bytes.length, sha256: createHash("sha256").update(bytes).digest("hex"), caseUnchanged: true, approvalCreated: false, file: resolve(output) }, null, 2));
