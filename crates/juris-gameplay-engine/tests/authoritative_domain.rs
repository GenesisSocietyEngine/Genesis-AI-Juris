use juris_gameplay_engine::{
    AllegedCassationGround, CassationOutcome, ClockSpeed, ClosureReason, CommandId,
    DecisionOutcome, DomainEvent, EngagementStatus, EngineError, GameplayCommand, GameplayConfig,
    GameplayEngine, LossKind, MatterResult, ProceduralStage,
};
use std::collections::BTreeSet;

struct Driver {
    engine: GameplayEngine,
    next_id: u64,
}

impl Driver {
    fn new() -> Self {
        Self {
            engine: GameplayEngine::new(GameplayConfig::default()).expect("valid config"),
            next_id: 1,
        }
    }

    fn with_config(config: GameplayConfig) -> Self {
        Self {
            engine: GameplayEngine::new(config).expect("valid config"),
            next_id: 1,
        }
    }

    fn execute(&mut self, command: GameplayCommand) {
        let next_id = self.next_id;
        let id = CommandId::new(format!("cmd-{next_id}")).expect("valid command id");
        self.next_id += 1;
        self.engine.execute(id, command).expect("command succeeds");
    }

    fn try_execute(&mut self, command: GameplayCommand) -> Result<(), EngineError> {
        let next_id = self.next_id;
        let id = CommandId::new(format!("cmd-{next_id}")).expect("valid command id");
        self.next_id += 1;
        self.engine.execute(id, command)?;
        Ok(())
    }

    fn set_fast_clock(&mut self) {
        self.execute(GameplayCommand::SetClockSpeed {
            speed: ClockSpeed::Quadruple,
        });
    }

    fn tick_game_minutes(&mut self, game_minutes: u64) {
        // At 4×, one real second equals exactly one game minute.
        self.execute(GameplayCommand::TickRealTime {
            elapsed_ms: game_minutes * 1_000,
        });
    }

    fn open_to_hearing_preparation(&mut self) {
        self.execute(GameplayCommand::OpenMatter);
        self.execute(GameplayCommand::CompletePleadings);
        self.execute(GameplayCommand::CompleteEvidence);
        assert_eq!(
            self.engine.state().stage(),
            ProceduralStage::HearingPreparation
        );
    }

    fn reach_judgment_pending_by_attending(&mut self) {
        self.open_to_hearing_preparation();
        self.set_fast_clock();
        let opens_at = self
            .engine
            .state()
            .clock()
            .now()
            .checked_add(1)
            .expect("time fits");
        self.execute(GameplayCommand::ScheduleMandatoryHearing {
            opens_at,
            grace_minutes: 60,
        });
        self.tick_game_minutes(1);
        self.execute(GameplayCommand::AttendMandatoryHearing);
        assert_eq!(
            self.engine.state().stage(),
            ProceduralStage::JudgmentPending
        );
    }

    fn lose_first_instance_on_merits(&mut self) {
        self.reach_judgment_pending_by_attending();
        self.execute(GameplayCommand::DeliverFirstInstanceJudgment {
            proposed_outcome: DecisionOutcome::Lost(LossKind::Merits),
        });
        assert_eq!(
            self.engine.state().result(),
            MatterResult::LostAtFirstInstance
        );
    }

    fn file_appeal(&mut self) {
        self.execute(GameplayCommand::PrepareAppealAdvice);
        self.execute(GameplayCommand::RequestAppealAuthorization);
        self.execute(GameplayCommand::RecordAppealAuthorization { approved: true });
        self.execute(GameplayCommand::FileAppeal);
        assert_eq!(self.engine.state().stage(), ProceduralStage::AppealPending);
    }

    fn lose_on_appeal(&mut self) {
        self.lose_first_instance_on_merits();
        self.file_appeal();
        self.execute(GameplayCommand::DeliverAppealJudgment {
            outcome: DecisionOutcome::Lost(LossKind::Merits),
        });
        assert_eq!(self.engine.state().result(), MatterResult::LostOnAppeal);
    }
}

#[test]
fn clock_rates_are_exact_at_standard_double_and_quadruple_speed() {
    let cases = [
        (ClockSpeed::Standard, 15_u64),
        (ClockSpeed::Double, 30_u64),
        (ClockSpeed::Quadruple, 60_u64),
    ];

    for (speed, expected_minutes) in cases {
        let mut driver = Driver::new();
        if speed != ClockSpeed::Standard {
            driver.execute(GameplayCommand::SetClockSpeed { speed });
        }
        driver.execute(GameplayCommand::TickRealTime { elapsed_ms: 60_000 });

        assert_eq!(
            driver.engine.state().clock().now().get(),
            expected_minutes,
            "the integer accumulator must implement the documented rate"
        );
    }
}

#[test]
fn many_small_ticks_equal_one_large_tick_without_float_drift() {
    let mut one_tick = Driver::new();
    one_tick.execute(GameplayCommand::TickRealTime { elapsed_ms: 60_000 });

    let mut many_ticks = Driver::new();
    for _ in 0..60 {
        many_ticks.execute(GameplayCommand::TickRealTime { elapsed_ms: 1_000 });
    }

    assert_eq!(
        one_tick.engine.state().clock(),
        many_ticks.engine.state().clock()
    );
}

#[test]
fn pause_stops_only_time_and_does_not_block_domain_reads_or_progression() {
    let mut driver = Driver::new();
    driver.execute(GameplayCommand::OpenMatter);
    driver.execute(GameplayCommand::PauseClock);

    let before = driver.engine.state().clone();
    driver.execute(GameplayCommand::TickRealTime {
        elapsed_ms: 120_000,
    });

    assert_eq!(driver.engine.state().clock().now(), before.clock().now());
    assert_eq!(driver.engine.state().stage(), ProceduralStage::Pleadings);

    // Reading state is always available, and non-time commands are not globally
    // disabled by pause. A UI may therefore inspect cards and navigate freely.
    driver.execute(GameplayCommand::CompletePleadings);
    assert_eq!(driver.engine.state().stage(), ProceduralStage::Evidence);
    assert!(driver.engine.state().clock().is_paused());
}

#[test]
fn large_tick_emits_inactivity_consequences_in_threshold_order_and_stops_exactly() {
    let config = GameplayConfig::new(3, 5, 8, 100, 100).expect("valid thresholds");
    let mut driver = Driver::with_config(config);
    driver.execute(GameplayCommand::OpenMatter);
    driver.set_fast_clock();

    let command_id = CommandId::new("large-inactivity-tick").expect("valid id");
    let receipt = driver
        .engine
        .execute(
            command_id,
            GameplayCommand::TickRealTime { elapsed_ms: 20_000 },
        )
        .expect("tick succeeds");

    let event_names: Vec<&'static str> = receipt
        .events()
        .iter()
        .map(|record| match record.event() {
            DomainEvent::RealTimeTicked { .. } => "tick",
            DomainEvent::InactivityWarningIssued { .. } => "warning",
            DomainEvent::FinalInactivityWarningIssued { .. } => "final-warning",
            DomainEvent::EngagementTerminatedForInactivity { .. } => "termination",
            DomainEvent::MatterClosed { .. } => "closed",
            DomainEvent::CaseReportGenerated { .. } => "report",
            other => panic!("unexpected event: {other:?}"),
        })
        .collect();

    assert_eq!(
        event_names,
        [
            "tick",
            "warning",
            "final-warning",
            "termination",
            "closed",
            "report"
        ]
    );
    assert_eq!(driver.engine.state().clock().now().get(), 8);
    assert_eq!(
        driver.engine.state().engagement(),
        EngagementStatus::TerminatedByClient
    );
    assert_eq!(
        driver.engine.state().result(),
        MatterResult::EngagementTerminated
    );
    assert_eq!(
        driver
            .engine
            .state()
            .case_report()
            .expect("terminal report")
            .closure_reason,
        ClosureReason::ClientTerminatedForInactivity
    );
}

#[test]
fn missed_mandatory_hearing_cannot_be_rescued_by_proposed_win() {
    let mut driver = Driver::new();
    driver.open_to_hearing_preparation();
    driver.set_fast_clock();

    let opens_at = driver
        .engine
        .state()
        .clock()
        .now()
        .checked_add(10)
        .expect("time fits");
    driver.execute(GameplayCommand::ScheduleMandatoryHearing {
        opens_at,
        grace_minutes: 360,
    });

    // Attendance is valid through grace_ends_at. Missing is recorded one minute
    // later, matching the previously discovered six-hours-plus-one boundary.
    driver.tick_game_minutes(371);
    assert_eq!(
        driver.engine.state().stage(),
        ProceduralStage::JudgmentPending
    );
    assert!(driver.engine.state().procedural_default());

    driver.execute(GameplayCommand::DeliverFirstInstanceJudgment {
        proposed_outcome: DecisionOutcome::Won,
    });

    assert_eq!(
        driver.engine.state().first_instance_outcome(),
        Some(DecisionOutcome::Lost(LossKind::ProceduralDefault))
    );
    assert_eq!(
        driver.engine.state().result(),
        MatterResult::LostAtFirstInstance
    );
    assert!(!driver.engine.state().is_terminal());
}

#[test]
fn first_instance_loss_is_not_closed_while_appeal_remains_available() {
    let mut driver = Driver::new();
    driver.lose_first_instance_on_merits();

    assert_eq!(
        driver.engine.state().stage(),
        ProceduralStage::FirstInstanceJudgmentDelivered
    );
    assert_eq!(
        driver.engine.state().engagement(),
        EngagementStatus::AwaitingClientInstructions
    );
    assert!(driver.engine.state().appeal().deadline().is_some());
    assert!(driver.engine.state().case_report().is_none());
    assert!(!driver.engine.state().is_terminal());
}

#[test]
fn appeal_requires_advice_and_explicit_client_authorization() {
    let mut driver = Driver::new();
    driver.lose_first_instance_on_merits();

    let error = driver
        .try_execute(GameplayCommand::FileAppeal)
        .expect_err("filing without authorization must fail");
    assert!(matches!(error, EngineError::ClientAuthorizationRequired(_)));

    driver.execute(GameplayCommand::PrepareAppealAdvice);
    driver.execute(GameplayCommand::RequestAppealAuthorization);

    let error = driver
        .try_execute(GameplayCommand::FileAppeal)
        .expect_err("pending client decision must not count as approval");
    assert!(matches!(error, EngineError::ClientAuthorizationRequired(_)));

    driver.execute(GameplayCommand::RecordAppealAuthorization { approved: true });
    driver.execute(GameplayCommand::FileAppeal);
    assert_eq!(
        driver.engine.state().stage(),
        ProceduralStage::AppealPending
    );
}

#[test]
fn appeal_deadline_is_inclusive_and_expires_one_minute_later() {
    let config = GameplayConfig::new(100, 200, 300, 5, 10).expect("valid config");
    let mut driver = Driver::with_config(config);
    driver.reach_judgment_pending_by_attending();
    driver.execute(GameplayCommand::DeliverFirstInstanceJudgment {
        proposed_outcome: DecisionOutcome::Lost(LossKind::Merits),
    });

    let deadline = driver.engine.state().appeal().deadline().expect("deadline");
    let now = driver.engine.state().clock().now();
    assert_eq!(deadline.get() - now.get(), 5);

    // Moving exactly to the deadline keeps the remedy available.
    driver.tick_game_minutes(5);
    assert!(!driver.engine.state().is_terminal());
    driver.execute(GameplayCommand::PrepareAppealAdvice);

    // One further minute crosses the explicit expiry boundary.
    driver.tick_game_minutes(1);
    assert!(driver.engine.state().is_terminal());
    assert_eq!(
        driver.engine.state().result(),
        MatterResult::FinalLossAfterFirstInstance
    );
    assert_eq!(
        driver
            .engine
            .state()
            .case_report()
            .expect("report")
            .closure_reason,
        ClosureReason::AppealNotPursued
    );
}

#[test]
fn factual_disagreement_alone_is_not_a_viable_cassation_ground() {
    let mut driver = Driver::new();
    driver.lose_on_appeal();

    let alleged = BTreeSet::from([
        AllegedCassationGround::FactualReassessment,
        AllegedCassationGround::EvidenceWeightDisagreement,
    ]);
    driver.execute(GameplayCommand::AssessCassationGrounds {
        alleged_grounds: alleged,
    });

    assert!(driver.engine.state().cassation().assessed());
    assert!(driver
        .engine
        .state()
        .cassation()
        .viable_grounds()
        .is_empty());

    let error = driver
        .try_execute(GameplayCommand::RequestCassationAuthorization)
        .expect_err("facts-only cassation must fail");
    assert_eq!(error, EngineError::NoViableCassationGround);
}

#[test]
fn cassation_requires_legal_ground_and_client_authorization() {
    let mut driver = Driver::new();
    driver.lose_on_appeal();

    driver.execute(GameplayCommand::AssessCassationGrounds {
        alleged_grounds: BTreeSet::from([AllegedCassationGround::ErrorOfLaw]),
    });

    let error = driver
        .try_execute(GameplayCommand::FileCassation)
        .expect_err("filing before authorization must fail");
    assert!(matches!(error, EngineError::ClientAuthorizationRequired(_)));

    driver.execute(GameplayCommand::RequestCassationAuthorization);
    driver.execute(GameplayCommand::RecordCassationAuthorization { approved: true });
    driver.execute(GameplayCommand::FileCassation);

    assert_eq!(
        driver.engine.state().stage(),
        ProceduralStage::CassationPending
    );
}

#[test]
fn successful_cassation_remits_and_does_not_create_terminal_case_report() {
    let mut driver = Driver::new();
    driver.lose_on_appeal();
    driver.execute(GameplayCommand::AssessCassationGrounds {
        alleged_grounds: BTreeSet::from([AllegedCassationGround::EssentialProceduralViolation]),
    });
    driver.execute(GameplayCommand::RequestCassationAuthorization);
    driver.execute(GameplayCommand::RecordCassationAuthorization { approved: true });
    driver.execute(GameplayCommand::FileCassation);
    driver.execute(GameplayCommand::DeliverCassationDecision {
        outcome: CassationOutcome::QuashedAndRemitted,
    });

    assert_eq!(driver.engine.state().stage(), ProceduralStage::Remitted);
    assert_eq!(
        driver.engine.state().result(),
        MatterResult::RemittedAfterCassation
    );
    assert!(!driver.engine.state().is_terminal());
    assert!(driver.engine.state().case_report().is_none());
}

#[test]
fn dismissed_cassation_closes_once_with_one_case_report() {
    let mut driver = Driver::new();
    driver.lose_on_appeal();
    driver.execute(GameplayCommand::AssessCassationGrounds {
        alleged_grounds: BTreeSet::from([AllegedCassationGround::InadequateReasoning]),
    });
    driver.execute(GameplayCommand::RequestCassationAuthorization);
    driver.execute(GameplayCommand::RecordCassationAuthorization { approved: true });
    driver.execute(GameplayCommand::FileCassation);
    driver.execute(GameplayCommand::DeliverCassationDecision {
        outcome: CassationOutcome::Dismissed,
    });

    assert!(driver.engine.state().is_terminal());
    assert_eq!(
        driver.engine.state().result(),
        MatterResult::CassationDismissed
    );
    assert_eq!(driver.engine.state().closure_count(), 1);
    assert_eq!(driver.engine.state().case_report_count(), 1);

    let reports_before = driver
        .engine
        .events()
        .iter()
        .filter(|record| matches!(record.event(), DomainEvent::CaseReportGenerated { .. }))
        .count();
    assert_eq!(reports_before, 1);

    // A terminal tick is recorded as ignored, not as a second closure/report.
    driver.execute(GameplayCommand::TickRealTime { elapsed_ms: 60_000 });
    let reports_after = driver
        .engine
        .events()
        .iter()
        .filter(|record| matches!(record.event(), DomainEvent::CaseReportGenerated { .. }))
        .count();
    assert_eq!(reports_after, 1);
}

#[test]
fn duplicate_command_id_is_idempotent_even_when_payload_differs() {
    let mut engine = GameplayEngine::new(GameplayConfig::default()).expect("valid engine");
    let id = CommandId::new("transport-retry-1").expect("valid id");

    let first = engine
        .execute(id.clone(), GameplayCommand::OpenMatter)
        .expect("first delivery succeeds");
    let duplicate = engine
        .execute(id, GameplayCommand::CompletePleadings)
        .expect("retry is recognized");

    assert!(!first.is_duplicate());
    assert!(duplicate.is_duplicate());
    assert!(duplicate.events().is_empty());
    assert_eq!(engine.state().stage(), ProceduralStage::Pleadings);
}

#[test]
fn replay_rebuilds_identical_state_and_preserves_idempotency() {
    let mut driver = Driver::new();
    driver.lose_first_instance_on_merits();
    driver.execute(GameplayCommand::PrepareAppealAdvice);
    driver.execute(GameplayCommand::RequestAppealAuthorization);

    let records = driver.engine.events().to_vec();
    let expected_state = driver.engine.state().clone();
    let replayed =
        GameplayEngine::replay(GameplayConfig::default(), records).expect("valid replay");

    assert_eq!(replayed.state(), &expected_state);
    assert_eq!(replayed.events(), driver.engine.events());
}
