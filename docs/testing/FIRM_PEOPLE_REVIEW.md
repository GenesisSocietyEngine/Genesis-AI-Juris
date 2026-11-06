# Cycle 3 — people across accessible cases

MyCase's Contacts list connects people to cases. CaseVant already records governed participants but previously required opening each case to find them. The new People view exposes the existing complete authorized scan as a searchable list and reading pane with case-overview destinations.

Grouping uses an exact linked actor identity only; unlinked participants use the case plus participant ID. Equal display names never imply identity. Names recorded differently in separate cases remain visible. Active/inactive scopes filter individual memberships, not the account globally. No standalone CRM, invitation, permission grant or contact mutation is implied. Enrollment remains in the existing governed case overview.

Evidence: 18 focused identity, firm-controller and navigation tests pass; targeted lint and portable production build pass. Tests cover identical names/local IDs across distinct cases, shared linked accounts, different recorded names, inactive memberships and empty input. Browser fixture has 27 cases and correctly presents one linked person with 27 case memberships. Selecting it focuses the details pane; Inactive hides the selection and returns zero; reset restores one unselected row. Exact links retain case and organization context. Russian 390px details and long controls fit without horizontal clipping.

The data source, pagination-completeness publication, revocation/account fences and save contracts are unchanged. No production records were written. Full candidate/main CI and live deployment audit remain required; do not equate the participant directory with a complete CRM.
