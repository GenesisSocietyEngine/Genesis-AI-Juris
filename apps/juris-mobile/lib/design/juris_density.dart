import 'package:flutter/material.dart';

/// Semantic content-density choices. Neither choice changes target or type size.
enum JurisDensityMode { compact, comfortable }

/// Insets and vertical rhythm for one semantic density choice.
@immutable
final class JurisDensityMetrics {
  const JurisDensityMetrics({
    required this.contentInset,
    required this.sectionRhythm,
  });

  final double contentInset;
  final double sectionRhythm;

  JurisDensityMetrics copyWith({
    double? contentInset,
    double? sectionRhythm,
  }) {
    return JurisDensityMetrics(
      contentInset: contentInset ?? this.contentInset,
      sectionRhythm: sectionRhythm ?? this.sectionRhythm,
    );
  }

  static JurisDensityMetrics lerp(
    JurisDensityMetrics begin,
    JurisDensityMetrics end,
    double t,
  ) {
    return JurisDensityMetrics(
      contentInset: _lerp(begin.contentInset, end.contentInset, t),
      sectionRhythm: _lerp(begin.sectionRhythm, end.sectionRhythm, t),
    );
  }
}

/// Typed density tokens aligned to the shared four-pixel spacing scale.
@immutable
final class JurisDensity extends ThemeExtension<JurisDensity> {
  const JurisDensity({
    required this.compact,
    required this.comfortable,
  });

  static const JurisDensity standard = JurisDensity(
    compact: JurisDensityMetrics(
      contentInset: 12,
      sectionRhythm: 8,
    ),
    comfortable: JurisDensityMetrics(
      contentInset: 16,
      sectionRhythm: 12,
    ),
  );

  final JurisDensityMetrics compact;
  final JurisDensityMetrics comfortable;

  JurisDensityMetrics resolve(JurisDensityMode mode) {
    return switch (mode) {
      JurisDensityMode.compact => compact,
      JurisDensityMode.comfortable => comfortable,
    };
  }

  @override
  JurisDensity copyWith({
    JurisDensityMetrics? compact,
    JurisDensityMetrics? comfortable,
  }) {
    return JurisDensity(
      compact: compact ?? this.compact,
      comfortable: comfortable ?? this.comfortable,
    );
  }

  @override
  JurisDensity lerp(covariant JurisDensity? other, double t) {
    if (other == null) {
      return this;
    }
    return JurisDensity(
      compact: JurisDensityMetrics.lerp(compact, other.compact, t),
      comfortable: JurisDensityMetrics.lerp(comfortable, other.comfortable, t),
    );
  }
}

double _lerp(double begin, double end, double t) => begin + (end - begin) * t;
