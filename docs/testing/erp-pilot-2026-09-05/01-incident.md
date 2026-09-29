# SYNTHETIC — ERP-PILOT-001 incident

Fictitious training organisation: Northwind Training Lab. No real customer or personal data.

An overnight bank-feed retry creates two candidate import batches for the same statement reference. Neither candidate has been posted. The operations lead pauses posting and requests a reconciled, reviewable decision before the next scheduled import.

Known facts: the original source statement is retained; two import attempts share its reference; the accounting ledger has not yet changed. Open questions: whether the import is idempotent, which candidate contains the complete rows, and who may authorise resumption.
