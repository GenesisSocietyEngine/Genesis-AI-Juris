# CV-011 · Billing and reconciliation

## Observed workflow, 10 November 2026

The signed-in MyCase walkthrough opened the billing dashboard, time entries, expenses, requested funds, invoice selection, account statements, payment plans, trust account activity, financial insights, the timesheet calendar and legacy reconciliation. The time form selects case, user, activity, billable status, date, rate and duration. The expense form adds receipt, cost and quantity controls. Invoice creation starts with uninvoiced amounts by case. Account statements start with a contact. The timesheet has billable and non-billable views. The legacy reconciliation page matches collected payments to records. The walkthrough did not submit account data or initiate payments.

## CaseVant candidate

Billing is available from workspace navigation. The operator selects a case. EUR entries use integer cents, time uses integer minutes, and hourly charges round half up per line. Staff case owners and contributors can record time and expenses. Organization owners/admins with case access can issue invoices, record externally completed payments and trust movements, request funds, schedule installments, reconcile statement references and void unbilled entries. The journal records actor, time and sequence. A unique operation key and case sequence protect retries and concurrent changes.

Invoices retain selected lines, recipient and due date. An expense can link an exact uploaded receipt version from the same case. Recorded payments reduce the referenced invoice balance. Trust balances remain separate and cannot be overdrawn. Payment plans split the exact outstanding cents into monthly installments. Register and date filters support daily timesheets and billed/collected comparisons. The operator’s instructions specify EUR and recording/reconciliation of existing transactions.

## Verification and release

An isolated browser fixture exercised a synthetic case through a 30-minute entry at EUR 100/hour, a EUR 50 invoice, a EUR 20 receipt and reconciliation. The displayed outstanding balance was EUR 30 and trust balance remained zero. The Russian layout displayed the same three balances at 390 CSS pixels without horizontal overflow. Unit checks cover rounding, duplicate lines, billed entry reuse, overpayments, trust overdrafts, repeated reconciliation and month-end installment dates. An in-memory SQLite database applied migration 0036 and rejected duplicate sequences, reused operation keys and invalid case references. Historical migration checks passed.

Live migration 0036 and signed-in acceptance with independent staff roles remain pending. This candidate provides case statements and recorded transactions. It does not deliver cross-case client statements, bank-feed import, direct file upload inside the expense form, tax invoice configuration or collection through a payment processor.
