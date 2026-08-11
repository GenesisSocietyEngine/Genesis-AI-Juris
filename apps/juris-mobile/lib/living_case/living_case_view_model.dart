import 'package:flutter/foundation.dart';

import '../models/case_catalog.dart';
import '../models/dossier_projection.dart';
import '../models/game_snapshot.dart';
import '../models/pressure_countermove.dart';
import 'living_case_visual_manifest.dart';

enum LivingCaseDeadlineState { inactive, active, completed, missed, unknown }

@immutable
final class LivingCaseDeadlineProjection {
  const LivingCaseDeadlineProjection({
    required this.title,
    required this.dueAtMinutes,
    required this.state,
  });

  final String title;
  final int? dueAtMinutes;
  final LivingCaseDeadlineState state;
}

/// Strict presentation adapter for the GreenFire Living Case slice.
///
/// It correlates only stable identities named by the visual manifest and only
/// returns objects already present in player-visible projections. It never
/// reconstructs availability, lateness, consequences, or outcomes.
@immutable
final class LivingCaseViewModel {
  const LivingCaseViewModel({
    required this.caseDefinition,
    required this.snapshot,
    required this.manifest,
    required this.locale,
  });

  final MobileCaseDefinition caseDefinition;
  final GameSnapshot snapshot;
  final LivingCaseVisualManifest manifest;
  final String locale;

  bool get isSupported => manifest.supportsCase(caseDefinition.caseId);

  LocalizedCaseText get caseText => caseDefinition.localized(locale, 'en');

  ActivePressureView? get activePressure {
    final PressureAndCountermoveView? projection =
        snapshot.pressureAndCountermove;
    if (!isSupported ||
        projection == null ||
        projection.projectionSchemaVersion != 1) {
      return null;
    }
    for (final ActivePressureView pressure in projection.activePressures) {
      if (pressure.pressureId == manifest.pressure.pressureId &&
          pressure.sourceActorId == manifest.pressure.sourceActorId) {
        return pressure;
      }
    }
    return null;
  }

  InboxItemView? get visibleRequest {
    if (activePressure == null) {
      return null;
    }
    for (final InboxItemView item in snapshot.inbox) {
      if (item.id == manifest.pressure.requestInboxItemId) {
        return item;
      }
    }
    return null;
  }

  List<GameActionView> get responseActions {
    final ActivePressureView? pressure = activePressure;
    if (pressure == null) {
      return const <GameActionView>[];
    }
    final Map<String, GameActionView> projectedActions =
        <String, GameActionView>{
      for (final GameActionView action in snapshot.actions) action.id: action,
    };
    return pressure.availableResponseActionIds
        .where(manifest.pressure.responses.containsKey)
        .map((String id) => projectedActions[id])
        .whereType<GameActionView>()
        .toList(growable: false);
  }

  LivingCaseResponseTreatment? responseTreatment(GameActionView action) =>
      responseActions.any((GameActionView item) => item.id == action.id)
          ? manifest.responseTreatment(action.id)
          : null;

  LivingCaseDeadlineProjection get deadline {
    final DossierProjectionView? dossier = snapshot.dossier;
    if (dossier != null && dossier.projectionSchemaVersion == 1) {
      for (final DossierDeadlineView item in dossier.deadlines) {
        if (item.id == manifest.pressure.deadlineId) {
          return LivingCaseDeadlineProjection(
            title: item.title,
            dueAtMinutes: item.dueAtMinutes,
            state: switch (item.status) {
              DossierDeadlineStatus.open => activePressure == null
                  ? LivingCaseDeadlineState.inactive
                  : LivingCaseDeadlineState.active,
              DossierDeadlineStatus.completed =>
                LivingCaseDeadlineState.completed,
              DossierDeadlineStatus.missed => LivingCaseDeadlineState.missed,
              DossierDeadlineStatus.unknown => LivingCaseDeadlineState.unknown,
            },
          );
        }
      }
    }
    for (final DeadlineView item in snapshot.deadlines) {
      if (item.id == manifest.pressure.deadlineId) {
        return LivingCaseDeadlineProjection(
          title: item.title,
          dueAtMinutes: activePressure?.dueAtMinute,
          state: switch (item.status) {
            DeadlineStatus.done => LivingCaseDeadlineState.completed,
            DeadlineStatus.missed => LivingCaseDeadlineState.missed,
            DeadlineStatus.open ||
            DeadlineStatus.scheduled ||
            DeadlineStatus.rescheduled =>
              activePressure == null
                  ? LivingCaseDeadlineState.inactive
                  : LivingCaseDeadlineState.active,
            DeadlineStatus.cancelled => LivingCaseDeadlineState.unknown,
          },
        );
      }
    }
    return LivingCaseDeadlineProjection(
      title: '',
      dueAtMinutes: activePressure?.dueAtMinute,
      state: activePressure == null
          ? LivingCaseDeadlineState.inactive
          : LivingCaseDeadlineState.active,
    );
  }

  /// Display-only progress from the values projected by the active Pressure.
  double? get deadlineProgress {
    final ActivePressureView? pressure = activePressure;
    if (pressure == null || pressure.dueAtMinute <= 0) {
      return null;
    }
    final int remaining =
        pressure.remainingMinutes.clamp(0, pressure.dueAtMinute);
    return (pressure.dueAtMinute - remaining) / pressure.dueAtMinute;
  }

  LivingCaseOutcomeTreatment? get outcomeTreatment {
    final debrief = snapshot.trainingDebrief;
    if (!isSupported ||
        debrief == null ||
        debrief.projectionSchemaVersion != 1 ||
        debrief.scenarioId != caseDefinition.scenarioId) {
      return null;
    }
    return manifest.outcomeTreatment(debrief.resolvedOutcomeId);
  }
}
