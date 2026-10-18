# Vertical node palette — review and release

18 October 2026. Requested outcome: place creation tools beside the decision map, keep them available during map/page scrolling, and reclaim the previous horizontal palette's height.

## Baseline and bounded implementation

Native Sites reports public v144. Canonical main and clean isolated HEAD were ea1caffb5aa0bdb74b0db623a0aa2dd993a4f204; its difference from runtime7515d185d31513b00aa0959e61426596ff6875bd consists of six Markdown files only. Supported Sites source opening confirmed the same documentation HEAD before edits. Root checkout belongs to another writer and is excluded.

The existing native details disclosure opens by default. Desktop uses a reserved180px left column, sticky within the workspace, bounded to viewport height with independent tool scrolling. Collapsing leaves a48px labelled rail and returns width to the map. At intermediate widths the inspector follows the map; narrow screens use a bounded two-column disclosure above it. The palette never overlays graph nodes. Native disclosure keyboard operation and visible focus remain available; presentation changes do not write case data.

Only JurisApp's disclosure and workspace-design.css change. Existing lazy palette boundary, drag authority/context guards, coordinate conversion, add/history/undo/save callbacks, zoom and case/source formats remain unchanged. No new dependency, schema, template or fixture hash. Preserve all cases, particularly user-amended37/39 and negative regression38; use a fresh synthetic identity for any production edits.

## Acceptance and review

- Eight existing actual-handler/normalization/source-revision map regressions passed; strict TypeScript passed.
- Desktop: inspect vertical arrangement, sticky containment, collapse/reopen by keyboard, zoom, viewport and scrollbar access; verify native drag and click fallback.
- Narrow EN/RU: measure actual viewport, wrapping, disclosure bounds, reachable controls, inspector and absence of document overflow.
- Existing source/undo/save regressions remain distinct from authenticated production save/reopen evidence.
- Required canonical web/PDF gates, exact merged-source build, current live predecessor retention, Sites receipt and both-origin asset verification must complete before release is claimed.

Local rendered review found the inherited app-shell overflow-x:hidden created an unintended scroll container, defeating sticky positioning. The bounded map-shell amendment uses overflow-x:clip/overflow-y:visible. Recheck confirmed palette top16px while the page moves. No map overlay: desktop measured columns180/763.6/250px; collapse48/895.6/250px and unchanged65 nodes. Native Actor drag at110% created exactly one node at445,91 with the ordinary dropped status. Narrow EN/RU at actual390px (document375px) used a341.6px disclosure, two146.4px tool columns and320px height cap. Russian labels, including jurisdiction, fit without button or document horizontal overflow. Native Enter collapse/reopen worked. Responsive override was reset. These local checks are not authenticated persistence evidence.

Changed-source lint passed with seven inherited unused-variable warnings and no errors. Review confirms no new hook/effect/state, no eager dependency, no data callback changes and native keyboard disclosure semantics. Rollout remains pending at this checkpoint.
