//! AI actor boundary.
//!
//! No external model is called in v0.3. The trait is intentionally narrow:
//! AI may propose language or analysis, but cannot mutate simulation state.
//! A future cloud or local LLM adapter must return the same typed response.

use juris_domain::{ActorId, MatterState};

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ActorPrompt {
    pub actor: ActorId,
    pub objective: String,
    pub known_facts: Vec<String>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ActorResponse {
    pub text: String,
    pub confidence_percent: u8,
}

pub trait AiActor {
    fn respond(&self, prompt: &ActorPrompt, state: &MatterState) -> ActorResponse;
}

/// Deterministic stand-in used by tests and the offline CLI.
#[derive(Debug, Default, Clone, Copy)]
pub struct ScriptedAiActor;

impl AiActor for ScriptedAiActor {
    fn respond(&self, prompt: &ActorPrompt, state: &MatterState) -> ActorResponse {
        let text = match prompt.actor {
            ActorId::AiAssociate => format!(
                "AI associate: {}. I found {} known facts; current position is {}/100. Verify all authorities before relying on this note.",
                prompt.objective,
                prompt.known_facts.len(),
                state.position_score()
            ),
            ActorId::OpposingCounsel => {
                "Opposing counsel rejects liability but remains open to a commercial resolution.".to_owned()
            }
            ActorId::ClientCfo => {
                "The CFO insists that the supplier caused the failure and asks for an immediate aggressive response.".to_owned()
            }
            _ => "The actor acknowledges the development.".to_owned(),
        };

        ActorResponse {
            text,
            confidence_percent: 78,
        }
    }
}
