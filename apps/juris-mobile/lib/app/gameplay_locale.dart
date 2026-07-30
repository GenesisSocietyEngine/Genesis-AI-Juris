import 'package:flutter/widgets.dart';

/// Locale selected in the case catalog for the active gameplay session.
///
/// Scenario prose is resolved by stable ID in the snapshot mapper. This
/// inherited value covers reusable shell labels and controls without allowing
/// localization to affect authoritative runtime state.
class GameplayLocale extends InheritedWidget {
  const GameplayLocale({
    required this.locale,
    required super.child,
    super.key,
  });

  final String locale;

  static String of(BuildContext context) {
    return context
            .dependOnInheritedWidgetOfExactType<GameplayLocale>()
            ?.locale ??
        'en';
  }

  static String text(BuildContext context, String english, String russian) {
    return of(context) == 'ru' ? russian : english;
  }

  @override
  bool updateShouldNotify(GameplayLocale oldWidget) {
    return locale != oldWidget.locale;
  }
}
