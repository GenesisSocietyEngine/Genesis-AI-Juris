# Prompt-only sign-in continuation correction — 27 September 2026

The coordinating browser reproduced a P1: a fresh local guest opened Create case, typed a synthetic case prompt, chose Save to workspace, reached Account, and selected Return to your task without signing in. Within approximately 20 seconds, Studio returned blank and incorrectly reported that the continuation had expired or belonged to another account. This browser observation is attributed to root; the helper reviewer did not operate that session.

Cause: temporary continuation creation accepts an unfinished draft, but restoration called `normalizeStudioDraft`, which requires a nonempty title and at least one node. The actual blank Studio draft has neither. The normalizer rejected the valid prompt-only continuation; the parent then consumed the rejected record. Existing tests used complete Canopy graphs and missed this case.

Acceptance defined by the regression before repair: preserve an untitled empty graph, exact prompt, action and selected-node state on a same-tab guest cancellation or permitted guest-to-account continuation; retain expiry/account/protection/size checks; reject an empty graph carrying links; leave server/import/save normalization strict.

Changed only the continuation helper and its focused tests. A continuation-local adapter reuses the strict field normalizer with temporary validation values for an empty title or graph, then removes those values before returning. No title or node is invented in the restored case. A graph with zero nodes must also have zero links. All other fields remain under existing normalization and all existing account, lifetime, protected-data and aggregate-size checks remain active. Ordinary save/import validation is unchanged, and incomplete restored drafts still fail that strict validation until the user completes them.

Unadded Sources composer input is a separate in-memory buffer: the parallel parent correction blocks leaving for sign-in until that input is added/discarded or Account is opened in another tab. This helper does not add persistence for those buffers or protected cases.

Validation with pinned Node 22.23.2:

- Two regression cases failed against the earlier helper, including the exact empty-title/empty-graph condition: [red log](evidence/continuation-empty-draft-red.log).
- `node --import tsx --test tests/onboarding-continuation.test.ts tests/studio-save-receipt.test.ts`: **14/14 PASS**, no skips, exit 0: [focused log](evidence/continuation-empty-draft-green.log).
- Focused ESLint for both changed files passed, exit 0, [no diagnostics](evidence/continuation-empty-draft-lint.log); scoped diff whitespace check passed.

These tests exercise actual creation/restoration and exact save-receipt helpers with synthetic fixtures. They do not perform real sign-in. No API, auth authority, migration, real account or production setting changed.

Independent source review by `review_flows` and the coordinating root found no material issue in the bounded adapter: validation values never enter the restored model, and account/protection/lifetime/size rules remain intact. Root subsequently repeated the ordinary local guest path at `http://127.0.0.1:5280` and reported **PASS for cancellation continuity**: Account → Return without signing in restored the exact prompt and displayed the restoration notice. This is an attributed local browser result on the uncommitted candidate, not a genuine login or hosted Save/reopen result. Final build/source attribution and integration gates remain coordinator-owned.
