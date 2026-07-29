import 'package:flutter/foundation.dart';

enum MobileCaseStatus { playable, outline, comingSoon }

enum CaseDifficulty { introductory, intermediate, advanced, expert }

@immutable
class CaseReadiness {
  const CaseReadiness({
    required this.identity,
    required this.scenarioDefinition,
    required this.diagnostics,
    required this.pathSimulation,
    required this.mobileBundle,
  });

  factory CaseReadiness.fromJson(Map<String, dynamic> json) {
    return CaseReadiness(
      identity: _requiredBool(json, 'identity'),
      scenarioDefinition: _requiredBool(json, 'scenario_definition'),
      diagnostics: _requiredBool(json, 'diagnostics'),
      pathSimulation: _requiredBool(json, 'path_simulation'),
      mobileBundle: _requiredBool(json, 'mobile_bundle'),
    );
  }

  final bool identity;
  final bool scenarioDefinition;
  final bool diagnostics;
  final bool pathSimulation;
  final bool mobileBundle;
}

@immutable
class LocalizedCaseText {
  const LocalizedCaseText({
    required this.caption,
    required this.topic,
    required this.shortTitle,
    required this.synopsis,
    required this.playerClientName,
    required this.playerClientRole,
    required this.legalIssues,
  });

  factory LocalizedCaseText.fromJson(Map<String, dynamic> json) {
    return LocalizedCaseText(
      caption: _requiredString(json, 'caption'),
      topic: _requiredString(json, 'topic'),
      shortTitle: _requiredString(json, 'short_title'),
      synopsis: _requiredString(json, 'synopsis'),
      playerClientName: _requiredString(json, 'player_client_name'),
      playerClientRole: _requiredString(json, 'player_client_role'),
      legalIssues: _stringList(json, 'legal_issues'),
    );
  }

  final String caption;
  final String topic;
  final String shortTitle;
  final String synopsis;
  final String playerClientName;
  final String playerClientRole;
  final List<String> legalIssues;
}

@immutable
class MobileCaseDefinition {
  const MobileCaseDefinition({
    required this.caseId,
    required this.scenarioId,
    required this.sortOrder,
    required this.seed,
    required this.status,
    required this.difficulty,
    required this.jurisdiction,
    required this.practiceArea,
    required this.playerClientId,
    required this.playerRole,
    required this.identityFile,
    required this.scenarioFile,
    required this.scenarioAvailable,
    required this.runtimeAdapter,
    required this.readiness,
    required this.localizations,
  });

  factory MobileCaseDefinition.fromJson(Map<String, dynamic> json) {
    final Map<String, dynamic> rawLocalizations =
        _requiredObject(json, 'localizations');
    return MobileCaseDefinition(
      caseId: _requiredString(json, 'case_id'),
      scenarioId: _requiredString(json, 'scenario_id'),
      sortOrder: _requiredInt(json, 'sort_order'),
      seed: _requiredInt(json, 'seed'),
      status: MobileCaseStatus.values.byName(_requiredString(json, 'status')),
      difficulty:
          CaseDifficulty.values.byName(_requiredString(json, 'difficulty')),
      jurisdiction: _requiredString(json, 'jurisdiction'),
      practiceArea: _requiredString(json, 'practice_area'),
      playerClientId: _requiredString(json, 'player_client_id'),
      playerRole: _requiredString(json, 'player_role'),
      identityFile: _requiredString(json, 'identity_file'),
      scenarioFile: json['scenario_file'] as String?,
      scenarioAvailable: _requiredBool(json, 'scenario_available'),
      runtimeAdapter: json['runtime_adapter'] as String?,
      readiness: CaseReadiness.fromJson(_requiredObject(json, 'readiness')),
      localizations: rawLocalizations.map(
        (String locale, dynamic value) => MapEntry<String, LocalizedCaseText>(
          locale,
          LocalizedCaseText.fromJson(_asObject(value, 'localizations.$locale')),
        ),
      ),
    );
  }

  final String caseId;
  final String scenarioId;
  final int sortOrder;
  final int seed;
  final MobileCaseStatus status;
  final CaseDifficulty difficulty;
  final String jurisdiction;
  final String practiceArea;
  final String playerClientId;
  final String playerRole;
  final String identityFile;
  final String? scenarioFile;
  final bool scenarioAvailable;
  final String? runtimeAdapter;
  final CaseReadiness readiness;
  final Map<String, LocalizedCaseText> localizations;

  LocalizedCaseText localized(String locale, String fallbackLocale) {
    final LocalizedCaseText? selected = localizations[locale];
    if (selected != null) {
      return selected;
    }
    final LocalizedCaseText? fallback = localizations[fallbackLocale];
    if (fallback != null) {
      return fallback;
    }
    return localizations.values.first;
  }
}

@immutable
class CaseCatalogBundle {
  const CaseCatalogBundle({
    required this.bundleVersion,
    required this.catalogVersion,
    required this.defaultLocale,
    required this.supportedLocales,
    required this.fictionalNotices,
    required this.ui,
    required this.cases,
  });

  factory CaseCatalogBundle.fromJson(Map<String, dynamic> json) {
    final List<MobileCaseDefinition> cases = _requiredList(json, 'cases')
        .map(
          (dynamic value) => MobileCaseDefinition.fromJson(
            _asObject(value, 'case'),
          ),
        )
        .toList(growable: false)
      ..sort(
        (MobileCaseDefinition left, MobileCaseDefinition right) {
          final int order = left.sortOrder.compareTo(right.sortOrder);
          if (order != 0) {
            return order;
          }
          return left.caseId.compareTo(right.caseId);
        },
      );

    final List<String> supportedLocales =
        _stringList(json, 'supported_locales');
    final String defaultLocale = _requiredString(json, 'default_locale');
    if (!supportedLocales.contains(defaultLocale)) {
      throw const FormatException(
        'default_locale must be present in supported_locales',
      );
    }

    return CaseCatalogBundle(
      bundleVersion: _requiredInt(json, 'bundle_version'),
      catalogVersion: _requiredInt(json, 'catalog_version'),
      defaultLocale: defaultLocale,
      supportedLocales: supportedLocales,
      fictionalNotices: _stringMap(json, 'fictional_notice'),
      ui: _requiredObject(json, 'ui').map(
        (String locale, dynamic value) => MapEntry<String, Map<String, String>>(
          locale,
          _asStringMap(value, 'ui.$locale'),
        ),
      ),
      cases: cases,
    );
  }

  final int bundleVersion;
  final int catalogVersion;
  final String defaultLocale;
  final List<String> supportedLocales;
  final Map<String, String> fictionalNotices;
  final Map<String, Map<String, String>> ui;
  final List<MobileCaseDefinition> cases;

  String text(String locale, String key) {
    return ui[locale]?[key] ?? ui[defaultLocale]?[key] ?? key;
  }

  String fictionalNotice(String locale) {
    return fictionalNotices[locale] ??
        fictionalNotices[defaultLocale] ??
        fictionalNotices.values.first;
  }
}

Map<String, dynamic> _requiredObject(
  Map<String, dynamic> json,
  String field,
) {
  return _asObject(json[field], field);
}

Map<String, dynamic> _asObject(dynamic value, String path) {
  if (value is Map<String, dynamic>) {
    return value;
  }
  throw FormatException('$path must be an object');
}

List<dynamic> _requiredList(Map<String, dynamic> json, String field) {
  final dynamic value = json[field];
  if (value is List<dynamic>) {
    return value;
  }
  throw FormatException('$field must be an array');
}

String _requiredString(Map<String, dynamic> json, String field) {
  final dynamic value = json[field];
  if (value is String && value.isNotEmpty) {
    return value;
  }
  throw FormatException('$field must be a non-empty string');
}

int _requiredInt(Map<String, dynamic> json, String field) {
  final dynamic value = json[field];
  if (value is int) {
    return value;
  }
  throw FormatException('$field must be an integer');
}

bool _requiredBool(Map<String, dynamic> json, String field) {
  final dynamic value = json[field];
  if (value is bool) {
    return value;
  }
  throw FormatException('$field must be a Boolean');
}

List<String> _stringList(Map<String, dynamic> json, String field) {
  final dynamic value = json[field];
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

Map<String, String> _stringMap(
  Map<String, dynamic> json,
  String field,
) {
  return _asStringMap(json[field], field);
}

Map<String, String> _asStringMap(dynamic value, String path) {
  final Map<String, dynamic> object = _asObject(value, path);
  return object.map((String key, dynamic item) {
    if (item is! String) {
      throw FormatException('$path.$key must be a string');
    }
    return MapEntry<String, String>(key, item);
  });
}
