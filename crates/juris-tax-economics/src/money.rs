//! Exact two-decimal input conversion; no binary floating-point intermediary.
use serde::{de::Error as _, Deserialize, Deserializer, Serialize, Serializer};
use std::{error::Error, fmt, str::FromStr};

/// A signed i64 minor-unit amount, encoded only as a canonical decimal string.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct MoneyCents(i64);

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum MoneyError {
    InvalidSyntax,
    OutOfRange,
}
impl fmt::Display for MoneyError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_str(match self {
            Self::InvalidSyntax => "expected a canonical signed decimal amount",
            Self::OutOfRange => "amount is outside the signed 64-bit cent range",
        })
    }
}
impl Error for MoneyError {}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum DecimalSeparator {
    Dot,
    Comma,
}

impl MoneyCents {
    pub const fn new(cents: i64) -> Self {
        Self(cents)
    }
    pub const fn value(self) -> i64 {
        self.0
    }

    /// Parse an explicitly selected locale's ungrouped major-unit amount.
    /// Allows zero, one or two fractional digits; rejects spaces, grouping,
    /// exponent notation, plus signs and ambiguous separators.
    pub fn parse_major(input: &str, separator: DecimalSeparator) -> Result<Self, MoneyError> {
        if input.len() > 24 {
            return Err(MoneyError::InvalidSyntax);
        }
        let separator = match separator {
            DecimalSeparator::Dot => '.',
            DecimalSeparator::Comma => ',',
        };
        let (negative, unsigned) = input
            .strip_prefix('-')
            .map_or((false, input), |v| (true, v));
        let mut parts = unsigned.split(separator);
        let whole = parts.next().ok_or(MoneyError::InvalidSyntax)?;
        let fraction = parts.next();
        if parts.next().is_some() || !digits(whole) || (whole.len() > 1 && whole.starts_with('0')) {
            return Err(MoneyError::InvalidSyntax);
        }
        let fractional = match fraction {
            None => 0,
            Some(v) if digits(v) && v.len() <= 2 => {
                let value = v.parse::<i128>().map_err(|_| MoneyError::InvalidSyntax)?;
                if v.len() == 1 {
                    value * 10
                } else {
                    value
                }
            }
            Some(_) => return Err(MoneyError::InvalidSyntax),
        };
        let major = whole.parse::<i128>().map_err(|_| MoneyError::OutOfRange)?;
        let cents = major
            .checked_mul(100)
            .and_then(|v| v.checked_add(fractional))
            .ok_or(MoneyError::OutOfRange)?;
        let signed = if negative { -cents } else { cents };
        i64::try_from(signed)
            .map(Self)
            .map_err(|_| MoneyError::OutOfRange)
    }

    pub fn format_major(self) -> String {
        let magnitude = i128::from(self.0).abs();
        format!(
            "{}{}.{:02}",
            if self.0 < 0 { "-" } else { "" },
            magnitude / 100,
            magnitude % 100
        )
    }
}
fn digits(value: &str) -> bool {
    !value.is_empty() && value.bytes().all(|c| c.is_ascii_digit())
}
impl FromStr for MoneyCents {
    type Err = MoneyError;
    fn from_str(value: &str) -> Result<Self, Self::Err> {
        let unsigned = value.strip_prefix('-').unwrap_or(value);
        if value.len() > 20
            || !digits(unsigned)
            || (unsigned.len() > 1 && unsigned.starts_with('0'))
            || value == "-0"
        {
            return Err(MoneyError::InvalidSyntax);
        }
        value
            .parse::<i64>()
            .map(Self)
            .map_err(|_| MoneyError::OutOfRange)
    }
}
impl Serialize for MoneyCents {
    fn serialize<S: Serializer>(&self, serializer: S) -> Result<S::Ok, S::Error> {
        serializer.serialize_str(&self.0.to_string())
    }
}
impl<'de> Deserialize<'de> for MoneyCents {
    fn deserialize<D: Deserializer<'de>>(deserializer: D) -> Result<Self, D::Error> {
        let encoded = String::deserialize(deserializer)?;
        encoded.parse().map_err(D::Error::custom)
    }
}
