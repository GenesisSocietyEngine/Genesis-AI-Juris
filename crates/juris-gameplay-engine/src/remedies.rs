use crate::{DecisionOutcome, GameMinute};
use serde::{Deserialize, Serialize};
use std::collections::BTreeSet;

/// Client authorization state for an optional remedy.
#[derive(Debug, Default, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum ClientAuthorization {
    /// Authorization has not been requested.
    #[default]
    NotRequested,
    /// The request is awaiting client response.
    Pending,
    /// Client approved the remedy.
    Approved,
    /// Client declined the remedy.
    Declined,
}

/// Appeal lifecycle state.
#[derive(Debug, Default, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct AppealState {
    deadline: Option<GameMinute>,
    advice_prepared: bool,
    authorization: ClientAuthorization,
    filed_at: Option<GameMinute>,
    outcome: Option<DecisionOutcome>,
}

impl AppealState {
    /// Appeal deadline.
    #[must_use]
    pub const fn deadline(&self) -> Option<GameMinute> {
        self.deadline
    }

    /// Whether appeal advice has been prepared.
    #[must_use]
    pub const fn advice_prepared(&self) -> bool {
        self.advice_prepared
    }

    /// Client authorization state.
    #[must_use]
    pub const fn authorization(&self) -> ClientAuthorization {
        self.authorization
    }

    /// Filing time.
    #[must_use]
    pub const fn filed_at(&self) -> Option<GameMinute> {
        self.filed_at
    }

    /// Appellate outcome.
    #[must_use]
    pub const fn outcome(&self) -> Option<DecisionOutcome> {
        self.outcome
    }

    pub(crate) fn open(&mut self, deadline: GameMinute) {
        *self = Self {
            deadline: Some(deadline),
            advice_prepared: false,
            authorization: ClientAuthorization::NotRequested,
            filed_at: None,
            outcome: None,
        };
    }

    pub(crate) fn mark_advice_prepared(&mut self) {
        self.advice_prepared = true;
    }

    pub(crate) fn request_authorization(&mut self) {
        self.authorization = ClientAuthorization::Pending;
    }

    pub(crate) fn record_authorization(&mut self, approved: bool) {
        self.authorization = if approved {
            ClientAuthorization::Approved
        } else {
            ClientAuthorization::Declined
        };
    }

    pub(crate) fn mark_filed(&mut self, at: GameMinute) {
        self.filed_at = Some(at);
    }

    pub(crate) fn record_outcome(&mut self, outcome: DecisionOutcome) {
        self.outcome = Some(outcome);
    }
}

/// Alleged cassation ground supplied by an adapter or scenario.
///
/// The enum intentionally distinguishes cognizable legal grounds from attempts
/// to obtain a third merits review.
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash, Serialize, Deserialize)]
pub enum AllegedCassationGround {
    /// Incorrect interpretation or application of law.
    ErrorOfLaw,
    /// Essential procedural rule was violated.
    EssentialProceduralViolation,
    /// Judgment contains insufficient or contradictory reasoning.
    InadequateReasoning,
    /// Court exceeded or misunderstood its jurisdiction.
    JurisdictionalError,
    /// Party merely disputes factual findings.
    FactualReassessment,
    /// Party merely disputes the weight assigned to evidence.
    EvidenceWeightDisagreement,
}

impl AllegedCassationGround {
    /// Converts a cognizable allegation to a viable legal ground.
    #[must_use]
    pub const fn viable_ground(self) -> Option<CassationGround> {
        match self {
            Self::ErrorOfLaw => Some(CassationGround::ErrorOfLaw),
            Self::EssentialProceduralViolation => {
                Some(CassationGround::EssentialProceduralViolation)
            }
            Self::InadequateReasoning => Some(CassationGround::InadequateReasoning),
            Self::JurisdictionalError => Some(CassationGround::JurisdictionalError),
            Self::FactualReassessment | Self::EvidenceWeightDisagreement => None,
        }
    }
}

/// Legally cognizable cassation ground.
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash, Serialize, Deserialize)]
pub enum CassationGround {
    /// Error of law.
    ErrorOfLaw,
    /// Essential procedural violation.
    EssentialProceduralViolation,
    /// Insufficient or contradictory reasoning.
    InadequateReasoning,
    /// Jurisdictional error.
    JurisdictionalError,
}

/// Cassation result.
///
/// Successful cassation remits the matter; it does not directly rewrite the
/// merits judgment as a victory.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum CassationOutcome {
    /// Cassation rejected.
    Dismissed,
    /// Decision quashed and remitted.
    QuashedAndRemitted,
    /// Decision partially quashed and remitted.
    PartiallyQuashedAndRemitted,
}

/// Cassation lifecycle state.
#[derive(Debug, Default, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct CassationState {
    deadline: Option<GameMinute>,
    assessed: bool,
    alleged_grounds: BTreeSet<AllegedCassationGround>,
    viable_grounds: BTreeSet<CassationGround>,
    authorization: ClientAuthorization,
    filed_at: Option<GameMinute>,
    outcome: Option<CassationOutcome>,
}

impl CassationState {
    /// Cassation deadline.
    #[must_use]
    pub const fn deadline(&self) -> Option<GameMinute> {
        self.deadline
    }

    /// Whether grounds have been assessed.
    #[must_use]
    pub const fn assessed(&self) -> bool {
        self.assessed
    }

    /// Alleged grounds, including non-cognizable factual disagreements.
    #[must_use]
    pub fn alleged_grounds(&self) -> &BTreeSet<AllegedCassationGround> {
        &self.alleged_grounds
    }

    /// Viable legal grounds.
    #[must_use]
    pub fn viable_grounds(&self) -> &BTreeSet<CassationGround> {
        &self.viable_grounds
    }

    /// Client authorization state.
    #[must_use]
    pub const fn authorization(&self) -> ClientAuthorization {
        self.authorization
    }

    /// Filing time.
    #[must_use]
    pub const fn filed_at(&self) -> Option<GameMinute> {
        self.filed_at
    }

    /// Cassation outcome.
    #[must_use]
    pub const fn outcome(&self) -> Option<CassationOutcome> {
        self.outcome
    }

    pub(crate) fn open(&mut self, deadline: GameMinute) {
        *self = Self {
            deadline: Some(deadline),
            assessed: false,
            alleged_grounds: BTreeSet::new(),
            viable_grounds: BTreeSet::new(),
            authorization: ClientAuthorization::NotRequested,
            filed_at: None,
            outcome: None,
        };
    }

    pub(crate) fn assess(
        &mut self,
        alleged_grounds: BTreeSet<AllegedCassationGround>,
        viable_grounds: BTreeSet<CassationGround>,
    ) {
        self.assessed = true;
        self.alleged_grounds = alleged_grounds;
        self.viable_grounds = viable_grounds;
    }

    pub(crate) fn request_authorization(&mut self) {
        self.authorization = ClientAuthorization::Pending;
    }

    pub(crate) fn record_authorization(&mut self, approved: bool) {
        self.authorization = if approved {
            ClientAuthorization::Approved
        } else {
            ClientAuthorization::Declined
        };
    }

    pub(crate) fn mark_filed(&mut self, at: GameMinute) {
        self.filed_at = Some(at);
    }

    pub(crate) fn record_outcome(&mut self, outcome: CassationOutcome) {
        self.outcome = Some(outcome);
    }
}
