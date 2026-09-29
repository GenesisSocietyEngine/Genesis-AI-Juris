# Organization creation context correction

Before implementation: user outcome is to create or join an organization without losing an unsaved invitation in the currently managed organization. Acceptance: keep the current context and input; show the refreshed list and truthful success notice; use the existing guarded Manage action for an explicit context change. Stay retains input, discard opens the exact selected organization. Existing identity, revision and late-response denial checks remain unchanged.

Reproduced on ordinary synthetic owner session, loopback127.0.0.1:5296, built4f2b10f / digest08e3299acd75b11606b22be64e9fab8f21b9f1089689b2a1ff4d94326df8f634: same-name creation succeeded201 and changed URL, then the navigation controller denied the unexpected selection and hid private details. Explicit Refresh access recovered. Independent invitation_security review confirmed the cause and unsaved-input risk. The second aggregate was stopped during lint before editing; it is not completed evidence.

The revision-bearing Users & access link reached the correct organization and focused organization-users after hydration. Its URL format is supported, not a reproduced navigation defect; retain its behavior.

Implementation and targeted/browser retests will be recorded below. No provider delivery, hosted acceptance, screen-reader speech or zoom PASS is inferred.
