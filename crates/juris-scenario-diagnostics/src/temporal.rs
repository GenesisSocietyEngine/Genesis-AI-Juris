use std::collections::BTreeMap;

use juris_scenario_schema::{
    EventDefinition, EventKind, EventTrigger, RelativeTimeDefinition, ScenarioDefinition,
    ScenarioTime,
};

use crate::{AuthoringDiagnostic, AuthoringDiagnosticCode, AuthoringValidationReport};

pub(crate) fn validate_temporal_coherence(
    scenario: &ScenarioDefinition,
    report: &mut AuthoringValidationReport,
) {
    let events = scenario
        .events
        .iter()
        .map(|event| (event.id.as_str(), event))
        .collect::<BTreeMap<_, _>>();

    if let Some(initial_clock) = scenario.initial_clock {
        validate_time(
            initial_clock,
            "initial_clock".to_owned(),
            "initial clock",
            report,
        );
    }
    validate_event_times(scenario, report);
    validate_action_times(scenario, report);
    validate_deadlines(scenario, &events, report);
    validate_async_tasks(scenario, &events, report);
    validate_fixed_procedural_order(scenario, report);
    report.sort();
}

fn validate_action_times(scenario: &ScenarioDefinition, report: &mut AuthoringValidationReport) {
    for (index, action) in scenario.actions.iter().enumerate() {
        if let Some(timing) = &action.completion_timing {
            validate_relative_time(
                timing,
                &format!("actions[{index}].completion_timing"),
                "action completion",
                report,
            );
        }
    }
}

fn validate_event_times(scenario: &ScenarioDefinition, report: &mut AuthoringValidationReport) {
    for (index, event) in scenario.events.iter().enumerate() {
        if let EventTrigger::AtTime { at } = event.trigger {
            validate_time(
                at,
                format!("events[{index}].trigger.at"),
                "scheduled event",
                report,
            );
        }
    }
}

fn validate_deadlines(
    scenario: &ScenarioDefinition,
    events: &BTreeMap<&str, &EventDefinition>,
    report: &mut AuthoringValidationReport,
) {
    for (index, deadline) in scenario.deadlines.iter().enumerate() {
        let path = format!("deadlines[{index}]");
        let due = validate_time(
            deadline.due_at,
            format!("{path}.due_at"),
            "deadline",
            report,
        );
        if let Some(relative_due) = &deadline.relative_due {
            validate_relative_time(
                relative_due,
                &format!("{path}.relative_due"),
                "relative deadline",
                report,
            );
        }

        if deadline.relative_due.is_none() {
            if let Some(activation_id) = deadline.activation_event.as_ref() {
                if let Some(EventDefinition {
                    trigger: EventTrigger::AtTime { at },
                    ..
                }) = events.get(activation_id.as_str()).copied()
                {
                    if let (Some(activation), Some(due)) = (time_value(*at), due) {
                        if activation > due {
                            report.push(AuthoringDiagnostic::error(
                                AuthoringDiagnosticCode::DeadlineActivatesAfterDue,
                                format!("{path}.activation_event"),
                                format!("deadline `{}` activates after its due time", deadline.id),
                                "Move the activation event earlier or move the deadline later.",
                            ));
                        }
                    }
                }
            }
        }

        if deadline.relative_due.is_none() {
            if let Some(completion_id) = deadline.completion_event.as_ref() {
                if let Some(EventDefinition {
                    trigger: EventTrigger::AtTime { at },
                    ..
                }) = events.get(completion_id.as_str()).copied()
                {
                    if let (Some(completion), Some(due)) = (time_value(*at), due) {
                        if completion > due {
                            report.push(AuthoringDiagnostic::error(
                                AuthoringDiagnosticCode::DeadlineCompletionAfterDue,
                                format!("{path}.completion_event"),
                                format!(
                                    "deadline `{}` has a fixed completion event after its due time",
                                    deadline.id
                                ),
                                "Schedule completion no later than the due time or make it action-driven.",
                            ));
                        }
                    }
                }
            }
        }

        if let Some(missed_event) = events.get(deadline.missed_event.as_str()).copied() {
            let matches_deadline = match &missed_event.trigger {
                EventTrigger::DeadlineMissed {
                    deadline: referenced,
                } => referenced == &deadline.id,
                _ => false,
            };

            if !matches_deadline {
                report.push(AuthoringDiagnostic::error(
                    AuthoringDiagnosticCode::DeadlineMissTriggerMismatch,
                    format!("{path}.missed_event"),
                    format!(
                        "deadline `{}` points to event `{}`, but that event is not triggered by missing this deadline",
                        deadline.id, deadline.missed_event
                    ),
                    format!(
                        "Use trigger {{ type: deadline_missed, deadline: {} }} on the missed event.",
                        deadline.id
                    ),
                ));
            }
        }
    }
}

fn validate_async_tasks(
    scenario: &ScenarioDefinition,
    events: &BTreeMap<&str, &EventDefinition>,
    report: &mut AuthoringValidationReport,
) {
    for (index, task) in scenario.async_tasks.iter().enumerate() {
        let path = format!("async_tasks[{index}]");

        if task.duration_minutes == 0 {
            report.push(AuthoringDiagnostic::error(
                AuthoringDiagnosticCode::ZeroDurationAsyncTask,
                format!("{path}.duration_minutes"),
                format!("asynchronous task `{}` has zero duration", task.id),
                "Use a positive deterministic duration in simulated minutes.",
            ));
        }
        if let Some(timing) = &task.completion_timing {
            validate_relative_time(
                timing,
                &format!("{path}.completion_timing"),
                "asynchronous completion",
                report,
            );
        }

        let usable = task
            .usable_until_event
            .as_ref()
            .and_then(|id| fixed_event_time(events.get(id.as_str()).copied()));
        let expiry = task
            .expiry_event
            .as_ref()
            .and_then(|id| fixed_event_time(events.get(id.as_str()).copied()));

        if let (Some(usable), Some(expiry)) = (usable, expiry) {
            if expiry < usable {
                report.push(AuthoringDiagnostic::error(
                    AuthoringDiagnosticCode::TaskExpiryBeforeUsableBoundary,
                    format!("{path}.expiry_event"),
                    format!(
                        "asynchronous task `{}` expires before its declared usable-until event",
                        task.id
                    ),
                    "Move the expiry event to the same time or later than the usable boundary.",
                ));
            }
        }
    }
}

fn validate_relative_time(
    timing: &RelativeTimeDefinition,
    path: &str,
    subject: &str,
    report: &mut AuthoringValidationReport,
) {
    if let Some(calendar) = timing.calendar_target {
        validate_time(
            ScenarioTime::new(calendar.day_offset, calendar.minute_of_day),
            format!("{path}.calendar_target.minute_of_day"),
            subject,
            report,
        );
    }
    if let Some(not_before) = timing.not_before {
        validate_time(not_before, format!("{path}.not_before"), subject, report);
    }
}

fn validate_fixed_procedural_order(
    scenario: &ScenarioDefinition,
    report: &mut AuthoringValidationReport,
) {
    let judgment = earliest_fixed_time(scenario, EventKind::Judgment);
    let appeal = earliest_fixed_time(scenario, EventKind::Appeal);
    let cassation = earliest_fixed_time(scenario, EventKind::Cassation);

    if let (Some((judgment_index, judgment_time)), Some((appeal_index, appeal_time))) =
        (judgment, appeal)
    {
        if appeal_time < judgment_time {
            report.push(AuthoringDiagnostic::error(
                AuthoringDiagnosticCode::AppealScheduledBeforeJudgment,
                format!("events[{appeal_index}].trigger.at"),
                "a fixed-time appeal event is scheduled before the first fixed-time judgment event",
                format!(
                    "Schedule the appeal after events[{judgment_index}] or make it causally dependent on that judgment."
                ),
            ));
        }
    }

    if let (Some((appeal_index, appeal_time)), Some((cassation_index, cassation_time))) =
        (appeal, cassation)
    {
        if cassation_time < appeal_time {
            report.push(AuthoringDiagnostic::error(
                AuthoringDiagnosticCode::CassationScheduledBeforeAppeal,
                format!("events[{cassation_index}].trigger.at"),
                "a fixed-time cassation event is scheduled before the fixed-time appeal event",
                format!(
                    "Schedule cassation after events[{appeal_index}] or trigger it from the appellate result."
                ),
            ));
        }
    }

    if let (Some((judgment_index, judgment_time)), Some((cassation_index, cassation_time))) =
        (judgment, cassation)
    {
        if cassation_time < judgment_time {
            report.push(AuthoringDiagnostic::error(
                AuthoringDiagnosticCode::CassationScheduledBeforeJudgment,
                format!("events[{cassation_index}].trigger.at"),
                "a fixed-time cassation event is scheduled before the first fixed-time judgment event",
                format!(
                    "Schedule cassation after events[{judgment_index}] and after the appellate process."
                ),
            ));
        }
    }
}

fn validate_time(
    time: ScenarioTime,
    path: String,
    subject: &str,
    report: &mut AuthoringValidationReport,
) -> Option<u64> {
    match time_value(time) {
        Some(value) => Some(value),
        None => {
            report.push(AuthoringDiagnostic::error(
                AuthoringDiagnosticCode::InvalidScenarioTime,
                path,
                format!(
                    "{subject} uses minute_of_day {}, which is outside 0..1440",
                    time.minute_of_day
                ),
                "Store typed scenario time with minute_of_day between 0 and 1439.",
            ));
            None
        }
    }
}

fn time_value(time: ScenarioTime) -> Option<u64> {
    if time.minute_of_day >= 1_440 {
        return None;
    }

    Some(u64::from(time.day) * 1_440 + u64::from(time.minute_of_day))
}

fn fixed_event_time(event: Option<&EventDefinition>) -> Option<u64> {
    match event {
        Some(EventDefinition {
            trigger: EventTrigger::AtTime { at },
            ..
        }) => time_value(*at),
        _ => None,
    }
}

fn earliest_fixed_time(scenario: &ScenarioDefinition, kind: EventKind) -> Option<(usize, u64)> {
    scenario
        .events
        .iter()
        .enumerate()
        .filter(|(_, event)| event.kind == kind)
        .filter_map(|(index, event)| fixed_event_time(Some(event)).map(|time| (index, time)))
        .min_by_key(|(_, time)| *time)
}
