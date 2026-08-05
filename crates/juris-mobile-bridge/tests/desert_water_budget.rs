use juris_mobile_bridge::MobileBridge;
use serde_json::{json, Value};

const DESERT_WATER_SCENARIO: &str =
    include_str!("../../../content/cases/desert_water_groundwater_claim.scenario.json");

fn advance(minutes: u32) -> Value {
    json!({"command": "advance_time", "minutes": minutes})
}

fn dispatch(action_id: &str) -> Value {
    json!({"command": "dispatch", "action_id": action_id})
}

fn migrated_player_commands_through_190() -> Vec<Value> {
    let mut commands = vec![advance(1); 5];
    commands.extend([
        dispatch("accept_residents_mandate"),
        advance(1),
        dispatch("demand_plant_record_preservation"),
        advance(1),
        dispatch("commission_defensible_sampling"),
        advance(1),
        advance(1),
        advance(1),
        dispatch("obtain_regulatory_records"),
        dispatch("protect_limitation_period"),
        dispatch("obtain_cooling_and_disposal_records"),
        dispatch("retain_independent_hydrogeologist"),
        dispatch("investigate_corporate_notice"),
        dispatch("test_alternative_source_defence"),
        advance(1),
        advance(694),
        advance(1),
        dispatch("review_hydrological_source_assessment"),
    ]);
    commands.extend((0..167).map(|_| advance(1)));
    assert_eq!(commands.len(), 190);
    commands
}

fn execute(bridge: &mut MobileBridge, request: &Value) -> Value {
    serde_json::from_str(&bridge.execute_json(&request.to_string())).unwrap()
}

fn execute_session_command(bridge: &mut MobileBridge, session_id: u64, request: &Value) -> Value {
    let mut request = request.clone();
    request
        .as_object_mut()
        .unwrap()
        .insert("session_id".to_owned(), json!(session_id));
    let response = execute(bridge, &request);
    assert_eq!(response["type"], "snapshot");
    response["snapshot"].clone()
}

struct BudgetCheckpoint<'a> {
    clock_minutes: u64,
    spend_eur: i64,
    remaining_budget_eur: i64,
    billable_minutes: i64,
    action_id: &'a str,
    action_cost_eur: u64,
    action_time_minutes: u64,
}

fn assert_checkpoint(snapshot: &Value, expected: BudgetCheckpoint<'_>) {
    let resources = &snapshot["resources"];
    assert_eq!(snapshot["clock_minutes"], expected.clock_minutes);
    assert_eq!(resources["authorized_budget_eur"], 60_000);
    assert_eq!(resources["spend_eur"], expected.spend_eur);
    assert_eq!(resources["billable_minutes"], expected.billable_minutes);
    assert_eq!(60_000 - expected.spend_eur, expected.remaining_budget_eur);

    let actions = snapshot["available_actions"].as_array().unwrap();
    assert_eq!(actions.len(), 1);
    assert_eq!(actions[0]["id"], expected.action_id);
    assert_eq!(actions[0]["cost_eur"], expected.action_cost_eur);
    assert_eq!(
        actions[0]["time_cost_minutes"],
        expected.action_time_minutes
    );
    assert_eq!(actions[0]["billable_minutes"], expected.action_time_minutes);
}

fn assert_save_reload_parity(
    bridge: &mut MobileBridge,
    session_id: u64,
    scenario: &Value,
    expected_snapshot: &Value,
) {
    let saved = execute(
        bridge,
        &json!({"command": "save_session", "session_id": session_id}),
    );
    assert_eq!(saved["type"], "session_saved");
    let loaded = execute(
        bridge,
        &json!({
            "command": "load_session",
            "scenario": scenario,
            "encoded_save": saved["encoded_save"],
        }),
    );
    assert_eq!(loaded["type"], "session_loaded");
    assert_eq!(loaded["snapshot"], *expected_snapshot);
}

#[test]
fn exact_migrated_player_log_keeps_budget_through_bridge_json() {
    let scenario: Value = serde_json::from_str(DESERT_WATER_SCENARIO).unwrap();
    let mut bridge = MobileBridge::new();
    let created = execute(
        &mut bridge,
        &json!({
            "command": "create_session",
            "scenario": scenario,
            "seed": 20260804,
        }),
    );
    assert_eq!(created["type"], "session_created");
    let session_id = created["session_id"].as_u64().unwrap();

    let mut snapshot = created["snapshot"].clone();
    for command in migrated_player_commands_through_190() {
        snapshot = execute_session_command(&mut bridge, session_id, &command);
    }
    assert_checkpoint(
        &snapshot,
        BudgetCheckpoint {
            clock_minutes: 1_728,
            spend_eur: 37_050,
            remaining_budget_eur: 22_950,
            billable_minutes: 855,
            action_id: "interview_affected_residents",
            action_cost_eur: 2_400,
            action_time_minutes: 120,
        },
    );
    assert_save_reload_parity(&mut bridge, session_id, &scenario, &snapshot);

    snapshot = execute_session_command(
        &mut bridge,
        session_id,
        &dispatch("interview_affected_residents"),
    );
    assert_checkpoint(
        &snapshot,
        BudgetCheckpoint {
            clock_minutes: 1_848,
            spend_eur: 39_450,
            remaining_budget_eur: 20_550,
            billable_minutes: 975,
            action_id: "map_wells_and_exposure_periods",
            action_cost_eur: 2_200,
            action_time_minutes: 90,
        },
    );
    assert_save_reload_parity(&mut bridge, session_id, &scenario, &snapshot);

    snapshot = execute_session_command(
        &mut bridge,
        session_id,
        &dispatch("map_wells_and_exposure_periods"),
    );
    assert_checkpoint(
        &snapshot,
        BudgetCheckpoint {
            clock_minutes: 1_938,
            spend_eur: 41_650,
            remaining_budget_eur: 18_350,
            billable_minutes: 1_065,
            action_id: "prepare_expert_evidence",
            action_cost_eur: 5_500,
            action_time_minutes: 180,
        },
    );
    assert_save_reload_parity(&mut bridge, session_id, &scenario, &snapshot);
}
