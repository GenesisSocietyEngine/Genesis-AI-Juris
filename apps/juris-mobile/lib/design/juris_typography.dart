import 'package:flutter/material.dart';

/// Flutter aliases registered for the exact locally bundled font binaries.
abstract final class JurisFontFamilies {
  static const String literata = 'JurisLiterata';
  static const String plexSans = 'JurisPlexSans';
  static const String plexMono = 'JurisPlexMono';
}

/// Eight semantic type roles used instead of widget-local font fragments.
@immutable
final class JurisTypography extends ThemeExtension<JurisTypography> {
  const JurisTypography({
    required this.caseDisplay,
    required this.sectionTitle,
    required this.bodyReading,
    required this.bodyCompact,
    required this.controlLabel,
    required this.caseIndex,
    required this.metadata,
    required this.caption,
  });

  static const JurisTypography standard = JurisTypography(
    caseDisplay: TextStyle(
      fontFamily: JurisFontFamilies.literata,
      fontSize: 36,
      fontWeight: FontWeight.w600,
      height: 1.08,
      letterSpacing: -0.4,
    ),
    sectionTitle: TextStyle(
      fontFamily: JurisFontFamilies.literata,
      fontSize: 24,
      fontWeight: FontWeight.w600,
      height: 1.2,
    ),
    bodyReading: TextStyle(
      fontFamily: JurisFontFamilies.plexSans,
      fontSize: 16,
      fontWeight: FontWeight.w400,
      height: 1.6,
    ),
    bodyCompact: TextStyle(
      fontFamily: JurisFontFamilies.plexSans,
      fontSize: 14,
      fontWeight: FontWeight.w400,
      height: 1.4,
    ),
    controlLabel: TextStyle(
      fontFamily: JurisFontFamilies.plexSans,
      fontSize: 14,
      fontWeight: FontWeight.w600,
      height: 1.2,
    ),
    caseIndex: TextStyle(
      fontFamily: JurisFontFamilies.plexMono,
      fontSize: 13,
      fontWeight: FontWeight.w500,
      height: 1.2,
      letterSpacing: 1.1,
    ),
    metadata: TextStyle(
      fontFamily: JurisFontFamilies.plexMono,
      fontSize: 12,
      fontWeight: FontWeight.w500,
      height: 1.35,
      letterSpacing: 0.45,
    ),
    caption: TextStyle(
      fontFamily: JurisFontFamilies.plexSans,
      fontSize: 12,
      fontWeight: FontWeight.w400,
      height: 1.4,
    ),
  );

  final TextStyle caseDisplay;
  final TextStyle sectionTitle;
  final TextStyle bodyReading;
  final TextStyle bodyCompact;
  final TextStyle controlLabel;
  final TextStyle caseIndex;
  final TextStyle metadata;
  final TextStyle caption;

  /// The catalogue chooses the wide variant from its documented breakpoint.
  TextStyle resolveCaseDisplay({required bool wide}) {
    return caseDisplay.copyWith(
      fontSize: wide ? 48 : caseDisplay.fontSize,
      height: wide ? 1.04 : caseDisplay.height,
    );
  }

  TextTheme materialTextTheme(Color foreground) {
    return TextTheme(
      displayLarge: resolveCaseDisplay(wide: true),
      displayMedium: caseDisplay,
      displaySmall: caseDisplay.copyWith(fontSize: 32),
      headlineLarge: sectionTitle.copyWith(fontSize: 28),
      headlineMedium: sectionTitle,
      headlineSmall: sectionTitle.copyWith(fontSize: 22),
      titleLarge: sectionTitle.copyWith(fontSize: 20),
      titleMedium: controlLabel.copyWith(fontSize: 16),
      titleSmall: controlLabel,
      bodyLarge: bodyReading,
      bodyMedium: bodyCompact,
      bodySmall: caption,
      labelLarge: controlLabel,
      labelMedium: controlLabel.copyWith(fontSize: 12),
      labelSmall: caption.copyWith(fontSize: 11),
    ).apply(bodyColor: foreground, displayColor: foreground);
  }

  @override
  JurisTypography copyWith({
    TextStyle? caseDisplay,
    TextStyle? sectionTitle,
    TextStyle? bodyReading,
    TextStyle? bodyCompact,
    TextStyle? controlLabel,
    TextStyle? caseIndex,
    TextStyle? metadata,
    TextStyle? caption,
  }) {
    return JurisTypography(
      caseDisplay: caseDisplay ?? this.caseDisplay,
      sectionTitle: sectionTitle ?? this.sectionTitle,
      bodyReading: bodyReading ?? this.bodyReading,
      bodyCompact: bodyCompact ?? this.bodyCompact,
      controlLabel: controlLabel ?? this.controlLabel,
      caseIndex: caseIndex ?? this.caseIndex,
      metadata: metadata ?? this.metadata,
      caption: caption ?? this.caption,
    );
  }

  @override
  JurisTypography lerp(covariant JurisTypography? other, double t) {
    if (other == null) {
      return this;
    }
    return JurisTypography(
      caseDisplay: TextStyle.lerp(caseDisplay, other.caseDisplay, t)!,
      sectionTitle: TextStyle.lerp(sectionTitle, other.sectionTitle, t)!,
      bodyReading: TextStyle.lerp(bodyReading, other.bodyReading, t)!,
      bodyCompact: TextStyle.lerp(bodyCompact, other.bodyCompact, t)!,
      controlLabel: TextStyle.lerp(controlLabel, other.controlLabel, t)!,
      caseIndex: TextStyle.lerp(caseIndex, other.caseIndex, t)!,
      metadata: TextStyle.lerp(metadata, other.metadata, t)!,
      caption: TextStyle.lerp(caption, other.caption, t)!,
    );
  }
}
