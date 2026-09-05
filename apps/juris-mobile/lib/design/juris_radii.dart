import 'package:flutter/material.dart';

/// Corner-radius policy. Use the pill radius only for compact controls or marks.
@immutable
final class JurisRadii extends ThemeExtension<JurisRadii> {
  const JurisRadii({
    required this.small,
    required this.medium,
    required this.large,
    required this.panel,
    required this.pill,
  });

  static const JurisRadii standard = JurisRadii(
    small: 8,
    medium: 12,
    large: 16,
    panel: 20,
    pill: 999,
  );

  final double small;
  final double medium;
  final double large;
  final double panel;
  final double pill;

  @override
  JurisRadii copyWith({
    double? small,
    double? medium,
    double? large,
    double? panel,
    double? pill,
  }) {
    return JurisRadii(
      small: small ?? this.small,
      medium: medium ?? this.medium,
      large: large ?? this.large,
      panel: panel ?? this.panel,
      pill: pill ?? this.pill,
    );
  }

  @override
  JurisRadii lerp(covariant JurisRadii? other, double t) {
    if (other == null) {
      return this;
    }
    return JurisRadii(
      small: _lerp(small, other.small, t),
      medium: _lerp(medium, other.medium, t),
      large: _lerp(large, other.large, t),
      panel: _lerp(panel, other.panel, t),
      pill: _lerp(pill, other.pill, t),
    );
  }
}

double _lerp(double begin, double end, double t) => begin + (end - begin) * t;
