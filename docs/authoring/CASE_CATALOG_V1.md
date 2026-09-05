# Case Catalog & Matter Identity v1

## Purpose

This contract gives GENESIS: AI Juris a stable case-library identity layer before
the full gameplay tree is migrated to the authoritative Rust engine.

The catalog deliberately separates:

- machine identifiers used by code and save data;
- fictional display names used by the UI;
- procedural roles used to construct the legal caption;
- the player client used to select perspective;
- the executable scenario file used by gameplay.

## Naming convention

The caption follows the procedural parties:

```text
Asteron Systems NV v. Northbridge Consulting BV
```

The topic is a separate field:

```text
Failed ERP Implementation
```

A UI may combine them as:

```text
Asteron Systems NV v. Northbridge Consulting BV - Failed ERP Implementation
```

The caption must not change when the player represents a different party.

## Stable IDs

Stable IDs use lowercase ASCII letters, digits, and single underscores. They
must not contain fictional names formatted for display.

Valid:

```text
be_commercial_failed_erp_001
northbridge_consulting
elise_van_den_berg
```

Invalid:

```text
Failed ERP Implementation
Northbridge Consulting BV
northbridge-consulting
```

## Directory separation

Catalog metadata is stored under `content/catalog/`, not directly beside
executable scenarios under `content/cases/`. This prevents existing scenario
validators that scan `content/cases/*.json` from interpreting catalog documents
as gameplay scenarios.

## Authority boundary

Catalog and identity metadata may affect presentation, selection, and narrative
addressing. They must not directly determine deadlines, evidence scores, random
resolution, or legal outcomes. Those remain authoritative in scenario data and
the Rust gameplay engine.

## Validation codes

- `CAT*`: catalog structure and case-card metadata;
- `MAT*`: matter identity, parties, contacts, and captions;
- `BND*`: catalog-to-identity consistency;
- `PTH*`: portable repository-relative paths.
