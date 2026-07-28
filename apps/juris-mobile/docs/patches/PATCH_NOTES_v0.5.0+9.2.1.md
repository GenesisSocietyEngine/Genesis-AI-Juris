# PATCH NOTES v0.5.0+9.2.1

## Regression-test isolation fix

The expert-report lifecycle implementation in v0.5.0+9.2 correctly resolves the unreviewed expert report after hearing attendance. The focused regression test still left the unrelated `cfo-pressure` Inbox item in `ACTION REQUIRED`, so the aggregate required-response count remained one.

This patch:

- resolves the CFO message during test setup;
- asserts directly that no expert-report notification remains action-required;
- retains the aggregate `unhandledRequiredMessages == 0` assertion once unrelated setup state is cleared.

No production gameplay logic is changed.
