import 'dart:convert';

import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:juris_mobile/living_case/living_case_visual_manifest.dart';
import 'package:juris_mobile/living_case/living_case_visual_manifest_repository.dart';

const String _asset =
    'assets/visual_identity/living_case_visual_manifest.v1.json';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  late String encoded;

  setUpAll(() async => encoded = await rootBundle.loadString(_asset));

  test('production manifest pins only the explicit presentation identities',
      () {
    final LivingCaseVisualManifest manifest =
        LivingCaseVisualManifest.fromJson(_decode(encoded));

    expect(manifest.schemaVersion, 1);
    expect(manifest.caseId, 'greenfire_first_72_hours');
    expect(manifest.pressure.pressureId, 'regulator_document_request_pressure');
    expect(manifest.pressure.sourceActorId, 'port_haven_environment_authority');
    expect(manifest.pressure.requestInboxItemId, 'regulator_document_request');
    expect(
        manifest.pressure.deadlineId, 'initial_regulatory_response_deadline');
    expect(
      manifest.responseTreatment('submit_initial_regulatory_response'),
      LivingCaseResponseTreatment.controlled,
    );
    expect(
      manifest.responseTreatment('release_unreviewed_documents'),
      LivingCaseResponseTreatment.disclosedRisk,
    );
    expect(
      manifest.outcomeTreatment('protected_crisis_position'),
      LivingCaseOutcomeTreatment.protected,
    );
    expect(manifest.responseTreatment('future_action'), isNull);
    expect(manifest.outcomeTreatment('future_outcome'), isNull);
    expect(manifest.supportsCase('unknown_case'), isFalse);
  });

  test('maps are immutable', () {
    final LivingCaseVisualManifest manifest =
        LivingCaseVisualManifest.fromJson(_decode(encoded));
    expect(
      () => manifest.pressure.responses['future'] =
          LivingCaseResponseTreatment.controlled,
      throwsUnsupportedError,
    );
    expect(
      () => manifest.outcomes['future'] = LivingCaseOutcomeTreatment.protected,
      throwsUnsupportedError,
    );
  });

  test('strict parser rejects unknown keys, IDs, duplicates, and treatments',
      () {
    _reject(encoded, (Map<String, dynamic> json) => json['gameplay'] = true);
    _reject(encoded, (Map<String, dynamic> json) => json['schema_version'] = 2);
    _reject(
        encoded,
        (Map<String, dynamic> json) =>
            json['case_id'] = 'GreenFire display name');
    _reject(encoded, (Map<String, dynamic> json) {
      final Map<String, dynamic> pressure = json['pressure'];
      pressure['responses'].add(
        jsonDecode(jsonEncode(pressure['responses'][0])),
      );
    });
    _reject(encoded, (Map<String, dynamic> json) {
      final Map<String, dynamic> pressure = json['pressure'];
      pressure['responses'][0]['treatment'] = 'safe';
    });
    _reject(encoded, (Map<String, dynamic> json) {
      final List<dynamic> outcomes = json['outcomes'];
      outcomes[1]['treatment'] = 'protected';
    });
  });

  test('repository caches success and disables the feature on any error',
      () async {
    int loads = 0;
    final LivingCaseVisualManifestRepository repository =
        LivingCaseVisualManifestRepository(
      assetLoader: (_) async {
        loads += 1;
        return encoded;
      },
    );
    expect(await repository.load(), isNotNull);
    expect(await repository.load(), isNotNull);
    expect(loads, 1);

    final List<Object> diagnostics = <Object>[];
    final LivingCaseVisualManifest? disabled =
        await LivingCaseVisualManifestRepository(
      assetLoader: (_) async => '{"schema_version":2}',
      onDiagnostic: (Object error, StackTrace _) => diagnostics.add(error),
    ).load();
    expect(disabled, isNull);
    expect(diagnostics, hasLength(1));
  });
}

Map<String, dynamic> _decode(String value) =>
    jsonDecode(value) as Map<String, dynamic>;

void _reject(
  String source,
  void Function(Map<String, dynamic> json) mutate,
) {
  final Map<String, dynamic> json = _decode(source);
  mutate(json);
  expect(() => LivingCaseVisualManifest.fromJson(json), throwsFormatException);
}
