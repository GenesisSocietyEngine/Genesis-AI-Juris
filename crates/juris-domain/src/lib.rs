//! Legal and career domain model.
//!
//! These types describe state and intent, but contain almost no orchestration.
//! The engine owns transitions. This separation keeps the domain serializable,
//! testable, and usable by CLI, mobile, server, and replay tools.

use juris_core::SimMinute;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum GameMode {
    Career,
    Assisted,
    Hardcore,
    Tournament,
}

impl GameMode {
    pub fn allows_internal_ai(self) -> bool {
        matches!(self, Self::Career | Self::Assisted)
    }

    pub fn decision_seconds(self) -> Option<u32> {
        match self {
            Self::Hardcore => Some(90),
            Self::Tournament => Some(120),
            _ => None,
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub struct Score(i16);

impl Score {
    pub fn new(value: i16) -> Self {
        Self(value.clamp(0, 100))
    }

    pub fn value(self) -> i16 {
        self.0
    }

    pub fn adjust(&mut self, delta: i16) {
        self.0 = (self.0 + delta).clamp(0, 100);
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct Reputation {
    pub client_trust: Score,
    pub judicial_credibility: Score,
    pub peer_respect: Score,
    pub ethical_standing: Score,
    pub commercial_reputation: Score,
}

impl Default for Reputation {
    fn default() -> Self {
        Self {
            client_trust: Score::new(50),
            judicial_credibility: Score::new(50),
            peer_respect: Score::new(50),
            ethical_standing: Score::new(70),
            commercial_reputation: Score::new(45),
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum ActorId {
    Player,
    ClientCfo,
    ClientCeo,
    OpposingCounsel,
    Partner,
    AiAssociate,
    Judge,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct Actor {
    pub id: ActorId,
    pub name: String,
    pub role: String,
    pub trust_in_player: Score,
    pub pressure: Score,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum EvidenceId {
    SignedContract,
    ChangeRequests,
    ProjectEmails,
    DeletedMailbox,
    ConditionalAcceptance,
    IndependentExpertReport,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct Evidence {
    pub id: EvidenceId,
    pub title: String,
    pub discovered: bool,
    pub disclosed: bool,
    pub reliability: Score,
    pub merits_effect: i16,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum CaseStage {
    Intake,
    Investigation,
    PreLitigation,
    Litigation,
    Resolved,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum PlayerAction {
    RunConflictCheck,
    AcceptMatterImmediately,
    RequestDocuments,
    AskAiResearch,
    AskAiEvidenceReview,
    SendDemand,
    OfferMediation,
    RecoverDeletedMailbox,
    HireIndependentExpert,
    DiscloseAdverseEmails,
    ConcealAdverseEmails,
    AcceptSettlement,
    Litigate,
    PrepareWitnesses,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub enum WorldEvent {
    InboxMessage {
        from: ActorId,
        subject: String,
        body: String,
    },
    DeadlineWarning {
        label: String,
        minutes_remaining: u32,
    },
    ClientPressure,
    OpponentSettlementOffer {
        amount_eur: i64,
    },
    PartnerReview,
    Hearing,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub enum CaseOutcome {
    Settlement { amount_eur: i64 },
    Judgment {
        client_won: bool,
        damages_eur: i64,
        costs_awarded_eur: i64,
    },
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct AiUsage {
    pub requests_used: u8,
    pub request_limit: u8,
    pub last_note: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct MatterState {
    pub title: String,
    pub claim_value_eur: i64,
    pub now: SimMinute,
    pub stage: CaseStage,
    pub legal_merits: Score,
    pub evidence_quality: Score,
    pub procedural_position: Score,
    pub negotiation_leverage: Score,
    pub budget_spent_eur: i64,
    pub billable_minutes: u32,
    pub reputation: Reputation,
    pub actors: Vec<Actor>,
    pub evidence: Vec<Evidence>,
    pub action_history: Vec<PlayerAction>,
    pub ai_usage: AiUsage,
    pub inbox: Vec<String>,
    pub outcome: Option<CaseOutcome>,
}

impl MatterState {
    pub fn position_score(&self) -> i16 {
        ((self.legal_merits.value() * 30
            + self.evidence_quality.value() * 25
            + self.procedural_position.value() * 20
            + self.negotiation_leverage.value() * 15
            + self.reputation.judicial_credibility.value() * 10)
            / 100)
            .clamp(0, 100)
    }

    pub fn is_resolved(&self) -> bool {
        self.stage == CaseStage::Resolved
    }
}
