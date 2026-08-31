import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import pdfMake from "pdfmake/build/pdfmake.js";
import pdfFonts from "pdfmake/build/vfs_fonts.js";
import { buildCaseReportDefinition } from "../app/case-report";
import { caseFingerprint } from "../app/case-integrity";
import { caseTypePlaybook, primaryCaseOutput } from "../app/case-type-playbooks";
import { caseTypeReference } from "../app/case-type-reference";
import type { CaseTypeId, StudioDraft, StudioNodeType } from "../app/types";

const out = resolve(process.argv[2] ?? ".artifacts/v61-report-goldens");
rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });
(pdfMake as unknown as { addVirtualFileSystem: (fonts: unknown) => void }).addVirtualFileSystem(pdfFonts);

const primaryTypes: CaseTypeId[] = ["general_advisory", "litigation_strategy", "contract_review", "tax_planning", "compliance", "erp_incident", "investigation", "training_simulation"];

function fixture(id: CaseTypeId, stress = false): StudioDraft {
  const playbook = caseTypePlaybook(caseTypeReference(id));
  let index = 0;
  const nodes = playbook.requiredNodeGroups.flatMap((group) => Array.from({ length: group.minimum }, () => {
    const type = group.types[0] as StudioNodeType;
    index += 1;
    return { id: `${type}-${index}`, type, title: `${group.label.en} ${index}`, detail: stress ? "A long governed professional record. ".repeat(55) : `Reviewable ${group.label.en.toLowerCase()} with source, owner, date, limitation and verification status.`, x: (index % 4) * 220, y: index * 145 };
  }));
  if (stress) for (let extra = 0; extra < 28; extra += 1) nodes.push({ id: `fact-stress-${extra}`, type: "fact", title: `Extended record ${extra + 1}`, detail: "Extended evidence narrative with qualifications, assumptions, provenance and reviewer notes. ".repeat(25), x: (extra % 4) * 220, y: (index + extra + 1) * 145 });
  return {
    caseId: `${id}_${stress ? "stress" : "golden"}`, version: "1.0.0", caseType: caseTypeReference(id), parent: null,
    title: `${playbook.label.en} — governed fixture`, jurisdiction: "Belgium / European Union", role: "Responsible professional reviewer",
    premise: stress ? "A long professional matter used to verify stable pagination, redaction-safe registers, citations, fingerprints and readable graph appendices. ".repeat(24) : "A professional matter used to verify a versioned, explainable, testable and reusable decision package.",
    classification: { domain: id === "tax_planning" ? "tax" : "general", practiceArea: playbook.label.en, difficulty: "Expert", tags: ["golden", "governed"], taxTopics: id === "tax_planning" ? ["planning"] : [], complianceOnly: true, purpose: "compliance_review", legalAsOf: "2026-08-31", sourceUrls: ["https://eur-lex.europa.eu/", "https://example.com/authority"] },
    nodes, links: nodes.slice(1).map((node, linkIndex) => ({ id: `link-${linkIndex + 1}`, from: nodes[linkIndex].id, to: node.id })),
    editHistory: [
      { id: "prompt-private", role: "author", source: "prompt", action: "prompt_submitted", message: "SECRET RAW PROMPT MUST NOT APPEAR", createdAt: "2026-08-31T08:00:00.000Z" },
      { id: "evidence-received", role: "author", source: "visual", action: "node_updated", message: "Evidence received and verified.", createdAt: "2026-08-31T09:00:00.000Z" },
    ], updatedAt: "2026-08-31T09:00:00.000Z",
  };
}

async function buffer(definition: ReturnType<typeof buildCaseReportDefinition>) {
  return await new Promise<Buffer>((resolveBuffer) => pdfMake.createPdf(definition).getBuffer((value) => resolveBuffer(Buffer.from(value))));
}

const manifest: Array<Record<string, unknown>> = [];
for (const id of primaryTypes) {
  for (const language of ["en", "ru"] as const) for (const audience of ["internal", "client"] as const) {
    const draft = fixture(id);
    const profile = primaryCaseOutput(draft.caseType);
    const fingerprint = caseFingerprint(draft);
    const bytes = await buffer(buildCaseReportDefinition(draft, {
      language, profileId: profile.id, profileLabel: profile.label[language], audience,
      confidentiality: "confidential", preparedBy: "Golden Fixture Author", preparedFor: "Golden Fixture Recipient", matterReference: `V61-${id}`,
      includeEconomics: true, includeRegisters: true, includeSources: true, includeAuditTrail: audience === "internal", includeTechnicalIds: audience === "internal",
      generatedAt: "2026-08-31T12:00:00.000Z", currentFingerprint: fingerprint, workspaceFingerprint: fingerprint, privateCase: true,
      status: audience === "client" ? "final" : "draft", reviewerName: "Golden Fixture Reviewer", reviewerApproved: true,
    }));
    const filename = `${id}-${profile.id}-${language}-${audience}.pdf`;
    const path = resolve(out, filename);
    writeFileSync(path, bytes);
    const textPath = `${path}.txt`;
    execFileSync("pdftotext", [path, textPath]);
    const text = readFileSync(textPath, "utf8");
    const normalizedText = text.toLocaleLowerCase(language === "ru" ? "ru" : "en");
    const profileToken = profile.label[language].split(/\s+/)[0].toLocaleLowerCase(language === "ru" ? "ru" : "en").replaceAll(" ", "");
    if (text.includes("SECRET RAW PROMPT") || !text.includes(draft.caseId) || !normalizedText.replaceAll(" ", "").includes(profileToken)) throw new Error(`PDF text verification failed for ${filename}`);
    const info = execFileSync("pdfinfo", [path], { encoding: "utf8" });
    const pages = Number(info.match(/^Pages:\s+(\d+)/m)?.[1] ?? 0);
    if (!pages || bytes.length < 10_000) throw new Error(`PDF structure verification failed for ${filename}`);
    manifest.push({ caseType: id, profileId: profile.id, language, audience, pages, bytes: bytes.length, sha256: createHash("sha256").update(bytes).digest("hex") });
  }
}

for (const id of ["litigation_strategy", "training_simulation"] as const) {
  const draft = fixture(id, true);
  const profile = primaryCaseOutput(draft.caseType);
  const fingerprint = caseFingerprint(draft);
  const path = resolve(out, `${id}-${profile.id}-long-stress.pdf`);
  writeFileSync(path, await buffer(buildCaseReportDefinition(draft, {
    language: "en", profileId: profile.id, profileLabel: profile.label.en, audience: "internal", confidentiality: "confidential",
    preparedBy: "Stress Author", preparedFor: "Stress Reviewer", matterReference: `V61-STRESS-${id}`, includeEconomics: true, includeRegisters: true,
    includeSources: true, includeAuditTrail: true, includeTechnicalIds: true, generatedAt: "2026-08-31T12:00:00.000Z",
    currentFingerprint: fingerprint, workspaceFingerprint: fingerprint, privateCase: true, status: "draft", reviewerName: "Stress Reviewer", reviewerApproved: true,
  })));
  const info = execFileSync("pdfinfo", [path], { encoding: "utf8" });
  const pages = Number(info.match(/^Pages:\s+(\d+)/m)?.[1] ?? 0);
  if (pages < 10) throw new Error(`Long-content stress fixture did not exercise pagination: ${path}`);
}

writeFileSync(resolve(out, "manifest.json"), `${JSON.stringify({ format: "genesis-juris-v61-report-goldens", rendererVersion: "1.0.0", fixtures: manifest }, null, 2)}\n`);
console.log(`PASS 32 bilingual/internal/external professional PDFs plus 2 long-content stress PDFs in ${out}`);
