//! Deterministic infrastructure shared by every GENESIS: AI Juris system.
//!
//! This crate deliberately contains no legal concepts. Its responsibility is
//! to provide reproducible simulation time, stable event ordering, and seeded
//! pseudo-randomness. Keeping these primitives independent prevents AI text,
//! UI rendering, wall-clock time, or operating-system scheduling from becoming
//! accidental sources of authoritative game state.

use serde::{Deserialize, Serialize};
use std::cmp::Ordering;
use std::collections::BinaryHeap;

/// Number of simulation minutes in one calendar day.
pub const MINUTES_PER_DAY: u32 = 24 * 60;

/// A monotonically increasing in-world minute counter.
///
/// The simulation does not store local wall-clock timestamps. Replaying the
/// same seed and player actions must produce the same world on every machine.
/// Presentation layers may translate a value into labels such as "Day 2 09:30".
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Serialize, Deserialize)]
pub struct SimMinute(pub u32);

impl SimMinute {
    /// The prototype begins on Day 1 at 08:00.
    pub const START_OF_DAY: Self = Self(8 * 60);

    /// Returns a new timestamp advanced by `minutes`.
    ///
    /// The explicit method name documents overflow behavior and avoids the
    /// ambiguity that Clippy correctly identifies for a generic method named
    /// `add`, which could be confused with `std::ops::Add::add`.
    pub fn saturating_add_minutes(self, minutes: u32) -> Self {
        Self(self.0.saturating_add(minutes))
    }

    /// Returns the one-based simulation day containing this timestamp.
    pub fn day(self) -> u32 {
        self.0 / MINUTES_PER_DAY + 1
    }

    /// Returns the twenty-four-hour clock representation within the day.
    pub fn hour_minute(self) -> (u32, u32) {
        ((self.0 / 60) % 24, self.0 % 60)
    }

    /// Returns the next 08:00 that is strictly later than this timestamp.
    ///
    /// If the current time is before 08:00, the result is 08:00 on the same
    /// calendar day. At or after 08:00, the result is 08:00 on the next day.
    pub fn next_workday_start(self) -> Self {
        let day_start = self.0 - self.0 % MINUTES_PER_DAY;
        let today_at_eight = day_start + 8 * 60;
        if self.0 < today_at_eight {
            Self(today_at_eight)
        } else {
            Self(today_at_eight.saturating_add(MINUTES_PER_DAY))
        }
    }
}

/// Stable event ID used as a deterministic tie-breaker.
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Serialize, Deserialize)]
pub struct EventId(pub u64);

/// One payload waiting for its due simulation minute.
///
/// `sequence` guarantees first-in-first-out behavior when several events share
/// the same due minute. Without this tie-breaker, heap implementation details
/// could make replays differ across builds.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct Scheduled<T> {
    pub due: SimMinute,
    pub sequence: EventId,
    pub payload: T,
}

impl<T: Eq> Ord for Scheduled<T> {
    fn cmp(&self, other: &Self) -> Ordering {
        // `BinaryHeap` is a max-heap. Reversing both comparisons makes the
        // earliest timestamp and then the earliest sequence appear first.
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

/// Deterministic priority queue for future world events.
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
    /// Schedules a payload and returns the stable event ID assigned to it.
    pub fn schedule(&mut self, due: SimMinute, payload: T) -> EventId {
        let id = EventId(self.next_sequence);
        self.next_sequence = self.next_sequence.saturating_add(1);
        self.queue.push(Scheduled {
            due,
            sequence: id,
            payload,
        });
        id
    }

    /// Removes the earliest event when it is due at or before `now`.
    pub fn pop_due(&mut self, now: SimMinute) -> Option<Scheduled<T>> {
        match self.queue.peek() {
            Some(next) if next.due <= now => self.queue.pop(),
            _ => None,
        }
    }

    /// Returns the next due minute without removing the event.
    pub fn next_due(&self) -> Option<SimMinute> {
        self.queue.peek().map(|item| item.due)
    }

    /// Returns whether no future events remain.
    pub fn is_empty(&self) -> bool {
        self.queue.is_empty()
    }
}

/// Small dependency-free pseudo-random number generator.
///
/// This generator is not cryptographically secure and must never be used for
/// secrets. It exists only to make controlled uncertainty exactly reproducible
/// from the simulation seed.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct DeterministicRng {
    state: u64,
}

impl DeterministicRng {
    /// Creates a generator. Seed zero is mapped to one because xorshift would
    /// otherwise remain permanently stuck at zero.
    pub fn new(seed: u64) -> Self {
        Self { state: seed.max(1) }
    }

    /// Produces the next deterministic 64-bit value.
    pub fn next_u64(&mut self) -> u64 {
        let mut x = self.state;
        x ^= x << 13;
        x ^= x >> 7;
        x ^= x << 17;
        self.state = x;
        x
    }

    /// Produces a zero-based percentage roll in `0..=99`.
    pub fn roll_percent(&mut self) -> u8 {
        (self.next_u64() % 100) as u8
    }

    /// Produces a player-facing percentage roll in `1..=100`.
    pub fn roll_one_to_one_hundred(&mut self) -> u8 {
        self.roll_percent().saturating_add(1)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn scheduler_preserves_fifo_order_for_equal_due_times() {
        // This test proves that two simultaneous messages are replayed in the
        // order in which systems scheduled them, not in arbitrary heap order.
        let mut scheduler = Scheduler::default();
        scheduler.schedule(SimMinute(10), "first");
        scheduler.schedule(SimMinute(10), "second");

        assert_eq!(scheduler.pop_due(SimMinute(10)).unwrap().payload, "first");
        assert_eq!(scheduler.pop_due(SimMinute(10)).unwrap().payload, "second");
    }

    #[test]
    fn identical_rng_seeds_generate_identical_sequences() {
        // This is the foundational replay invariant: equal seeds must generate
        // equal uncertainty regardless of the host machine.
        let mut left = DeterministicRng::new(42);
        let mut right = DeterministicRng::new(42);
        let left_values: Vec<u64> = (0..10).map(|_| left.next_u64()).collect();
        let right_values: Vec<u64> = (0..10).map(|_| right.next_u64()).collect();
        assert_eq!(left_values, right_values);
    }

    #[test]
    fn next_workday_start_never_moves_time_backwards() {
        // Rest must never rewind the world. Before 08:00 it advances to today's
        // start; after 08:00 it advances to tomorrow's start.
        assert_eq!(SimMinute(7 * 60).next_workday_start(), SimMinute(8 * 60));
        assert_eq!(
            SimMinute(9 * 60).next_workday_start(),
            SimMinute(MINUTES_PER_DAY + 8 * 60)
        );
    }
}
