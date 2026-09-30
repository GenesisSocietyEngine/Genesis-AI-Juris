# Reopened browser artifact and native C ABI parity

This receipt covers the actual P4C browser create/edit/calculate/device-save/close/reopen/fresh-calculate artifact. Authentication used a synthetic two-endpoint identity fixture; the application, storage, and browser Rust execution were real. It is not mobile-device or PDF acceptance.

The complete retained capture is `tax-web-editor/.artifacts/editor-browser/cold-reopened-calculated.json`, SHA-256 `19d3375d1088625688d3487a47c778712a8f8bf90217ea2ce9a8516e9ceebc97`. Its exact calculation command was passed through the existing Windows `juris_mobile_bridge_execute` export. The returned Rust allocation was released once using `juris_mobile_bridge_string_free`; ABI version was 1. No auxiliary export or alternate calculator was introduced.

The library was built using `cargo +1.95.0 build --locked -p juris-mobile-ffi`. Native Rust paths match source `92532d93d3724582f98464431c8fd69164885994`; the web/PDF working tree was still uncommitted. An explicit provenance run exited 0 with Rust 1.95.0. The retained build record hash is `271b806dfa8c17b43d50e16d4ec7a55eedd289e740fbae325a586b342c46f976`, log hash `1a893896239f4f554ddef6e3ac6c404bd3d40115762983edd9f10b2981ca0f7e`, and DLL hash `07c58d350b6a7ae5f267b5a231f138361d04e199dffa88fc4afd04cbdb9df6cb`.

The final helper verifies the full source descriptor, normalized request, component bindings, required IDs, missing inputs, context, every execution version, input/binding hashes, and full financial result against the browser snapshot. It retains the entire browser capture, request, native response, snapshot and build provenance. A first comparison incorrectly expected the response's nested source to repeat `source_schema`; the protocol places that version at the response top level. The corrected comparison requires both the exact descriptor and that separate schema field. It does not ignore other fields.

Final evidence directory: `.artifacts/browser-native-parity-2026-09-30T1729`. Receipt SHA-256: `e7e16150460a26cd7ccd6771ff9243da7146002646a130a00820864b5387e1e6`.

| Bound item | SHA-256 / value |
| --- | --- |
| Exact request bytes | `423ab186e808429cdff80af54df01594e6b90787adbe22896a6f8db8152f97d3` |
| Native response bytes | `5914755944e16eb05b1d7dc20c40f4260fea605d18cbb8cfb9e8efac81bf26f5` |
| Rust input hash | `124dcb5d962ebcc32f6f3863ae3ac09bf3fa34e6cacb9f11b94e41ad761320f6` |
| Rust binding hash | `a63472c650a7062d0e61c31a8676697a304e322fdb904f3843e2496dbdcbb40c` |

Independent review confirmed the bounded call/free and comparison flow, then requested complete capture retention, binding/version comparisons, and explicit DLL build provenance; these are included in the final receipt. The original browser source contains an unsupported governed-font character, so this same artifact must refuse PDF output. A successful native/browser/PDF application journey requires an explicit source edit/rebind and a new equally bound artifact. The earlier 22-PDF cohort deliberately used a different supported source premise and must not be relabelled as this artifact's PDF evidence.

## Explicit source correction and same-artifact PDF parity

The actual P5 dialog refused the original unsupported `U+1F4B6` glyph. The browser journey then explicitly replaced that character with `EUR` in the existing publishable context editor, confirmed the change, rebound the source, recalculated through Rust and saved. After closing and reopening the browser, no current result appeared until a new calculation. No parity helper changed, normalized or replaced that draft.

The new full capture is `.artifacts/p5-application-browser/corrected-reopened-calculated.json`, SHA-256 `6dd269a95e6e8b98e33595b64aac77c62dace479376e9e543a04b1170094ca02`. Replaying its exact command through the same verified native DLL passed every full-source/request/binding/version/result assertion. Retained directory: `.artifacts/browser-native-parity-2026-09-30T1746`. Request SHA-256: `e8a8e477689dbf1bd34b93e373e9b0aefe358ca589b17c3bf23c7d660d2a76d8`; native response SHA-256: `ea9ec1c147af4158331bbcbee14b9c4def6d6ac6a446b1601fa20efc4e3aa5b7`. Its new input hash is `ecd641852283f26780a3dffe5ec110a4630c69d7cd78477964bf48bb74efe1a5` and binding hash is `c3a5fed6d750bf0f5fb6ae576cc79f97a4ca968df86959684ac2315f7ab7ee0b`.

An independently reviewed local helper next required equality of the **entire** reopened browser snapshot with fresh packaged Rust, then built both supported report profiles in both languages from that unchanged draft. All four actual PDFs passed complete tax-label/value/note extraction, localized profile-label checks, exact model bindings, A4/metadata checks and all-page render/sanity checks: **34 pages and 34 PNGs**. Root visually inspected the Russian economic-assessment cover and English/Russian financial tables; no clipping or incorrect profile title was observed on those pages. This visual sample is distinct from automated all-page rendering and text checks.

The retained `.artifacts/browser-native-pdf-parity-2026-09-30T1747/receipt.json` has SHA-256 `0e46be36dd91f086b707da199f026af6353870a535b3b237a17883bee04ef82f`. It includes the full comparison snapshot, compact per-PDF receipts, exact PDF and page-image hashes. Source is locally integrated base `f735ca4` with P5 changes still uncommitted; it is not clean PR-head evidence. These generated files establish same-artifact native/browser/report parity. The actual browser's preview, download completion and receipt persistence are separate application evidence.

An independent read-only audit rehashed the browser/native receipts and complete capture, compared the entire snapshot and all native source/request/binding/version/result fields, and verified all four PDF hashes and exactly 34 contiguous page-image hashes. Standalone receipts match the manifest and model identities. No material finding remained; the audit did not rerender files or expand the three-page visual sample into an all-page visual claim.

Peer review caught a QA-only label error before this run: the shared option helper always named the tax memorandum, even when a cohort selected economic assessment or Russian. It now resolves the actual profile/language label from the same registry as the dialog, with explicit overrides preserved, and extracted PDF checks require it. The application dialog already used that registry. The earlier 22-report run remains financial/text evidence but is superseded for profile-label acceptance by the corrected cohort recorded in `PDF_INTEGRATION.md`.
