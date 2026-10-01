# Tax web production v105 — 1 October 2026

The user explicitly requested production publication and a PO/UX status report.
The existing Sites project deployed v105 successfully at
`2026-10-01T00:10:48.512791+00:00`. This is a web publication; remaining mobile,
accessibility, provider and pilot acceptance is not inferred from it.

| Identity | Recorded value |
| --- | --- |
| Custom domain | https://studio.falcon-merlin.com |
| Provider URL | https://genesis-juris-web.maxim-hayan.chatgpt.site |
| Site | `appgprj_6a88a26d2f808191aa076b9fcd8dbce6` |
| Saved version | 105, `appgprj_6a88a26d2f808191aa076b9fcd8dbce6~appgver_f36d238378d48191b1547bf9e4e00c31` |
| Deployment | `appgdep_6abda4ed8aa48191bc363c238958b9a7`, `succeeded` |
| Exact built/deployed source | `073a6382aa03ca7227e36fc134b82180d5e9d700` |
| Source tree | `08e985ad544168249683bae745f68ac2247ed952` |
| Accepted main merge | `1a8b7ee23c61ae3efc78283a0a29538ecae2bd86` |
| Application inputs | 429 files, SHA-256 `35f178afbdb51f4509f5e3c19525f2b32ff1aec62714794cd3f6494cd8920c98` |
| Audience / environment | Existing public audience / revision 40, preserved |

PR #79 was independently reviewed and normally retargeted from its development
stack to current main, which was already its ancestor. No source change was
needed. All 18 checks passed and no unresolved review or pending check remained.
Normal merge at `00:02:07Z` produced the identical complete tested tree. The
production checkout stayed on the fully tested PR head; its build provenance
does not claim to be a compilation of the merge commit.

The isolated checkout used Node 22.23.2 and npm 10.9.8. Locked installation
completed with 527 packages and no lockfile changes. The supported repository
build passed strict TypeScript, generated shared-Rust asset verification, both
migration statement controls, the locked mobile contract and bounded vinext
compilation. The complete local build-log SHA-256 is
`97b8c7031093b2e737ff687752e776447ce9f8e20c24b42445181722a8064893`.
The unchanged source was ordinarily pushed to the Sites `main` branch and read
back exactly before saving the version. Previous Sites source was v104's
`4cb050f51a3448f6e051d11d16e58d5ee547e9ec`; no force push was used.

Packaging independently recomputed the complete source identity, matched every
application input to Git, compared the full migration inventory and bytes, and
verified every TAR member. The archive contains only compiled output and Sites
metadata: 438 files, 40,878,080 bytes. An initial archive placed the Worker at
`server/index.js`; the provider rejected that layout before creating a version.
The corrected archive leaves `.openai/` at root and puts compiled client/server
output under `dist/`, including the supported `dist/server/index.js`. Compiled
bytes and source remained unchanged; the rejected archive is retained separately.

The corrected local TAR SHA-256 is
`6aa5df8d1606d5421b359310d0977be4e76c13ce27a162b69a623cbd2399744c`.
Saved v105 reports `archive_storage.content_hash`
`sha256:4d2266d236bafb3dc23151af2e343b3c587946ebbf3e27677d3a112865398e17`,
with the same source, size and file count. The local TAR remained unchanged.
The callable provider contract does not define that field as the raw transport
TAR checksum, and bounded investigation did not establish a normalization cause.
These are recorded as distinct local/provider identities; byte-identical remote
archive storage is not claimed. No remote archive was downloaded or executed.

The provider's terminal success is the publication proof. The initial fresh
Edge browser loaded the custom-domain Case Studio and Demo pages, with the home
viewport visually inspected and no captured browser error. A separate Python
HTTP request for the runtime manifest received 403; it is not counted as a pass.
Fresh guest Edge browser requests at `00:16:59.582Z` then returned HTTP 200 for
all three deployed Rust assets. Each complete byte count and hash equals the
local production build, independently rechecked against the retained browser
receipt. The served manifest identifies exact source `073a638` and application
digest `35f178af...`.

| Served asset | Bytes | SHA-256 |
| --- | --- | --- |
| `tax-runtime-entry.json` | 268 | `b0a4fec105bb1ffaebfe7de330d96150dff55051bb1d04ea7c4e1fa4b4c3dadc` |
| `_next/static/chunks/tax-runtime-Bnxv2iAp.js` | 3,147 | `9ee7583fdfc78e9f5dc2a51a6e078fdfda43cf8cac2fb416f2cbba03964888ed` |
| `_next/static/media/juris_tax_wasm_bg.CRo4SHCF.wasm` | 926,022 | `2dfdd6b2961b8965c3ab92d9976f32b4a4b1ccbc3c9a0aac0594b7c05d68510d` |

Raw receipt `public-smoke/served-assets.json` has SHA-256
`56400219764426decd46e7f822a2683e3edb427dbd9e04888ad96f6209ca19f8`.
This proves served asset equality; it does not explain the provider's archive
hash or establish the whole remote archive's bytes.

The fresh guest browser then created a labelled synthetic case through actual
application controls and entered annual tax amounts. At `00:27:48Z`, clicking
`Calculate with Rust` displayed a fresh result for `tax-economics-2026-09-29`,
input hash `6c06266b48b62a22e35a78eabe4561696824389d0c971d77959a8ba94809266f`.
Inputs were EUR 10,000 baseline tax, 7,000 optimized tax, 1,000 implementation,
500 annual maintenance, zero terminal cost, 36 months, 800 discount basis
points and 10,000 benefit-realization basis points. Observed output included
EUR 2,166.67 annualized benefit, 6,500.00 lifecycle benefit, 5,675.69 NPV,
260% lifecycle ROI and four-month payback. Tax-base inputs were explicitly
unavailable. The retained UI snapshot is
`public-smoke/20261001T002748167305Z-command.json`.
The page correctly labels this guest draft as unsaved and requires a verified
account for workspace/device saving. This check does not claim production
save/reopen, provider-backed sign-in or account-history acceptance.

The same guest flow opened `Create analytical report` and `Preview PDF` at
`00:28:34Z`. The dialog identifies a preliminary **Base decision report**, a
working draft that is not the exact workspace version, and keeps human approval
separate. The result and report-dialog screenshots were independently inspected:
`public-smoke/03-fresh-rust-result.png` and
`public-smoke/04-preliminary-pdf-preview.png`. This bounded viewport review does
not establish a hosted tax-memorandum/economic-assessment PDF journey, all PDF
pages, tagging or accessibility. Those local/CI report proofs remain distinct.

The final `public-smoke/RESULT.json` has SHA-256
`fe0799a60decb15dd760e7d8f2f6020b8b194b276a1dbf496bb269fd7e1b6735`;
all 95 listed evidence files were independently checked for complete byte counts
and hashes. A later read-only attempt to fetch the preview blob failed with
`TypeError: Failed to fetch`; no PDF bytes, download or content parity are claimed,
and the cause was not established. The owned guest browser closed at 00:30:15Z;
00:30:37Z inspection found zero owned Edge processes and a clean tracked
production checkout. Its isolated diagnostic profile remains retained.

Exact source, build, archive and provider receipts are retained in
`.worktrees/tax-production-2026-10-01/.artifacts/production/`. The independent
hash review is `.artifacts/tax-production-2026-10-01/ARCHIVE_HASH_REVIEW.json`.
No migrations, resource bindings, runtime values, invitation recipients or
audience settings changed. Credentials are excluded from these receipts.

Subsequent main `1a8b7ee` checks are separate: all seven non-iOS jobs passed,
with full web/Worker/Rust/PDF artifacts independently verified. Native run
`36794112807` / job `110153478772` explicitly passed
`RunnerTests.testNativeLogisticsLifecycle()` (PASS recorded in the job log at
`00:20:09.050310Z`, duration 0.260 seconds),
with both archive audits and 27 fake/eight real macOS fixtures. Artifact
`11133656595` is 179,662 bytes, SHA-256
`2041d231b47faa13a179cabfc49011f7dccca60b4d8d28baba58cd6bf06eeaa5`;
all 41 files equal the original ZIP. Main application run `36794112747` /
job `110153478590` remains pending: eight of nine main jobs have passed.
Earlier PR-head evidence is not relabelled as main or production execution.
