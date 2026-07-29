use crate::{CassationOutcome, DecisionOutcome, GameMinute, MatterResult};
use serde::{Deserialize, Serialize};

/// Terminal closure reason.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum ClosureReason {
    /// Client accepted the first-instance loss.
    FirstInstanceJudgmentAccepted,
    /// Client declined or failed to pursue an appeal.
    AppealNotPursued,
    /// Client accepted the appellate loss.
    AppellateJudgmentAccepted,
    /// Client declined or failed to pursue cassation.
    CassationNotPursued,
    /// Cassation was dismissed.
    CassationDismissed,
    /// Inactivity caused client termination.
    ClientTerminatedForInactivity,
    /// Matter concluded successfully at first instance.
    SuccessfulFirstInstanceJudgment,
    /// Matter concluded successfully on appeal.
    SuccessfulAppealJudgment,
}

/// Deterministic professional and financial consequences.
#[derive(Debug, Default, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub struct ProfessionalConsequences {
    /// Change in client trust.
    pub client_trust_delta: i16,
    /// Change in professional standing.
    pub professional_standing_delta: i16,
    /// Net financial effect in cents.
    pub financial_delta_cents: i64,
}

impl ProfessionalConsequences {
    pub(crate) const fn for_closure(
        reason: ClosureReason,
        first_instance: Option<DecisionOutcome>,
        appeal: Option<DecisionOutcome>,
    ) -> Self {
        match reason {
            ClosureReason::ClientTerminatedForInactivity => Self {
                client_trust_delta: -45,
                professional_standing_delta: -20,
                financial_delta_cents: -1_850_000,
            },
            ClosureReason::CassationDismissed
            | ClosureReason::CassationNotPursued
            | ClosureReason::AppellateJudgmentAccepted => {
                let procedural_default = matches!(
                    first_instance,
                    Some(DecisionOutcome::Lost(crate::LossKind::ProceduralDefault))
                ) || matches!(
                    appeal,
                    Some(DecisionOutcome::Lost(crate::LossKind::ProceduralDefault))
                );

                if procedural_default {
                    Self {
                        client_trust_delta: -35,
                        professional_standing_delta: -18,
                        financial_delta_cents: -1_250_000,
                    }
                } else {
                    Self {
                        client_trust_delta: -12,
                        professional_standing_delta: -4,
                        financial_delta_cents: -650_000,
                    }
                }
            }
            ClosureReason::FirstInstanceJudgmentAccepted | ClosureReason::AppealNotPursued => {
                if matches!(
                    first_instance,
                    Some(DecisionOutcome::Lost(crate::LossKind::ProceduralDefault))
                ) {
                    Self {
                        client_trust_delta: -35,
                        professional_standing_delta: -18,
                        financial_delta_cents: -1_250_000,
                    }
                } else {
                    Self {
                        client_trust_delta: -10,
                        professional_standing_delta: -3,
                        financial_delta_cents: -450_000,
                    }
                }
            }
            ClosureReason::SuccessfulFirstInstanceJudgment
            | ClosureReason::SuccessfulAppealJudgment => Self {
                client_trust_delta: 12,
                professional_standing_delta: 6,
                financial_delta_cents: 900_000,
            },
        }
    }
}

/// Immutable terminal case report.
///
/// Exactly one report is generated when a matter becomes terminal. A remittal
/// after successful cassation is not terminal and therefore produces no report.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct CaseReport {
    /// Generation time.
    pub generated_at: GameMinute,
    /// Final result.
    pub final_result: MatterResult,
    /// Closure reason.
    pub closure_reason: ClosureReason,
    /// First-instance outcome, when delivered.
    pub first_instance_outcome: Option<DecisionOutcome>,
    /// Appellate outcome, when delivered.
    pub appeal_outcome: Option<DecisionOutcome>,
    /// Cassation outcome, when delivered.
    pub cassation_outcome: Option<CassationOutcome>,
    /// Professional and financial consequences.
    pub consequences: ProfessionalConsequences,
}
