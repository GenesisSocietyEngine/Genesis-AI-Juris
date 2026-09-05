import 'package:flutter/foundation.dart';

/// Presentation-safe view of one currently active pressure window.
@immutable
class ActivePressureView {
  const ActivePressureView({
    required this.pressureId,
    required this.sourceActorId,
    required this.sourceActorName,
    required this.dueAtMinute,
    required this.remainingMinutes,
    required this.availableResponseActionIds,
  });

  final String pressureId;
  final String sourceActorId;
  final String sourceActorName;
  final int dueAtMinute;
  final int remainingMinutes;
  final List<String> availableResponseActionIds;
}

/// Optional nested read model supplied by the authoritative Rust runtime.
@immutable
class PressureAndCountermoveView {
  const PressureAndCountermoveView({
    required this.projectionSchemaVersion,
    required this.activePressures,
  });

  final int projectionSchemaVersion;
  final List<ActivePressureView> activePressures;
}
