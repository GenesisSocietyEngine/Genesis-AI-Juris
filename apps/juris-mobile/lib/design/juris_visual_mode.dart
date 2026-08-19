import 'package:flutter/foundation.dart';

/// Resolved semantic treatments shared by every professional UI surface.
enum JurisVisualMode { office, afterHours }

/// Transient presentation selection. It is never persisted as gameplay state.
enum JurisVisualModeSelection { automatic, office, afterHours }

/// Pure presentation-only selection for the semantic visual treatment.
///
/// The projected clock is already player-visible. This resolver never reads a
/// wall clock, locale, gameplay identifier, or any other inferred state.
abstract final class JurisVisualModeResolver {
  static const JurisVisualMode fallback = JurisVisualMode.afterHours;
  static const int _officeStartMinutes = 8 * 60;
  static const int _officeEndMinutes = 18 * 60;

  static final RegExp _projectedClockPattern = RegExp(
    r'^(?:[01][0-9]|2[0-3]):[0-5][0-9]$',
  );

  /// Resolves an injected mode first, then the projected player-visible clock.
  static JurisVisualMode resolve({
    JurisVisualMode? injectedMode,
    JurisVisualModeSelection selection = JurisVisualModeSelection.automatic,
    String? projectedTimeLabel,
  }) {
    if (injectedMode case final JurisVisualMode mode) {
      return mode;
    }
    return switch (selection) {
      JurisVisualModeSelection.automatic =>
        fromProjectedTimeLabel(projectedTimeLabel),
      JurisVisualModeSelection.office => JurisVisualMode.office,
      JurisVisualModeSelection.afterHours => JurisVisualMode.afterHours,
    };
  }

  /// Resolves OFFICE for 08:00 inclusive through 18:00 exclusive.
  ///
  /// Missing or malformed values deterministically retain AFTER HOURS.
  static JurisVisualMode fromProjectedTimeLabel(String? projectedTimeLabel) {
    if (projectedTimeLabel == null ||
        !_projectedClockPattern.hasMatch(projectedTimeLabel)) {
      return fallback;
    }

    final int hour = int.parse(projectedTimeLabel.substring(0, 2));
    final int minute = int.parse(projectedTimeLabel.substring(3, 5));
    final int minuteOfDay = hour * 60 + minute;
    return minuteOfDay >= _officeStartMinutes && minuteOfDay < _officeEndMinutes
        ? JurisVisualMode.office
        : JurisVisualMode.afterHours;
  }
}

/// Shared transient controller for Catalogue and gameplay theme presentation.
///
/// Updating projected time only notifies listeners when the resolved semantic
/// treatment changes. Repository identity and gameplay projection ownership
/// remain outside this controller.
final class JurisVisualModeController
    extends ValueNotifier<JurisVisualModeSelection> {
  JurisVisualModeController({
    JurisVisualModeSelection selection = JurisVisualModeSelection.automatic,
    String? projectedTimeLabel,
  })  : _projectedTimeLabel = projectedTimeLabel,
        super(selection);

  JurisVisualModeController.fixed(JurisVisualMode mode)
      : _projectedTimeLabel = null,
        super(
          mode == JurisVisualMode.office
              ? JurisVisualModeSelection.office
              : JurisVisualModeSelection.afterHours,
        );

  String? _projectedTimeLabel;

  JurisVisualModeSelection get selection => value;

  set selection(JurisVisualModeSelection selection) {
    value = selection;
  }

  String? get projectedTimeLabel => _projectedTimeLabel;

  JurisVisualMode get resolvedMode => JurisVisualModeResolver.resolve(
        selection: selection,
        projectedTimeLabel: _projectedTimeLabel,
      );

  void updateProjectedTimeLabel(String? projectedTimeLabel) {
    if (projectedTimeLabel == _projectedTimeLabel) {
      return;
    }
    final JurisVisualMode before = resolvedMode;
    _projectedTimeLabel = projectedTimeLabel;
    if (resolvedMode != before) {
      notifyListeners();
    }
  }

  /// Clears gameplay projection when returning to a no-clock surface.
  void clearProjectedTime() {
    updateProjectedTimeLabel(null);
  }
}
