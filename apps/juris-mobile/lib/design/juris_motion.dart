import 'package:flutter/material.dart';

/// Finite motion timings. Design-layer animations consume these tokens only.
@immutable
final class JurisMotion extends ThemeExtension<JurisMotion> {
  const JurisMotion({
    required this.immediate,
    required this.selection,
    required this.reveal,
    required this.immediateCurve,
    required this.selectionCurve,
    required this.revealCurve,
  });

  static const JurisMotion standard = JurisMotion(
    immediate: Duration(milliseconds: 120),
    selection: Duration(milliseconds: 220),
    reveal: Duration(milliseconds: 340),
    immediateCurve: Curves.easeOutCubic,
    selectionCurve: Curves.easeInOutCubic,
    revealCurve: Curves.easeOutQuart,
  );

  final Duration immediate;
  final Duration selection;
  final Duration reveal;
  final Curve immediateCurve;
  final Curve selectionCurve;
  final Curve revealCurve;

  @override
  JurisMotion copyWith({
    Duration? immediate,
    Duration? selection,
    Duration? reveal,
    Curve? immediateCurve,
    Curve? selectionCurve,
    Curve? revealCurve,
  }) {
    return JurisMotion(
      immediate: immediate ?? this.immediate,
      selection: selection ?? this.selection,
      reveal: reveal ?? this.reveal,
      immediateCurve: immediateCurve ?? this.immediateCurve,
      selectionCurve: selectionCurve ?? this.selectionCurve,
      revealCurve: revealCurve ?? this.revealCurve,
    );
  }

  @override
  JurisMotion lerp(covariant JurisMotion? other, double t) {
    if (other == null) {
      return this;
    }
    return JurisMotion(
      immediate: _lerpDuration(immediate, other.immediate, t),
      selection: _lerpDuration(selection, other.selection, t),
      reveal: _lerpDuration(reveal, other.reveal, t),
      // Curves are semantic policies rather than numeric geometry. Switching at
      // the midpoint keeps interpolation deterministic without inventing a
      // synthetic curve that was never declared by either theme.
      immediateCurve: t < 0.5 ? immediateCurve : other.immediateCurve,
      selectionCurve: t < 0.5 ? selectionCurve : other.selectionCurve,
      revealCurve: t < 0.5 ? revealCurve : other.revealCurve,
    );
  }
}

Duration _lerpDuration(Duration begin, Duration end, double t) {
  return Duration(
    microseconds:
        (begin.inMicroseconds + (end.inMicroseconds - begin.inMicroseconds) * t)
            .round(),
  );
}
