import 'package:flutter/foundation.dart';

/// Player-facing status of the matter as projected by the Rust runtime.
///
/// Flutter never derives this value from a court result, stage, remedy list,
/// or outcome. [unknown] keeps future runtime values visible without silently
/// changing their meaning.
enum DossierMatterStatus { open, recoverable, closed, unknown }

/// Authoritative procedural lifecycle copied from the dossier projection.
enum DossierLifecycleStatus {
  active,
  postJudgment,
  appeal,
  cassation,
  enforcement,
  closed,
  unknown,
}

/// Authoritative judicial result copied from the dossier projection.
enum DossierJudicialResult { won, lost, partiallyWon, dismissed, unknown }

/// Court instance attached by Rust to the latest judicial result.
enum DossierJudicialDecisionInstance {
  firstInstance,
  appeal,
  cassation,
  unknown,
}

/// Epistemic status of a fact that Rust has authorized for disclosure.
enum DossierFactStatus {
  alleged,
  admitted,
  disputed,
  proven,
  inferred,
  unknown,
}

/// State of an authoritative deadline exposed in the dossier.
enum DossierDeadlineStatus { open, completed, missed, unknown }

@immutable
class DossierProjectionView {
  const DossierProjectionView({
    required this.projectionSchemaVersion,
    required this.procedure,
    required this.facts,
    required this.evidence,
    required this.deadlines,
    this.judicialResult,
    this.judicialDecisionInstance,
    this.outcome,
  });

  final int projectionSchemaVersion;
  final DossierProcedureView procedure;
  final DossierJudicialResult? judicialResult;
  final DossierJudicialDecisionInstance? judicialDecisionInstance;
  final List<DossierFactView> facts;
  final List<DossierEvidenceView> evidence;
  final List<DossierDeadlineView> deadlines;
  final DossierOutcomeView? outcome;
}

@immutable
class DossierProcedureView {
  const DossierProcedureView({
    required this.stageId,
    required this.stageTitle,
    required this.clockMinutes,
    required this.matterLifecycle,
    required this.isClosed,
    required this.matterStatus,
  });

  final String stageId;
  final String stageTitle;
  final int clockMinutes;
  final DossierLifecycleStatus matterLifecycle;
  final bool isClosed;
  final DossierMatterStatus matterStatus;
}

@immutable
class DossierFactView {
  const DossierFactView({
    required this.id,
    required this.statement,
    required this.status,
  });

  final String id;
  final String statement;
  final DossierFactStatus status;
}

@immutable
class DossierEvidenceView {
  const DossierEvidenceView({
    required this.id,
    required this.title,
    required this.kind,
    required this.supportsFactIds,
    required this.contradictsFactIds,
    this.description,
  });

  final String id;
  final String title;
  final String kind;
  final String? description;
  final List<String> supportsFactIds;
  final List<String> contradictsFactIds;
}

@immutable
class DossierDeadlineView {
  const DossierDeadlineView({
    required this.id,
    required this.title,
    required this.dueAtMinutes,
    required this.status,
    required this.remedies,
  });

  final String id;
  final String title;
  final int dueAtMinutes;
  final DossierDeadlineStatus status;
  final List<DossierRemedyView> remedies;
}

@immutable
class DossierRemedyView {
  const DossierRemedyView({
    required this.actionId,
    required this.title,
    required this.timeCostMinutes,
    required this.costEur,
    this.description,
  });

  final String actionId;
  final String title;
  final String? description;
  final int timeCostMinutes;
  final int costEur;
}

@immutable
class DossierOutcomeView {
  const DossierOutcomeView({
    required this.id,
    required this.title,
    required this.summary,
  });

  final String id;
  final String title;
  final String summary;
}
