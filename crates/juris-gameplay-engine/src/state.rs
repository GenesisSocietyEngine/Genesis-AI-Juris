use crate::{
    AppealState, CaseReport, CassationOutcome, CassationState, ClientAuthorization,
    DecisionOutcome, DomainEvent, EngagementStatus, GameMinute, LossKind, MandatoryHearing,
    MatterResult, ProceduralStage, SimulationClock,
};
use serde::{Deserialize, Serialize};
use thiserror::Error;

/// Engine thresholds and remedy windows, expressed only in game minutes.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub struct GameplayConfig {
    inactivity_warning_after_minutes: u64,
    inactivity_final_warning_after_minutes: u64,
    inactivity_termination_after_minutes: u64,
    appeal_window_minutes: u64,
    cassation_window_minutes: u64,
}

impl Default for GameplayConfig {
    fn default() -> Self {
        Self {
            inactivity_warning_after_minutes: 180,
            inactivity_final_warning_after_minutes: 300,
            inactivity_termination_after_minutes: 480,
            appeal_window_minutes: 7 * 24 * 60,
            cassation_window_minutes: 30 * 24 * 60,
        }
    }
}

impl GameplayConfig {
    /// Creates a configuration.
    pub fn new(
        inactivity_warning_after_minutes: u64,
        inactivity_final_warning_after_minutes: u64,
        inactivity_termination_after_minutes: u64,
        appeal_window_minutes: u64,
        cassation_window_minutes: u64,
    ) -> Result<Self, StateInvariantError> {
        let config = Self {
            inactivity_warning_after_minutes,
            inactivity_final_warning_after_minutes,
            inactivity_termination_after_minutes,
            appeal_window_minutes,
            cassation_window_minutes,
        };
        config.validate()?;
        Ok(config)
    }

    /// First inactivity warning threshold.
    #[must_use]
    pub const fn inactivity_warning_after_minutes(self) -> u64 {
        self.inactivity_warning_after_minutes
    }

    /// Final inactivity warning threshold.
    #[must_use]
    pub const fn inactivity_final_warning_after_minutes(self) -> u64 {
        self.inactivity_final_warning_after_minutes
    }

    /// Client-termination threshold.
    #[must_use]
    pub const fn inactivity_termination_after_minutes(self) -> u64 {
        self.inactivity_termination_after_minutes
    }

    /// Appeal filing window.
    #[must_use]
    pub const fn appeal_window_minutes(self) -> u64 {
        self.appeal_window_minutes
    }

    /// Cassation filing window.
    #[must_use]
    pub const fn cassation_window_minutes(self) -> u64 {
        self.cassation_window_minutes
    }

    pub(crate) fn validate(self) -> Result<(), StateInvariantError> {
        if self.inactivity_warning_after_minutes == 0
            || self.inactivity_warning_after_minutes >= self.inactivity_final_warning_after_minutes
            || self.inactivity_final_warning_after_minutes
                >= self.inactivity_termination_after_minutes
        {
            return Err(StateInvariantError::InvalidInactivityThresholds);
        }

        if self.appeal_window_minutes == 0 || self.cassation_window_minutes == 0 {
            return Err(StateInvariantError::InvalidRemedyWindow);
        }

        Ok(())
    }
}

/// Complete authoritative gameplay state.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct GameplayState {
    config: GameplayConfig,
    clock: SimulationClock,
    stage: ProceduralStage,
    engagement: EngagementStatus,
    result: MatterResult,
    last_substantive_activity_at: GameMinute,
    inactivity_warning_issued: bool,
    inactivity_final_warning_issued: bool,
    hearing: Option<MandatoryHearing>,
    procedural_default: bool,
    first_instance_outcome: Option<DecisionOutcome>,
    appeal: AppealState,
    cassation: CassationState,
    closure_count: u32,
    case_report_count: u32,
    case_report: Option<CaseReport>,
}

impl GameplayState {
    pub(crate) fn new(config: GameplayConfig) -> Result<Self, StateInvariantError> {
        config.validate()?;
        Ok(Self {
            config,
            clock: SimulationClock::default(),
            stage: ProceduralStage::Intake,
            engagement: EngagementStatus::Active,
            result: MatterResult::Undecided,
            last_substantive_activity_at: GameMinute::ZERO,
            inactivity_warning_issued: false,
            inactivity_final_warning_issued: false,
            hearing: None,
            procedural_default: false,
            first_instance_outcome: None,
            appeal: AppealState::default(),
            cassation: CassationState::default(),
            closure_count: 0,
            case_report_count: 0,
            case_report: None,
        })
    }

    /// Engine configuration.
    #[must_use]
    pub const fn config(&self) -> GameplayConfig {
        self.config
    }

    /// Simulation clock.
    #[must_use]
    pub fn clock(&self) -> &SimulationClock {
        &self.clock
    }

    /// Procedural stage.
    #[must_use]
    pub const fn stage(&self) -> ProceduralStage {
        self.stage
    }

    /// Engagement status.
    #[must_use]
    pub const fn engagement(&self) -> EngagementStatus {
        self.engagement
    }

    /// Current result.
    #[must_use]
    pub const fn result(&self) -> MatterResult {
        self.result
    }

    /// Last substantive-activity time.
    #[must_use]
    pub const fn last_substantive_activity_at(&self) -> GameMinute {
        self.last_substantive_activity_at
    }

    /// Whether the first inactivity warning was issued in the current cycle.
    #[must_use]
    pub const fn inactivity_warning_issued(&self) -> bool {
        self.inactivity_warning_issued
    }

    /// Whether the final inactivity warning was issued in the current cycle.
    #[must_use]
    pub const fn inactivity_final_warning_issued(&self) -> bool {
        self.inactivity_final_warning_issued
    }

    /// Scheduled hearing.
    #[must_use]
    pub const fn hearing(&self) -> Option<MandatoryHearing> {
        self.hearing
    }

    /// Whether a mandatory procedural default has occurred.
    #[must_use]
    pub const fn procedural_default(&self) -> bool {
        self.procedural_default
    }

    /// First-instance outcome.
    #[must_use]
    pub const fn first_instance_outcome(&self) -> Option<DecisionOutcome> {
        self.first_instance_outcome
    }

    /// Appeal state.
    #[must_use]
    pub fn appeal(&self) -> &AppealState {
        &self.appeal
    }

    /// Cassation state.
    #[must_use]
    pub fn cassation(&self) -> &CassationState {
        &self.cassation
    }

    /// Number of terminal closure events applied to this aggregate.
    #[must_use]
    pub const fn closure_count(&self) -> u32 {
        self.closure_count
    }

    /// Number of case-report events applied to this aggregate.
    #[must_use]
    pub const fn case_report_count(&self) -> u32 {
        self.case_report_count
    }

    /// Terminal case report.
    #[must_use]
    pub fn case_report(&self) -> Option<&CaseReport> {
        self.case_report.as_ref()
    }

    /// Whether the matter is terminally closed.
    #[must_use]
    pub const fn is_terminal(&self) -> bool {
        matches!(self.stage, ProceduralStage::Closed)
    }

    pub(crate) fn apply(&mut self, event: &DomainEvent) {
        match event {
            DomainEvent::MatterOpened => {
                self.stage = ProceduralStage::Pleadings;
                self.last_substantive_activity_at = self.clock.now();
                self.inactivity_warning_issued = false;
                self.inactivity_final_warning_issued = false;
            }
            DomainEvent::PleadingsCompleted => {
                self.stage = ProceduralStage::Evidence;
                self.last_substantive_activity_at = self.clock.now();
                self.inactivity_warning_issued = false;
                self.inactivity_final_warning_issued = false;
            }
            DomainEvent::EvidenceCompleted => {
                self.stage = ProceduralStage::HearingPreparation;
                self.last_substantive_activity_at = self.clock.now();
                self.inactivity_warning_issued = false;
                self.inactivity_final_warning_issued = false;
            }
            DomainEvent::ClockPaused => self.clock.pause(),
            DomainEvent::ClockResumed => self.clock.resume(),
            DomainEvent::ClockSpeedChanged { speed } => self.clock.set_speed(*speed),
            DomainEvent::RealTimeTicked { advance, .. } => self.clock.apply_advance(*advance),
            DomainEvent::CommandIgnored { .. } => {}
            DomainEvent::SubstantiveWorkRecorded { at } => {
                self.last_substantive_activity_at = *at;
                self.inactivity_warning_issued = false;
                self.inactivity_final_warning_issued = false;
            }
            DomainEvent::InactivityWarningIssued { .. } => {
                self.inactivity_warning_issued = true;
            }
            DomainEvent::FinalInactivityWarningIssued { .. } => {
                self.inactivity_final_warning_issued = true;
            }
            DomainEvent::EngagementTerminatedForInactivity { .. } => {
                self.engagement = EngagementStatus::TerminatedByClient;
                self.result = MatterResult::EngagementTerminated;
            }
            DomainEvent::MandatoryHearingScheduled {
                opens_at,
                grace_ends_at,
            } => {
                self.hearing = Some(MandatoryHearing::scheduled(*opens_at, *grace_ends_at));
            }
            DomainEvent::MandatoryHearingOpened { .. } => {
                self.stage = ProceduralStage::HearingOpen;
            }
            DomainEvent::MandatoryHearingAttended { at } => {
                if let Some(hearing) = &mut self.hearing {
                    hearing.mark_attended(*at);
                }
                self.stage = ProceduralStage::JudgmentPending;
            }
            DomainEvent::MandatoryHearingMissed { at } => {
                if let Some(hearing) = &mut self.hearing {
                    hearing.mark_missed(*at);
                }
                self.procedural_default = true;
                self.stage = ProceduralStage::JudgmentPending;
            }
            DomainEvent::FirstInstanceJudgmentDelivered {
                effective_outcome,
                appeal_deadline,
                ..
            } => {
                self.first_instance_outcome = Some(*effective_outcome);
                self.stage = ProceduralStage::FirstInstanceJudgmentDelivered;

                match effective_outcome {
                    DecisionOutcome::Won => {
                        self.result = MatterResult::WonAtFirstInstance;
                    }
                    DecisionOutcome::PartiallyWon => {
                        self.result = MatterResult::PartiallyWonAtFirstInstance;
                    }
                    DecisionOutcome::Lost(_) => {
                        self.result = MatterResult::LostAtFirstInstance;
                        self.engagement = EngagementStatus::AwaitingClientInstructions;
                        if let Some(deadline) = appeal_deadline {
                            self.appeal.open(*deadline);
                        }
                    }
                }
            }
            DomainEvent::AppealAdvicePrepared { .. } => {
                self.appeal.mark_advice_prepared();
                self.stage = ProceduralStage::AppealAdvice;
            }
            DomainEvent::AppealAuthorizationRequested { .. } => {
                self.appeal.request_authorization();
                self.stage = ProceduralStage::AwaitingAppealInstructions;
                self.engagement = EngagementStatus::AwaitingClientInstructions;
            }
            DomainEvent::AppealAuthorizationRecorded { approved, .. } => {
                self.appeal.record_authorization(*approved);
            }
            DomainEvent::AppealFiled { at } => {
                self.appeal.mark_filed(*at);
                self.stage = ProceduralStage::AppealPending;
                self.engagement = EngagementStatus::Active;
                self.last_substantive_activity_at = *at;
                self.inactivity_warning_issued = false;
                self.inactivity_final_warning_issued = false;
            }
            DomainEvent::AppealDeadlineExpired { .. } => {}
            DomainEvent::AppealJudgmentDelivered {
                outcome,
                cassation_deadline,
                ..
            } => {
                self.appeal.record_outcome(*outcome);
                self.stage = ProceduralStage::AppealJudgmentDelivered;

                match outcome {
                    DecisionOutcome::Won => {
                        self.result = MatterResult::WonOnAppeal;
                    }
                    DecisionOutcome::PartiallyWon => {
                        self.result = MatterResult::PartiallyWonOnAppeal;
                    }
                    DecisionOutcome::Lost(_) => {
                        self.result = MatterResult::LostOnAppeal;
                        self.engagement = EngagementStatus::AwaitingClientInstructions;
                        if let Some(deadline) = cassation_deadline {
                            self.cassation.open(*deadline);
                        }
                    }
                }
            }
            DomainEvent::CassationGroundsAssessed {
                alleged_grounds,
                viable_grounds,
                ..
            } => {
                self.cassation
                    .assess(alleged_grounds.clone(), viable_grounds.clone());
                self.stage = ProceduralStage::CassationAssessment;
            }
            DomainEvent::CassationAuthorizationRequested { .. } => {
                self.cassation.request_authorization();
                self.stage = ProceduralStage::AwaitingCassationInstructions;
                self.engagement = EngagementStatus::AwaitingClientInstructions;
            }
            DomainEvent::CassationAuthorizationRecorded { approved, .. } => {
                self.cassation.record_authorization(*approved);
            }
            DomainEvent::CassationFiled { at } => {
                self.cassation.mark_filed(*at);
                self.stage = ProceduralStage::CassationPending;
                self.engagement = EngagementStatus::Active;
                self.last_substantive_activity_at = *at;
                self.inactivity_warning_issued = false;
                self.inactivity_final_warning_issued = false;
            }
            DomainEvent::CassationDeadlineExpired { .. } => {}
            DomainEvent::CassationDecisionDelivered { outcome, .. } => {
                self.cassation.record_outcome(*outcome);
                match outcome {
                    CassationOutcome::Dismissed => {
                        self.result = MatterResult::CassationDismissed;
                    }
                    CassationOutcome::QuashedAndRemitted
                    | CassationOutcome::PartiallyQuashedAndRemitted => {
                        self.result = MatterResult::RemittedAfterCassation;
                        self.stage = ProceduralStage::Remitted;
                        self.engagement = EngagementStatus::Active;
                    }
                }
            }
            DomainEvent::MatterClosed { final_result, .. } => {
                self.closure_count = self.closure_count.saturating_add(1);
                self.stage = ProceduralStage::Closed;
                self.result = *final_result;
                if !matches!(self.engagement, EngagementStatus::TerminatedByClient) {
                    self.engagement = EngagementStatus::Completed;
                }
            }
            DomainEvent::CaseReportGenerated { report } => {
                self.case_report_count = self.case_report_count.saturating_add(1);
                self.case_report = Some(report.clone());
            }
        }
    }

    pub(crate) fn validate(&self) -> Result<(), StateInvariantError> {
        self.config.validate()?;

        if let Some(hearing) = self.hearing {
            if hearing.was_attended() && hearing.was_missed() {
                return Err(StateInvariantError::HearingBothAttendedAndMissed);
            }
            if hearing.grace_ends_at() <= hearing.opens_at() {
                return Err(StateInvariantError::InvalidHearingWindow);
            }
        }

        if self.appeal.filed_at().is_some()
            && self.appeal.authorization() != ClientAuthorization::Approved
        {
            return Err(StateInvariantError::AppealFiledWithoutAuthorization);
        }

        if self.cassation.filed_at().is_some() {
            if self.cassation.authorization() != ClientAuthorization::Approved {
                return Err(StateInvariantError::CassationFiledWithoutAuthorization);
            }
            if self.cassation.viable_grounds().is_empty() {
                return Err(StateInvariantError::CassationFiledWithoutViableGround);
            }
        }

        if self.closure_count > 1 {
            return Err(StateInvariantError::DuplicateClosure);
        }

        if self.case_report_count > 1 {
            return Err(StateInvariantError::DuplicateCaseReport);
        }

        if self.case_report.is_some() != (self.case_report_count == 1) {
            return Err(StateInvariantError::CaseReportCountMismatch);
        }

        if self.is_terminal() {
            if self.closure_count != 1 || self.case_report_count != 1 {
                return Err(StateInvariantError::ClosedMatterWithoutReport);
            }
        } else if self.closure_count != 0 || self.case_report_count != 0 {
            return Err(StateInvariantError::ReportOnOpenMatter);
        }

        if matches!(self.stage, ProceduralStage::Remitted)
            != matches!(self.result, MatterResult::RemittedAfterCassation)
        {
            return Err(StateInvariantError::InvalidRemittalState);
        }

        if self.procedural_default
            && !matches!(
                self.first_instance_outcome,
                None | Some(DecisionOutcome::Lost(LossKind::ProceduralDefault))
            )
        {
            return Err(StateInvariantError::ProceduralDefaultOverridden);
        }

        Ok(())
    }
}

/// Invalid state or configuration.
#[derive(Debug, Clone, PartialEq, Eq, Error)]
pub enum StateInvariantError {
    /// Inactivity thresholds must be positive and strictly increasing.
    #[error("inactivity thresholds must be positive and strictly increasing")]
    InvalidInactivityThresholds,

    /// Remedy windows must be positive.
    #[error("appeal and cassation windows must be positive")]
    InvalidRemedyWindow,

    /// Hearing closing time must be later than opening time.
    #[error("invalid mandatory hearing window")]
    InvalidHearingWindow,

    /// Hearing cannot be both attended and missed.
    #[error("mandatory hearing cannot be both attended and missed")]
    HearingBothAttendedAndMissed,

    /// Appeal was filed without client approval.
    #[error("appeal filed without client authorization")]
    AppealFiledWithoutAuthorization,

    /// Cassation was filed without client approval.
    #[error("cassation filed without client authorization")]
    CassationFiledWithoutAuthorization,

    /// Cassation was filed without a cognizable legal ground.
    #[error("cassation filed without a viable legal ground")]
    CassationFiledWithoutViableGround,

    /// More than one terminal closure event was applied.
    #[error("matter was closed more than once")]
    DuplicateClosure,

    /// More than one case report was generated.
    #[error("case report was generated more than once")]
    DuplicateCaseReport,

    /// Stored case-report value and event count disagree.
    #[error("case report value and generation count are inconsistent")]
    CaseReportCountMismatch,

    /// Open matter contains terminal closure/report state.
    #[error("terminal closure or case report exists for a non-terminal matter")]
    ReportOnOpenMatter,

    /// Closed matter lacks its immutable report.
    #[error("closed matter has no case report")]
    ClosedMatterWithoutReport,

    /// Remittal stage and result disagree.
    #[error("remittal stage and result are inconsistent")]
    InvalidRemittalState,

    /// A procedural default was replaced with a non-default outcome.
    #[error("procedural default outcome was overridden")]
    ProceduralDefaultOverridden,
}
