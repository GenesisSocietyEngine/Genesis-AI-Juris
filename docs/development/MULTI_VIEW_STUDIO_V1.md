# Multi-view Guided Studio v1

The mobile authoring step now presents the views allowlisted by the draft's
pinned case-type package. Advisory, tax/compliance, ERP incident and training
packages therefore expose different professional projections while continuing
to edit and persist one canonical `ScenarioDefinition`.

`projectStudioCaseView` is deliberately presentation-only. It reads stages,
actions, facts, evidence, deadlines, outcomes and resources, returns immutable
view items and has no mutation, validation or execution capability. Changing a
view cannot mark a workflow stage complete or unlock export.

The trust boundary is unchanged:

1. Flutter edits the canonical scenario.
2. View projections help the author inspect that scenario.
3. Step 5 sends the exact JSON to the native bridge.
4. Rust parses and validates the schema and case-type reference.
5. Rust executes the first available route.
6. Finish unlocks only after both authoritative operations succeed.

The case-type registry bytes and scenario/runtime contracts remain unchanged.
This feature therefore adds no second rules engine and no executable package
plug-in surface.
