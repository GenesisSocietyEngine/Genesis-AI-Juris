# Organization creation context correction

Before implementation: user outcome is to create or join an organization without losing an unsaved invitation in the currently managed organization. Acceptance: keep the current context and input; show the refreshed list and truthful success notice; use the existing guarded Manage action for an explicit context change. Stay retains input, discard opens the exact selected organization. Existing identity, revision and late-response denial checks remain unchanged.

Reproduced on ordinary synthetic owner session, loopback127.0.0.1:5296, built4f2b10f / digest08e3299acd75b11606b22be64e9fab8f21b9f1089689b2a1ff4d94326df8f634: same-name creation succeeded201 and changed URL, then the navigation controller denied the unexpected selection and hid private details. Explicit Refresh access recovered. Independent invitation_security review confirmed the cause and unsaved-input risk. The second aggregate was stopped during lint before editing; it is not completed evidence.

The revision-bearing Users & access link reached the correct organization and focused organization-users after hydration. Its URL format is supported, not a reproduced navigation defect; retain its behavior.

Implementation and targeted/browser retests will be recorded below. No provider delivery, hosted acceptance, screen-reader speech or zoom PASS is inferred.

## Follow-up: withdrawal must also clear the navigation role

Before implementation: a synthetic owner suspended the existing synthetic administrator through ordinary UI in a separate loopback cookie scope. Recipient Refresh organization details removed the member table and actions, but left the navigation asserting Administrator. Outcome/acceptance: that fresh missing or changed membership selection must withdraw shared navigation authority as well; unchanged context keeps dirty input, and revocation during the read fences late results. No permission policy or automatic real-time notification is added. Independent security review classifies this as P2 misleading authority presentation, not a demonstrated bypass. Exact source d935110/browser digest69729d0c0a4ab078ab10464798b070230cca63800c69a95bd4f2f6a3e5fc9fc3.

The d935 aggregate was interrupted during web4 for this correction. Native children survived MSYS parent termination. Read-only actual-process-working-directory evidence established ownership before approved cleanup;17 owned processes stopped,2 outside-directory console helpers excluded. The earlier4f2 run's later output continued across edits and is invalid exact-source acceptance evidence. Preserve both attempts and do not reuse their incomplete aggregate outcome.
