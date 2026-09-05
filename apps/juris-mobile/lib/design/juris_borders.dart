import 'package:flutter/material.dart';

/// Border weights used for hierarchy, selection, and focus.
@immutable
final class JurisBorders extends ThemeExtension<JurisBorders> {
  const JurisBorders({
    required this.hairline,
    required this.standard,
    required this.emphasis,
    required this.focus,
  });

  static const JurisBorders standardWeights = JurisBorders(
    hairline: 0.5,
    standard: 1,
    emphasis: 2,
    focus: 2,
  );

  final double hairline;
  final double standard;
  final double emphasis;
  final double focus;

  @override
  JurisBorders copyWith({
    double? hairline,
    double? standard,
    double? emphasis,
    double? focus,
  }) {
    return JurisBorders(
      hairline: hairline ?? this.hairline,
      standard: standard ?? this.standard,
      emphasis: emphasis ?? this.emphasis,
      focus: focus ?? this.focus,
    );
  }

  @override
  JurisBorders lerp(covariant JurisBorders? other, double t) {
    if (other == null) {
      return this;
    }
    return JurisBorders(
      hairline: _lerp(hairline, other.hairline, t),
      standard: _lerp(standard, other.standard, t),
      emphasis: _lerp(emphasis, other.emphasis, t),
      focus: _lerp(focus, other.focus, t),
    );
  }
}

double _lerp(double begin, double end, double t) => begin + (end - begin) * t;
