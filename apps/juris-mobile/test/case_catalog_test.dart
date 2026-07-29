import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:juris_mobile/app/juris_app.dart';
import 'package:juris_mobile/data/case_catalog_repository.dart';
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
      ),
    );
    await tester.pumpAndSettle();
  }

  test('generated mobile bundle contains multiple stable case IDs', () async {
    final dynamic decoded = jsonDecode(generatedBundle);
    final CaseCatalogBundle bundle = CaseCatalogBundle.fromJson(
      decoded as Map<String, dynamic>,
    );

    expect(bundle.cases, hasLength(3));
    expect(
      bundle.cases.map((MobileCaseDefinition item) => item.caseId),
      containsAll(<String>[
        'be_commercial_failed_erp_001',
        'be_commercial_logistics_001',
        'greenfire_first_72_hours',
      ]),
    );
    expect(bundle.supportedLocales, containsAll(<String>['en', 'ru']));

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

    final MobileCaseDefinition greenfire = bundle.cases.singleWhere(
      (MobileCaseDefinition item) => item.caseId == 'greenfire_first_72_hours',
    );
    expect(greenfire.status, MobileCaseStatus.playable);
    expect(greenfire.scenarioAvailable, isTrue);
    expect(greenfire.scenario, isNotNull);
    expect(greenfire.scenario?['actions'], hasLength(14));
    expect(greenfire.readiness.diagnostics, isTrue);
    expect(greenfire.readiness.pathSimulation, isTrue);
    expect(greenfire.readiness.engineRuntime, isTrue);
    expect(greenfire.runtimeAdapter, 'rust_scenario_v1');
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
  });

  testWidgets('playable case opens demo and returns to library', (
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
