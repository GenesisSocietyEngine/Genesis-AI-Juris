# Stage 5 — one My cases entry

## Intended outcome and criteria, before implementation

The existing `/matters` route will offer Personal (saved Studio drafts for the verified account) and Team (governed cases in the selected organization). Studio custom-case IDs and Matter dossier IDs remain separate; records are never combined by title. A Personal workspace is still an organization and its governed cases remain available in the Team view, with explicit wording explaining that storage distinction.

1. Personal lists only the existing authorized `/api/custom-cases` projection, including role/access, version and update time. Own and shared Studio drafts remain distinguishable and pagination stays available; no inaccessible counts or client-derived authorization.
2. Team renders the existing MattersClient unchanged. Existing dossier/section/target/request deep links select Team and retain exact target semantics. Normal links between views pass through existing departure protection; no local tab setter unmounts dirty notes.
3. New Personal metadata stays in component/controller memory only. Expiry/account/organization authority change removes it and fences late responses; failed reads show retry without stale success or private results.
4. Studio opens the existing exact `custom_case` route; Matter work stays in its existing controller. No save, history, conflict, approval, import or recovery contract changes.
5. The Studio recent-work entry leads to My cases while its current local draft continuation remains intact. Guest sign-in remains under OrganizationBoundary and normal return navigation.
6. Keyboard semantics, visible role/storage wording and a narrow layout are reviewed locally; hosted guest continuation, save/reopen/network conflict and expiry/role acceptance remain separate browser checks. No local test is a claim that those hosted scenarios passed.

Scope: new MyCases/SavedStudioCases components and bounded catalogue helper/styles/tests; `/matters/page.tsx` child integration; only the recent-work links in StudioEntryScreen. No JurisApp, navigation/auth authority, database/API/schema or existing MattersClient changes. Root approved this scope before implementation.

## Implemented behavior and bounded verification

The existing `/matters` route now hosts MyCasesClient. Its default remains Team, including bare URLs and the organization picker's existing destination. Explicit `collection=personal` opens saved Studio drafts; a `dossier` deep link always retains the existing Matter owner. This avoids a view change when OrganizationBoundary adds its selected-organization hint. The child MattersClient, its draft/notes controllers and all APIs remain unchanged.

Personal reads only the existing authorized custom-case summaries, separates owner/shared/administrator access, retains server ID and current version, and links directly to the existing Studio `custom_case` route. The displayed `updatedAt` is labeled Updated; it is not represented as a save receipt. Search and counts cover only loaded, authorized records, with explicit pagination. No title-based merge, grant, export, browser persistence or copy is introduced.

The new catalogue follows NavigationController identity/authority and the existing session-boundary invalidation signal. It removes metadata on expiry/revocation, rejects late responses and reloads after same-identity verification so changed grants are checked by the server again. Failed reads remove the previous list and expose retry. Normal collection anchors remain under the existing dirty/uncertain departure guard; they are not local state toggles that dispose the Matter owner.

Verification with pinned Node 22.23.2:

- 22/22 PASS: `node --import tsx --test tests/my-cases.test.ts tests/sidebar-navigation.test.ts`; [final log](evidence/my-cases/targeted-final-2.log). This includes route compatibility, distinct same-title IDs, no-store read requests, pagination, late-response fences, expiry/revocation, the actual existing local logout signal, same-identity grant refresh and preserved sidebar guards.
- Full TypeScript `--noEmit --incremental false`: exit 0; [log](evidence/my-cases/typecheck.log). The final follow-up changes only the default route literal and Updated wording; no type contract changed.
- The scoped CSS parsed successfully with PostCSS (17 rules); `git diff --check` passed. CSS rules provide wrapping cards, 44px controls and visible keyboard focus. These are source checks, not rendered layout proof.
- The initial new test run passed four controller checks then failed in the render harness setup (CSS-module/fixture module resolution). The harness was corrected; no product failure was concealed. It stubs the unchanged Matter child only to verify parent branch identity and loads the real new wrapper, catalogue and existing navigation context.

Browser acceptance remains NOT_RUN by this agent: narrow/zoom layout, keyboard operation, actual authorized Personal/Team navigation, guest continuation, saved-case reopen, network retry, conflicts and logout/expiry. Existing save/conflict/recovery flows were preserved at source and were not reaccepted through these local tests. Root owns browser integration and full-journey release evaluation.

Independent read-only review by gate_requirements: PASS, no material finding in current route compatibility, authority/lifecycle handling, source identities, normal departure links or bounded claims. No source commit, build, publication, data mutation or browser action was performed by this agent.
