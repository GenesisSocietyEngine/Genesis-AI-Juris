import { casePublicationFingerprint } from './case-integrity';
import { applyStudioPromptIteration, type StudioPromptPlan } from './studio-editing';
import type { StudioDraft, StudioNodeType } from './types';

export type StudioLocalReview = { baseFingerprint: string; instruction: string; locale: 'en'|'ru'; selectedNodeId: string|null };
export function studioLocalReview(draft: StudioDraft, plan: StudioPromptPlan, locale: 'en'|'ru', selectedNodeId: string|null): StudioLocalReview {
  return {baseFingerprint:casePublicationFingerprint(draft),instruction:plan.instruction.trim(),locale,selectedNodeId};
}

/** The proposal stays local and must still describe the exact current editing context. */
export function applyReviewedLocalPrompt(draft: StudioDraft, options: { review: StudioLocalReview; instruction: string; locale:'en'|'ru'; selectedNodeId:string|null; nodeLabels:Record<StudioNodeType,string>; createdAt:string }) {
  const {review}=options;
  if (review.baseFingerprint!==casePublicationFingerprint(draft) || review.instruction!==options.instruction.trim() || review.locale!==options.locale || review.selectedNodeId!==options.selectedNodeId) return null;
  return applyStudioPromptIteration(draft,options);
}
