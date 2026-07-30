//! Deterministic event-driven legal simulation engine.
//!
//! # Authority boundary
//!
//! This crate is the only layer allowed to mutate `MatterState`. User
//! interfaces submit typed `PlayerAction` values, content supplies immutable
//! configuration, and AI adapters return advisory text. None of those layers
//! can directly change evidence, deadlines, money, reputation, or outcomes.
//!
//! # Determinism
//!
//! The same engine version, seed, game mode, and ordered player actions must
//! produce the same state. All uncertainty comes from `DeterministicRng`; all
//! delayed consequences pass through the FIFO `Scheduler`.
//!
//! # v0.4 vertical-slice goals
//!
//! The engine now models an active inbox, professional deadlines, limited daily
//! capacity, fatigue, asynchronous delegation, a multi-stage litigation path,
//! and an explainable judgment calculation.

use juris_ai::{ActorPrompt, AiActor};
use juris_content::{failed_erp_template, CaseTemplate};
use juris_core::{DeterministicRng, Scheduler, SimMinute, MINUTES_PER_DAY};
use juris_domain::*;
use thiserror::Error;

mod scenario_runtime;

pub use scenario_runtime::{
    MobileActionSnapshot, MobileDeadlineSnapshot, MobileEvidenceSnapshot, MobileFactSnapshot,
    MobileInboxSnapshot, MobileOutcomeSnapshot, MobileScenarioSnapshot, ScenarioCommand,
    ScenarioRuntimeError, ScenarioSaveEnvelope, ScenarioSaveError, ScenarioSession,
    ScenarioSessionId, ScenarioSessionRegistry, SAVE_SCHEMA_ID, SAVE_SCHEMA_VERSION,
};

/// Errors returned when a presentation layer submits an invalid intention.
#[derive(Debug, Error, PartialEq, Eq)]
pub enum EngineError {
    #[error("the matter is already resolved")]
    MatterResolved,
    #[error("action {0:?} is not currently available")]
    ActionUnavailable(PlayerAction),
    #[error("the internal AI associate is unavailable in this mode")]
    AiUnavailable,
    #[error("the internal AI request limit has been reached")]
    AiLimitReached,
}

/// Authoritative runtime for one legal matter.
///
/// The generic AI adapter is owned by the engine. Ownership keeps the adapter's
/// lifecycle explicit and avoids global state. `state()` exposes only an
/// immutable borrow, so callers cannot bypass action validation.
pub struct Engine<A: AiActor> {
    seed: u64,
    mode: GameMode,
    rng: DeterministicRng,
    scheduler: Scheduler<WorldEvent>,
    ai: A,
    state: MatterState,
    template: CaseTemplate,
    next_message_id: u64,
}

impl<A: AiActor> Engine<A> {
    /// Creates the first ERP dispute and schedules its opening world events.
    pub fn new(seed: u64, mode: GameMode, ai: A) -> Self {
        let template = failed_erp_template();
        let start = SimMinute::START_OF_DAY;
        let partner_due =
            start.saturating_add_minutes(template.partner_brief_due_minutes_from_start);
        let preservation_due =
            start.saturating_add_minutes(template.preservation_due_minutes_from_start);

        let deadlines = vec![
            Deadline {
                id: DeadlineId::PartnerBrief,
                label: "Partner risk brief".to_owned(),
                due: partner_due,
                status: DeadlineStatus::Open,
            },
            Deadline {
                id: DeadlineId::PreservationNotice,
                label: "Evidence-preservation notice".to_owned(),
                due: preservation_due,
                status: DeadlineStatus::Open,
            },
        ];

        let mut scheduler = Scheduler::default();
        scheduler.schedule(
            start,
            WorldEvent::InboxMessage {
                from: ActorId::ClientCeo,
                kind: InboxMessageKind::OpeningClientRequest,
                subject: template.opening_subject.clone(),
                body: template.opening_message.clone(),
                requires_response: true,
            },
        );
        scheduler.schedule(start.saturating_add_minutes(65), WorldEvent::ClientPressure);
        scheduler.schedule(start.saturating_add_minutes(180), WorldEvent::PartnerReview);
        for deadline in &deadlines {
            schedule_deadline_events(&mut scheduler, deadline);
        }

        let state = MatterState {
            title: template.title.clone(),
            claim_value_eur: template.claim_value_eur,
            now: start,
            stage: CaseStage::Intake,
            legal_merits: Score::new(52),
            evidence_quality: Score::new(28),
            procedural_position: Score::new(55),
            negotiation_leverage: Score::new(35),
            hearing_preparation: Score::new(20),
            budget_spent_eur: 0,
            billable_minutes: 0,
            reputation: Reputation::default(),
            work: WorkState {
                tracked_day: start.day(),
                minutes_worked_today: 0,
                daily_capacity_minutes: 9 * 60,
                fatigue: Score::new(5),
                cumulative_strain: Score::new(0),
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
                hearing_attendance_deadline: None,
            },
            actors: initial_actors(),
            evidence: initial_evidence(),
            deadlines,
            action_history: Vec::new(),
            ai_usage: AiUsage {
                requests_used: 0,
                request_limit: if mode == GameMode::Assisted { 5 } else { 2 },
                last_note: None,
            },
            inbox: Vec::new(),
            settlement_offer: None,
            authorized_budget_eur: 25_000,
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
            next_message_id: 1,
        }
    }

    /// Seed used for this replayable run.
    pub fn seed(&self) -> u64 {
        self.seed
    }

    /// Active ruleset.
    pub fn mode(&self) -> GameMode {
        self.mode
    }

    /// Immutable view of authoritative matter state.
    pub fn state(&self) -> &MatterState {
        &self.state
    }

    /// Optional real-world timer for Hardcore and Tournament presentation.
    pub fn decision_seconds(&self) -> Option<u32> {
        self.mode.decision_seconds()
    }

    /// Advances to the next scheduled event and processes every event due up to
    /// that minute. Returning `false` means no future world events remain.
    pub fn advance_to_next_event(&mut self) -> bool {
        let Some(next_due) = self.scheduler.next_due() else {
            return false;
        };
        if next_due > self.state.now {
            self.state.now = next_due;
            self.sync_workday_counter();
        }
        self.drain_events_due_now();
        self.refresh_stage();
        true
    }

    /// Returns typed actions currently accepted by the engine.
    pub fn available_actions(&self) -> Vec<PlayerAction> {
        if self.state.is_resolved() {
            return Vec::new();
        }

        let mut actions = Vec::new();

        if self.state.stage == CaseStage::Intake {
            actions.extend([
                PlayerAction::RunConflictCheck,
                PlayerAction::AcceptMatterImmediately,
            ]);
            self.add_ai_action_if_available(&mut actions, PlayerAction::AskAiResearch);
            actions.sort();
            actions.dedup();
            return actions;
        }

        self.add_inbox_response_actions(&mut actions);
        self.add_deadline_actions(&mut actions);

        if self.active_settlement_offer().is_some() {
            actions.push(PlayerAction::AcceptSettlement);
        }

        if self.state.budget_spent_eur >= self.state.authorized_budget_eur.saturating_sub(5_000)
            && self.state.authorized_budget_eur < 100_000
        {
            actions.push(PlayerAction::RequestBudgetApproval);
        }

        match self.state.stage {
            CaseStage::Intake | CaseStage::Resolved => {}
            CaseStage::Investigation => self.add_investigation_actions(&mut actions),
            CaseStage::PreLitigation => {
                self.add_investigation_actions(&mut actions);
                actions.push(PlayerAction::Litigate);
                self.add_ai_action_if_available(&mut actions, PlayerAction::AskAiDamagesModel);
            }
            CaseStage::Pleadings => self.add_pleadings_actions(&mut actions),
            CaseStage::Disclosure => self.add_disclosure_actions(&mut actions),
            CaseStage::ExpertEvidence => self.add_expert_actions(&mut actions),
            CaseStage::HearingPreparation => self.add_hearing_preparation_actions(&mut actions),
            CaseStage::Hearing => {
                // Once the hearing is in session, the player must attend within
                // the attendance window or accept a still-live settlement.
                // Preparation and rest are no longer lawful escape routes.
                actions.push(PlayerAction::AttendHearing);
            }
        }

        // Rest is available only when it cannot jump over a mandatory hearing.
        // Other deadlines may still be missed deliberately; the hearing itself
        // is a hard appointment with a default-loss consequence.
        if self.can_rest_safely() {
            actions.push(PlayerAction::RestUntilNextWorkday);
        }
        actions.retain(|action| self.action_within_authorized_budget(*action));
        actions.sort();
        actions.dedup();
        actions
    }

    /// Returns presentation metadata for all currently valid actions.
    pub fn available_options(&self) -> Vec<ActionOption> {
        self.available_actions()
            .into_iter()
            .map(action_option)
            .collect()
    }

    /// Validates and applies one player intention.
    pub fn apply_action(&mut self, action: PlayerAction) -> Result<(), EngineError> {
        if self.state.is_resolved() {
            return Err(EngineError::MatterResolved);
        }
        if !self.available_actions().contains(&action) {
            return Err(EngineError::ActionUnavailable(action));
        }

        if is_ai_action(action) {
            self.use_ai(action)?;
        } else {
            self.apply_non_ai_action(action);
        }

        self.state.action_history.push(action);
        self.drain_events_due_now();
        self.refresh_stage();
        Ok(())
    }

    fn add_inbox_response_actions(&self, actions: &mut Vec<PlayerAction>) {
        if self.has_unhandled_message(InboxMessageKind::OpeningClientRequest) {
            actions.push(PlayerAction::ReplyToClient);
        }
        if self.has_unhandled_message(InboxMessageKind::ClientPressure) {
            actions.push(PlayerAction::ReplyToCfo);
        }
        if self.has_unhandled_message(InboxMessageKind::PartnerBriefRequest) {
            actions.push(PlayerAction::SendPartnerBrief);
        }
        if self.has_unhandled_message(InboxMessageKind::JuniorReport) {
            actions.push(PlayerAction::ReviewJuniorReport);
        }
        if self.has_unhandled_message(InboxMessageKind::ExpertReport) {
            actions.push(PlayerAction::ReviewExpertReport);
        }
        if self.has_unhandled_message(InboxMessageKind::OpponentDisclosure) {
            actions.push(PlayerAction::ReviewOpponentDisclosure);
        }
    }

    fn add_deadline_actions(&self, actions: &mut Vec<PlayerAction>) {
        if self.deadline_is_open(DeadlineId::PreservationNotice)
            && !self.has_action(PlayerAction::IssuePreservationNotice)
        {
            actions.push(PlayerAction::IssuePreservationNotice);
        }
    }

    fn add_investigation_actions(&self, actions: &mut Vec<PlayerAction>) {
        if !self.documents_reviewed()
            && self.state.delegation.in_progress.is_none()
            && self.state.delegation.completed.is_none()
        {
            actions.push(PlayerAction::RequestDocuments);
            actions.push(PlayerAction::DelegateDocumentReview);
        }

        if self.documents_reviewed() {
            if !self.has_action(PlayerAction::RecoverDeletedMailbox) {
                actions.push(PlayerAction::RecoverDeletedMailbox);
            }
            self.add_expert_actions(actions);
            self.add_ai_action_if_available(actions, PlayerAction::AskAiEvidenceReview);
        }

        if self.evidence_is_discovered(EvidenceId::DeletedMailbox)
            && !self.adverse_email_decision_made()
        {
            actions.push(PlayerAction::DiscloseAdverseEmails);
            actions.push(PlayerAction::ConcealAdverseEmails);
        }

        if !self.has_action(PlayerAction::SendDemand) {
            actions.push(PlayerAction::SendDemand);
        }
        if !self.has_action(PlayerAction::OfferMediation) {
            actions.push(PlayerAction::OfferMediation);
        }
        self.add_ai_action_if_available(actions, PlayerAction::AskAiResearch);
    }

    fn add_pleadings_actions(&self, actions: &mut Vec<PlayerAction>) {
        if !self.state.litigation.statement_drafted {
            actions.push(PlayerAction::DraftStatementOfClaim);
        } else if !self.state.litigation.statement_filed {
            actions.push(PlayerAction::FileStatementOfClaim);
            self.add_ai_action_if_available(actions, PlayerAction::AskAiDraftReview);
        }
        self.add_ai_action_if_available(actions, PlayerAction::AskAiDamagesModel);
        self.add_expert_actions(actions);
    }

    fn add_disclosure_actions(&self, actions: &mut Vec<PlayerAction>) {
        if !self.state.litigation.disclosure_served && self.disclosure_choice_resolved() {
            actions.push(PlayerAction::ServeDisclosure);
        }
        self.add_expert_actions(actions);
        self.add_ai_action_if_available(actions, PlayerAction::AskAiEvidenceReview);
        self.add_ai_action_if_available(actions, PlayerAction::AskAiDamagesModel);
    }

    fn add_expert_actions(&self, actions: &mut Vec<PlayerAction>) {
        if !self.state.litigation.expert_commissioned
            && !self.state.litigation.proceeded_without_expert
        {
            actions.push(PlayerAction::CommissionIndependentExpert);
            if matches!(
                self.state.stage,
                CaseStage::Disclosure | CaseStage::ExpertEvidence
            ) {
                actions.push(PlayerAction::ProceedWithoutExpert);
            }
        }
        if self.state.litigation.expert_report_ready
            && !self.state.litigation.expert_report_reviewed
        {
            actions.push(PlayerAction::ReviewExpertReport);
        }
    }

    fn add_hearing_preparation_actions(&self, actions: &mut Vec<PlayerAction>) {
        if !self.state.litigation.witnesses_prepared {
            actions.push(PlayerAction::PrepareWitnesses);
        } else if !self.state.litigation.hearing_rehearsed {
            actions.push(PlayerAction::RehearseHearing);
        }
        self.add_ai_action_if_available(actions, PlayerAction::AskAiHearingPreparation);
    }

    fn add_ai_action_if_available(&self, actions: &mut Vec<PlayerAction>, action: PlayerAction) {
        if self.mode.allows_internal_ai()
            && self.state.ai_usage.requests_used < self.state.ai_usage.request_limit
            && !self.has_action(action)
        {
            actions.push(action);
        }
    }

    fn apply_non_ai_action(&mut self, action: PlayerAction) {
        let quality_penalty = self.current_quality_penalty();
        match action {
            PlayerAction::RunConflictCheck => {
                self.spend(60, 350);
                self.state.reputation.ethical_standing.adjust(2);
                self.state.stage = CaseStage::Investigation;
            }
            PlayerAction::AcceptMatterImmediately => {
                self.mark_message_handled(InboxMessageKind::OpeningClientRequest);
                self.state.reputation.client_trust.adjust(3);
                self.state.reputation.ethical_standing.adjust(-5);
                self.state.stage = CaseStage::Investigation;
            }
            PlayerAction::ReplyToClient => {
                self.spend(30, 250);
                self.mark_message_handled(InboxMessageKind::OpeningClientRequest);
                self.state.reputation.client_trust.adjust(4);
            }
            PlayerAction::ReplyToCfo => {
                self.spend(30, 250);
                self.mark_message_handled(InboxMessageKind::ClientPressure);
                self.state.reputation.client_trust.adjust(3);
            }
            PlayerAction::SendPartnerBrief => {
                self.spend(90, 750);
                self.mark_message_handled(InboxMessageKind::PartnerBriefRequest);
                self.complete_deadline(DeadlineId::PartnerBrief);
                let respect_gain = if self.state.evidence_quality.value() >= 40 {
                    4
                } else {
                    1
                };
                self.state.reputation.peer_respect.adjust(respect_gain);
            }
            PlayerAction::IssuePreservationNotice => {
                self.spend(60, 500);
                self.complete_deadline(DeadlineId::PreservationNotice);
                self.state.procedural_position.adjust(5);
                self.state.reputation.ethical_standing.adjust(3);
            }
            PlayerAction::RequestDocuments => {
                self.spend(6 * 60, 2_000);
                self.apply_document_review(16, quality_penalty);
            }
            PlayerAction::DelegateDocumentReview => {
                self.spend(30, 2_000);
                self.state.delegation.in_progress = Some(DelegatedTask::DocumentReview);
                self.scheduler.schedule(
                    self.state
                        .now
                        .saturating_add_minutes(self.template.junior_review_turnaround_minutes),
                    WorldEvent::JuniorTaskCompleted {
                        task: DelegatedTask::DocumentReview,
                    },
                );
            }
            PlayerAction::ReviewJuniorReport => {
                self.spend(90, 1_000);
                self.mark_message_handled(InboxMessageKind::JuniorReport);
                self.state.delegation.completed = None;
                self.state.delegation.reports_reviewed =
                    self.state.delegation.reports_reviewed.saturating_add(1);
                self.apply_document_review(12, quality_penalty);
            }
            PlayerAction::RecoverDeletedMailbox => {
                self.spend(6 * 60, 5_500);
                self.discover(EvidenceId::DeletedMailbox);
                self.state.evidence_quality.adjust(7 - quality_penalty);
                self.state.legal_merits.adjust(-8);
            }
            PlayerAction::DiscloseAdverseEmails => {
                self.spend(60, 600);
                self.disclose(EvidenceId::DeletedMailbox);
                self.state.procedural_position.adjust(6);
                self.state.reputation.ethical_standing.adjust(7);
                self.state.negotiation_leverage.adjust(-4);
            }
            PlayerAction::ConcealAdverseEmails => {
                self.spend(30, 250);
                self.state.negotiation_leverage.adjust(6);
                self.state.reputation.ethical_standing.adjust(-30);
                self.state.procedural_position.adjust(-12);
            }
            PlayerAction::CommissionIndependentExpert => {
                self.spend(60, 12_000);
                self.state.litigation.expert_commissioned = true;
                self.scheduler.schedule(
                    self.state
                        .now
                        .saturating_add_minutes(self.template.expert_turnaround_minutes),
                    WorldEvent::ExpertReportCompleted,
                );
            }
            PlayerAction::ReviewExpertReport => {
                self.spend(120, 2_000);
                self.mark_message_handled(InboxMessageKind::ExpertReport);
                self.state.litigation.expert_report_reviewed = true;
                self.discover(EvidenceId::IndependentExpertReport);
                self.state.evidence_quality.adjust(14 - quality_penalty);
                self.state.legal_merits.adjust(8 - quality_penalty);
                self.state.reputation.judicial_credibility.adjust(3);
                self.schedule_revised_settlement_offer(60);
            }
            PlayerAction::SendDemand => {
                self.spend(180, 900);
                self.state.negotiation_leverage.adjust(4 - quality_penalty);
                self.state.reputation.client_trust.adjust(2);
                self.schedule_settlement_offer(90);
            }
            PlayerAction::OfferMediation => {
                self.spend(120, 1_200);
                if self.documents_reviewed() {
                    self.state.negotiation_leverage.adjust(3 - quality_penalty);
                } else {
                    self.state.negotiation_leverage.adjust(-1);
                    self.state.reputation.client_trust.adjust(-2);
                }
                self.schedule_settlement_offer(60);
            }
            PlayerAction::AcceptSettlement => {
                self.mark_message_handled(InboxMessageKind::SettlementOffer);
                let amount = self
                    .active_settlement_offer()
                    .map(|offer| offer.amount_eur)
                    .expect("validated settlement action requires a live offer");
                self.resolve(CaseOutcome::Settlement {
                    amount_eur: amount,
                    net_after_legal_spend_eur: amount - self.state.budget_spent_eur,
                });
            }
            PlayerAction::Litigate => {
                self.spend(120, 2_500);
                self.mark_message_handled(InboxMessageKind::SettlementOffer);
                self.state.stage = CaseStage::Pleadings;
                let due = SimMinute::START_OF_DAY
                    .saturating_add_minutes(self.template.claim_due_minutes_from_start);
                self.add_deadline(DeadlineId::StatementOfClaim, "File statement of claim", due);
            }
            PlayerAction::DraftStatementOfClaim => {
                self.spend(240, 4_000);
                self.state.litigation.statement_drafted = true;
                self.state.procedural_position.adjust(5 - quality_penalty);
            }
            PlayerAction::FileStatementOfClaim => {
                self.spend(60, 1_000);
                self.state.litigation.statement_filed = true;
                self.complete_deadline(DeadlineId::StatementOfClaim);
                self.state.stage = CaseStage::Disclosure;

                let disclosure_due = self
                    .state
                    .now
                    .saturating_add_minutes(self.template.opponent_disclosure_turnaround_minutes);
                self.scheduler
                    .schedule(disclosure_due, WorldEvent::OpponentDisclosureReceived);

                let hearing_due = self
                    .state
                    .now
                    .saturating_add_minutes(self.template.hearing_delay_minutes_from_filing);
                self.state.litigation.hearing_scheduled_for = Some(hearing_due);
                self.state.litigation.hearing_attendance_deadline =
                    Some(hearing_due.saturating_add_minutes(120));
                self.scheduler.schedule(
                    self.state.now,
                    WorldEvent::InboxMessage {
                        from: ActorId::CourtRegistry,
                        kind: InboxMessageKind::CourtNotice,
                        subject: "Hearing date fixed".to_owned(),
                        body: format_sim_time("The court fixed the hearing for", hearing_due),
                        requires_response: false,
                    },
                );
                self.scheduler
                    .schedule(hearing_due, WorldEvent::HearingReady);
                self.scheduler.schedule(
                    hearing_due.saturating_add_minutes(120),
                    WorldEvent::HearingMissed,
                );
            }
            PlayerAction::ServeDisclosure => {
                self.spend(180, 2_500);
                self.state.litigation.disclosure_served = true;
                self.state.procedural_position.adjust(4 - quality_penalty);
                for evidence in &mut self.state.evidence {
                    if evidence.discovered && evidence.id != EvidenceId::DeletedMailbox {
                        evidence.disclosed = true;
                    }
                }
            }
            PlayerAction::ReviewOpponentDisclosure => {
                self.spend(180, 2_500);
                self.mark_message_handled(InboxMessageKind::OpponentDisclosure);
                self.state.litigation.opponent_disclosure_reviewed = true;
                self.discover(EvidenceId::OpponentProjectLog);
                self.state.evidence_quality.adjust(10 - quality_penalty);
                self.state.legal_merits.adjust(5 - quality_penalty);
                self.schedule_revised_settlement_offer(60);
            }
            PlayerAction::ProceedWithoutExpert => {
                self.spend(30, 0);
                self.state.litigation.proceeded_without_expert = true;
                self.state.reputation.peer_respect.adjust(-2);
            }
            PlayerAction::PrepareWitnesses => {
                self.spend(240, 8_000);
                self.state.litigation.witnesses_prepared = true;
                self.state.hearing_preparation.adjust(18 - quality_penalty);
            }
            PlayerAction::RehearseHearing => {
                self.spend(180, 4_000);
                self.state.litigation.hearing_rehearsed = true;
                self.state.hearing_preparation.adjust(12 - quality_penalty);
            }
            PlayerAction::AttendHearing => {
                self.spend(180, 6_000);
                self.resolve_all_messages(InboxMessageKind::CourtNotice);
                self.resolve_hearing();
            }
            PlayerAction::RequestBudgetApproval => {
                self.spend(30, 250);
                self.state.authorized_budget_eur =
                    self.state.authorized_budget_eur.saturating_add(25_000);
                self.state.reputation.client_trust.adjust(-1);
                self.push_message(
                    self.state.now,
                    ActorId::ClientCfo,
                    InboxMessageKind::BudgetApproval,
                    "Additional litigation budget approved".to_owned(),
                    format!(
                        "The client approved a revised budget ceiling of EUR {}. Further overruns require another approval.",
                        self.state.authorized_budget_eur
                    ),
                    false,
                );
            }
            PlayerAction::RestUntilNextWorkday => self.rest_until_next_workday(),
            PlayerAction::AskAiResearch
            | PlayerAction::AskAiEvidenceReview
            | PlayerAction::AskAiDamagesModel
            | PlayerAction::AskAiDraftReview
            | PlayerAction::AskAiHearingPreparation => {
                unreachable!("AI actions are routed through use_ai")
            }
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
            PlayerAction::AskAiResearch => {
                "Summarize potentially relevant Belgian commercial-law issues."
            }
            PlayerAction::AskAiEvidenceReview => {
                "Identify contradictions and missing links in the discovered evidence."
            }
            PlayerAction::AskAiDamagesModel => {
                "Estimate a settlement range using only known facts."
            }
            PlayerAction::AskAiDraftReview => {
                "Review the statement of claim for structure and unsupported assertions."
            }
            PlayerAction::AskAiHearingPreparation => {
                "Generate likely judicial questions and weaknesses to rehearse."
            }
            _ => unreachable!("only AI actions reach use_ai"),
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
                stage: self.state.stage,
            },
            &self.state,
        );
        let confidence = response.confidence_percent;

        self.spend(90, 750);
        self.state.ai_usage.requests_used = self.state.ai_usage.requests_used.saturating_add(1);

        // Reliability is resolved by the seeded engine, never trusted from the
        // generated prose. This is both a safety boundary and an anti-cheating
        // mechanic: an eloquent answer may still require professional checking.
        let reliable = self.rng.roll_percent() < confidence;
        let reliability_note = if reliable {
            "Engine verification: the advisory result was mechanically reliable."
        } else {
            "Engine verification: the advisory result contained an unreliable inference and requires correction."
        };
        self.state.ai_usage.last_note = Some(format!("{} {}", response.text, reliability_note));
        match (action, reliable) {
            (PlayerAction::AskAiResearch, true) => self.state.procedural_position.adjust(3),
            (PlayerAction::AskAiResearch, false) => self.state.procedural_position.adjust(-2),
            (PlayerAction::AskAiEvidenceReview, true) => self.state.evidence_quality.adjust(4),
            (PlayerAction::AskAiEvidenceReview, false) => self.state.evidence_quality.adjust(-2),
            (PlayerAction::AskAiDamagesModel, true) => self.state.negotiation_leverage.adjust(4),
            (PlayerAction::AskAiDamagesModel, false) => self.state.negotiation_leverage.adjust(-2),
            (PlayerAction::AskAiDraftReview, true) => self.state.procedural_position.adjust(5),
            (PlayerAction::AskAiDraftReview, false) => self.state.procedural_position.adjust(-3),
            (PlayerAction::AskAiHearingPreparation, true) => {
                self.state.hearing_preparation.adjust(6)
            }
            (PlayerAction::AskAiHearingPreparation, false) => {
                self.state.hearing_preparation.adjust(-3)
            }
            _ => unreachable!("all AI actions are covered"),
        }
        if action == PlayerAction::AskAiDamagesModel {
            self.schedule_revised_settlement_offer(30);
        }
        Ok(())
    }

    /// Processes every event whose due minute is at or before the current time.
    ///
    /// Long actions may cross several due times. Draining after the action keeps
    /// all consequences while preserving the design choice that the player is
    /// not interrupted mid-action in this prototype.
    fn drain_events_due_now(&mut self) {
        while let Some(event) = self.scheduler.pop_due(self.state.now) {
            self.handle_world_event(event.payload, event.due);
        }
    }

    fn handle_world_event(&mut self, event: WorldEvent, occurred_at: SimMinute) {
        match event {
            WorldEvent::InboxMessage {
                from,
                kind,
                subject,
                body,
                requires_response,
            } => self.push_message(occurred_at, from, kind, subject, body, requires_response),
            WorldEvent::ClientPressure => {
                self.push_message(
                    occurred_at,
                    ActorId::ClientCfo,
                    InboxMessageKind::ClientPressure,
                    "Board expects visible action".to_owned(),
                    "We need a visible response today. The board is losing patience.".to_owned(),
                    true,
                );
                self.state.reputation.client_trust.adjust(-2);
            }
            WorldEvent::PartnerReview => {
                self.push_message(
                    occurred_at,
                    ActorId::Partner,
                    InboxMessageKind::PartnerBriefRequest,
                    "Risk brief required by 15:00".to_owned(),
                    "Before spending heavily, send me the merits, evidence gaps, budget, and settlement range."
                        .to_owned(),
                    true,
                );
                if self.state.evidence_quality.value() < 40 {
                    self.state.reputation.peer_respect.adjust(-2);
                }
            }
            WorldEvent::OpponentSettlementOffer {
                amount_eur,
                expires_at,
                revision,
            } => {
                // A newer commercial proposal supersedes any earlier open one.
                self.resolve_all_messages(InboxMessageKind::SettlementOffer);
                self.state.settlement_offer = Some(SettlementOffer {
                    amount_eur,
                    made_at: occurred_at,
                    expires_at,
                    revision,
                });
                self.push_message(
                    occurred_at,
                    ActorId::OpposingCounsel,
                    InboxMessageKind::SettlementOffer,
                    format!("Without-prejudice settlement offer — revision {revision}"),
                    format!(
                        "Opposing counsel offers EUR {amount_eur} without admission of liability. The offer expires {}.",
                        format_sim_time("at", expires_at)
                    ),
                    true,
                );
                if self.state.stage == CaseStage::Investigation {
                    self.state.stage = CaseStage::PreLitigation;
                }
            }
            WorldEvent::SettlementOfferExpired { revision } => {
                let should_expire = self
                    .state
                    .settlement_offer
                    .as_ref()
                    .is_some_and(|offer| offer.revision == revision);
                if should_expire {
                    self.state.settlement_offer = None;
                    self.resolve_all_messages(InboxMessageKind::SettlementOffer);
                    self.push_message(
                        occurred_at,
                        ActorId::OpposingCounsel,
                        InboxMessageKind::General,
                        "Settlement offer expired".to_owned(),
                        "The without-prejudice proposal is no longer available.".to_owned(),
                        false,
                    );
                }
            }
            WorldEvent::DeadlineWarning {
                deadline_id,
                minutes_remaining,
            } => {
                if self.deadline_is_open(deadline_id) {
                    let label = self.deadline_label(deadline_id);
                    self.push_message(
                        occurred_at,
                        ActorId::Partner,
                        InboxMessageKind::DeadlineWarning,
                        format!("Deadline warning: {label}"),
                        format!("{minutes_remaining} simulation minutes remain."),
                        false,
                    );
                }
            }
            WorldEvent::DeadlineReached { deadline_id } => {
                self.miss_deadline_if_open(deadline_id, occurred_at)
            }
            WorldEvent::JuniorTaskCompleted { task } => {
                self.state.delegation.in_progress = None;
                self.state.delegation.completed = Some(task);
                self.push_message(
                    occurred_at,
                    ActorId::JuniorAssociate,
                    InboxMessageKind::JuniorReport,
                    "Junior document review completed".to_owned(),
                    "The junior flagged change requests, acceptance wording, and contradictory project emails. Review is required before relying on the findings."
                        .to_owned(),
                    true,
                );
            }
            WorldEvent::ExpertReportCompleted => {
                self.state.litigation.expert_report_ready = true;
                self.push_message(
                    occurred_at,
                    ActorId::JuniorAssociate,
                    InboxMessageKind::ExpertReport,
                    "Independent ERP expert report received".to_owned(),
                    "The report is available. It must be reviewed before its findings affect the case position."
                        .to_owned(),
                    true,
                );
            }
            WorldEvent::OpponentDisclosureReceived => {
                self.state.litigation.opponent_disclosure_received = true;
                self.push_message(
                    occurred_at,
                    ActorId::OpposingCounsel,
                    InboxMessageKind::OpponentDisclosure,
                    "Opponent disclosure received".to_owned(),
                    "The production contains a project log and internal escalation records."
                        .to_owned(),
                    true,
                );
            }
            WorldEvent::HearingReady => {
                if !self.state.is_resolved() {
                    self.state.stage = CaseStage::Hearing;
                    self.resolve_all_messages(InboxMessageKind::CourtNotice);
                    self.schedule_revised_settlement_offer(0);
                    self.push_message(
                        occurred_at,
                        ActorId::CourtRegistry,
                        InboxMessageKind::CourtNotice,
                        "Hearing now in session".to_owned(),
                        "The court is ready. Attendance is mandatory within the two-hour hearing window."
                            .to_owned(),
                        true,
                    );
                }
            }
            WorldEvent::HearingMissed => {
                if !self.state.is_resolved() && self.state.stage == CaseStage::Hearing {
                    self.state.procedural_position.adjust(-40);
                    self.state.reputation.judicial_credibility.adjust(-20);
                    self.resolve(CaseOutcome::Judgment {
                        client_won: false,
                        damages_eur: 0,
                        costs_awarded_eur: -25_000,
                        breakdown: JudgmentBreakdown {
                            base_position: self.state.position_score(),
                            factors: vec![OutcomeFactor {
                                label: "Mandatory hearing missed".to_owned(),
                                modifier: -95,
                            }],
                            win_threshold: 5,
                            deterministic_roll: 100,
                        },
                    });
                }
            }
        }
    }

    fn push_message(
        &mut self,
        received_at: SimMinute,
        from: ActorId,
        kind: InboxMessageKind,
        subject: String,
        body: String,
        requires_response: bool,
    ) {
        let id = MessageId(self.next_message_id);
        self.next_message_id = self.next_message_id.saturating_add(1);
        self.state.inbox.push(InboxMessage {
            id,
            received_at,
            from,
            kind,
            subject,
            body,
            requires_response,
            status: if requires_response {
                InboxStatus::ActionRequired
            } else {
                InboxStatus::Unread
            },
        });
    }

    fn mark_message_handled(&mut self, kind: InboxMessageKind) {
        if let Some(message) = self.state.inbox.iter_mut().find(|message| {
            message.kind == kind
                && matches!(
                    message.status,
                    InboxStatus::Unread | InboxStatus::ActionRequired
                )
        }) {
            message.status = InboxStatus::Resolved;
        }
    }

    fn resolve_all_messages(&mut self, kind: InboxMessageKind) {
        for message in self
            .state
            .inbox
            .iter_mut()
            .filter(|message| message.kind == kind)
        {
            if message.status != InboxStatus::Archived {
                message.status = InboxStatus::Resolved;
            }
        }
    }

    fn has_unhandled_message(&self, kind: InboxMessageKind) -> bool {
        self.state.inbox.iter().any(|message| {
            message.kind == kind
                && matches!(
                    message.status,
                    InboxStatus::Unread | InboxStatus::ActionRequired
                )
        })
    }

    fn add_deadline(&mut self, id: DeadlineId, label: &str, due: SimMinute) {
        if self
            .state
            .deadlines
            .iter()
            .any(|deadline| deadline.id == id)
        {
            return;
        }
        let deadline = Deadline {
            id,
            label: label.to_owned(),
            due,
            status: DeadlineStatus::Open,
        };
        schedule_deadline_events(&mut self.scheduler, &deadline);
        self.state.deadlines.push(deadline);
    }

    fn complete_deadline(&mut self, id: DeadlineId) {
        if let Some(deadline) = self
            .state
            .deadlines
            .iter_mut()
            .find(|deadline| deadline.id == id)
        {
            if deadline.status == DeadlineStatus::Open {
                deadline.status = DeadlineStatus::Completed;
            }
        }
    }

    fn miss_deadline_if_open(&mut self, id: DeadlineId, occurred_at: SimMinute) {
        let Some(deadline) = self
            .state
            .deadlines
            .iter_mut()
            .find(|deadline| deadline.id == id)
        else {
            return;
        };
        if deadline.status != DeadlineStatus::Open {
            return;
        }
        deadline.status = DeadlineStatus::Missed;
        let label = deadline.label.clone();

        match id {
            DeadlineId::PartnerBrief => {
                self.state.reputation.peer_respect.adjust(-8);
                self.state.reputation.client_trust.adjust(-3);
            }
            DeadlineId::PreservationNotice => {
                self.state.procedural_position.adjust(-15);
                self.state.reputation.ethical_standing.adjust(-10);
            }
            DeadlineId::StatementOfClaim => {
                self.state.procedural_position.adjust(-25);
                self.state.reputation.judicial_credibility.adjust(-8);
            }
        }

        self.push_message(
            occurred_at,
            ActorId::Partner,
            InboxMessageKind::DeadlineMissed,
            format!("Deadline missed: {label}"),
            "The missed deadline has immediate professional and procedural consequences."
                .to_owned(),
            false,
        );
    }

    fn deadline_is_open(&self, id: DeadlineId) -> bool {
        self.state
            .deadlines
            .iter()
            .any(|deadline| deadline.id == id && deadline.status == DeadlineStatus::Open)
    }

    fn deadline_label(&self, id: DeadlineId) -> String {
        self.state
            .deadlines
            .iter()
            .find(|deadline| deadline.id == id)
            .map(|deadline| deadline.label.clone())
            .unwrap_or_else(|| format!("{id:?}"))
    }

    fn schedule_settlement_offer(&mut self, delay_minutes: u32) {
        self.schedule_revised_settlement_offer(delay_minutes);
    }

    fn schedule_revised_settlement_offer(&mut self, delay_minutes: u32) {
        let revision = self
            .state
            .settlement_offer
            .as_ref()
            .map_or(1, |offer| offer.revision.saturating_add(1));
        let amount = self.calculated_settlement_offer();
        let made_at = self.state.now.saturating_add_minutes(delay_minutes);
        let expires_at = made_at.saturating_add_minutes(12 * 60);
        self.scheduler.schedule(
            made_at,
            WorldEvent::OpponentSettlementOffer {
                amount_eur: amount,
                expires_at,
                revision,
            },
        );
        self.scheduler
            .schedule(expires_at, WorldEvent::SettlementOfferExpired { revision });
    }

    fn calculated_settlement_offer(&self) -> i64 {
        let leverage_delta = i64::from(self.state.negotiation_leverage.value() - 35);
        let position_delta = i64::from(self.state.position_score() - 45);
        let litigation_premium = if self.state.litigation.statement_filed {
            18_000
        } else {
            0
        };
        let expert_premium = if self.state.litigation.expert_report_reviewed {
            25_000
        } else {
            0
        };
        let disclosure_premium = if self.state.litigation.opponent_disclosure_reviewed {
            30_000
        } else {
            0
        };
        let concealment_discount = if self.has_action(PlayerAction::ConcealAdverseEmails) {
            35_000
        } else {
            0
        };

        (self.template.opponent_initial_offer_eur
            + leverage_delta * 1_000
            + position_delta * 900
            + litigation_premium
            + expert_premium
            + disclosure_premium
            - concealment_discount)
            .clamp(25_000, 220_000)
    }

    fn active_settlement_offer(&self) -> Option<&SettlementOffer> {
        self.state
            .settlement_offer
            .as_ref()
            .filter(|offer| offer.expires_at >= self.state.now)
    }

    fn apply_document_review(&mut self, evidence_gain: i16, quality_penalty: i16) {
        self.discover(EvidenceId::ChangeRequests);
        self.discover(EvidenceId::ProjectEmails);
        self.discover(EvidenceId::ConditionalAcceptance);
        self.state
            .evidence_quality
            .adjust((evidence_gain - quality_penalty).max(1));
        self.state.legal_merits.adjust(-3);
    }

    fn resolve_hearing(&mut self) {
        if self.state.is_resolved() {
            return;
        }

        let base_position = self.state.position_score();
        let mut factors = Vec::new();

        let preparation_modifier =
            ((self.state.hearing_preparation.value() - 40) / 4).clamp(-10, 15);
        factors.push(OutcomeFactor {
            label: "Hearing preparation".to_owned(),
            modifier: preparation_modifier,
        });

        factors.push(OutcomeFactor {
            label: "Independent expert evidence".to_owned(),
            modifier: if self.state.litigation.expert_report_reviewed {
                7
            } else {
                -5
            },
        });
        factors.push(OutcomeFactor {
            label: "Witness preparation".to_owned(),
            modifier: if self.state.litigation.witnesses_prepared {
                6
            } else {
                -10
            },
        });
        factors.push(OutcomeFactor {
            label: "Hearing rehearsal".to_owned(),
            modifier: if self.state.litigation.hearing_rehearsed {
                4
            } else {
                0
            },
        });
        factors.push(OutcomeFactor {
            label: "Current fatigue".to_owned(),
            modifier: -(self.state.work.fatigue.value() / 12),
        });
        factors.push(OutcomeFactor {
            label: "Disclosure compliance".to_owned(),
            modifier: if self.state.litigation.disclosure_served {
                4
            } else {
                -8
            },
        });
        factors.push(OutcomeFactor {
            label: "Opponent disclosure reviewed".to_owned(),
            modifier: if self.state.litigation.opponent_disclosure_reviewed {
                5
            } else {
                -4
            },
        });

        if self.has_action(PlayerAction::ConcealAdverseEmails) {
            factors.push(OutcomeFactor {
                label: "Concealment risk".to_owned(),
                modifier: -20,
            });
        }

        for deadline in self
            .state
            .deadlines
            .iter()
            .filter(|deadline| deadline.status == DeadlineStatus::Missed)
        {
            let modifier = match deadline.id {
                DeadlineId::PartnerBrief => -3,
                DeadlineId::PreservationNotice => -8,
                DeadlineId::StatementOfClaim => -15,
            };
            factors.push(OutcomeFactor {
                label: format!("Missed deadline: {}", deadline.label),
                modifier,
            });
        }

        let unanswered_penalty = -((self.state.unhandled_required_messages().min(5) as i16) * 2);
        if unanswered_penalty != 0 {
            factors.push(OutcomeFactor {
                label: "Unanswered material messages".to_owned(),
                modifier: unanswered_penalty,
            });
        }

        let modifier_total: i16 = factors.iter().map(|factor| factor.modifier).sum();
        let win_threshold = (base_position + modifier_total).clamp(5, 95) as u8;
        let deterministic_roll = self.rng.roll_one_to_one_hundred();
        let client_won = deterministic_roll <= win_threshold;

        let (damages_eur, costs_awarded_eur) = if client_won {
            let recovery_percent = 55 + i64::from(self.state.evidence_quality.value()) / 2;
            let damages = self.state.claim_value_eur.saturating_mul(recovery_percent) / 100;
            (damages.min(self.state.claim_value_eur), 18_000)
        } else {
            (0, -18_000)
        };

        self.resolve(CaseOutcome::Judgment {
            client_won,
            damages_eur,
            costs_awarded_eur,
            breakdown: JudgmentBreakdown {
                base_position,
                factors,
                win_threshold,
                deterministic_roll,
            },
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

    fn refresh_stage(&mut self) {
        if self.state.is_resolved() || self.state.stage == CaseStage::Hearing {
            return;
        }

        if matches!(
            self.state.stage,
            CaseStage::Disclosure | CaseStage::ExpertEvidence
        ) && self.state.litigation.disclosure_served
            && self.state.litigation.opponent_disclosure_reviewed
        {
            if self.expert_path_complete() {
                self.state.stage = CaseStage::HearingPreparation;
            } else {
                self.state.stage = CaseStage::ExpertEvidence;
            }
        }
    }

    fn spend(&mut self, minutes: u32, euros: i64) {
        self.state.billable_minutes = self.state.billable_minutes.saturating_add(minutes);
        self.state.budget_spent_eur = self.state.budget_spent_eur.saturating_add(euros);
        self.record_work(minutes);
    }

    /// Records player work while respecting calendar-day boundaries.
    ///
    /// This method intentionally does not auto-rest at midnight. A lawyer may
    /// continue working, but overtime and fatigue accumulate. Rest is an
    /// explicit strategic action because the world and deadlines keep moving.
    fn record_work(&mut self, minutes: u32) {
        let mut remaining = minutes;
        while remaining > 0 {
            self.sync_workday_counter();
            let minute_in_day = self.state.now.0 % MINUTES_PER_DAY;
            let until_midnight = MINUTES_PER_DAY - minute_in_day;
            let chunk = remaining.min(until_midnight);

            let previous_overtime = self
                .state
                .work
                .minutes_worked_today
                .saturating_sub(self.state.work.daily_capacity_minutes);
            self.state.work.minutes_worked_today =
                self.state.work.minutes_worked_today.saturating_add(chunk);
            let current_overtime = self
                .state
                .work
                .minutes_worked_today
                .saturating_sub(self.state.work.daily_capacity_minutes);
            let overtime_delta = current_overtime.saturating_sub(previous_overtime);
            self.state.work.overtime_minutes_total = self
                .state
                .work
                .overtime_minutes_total
                .saturating_add(overtime_delta);

            let base_fatigue = chunk.div_ceil(180) as i16;
            let overtime_fatigue = (overtime_delta.div_ceil(60) * 2) as i16;
            self.state
                .work
                .fatigue
                .adjust(base_fatigue + overtime_fatigue);
            let strain_gain =
                (overtime_delta.div_ceil(120) as i16) + if chunk >= 6 * 60 { 1 } else { 0 };
            self.state.work.cumulative_strain.adjust(strain_gain);

            self.state.now = self.state.now.saturating_add_minutes(chunk);
            let (hour, _) = self.state.now.hour_minute();
            if !(6..22).contains(&hour) {
                self.state.work.fatigue.adjust(1);
            }
            remaining -= chunk;
        }
        self.sync_workday_counter();
    }

    fn rest_until_next_workday(&mut self) {
        self.state.now = self.state.now.next_workday_start();
        self.state.work.tracked_day = self.state.now.day();
        self.state.work.minutes_worked_today = 0;
        self.state.work.fatigue.adjust(-30);
        self.state.work.cumulative_strain.adjust(-4);
    }

    fn sync_workday_counter(&mut self) {
        let current_day = self.state.now.day();
        if self.state.work.tracked_day != current_day {
            self.state.work.tracked_day = current_day;
            self.state.work.minutes_worked_today = 0;
        }
    }

    fn current_quality_penalty(&self) -> i16 {
        let fatigue_penalty = self.state.work.fatigue.value() / 20;
        let strain_penalty = self.state.work.cumulative_strain.value() / 25;
        let overtime_today = self
            .state
            .work
            .minutes_worked_today
            .saturating_sub(self.state.work.daily_capacity_minutes);
        let overtime_penalty = (overtime_today / 120) as i16;
        (fatigue_penalty + strain_penalty + overtime_penalty).clamp(0, 10)
    }

    fn can_rest_safely(&self) -> bool {
        if self.state.stage == CaseStage::Hearing {
            return false;
        }
        let next_workday = self.state.now.next_workday_start();
        // Use an explicit match instead of `Option::is_none_or`. The latter
        // became stable in Rust 1.82, while this workspace promises Rust 1.78
        // compatibility. Keeping the MSRV honest prevents a release from
        // compiling on the maintainer's current toolchain but failing for users
        // on the documented minimum version.
        match self.state.litigation.hearing_scheduled_for {
            None => true,
            Some(hearing) => hearing >= next_workday || hearing <= self.state.now,
        }
    }

    fn action_within_authorized_budget(&self, action: PlayerAction) -> bool {
        if matches!(
            action,
            PlayerAction::RequestBudgetApproval
                | PlayerAction::AcceptSettlement
                | PlayerAction::RestUntilNextWorkday
        ) {
            return true;
        }
        let cost = action_option(action).monetary_cost_eur;
        self.state.budget_spent_eur.saturating_add(cost) <= self.state.authorized_budget_eur
    }

    fn discover(&mut self, id: EvidenceId) {
        if let Some(evidence) = self
            .state
            .evidence
            .iter_mut()
            .find(|evidence| evidence.id == id)
        {
            evidence.discovered = true;
        }
    }

    fn disclose(&mut self, id: EvidenceId) {
        if let Some(evidence) = self
            .state
            .evidence
            .iter_mut()
            .find(|evidence| evidence.id == id)
        {
            evidence.disclosed = true;
        }
    }

    fn evidence_is_discovered(&self, id: EvidenceId) -> bool {
        self.state
            .evidence
            .iter()
            .any(|evidence| evidence.id == id && evidence.discovered)
    }

    fn has_action(&self, action: PlayerAction) -> bool {
        self.state.action_history.contains(&action)
    }

    fn documents_reviewed(&self) -> bool {
        self.has_action(PlayerAction::RequestDocuments)
            || self.state.delegation.reports_reviewed > 0
    }

    fn adverse_email_decision_made(&self) -> bool {
        self.has_action(PlayerAction::DiscloseAdverseEmails)
            || self.has_action(PlayerAction::ConcealAdverseEmails)
    }

    fn disclosure_choice_resolved(&self) -> bool {
        !self.evidence_is_discovered(EvidenceId::DeletedMailbox)
            || self.adverse_email_decision_made()
    }

    fn expert_path_complete(&self) -> bool {
        self.state.litigation.expert_report_reviewed
            || self.state.litigation.proceeded_without_expert
    }
}

fn schedule_deadline_events(scheduler: &mut Scheduler<WorldEvent>, deadline: &Deadline) {
    let warning_due = SimMinute(deadline.due.0.saturating_sub(60));
    scheduler.schedule(
        warning_due,
        WorldEvent::DeadlineWarning {
            deadline_id: deadline.id,
            minutes_remaining: 60,
        },
    );
    scheduler.schedule(
        deadline.due,
        WorldEvent::DeadlineReached {
            deadline_id: deadline.id,
        },
    );
}

fn is_ai_action(action: PlayerAction) -> bool {
    matches!(
        action,
        PlayerAction::AskAiResearch
            | PlayerAction::AskAiEvidenceReview
            | PlayerAction::AskAiDamagesModel
            | PlayerAction::AskAiDraftReview
            | PlayerAction::AskAiHearingPreparation
    )
}

fn format_sim_time(prefix: &str, time: SimMinute) -> String {
    let (hour, minute) = time.hour_minute();
    format!("{prefix} Day {} {:02}:{:02}.", time.day(), hour, minute)
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
        Actor {
            id: ActorId::JuniorAssociate,
            name: "Nora Jacobs".to_owned(),
            role: "Junior associate".to_owned(),
            trust_in_player: Score::new(50),
            pressure: Score::new(35),
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
            EvidenceId::OpponentProjectLog,
            "Opponent internal project log",
            false,
            82,
            6,
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

/// Central presentation metadata for every player action.
///
/// Keeping costs and durations beside labels makes the CLI transparent while
/// the engine remains authoritative: the values shown here mirror the values
/// applied by `apply_non_ai_action` and are covered by gameplay tests.
fn action_option(action: PlayerAction) -> ActionOption {
    use PlayerAction::*;
    let (label, description, player_minutes, monetary_cost_eur) = match action {
        RunConflictCheck => (
            "Run conflict check",
            "Verify that the firm may ethically accept the client.",
            60,
            350,
        ),
        AcceptMatterImmediately => (
            "Accept matter immediately",
            "Secure the client without completing the formal conflict check.",
            0,
            0,
        ),
        ReplyToClient => (
            "Reply to the client CEO",
            "Confirm the mandate and set realistic next steps.",
            30,
            250,
        ),
        ReplyToCfo => (
            "Respond to the client CFO",
            "Manage board pressure without making unsupported promises.",
            30,
            250,
        ),
        SendPartnerBrief => (
            "Send partner risk brief",
            "Summarize merits, evidence gaps, budget, and settlement range.",
            90,
            750,
        ),
        IssuePreservationNotice => (
            "Issue evidence-preservation notice",
            "Protect mailboxes, project files, logs, and device evidence.",
            60,
            500,
        ),
        RequestDocuments => (
            "Personally review the full document set",
            "Spend six hours reviewing contract, changes, acceptance, and emails.",
            360,
            2_000,
        ),
        DelegateDocumentReview => (
            "Delegate document review to junior",
            "Use little player time but wait for an asynchronous junior report.",
            30,
            2_000,
        ),
        ReviewJuniorReport => (
            "Review junior document report",
            "Validate the junior's findings before using them strategically.",
            90,
            1_000,
        ),
        RecoverDeletedMailbox => (
            "Recover deleted mailbox",
            "Commission forensic recovery that may reveal adverse evidence.",
            360,
            5_500,
        ),
        DiscloseAdverseEmails => (
            "Disclose adverse emails",
            "Comply fully despite damage to the client's narrative.",
            60,
            600,
        ),
        ConcealAdverseEmails => (
            "Conceal adverse emails",
            "Gain short-term leverage at severe ethical and procedural risk.",
            30,
            250,
        ),
        CommissionIndependentExpert => (
            "Commission independent ERP expert",
            "Start asynchronous technical analysis by an external expert.",
            60,
            12_000,
        ),
        ReviewExpertReport => (
            "Review independent expert report",
            "Translate technical findings into legal and evidentiary value.",
            120,
            2_000,
        ),
        SendDemand => (
            "Send demand letter",
            "Present the claim and invite a commercial response.",
            180,
            900,
        ),
        OfferMediation => (
            "Propose early mediation",
            "Test settlement before litigation, with risk if facts are incomplete.",
            120,
            1_200,
        ),
        AskAiResearch => (
            "Ask AI associate for legal research",
            "Receive a limited advisory note that still requires verification.",
            90,
            750,
        ),
        AskAiEvidenceReview => (
            "Ask AI associate to review known evidence",
            "Search authorized facts for contradictions and missing links.",
            90,
            750,
        ),
        AskAiDamagesModel => (
            "Ask AI associate for damages model",
            "Estimate settlement value using only facts already known.",
            90,
            750,
        ),
        AskAiDraftReview => (
            "Ask AI associate to review the claim draft",
            "Check structure and unsupported assertions before filing.",
            90,
            750,
        ),
        AskAiHearingPreparation => (
            "Ask AI associate for hearing preparation",
            "Generate likely questions and weaknesses for rehearsal.",
            90,
            750,
        ),
        AcceptSettlement => (
            "Accept current settlement offer",
            "Resolve the matter now at the currently available amount.",
            0,
            0,
        ),
        Litigate => (
            "Commence litigation",
            "Open pleadings, procedural deadlines, disclosure, and hearing path.",
            120,
            2_500,
        ),
        DraftStatementOfClaim => (
            "Draft statement of claim",
            "Build a pleaded case from known facts and available evidence.",
            240,
            4_000,
        ),
        FileStatementOfClaim => (
            "File statement of claim",
            "Meet the filing deadline and trigger disclosure and hearing dates.",
            60,
            1_000,
        ),
        ServeDisclosure => (
            "Serve disclosure",
            "Provide discovered material after resolving adverse-email treatment.",
            180,
            2_500,
        ),
        ReviewOpponentDisclosure => (
            "Review opponent disclosure",
            "Analyze the project log and internal escalation records.",
            180,
            2_500,
        ),
        ProceedWithoutExpert => (
            "Proceed without expert evidence",
            "Save time and money but accept a weaker technical foundation.",
            30,
            0,
        ),
        PrepareWitnesses => (
            "Prepare witnesses",
            "Test recollection, consistency, and likely cross-examination.",
            240,
            8_000,
        ),
        RehearseHearing => (
            "Rehearse the hearing",
            "Run the argument, judicial questions, and evidentiary transitions.",
            180,
            4_000,
        ),
        AttendHearing => (
            "Attend hearing",
            "Submit the matter to the explainable deterministic judgment model.",
            180,
            6_000,
        ),
        RequestBudgetApproval => (
            "Request additional budget approval",
            "Ask the client to raise the approved legal-spend ceiling by EUR 25,000.",
            30,
            250,
        ),
        RestUntilNextWorkday => (
            "Rest until next workday",
            "Recover fatigue while deadlines and world events continue.",
            0,
            0,
        ),
    };

    ActionOption {
        action,
        label,
        description,
        player_minutes,
        monetary_cost_eur,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use juris_ai::ScriptedAiActor;

    fn started_engine(seed: u64, mode: GameMode) -> Engine<ScriptedAiActor> {
        let mut engine = Engine::new(seed, mode, ScriptedAiActor);
        assert!(engine.advance_to_next_event());
        engine
    }

    #[test]
    fn identical_seed_and_actions_reproduce_the_same_world() {
        // This proves the central replay promise across inbox, workload, money,
        // evidence, and reputation—not merely the final random roll.
        fn run(seed: u64) -> MatterState {
            let mut engine = started_engine(seed, GameMode::Career);
            engine.apply_action(PlayerAction::RunConflictCheck).unwrap();
            engine.apply_action(PlayerAction::ReplyToClient).unwrap();
            engine.apply_action(PlayerAction::RequestDocuments).unwrap();
            engine.state().clone()
        }
        assert_eq!(run(20260724), run(20260724));
    }

    #[test]
    fn replying_to_client_resolves_the_opening_request_even_when_new_mail_arrives() {
        // The reply consumes time, so a later CFO message may arrive before the
        // action completes. The test therefore inspects the specific opening
        // request rather than assuming the global required-message count is zero.
        let mut engine = started_engine(1, GameMode::Career);
        engine.apply_action(PlayerAction::RunConflictCheck).unwrap();
        engine.apply_action(PlayerAction::ReplyToClient).unwrap();
        assert!(engine.state().inbox.iter().any(|message| {
            message.kind == InboxMessageKind::OpeningClientRequest
                && message.status == InboxStatus::Resolved
        }));
    }

    #[test]
    fn long_work_delivers_events_that_became_due_during_the_action() {
        // Six hours of document review crosses both the CFO and partner events.
        // Neither message may remain incorrectly suspended in the scheduler.
        let mut engine = started_engine(2, GameMode::Career);
        engine.apply_action(PlayerAction::RunConflictCheck).unwrap();
        engine.apply_action(PlayerAction::RequestDocuments).unwrap();
        assert!(engine
            .state()
            .inbox
            .iter()
            .any(|message| message.kind == InboxMessageKind::ClientPressure));
        assert!(engine
            .state()
            .inbox
            .iter()
            .any(|message| message.kind == InboxMessageKind::PartnerBriefRequest));
    }

    #[test]
    fn unanswered_partner_deadline_is_missed_and_penalized() {
        // Advancing through the due time without sending the brief must change
        // deadline status and professional reputation.
        let mut engine = started_engine(3, GameMode::Career);
        let respect_before = engine.state().reputation.peer_respect.value();
        while engine.deadline_is_open(DeadlineId::PartnerBrief) {
            assert!(engine.advance_to_next_event());
        }
        let deadline = engine
            .state()
            .deadlines
            .iter()
            .find(|deadline| deadline.id == DeadlineId::PartnerBrief)
            .unwrap();
        assert_eq!(deadline.status, DeadlineStatus::Missed);
        assert!(engine.state().reputation.peer_respect.value() < respect_before);
    }

    #[test]
    fn delegation_finishes_asynchronously_and_requires_review() {
        // Delegation saves player hours but does not instantly reveal evidence.
        // A report event must arrive, and a separate review action unlocks facts.
        let mut engine = started_engine(4, GameMode::Career);
        engine.apply_action(PlayerAction::RunConflictCheck).unwrap();
        engine
            .apply_action(PlayerAction::DelegateDocumentReview)
            .unwrap();
        assert!(!engine.evidence_is_discovered(EvidenceId::ChangeRequests));
        while engine.state().delegation.completed.is_none() {
            assert!(engine.advance_to_next_event());
        }
        engine
            .apply_action(PlayerAction::ReviewJuniorReport)
            .unwrap();
        assert!(engine.evidence_is_discovered(EvidenceId::ChangeRequests));
    }

    #[test]
    fn overtime_increases_fatigue_and_rest_reduces_it() {
        // Workload must have consequences. A long review creates fatigue, while
        // deliberate rest recovers part—but not necessarily all—of it.
        let mut engine = started_engine(5, GameMode::Career);
        engine.apply_action(PlayerAction::RunConflictCheck).unwrap();
        engine.apply_action(PlayerAction::RequestDocuments).unwrap();
        engine
            .apply_action(PlayerAction::RecoverDeletedMailbox)
            .unwrap();
        let tired = engine.state().work.fatigue.value();
        assert!(engine.state().work.overtime_minutes_total > 0);
        engine
            .apply_action(PlayerAction::RestUntilNextWorkday)
            .unwrap();
        assert!(engine.state().work.fatigue.value() < tired);
    }

    #[test]
    fn ai_cannot_reveal_undiscovered_evidence() {
        // The adapter receives only evidence marked discovered. Hidden mailbox
        // data therefore cannot leak through an AI note.
        let mut engine = started_engine(6, GameMode::Career);
        engine.apply_action(PlayerAction::AskAiResearch).unwrap();
        let note = engine.state().ai_usage.last_note.as_ref().unwrap();
        assert!(
            note.contains("Signed implementation agreement"),
            "the AI note must include evidence explicitly authorized by the engine: {note}"
        );
        assert!(
            !note.contains("Recovered deleted mailbox data"),
            "the AI note must not reveal undiscovered evidence: {note}"
        );
    }

    #[test]
    fn hardcore_mode_exposes_no_internal_ai_actions() {
        // Hardcore removes the official assistant while preserving all ordinary
        // legal actions and the deterministic world.
        let engine = started_engine(7, GameMode::Hardcore);
        assert!(!engine
            .available_actions()
            .iter()
            .any(|action| is_ai_action(*action)));
    }

    #[test]
    fn concealment_materially_harms_ethics_and_final_threshold() {
        // An unethical shortcut may improve leverage, but it must impose a
        // visible long-term penalty in both reputation and judgment explanation.
        let mut engine = started_engine(8, GameMode::Career);
        engine.apply_action(PlayerAction::RunConflictCheck).unwrap();
        engine.apply_action(PlayerAction::RequestDocuments).unwrap();
        engine
            .apply_action(PlayerAction::RecoverDeletedMailbox)
            .unwrap();
        let ethics_before = engine.state().reputation.ethical_standing.value();
        engine
            .apply_action(PlayerAction::ConcealAdverseEmails)
            .unwrap();
        assert!(engine.state().reputation.ethical_standing.value() <= ethics_before - 30);

        engine.state.stage = CaseStage::Hearing;
        engine.state.litigation.witnesses_prepared = true;
        engine.state.litigation.disclosure_served = true;
        engine.state.litigation.opponent_disclosure_reviewed = true;
        engine.resolve_hearing();
        let CaseOutcome::Judgment { breakdown, .. } = engine.state().outcome.as_ref().unwrap()
        else {
            panic!("hearing must produce a judgment");
        };
        assert!(breakdown
            .factors
            .iter()
            .any(|factor| factor.label == "Concealment risk" && factor.modifier == -20));
    }

    #[test]
    fn judgment_records_threshold_and_seeded_roll() {
        // Players must be able to understand why they won or lost. The terminal
        // outcome therefore stores both named modifiers and the seeded roll.
        let mut engine = started_engine(9, GameMode::Career);
        engine.state.stage = CaseStage::Hearing;
        engine.state.litigation.witnesses_prepared = true;
        engine.state.litigation.hearing_rehearsed = true;
        engine.state.litigation.disclosure_served = true;
        engine.state.litigation.opponent_disclosure_reviewed = true;
        engine.state.litigation.expert_report_reviewed = true;
        engine.resolve_hearing();

        let CaseOutcome::Judgment { breakdown, .. } = engine.state().outcome.as_ref().unwrap()
        else {
            panic!("hearing must produce a judgment");
        };
        assert!((5..=95).contains(&breakdown.win_threshold));
        assert!((1..=100).contains(&breakdown.deterministic_roll));
        assert!(!breakdown.factors.is_empty());
    }

    #[test]
    fn rest_is_blocked_when_it_would_skip_a_scheduled_hearing() {
        // Mandatory court appointments are hard world constraints. The player
        // may not use overnight rest to jump past a hearing start.
        let mut engine = started_engine(91, GameMode::Career);
        engine.state.litigation.hearing_scheduled_for =
            Some(engine.state.now.saturating_add_minutes(60));
        assert!(!engine
            .available_actions()
            .contains(&PlayerAction::RestUntilNextWorkday));
    }

    #[test]
    fn repeated_overtime_creates_persistent_strain() {
        // Acute fatigue may recover overnight, but cumulative strain must retain
        // part of the cost of repeated long days.
        let mut engine = started_engine(92, GameMode::Career);
        engine.record_work(12 * 60);
        let strain_before_rest = engine.state.work.cumulative_strain.value();
        engine.rest_until_next_workday();
        assert!(strain_before_rest > 0);
        assert!(engine.state.work.cumulative_strain.value() < strain_before_rest);
    }

    #[test]
    fn budget_authority_hides_actions_that_would_exceed_the_ceiling() {
        // The client-approved budget is a real constraint rather than narrative
        // flavour. Expensive work becomes available again only after approval.
        let mut engine = started_engine(93, GameMode::Career);
        engine.state.stage = CaseStage::PreLitigation;
        engine.state.budget_spent_eur = 24_500;
        assert!(!engine
            .available_actions()
            .contains(&PlayerAction::CommissionIndependentExpert));
        assert!(engine
            .available_actions()
            .contains(&PlayerAction::RequestBudgetApproval));
    }
}
