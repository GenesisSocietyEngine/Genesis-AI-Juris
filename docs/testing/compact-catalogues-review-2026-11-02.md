# Compact Templates and Demo review — 2 November 2026

## Outcome and acceptance

The user extended the compact Sources request to Templates and Demo. Use one consistent, single-column row list, including two-result filters. Keep full titles, category/jurisdiction, fictional status, intended output and direct opening actions visible. Put complete descriptions, prompts, intake and source/editorial guidance in native, initially closed disclosures. Preserve all nine starters, 15 examples, nine category filters, Canopy’s optional walkthrough, saved-play recovery, cancellation, authority and working-copy safeguards. This bounded layout slice takes priority over S03 proof; it does not close S03.

## Verified starting source

Clean local/remote canonical main d3b96aeb6d49a2f8284cb15c16cf4ff39ed86494 matches public v168’s 579 application inputs and hosting configuration; its source SHA differs from runtime 2457b9d65a7574dadfbfa875ba5152be31785350 only through documentation. Application hash 09e47f5bbdae754a3d038f85f27f7dc3f4d555ad13808affc191d2bcc9514e9c; hosting hash 20c4899db37316b7bf0bddf07ec2e526afe531e09808c9a2e22d0298a7d63ebe. Existing public Site opened through the supported source helper before edits. No dependency, factory, source, persistence, authority, report, recording, hosting or binding changes.

## Implementation and review corrections

- Templates retain two explicit direct actions: empty starter and authored example. Numbering survives filtering. Recovery/history limitations remain visible above the list.
- All Demo families use the same compact row and “About this example”; Canopy retains Featured/Advisory decision, nine-document/four-variant text and lazy optional walkthrough. Converted examples are explicitly fictional. Longer prompts, source outlines, editorial versions and feedback remain available without truncation.
- Opening status, Cancel and retry remain outside every disclosure. Native summaries have unique title suffixes, visible focus, keyboard activation and full-width wrapping. On narrow screens actions wrap below metadata, with measured 46.5px button height.
- First desktop review caught vertical Template actions using excess height. They now sit side by side on wide screens and wrap on narrow screens. Review used the React checklist: stable existing keys, no new effect/state or authority path, inert rendering, lazy walkthrough retained, native keyboard controls, no HTML injection or data mutation.

## Local full-application browser observations

At equal 1,195.2px list width / 1,522px viewport width, all 15 collapsed Demo rows measure 3,087.56px versus 4,238.10px (about 27% less); nine Templates measure 1,415.40px versus 1,876.46px (about 25% less). The old viewport was 688px high and local 632px; these are equal-width list-height measurements, not equal-height screenshots, retrieval speed or human review results.

Chrome local full app on port 4187: Enter expands Canopy’s complete description and retains focused summary/direct action; optional walkthrough loads the nine documents and four scenarios. Advisory filter shows two rows. RU Template tax search shows two; Enter reveals full intake questions. Empty search shows zero; keyboard Clear restores nine. EN Demo and RU Demo/Templates at actual 390×480 have no document horizontal overflow; measured primary actions are at least 46.5px high. Temporary viewport is reset.

An empty local starter opens directly. A local Canopy opens directly with About closed and shows 14 records. Both local synthetic tabs are retained (starter 178222777, Canopy 178222780), with no workspace saves. Leaving Canopy exposes the existing unsaved-input confirmation; native AX identifies it when DOM capture misses it, and Stay here cancels navigation while retaining the case. Search restoration after completed return is not claimed because the case was preserved. Pointer Clear during a simultaneous viewport reset is unconfirmed; subsequent native Enter succeeds. These input/capture limits are not product-defect findings.

## Checks and remaining gates

42 existing focused catalogue/category/conversion/navigation/UI checks pass. Four additional EN/RU structural regression checks prove direct opening/cancel/retry are outside initially closed guidance, all starters/examples retain full copy, feedback is intentionally disclosed and rendering invokes no launch callbacks. Strict TypeScript and changed-file lint pass. Initial sandbox Node execution failed before tests with uv_os_get_passwd ENOMEM; the same commands run successfully with approved execution. A synthetic test initially used a nonexistent category key; corrected to the real registry identity before passing, with no application change.

Candidate and exact-main full web/PDF/package/audit gates, exact CI artifact adoption, Sites save/deployment and fresh production checks remain required. Local/component evidence is separate from production. Preserve all original/synthetic saved cases and existing unsaved tabs. No production case saves, replacements, deletions or bulk mutations are part of this slice. S03 authenticated save/reopen/export, legitimate unsupported-owner recovery, same-tab identity/timing, historical/original-source, native and operator/commercial limits remain open. Do not claim commercial readiness from this density amendment.
