# Scenario Builder CLI v1

Commit 11B introduces deterministic creation and cloning of fictional
`MatterIdentity` documents. It deliberately does **not** generate a complete
executable scenario graph yet; temporal and outcome graph authoring follows in
Commit 11C/11D.

## Commands

```powershell
cargo run -p juris-scenario-builder -- new `
  --template content/templates/commercial_litigation_v1.json `
  --output content/catalog/cases/example.identity.json `
  --case-id be_commercial_example_001 `
  --claimant-id example_claimant `
  --claimant-name "Example Claimant NV" `
  --defendant-id example_defendant `
  --defendant-name "Example Defendant BV" `
  --player-client-id example_claimant `
  --topic "Example Commercial Dispute"
```

Optional contact fields must be supplied as a complete group:

```text
--claimant-contact-id
--claimant-contact-name
--claimant-contact-role
```

Use `--force` only when deliberate replacement is required.

## Invariants

- machine references use stable IDs;
- captions are claimant versus defendant;
- player representation does not reorder the caption;
- generated identities validate before writing;
- failed generation leaves no partial JSON;
- identical inputs generate identical JSON content;
- UTF-8 fictional names remain presentation data only.
