# SYNTHETIC — ERP-PILOT-001 control plan

Required before resumption: compare source and candidate row counts/totals, check existing ledger references, demonstrate idempotency in an isolated test, retain rollback evidence and obtain an authorised reviewer's approval.

Proposed alternative A: validate and retain one unposted candidate, remove the redundant staging candidate using a reversible procedure, then resume with a verified idempotency key.

Proposed alternative B: quarantine both unposted candidates, reconcile a fresh isolated import against the original statement, then approve a controlled replacement.

These are proposals. The professional must choose and document the remedy. Do not execute production deletions or post accounting entries from this demonstration.
