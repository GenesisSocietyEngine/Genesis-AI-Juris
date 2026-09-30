import { caseFingerprint } from "./case-integrity";
import { assertTaxAttachmentMutation, hasTaxAttachment, taxAttachmentDigest, type TaxAttachmentMutation } from "./tax-authoring";
import type { StudioDraft } from "./types";

type Baseline = { scope: string | null; caseId: string; version: string; fingerprint: string; attachment: unknown };
export type StudioTaxWrite = { mutation?: TaxAttachmentMutation; current: () => boolean };

/** Memory-only prior carrier, captured exclusively from a verified load or save.
 * It never refreshes authority or derives a prior digest from edited after-data. */
export class StudioTaxWriteBaseline {
  private baseline: Baseline | null = null;
  private epoch = 0;
  clear() { this.baseline = null; this.epoch++; }
  capture(draft: StudioDraft, scope: string | null, fingerprint = caseFingerprint(draft)) {
    this.baseline = structuredClone({ scope, caseId: draft.caseId, version: draft.version, fingerprint, attachment: draft.taxAnalysis });
    this.epoch++;
  }
  prepare = async (draft: StudioDraft, scope: string | null, serverFingerprint: string | null): Promise<StudioTaxWrite> => {
    const snapshot = structuredClone(draft), baseline = structuredClone(this.baseline), epoch = this.epoch;
    const matching = baseline?.scope === scope && (
      snapshot.caseId === baseline.caseId && snapshot.version === baseline.version && serverFingerprint === baseline.fingerprint
      || snapshot.parent?.caseId === baseline.caseId && snapshot.parent.version === baseline.version && snapshot.parent.fingerprint === baseline.fingerprint
    );
    const before = matching ? baseline!.attachment : undefined;
    const current = () => epoch === this.epoch;
    if (!hasTaxAttachment(snapshot) && before === undefined) return { current };
    if ((serverFingerprint || snapshot.parent) && !matching) throw new Error("The prior tax attachment is not verified in this tab. Keep these edits or export them, then reopen the exact saved case or parent before saving.");
    const mutation: TaxAttachmentMutation = { protocol: "web-tax-attachment-write-v1", expected: await taxAttachmentDigest(before) };
    await assertTaxAttachmentMutation({ before, after: snapshot.taxAnalysis, precondition: mutation });
    return { mutation, current };
  };
}
