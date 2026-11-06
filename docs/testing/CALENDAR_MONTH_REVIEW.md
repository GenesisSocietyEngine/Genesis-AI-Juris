# Cycle 3 — visual month orientation

MyCase's month calendar makes the distribution of upcoming work visible. CaseVant's published agenda provides precise dates but no spatial overview. The amendment adds a Monday-first month grid alongside the existing agenda, preserving filters and explicit display timezone. It uses only the already authorized complete firm scan.

Each day shows its matching record count and up to two titles on wide screens. Narrow cells retain counts and a day-agenda drill-down; no record is removed from the agenda. Outside-month cells are disabled. Today has a visible border and semantic current-date marker. Arrow keys and Home/End move one roving focus within the current month; Enter opens the day's agenda and focuses the heading. No drag rescheduling or write operation is introduced. This is a visual month, not a week/hour overlap layout.

Evidence: 12 boundary/scheduling/firm-controller tests and targeted lint pass. The additional grid test covers 42 complete Monday-first cells, leap February and outside-month boundaries. Synthetic desktop browser: ArrowRight from Nov 6 focuses Nov 7, Enter opens its three-record Day agenda. Russian 390px screenshot shows all seven columns within the frame; selecting Nov 7 opens the same three records. Existing timezone/cross-midnight tests remain in force. Agenda date headings are now explicitly sorted, including overlapping multi-day entries.

Production build, full candidate/exact-main CI, publication and live audit are recorded in the five-cycle ledger. These local checks alone do not complete cycle 3. AI proposals, case outcomes, persistence and authority contracts are unchanged.

Local production build passed. Final review corrected singular English and Russian count labels; candidate CI builds the final wording.
