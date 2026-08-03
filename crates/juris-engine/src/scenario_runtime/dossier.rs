//! Deterministic, player-facing dossier projection.
//!
//! The dossier is derived from the authoritative scenario definition and
//! runtime state every time a snapshot is produced. It is deliberately not a
//! second mutable model and is never persisted or included in save digests.

use std::collections::BTreeSet;

use juris_scenario_schema::{
    DeadlineStatus, EvidenceKind, FactStatus, JudicialDecisionInstance, JudicialResult,
    MatterLifecycleStatus, StageDefinition,
};
use serde::Serialize;

use super::{
    deadline_status_name, fact_status_name, scenario_time_minutes, MobileActionSnapshot,
    MobileOutcomeSnapshot, ScenarioSession,
};

/// Version of the additive dossier read model carried by a mobile snapshot.
pub const DOSSIER_PROJECTION_SCHEMA_VERSION: u32 = 1;

/// Player-facing status derived from authoritative lifecycle and remedy state.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum DossierMatterStatus {
    Open,
    Recoverable,
    Closed,
}

/// Current procedural position of the matter.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct DossierProcedureProjection {
    pub stage_id: String,
    pub stage_title: String,
    pub clock_minutes: u64,
    pub matter_lifecycle: MatterLifecycleStatus,
    pub is_closed: bool,
    pub matter_status: DossierMatterStatus,
}

/// One fact that is currently known to the player.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct DossierFactProjection {
    pub id: String,
    pub statement: String,
    pub status: String,
}

/// One item of evidence that is currently available to the player.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct DossierEvidenceProjection {
    pub id: String,
    pub title: String,
    pub kind: String,
    pub description: Option<String>,
    pub supports_fact_ids: Vec<String>,
    pub contradicts_fact_ids: Vec<String>,
}

/// One currently available action capable of completing an open deadline.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct DossierRemedyProjection {
    pub action_id: String,
    pub title: String,
    pub description: Option<String>,
    pub time_cost_minutes: u32,
    pub cost_eur: u32,
}

/// One activated deadline and the remedies currently executable for it.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct DossierDeadlineProjection {
    pub id: String,
    pub title: String,
    pub due_at_minutes: u64,
    pub status: String,
    pub remedies: Vec<DossierRemedyProjection>,
}

/// Terminal outcome exposed only after explicit matter closure.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct DossierOutcomeProjection {
    pub id: String,
    pub title: String,
    pub summary: String,
}

/// Immutable dossier derived from the same authoritative state as its parent
/// mobile snapshot.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct DossierProjection {
    pub projection_schema_version: u32,
    pub procedure: DossierProcedureProjection,
    pub judicial_result: Option<JudicialResult>,
    pub judicial_decision_instance: Option<JudicialDecisionInstance>,
    pub facts: Vec<DossierFactProjection>,
    pub evidence: Vec<DossierEvidenceProjection>,
    pub deadlines: Vec<DossierDeadlineProjection>,
    pub outcome: Option<DossierOutcomeProjection>,
}

pub(super) fn project_dossier(
    session: &ScenarioSession,
    stage: &StageDefinition,
    matter_lifecycle: MatterLifecycleStatus,
    is_closed: bool,
    available_actions: &[MobileActionSnapshot],
    outcome: Option<&MobileOutcomeSnapshot>,
) -> DossierProjection {
    let mut facts = session
        .definition
        .facts
        .iter()
        .filter_map(|fact| {
            let status = *session
                .state
                .fact_statuses
                .get(fact.id.as_str())
                .expect("validated fact state must exist");
            (status != FactStatus::Unknown).then(|| DossierFactProjection {
                id: fact.id.as_str().to_owned(),
                statement: fact.statement.clone(),
                status: fact_status_name(status).to_owned(),
            })
        })
        .collect::<Vec<_>>();
    facts.sort_by(|left, right| left.id.cmp(&right.id));

    let visible_fact_ids = facts
        .iter()
        .map(|fact| fact.id.as_str())
        .collect::<BTreeSet<_>>();
    let mut evidence = session
        .definition
        .evidence
        .iter()
        .filter(|item| session.state.available_evidence.contains(item.id.as_str()))
        .map(|item| {
            let mut supports_fact_ids = item
                .supports_facts
                .iter()
                .filter(|fact| visible_fact_ids.contains(fact.as_str()))
                .map(|fact| fact.as_str().to_owned())
                .collect::<Vec<_>>();
            supports_fact_ids.sort();
            supports_fact_ids.dedup();

            let mut contradicts_fact_ids = item
                .contradicts_facts
                .iter()
                .filter(|fact| visible_fact_ids.contains(fact.as_str()))
                .map(|fact| fact.as_str().to_owned())
                .collect::<Vec<_>>();
            contradicts_fact_ids.sort();
            contradicts_fact_ids.dedup();

            DossierEvidenceProjection {
                id: item.id.as_str().to_owned(),
                title: item.title.clone(),
                kind: evidence_kind_name(item.kind).to_owned(),
                description: item.description.clone(),
                supports_fact_ids,
                contradicts_fact_ids,
            }
        })
        .collect::<Vec<_>>();
    evidence.sort_by(|left, right| left.id.cmp(&right.id));

    let mut deadlines = session
        .definition
        .deadlines
        .iter()
        .filter_map(|deadline| {
            let status = session
                .state
                .deadline_statuses
                .get(deadline.id.as_str())
                .copied()
                .flatten()?;
            let remedies = if status == DeadlineStatus::Open {
                let mut remedies = deadline
                    .completion_actions
                    .iter()
                    .filter_map(|action_id| {
                        available_actions
                            .iter()
                            .find(|action| action.id == action_id.as_str())
                    })
                    .map(|action| DossierRemedyProjection {
                        action_id: action.id.clone(),
                        title: action.title.clone(),
                        description: action.description.clone(),
                        time_cost_minutes: action.time_cost_minutes,
                        cost_eur: action.cost_eur,
                    })
                    .collect::<Vec<_>>();
                remedies.sort_by(|left, right| left.action_id.cmp(&right.action_id));
                remedies.dedup_by(|left, right| left.action_id == right.action_id);
                remedies
            } else {
                Vec::new()
            };

            Some(DossierDeadlineProjection {
                id: deadline.id.as_str().to_owned(),
                title: deadline.title.clone(),
                due_at_minutes: scenario_time_minutes(deadline.due_at),
                status: deadline_status_name(status).to_owned(),
                remedies,
            })
        })
        .collect::<Vec<_>>();
    deadlines.sort_by(|left, right| {
        left.due_at_minutes
            .cmp(&right.due_at_minutes)
            .then_with(|| left.id.cmp(&right.id))
    });

    let has_available_remedy = deadlines
        .iter()
        .any(|deadline| deadline.status == "open" && !deadline.remedies.is_empty());
    let adverse_result = matches!(
        session.state.judicial_result,
        Some(JudicialResult::Lost | JudicialResult::Dismissed | JudicialResult::PartiallyWon)
    );
    let matter_status = if is_closed {
        DossierMatterStatus::Closed
    } else if adverse_result && has_available_remedy {
        DossierMatterStatus::Recoverable
    } else {
        DossierMatterStatus::Open
    };

    DossierProjection {
        projection_schema_version: DOSSIER_PROJECTION_SCHEMA_VERSION,
        procedure: DossierProcedureProjection {
            stage_id: session.state.stage_id.clone(),
            stage_title: stage.title.clone(),
            clock_minutes: session.state.clock_minutes,
            matter_lifecycle,
            is_closed,
            matter_status,
        },
        judicial_result: session.state.judicial_result,
        judicial_decision_instance: session.state.judicial_decision_instance,
        facts,
        evidence,
        deadlines,
        outcome: is_closed
            .then_some(outcome)
            .flatten()
            .map(|item| DossierOutcomeProjection {
                id: item.id.clone(),
                title: item.title.clone(),
                summary: item.summary.clone(),
            }),
    }
}

fn evidence_kind_name(kind: EvidenceKind) -> &'static str {
    match kind {
        EvidenceKind::Document => "document",
        EvidenceKind::Email => "email",
        EvidenceKind::Contract => "contract",
        EvidenceKind::Invoice => "invoice",
        EvidenceKind::ExpertReport => "expert_report",
        EvidenceKind::WitnessStatement => "witness_statement",
        EvidenceKind::SystemRecord => "system_record",
        EvidenceKind::Other => "other",
    }
}
