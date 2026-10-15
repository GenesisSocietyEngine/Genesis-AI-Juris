import type { StudioDraft } from "./types";

export const CASE_REVIEW_QUESTION_IDS = ["review-question-mandate", "review-question-evidence", "review-question-authority"] as const;

/** Authored review questions, never inferred findings, instructions or approvals. */
export function caseReviewQuestions(draft: StudioDraft) {
  return CASE_REVIEW_QUESTION_IDS.flatMap(id => draft.nodes.filter(node => node.id === id && node.type === "decision"));
}

export function hasProfessionalCaseBrief(draft: StudioDraft) {
  return Boolean(draft.classification?.tags.includes("converted-example") && (
    draft.version === "2.5.0" || draft.exampleSource?.version === "2.5.0" || caseReviewQuestions(draft).length
  ));
}
