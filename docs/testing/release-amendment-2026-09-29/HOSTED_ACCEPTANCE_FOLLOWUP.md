# Hosted acceptance follow-up - 29 September 2026

This is post-publication evidence for production v103, not proof that the pre-rollout gate sequence was completed. Source is `ddb61267c9d4368b3d1cb654a8d3a5c989bddf69`, deployment `appgdep_6abbd4eccd6c8191b44e4e0cb7ab4169`, environment revision 40. The live Site readback still reports version 103. Canonical main at start: `edfca4bcd8eccbc72c9c90193529e22b006e15b2`. No application code, environment or deployment was changed by this acceptance slice.

## Observed on the live custom domain

| Journey | Result and evidence |
|---|---|
| Ordinary ChatGPT sign-in | PASS within this session: the user selected the saved account through the secure browser prompt; the target domain then showed signed-in account and organization controls. No bypass token used. |
| Account identity and controls | PASS for the desktop account screen: name/email displayed without member-ID text; Continue to your work is a readable blue control and opens Studio; Sign out is visible in the sidebar. This does not mean every identifier-based workflow has been removed. |
| Save and reopen | PASS for a new synthetic Project Canopy v2.0.0 working copy: Saved to workspace confirmed at 16:58:26Z; a full reload reopened its title, question, recommendation and recorded source baseline. It later appeared in Personal drafts. Existing saved cases were not edited. |
| Four PDF variants | PASS within the [independent Canopy PDF review](HOSTED_CANOPY_PDF_REVIEW.md): Base OFF 3 pages, Medium ON 7, Full ON 15, Full OFF 8. Files downloaded at 16:59-17:01Z. All 33 pages rendered; Full OFF retains all eight core sections. Exact file hashes and limits: [JSON receipt](HOSTED_CANOPY_PDF_REVIEW.json). |
| Receipt freshness | PASS for observed UI behavior: changing report settings marks the earlier receipt stale; each completed generation shows a matching current receipt. This is not independent approval or a governed-output journey. |
| Organization navigation | PASS for ordinary authorized context selection: Open cases selected an existing organization and its empty team list; Personal showed account-owned drafts separately. Original Personal workspace context was restored. This is not cross-account access-isolation proof. |
| Sign out and private-draft denial | PASS within this session: Sign out returned to guest Studio; revisiting the saved draft URL hid its contents and displayed a sign-in requirement. Logout was observed around 17:03:41Z. |
| Live database diagnostic | BLOCKED: direct browser navigation to the existing parameterless /api/admin/database-state endpoint returned net::ERR_BLOCKED_BY_CLIENT. This is a client limitation, not a site authorization verdict, bot diagnosis, or schema result. No alternate route or credential bypass attempted. |

The browser download-event waiter timed out for Base and Medium; their actual nonempty PDF files appeared in the synchronized download directory and were inspected. A receipt alone was not used as delivery proof. Account screenshots remain private; public evidence excludes email, member/organization identifiers and raw request headers.

## Open scope and next actions

The organization invitation UI now presents email, role and explicit acceptance; legacy ID invitation controls remain collapsed. The separate case participant enrollment form still presents Existing account Actor ID by default. Treat that as an unresolved UX scope item requiring its own identity-resolution/access design; INV01 does not demonstrate email-based case enrollment. No invitation email was sent, no membership or case permission was changed, and no authorized second test account/mailbox is established by this receipt.

Remain BLOCKED or NOT_RUN as applicable: resource-bound backup/isolated restore rehearsal; independently obtained live journal/schema, live foreign-key and preservation checks; real invitation delivery/mailbox proof/acceptance and negative cases; permitted source-v2 stale/reassessment/review/output flow; guest-auth-cancel, lost-response/conflict and expiry variants; second-account organization isolation; genuine keyboard/screen-reader/200%/mobile-tablet acceptance; Five Flats/65-line hosted preservation; remaining 42-row ledger and A17 new-user validation. Preserve existing native emulator/iOS timing limitations separately. Publication and this bounded smoke do not close those gates.

Next sequence: use the supported saved-report comparator when an authorized diagnostic receipt becomes available; obtain the platform operator's actual recovery identities/permissions and isolated rehearsal; obtain specifically authorized controlled invitation recipients and a second account; complete the remaining bounded journeys, then reconcile each original ledger row. The isolated tax P1a boundary work does not make native/Flutter tax authoring available and requires no web redeployment.
