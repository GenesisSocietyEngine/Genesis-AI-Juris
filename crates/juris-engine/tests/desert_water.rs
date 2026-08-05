use juris_engine::{
    DossierMatterStatus, MobileScenarioSnapshot, ScenarioCommand, ScenarioRuntimeError,
    ScenarioSession,
};
use juris_scenario_schema::{
    JudicialDecisionInstance, JudicialResult, MatterLifecycleStatus, ScenarioDefinition,
};

const FAILED_ERP_SCENARIO: &str = include_str!("../../../content/cases/failed_erp.scenario.json");
const LOGISTICS_SCENARIO: &str =
    include_str!("../../../content/cases/unpaid_logistics_invoices.scenario.json");
const GREENFIRE_SCENARIO: &str =
    include_str!("../../../content/cases/greenfire_first_72_hours.scenario.json");
const GOLDENSHELL_SCENARIO: &str =
    include_str!("../../../content/cases/goldenshell_recall_at_dawn.scenario.json");
const DESERT_WATER_SCENARIO: &str =
    include_str!("../../../content/cases/desert_water_groundwater_claim.scenario.json");
const COORDINATED_TRACE: &str =
    include_str!("../../../content/traces/desert_water_coordinated.commands.json");
const COMPROMISED_TRACE: &str =
    include_str!("../../../content/traces/desert_water_compromised.commands.json");

fn definition(encoded: &str) -> ScenarioDefinition {
    serde_json::from_str(encoded).expect("canonical scenario must deserialize")
}

fn trace(encoded: &str) -> Vec<ScenarioCommand> {
    serde_json::from_str(encoded).expect("canonical trace must deserialize")
}

fn run(session: &mut ScenarioSession, commands: &[ScenarioCommand]) {
    for command in commands {
        match command {
            ScenarioCommand::Dispatch { action_id } => {
                session
                    .dispatch(action_id)
                    .unwrap_or_else(|error| panic!("dispatch {action_id} failed: {error}"));
            }
            ScenarioCommand::AdvanceTime { minutes } => {
                session
                    .advance_time(*minutes)
                    .unwrap_or_else(|error| panic!("advance_time {minutes} failed: {error}"));
            }
        }
    }
}

fn advance(minutes: u32) -> ScenarioCommand {
    ScenarioCommand::AdvanceTime { minutes }
}

fn dispatch(action_id: &str) -> ScenarioCommand {
    ScenarioCommand::Dispatch {
        action_id: action_id.to_owned(),
    }
}

/// Reconstructs the preserved player session exactly through command 190.
///
/// Keeping this as executable test data avoids committing a private player save
/// while retaining its command ordering, including every one-minute foreground
/// tick. The aggregate assertions protect the fixture from accidental edits.
fn migrated_player_commands_through_190() -> Vec<ScenarioCommand> {
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
    assert_eq!(
        commands
            .iter()
            .filter(|command| matches!(command, ScenarioCommand::Dispatch { .. }))
            .count(),
        10
    );
    assert_eq!(
        commands
            .iter()
            .filter_map(|command| match command {
                ScenarioCommand::AdvanceTime { minutes } => Some(u64::from(*minutes)),
                ScenarioCommand::Dispatch { .. } => None,
            })
            .sum::<u64>(),
        873
    );
    commands
}

struct BudgetCheckpoint<'a> {
    clock_minutes: u64,
    spend_eur: i64,
    remaining_budget_eur: i64,
    billable_minutes: i64,
    action_id: &'a str,
    action_cost_eur: u32,
    action_time_minutes: u32,
}

fn assert_budget_checkpoint(snapshot: &MobileScenarioSnapshot, expected: BudgetCheckpoint<'_>) {
    const AUTHORIZED_BUDGET_EUR: i64 = 60_000;
    let resources = snapshot
        .resources
        .as_ref()
        .expect("Desert Water must project authoritative resources");
    assert_eq!(snapshot.clock_minutes, expected.clock_minutes);
    assert_eq!(resources["authorized_budget_eur"], AUTHORIZED_BUDGET_EUR);
    assert_eq!(resources["spend_eur"], expected.spend_eur);
    assert_eq!(resources["billable_minutes"], expected.billable_minutes);
    assert_eq!(
        AUTHORIZED_BUDGET_EUR - expected.spend_eur,
        expected.remaining_budget_eur
    );

    let action = snapshot
        .available_actions
        .iter()
        .find(|action| action.id == expected.action_id)
        .unwrap_or_else(|| panic!("expected available action {}", expected.action_id));
    assert_eq!(snapshot.available_actions.len(), 1);
    assert_eq!(action.cost_eur, expected.action_cost_eur);
    assert_eq!(action.time_cost_minutes, expected.action_time_minutes);
    assert_eq!(action.billable_minutes, expected.action_time_minutes);
}

fn assert_save_reload_parity(session: &ScenarioSession) {
    let encoded = session.save_json().unwrap();
    let restored =
        ScenarioSession::from_save_json(definition(DESERT_WATER_SCENARIO), &encoded).unwrap();
    assert_eq!(restored.snapshot(), session.snapshot());
    assert_eq!(restored.command_log(), session.command_log());
    assert_eq!(
        restored.final_state_digest().unwrap(),
        session.final_state_digest().unwrap()
    );
}

fn deadline_status<'a>(snapshot: &'a MobileScenarioSnapshot, deadline_id: &str) -> Option<&'a str> {
    snapshot
        .deadlines
        .iter()
        .find(|deadline| deadline.id == deadline_id)
        .and_then(|deadline| deadline.status.as_deref())
}

fn advance_to(session: &mut ScenarioSession, target_minute: u64) {
    while session.snapshot().clock_minutes < target_minute {
        let remaining = target_minute - session.snapshot().clock_minutes;
        // Foreground commands intentionally retain the public 24-hour cap.
        // Chunking reaches distant boundaries without bypassing that contract.
        session.advance_time(remaining.min(1_440) as u32).unwrap();
    }
}

fn assert_deadline_boundary(deadline_id: &str, due_minute: u64) {
    let mut session = ScenarioSession::new(definition(DESERT_WATER_SCENARIO), 20260804).unwrap();

    // These preservation/limitation deadlines have no activation event, so
    // they are authoritatively open from scenario start.
    assert_eq!(
        deadline_status(&session.snapshot(), deadline_id),
        Some("open")
    );
    advance_to(&mut session, due_minute - 1);
    assert_eq!(session.snapshot().clock_minutes, due_minute - 1);
    assert_eq!(
        deadline_status(&session.snapshot(), deadline_id),
        Some("open")
    );

    // The boundary processor is inclusive: arriving exactly at due time fires
    // the missed event. A later minute cannot reopen or duplicate the miss.
    session.advance_time(1).unwrap();
    assert_eq!(session.snapshot().clock_minutes, due_minute);
    assert_eq!(
        deadline_status(&session.snapshot(), deadline_id),
        Some("missed")
    );
    session.advance_time(1).unwrap();
    assert_eq!(session.snapshot().clock_minutes, due_minute + 1);
    assert_eq!(
        deadline_status(&session.snapshot(), deadline_id),
        Some("missed")
    );
}

#[test]
fn released_rust_scenario_fingerprints_remain_byte_exact() {
    for (encoded, expected) in [
        (
            FAILED_ERP_SCENARIO,
            "ed3e67464797d8dcfd4acd90a2f3c0ab769fab1b9b7fc87c1a8857b43e2fd2f8",
        ),
        (
            LOGISTICS_SCENARIO,
            "1c6a26a53f0a0d05161812787a0e36f342271b4f9f3bdd7afa9a5068f52a8dd8",
        ),
        (
            GREENFIRE_SCENARIO,
            "b585c95424169d72ac28a5d925a972e34464809a88b6a69216b88f5c65f82261",
        ),
        (
            GOLDENSHELL_SCENARIO,
            "7b0d2d7f07e3d5cb61d951afaf80d43d014893696bb16632d1beae5074d18ba4",
        ),
    ] {
        let session = ScenarioSession::new(definition(encoded), 1).unwrap();
        assert_eq!(session.scenario_fingerprint().unwrap(), expected);
    }

    let first = ScenarioSession::new(definition(DESERT_WATER_SCENARIO), 20260804)
        .unwrap()
        .scenario_fingerprint()
        .unwrap();
    let second = ScenarioSession::new(definition(DESERT_WATER_SCENARIO), 20260804)
        .unwrap()
        .scenario_fingerprint()
        .unwrap();
    assert_eq!(first, second);
    assert_eq!(
        first,
        "636e7b78ddccf01b23476e53ab77f3c8b0c82406be7c567afbd9f1edc41a28af"
    );
}

#[test]
fn dossier_omits_hidden_desert_water_content_until_authoritative_reveal() {
    let commands = trace(COORDINATED_TRACE);
    let mut session = ScenarioSession::new(definition(DESERT_WATER_SCENARIO), 20260804).unwrap();
    let initial = session.snapshot();

    assert_eq!(
        initial
            .dossier
            .facts
            .iter()
            .map(|fact| fact.id.as_str())
            .collect::<Vec<_>>(),
        [
            "community_reports_shared_exposure",
            "medical_causation_requires_individual_proof",
        ]
    );
    assert_eq!(
        initial
            .dossier
            .evidence
            .iter()
            .map(|evidence| evidence.id.as_str())
            .collect::<Vec<_>>(),
        ["community_well_register", "public_facility_permit"]
    );
    let encoded = serde_json::to_string(&initial.dossier).unwrap();
    for hidden in [
        "chromium_detected_in_residential_wells",
        "groundwater_plume_links_facility_to_wells",
        "sampling_chain_record",
        "hydrogeology_source_assessment",
        "credible_source_and_remedy",
        "compromised_claim_closed",
    ] {
        assert!(!encoded.contains(hidden), "initial dossier leaked {hidden}");
    }

    run(&mut session, &commands[..13]);
    assert_eq!(session.snapshot().clock_minutes, 1_395);
    let ready = serde_json::to_string(&session.snapshot().dossier).unwrap();
    assert!(!ready.contains("hydrogeology_source_assessment"));
    assert!(!ready.contains("groundwater_plume_links_facility_to_wells"));

    run(&mut session, &commands[13..14]);
    let reviewed = serde_json::to_string(&session.snapshot().dossier).unwrap();
    assert!(reviewed.contains("hydrogeology_source_assessment"));
    assert!(reviewed.contains("groundwater_plume_links_facility_to_wells"));
}

#[test]
fn skipped_well_mapping_can_be_recovered_after_entering_environmental_investigation() {
    let mut session = ScenarioSession::new(definition(DESERT_WATER_SCENARIO), 20260804).unwrap();

    // Reproduce the reported route: move into investigation before interviewing
    // residents or mapping their wells, then exhaust every other productive
    // investigation action and wait until the observed minute 1,646.
    for action in [
        "accept_residents_mandate",
        "commission_defensible_sampling",
        "demand_plant_record_preservation",
        "obtain_regulatory_records",
        "obtain_cooling_and_disposal_records",
        "retain_independent_hydrogeologist",
        "test_alternative_source_defence",
        "investigate_corporate_notice",
        "protect_limitation_period",
    ] {
        session.dispatch(action).unwrap();
    }
    session.advance_time(450).unwrap();
    session
        .dispatch("review_hydrological_source_assessment")
        .unwrap();
    session.advance_time(341).unwrap();

    let stranded_route = session.snapshot();
    assert_eq!(stranded_route.clock_minutes, 1_646);
    assert_eq!(stranded_route.stage_id, "environmental_investigation");
    assert_eq!(
        stranded_route
            .available_actions
            .iter()
            .map(|action| action.id.as_str())
            .collect::<Vec<_>>(),
        ["interview_affected_residents"]
    );

    session.dispatch("interview_affected_residents").unwrap();
    assert_eq!(
        session
            .snapshot()
            .available_actions
            .iter()
            .map(|action| action.id.as_str())
            .collect::<Vec<_>>(),
        ["map_wells_and_exposure_periods"]
    );

    session.dispatch("map_wells_and_exposure_periods").unwrap();
    assert!(session
        .snapshot()
        .available_actions
        .iter()
        .any(|action| action.id == "prepare_expert_evidence"));

    let recovered = session.dispatch("prepare_expert_evidence").unwrap();
    assert_eq!(recovered.clock_minutes, 2_036);
    assert_eq!(recovered.stage_id, "claim_preparation");
    assert!(!recovered.is_closed);
}

#[test]
fn migrated_player_budget_remains_authoritative_across_commands_191_and_192() {
    let commands = migrated_player_commands_through_190();
    let mut session = ScenarioSession::new(definition(DESERT_WATER_SCENARIO), 20260804).unwrap();
    run(&mut session, &commands);

    assert_eq!(session.command_log(), commands.as_slice());
    assert_budget_checkpoint(
        &session.snapshot(),
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
    assert_save_reload_parity(&session);

    session.dispatch("interview_affected_residents").unwrap();
    assert_eq!(session.command_log().len(), 191);
    assert_budget_checkpoint(
        &session.snapshot(),
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
    assert_save_reload_parity(&session);

    session.dispatch("map_wells_and_exposure_periods").unwrap();
    assert_eq!(session.command_log().len(), 192);
    assert_budget_checkpoint(
        &session.snapshot(),
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
    assert_save_reload_parity(&session);
}

#[test]
fn coordinated_trace_runs_through_engine_and_round_trips_after_closure() {
    let commands = trace(COORDINATED_TRACE);
    let mut session = ScenarioSession::new(definition(DESERT_WATER_SCENARIO), 20260804).unwrap();
    run(&mut session, &commands);

    let snapshot = session.snapshot();
    assert_eq!(snapshot.clock_minutes, 3_180);
    assert_eq!(snapshot.stage_id, "resolved");
    assert_eq!(snapshot.judicial_result, Some(JudicialResult::Won));
    assert_eq!(
        snapshot.judicial_decision_instance,
        Some(JudicialDecisionInstance::FirstInstance)
    );
    assert_eq!(snapshot.matter_lifecycle, MatterLifecycleStatus::Closed);
    assert!(snapshot.is_closed);
    assert_eq!(
        snapshot.outcome.as_ref().map(|outcome| outcome.id.as_str()),
        Some("credible_source_and_remedy")
    );
    assert_eq!(
        snapshot.dossier.procedure.matter_status,
        DossierMatterStatus::Closed
    );
    assert_eq!(
        snapshot
            .dossier
            .outcome
            .as_ref()
            .map(|outcome| outcome.id.as_str()),
        Some("credible_source_and_remedy")
    );
    assert!(snapshot.available_actions.is_empty());
    assert_eq!(
        session.final_state_digest().unwrap(),
        "432df44aa3f9039ea3970298a0c2dbfe111f0ddfbf76713c75c1cc92261e0e2d"
    );
    assert_eq!(session.command_log(), commands.as_slice());

    let encoded = session.save_json().unwrap();
    let envelope: serde_json::Value = serde_json::from_str(&encoded).unwrap();
    assert_eq!(envelope.as_object().unwrap().len(), 8);
    assert_eq!(envelope["schema_id"], "genesis.ai-juris.command-log");
    assert_eq!(envelope["schema_version"], 1);
    assert_eq!(envelope["runtime_compatibility"], "scenario-runtime-v2");
    assert!(envelope.get("dossier").is_none());

    let restored =
        ScenarioSession::from_save_json(definition(DESERT_WATER_SCENARIO), &encoded).unwrap();
    assert_eq!(restored.snapshot(), snapshot);
    assert_eq!(restored.command_log(), session.command_log());
    assert_eq!(
        restored.final_state_digest().unwrap(),
        session.final_state_digest().unwrap()
    );
}

#[test]
fn loss_remains_recoverable_then_appealable_and_explicitly_closed() {
    let commands = trace(COMPROMISED_TRACE);
    let mut session = ScenarioSession::new(definition(DESERT_WATER_SCENARIO), 20260804).unwrap();
    run(&mut session, &commands[..9]);

    let lost = session.snapshot();
    assert_eq!(lost.clock_minutes, 3_180);
    assert_eq!(lost.stage_id, "post_judgment_remedies");
    assert_eq!(lost.judicial_result, Some(JudicialResult::Lost));
    assert_eq!(
        lost.judicial_decision_instance,
        Some(JudicialDecisionInstance::FirstInstance)
    );
    assert_eq!(lost.matter_lifecycle, MatterLifecycleStatus::PostJudgment);
    assert!(!lost.is_closed);
    assert_eq!(lost.outcome, None);
    assert_eq!(
        lost.dossier.procedure.matter_status,
        DossierMatterStatus::Recoverable
    );
    let appeal = lost
        .dossier
        .deadlines
        .iter()
        .find(|deadline| deadline.id == "appeal_deadline")
        .expect("appeal deadline must be projected");
    assert_eq!(appeal.status, "open");
    assert_eq!(appeal.remedies.len(), 1);
    assert_eq!(appeal.remedies[0].action_id, "file_appeal");
    assert_eq!(appeal.remedies[0].time_cost_minutes, 120);
    assert_eq!(appeal.remedies[0].cost_eur, 5_000);
    assert_eq!(lost.dossier.outcome, None);

    let encoded = session.save_json().unwrap();
    let mut restored =
        ScenarioSession::from_save_json(definition(DESERT_WATER_SCENARIO), &encoded).unwrap();
    assert_eq!(restored.snapshot(), lost);
    assert_eq!(restored.snapshot().dossier, lost.dossier);
    assert_eq!(
        restored.final_state_digest().unwrap(),
        session.final_state_digest().unwrap()
    );

    run(&mut restored, &commands[9..11]);
    let adverse_appeal = restored.snapshot();
    assert_eq!(adverse_appeal.clock_minutes, 3_480);
    assert_eq!(adverse_appeal.stage_id, "appeal");
    assert_eq!(adverse_appeal.judicial_result, Some(JudicialResult::Lost));
    assert_eq!(
        adverse_appeal.judicial_decision_instance,
        Some(JudicialDecisionInstance::Appeal)
    );
    assert_eq!(
        adverse_appeal.matter_lifecycle,
        MatterLifecycleStatus::Appeal
    );
    assert!(!adverse_appeal.is_closed);
    assert_eq!(adverse_appeal.outcome, None);

    run(&mut restored, &commands[11..]);
    let closed = restored.snapshot();
    assert_eq!(closed.clock_minutes, 3_510);
    assert!(closed.is_closed);
    assert_eq!(closed.matter_lifecycle, MatterLifecycleStatus::Closed);
    assert_eq!(
        closed.outcome.as_ref().map(|outcome| outcome.id.as_str()),
        Some("compromised_claim_closed")
    );
    assert_eq!(
        closed.dossier.procedure.matter_status,
        DossierMatterStatus::Closed
    );
    assert_eq!(
        restored.final_state_digest().unwrap(),
        "a8ce4971e6898c5e020697733288cae4fc142cdb28f599551c7bfa0405c141ce"
    );
    assert_eq!(restored.command_log(), commands.as_slice());

    let before_rejection = restored.snapshot();
    assert_eq!(
        restored.dispatch("accept_residents_mandate"),
        Err(ScenarioRuntimeError::ScenarioResolved)
    );
    assert_eq!(
        restored.advance_time(1),
        Err(ScenarioRuntimeError::ScenarioResolved)
    );
    assert_eq!(restored.snapshot(), before_rejection);
}

#[test]
fn sampling_plant_limitation_and_claim_deadlines_have_exact_miss_boundaries() {
    for (deadline_id, due_minute) in [
        ("sampling_chain_deadline", 360),
        ("plant_record_preservation_deadline", 720),
        ("limitation_protection_deadline", 1_440),
    ] {
        assert_deadline_boundary(deadline_id, due_minute);
    }

    let coordinated = trace(COORDINATED_TRACE);
    let mut claim = ScenarioSession::new(definition(DESERT_WATER_SCENARIO), 20260804).unwrap();
    run(&mut claim, &coordinated[..15]);

    // Unlike the first three deadlines, filing is dormant until the protected
    // claim window opens at minute 2,880. Pin both sides of that activation.
    advance_to(&mut claim, 2_879);
    assert_eq!(claim.snapshot().clock_minutes, 2_879);
    assert_eq!(
        deadline_status(&claim.snapshot(), "claim_filing_deadline"),
        None
    );
    claim.advance_time(1).unwrap();
    assert_eq!(claim.snapshot().clock_minutes, 2_880);
    assert_eq!(
        deadline_status(&claim.snapshot(), "claim_filing_deadline"),
        Some("open")
    );

    advance_to(&mut claim, 4_319);
    assert_eq!(
        deadline_status(&claim.snapshot(), "claim_filing_deadline"),
        Some("open")
    );
    claim.advance_time(1).unwrap();
    assert_eq!(claim.snapshot().clock_minutes, 4_320);
    assert_eq!(
        deadline_status(&claim.snapshot(), "claim_filing_deadline"),
        Some("missed")
    );
    claim.advance_time(1).unwrap();
    assert_eq!(claim.snapshot().clock_minutes, 4_321);
    assert_eq!(
        deadline_status(&claim.snapshot(), "claim_filing_deadline"),
        Some("missed")
    );
}

#[test]
fn timely_deadline_actions_complete_once_and_survive_their_due_boundaries() {
    let coordinated = trace(COORDINATED_TRACE);

    let mut sampling = ScenarioSession::new(definition(DESERT_WATER_SCENARIO), 20260804).unwrap();
    run(&mut sampling, &coordinated[..2]);
    assert_eq!(
        deadline_status(&sampling.snapshot(), "sampling_chain_deadline"),
        Some("completed")
    );
    advance_to(&mut sampling, 361);
    assert_eq!(
        deadline_status(&sampling.snapshot(), "sampling_chain_deadline"),
        Some("completed")
    );

    let mut plant = ScenarioSession::new(definition(DESERT_WATER_SCENARIO), 20260804).unwrap();
    plant.dispatch("accept_residents_mandate").unwrap();
    plant.dispatch("demand_plant_record_preservation").unwrap();
    assert_eq!(
        deadline_status(&plant.snapshot(), "plant_record_preservation_deadline"),
        Some("completed")
    );
    advance_to(&mut plant, 721);
    assert_eq!(
        deadline_status(&plant.snapshot(), "plant_record_preservation_deadline"),
        Some("completed")
    );

    let mut limitation = ScenarioSession::new(definition(DESERT_WATER_SCENARIO), 20260804).unwrap();
    run(&mut limitation, &coordinated[..11]);
    assert_eq!(
        deadline_status(&limitation.snapshot(), "limitation_protection_deadline"),
        Some("completed")
    );
    advance_to(&mut limitation, 1_441);
    assert_eq!(
        deadline_status(&limitation.snapshot(), "limitation_protection_deadline"),
        Some("completed")
    );

    let mut claim = ScenarioSession::new(definition(DESERT_WATER_SCENARIO), 20260804).unwrap();
    run(&mut claim, &coordinated[..17]);
    assert_eq!(
        deadline_status(&claim.snapshot(), "claim_filing_deadline"),
        Some("completed")
    );
    advance_to(&mut claim, 4_321);
    assert_eq!(
        deadline_status(&claim.snapshot(), "claim_filing_deadline"),
        Some("completed")
    );
}

#[test]
fn preserved_source_issue_can_reverse_the_loss_on_appeal() {
    let coordinated = trace(COORDINATED_TRACE);
    let mut session = ScenarioSession::new(definition(DESERT_WATER_SCENARIO), 20260804).unwrap();
    run(&mut session, &coordinated[..17]);
    for action in [
        "receive_adverse_first_instance_judgment",
        "preserve_source_issue_for_appeal",
        "file_appeal",
        "receive_favorable_appeal_judgment",
    ] {
        session.dispatch(action).unwrap();
    }

    let snapshot = session.snapshot();
    assert_eq!(snapshot.clock_minutes, 3_660);
    assert_eq!(snapshot.judicial_result, Some(JudicialResult::Won));
    assert_eq!(
        snapshot.judicial_decision_instance,
        Some(JudicialDecisionInstance::Appeal)
    );
    assert!(snapshot.is_closed);
    assert_eq!(
        snapshot.outcome.as_ref().map(|outcome| outcome.id.as_str()),
        Some("credible_source_and_remedy")
    );
}

#[test]
fn waiver_expiry_and_time_bar_require_explicit_closure() {
    let compromised = trace(COMPROMISED_TRACE);

    let mut waived = ScenarioSession::new(definition(DESERT_WATER_SCENARIO), 20260804).unwrap();
    run(&mut waived, &compromised[..9]);
    let waived_snapshot = waived.dispatch("waive_appeal_and_close").unwrap();
    assert_eq!(waived_snapshot.clock_minutes, 3_210);
    assert_eq!(waived_snapshot.judicial_result, Some(JudicialResult::Lost));
    assert_eq!(
        waived_snapshot.judicial_decision_instance,
        Some(JudicialDecisionInstance::FirstInstance)
    );
    assert!(waived_snapshot.is_closed);
    assert_eq!(
        waived_snapshot
            .outcome
            .as_ref()
            .map(|outcome| outcome.id.as_str()),
        Some("compromised_claim_closed")
    );

    let mut expired = ScenarioSession::new(definition(DESERT_WATER_SCENARIO), 20260804).unwrap();
    run(&mut expired, &compromised[..9]);
    expired.advance_time(1_440).unwrap();
    expired.advance_time(1_440).unwrap();
    expired.advance_time(1_141).unwrap();
    let before_close = expired.snapshot();
    assert_eq!(before_close.clock_minutes, 7_201);
    assert!(!before_close.is_closed);
    assert!(before_close
        .deadlines
        .iter()
        .any(|deadline| deadline.id == "appeal_deadline"
            && deadline.status.as_deref() == Some("missed")));
    let expired_snapshot = expired.dispatch("close_after_appeal_expiry").unwrap();
    assert_eq!(expired_snapshot.clock_minutes, 7_231);
    assert!(expired_snapshot.is_closed);
    assert_eq!(
        expired_snapshot
            .outcome
            .as_ref()
            .map(|outcome| outcome.id.as_str()),
        Some("compromised_claim_closed")
    );

    let mut time_barred =
        ScenarioSession::new(definition(DESERT_WATER_SCENARIO), 20260804).unwrap();
    time_barred.dispatch("accept_residents_mandate").unwrap();
    time_barred.dispatch("rely_on_unverified_samples").unwrap();
    time_barred.advance_time(1_351).unwrap();
    let before_close = time_barred.snapshot();
    assert_eq!(before_close.clock_minutes, 1_441);
    assert_eq!(before_close.judicial_result, None);
    assert!(!before_close.is_closed);
    let time_barred_snapshot = time_barred
        .dispatch("acknowledge_time_bar_and_close")
        .unwrap();
    assert_eq!(time_barred_snapshot.clock_minutes, 1_471);
    assert_eq!(time_barred_snapshot.judicial_result, None);
    assert_eq!(time_barred_snapshot.judicial_decision_instance, None);
    assert!(time_barred_snapshot.is_closed);
    assert_eq!(
        time_barred_snapshot
            .outcome
            .as_ref()
            .map(|outcome| outcome.id.as_str()),
        Some("compromised_claim_closed")
    );
}
