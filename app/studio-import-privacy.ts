/** Local draft controls are distinct from authority over a saved case.
 * For exports, the ID must come from the successful server verification,
 * which returns a custom-case ID only to its owner, never from the file.
 */
export function mayChooseImportedPrivacy(input: {
  newUnsealedRawDraft: boolean;
  verifiedOwnerCustomCaseId: number | null;
}): boolean {
  if (input.newUnsealedRawDraft) return input.verifiedOwnerCustomCaseId === null;
  return Number.isSafeInteger(input.verifiedOwnerCustomCaseId)
    && (input.verifiedOwnerCustomCaseId ?? 0) > 0;
}
