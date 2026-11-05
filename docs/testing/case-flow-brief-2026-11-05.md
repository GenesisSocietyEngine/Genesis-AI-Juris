# Case-flow brief outline review

## Outcome and acceptance

Provide an optional starting outline for logical case planning inside the existing brief editor. Preserve all authored text byte-for-byte, use the existing prompt buffer and departure protections, retain explicit AI analysis and reviewed graph application, and add no provider call, source selection, task execution or persistence path. Hide this action for canonical-import text. Do not silently truncate content or append duplicate outlines, including after a language switch.

The branch started from PR226's reviewed head while its last CI job finished and was fast-forwarded to canonical merged main `d411fc631eb2bfe2a9eb892a2a75323fbd393d69` before follow-up publication. PR226 passed all six workflows; its first iOS application timeout remains distinct from the passing second attempt. The public Site remains v179 until a verified release receipt is recorded.

## Implementation

A lazily loaded EN/RU guide appends seven editable headings for objective, jurisdiction/parties, facts/issues, evidence references, known dates, alternatives/conditions and missing information. It uses the existing `loadCasePrompt` path to invalidate old proposals and focus the editor. No additional unsaved field state is introduced. Existing canDuplicate, restoration, operation and analysis guards apply. The guide explains that references are author notes, not selected or verified documents.

## Verification

- Three focused tests pass: exact text preservation in both languages; duplicate refusal across languages/line endings; exact 64,000-character acceptance and overflow refusal; ordinary heading mentions remain usable.
- Actual local application in the in-app browser, synthetic unsaved case: existing sentence remains exact, all seven headings appear, focus returns to `studio-case-brief`, and duplicate insertion is disabled.
- Overview → AI case flow retains the full outline in the existing prompt buffer.
- Actual 64,000-character brief shows the limit explanation, keeps all characters and disables insertion.
- Russian keyboard Enter activation inserts the Russian outline and focuses the editor. At actual 390 × 640, document width and scroll width both equal 375 CSS pixels; narrow screenshot reviewed with no horizontal overflow and readable wrapping.
- Canonical marker visibility check removes the guide and retains the existing local verification action. This does not claim a new canonical import acceptance run.
- No AI request, workspace save, document mutation or MyCase business-record write was executed. Account/permission/provider acceptance is unchanged and not newly established by this guest browser test.

The initial Windows native inspection was stopped by URL-verification enforcement; the user requested retry and local browser testing resumed in the supported in-app browser. Sandbox loopback restrictions prevented the first preview launch; the authorized local preview subsequently started outside the sandbox. Neither environmental interruption is counted as a product failure.

English Tab from the brief reaches the outline button; Enter inserts it and returns focus. EN and RU narrow screenshots were reviewed at 390 × 640. Strict TypeScript passed. Changed-file lint has zero errors and seven inherited warnings in JurisApp. The combined outline, AI-plan, departure and continuity run passed **48 tests, zero failures or skips**. Full canonical CI remains the integration/release gate. No release claim is made by this development checkpoint.
