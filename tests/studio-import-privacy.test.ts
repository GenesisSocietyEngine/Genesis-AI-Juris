import assert from "node:assert/strict";
import test from "node:test";
import { mayChooseImportedPrivacy } from "../app/studio-import-privacy";

test("a new unsealed raw draft can choose private visibility before its first save", () => {
  assert.equal(mayChooseImportedPrivacy({ newUnsealedRawDraft: true, verifiedOwnerCustomCaseId: null }), true);
});

test("an export without verified ownership cannot gain privacy controls from import", () => {
  // Public, shared, and admin-inspection exports receive no owner case ID.
  for (const verifiedOwnerCustomCaseId of [null, 0, -1, 1.5, Number.NaN]) {
    assert.equal(mayChooseImportedPrivacy({ newUnsealedRawDraft: false, verifiedOwnerCustomCaseId }), false);
  }
  assert.equal(mayChooseImportedPrivacy({ newUnsealedRawDraft: false, verifiedOwnerCustomCaseId: 27 }), true);
});

test("the local-draft exception cannot also claim a saved-case identity", () => {
  assert.equal(mayChooseImportedPrivacy({ newUnsealedRawDraft: true, verifiedOwnerCustomCaseId: 27 }), false);
});
