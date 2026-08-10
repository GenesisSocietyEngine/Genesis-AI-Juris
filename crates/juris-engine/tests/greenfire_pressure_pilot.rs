use juris_engine::{
    MobileScenarioSnapshot, ScenarioRuntimeError, ScenarioSession,
    PRESSURE_COUNTERMOVE_PROJECTION_SCHEMA_VERSION,
};
use juris_scenario_schema::ScenarioDefinition;

const GREENFIRE_SCENARIO: &str =
    include_str!("../../../content/cases/greenfire_first_72_hours.scenario.json");
const SEED: u64 = 20260729;

fn definition() -> ScenarioDefinition {
    serde_json::from_str(GREENFIRE_SCENARIO).expect("GreenFire scenario must deserialize")
}

fn session() -> ScenarioSession {
    ScenarioSession::new(definition(), SEED).expect("GreenFire session must start")
}

fn open_channel_session() -> ScenarioSession {
    let mut session = session();
    session
        .dispatch("accept_emergency_mandate")
        .expect("mandate must be accepted");
    session
        .dispatch("open_controlled_regulator_channel")
        .expect("controlled channel must open");
    assert_eq!(session.snapshot().clock_minutes, 90);
    session
}

fn activated_session(controlled_channel: bool) -> ScenarioSession {
    let mut session = session();
    session
        .dispatch("accept_emergency_mandate")
        .expect("mandate must be accepted");
    if controlled_channel {
        session
            .dispatch("open_controlled_regulator_channel")
            .expect("controlled channel must open");
    }
    advance_to(&mut session, 120);
    session
}

fn advance_to(session: &mut ScenarioSession, target: u64) {
    let current = session.snapshot().clock_minutes;
    assert!(target >= current, "test helper cannot rewind the clock");
    let mut remaining = target - current;
    while remaining > 0 {
        let chunk = remaining.min(1_440) as u32;
        session
            .advance_time(chunk)
            .unwrap_or_else(|error| panic!("advance_time({chunk}) must succeed: {error}"));
        remaining -= u64::from(chunk);
    }
    assert_eq!(session.snapshot().clock_minutes, target);
}

fn deadline_status<'a>(snapshot: &'a MobileScenarioSnapshot, id: &str) -> Option<&'a str> {
    snapshot
        .deadlines
        .iter()
        .find(|deadline| deadline.id == id)
        .and_then(|deadline| deadline.status.as_deref())
}

fn regulator_inbox(snapshot: &MobileScenarioSnapshot) -> (bool, bool) {
    let item = snapshot
        .inbox
        .iter()
        .find(|item| item.id == "regulator_document_request")
        .expect("activated regulator Inbox item must be projected");
    (item.visible, item.resolved)
}

#[test]
fn projection_activates_at_minute_120_without_hidden_countermove_and_is_idempotent() {
    let mut session = open_channel_session();

    let before = session
        .advance_time(29)
        .expect("minute 119 must be reachable");
    assert_eq!(before.clock_minutes, 119);
    assert!(before.pressure_and_countermove.is_none());
    let before_json = serde_json::to_string(&before).unwrap();
    assert!(!before_json.contains("pressure_and_countermove"));
    assert!(!before_json.contains("regulator_document_request_pressure"));
    assert!(!before_json.contains("regulatory_response_missed"));

    let activated = session.advance_time(1).expect("activation minute must run");
    assert_eq!(activated.clock_minutes, 120);
    let projection = activated
        .pressure_and_countermove
        .as_ref()
        .expect("pressure must be projected at activation");
    assert_eq!(
        projection.projection_schema_version,
        PRESSURE_COUNTERMOVE_PROJECTION_SCHEMA_VERSION
    );
    assert_eq!(projection.active_pressures.len(), 1);
    let pressure = &projection.active_pressures[0];
    assert_eq!(pressure.pressure_id, "regulator_document_request_pressure");
    assert_eq!(pressure.source_actor_id, "port_haven_environment_authority");
    assert_eq!(pressure.due_at_minute, 2_160);
    assert_eq!(pressure.remaining_minutes, 2_040);
    assert_eq!(
        pressure.available_response_action_ids,
        [
            "submit_initial_regulatory_response",
            "release_unreviewed_documents",
        ]
    );
    assert_eq!(regulator_inbox(&activated), (true, false));

    let activated_json = serde_json::to_string(&activated).unwrap();
    assert!(activated_json.contains("regulator_document_request_pressure"));
    assert!(!activated_json.contains("regulatory_response_missed"));
    assert!(!activated_json.contains("uncontrolled_disclosure"));

    let command_count = session.command_log().len();
    let repeated = session.snapshot();
    assert_eq!(repeated, activated);
    assert_eq!(serde_json::to_string(&repeated).unwrap(), activated_json);
    assert_eq!(session.command_log().len(), command_count);

    let encoded_save = session.save_json().expect("active save must encode");
    let restored = ScenarioSession::from_save_json(definition(), &encoded_save)
        .expect("active save must replay");
    assert_eq!(restored.snapshot(), session.snapshot());
    assert_eq!(restored.command_log(), session.command_log());
    assert_eq!(
        restored.final_state_digest().unwrap(),
        session.final_state_digest().unwrap()
    );
    assert_eq!(restored.save_json().unwrap(), encoded_save);
}

#[test]
fn controlled_and_risky_responses_complete_the_same_pressure_without_countermove() {
    let mut controlled = activated_session(true);
    let controlled_snapshot = controlled
        .dispatch("submit_initial_regulatory_response")
        .expect("reviewed response must complete");
    assert_eq!(controlled_snapshot.clock_minutes, 300);
    assert_eq!(
        deadline_status(&controlled_snapshot, "initial_regulatory_response_deadline"),
        Some("completed")
    );
    assert!(controlled_snapshot.pressure_and_countermove.is_none());
    assert_eq!(regulator_inbox(&controlled_snapshot), (true, true));
    assert_eq!(
        controlled
            .diagnostic_flags()
            .get("regulatory_response_submitted"),
        Some(&true)
    );
    assert_ne!(
        controlled.diagnostic_flags().get("uncontrolled_disclosure"),
        Some(&true)
    );
    assert!(!controlled
        .diagnostic_fired_event_ids()
        .contains("regulatory_response_missed"));

    let mut risky = activated_session(false);
    assert_eq!(
        risky
            .snapshot()
            .pressure_and_countermove
            .unwrap()
            .active_pressures[0]
            .available_response_action_ids,
        ["release_unreviewed_documents"]
    );
    let before_snapshot = risky.snapshot();
    let before_save = risky.save_json().unwrap();
    let before_flags = risky.diagnostic_flags().clone();
    let before_events = risky.diagnostic_fired_event_ids().clone();
    let before_inbox = risky.diagnostic_visible_inbox_ids().clone();
    let before_commands = risky.command_log().to_vec();
    assert_eq!(
        risky.dispatch("submit_initial_regulatory_response"),
        Err(ScenarioRuntimeError::ActionUnavailable(
            "submit_initial_regulatory_response".to_owned()
        ))
    );
    assert_eq!(risky.snapshot(), before_snapshot);
    assert_eq!(risky.save_json().unwrap(), before_save);
    assert_eq!(risky.diagnostic_flags(), &before_flags);
    assert_eq!(risky.diagnostic_fired_event_ids(), &before_events);
    assert_eq!(risky.diagnostic_visible_inbox_ids(), &before_inbox);
    assert_eq!(risky.command_log(), before_commands);

    let risky_snapshot = risky
        .dispatch("release_unreviewed_documents")
        .expect("unreviewed release must remain an ordinary available choice");
    assert_eq!(risky_snapshot.clock_minutes, 300);
    assert_eq!(
        deadline_status(&risky_snapshot, "initial_regulatory_response_deadline"),
        Some("completed")
    );
    assert!(risky_snapshot.pressure_and_countermove.is_none());
    assert_eq!(regulator_inbox(&risky_snapshot), (true, true));
    assert_eq!(
        risky
            .diagnostic_flags()
            .get("regulatory_response_submitted"),
        Some(&true)
    );
    assert_eq!(
        risky.diagnostic_flags().get("uncontrolled_disclosure"),
        Some(&true)
    );
    assert!(!risky
        .diagnostic_fired_event_ids()
        .contains("regulatory_response_missed"));
}

#[test]
fn both_responses_obey_the_1979_1980_exclusive_boundary_atomically() {
    for action_id in [
        "submit_initial_regulatory_response",
        "release_unreviewed_documents",
    ] {
        let mut timely = open_channel_session();
        advance_to(&mut timely, 1_979);
        let pressure = &timely
            .snapshot()
            .pressure_and_countermove
            .expect("pressure must remain open")
            .active_pressures[0];
        assert_eq!(pressure.remaining_minutes, 181);
        let completed = timely
            .dispatch(action_id)
            .unwrap_or_else(|error| panic!("{action_id} must finish at 2,159: {error}"));
        assert_eq!(completed.clock_minutes, 2_159);
        assert_eq!(
            deadline_status(&completed, "initial_regulatory_response_deadline"),
            Some("completed")
        );
        assert!(completed.pressure_and_countermove.is_none());
        assert!(!timely
            .diagnostic_fired_event_ids()
            .contains("regulatory_response_missed"));

        let mut exact_due = open_channel_session();
        advance_to(&mut exact_due, 1_980);
        let before_snapshot = exact_due.snapshot();
        let before_save = exact_due.save_json().unwrap();
        let before_flags = exact_due.diagnostic_flags().clone();
        let before_events = exact_due.diagnostic_fired_event_ids().clone();
        let before_inbox = exact_due.diagnostic_visible_inbox_ids().clone();
        let before_commands = exact_due.command_log().to_vec();

        assert_eq!(
            exact_due.dispatch(action_id),
            Err(ScenarioRuntimeError::ActionCompletionDeadlineExceeded {
                action: action_id.to_owned(),
                deadline: "initial_regulatory_response_deadline".to_owned(),
                completion: 2_160,
                due: 2_160,
            })
        );
        assert_eq!(exact_due.snapshot(), before_snapshot);
        assert_eq!(exact_due.save_json().unwrap(), before_save);
        assert_eq!(exact_due.diagnostic_flags(), &before_flags);
        assert_eq!(exact_due.diagnostic_fired_event_ids(), &before_events);
        assert_eq!(exact_due.diagnostic_visible_inbox_ids(), &before_inbox);
        assert_eq!(exact_due.command_log(), before_commands);
    }
}

#[test]
fn regulatory_miss_is_one_shot_and_large_advance_matches_chunks() {
    let mut direct = activated_session(true);
    let mut chunked = activated_session(true);

    direct.advance_time(600).unwrap();
    chunked.advance_time(600).unwrap();
    let direct_miss = direct.advance_time(1_440).unwrap();
    let mut chunked_miss = chunked.snapshot();
    for _ in 0..4 {
        chunked_miss = chunked.advance_time(360).unwrap();
    }

    assert_eq!(direct_miss.clock_minutes, 2_160);
    assert_eq!(chunked_miss, direct_miss);
    assert_eq!(
        deadline_status(&direct_miss, "initial_regulatory_response_deadline"),
        Some("missed")
    );
    assert!(direct_miss.pressure_and_countermove.is_none());
    assert_eq!(regulator_inbox(&direct_miss), (true, true));
    assert_eq!(
        direct.diagnostic_flags().get("regulatory_response_missed"),
        Some(&true)
    );
    assert!(direct
        .diagnostic_fired_event_ids()
        .contains("regulatory_response_missed"));
    assert_eq!(
        direct.diagnostic_fired_event_ids(),
        chunked.diagnostic_fired_event_ids()
    );
    assert_eq!(direct.diagnostic_flags(), chunked.diagnostic_flags());

    let direct_events_at_miss = direct.diagnostic_fired_event_ids().clone();
    let chunked_events_at_miss = chunked.diagnostic_fired_event_ids().clone();
    let after_direct = direct.advance_time(60).unwrap();
    let after_chunked = chunked.advance_time(60).unwrap();
    assert_eq!(after_direct, after_chunked);
    assert_eq!(direct.diagnostic_fired_event_ids(), &direct_events_at_miss);
    assert_eq!(
        chunked.diagnostic_fired_event_ids(),
        &chunked_events_at_miss
    );
    assert_eq!(
        deadline_status(&after_direct, "initial_regulatory_response_deadline"),
        Some("missed")
    );
    assert!(after_direct.pressure_and_countermove.is_none());
}
