# P4B artifact preservation — implementation review

User outcome: retain complete tax attachments through Studio storage, restore,
import, copy and publication. Unknown/future/corrupt content stays read-only with
authorized raw recovery, without falling back to a blank or legacy tax result.
Financial/editor/report acceptance remains separate.

Clean dependent base: `fe8839520aff06772d30b6eef81d859fb4e71174` (PR #74), already
reconciled with canonical main `bb49049`. Branch
`codex/tax-web-preservation-2026-09-30`, worktree `tax-web-preservation`. Parent
review approved the carrier/read-state/mutation contract before implementation.
The published P4A worktree is unchanged under its own CI.

First bounded step: pure carrier/document classification, duplicate-key-safe JSON
classification with original raw retention, and explicit complete-carrier mutation
preconditions. Acceptance requires known/incomplete exact round-trip, future and
corrupt read-only classification, unknown numeric-token preservation, and omission/
deletion/stale-digest refusal. Six focused tests passed, including all five
successful calculation request shapes from the complete Rust web corpus. Strict
TypeScript and focused ESLint completed successfully. Root review found and fixed
leading-BOM identifier handling and mutable hash inputs: identifiers now preserve
their exact UTF-8 identity, mutation inputs detach before the first await, and the
caller must retain its frozen validated candidate through final persistence.

The second bounded step adds the raw aggregate reader, preservation-aware
normalizer and complete case-type/attachment snapshots and diffs. The reader is
explicitly not seal or import authorization. Scoped reads deny recovery output
when size, syntax or duplicate keys prevent establishing the expected scope.
Existing access, privacy and copy/export checks remain required at each caller.
Legacy custom-case v1–v4 still classify through their existing verification path;
tax-bearing sealed envelopes require v5. Exact attachment text enters the case
fingerprint only when present, preserving the released no-attachment fingerprint.

The combined integrity, AI, editing and preservation run passed 39 tests. The
initial new AI snapshot fixture omitted the required case-type registry; it was
corrected using the production caseTypeReference helper, without weakening the
validator. TypeScript and focused ESLint then passed. Root independently reviewed
the substep and identified scoped malformed recovery ordering; the correction and
three denial fixtures passed the four-test aggregate rerun and root re-review.
No UI/browser or authorized route recovery is claimed by these pure checks.

Subsequent steps must cover all normalizer, device, workspace, authoritative parent,
protected read/recovery, JSON/Markdown, snapshot, AI, reclassification and auth
continuation seams. Actual browser preservation/recovery and independent review
are required before publication. No current tax-v2 result is established by a
stored cache or an existing web/PDF green.

The device/auth continuation step adds separate v2 keys and classifies them before
legacy fallback. A present unsupported record blocks fallback and remains intact;
failed writes retain both the prior v2 bytes and legacy v1. Scope/protection checks
precede restore and recovery download. The synchronous localStorage read/write is
not a cross-tab atomic transaction. Existing explicit, server-confirmed sign-out
is an intentional privacy exception: it removes this verified account's device
keys and same-tab continuation, including future data, after the existing
departure warning. Failed sign-out preserves them and other account keys are
untouched. Focused device/UI/authority runs passed (30, 32 and 18 tests in their
respective runs); root independently reviewed these boundaries.

Actual local Chrome verification used the production Studio components and
storage, with only `/api/me` and `/api/workspace-session` intercepted for an
explicit synthetic local account. It is not hosted authentication evidence.
Future v2 plus an older v1 showed recovery without loading the old draft; corrupt
inner JSON also showed recovery. The original download and retained future
document were both 43,802 bytes, SHA256
`50e794fadce1aaa671ce9dc672f37f860756be455a61b09b236e6c1f26308262`.
Evidence is in `.artifacts/recovery-browser/future-original.json` and
`downloads/studio-device-recovery.json`. A known incomplete carrier survived a
real device-save click, including its raw legacy numeric text. Injected quota
failure left stored bytes and the open editor unchanged and showed the failure.
Keyboard focus moved from the recovery heading to its download action. At 390px
with root font 32px, the recovery view wrapped without horizontal overflow
(`screenshot-1790781899293.png`). This is not a screen-reader or device claim.
An initially plain recovery layout was corrected to the existing page/header and
button styles and visually rechecked.

The first real development-server start found that the released Vinext scan
included generated `.wasm.d.ts` declarations. The accepted runtime baseline and
P4A had identical files/configuration here; production packaging parity had not
covered development scanning. A serve-only Vite hook excludes `.d.ts` entries
without changing production inputs. A cold start then loaded the actual app.
Later local CLI daemon/CDP interruptions and renderer warnings are retained in
the task logs; they are not counted as passing final browser checks.

Authoritative route acceptance uses actual production handlers, ordinary password
login, migrated Miniflare D1 and existing provider-header fixtures for separate
shared/admin actors. Strict UTF-8 and duplicate-key parsing happen before
normalization; all stored authoritative payloads are read as raw SQL TEXT before
classification. Tax-bearing normalization may add defaults but cannot drop or
change supplied nested properties/arrays/values. Review caught outer and nested
future-field loss plus nonfatal UTF-8 replacement; regressions now refuse those
writes without row changes. Exact current/parent carrier preconditions and final
raw-row SQL guards cover omission, stale hashes, child/fork inheritance and
changes during asynchronous hashing. Owner recovery returns exact SQL text;
shared/admin inspection cannot download unverified recovery content. Publication
and moderation retain their privacy, review, protection and atomic audit gates.

The first eight route tests passed. Initial route fixtures accidentally attempted
submission while private and publication with an unreviewed premise; the existing
gates correctly rejected both, and the fixtures were corrected. Independent
review then reproduced a malformed-payload list failure and a pre-existing
unqualified inner/outer SQL correlation. The list now guards JSON validity/root
shape, qualifies the current-envelope correlation, and treats unknown protection
as protected. Separate D1 controls cover distinct draft/envelope IDs, malformed
and non-object payloads, future protection, and concurrent publication source
advancement. The last race is rejected by the existing migration trigger.

Frontend saves retain a memory-only prior carrier captured from a verified
workspace load, sealed import or successful exact save. The request hashes that
prior carrier, never its edited replacement. New roots explicitly bind absence;
unknown device-only lineage refuses save without changing input and directs the
user to reopen the exact saved case/parent. This is a bounded safety checkpoint,
not durable reopen/edit/save acceptance for P4C. The submitted draft is detached
and frozen before asynchronous hashing, and changed account/authority fences
prevent an obsolete request. Four actual handler tests pass; 24 related baseline,
departure, evidence-buffer and saved-case-navigation tests passed. Fixtures were
corrected to canonical `.000Z` timestamps and JSON transport projections after
the strict reader/deep equality correctly rejected their initial forms.

JSON v5 activation retains exact saved content/publication fingerprints, fresh
access verification and existing server seal verification. Unsupported/corrupt
file imports retain their original text in read-only recovery; an unverified file
does not grant export permission. Malformed UTF-8 is refused without replacing
the open case. The canonical Markdown family is recognized before AI/local
fallback, including future or malformed declarations, and asynchronous parsing
has source/account fences. The reviewed Markdown v2 entrypoints retain the full
attachment and replace legacy economics with an explicit historical-data notice;
the final whole Markdown must fit its input limit. The codecs and existing
private-export handlers passed 12 tests before the final combined verification.

The exact-value formatter, shared edit materializer and fresh report-execution
service are pure prerequisites, independently reviewed and tested. They do not
activate editor results or reports. The formatter initially used BigInt literal
syntax incompatible with the repository target; constructors now preserve that
target. See the separate materializer/report receipts for their scope. Existing
financial reports are blocked whenever an attachment is present, so legacy
JavaScript amounts cannot become the fallback for tax v2.

All evidence above is local uncommitted P4B work on the dependent `fe883` base,
not a claim that that published SHA contains preservation integration. Final
type/lint/full-suite, final browser checks, clean-source packaging, reconciliation
with canonical main and ordinary reviewed publication are still pending here.

Final UI/route review added a concrete late-import navigation regression: the
old handler could finish seal verification after navigation and reopen Studio.
The fixed handler also binds pathname, view and selected custom case before
adopting either recovery or editable content. Independent old-fail/new-pass
receipts are retained; 49 assertions across 32 focused tests passed in the
independent rerun. The combined final route/codec/handler run passed 34 tests.
Its real D1 list checks cover malformed, non-object and future protection rows
without hiding them from the owner or disclosing recovery text in the list.

The final browser repeat is recorded in
`.artifacts/recovery-browser/final-receipt.json`, with explicit synthetic account
interception and uncommitted-source labels. Future device bytes retain the same
hash above. Actual absolute-path JSON upload produces read-only recovery without
granting a download. Future canonical Markdown offers local verification only,
then recovery; returning restores exactly SHA256
`ec6d9b949b5f378bdabd3a0eec719900de4d62f34163435bb10cf0bb60ac3aa5`.
The inspected final screenshot is `final-canonical-recovery-fixed.png`.
Browser inspection found a misleading interrupted-operation toast on intentional
canonical recovery: idle state now commits before unmounting the editor, while
an independent pending save still retains its warning. The sixth actual-handler
regression and rendered repeat pass, with no toast and no fallback.

Failure history remains explicit. A relative CLI upload path was unreadable and
was repeated with the absolute task path. A later small scripted onerror cleanup
omitted its closing brace; browser parsing/lint caught it, an exact patch restored
the closure, and subsequent handler/real-browser checks passed. The unrelated
played-case import remains unchanged. The first full suite found stale structural
assertions for the former unqualified SQL and inline v4 export. Those assertions
now check qualified current-envelope identity/version/fingerprint plus the
extracted codec's v4/v5 and Case Core behavior; all 15 affected checks passed.
The full run is retained until terminal, and final source-bound validation is
still required. The verified build previously passed all ordinary gates; it is
not labelled evidence for source changes made afterward.

The original full run finished with 1,098 tests: 1,093 passed, the two structural
assertions above failed, and three existing tests were skipped (774.9 seconds).
It is not a unified green run. Both failures were corrected and their 15-test
focused run passed. The final canonical handler group passed all six tests.
Frozen final TypeScript and focused lint then exited zero; an AST source audit
confirmed valid JSX and the unchanged played-case import function. Exact-head
hosted CI must establish the unified result for the published candidate.

The ordinary prompt-file entrypoint still limits Markdown/text to 64,000
characters, even though the standalone canonical codec accepts up to 1 MB.
Oversized input is rejected before replacing the current prompt, without
truncation or interpretation. Broadening this UI limit is outside this checkpoint
and remains part of the later editor/import acceptance scope.

A final raw-text boundary regression reproduced `File.text()` removing a leading
BOM from otherwise valid Markdown; it also permits malformed UTF-8 replacement.
The prompt reader now reads bytes, decodes fatal UTF-8 while retaining a BOM, and
rejects invalid encoding before replacing the current prompt. Its existing size,
empty-file and read-failure behavior remains. The old reader failed the new
regression; the corrected prompt/canonical/actual-handler group passed all 17
tests (`prompt-utf8-before.log` and `prompt-utf8-after.log`). This is a preservation
correction, not an increase in the UI's import limit.
