//! Conservative condition satisfiability analysis.
//!
//! The analyser proves only simple contradictions. Unknown predicates remain
//! potentially satisfiable, which avoids rejecting valid authored content.

use std::collections::BTreeMap;

use juris_scenario_schema::{Condition, IntegerComparisonOperator, IntegerOperand};

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub(crate) enum Satisfiability {
    Always,
    Possible,
    Never,
}

#[must_use]
pub(crate) fn classify(condition: &Condition) -> Satisfiability {
    match condition {
        Condition::Always => Satisfiability::Always,
        Condition::All { conditions } => classify_all(conditions),
        Condition::Any { conditions } => classify_any(conditions),
        Condition::Not { condition } => match classify(condition) {
            Satisfiability::Always => Satisfiability::Never,
            Satisfiability::Never => Satisfiability::Always,
            Satisfiability::Possible => Satisfiability::Possible,
        },
        Condition::IntegerCompare {
            left,
            operator,
            right,
        } => classify_integer_compare(left, *operator, right),
        _ => Satisfiability::Possible,
    }
}

fn classify_integer_compare(
    left: &IntegerOperand,
    operator: IntegerComparisonOperator,
    right: &IntegerOperand,
) -> Satisfiability {
    let known = match (left, right) {
        (IntegerOperand::Constant { value: left }, IntegerOperand::Constant { value: right }) => {
            Some((*left, *right))
        }
        (
            IntegerOperand::Metric {
                metric: left,
                offset: left_offset,
            },
            IntegerOperand::Metric {
                metric: right,
                offset: right_offset,
            },
        ) if left == right => Some((*left_offset, *right_offset)),
        (
            IntegerOperand::Resource {
                resource: left,
                offset: left_offset,
            },
            IntegerOperand::Resource {
                resource: right,
                offset: right_offset,
            },
        ) if left == right => Some((*left_offset, *right_offset)),
        _ => None,
    };
    let Some((left, right)) = known else {
        return Satisfiability::Possible;
    };
    if compare_integers(left, operator, right) {
        Satisfiability::Always
    } else {
        Satisfiability::Never
    }
}

fn compare_integers(left: i64, operator: IntegerComparisonOperator, right: i64) -> bool {
    match operator {
        IntegerComparisonOperator::Equal => left == right,
        IntegerComparisonOperator::NotEqual => left != right,
        IntegerComparisonOperator::LessThan => left < right,
        IntegerComparisonOperator::LessThanOrEqual => left <= right,
        IntegerComparisonOperator::GreaterThan => left > right,
        IntegerComparisonOperator::GreaterThanOrEqual => left >= right,
    }
}

fn classify_all(conditions: &[Condition]) -> Satisfiability {
    if has_direct_contradiction(conditions) {
        return Satisfiability::Never;
    }

    let mut all_always = true;
    for condition in conditions {
        match classify(condition) {
            Satisfiability::Never => return Satisfiability::Never,
            Satisfiability::Possible => all_always = false,
            Satisfiability::Always => {}
        }
    }

    if all_always {
        Satisfiability::Always
    } else {
        Satisfiability::Possible
    }
}

fn classify_any(conditions: &[Condition]) -> Satisfiability {
    if conditions.is_empty() {
        return Satisfiability::Never;
    }

    let mut any_possible = false;
    for condition in conditions {
        match classify(condition) {
            Satisfiability::Always => return Satisfiability::Always,
            Satisfiability::Possible => any_possible = true,
            Satisfiability::Never => {}
        }
    }

    if any_possible {
        Satisfiability::Possible
    } else {
        Satisfiability::Never
    }
}

fn has_direct_contradiction(conditions: &[Condition]) -> bool {
    let mut stage: Option<&str> = None;
    let mut flags: BTreeMap<&str, bool> = BTreeMap::new();
    let mut facts: BTreeMap<&str, String> = BTreeMap::new();
    let mut deadlines: BTreeMap<&str, String> = BTreeMap::new();
    let mut tasks: BTreeMap<&str, String> = BTreeMap::new();

    for condition in conditions {
        match condition {
            Condition::StageIs { stage: candidate } => {
                let candidate = candidate.as_str();
                match stage {
                    Some(existing) if existing != candidate => return true,
                    Some(_) => {}
                    None => stage = Some(candidate),
                }
            }
            Condition::FlagEquals { flag, value } => {
                if let Some(existing) = flags.insert(flag.as_str(), *value) {
                    if existing != *value {
                        return true;
                    }
                }
            }
            Condition::FactStatusIs { fact, status } => {
                let value = format!("{status:?}");
                if let Some(existing) = facts.insert(fact.as_str(), value.clone()) {
                    if existing != value {
                        return true;
                    }
                }
            }
            Condition::DeadlineStatusIs { deadline, status } => {
                let value = format!("{status:?}");
                if let Some(existing) = deadlines.insert(deadline.as_str(), value.clone()) {
                    if existing != value {
                        return true;
                    }
                }
            }
            Condition::AsyncTaskStatusIs { task, status } => {
                let value = format!("{status:?}");
                if let Some(existing) = tasks.insert(task.as_str(), value.clone()) {
                    if existing != value {
                        return true;
                    }
                }
            }
            Condition::Not { condition } => {
                if conditions
                    .iter()
                    .any(|candidate| candidate == condition.as_ref())
                {
                    return true;
                }
            }
            Condition::Always
            | Condition::EvidenceAvailable { .. }
            | Condition::InboxItemResolved { .. }
            | Condition::JudicialResultIs { .. }
            | Condition::IntegerCompare { .. }
            | Condition::All { .. }
            | Condition::Any { .. } => {}
        }
    }

    false
}
