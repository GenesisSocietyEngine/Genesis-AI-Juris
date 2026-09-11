# Canopy report review - 11 September 2026

This follow-up addresses R01/R02 from the Canopy UX review. It changes the
Studio PDF presentation, without changing the canonical report model, graph
layout contract, immutable Base, access checks, or independent approval workflow.

## Changes and acceptance criteria

- R01: A bounded decision brief precedes the technical appendices. It identifies
  the objective, recorded inputs, decision criteria, alternative outcomes,
  assumptions, source limitations and next actions. The exact Base brief fits
  one page in EN and RU. Source text retains its original language.
- The brief describes the model; it cannot infer a chosen outcome, completed
  run, verified fact or independent approval. The cover visibly says draft for
  a draft, separately from workspace-save status. It no longer calls an
  unreviewed graph reviewed. Studio review information is explicitly distinct
  from independently approved case-workflow output.
- Brief extracts are labelled and point to complete records in the appendices.
  Redactions apply before summary selection; unreviewed raw intake remains
  excluded. Economics is retained only where supplied by the case.
- R02: Section headings stay with their content. Page furniture has explicit
  identifiers because pdfmake includes header/footer nodes in the pagination
  callback; a page number cannot count as the next paragraph.
- Presentation-binding version advances to 2, making earlier PDF receipts
  stale without altering model or graph-layout fingerprints.

## Evidence

The existing report tests cover redaction, raw-prompt exclusion, final/client
gates, model identity, directed graph completeness and receipt freshness.
New rendered-PDF assertions check a <=2-page Canopy brief in EN/RU and ensure
the analysis heading shares a page with its first actual record.

The example generator accepts `en` or `ru` as its third argument. Its provenance
records the actual generation timestamp, PDF digest and presentation binding;
it has no database, publication, session, approval or receipt-write capability.

Immutable Base 2.0.0 remains:

- Studio: `sha256-e8df94bed5cc24a4b56093b21b24101839cd7501080d01b4bfb0f1bb7e4b3702`
- Playable: `sha256-4c17139f6cf47399349aeaf27a473bbcb1429e7d6a9cc3eb0766e12ab290b31b`

Windows/x64, Node 22.23.2 and Poppler 25.07.0 are required by the existing
47-PDF visual baseline. Linux/Poppler 26.05.0 inspection is supplementary;
it must not be reported as that gate. An intentional candidate baseline must
be visually reviewed before replacement and followed by read-only verification.

The first hosted run found that the long-content corpus disallows ellipsis
characters. Brief extracts now use an explicit `[extract]` / `[фрагмент]` label
without an ellipsis; full records remain in the appendices. Table subheadings
repeat as part of the table header and stay with at least one data row. The
verification checklist and signature area form one indivisible block.

## Dependency audit finding

The 11 September hosted audit reported five high and one critical dependency
findings. Corrected pins are Next.js / eslint-config-next 16.3.4, Cloudflare
Vite plugin 1.54.8, Wrangler 4.131.1 and its matching Workers types
5.20260911.1. The lockfile resolves sharp 0.35.4 and js-yaml 4.3.2. These are
targeted security updates; no audit threshold, peer-dependency check, permission
or release gate is disabled. PDF dependencies and graph contract stay pinned.

The audit finding alone does not demonstrate exploitation in the deployed
Cloudflare runtime. Relevant upstream advisories:

- https://github.com/advisories/GHSA-2xp9-vwfh-vxw4
- https://github.com/advisories/GHSA-p293-qw3h-jr36
- https://github.com/advisories/GHSA-rgj7-g3m4-5g8c
- https://github.com/advisories/GHSA-2883-xcg3-v3hh

## Boundaries

Production remains version 76 until a successful subsequent deployment is
recorded. The normal browser retry timed out while listing tabs. The Production
catalogue still lacks Canopy Base. No identity, role, invitation, database record
or catalogue publication was changed to work around this.

Cold-registration timings, live AI preview/application, independent reviewer
acceptance, the five-minute first-report target, three new-user observations,
and the real 8-10 minute/short MP4 remain unverified. Existing demo media and
duration labels are unchanged. The prepared EN/RU demo plan remains applicable.
