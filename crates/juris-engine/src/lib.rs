//! Event-driven simulation engine for the first playable legal workday.
//!
//! Architectural rules:
//! - only this crate mutates `MatterState`;
//! - UI submits typed `PlayerAction` values;
//! - AI returns advisory text, never state changes;
//! - scheduled world events are ordered deterministically;
//! - identical seed + mode + player actions produce identical outcomes.

use juris_ai::{ActorPrompt, AiActor};
use juris_content::{failed_erp_template, CaseTemplate};
use juris_core::{DeterministicRng, Scheduler, SimMinute};
use juris_domain::*;
use thiserror::Error;

#[derive(Debug, Error, PartialEq, Eq)]
pub enum EngineError {
    #[error("the matter is already resolved")]
    MatterResolved,
    #[error("action {0:?} is not currently available")]
    ActionUnavailable(PlayerAction),
    #[error("the internal AI assistant is unavailable in this mode")]
    AiUnavailable,
    #[error("the internal AI request limit has been reached")]
    AiLimitReached,
}

pub struct Engine<A: AiActor> {
    seed: u64,
    mode: GameMode,
    rng: DeterministicRng,
    scheduler: Scheduler<WorldEvent>,
    ai: A,
    state: MatterState,
    template: CaseTemplate,
}

impl<A: AiActor> Engine<A> {
    pub fn new(seed: u64, mode: GameMode, ai: A) -> Self {
        let template = failed_erp_template();
        let mut scheduler = Scheduler::default();
        scheduler.schedule(
            SimMinute::START_OF_DAY,
            WorldEvent::InboxMessage {
                from: ActorId::ClientCeo,
                subject: template.opening_subject.clone(),
                body: template.opening_message.clone(),
            },
        );
        scheduler.schedule(
            SimMinute::START_OF_DAY.saturating_add_minutes(65),
            WorldEvent::ClientPressure,
        );
        scheduler.schedule(
            SimMinute::START_OF_DAY.saturating_add_minutes(180),
            WorldEvent::PartnerReview,
        );

        let state = MatterState {
            title: template.title.clone(),
            claim_value_eur: template.claim_value_eur,
            now: SimMinute::START_OF_DAY,
            stage: CaseStage::Intake,
            legal_merits: Score::new(52),
            evidence_quality: Score::new(28),
            procedural_position: Score::new(55),
            negotiation_leverage: Score::new(35),
            budget_spent_eur: 0,
            billable_minutes: 0,
            reputation: Reputation::default(),
            actors: initial_actors(),
            evidence: initial_evidence(),
            action_history: Vec::new(),
            ai_usage: AiUsage {
                requests_used: 0,
                request_limit: if mode == GameMode::Assisted { 5 } else { 2 },
                last_note: None,
            },
            inbox: Vec::new(),
            outcome: None,
        };

        Self {
            seed,
            mode,
            rng: DeterministicRng::new(seed),
            scheduler,
            ai,
            state,
            template,
        }
    }

    pub fn seed(&self) -> u64 {
        self.seed
    }

    pub fn mode(&self) -> GameMode {
        self.mode
    }

    pub fn state(&self) -> &MatterState {
        &self.state
    }

    pub fn decision_seconds(&self) -> Option<u32> {
        self.mode.decision_seconds()
    }

    /// Advances to the next scheduled world event and processes all events due
    /// at that exact minute. The player explicitly controls when time advances.
    pub fn advance_to_next_event(&mut self) -> bool {
        let Some(next_due) = self.scheduler.next_due() else {
            return false;
        };
        self.state.now = next_due;
        while let Some(event) = self.scheduler.pop_due(next_due) {
            self.handle_world_event(event.payload);
        }
        true
    }

    pub fn available_actions(&self) -> Vec<PlayerAction> {
        if self.state.is_resolved() {
            return Vec::new();
        }

        let mut actions = match self.state.stage {
            CaseStage::Intake => vec![
                PlayerAction::RunConflictCheck,
                PlayerAction::AcceptMatterImmediately,
            ],
            CaseStage::Investigation => {
                let mut items = vec![
                    PlayerAction::RequestDocuments,
                    PlayerAction::SendDemand,
                    PlayerAction::OfferMediation,
                ];
                if self.has_action(PlayerAction::RequestDocuments) {
                    items.push(PlayerAction::RecoverDeletedMailbox);
                    items.push(PlayerAction::HireIndependentExpert);
                }
                if self.has_action(PlayerAction::RecoverDeletedMailbox) {
                    items.push(PlayerAction::DiscloseAdverseEmails);
                    items.push(PlayerAction::ConcealAdverseEmails);
                }
                items
            }
            CaseStage::PreLitigation => {
                vec![PlayerAction::AcceptSettlement, PlayerAction::Litigate]
            }
            CaseStage::Litigation => vec![PlayerAction::PrepareWitnesses],
            CaseStage::Resolved => Vec::new(),
        };

        if self.mode.allows_internal_ai()
            && self.state.ai_usage.requests_used < self.state.ai_usage.request_limit
        {
            match self.state.stage {
                CaseStage::Intake => actions.push(PlayerAction::AskAiResearch),
                CaseStage::Investigation => actions.push(PlayerAction::AskAiEvidenceReview),
                _ => {}
            }
        }

        actions.sort_by_key(|action| *action as u8);
        actions.dedup();
        actions
    }

    pub fn apply_action(&mut self, action: PlayerAction) -> Result<(), EngineError> {
        if self.state.is_resolved() {
            return Err(EngineError::MatterResolved);
        }
        if !self.available_actions().contains(&action) {
            return Err(EngineError::ActionUnavailable(action));
        }
        if matches!(
            action,
            PlayerAction::AskAiResearch | PlayerAction::AskAiEvidenceReview
        ) {
            self.use_ai(action)?;
        } else {
            self.apply_non_ai_action(action);
        }
        self.state.action_history.push(action);
        self.drain_events_due_now();
        Ok(())
    }

    /// Processes world events that became due while the player was working.
    /// This prevents an eight-hour document review from leaving a 09:05 client
    /// message suspended in the past.
    fn drain_events_due_now(&mut self) {
        while let Some(event) = self.scheduler.pop_due(self.state.now) {
            self.handle_world_event(event.payload);
        }
    }

    fn apply_non_ai_action(&mut self, action: PlayerAction) {
        match action {
            PlayerAction::RunConflictCheck => {
                self.spend(60, 350);
                self.state.reputation.ethical_standing.adjust(2);
                self.state.stage = CaseStage::Investigation;
            }
            PlayerAction::AcceptMatterImmediately => {
                self.state.reputation.client_trust.adjust(3);
                self.state.reputation.ethical_standing.adjust(-5);
                self.state.stage = CaseStage::Investigation;
            }
            PlayerAction::RequestDocuments => {
                self.spend(8 * 60, 2_000);
                self.discover(EvidenceId::ChangeRequests);
                self.discover(EvidenceId::ProjectEmails);
                self.discover(EvidenceId::ConditionalAcceptance);
                self.state.evidence_quality.adjust(16);
                self.state.legal_merits.adjust(-3);
            }
            PlayerAction::SendDemand => {
                self.spend(3 * 60, 900);
                self.state.negotiation_leverage.adjust(4);
                self.state.reputation.client_trust.adjust(2);
                self.schedule_settlement_offer(90);
            }
            PlayerAction::OfferMediation => {
                self.spend(4 * 60, 1_200);
                self.state.negotiation_leverage.adjust(3);
                self.schedule_settlement_offer(60);
            }
            PlayerAction::RecoverDeletedMailbox => {
                self.spend(12 * 60, 5_500);
                self.discover(EvidenceId::DeletedMailbox);
                self.state.evidence_quality.adjust(7);
                self.state.legal_merits.adjust(-8);
            }
            PlayerAction::HireIndependentExpert => {
                self.spend(20 * 60, 12_000);
                self.discover(EvidenceId::IndependentExpertReport);
                self.state.evidence_quality.adjust(14);
                self.state.legal_merits.adjust(8);
                self.state.reputation.judicial_credibility.adjust(3);
            }
            PlayerAction::DiscloseAdverseEmails => {
                self.spend(2 * 60, 600);
                self.disclose(EvidenceId::DeletedMailbox);
                self.state.procedural_position.adjust(6);
                self.state.reputation.ethical_standing.adjust(7);
                self.state.negotiation_leverage.adjust(-4);
            }
            PlayerAction::ConcealAdverseEmails => {
                self.state.negotiation_leverage.adjust(6);
                self.state.reputation.ethical_standing.adjust(-30);
                self.state.procedural_position.adjust(-12);
            }
            PlayerAction::AcceptSettlement => {
                let amount = self.current_settlement_offer();
                self.resolve(CaseOutcome::Settlement { amount_eur: amount });
            }
            PlayerAction::Litigate => {
                self.spend(15 * 60, 7_500);
                self.state.stage = CaseStage::Litigation;
                self.scheduler.schedule(
                    self.state.now.saturating_add_minutes(24 * 60),
                    WorldEvent::Hearing,
                );
            }
            PlayerAction::PrepareWitnesses => {
                self.spend(18 * 60, 8_000);
                self.state.evidence_quality.adjust(7);
                self.state.procedural_position.adjust(4);
                self.resolve_hearing();
            }
            PlayerAction::AskAiResearch | PlayerAction::AskAiEvidenceReview => unreachable!(),
        }
    }

    fn use_ai(&mut self, action: PlayerAction) -> Result<(), EngineError> {
        if !self.mode.allows_internal_ai() {
            return Err(EngineError::AiUnavailable);
        }
        if self.state.ai_usage.requests_used >= self.state.ai_usage.request_limit {
            return Err(EngineError::AiLimitReached);
        }

        let objective = match action {
            PlayerAction::AskAiResearch => "Summarise potentially relevant legal issues",
            PlayerAction::AskAiEvidenceReview => "Identify contradictions in discovered evidence",
            _ => unreachable!(),
        };
        let known_facts = self
            .state
            .evidence
            .iter()
            .filter(|evidence| evidence.discovered)
            .map(|evidence| evidence.title.clone())
            .collect();
        let response = self.ai.respond(
            &ActorPrompt {
                actor: ActorId::AiAssociate,
                objective: objective.to_owned(),
                known_facts,
            },
            &self.state,
        );

        self.spend(2 * 60, 750);
        self.state.ai_usage.requests_used += 1;
        self.state.ai_usage.last_note = Some(response.text);

        // Reliability is resolved by the deterministic engine, not trusted from
        // model prose. This is the anti-cheating and safety boundary.
        if self.rng.roll_percent() < response.confidence_percent {
            self.state.procedural_position.adjust(3);
        } else {
            self.state.procedural_position.adjust(-2);
        }
        Ok(())
    }

    fn handle_world_event(&mut self, event: WorldEvent) {
        match event {
            WorldEvent::InboxMessage {
                from,
                subject,
                body,
            } => {
                self.state
                    .inbox
                    .push(format!("{from:?} — {subject}: {body}"));
            }
            WorldEvent::ClientPressure => {
                self.state.inbox.push(
                    "Client CFO: We need a visible response today. The board is losing patience."
                        .to_owned(),
                );
                self.state.reputation.client_trust.adjust(-2);
            }
            WorldEvent::PartnerReview => {
                self.state.inbox.push(
                    "Partner: Before spending heavily, tell me the merits, evidence gaps, and settlement range."
                        .to_owned(),
                );
                if self.state.evidence_quality.value() < 40 {
                    self.state.reputation.peer_respect.adjust(-2);
                }
            }
            WorldEvent::OpponentSettlementOffer { amount_eur } => {
                self.state.inbox.push(format!(
                    "Opposing counsel offers EUR {amount_eur} without admission of liability."
                ));
                self.state.stage = CaseStage::PreLitigation;
            }
            WorldEvent::DeadlineWarning {
                label,
                minutes_remaining,
            } => self.state.inbox.push(format!(
                "Deadline warning: {label} — {minutes_remaining} minutes remaining."
            )),
            WorldEvent::Hearing => self.resolve_hearing(),
        }
    }

    fn schedule_settlement_offer(&mut self, delay_minutes: u32) {
        let amount = self.current_settlement_offer();
        self.scheduler.schedule(
            self.state.now.saturating_add_minutes(delay_minutes),
            WorldEvent::OpponentSettlementOffer { amount_eur: amount },
        );
    }

    fn current_settlement_offer(&self) -> i64 {
        let base = self.template.opponent_initial_offer_eur;
        let leverage_adjustment = i64::from(self.state.negotiation_leverage.value() - 35) * 1_000;
        (base + leverage_adjustment).clamp(25_000, 150_000)
    }

    fn resolve_hearing(&mut self) {
        if self.state.is_resolved() {
            return;
        }
        let score = self.state.position_score();
        let roll = i16::from(self.rng.roll_percent());
        let client_won = roll < score;
        let (damages_eur, costs_awarded_eur) = if client_won {
            let damages = 90_000 + i64::from(score) * 1_200;
            (damages.min(self.state.claim_value_eur), 18_000)
        } else {
            (0, -18_000)
        };
        self.resolve(CaseOutcome::Judgment {
            client_won,
            damages_eur,
            costs_awarded_eur,
        });
    }

    fn resolve(&mut self, outcome: CaseOutcome) {
        self.state.outcome = Some(outcome);
        self.state.stage = CaseStage::Resolved;
        if self.state.reputation.ethical_standing.value() < 40 {
            self.state.reputation.judicial_credibility.adjust(-12);
            self.state.reputation.peer_respect.adjust(-8);
        }
    }

    fn spend(&mut self, minutes: u32, euros: i64) {
        self.state.billable_minutes += minutes;
        self.state.budget_spent_eur += euros;
        self.state.now = self.state.now.saturating_add_minutes(minutes);
    }

    fn discover(&mut self, id: EvidenceId) {
        if let Some(evidence) = self.state.evidence.iter_mut().find(|item| item.id == id) {
            evidence.discovered = true;
        }
    }

    fn disclose(&mut self, id: EvidenceId) {
        if let Some(evidence) = self.state.evidence.iter_mut().find(|item| item.id == id) {
            evidence.disclosed = true;
        }
    }

    fn has_action(&self, action: PlayerAction) -> bool {
        self.state.action_history.contains(&action)
    }
}

fn initial_actors() -> Vec<Actor> {
    vec![
        Actor {
            id: ActorId::ClientCeo,
            name: "Sophie De Smet".to_owned(),
            role: "Client CEO".to_owned(),
            trust_in_player: Score::new(55),
            pressure: Score::new(70),
        },
        Actor {
            id: ActorId::ClientCfo,
            name: "Marc Vermeulen".to_owned(),
            role: "Client CFO".to_owned(),
            trust_in_player: Score::new(50),
            pressure: Score::new(85),
        },
        Actor {
            id: ActorId::OpposingCounsel,
            name: "Claire Van den Berg".to_owned(),
            role: "Opposing counsel".to_owned(),
            trust_in_player: Score::new(25),
            pressure: Score::new(45),
        },
        Actor {
            id: ActorId::Partner,
            name: "Thomas Lambert".to_owned(),
            role: "Supervising partner".to_owned(),
            trust_in_player: Score::new(50),
            pressure: Score::new(60),
        },
    ]
}

fn initial_evidence() -> Vec<Evidence> {
    vec![
        evidence(
            EvidenceId::SignedContract,
            "Signed implementation agreement",
            true,
            90,
            4,
        ),
        evidence(
            EvidenceId::ChangeRequests,
            "Informal change requests",
            false,
            70,
            -6,
        ),
        evidence(
            EvidenceId::ProjectEmails,
            "Project correspondence",
            false,
            80,
            5,
        ),
        evidence(
            EvidenceId::DeletedMailbox,
            "Recovered deleted mailbox data",
            false,
            85,
            -8,
        ),
        evidence(
            EvidenceId::ConditionalAcceptance,
            "Conditional delivery acceptance",
            false,
            75,
            -4,
        ),
        evidence(
            EvidenceId::IndependentExpertReport,
            "Independent ERP expert report",
            false,
            88,
            9,
        ),
    ]
}

fn evidence(
    id: EvidenceId,
    title: &str,
    discovered: bool,
    reliability: i16,
    merits_effect: i16,
) -> Evidence {
    Evidence {
        id,
        title: title.to_owned(),
        discovered,
        disclosed: false,
        reliability: Score::new(reliability),
        merits_effect,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use juris_ai::ScriptedAiActor;

    fn run_strategy(seed: u64) -> MatterState {
        let mut engine = Engine::new(seed, GameMode::Career, ScriptedAiActor);
        engine.advance_to_next_event();
        engine.apply_action(PlayerAction::RunConflictCheck).unwrap();
        engine.apply_action(PlayerAction::RequestDocuments).unwrap();
        engine
            .apply_action(PlayerAction::HireIndependentExpert)
            .unwrap();
        engine.apply_action(PlayerAction::OfferMediation).unwrap();
        engine.advance_to_next_event();
        engine.apply_action(PlayerAction::Litigate).unwrap();
        engine.apply_action(PlayerAction::PrepareWitnesses).unwrap();
        engine.state().clone()
    }

    #[test]
    fn identical_seed_and_actions_reproduce_the_same_world() {
        assert_eq!(run_strategy(20260724), run_strategy(20260724));
    }

    #[test]
    fn hardcore_mode_exposes_no_internal_ai_actions() {
        let engine = Engine::new(1, GameMode::Hardcore, ScriptedAiActor);
        assert!(!engine.available_actions().iter().any(|action| matches!(
            action,
            PlayerAction::AskAiResearch | PlayerAction::AskAiEvidenceReview
        )));
    }

    #[test]
    fn concealing_adverse_evidence_materially_harms_ethics() {
        let mut engine = Engine::new(1, GameMode::Career, ScriptedAiActor);
        engine.apply_action(PlayerAction::RunConflictCheck).unwrap();
        engine.apply_action(PlayerAction::RequestDocuments).unwrap();
        engine
            .apply_action(PlayerAction::RecoverDeletedMailbox)
            .unwrap();
        let before = engine.state().reputation.ethical_standing.value();
        engine
            .apply_action(PlayerAction::ConcealAdverseEmails)
            .unwrap();
        assert!(engine.state().reputation.ethical_standing.value() <= before - 30);
    }

    #[test]
    fn ai_cannot_reveal_undiscovered_evidence() {
        let mut engine = Engine::new(2, GameMode::Career, ScriptedAiActor);
        engine.apply_action(PlayerAction::AskAiResearch).unwrap();
        let note = engine.state().ai_usage.last_note.as_ref().unwrap();
        assert!(note.contains("1 known facts"));
        assert!(!note.contains("deleted mailbox"));
    }

    #[test]
    fn scheduled_opening_message_arrives_when_time_advances() {
        let mut engine = Engine::new(3, GameMode::Career, ScriptedAiActor);
        assert!(engine.state().inbox.is_empty());
        assert!(engine.advance_to_next_event());
        assert_eq!(engine.state().inbox.len(), 1);
    }
}
