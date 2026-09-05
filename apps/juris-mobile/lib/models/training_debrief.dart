import 'package:flutter/foundation.dart';

/// Authoritative matter lifecycle copied from the nested Training Debrief.
///
/// Flutter deliberately keeps an [unknown] value for future runtime states and
/// never reconstructs lifecycle from a stage, outcome, or route.
enum TrainingDebriefMatterLifecycle {
  active,
  postJudgment,
  appeal,
  cassation,
  enforcement,
  closed,
  unknown,
}

/// Player-facing matter status copied from the nested Training Debrief.
enum TrainingDebriefMatterStatus { open, recoverable, closed, unknown }

/// Immutable post-case projection produced by the authoritative Rust runtime.
///
/// The projection is absent until Rust resolves an outcome. It contains only
/// the actions and resource values Rust chose to disclose for the completed
/// run; Flutter does not rebuild it from the broader game snapshot.
@immutable
class TrainingDebriefView {
  TrainingDebriefView({
    required this.projectionSchemaVersion,
    required this.scenarioId,
    required this.scenarioTitle,
    required this.resolvedOutcomeId,
    required this.resolvedOutcomeTitle,
    required this.finalScenarioMinute,
    required this.matterLifecycle,
    required this.matterStatus,
    required List<TrainingDebriefActionView> executedActions,
    required List<TrainingDebriefResourceView> resources,
    required List<String> reflectionPromptIds,
  })  : executedActions = List<TrainingDebriefActionView>.unmodifiable(
          executedActions,
        ),
        resources = List<TrainingDebriefResourceView>.unmodifiable(resources),
        reflectionPromptIds = List<String>.unmodifiable(reflectionPromptIds);

  final int projectionSchemaVersion;
  final String scenarioId;
  final String scenarioTitle;
  final String resolvedOutcomeId;
  final String resolvedOutcomeTitle;
  final int finalScenarioMinute;
  final TrainingDebriefMatterLifecycle matterLifecycle;
  final TrainingDebriefMatterStatus matterStatus;
  final List<TrainingDebriefActionView> executedActions;
  final List<TrainingDebriefResourceView> resources;
  final List<String> reflectionPromptIds;

  int get totalActionTimeMinutes => executedActions.fold<int>(
        0,
        (int total, TrainingDebriefActionView action) =>
            total + action.timeCostMinutes,
      );

  int get totalActionCostEur => executedActions.fold<int>(
        0,
        (int total, TrainingDebriefActionView action) => total + action.costEur,
      );

  int get totalBillableMinutes => executedActions.fold<int>(
        0,
        (int total, TrainingDebriefActionView action) =>
            total + action.billableMinutes,
      );
}

/// One player-executed action in authoritative execution order.
@immutable
class TrainingDebriefActionView {
  const TrainingDebriefActionView({
    required this.actionId,
    required this.title,
    required this.sequence,
    required this.completionMinute,
    required this.timeCostMinutes,
    required this.costEur,
    required this.billableMinutes,
  });

  final String actionId;
  final String title;
  final int sequence;
  final int completionMinute;
  final int timeCostMinutes;
  final int costEur;
  final int billableMinutes;
}

/// Initial and final value for one Rust-owned resource.
@immutable
class TrainingDebriefResourceView {
  const TrainingDebriefResourceView({
    required this.resourceId,
    required this.label,
    required this.initialValue,
    required this.currentValue,
  });

  final String resourceId;
  final String label;
  final int initialValue;
  final int currentValue;
}
