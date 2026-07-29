use serde::Serialize;

/// Severity used by authoring diagnostics.
#[derive(Clone, Copy, Debug, Eq, PartialEq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum AuthoringSeverity {
    Error,
    Warning,
}

/// Stable authoring-diagnostic identifiers.
#[derive(Clone, Copy, Debug, Eq, PartialEq, Ord, PartialOrd)]
pub enum AuthoringDiagnosticCode {
    InvalidScenarioTime,
    DeadlineActivatesAfterDue,
    DeadlineCompletionAfterDue,
    DeadlineMissTriggerMismatch,
    ZeroDurationAsyncTask,
    TaskExpiryBeforeUsableBoundary,
    AppealScheduledBeforeJudgment,
    CassationScheduledBeforeAppeal,
    CassationScheduledBeforeJudgment,
    TerminalStageWithoutOutcome,
    OutcomeTargetsNonTerminalStage,
    OutcomeWithoutProducer,
    MultipleOutcomesInTransition,
    AmbiguousUnconditionalOutcomes,
    UnsatisfiableOutcomeCondition,
    TerminalPostJudgmentStage,
}

impl AuthoringDiagnosticCode {
    #[must_use]
    pub const fn as_str(self) -> &'static str {
        match self {
            Self::InvalidScenarioTime => "AUT500_INVALID_SCENARIO_TIME",
            Self::DeadlineActivatesAfterDue => "AUT501_DEADLINE_ACTIVATES_AFTER_DUE",
            Self::DeadlineCompletionAfterDue => "AUT502_DEADLINE_COMPLETION_AFTER_DUE",
            Self::DeadlineMissTriggerMismatch => "AUT503_DEADLINE_MISS_TRIGGER_MISMATCH",
            Self::ZeroDurationAsyncTask => "AUT504_ZERO_DURATION_ASYNC_TASK",
            Self::TaskExpiryBeforeUsableBoundary => "AUT505_TASK_EXPIRY_BEFORE_USABLE_BOUNDARY",
            Self::AppealScheduledBeforeJudgment => "AUT506_APPEAL_BEFORE_JUDGMENT",
            Self::CassationScheduledBeforeAppeal => "AUT507_CASSATION_BEFORE_APPEAL",
            Self::CassationScheduledBeforeJudgment => "AUT508_CASSATION_BEFORE_JUDGMENT",
            Self::TerminalStageWithoutOutcome => "AUT600_TERMINAL_STAGE_WITHOUT_OUTCOME",
            Self::OutcomeTargetsNonTerminalStage => "AUT601_OUTCOME_TARGETS_NON_TERMINAL_STAGE",
            Self::OutcomeWithoutProducer => "AUT602_OUTCOME_WITHOUT_PRODUCER",
            Self::MultipleOutcomesInTransition => "AUT603_MULTIPLE_OUTCOMES_IN_TRANSITION",
            Self::AmbiguousUnconditionalOutcomes => "AUT604_AMBIGUOUS_UNCONDITIONAL_OUTCOMES",
            Self::UnsatisfiableOutcomeCondition => "AUT605_UNSATISFIABLE_OUTCOME_CONDITION",
            Self::TerminalPostJudgmentStage => "AUT700_TERMINAL_POST_JUDGMENT_STAGE",
        }
    }
}

/// One actionable authoring diagnostic.
#[derive(Clone, Debug, Eq, PartialEq, Serialize)]
pub struct AuthoringDiagnostic {
    pub code: &'static str,
    pub severity: AuthoringSeverity,
    pub path: String,
    pub message: String,
    pub suggestion: String,
}

impl AuthoringDiagnostic {
    #[must_use]
    pub fn error(
        code: AuthoringDiagnosticCode,
        path: impl Into<String>,
        message: impl Into<String>,
        suggestion: impl Into<String>,
    ) -> Self {
        Self {
            code: code.as_str(),
            severity: AuthoringSeverity::Error,
            path: path.into(),
            message: message.into(),
            suggestion: suggestion.into(),
        }
    }

    #[must_use]
    pub fn warning(
        code: AuthoringDiagnosticCode,
        path: impl Into<String>,
        message: impl Into<String>,
        suggestion: impl Into<String>,
    ) -> Self {
        Self {
            code: code.as_str(),
            severity: AuthoringSeverity::Warning,
            path: path.into(),
            message: message.into(),
            suggestion: suggestion.into(),
        }
    }
}

/// Aggregate result for authoring diagnostics.
#[derive(Clone, Debug, Default, Eq, PartialEq, Serialize)]
pub struct AuthoringValidationReport {
    diagnostics: Vec<AuthoringDiagnostic>,
}

impl AuthoringValidationReport {
    pub(crate) fn push(&mut self, diagnostic: AuthoringDiagnostic) {
        self.diagnostics.push(diagnostic);
    }

    pub(crate) fn sort(&mut self) {
        self.diagnostics.sort_by(|left, right| {
            left.path
                .cmp(&right.path)
                .then_with(|| left.code.cmp(right.code))
                .then_with(|| left.message.cmp(&right.message))
        });
    }

    #[must_use]
    pub fn diagnostics(&self) -> &[AuthoringDiagnostic] {
        &self.diagnostics
    }

    #[must_use]
    pub fn is_valid(&self) -> bool {
        self.error_count() == 0
    }

    #[must_use]
    pub fn error_count(&self) -> usize {
        self.diagnostics
            .iter()
            .filter(|item| item.severity == AuthoringSeverity::Error)
            .count()
    }

    #[must_use]
    pub fn warning_count(&self) -> usize {
        self.diagnostics
            .iter()
            .filter(|item| item.severity == AuthoringSeverity::Warning)
            .count()
    }

    #[must_use]
    pub fn contains_code(&self, code: AuthoringDiagnosticCode) -> bool {
        self.diagnostics
            .iter()
            .any(|item| item.code == code.as_str())
    }
}
