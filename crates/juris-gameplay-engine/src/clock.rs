use serde::{Deserialize, Serialize};
use thiserror::Error;

/// Number of elapsed game minutes since the simulation epoch.
///
/// The value is intentionally independent of locale and presentation. UI labels
/// such as `Day 5 · 10:00` must be derived outside this crate; domain rules never
/// parse those labels.
#[derive(
    Debug, Default, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash, Serialize, Deserialize,
)]
pub struct GameMinute(u64);

impl GameMinute {
    /// The simulation epoch.
    pub const ZERO: Self = Self(0);

    /// Creates a game-minute value.
    #[must_use]
    pub const fn new(value: u64) -> Self {
        Self(value)
    }

    /// Returns the underlying minute count.
    #[must_use]
    pub const fn get(self) -> u64 {
        self.0
    }

    /// Adds a duration while detecting overflow.
    pub fn checked_add(self, minutes: u64) -> Result<Self, ClockError> {
        self.0
            .checked_add(minutes)
            .map(Self)
            .ok_or(ClockError::GameTimeOverflow)
    }
}

/// Supported simulation speeds.
///
/// `Standard` intentionally means 15 game minutes per real minute. The mobile
/// adapter may display these values as 1×, 2×, and 4×.
#[derive(Debug, Default, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum ClockSpeed {
    /// 15 game minutes per real minute.
    #[default]
    Standard,
    /// 30 game minutes per real minute.
    Double,
    /// 60 game minutes per real minute.
    Quadruple,
}

impl ClockSpeed {
    /// Returns the UI multiplier.
    #[must_use]
    pub const fn multiplier(self) -> u8 {
        match self {
            Self::Standard => 1,
            Self::Double => 2,
            Self::Quadruple => 4,
        }
    }

    /// Returns the exact rate used by the integer clock accumulator.
    #[must_use]
    pub const fn game_minutes_per_real_minute(self) -> u64 {
        match self {
            Self::Standard => 15,
            Self::Double => 30,
            Self::Quadruple => 60,
        }
    }
}

/// Projected result of one real-time tick.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub struct ClockAdvance {
    from: GameMinute,
    to: GameMinute,
    advanced_minutes: u64,
    scaled_millis_remainder: u64,
}

impl ClockAdvance {
    /// Starting game time.
    #[must_use]
    pub const fn from(self) -> GameMinute {
        self.from
    }

    /// Resulting game time.
    #[must_use]
    pub const fn to(self) -> GameMinute {
        self.to
    }

    /// Whole game minutes advanced.
    #[must_use]
    pub const fn advanced_minutes(self) -> u64 {
        self.advanced_minutes
    }

    /// Fractional accumulator retained for the next tick.
    ///
    /// The denominator is 60,000. Keeping this integer remainder prevents drift
    /// and makes many small ticks equivalent to one large tick.
    #[must_use]
    pub const fn scaled_millis_remainder(self) -> u64 {
        self.scaled_millis_remainder
    }

    /// Clamps an advance to an earlier terminal boundary.
    ///
    /// Unused real time is intentionally discarded after terminal closure. The
    /// clock stops exactly at the legal/gameplay boundary rather than jumping
    /// beyond it and then trying to repair the state.
    pub(crate) fn clamp_to(self, to: GameMinute) -> Result<Self, ClockError> {
        if to < self.from || to > self.to {
            return Err(ClockError::InvalidClamp {
                from: self.from.get(),
                requested: to.get(),
                projected: self.to.get(),
            });
        }

        Ok(Self {
            from: self.from,
            to,
            advanced_minutes: to.get() - self.from.get(),
            scaled_millis_remainder: 0,
        })
    }
}

/// Deterministic simulation clock.
#[derive(Debug, Default, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct SimulationClock {
    now: GameMinute,
    paused: bool,
    speed: ClockSpeed,
    scaled_millis_remainder: u64,
}

impl SimulationClock {
    /// Current game time.
    #[must_use]
    pub const fn now(&self) -> GameMinute {
        self.now
    }

    /// Whether time advancement is paused.
    #[must_use]
    pub const fn is_paused(&self) -> bool {
        self.paused
    }

    /// Current speed.
    #[must_use]
    pub const fn speed(&self) -> ClockSpeed {
        self.speed
    }

    /// Current fractional accumulator.
    #[must_use]
    pub const fn scaled_millis_remainder(&self) -> u64 {
        self.scaled_millis_remainder
    }

    /// Projects elapsed real milliseconds without mutating the clock.
    ///
    /// A paused clock returns a zero-minute advance while preserving the
    /// fractional accumulator. This is a domain-level time rule only; it says
    /// nothing about whether UI cards or screens may be inspected.
    pub fn project_real_time(&self, elapsed_ms: u64) -> Result<ClockAdvance, ClockError> {
        if self.paused || elapsed_ms == 0 {
            return Ok(ClockAdvance {
                from: self.now,
                to: self.now,
                advanced_minutes: 0,
                scaled_millis_remainder: self.scaled_millis_remainder,
            });
        }

        let rate = u128::from(self.speed.game_minutes_per_real_minute());
        let scaled = u128::from(self.scaled_millis_remainder)
            .checked_add(
                u128::from(elapsed_ms)
                    .checked_mul(rate)
                    .ok_or(ClockError::AccumulatorOverflow)?,
            )
            .ok_or(ClockError::AccumulatorOverflow)?;

        let whole_minutes = scaled / 60_000;
        let remainder = scaled % 60_000;

        let advanced_minutes =
            u64::try_from(whole_minutes).map_err(|_| ClockError::AccumulatorOverflow)?;
        let remainder = u64::try_from(remainder).map_err(|_| ClockError::AccumulatorOverflow)?;
        let to = self.now.checked_add(advanced_minutes)?;

        Ok(ClockAdvance {
            from: self.now,
            to,
            advanced_minutes,
            scaled_millis_remainder: remainder,
        })
    }

    pub(crate) fn apply_advance(&mut self, advance: ClockAdvance) {
        debug_assert_eq!(self.now, advance.from);
        self.now = advance.to;
        self.scaled_millis_remainder = advance.scaled_millis_remainder;
    }

    pub(crate) fn pause(&mut self) {
        self.paused = true;
    }

    pub(crate) fn resume(&mut self) {
        self.paused = false;
    }

    pub(crate) fn set_speed(&mut self, speed: ClockSpeed) {
        self.speed = speed;
    }
}

/// Clock calculation failure.
#[derive(Debug, Clone, PartialEq, Eq, Error)]
pub enum ClockError {
    /// Game time exceeded the representable range.
    #[error("game time overflow")]
    GameTimeOverflow,

    /// The integer clock accumulator exceeded the representable range.
    #[error("clock accumulator overflow")]
    AccumulatorOverflow,

    /// A terminal clamp fell outside the projected interval.
    #[error(
        "invalid clock clamp: interval starts at {from}, projected to {projected}, requested {requested}"
    )]
    InvalidClamp {
        /// Starting minute.
        from: u64,
        /// Requested clamped minute.
        requested: u64,
        /// Original projected minute.
        projected: u64,
    },
}
