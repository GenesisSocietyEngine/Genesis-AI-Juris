import 'dart:convert';
import 'dart:io';

import 'package:crypto/crypto.dart';

void main(List<String> arguments) {
  final _Arguments parsed = _Arguments.parse(arguments);
  final Directory repository = Directory(parsed.repositoryRoot).absolute;
  final File catalogFile =
      File(_join(repository.path, 'content/catalog/catalog.json'));
  final File localizationFile =
      File(_join(repository.path, 'content/localization/case_catalog.v1.json'));
  final File archiveManifestFile =
      File(_join(repository.path, 'content/archive/content_versions.v1.json'));
  final File outputFile = File(_join(
    repository.path,
    'apps/juris-mobile/assets/case_catalog/mobile_case_bundle.json',
  ));

  final Map<String, dynamic> catalog = _readObject(catalogFile);
  final Map<String, dynamic> localization = _readObject(localizationFile);
  final Map<String, dynamic> archiveManifest = _readObject(archiveManifestFile);

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
  final List<_ScenarioFingerprintPin> scenarioFingerprintPins =
      <_ScenarioFingerprintPin>[];
  final Map<String, Map<String, dynamic>> currentIdentities =
      <String, Map<String, dynamic>>{};
  for (final dynamic rawIdentity in _list(
    archiveManifest['current_identities'],
    'archive.current_identities',
  )) {
    final Map<String, dynamic> identity =
        _object(rawIdentity, 'archive current identity');
    final String scenarioFile = _requireString(identity, 'scenario_file');
    if (currentIdentities.putIfAbsent(scenarioFile, () => identity) !=
        identity) {
      throw FormatException('duplicate current identity path: $scenarioFile');
    }
    final String sourceHash = _requireSha256(identity, 'source_sha256');
    _requireEqual(
      sourceHash,
      _fileSha256(File(_join(repository.path, scenarioFile))),
      'current identity source_sha256',
    );
    final String declaredFingerprint =
        _requireSha256(identity, 'scenario_fingerprint');
    scenarioFingerprintPins.add(_ScenarioFingerprintPin(
      scenarioFile: scenarioFile,
      declaredFingerprint: declaredFingerprint,
    ));
  }
  final Set<String> usedCurrentIdentities = <String>{};

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
    final Map<String, dynamic>? scenarioSource = scenarioAvailable
        ? _readObject(File(_join(repository.path, scenarioRelative)))
        : null;
    final Map<String, dynamic>? scenarioDefinition =
        readiness['engine_runtime'] == true ? scenarioSource : null;
    final String scenarioId = scenarioDefinition == null
        ? caseId
        : _requireString(
            _object(
              scenarioDefinition['metadata'],
              '$caseId.scenario.metadata',
            ),
            'id',
          );
    _validateStableId(scenarioId, '$caseId.scenario_id');
    final Map<String, dynamic>? currentIdentity =
        scenarioRelative == null ? null : currentIdentities[scenarioRelative];
    if (scenarioDefinition != null && currentIdentity == null) {
      throw FormatException(
        '$caseId has no pinned current scenario identity for $scenarioRelative',
      );
    }
    if (currentIdentity != null) {
      usedCurrentIdentities.add(scenarioRelative!);
      _requireEqual(
        scenarioId,
        _requireString(currentIdentity, 'scenario_id'),
        '$caseId current scenario_id',
      );
    }
    final String? scenarioFingerprint = currentIdentity == null
        ? null
        : _requireSha256(currentIdentity, 'scenario_fingerprint');
    final Map<String, dynamic> localeSource =
        _object(caseConfig['locales'], '$caseId.locales');
    final Map<String, dynamic> localizedOutput = <String, dynamic>{};
    final Map<String, dynamic> scenarioLocalizedOutput = <String, dynamic>{};

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

    final Map<String, dynamic> scenarioLocalizationFiles = _object(
      caseConfig['scenario_localization_files'] ?? <String, dynamic>{},
      '$caseId.scenario_localization_files',
    );
    for (final MapEntry<String, dynamic> item
        in scenarioLocalizationFiles.entries) {
      if (item.value is! String) {
        throw FormatException(
          '$caseId.scenario_localization_files.${item.key} must be a path',
        );
      }
      if (!supportedLocales.contains(item.key)) {
        throw FormatException(
          '$caseId scenario localization uses unsupported locale ${item.key}',
        );
      }
      final Map<String, dynamic> overlay = _readObject(
        File(_join(repository.path, item.value as String)),
      );
      _requireEqual(
        scenarioId,
        _requireString(overlay, 'scenario_id'),
        '$caseId.scenario_localizations.${item.key}.scenario_id',
      );
      _requireEqual(
        item.key,
        _requireString(overlay, 'locale'),
        '$caseId.scenario_localizations.${item.key}.locale',
      );
      if (scenarioDefinition != null) {
        _validateScenarioLocalization(
          overlay,
          scenarioDefinition,
          '$caseId.scenario_localizations.${item.key}',
        );
      }
      scenarioLocalizedOutput[item.key] = overlay;
    }

    exportedCases.add(<String, dynamic>{
      'case_id': caseId,
      'scenario_id': scenarioId,
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
      'scenario_fingerprint': scenarioFingerprint,
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
      'scenario_localizations': scenarioLocalizedOutput,
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
  final Set<String> unusedCurrentIdentities =
      currentIdentities.keys.toSet().difference(usedCurrentIdentities);
  if (unusedCurrentIdentities.isNotEmpty) {
    throw FormatException(
      'current identity entries are not catalogue scenarios: '
      '${unusedCurrentIdentities.toList()..sort()}',
    );
  }

  _requireEqual(
    '1',
    _requireInt(archiveManifest, 'schema_version').toString(),
    'content archive schema_version',
  );
  final List<Map<String, dynamic>> loadOnlyScenarios = <Map<String, dynamic>>[];
  final Set<String> archiveIdentities = <String>{};
  for (final dynamic rawEntry
      in _list(archiveManifest['entries'], 'archive.entries')) {
    final Map<String, dynamic> entry = _object(rawEntry, 'archive entry');
    final String scenarioId = _requireString(entry, 'scenario_id');
    final String contentVersion = _requireString(entry, 'content_version');
    final String declaredFingerprint =
        _requireSha256(entry, 'scenario_fingerprint');
    _validateStableId(scenarioId, 'archive.scenario_id');
    final String identity = '$scenarioId\u0000$declaredFingerprint';
    if (!archiveIdentities.add(identity)) {
      throw FormatException(
        'duplicate archived scenario identity: $scenarioId/$declaredFingerprint',
      );
    }

    final String scenarioRelative = _requireString(entry, 'scenario_file');
    if (!scenarioRelative
        .replaceAll('\\', '/')
        .startsWith('content/archive/')) {
      throw FormatException(
        'archive scenario_file must stay under content/archive: $scenarioRelative',
      );
    }
    scenarioFingerprintPins.add(_ScenarioFingerprintPin(
      scenarioFile: scenarioRelative,
      declaredFingerprint: declaredFingerprint,
    ));
    final Map<String, dynamic> scenario =
        _readObject(File(_join(repository.path, scenarioRelative)));
    _requireEqual(
      _requireSha256(entry, 'source_sha256'),
      _fileSha256(File(_join(repository.path, scenarioRelative))),
      'archive source_sha256',
    );
    final Map<String, dynamic> metadata =
        _object(scenario['metadata'], 'archive.scenario.metadata');
    _requireEqual(
      scenarioId,
      _requireString(metadata, 'id'),
      'archive scenario_id',
    );
    _requireEqual(
      contentVersion,
      _requireString(metadata, 'content_version'),
      'archive content_version',
    );
    final Map<String, dynamic> localizedOutput = <String, dynamic>{};
    final Map<String, dynamic> localizationFiles = _object(
      entry['scenario_localization_files'] ?? <String, dynamic>{},
      'archive.scenario_localization_files',
    );
    final Map<String, dynamic> localizationHashes = _object(
      entry['scenario_localization_sha256'] ?? <String, dynamic>{},
      'archive.scenario_localization_sha256',
    );
    if (localizationHashes.keys
            .toSet()
            .difference(localizationFiles.keys.toSet())
            .isNotEmpty ||
        localizationFiles.keys
            .toSet()
            .difference(localizationHashes.keys.toSet())
            .isNotEmpty) {
      throw const FormatException(
        'archive localization paths and SHA-256 keys must match',
      );
    }
    for (final MapEntry<String, dynamic> localization
        in localizationFiles.entries) {
      if (!supportedLocales.contains(localization.key) ||
          localization.value is! String) {
        throw FormatException(
          'archive localization ${localization.key} must be a supported locale path',
        );
      }
      final String relative = localization.value as String;
      if (!relative.replaceAll('\\', '/').startsWith('content/archive/')) {
        throw FormatException(
          'archive localization must stay under content/archive: $relative',
        );
      }
      final Map<String, dynamic> overlay =
          _readObject(File(_join(repository.path, relative)));
      _requireEqual(
        _requireSha256(localizationHashes, localization.key),
        _fileSha256(File(_join(repository.path, relative))),
        'archive localization ${localization.key} SHA-256',
      );
      _requireEqual(
        scenarioId,
        _requireString(overlay, 'scenario_id'),
        'archive localization scenario_id',
      );
      _requireEqual(
        localization.key,
        _requireString(overlay, 'locale'),
        'archive localization locale',
      );
      _validateScenarioLocalization(
        overlay,
        scenario,
        'archive.scenario_localizations.${localization.key}',
      );
      localizedOutput[localization.key] = overlay;
    }

    loadOnlyScenarios.add(<String, dynamic>{
      'scenario_id': scenarioId,
      'content_version': contentVersion,
      'scenario_fingerprint': declaredFingerprint,
      'scenario_file': scenarioRelative,
      'scenario': scenario,
      'scenario_localizations': localizedOutput,
    });
  }
  loadOnlyScenarios
      .sort((Map<String, dynamic> left, Map<String, dynamic> right) {
    final int scenarioOrder = (left['scenario_id'] as String)
        .compareTo(right['scenario_id'] as String);
    if (scenarioOrder != 0) {
      return scenarioOrder;
    }
    return (left['scenario_fingerprint'] as String)
        .compareTo(right['scenario_fingerprint'] as String);
  });

  _verifyScenarioFingerprints(repository, scenarioFingerprintPins);

  final Map<String, dynamic> output = <String, dynamic>{
    'bundle_version': 5,
    'catalog_version': catalog['catalog_version'],
    'default_locale': defaultLocale,
    'supported_locales': supportedLocales,
    'fictional_notice': localization['fictional_notice'],
    'ui': localization['ui'],
    'cases': exportedCases,
    'load_only_scenarios': loadOnlyScenarios,
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
    'Wrote ${exportedCases.length} cases and '
    '${loadOnlyScenarios.length} load-only definitions to ${outputFile.path}',
  );
}

String _fileSha256(File file) {
  if (!file.existsSync()) {
    throw FileSystemException('Required file not found', file.path);
  }
  return sha256.convert(file.readAsBytesSync()).toString();
}

void _verifyScenarioFingerprints(
  Directory repository,
  List<_ScenarioFingerprintPin> pins,
) {
  if (pins.isEmpty) {
    throw const FormatException(
      'at least one current or archived scenario fingerprint is required',
    );
  }
  final List<String> arguments = <String>[
    'run',
    '--quiet',
    '--locked',
    '-p',
    'juris-engine',
    '--bin',
    'juris-scenario-fingerprint',
    '--',
    for (final _ScenarioFingerprintPin pin in pins) ...<String>[
      '--expect',
      pin.declaredFingerprint,
      pin.scenarioFile,
    ],
  ];

  final ProcessResult result;
  try {
    result = Process.runSync(
      'cargo',
      arguments,
      workingDirectory: repository.path,
      runInShell: false,
      stdoutEncoding: utf8,
      stderrEncoding: utf8,
    );
  } on ProcessException catch (error) {
    throw StateError(
      'Unable to run the authoritative Rust scenario fingerprint verifier: '
      '$error',
    );
  }
  if (result.exitCode != 0) {
    final String details = (result.stderr as String).trim();
    throw FormatException(
      'Authoritative Rust scenario fingerprint verification failed'
      '${details.isEmpty ? '' : ': $details'}',
    );
  }
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

String _requireSha256(Map<String, dynamic> value, String field) {
  final String candidate = _requireString(value, field);
  if (!RegExp(r'^[0-9a-f]{64}$').hasMatch(candidate)) {
    throw FormatException('$field must be 64 lowercase hex characters');
  }
  return candidate;
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

void _validateScenarioLocalization(
  Map<String, dynamic> overlay,
  Map<String, dynamic> scenario,
  String path,
) {
  const List<String> sections = <String>[
    'stages',
    'actions',
    'deadlines',
    'inbox_items',
    'facts',
    'evidence',
    'outcomes',
  ];
  for (final String section in sections) {
    final Set<String> canonicalIds = _list(
      scenario[section],
      'scenario.$section',
    ).map((dynamic item) {
      return _requireString(_object(item, 'scenario.$section item'), 'id');
    }).toSet();
    final Set<String> translatedIds =
        _object(overlay[section], '$path.$section').keys.toSet();
    final Set<String> missing = canonicalIds.difference(translatedIds);
    final Set<String> unknown = translatedIds.difference(canonicalIds);
    if (missing.isNotEmpty || unknown.isNotEmpty) {
      throw FormatException(
        '$path.$section stable IDs differ: '
        'missing=${missing.toList()..sort()}, '
        'unknown=${unknown.toList()..sort()}',
      );
    }
  }

  _validateOptionalScenarioLabelSection(
    overlay: overlay,
    scenario: scenario,
    overlaySection: 'metrics',
    scenarioSection: 'numeric_metrics',
    path: path,
  );
  _validateOptionalScenarioLabelSection(
    overlay: overlay,
    scenario: scenario,
    overlaySection: 'resources',
    scenarioSection: 'initial_resources',
    path: path,
    derivedIds: const <String>{'spend_eur', 'billable_minutes'},
  );
}

void _validateOptionalScenarioLabelSection({
  required Map<String, dynamic> overlay,
  required Map<String, dynamic> scenario,
  required String overlaySection,
  required String scenarioSection,
  required String path,
  Set<String> derivedIds = const <String>{},
}) {
  if (!overlay.containsKey(overlaySection)) {
    return;
  }

  final Map<String, dynamic> canonical = _object(
    scenario[scenarioSection] ?? <String, dynamic>{},
    'scenario.$scenarioSection',
  );
  final Map<String, dynamic> labels = _object(
    overlay[overlaySection],
    '$path.$overlaySection',
  );
  final Set<String> canonicalIds = canonical.keys.toSet();
  if (canonicalIds.isNotEmpty) {
    canonicalIds.addAll(derivedIds);
  }
  final Set<String> translatedIds = labels.keys.toSet();
  final Set<String> missing = canonicalIds.difference(translatedIds);
  final Set<String> unknown = translatedIds.difference(canonicalIds);
  if (missing.isNotEmpty || unknown.isNotEmpty) {
    throw FormatException(
      '$path.$overlaySection stable IDs differ: '
      'missing=${missing.toList()..sort()}, '
      'unknown=${unknown.toList()..sort()}',
    );
  }

  for (final MapEntry<String, dynamic> item in labels.entries) {
    final Map<String, dynamic> label = _object(
      item.value,
      '$path.$overlaySection.${item.key}',
    );
    _requireString(label, 'label');
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

class _ScenarioFingerprintPin {
  const _ScenarioFingerprintPin({
    required this.scenarioFile,
    required this.declaredFingerprint,
  });

  final String scenarioFile;
  final String declaredFingerprint;
}
