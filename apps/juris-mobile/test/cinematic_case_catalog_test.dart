import 'dart:convert';
import 'dart:ui' show SemanticsAction, Tristate;

import 'package:flutter/foundation.dart' show FlutterExceptionHandler;
import 'package:flutter/material.dart';
import 'package:flutter/semantics.dart';
import 'package:flutter/services.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:juris_mobile/app/app_theme.dart';
import 'package:juris_mobile/data/case_catalog_repository.dart';
import 'package:juris_mobile/design/juris_design.dart';
import 'package:juris_mobile/models/case_catalog.dart';
import 'package:juris_mobile/screens/case_catalog_screen.dart';
import 'package:juris_mobile/visual_identity/case_visual_manifest.dart';
import 'package:juris_mobile/visual_identity/case_visual_manifest_repository.dart';

const String _failedErpId = 'be_commercial_failed_erp_001';
const String _logisticsId = 'be_commercial_logistics_001';
const String _greenFireId = 'greenfire_first_72_hours';
const String _goldenShellId = 'nl_food_safety_goldenshell_001';
const String _desertWaterId = 'us_environmental_desert_water_001';
const List<String> _authoritativeCaseIds = <String>[
  _failedErpId,
  _logisticsId,
  _greenFireId,
  _goldenShellId,
  _desertWaterId,
];

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  late String encodedBundle;
  late String encodedManifest;
  late CaseCatalogBundle bundle;
  late CaseVisualManifest manifest;

  setUpAll(() async {
    encodedBundle = await rootBundle.loadString(
      'assets/case_catalog/mobile_case_bundle.json',
    );
    encodedManifest = await rootBundle.loadString(
      'assets/visual_identity/case_visual_manifest.v1.json',
    );
    bundle = CaseCatalogBundle.fromJson(
      jsonDecode(encodedBundle) as Map<String, dynamic>,
    );
    manifest = CaseVisualManifest.fromJson(
      jsonDecode(encodedManifest) as Map<String, dynamic>,
    );
  });

  testWidgets(
    'renders exactly five current cases in order at both sides of breakpoint',
    (WidgetTester tester) async {
      await _pumpCatalogue(
        tester,
        size: const Size(699, 900),
        bundle: bundle,
        manifest: manifest,
        hostKey: const ValueKey<String>('compact-699'),
      );

      _expectExactIndexOrder();
      _expectSelectedCase(bundle, _failedErpId, 'en');

      await _pumpCatalogue(
        tester,
        size: const Size(700, 900),
        bundle: bundle,
        manifest: manifest,
        hostKey: const ValueKey<String>('wide-700'),
      );

      _expectExactIndexOrder();
      _expectSelectedCase(bundle, _failedErpId, 'en');
      expect(bundle.loadOnlyScenarios, hasLength(1));
      expect(
        find.byKey(
          const ValueKey<String>(
            'case-index-item-greenfire_first_72_hours',
          ),
        ),
        findsOneWidget,
        reason: 'The retained load-only version must not create a second item.',
      );
    },
  );

  testWidgets(
    'filters preserve visible selection and reselect deterministically',
    (WidgetTester tester) async {
      await _pumpCatalogue(
        tester,
        size: const Size(412, 915),
        bundle: bundle,
        manifest: manifest,
      );
      await _selectCase(tester, _greenFireId);
      _expectSelectedCase(bundle, _greenFireId, 'en');

      await _scrollCatalogueToTop(tester);
      await tester.tap(
        find.byKey(const ValueKey<String>('catalog-filter-playable')),
      );
      await tester.pumpAndSettle();
      _expectExactIndexOrder();
      _expectSelectedCase(bundle, _greenFireId, 'en');

      await _scrollCatalogueToTop(tester);
      await tester.tap(
        find.byKey(const ValueKey<String>('catalog-filter-authoring')),
      );
      await tester.pumpAndSettle();
      expect(find.text(bundle.text('en', 'no_cases')), findsOneWidget);
      expect(
        find.byKey(const ValueKey<String>('selected-case-panel')),
        findsNothing,
      );
      for (final String caseId in _authoritativeCaseIds) {
        expect(
          find.byKey(ValueKey<String>('case-index-item-$caseId')),
          findsNothing,
        );
      }

      await _scrollCatalogueToTop(tester);
      await tester.tap(
        find.byKey(const ValueKey<String>('catalog-filter-all')),
      );
      await tester.pumpAndSettle();
      _expectExactIndexOrder();
      _expectSelectedCase(bundle, _failedErpId, 'en');
      expect(tester.takeException(), isNull);
    },
  );

  testWidgets(
    'selection survives locale changes and compact-wide resizing',
    (WidgetTester tester) async {
      final List<String> localeChanges = <String>[];
      await _pumpCatalogue(
        tester,
        size: const Size(699, 1000),
        bundle: bundle,
        manifest: manifest,
        onLocaleChanged: localeChanges.add,
      );
      await _selectCase(tester, _goldenShellId);
      _expectSelectedCase(bundle, _goldenShellId, 'en');

      await _chooseLocale(tester, 'ru');
      _expectSelectedCase(bundle, _goldenShellId, 'ru');
      expect(localeChanges, <String>['ru']);

      tester.view.physicalSize = const Size(700, 1000);
      await tester.pumpAndSettle();
      _expectSelectedCase(bundle, _goldenShellId, 'ru');
      _expectExactIndexOrder();
      expect(tester.takeException(), isNull);
    },
  );

  testWidgets(
    'official EN and RU localization and selected semantics stay synchronized',
    (WidgetTester tester) async {
      final SemanticsHandle semantics = tester.ensureSemantics();
      await _pumpCatalogue(
        tester,
        size: const Size(800, 1000),
        bundle: bundle,
        manifest: manifest,
      );

      expect(_materialLocale(tester), 'en');
      _expectSelectedSemantics(tester, _failedErpId, selected: true);
      final SemanticsNode englishStart = tester.getSemantics(
        find.byKey(const ValueKey<String>('start-case-action')),
      );
      expect(
        englishStart.label,
        contains(bundle.cases.first.localized('en', 'en').topic),
      );

      await tester.tap(
        find.byKey(const ValueKey<String>('catalog-language-action')),
      );
      await tester.pumpAndSettle();
      final Finder englishLocale = find.byWidgetPredicate(
        (Widget widget) =>
            widget is CheckedPopupMenuItem<String> && widget.value == 'en',
      );
      final Finder russianLocale = find.byWidgetPredicate(
        (Widget widget) =>
            widget is CheckedPopupMenuItem<String> && widget.value == 'ru',
      );
      expect(
        tester.widget<CheckedPopupMenuItem<String>>(englishLocale).checked,
        isTrue,
      );
      expect(
        tester.widget<CheckedPopupMenuItem<String>>(russianLocale).checked,
        isFalse,
      );
      expect(
        tester
            .widget<Text>(
              find.descendant(of: englishLocale, matching: find.byType(Text)),
            )
            .data,
        'English',
      );
      expect(
        tester
            .widget<Text>(
              find.descendant(of: russianLocale, matching: find.byType(Text)),
            )
            .data,
        'Русский',
      );
      await tester.tap(russianLocale);
      await tester.pumpAndSettle();
      expect(_materialLocale(tester), 'ru');
      _expectSelectedSemantics(tester, _failedErpId, selected: true);
      final SemanticsNode russianStart = tester.getSemantics(
        find.byKey(const ValueKey<String>('start-case-action')),
      );
      expect(
        russianStart.label,
        contains(bundle.cases.first.localized('ru', 'en').topic),
      );
      expect(tester.takeException(), isNull);
      semantics.dispose();
    },
  );

  testWidgets(
    'Tab arrows and Enter select without launching until the Start action',
    (WidgetTester tester) async {
      final List<_LaunchRecord> launches = <_LaunchRecord>[];
      await _pumpCatalogue(
        tester,
        size: const Size(699, 1000),
        bundle: bundle,
        manifest: manifest,
        onStartCase: (
          MobileCaseDefinition definition,
          String locale,
          CaseCatalogBundle inventory,
        ) {
          launches.add(_LaunchRecord(definition, locale, inventory));
        },
      );

      final Finder firstItem = find.byKey(
        const ValueKey<String>('case-index-item-be_commercial_failed_erp_001'),
      );
      await _tabTo(tester, firstItem);
      _expectSelectedCase(bundle, _failedErpId, 'en');
      expect(launches, isEmpty);

      await tester.sendKeyEvent(LogicalKeyboardKey.arrowRight);
      await tester.pump();
      final Finder secondItem = find.byKey(
        const ValueKey<String>('case-index-item-be_commercial_logistics_001'),
      );
      expect(_primaryFocusIsWithin(secondItem), isTrue);
      _expectSelectedCase(bundle, _failedErpId, 'en');
      expect(launches, isEmpty);

      await tester.sendKeyEvent(LogicalKeyboardKey.enter);
      await tester.pumpAndSettle();
      _expectSelectedCase(bundle, _logisticsId, 'en');
      expect(launches, isEmpty);

      final Finder startAction = find.byKey(
        const ValueKey<String>('start-case-action'),
      );
      await _tabTo(tester, startAction);
      expect(launches, isEmpty);
      await tester.sendKeyEvent(LogicalKeyboardKey.enter);
      await tester.pump();

      expect(launches, hasLength(1));
      expect(launches.single.definition, same(bundle.cases[1]));
      expect(launches.single.locale, 'en');
      expect(launches.single.inventory, same(bundle));
    },
  );

  testWidgets(
    'action semantics expose taps only when the action is enabled',
    (WidgetTester tester) async {
      final SemanticsHandle semantics = tester.ensureSemantics();
      await _pumpCatalogue(
        tester,
        size: const Size(800, 1000),
        bundle: bundle,
        manifest: manifest,
      );
      await _revealCatalogueFinder(
        tester,
        find.byKey(const ValueKey<String>('start-case-action')),
      );

      final SemanticsData enabledStart = tester
          .getSemantics(
            find.byKey(const ValueKey<String>('start-case-action')),
          )
          .getSemanticsData();
      final SemanticsData details = tester
          .getSemantics(
            find.byKey(const ValueKey<String>('case-details-action')),
          )
          .getSemanticsData();
      expect(enabledStart.flagsCollection.isEnabled, Tristate.isTrue);
      expect(enabledStart.hasAction(SemanticsAction.tap), isTrue);
      expect(details.hasAction(SemanticsAction.tap), isTrue);

      final Map<String, dynamic> rawBundle =
          jsonDecode(encodedBundle) as Map<String, dynamic>;
      final Map<String, dynamic> unsupportedCase = Map<String, dynamic>.from(
        (rawBundle['cases'] as List<dynamic>).first as Map<String, dynamic>,
      )..['runtime_adapter'] = null;
      rawBundle
        ..['cases'] = <Map<String, dynamic>>[unsupportedCase]
        ..['load_only_scenarios'] = <dynamic>[];
      final CaseCatalogBundle unsupportedBundle = CaseCatalogBundle.fromJson(
        rawBundle,
      );
      await _pumpCatalogue(
        tester,
        size: const Size(800, 1000),
        bundle: unsupportedBundle,
        manifest: manifest,
        hostKey: const ValueKey<String>('unsupported-catalogue'),
      );
      await _revealCatalogueFinder(
        tester,
        find.byKey(const ValueKey<String>('start-case-action')),
      );

      final SemanticsData disabledStart = tester
          .getSemantics(
            find.byKey(const ValueKey<String>('start-case-action')),
          )
          .getSemanticsData();
      expect(disabledStart.flagsCollection.isEnabled, Tristate.isFalse);
      expect(disabledStart.hasAction(SemanticsAction.tap), isFalse);
      semantics.dispose();
    },
  );

  testWidgets(
    'launch callback preserves exact selected object locale and bundle identity',
    (WidgetTester tester) async {
      final List<_LaunchRecord> launches = <_LaunchRecord>[];
      await _pumpCatalogue(
        tester,
        size: const Size(800, 1100),
        bundle: bundle,
        manifest: manifest,
        onStartCase: (
          MobileCaseDefinition definition,
          String locale,
          CaseCatalogBundle inventory,
        ) {
          launches.add(_LaunchRecord(definition, locale, inventory));
        },
      );
      await _selectCase(tester, _desertWaterId);
      await _chooseLocale(tester, 'ru');

      final Finder start = find.byKey(
        const ValueKey<String>('start-case-action'),
      );
      await _revealCatalogueFinder(tester, start);
      await tester.tap(start);
      await tester.pump();

      final MobileCaseDefinition desertWater = bundle.cases.singleWhere(
        (MobileCaseDefinition item) => item.caseId == _desertWaterId,
      );
      expect(launches, hasLength(1));
      expect(launches.single.definition, same(desertWater));
      expect(launches.single.locale, 'ru');
      expect(launches.single.inventory, same(bundle));
    },
  );

  testWidgets(
    'details action opens localized conversion details without launching',
    (WidgetTester tester) async {
      int launchCount = 0;
      await _pumpCatalogue(
        tester,
        size: const Size(412, 915),
        bundle: bundle,
        manifest: manifest,
        onStartCase: (_, __, ___) => launchCount += 1,
      );
      await _selectCase(tester, _greenFireId);

      final Finder details = find.byKey(
        const ValueKey<String>('case-details-action'),
      );
      await _revealCatalogueFinder(tester, details);
      await tester.tap(details);
      await tester.pumpAndSettle();

      expect(find.byType(BottomSheet), findsOneWidget);
      expect(find.text(bundle.text('en', 'conversion_title')), findsOneWidget);
      expect(
        find.text(
          bundle.cases[2].localized('en', bundle.defaultLocale).caption,
        ),
        findsWidgets,
      );
      expect(
        find.textContaining(
          bundle.text('en', 'runtime_adapter'),
          findRichText: true,
        ),
        findsOneWidget,
      );
      expect(launchCount, 0);
      Navigator.of(tester.element(find.byType(BottomSheet))).pop();
      await tester.pumpAndSettle();
      expect(find.byType(BottomSheet), findsNothing);
    },
  );

  testWidgets(
    'catalog load failure hides raw exception and retry succeeds',
    (WidgetTester tester) async {
      int catalogueLoads = 0;
      int manifestLoads = 0;
      final CaseCatalogRepository catalogRepository = CaseCatalogRepository(
        assetLoader: (_) async {
          catalogueLoads += 1;
          if (catalogueLoads == 1) {
            throw StateError('private sentinel that must not be rendered');
          }
          return encodedBundle;
        },
      );
      final CaseVisualManifestRepository visualRepository =
          CaseVisualManifestRepository(
        assetLoader: (_) async {
          manifestLoads += 1;
          return encodedManifest;
        },
      );

      tester.view.devicePixelRatio = 1;
      tester.view.physicalSize = const Size(800, 900);
      addTearDown(tester.view.reset);
      await tester.pumpWidget(
        MaterialApp(
          theme: JurisTheme.dark(),
          home: CaseCatalogLoaderScreen(
            repository: catalogRepository,
            visualManifestRepository: visualRepository,
            locale: 'en',
            onLocaleChanged: (_) {},
            onStartCase: _ignoreStart,
          ),
        ),
      );
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 1));
      await tester.pump(const Duration(milliseconds: 400));

      expect(find.text(bundle.text('en', 'load_failed')), findsOneWidget);
      expect(find.textContaining('private sentinel'), findsNothing);
      expect(
        find.byKey(const ValueKey<String>('catalog-retry-action')),
        findsOneWidget,
      );
      expect(catalogueLoads, 1);
      expect(manifestLoads, 1);

      await tester.tap(
        find.byKey(const ValueKey<String>('catalog-retry-action')),
      );
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 1));
      await tester.pump(const Duration(milliseconds: 400));

      expect(catalogueLoads, 2);
      expect(manifestLoads, 1,
          reason: 'The visual repository is single-flight.');
      _expectSelectedCase(bundle, _failedErpId, 'en');
      expect(tester.takeException(), isNull);
    },
  );

  const List<_ManifestFailure> manifestFailures = <_ManifestFailure>[
    _ManifestFailure('missing', null),
    _ManifestFailure('corrupt', '{not-json'),
    _ManifestFailure(
      'future schema',
      '{"schema_version":2,"default_treatment":{},"case_treatments":[]}',
    ),
  ];
  for (final _ManifestFailure failure in manifestFailures) {
    testWidgets(
      '${failure.name} visual manifest falls back without blocking catalogue',
      (WidgetTester tester) async {
        Object? diagnostic;
        final CaseVisualManifestRepository visualRepository =
            CaseVisualManifestRepository(
          assetLoader: (_) async {
            final String? encoded = failure.encoded;
            if (encoded == null) {
              throw StateError('asset missing');
            }
            return encoded;
          },
          onDiagnostic: (Object error, StackTrace _) => diagnostic = error,
        );

        await _pumpLoader(
          tester,
          catalogRepository: CaseCatalogRepository(
            assetLoader: (_) async => encodedBundle,
          ),
          visualRepository: visualRepository,
        );

        _expectSelectedCase(bundle, _failedErpId, 'en');
        expect(diagnostic, isNotNull);
        expect(
            _selectedTreatment(), CaseVisualManifest.builtInDefaultTreatment);
        expect(tester.takeException(), isNull);
      },
    );
  }

  testWidgets(
    'missing case manifest entry resolves the declared safe default',
    (WidgetTester tester) async {
      final Map<String, dynamic> raw =
          jsonDecode(encodedManifest) as Map<String, dynamic>;
      (raw['case_treatments'] as List<dynamic>).removeAt(0);
      final CaseVisualManifest missingEntry = CaseVisualManifest.fromJson(raw);
      await _pumpCatalogue(
        tester,
        size: const Size(800, 900),
        bundle: bundle,
        manifest: missingEntry,
      );

      expect(_selectedTreatment(), missingEntry.defaultTreatment);
      _expectSelectedCase(bundle, _failedErpId, 'en');
    },
  );

  testWidgets(
    'all five selected cases consume their exact manifest treatments',
    (WidgetTester tester) async {
      await _pumpCatalogue(
        tester,
        size: const Size(800, 1100),
        bundle: bundle,
        manifest: manifest,
      );

      final Set<CaseVisualMotif> seenMotifs = <CaseVisualMotif>{};
      for (final String caseId in _authoritativeCaseIds) {
        await _selectCase(tester, caseId);
        final CaseVisualTreatment expected = manifest.resolve(caseId);
        expect(_selectedTreatment(), expected);
        expect(
            _selectedHeroPainter().spec,
            CaseArtSpec.fromTreatment(
              expected,
              palette: expected.palette,
            ));
        seenMotifs.add(expected.motif);
      }
      expect(seenMotifs, hasLength(5));
    },
  );

  testWidgets(
    'visual treatment changes cannot infer or replace gameplay launch data',
    (WidgetTester tester) async {
      final Map<String, dynamic> raw =
          jsonDecode(encodedManifest) as Map<String, dynamic>;
      final List<dynamic> treatments = raw['case_treatments'] as List<dynamic>;
      final Map<String, dynamic> first =
          treatments.first as Map<String, dynamic>;
      final Map<String, dynamic> last = treatments.last as Map<String, dynamic>;
      final Map<String, dynamic> firstVisual = <String, dynamic>{
        'motif': first['motif'],
        'palette': first['palette'],
        'art_seed': first['art_seed'],
      };
      for (final String field in <String>['motif', 'palette', 'art_seed']) {
        first[field] = last[field];
        last[field] = firstVisual[field];
      }
      final CaseVisualManifest swapped = CaseVisualManifest.fromJson(raw);
      _LaunchRecord? launch;

      await _pumpCatalogue(
        tester,
        size: const Size(800, 1000),
        bundle: bundle,
        manifest: swapped,
        onStartCase: (
          MobileCaseDefinition definition,
          String locale,
          CaseCatalogBundle inventory,
        ) {
          launch = _LaunchRecord(definition, locale, inventory);
        },
      );

      expect(_selectedTreatment(), swapped.resolve(_failedErpId));
      expect(
        _selectedTreatment(),
        manifest.resolve(_desertWaterId),
        reason: 'The deliberately swapped presentation value must be used.',
      );
      expect(
        find.descendant(
          of: find.byKey(const ValueKey<String>('selected-case-panel')),
          matching: find.text(
            bundle.cases.first.localized('en', 'en').topic,
          ),
        ),
        findsOneWidget,
      );
      final FilledButton start = tester.widget<FilledButton>(
        find.byKey(const ValueKey<String>('start-case-action')),
      );
      expect(start.onPressed, isNotNull);
      final Finder startAction = find.byKey(
        const ValueKey<String>('start-case-action'),
      );
      await _revealCatalogueFinder(tester, startAction);
      await tester.tap(startAction);
      await tester.pump();

      expect(launch, isNotNull);
      expect(launch!.definition, same(bundle.cases.first));
      expect(launch!.inventory, same(bundle));
      expect(launch!.locale, 'en');
    },
  );

  testWidgets(
    'localized presentation copy cannot infer gameplay availability',
    (WidgetTester tester) async {
      const String adversarialTopic =
          'НЕ ПОДДЕРЖИВАЕТСЯ · ЗАКРЫТО · ТОЛЬКО АВТОРИНГ';
      final CaseCatalogBundle copyMutated = _mutateFirstCase(
        encodedBundle,
        (Map<String, dynamic> rawCase) {
          final Map<String, dynamic> localizations =
              rawCase['localizations'] as Map<String, dynamic>;
          final Map<String, dynamic> russian =
              localizations['ru'] as Map<String, dynamic>;
          russian
            ..['caption'] = 'ВИЗУАЛЬНЫЙ СИГНАЛ «НЕ ЗАПУСКАТЬ»'
            ..['topic'] = adversarialTopic
            ..['short_title'] = 'Не запускать'
            ..['synopsis'] =
                'Этот текст намеренно имитирует состояние gameplay.';
        },
      );
      final MobileCaseDefinition original = bundle.cases.first;
      final MobileCaseDefinition mutated = copyMutated.cases.first;
      _LaunchRecord? launch;

      expect(mutated.caseId, original.caseId);
      expect(mutated.scenarioId, original.scenarioId);
      expect(mutated.runtimeAdapter, original.runtimeAdapter);
      expect(mutated.scenarioAvailable, original.scenarioAvailable);
      expect(mutated.readiness.engineRuntime, original.readiness.engineRuntime);
      expect(mutated.scenarioFingerprint, original.scenarioFingerprint);

      await _pumpCatalogue(
        tester,
        size: const Size(800, 1000),
        bundle: copyMutated,
        manifest: manifest,
        initialLocale: 'ru',
        onStartCase: (
          MobileCaseDefinition definition,
          String locale,
          CaseCatalogBundle inventory,
        ) {
          launch = _LaunchRecord(definition, locale, inventory);
        },
      );

      expect(
        find.descendant(
          of: find.byKey(const ValueKey<String>('selected-case-panel')),
          matching: find.text(adversarialTopic),
        ),
        findsOneWidget,
      );
      final FilledButton start = tester.widget<FilledButton>(
        find.byKey(const ValueKey<String>('start-case-action')),
      );
      expect(start.onPressed, isNotNull);
      final Finder startAction = find.byKey(
        const ValueKey<String>('start-case-action'),
      );
      await _revealCatalogueFinder(tester, startAction);
      await tester.tap(startAction);
      await tester.pump();

      expect(launch, isNotNull);
      expect(launch!.definition, same(mutated));
      expect(launch!.inventory, same(copyMutated));
      expect(launch!.locale, 'ru');
    },
  );

  testWidgets(
    'case id cannot infer gameplay availability or visual treatment',
    (WidgetTester tester) async {
      const String adversarialCaseId =
          'unsupported_authoring_closed_visual_case';
      final CaseCatalogBundle idMutated = _mutateFirstCase(
        encodedBundle,
        (Map<String, dynamic> rawCase) {
          rawCase['case_id'] = adversarialCaseId;
        },
      );
      final MobileCaseDefinition original = bundle.cases.first;
      final MobileCaseDefinition mutated = idMutated.cases.first;
      _LaunchRecord? launch;

      expect(mutated.caseId, adversarialCaseId);
      expect(mutated.scenarioId, original.scenarioId);
      expect(mutated.runtimeAdapter, original.runtimeAdapter);
      expect(mutated.scenarioAvailable, original.scenarioAvailable);
      expect(mutated.readiness.engineRuntime, original.readiness.engineRuntime);
      expect(mutated.scenarioFingerprint, original.scenarioFingerprint);

      await _pumpCatalogue(
        tester,
        size: const Size(800, 1000),
        bundle: idMutated,
        manifest: manifest,
        onStartCase: (
          MobileCaseDefinition definition,
          String locale,
          CaseCatalogBundle inventory,
        ) {
          launch = _LaunchRecord(definition, locale, inventory);
        },
      );

      expect(
        find.byKey(
          const ValueKey<String>(
            'case-index-item-unsupported_authoring_closed_visual_case',
          ),
        ),
        findsOneWidget,
      );
      expect(
        _selectedTreatment(),
        manifest.defaultTreatment,
        reason: 'An unknown ID may select only the safe visual fallback.',
      );
      final FilledButton start = tester.widget<FilledButton>(
        find.byKey(const ValueKey<String>('start-case-action')),
      );
      expect(start.onPressed, isNotNull);
      final Finder startAction = find.byKey(
        const ValueKey<String>('start-case-action'),
      );
      await _revealCatalogueFinder(tester, startAction);
      await tester.tap(startAction);
      await tester.pump();

      expect(launch, isNotNull);
      expect(launch!.definition, same(mutated));
      expect(launch!.inventory, same(idMutated));
      expect(launch!.locale, 'en');
    },
  );

  testWidgets(
    'high contrast resolves art palette and reduced motion settles immediately',
    (WidgetTester tester) async {
      await _pumpCatalogue(
        tester,
        size: const Size(800, 1000),
        bundle: bundle,
        manifest: manifest,
        highContrast: true,
        reducedMotion: true,
      );

      final CaseVisualTreatment treatment = manifest.resolve(_failedErpId);
      expect(
        _selectedHeroPainter().spec.palette,
        JurisCasePaletteResolver.resolve(
          palette: treatment.palette,
          surfaces: JurisSurfaces.dark,
          highContrast: true,
        ),
      );
      final BuildContext panelContext = tester.element(
        find.byKey(const ValueKey<String>('selected-case-panel')),
      );
      final JurisMotion motion = JurisMotionPolicy.of(panelContext);
      expect(motion.immediate, Duration.zero);
      expect(motion.selection, Duration.zero);
      expect(motion.reveal, Duration.zero);

      final Finder logistics = find.byKey(
        const ValueKey<String>('case-index-item-be_commercial_logistics_001'),
      );
      final Semantics logisticsSemantics = tester.widget<Semantics>(logistics);
      logisticsSemantics.properties.onTap!();
      await tester.pump();
      _expectSelectedCase(bundle, _logisticsId, 'en');
      expect(tester.binding.transientCallbackCount, 0);
      expect(tester.takeException(), isNull);
    },
  );

  for (final String locale in <String>['en', 'ru']) {
    testWidgets(
      '$locale at 200 percent has no overflow and both actions stay reachable',
      (WidgetTester tester) async {
        await _pumpCatalogue(
          tester,
          size: const Size(360, 800),
          bundle: bundle,
          manifest: manifest,
          initialLocale: locale,
          textScale: 2,
          reducedMotion: true,
        );

        for (final String keyValue in <String>[
          'start-case-action',
          'case-details-action',
        ]) {
          final Finder action = find.byKey(ValueKey<String>(keyValue));
          await _revealCatalogueFinder(tester, action);
          expect(action.hitTestable(), findsOneWidget);
          expect(tester.getSize(action).height, greaterThanOrEqualTo(48));
          expect(tester.getSize(action).width, greaterThanOrEqualTo(48));
          expect(tester.takeException(), isNull);
        }
        expect(tester.binding.transientCallbackCount, 0);
      },
    );
  }
}

CaseCatalogBundle _mutateFirstCase(
  String encodedBundle,
  void Function(Map<String, dynamic> rawCase) mutate,
) {
  final Map<String, dynamic> raw =
      jsonDecode(encodedBundle) as Map<String, dynamic>;
  final List<dynamic> rawCases = raw['cases'] as List<dynamic>;
  mutate(rawCases.first as Map<String, dynamic>);
  return CaseCatalogBundle.fromJson(raw);
}

Future<void> _pumpCatalogue(
  WidgetTester tester, {
  required Size size,
  required CaseCatalogBundle bundle,
  required CaseVisualManifest manifest,
  Key? hostKey,
  String initialLocale = 'en',
  double textScale = 1,
  bool highContrast = false,
  bool reducedMotion = false,
  CaseStartCallback? onStartCase,
  ValueChanged<String>? onLocaleChanged,
}) async {
  tester.view.devicePixelRatio = 1;
  tester.view.physicalSize = size;
  addTearDown(tester.view.reset);

  final FlutterExceptionHandler? previousErrorHandler = FlutterError.onError;
  FlutterErrorDetails? capturedErrorDetails;
  FlutterError.onError = (FlutterErrorDetails details) {
    capturedErrorDetails ??= details;
    previousErrorHandler?.call(details);
  };
  try {
    await tester.pumpWidget(
      _CatalogueTestHost(
        key: hostKey,
        bundle: bundle,
        manifest: manifest,
        initialLocale: initialLocale,
        textScale: textScale,
        highContrast: highContrast,
        reducedMotion: reducedMotion,
        onStartCase: onStartCase ?? _ignoreStart,
        onLocaleChanged: onLocaleChanged,
      ),
    );
    await tester.pumpAndSettle();
  } finally {
    FlutterError.onError = previousErrorHandler;
  }
  final Object? exception = tester.takeException();
  if (capturedErrorDetails case final FlutterErrorDetails details) {
    fail(details.toString());
  }
  if (exception is FlutterError) {
    fail(exception.toStringDeep());
  }
  expect(exception, isNull);
  expect(tester.binding.transientCallbackCount, 0);
}

Future<void> _pumpLoader(
  WidgetTester tester, {
  required CaseCatalogRepository catalogRepository,
  required CaseVisualManifestRepository visualRepository,
}) async {
  tester.view.devicePixelRatio = 1;
  tester.view.physicalSize = const Size(800, 900);
  addTearDown(tester.view.reset);
  await tester.pumpWidget(
    MaterialApp(
      theme: JurisTheme.dark(),
      home: CaseCatalogLoaderScreen(
        key: UniqueKey(),
        repository: catalogRepository,
        visualManifestRepository: visualRepository,
        locale: 'en',
        onLocaleChanged: (_) {},
        onStartCase: _ignoreStart,
      ),
    ),
  );
  await tester.pump();
  await tester.pump(const Duration(milliseconds: 1));
  await tester.pump(const Duration(milliseconds: 400));
}

Future<void> _selectCase(WidgetTester tester, String caseId) async {
  final Finder item = find.byKey(
    ValueKey<String>('case-index-item-$caseId'),
  );
  await tester.ensureVisible(item);
  await tester.pump();
  await tester.tap(item);
  await tester.pumpAndSettle();
}

Future<void> _chooseLocale(WidgetTester tester, String localeCode) async {
  await _scrollCatalogueToTop(tester);
  await tester.tap(
    find.byKey(const ValueKey<String>('catalog-language-action')),
  );
  await tester.pumpAndSettle();
  await tester.tap(
    find.byWidgetPredicate(
      (Widget widget) =>
          widget is PopupMenuItem<String> && widget.value == localeCode,
    ),
  );
  await tester.pumpAndSettle();
}

Future<void> _scrollCatalogueToTop(WidgetTester tester) async {
  final ScrollableState scrollable = tester.state<ScrollableState>(
    _catalogueScrollable(),
  );
  scrollable.position.jumpTo(scrollable.position.minScrollExtent);
  await tester.pump();
}

Future<void> _revealCatalogueFinder(
  WidgetTester tester,
  Finder target,
) async {
  for (int attempt = 0; attempt < 30; attempt += 1) {
    if (target.evaluate().length == 1 &&
        target.hitTestable().evaluate().length == 1) {
      return;
    }
    final ScrollableState scrollable = tester.state<ScrollableState>(
      _catalogueScrollable(),
    );
    final double current = scrollable.position.pixels;
    final double maximum = scrollable.position.maxScrollExtent;
    if (current >= maximum) {
      break;
    }
    final double next = current + 320 > maximum ? maximum : current + 320;
    scrollable.position.jumpTo(next);
    await tester.pump();
  }
  fail('The requested catalogue control could not be made reachable.');
}

Finder _catalogueScrollable() {
  return find
      .descendant(
        of: find.byKey(const PageStorageKey<String>('case-catalog')),
        matching: find.byWidgetPredicate((Widget widget) {
          return widget is Scrollable &&
              axisDirectionToAxis(widget.axisDirection) == Axis.vertical;
        }),
      )
      .first;
}

Future<void> _tabTo(WidgetTester tester, Finder target) async {
  for (int attempt = 0; attempt < 30; attempt += 1) {
    if (_primaryFocusIsWithin(target)) {
      return;
    }
    await tester.sendKeyEvent(LogicalKeyboardKey.tab);
    await tester.pump();
  }
  fail('Tab traversal did not reach the requested target.');
}

bool _primaryFocusIsWithin(Finder target) {
  if (target.evaluate().length != 1) {
    return false;
  }
  final BuildContext? focusContext =
      FocusManager.instance.primaryFocus?.context;
  if (focusContext == null) {
    return false;
  }
  final Element targetElement = target.evaluate().single;
  if (identical(focusContext, targetElement)) {
    return true;
  }
  bool found = false;
  focusContext.visitAncestorElements((Element ancestor) {
    if (identical(ancestor, targetElement)) {
      found = true;
      return false;
    }
    return true;
  });
  return found;
}

CaseVisualTreatment _selectedTreatment() {
  final Finder panel = find.byKey(
    const ValueKey<String>('selected-case-panel'),
  );
  return find
      .descendant(of: panel, matching: find.byType(CaseTreatmentScope))
      .evaluate()
      .map((Element element) => element.widget as CaseTreatmentScope)
      .single
      .treatment;
}

CaseHeroPainter _selectedHeroPainter() {
  final Finder panel = find.byKey(
    const ValueKey<String>('selected-case-panel'),
  );
  return find
      .descendant(of: panel, matching: find.byType(CustomPaint))
      .evaluate()
      .map((Element element) => element.widget as CustomPaint)
      .map((CustomPaint paint) => paint.painter)
      .whereType<CaseHeroPainter>()
      .single;
}

void _expectExactIndexOrder() {
  final Finder index = find.byKey(const ValueKey<String>('case-index'));
  expect(index, findsOneWidget);
  final List<String> renderedIds = find
      .descendant(
        of: index,
        matching: find.byWidgetPredicate((Widget widget) {
          final Key? key = widget.key;
          return key is ValueKey<String> &&
              key.value.startsWith('case-index-item-');
        }),
      )
      .evaluate()
      .map((Element element) {
    final ValueKey<String> key = element.widget.key! as ValueKey<String>;
    return key.value.substring('case-index-item-'.length);
  }).toList(growable: false);
  expect(renderedIds, _authoritativeCaseIds);
}

void _expectSelectedCase(
  CaseCatalogBundle bundle,
  String caseId,
  String locale,
) {
  final MobileCaseDefinition selected = bundle.cases.singleWhere(
    (MobileCaseDefinition item) => item.caseId == caseId,
  );
  final Finder panel = find.byKey(
    const ValueKey<String>('selected-case-panel'),
  );
  expect(panel, findsOneWidget);
  expect(
    find.descendant(
      of: panel,
      matching:
          find.text(selected.localized(locale, bundle.defaultLocale).caption),
    ),
    findsOneWidget,
  );
}

void _expectSelectedSemantics(
  WidgetTester tester,
  String caseId, {
  required bool selected,
}) {
  expect(
    tester.getSemantics(
      find.byKey(ValueKey<String>('case-index-item-$caseId')),
    ),
    matchesSemantics(
      hasSelectedState: true,
      isSelected: selected,
      isButton: true,
      hasTapAction: true,
    ),
  );
}

String _materialLocale(WidgetTester tester) {
  final BuildContext context = tester.element(
    find.byKey(const ValueKey<String>('selected-case-panel')),
  );
  MaterialLocalizations.of(context);
  return Localizations.localeOf(context).languageCode;
}

void _ignoreStart(
  MobileCaseDefinition _,
  String __,
  CaseCatalogBundle ___,
) {}

@immutable
final class _LaunchRecord {
  const _LaunchRecord(this.definition, this.locale, this.inventory);

  final MobileCaseDefinition definition;
  final String locale;
  final CaseCatalogBundle inventory;
}

@immutable
final class _ManifestFailure {
  const _ManifestFailure(this.name, this.encoded);

  final String name;
  final String? encoded;
}

final class _CatalogueTestHost extends StatefulWidget {
  const _CatalogueTestHost({
    super.key,
    required this.bundle,
    required this.manifest,
    required this.initialLocale,
    required this.textScale,
    required this.highContrast,
    required this.reducedMotion,
    required this.onStartCase,
    this.onLocaleChanged,
  });

  final CaseCatalogBundle bundle;
  final CaseVisualManifest manifest;
  final String initialLocale;
  final double textScale;
  final bool highContrast;
  final bool reducedMotion;
  final CaseStartCallback onStartCase;
  final ValueChanged<String>? onLocaleChanged;

  @override
  State<_CatalogueTestHost> createState() => _CatalogueTestHostState();
}

final class _CatalogueTestHostState extends State<_CatalogueTestHost> {
  late String _locale = widget.initialLocale;

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      debugShowCheckedModeBanner: false,
      locale: Locale(_locale),
      supportedLocales: const <Locale>[Locale('en'), Locale('ru')],
      localizationsDelegates: const <LocalizationsDelegate<dynamic>>[
        GlobalMaterialLocalizations.delegate,
        GlobalWidgetsLocalizations.delegate,
        GlobalCupertinoLocalizations.delegate,
      ],
      theme: JurisTheme.dark(),
      builder: (BuildContext context, Widget? child) {
        final MediaQueryData media = MediaQuery.of(context).copyWith(
          textScaler: TextScaler.linear(widget.textScale),
          highContrast: widget.highContrast,
          disableAnimations: widget.reducedMotion,
          accessibleNavigation: widget.reducedMotion,
        );
        return MediaQuery(data: media, child: child!);
      },
      home: CaseCatalogScreen(
        bundle: widget.bundle,
        visualManifest: widget.manifest,
        initialLocale: _locale,
        onLocaleChanged: (String locale) {
          setState(() => _locale = locale);
          widget.onLocaleChanged?.call(locale);
        },
        onStartCase: widget.onStartCase,
      ),
    );
  }
}
