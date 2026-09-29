# Product change review

The product owner requires review and evaluation after every step, for all future work in this repository.

- Before each implementation step, identify the intended user outcome and its acceptance criteria.
- After that step, review the resulting behavior, wording, navigation, accessibility and preservation of existing work. Fix material findings before proceeding.
- Use proportionate evidence: inspect the diff, run relevant existing checks, and exercise changed user flows in the browser when available. For layout changes, inspect the rendered result, including narrow layouts and long text when supported.
- Record the outcome, evidence and remaining limitations in the task's review notes under `docs/testing/`. Clearly distinguish verified behavior from checks that could not be completed.
- Review the complete user journey before publication. Do not claim a check passed without evidence. This review requirement does not add a separate user-approval gate.

# Source-control delivery

- The canonical repository is https://github.com/GenesisSocietyEngine/Genesis-AI-Juris; use a current Git ref as the contributor review base, not a dated uploaded ZIP.
- Start by recording local HEAD, remote main, dirty paths and current task ownership. Use an isolated checkout when another writer is active.
- Commit each coherent reviewed implementation slice. When repository publication is authorized, promptly push that task branch after checking the outgoing source for secrets and unintended files; do not leave the only copy in a temporary checkout.
- A pending production/provider/human acceptance gate does not prohibit a clearly labelled development checkpoint. Keep source synchronization, integration acceptance and deployment decisions separate.
- Integrate working changes into main through ordinary repository controls within the authorized task scope. Do not force-push, bypass rules, broaden the feature scope or claim a release because a merge succeeded.
- Never blanket-stage local artifacts, linked worktrees, credentials, database state or another session's changes. Name each remaining dirty functional path and its owner/disposition.
- At handoff, verify the actual remote branch/commit and state whether main contains the candidate. Local commit success is not remote synchronization. Record CI still running or blocked honestly.
- When developing from an isolated source clone, reconcile the completed task with canonical main before starting the next slice, preserving any newer in-flight work.
