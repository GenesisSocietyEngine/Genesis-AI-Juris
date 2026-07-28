import 'package:flutter/material.dart';

/// Central visual language for the mobile shell.
///
/// The palette follows the existing GENESIS: AI Juris identity: deep navy for
/// institutional seriousness, restrained gold for authority, and neutral
/// surfaces for evidence-heavy information. Screens consume semantic theme
/// roles instead of hard-coding decorative colors.
abstract final class JurisTheme {
  static const Color brandGold = Color(0xFFC7A35B);
  static const Color brandNavy = Color(0xFF07111F);

  static ThemeData dark() {
    final ColorScheme colorScheme = ColorScheme.fromSeed(
      seedColor: brandGold,
      brightness: Brightness.dark,
      surface: const Color(0xFF0B1726),
    ).copyWith(
      primary: brandGold,
      onPrimary: const Color(0xFF211A0B),
      secondary: const Color(0xFF9FB7D1),
      surfaceContainerLowest: brandNavy,
      surfaceContainerLow: const Color(0xFF0E1B2B),
      surfaceContainer: const Color(0xFF132235),
      surfaceContainerHigh: const Color(0xFF192A3E),
      error: const Color(0xFFFFB4AB),
    );

    return ThemeData(
      colorScheme: colorScheme,
      brightness: Brightness.dark,
      scaffoldBackgroundColor: brandNavy,
      useMaterial3: true,
      visualDensity: VisualDensity.standard,
      appBarTheme: const AppBarTheme(centerTitle: false),
      cardTheme: CardThemeData(
        color: colorScheme.surfaceContainerLow,
        margin: EdgeInsets.zero,
        elevation: 0,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(20),
          side: BorderSide(
              color: colorScheme.outlineVariant.withValues(alpha: 0.5)),
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
          borderRadius: BorderRadius.circular(16),
          borderSide: BorderSide.none,
        ),
      ),
      snackBarTheme: SnackBarThemeData(
        behavior: SnackBarBehavior.floating,
        backgroundColor: colorScheme.surfaceContainerHigh,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
      ),
    );
  }
}
