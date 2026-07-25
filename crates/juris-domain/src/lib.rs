//! Legal, professional, and workday domain model for GENESIS: AI Juris.
//!
//! This crate defines the nouns and typed intentions shared by the engine,
//! content loader, AI adapter, CLI, save files, and future clients. It contains
//! almost no orchestration: the engine is the only layer allowed to perform
//! authoritative state transitions.
//!
//! The separation is intentional. A presentation layer may display a deadline,
//! and an AI adapter may discuss a deadline, but neither can silently complete
//! it. They must submit a typed `PlayerAction` to the engine.

use juris_core::SimMinute;
use serde::{Deserialize, Serialize};

/// Ruleset selected for one simulation run.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum GameMode {
    /// Standard career progression with limited internal AI assistance.
    Career,
    /// More generous internal AI allowance for a first playthrough.
    Assisted,
    /// Timed decisions and no official in-game AI associate.
    Hardcore,
    /// Shared timing rules intended for identical-seed competitive runs.
    Tournament,
}

impl GameMode {
    /// Whether the official in-game AI associate is available.
    ///
    /// External tools are not technically blocked. The simulation is designed
    /// so evidence access, time, deadlines, ethics, and sequencing remain more
    /// important than the surface quality of generated prose.
    pub fn allows_internal_ai(self) -> bool {
        matches!(self, Self::Career | Self::Assisted)
    }

    /// Optional real-world decision timer displayed by presentation layers.
    pub fn decision_seconds(self) -> Option<u32> {
        match self {
            Self::Hardcore => Some(90),
            Self::Tournament => Some(120),
            _ => None,
        }
    }
}

/// Bounded zero-to-one-hundred value used for qualitative metrics.
///
/// A dedicated type centralizes clamping and prevents isolated systems from
/// creating impossible values such as trust `143` or ethics `-20`.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub struct Score(i16);

impl Score {
    /// Constructs a score and clamps the supplied value into the valid range.
    pub fn new(value: i16) -> Self {
        Self(value.clamp(0, 100))
    }

    /// Returns the primitive value for arithmetic and presentation.
    pub fn value(self) -> i16 {
        self.0
    }

    /// Applies a signed delta while preserving the score invariant.
    pub fn adjust(&mut self, delta: i16) {
        self.0 = (self.0 + delta).clamp(0, 100);
    }
}

/// Long-term professional reputation dimensions affected by one matter.
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

/// Stable identity of an actor participating in the matter.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum ActorId {
    Player,
    ClientCfo,
    ClientCeo,
    OpposingCounsel,
    Partner,
    JuniorAssociate,
    AiAssociate,
    Judge,
    CourtRegistry,
}

/// Mutable relationship state for one actor.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct Actor {
    pub id: ActorId,
    pub name: String,
    pub role: String,
    pub trust_in_player: Score,
    pub pressure: Score,
}

/// Stable identifier for evidence in the first ERP dispute.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum EvidenceId {
    SignedContract,
    ChangeRequests,
    ProjectEmails,
    DeletedMailbox,
    ConditionalAcceptance,
    OpponentProjectLog,
    IndependentExpertReport,
}

/// One potentially discoverable evidentiary item.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct Evidence {
    pub id: EvidenceId,
    pub title: String,
    pub discovered: bool,
    pub disclosed: bool,
    pub reliability: Score,
    pub merits_effect: i16,
}

/// Procedural phase used to organize actions and presentation.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum CaseStage {
    Intake,
    Investigation,
    PreLitigation,
    Pleadings,
    Disclosure,
    ExpertEvidence,
    HearingPreparation,
    Hearing,
    Resolved,
}

/// Typed player intention submitted to the engine.
///
/// The CLI never submits free-form mutations such as "increase merits by 5".
/// It submits one action, and the engine alone decides its lawful consequences.
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash, Serialize, Deserialize)]
pub enum PlayerAction {
    RunConflictCheck,
    AcceptMatterImmediately,
    ReplyToClient,
    ReplyToCfo,
    SendPartnerBrief,
    IssuePreservationNotice,
    RequestDocuments,
    DelegateDocumentReview,
    ReviewJuniorReport,
    RecoverDeletedMailbox,
    DiscloseAdverseEmails,
    ConcealAdverseEmails,
    CommissionIndependentExpert,
    ReviewExpertReport,
    SendDemand,
    OfferMediation,
    AskAiResearch,
    AskAiEvidenceReview,
    AskAiDamagesModel,
    AskAiDraftReview,
    AskAiHearingPreparation,
    AcceptSettlement,
    Litigate,
    DraftStatementOfClaim,
    FileStatementOfClaim,
    ServeDisclosure,
    ReviewOpponentDisclosure,
    ProceedWithoutExpert,
    PrepareWitnesses,
    RehearseHearing,
    AttendHearing,
    RestUntilNextWorkday,
}

/// Human-readable metadata for one currently available action.
///
/// Labels are presentation data, while `action` remains the stable typed value
/// used by tests, replays, and future network protocols.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ActionOption {
    pub action: PlayerAction,
    pub label: &'static str,
    pub description: &'static str,
    pub player_minutes: u32,
    pub monetary_cost_eur: i64,
}

/// Stable inbox message ID assigned by the engine.
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Serialize, Deserialize)]
pub struct MessageId(pub u64);

/// Semantic purpose of a message.
///
/// The engine connects replies to this type instead of parsing subject lines or
/// AI-generated text, which keeps mechanics deterministic and localization-safe.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum InboxMessageKind {
    OpeningClientRequest,
    ClientPressure,
    PartnerBriefRequest,
    SettlementOffer,
    DeadlineWarning,
    DeadlineMissed,
    JuniorReport,
    ExpertReport,
    OpponentDisclosure,
    CourtNotice,
    General,
}

/// One message visible in the player's active inbox.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct InboxMessage {
    pub id: MessageId,
    pub received_at: SimMinute,
    pub from: ActorId,
    pub kind: InboxMessageKind,
    pub subject: String,
    pub body: String,
    pub requires_response: bool,
    pub handled: bool,
}

/// Deadline categories with distinct professional consequences.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum DeadlineId {
    PartnerBrief,
    PreservationNotice,
    StatementOfClaim,
}

/// Lifecycle of a deadline.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum DeadlineStatus {
    Open,
    Completed,
    Missed,
}

/// One tracked professional or procedural deadline.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct Deadline {
    pub id: DeadlineId,
    pub label: String,
    pub due: SimMinute,
    pub status: DeadlineStatus,
}

/// Work that may be delegated to a junior associate.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum DelegatedTask {
    DocumentReview,
}

/// State of the junior-associate delegation pipeline.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct DelegationState {
    pub in_progress: Option<DelegatedTask>,
    pub completed: Option<DelegatedTask>,
    pub reports_reviewed: u8,
}

/// Workload and fatigue accumulated by the player.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct WorkState {
    /// Calendar day whose `minutes_worked_today` counter is active.
    pub tracked_day: u32,
    /// Player time spent on legal actions during the tracked day.
    pub minutes_worked_today: u32,
    /// Soft capacity; work beyond this threshold creates stronger fatigue.
    pub daily_capacity_minutes: u32,
    /// Persistent fatigue reduced only by deliberate rest.
    pub fatigue: Score,
    /// Career statistic useful for later performance reviews.
    pub overtime_minutes_total: u32,
}

/// Detailed state for the multi-stage litigation pipeline.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct LitigationState {
    pub statement_drafted: bool,
    pub statement_filed: bool,
    pub disclosure_served: bool,
    pub opponent_disclosure_received: bool,
    pub opponent_disclosure_reviewed: bool,
    pub expert_commissioned: bool,
    pub expert_report_ready: bool,
    pub expert_report_reviewed: bool,
    pub proceeded_without_expert: bool,
    pub witnesses_prepared: bool,
    pub hearing_rehearsed: bool,
    pub hearing_scheduled_for: Option<SimMinute>,
}

/// Accounting for use of the official in-game AI associate.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct AiUsage {
    pub requests_used: u8,
    pub request_limit: u8,
    pub last_note: Option<String>,
}

/// Scheduled event payload owned by the engine until its due minute.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub enum WorldEvent {
    InboxMessage {
        from: ActorId,
        kind: InboxMessageKind,
        subject: String,
        body: String,
        requires_response: bool,
    },
    DeadlineWarning {
        deadline_id: DeadlineId,
        minutes_remaining: u32,
    },
    DeadlineReached {
        deadline_id: DeadlineId,
    },
    ClientPressure,
    PartnerReview,
    OpponentSettlementOffer {
        amount_eur: i64,
    },
    JuniorTaskCompleted {
        task: DelegatedTask,
    },
    ExpertReportCompleted,
    OpponentDisclosureReceived,
    HearingReady,
}

/// One transparent modifier applied to the hearing win threshold.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct OutcomeFactor {
    pub label: String,
    pub modifier: i16,
}

/// Explainable deterministic calculation behind a judgment.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct JudgmentBreakdown {
    /// Position score before hearing-specific modifiers.
    pub base_position: i16,
    /// Named additions and deductions shown to the player.
    pub factors: Vec<OutcomeFactor>,
    /// Final percentage threshold after all modifiers and clamping.
    pub win_threshold: u8,
    /// Seeded roll in the inclusive range `1..=100`.
    pub deterministic_roll: u8,
}

/// Terminal result of the matter.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub enum CaseOutcome {
    Settlement {
        amount_eur: i64,
        net_after_legal_spend_eur: i64,
    },
    Judgment {
        client_won: bool,
        damages_eur: i64,
        costs_awarded_eur: i64,
        breakdown: JudgmentBreakdown,
    },
}

/// Complete serializable state of the currently simulated matter.
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
    pub hearing_preparation: Score,
    pub budget_spent_eur: i64,
    pub billable_minutes: u32,
    pub reputation: Reputation,
    pub work: WorkState,
    pub delegation: DelegationState,
    pub litigation: LitigationState,
    pub actors: Vec<Actor>,
    pub evidence: Vec<Evidence>,
    pub deadlines: Vec<Deadline>,
    pub action_history: Vec<PlayerAction>,
    pub ai_usage: AiUsage,
    pub inbox: Vec<InboxMessage>,
    pub settlement_offer_eur: Option<i64>,
    pub outcome: Option<CaseOutcome>,
}

impl MatterState {
    /// Weighted case position before hearing-specific modifiers.
    ///
    /// Integer arithmetic is deliberate: exact replays must not depend on
    /// floating-point implementation details. Hearing preparation is shown as a
    /// separate final factor so the judgment explanation remains intelligible.
    pub fn position_score(&self) -> i16 {
        ((self.legal_merits.value() * 30
            + self.evidence_quality.value() * 25
            + self.procedural_position.value() * 20
            + self.negotiation_leverage.value() * 15
            + self.reputation.judicial_credibility.value() * 10)
            / 100)
            .clamp(0, 100)
    }

    /// Number of messages still requiring an explicit player response.
    pub fn unhandled_required_messages(&self) -> usize {
        self.inbox
            .iter()
            .filter(|message| message.requires_response && !message.handled)
            .count()
    }

    /// Whether the matter has reached a terminal outcome.
    pub fn is_resolved(&self) -> bool {
        self.stage == CaseStage::Resolved
    }
}
