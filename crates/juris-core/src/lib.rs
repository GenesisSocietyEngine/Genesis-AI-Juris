//! Deterministic infrastructure shared by every GENESIS: AI Juris system.
//!
//! This crate deliberately contains no legal concepts. Its responsibility is
//! to provide reproducible time, IDs, pseudo-randomness, and event scheduling.
//! Keeping these mechanics independent prevents AI text generation or UI code
//! from becoming an accidental source of simulation state.

use serde::{Deserialize, Serialize};
use std::cmp::Ordering;
use std::collections::BinaryHeap;

/// A monotonically increasing in-world minute counter.
///
/// We avoid wall-clock timestamps because replaying the same seed and actions
/// must reproduce the same world. Presentation layers may translate this value
/// into dates and times such as "Monday 08:12".
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Serialize, Deserialize)]
pub struct SimMinute(pub u32);

impl SimMinute {
    pub const START_OF_DAY: Self = Self(8 * 60);

    pub fn saturating_add_minutes(self, minutes: u32) -> Self {
        Self(self.0.saturating_add(minutes))
    }

    pub fn day(self) -> u32 {
        self.0 / (24 * 60) + 1
    }

    pub fn hour_minute(self) -> (u32, u32) {
        ((self.0 / 60) % 24, self.0 % 60)
    }
}

/// Stable event ID used as a deterministic tie-breaker.
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Serialize, Deserialize)]
pub struct EventId(pub u64);

/// A scheduled payload. `sequence` guarantees FIFO order for events sharing
/// the same due minute, which is essential for deterministic replay.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct Scheduled<T> {
    pub due: SimMinute,
    pub sequence: EventId,
    pub payload: T,
}

impl<T: Eq> Ord for Scheduled<T> {
    fn cmp(&self, other: &Self) -> Ordering {
        // BinaryHeap is a max-heap, so reverse chronological ordering.
        other
            .due
            .cmp(&self.due)
            .then_with(|| other.sequence.cmp(&self.sequence))
    }
}

impl<T: Eq> PartialOrd for Scheduled<T> {
    fn partial_cmp(&self, other: &Self) -> Option<Ordering> {
        Some(self.cmp(other))
    }
}

/// Deterministic event scheduler.
#[derive(Debug, Clone)]
pub struct Scheduler<T: Eq> {
    queue: BinaryHeap<Scheduled<T>>,
    next_sequence: u64,
}

impl<T: Eq> Default for Scheduler<T> {
    fn default() -> Self {
        Self {
            queue: BinaryHeap::new(),
            next_sequence: 1,
        }
    }
}

impl<T: Eq> Scheduler<T> {
    pub fn schedule(&mut self, due: SimMinute, payload: T) -> EventId {
        let id = EventId(self.next_sequence);
        self.next_sequence += 1;
        self.queue.push(Scheduled {
            due,
            sequence: id,
            payload,
        });
        id
    }

    pub fn pop_due(&mut self, now: SimMinute) -> Option<Scheduled<T>> {
        match self.queue.peek() {
            Some(next) if next.due <= now => self.queue.pop(),
            _ => None,
        }
    }

    pub fn next_due(&self) -> Option<SimMinute> {
        self.queue.peek().map(|item| item.due)
    }

    pub fn is_empty(&self) -> bool {
        self.queue.is_empty()
    }
}

/// Small, dependency-free PRNG. It is not cryptographically secure; it exists
/// only to make controlled uncertainty reproducible across machines.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct DeterministicRng {
    state: u64,
}

impl DeterministicRng {
    pub fn new(seed: u64) -> Self {
        Self { state: seed.max(1) }
    }

    pub fn next_u64(&mut self) -> u64 {
        let mut x = self.state;
        x ^= x << 13;
        x ^= x >> 7;
        x ^= x << 17;
        self.state = x;
        x
    }

    pub fn roll_percent(&mut self) -> u8 {
        (self.next_u64() % 100) as u8
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn scheduler_preserves_fifo_order_for_equal_due_times() {
        let mut scheduler = Scheduler::default();
        scheduler.schedule(SimMinute(10), "first");
        scheduler.schedule(SimMinute(10), "second");

        assert_eq!(scheduler.pop_due(SimMinute(10)).unwrap().payload, "first");
        assert_eq!(scheduler.pop_due(SimMinute(10)).unwrap().payload, "second");
    }

    #[test]
    fn identical_rng_seeds_generate_identical_sequences() {
        let mut left = DeterministicRng::new(42);
        let mut right = DeterministicRng::new(42);
        let left_values: Vec<u64> = (0..10).map(|_| left.next_u64()).collect();
        let right_values: Vec<u64> = (0..10).map(|_| right.next_u64()).collect();
        assert_eq!(left_values, right_values);
    }
}
