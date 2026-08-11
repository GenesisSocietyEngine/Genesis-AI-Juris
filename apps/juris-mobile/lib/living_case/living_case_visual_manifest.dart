import 'package:flutter/foundation.dart';

import '../visual_identity/case_visual_manifest.dart';

enum LivingCaseResponseTreatment {
  controlled('controlled'),
  disclosedRisk('disclosed_risk');

  const LivingCaseResponseTreatment(this.wireName);
  final String wireName;

  static LivingCaseResponseTreatment parse(String value) => values.singleWhere(
        (LivingCaseResponseTreatment item) => item.wireName == value,
        orElse: () => throw FormatException(
          'Unknown Living Case response treatment `$value`',
        ),
      );
}

enum LivingCaseOutcomeTreatment {
  protected('protected'),
  compromised('compromised');

  const LivingCaseOutcomeTreatment(this.wireName);
  final String wireName;

  static LivingCaseOutcomeTreatment parse(String value) => values.singleWhere(
        (LivingCaseOutcomeTreatment item) => item.wireName == value,
        orElse: () => throw FormatException(
          'Unknown Living Case outcome treatment `$value`',
        ),
      );
}

@immutable
final class LivingCasePressureTreatment {
  LivingCasePressureTreatment._({
    required this.pressureId,
    required this.sourceActorId,
    required this.requestInboxItemId,
    required this.deadlineId,
    required Map<String, LivingCaseResponseTreatment> responses,
  }) : responses = Map<String, LivingCaseResponseTreatment>.unmodifiable(
          responses,
        );

  factory LivingCasePressureTreatment.fromJson(Map<String, dynamic> json) {
    _requireExactKeys(
      json,
      const <String>{
        'pressure_id',
        'source_actor_id',
        'request_inbox_item_id',
        'deadline_id',
        'responses',
      },
      'manifest.pressure',
    );
    final Map<String, LivingCaseResponseTreatment> responses =
        <String, LivingCaseResponseTreatment>{};
    for (final (int index, dynamic raw)
        in _requiredList(json, 'responses', 'manifest.pressure').indexed) {
      final String path = 'manifest.pressure.responses[$index]';
      final Map<String, dynamic> item = _asObject(raw, path);
      _requireExactKeys(item, const <String>{'action_id', 'treatment'}, path);
      final String actionId = _stableId(item, 'action_id', path);
      if (responses.containsKey(actionId)) {
        throw FormatException('Duplicate action_id `$actionId`');
      }
      responses[actionId] = LivingCaseResponseTreatment.parse(
        _requiredString(item, 'treatment', path),
      );
    }
    if (responses.length != 2 ||
        responses.values.toSet().length !=
            LivingCaseResponseTreatment.values.length) {
      throw const FormatException(
        'manifest.pressure.responses must map exactly one controlled and one disclosed_risk action',
      );
    }
    return LivingCasePressureTreatment._(
      pressureId: _stableId(json, 'pressure_id', 'manifest.pressure'),
      sourceActorId: _stableId(json, 'source_actor_id', 'manifest.pressure'),
      requestInboxItemId:
          _stableId(json, 'request_inbox_item_id', 'manifest.pressure'),
      deadlineId: _stableId(json, 'deadline_id', 'manifest.pressure'),
      responses: responses,
    );
  }

  final String pressureId;
  final String sourceActorId;
  final String requestInboxItemId;
  final String deadlineId;
  final Map<String, LivingCaseResponseTreatment> responses;
}

@immutable
final class LivingCaseVisualManifest {
  LivingCaseVisualManifest._({
    required this.schemaVersion,
    required this.caseId,
    required this.caseTreatment,
    required this.pressure,
    required Map<String, LivingCaseOutcomeTreatment> outcomes,
  }) : outcomes =
            Map<String, LivingCaseOutcomeTreatment>.unmodifiable(outcomes);

  factory LivingCaseVisualManifest.fromJson(Map<String, dynamic> json) {
    _requireExactKeys(
      json,
      const <String>{
        'schema_version',
        'case_id',
        'case_treatment',
        'pressure',
        'outcomes',
      },
      'manifest',
    );
    final dynamic schemaVersion = json['schema_version'];
    if (schemaVersion is! int || schemaVersion != 1) {
      throw const FormatException('manifest.schema_version must be integer 1');
    }
    final Map<String, LivingCaseOutcomeTreatment> outcomes =
        <String, LivingCaseOutcomeTreatment>{};
    for (final (int index, dynamic raw)
        in _requiredList(json, 'outcomes', 'manifest').indexed) {
      final String path = 'manifest.outcomes[$index]';
      final Map<String, dynamic> item = _asObject(raw, path);
      _requireExactKeys(item, const <String>{'outcome_id', 'treatment'}, path);
      final String outcomeId = _stableId(item, 'outcome_id', path);
      if (outcomes.containsKey(outcomeId)) {
        throw FormatException('Duplicate outcome_id `$outcomeId`');
      }
      outcomes[outcomeId] = LivingCaseOutcomeTreatment.parse(
        _requiredString(item, 'treatment', path),
      );
    }
    if (outcomes.length != 2 ||
        outcomes.values.toSet().length !=
            LivingCaseOutcomeTreatment.values.length) {
      throw const FormatException(
        'manifest.outcomes must map exactly one protected and one compromised outcome',
      );
    }
    return LivingCaseVisualManifest._(
      schemaVersion: schemaVersion,
      caseId: _stableId(json, 'case_id', 'manifest'),
      caseTreatment: CaseVisualTreatment.fromJson(
        _requiredObject(json, 'case_treatment', 'manifest'),
        path: 'manifest.case_treatment',
      ),
      pressure: LivingCasePressureTreatment.fromJson(
        _requiredObject(json, 'pressure', 'manifest'),
      ),
      outcomes: outcomes,
    );
  }

  final int schemaVersion;
  final String caseId;
  final CaseVisualTreatment caseTreatment;
  final LivingCasePressureTreatment pressure;
  final Map<String, LivingCaseOutcomeTreatment> outcomes;

  bool supportsCase(String candidateCaseId) => candidateCaseId == caseId;

  LivingCaseResponseTreatment? responseTreatment(String actionId) =>
      pressure.responses[actionId];

  LivingCaseOutcomeTreatment? outcomeTreatment(String outcomeId) =>
      outcomes[outcomeId];
}

void _requireExactKeys(
  Map<String, dynamic> json,
  Set<String> expected,
  String path,
) {
  final Set<String> actual = json.keys.toSet();
  final List<String> missing = expected.difference(actual).toList()..sort();
  final List<String> unknown = actual.difference(expected).toList()..sort();
  if (missing.isNotEmpty || unknown.isNotEmpty) {
    throw FormatException(
      '$path has invalid keys; missing=$missing unknown=$unknown',
    );
  }
}

Map<String, dynamic> _requiredObject(
  Map<String, dynamic> json,
  String field,
  String path,
) =>
    _asObject(json[field], '$path.$field');

Map<String, dynamic> _asObject(dynamic value, String path) {
  if (value is Map<String, dynamic>) {
    return value;
  }
  throw FormatException('$path must be an object');
}

List<dynamic> _requiredList(
  Map<String, dynamic> json,
  String field,
  String path,
) {
  final dynamic value = json[field];
  if (value is List<dynamic>) {
    return value;
  }
  throw FormatException('$path.$field must be an array');
}

String _requiredString(Map<String, dynamic> json, String field, String path) {
  final dynamic value = json[field];
  if (value is String && value.isNotEmpty) {
    return value;
  }
  throw FormatException('$path.$field must be a non-empty string');
}

String _stableId(Map<String, dynamic> json, String field, String path) {
  final String value = _requiredString(json, field, path);
  if (!RegExp(r'^[a-z0-9_]+$').hasMatch(value)) {
    throw FormatException('$path.$field must be a stable snake_case ID');
  }
  return value;
}
