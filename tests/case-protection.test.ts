import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  buildCaseProtection,
  canonicalCaseProtectionBinding,
  legacyCaseProtectionCode,
  normalizeStoredCaseProtection,
  normalizeUntrustedCaseProtection,
  verifyCaseProtection,
  type CaseProtectionBinding,
} from "../app/case-protection";
import { caseFingerprint, legacyCaseFingerprintV15, normalizeStudioDraft } from "../app/case-integrity";

const key = Uint8Array.from({ length: 32 }, (_, index) => index + 1);
const rootBinding: CaseProtectionBinding = {
  caseId: "protected_case_001",
  version: "1.0.0",
  studioFingerprint: `sha256-${"a".repeat(64)}`,
  parentCaseId: null,
  parentVersion: null,
  parentFingerprint: null,
  parentCode: null,
  copyPolicy: "lineage_locked",
};

test("case-protection-v1 deterministically binds identity, fingerprint, parent and copy policy", async () => {
  const first = await buildCaseProtection(rootBinding, key);
  const second = await buildCaseProtection(rootBinding, key);
  assert.deepEqual(first, second);
  assert.equal(first.kind, "case-protection-v1");
  assert.equal(first.copyProtected, true);
  assert.match(first.currentCode, /^sha256-[a-f0-9]{64}$/);
  assert.match(first.seal, /^hmac-sha256-[a-f0-9]{64}$/);
  assert.equal(await verifyCaseProtection(first, rootBinding, key), true);

  for (const mutation of [
    { ...rootBinding, version: "1.0.1" },
    { ...rootBinding, studioFingerprint: `sha256-${"b".repeat(64)}` },
    { ...rootBinding, copyPolicy: "fork_allowed" as const },
  ]) assert.equal(await verifyCaseProtection(first, mutation, key), false);
  assert.equal(await verifyCaseProtection({ ...first, seal: `hmac-sha256-${"0".repeat(64)}` }, rootBinding, key), false);
  assert.throws(() => canonicalCaseProtectionBinding({ ...rootBinding, parentFingerprint: `sha256-${"c".repeat(64)}` }), /paired/i);
});

test("child codes form a sealed lineage and inherited policy cannot be represented as unlocked", async () => {
  const parent = await buildCaseProtection(rootBinding, key);
  const childBinding: CaseProtectionBinding = {
    caseId: rootBinding.caseId,
    version: "1.0.1",
    studioFingerprint: `sha256-${"d".repeat(64)}`,
    parentCaseId: rootBinding.caseId,
    parentVersion: rootBinding.version,
    parentFingerprint: rootBinding.studioFingerprint,
    parentCode: parent.currentCode,
    copyPolicy: "lineage_locked",
  };
  const child = await buildCaseProtection(childBinding, key);
  assert.equal(child.parentCode, parent.currentCode);
  assert.notEqual(child.currentCode, parent.currentCode);
  assert.equal(await verifyCaseProtection(child, childBinding, key), true);
  assert.equal(await verifyCaseProtection(child, { ...childBinding, parentCode: `sha256-${"e".repeat(64)}` }, key), false);
  assert.equal(await verifyCaseProtection(child, { ...childBinding, parentVersion: "9.9.9" }, key), false);
  assert.match(await legacyCaseProtectionCode("legacy_case", "1.0.0", `sha256-${"f".repeat(64)}`), /^sha256-[a-f0-9]{64}$/);
});

test("untrusted codes are discarded while a requested lineage lock is preserved", () => {
  const normalized = normalizeUntrustedCaseProtection({
    kind: "case-protection-v1",
    copyProtected: false,
    copyPolicy: "lineage_locked",
    parentCode: "attacker-parent",
    currentCode: "attacker-current",
    seal: "attacker-seal",
  });
  assert.deepEqual(normalized, {
    kind: "case-protection-v1",
    copyProtected: true,
    copyPolicy: "lineage_locked",
    parentCode: null,
    currentCode: "",
    seal: "",
  });
  assert.throws(() => normalizeStoredCaseProtection(normalized), /invalid/i);
  assert.throws(() => normalizeStoredCaseProtection({
    kind: "case-protection-v1",
    copyProtected: false,
    copyPolicy: "lineage_locked",
    parentCode: null,
    currentCode: `sha256-${"a".repeat(64)}`,
    seal: `hmac-sha256-${"b".repeat(64)}`,
  }), /invalid/i);
});

test("Studio content fingerprints exclude the server attestation and avoid a circular seal", async () => {
  const draft = normalizeStudioDraft({
    caseId: "protected_case_001",
    version: "1.0.0",
    parent: null,
    title: "Protected case",
    jurisdiction: "BE",
    role: "Counsel",
    premise: "Evaluate the protected matter.",
    nodes: [{ id: "trigger-1", type: "trigger", title: "Trigger", detail: "", x: 10, y: 10 }],
    links: [],
    editHistory: [],
    updatedAt: "2026-08-22T00:00:00.000Z",
  });
  const fingerprint = caseFingerprint(draft);
  const protection = await buildCaseProtection({ ...rootBinding, studioFingerprint: fingerprint }, key);
  assert.equal(caseFingerprint({ ...draft, protection }), fingerprint);
});

test("case seals distinguish relationship IDs that compile into different playable options", async () => {
  const draft = normalizeStudioDraft({
    caseId: "protected_relationship_001",
    version: "1.0.0",
    parent: null,
    title: "Protected relationship",
    jurisdiction: "BE",
    role: "Counsel",
    premise: "Evaluate one exact protected route.",
    nodes: [
      { id: "trigger-1", type: "trigger", title: "Trigger", detail: "", x: 10, y: 10 },
      { id: "outcome-1", type: "outcome", title: "Outcome", detail: "", x: 200, y: 10 },
    ],
    links: [{ id: "link-1", from: "trigger-1", to: "outcome-1" }],
    editHistory: [],
    updatedAt: "2026-08-22T00:00:00.000Z",
  });
  const renamed = normalizeStudioDraft({ ...draft, links: [{ ...draft.links[0], id: "link-2" }] });
  const first = await buildCaseProtection({ ...rootBinding, caseId: draft.caseId, studioFingerprint: caseFingerprint(draft) }, key);
  const second = await buildCaseProtection({ ...rootBinding, caseId: renamed.caseId, studioFingerprint: caseFingerprint(renamed) }, key);
  const legacyFingerprint = legacyCaseFingerprintV15(draft);
  const legacySeal = await buildCaseProtection({ ...rootBinding, caseId: draft.caseId, studioFingerprint: legacyFingerprint }, key);
  assert.notEqual(caseFingerprint(draft), caseFingerprint(renamed));
  assert.equal(legacyFingerprint, legacyCaseFingerprintV15(renamed), "v15 compatibility alone cannot authenticate playable option identity");
  assert.equal(await verifyCaseProtection(legacySeal, { ...rootBinding, caseId: draft.caseId, studioFingerprint: legacyFingerprint }, key), true);
  assert.equal(await verifyCaseProtection(legacySeal, { ...rootBinding, caseId: draft.caseId, studioFingerprint: caseFingerprint(draft) }, key), false);
  assert.notEqual(first.currentCode, second.currentCode);
  assert.notEqual(first.seal, second.seal);
});

test("server routes retain signing-key secrecy, exact lineage checks and copy-protection ACL gates", () => {
  const source = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
  const serverProtection = source("app/server-case-protection.ts");
  const submissions = source("app/api/submissions/route.ts");
  const publication = source("app/api/admin/cases/route.ts");
  const verification = source("app/api/case-protection/verify/route.ts");
  const customCases = source("app/api/custom-cases/route.ts");
  const studio = source("app/JurisApp.tsx");
  const reportDialog = source("app/CaseReportDialog.tsx");
  const report = source("app/case-report.ts");

  assert.match(serverProtection, /platformSecrets/);
  assert.match(serverProtection, /crypto\.getRandomValues/);
  assert.match(serverProtection, /onConflictDoNothing\(\)/);
  assert.match(serverProtection, /case-lineage-hmac-v1/);
  assert.match(serverProtection, /caseDrafts\.fingerprint, input\.fingerprint/);
  assert.match(serverProtection, /caseVersions\.studioFingerprint/);
  assert.match(serverProtection, /verifyCaseProtection/);
  assert.match(serverProtection, /records\.length > 1/);

  assert.match(submissions, /currentArtifact\?\.copyProtected/);
  assert.match(submissions, /parentArtifact\?\.copyProtected/);
  assert.match(submissions, /continuingProtectedLineage/);
  assert.match(submissions, /code: "copy_protected"/);
  assert.match(submissions, /const protectedDraft = \{ \.\.\.draft, protection \}/);
  assert.match(submissions, /parent lineage of an existing version cannot be replaced/);
  assert.match(submissions, /protectionCompareAndSwap/);
  assert.match(submissions, /json_extract\(\$\{caseDrafts\.payload\}, '\$\.protection\.currentCode'\)/);
  assert.match(submissions, /saved\.protectionCode !== protection\.currentCode/);
  assert.match(submissions, /canUseArtifact/);
  assert.match(submissions, /const parentWriteGuard = artifactWriteGuard/);
  assert.match(submissions, /customCaseGrants\.recipientEmail/);
  assert.match(submissions, /codeStillMatches/);
  assert.match(submissions, /payload\.expectedPublicationFingerprint/);
  assert.match(submissions, /payload\.basePublicationFingerprint/);
  assert.match(submissions, /storedPublicationBinding/);
  assert.match(submissions, /publicationCompareAndSwap/);

  assert.match(publication, /caseProtection: protection/);
  assert.match(publication, /payload: \{ kind: "playable-scenario-v1"[\s\S]*protection, artifactBinding/);
  assert.match(publication, /sourceArtifact\?\.copyProtected/);
  assert.match(publication, /parentArtifact\?\.copyProtected/);
  assert.match(publication, /storedPublicationFingerprint\(sourceDraft\.payload\) !== publicationFingerprint/);
  assert.match(publication, /storedPublicationFingerprint\(review\.payload\) !== publicationFingerprint/);
  assert.match(publication, /artifactBinding = \{ \.\.\.compilationBinding, publicationFingerprint, caseProtection: protection \}/);

  assert.match(verification, /isSameOriginMutation/);
  assert.match(verification, /normalizeStoredCaseProtection/);
  assert.match(verification, /legacyCaseFingerprintV15/);
  assert.match(verification, /authoritativeCurrentFingerprints/);
  assert.match(verification, /authoritative\.caseFingerprint !== fingerprint/);
  assert.match(verification, /authoritative\.publicationFingerprint !== publicationFingerprint/);
  assert.match(verification, /access === "owner" \? customCaseId : null/);
  assert.match(verification, /return privateJson\(\{ valid, copyProtected, canDuplicate, access, customCaseId: access === "owner" \? customCaseId : null, fingerprint, publicationFingerprint \}\)/);
  assert.doesNotMatch(verification, /secret:/);

  assert.match(customCases, /copyProtected/);
  assert.match(customCases, /json_extract/);
  assert.match(customCases, /caseDrafts\.version} = \$\{customCases\.currentVersion/);
  assert.match(customCases, /Boolean\(record\.copyProtected\)/);
  assert.match(customCases, /casePublicationFingerprint\(storedDraft\)/);
  assert.match(customCases, /publication binding failed integrity verification/);
  assert.doesNotMatch(customCases, /for \(const record of records\)[\s\S]*await db/);

  assert.match(studio, /serverPublicationFingerprint/);
  assert.match(studio, /expectedPublicationFingerprint/);
  assert.match(studio, /basePublicationFingerprint/);
  assert.match(studio, /Report export is unavailable in inspection-only mode/);
  assert.match(reportDialog, /canGenerateReport/);
  assert.match(reportDialog, /workspacePublicationFingerprint === currentPublicationFingerprint/);
  assert.match(report, /assertCaseReportGenerationAuthorized\(authorization\?\.canGenerate\)/);
  assert.match(report, /technicalProtection: effectiveOptions\.includeTechnicalIds && draft\.protection/);
});
