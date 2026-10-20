import { buildCanopyPackage } from "../../app/canopy-fixture";
import { createExampleWorkingCopy } from "../../app/example-working-copy";

/** Synthetic input preparation only; the archived application executes it. */
export function packagedCatalogueCases() {
  const source = buildCanopyPackage("base").draft;
  return Array.from({ length: 48 }, (_, index) => {
    const id = index + 1;
    // The normal copy contract retains exact source identity before amendments.
    // Renaming the source caseId directly would remove packet recognition.
    const draft = createExampleWorkingCopy(source, id.toString(16).padStart(32, "0"));
    draft.title = `SYNTHETIC packaged catalogue — case ${String(id).padStart(2, "0")} — ${id % 3 === 0 ? "Long title for source, authority, evidence, owner and action review" : "Pagination acceptance"}`;
    return { id, draft };
  });
}
