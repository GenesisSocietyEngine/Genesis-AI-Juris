//! Terminal presentation layer for the v0.4 vertical slice.
//!
//! The CLI owns input and rendering only. It never edits `MatterState`; every
//! choice is submitted to `Engine::apply_action`. This intentionally mirrors a
//! future mobile client, which should be replaceable without changing rules.

use juris_ai::ScriptedAiActor;
use juris_domain::{CaseOutcome, DeadlineStatus, GameMode, InboxStatus, MatterState};
use juris_engine::Engine;
use std::env;
use std::io::{self, Write};

fn main() {
    let args: Vec<String> = env::args().collect();
    if !args.iter().any(|arg| arg == "start-day") {
        print_usage();
        return;
    }

    let seed = parse_seed(&args).unwrap_or(20260724);
    let mode = parse_mode(&args).unwrap_or(GameMode::Career);
    let mut engine = Engine::new(seed, mode, ScriptedAiActor);

    println!("GENESIS: AI Juris v0.4.2");
    println!("Seed: {} | Mode: {:?}", engine.seed(), engine.mode());
    println!("Matter: {}\n", engine.state().title);
    engine.advance_to_next_event();

    while !engine.state().is_resolved() {
        print_state(&engine);
        let options = engine.available_options();
        for (index, option) in options.iter().enumerate() {
            println!("  {}. {}", index + 1, option.label);
            println!("     {}", option.description);
            println!(
                "     Player time: {} | Cost: EUR {}",
                format_duration(option.player_minutes),
                option.monetary_cost_eur
            );
        }
        println!("  {}. Advance to next world event", options.len() + 1);

        let choice = read_selection(options.len() + 1);
        if choice == options.len() + 1 {
            if !engine.advance_to_next_event() {
                println!("No scheduled events remain. Choose a legal action.\n");
            }
        } else if let Err(error) = engine.apply_action(options[choice - 1].action) {
            println!("Action rejected: {error}\n");
        }
    }

    print_final(engine.state());
}

fn parse_seed(args: &[String]) -> Option<u64> {
    args.windows(2)
        .find(|pair| pair[0] == "--seed")
        .and_then(|pair| pair[1].parse().ok())
}

fn parse_mode(args: &[String]) -> Option<GameMode> {
    let value = args.windows(2).find(|pair| pair[0] == "--mode")?.get(1)?;
    match value.as_str() {
        "career" => Some(GameMode::Career),
        "assisted" => Some(GameMode::Assisted),
        "hardcore" => Some(GameMode::Hardcore),
        "tournament" => Some(GameMode::Tournament),
        _ => None,
    }
}

fn read_selection(max: usize) -> usize {
    loop {
        print!("> ");
        io::stdout().flush().expect("stdout must be writable");
        let mut input = String::new();
        if io::stdin().read_line(&mut input).is_ok() {
            if let Ok(number) = input.trim().parse::<usize>() {
                if (1..=max).contains(&number) {
                    return number;
                }
            }
        }
        println!("Enter a number from 1 to {max}.");
    }
}

fn print_state(engine: &Engine<ScriptedAiActor>) {
    let state = engine.state();
    let (hour, minute) = state.now.hour_minute();
    println!(
        "\n=== Day {} {:02}:{:02} | {:?} ===",
        state.now.day(),
        hour,
        minute,
        state.stage
    );
    if let Some(seconds) = engine.decision_seconds() {
        println!("Decision window: {seconds} seconds");
    }
    println!(
        "Position {}/100 | Merits {} | Evidence {} | Procedure {} | Leverage {}",
        state.position_score(),
        state.legal_merits.value(),
        state.evidence_quality.value(),
        state.procedural_position.value(),
        state.negotiation_leverage.value()
    );
    println!(
        "Spend EUR {} | Billable {:.1}h | Ethics {} | Client trust {}",
        state.budget_spent_eur,
        state.billable_minutes as f64 / 60.0,
        state.reputation.ethical_standing.value(),
        state.reputation.client_trust.value()
    );
    println!(
        "Today {:.1}/{:.1}h | Fatigue {} | Strain {} | Total overtime {:.1}h",
        state.work.minutes_worked_today as f64 / 60.0,
        state.work.daily_capacity_minutes as f64 / 60.0,
        state.work.fatigue.value(),
        state.work.cumulative_strain.value(),
        state.work.overtime_minutes_total as f64 / 60.0
    );
    println!(
        "AI requests {}/{} | Unhandled required messages {}",
        state.ai_usage.requests_used,
        state.ai_usage.request_limit,
        state.unhandled_required_messages()
    );
    if let Some(note) = &state.ai_usage.last_note {
        println!("Latest AI note: {note}");
    }

    print_inbox(state);
    print_deadlines(state);
    print_evidence(state);
    print_litigation_status(state);
    if let Some(offer) = &state.settlement_offer {
        let (hour, minute) = offer.expires_at.hour_minute();
        println!(
            "Current settlement offer: EUR {} | revision {} | expires Day {} {:02}:{:02}",
            offer.amount_eur,
            offer.revision,
            offer.expires_at.day(),
            hour,
            minute
        );
    }
    println!(
        "Authorized budget: EUR {} | Remaining authority: EUR {}",
        state.authorized_budget_eur,
        state
            .authorized_budget_eur
            .saturating_sub(state.budget_spent_eur)
    );
    println!();
}

fn print_inbox(state: &MatterState) {
    if state.inbox.is_empty() {
        return;
    }
    println!("Inbox:");
    for message in state.inbox.iter().rev().take(8).rev() {
        let (hour, minute) = message.received_at.hour_minute();
        let status = match message.status {
            InboxStatus::Unread => "unread",
            InboxStatus::Read => "read",
            InboxStatus::ActionRequired => "ACTION REQUIRED",
            InboxStatus::Resolved => "resolved",
            InboxStatus::Archived => "archived",
        };
        println!(
            "  - [Day {} {:02}:{:02} | {}] {:?} — {}",
            message.received_at.day(),
            hour,
            minute,
            status,
            message.from,
            message.subject
        );
        println!("    {}", message.body);
    }
}

fn print_deadlines(state: &MatterState) {
    if state.deadlines.is_empty() {
        return;
    }
    println!("Deadlines:");
    for deadline in &state.deadlines {
        let (hour, minute) = deadline.due.hour_minute();
        let marker = match deadline.status {
            DeadlineStatus::Open => "OPEN",
            DeadlineStatus::Completed => "DONE",
            DeadlineStatus::Missed => "MISSED",
        };
        println!(
            "  - [{marker}] {} — Day {} {:02}:{:02}",
            deadline.label,
            deadline.due.day(),
            hour,
            minute
        );
    }
}

fn print_evidence(state: &MatterState) {
    let known: Vec<&str> = state
        .evidence
        .iter()
        .filter(|evidence| evidence.discovered)
        .map(|evidence| evidence.title.as_str())
        .collect();
    println!("Known evidence: {}", known.join(", "));
}

fn print_litigation_status(state: &MatterState) {
    if state.litigation.statement_drafted
        || state.litigation.statement_filed
        || state.litigation.disclosure_served
        || state.litigation.hearing_scheduled_for.is_some()
    {
        println!(
            "Litigation: draft={} filed={} disclosure={} opponent-reviewed={} expert-reviewed={} witnesses={} rehearsal={}",
            state.litigation.statement_drafted,
            state.litigation.statement_filed,
            state.litigation.disclosure_served,
            state.litigation.opponent_disclosure_reviewed,
            state.litigation.expert_report_reviewed,
            state.litigation.witnesses_prepared,
            state.litigation.hearing_rehearsed
        );
    }
}

fn print_final(state: &MatterState) {
    println!("\n=== MATTER RESOLVED ===");
    match state
        .outcome
        .as_ref()
        .expect("resolved matter must contain an outcome")
    {
        CaseOutcome::Settlement {
            amount_eur,
            net_after_legal_spend_eur,
        } => {
            println!("Settlement accepted: EUR {amount_eur}");
            println!("Net after recorded legal spend: EUR {net_after_legal_spend_eur}");
        }
        CaseOutcome::Judgment {
            client_won,
            damages_eur,
            costs_awarded_eur,
            breakdown,
        } => {
            println!("Client won: {client_won}");
            println!("Damages: EUR {damages_eur}");
            println!("Costs award: EUR {costs_awarded_eur}");
            println!("\nJudgment calculation:");
            println!(
                "  Pre-hearing case strength: {}/100",
                breakdown.base_position
            );
            for factor in &breakdown.factors {
                println!("  {:+3}  {}", factor.modifier, factor.label);
            }
            println!("  Adjusted win probability: {}%", breakdown.win_threshold);
            println!("  Deterministic roll: {}", breakdown.deterministic_roll);
        }
    }
    println!("\nFinal position: {}/100", state.position_score());
    println!(
        "Ethical standing: {}/100",
        state.reputation.ethical_standing.value()
    );
    println!("Total spend: EUR {}", state.budget_spent_eur);
    println!(
        "Billable time: {:.1}h",
        state.billable_minutes as f64 / 60.0
    );
    println!("Final fatigue: {}/100", state.work.fatigue.value());
    println!(
        "Deadlines completed/missed: {}/{}",
        state
            .deadlines
            .iter()
            .filter(|deadline| deadline.status == DeadlineStatus::Completed)
            .count(),
        state
            .deadlines
            .iter()
            .filter(|deadline| deadline.status == DeadlineStatus::Missed)
            .count()
    );
}

fn format_duration(minutes: u32) -> String {
    if minutes == 0 {
        return "immediate".to_owned();
    }
    let hours = minutes / 60;
    let remainder = minutes % 60;
    match (hours, remainder) {
        (0, minutes) => format!("{minutes}m"),
        (hours, 0) => format!("{hours}h"),
        (hours, minutes) => format!("{hours}h {minutes}m"),
    }
}

fn print_usage() {
    println!(
        "Usage: cargo run -p juris-cli -- start-day --mode <career|assisted|hardcore|tournament> --seed <u64>"
    );
}
