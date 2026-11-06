# Work triage and agenda ranges review — 6 November 2026

Outcome: apply the fresh MyCase study to routine work retrieval while retaining Outlook-style lists and reading panes. Accept when date scopes compose with existing filters, resetting restores the complete view, hidden selections cannot show stale details, and navigable agenda ranges preserve timezone and cross-day behavior.

Implementation: All dates / Overdue / Today / Next 7 days (today plus six days) / No date; priority-then-date sort; explicit overdue/high-priority row hints; Clear filters restores search/case/assignee/status/due/sort and clears selection. Calendar Day/Week/Month agenda ranges have date selection, previous/next and Today. Weeks start Monday. These are agenda lists, not an hourly calendar grid. Timezone selection remains explicit; dated tasks remain calendar-day records. No persistence or permission contract changes.

Evidence: 12 date/scheduling/firm-controller/template tests passed. They cover leap February, cross-year weeks, day/week/month navigation, inclusive due boundaries, completed work not overdue, undated items, timezone-dependent dates and cross-midnight inclusion. Synthetic browser confirmed No date narrows 27 records to one; changing scope hides the prior reading-pane details; reset restores 27 records; Week showed Nov 2–8 with six items, Next showed Nov 9–15 with ten, and Today returned to the current week. Russian Day controls and long labels fit the existing 390px iframe. Narrow review found unnecessary empty reading-pane space, subsequently removed only when no item is selected.

The reviewed source is separate from the isolated PR229 release checkout. AI workflow building, templates and case outcome report calculations are unchanged. No live MyCase data was written. Production acceptance and source publication receipts are recorded separately; no live provider AI verification is claimed.

Portable production build and targeted ESLint completed successfully. Full follow-on CI and production acceptance remain separate gates.
