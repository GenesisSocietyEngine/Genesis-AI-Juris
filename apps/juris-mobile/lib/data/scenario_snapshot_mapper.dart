import '../models/case_catalog.dart';
import '../models/game_snapshot.dart';

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
    final Set<String> availableActionIds = availableActions
        .map((Map<String, dynamic> action) => _string(action, 'id'))
        .toSet();
    final List<Map<String, dynamic>> availableEvidence = evidence
        .where((Map<String, dynamic> item) => _bool(item, 'available'))
        .toList(growable: false);
    final int factScore = facts.isEmpty
        ? 0
        : facts
                .map((Map<String, dynamic> fact) =>
                    _factStatusScore(_string(fact, 'status')))
                .reduce((int left, int right) => left + right) ~/
            facts.length;
    final int evidenceScore = evidence.isEmpty
        ? 0
        : ((availableEvidence.length / evidence.length) * 100).round();
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
      caseStrength: ((factScore + evidenceScore) / 2).round(),
      merits: factScore,
      evidenceScore: evidenceScore,
      procedure: _stageProgress(source, caseDefinition),
      leverage: factScore,
      spendEur: 0,
      authorizedBudgetEur: 0,
      billableMinutes: clockMinutes,
      fatigue: 0,
      cumulativeStrain: 0,
      ethics: 100,
      clientTrust: 100,
      inactivityMinutes: 0,
      clientWarningLevel: 0,
      aiRequestsUsed: 0,
      aiRequestLimit: 0,
      knownFactsRevision: facts.length,
      aiLegalResearchRevision: 0,
      aiDamagesModelRevision: 0,
      expertReviewStatus: ExpertReviewStatus.notCommissioned,
      expertReportDueDay: 0,
      juniorReviewStatus: JuniorReviewStatus.notDelegated,
      juniorReviewDueDay: 0,
      juniorReviewDueMinute: 0,
      inbox: _objectList(source, 'inbox')
          .where((Map<String, dynamic> item) => _bool(item, 'visible'))
          .map(
            (Map<String, dynamic> item) => InboxItemView(
              id: _string(item, 'id'),
              sender:
                  locale == 'ru' ? 'Обновление сценария' : 'Scenario update',
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
            ),
          )
          .toList(growable: false),
      deadlines: _objectList(source, 'deadlines')
          .where((Map<String, dynamic> item) => item['status'] != null)
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
              relatedActionId: _firstAvailableString(
                item['completion_action_ids'],
                availableActionIds,
              ),
            ),
          )
          .toList(growable: false),
      evidence: availableEvidence
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
              timeLabel:
                  _durationLabel(_int(item, 'time_cost_minutes'), locale),
              costEur: _optionalInt(item, 'cost_eur'),
              tone: ActionTone.primary,
            ),
          )
          .toList(growable: false),
      latestAiNote: null,
      judicialResult: judicialResult,
      judicialDecisionInstance: judicialDecisionInstance,
      matterLifecycle: matterLifecycle,
      isClosed: isClosed,
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
              awardEur: 0,
              costsEur: 0,
              keySuccesses: <String>[
                locale == 'ru'
                    ? 'Завершён авторитетный детерминированный путь сценария.'
                    : 'Completed an authoritative deterministic scenario path.',
              ],
              missedOpportunities: const <String>[],
            ),
    );
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

  static String? _firstAvailableString(
    dynamic value,
    Set<String> available,
  ) {
    if (value == null) {
      return null;
    }
    if (value is! List<dynamic>) {
      throw const FormatException('completion_action_ids must be an array');
    }
    for (final dynamic item in value) {
      if (item is! String) {
        throw const FormatException(
          'completion_action_ids entries must be strings',
        );
      }
      if (available.contains(item)) {
        return item;
      }
    }
    return null;
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
