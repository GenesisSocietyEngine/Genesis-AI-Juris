//! Deterministic and authoritative legal simulation engine.
//!
//! An LLM may phrase facts, classify a player's free-text request, or role-play
//! a client. It never writes directly to `CaseState`. Every accepted action is
//! validated and resolved here so identical seeds and decisions are replayable.

use juris_domain::{
    AssistantUsage, CareerState, CaseId, CaseOutcome, CaseStage, CaseState, DecisionId,
    DecisionOption, Evidence, EvidenceId, GameMode, Score,
};
use thiserror::Error;

#[derive(Debug, Error, PartialEq, Eq)]
pub enum SimulationError {
    #[error("the case has already been resolved")]
    CaseResolved,
    #[error("decision {0:?} is not available in the current state")]
    DecisionUnavailable(DecisionId),
    #[error("the internal AI assistant is unavailable in this mode")]
    AssistantUnavailable,
    #[error("the internal AI assistant request limit has been reached")]
    AssistantLimitReached,
}

/// Small deterministic PRNG for replayable scenario variation. It is not
/// cryptographically secure and must never be used for secrets or security.
#[derive(Debug, Clone)]
struct DeterministicRng {
    state: u64,
}

impl DeterministicRng {
    fn new(seed: u64) -> Self {
        Self { state: seed.max(1) }
    }

    fn next_u64(&mut self) -> u64 {
        let mut x = self.state;
        x ^= x << 13;
        x ^= x >> 7;
        x ^= x << 17;
        self.state = x;
        x
    }

    fn roll_0_99(&mut self) -> u8 {
        (self.next_u64() % 100) as u8
    }
}

#[derive(Debug, Clone)]
pub struct Simulation {
    seed: u64,
    rng: DeterministicRng,
    state: CaseState,
}

impl Simulation {
    pub fn failed_erp_implementation(seed: u64, mode: GameMode) -> Self {
        let request_limit = match mode {
            GameMode::Assisted => 4,
            GameMode::Career => 2,
            GameMode::Hardcore | GameMode::Tournament => 0,
        };

        let state = CaseState {
            id: CaseId("failed-erp-implementation".to_owned()),
            title: "The Failed ERP Implementation".to_owned(),
            jurisdiction: "Belgium".to_owned(),
            practice_area: "Commercial contract disputes".to_owned(),
            mode,
            stage: CaseStage::Intake,
            day: 1,
            claimed_amount_eur: 240_000,
            legal_merits: Score::new(52),
            evidence_quality: Score::new(38),
            procedural_position: Score::new(55),
            negotiation_leverage: Score::new(42),
            client_trust: Score::new(58),
            ethical_standing: Score::new(75),
            budget_spent_eur: 0,
            billable_hours: 0,
            decision_seconds_remaining: mode.has_time_pressure().then_some(90),
            evidence: vec![
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
                    EvidenceId::DeletedEmailRecovery,
                    "Recovered deleted mailbox data",
                    false,
                    85,
                    -8,
                ),
                evidence(
                    EvidenceId::DeliveryAcceptance,
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
            ],
            decisions: Vec::new(),
            assistant: AssistantUsage {
                requests_used: 0,
                request_limit,
                reliability: Score::new(82),
                last_advice: None,
            },
            career: CareerState::default(),
            outcome: None,
        };

        Self {
            seed,
            rng: DeterministicRng::new(seed),
            state,
        }
    }

    pub fn seed(&self) -> u64 {
        self.seed
    }
    pub fn state(&self) -> &CaseState {
        &self.state
    }

    pub fn available_decisions(&self) -> Vec<DecisionOption> {
        if self.state.is_resolved() {
            return Vec::new();
        }

        use CaseStage::*;
        use DecisionId::*;
        let mut ids = match self.state.stage {
            Intake if self.state.decisions.is_empty() => vec![RunConflictCheck, AcceptImmediately],
            Intake => vec![RequestFullDocumentSet, SendAggressiveDemand],
            Investigation => {
                let mut choices = vec![OfferEarlyMediation];
                if !self.has_decision(RecoverDeletedEmails) {
                    choices.push(RecoverDeletedEmails);
                }
                if !self.has_decision(HireIndependentExpert)
                    && !self.has_decision(UseFormerVendorEmployee)
                {
                    choices.extend([HireIndependentExpert, UseFormerVendorEmployee]);
                }
                if self.has_decision(RecoverDeletedEmails)
                    && !self.has_decision(DiscloseAdverseEmails)
                    && !self.has_decision(ConcealAdverseEmails)
                {
                    choices.extend([DiscloseAdverseEmails, ConcealAdverseEmails]);
                }
                choices.push(SendAggressiveDemand);
                choices
            }
            PreLitigation => vec![AcceptSettlement, RejectSettlementAndLitigate],
            Pleadings => vec![PrepareWitnesses, FileLateEvidence],
            Hearing | Resolved => Vec::new(),
        };

        if self.can_use_assistant() {
            match self.state.stage {
                Intake if !self.has_decision(ConsultAiCaseResearch) => {
                    ids.push(ConsultAiCaseResearch)
                }
                Investigation if !self.has_decision(ConsultAiEvidenceReview) => {
                    ids.push(ConsultAiEvidenceReview)
                }
                PreLitigation if !self.has_decision(ConsultAiSettlementModel) => {
                    ids.push(ConsultAiSettlementModel)
                }
                _ => {}
            }
        }

        ids.into_iter().map(option_for).collect()
    }

    pub fn apply(&mut self, decision: DecisionId) -> Result<(), SimulationError> {
        if self.state.is_resolved() {
            return Err(SimulationError::CaseResolved);
        }
        if is_assistant_decision(decision) {
            if !self.state.mode.allows_internal_assistant() {
                return Err(SimulationError::AssistantUnavailable);
            }
            if self.state.assistant.requests_used >= self.state.assistant.request_limit {
                return Err(SimulationError::AssistantLimitReached);
            }
        }
        if !self
            .available_decisions()
            .iter()
            .any(|option| option.id == decision)
        {
            return Err(SimulationError::DecisionUnavailable(decision));
        }

        use DecisionId::*;
        match decision {
            RunConflictCheck => {
                self.spend(1, 350);
                self.state.client_trust.adjust(2);
                self.state.ethical_standing.adjust(2);
            }
            AcceptImmediately => {
                self.state.client_trust.adjust(3);
                self.state.ethical_standing.adjust(-3);
                self.state.procedural_position.adjust(-2);
            }
            RequestFullDocumentSet => {
                self.spend(8, 2_000);
                for id in [EvidenceId::ChangeRequests, EvidenceId::ProjectEmails, EvidenceId::DeliveryAcceptance] {
                    self.discover(id);
                }
                self.state.evidence_quality.adjust(12);
                self.state.legal_merits.adjust(-2);
                self.state.stage = CaseStage::Investigation;
            }
            ConsultAiCaseResearch => self.apply_assistant(
                "The assistant identifies liability-cap language and warns that factual causation will matter more than rhetoric.",
                3,
                2,
                1,
            ),
            ConsultAiEvidenceReview => self.apply_assistant(
                "The assistant flags a contradiction between change requests and the client's initial chronology. Verify it manually.",
                0,
                4,
                2,
            ),
            ConsultAiSettlementModel => self.apply_assistant(
                "The assistant estimates that settlement dominates litigation unless expert evidence materially improves the merits.",
                0,
                0,
                4,
            ),
            SendAggressiveDemand => {
                self.spend(3, 900);
                self.state.negotiation_leverage.adjust(5);
                self.state.client_trust.adjust(2);
                self.state.procedural_position.adjust(-2);
                self.state.stage = CaseStage::PreLitigation;
            }
            OfferEarlyMediation => {
                self.spend(4, 1_200);
                self.state.negotiation_leverage.adjust(3);
                self.state.client_trust.adjust(1);
                self.state.stage = CaseStage::PreLitigation;
            }
            RecoverDeletedEmails => {
                self.spend(12, 5_500);
                self.discover(EvidenceId::DeletedEmailRecovery);
                self.state.evidence_quality.adjust(10);
                self.state.legal_merits.adjust(-8);
                self.state.client_trust.adjust(-4);
            }
            HireIndependentExpert => {
                self.spend(20, 12_000);
                self.discover(EvidenceId::IndependentExpertReport);
                self.state.evidence_quality.adjust(14);
                self.state.legal_merits.adjust(9);
                self.state.negotiation_leverage.adjust(8);
            }
            UseFormerVendorEmployee => {
                self.spend(8, 4_000);
                self.state.evidence_quality.adjust(7);
                self.state.legal_merits.adjust(5);
                self.state.ethical_standing.adjust(-4);
                self.state.procedural_position.adjust(-4);
            }
            DiscloseAdverseEmails => {
                self.spend(2, 600);
                self.disclose(EvidenceId::DeletedEmailRecovery);
                self.state.ethical_standing.adjust(8);
                self.state.procedural_position.adjust(7);
                self.state.client_trust.adjust(-2);
            }
            ConcealAdverseEmails => {
                self.state.legal_merits.adjust(4);
                self.state.client_trust.adjust(4);
                self.state.ethical_standing.adjust(-24);
                self.state.procedural_position.adjust(-14);
            }
            AcceptSettlement => {
                self.state.outcome = Some(CaseOutcome::Settlement { amount_eur: self.settlement_offer() });
                self.finish_career_effects(true);
            }
            RejectSettlementAndLitigate => {
                self.spend(15, 7_500);
                self.state.stage = CaseStage::Pleadings;
            }
            PrepareWitnesses => {
                self.spend(18, 8_000);
                self.state.evidence_quality.adjust(7);
                self.state.procedural_position.adjust(4);
                self.state.client_trust.adjust(2);
                self.resolve_judgment();
            }
            FileLateEvidence => {
                self.spend(5, 2_000);
                self.state.evidence_quality.adjust(4);
                self.state.procedural_position.adjust(-12);
                self.resolve_judgment();
            }
        }

        self.state.decisions.push(decision);
        self.state.day += elapsed_days(decision);
        if self.state.mode.has_time_pressure() && !self.state.is_resolved() {
            self.state.decision_seconds_remaining = Some(90);
        }
        Ok(())
    }

    pub fn current_position_score(&self) -> u8 {
        let weighted = self.state.legal_merits.value() as u32 * 35
            + self.state.evidence_quality.value() as u32 * 25
            + self.state.procedural_position.value() as u32 * 20
            + self.state.negotiation_leverage.value() as u32 * 10
            + self.state.ethical_standing.value() as u32 * 10;
        (weighted / 100) as u8
    }

    pub fn settlement_offer(&self) -> i64 {
        (35_000 + self.current_position_score() as i64 * 1_400).clamp(45_000, 175_000)
    }

    fn apply_assistant(&mut self, advice: &str, merits: i32, evidence: i32, leverage: i32) {
        self.spend(2, 750);
        self.state.assistant.requests_used += 1;
        self.state.assistant.last_advice = Some(advice.to_owned());

        // The assistant is useful but fallible. The failure branch is deterministic
        // for a seed and costs procedural confidence, not arbitrary instant defeat.
        if self.rng.roll_0_99() < self.state.assistant.reliability.value() {
            self.state.legal_merits.adjust(merits);
            self.state.evidence_quality.adjust(evidence);
            self.state.negotiation_leverage.adjust(leverage);
        } else {
            self.state.procedural_position.adjust(-3);
            self.state.assistant.last_advice = Some(format!(
                "{advice} Later verification reveals that part of the analysis was unreliable."
            ));
        }
    }

    fn resolve_judgment(&mut self) {
        let score = self.current_position_score();
        let client_won = self.rng.roll_0_99() < score;
        let (damages_eur, costs_awarded_eur) = if client_won {
            let factor = 45 + (self.rng.roll_0_99() as i64 % 36);
            (self.state.claimed_amount_eur * factor / 100, 12_000)
        } else {
            (0, -18_000)
        };
        self.state.outcome = Some(CaseOutcome::Judgment {
            client_won,
            damages_eur,
            costs_awarded_eur,
        });
        self.finish_career_effects(client_won);
    }

    fn finish_career_effects(&mut self, favorable: bool) {
        self.state.stage = CaseStage::Resolved;
        self.state.career.matters_completed += 1;
        self.state.career.cash_eur -= self.state.budget_spent_eur;
        self.state.career.reputation.client_trust = self.state.client_trust;
        self.state.career.reputation.ethical_standing = self.state.ethical_standing;
        self.state
            .career
            .reputation
            .commercial_reputation
            .adjust(if favorable { 4 } else { -2 });
        if self.state.ethical_standing.value() < 40 {
            self.state
                .career
                .reputation
                .judicial_credibility
                .adjust(-12);
            self.state.career.reputation.peer_respect.adjust(-8);
        }
    }

    fn can_use_assistant(&self) -> bool {
        self.state.mode.allows_internal_assistant()
            && self.state.assistant.requests_used < self.state.assistant.request_limit
    }

    fn discover(&mut self, id: EvidenceId) {
        if let Some(item) = self.state.evidence.iter_mut().find(|item| item.id == id) {
            item.discovered = true;
        }
    }

    fn disclose(&mut self, id: EvidenceId) {
        if let Some(item) = self.state.evidence.iter_mut().find(|item| item.id == id) {
            item.disclosed_to_opponent = true;
        }
    }

    fn spend(&mut self, hours: u32, cost: i64) {
        self.state.billable_hours += hours;
        self.state.budget_spent_eur += cost;
    }

    fn has_decision(&self, decision: DecisionId) -> bool {
        self.state.decisions.contains(&decision)
    }
}

fn evidence(
    id: EvidenceId,
    title: &str,
    discovered: bool,
    reliability: i32,
    merits_effect: i16,
) -> Evidence {
    Evidence {
        id,
        title: title.to_owned(),
        discovered,
        disclosed_to_opponent: false,
        reliability: Score::new(reliability),
        merits_effect,
    }
}

fn is_assistant_decision(id: DecisionId) -> bool {
    matches!(
        id,
        DecisionId::ConsultAiCaseResearch
            | DecisionId::ConsultAiEvidenceReview
            | DecisionId::ConsultAiSettlementModel
    )
}

fn elapsed_days(id: DecisionId) -> u32 {
    use DecisionId::*;
    match id {
        HireIndependentExpert => 21,
        RecoverDeletedEmails => 10,
        AcceptSettlement => 2,
        PrepareWitnesses | FileLateEvidence => 30,
        _ => 3,
    }
}

fn option_for(id: DecisionId) -> DecisionOption {
    use DecisionId::*;
    let (label, description, hours, cost) = match id {
        RunConflictCheck => (
            "Run conflict check",
            "Verify whether the firm can ethically accept the client.",
            1,
            350,
        ),
        AcceptImmediately => (
            "Accept immediately",
            "Secure the client before completing formal checks.",
            0,
            0,
        ),
        RequestFullDocumentSet => (
            "Request full document set",
            "Review the contract, changes, acceptance records, and correspondence.",
            8,
            2_000,
        ),
        ConsultAiCaseResearch => (
            "Ask AI: case-law research",
            "Use the firm's assistant; its output still requires verification.",
            2,
            750,
        ),
        ConsultAiEvidenceReview => (
            "Ask AI: evidence review",
            "Ask for contradictions and missing links; the assistant can be wrong.",
            2,
            750,
        ),
        ConsultAiSettlementModel => (
            "Ask AI: settlement model",
            "Estimate litigation value using known—not hidden—facts.",
            2,
            750,
        ),
        SendAggressiveDemand => (
            "Send aggressive demand",
            "Demand full payment and threaten immediate proceedings.",
            3,
            900,
        ),
        OfferEarlyMediation => (
            "Offer early mediation",
            "Test whether the dispute can be resolved before litigation.",
            4,
            1_200,
        ),
        RecoverDeletedEmails => (
            "Recover deleted emails",
            "Commission forensic recovery of the finance director's mailbox.",
            12,
            5_500,
        ),
        HireIndependentExpert => (
            "Hire independent expert",
            "Obtain a technically credible ERP implementation report.",
            20,
            12_000,
        ),
        UseFormerVendorEmployee => (
            "Use former vendor employee",
            "Rely on an insider who may face a conflict challenge.",
            8,
            4_000,
        ),
        DiscloseAdverseEmails => (
            "Disclose adverse emails",
            "Comply fully despite damage to the client's narrative.",
            2,
            600,
        ),
        ConcealAdverseEmails => (
            "Conceal adverse emails",
            "Keep harmful correspondence away from the opponent.",
            0,
            0,
        ),
        AcceptSettlement => (
            "Accept settlement",
            "Resolve now for the dynamically calculated offer.",
            0,
            0,
        ),
        RejectSettlementAndLitigate => (
            "Reject and litigate",
            "Proceed to court for a potentially higher but uncertain recovery.",
            15,
            7_500,
        ),
        PrepareWitnesses => (
            "Prepare witnesses",
            "Invest in consistent and credible testimony.",
            18,
            8_000,
        ),
        FileLateEvidence => (
            "File late evidence",
            "Attempt a tactical late filing at significant procedural risk.",
            5,
            2_000,
        ),
    };
    DecisionOption {
        id,
        label: label.to_owned(),
        description: description.to_owned(),
        time_cost_hours: hours,
        monetary_cost_eur: cost,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn litigate_with_expert(seed: u64) -> CaseOutcome {
        let mut sim = Simulation::failed_erp_implementation(seed, GameMode::Career);
        sim.apply(DecisionId::RunConflictCheck).unwrap();
        sim.apply(DecisionId::RequestFullDocumentSet).unwrap();
        sim.apply(DecisionId::HireIndependentExpert).unwrap();
        sim.apply(DecisionId::OfferEarlyMediation).unwrap();
        sim.apply(DecisionId::RejectSettlementAndLitigate).unwrap();
        sim.apply(DecisionId::PrepareWitnesses).unwrap();
        sim.state().outcome.clone().unwrap()
    }

    #[test]
    fn identical_seed_and_decisions_produce_identical_outcome() {
        assert_eq!(
            litigate_with_expert(20260724),
            litigate_with_expert(20260724)
        );
    }

    #[test]
    fn expert_improves_position() {
        let mut sim = Simulation::failed_erp_implementation(7, GameMode::Career);
        sim.apply(DecisionId::RunConflictCheck).unwrap();
        sim.apply(DecisionId::RequestFullDocumentSet).unwrap();
        let before = sim.current_position_score();
        sim.apply(DecisionId::HireIndependentExpert).unwrap();
        assert!(sim.current_position_score() > before);
    }

    #[test]
    fn concealment_damages_ethics_and_procedure() {
        let mut sim = Simulation::failed_erp_implementation(9, GameMode::Career);
        sim.apply(DecisionId::RunConflictCheck).unwrap();
        sim.apply(DecisionId::RequestFullDocumentSet).unwrap();
        sim.apply(DecisionId::RecoverDeletedEmails).unwrap();
        let ethics = sim.state().ethical_standing.value();
        let procedure = sim.state().procedural_position.value();
        sim.apply(DecisionId::ConcealAdverseEmails).unwrap();
        assert!(sim.state().ethical_standing.value() < ethics);
        assert!(sim.state().procedural_position.value() < procedure);
    }

    #[test]
    fn hardcore_disables_internal_assistant() {
        let sim = Simulation::failed_erp_implementation(1, GameMode::Hardcore);
        assert!(!sim
            .available_decisions()
            .iter()
            .any(|x| x.id == DecisionId::ConsultAiCaseResearch));
    }

    #[test]
    fn assistant_usage_costs_time_and_money() {
        let mut sim = Simulation::failed_erp_implementation(3, GameMode::Assisted);
        let hours = sim.state().billable_hours;
        let spend = sim.state().budget_spent_eur;
        sim.apply(DecisionId::ConsultAiCaseResearch).unwrap();
        assert!(sim.state().billable_hours > hours);
        assert!(sim.state().budget_spent_eur > spend);
        assert_eq!(sim.state().assistant.requests_used, 1);
    }

    #[test]
    fn unavailable_decisions_are_rejected() {
        let mut sim = Simulation::failed_erp_implementation(1, GameMode::Career);
        assert_eq!(
            sim.apply(DecisionId::PrepareWitnesses),
            Err(SimulationError::DecisionUnavailable(
                DecisionId::PrepareWitnesses
            ))
        );
    }
}
