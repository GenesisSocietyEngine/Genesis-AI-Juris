use juris_ai::ScriptedAiActor;
use juris_domain::{CaseOutcome, GameMode, PlayerAction};
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

    println!("GENESIS: AI Juris v0.3.1");
    println!("Seed: {} | Mode: {:?}", engine.seed(), engine.mode());
    println!("Matter: {}\n", engine.state().title);
    engine.advance_to_next_event();

    while !engine.state().is_resolved() {
        print_state(&engine);
        let actions = engine.available_actions();
        for (index, action) in actions.iter().enumerate() {
            println!("  {}. {}", index + 1, action_label(*action));
        }
        println!("  {}. Advance to next world event", actions.len() + 1);

        let choice = read_selection(actions.len() + 1);
        if choice == actions.len() + 1 {
            if !engine.advance_to_next_event() {
                println!("No scheduled events remain. Choose a legal action.\n");
            }
        } else if let Err(error) = engine.apply_action(actions[choice - 1]) {
            println!("Action rejected: {error}\n");
        }
    }

    print_final(&engine);
}

fn parse_seed(args: &[String]) -> Option<u64> {
    args.windows(2)
        .find(|pair| pair[0] == "--seed")
        .and_then(|pair| pair[1].parse().ok())
}

fn parse_mode(args: &[String]) -> Option<GameMode> {
    let value = args
        .windows(2)
        .find(|pair| pair[0] == "--mode")?
        .get(1)?;
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
    println!("\n=== Day {} {:02}:{:02} | {:?} ===", state.now.day(), hour, minute, state.stage);
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
        "AI requests {}/{}",
        state.ai_usage.requests_used, state.ai_usage.request_limit
    );
    if let Some(note) = &state.ai_usage.last_note {
        println!("AI note: {note}");
    }
    if !state.inbox.is_empty() {
        println!("Inbox:");
        for message in state.inbox.iter().rev().take(3).rev() {
            println!("  - {message}");
        }
    }
    println!();
}

fn print_final(engine: &Engine<ScriptedAiActor>) {
    let state = engine.state();
    println!("\n=== MATTER RESOLVED ===");
    match state.outcome.as_ref().expect("resolved state has outcome") {
        CaseOutcome::Settlement { amount_eur } => {
            println!("Settlement: EUR {amount_eur}");
        }
        CaseOutcome::Judgment {
            client_won,
            damages_eur,
            costs_awarded_eur,
        } => {
            println!("Client won: {client_won}");
            println!("Damages: EUR {damages_eur}");
            println!("Costs award: EUR {costs_awarded_eur}");
        }
    }
    println!("Final position: {}/100", state.position_score());
    println!("Ethical standing: {}/100", state.reputation.ethical_standing.value());
    println!("Total spend: EUR {}", state.budget_spent_eur);
}

fn action_label(action: PlayerAction) -> &'static str {
    match action {
        PlayerAction::RunConflictCheck => "Run conflict check",
        PlayerAction::AcceptMatterImmediately => "Accept matter immediately",
        PlayerAction::RequestDocuments => "Request and review full document set",
        PlayerAction::AskAiResearch => "Ask AI associate for legal research",
        PlayerAction::AskAiEvidenceReview => "Ask AI associate to review known evidence",
        PlayerAction::SendDemand => "Send an aggressive demand letter",
        PlayerAction::OfferMediation => "Propose early mediation",
        PlayerAction::RecoverDeletedMailbox => "Recover deleted mailbox data",
        PlayerAction::HireIndependentExpert => "Hire an independent ERP expert",
        PlayerAction::DiscloseAdverseEmails => "Disclose adverse emails",
        PlayerAction::ConcealAdverseEmails => "Conceal adverse emails",
        PlayerAction::AcceptSettlement => "Accept current settlement offer",
        PlayerAction::Litigate => "Reject settlement and litigate",
        PlayerAction::PrepareWitnesses => "Prepare witnesses for hearing",
    }
}

fn print_usage() {
    println!("Usage:");
    println!("  cargo run -p juris-cli -- start-day --mode career --seed 20260724");
    println!("Modes: career, assisted, hardcore, tournament");
}
