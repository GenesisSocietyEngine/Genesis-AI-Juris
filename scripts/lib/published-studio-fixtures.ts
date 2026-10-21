import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { createExampleWorkingCopy } from "../../app/example-working-copy";
import { readStudioAggregate } from "../../app/studio-aggregate";
import { deriveWebTaxSource } from "../../app/studio-tax-source";
import { readTaxAttachment } from "../../app/tax-authoring";
import type { StudioDraft } from "../../app/types";

/** Local QA input only. Never rebind an existing tax carrier to label a fixture. */
export async function preparePublishedStudioFixture(original: StudioDraft, id: string): Promise<StudioDraft> {
  assert.match(id, /^[a-z0-9][a-z0-9.-]*$/, "Invalid local fixture label");
  let draft = structuredClone(original);
  const tax = readTaxAttachment(draft.taxAnalysis);
  if (tax.status !== "absent") {
    assert.equal(tax.status, "known", "Unsupported tax fixture requires recovery, not rewriting");
    if (tax.status !== "known") throw Error("Tax fixture requires recovery");
    // Shape validation alone cannot establish an attachment's outer case binding.
    // Title, identity and manual positions all participate in the source hash.
    assert.deepEqual(tax.view.source, (await deriveWebTaxSource(draft)).descriptor,
      "Tax fixture must retain its exact bound source");
  }
  // Classify before the normalizer used by the standard example-copy contract.
  const sourcePreflight = readStudioAggregate(JSON.stringify(draft), { kind: "draft" });
  assert.equal(sourcePreflight.status, "editable", `Invalid source fixture ${id}: ${sourcePreflight.status === "editable" ? "" : sourcePreflight.reason}`);
  if (tax.status === "absent") {
    draft = createExampleWorkingCopy(draft, createHash("sha256").update(id).digest("hex").slice(0, 32));
    draft.caseId = `qa_original_v149_${id.replace(/[^a-zA-Z0-9_]/g, "_")}`;
    draft.title = `SYNTHETIC original v149 QA — ${id}`;
    assert.ok(draft.nodes.length, "Manual-placement fixture needs a node");
    draft.nodes[0].mapPosition = { x: 413, y: 14003 };
  }
  const preflight = readStudioAggregate(JSON.stringify(draft), { kind: "draft" });
  assert.equal(preflight.status, "editable", `Invalid local fixture ${id}: ${preflight.status === "editable" ? "" : preflight.reason}`);
  return draft;
}
