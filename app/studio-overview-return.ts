export type OverviewReturnContext = {
  caseId: string; version: string; sourceKey: string; storedCaseId: number | null;
  scope: string | null; locale: string; epoch: number; allowed: boolean;
};

/** View navigation only. The parent replaces this owner on identity/context changes,
 * while ordinary edits retain it. No case snapshot, input, permission or history is saved. */
export function createOverviewActionReturnMemory(context: OverviewReturnContext) {
  const allowed = context.allowed;
  let origin = false, focus = false;
  return {
    remember: () => { origin = allowed; focus = false; },
    active: () => allowed && origin,
    clear: () => { origin = false; focus = false; },
    take: () => { const current = allowed && origin; origin = false; return current; },
    requestFocus: () => { focus = allowed; },
    focusRequested: () => allowed && focus,
  };
}
