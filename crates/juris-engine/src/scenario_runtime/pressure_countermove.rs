//! Pure Pressure & Countermove projection over authoritative runtime state.

use super::{MobileActionSnapshot, ScenarioSession};
use juris_scenario_schema::DeadlineStatus;
use serde::Serialize;

/// Version of the optional nested Pressure & Countermove projection.
pub const PRESSURE_COUNTERMOVE_PROJECTION_SCHEMA_VERSION: u32 = 1;

/// One active authored pressure window.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct ActivePressureProjection {
    pub pressure_id: String,
    pub source_actor_id: String,
    pub due_at_minute: u64,
    pub remaining_minutes: u64,
    pub available_response_action_ids: Vec<String>,
}

/// Optional nested projection emitted only while at least one pressure is active.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct PressureAndCountermoveProjection {
    pub projection_schema_version: u32,
    pub active_pressures: Vec<ActivePressureProjection>,
}

pub(super) fn project_pressure_and_countermove(
    session: &ScenarioSession,
    is_closed: bool,
    available_actions: &[MobileActionSnapshot],
) -> Option<PressureAndCountermoveProjection> {
    if is_closed {
        return None;
    }

    let active_pressures = session
        .definition
        .pressure_windows
        .iter()
        .filter_map(|window| {
            let activation_fired = session
                .state
                .fired_events
                .contains(window.activation_event_id.as_str());
            let countermove_fired = session
                .state
                .fired_events
                .contains(window.countermove_event_id.as_str());
            let deadline_open = session
                .state
                .deadline_statuses
                .get(window.response_deadline_id.as_str())
                .copied()
                .flatten()
                == Some(DeadlineStatus::Open);
            if !activation_fired || countermove_fired || !deadline_open {
                return None;
            }

            let due_at_minute = session
                .state
                .deadline_due_minutes
                .get(window.response_deadline_id.as_str())
                .copied()
                .expect("active pressure deadline must have a stored due minute");
            let available_response_action_ids = window
                .response_action_ids
                .iter()
                .filter(|response_id| {
                    available_actions
                        .iter()
                        .any(|action| action.id == response_id.as_str())
                })
                .map(|response_id| response_id.as_str().to_owned())
                .collect();

            Some(ActivePressureProjection {
                pressure_id: window.id.as_str().to_owned(),
                source_actor_id: window.source_actor_id.as_str().to_owned(),
                due_at_minute,
                remaining_minutes: due_at_minute.saturating_sub(session.state.clock_minutes),
                available_response_action_ids,
            })
        })
        .collect::<Vec<_>>();

    (!active_pressures.is_empty()).then_some(PressureAndCountermoveProjection {
        projection_schema_version: PRESSURE_COUNTERMOVE_PROJECTION_SCHEMA_VERSION,
        active_pressures,
    })
}
