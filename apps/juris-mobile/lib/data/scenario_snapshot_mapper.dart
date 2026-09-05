import '../models/case_catalog.dart';
import '../models/dossier_projection.dart';
import '../models/game_snapshot.dart';
import '../models/pressure_countermove.dart';
import '../models/training_debrief.dart';

/// Converts the stable Rust mobile snapshot into the current Flutter read
/// model. All values are presentation projections; scenario mutation remains
/// exclusively inside Rust.
abstract final class ScenarioSnapshotMapper {
  static GameSnapshot map({
    required Map<String, dynamic> source,
    required MobileCaseDefinition caseDefinition,
    String locale = 'en',
    Set<String> locallyReadInboxIds = const <String>{},
  }) {
    final int clockMinutes = _int(source, 'clock_minutes');
    final bool isClosed =
        _optionalBool(source, 'is_closed') ?? _bool(source, 'terminal');
    final JudicialResult? judicialResult =
        _judicialResult(source['judicial_result']);
    final JudicialDecisionInstance? judicialDecisionInstance =
        _judicialDecisionInstance(source['judicial_decision_instance']);
    final MatterLifecycleStatus matterLifecycle = _matterLifecycle(
      source['matter_lifecycle'],
      isClosed: isClosed,
    );
    final List<Map<String, dynamic>> facts = _objectList(source, 'facts');
    final List<Map<String, dynamic>> evidence = _objectList(source, 'evidence');
    final List<Map<String, dynamic>> availableActions =
        _objectList(source, 'available_actions');
    final Map<String, int> numericMetrics =
        _optionalIntegerMap(source, 'numeric_metrics');
    final Map<String, int> resources = _optionalIntegerMap(source, 'resources');
    final int factScore = facts.isEmpty
        ? 0
        : facts
                .map((Map<String, dynamic> fact) =>
                    _factStatusScore(_string(fact, 'status')))
                .reduce((int left, int right) => left + right) ~/
            facts.length;
    // Rust owns player visibility. The legacy visible/total ratio disclosed
    // the hidden definition count. For scenarios without an authored numeric
    // metric this is deliberately a player-safe presence score: zero means no
    // evidence is visible and 100 means at least one item is visible. It is a
    // presentation summary, not evidence completeness or gameplay state.
    final int evidencePresenceScore = evidence.isEmpty ? 0 : 100;
    final Map<String, dynamic>? outcome = _nullableObject(source['outcome']);

    return GameSnapshot(
      version: '0.5.1 native scenario runtime',
      seed: _int(source, 'seed'),
      mode: locale == 'ru' ? 'Авторитетный Rust' : 'Authoritative Rust',
      dayLabel: _dayLabel(clockMinutes, locale),
      timeLabel: _timeLabel(clockMinutes),
      stage: caseDefinition.scenarioText(
        locale: locale,
        section: 'stages',
        id: _string(source, 'stage_id'),
        field: 'title',
        fallback: _string(source, 'stage_title'),
      ),
      caseResultStatus: _caseResult(
        judicialResult,
        judicialDecisionInstance,
        outcome,
      ),
      engagementStatus:
          isClosed ? EngagementStatus.completed : EngagementStatus.active,
      matterTitle: _scenarioTitle(caseDefinition, locale),
      caseStrength: numericMetrics['case_strength'] ??
          ((factScore + evidencePresenceScore) / 2).round(),
      merits: numericMetrics['merits'] ?? factScore,
      evidenceScore: numericMetrics['evidence'] ?? evidencePresenceScore,
      procedure:
          numericMetrics['procedure'] ?? _stageProgress(source, caseDefinition),
      leverage: numericMetrics['leverage'] ?? factScore,
      spendEur: resources['spend_eur'] ?? 0,
      authorizedBudgetEur: resources['authorized_budget_eur'] ?? 0,
      billableMinutes: resources['billable_minutes'] ?? clockMinutes,
      fatigue: numericMetrics['fatigue'] ?? 0,
      cumulativeStrain: numericMetrics['cumulative_strain'] ?? 0,
      ethics: numericMetrics['ethics'] ?? 100,
      clientTrust: numericMetrics['client_trust'] ?? 100,
      inactivityMinutes: numericMetrics['inactivity_minutes'] ?? 0,
      clientWarningLevel: numericMetrics['client_warning_level'] ?? 0,
      aiRequestsUsed: numericMetrics['ai_requests_used'] ?? 0,
      aiRequestLimit: numericMetrics['ai_request_limit'] ?? 0,
      knownFactsRevision:
          numericMetrics['known_facts_revision'] ?? facts.length,
      aiLegalResearchRevision:
          numericMetrics['ai_legal_research_revision'] ?? 0,
      aiDamagesModelRevision: numericMetrics['ai_damages_model_revision'] ?? 0,
      expertReviewStatus: ExpertReviewStatus.notCommissioned,
      expertReportDueDay: 0,
      juniorReviewStatus: JuniorReviewStatus.notDelegated,
      juniorReviewDueDay: 0,
      juniorReviewDueMinute: 0,
      inbox: _objectList(source, 'inbox')
          .map(
            (Map<String, dynamic> item) => InboxItemView(
              id: _string(item, 'id'),
              sender: caseDefinition.scenarioText(
                locale: locale,
                section: 'inbox_items',
                id: _string(item, 'id'),
                field: 'sender',
                fallback: _optionalString(item, 'sender') ??
                    (locale == 'ru'
                        ? 'Обновление сценария'
                        : 'Scenario update'),
              ),
              subject: caseDefinition.scenarioText(
                locale: locale,
                section: 'inbox_items',
                id: _string(item, 'id'),
                field: 'subject',
                fallback: _string(item, 'subject'),
              ),
              body: caseDefinition.scenarioText(
                locale: locale,
                section: 'inbox_items',
                id: _string(item, 'id'),
                field: 'body',
                fallback: _string(item, 'body'),
              ),
              receivedAt: '${_dayLabel(clockMinutes, locale)} · '
                  '${_timeLabel(clockMinutes)}',
              status: _inboxStatus(item, locallyReadInboxIds),
              resolutionActionIds:
                  _optionalStringList(item, 'resolution_action_ids'),
            ),
          )
          .toList(growable: false),
      deadlines: _objectList(source, 'deadlines')
          .map(
            (Map<String, dynamic> item) => DeadlineView(
              id: _string(item, 'id'),
              title: caseDefinition.scenarioText(
                locale: locale,
                section: 'deadlines',
                id: _string(item, 'id'),
                field: 'title',
                fallback: _string(item, 'title'),
              ),
              dueAt: _absoluteMoment(_int(item, 'due_at_minutes'), locale),
              status: _deadlineStatus(_string(item, 'status')),
              detail: locale == 'ru'
                  ? 'Обязательный срок авторитетного сценария.'
                  : 'Authoritative scenario deadline.',
              relatedActionId: _firstString(
                item,
                'completion_action_ids',
              ),
            ),
          )
          .toList(growable: false),
      evidence: evidence
          .map(
            (Map<String, dynamic> item) => EvidenceView(
              id: _string(item, 'id'),
              title: caseDefinition.scenarioText(
                locale: locale,
                section: 'evidence',
                id: _string(item, 'id'),
                field: 'title',
                fallback: _string(item, 'title'),
              ),
              detail: locale == 'ru'
                  ? '${_evidenceKind(_string(item, 'kind'), locale)} · доступно'
                  : '${_string(item, 'kind')} · available',
              reliability: 100,
              isAdverse: false,
            ),
          )
          .toList(growable: false),
      actions: availableActions
          .map(
            (Map<String, dynamic> item) => GameActionView(
              id: _string(item, 'id'),
              title: caseDefinition.scenarioText(
                locale: locale,
                section: 'actions',
                id: _string(item, 'id'),
                field: 'title',
                fallback: _string(item, 'title'),
              ),
              description: caseDefinition.scenarioText(
                locale: locale,
                section: 'actions',
                id: _string(item, 'id'),
                field: 'description',
                fallback: item['description'] as String? ??
                    (locale == 'ru'
                        ? 'Выполнить действие авторитетного сценария.'
                        : 'Execute this authoritative scenario action.'),
              ),
              timeLabel: _actionTimeLabel(item, locale),
              costEur: _optionalInt(item, 'cost_eur'),
              tone: ActionTone.primary,
              presentationTags: _optionalStringList(item, 'presentation_tags'),
            ),
          )
          .toList(growable: false),
      latestAiNote: null,
      judicialResult: judicialResult,
      judicialDecisionInstance: judicialDecisionInstance,
      matterLifecycle: matterLifecycle,
      isClosed: isClosed,
      dossier: _dossierProjection(
        source: source,
        caseDefinition: caseDefinition,
        locale: locale,
      ),
      pressureAndCountermove: _pressureAndCountermoveProjection(
        source: source,
        caseDefinition: caseDefinition,
        locale: locale,
        availableActions: availableActions,
      ),
      trainingDebrief: _trainingDebriefProjection(
        source: source,
        caseDefinition: caseDefinition,
        locale: locale,
      ),
      numericMetrics: Map<String, int>.unmodifiable(numericMetrics),
      resources: Map<String, int>.unmodifiable(resources),
      outcomeSummary: !isClosed || outcome == null
          ? null
          : CaseOutcomeSummaryView(
              headline: caseDefinition.scenarioText(
                locale: locale,
                section: 'outcomes',
                id: _string(outcome, 'id'),
                field: 'title',
                fallback: _string(outcome, 'title'),
              ),
              finalStatus: _string(outcome, 'id'),
              detail: caseDefinition.scenarioText(
                locale: locale,
                section: 'outcomes',
                id: _string(outcome, 'id'),
                field: 'summary',
                fallback: _string(outcome, 'summary'),
              ),
              closedAt: '${_dayLabel(clockMinutes, locale)} · '
                  '${_timeLabel(clockMinutes)}',
              awardEur: resources['award_eur'] ?? 0,
              costsEur: resources['outcome_costs_eur'] ?? 0,
              keySuccesses: <String>[
                locale == 'ru'
                    ? 'Завершён авторитетный детерминированный путь сценария.'
                    : 'Completed an authoritative deterministic scenario path.',
              ],
              missedOpportunities: const <String>[],
            ),
    );
  }

  static PressureAndCountermoveView? _pressureAndCountermoveProjection({
    required Map<String, dynamic> source,
    required MobileCaseDefinition caseDefinition,
    required String locale,
    required List<Map<String, dynamic>> availableActions,
  }) {
    if (!source.containsKey('pressure_and_countermove') ||
        source['pressure_and_countermove'] == null) {
      return null;
    }
    final Map<String, dynamic> projection = _requiredObjectValue(
      source['pressure_and_countermove'],
      'pressure_and_countermove',
    );
    final int version = _int(projection, 'projection_schema_version');
    if (version != 1) {
      return null;
    }

    final Set<String> availableActionIds = availableActions
        .map((Map<String, dynamic> action) => _string(action, 'id'))
        .toSet();
    final List<ActivePressureView> activePressures = _objectList(
      projection,
      'active_pressures',
    ).map((Map<String, dynamic> pressure) {
      final String sourceActorId = _string(pressure, 'source_actor_id');
      return ActivePressureView(
        pressureId: _string(pressure, 'pressure_id'),
        sourceActorId: sourceActorId,
        sourceActorName: _scenarioEntityText(
          definition: caseDefinition,
          locale: locale,
          section: 'actors',
          id: sourceActorId,
          field: 'name',
        ),
        dueAtMinute: _int(pressure, 'due_at_minute'),
        remainingMinutes: _int(pressure, 'remaining_minutes'),
        availableResponseActionIds: List<String>.unmodifiable(
          _stringList(pressure, 'available_response_action_ids').where(
            availableActionIds.contains,
          ),
        ),
      );
    }).toList(growable: false);

    return PressureAndCountermoveView(
      projectionSchemaVersion: version,
      activePressures: List<ActivePressureView>.unmodifiable(activePressures),
    );
  }

  static TrainingDebriefView? _trainingDebriefProjection({
    required Map<String, dynamic> source,
    required MobileCaseDefinition caseDefinition,
    required String locale,
  }) {
    if (!source.containsKey('training_debrief') ||
        source['training_debrief'] == null) {
      return null;
    }
    final Map<String, dynamic> debrief = _requiredObjectValue(
      source['training_debrief'],
      'training_debrief',
    );
    final String scenarioId = _string(debrief, 'scenario_id');
    final String resolvedOutcomeId = _string(
      debrief,
      'resolved_outcome_id',
    );

    final List<TrainingDebriefActionView> executedActions = _objectList(
      debrief,
      'executed_actions',
    ).map((Map<String, dynamic> action) {
      final String actionId = _string(action, 'action_id');
      return TrainingDebriefActionView(
        actionId: actionId,
        title: _scenarioEntityText(
          definition: caseDefinition,
          locale: locale,
          section: 'actions',
          id: actionId,
          field: 'title',
        ),
        sequence: _int(action, 'sequence'),
        completionMinute: _int(action, 'completion_minute'),
        timeCostMinutes: _int(action, 'time_cost_minutes'),
        costEur: _int(action, 'cost_eur'),
        billableMinutes: _int(action, 'billable_minutes'),
      );
    }).toList(growable: false);

    final List<TrainingDebriefResourceView> resources = _objectList(
      debrief,
      'resources',
    ).map((Map<String, dynamic> resource) {
      final String resourceId = _string(resource, 'resource_id');
      return TrainingDebriefResourceView(
        resourceId: resourceId,
        label: caseDefinition.scenarioText(
          locale: locale,
          section: 'resources',
          id: resourceId,
          field: 'label',
          fallback: _resourceLabel(resourceId, locale),
        ),
        initialValue: _int(resource, 'initial_value'),
        currentValue: _int(resource, 'current_value'),
      );
    }).toList(growable: false);

    return TrainingDebriefView(
      projectionSchemaVersion: _int(debrief, 'projection_schema_version'),
      scenarioId: scenarioId,
      scenarioTitle: _scenarioTitle(caseDefinition, locale),
      resolvedOutcomeId: resolvedOutcomeId,
      resolvedOutcomeTitle: _scenarioEntityText(
        definition: caseDefinition,
        locale: locale,
        section: 'outcomes',
        id: resolvedOutcomeId,
        field: 'title',
      ),
      finalScenarioMinute: _int(debrief, 'final_scenario_minute'),
      matterLifecycle: _trainingDebriefLifecycle(
        _string(debrief, 'matter_lifecycle'),
      ),
      matterStatus: _trainingDebriefMatterStatus(
        _string(debrief, 'matter_status'),
      ),
      executedActions: executedActions,
      resources: resources,
      reflectionPromptIds: _stringList(
        debrief,
        'reflection_prompt_ids',
      ),
    );
  }

  static TrainingDebriefMatterLifecycle _trainingDebriefLifecycle(
    String value,
  ) {
    return switch (value) {
      'active' => TrainingDebriefMatterLifecycle.active,
      'post_judgment' => TrainingDebriefMatterLifecycle.postJudgment,
      'appeal' => TrainingDebriefMatterLifecycle.appeal,
      'cassation' => TrainingDebriefMatterLifecycle.cassation,
      'enforcement' => TrainingDebriefMatterLifecycle.enforcement,
      'closed' => TrainingDebriefMatterLifecycle.closed,
      _ => TrainingDebriefMatterLifecycle.unknown,
    };
  }

  static TrainingDebriefMatterStatus _trainingDebriefMatterStatus(
    String value,
  ) {
    return switch (value) {
      'open' => TrainingDebriefMatterStatus.open,
      'recoverable' => TrainingDebriefMatterStatus.recoverable,
      'closed' => TrainingDebriefMatterStatus.closed,
      _ => TrainingDebriefMatterStatus.unknown,
    };
  }

  static DossierProjectionView? _dossierProjection({
    required Map<String, dynamic> source,
    required MobileCaseDefinition caseDefinition,
    required String locale,
  }) {
    if (!source.containsKey('dossier') || source['dossier'] == null) {
      return null;
    }
    final Map<String, dynamic> dossier = _requiredObjectValue(
      source['dossier'],
      'dossier',
    );
    final Map<String, dynamic> procedure = _requiredObjectValue(
      dossier['procedure'],
      'dossier.procedure',
    );
    final String stageId = _string(procedure, 'stage_id');

    final List<DossierFactView> facts =
        _objectList(dossier, 'facts').map((Map<String, dynamic> fact) {
      final String id = _string(fact, 'id');
      return DossierFactView(
        id: id,
        statement: caseDefinition.scenarioText(
          locale: locale,
          section: 'facts',
          id: id,
          field: 'statement',
          fallback: _string(fact, 'statement'),
        ),
        status: _dossierFactStatus(_string(fact, 'status')),
      );
    }).toList(growable: false);

    final List<DossierEvidenceView> evidence =
        _objectList(dossier, 'evidence').map((Map<String, dynamic> item) {
      final String id = _string(item, 'id');
      final String? description = _optionalString(item, 'description');
      return DossierEvidenceView(
        id: id,
        title: caseDefinition.scenarioText(
          locale: locale,
          section: 'evidence',
          id: id,
          field: 'title',
          fallback: _string(item, 'title'),
        ),
        kind: _string(item, 'kind'),
        description: description == null
            ? null
            : caseDefinition.scenarioText(
                locale: locale,
                section: 'evidence',
                id: id,
                field: 'description',
                fallback: description,
              ),
        supportsFactIds: _stringList(item, 'supports_fact_ids'),
        contradictsFactIds: _stringList(item, 'contradicts_fact_ids'),
      );
    }).toList(growable: false);

    final List<DossierDeadlineView> deadlines =
        _objectList(dossier, 'deadlines').map((Map<String, dynamic> deadline) {
      final String id = _string(deadline, 'id');
      final List<DossierRemedyView> remedies =
          _objectList(deadline, 'remedies').map((Map<String, dynamic> remedy) {
        final String actionId = _string(remedy, 'action_id');
        final String? description = _optionalString(remedy, 'description');
        return DossierRemedyView(
          actionId: actionId,
          title: caseDefinition.scenarioText(
            locale: locale,
            section: 'actions',
            id: actionId,
            field: 'title',
            fallback: _string(remedy, 'title'),
          ),
          description: description == null
              ? null
              : caseDefinition.scenarioText(
                  locale: locale,
                  section: 'actions',
                  id: actionId,
                  field: 'description',
                  fallback: description,
                ),
          timeCostMinutes: _int(remedy, 'time_cost_minutes'),
          costEur: _int(remedy, 'cost_eur'),
        );
      }).toList(growable: false);
      return DossierDeadlineView(
        id: id,
        title: caseDefinition.scenarioText(
          locale: locale,
          section: 'deadlines',
          id: id,
          field: 'title',
          fallback: _string(deadline, 'title'),
        ),
        dueAtMinutes: _int(deadline, 'due_at_minutes'),
        status: _dossierDeadlineStatus(_string(deadline, 'status')),
        remedies: remedies,
      );
    }).toList(growable: false);

    final Map<String, dynamic>? rawOutcome = _optionalObjectValue(
      dossier,
      'outcome',
      'dossier.outcome',
    );
    final DossierOutcomeView? outcome;
    if (rawOutcome == null) {
      outcome = null;
    } else {
      final String id = _string(rawOutcome, 'id');
      outcome = DossierOutcomeView(
        id: id,
        title: caseDefinition.scenarioText(
          locale: locale,
          section: 'outcomes',
          id: id,
          field: 'title',
          fallback: _string(rawOutcome, 'title'),
        ),
        summary: caseDefinition.scenarioText(
          locale: locale,
          section: 'outcomes',
          id: id,
          field: 'summary',
          fallback: _string(rawOutcome, 'summary'),
        ),
      );
    }

    return DossierProjectionView(
      projectionSchemaVersion: _int(dossier, 'projection_schema_version'),
      procedure: DossierProcedureView(
        stageId: stageId,
        stageTitle: caseDefinition.scenarioText(
          locale: locale,
          section: 'stages',
          id: stageId,
          field: 'title',
          fallback: _string(procedure, 'stage_title'),
        ),
        clockMinutes: _int(procedure, 'clock_minutes'),
        matterLifecycle: _dossierLifecycleStatus(
          _string(procedure, 'matter_lifecycle'),
        ),
        isClosed: _bool(procedure, 'is_closed'),
        matterStatus: _dossierMatterStatus(
          _string(procedure, 'matter_status'),
        ),
      ),
      judicialResult: _dossierJudicialResult(dossier['judicial_result']),
      judicialDecisionInstance: _dossierDecisionInstance(
        dossier['judicial_decision_instance'],
      ),
      facts: facts,
      evidence: evidence,
      deadlines: deadlines,
      outcome: outcome,
    );
  }

  static DossierMatterStatus _dossierMatterStatus(String value) {
    return switch (value) {
      'open' => DossierMatterStatus.open,
      'recoverable' => DossierMatterStatus.recoverable,
      'closed' => DossierMatterStatus.closed,
      _ => DossierMatterStatus.unknown,
    };
  }

  static DossierLifecycleStatus _dossierLifecycleStatus(String value) {
    return switch (value) {
      'active' => DossierLifecycleStatus.active,
      'post_judgment' => DossierLifecycleStatus.postJudgment,
      'appeal' => DossierLifecycleStatus.appeal,
      'cassation' => DossierLifecycleStatus.cassation,
      'enforcement' => DossierLifecycleStatus.enforcement,
      'closed' => DossierLifecycleStatus.closed,
      _ => DossierLifecycleStatus.unknown,
    };
  }

  static DossierJudicialResult? _dossierJudicialResult(dynamic value) {
    if (value == null) {
      return null;
    }
    if (value is! String) {
      throw const FormatException(
        'dossier.judicial_result must be a string or null',
      );
    }
    return switch (value) {
      'won' => DossierJudicialResult.won,
      'lost' => DossierJudicialResult.lost,
      'partially_won' => DossierJudicialResult.partiallyWon,
      'dismissed' => DossierJudicialResult.dismissed,
      _ => DossierJudicialResult.unknown,
    };
  }

  static DossierJudicialDecisionInstance? _dossierDecisionInstance(
    dynamic value,
  ) {
    if (value == null) {
      return null;
    }
    if (value is! String) {
      throw const FormatException(
        'dossier.judicial_decision_instance must be a string or null',
      );
    }
    return switch (value) {
      'first_instance' => DossierJudicialDecisionInstance.firstInstance,
      'appeal' => DossierJudicialDecisionInstance.appeal,
      'cassation' => DossierJudicialDecisionInstance.cassation,
      _ => DossierJudicialDecisionInstance.unknown,
    };
  }

  static DossierFactStatus _dossierFactStatus(String value) {
    return switch (value) {
      'alleged' => DossierFactStatus.alleged,
      'admitted' => DossierFactStatus.admitted,
      'disputed' => DossierFactStatus.disputed,
      'proven' => DossierFactStatus.proven,
      'inferred' => DossierFactStatus.inferred,
      _ => DossierFactStatus.unknown,
    };
  }

  static DossierDeadlineStatus _dossierDeadlineStatus(String value) {
    return switch (value) {
      'open' => DossierDeadlineStatus.open,
      'completed' => DossierDeadlineStatus.completed,
      'missed' => DossierDeadlineStatus.missed,
      _ => DossierDeadlineStatus.unknown,
    };
  }

  static String _scenarioTitle(
    MobileCaseDefinition definition,
    String locale,
  ) {
    final Map<String, dynamic>? metadata =
        _nullableObject(definition.scenario?['metadata']);
    final dynamic title = metadata?['title'];
    if (title is String && title.isNotEmpty) {
      return definition.scenarioText(
        locale: locale,
        section: 'metadata',
        field: 'title',
        fallback: title,
      );
    }
    return definition.localized('en', 'en').caption;
  }

  static String _scenarioEntityText({
    required MobileCaseDefinition definition,
    required String locale,
    required String section,
    required String id,
    required String field,
  }) {
    String fallback = id;
    final dynamic rawEntries = definition.scenario?[section];
    if (rawEntries is List<dynamic>) {
      for (final dynamic rawEntry in rawEntries) {
        if (rawEntry is Map<String, dynamic> && rawEntry['id'] == id) {
          final dynamic rawText = rawEntry[field];
          if (rawText is String && rawText.isNotEmpty) {
            fallback = rawText;
          }
          break;
        }
      }
    }
    return definition.scenarioText(
      locale: locale,
      section: section,
      id: id,
      field: field,
      fallback: fallback,
    );
  }

  static String _resourceLabel(String resourceId, String locale) {
    final bool russian = locale == 'ru';
    return switch (resourceId) {
      'authorized_budget_eur' =>
        russian ? 'Утверждённый бюджет' : 'Authorized budget',
      'spend_eur' => russian ? 'Расходы' : 'Spend',
      'billable_minutes' => russian ? 'Учтённое время' : 'Billable time',
      'award_eur' => russian ? 'Присуждённая сумма' : 'Award',
      'outcome_costs_eur' =>
        russian ? 'Расходы по результату' : 'Outcome costs',
      _ => resourceId.replaceAll('_', ' '),
    };
  }

  static int _stageProgress(
    Map<String, dynamic> snapshot,
    MobileCaseDefinition definition,
  ) {
    final dynamic rawStages = definition.scenario?['stages'];
    if (rawStages is! List<dynamic> || rawStages.isEmpty) {
      return 0;
    }
    final String stageId = _string(snapshot, 'stage_id');
    final int index = rawStages.indexWhere(
      (dynamic item) => item is Map<String, dynamic> && item['id'] == stageId,
    );
    if (index < 0) {
      return 0;
    }
    return (((index + 1) / rawStages.length) * 100).round();
  }

  static InboxStatus _inboxStatus(
    Map<String, dynamic> item,
    Set<String> locallyReadInboxIds,
  ) {
    if (_bool(item, 'resolved')) {
      return InboxStatus.resolved;
    }
    if (_bool(item, 'action_required')) {
      return InboxStatus.actionRequired;
    }
    if (locallyReadInboxIds.contains(_string(item, 'id'))) {
      return InboxStatus.read;
    }
    return InboxStatus.unread;
  }

  static DeadlineStatus _deadlineStatus(String status) {
    return switch (status) {
      'open' => DeadlineStatus.open,
      'completed' => DeadlineStatus.done,
      'missed' => DeadlineStatus.missed,
      _ => throw FormatException('Unsupported deadline status: $status'),
    };
  }

  static CaseResultStatus _caseResult(
    JudicialResult? judicialResult,
    JudicialDecisionInstance? judicialDecisionInstance,
    Map<String, dynamic>? outcome,
  ) {
    // Decision level is mapped only from Rust's authoritative instance field.
    // A lifecycle stage or outcome ID does not identify which court produced
    // the latest decision.
    final CaseResultStatus? fromDecision =
        switch ((judicialResult, judicialDecisionInstance)) {
      (JudicialResult.won, JudicialDecisionInstance.firstInstance) =>
        CaseResultStatus.wonAtFirstInstance,
      (JudicialResult.partiallyWon, JudicialDecisionInstance.firstInstance) =>
        CaseResultStatus.mixedAtFirstInstance,
      (
        JudicialResult.lost || JudicialResult.dismissed,
        JudicialDecisionInstance.firstInstance
      ) =>
        CaseResultStatus.lostAtFirstInstance,
      (JudicialResult.won, JudicialDecisionInstance.appeal) =>
        CaseResultStatus.wonOnAppeal,
      (
        JudicialResult.lost || JudicialResult.dismissed,
        JudicialDecisionInstance.appeal
      ) =>
        CaseResultStatus.lostOnAppeal,
      _ => null,
    };
    if (fromDecision != null) {
      return fromDecision;
    }
    if (outcome == null) {
      return CaseResultStatus.ongoing;
    }
    return CaseResultStatus.settled;
  }

  static JudicialResult? _judicialResult(dynamic value) {
    if (value == null) {
      return null;
    }
    if (value is! String) {
      return JudicialResult.unknown;
    }
    return switch (value) {
      'won' => JudicialResult.won,
      'lost' => JudicialResult.lost,
      'partially_won' => JudicialResult.partiallyWon,
      'dismissed' => JudicialResult.dismissed,
      _ => JudicialResult.unknown,
    };
  }

  static JudicialDecisionInstance? _judicialDecisionInstance(dynamic value) {
    if (value == null) {
      return null;
    }
    if (value is! String) {
      return JudicialDecisionInstance.unknown;
    }
    return switch (value) {
      'first_instance' => JudicialDecisionInstance.firstInstance,
      'appeal' => JudicialDecisionInstance.appeal,
      'cassation' => JudicialDecisionInstance.cassation,
      _ => JudicialDecisionInstance.unknown,
    };
  }

  static MatterLifecycleStatus _matterLifecycle(
    dynamic value, {
    required bool isClosed,
  }) {
    if (value is! String) {
      return isClosed
          ? MatterLifecycleStatus.closed
          : MatterLifecycleStatus.active;
    }
    return switch (value) {
      'active' => MatterLifecycleStatus.active,
      'post_judgment' => MatterLifecycleStatus.postJudgment,
      'appeal' => MatterLifecycleStatus.appeal,
      'cassation' => MatterLifecycleStatus.cassation,
      'enforcement' => MatterLifecycleStatus.enforcement,
      'closed' => MatterLifecycleStatus.closed,
      _ => MatterLifecycleStatus.unknown,
    };
  }

  static int _factStatusScore(String status) {
    return switch (status) {
      'proven' => 100,
      'admitted' => 80,
      'inferred' => 65,
      'alleged' => 45,
      'disputed' => 25,
      'unknown' => 0,
      _ => throw FormatException('Unsupported fact status: $status'),
    };
  }

  static String _durationLabel(int minutes, String locale) {
    if (minutes == 0) {
      return locale == 'ru' ? 'Сразу' : 'Immediate';
    }
    final int hours = minutes ~/ 60;
    final int remainder = minutes % 60;
    if (hours == 0) {
      return '$remainder${locale == 'ru' ? 'м' : 'm'}';
    }
    if (remainder == 0) {
      return '$hours${locale == 'ru' ? 'ч' : 'h'}';
    }
    return '$hours${locale == 'ru' ? 'ч' : 'h'} '
        '$remainder${locale == 'ru' ? 'м' : 'm'}';
  }

  static String _actionTimeLabel(
    Map<String, dynamic> action,
    String locale,
  ) {
    final int? completionAt = _nullableInt(
      action,
      'completion_at_minutes',
    );
    if (completionAt != null) {
      final String moment = _absoluteMoment(completionAt, locale);
      return locale == 'ru'
          ? 'До ${moment.replaceFirst('День ', 'дня ')}'
          : 'Until $moment';
    }
    return _durationLabel(_int(action, 'time_cost_minutes'), locale);
  }

  static String _evidenceKind(String kind, String locale) {
    if (locale != 'ru') {
      return kind;
    }
    return switch (kind) {
      'document' => 'документ',
      'contract' => 'договор',
      'email' => 'электронное письмо',
      'expert_report' => 'заключение эксперта',
      'invoice' => 'счёт',
      'system_record' => 'системная запись',
      'other' => 'иной материал',
      'testimony' => 'показания',
      'physical' => 'вещественное доказательство',
      'digital' => 'цифровое доказательство',
      'expert' => 'экспертный материал',
      _ => kind,
    };
  }

  static String _dayLabel(int elapsedMinutes, String locale) {
    final int absoluteMinutes = 8 * 60 + elapsedMinutes;
    final int day = absoluteMinutes ~/ 1440 + 1;
    return locale == 'ru' ? 'День $day' : 'Day $day';
  }

  static String _timeLabel(int elapsedMinutes) {
    final int minuteOfDay = (8 * 60 + elapsedMinutes) % 1440;
    final String hour = (minuteOfDay ~/ 60).toString().padLeft(2, '0');
    final String minute = (minuteOfDay % 60).toString().padLeft(2, '0');
    return '$hour:$minute';
  }

  static String _absoluteMoment(int minutes, String locale) {
    final int absoluteMinutes = 8 * 60 + minutes;
    final int day = absoluteMinutes ~/ 1440 + 1;
    final int minuteOfDay = absoluteMinutes % 1440;
    final String hour = (minuteOfDay ~/ 60).toString().padLeft(2, '0');
    final String minute = (minuteOfDay % 60).toString().padLeft(2, '0');
    return '${locale == 'ru' ? 'День' : 'Day'} $day · $hour:$minute';
  }

  static List<Map<String, dynamic>> _objectList(
    Map<String, dynamic> source,
    String field,
  ) {
    final dynamic value = source[field];
    if (value is! List<dynamic>) {
      throw FormatException('$field must be an array');
    }
    return value.map((dynamic item) {
      if (item is! Map<String, dynamic>) {
        throw FormatException('$field entries must be objects');
      }
      return item;
    }).toList(growable: false);
  }

  static Map<String, dynamic>? _nullableObject(dynamic value) {
    return value is Map<String, dynamic> ? value : null;
  }

  static Map<String, int> _optionalIntegerMap(
    Map<String, dynamic> source,
    String field,
  ) {
    final dynamic value = source[field];
    if (value == null) {
      return const <String, int>{};
    }
    if (value is! Map<String, dynamic>) {
      throw FormatException('$field must be an object or null');
    }
    return value.map((String id, dynamic raw) {
      if (raw is! int) {
        throw FormatException('$field.$id must be an integer');
      }
      return MapEntry<String, int>(id, raw);
    });
  }

  static Map<String, dynamic> _requiredObjectValue(
    dynamic value,
    String path,
  ) {
    if (value is Map<String, dynamic>) {
      return value;
    }
    throw FormatException('$path must be an object');
  }

  static Map<String, dynamic>? _optionalObjectValue(
    Map<String, dynamic> source,
    String field,
    String path,
  ) {
    final dynamic value = source[field];
    if (value == null) {
      return null;
    }
    if (value is Map<String, dynamic>) {
      return value;
    }
    throw FormatException('$path must be an object or null');
  }

  static String _string(Map<String, dynamic> source, String field) {
    final dynamic value = source[field];
    if (value is String) {
      return value;
    }
    throw FormatException('$field must be a string');
  }

  static int _int(Map<String, dynamic> source, String field) {
    final dynamic value = source[field];
    if (value is int) {
      return value;
    }
    throw FormatException('$field must be an integer');
  }

  static int _optionalInt(Map<String, dynamic> source, String field) {
    final dynamic value = source[field];
    if (value == null) {
      return 0;
    }
    if (value is int) {
      return value;
    }
    throw FormatException('$field must be an integer');
  }

  static int? _nullableInt(
    Map<String, dynamic> source,
    String field,
  ) {
    final dynamic value = source[field];
    if (value == null) {
      return null;
    }
    if (value is int) {
      return value;
    }
    throw FormatException('$field must be an integer or null');
  }

  static String? _optionalString(
    Map<String, dynamic> source,
    String field,
  ) {
    final dynamic value = source[field];
    if (value == null) {
      return null;
    }
    if (value is String) {
      return value;
    }
    throw FormatException('$field must be a string or null');
  }

  static List<String> _stringList(
    Map<String, dynamic> source,
    String field,
  ) {
    final dynamic value = source[field];
    if (value is! List<dynamic>) {
      throw FormatException('$field must be an array');
    }
    return value.map((dynamic item) {
      if (item is! String) {
        throw FormatException('$field entries must be strings');
      }
      return item;
    }).toList(growable: false);
  }

  static List<String> _optionalStringList(
    Map<String, dynamic> source,
    String field,
  ) {
    if (source[field] == null) {
      return const <String>[];
    }
    return _stringList(source, field);
  }

  static String? _firstString(
    Map<String, dynamic> source,
    String field,
  ) {
    final List<String> values = _optionalStringList(source, field);
    return values.isEmpty ? null : values.first;
  }

  static bool _bool(Map<String, dynamic> source, String field) {
    final dynamic value = source[field];
    if (value is bool) {
      return value;
    }
    throw FormatException('$field must be a Boolean');
  }

  static bool? _optionalBool(Map<String, dynamic> source, String field) {
    final dynamic value = source[field];
    return value is bool ? value : null;
  }
}
