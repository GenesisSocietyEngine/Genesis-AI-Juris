import 'package:flutter/material.dart';

/// Brand, neutral surface, high-contrast, and elevation roles.
@immutable
final class JurisSurfaces extends ThemeExtension<JurisSurfaces> {
  const JurisSurfaces({
    required this.brandGold,
    required this.brandNavy,
    required this.circuitCyan,
    required this.evidenceNeutral,
    required this.highContrastGold,
    required this.highContrastCyan,
    required this.focusRing,
    required this.surface,
    required this.surfaceLowest,
    required this.surfaceLow,
    required this.surfaceContainer,
    required this.surfaceHigh,
    required this.flatElevation,
    required this.raisedElevation,
    required this.overlayElevation,
  });

  static const JurisSurfaces dark = JurisSurfaces(
    brandGold: Color(0xFFC7A35B),
    brandNavy: Color(0xFF07111F),
    circuitCyan: Color(0xFF70D3E2),
    evidenceNeutral: Color(0xFFD8D2C4),
    highContrastGold: Color(0xFFF3D994),
    highContrastCyan: Color(0xFFA6F4FF),
    focusRing: Color(0xFFD8E8FA),
    surface: Color(0xFF0B1726),
    surfaceLowest: Color(0xFF07111F),
    surfaceLow: Color(0xFF0E1B2B),
    surfaceContainer: Color(0xFF132235),
    surfaceHigh: Color(0xFF192A3E),
    flatElevation: 0,
    raisedElevation: 1,
    overlayElevation: 6,
  );

  final Color brandGold;
  final Color brandNavy;
  final Color circuitCyan;
  final Color evidenceNeutral;
  final Color highContrastGold;
  final Color highContrastCyan;
  final Color focusRing;
  final Color surface;
  final Color surfaceLowest;
  final Color surfaceLow;
  final Color surfaceContainer;
  final Color surfaceHigh;
  final double flatElevation;
  final double raisedElevation;
  final double overlayElevation;

  @override
  JurisSurfaces copyWith({
    Color? brandGold,
    Color? brandNavy,
    Color? circuitCyan,
    Color? evidenceNeutral,
    Color? highContrastGold,
    Color? highContrastCyan,
    Color? focusRing,
    Color? surface,
    Color? surfaceLowest,
    Color? surfaceLow,
    Color? surfaceContainer,
    Color? surfaceHigh,
    double? flatElevation,
    double? raisedElevation,
    double? overlayElevation,
  }) {
    return JurisSurfaces(
      brandGold: brandGold ?? this.brandGold,
      brandNavy: brandNavy ?? this.brandNavy,
      circuitCyan: circuitCyan ?? this.circuitCyan,
      evidenceNeutral: evidenceNeutral ?? this.evidenceNeutral,
      highContrastGold: highContrastGold ?? this.highContrastGold,
      highContrastCyan: highContrastCyan ?? this.highContrastCyan,
      focusRing: focusRing ?? this.focusRing,
      surface: surface ?? this.surface,
      surfaceLowest: surfaceLowest ?? this.surfaceLowest,
      surfaceLow: surfaceLow ?? this.surfaceLow,
      surfaceContainer: surfaceContainer ?? this.surfaceContainer,
      surfaceHigh: surfaceHigh ?? this.surfaceHigh,
      flatElevation: flatElevation ?? this.flatElevation,
      raisedElevation: raisedElevation ?? this.raisedElevation,
      overlayElevation: overlayElevation ?? this.overlayElevation,
    );
  }

  @override
  JurisSurfaces lerp(covariant JurisSurfaces? other, double t) {
    if (other == null) {
      return this;
    }
    return JurisSurfaces(
      brandGold: Color.lerp(brandGold, other.brandGold, t)!,
      brandNavy: Color.lerp(brandNavy, other.brandNavy, t)!,
      circuitCyan: Color.lerp(circuitCyan, other.circuitCyan, t)!,
      evidenceNeutral: Color.lerp(evidenceNeutral, other.evidenceNeutral, t)!,
      highContrastGold:
          Color.lerp(highContrastGold, other.highContrastGold, t)!,
      highContrastCyan:
          Color.lerp(highContrastCyan, other.highContrastCyan, t)!,
      focusRing: Color.lerp(focusRing, other.focusRing, t)!,
      surface: Color.lerp(surface, other.surface, t)!,
      surfaceLowest: Color.lerp(surfaceLowest, other.surfaceLowest, t)!,
      surfaceLow: Color.lerp(surfaceLow, other.surfaceLow, t)!,
      surfaceContainer:
          Color.lerp(surfaceContainer, other.surfaceContainer, t)!,
      surfaceHigh: Color.lerp(surfaceHigh, other.surfaceHigh, t)!,
      flatElevation: _lerp(flatElevation, other.flatElevation, t),
      raisedElevation: _lerp(raisedElevation, other.raisedElevation, t),
      overlayElevation: _lerp(overlayElevation, other.overlayElevation, t),
    );
  }
}

double _lerp(double begin, double end, double t) => begin + (end - begin) * t;
