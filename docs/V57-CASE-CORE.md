# v57 Case Core and Case-Type Registry

## Product outcome

v57 establishes a reusable intake foundation for the Studio: an unstructured
professional matter can be classified, normalized, versioned, explained, tested,
and exported as a stable decision package without introducing a second rules
engine.

The guided Studio now starts by selecting one of four versioned case packages:

- `general_advisory@1.0.0`
- `tax_compliance@1.0.0`
- `erp_incident@1.0.0`
- `training_simulation@1.0.0`

Each package declares its workflow mode, safe classification defaults, expected
result, and whether tax economics are supported. The package reference is stored
with the draft and is visible in both guided review and developer validation.

## Architectural guardrails

1. The authoring graph remains the editable source of truth. `CaseCoreV2` is a
   deterministic neutral projection, not a parallel editor or execution model.
2. The Rust scenario validator remains authoritative on mobile. Flutter selects
   and persists a package but does not implement independent validation rules.
3. AI remains proposal-only. It can use the selected case type as context, but
   all changes still pass the existing review, apply, validation, and audit path.
4. Case packages are immutable references. Unknown IDs and unsupported versions
   are rejected rather than silently upgraded.
5. Legacy drafts keep their existing fingerprints and server seals. The case-type
   field enters the fingerprint only after an explicit type is present.
6. The same registry bytes are committed in web, the mobile contract, and the
   Flutter asset. Release verification locks their SHA-256 and Git blob identity.
7. A shared-runtime release is blocked unless Rust, Flutter, Android, iOS, and the
   existing 18-route parity suite all have exact-commit evidence.

## Decision package format

Custom case exports use schema version 4 and contain:

- the complete editable Studio draft;
- an immutable case-type ID and semantic version;
- a deterministic `CaseCoreV2` projection;
- existing integrity protection and provenance metadata.

Import verifies that the declared package exists at the exact supported version
and that the supplied Case Core matches a fresh projection of the protected
draft. Schema versions 1–3 remain importable under their prior compatibility and
integrity rules.

## Mobile parity

Flutter exposes the same four packages at the first stage of its six-stage
workflow and persists the selection in canonical scenario metadata. Rust accepts
only supported registry/version pairs and reports
`SCN016_UNSUPPORTED_CASE_TYPE` for an unsupported package version.
Flutter validates the package during import, before a draft can be rendered or
persisted, so malformed clipboard data cannot create a reopen error loop.

The authoritative receipts are stored in `parity/mobile-parity.lock.json`:

- exact mobile repository commit and app version;
- byte-identical case-type registry hash and Git blob;
- successful Rust, Flutter, Android, and iOS workflow run IDs;
- unchanged canonical bundle, 18 routes, 290 checkpoints, and 45 judicial-result
  checkpoints.

## Release baseline

The web release also moves to the patched Vinext 1.0/Vite 8.2/Cloudflare
toolchain line. The high-severity dependency audit is clear; the remaining
moderate findings are confined to the legacy `drizzle-kit` development loader
and have no production runtime path. Production build, strict TypeScript, lint,
and the complete web suite remain mandatory gates.

## Deliberate next boundary

v57 does not activate arbitrary plug-ins or case-specific executable code. Future
iterations may add package-defined intake questions, compiler adapters, and
specialized decision views, but only through versioned declarative schemas,
explicit migrations, the existing author-review boundary, and the same mandatory
web/mobile/Rust parity gates.
