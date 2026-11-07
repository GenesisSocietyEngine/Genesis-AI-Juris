# CRM and contacts review, 7 November 2026

## Starting point and reference

The clean checkout and canonical main both pointed to `055092e904708e5d3f9bcdd98edd8cbc5ac7edd2`. Public v195 served `64ef7cd70fa0d594be47f11bac021c1f075d0cda`. The existing People directory derived names and participation from accessible cases. A person outside a case and a company had no editable address-book record.

Signed-in, read-only MyCase inspection covered the separate People and Companies lists, Active and Archived views, search, group filters, import entry points and the blank Add person and Add company forms. The person form grouped identity, email, phone and address with explicit save actions. The company form included its own contact channels and an employee follow-up. No forms were submitted and no contact records were copied. [MyCase People](https://maxima-consult.mycase.com/contacts/clients) · [MyCase Companies](https://maxima-consult.mycase.com/contacts/companies).

## Implementation acceptance

- Create a person or company independently of any case. Search, group and preview records, edit their details, associate a person with a saved company and archive or restore a contact.
- Review same-kind name matches and shared email addresses, including archived contacts. Separate identities require an explicit decision. Preserve existing participant identities, case roles, evidence, originals and membership.
- Link and unlink a case only with current case-write authority. Show a contact’s case associations only to participants who can open those cases. Preserve the current saved Studio case and governed return location across workspace navigation.
- Preview up to 25 CSV rows, explain rejected rows, commit only reviewed rows and undo an untouched import into the archive. Reject stale edits and retry a lost response against its original operation.
- Inspect English and Russian presentation, narrow layouts, keyboard focus, save feedback and real storage behaviour before release. Use synthetic data for writes.

## Development verification

The isolated D1/R2 route suite passed all 14 checks, including the upgrade of a populated database, cross-organization isolation, auditor write rejection, concealed case links, exact retry, stale edits, reversible import and atomic rollback. The first browser pass used the actual contact handlers and a synthetic database. It exercised both contact types, company affiliation, edit, case link, archive, restore, import preview and undo. A Contacts → Library → Contacts round trip retained the identical Studio return and governed case. In the Russian 390 px fixture, the header and case-return commands measured 44 px high. The 341 px-wide editor returned focus to its opener on discard.

The contact, participant, Library and persistence suites passed 27 focused checks. TypeScript and targeted ESLint passed. The final browser review changed a professional contact to a client under an active relationship filter and reopened the saved record from the confirmation. The responsive controls use the suite’s existing command heights and case banner. GitHub integration and production verification follow this checkpoint.

A final wording check found that the shared departure dialog referred to saving a case when a contact was being saved. Its progress and discard messages now apply to the changes listed in the dialog, including CRM records.
