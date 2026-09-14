# Product change review

The product owner requires review and evaluation after every step, for all future work in this repository.

- Before each implementation step, identify the intended user outcome and its acceptance criteria.
- After that step, review the resulting behavior, wording, navigation, accessibility and preservation of existing work. Fix material findings before proceeding.
- Use proportionate evidence: inspect the diff, run relevant existing checks, and exercise changed user flows in the browser when available. For layout changes, inspect the rendered result, including narrow layouts and long text when supported.
- Record the outcome, evidence and remaining limitations in the task's review notes under `docs/testing/`. Clearly distinguish verified behavior from checks that could not be completed.
- Review the complete user journey before publication. Do not claim a check passed without evidence. This review requirement does not add a separate user-approval gate.
