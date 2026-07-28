//! Stable diagnostics emitted by scenario validation.
//!
//! Diagnostic codes are part of the validator's public contract. Tests and
//! tooling should assert codes rather than complete human-readable messages,
//! because message wording may improve without changing validation semantics.

use std::fmt;

/// Stable machine-readable validation code.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum DiagnosticCode {
    // Structural validation.
    DuplicateId,
    EmptyId,
    UnsupportedSchemaVersion,
    MissingInitialStage,
    NoOutcomes,

    // Lifecycle validation.
    AsyncTaskWithoutCompletionPath,
    AsyncTaskWithoutTerminalBoundary,
    RequiredInboxWithoutResolution,
    DeadlineWithoutMissedPath,
    DeadlineWithoutCompletionPath,
    HearingWithoutScheduleEvent,
    HearingWithoutTerminalEvent,

    // Reference validation.
    UnknownStageReference,
    UnknownActionReference,
    UnknownEventReference,
    UnknownFactReference,
    UnknownDeadlineReference,
    UnknownAsyncTaskReference,
    UnknownOutcomeReference,
    UnknownActorReference,
    UnknownEvidenceReference,
    UnknownInboxItemReference,
}

impl DiagnosticCode {
    /// Returns the stable external identifier used in logs, CLI output, and
    /// regression tests.
    pub const fn as_str(&self) -> &'static str {
        match self {
            Self::DuplicateId => "SCN001_DUPLICATE_ID",
            Self::EmptyId => "SCN002_EMPTY_ID",
            Self::UnsupportedSchemaVersion => "SCN003_UNSUPPORTED_SCHEMA_VERSION",
            Self::MissingInitialStage => "SCN004_MISSING_INITIAL_STAGE",
            Self::NoOutcomes => "SCN005_NO_OUTCOMES",

            Self::UnknownStageReference => "SCN101_UNKNOWN_STAGE_REFERENCE",
            Self::UnknownActionReference => "SCN102_UNKNOWN_ACTION_REFERENCE",
            Self::UnknownEventReference => "SCN103_UNKNOWN_EVENT_REFERENCE",
            Self::UnknownFactReference => "SCN104_UNKNOWN_FACT_REFERENCE",
            Self::UnknownDeadlineReference => "SCN105_UNKNOWN_DEADLINE_REFERENCE",
            Self::UnknownAsyncTaskReference => "SCN106_UNKNOWN_ASYNC_TASK_REFERENCE",
            Self::UnknownOutcomeReference => "SCN107_UNKNOWN_OUTCOME_REFERENCE",
            Self::UnknownActorReference => "SCN108_UNKNOWN_ACTOR_REFERENCE",
            Self::UnknownEvidenceReference => "SCN109_UNKNOWN_EVIDENCE_REFERENCE",
            Self::UnknownInboxItemReference => "SCN110_UNKNOWN_INBOX_ITEM_REFERENCE",

            Self::AsyncTaskWithoutCompletionPath => "SCN201_ASYNC_TASK_WITHOUT_COMPLETION_PATH",
            Self::AsyncTaskWithoutTerminalBoundary => "SCN202_ASYNC_TASK_WITHOUT_TERMINAL_BOUNDARY",
            Self::RequiredInboxWithoutResolution => "SCN203_REQUIRED_INBOX_WITHOUT_RESOLUTION",
            Self::DeadlineWithoutMissedPath => "SCN204_DEADLINE_WITHOUT_MISSED_PATH",
            Self::DeadlineWithoutCompletionPath => "SCN205_DEADLINE_WITHOUT_COMPLETION_PATH",
            Self::HearingWithoutScheduleEvent => "SCN206_HEARING_WITHOUT_SCHEDULE_EVENT",
            Self::HearingWithoutTerminalEvent => "SCN207_HEARING_WITHOUT_TERMINAL_EVENT",
        }
    }
}

impl fmt::Display for DiagnosticCode {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        formatter.write_str(self.as_str())
    }
}

/// Severity allows future advisory rules without making every diagnostic
/// fatal to scenario compilation.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Severity {
    Error,
    Warning,
}

/// One concrete validation problem.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Diagnostic {
    pub code: DiagnosticCode,
    pub severity: Severity,

    /// Logical source path such as `actions[2].effects[0].stage`.
    pub path: String,

    pub message: String,
}

impl Diagnostic {
    /// Creates a fatal validation diagnostic.
    pub fn error(
        code: DiagnosticCode,
        path: impl Into<String>,
        message: impl Into<String>,
    ) -> Self {
        Self {
            code,
            severity: Severity::Error,
            path: path.into(),
            message: message.into(),
        }
    }
}

/// Complete validation result.
#[derive(Debug, Clone, PartialEq, Eq, Default)]
pub struct ValidationReport {
    pub diagnostics: Vec<Diagnostic>,
}

impl ValidationReport {
    /// Returns true only when no error-level diagnostic exists.
    pub fn is_valid(&self) -> bool {
        !self
            .diagnostics
            .iter()
            .any(|diagnostic| diagnostic.severity == Severity::Error)
    }

    /// Returns stable error codes in deterministic report order.
    pub fn error_codes(&self) -> Vec<DiagnosticCode> {
        self.diagnostics
            .iter()
            .filter(|diagnostic| diagnostic.severity == Severity::Error)
            .map(|diagnostic| diagnostic.code)
            .collect()
    }

    pub(crate) fn push(&mut self, diagnostic: Diagnostic) {
        self.diagnostics.push(diagnostic);
    }
}
