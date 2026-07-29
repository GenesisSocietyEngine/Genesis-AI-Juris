//! Stable, path-aware validation diagnostics.
//!
//! Authoring tools need machine-readable codes for tests and UI filtering, while
//! writers need precise JSON paths and corrective guidance. Diagnostics carry
//! both forms without coupling the validator to a specific terminal UI.

/// Diagnostic severity.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum Severity {
    Error,
    Warning,
}

/// One authoring diagnostic with a stable code and document path.
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Diagnostic {
    pub severity: Severity,
    pub code: &'static str,
    pub path: String,
    pub message: String,
    pub help: Option<String>,
}

impl Diagnostic {
    #[must_use]
    pub fn error(
        code: &'static str,
        path: impl Into<String>,
        message: impl Into<String>,
        help: Option<String>,
    ) -> Self {
        Self {
            severity: Severity::Error,
            code,
            path: path.into(),
            message: message.into(),
            help,
        }
    }

    #[must_use]
    pub fn warning(
        code: &'static str,
        path: impl Into<String>,
        message: impl Into<String>,
        help: Option<String>,
    ) -> Self {
        Self {
            severity: Severity::Warning,
            code,
            path: path.into(),
            message: message.into(),
            help,
        }
    }
}

/// Aggregated diagnostics for one validation pass.
#[derive(Clone, Debug, Default, Eq, PartialEq)]
pub struct ValidationReport {
    diagnostics: Vec<Diagnostic>,
}

impl ValidationReport {
    #[must_use]
    pub fn new() -> Self {
        Self::default()
    }

    pub fn push(&mut self, diagnostic: Diagnostic) {
        self.diagnostics.push(diagnostic);
    }

    pub fn extend(&mut self, other: Self) {
        self.diagnostics.extend(other.diagnostics);
    }

    #[must_use]
    pub fn diagnostics(&self) -> &[Diagnostic] {
        &self.diagnostics
    }

    #[must_use]
    pub fn is_valid(&self) -> bool {
        !self
            .diagnostics
            .iter()
            .any(|diagnostic| diagnostic.severity == Severity::Error)
    }

    #[must_use]
    pub fn error_count(&self) -> usize {
        self.diagnostics
            .iter()
            .filter(|diagnostic| diagnostic.severity == Severity::Error)
            .count()
    }

    #[must_use]
    pub fn warning_count(&self) -> usize {
        self.diagnostics
            .iter()
            .filter(|diagnostic| diagnostic.severity == Severity::Warning)
            .count()
    }

    #[must_use]
    pub fn contains_code(&self, code: &str) -> bool {
        self.diagnostics
            .iter()
            .any(|diagnostic| diagnostic.code == code)
    }
}
