import 'dart:convert';
import 'dart:io';

void main(List<String> arguments) {
  final _Arguments parsed = _Arguments.parse(arguments);
  final Directory repository = Directory(parsed.repositoryRoot).absolute;
  final File catalogFile =
      File(_join(repository.path, 'content/catalog/catalog.json'));
  final File localizationFile =
      File(_join(repository.path, 'content/localization/case_catalog.v1.json'));
  final File outputFile = File(_join(
    repository.path,
    'apps/juris-mobile/assets/case_catalog/mobile_case_bundle.json',
  ));

  final Map<String, dynamic> catalog = _readObject(catalogFile);
  final Map<String, dynamic> localization = _readObject(localizationFile);

  _requireInt(catalog, 'catalog_version');
  _requireInt(localization, 'schema_version');
  final String defaultLocale = _requireString(localization, 'default_locale');
  final List<String> supportedLocales =
      _stringList(localization['supported_locales'], 'supported_locales');
  if (!supportedLocales.contains(defaultLocale)) {
    throw FormatException(
      'default_locale must be included in supported_locales',
    );
  }

  final Map<String, dynamic> localizedCases =
      _object(localization['cases'], 'cases');
  final List<dynamic> catalogCases = _list(catalog['cases'], 'catalog.cases');
  final List<Map<String, dynamic>> exportedCases = <Map<String, dynamic>>[];

  for (final dynamic rawEntry in catalogCases) {
    final Map<String, dynamic> entry = _object(rawEntry, 'catalog case');
    final String caseId = _requireString(entry, 'case_id');
    _validateStableId(caseId, 'case_id');

    final Map<String, dynamic> caseConfig =
        _object(localizedCases[caseId], 'localization.cases.$caseId');
    final String identityRelative = _requireString(entry, 'identity_file');
    final File identityFile = File(_join(repository.path, identityRelative));
    final Map<String, dynamic> identity = _readObject(identityFile);

    _requireEqual(
        caseId, _requireString(identity, 'case_id'), '$caseId.case_id');
    _requireEqual(
      _requireString(entry, 'caption'),
      _requireString(identity, 'caption'),
      '$caseId.caption',
    );
    _requireEqual(
      _requireString(entry, 'player_client_id'),
      _requireString(identity, 'player_client_id'),
      '$caseId.player_client_id',
    );

    final String playerClientId = _requireString(identity, 'player_client_id');
    final List<dynamic> parties = _list(identity['parties'], '$caseId.parties');
    Map<String, dynamic>? playerParty;
    for (final dynamic rawParty in parties) {
      final Map<String, dynamic> party = _object(rawParty, '$caseId.party');
      if (_requireString(party, 'party_id') == playerClientId) {
        playerParty = party;
        break;
      }
    }
    if (playerParty == null) {
      throw FormatException(
        '$caseId player_client_id does not resolve to an identity party',
      );
    }

    final String? scenarioRelative = entry['scenario_file'] as String?;
    final bool scenarioAvailable = scenarioRelative != null &&
        File(_join(repository.path, scenarioRelative)).existsSync();
    final String? runtimeAdapter = caseConfig['runtime_adapter'] as String?;
    if (runtimeAdapter != null && !scenarioAvailable) {
      throw FormatException(
        '$caseId declares runtime_adapter but its scenario file is unavailable',
      );
    }

    final Map<String, dynamic> readiness = _object(
        caseConfig['readiness'] ?? <String, dynamic>{}, '$caseId.readiness');
    final Map<String, dynamic>? scenarioDefinition =
        readiness['engine_runtime'] == true && scenarioRelative != null
            ? _readObject(File(_join(repository.path, scenarioRelative)))
            : null;
    final Map<String, dynamic> localeSource =
        _object(caseConfig['locales'], '$caseId.locales');
    final Map<String, dynamic> localizedOutput = <String, dynamic>{};

    for (final String locale in supportedLocales) {
      final Map<String, dynamic> defaultText = _object(
        localeSource[defaultLocale] ?? <String, dynamic>{},
        '$caseId.locales.$defaultLocale',
      );
      final Map<String, dynamic> selectedText = _object(
        localeSource[locale] ?? <String, dynamic>{},
        '$caseId.locales.$locale',
      );

      dynamic localized(String key, dynamic fallback) {
        return selectedText.containsKey(key)
            ? selectedText[key]
            : defaultText.containsKey(key)
                ? defaultText[key]
                : fallback;
      }

      localizedOutput[locale] = <String, dynamic>{
        'caption': _requireString(identity, 'caption'),
        'topic': localized('topic', _requireString(identity, 'topic')),
        'short_title':
            localized('short_title', _requireString(identity, 'short_title')),
        'synopsis': localized('synopsis', _requireString(identity, 'synopsis')),
        'player_client_name': _requireString(playerParty, 'display_name'),
        'player_client_role': localized(
          'player_client_role',
          _clientRole(playerParty),
        ),
        'legal_issues': localized(
          'legal_issues',
          _stringList(identity['legal_issues'], '$caseId.legal_issues'),
        ),
      };
    }

    exportedCases.add(<String, dynamic>{
      'case_id': caseId,
      'scenario_id': caseId,
      'sort_order': _requireInt(caseConfig, 'sort_order'),
      'seed': _requireInt(caseConfig, 'seed'),
      'status': _requireString(entry, 'status'),
      'difficulty': _requireString(entry, 'difficulty'),
      'jurisdiction': _requireString(entry, 'jurisdiction'),
      'practice_area': _requireString(entry, 'practice_area'),
      'player_client_id': playerClientId,
      'player_role': _requireString(playerParty, 'procedural_role'),
      'identity_file': identityRelative,
      'scenario_file': scenarioRelative,
      'scenario_available': scenarioAvailable,
      'scenario': scenarioDefinition,
      'runtime_adapter': runtimeAdapter,
      'readiness': <String, dynamic>{
        'identity': true,
        'scenario_definition': scenarioAvailable,
        'diagnostics': readiness['diagnostics'] == true,
        'path_simulation': readiness['path_simulation'] == true,
        'engine_runtime': readiness['engine_runtime'] == true,
        'mobile_bundle': true,
      },
      'localizations': localizedOutput,
    });
  }

  exportedCases.sort((Map<String, dynamic> left, Map<String, dynamic> right) {
    final int order =
        (left['sort_order'] as int).compareTo(right['sort_order'] as int);
    if (order != 0) {
      return order;
    }
    return (left['case_id'] as String).compareTo(right['case_id'] as String);
  });

  final Map<String, dynamic> output = <String, dynamic>{
    'bundle_version': 3,
    'catalog_version': catalog['catalog_version'],
    'default_locale': defaultLocale,
    'supported_locales': supportedLocales,
    'fictional_notice': localization['fictional_notice'],
    'ui': localization['ui'],
    'cases': exportedCases,
  };
  final String encoded =
      '${const JsonEncoder.withIndent('  ').convert(output)}\n';

  if (parsed.checkOnly) {
    if (!outputFile.existsSync()) {
      stderr.writeln('Generated mobile bundle is missing: ${outputFile.path}');
      exitCode = 1;
      return;
    }
    final String current = outputFile.readAsStringSync();
    if (current != encoded) {
      stderr.writeln(
        'Generated mobile bundle is stale. Run the exporter without --check.',
      );
      exitCode = 1;
      return;
    }
    stdout.writeln('PASS mobile case bundle is deterministic and current');
    return;
  }

  outputFile.parent.createSync(recursive: true);
  outputFile.writeAsStringSync(encoded, flush: true);
  stdout.writeln(
    'Wrote ${exportedCases.length} cases to ${outputFile.path}',
  );
}

String _clientRole(Map<String, dynamic> playerParty) {
  final dynamic rawContact = playerParty['client_contact'];
  if (rawContact is Map<String, dynamic>) {
    return _requireString(rawContact, 'role');
  }
  return _requireString(playerParty, 'procedural_role');
}

Map<String, dynamic> _readObject(File file) {
  if (!file.existsSync()) {
    throw FileSystemException('Required JSON file not found', file.path);
  }
  final dynamic decoded = jsonDecode(file.readAsStringSync());
  return _object(decoded, file.path);
}

Map<String, dynamic> _object(dynamic value, String path) {
  if (value is Map<String, dynamic>) {
    return value;
  }
  throw FormatException('$path must be a JSON object');
}

List<dynamic> _list(dynamic value, String path) {
  if (value is List<dynamic>) {
    return value;
  }
  throw FormatException('$path must be a JSON array');
}

List<String> _stringList(dynamic value, String path) {
  return _list(value, path).map((dynamic item) {
    if (item is! String) {
      throw FormatException('$path entries must be strings');
    }
    return item;
  }).toList(growable: false);
}

String _requireString(Map<String, dynamic> value, String field) {
  final dynamic candidate = value[field];
  if (candidate is String && candidate.isNotEmpty) {
    return candidate;
  }
  throw FormatException('$field must be a non-empty string');
}

int _requireInt(Map<String, dynamic> value, String field) {
  final dynamic candidate = value[field];
  if (candidate is int) {
    return candidate;
  }
  throw FormatException('$field must be an integer');
}

void _requireEqual(String left, String right, String path) {
  if (left != right) {
    throw FormatException('$path differs between catalog and identity');
  }
}

void _validateStableId(String value, String path) {
  final RegExp pattern = RegExp(r'^[a-z][a-z0-9]*(?:_[a-z0-9]+)*$');
  if (!pattern.hasMatch(value)) {
    throw FormatException('$path is not a stable ID: $value');
  }
}

String _join(String root, String relative) {
  final List<String> parts = relative
      .replaceAll('\\', '/')
      .split('/')
      .where((String item) => item.isNotEmpty)
      .toList(growable: false);
  return <String>[root, ...parts].join(Platform.pathSeparator);
}

class _Arguments {
  const _Arguments({
    required this.repositoryRoot,
    required this.checkOnly,
  });

  final String repositoryRoot;
  final bool checkOnly;

  static _Arguments parse(List<String> arguments) {
    String? repositoryRoot;
    bool checkOnly = false;

    for (int index = 0; index < arguments.length; index += 1) {
      final String argument = arguments[index];
      switch (argument) {
        case '--repo-root':
          if (index + 1 >= arguments.length) {
            throw const FormatException('--repo-root requires a value');
          }
          repositoryRoot = arguments[index + 1];
          index += 1;
          break;
        case '--check':
          checkOnly = true;
          break;
        default:
          throw FormatException('Unknown argument: $argument');
      }
    }

    if (repositoryRoot == null || repositoryRoot.isEmpty) {
      throw const FormatException('--repo-root is required');
    }
    return _Arguments(
      repositoryRoot: repositoryRoot,
      checkOnly: checkOnly,
    );
  }
}
