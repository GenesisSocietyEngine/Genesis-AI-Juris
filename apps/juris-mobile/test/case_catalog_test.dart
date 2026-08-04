import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:juris_mobile/app/juris_app.dart';
import 'package:juris_mobile/data/case_catalog_repository.dart';
import 'package:juris_mobile/data/case_runtime_factory.dart';
import 'package:juris_mobile/data/scenario_bridge_client.dart';
import 'package:juris_mobile/models/case_catalog.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  late String generatedBundle;

  setUpAll(() async {
    generatedBundle = await rootBundle.loadString(
      'assets/case_catalog/mobile_case_bundle.json',
    );
  });

  Future<void> pumpCatalog(WidgetTester tester) async {
    await tester.pumpWidget(
      JurisApp.catalog(
        catalogRepository: CaseCatalogRepository(
          assetLoader: (_) async => generatedBundle,
        ),
        scenarioBridgeClient: _CatalogScenarioBridgeClient(),
      ),
    );
    await tester.pumpAndSettle();
  }

  test('generated mobile bundle contains multiple stable case IDs', () async {
    final dynamic decoded = jsonDecode(generatedBundle);
    final CaseCatalogBundle bundle = CaseCatalogBundle.fromJson(
      decoded as Map<String, dynamic>,
    );

    expect(bundle.bundleVersion, 4);
    expect(bundle.cases, hasLength(4));
    expect(
      bundle.cases.map((MobileCaseDefinition item) => item.caseId),
      containsAll(<String>[
        'be_commercial_failed_erp_001',
        'be_commercial_logistics_001',
        'greenfire_first_72_hours',
        'nl_food_safety_goldenshell_001',
      ]),
    );
    expect(
      bundle.cases.map((MobileCaseDefinition item) => item.scenarioId),
      isNot(contains('integration_adverse_judgment_with_remedies')),
      reason: 'The lifecycle/dossier fixture is debug-only Android content.',
    );
    expect(
      generatedBundle,
      isNot(contains('integration_adverse_judgment_with_remedies')),
    );
    expect(bundle.supportedLocales, containsAll(<String>['en', 'ru']));

    final MobileCaseDefinition failedErp = bundle.cases.first;
    expect(failedErp.caseId, 'be_commercial_failed_erp_001');
    expect(failedErp.scenarioId, 'be_commercial_failed_erp_001');
    expect(failedErp.sortOrder, 10);
    expect(failedErp.playerClientId, 'asteron_systems');
    expect(failedErp.playerRole, 'claimant');
    expect(
        failedErp.localized('en', 'en').playerClientName, 'Asteron Systems NV');
    expect(failedErp.status, MobileCaseStatus.playable);
    expect(failedErp.scenarioAvailable, isTrue);
    expect(failedErp.scenario, isNotNull);
    expect(
      (failedErp.scenario?['metadata'] as Map<String, dynamic>)['id'],
      'be_commercial_failed_erp_001',
    );
    expect(failedErp.readiness.scenarioDefinition, isTrue);
    expect(failedErp.readiness.diagnostics, isTrue);
    expect(failedErp.readiness.pathSimulation, isTrue);
    expect(failedErp.readiness.engineRuntime, isTrue);
    expect(failedErp.runtimeAdapter, CaseRuntimeFactory.rustScenarioAdapter);
    expect(CaseRuntimeFactory.supports(failedErp), isTrue);
    expect(failedErp.scenarioLocalizations.keys,
        containsAll(<String>['en', 'ru']));
    for (final String locale in <String>['en', 'ru']) {
      expect(
        failedErp.scenarioLocalizations[locale],
        allOf(contains('metrics'), contains('resources')),
        reason: '$locale gameplay must label Rust-owned metrics and resources',
      );
    }

    final MobileCaseDefinition logistics = bundle.cases.singleWhere(
      (MobileCaseDefinition item) =>
          item.caseId == 'be_commercial_logistics_001',
    );
    expect(logistics.status, MobileCaseStatus.playable);
    expect(logistics.scenarioAvailable, isTrue);
    expect(logistics.scenario, isNotNull);
    expect(logistics.readiness.scenarioDefinition, isTrue);
    expect(logistics.readiness.diagnostics, isTrue);
    expect(logistics.readiness.pathSimulation, isTrue);
    expect(logistics.readiness.engineRuntime, isTrue);
    expect(logistics.runtimeAdapter, 'rust_scenario_v1');
    expect(logistics.scenario?['clock'], isNull);

    final MobileCaseDefinition greenfire = bundle.cases.singleWhere(
      (MobileCaseDefinition item) => item.caseId == 'greenfire_first_72_hours',
    );
    expect(greenfire.status, MobileCaseStatus.playable);
    expect(greenfire.scenarioAvailable, isTrue);
    expect(greenfire.scenario, isNotNull);
    expect(greenfire.scenario?['actions'], hasLength(13));
    expect(greenfire.scenario?['clock'], <String, dynamic>{
      'mode': 'foreground',
    });
    expect(greenfire.readiness.diagnostics, isTrue);
    expect(greenfire.readiness.pathSimulation, isTrue);
    expect(greenfire.readiness.engineRuntime, isTrue);
    expect(greenfire.runtimeAdapter, 'rust_scenario_v1');
    expect(greenfire.scenarioLocalizations, contains('ru'));

    final MobileCaseDefinition goldenshell = bundle.cases.singleWhere(
      (MobileCaseDefinition item) =>
          item.caseId == 'nl_food_safety_goldenshell_001',
    );
    expect(goldenshell.status, MobileCaseStatus.playable);
    expect(goldenshell.scenarioId, 'goldenshell_recall_at_dawn');
    expect(goldenshell.scenarioAvailable, isTrue);
    expect(goldenshell.scenario, isNotNull);
    expect(goldenshell.scenario?['actions'], hasLength(17));
    expect(goldenshell.scenario?['clock'], <String, dynamic>{
      'mode': 'foreground',
    });
    expect(goldenshell.readiness.diagnostics, isTrue);
    expect(goldenshell.readiness.pathSimulation, isTrue);
    expect(goldenshell.readiness.engineRuntime, isTrue);
    expect(goldenshell.runtimeAdapter, 'rust_scenario_v1');
    expect(goldenshell.scenarioLocalizations, contains('ru'));
    expect(
      (goldenshell.scenario?['actions'] as List<dynamic>).every(
        (dynamic action) =>
            (action as Map<String, dynamic>)['cost_eur'] is int &&
            (action['cost_eur'] as int) > 0,
      ),
      isTrue,
    );
  });

  test('Failed ERP EN and RU overlays preserve canonical authority', () {
    final CaseCatalogBundle bundle = CaseCatalogBundle.fromJson(
      jsonDecode(generatedBundle) as Map<String, dynamic>,
    );
    final MobileCaseDefinition failedErp = bundle.cases.singleWhere(
      (MobileCaseDefinition item) =>
          item.caseId == 'be_commercial_failed_erp_001',
    );
    final Map<String, dynamic> scenario = failedErp.scenario!;
    final String canonicalBeforeLocalization = jsonEncode(scenario);

    const List<String> entitySections = <String>[
      'stages',
      'actions',
      'deadlines',
      'inbox_items',
      'facts',
      'evidence',
      'outcomes',
    ];
    for (final String locale in <String>['en', 'ru']) {
      final Map<String, dynamic> overlay =
          failedErp.scenarioLocalizations[locale]!;
      for (final String section in entitySections) {
        final Set<String> canonicalIds =
            (scenario[section] as List<dynamic>).map((dynamic item) {
          return (item as Map<String, dynamic>)['id'] as String;
        }).toSet();
        expect(
          (overlay[section] as Map<String, dynamic>).keys.toSet(),
          canonicalIds,
          reason: '$locale.$section must have exact canonical stable IDs',
        );
      }

      expect(
        (overlay['metrics'] as Map<String, dynamic>).keys.toSet(),
        (scenario['numeric_metrics'] as Map<String, dynamic>).keys.toSet(),
      );
      expect(
        (overlay['resources'] as Map<String, dynamic>).keys.toSet(),
        <String>{
          ...(scenario['initial_resources'] as Map<String, dynamic>).keys,
          'spend_eur',
          'billable_minutes',
        },
      );
    }

    final Map<String, dynamic> english = failedErp.scenarioLocalizations['en']!;
    final Map<String, List<String>> canonicalTextFields =
        <String, List<String>>{
      'stages': <String>['title'],
      'actions': <String>['title', 'description'],
      'deadlines': <String>['title'],
      'inbox_items': <String>['sender', 'subject', 'body'],
      'facts': <String>['statement'],
      'evidence': <String>['title', 'description'],
      'outcomes': <String>['title', 'summary'],
    };
    for (final MapEntry<String, List<String>> section
        in canonicalTextFields.entries) {
      final Map<String, dynamic> overlaySection =
          english[section.key] as Map<String, dynamic>;
      for (final dynamic rawItem in scenario[section.key] as List<dynamic>) {
        final Map<String, dynamic> item = rawItem as Map<String, dynamic>;
        final Map<String, dynamic> localized =
            overlaySection[item['id']] as Map<String, dynamic>;
        for (final String field in section.value) {
          expect(
            localized[field],
            item[field],
            reason: 'EN ${section.key}.${item['id']}.$field must be canonical',
          );
        }
      }
    }
    expect(
      english['metadata'],
      <String, dynamic>{
        'title': (scenario['metadata'] as Map<String, dynamic>)['title'],
        'summary': (scenario['metadata'] as Map<String, dynamic>)['summary'],
      },
    );

    for (final String locale in <String>['en', 'ru']) {
      failedErp.scenarioText(
        locale: locale,
        section: 'metadata',
        field: 'title',
        fallback: 'fallback',
      );
    }
    expect(
      jsonEncode(scenario),
      canonicalBeforeLocalization,
      reason: 'locale overlays cannot alter scenario fingerprint input',
    );
  });

  test('factory rejects the retired Failed ERP demo adapter', () {
    final Map<String, dynamic> decoded =
        jsonDecode(generatedBundle) as Map<String, dynamic>;
    final Map<String, dynamic> retiredCase = Map<String, dynamic>.from(
        (decoded['cases'] as List<dynamic>).first as Map<String, dynamic>)
      ..['runtime_adapter'] = 'demo_failed_erp';
    final MobileCaseDefinition definition =
        MobileCaseDefinition.fromJson(retiredCase);

    expect(CaseRuntimeFactory.supports(definition), isFalse);
    expect(
      () => CaseRuntimeFactory.create(definition),
      throwsA(isA<StateError>()),
    );
  });

  testWidgets('case library renders all catalog scenarios', (
    WidgetTester tester,
  ) async {
    await pumpCatalog(tester);

    expect(
      find.text('Asteron Systems NV v. Northbridge Consulting BV'),
      findsOneWidget,
    );
    expect(find.text('Playable demo'), findsWidgets);

    await tester.drag(
      find.byKey(const PageStorageKey<String>('case-catalog')),
      const Offset(0, -550),
    );
    await tester.pumpAndSettle();

    expect(
      find.text('Velmont Logistics SA v. Orbis Retail Belgium NV'),
      findsOneWidget,
    );
    expect(find.text('Playable demo'), findsWidgets);

    await tester.drag(
      find.byKey(const PageStorageKey<String>('case-catalog')),
      const Offset(0, -550),
    );
    await tester.pumpAndSettle();

    expect(
      find.text(
        'Port Haven Environmental Authority v. GreenFire Industrial Solutions B.V.',
      ),
      findsOneWidget,
    );

    await tester.drag(
      find.byKey(const PageStorageKey<String>('case-catalog')),
      const Offset(0, -550),
    );
    await tester.pumpAndSettle();

    expect(
      find.text(
        'GoldenShell Producers Cooperative U.A. v. MiteGuard Services V.O.F.',
      ),
      findsOneWidget,
    );
    expect(find.text('Contaminated Egg Supply Chain'), findsOneWidget);
  });

  testWidgets(
      'language switch localizes case text without changing stable names', (
    WidgetTester tester,
  ) async {
    await pumpCatalog(tester);

    await tester.tap(find.byIcon(Icons.language));
    await tester.pumpAndSettle();
    await tester.tap(find.text('RU'));
    await tester.pumpAndSettle();

    expect(find.text('Библиотека дел'), findsWidgets);
    expect(find.text('Неудачное внедрение ERP'), findsOneWidget);
    expect(
      find.text('Asteron Systems NV v. Northbridge Consulting BV'),
      findsOneWidget,
    );

    for (int index = 0; index < 3; index += 1) {
      await tester.drag(
        find.byKey(const PageStorageKey<String>('case-catalog')),
        const Offset(0, -550),
      );
      await tester.pumpAndSettle();
    }

    expect(find.text('Загрязнение цепочки поставок яиц'), findsOneWidget);
    expect(
      find.text(
        'GoldenShell Producers Cooperative U.A. v. MiteGuard Services V.O.F.',
      ),
      findsOneWidget,
    );
  });

  testWidgets('playable Rust case opens and returns to library', (
    WidgetTester tester,
  ) async {
    await pumpCatalog(tester);

    final Finder startButtons = find.widgetWithText(FilledButton, 'Start case');
    await tester.ensureVisible(startButtons.first);
    await tester.pumpAndSettle();
    await tester.tap(startButtons.first);
    await tester.pumpAndSettle();

    expect(
        find.text('Urgent: ERP supplier termination notice'), findsOneWidget);
    expect(find.byTooltip('Back to case library'), findsOneWidget);

    await tester.tap(find.byTooltip('Back to case library'));
    await tester.pumpAndSettle();

    expect(find.text('Case Library'), findsWidgets);
    expect(
      find.text('Asteron Systems NV v. Northbridge Consulting BV'),
      findsOneWidget,
    );
  });

  testWidgets('playable filter includes the Rust logistics scenario', (
    WidgetTester tester,
  ) async {
    await pumpCatalog(tester);

    await tester.tap(find.text('Playable'));
    await tester.pumpAndSettle();

    await tester.drag(
      find.byKey(const PageStorageKey<String>('case-catalog')),
      const Offset(0, -550),
    );
    await tester.pumpAndSettle();

    expect(
      find.text('Velmont Logistics SA v. Orbis Retail Belgium NV'),
      findsOneWidget,
    );
    final FilledButton logisticsStart = tester.widget<FilledButton>(
      find.widgetWithText(FilledButton, 'Start case').last,
    );
    expect(logisticsStart.onPressed, isNotNull);
  });

  test('repository supports an injected deterministic bundle', () async {
    const String encoded = '''
{
  "bundle_version": 1,
  "catalog_version": 1,
  "default_locale": "en",
  "supported_locales": ["en"],
  "fictional_notice": {
    "en": "Fictional."
  },
  "ui": {
    "en": {
      "library_title": "Injected library"
    }
  },
  "cases": [
    {
      "case_id": "test_case_001",
      "scenario_id": "test_scenario_001",
      "sort_order": 1,
      "seed": 7,
      "status": "outline",
      "difficulty": "introductory",
      "jurisdiction": "BE",
      "practice_area": "commercial_litigation",
      "player_client_id": "test_claimant",
      "player_role": "claimant",
      "identity_file": "content/catalog/cases/test.identity.json",
      "scenario_file": null,
      "scenario_available": false,
      "runtime_adapter": null,
      "readiness": {
        "identity": true,
        "scenario_definition": false,
        "diagnostics": false,
        "path_simulation": false,
        "engine_runtime": false,
        "mobile_bundle": true
      },
      "localizations": {
        "en": {
          "caption": "Test Claimant v. Test Defendant",
          "topic": "Test dispute",
          "short_title": "Test",
          "synopsis": "A deterministic injected case.",
          "player_client_name": "Test Claimant",
          "player_client_role": "Director",
          "legal_issues": ["contract"]
        }
      }
    }
  ]
}
''';
    String? requestedPath;
    final CaseCatalogRepository repository = CaseCatalogRepository(
      assetPath: 'injected.json',
      assetLoader: (String assetPath) async {
        requestedPath = assetPath;
        return encoded;
      },
    );

    final CaseCatalogBundle bundle = await repository.load();

    expect(requestedPath, 'injected.json');
    expect(bundle.cases, hasLength(1));
    expect(bundle.cases.single.caseId, 'test_case_001');
    expect(bundle.cases.single.scenarioId, 'test_scenario_001');
    expect(bundle.cases.single.scenarioAvailable, isFalse);
  });
}

final class _CatalogScenarioBridgeClient implements ScenarioBridgeClient {
  int _nextSessionId = 0;

  @override
  String execute(String encodedRequest) {
    final Map<String, dynamic> request =
        jsonDecode(encodedRequest) as Map<String, dynamic>;
    if (request['command'] == 'dispose_session') {
      return jsonEncode(<String, dynamic>{
        'type': 'session_disposed',
        'session_id': request['session_id'],
      });
    }
    if (request['command'] != 'create_session') {
      return jsonEncode(<String, dynamic>{
        'type': 'error',
        'code': 'unsupported_test_command',
        'message': 'The catalog test bridge only creates sessions.',
      });
    }

    final Map<String, dynamic> scenario =
        request['scenario'] as Map<String, dynamic>;
    final List<dynamic> stages = scenario['stages'] as List<dynamic>;
    final String initialStage = scenario['initial_stage'] as String;
    final Map<String, dynamic> stage = stages
        .cast<Map<String, dynamic>>()
        .singleWhere((Map<String, dynamic> item) => item['id'] == initialStage);
    final List<dynamic> inboxDefinitions =
        scenario['inbox_items'] as List<dynamic>;
    final Map<String, dynamic>? openingInbox = inboxDefinitions.isEmpty
        ? null
        : inboxDefinitions.first as Map<String, dynamic>;
    final Map<String, dynamic> metadata =
        scenario['metadata'] as Map<String, dynamic>;
    _nextSessionId += 1;
    return jsonEncode(<String, dynamic>{
      'type': 'session_created',
      'session_id': _nextSessionId,
      'snapshot': <String, dynamic>{
        'snapshot_schema_version': 1,
        'scenario_id': metadata['id'],
        'seed': request['seed'],
        // Runtime snapshots expose elapsed monotonic minutes. `initial_clock`
        // is only the civil-time baseline used to resolve authored targets.
        'clock_minutes': 0,
        'clock_mode': 'manual',
        'stage_id': initialStage,
        'stage_title': stage['title'],
        'terminal': false,
        'is_closed': false,
        'matter_lifecycle': 'active',
        'judicial_result': null,
        'judicial_decision_instance': null,
        'facts': const <dynamic>[],
        'evidence': const <dynamic>[],
        'available_actions': const <dynamic>[],
        'deadlines': const <dynamic>[],
        'inbox': openingInbox == null
            ? const <dynamic>[]
            : <dynamic>[
                <String, dynamic>{
                  'id': openingInbox['id'],
                  'subject': openingInbox['subject'],
                  'body': openingInbox['body'],
                  'visible': true,
                  'resolved': false,
                  'action_required': true,
                },
              ],
        'outcome': null,
        'numeric_metrics': scenario['numeric_metrics'],
        'resources': scenario['initial_resources'],
      },
    });
  }
}
