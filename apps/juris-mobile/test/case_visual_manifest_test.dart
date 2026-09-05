import 'dart:async';
import 'dart:convert';

import 'package:crypto/crypto.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:juris_mobile/visual_identity/case_visual_manifest.dart';
import 'package:juris_mobile/visual_identity/case_visual_manifest_repository.dart';

const String _manifestAsset =
    'assets/visual_identity/case_visual_manifest.v1.json';
const String _caseBundleAsset = 'assets/case_catalog/mobile_case_bundle.json';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  late String encodedManifest;

  setUpAll(() async {
    encodedManifest = await rootBundle.loadString(_manifestAsset);
  });

  test(
    'production asset has the exact default and five current treatments',
    () async {
      final List<Object> diagnostics = <Object>[];
      final CaseVisualManifest manifest = await CaseVisualManifestRepository(
        onDiagnostic: (Object error, StackTrace _) => diagnostics.add(error),
      ).load();

      expect(diagnostics, isEmpty);
      expect(manifest.schemaVersion, 1);
      expect(
        manifest.defaultTreatment,
        CaseVisualManifest.builtInDefaultTreatment,
      );
      expect(manifest.caseTreatments, const <String, CaseVisualTreatment>{
        'be_commercial_failed_erp_001': CaseVisualTreatment(
          motif: CaseVisualMotif.systemsGrid,
          palette: CaseVisualPalette(
            background: Color(0xFF07131F),
            surface: Color(0xFF102639),
            accent: Color(0xFF57B7D9),
            signal: Color(0xFFD6A84F),
          ),
          artSeed: 19996,
        ),
        'be_commercial_logistics_001': CaseVisualTreatment(
          motif: CaseVisualMotif.freightRoutes,
          palette: CaseVisualPalette(
            background: Color(0xFF07161B),
            surface: Color(0xFF0E2A30),
            accent: Color(0xFF3FA7A1),
            signal: Color(0xFFC7A35B),
          ),
          artSeed: 40872,
        ),
        'greenfire_first_72_hours': CaseVisualTreatment(
          motif: CaseVisualMotif.industrialHaze,
          palette: CaseVisualPalette(
            background: Color(0xFF0A1714),
            surface: Color(0xFF172A22),
            accent: Color(0xFF7A9F55),
            signal: Color(0xFFD8763E),
          ),
          artSeed: 38495,
        ),
        'nl_food_safety_goldenshell_001': CaseVisualTreatment(
          motif: CaseVisualMotif.supplyChain,
          palette: CaseVisualPalette(
            background: Color(0xFF17140B),
            surface: Color(0xFF2A2412),
            accent: Color(0xFFC69A43),
            signal: Color(0xFFA94A42),
          ),
          artSeed: 11766,
        ),
        'us_environmental_desert_water_001': CaseVisualTreatment(
          motif: CaseVisualMotif.aquiferContours,
          palette: CaseVisualPalette(
            background: Color(0xFF071820),
            surface: Color(0xFF102C34),
            accent: Color(0xFF48B6C6),
            signal: Color(0xFFD1A15D),
          ),
          artSeed: 7176,
        ),
      });
    },
  );

  test(
    'manifest keys equal current case IDs and expose no retained content',
    () async {
      final Map<String, dynamic> manifestJson = _decode(encodedManifest);
      final Map<String, dynamic> bundleJson = _decode(
        await rootBundle.loadString(_caseBundleAsset),
      );
      final CaseVisualManifest manifest = CaseVisualManifest.fromJson(
        manifestJson,
      );
      final List<String> currentCaseIds =
          (bundleJson['cases'] as List<dynamic>).map((dynamic rawCase) {
        return (rawCase as Map<String, dynamic>)['case_id'] as String;
      }).toList(growable: false);

      expect(manifest.caseTreatments.keys, orderedEquals(currentCaseIds));
      expect(manifest.caseTreatments, hasLength(5));
      expect(bundleJson['load_only_scenarios'], hasLength(1));
      expect(manifestJson.keys.toSet(), <String>{
        'schema_version',
        'default_treatment',
        'case_treatments',
      });
      expect(encodedManifest, isNot(contains('scenario_id')));
      expect(encodedManifest, isNot(contains('content_version')));
      expect(encodedManifest, isNot(contains('fingerprint')));
      expect(encodedManifest, isNot(contains('load_only')));
    },
  );

  test('missing and future case IDs resolve to the immutable safe default', () {
    final CaseVisualManifest manifest = CaseVisualManifest.fromJson(
      _decode(encodedManifest),
    );

    expect(
      manifest.resolve('unknown_future_case'),
      CaseVisualManifest.builtInDefaultTreatment,
    );
    expect(
      CaseVisualManifest.safeFallback.resolve('anything'),
      CaseVisualManifest.builtInDefaultTreatment,
    );
    expect(CaseVisualManifest.safeFallback.caseTreatments, isEmpty);
    expect(
      () => manifest.caseTreatments['new_case'] =
          CaseVisualManifest.builtInDefaultTreatment,
      throwsUnsupportedError,
    );
  });

  test('manifest equality and hash are immutable and order-independent', () {
    final Map<String, dynamic> forwardJson = _decode(encodedManifest);
    final Map<String, dynamic> reverseJson = _decode(encodedManifest);
    reverseJson['case_treatments'] =
        (reverseJson['case_treatments'] as List<dynamic>).reversed.toList();

    final CaseVisualManifest forward = CaseVisualManifest.fromJson(forwardJson);
    final CaseVisualManifest reverse = CaseVisualManifest.fromJson(reverseJson);

    expect(reverse, forward);
    expect(reverse.hashCode, forward.hashCode);
    expect(
      forward.resolve('greenfire_first_72_hours'),
      reverse.resolve('greenfire_first_72_hours'),
    );
  });

  test('seed boundaries are accepted', () {
    final Map<String, dynamic> json = _decode(encodedManifest);
    _defaultTreatment(json)['art_seed'] = 0;
    _caseTreatment(json)['art_seed'] = 65535;

    final CaseVisualManifest manifest = CaseVisualManifest.fromJson(json);

    expect(manifest.defaultTreatment.artSeed, 0);
    expect(manifest.caseTreatments.values.first.artSeed, 65535);
  });

  group('strict exact-key parser', () {
    test('rejects unknown and missing root keys', () {
      _expectRejected(encodedManifest, (Map<String, dynamic> json) {
        json['scenario_id'] = 'forbidden';
      });
      _expectRejected(encodedManifest, (Map<String, dynamic> json) {
        json.remove('default_treatment');
      });
    });

    test('rejects non-integer and unknown schema versions', () {
      for (final Object version in <Object>[1.0, 2, '1']) {
        _expectRejected(encodedManifest, (Map<String, dynamic> json) {
          json['schema_version'] = version;
        });
      }
    });

    test('reserves institutional_grid for the safe default', () {
      _expectRejected(encodedManifest, (Map<String, dynamic> json) {
        _defaultTreatment(json)['motif'] = 'systems_grid';
      });
      _expectRejected(encodedManifest, (Map<String, dynamic> json) {
        _caseTreatment(json)['motif'] = 'institutional_grid';
      });
    });

    test(
      'rejects unknown or missing treatment keys including gameplay data',
      () {
        _expectRejected(encodedManifest, (Map<String, dynamic> json) {
          _defaultTreatment(json)['composition'] = <String, dynamic>{};
        });
        for (final String forbiddenField in <String>[
          'gameplay',
          'localization',
          'scenario_id',
          'scenario_fingerprint',
          'pressure_windows',
          'readiness',
          'outcome',
          'action_id',
          'deadline_id',
          'evidence',
          'fact',
          'resource',
          'cost',
          'score',
        ]) {
          _expectRejected(encodedManifest, (Map<String, dynamic> json) {
            _caseTreatment(json)[forbiddenField] = null;
          });
        }
        _expectRejected(encodedManifest, (Map<String, dynamic> json) {
          _caseTreatment(json).remove('palette');
        });
      },
    );

    test('rejects duplicate, empty, whitespace, and untrimmed case IDs', () {
      _expectRejected(encodedManifest, (Map<String, dynamic> json) {
        final List<dynamic> treatments =
            json['case_treatments'] as List<dynamic>;
        treatments.add(
          jsonDecode(jsonEncode(treatments.first)) as Map<String, dynamic>,
        );
      });
      for (final String caseId in <String>['', '   ', ' case_id']) {
        _expectRejected(encodedManifest, (Map<String, dynamic> json) {
          _caseTreatment(json)['case_id'] = caseId;
        });
      }
    });

    test('rejects unknown motifs', () {
      _expectRejected(encodedManifest, (Map<String, dynamic> json) {
        _caseTreatment(json)['motif'] = 'official_seal';
      });
    });

    test(
      'rejects unknown, missing, malformed, and non-opaque palette values',
      () {
        _expectRejected(encodedManifest, (Map<String, dynamic> json) {
          _palette(_caseTreatment(json))['glow'] = '#FFFFFF';
        });
        _expectRejected(encodedManifest, (Map<String, dynamic> json) {
          _palette(_caseTreatment(json)).remove('signal');
        });
        for (final Object colour in <Object>[
          '#12345',
          '#FF123456',
          '123456',
          '#GGGGGG',
          0xFF123456,
        ]) {
          _expectRejected(encodedManifest, (Map<String, dynamic> json) {
            _palette(_caseTreatment(json))['accent'] = colour;
          });
        }
      },
    );

    test('rejects non-integral and out-of-range seeds', () {
      for (final Object seed in <Object>[-1, 65536, 1.5, '7']) {
        _expectRejected(encodedManifest, (Map<String, dynamic> json) {
          _caseTreatment(json)['art_seed'] = seed;
        });
      }
    });

    test('rejects wrong object and array shapes', () {
      _expectRejected(encodedManifest, (Map<String, dynamic> json) {
        json['default_treatment'] = <dynamic>[];
      });
      _expectRejected(encodedManifest, (Map<String, dynamic> json) {
        json['case_treatments'] = <String, dynamic>{};
      });
      _expectRejected(encodedManifest, (Map<String, dynamic> json) {
        (json['case_treatments'] as List<dynamic>)[0] = null;
      });
      _expectRejected(encodedManifest, (Map<String, dynamic> json) {
        _caseTreatment(json)['palette'] = <dynamic>[];
      });
    });
  });

  test(
    'repository loads once and returns one cached successful future',
    () async {
      int loadCount = 0;
      String? requestedPath;
      final CaseVisualManifestRepository repository =
          CaseVisualManifestRepository(
        assetPath: 'injected-manifest.json',
        assetLoader: (String path) async {
          loadCount += 1;
          requestedPath = path;
          return encodedManifest;
        },
      );

      final Future<CaseVisualManifest> first = repository.load();
      final Future<CaseVisualManifest> second = repository.load();

      expect(identical(first, second), isTrue);
      final CaseVisualManifest loaded = await first;
      expect(await second, same(loaded));
      expect(await repository.load(), same(loaded));
      expect(requestedPath, 'injected-manifest.json');
      expect(loadCount, 1);
    },
  );

  test('concurrent corrupt load caches fallback and one diagnostic', () async {
    final Completer<String> source = Completer<String>();
    final List<Object> diagnostics = <Object>[];
    int loadCount = 0;
    final CaseVisualManifestRepository repository =
        CaseVisualManifestRepository(
      assetLoader: (_) {
        loadCount += 1;
        return source.future;
      },
      onDiagnostic: (Object error, StackTrace _) => diagnostics.add(error),
    );

    final Future<CaseVisualManifest> first = repository.load();
    final Future<CaseVisualManifest> second = repository.load();
    expect(identical(first, second), isTrue);
    expect(loadCount, 1);

    source.complete('{corrupt json');
    final List<CaseVisualManifest> results = await Future.wait(
      <Future<CaseVisualManifest>>[first, second],
    );

    expect(results, everyElement(same(CaseVisualManifest.safeFallback)));
    expect(await repository.load(), same(CaseVisualManifest.safeFallback));
    expect(loadCount, 1);
    expect(diagnostics, hasLength(1));
    expect(diagnostics.single, isA<FormatException>());
  });

  test(
    'missing asset and a failing diagnostic still return safe fallback',
    () async {
      final CaseVisualManifestRepository repository =
          CaseVisualManifestRepository(
        assetLoader: (_) async => throw StateError('missing asset'),
        onDiagnostic: (_, __) => throw StateError('broken diagnostic'),
      );

      expect(await repository.load(), same(CaseVisualManifest.safeFallback));
    },
  );

  test('authoritative case bundle baseline remains byte exact', () async {
    final ByteData data = await rootBundle.load(_caseBundleAsset);
    final Uint8List bytes = data.buffer.asUint8List(
      data.offsetInBytes,
      data.lengthInBytes,
    );

    expect(bytes, hasLength(684360));
    expect(
      sha256.convert(bytes).toString(),
      '18144245b2eb11345a96d86a18ead0804ceef7d26aa3492ad67c6924ebbbe012',
    );
  });
}

Map<String, dynamic> _decode(String encoded) {
  return jsonDecode(encoded) as Map<String, dynamic>;
}

Map<String, dynamic> _defaultTreatment(Map<String, dynamic> json) {
  return json['default_treatment'] as Map<String, dynamic>;
}

Map<String, dynamic> _caseTreatment(Map<String, dynamic> json) {
  return (json['case_treatments'] as List<dynamic>).first
      as Map<String, dynamic>;
}

Map<String, dynamic> _palette(Map<String, dynamic> treatment) {
  return treatment['palette'] as Map<String, dynamic>;
}

void _expectRejected(
  String encoded,
  void Function(Map<String, dynamic> json) mutate,
) {
  final Map<String, dynamic> json = _decode(encoded);
  mutate(json);
  expect(
    () => CaseVisualManifest.fromJson(json),
    throwsA(isA<FormatException>()),
  );
}
