import 'package:flutter/foundation.dart';

import '../models/game_snapshot.dart';

/// Presentation boundary shared by the temporary ERP demo and future Rust
/// scenario sessions.
///
/// Widgets consume immutable snapshots and submit stable action IDs. They do
/// not know which runtime owns state transitions, so connecting a native Rust
/// transport cannot introduce scenario-specific mutation into Flutter.
abstract class GameRuntimeRepository extends ChangeNotifier {
  GameSnapshot get snapshot;

  bool get isTerminal;

  /// Whether the shared shell should advance this runtime every foreground
  /// clock tick. Declarative Rust scenarios opt in through their authoritative
  /// snapshot clock policy.
  bool get supportsLiveClock;

  /// Last controlled automatic-clock failure, if ticking has been stopped.
  String? get clockErrorMessage;

  /// Whether this runtime exposes the versioned save/load contract.
  bool get supportsPersistence => false;

  Future<bool> hasSavedGame() async => false;

  Future<void> saveGame() async {
    throw const GamePersistenceException(
      code: 'persistence_unsupported',
      message: 'This runtime does not support saved games.',
    );
  }

  Future<void> loadGame() async {
    throw const GamePersistenceException(
      code: 'persistence_unsupported',
      message: 'This runtime does not support saved games.',
    );
  }

  void reset();

  void markInboxItemRead(String itemId);

  void advanceTimeByMinutes(int minutes);

  /// Advances the authoritative clock to 08:00 at the next work period.
  ///
  /// Scenario clocks expose civil time through the shared snapshot. The
  /// command still crosses the normal runtime boundary; Flutter never mutates
  /// scenario state locally.
  void restUntilNextWorkday() {
    final List<String> parts = snapshot.timeLabel.split(':');
    if (parts.length != 2) {
      throw StateError('Unsupported scenario time: ${snapshot.timeLabel}');
    }
    final int minuteOfDay = int.parse(parts[0]) * 60 + int.parse(parts[1]);
    const int workdayStart = 8 * 60;
    int minutes = workdayStart - minuteOfDay;
    if (minutes <= 0) {
      minutes += 24 * 60;
    }
    advanceTimeByMinutes(minutes);
  }

  ActionExecutionResult applyAction(String actionId);
}

/// Controlled save/load failure suitable for localized presentation.
final class GamePersistenceException implements Exception {
  const GamePersistenceException({
    required this.code,
    required this.message,
  });

  final String code;
  final String message;

  @override
  String toString() => '$code: $message';
}
