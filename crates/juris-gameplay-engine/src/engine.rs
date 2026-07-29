use crate::{
    AllegedCassationGround, CaseReport, CassationGround, CassationOutcome, ClientAuthorization,
    ClosureReason, CommandId, DecisionOutcome, DomainEvent, EngagementStatus, EngineError,
    GameMinute, GameplayCommand, GameplayConfig, GameplayState, IgnoredCommandReason, LossKind,
    MatterResult, ProceduralStage, ProfessionalConsequences, RecordedEvent,
};
use std::collections::BTreeSet;

/// Result of one command execution.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct CommandReceipt {
    duplicate: bool,
    events: Vec<RecordedEvent>,
}

impl CommandReceipt {
    /// Whether the command identifier had already been processed.
    #[must_use]
    pub const fn is_duplicate(&self) -> bool {
        self.duplicate
    }

    /// Events recorded by this execution.
    #[must_use]
    pub fn events(&self) -> &[RecordedEvent] {
        &self.events
    }
}

/// Authoritative deterministic gameplay engine.
///
/// A command is decided against a cloned state, all resulting events are applied
/// to that clone, and invariants are checked before anything is committed. This
/// atomic transaction model prevents partially applied fixes and half-updated
/// lifecycle state.
#[derive(Debug, Clone)]
pub struct GameplayEngine {
    state: GameplayState,
    events: Vec<RecordedEvent>,
    processed_commands: BTreeSet<CommandId>,
}

impl GameplayEngine {
    /// Creates a new engine.
    pub fn new(config: GameplayConfig) -> Result<Self, EngineError> {
        Ok(Self {
            state: GameplayState::new(config)?,
            events: Vec::new(),
            processed_commands: BTreeSet::new(),
        })
    }

    /// Returns the authoritative current state.
    #[must_use]
    pub fn state(&self) -> &GameplayState {
        &self.state
    }

    /// Returns the complete event log.
    #[must_use]
    pub fn events(&self) -> &[RecordedEvent] {
        &self.events
    }

    /// Executes one idempotent command.
    pub fn execute(
        &mut self,
        command_id: CommandId,
        command: GameplayCommand,
    ) -> Result<CommandReceipt, EngineError> {
        if self.processed_commands.contains(&command_id) {
            return Ok(CommandReceipt {
                duplicate: true,
                events: Vec::new(),
            });
        }

        let mut decision = DecisionContext::new(self.state.clone());
        decision.decide(command)?;
        let (next_state, domain_events) = decision.finish()?;

        let mut records = Vec::with_capacity(domain_events.len());
        for event in domain_events {
            let sequence = u64::try_from(self.events.len())
                .map_err(|_| EngineError::InvalidReplay("event count overflow".to_owned()))?
                .checked_add(1)
                .ok_or_else(|| EngineError::InvalidReplay("event sequence overflow".to_owned()))?;
            let record = RecordedEvent::new(sequence, command_id.clone(), event);
            self.events.push(record.clone());
            records.push(record);
        }

        self.state = next_state;
        self.processed_commands.insert(command_id);

        Ok(CommandReceipt {
            duplicate: false,
            events: records,
        })
    }

    /// Rebuilds an engine from its recorded event stream.
    ///
    /// Sequences must start at 1 and remain contiguous. Events produced by one
    /// command must remain contiguous as well; reusing a command identifier in a
    /// later batch is rejected.
    pub fn replay(
        config: GameplayConfig,
        records: impl IntoIterator<Item = RecordedEvent>,
    ) -> Result<Self, EngineError> {
        let mut state = GameplayState::new(config)?;
        let mut events = Vec::new();
        let mut processed_commands = BTreeSet::new();
        let mut active_command: Option<CommandId> = None;
        let mut expected_sequence = 1_u64;

        for record in records {
            if record.sequence() != expected_sequence {
                let actual_sequence = record.sequence();
                return Err(EngineError::InvalidReplay(format!(
                    "expected sequence {expected_sequence}, found {actual_sequence}"
                )));
            }
            expected_sequence = expected_sequence
                .checked_add(1)
                .ok_or_else(|| EngineError::InvalidReplay("event sequence overflow".to_owned()))?;

            let command_id = record.command_id().clone();
            if active_command.as_ref() != Some(&command_id) {
                if processed_commands.contains(&command_id) {
                    let reused_command_id = command_id.as_str();
                    return Err(EngineError::InvalidReplay(format!(
                        "command id {reused_command_id} appears in multiple event batches"
                    )));
                }
                processed_commands.insert(command_id.clone());
                active_command = Some(command_id);
            }

            state.apply(record.event());
            events.push(record);
        }

        state.validate()?;

        Ok(Self {
            state,
            events,
            processed_commands,
        })
    }
}

#[derive(Debug)]
struct DecisionContext {
    state: GameplayState,
    events: Vec<DomainEvent>,
}

impl DecisionContext {
    fn new(state: GameplayState) -> Self {
        Self {
            state,
            events: Vec::new(),
        }
    }

    fn finish(self) -> Result<(GameplayState, Vec<DomainEvent>), EngineError> {
        if self.events.is_empty() {
            return Err(EngineError::EmptyDecision);
        }
        self.state.validate()?;
        Ok((self.state, self.events))
    }

    fn emit(&mut self, event: DomainEvent) {
        self.state.apply(&event);
        self.events.push(event);
    }

    fn decide(&mut self, command: GameplayCommand) -> Result<(), EngineError> {
        match command {
            GameplayCommand::OpenMatter => self.open_matter(),
            GameplayCommand::CompletePleadings => self.complete_pleadings(),
            GameplayCommand::CompleteEvidence => self.complete_evidence(),
            GameplayCommand::PauseClock => {
                self.pause_clock();
                Ok(())
            }
            GameplayCommand::ResumeClock => {
                self.resume_clock();
                Ok(())
            }
            GameplayCommand::SetClockSpeed { speed } => {
                self.set_clock_speed(speed);
                Ok(())
            }
            GameplayCommand::TickRealTime { elapsed_ms } => self.tick_real_time(elapsed_ms),
            GameplayCommand::RecordSubstantiveWork => self.record_substantive_work(),
            GameplayCommand::ScheduleMandatoryHearing {
                opens_at,
                grace_minutes,
            } => self.schedule_mandatory_hearing(opens_at, grace_minutes),
            GameplayCommand::AttendMandatoryHearing => self.attend_mandatory_hearing(),
            GameplayCommand::DeliverFirstInstanceJudgment { proposed_outcome } => {
                self.deliver_first_instance_judgment(proposed_outcome)
            }
            GameplayCommand::PrepareAppealAdvice => self.prepare_appeal_advice(),
            GameplayCommand::RequestAppealAuthorization => self.request_appeal_authorization(),
            GameplayCommand::RecordAppealAuthorization { approved } => {
                self.record_appeal_authorization(approved)
            }
            GameplayCommand::FileAppeal => self.file_appeal(),
            GameplayCommand::DeliverAppealJudgment { outcome } => {
                self.deliver_appeal_judgment(outcome)
            }
            GameplayCommand::AssessCassationGrounds { alleged_grounds } => {
                self.assess_cassation_grounds(alleged_grounds)
            }
            GameplayCommand::RequestCassationAuthorization => {
                self.request_cassation_authorization()
            }
            GameplayCommand::RecordCassationAuthorization { approved } => {
                self.record_cassation_authorization(approved)
            }
            GameplayCommand::FileCassation => self.file_cassation(),
            GameplayCommand::DeliverCassationDecision { outcome } => {
                self.deliver_cassation_decision(outcome)
            }
            GameplayCommand::AcceptCurrentJudgmentAndClose => {
                self.accept_current_judgment_and_close()
            }
        }
    }

    fn open_matter(&mut self) -> Result<(), EngineError> {
        self.require_stage(ProceduralStage::Intake, "open matter")?;
        self.emit(DomainEvent::MatterOpened);
        Ok(())
    }

    fn complete_pleadings(&mut self) -> Result<(), EngineError> {
        self.require_stage(ProceduralStage::Pleadings, "complete pleadings")?;
        self.emit(DomainEvent::PleadingsCompleted);
        Ok(())
    }

    fn complete_evidence(&mut self) -> Result<(), EngineError> {
        self.require_stage(ProceduralStage::Evidence, "complete evidence")?;
        self.emit(DomainEvent::EvidenceCompleted);
        Ok(())
    }

    fn pause_clock(&mut self) {
        if self.state.is_terminal() {
            self.emit(DomainEvent::CommandIgnored {
                reason: IgnoredCommandReason::MatterAlreadyClosed,
            });
        } else if self.state.clock().is_paused() {
            self.emit(DomainEvent::CommandIgnored {
                reason: IgnoredCommandReason::ClockAlreadyPaused,
            });
        } else {
            self.emit(DomainEvent::ClockPaused);
        }
    }

    fn resume_clock(&mut self) {
        if self.state.is_terminal() {
            self.emit(DomainEvent::CommandIgnored {
                reason: IgnoredCommandReason::MatterAlreadyClosed,
            });
        } else if !self.state.clock().is_paused() {
            self.emit(DomainEvent::CommandIgnored {
                reason: IgnoredCommandReason::ClockAlreadyRunning,
            });
        } else {
            self.emit(DomainEvent::ClockResumed);
        }
    }

    fn set_clock_speed(&mut self, speed: crate::ClockSpeed) {
        if self.state.is_terminal() {
            self.emit(DomainEvent::CommandIgnored {
                reason: IgnoredCommandReason::MatterAlreadyClosed,
            });
        } else if self.state.clock().speed() == speed {
            self.emit(DomainEvent::CommandIgnored {
                reason: IgnoredCommandReason::ClockSpeedAlreadySelected,
            });
        } else {
            self.emit(DomainEvent::ClockSpeedChanged { speed });
        }
    }

    fn tick_real_time(&mut self, elapsed_ms: u64) -> Result<(), EngineError> {
        if self.state.is_terminal() {
            self.emit(DomainEvent::CommandIgnored {
                reason: IgnoredCommandReason::MatterAlreadyClosed,
            });
            return Ok(());
        }

        if self.state.clock().is_paused() {
            self.emit(DomainEvent::CommandIgnored {
                reason: IgnoredCommandReason::ClockPaused,
            });
            return Ok(());
        }

        let before = self.state.clone();
        let projected = before.clock().project_real_time(elapsed_ms)?;
        let terminal_cutoff = Self::earliest_terminal_cutoff(&before, projected.to())?;
        let advance = match terminal_cutoff {
            Some(cutoff) => projected.clamp_to(cutoff)?,
            None => projected,
        };

        let automatic_events =
            Self::automatic_events_between(&before, advance.from(), advance.to())?;

        self.emit(DomainEvent::RealTimeTicked {
            elapsed_ms,
            advance,
        });

        for scheduled in automatic_events {
            let terminal = scheduled.kind.is_terminal();
            self.apply_automatic_event(scheduled)?;
            if terminal {
                break;
            }
        }

        Ok(())
    }

    fn record_substantive_work(&mut self) -> Result<(), EngineError> {
        self.require_open_active("record substantive work")?;
        self.emit(DomainEvent::SubstantiveWorkRecorded {
            at: self.state.clock().now(),
        });
        Ok(())
    }

    fn schedule_mandatory_hearing(
        &mut self,
        opens_at: GameMinute,
        grace_minutes: u64,
    ) -> Result<(), EngineError> {
        self.require_stage(
            ProceduralStage::HearingPreparation,
            "schedule mandatory hearing",
        )?;
        if self.state.hearing().is_some() {
            return Err(EngineError::InvalidTransition(
                "mandatory hearing is already scheduled".to_owned(),
            ));
        }
        if opens_at <= self.state.clock().now() {
            return Err(EngineError::InvalidTransition(
                "mandatory hearing must open in the future".to_owned(),
            ));
        }
        if grace_minutes == 0 {
            return Err(EngineError::InvalidTransition(
                "mandatory hearing grace period must be positive".to_owned(),
            ));
        }

        let grace_ends_at = opens_at.checked_add(grace_minutes)?;
        self.emit(DomainEvent::MandatoryHearingScheduled {
            opens_at,
            grace_ends_at,
        });
        Ok(())
    }

    fn attend_mandatory_hearing(&mut self) -> Result<(), EngineError> {
        self.require_stage(ProceduralStage::HearingOpen, "attend mandatory hearing")?;
        let hearing = self.state.hearing().ok_or_else(|| {
            EngineError::InvalidTransition("no mandatory hearing is scheduled".to_owned())
        })?;
        let now = self.state.clock().now();

        if now < hearing.opens_at() || now > hearing.grace_ends_at() {
            return Err(EngineError::DeadlinePassed(
                "mandatory hearing attendance window".to_owned(),
            ));
        }
        if hearing.was_attended() || hearing.was_missed() {
            return Err(EngineError::InvalidTransition(
                "mandatory hearing is already resolved".to_owned(),
            ));
        }

        self.emit(DomainEvent::MandatoryHearingAttended { at: now });
        Ok(())
    }

    fn deliver_first_instance_judgment(
        &mut self,
        proposed_outcome: DecisionOutcome,
    ) -> Result<(), EngineError> {
        self.require_stage(
            ProceduralStage::JudgmentPending,
            "deliver first-instance judgment",
        )?;

        let effective_outcome = if self.state.procedural_default() {
            DecisionOutcome::Lost(LossKind::ProceduralDefault)
        } else {
            proposed_outcome
        };
        let now = self.state.clock().now();
        let appeal_deadline = if effective_outcome.is_loss() {
            Some(now.checked_add(self.state.config().appeal_window_minutes())?)
        } else {
            None
        };

        self.emit(DomainEvent::FirstInstanceJudgmentDelivered {
            at: now,
            proposed_outcome,
            effective_outcome,
            appeal_deadline,
        });

        match effective_outcome {
            DecisionOutcome::Won => self.close_matter(
                MatterResult::WonAtFirstInstance,
                ClosureReason::SuccessfulFirstInstanceJudgment,
                now,
            ),
            DecisionOutcome::PartiallyWon => self.close_matter(
                MatterResult::PartiallyWonAtFirstInstance,
                ClosureReason::SuccessfulFirstInstanceJudgment,
                now,
            ),
            DecisionOutcome::Lost(_) => Ok(()),
        }
    }

    fn prepare_appeal_advice(&mut self) -> Result<(), EngineError> {
        self.require_result(MatterResult::LostAtFirstInstance, "prepare appeal advice")?;
        self.require_before_or_at_appeal_deadline()?;
        if self.state.appeal().advice_prepared() {
            return Err(EngineError::InvalidTransition(
                "appeal advice is already prepared".to_owned(),
            ));
        }

        self.emit(DomainEvent::AppealAdvicePrepared {
            at: self.state.clock().now(),
        });
        Ok(())
    }

    fn request_appeal_authorization(&mut self) -> Result<(), EngineError> {
        self.require_result(
            MatterResult::LostAtFirstInstance,
            "request appeal authorization",
        )?;
        self.require_before_or_at_appeal_deadline()?;
        if !self.state.appeal().advice_prepared() {
            return Err(EngineError::InvalidTransition(
                "appeal advice must be prepared first".to_owned(),
            ));
        }
        if self.state.appeal().authorization() != ClientAuthorization::NotRequested {
            return Err(EngineError::InvalidTransition(
                "appeal authorization was already requested".to_owned(),
            ));
        }

        self.emit(DomainEvent::AppealAuthorizationRequested {
            at: self.state.clock().now(),
        });
        Ok(())
    }

    fn record_appeal_authorization(&mut self, approved: bool) -> Result<(), EngineError> {
        self.require_result(
            MatterResult::LostAtFirstInstance,
            "record appeal authorization",
        )?;
        self.require_before_or_at_appeal_deadline()?;
        if self.state.appeal().authorization() != ClientAuthorization::Pending {
            return Err(EngineError::InvalidTransition(
                "appeal authorization is not pending".to_owned(),
            ));
        }

        let now = self.state.clock().now();
        self.emit(DomainEvent::AppealAuthorizationRecorded { at: now, approved });
        if approved {
            Ok(())
        } else {
            self.close_matter(
                MatterResult::FinalLossAfterFirstInstance,
                ClosureReason::AppealNotPursued,
                now,
            )
        }
    }

    fn file_appeal(&mut self) -> Result<(), EngineError> {
        self.require_result(MatterResult::LostAtFirstInstance, "file appeal")?;
        self.require_before_or_at_appeal_deadline()?;
        if self.state.appeal().authorization() != ClientAuthorization::Approved {
            return Err(EngineError::ClientAuthorizationRequired(
                "appeal".to_owned(),
            ));
        }
        if self.state.appeal().filed_at().is_some() {
            return Err(EngineError::InvalidTransition(
                "appeal is already filed".to_owned(),
            ));
        }

        self.emit(DomainEvent::AppealFiled {
            at: self.state.clock().now(),
        });
        Ok(())
    }

    fn deliver_appeal_judgment(&mut self, outcome: DecisionOutcome) -> Result<(), EngineError> {
        self.require_stage(ProceduralStage::AppealPending, "deliver appeal judgment")?;
        let now = self.state.clock().now();
        let cassation_deadline = if outcome.is_loss() {
            Some(now.checked_add(self.state.config().cassation_window_minutes())?)
        } else {
            None
        };

        self.emit(DomainEvent::AppealJudgmentDelivered {
            at: now,
            outcome,
            cassation_deadline,
        });

        match outcome {
            DecisionOutcome::Won => self.close_matter(
                MatterResult::WonOnAppeal,
                ClosureReason::SuccessfulAppealJudgment,
                now,
            ),
            DecisionOutcome::PartiallyWon => self.close_matter(
                MatterResult::PartiallyWonOnAppeal,
                ClosureReason::SuccessfulAppealJudgment,
                now,
            ),
            DecisionOutcome::Lost(_) => Ok(()),
        }
    }

    fn assess_cassation_grounds(
        &mut self,
        alleged_grounds: BTreeSet<AllegedCassationGround>,
    ) -> Result<(), EngineError> {
        self.require_result(MatterResult::LostOnAppeal, "assess cassation grounds")?;
        self.require_before_or_at_cassation_deadline()?;
        if self.state.cassation().assessed() {
            return Err(EngineError::InvalidTransition(
                "cassation grounds are already assessed".to_owned(),
            ));
        }

        let viable_grounds: BTreeSet<CassationGround> = alleged_grounds
            .iter()
            .filter_map(|ground| ground.viable_ground())
            .collect();

        self.emit(DomainEvent::CassationGroundsAssessed {
            at: self.state.clock().now(),
            alleged_grounds,
            viable_grounds,
        });
        Ok(())
    }

    fn request_cassation_authorization(&mut self) -> Result<(), EngineError> {
        self.require_result(
            MatterResult::LostOnAppeal,
            "request cassation authorization",
        )?;
        self.require_before_or_at_cassation_deadline()?;
        if !self.state.cassation().assessed() {
            return Err(EngineError::InvalidTransition(
                "cassation grounds must be assessed first".to_owned(),
            ));
        }
        if self.state.cassation().viable_grounds().is_empty() {
            return Err(EngineError::NoViableCassationGround);
        }
        if self.state.cassation().authorization() != ClientAuthorization::NotRequested {
            return Err(EngineError::InvalidTransition(
                "cassation authorization was already requested".to_owned(),
            ));
        }

        self.emit(DomainEvent::CassationAuthorizationRequested {
            at: self.state.clock().now(),
        });
        Ok(())
    }

    fn record_cassation_authorization(&mut self, approved: bool) -> Result<(), EngineError> {
        self.require_result(MatterResult::LostOnAppeal, "record cassation authorization")?;
        self.require_before_or_at_cassation_deadline()?;
        if self.state.cassation().authorization() != ClientAuthorization::Pending {
            return Err(EngineError::InvalidTransition(
                "cassation authorization is not pending".to_owned(),
            ));
        }

        let now = self.state.clock().now();
        self.emit(DomainEvent::CassationAuthorizationRecorded { at: now, approved });
        if approved {
            Ok(())
        } else {
            self.close_matter(
                MatterResult::FinalLossAfterAppeal,
                ClosureReason::CassationNotPursued,
                now,
            )
        }
    }

    fn file_cassation(&mut self) -> Result<(), EngineError> {
        self.require_result(MatterResult::LostOnAppeal, "file cassation")?;
        self.require_before_or_at_cassation_deadline()?;
        if self.state.cassation().viable_grounds().is_empty() {
            return Err(EngineError::NoViableCassationGround);
        }
        if self.state.cassation().authorization() != ClientAuthorization::Approved {
            return Err(EngineError::ClientAuthorizationRequired(
                "cassation".to_owned(),
            ));
        }
        if self.state.cassation().filed_at().is_some() {
            return Err(EngineError::InvalidTransition(
                "cassation is already filed".to_owned(),
            ));
        }

        self.emit(DomainEvent::CassationFiled {
            at: self.state.clock().now(),
        });
        Ok(())
    }

    fn deliver_cassation_decision(&mut self, outcome: CassationOutcome) -> Result<(), EngineError> {
        self.require_stage(
            ProceduralStage::CassationPending,
            "deliver cassation decision",
        )?;
        let now = self.state.clock().now();

        self.emit(DomainEvent::CassationDecisionDelivered { at: now, outcome });

        match outcome {
            CassationOutcome::Dismissed => self.close_matter(
                MatterResult::CassationDismissed,
                ClosureReason::CassationDismissed,
                now,
            ),
            CassationOutcome::QuashedAndRemitted
            | CassationOutcome::PartiallyQuashedAndRemitted => Ok(()),
        }
    }

    fn accept_current_judgment_and_close(&mut self) -> Result<(), EngineError> {
        let now = self.state.clock().now();
        match self.state.result() {
            MatterResult::LostAtFirstInstance => self.close_matter(
                MatterResult::FinalLossAfterFirstInstance,
                ClosureReason::FirstInstanceJudgmentAccepted,
                now,
            ),
            MatterResult::LostOnAppeal => self.close_matter(
                MatterResult::FinalLossAfterAppeal,
                ClosureReason::AppellateJudgmentAccepted,
                now,
            ),
            _ => Err(EngineError::InvalidTransition(
                "there is no adverse open judgment to accept".to_owned(),
            )),
        }
    }

    fn close_matter(
        &mut self,
        final_result: MatterResult,
        closure_reason: ClosureReason,
        at: GameMinute,
    ) -> Result<(), EngineError> {
        if self.state.is_terminal() || self.state.case_report().is_some() {
            return Err(EngineError::InvalidTransition(
                "matter is already closed".to_owned(),
            ));
        }

        let consequences = ProfessionalConsequences::for_closure(
            closure_reason,
            self.state.first_instance_outcome(),
            self.state.appeal().outcome(),
        );
        let report = CaseReport {
            generated_at: at,
            final_result,
            closure_reason,
            first_instance_outcome: self.state.first_instance_outcome(),
            appeal_outcome: self.state.appeal().outcome(),
            cassation_outcome: self.state.cassation().outcome(),
            consequences,
        };

        self.emit(DomainEvent::MatterClosed {
            at,
            final_result,
            consequences,
        });
        self.emit(DomainEvent::CaseReportGenerated { report });
        Ok(())
    }

    fn require_stage(&self, expected: ProceduralStage, operation: &str) -> Result<(), EngineError> {
        if self.state.stage() != expected {
            let current_stage = self.state.stage();
            return Err(EngineError::InvalidTransition(format!(
                "{operation} requires stage {expected:?}, current stage is {current_stage:?}"
            )));
        }
        Ok(())
    }

    fn require_result(&self, expected: MatterResult, operation: &str) -> Result<(), EngineError> {
        if self.state.result() != expected {
            let current_result = self.state.result();
            return Err(EngineError::InvalidTransition(format!(
                "{operation} requires result {expected:?}, current result is {current_result:?}"
            )));
        }
        Ok(())
    }

    fn require_open_active(&self, operation: &str) -> Result<(), EngineError> {
        if self.state.is_terminal() {
            return Err(EngineError::InvalidTransition(format!(
                "{operation} is unavailable after closure"
            )));
        }
        if self.state.engagement() != EngagementStatus::Active {
            return Err(EngineError::InvalidTransition(format!(
                "{operation} requires an active engagement"
            )));
        }
        Ok(())
    }

    fn require_before_or_at_appeal_deadline(&self) -> Result<(), EngineError> {
        let deadline = self.state.appeal().deadline().ok_or_else(|| {
            EngineError::InvalidTransition("appeal deadline is unavailable".to_owned())
        })?;
        if self.state.clock().now() > deadline {
            return Err(EngineError::DeadlinePassed("appeal".to_owned()));
        }
        Ok(())
    }

    fn require_before_or_at_cassation_deadline(&self) -> Result<(), EngineError> {
        let deadline = self.state.cassation().deadline().ok_or_else(|| {
            EngineError::InvalidTransition("cassation deadline is unavailable".to_owned())
        })?;
        if self.state.clock().now() > deadline {
            return Err(EngineError::DeadlinePassed("cassation".to_owned()));
        }
        Ok(())
    }

    fn earliest_terminal_cutoff(
        state: &GameplayState,
        projected_to: GameMinute,
    ) -> Result<Option<GameMinute>, EngineError> {
        let from = state.clock().now();
        let mut candidates = Vec::new();

        if state.engagement() == EngagementStatus::Active {
            let termination_at = state
                .last_substantive_activity_at()
                .checked_add(state.config().inactivity_termination_after_minutes())?;
            if crossed(from, projected_to, termination_at) {
                candidates.push(termination_at);
            }
        }

        match state.appeal().deadline() {
            Some(deadline)
                if state.result() == MatterResult::LostAtFirstInstance
                    && state.appeal().filed_at().is_none() =>
            {
                let expires_at = deadline.checked_add(1)?;
                if crossed(from, projected_to, expires_at) {
                    candidates.push(expires_at);
                }
            }
            _ => {}
        }

        match state.cassation().deadline() {
            Some(deadline)
                if state.result() == MatterResult::LostOnAppeal
                    && state.cassation().filed_at().is_none() =>
            {
                let expires_at = deadline.checked_add(1)?;
                if crossed(from, projected_to, expires_at) {
                    candidates.push(expires_at);
                }
            }
            _ => {}
        }

        Ok(candidates.into_iter().min())
    }

    fn automatic_events_between(
        state: &GameplayState,
        from: GameMinute,
        to: GameMinute,
    ) -> Result<Vec<ScheduledAutomaticEvent>, EngineError> {
        let mut events = Vec::new();

        match state.hearing() {
            Some(hearing) if !hearing.was_attended() && !hearing.was_missed() => {
                if crossed(from, to, hearing.opens_at()) {
                    events.push(ScheduledAutomaticEvent::new(
                        hearing.opens_at(),
                        AutomaticEventKind::HearingOpened,
                    ));
                }

                let missed_at = hearing.grace_ends_at().checked_add(1)?;
                if crossed(from, to, missed_at) {
                    events.push(ScheduledAutomaticEvent::new(
                        missed_at,
                        AutomaticEventKind::HearingMissed,
                    ));
                }
            }
            _ => {}
        }

        if state.engagement() == EngagementStatus::Active {
            let warning_at = state
                .last_substantive_activity_at()
                .checked_add(state.config().inactivity_warning_after_minutes())?;
            if !state.inactivity_warning_issued() && crossed(from, to, warning_at) {
                events.push(ScheduledAutomaticEvent::new(
                    warning_at,
                    AutomaticEventKind::InactivityWarning,
                ));
            }

            let final_warning_at = state
                .last_substantive_activity_at()
                .checked_add(state.config().inactivity_final_warning_after_minutes())?;
            if !state.inactivity_final_warning_issued() && crossed(from, to, final_warning_at) {
                events.push(ScheduledAutomaticEvent::new(
                    final_warning_at,
                    AutomaticEventKind::FinalInactivityWarning,
                ));
            }

            let termination_at = state
                .last_substantive_activity_at()
                .checked_add(state.config().inactivity_termination_after_minutes())?;
            if crossed(from, to, termination_at) {
                events.push(ScheduledAutomaticEvent::new(
                    termination_at,
                    AutomaticEventKind::InactivityTermination,
                ));
            }
        }

        match state.appeal().deadline() {
            Some(deadline)
                if state.result() == MatterResult::LostAtFirstInstance
                    && state.appeal().filed_at().is_none() =>
            {
                let expires_at = deadline.checked_add(1)?;
                if crossed(from, to, expires_at) {
                    events.push(ScheduledAutomaticEvent::new(
                        expires_at,
                        AutomaticEventKind::AppealDeadlineExpired,
                    ));
                }
            }
            _ => {}
        }

        match state.cassation().deadline() {
            Some(deadline)
                if state.result() == MatterResult::LostOnAppeal
                    && state.cassation().filed_at().is_none() =>
            {
                let expires_at = deadline.checked_add(1)?;
                if crossed(from, to, expires_at) {
                    events.push(ScheduledAutomaticEvent::new(
                        expires_at,
                        AutomaticEventKind::CassationDeadlineExpired,
                    ));
                }
            }
            _ => {}
        }

        events.sort_by_key(|event| (event.at, event.kind.priority()));
        Ok(events)
    }

    fn apply_automatic_event(
        &mut self,
        scheduled: ScheduledAutomaticEvent,
    ) -> Result<(), EngineError> {
        match scheduled.kind {
            AutomaticEventKind::HearingOpened => {
                self.emit(DomainEvent::MandatoryHearingOpened { at: scheduled.at });
                Ok(())
            }
            AutomaticEventKind::HearingMissed => {
                self.emit(DomainEvent::MandatoryHearingMissed { at: scheduled.at });
                Ok(())
            }
            AutomaticEventKind::InactivityWarning => {
                self.emit(DomainEvent::InactivityWarningIssued { at: scheduled.at });
                Ok(())
            }
            AutomaticEventKind::FinalInactivityWarning => {
                self.emit(DomainEvent::FinalInactivityWarningIssued { at: scheduled.at });
                Ok(())
            }
            AutomaticEventKind::AppealDeadlineExpired => {
                self.emit(DomainEvent::AppealDeadlineExpired { at: scheduled.at });
                self.close_matter(
                    MatterResult::FinalLossAfterFirstInstance,
                    ClosureReason::AppealNotPursued,
                    scheduled.at,
                )
            }
            AutomaticEventKind::CassationDeadlineExpired => {
                self.emit(DomainEvent::CassationDeadlineExpired { at: scheduled.at });
                self.close_matter(
                    MatterResult::FinalLossAfterAppeal,
                    ClosureReason::CassationNotPursued,
                    scheduled.at,
                )
            }
            AutomaticEventKind::InactivityTermination => {
                self.emit(DomainEvent::EngagementTerminatedForInactivity { at: scheduled.at });
                self.close_matter(
                    MatterResult::EngagementTerminated,
                    ClosureReason::ClientTerminatedForInactivity,
                    scheduled.at,
                )
            }
        }
    }
}

fn crossed(from: GameMinute, to: GameMinute, boundary: GameMinute) -> bool {
    from < boundary && boundary <= to
}

#[derive(Debug, Clone, Copy)]
struct ScheduledAutomaticEvent {
    at: GameMinute,
    kind: AutomaticEventKind,
}

impl ScheduledAutomaticEvent {
    const fn new(at: GameMinute, kind: AutomaticEventKind) -> Self {
        Self { at, kind }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum AutomaticEventKind {
    HearingOpened,
    InactivityWarning,
    FinalInactivityWarning,
    HearingMissed,
    AppealDeadlineExpired,
    CassationDeadlineExpired,
    InactivityTermination,
}

impl AutomaticEventKind {
    const fn priority(self) -> u8 {
        match self {
            Self::HearingOpened => 0,
            Self::InactivityWarning => 1,
            Self::FinalInactivityWarning => 2,
            Self::HearingMissed => 3,
            Self::AppealDeadlineExpired => 4,
            Self::CassationDeadlineExpired => 5,
            Self::InactivityTermination => 6,
        }
    }

    const fn is_terminal(self) -> bool {
        matches!(
            self,
            Self::AppealDeadlineExpired
                | Self::CassationDeadlineExpired
                | Self::InactivityTermination
        )
    }
}
