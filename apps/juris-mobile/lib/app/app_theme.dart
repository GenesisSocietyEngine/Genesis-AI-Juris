import 'package:flutter/material.dart';

import '../design/juris_design.dart';

/// Central semantic visual language for the mobile shell.
abstract final class JurisTheme {
  static final ThemeData _office = _semanticTheme(
    mode: JurisVisualMode.office,
    highContrast: false,
  );
  static final ThemeData _officeHighContrast = _semanticTheme(
    mode: JurisVisualMode.office,
    highContrast: true,
  );
  static final ThemeData _afterHours = _semanticTheme(
    mode: JurisVisualMode.afterHours,
    highContrast: false,
  );
  static final ThemeData _afterHoursHighContrast = _semanticTheme(
    mode: JurisVisualMode.afterHours,
    highContrast: true,
  );

  /// Exact compatibility entry point for the accepted pre-pilot dark theme.
  static ThemeData dark() {
    const JurisSurfaces surfaces = JurisSurfaces.dark;
    final ColorScheme colorScheme = ColorScheme.fromSeed(
      seedColor: surfaces.brandGold,
      brightness: Brightness.dark,
      surface: surfaces.surface,
    ).copyWith(
      primary: surfaces.brandGold,
      onPrimary: const Color(0xFF211A0B),
      secondary: const Color(0xFF9FB7D1),
      surfaceContainerLowest: surfaces.surfaceLowest,
      surfaceContainerLow: surfaces.surfaceLow,
      surfaceContainer: surfaces.surfaceContainer,
      surfaceContainerHigh: surfaces.surfaceHigh,
      error: const Color(0xFFFFB4AB),
    );
    return _buildTheme(
      colorScheme: colorScheme,
      surfaces: surfaces,
      scrims: JurisScrims.dark,
      highContrast: false,
      focusOverlayColor: surfaces.focusRing,
    );
  }

  static ThemeData office({bool highContrast = false}) {
    return highContrast ? _officeHighContrast : _office;
  }

  static ThemeData afterHours({bool highContrast = false}) {
    return highContrast ? _afterHoursHighContrast : _afterHours;
  }

  static ThemeData forMode(
    JurisVisualMode mode, {
    bool highContrast = false,
  }) {
    return switch (mode) {
      JurisVisualMode.office => office(highContrast: highContrast),
      JurisVisualMode.afterHours => afterHours(highContrast: highContrast),
    };
  }

  static ThemeData _semanticTheme({
    required JurisVisualMode mode,
    required bool highContrast,
  }) {
    final JurisSurfaces surfaces = JurisSurfaces.forMode(mode)
        .resolveHighContrast(highContrast: highContrast);
    final Brightness brightness =
        mode == JurisVisualMode.office ? Brightness.light : Brightness.dark;
    final Color inverseInk = brightness == Brightness.light
        ? const Color(0xFFFFFFFF)
        : surfaces.canvas;
    final ColorScheme colorScheme = ColorScheme.fromSeed(
      seedColor: surfaces.brass,
      brightness: brightness,
      surface: surfaces.baseSurface,
    ).copyWith(
      primary: surfaces.brass,
      onPrimary: inverseInk,
      secondary: surfaces.cyan,
      onSecondary: inverseInk,
      tertiary: surfaces.success,
      onTertiary: inverseInk,
      surface: surfaces.baseSurface,
      onSurface: surfaces.ink,
      onSurfaceVariant: surfaces.mutedInk,
      surfaceContainerLowest: surfaces.surfaceLowest,
      surfaceContainerLow: surfaces.surfaceLow,
      surfaceContainer: surfaces.surfaceContainer,
      surfaceContainerHigh: surfaces.surfaceHigh,
      surfaceContainerHighest: surfaces.elevatedSurface,
      outline: surfaces.rule,
      outlineVariant: surfaces.rule,
      error: surfaces.danger,
      onError: inverseInk,
    );
    return _buildTheme(
      colorScheme: colorScheme,
      surfaces: surfaces,
      scrims: JurisScrims.forMode(mode),
      highContrast: highContrast,
      focusOverlayColor: surfaces.focus.withValues(
        alpha: highContrast ? 0.18 : 0.12,
      ),
    );
  }

  static ThemeData _buildTheme({
    required ColorScheme colorScheme,
    required JurisSurfaces surfaces,
    required JurisScrims scrims,
    required bool highContrast,
    required Color focusOverlayColor,
  }) {
    const JurisSpacing spacing = JurisSpacing.standard;
    const JurisDensity density = JurisDensity.standard;
    const JurisRadii radii = JurisRadii.standard;
    const JurisBorders borders = JurisBorders.standardWeights;
    const JurisMotion motion = JurisMotion.standard;
    const JurisTargets targets = JurisTargets.accessible;
    const JurisTypography typography = JurisTypography.standard;
    final ButtonStyle accessibleButtonStyle = ButtonStyle(
      minimumSize: WidgetStatePropertyAll<Size>(
        targets.minimumInteractiveSize,
      ),
    );

    return ThemeData(
      colorScheme: colorScheme,
      brightness: colorScheme.brightness,
      scaffoldBackgroundColor: surfaces.canvas,
      useMaterial3: true,
      visualDensity: VisualDensity.standard,
      materialTapTargetSize: MaterialTapTargetSize.padded,
      fontFamily: JurisFontFamilies.plexSans,
      textTheme: typography.materialTextTheme(colorScheme.onSurface),
      focusColor: focusOverlayColor,
      extensions: <ThemeExtension<dynamic>>[
        surfaces,
        spacing,
        density,
        radii,
        borders,
        scrims,
        motion,
        targets,
        typography,
      ],
      appBarTheme: const AppBarTheme(centerTitle: false),
      cardTheme: CardThemeData(
        color: colorScheme.surfaceContainerLow,
        margin: EdgeInsets.zero,
        elevation: surfaces.flatElevation,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(radii.panel),
          side: BorderSide(
            color: highContrast
                ? colorScheme.outlineVariant
                : colorScheme.outlineVariant.withValues(alpha: 0.5),
            width: borders.standard,
          ),
        ),
      ),
      navigationBarTheme: NavigationBarThemeData(
        backgroundColor: colorScheme.surfaceContainerLow,
        indicatorColor: colorScheme.primaryContainer,
        labelBehavior: NavigationDestinationLabelBehavior.alwaysShow,
      ),
      navigationRailTheme: NavigationRailThemeData(
        backgroundColor: colorScheme.surfaceContainerLowest,
        indicatorColor: colorScheme.primaryContainer,
        useIndicator: true,
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: colorScheme.surfaceContainer,
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(radii.large),
          borderSide: BorderSide.none,
        ),
      ),
      snackBarTheme: SnackBarThemeData(
        behavior: SnackBarBehavior.floating,
        backgroundColor: colorScheme.surfaceContainerHigh,
        elevation: surfaces.overlayElevation,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(radii.large),
        ),
      ),
      elevatedButtonTheme: ElevatedButtonThemeData(
        style: accessibleButtonStyle,
      ),
      filledButtonTheme: FilledButtonThemeData(style: accessibleButtonStyle),
      outlinedButtonTheme: OutlinedButtonThemeData(
        style: accessibleButtonStyle,
      ),
      textButtonTheme: TextButtonThemeData(style: accessibleButtonStyle),
    );
  }
}
