import 'dart:convert';
import '../models/case_type_registry.dart';
import '../models/studio_scenario_draft.dart';
import '../models/studio_workspace.dart';

/// Existing canonical workspace format validation shared with journal recovery.
final class StudioWorkspaceCodec {
  static StudioWorkspace decode(String encoded) {
    final dynamic source = jsonDecode(encoded);
    if (source is! Map<String, dynamic> ||
        !source.containsKey('schema_version')) {
      throw const FormatException('Invalid Studio workspace envelope.');
    }
    if (source['schema_version'] != 1 ||
        source.keys.any((String key) => !{
              'schema_version',
              'scenario',
              'active_stage',
              'completed_stages'
            }.contains(key))) {
      throw const UnsupportedStudioData('Unsupported Studio workspace format.');
    }
    final StudioScenarioDraft draft = decodeScenario(source['scenario']);
    final Object? active = source['active_stage'];
    final Object? completed = source['completed_stages'];
    if ((active != null && active is! String) ||
        (completed != null && completed is! List<dynamic>)) {
      throw const FormatException('Invalid Studio progress.');
    }
    StudioWorkflowStage stage(Object? value) {
      if (value is! String)
        throw const FormatException('Invalid Studio stage.');
      for (final StudioWorkflowStage stage in StudioWorkflowStage.values) {
        if (value == stage.wireName) return stage;
      }
      throw const UnsupportedStudioData('Unsupported Studio workflow stage.');
    }

    return StudioWorkspace(
      draft: draft,
      activeStage:
          active == null ? StudioWorkflowStage.describe : stage(active),
      completedStages: ((completed as List<dynamic>?) ?? const <dynamic>[])
          .map(stage)
          .toSet(),
    );
  }

  static StudioScenarioDraft decodeScenario(dynamic source) {
    if (source is! Map<String, dynamic> ||
        !source.containsKey('schema_version')) {
      throw const FormatException('Invalid canonical scenario.');
    }
    if (source['schema_version'] != '1.0') {
      throw const UnsupportedStudioData(
          'Unsupported canonical scenario version.');
    }
    final dynamic metadata = source['metadata'];
    final dynamic jurisdiction = source['jurisdiction'];
    if (metadata is! Map<String, dynamic> ||
        jurisdiction is! Map<String, dynamic> ||
        !['id', 'title', 'summary', 'content_version']
            .every((String key) => metadata[key] is String) ||
        (metadata['id'] as String).isEmpty ||
        source['initial_stage'] is! String ||
        !['code', 'pack_version']
            .every((String key) => jurisdiction[key] is String)) {
      throw const FormatException('Invalid canonical scenario identity.');
    }
    if (metadata['case_type'] != null) {
      try {
        CaseTypeReference.fromJson(metadata['case_type']);
      } on FormatException {
        throw const UnsupportedStudioData('Unsupported case-type package.');
      }
    }
    const Map<String, List<String>> fields = {
      'stages': ['id', 'title', 'kind'],
      'actions': ['id', 'title'],
      'outcomes': ['id', 'title', 'summary', 'terminal_stage'],
      'facts': ['id', 'statement', 'initial_status'],
      'actors': ['id', 'name', 'role'],
      'evidence': ['id', 'title', 'kind'],
    };
    for (final String field in fields.keys) {
      final dynamic items = source[field];
      if (items == null && ['facts', 'actors', 'evidence'].contains(field))
        continue;
      if (items is! List<dynamic> ||
          items.any((dynamic item) =>
              item is! Map<String, dynamic> ||
              !fields[field]!.every((String key) => item[key] is String) ||
              (item['description'] != null &&
                  item['description'] is! String))) {
        throw FormatException('Invalid canonical scenario $field.');
      }
    }
    return StudioScenarioDraft.fromJson(source);
  }
}

final class UnsupportedStudioData implements Exception {
  const UnsupportedStudioData(this.message);
  final String message;
}
