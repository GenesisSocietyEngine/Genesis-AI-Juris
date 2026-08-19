import 'package:flutter/material.dart';

import 'juris_visual_mode.dart';

/// Semantic colour, high-contrast, surface-tier, and elevation roles.
@immutable
final class JurisSurfaces extends ThemeExtension<JurisSurfaces> {
  const JurisSurfaces({
    required this.canvas,
    required this.baseSurface,
    required this.elevatedSurface,
    required this.ink,
    required this.mutedInk,
    required this.rule,
    required this.brass,
    required this.cyan,
    required this.danger,
    required this.success,
    required this.focus,
    required this.highContrastInk,
    required this.highContrastBrass,
    required this.highContrastCyan,
    required this.highContrastFocus,
    required this.surfaceLowest,
    required this.surfaceLow,
    required this.surfaceContainer,
    required this.surfaceHigh,
    required this.flatElevation,
    required this.raisedElevation,
    required this.overlayElevation,
  });

  static const JurisSurfaces office = JurisSurfaces(
    canvas: Color(0xFFF2EFE7),
    baseSurface: Color(0xFFFBF9F4),
    elevatedSurface: Color(0xFFFFFFFF),
    ink: Color(0xFF17202B),
    mutedInk: Color(0xFF5F6871),
    rule: Color(0xFFC9C3B5),
    brass: Color(0xFF8C6722),
    cyan: Color(0xFF006C7A),
    danger: Color(0xFFA33A32),
    success: Color(0xFF2F6B4F),
    focus: Color(0xFF005F73),
    highContrastInk: Color(0xFF17202B),
    highContrastBrass: Color(0xFF6B4900),
    highContrastCyan: Color(0xFF005A68),
    highContrastFocus: Color(0xFF003B49),
    surfaceLowest: Color(0xFFF2EFE7),
    surfaceLow: Color(0xFFFBF9F4),
    surfaceContainer: Color(0xFFFBF9F4),
    surfaceHigh: Color(0xFFFFFFFF),
    flatElevation: 0,
    raisedElevation: 1,
    overlayElevation: 6,
  );

  static const JurisSurfaces afterHours = JurisSurfaces(
    canvas: Color(0xFF091321),
    baseSurface: Color(0xFF102033),
    elevatedSurface: Color(0xFF162A40),
    ink: Color(0xFFEEE7D8),
    mutedInk: Color(0xFFAAB4C0),
    rule: Color(0xFF35485C),
    brass: Color(0xFFC6A455),
    cyan: Color(0xFF70D3E2),
    danger: Color(0xFFFFB4AB),
    success: Color(0xFF8BD3A8),
    focus: Color(0xFFD8E8FA),
    highContrastInk: Color(0xFFEEE7D8),
    highContrastBrass: Color(0xFFF3D994),
    highContrastCyan: Color(0xFFA6F4FF),
    highContrastFocus: Color(0xFFA6F4FF),
    surfaceLowest: Color(0xFF091321),
    surfaceLow: Color(0xFF102033),
    surfaceContainer: Color(0xFF102033),
    surfaceHigh: Color(0xFF162A40),
    flatElevation: 0,
    raisedElevation: 1,
    overlayElevation: 6,
  );

  /// Exact compatibility tokens for the accepted pre-pilot dark treatment.
  static const JurisSurfaces dark = JurisSurfaces(
    canvas: Color(0xFF07111F),
    baseSurface: Color(0xFF0B1726),
    elevatedSurface: Color(0xFF192A3E),
    ink: Color(0xFFD8D2C4),
    mutedInk: Color(0xFF9FB7D1),
    rule: Color(0xFF35485C),
    brass: Color(0xFFC7A35B),
    cyan: Color(0xFF70D3E2),
    danger: Color(0xFFFFB4AB),
    success: Color(0xFF8BD3A8),
    focus: Color(0xFFD8E8FA),
    highContrastInk: Color(0xFFD8D2C4),
    highContrastBrass: Color(0xFFF3D994),
    highContrastCyan: Color(0xFFA6F4FF),
    highContrastFocus: Color(0xFFA6F4FF),
    surfaceLowest: Color(0xFF07111F),
    surfaceLow: Color(0xFF0E1B2B),
    surfaceContainer: Color(0xFF132235),
    surfaceHigh: Color(0xFF192A3E),
    flatElevation: 0,
    raisedElevation: 1,
    overlayElevation: 6,
  );

  static JurisSurfaces forMode(JurisVisualMode mode) {
    return switch (mode) {
      JurisVisualMode.office => office,
      JurisVisualMode.afterHours => afterHours,
    };
  }

  final Color canvas;
  final Color baseSurface;
  final Color elevatedSurface;
  final Color ink;
  final Color mutedInk;
  final Color rule;
  final Color brass;
  final Color cyan;
  final Color danger;
  final Color success;
  final Color focus;
  final Color highContrastInk;
  final Color highContrastBrass;
  final Color highContrastCyan;
  final Color highContrastFocus;
  final Color surfaceLowest;
  final Color surfaceLow;
  final Color surfaceContainer;
  final Color surfaceHigh;
  final double flatElevation;
  final double raisedElevation;
  final double overlayElevation;

  // Compatibility names retained for the accepted v1 visual-identity callers.
  Color get brandGold => brass;
  Color get brandNavy => canvas;
  Color get circuitCyan => cyan;
  Color get evidenceNeutral => highContrastInk;
  Color get highContrastGold => highContrastBrass;
  Color get focusRing => focus;
  Color get surface => baseSurface;

  JurisSurfaces resolveHighContrast({required bool highContrast}) {
    if (!highContrast) {
      return this;
    }
    return copyWith(
      ink: highContrastInk,
      mutedInk: highContrastInk,
      rule: highContrastFocus,
      brass: highContrastBrass,
      cyan: highContrastCyan,
      focus: highContrastFocus,
    );
  }

  @override
  JurisSurfaces copyWith({
    Color? canvas,
    Color? baseSurface,
    Color? elevatedSurface,
    Color? ink,
    Color? mutedInk,
    Color? rule,
    Color? brass,
    Color? cyan,
    Color? danger,
    Color? success,
    Color? focus,
    Color? highContrastInk,
    Color? highContrastBrass,
    Color? highContrastCyan,
    Color? highContrastFocus,
    Color? surfaceLowest,
    Color? surfaceLow,
    Color? surfaceContainer,
    Color? surfaceHigh,
    double? flatElevation,
    double? raisedElevation,
    double? overlayElevation,
    Color? brandGold,
    Color? brandNavy,
    Color? circuitCyan,
    Color? evidenceNeutral,
    Color? highContrastGold,
    Color? focusRing,
    Color? surface,
  }) {
    return JurisSurfaces(
      canvas: canvas ?? brandNavy ?? this.canvas,
      baseSurface: baseSurface ?? surface ?? this.baseSurface,
      elevatedSurface: elevatedSurface ?? this.elevatedSurface,
      ink: ink ?? this.ink,
      mutedInk: mutedInk ?? this.mutedInk,
      rule: rule ?? this.rule,
      brass: brass ?? brandGold ?? this.brass,
      cyan: cyan ?? circuitCyan ?? this.cyan,
      danger: danger ?? this.danger,
      success: success ?? this.success,
      focus: focus ?? focusRing ?? this.focus,
      highContrastInk:
          highContrastInk ?? evidenceNeutral ?? this.highContrastInk,
      highContrastBrass:
          highContrastBrass ?? highContrastGold ?? this.highContrastBrass,
      highContrastCyan: highContrastCyan ?? this.highContrastCyan,
      highContrastFocus: highContrastFocus ?? this.highContrastFocus,
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
      canvas: Color.lerp(canvas, other.canvas, t)!,
      baseSurface: Color.lerp(baseSurface, other.baseSurface, t)!,
      elevatedSurface: Color.lerp(elevatedSurface, other.elevatedSurface, t)!,
      ink: Color.lerp(ink, other.ink, t)!,
      mutedInk: Color.lerp(mutedInk, other.mutedInk, t)!,
      rule: Color.lerp(rule, other.rule, t)!,
      brass: Color.lerp(brass, other.brass, t)!,
      cyan: Color.lerp(cyan, other.cyan, t)!,
      danger: Color.lerp(danger, other.danger, t)!,
      success: Color.lerp(success, other.success, t)!,
      focus: Color.lerp(focus, other.focus, t)!,
      highContrastInk: Color.lerp(highContrastInk, other.highContrastInk, t)!,
      highContrastBrass:
          Color.lerp(highContrastBrass, other.highContrastBrass, t)!,
      highContrastCyan:
          Color.lerp(highContrastCyan, other.highContrastCyan, t)!,
      highContrastFocus:
          Color.lerp(highContrastFocus, other.highContrastFocus, t)!,
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
