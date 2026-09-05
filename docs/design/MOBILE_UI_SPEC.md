# GENESIS: AI Juris — Mobile UI Specification v0.5

## Product stance

The mobile application should feel like a credible professional workspace under pressure, not a traditional RPG HUD and not a generic corporate dashboard.

The player should be able to open the application for two minutes, understand what requires attention, make one meaningful decision, and leave the world in a coherent state.

## Primary navigation

### Inbox

Purpose: triage communications and identify mandatory responses.

Key information:

- sender and timestamp;
- subject and concise body;
- unread, action-required, resolved, or archived status;
- deadline or linked matter when relevant.

### Matter

Purpose: understand the current legal and commercial position.

Key information:

- case strength and component scores;
- known evidence only;
- budget used and remaining authority;
- billable time, fatigue, and strain;
- current settlement offer and expiry;
- available actions.

### Calendar

Purpose: manage deadlines, hearings, delegated work, and personal capacity.

Mandatory events must be visually distinct from ordinary reminders. A time-advancing action should warn when it approaches a mandatory event window.

### AI Associate

Purpose: request and inspect bounded AI work product.

Each result should show:

- objective;
- evidence used;
- assumptions and unknowns;
- confidence or engine verification;
- required human verification.

### Career

Purpose: connect current conduct to long-term professional identity.

The screen will later include reputation dimensions, relationships, financial position, specialization, performance reviews, and career opportunities.

## Action interaction

Every action is identified by a stable ID supplied by Rust. Flutter displays presentation metadata but does not infer mechanical consequences.

Before execution the player sees:

- title;
- description;
- time cost;
- monetary cost;
- known professional risk;
- confirmation for irreversible or high-risk choices.

## v0.5.1 bridge contract

The bridge should expose conceptual operations equivalent to:

```text
start_game(seed, mode) -> GameSnapshot
apply_action(session_id, action_id) -> GameSnapshot
save_game(session_id) -> SavePayload
load_game(save_payload) -> GameSnapshot
```

`GameSnapshot` must be an immutable projection. It should include only information currently visible to the player. Hidden evidence, opponent state, RNG state, and unrevealed consequences remain inside Rust.

## Accessibility and responsive behavior

- Material controls retain native semantics and focus handling.
- Status is communicated by text and icon, not color alone.
- Phone layouts use bottom navigation.
- Wider windows use a navigation rail.
- Information reflows by available width rather than device-name detection.
- Core decisions remain reachable without precision gestures.

## Contextual Inbox responses

Inbox message cards are full-card tap targets. Tapping a message opens its detail and only the responses relevant to that concrete message. Binary decisions must use explicit language rather than treating dismissal as a decision:

- settlement acceptance: `Yes — accept EUR …`;
- settlement rejection: `No — reject the offer`;
- confirmation dialogs: separate `No` and `Yes` buttons;
- `Not now` closes the message without changing simulation state.

Resolved and informational messages remain tappable for reading, but expose no state-changing responses unless the current snapshot authorizes one.
