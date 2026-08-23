import assert from "node:assert/strict";
import test from "node:test";
import { buildCaseMarkdown, CANONICAL_CASE_MARKER, parseCaseMarkdown } from "../app/case-markdown";
import { caseFingerprint, normalizeStudioDraft } from "../app/case-integrity";
import type { StudioDraft } from "../app/types";

function reviewedDraft(): StudioDraft {
  return normalizeStudioDraft({
    caseId: "five_flats_three_borders",
    version: "1.2.0",
    parent: { caseId: "five_flats_three_borders", version: "1.1.0", fingerprint: `sha256-${"a".repeat(64)}` },
    protection: { copyProtected: true, currentCode: "secret", parentCode: null, seal: "secret", lockedAt: "2026-08-23T12:00:00.000Z" },
    title: "Five Flats, Three Borders",
    jurisdiction: "PRC · England · Liechtenstein",
    role: "Cross-border tax counsel",
    premise: "Review a lawful acquisition and financing structure for five English flats.",
    classification: {
      domain: "tax", practiceArea: "Cross-border tax", difficulty: "Advanced", tags: ["real estate", "financing"],
      taxTopics: ["ATED", "non-resident landlord"], purpose: "lawful_planning", complianceOnly: true,
      legalAsOf: "2026-08-23", sourceUrls: ["https://www.gov.uk/guidance/annual-tax-on-enveloped-dwellings-the-basics"],
    },
    dealEconomics: {
      kind: "deal-economics-v1", currency: "GBP", purchasePrice: 1_000_000, loanToValueBps: 8_000,
      annualInterestRateBps: 750, termMonths: 120, repaymentBasis: "interest_only", grossAnnualIncome: 129_600,
      annualOperatingCosts: 20_000, oneOffStructureCost: 15_000, annualStructureCost: 10_000,
      otherInitialCosts: 0, targetAnnualReturnBps: 1_000,
      scenarioProbabilities: { interestOnlyBps: 5_000, favorableBps: 2_500, baseBps: 5_000, stressedBps: 2_500 },
      assumptions: ["Five units remain five."],
    },
    nodes: [
      { id: "trigger-1", type: "trigger", title: "Client mandate", detail: "Acquire five flats.", x: 80, y: 80 },
      { id: "actor-1", type: "actor", title: "PRC-resident client", detail: "Individual investor.", x: 340, y: 80 },
      { id: "evidence-1", type: "evidence", title: "Rental and finance evidence", detail: "Rent roll and term sheet.", x: 600, y: 80 },
      { id: "decision-1", type: "decision", title: "Choose lawful route", detail: "Compare direct and structured ownership.", x: 860, y: 80 },
      { id: "outcome-1", type: "outcome", title: "Proceed after verification", detail: "Returns and compliance reconcile.", x: 1120, y: 20, runtime: { terminalOutcome: "strong" } },
      { id: "outcome-2", type: "outcome", title: "Stop or renegotiate", detail: "The mandate does not reconcile.", x: 1120, y: 220, runtime: { terminalOutcome: "weak" } },
    ],
    links: [
      { id: "link-1", from: "trigger-1", to: "actor-1" },
      { id: "link-2", from: "actor-1", to: "evidence-1" },
      { id: "link-3", from: "evidence-1", to: "decision-1" },
      { id: "link-4", from: "decision-1", to: "outcome-1", rule: { label: "Verified" } },
      { id: "link-5", from: "decision-1", to: "outcome-2", rule: { label: "Unverified" } },
    ],
    editHistory: [{ id: "history-1", role: "author", source: "prompt", action: "prompt_submitted", message: "private source text", createdAt: "2026-08-23T12:00:00.000Z" }],
    updatedAt: "2026-08-23T12:00:00.000Z",
  });
}

test("canonical Markdown is polished, portable and idempotent", async () => {
  const source = reviewedDraft();
  const built = await buildCaseMarkdown(source, { status: "final", language: "en" });
  assert.match(built.markdown, /^# Five Flats, Three Borders/m);
  assert.match(built.markdown, /## 3\. Decision paths and consequences/);
  assert.match(built.markdown, new RegExp(CANONICAL_CASE_MARKER));
  assert.doesNotMatch(built.markdown, /private source text|"seal":"secret"/);

  const parsed = await parseCaseMarkdown(built.markdown);
  assert.ok(parsed);
  assert.equal(parsed.status, "final");
  assert.equal(parsed.fingerprint, built.fingerprint);
  assert.equal(caseFingerprint(parsed.draft), built.fingerprint);
  assert.deepEqual(parsed.draft.nodes, built.draft.nodes);
  assert.deepEqual(parsed.draft.links, built.draft.links);
  assert.equal(parsed.draft.parent, null);
  assert.equal(parsed.draft.protection, undefined);
  assert.deepEqual(parsed.draft.editHistory, []);

  const editedNarrative = built.markdown.replace("## 1. Case mandate", "## 1. Edited display heading");
  const reparsed = await parseCaseMarkdown(editedNarrative);
  assert.equal(reparsed?.fingerprint, built.fingerprint, "display prose must not change the embedded reviewed graph");
});

test("canonical Markdown rejects a tampered fingerprint", async () => {
  const built = await buildCaseMarkdown(reviewedDraft(), { status: "amended", language: "ru" });
  const tampered = built.markdown.replaceAll(built.fingerprint, `sha256-${"f".repeat(64)}`);
  await assert.rejects(() => parseCaseMarkdown(tampered), /payload is invalid|fingerprint mismatch/);
});
