import 'package:flutter/material.dart';

import '../design/juris_design.dart';

/// Central visual language for the mobile shell.
///
/// The palette follows the existing GENESIS: AI Juris identity: deep navy for
/// institutional seriousness, restrained gold for authority, and neutral
/// surfaces for evidence-heavy information. Screens consume semantic theme
/// roles instead of hard-coding decorative colors.
abstract final class JurisTheme {
  static ThemeData dark() {
    const JurisSurfaces surfaces = JurisSurfaces.dark;
    const JurisSpacing spacing = JurisSpacing.standard;
    const JurisRadii radii = JurisRadii.standard;
    const JurisBorders borders = JurisBorders.standardWeights;
    const JurisScrims scrims = JurisScrims.dark;
    const JurisMotion motion = JurisMotion.standard;
    const JurisTargets targets = JurisTargets.accessible;
    const JurisTypography typography = JurisTypography.standard;

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
    final ButtonStyle accessibleButtonStyle = ButtonStyle(
      minimumSize: WidgetStatePropertyAll<Size>(
        targets.minimumInteractiveSize,
      ),
    );

    return ThemeData(
      colorScheme: colorScheme,
      brightness: Brightness.dark,
      scaffoldBackgroundColor: surfaces.brandNavy,
      useMaterial3: true,
      visualDensity: VisualDensity.standard,
      materialTapTargetSize: MaterialTapTargetSize.padded,
      fontFamily: JurisFontFamilies.plexSans,
      textTheme: typography.materialTextTheme(colorScheme.onSurface),
      focusColor: surfaces.focusRing,
      extensions: const <ThemeExtension<dynamic>>[
        surfaces,
        spacing,
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
            color: colorScheme.outlineVariant.withValues(alpha: 0.5),
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
