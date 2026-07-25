//! Boundary between deterministic simulation and AI-generated language.
//!
//! The AI layer may analyze facts already known to the player and return text,
//! but it cannot mutate `MatterState`, discover evidence, advance time, spend
//! money, or determine an outcome. The engine remains the sole authority for
//! every consequential state transition.
//!
//! This separation allows external models to be replaced, keeps offline tests
//! deterministic, and prevents untrusted model output from directly changing
//! the authoritative world.

use juris_domain::{ActorId, CaseStage, MatterState};

/// Typed context supplied to an AI-controlled actor.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ActorPrompt {
    /// Persona expected to produce the response.
    pub actor: ActorId,
    /// Narrow task such as evidence review or hearing preparation.
    pub objective: String,
    /// Facts the engine has explicitly authorized the actor to see.
    pub known_facts: Vec<String>,
    /// Structured procedural phase; the model need not infer it from prose.
    pub stage: CaseStage,
}

/// Advisory response returned to the engine.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ActorResponse {
    pub text: String,
    pub confidence_percent: u8,
}

/// Adapter contract for a scripted, local, or cloud AI actor.
///
/// `state` is borrowed immutably. Rust therefore prevents implementations from
/// changing authoritative state through this interface. The response is owned,
/// allowing the engine to sanitize, retain, or discard it independently of the
/// adapter's lifetime.
pub trait AiActor {
    fn respond(&self, prompt: &ActorPrompt, state: &MatterState) -> ActorResponse;
}

/// Deterministic offline stand-in used by the CLI and automated tests.
///
/// It returns useful but generic notes. The engine separately resolves whether
/// the assistance was mechanically reliable; prose never decides the result.
#[derive(Debug, Default, Clone, Copy)]
pub struct ScriptedAiActor;

impl AiActor for ScriptedAiActor {
    fn respond(&self, prompt: &ActorPrompt, state: &MatterState) -> ActorResponse {
        let text = match prompt.actor {
            ActorId::AiAssociate => format!(
                "AI associate: {} I reviewed {} authorized facts at the {:?} stage. Current position is {}/100. Verify authorities, citations, and assumptions before relying on this note.",
                prompt.objective,
                prompt.known_facts.len(),
                prompt.stage,
                state.position_score()
            ),
            ActorId::OpposingCounsel => {
                "Opposing counsel denies liability but remains open to a commercial resolution."
                    .to_owned()
            }
            ActorId::ClientCfo => {
                "The CFO wants an immediate visible response and minimizes the client's own change requests."
                    .to_owned()
            }
            ActorId::Partner => {
                "The partner expects a concise risk assessment, budget range, and recommendation."
                    .to_owned()
            }
            _ => "The actor acknowledges the development.".to_owned(),
        };

        ActorResponse {
            text,
            confidence_percent: 78,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::{ActorPrompt, AiActor, ScriptedAiActor};
    use juris_core::SimMinute;
    use juris_domain::{
        ActorId, AiUsage, CaseStage, DelegationState, LitigationState, MatterState, Reputation,
        Score, WorkState,
    };

    fn minimal_state() -> MatterState {
        MatterState {
            title: "Test".to_owned(),
            claim_value_eur: 1,
            now: SimMinute::START_OF_DAY,
            stage: CaseStage::Investigation,
            legal_merits: Score::new(50),
            evidence_quality: Score::new(50),
            procedural_position: Score::new(50),
            negotiation_leverage: Score::new(50),
            hearing_preparation: Score::new(20),
            budget_spent_eur: 0,
            billable_minutes: 0,
            reputation: Reputation::default(),
            work: WorkState {
                tracked_day: 1,
                minutes_worked_today: 0,
                daily_capacity_minutes: 540,
                fatigue: Score::new(10),
                overtime_minutes_total: 0,
            },
            delegation: DelegationState {
                in_progress: None,
                completed: None,
                reports_reviewed: 0,
            },
            litigation: LitigationState {
                statement_drafted: false,
                statement_filed: false,
                disclosure_served: false,
                opponent_disclosure_received: false,
                opponent_disclosure_reviewed: false,
                expert_commissioned: false,
                expert_report_ready: false,
                expert_report_reviewed: false,
                proceeded_without_expert: false,
                witnesses_prepared: false,
                hearing_rehearsed: false,
                hearing_scheduled_for: None,
            },
            actors: Vec::new(),
            evidence: Vec::new(),
            deadlines: Vec::new(),
            action_history: Vec::new(),
            ai_usage: AiUsage {
                requests_used: 0,
                request_limit: 2,
                last_note: None,
            },
            inbox: Vec::new(),
            settlement_offer_eur: None,
            outcome: None,
        }
    }

    #[test]
    fn scripted_actor_uses_only_explicitly_authorized_context() {
        // The response names the exact number of supplied facts. This proves
        // hidden evidence is not implicitly exposed by the adapter contract.
        let actor = ScriptedAiActor;
        let response = actor.respond(
            &ActorPrompt {
                actor: ActorId::AiAssociate,
                objective: "Review the known record.".to_owned(),
                known_facts: vec!["Signed contract".to_owned()],
                stage: CaseStage::Investigation,
            },
            &minimal_state(),
        );
        assert!(response.text.contains("1 authorized facts"));
    }
}
