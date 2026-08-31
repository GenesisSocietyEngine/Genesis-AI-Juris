import 'case_type_registry.dart';
import 'studio_scenario_draft.dart';

/// Read-only presentation projection over the canonical ScenarioDefinition.
///
/// This layer never mutates or approves a draft. The exact JSON remains the
/// source of truth and still has to pass the Rust validator and route test in
/// Step 5 before Finish can unlock.
final class StudioCaseViewItem {
  const StudioCaseViewItem({
    required this.id,
    required this.title,
    required this.detail,
    required this.kind,
    required this.primaryMeta,
    required this.secondaryMeta,
    this.needsAttention = false,
  });

  final String id;
  final String title;
  final String detail;
  final String kind;
  final String primaryMeta;
  final String secondaryMeta;
  final bool needsAttention;
}

final class StudioCaseViewProjection {
  const StudioCaseViewProjection({
    required this.id,
    required this.items,
    required this.sourceStageCount,
    required this.sourceActionCount,
  });

  final StudioCaseViewId id;
  final List<StudioCaseViewItem> items;
  final int sourceStageCount;
  final int sourceActionCount;
}

StudioCaseViewProjection projectStudioCaseView(
  StudioScenarioDraft draft,
  StudioCaseViewId id,
) {
  final Map<String, dynamic> source = draft.toJson();
  final List<Map<String, dynamic>> stages = _objects(source['stages']);
  final List<Map<String, dynamic>> actions = _objects(source['actions']);
  final List<StudioCaseViewItem> items = switch (id) {
    StudioCaseViewId.issueMap => _issueItems(stages, actions),
    StudioCaseViewId.evidenceMap => _recordItems(source),
    StudioCaseViewId.decisionTable => _decisionItems(actions),
    StudioCaseViewId.taskPlan => _taskItems(stages, actions),
    StudioCaseViewId.timeline => _timelineItems(source, stages),
    StudioCaseViewId.economics => _economicsItems(source, actions),
    StudioCaseViewId.simulation => _simulationItems(source, stages, actions),
  };
  return StudioCaseViewProjection(
    id: id,
    items: List<StudioCaseViewItem>.unmodifiable(items),
    sourceStageCount: stages.length,
    sourceActionCount: actions.length,
  );
}

List<StudioCaseViewItem> _issueItems(
  List<Map<String, dynamic>> stages,
  List<Map<String, dynamic>> actions,
) {
  return stages
      .where((Map<String, dynamic> stage) => stage['terminal'] != true)
      .map((Map<String, dynamic> stage) {
    final String stageId = _text(stage['id'], 'stage');
    final List<String> exits = _strings(stage['exit_actions']);
    final List<Map<String, dynamic>> options = actions
        .where((Map<String, dynamic> action) => exits.contains(action['id']))
        .toList(growable: false);
    return StudioCaseViewItem(
      id: stageId,
      title: _text(stage['title'], stageId),
      detail: options.isEmpty
          ? 'No decision option is connected to this issue.'
          : options.map((Map<String, dynamic> item) => _text(item['title'], _text(item['id'], 'action'))).join(' · '),
      kind: 'issue',
      primaryMeta: '${options.length} option${options.length == 1 ? '' : 's'}',
      secondaryMeta: _text(stage['kind'], 'standard'),
      needsAttention: options.isEmpty,
    );
  }).toList(growable: false);
}

List<StudioCaseViewItem> _recordItems(Map<String, dynamic> source) {
  final List<StudioCaseViewItem> facts = _objects(source['facts'])
      .map((Map<String, dynamic> fact) => StudioCaseViewItem(
            id: _text(fact['id'], 'fact'),
            title: _text(fact['statement'], 'Untitled fact'),
            detail: _strings(fact['related_actors']).isEmpty
                ? 'No participant is linked.'
                : 'Participants: ${_strings(fact['related_actors']).join(' · ')}',
            kind: 'fact',
            primaryMeta: _text(fact['initial_status'], 'alleged'),
            secondaryMeta: '${_strings(fact['related_actors']).length} participant link(s)',
            needsAttention: _strings(fact['related_actors']).isEmpty,
          ))
      .toList(growable: false);
  final List<StudioCaseViewItem> evidence = _objects(source['evidence'])
      .map((Map<String, dynamic> item) => StudioCaseViewItem(
            id: _text(item['id'], 'evidence'),
            title: _text(item['title'], _text(item['id'], 'Evidence')),
            detail: _text(item['description'], _text(item['summary'], '')),
            kind: 'evidence',
            primaryMeta: _text(item['kind'], 'record'),
            secondaryMeta: '${_strings(item['supports_facts']).length} supported fact(s)',
            needsAttention: _strings(item['supports_facts']).isEmpty,
          ))
      .toList(growable: false);
  return <StudioCaseViewItem>[...facts, ...evidence];
}

List<StudioCaseViewItem> _decisionItems(List<Map<String, dynamic>> actions) {
  return actions.map((Map<String, dynamic> action) {
    final String actionId = _text(action['id'], 'action');
    final int minutes = _integer(action['time_cost_minutes']);
    final int billable = _integer(action['billable_minutes']);
    final List<Map<String, dynamic>> effects = _objects(action['effects']);
    return StudioCaseViewItem(
      id: actionId,
      title: _text(action['title'], actionId),
      detail: _text(action['description'], 'Add a concise consequence.'),
      kind: 'decision option',
      primaryMeta: action['available_when'] == null ? 'Always available' : 'Conditioned',
      secondaryMeta: '$minutes min · $billable billable · ${effects.length} effect(s)',
      needsAttention: effects.isEmpty,
    );
  }).toList(growable: false);
}

List<StudioCaseViewItem> _taskItems(
  List<Map<String, dynamic>> stages,
  List<Map<String, dynamic>> actions,
) {
  return stages.indexed.map(((int, Map<String, dynamic>) entry) {
    final int index = entry.$1;
    final Map<String, dynamic> stage = entry.$2;
    final List<String> exits = _strings(stage['exit_actions']);
    final int effort = actions
        .where((Map<String, dynamic> action) => exits.contains(action['id']))
        .fold<int>(0, (int total, Map<String, dynamic> action) => total + _integer(action['time_cost_minutes']));
    return StudioCaseViewItem(
      id: _text(stage['id'], 'stage_$index'),
      title: _text(stage['title'], 'Stage ${index + 1}'),
      detail: exits.isEmpty ? 'Terminal or awaiting a connected action.' : 'Actions: ${exits.join(' · ')}',
      kind: stage['terminal'] == true ? 'outcome' : 'process stage',
      primaryMeta: 'Sequence ${index + 1}',
      secondaryMeta: '$effort min planned',
      needsAttention: stage['terminal'] != true && exits.isEmpty,
    );
  }).toList(growable: false);
}

List<StudioCaseViewItem> _timelineItems(
  Map<String, dynamic> source,
  List<Map<String, dynamic>> stages,
) {
  final List<StudioCaseViewItem> stageItems = stages.indexed
      .map(((int, Map<String, dynamic>) entry) => StudioCaseViewItem(
            id: _text(entry.$2['id'], 'stage_${entry.$1}'),
            title: _text(entry.$2['title'], 'Stage ${entry.$1 + 1}'),
            detail: entry.$2['terminal'] == true ? 'Terminal stage.' : 'Case stage in authored order.',
            kind: 'stage',
            primaryMeta: 'Sequence ${entry.$1 + 1}',
            secondaryMeta: _text(entry.$2['kind'], 'standard'),
          ))
      .toList(growable: false);
  final List<StudioCaseViewItem> deadlines = _objects(source['deadlines'])
      .map((Map<String, dynamic> item) => StudioCaseViewItem(
            id: _text(item['id'], 'deadline'),
            title: _text(item['title'], _text(item['id'], 'Deadline')),
            detail: 'Completion actions: ${_strings(item['completion_actions']).join(' · ')}',
            kind: 'deadline',
            primaryMeta: '${_integer(item['due_at_minute'])} elapsed min',
            secondaryMeta: _text(item['activation_event'], 'active at opening'),
            needsAttention: _strings(item['completion_actions']).isEmpty,
          ))
      .toList(growable: false);
  return <StudioCaseViewItem>[...stageItems, ...deadlines];
}

List<StudioCaseViewItem> _economicsItems(
  Map<String, dynamic> source,
  List<Map<String, dynamic>> actions,
) {
  final int totalMinutes = actions.fold<int>(
    0,
    (int sum, Map<String, dynamic> action) => sum + _integer(action['time_cost_minutes']),
  );
  final int billableMinutes = actions.fold<int>(
    0,
    (int sum, Map<String, dynamic> action) => sum + _integer(action['billable_minutes']),
  );
  final Map<String, dynamic> resources = source['initial_resources'] is Map<String, dynamic>
      ? source['initial_resources'] as Map<String, dynamic>
      : const <String, dynamic>{};
  return <StudioCaseViewItem>[
    StudioCaseViewItem(
      id: 'route_effort',
      title: 'Route effort and budget',
      detail: resources.isEmpty
          ? 'No initial monetary resource envelope is authored; time remains visible.'
          : 'Initial resource keys: ${resources.keys.join(' · ')}',
      kind: 'economics',
      primaryMeta: '$totalMinutes elapsed min',
      secondaryMeta: '$billableMinutes billable min',
      needsAttention: resources.isEmpty,
    ),
  ];
}

List<StudioCaseViewItem> _simulationItems(
  Map<String, dynamic> source,
  List<Map<String, dynamic>> stages,
  List<Map<String, dynamic>> actions,
) {
  final List<Map<String, dynamic>> outcomes = _objects(source['outcomes']);
  return <StudioCaseViewItem>[
    StudioCaseViewItem(
      id: 'simulation_route',
      title: 'Playable route',
      detail: 'The canonical route is validated and executed by Rust in Step 5.',
      kind: 'simulation',
      primaryMeta: '${stages.length} stages · ${actions.length} actions',
      secondaryMeta: '${outcomes.length} outcome(s)',
      needsAttention: stages.isEmpty || actions.isEmpty || outcomes.isEmpty,
    ),
    ...outcomes.map((Map<String, dynamic> outcome) => StudioCaseViewItem(
          id: _text(outcome['id'], 'outcome'),
          title: _text(outcome['title'], _text(outcome['id'], 'Outcome')),
          detail: _text(outcome['summary'], ''),
          kind: 'outcome',
          primaryMeta: _text(outcome['terminal_stage'], 'terminal'),
          secondaryMeta: outcome['condition'] == null ? 'No condition' : 'Conditioned',
          needsAttention: outcome['condition'] == null,
        )),
  ];
}

List<Map<String, dynamic>> _objects(Object? value) => value is List<dynamic>
    ? value.whereType<Map<String, dynamic>>().toList(growable: false)
    : const <Map<String, dynamic>>[];

List<String> _strings(Object? value) => value is List<dynamic>
    ? value.whereType<String>().toList(growable: false)
    : const <String>[];

String _text(Object? value, String fallback) => value is String && value.trim().isNotEmpty ? value.trim() : fallback;

int _integer(Object? value) => value is int && value >= 0 ? value : 0;
