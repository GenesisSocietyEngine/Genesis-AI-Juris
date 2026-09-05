import 'package:flutter/material.dart';

/// Semantic spacing scale for the GENESIS design layer.
@immutable
final class JurisSpacing extends ThemeExtension<JurisSpacing> {
  const JurisSpacing({
    required this.hairline,
    required this.xs,
    required this.sm,
    required this.md,
    required this.lg,
    required this.xl,
    required this.xxl,
    required this.display,
    required this.compactGutter,
    required this.wideGutter,
  });

  static const JurisSpacing standard = JurisSpacing(
    hairline: 2,
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 24,
    xxl: 32,
    display: 48,
    compactGutter: 16,
    wideGutter: 32,
  );

  final double hairline;
  final double xs;
  final double sm;
  final double md;
  final double lg;
  final double xl;
  final double xxl;
  final double display;
  final double compactGutter;
  final double wideGutter;

  @override
  JurisSpacing copyWith({
    double? hairline,
    double? xs,
    double? sm,
    double? md,
    double? lg,
    double? xl,
    double? xxl,
    double? display,
    double? compactGutter,
    double? wideGutter,
  }) {
    return JurisSpacing(
      hairline: hairline ?? this.hairline,
      xs: xs ?? this.xs,
      sm: sm ?? this.sm,
      md: md ?? this.md,
      lg: lg ?? this.lg,
      xl: xl ?? this.xl,
      xxl: xxl ?? this.xxl,
      display: display ?? this.display,
      compactGutter: compactGutter ?? this.compactGutter,
      wideGutter: wideGutter ?? this.wideGutter,
    );
  }

  @override
  JurisSpacing lerp(covariant JurisSpacing? other, double t) {
    if (other == null) {
      return this;
    }
    return JurisSpacing(
      hairline: _lerp(hairline, other.hairline, t),
      xs: _lerp(xs, other.xs, t),
      sm: _lerp(sm, other.sm, t),
      md: _lerp(md, other.md, t),
      lg: _lerp(lg, other.lg, t),
      xl: _lerp(xl, other.xl, t),
      xxl: _lerp(xxl, other.xxl, t),
      display: _lerp(display, other.display, t),
      compactGutter: _lerp(compactGutter, other.compactGutter, t),
      wideGutter: _lerp(wideGutter, other.wideGutter, t),
    );
  }
}

double _lerp(double begin, double end, double t) => begin + (end - begin) * t;
