# Web tax editor development review

This dependent P4C slice starts from reviewed P4B candidate
`00b1e390d768edbd0721f23de79c8d435aa1fed5`, reconciled with canonical main
`33c5c7867acf70add458ebee926db17d89b69711`. Its branch is
`codex/tax-web-editor-2026-09-30`. The reviewed dependency correction
`409208e412cc677c7a23a4c32acc4453852c94d1` is included as `dea0d33`.
This is a reviewed local development checkpoint; remaining browser and unified
candidate checks are listed below. PR #76 retains its independent checks and
acceptance decision.

## Intended outcome

An author can prepare a tax analysis through Rust, edit exact raw values,
calculate through the packaged shared engine, save the whole Studio draft,
reload/reopen it, and recompute the same inputs. Incomplete text stays exact;
stored responses never become current results. Source changes require explicit
rebinding and new confirmation. Existing P4B storage authority, privacy, export,
copy protection and professional report gates remain in force.

## Model and execution boundary

The dedicated editor uses immutable transitions and exact decimal u64 revisions.
Each edit invalidates the displayed result. Rate edits reset rate confirmation;
component changes reset provenance confirmation. Rebinding retains the complete
old document and requires reconfirmation. Required IDs and excluded components
and benefits remain editable and preserved.

Preparation and import use the production web Rust repository. Fresh calculation
uses the reviewed shared materializer and response-verifying execution service;
the service name includes reports, but using it in the editor neither generates
a report nor grants report authority. Money formatting uses integer cents.
Operation adoption is fenced by attempt, committed draft and account/access
identity, plus layout cleanup on context change or unmount. Pending presentation
is bound to its own context and cannot block an unrelated new context.

Two review findings were corrected. Rust's unavailable legacy field names use
camelCase; an explicit pinned mapping now preserves them as blank raw edits.
Unavailable imports initially required only an ephemeral UI acknowledgement.
They now require a durable strict decision record in the retained history,
bound to the exact immediately preceding receipt index and SHA-256 of its
complete original bytes, plus the original JSON hash. Shared materialization
blocks absent, mismatched, duplicate or ambiguous decisions. Explicit approval
advances the revision and retains all original input. This is authoring review,
not access or professional approval.

Independent review then found that a truncated synthetic converted receipt could
clear an earlier unavailable-import gate. Recognized receipts now require the
complete supported source, request, schema, wire bounds and conversion structure;
literal status values replace coercion. Sixteen malformed/future history controls
and a deserialized direct-execution regression refuse before runtime load. Both
root and peer reviews accepted the correction. It validates retained structure,
not financial correctness or cryptographic authenticity of a historical receipt.

In amounts mode only, inactive baseline/optimized rates remain exact raw text
while mandatory Rust wire slots use neutral zero. These slots are not factual
rates. Switching to rates requires valid text and explicit confirmation. Other
numeric conversion policy is unchanged. Reports must mark inactive rates not
applicable, using the authored basis rather than interpreting wire zero.

## Evidence in progress

The first eight model tests passed against actual packaged Rust, followed by
27 focused model/actual-handler/materializer/execution tests. They cover complete
fresh response equality after serialization/reopening, incomplete edits, u64
overflow, source rebinding, legacy retention, durable review tampering and
held-operation edit/account/access/unmount boundaries. The handler harness runs
the actual component operation and layout fence with controlled completion; it
does not claim React/browser scheduling or accessibility acceptance.

Initial whole-project TypeScript passed. Three local lint warnings were corrected
before final lint. React and browser verification skills were applied.
The strict-history correction also passed whole-project TypeScript, focused lint
and 21 combined tests. The final combined editor/handler/legacy/materializer/
execution suite passed 30 tests on the isolated dependency graph.

An actual Chrome session created a new analysis through WASM, edited annual tax
amounts 250000/200000 and implementation cost 1000, calculated the expected full
Rust snapshot (input hash `124dcb5d962ebcc32f6f3863ae3ac09bf3fa34e6cacb9f11b94e41ad761320f6`),
and saved a v2 attachment through Studio's existing device action. Only synthetic
`/api/me` and `/api/workspace-session` responses were substituted; the app,
repository, WASM and localStorage save were real. The first identity fixture had
an actor ID shorter than the existing access contract; the fixture was corrected
without relaxing production validation.

That session's reload stalled at the renderer/CDP level despite a 200 server
response; no confirmation dialog was present. It is not a reopen success.
Concurrent dependency graph replacement was a possible environmental factor,
not a proven cause. The task server was stopped, the shared node_modules junction
removed without deleting its target, and an isolated locked installation completed
for a cold repeat with a persistent task browser profile. Earlier captures remain
under `.artifacts/editor-browser/` and are labelled diagnostic.

The cold repeat completed actual edit, Rust calculation, device save, browser
close/relaunch, reopen and fresh Rust calculation. All complete authored inputs,
request, response, source and attachment fields matched. Save intentionally updates
`draft.updatedAt`, so the full report-snapshot identity changes; these are the only
snapshot differences. Device envelope bytes remained equal across reopening. No
current result appeared before the explicit new calculation. The retained receipt
is `.artifacts/editor-browser/reopen-receipt.json`; the saved envelope SHA-256 is
`724d9f91e2398df05f630ae677565bcd6fb8a15412553a3b02b2b0891dceb9dd`.

Ordinary reload also succeeded and retained `unfinished.` exactly, without a
current result. Actual rates/manual-override calculation succeeded, a rate edit
revoked confirmation, and a case-source edit blocked calculation. Explicit rebind
retained prior input and reset confirmation. A rebind started during a concurrent
source update was discarded; retry after the source settled succeeded.

Remaining rendered legacy, keyboard, narrow/enlarged-text and fail-closed runtime
checks, production build and unified final candidate checks remain pending. Physical
devices, spoken screen readers and P5 PDF/report activation are separate gates.
