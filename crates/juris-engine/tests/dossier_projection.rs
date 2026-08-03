use std::collections::BTreeSet;

use juris_engine::{
    DossierMatterStatus, ScenarioSession, ScenarioSessionRegistry,
    DOSSIER_PROJECTION_SCHEMA_VERSION,
};
use juris_scenario_schema::{
    JudicialDecisionInstance, JudicialResult, MatterLifecycleStatus, ScenarioDefinition,
};

const DOSSIER_SCENARIO: &str =
    include_str!("../../../content/fixtures/authoring/dossier_projection_v1.json");

fn definition() -> ScenarioDefinition {
    serde_json::from_str(DOSSIER_SCENARIO).expect("dossier fixture must parse")
}

fn adverse_session(seed: u64) -> ScenarioSession {
    let mut session = ScenarioSession::new(definition(), seed).expect("fixture must validate");
    session.dispatch("z_reveal_record").unwrap();
    session.dispatch("a_receive_adverse_decision").unwrap();
    session
}

#[test]
fn focused_fixture_passes_the_complete_scenario_validator() {
    let report = juris_scenario_validator::validate_scenario(&definition());
    assert!(
        report.is_valid(),
        "dossier fixture diagnostics: {:#?}",
        report.diagnostics
    );
}

#[test]
fn projection_omits_unknown_and_future_authoring_state() {
    let session = ScenarioSession::new(definition(), 101).unwrap();
    let snapshot = session.snapshot();
    let dossier = &snapshot.dossier;

    assert_eq!(
        dossier.projection_schema_version,
        DOSSIER_PROJECTION_SCHEMA_VERSION
    );
    assert_eq!(dossier.procedure.stage_id, "investigation");
    assert_eq!(dossier.procedure.clock_minutes, 0);
    assert_eq!(dossier.procedure.matter_status, DossierMatterStatus::Open);
    assert_eq!(
        dossier.procedure.matter_lifecycle,
        MatterLifecycleStatus::Active
    );
    assert!(!dossier.procedure.is_closed);
    assert_eq!(dossier.judicial_result, None);
    assert_eq!(dossier.judicial_decision_instance, None);
    assert_eq!(
        dossier
            .facts
            .iter()
            .map(|fact| fact.id.as_str())
            .collect::<Vec<_>>(),
        ["a_known_fact", "z_known_fact"]
    );
    assert_eq!(
        dossier
            .evidence
            .iter()
            .map(|evidence| evidence.id.as_str())
            .collect::<Vec<_>>(),
        ["a_visible_evidence", "z_visible_evidence"]
    );
    let registry_extract = dossier
        .evidence
        .iter()
        .find(|evidence| evidence.id == "z_visible_evidence")
        .unwrap();
    assert_eq!(registry_extract.supports_fact_ids, ["z_known_fact"]);
    assert_eq!(registry_extract.contradicts_fact_ids, ["a_known_fact"]);
    assert!(dossier.deadlines.is_empty());
    assert_eq!(dossier.outcome, None);

    let encoded = serde_json::to_string(dossier).unwrap();
    for sentinel in [
        "sentinel_unknown_fact",
        "SENTINEL UNKNOWN FACT MUST NOT LEAK",
        "sentinel_unavailable_evidence",
        "SENTINEL UNAVAILABLE EVIDENCE MUST NOT LEAK",
        "SENTINEL UNAVAILABLE DESCRIPTION MUST NOT LEAK",
        "sentinel_inactive_deadline",
        "SENTINEL INACTIVE DEADLINE MUST NOT LEAK",
        "sentinel_unfired_event",
        "SENTINEL UNFIRED EVENT MUST NOT LEAK",
        "sentinel_private_flag",
        "sentinel_future_gate",
        "sentinel_future_activation_action",
        "SENTINEL FUTURE ACTION MUST NOT LEAK",
        "sentinel_future_remedy_action",
        "SENTINEL FUTURE REMEDY MUST NOT LEAK",
        "final_loss",
        "SENTINEL HIDDEN LOSS OUTCOME",
        "SENTINEL HIDDEN OUTCOME SUMMARY MUST NOT LEAK BEFORE CLOSURE",
    ] {
        assert!(
            !encoded.contains(sentinel),
            "dossier leaked hidden sentinel `{sentinel}`: {encoded}"
        );
    }
}

#[test]
fn reveal_is_additive_and_prior_snapshot_remains_immutable() {
    let mut session = ScenarioSession::new(definition(), 102).unwrap();
    let before = session.snapshot();

    let after = session.dispatch("z_reveal_record").unwrap();

    assert_eq!(
        before
            .dossier
            .facts
            .iter()
            .map(|fact| fact.id.as_str())
            .collect::<Vec<_>>(),
        ["a_known_fact", "z_known_fact"]
    );
    assert_eq!(
        before
            .dossier
            .evidence
            .iter()
            .map(|evidence| evidence.id.as_str())
            .collect::<Vec<_>>(),
        ["a_visible_evidence", "z_visible_evidence"]
    );
    assert_eq!(
        after
            .dossier
            .facts
            .iter()
            .map(|fact| fact.id.as_str())
            .collect::<Vec<_>>(),
        ["a_known_fact", "sentinel_unknown_fact", "z_known_fact"]
    );
    assert_eq!(
        after
            .dossier
            .evidence
            .iter()
            .map(|evidence| evidence.id.as_str())
            .collect::<Vec<_>>(),
        [
            "a_visible_evidence",
            "sentinel_unavailable_evidence",
            "z_visible_evidence"
        ]
    );
    let registry_extract = after
        .dossier
        .evidence
        .iter()
        .find(|evidence| evidence.id == "z_visible_evidence")
        .unwrap();
    assert_eq!(
        registry_extract.supports_fact_ids,
        ["sentinel_unknown_fact", "z_known_fact"]
    );

    let encoded = serde_json::to_string(&after.dossier).unwrap();
    assert!(encoded.contains("sentinel_unknown_fact"));
    assert!(encoded.contains("sentinel_unavailable_evidence"));
    for private in [
        "sentinel_private_flag",
        "sentinel_future_gate",
        "sentinel_inactive_deadline",
        "sentinel_unfired_event",
        "sentinel_future_activation_action",
        "sentinel_future_remedy_action",
        "final_loss",
    ] {
        assert!(!encoded.contains(private), "leaked `{private}`: {encoded}");
    }
}

#[test]
fn identical_seed_and_command_log_produce_identical_sorted_projection() {
    let first = adverse_session(103);
    let second = adverse_session(103);

    assert_eq!(first.command_log(), second.command_log());
    assert_eq!(first.snapshot().dossier, second.snapshot().dossier);

    let dossier = first.snapshot().dossier;
    assert_eq!(dossier.procedure.stage_id, "post_judgment");
    assert_eq!(dossier.procedure.clock_minutes, 30);
    assert_eq!(
        dossier.procedure.matter_lifecycle,
        MatterLifecycleStatus::PostJudgment
    );
    assert_eq!(
        dossier.procedure.matter_status,
        DossierMatterStatus::Recoverable
    );
    assert_eq!(dossier.judicial_result, Some(JudicialResult::Lost));
    assert_eq!(
        dossier.judicial_decision_instance,
        Some(JudicialDecisionInstance::FirstInstance)
    );
    assert_eq!(
        dossier
            .deadlines
            .iter()
            .map(|deadline| (deadline.id.as_str(), deadline.due_at_minutes))
            .collect::<Vec<_>>(),
        [("a_review_deadline", 240), ("z_appeal_deadline", 300)]
    );
    assert_eq!(
        dossier.deadlines[0]
            .remedies
            .iter()
            .map(|remedy| remedy.action_id.as_str())
            .collect::<Vec<_>>(),
        ["file_appeal", "preserve_review_rights"]
    );
    assert_eq!(
        dossier.deadlines[1]
            .remedies
            .iter()
            .map(|remedy| remedy.action_id.as_str())
            .collect::<Vec<_>>(),
        ["file_appeal"]
    );
    assert_eq!(dossier.deadlines[0].remedies[0].cost_eur, 1_800);
    assert_eq!(dossier.deadlines[0].remedies[0].time_cost_minutes, 60);
    assert_eq!(dossier.outcome, None);

    let mut tied_definition = definition();
    tied_definition
        .deadlines
        .iter_mut()
        .find(|deadline| deadline.id.as_str() == "z_appeal_deadline")
        .unwrap()
        .due_at
        .minute_of_day = 240;
    let mut tied = ScenarioSession::new(tied_definition, 103).unwrap();
    tied.dispatch("z_reveal_record").unwrap();
    tied.dispatch("a_receive_adverse_decision").unwrap();
    assert_eq!(
        tied.snapshot()
            .dossier
            .deadlines
            .iter()
            .map(|deadline| deadline.id.as_str())
            .collect::<Vec<_>>(),
        ["a_review_deadline", "z_appeal_deadline"],
        "stable deadline ID must break equal-due-time ties"
    );
}

#[test]
fn completed_and_missed_deadlines_remove_remedies_deterministically() {
    let mut completed = adverse_session(104);
    let snapshot = completed.dispatch("preserve_review_rights").unwrap();
    assert_eq!(snapshot.dossier.deadlines[0].status, "completed");
    assert!(snapshot.dossier.deadlines[0].remedies.is_empty());
    assert_eq!(snapshot.dossier.deadlines[1].status, "open");
    assert_eq!(
        snapshot.dossier.procedure.matter_status,
        DossierMatterStatus::Recoverable
    );

    let appealed = completed.dispatch("file_appeal").unwrap();
    assert_eq!(appealed.dossier.procedure.stage_id, "appeal");
    assert!(appealed
        .dossier
        .deadlines
        .iter()
        .all(|deadline| deadline.status == "completed" && deadline.remedies.is_empty()));
    assert_eq!(
        appealed.dossier.procedure.matter_status,
        DossierMatterStatus::Open
    );
    assert_eq!(appealed.judicial_result, Some(JudicialResult::Lost));
    assert_eq!(
        appealed.dossier.judicial_decision_instance,
        Some(JudicialDecisionInstance::FirstInstance)
    );

    let closed = completed.dispatch("resolve_appeal_and_close").unwrap();
    assert_eq!(
        closed.dossier.procedure.matter_status,
        DossierMatterStatus::Closed
    );
    assert_eq!(
        closed.dossier.procedure.matter_lifecycle,
        MatterLifecycleStatus::Closed
    );
    assert!(closed.dossier.procedure.is_closed);
    assert_eq!(closed.dossier.judicial_result, Some(JudicialResult::Won));
    assert_eq!(
        closed.dossier.judicial_decision_instance,
        Some(JudicialDecisionInstance::Appeal)
    );
    assert_eq!(
        closed
            .dossier
            .outcome
            .as_ref()
            .map(|outcome| outcome.id.as_str()),
        Some("recovered_on_appeal")
    );

    let mut missed = adverse_session(105);
    let expired = missed.advance_time(270).unwrap();
    assert_eq!(expired.clock_minutes, 300);
    assert!(expired
        .dossier
        .deadlines
        .iter()
        .all(|deadline| deadline.status == "missed" && deadline.remedies.is_empty()));
    assert_eq!(
        expired.dossier.procedure.matter_status,
        DossierMatterStatus::Open
    );
    assert_eq!(expired.dossier.outcome, None);

    let closed = missed.dispatch("close_after_expiry").unwrap();
    assert_eq!(
        closed.dossier.procedure.matter_status,
        DossierMatterStatus::Closed
    );
    assert_eq!(closed.dossier.judicial_result, Some(JudicialResult::Lost));
    assert_eq!(
        closed.dossier.judicial_decision_instance,
        Some(JudicialDecisionInstance::FirstInstance)
    );
    assert_eq!(
        closed
            .dossier
            .outcome
            .as_ref()
            .map(|outcome| outcome.id.as_str()),
        Some("final_loss")
    );
}

#[test]
fn save_load_rederives_the_exact_dossier_without_digest_or_duplicate_effects() {
    let session = adverse_session(106);
    let before = session.snapshot().dossier;
    let digest_before_snapshot = session.final_state_digest().unwrap();
    let _ = session.snapshot();
    assert_eq!(
        session.final_state_digest().unwrap(),
        digest_before_snapshot
    );

    let encoded = session.save_json().unwrap();
    let envelope: serde_json::Value = serde_json::from_str(&encoded).unwrap();
    assert_eq!(envelope.as_object().unwrap().len(), 8);
    assert!(envelope.get("dossier").is_none());
    assert_eq!(
        session.final_state_digest().unwrap(),
        digest_before_snapshot
    );

    let restored = ScenarioSession::from_save_json(definition(), &encoded).unwrap();
    assert_eq!(restored.snapshot().dossier, before);
    assert_eq!(
        restored.final_state_digest().unwrap(),
        digest_before_snapshot
    );

    let mut registry = ScenarioSessionRegistry::new();
    let first = registry.load_from_json(definition(), &encoded).unwrap();
    let second = registry.load_from_json(definition(), &encoded).unwrap();
    let first_dossier = registry.snapshot(first).unwrap().dossier;
    let second_dossier = registry.snapshot(second).unwrap().dossier;
    assert_eq!(first_dossier, before);
    assert_eq!(second_dossier, before);

    let fact_ids = first_dossier
        .facts
        .iter()
        .map(|fact| fact.id.as_str())
        .collect::<BTreeSet<_>>();
    let evidence_ids = first_dossier
        .evidence
        .iter()
        .map(|evidence| evidence.id.as_str())
        .collect::<BTreeSet<_>>();
    let deadline_ids = first_dossier
        .deadlines
        .iter()
        .map(|deadline| deadline.id.as_str())
        .collect::<BTreeSet<_>>();
    assert_eq!(fact_ids.len(), first_dossier.facts.len());
    assert_eq!(evidence_ids.len(), first_dossier.evidence.len());
    assert_eq!(deadline_ids.len(), first_dossier.deadlines.len());
}
