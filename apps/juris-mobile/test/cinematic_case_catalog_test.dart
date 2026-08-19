import 'dart:convert';
import 'dart:math' as math;
import 'dart:ui' show SemanticsAction, TextHeightBehavior, Tristate;

import 'package:flutter/foundation.dart' show FlutterExceptionHandler;
import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
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
import 'package:juris_mobile/widgets/catalogue/case_index.dart';

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
    'compact previous and next controls select first middle and last without launch',
    (WidgetTester tester) async {
      int launchCount = 0;
      await _pumpCatalogue(
        tester,
        size: const Size(412, 915),
        bundle: bundle,
        manifest: manifest,
        onStartCase: (_, __, ___) => launchCount += 1,
      );

      expect(_boundaryButton(tester, 'case-index-previous').onPressed, isNull);
      expect(_boundaryButton(tester, 'case-index-next').onPressed, isNotNull);
      expect(find.text('01 / 05'), findsWidgets);
      _expectSelectedCase(bundle, _failedErpId, 'en');

      await _tapBoundary(tester, 'case-index-next');
      await _tapBoundary(tester, 'case-index-next');
      _expectSelectedCase(bundle, _greenFireId, 'en');
      expect(find.text('03 / 05'), findsWidgets);

      await _tapBoundary(tester, 'case-index-next');
      await _tapBoundary(tester, 'case-index-next');
      _expectSelectedCase(bundle, _desertWaterId, 'en');
      expect(_boundaryButton(tester, 'case-index-next').onPressed, isNull);
      expect(
        _boundaryButton(tester, 'case-index-previous').onPressed,
        isNotNull,
      );
      expect(launchCount, 0);
    },
  );

  testWidgets('compact horizontal swipe snaps one case without launching', (
    WidgetTester tester,
  ) async {
    int launchCount = 0;
    await _pumpCatalogue(
      tester,
      size: const Size(412, 915),
      bundle: bundle,
      manifest: manifest,
      onStartCase: (_, __, ___) => launchCount += 1,
    );

    await tester.drag(
      find.byKey(const ValueKey<String>('compact-case-pages')),
      const Offset(-320, 0),
    );
    await tester.pumpAndSettle();

    _expectSelectedCase(bundle, _logisticsId, 'en');
    expect(find.text('02 / 05'), findsWidgets);
    expect(launchCount, 0);
  });

  testWidgets('Browse all directly selects by stable ID and focuses heading', (
    WidgetTester tester,
  ) async {
    final SemanticsHandle semantics = tester.ensureSemantics();
    int launchCount = 0;
    await _pumpCatalogue(
      tester,
      size: const Size(412, 915),
      bundle: bundle,
      manifest: manifest,
      onStartCase: (_, __, ___) => launchCount += 1,
    );

    await tester.tap(
      find.byKey(const ValueKey<String>('browse-all-cases')),
    );
    await tester.pumpAndSettle();
    expect(
      find.byKey(const ValueKey<String>('browse-all-case-list')),
      findsOneWidget,
    );
    for (final String caseId in _authoritativeCaseIds) {
      expect(
        find.byKey(ValueKey<String>('browse-case-$caseId')),
        findsOneWidget,
      );
    }

    await tester.tap(
      find.byKey(const ValueKey<String>('browse-case-$_desertWaterId')),
    );
    await tester.pumpAndSettle();

    _expectSelectedCase(bundle, _desertWaterId, 'en');
    expect(FocusManager.instance.primaryFocus?.debugLabel,
        'selected-case-heading');
    _expectFocusOutlineVisible(
      tester,
      find.byKey(
        const ValueKey<String>('selected-case-heading-focus'),
      ),
    );
    expect(find.text('05 / 05'), findsWidgets);
    _expectSelectedSemantics(tester, _desertWaterId, selected: true);
    final CaseVisualTreatment desertTreatment = manifest.resolve(
      _desertWaterId,
    );
    expect(_selectedTreatment(), desertTreatment);
    expect(
      _selectedHeroPainter().spec,
      CaseArtSpec.fromTreatment(
        desertTreatment,
        palette: desertTreatment.palette,
      ),
    );
    expect(launchCount, 0);

    await tester.drag(
      find.byKey(const ValueKey<String>('compact-case-pages')),
      const Offset(320, 0),
    );
    await tester.pumpAndSettle();
    _expectSelectedCase(bundle, _goldenShellId, 'en');
    expect(find.text('04 / 05'), findsWidgets);
    expect(FocusManager.instance.primaryFocus?.debugLabel,
        'selected-case-heading');
    expect(launchCount, 0);
    expect(tester.binding.transientCallbackCount, 0);
    semantics.dispose();
  });

  testWidgets(
    'catalog visual modes preserve one loaded stable selection without launch',
    (WidgetTester tester) async {
      final SemanticsHandle semantics = tester.ensureSemantics();
      final JurisVisualModeController controller = JurisVisualModeController();
      addTearDown(controller.dispose);
      int catalogueLoads = 0;
      int manifestLoads = 0;
      int launchCount = 0;
      await _pumpLoader(
        tester,
        catalogRepository: CaseCatalogRepository(
          assetLoader: (_) async {
            catalogueLoads += 1;
            return encodedBundle;
          },
        ),
        visualRepository: CaseVisualManifestRepository(
          assetLoader: (_) async {
            manifestLoads += 1;
            return encodedManifest;
          },
        ),
        visualModeController: controller,
        onStartCase: (_, __, ___) => launchCount += 1,
      );

      final Finder modeAction = find.byKey(
        const ValueKey<String>('catalog-visual-mode-action'),
      );
      expect(modeAction.hitTestable(), findsOneWidget);
      expect(tester.getSize(modeAction).height, greaterThanOrEqualTo(48));
      expect(
        tester.getSemantics(modeAction).label,
        contains('Appearance: Automatic'),
      );
      expect(
        find.descendant(of: modeAction, matching: find.text('AFTER HOURS')),
        findsOneWidget,
      );
      _expectCatalogueMode(tester, JurisVisualMode.afterHours);

      await _tabTo(tester, modeAction);
      await tester.pumpAndSettle();
      _expectFocusOutlineVisible(
        tester,
        find.byKey(
          const ValueKey<String>('catalog-visual-mode-focus'),
        ),
      );
      FocusManager.instance.primaryFocus?.unfocus();
      await tester.pump();

      await _selectCatalogueVisualMode(
        tester,
        JurisVisualModeSelection.office,
      );
      _expectCatalogueMode(tester, JurisVisualMode.office);
      expect(controller.selection, JurisVisualModeSelection.office);

      await _selectCase(tester, _goldenShellId);
      _expectSelectedCase(bundle, _goldenShellId, 'en');
      expect(
        tester.widget<CaseIndex>(find.byType(CaseIndex)).selectedCaseId,
        _goldenShellId,
      );

      await _revealMastheadControl(tester, modeAction);
      await _selectCatalogueVisualMode(
        tester,
        JurisVisualModeSelection.afterHours,
      );
      _expectCatalogueMode(tester, JurisVisualMode.afterHours);
      expect(
        tester.widget<CaseIndex>(find.byType(CaseIndex)).selectedCaseId,
        _goldenShellId,
      );

      await _selectCatalogueVisualMode(
        tester,
        JurisVisualModeSelection.automatic,
      );
      _expectCatalogueMode(tester, JurisVisualMode.afterHours);
      expect(
        tester.widget<CaseIndex>(find.byType(CaseIndex)).selectedCaseId,
        _goldenShellId,
      );
      expect(catalogueLoads, 1);
      expect(manifestLoads, 1);
      expect(launchCount, 0);
      expect(tester.takeException(), isNull);
      semantics.dispose();
    },
  );

  testWidgets('wide arrows Home End and activation never launch a case', (
    WidgetTester tester,
  ) async {
    int launchCount = 0;
    await _pumpCatalogue(
      tester,
      size: const Size(800, 1000),
      bundle: bundle,
      manifest: manifest,
      onStartCase: (_, __, ___) => launchCount += 1,
    );

    final Finder first = find.byKey(
      const ValueKey<String>('case-index-item-$_failedErpId'),
    );
    await _tabTo(tester, first);
    await tester.sendKeyEvent(LogicalKeyboardKey.arrowUp);
    await tester.pumpAndSettle();
    _expectSelectedCase(bundle, _failedErpId, 'en');
    await tester.sendKeyEvent(LogicalKeyboardKey.arrowDown);
    await tester.pumpAndSettle();
    _expectSelectedCase(bundle, _logisticsId, 'en');

    await tester.sendKeyEvent(LogicalKeyboardKey.end);
    await tester.pumpAndSettle();
    _expectSelectedCase(bundle, _desertWaterId, 'en');
    await tester.sendKeyEvent(LogicalKeyboardKey.arrowDown);
    await tester.pumpAndSettle();
    _expectSelectedCase(bundle, _desertWaterId, 'en');

    await tester.sendKeyEvent(LogicalKeyboardKey.home);
    await tester.pumpAndSettle();
    _expectSelectedCase(bundle, _failedErpId, 'en');
    await tester.sendKeyEvent(LogicalKeyboardKey.space);
    await tester.pumpAndSettle();
    _expectSelectedCase(bundle, _failedErpId, 'en');
    await tester.sendKeyEvent(LogicalKeyboardKey.enter);
    await tester.pumpAndSettle();
    expect(launchCount, 0);
  });

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
      await tester.pumpAndSettle();
      final Finder secondItem = find.byKey(
        const ValueKey<String>('case-index-item-be_commercial_logistics_001'),
      );
      expect(_primaryFocusIsWithin(secondItem), isTrue);
      _expectSelectedCase(bundle, _logisticsId, 'en');
      expect(find.text('02 / 05'), findsWidgets);
      expect(launches, isEmpty);

      await tester.sendKeyEvent(LogicalKeyboardKey.enter);
      await tester.pumpAndSettle();
      _expectSelectedCase(bundle, _logisticsId, 'en');
      expect(launches, isEmpty);

      await tester.sendKeyEvent(LogicalKeyboardKey.end);
      await tester.pumpAndSettle();
      _expectSelectedCase(bundle, _desertWaterId, 'en');
      expect(find.text('05 / 05'), findsWidgets);
      await tester.sendKeyEvent(LogicalKeyboardKey.arrowRight);
      await tester.pumpAndSettle();
      _expectSelectedCase(bundle, _desertWaterId, 'en');
      expect(launches, isEmpty);

      await tester.sendKeyEvent(LogicalKeyboardKey.home);
      await tester.pumpAndSettle();
      _expectSelectedCase(bundle, _failedErpId, 'en');
      expect(find.text('01 / 05'), findsWidgets);
      await tester.sendKeyEvent(LogicalKeyboardKey.arrowLeft);
      await tester.pumpAndSettle();
      _expectSelectedCase(bundle, _failedErpId, 'en');
      await tester.sendKeyEvent(LogicalKeyboardKey.space);
      await tester.pumpAndSettle();
      _expectSelectedCase(bundle, _failedErpId, 'en');
      expect(launches, isEmpty);

      await tester.sendKeyEvent(LogicalKeyboardKey.arrowRight);
      await tester.pumpAndSettle();
      _expectSelectedCase(bundle, _logisticsId, 'en');

      final Finder startAction = find.byKey(
        const ValueKey<String>('start-case-action'),
      );
      final Finder detailsAction = find.byKey(
        const ValueKey<String>('case-details-action'),
      );
      await _tabTo(tester, startAction);
      expect(_primaryFocusIsWithin(startAction), isTrue);
      expect(launches, isEmpty);
      await tester.sendKeyEvent(LogicalKeyboardKey.arrowRight);
      await tester.pumpAndSettle();
      _expectSelectedCase(bundle, _logisticsId, 'en');
      expect(launches, isEmpty);

      final List<String> visitedActionFocus =
          await _restoreStartFocusThroughVisibleActions(
        tester,
        startAction: startAction,
        detailsAction: detailsAction,
      );
      expect(
        _primaryFocusIsWithin(startAction),
        isTrue,
        reason:
            'Start must own focus before Enter. visited=$visitedActionFocus',
      );
      expect(
        _primaryFocusIsWithin(detailsAction),
        isFalse,
        reason: 'Details must not own focus. visited=$visitedActionFocus',
      );
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
      await _revealCatalogueAction(
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
      await _revealCatalogueAction(
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
      await _revealCatalogueAction(tester, start);
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
      await _revealCatalogueAction(tester, details);
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
      await _revealCatalogueAction(tester, startAction);
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
      await _revealCatalogueAction(tester, startAction);
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
      await _revealCatalogueAction(tester, startAction);
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
      final BuildContext panelContext = tester.element(
        find.byKey(const ValueKey<String>('selected-case-panel')),
      );
      expect(
        _selectedHeroPainter().spec.palette,
        JurisCasePaletteResolver.resolve(
          palette: treatment.palette,
          surfaces: Theme.of(panelContext).extension<JurisSurfaces>()!,
          highContrast: true,
        ),
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

  const List<
      ({
        String name,
        Size size,
        String locale,
        double textScale,
        JurisVisualMode mode,
      })> accessibilityMatrix = <({
    String name,
    Size size,
    String locale,
    double textScale,
    JurisVisualMode mode,
  })>[
    (
      name:
          'en at 100 percent has complete compact navigation and reachable actions',
      size: Size(360, 800),
      locale: 'en',
      textScale: 1,
      mode: JurisVisualMode.office,
    ),
    (
      name: 'en at 200 percent has no overflow and both actions stay reachable',
      size: Size(360, 800),
      locale: 'en',
      textScale: 2,
      mode: JurisVisualMode.office,
    ),
    (
      name: 'ru at 200 percent has no overflow and both actions stay reachable',
      size: Size(360, 800),
      locale: 'ru',
      textScale: 2,
      mode: JurisVisualMode.office,
    ),
    (
      name: '412 phone en at 200 percent remains reachable',
      size: Size(412, 915),
      locale: 'en',
      textScale: 2,
      mode: JurisVisualMode.afterHours,
    ),
    (
      name: '412 phone ru at 200 percent remains reachable',
      size: Size(412, 915),
      locale: 'ru',
      textScale: 2,
      mode: JurisVisualMode.afterHours,
    ),
    (
      name: '699 compact boundary at 200 percent remains reachable',
      size: Size(699, 1000),
      locale: 'ru',
      textScale: 2,
      mode: JurisVisualMode.office,
    ),
    (
      name: '700 wide boundary at 200 percent remains reachable',
      size: Size(700, 1000),
      locale: 'en',
      textScale: 2,
      mode: JurisVisualMode.afterHours,
    ),
    (
      name: '800 tablet portrait ru in office mode remains reachable',
      size: Size(800, 1280),
      locale: 'ru',
      textScale: 1,
      mode: JurisVisualMode.office,
    ),
    (
      name: '1024 tablet landscape en after hours remains reachable',
      size: Size(1024, 768),
      locale: 'en',
      textScale: 1,
      mode: JurisVisualMode.afterHours,
    ),
  ];
  for (final state in accessibilityMatrix) {
    testWidgets(
      state.name,
      (WidgetTester tester) async {
        final SemanticsHandle semantics = tester.ensureSemantics();
        int launchCount = 0;
        final JurisVisualModeController visualModeController =
            JurisVisualModeController.fixed(state.mode);
        addTearDown(visualModeController.dispose);
        await _pumpCatalogue(
          tester,
          size: state.size,
          bundle: bundle,
          manifest: manifest,
          initialLocale: state.locale,
          textScale: state.textScale,
          reducedMotion: true,
          visualModeController: visualModeController,
          onStartCase: (_, __, ___) => launchCount += 1,
        );

        final BuildContext catalogueContext = tester.element(
          find.byKey(const ValueKey<String>('catalog-visual-mode-action')),
        );
        expect(
          Theme.of(catalogueContext).extension<JurisSurfaces>()!.canvas,
          JurisSurfaces.forMode(state.mode).canvas,
        );

        final CaseIndex selector = await _revealCaseIndex(tester);
        _expectBuiltCaseIndexGeometryParity(
          tester,
          locale: state.locale,
        );
        expect(tester.takeException(), isNull);
        if (selector.vertical) {
          final Finder firstRow = find.byKey(
            const ValueKey<String>('case-index-item-$_failedErpId'),
          );
          expect(firstRow, findsOneWidget);
          await _revealSelectorControl(tester, firstRow);
          expect(tester.getSize(firstRow).height, greaterThanOrEqualTo(48));
          await _tabTo(tester, firstRow);
          await tester.sendKeyEvent(LogicalKeyboardKey.end);
          await tester.pumpAndSettle();
          _expectSelectedCase(bundle, _desertWaterId, state.locale);
          final Finder lastRow = find.byKey(
            const ValueKey<String>('case-index-item-$_desertWaterId'),
          );
          await _revealSelectorControl(tester, lastRow);
          expect(lastRow.hitTestable(), findsOneWidget);
          expect(_primaryFocusIsWithin(lastRow), isTrue);
        } else {
          final Finder previous = find.byKey(
            const ValueKey<String>('case-index-previous'),
          );
          final Finder next = find.byKey(
            const ValueKey<String>('case-index-next'),
          );
          final Finder browse = find.byKey(
            const ValueKey<String>('browse-all-cases'),
          );
          for (final Finder target in <Finder>[previous, next]) {
            expect(tester.getSize(target).height, greaterThanOrEqualTo(48));
            expect(tester.getSize(target).width, greaterThanOrEqualTo(48));
            expect(tester.getSemantics(target).label, isNotEmpty);
          }
          expect(find.text('01 / 05'), findsWidgets);
          await _revealSelectorControl(tester, next);
          await tester.tap(
            find.descendant(of: next, matching: find.byType(IconButton)),
          );
          await tester.pumpAndSettle();
          _expectSelectedCase(bundle, _logisticsId, state.locale);
          expect(find.text('02 / 05'), findsWidgets);
          await _revealSelectorControl(tester, browse);
          expect(browse.hitTestable(), findsOneWidget);
          expect(tester.getSize(browse).height, greaterThanOrEqualTo(48));
          expect(tester.getSemantics(browse).label, isNotEmpty);
        }

        for (final String keyValue in <String>[
          'start-case-action',
          'case-details-action',
        ]) {
          final Finder action = find.byKey(ValueKey<String>(keyValue));
          await _revealCatalogueAction(tester, action);
          expect(action.hitTestable(), findsOneWidget);
          expect(tester.getSize(action).height, greaterThanOrEqualTo(48));
          expect(tester.getSize(action).width, greaterThanOrEqualTo(48));
          expect(tester.takeException(), isNull);
        }
        expect(launchCount, 0);
        expect(tester.binding.transientCallbackCount, 0);
        semantics.dispose();
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
  JurisVisualModeController? visualModeController,
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
        visualModeController: visualModeController,
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
  JurisVisualModeController? visualModeController,
  CaseStartCallback onStartCase = _ignoreStart,
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
        visualModeController: visualModeController,
        onLocaleChanged: (_) {},
        onStartCase: onStartCase,
      ),
    ),
  );
  await tester.pump();
  await tester.pump(const Duration(milliseconds: 1));
  await tester.pump(const Duration(milliseconds: 400));
}

Future<void> _selectCase(WidgetTester tester, String caseId) async {
  final CaseIndex selector = await _revealCaseIndex(tester);
  if (selector.vertical) {
    await _selectWideCase(tester, caseId, selector);
    return;
  }
  final Finder item = find.byKey(
    ValueKey<String>('case-index-item-$caseId'),
  );
  if (item.evaluate().length == 1 &&
      item.hitTestable().evaluate().length == 1) {
    await tester.tap(item);
  } else if (find
      .byKey(const ValueKey<String>('browse-all-cases'))
      .evaluate()
      .isNotEmpty) {
    final Finder browse = find.byKey(
      const ValueKey<String>('browse-all-cases'),
    );
    await tester.ensureVisible(browse);
    await tester.pump();
    await tester.tap(browse);
    await tester.pumpAndSettle();
    await tester.tap(find.byKey(ValueKey<String>('browse-case-$caseId')));
  } else {
    await tester.ensureVisible(item);
    await tester.pump();
    await tester.tap(item);
  }
  await tester.pumpAndSettle();
}

Future<void> _selectWideCase(
  WidgetTester tester,
  String caseId,
  CaseIndex selector,
) async {
  final List<String> visibleIds = selector.cases
      .map((MobileCaseDefinition item) => item.caseId)
      .toList(growable: false);
  final int targetIndex = visibleIds.indexOf(caseId);
  expect(
    targetIndex,
    greaterThanOrEqualTo(0),
    reason: 'Target $caseId must be in the player-visible wide index.',
  );

  final String currentId = selector.selectedCaseId ?? visibleIds.first;
  final Finder currentRow = find.byKey(
    ValueKey<String>('case-index-item-$currentId'),
  );
  expect(currentRow, findsOneWidget);
  expect(currentRow.hitTestable(), findsOneWidget);
  await _tabTo(tester, currentRow);

  final List<String> visitedIds = <String>[];
  await tester.sendKeyEvent(LogicalKeyboardKey.home);
  await tester.pumpAndSettle();
  String selectedId = _selectedCaseId();
  visitedIds.add(selectedId);
  if (selectedId != visibleIds.first) {
    fail(
      'Wide Home navigation did not reach the first case. '
      'current=$selectedId target=$caseId visited=$visitedIds',
    );
  }
  _expectWideSelection(tester, selector.bundle, visibleIds.first);

  for (int position = 1; position <= targetIndex; position += 1) {
    await tester.sendKeyEvent(LogicalKeyboardKey.arrowDown);
    await tester.pumpAndSettle();
    selectedId = _selectedCaseId();
    visitedIds.add(selectedId);
    if (selectedId != visibleIds[position]) {
      fail(
        'Bounded wide navigation diverged. current=$selectedId '
        'target=$caseId visited=$visitedIds',
      );
    }
    _expectWideSelection(tester, selector.bundle, visibleIds[position]);
  }

  if (selectedId != caseId) {
    fail(
      'Wide target was not reached within ${visibleIds.length} steps. '
      'current=$selectedId target=$caseId visited=$visitedIds',
    );
  }
}

String _selectedCaseId() {
  final CaseIndex selector =
      find.byType(CaseIndex).evaluate().single.widget as CaseIndex;
  final String? selectedCaseId = selector.selectedCaseId;
  if (selectedCaseId == null) {
    fail('The player-visible case index has no selected stable case ID.');
  }
  return selectedCaseId;
}

void _expectWideSelection(
  WidgetTester tester,
  CaseCatalogBundle bundle,
  String caseId,
) {
  final CaseIndex selector = tester.widget<CaseIndex>(find.byType(CaseIndex));
  expect(selector.selectedCaseId, caseId);
  final Finder row = find.byKey(
    ValueKey<String>('case-index-item-$caseId'),
  );
  expect(row, findsOneWidget);
  expect(row.hitTestable(), findsOneWidget);
  expect(_primaryFocusIsWithin(row), isTrue);
  _expectSelectedCase(bundle, caseId, selector.locale);
}

IconButton _boundaryButton(WidgetTester tester, String key) {
  return tester.widget<IconButton>(
    find.descendant(
      of: find.byKey(ValueKey<String>(key)),
      matching: find.byType(IconButton),
    ),
  );
}

Future<void> _tapBoundary(WidgetTester tester, String key) async {
  await tester.tap(
    find.descendant(
      of: find.byKey(ValueKey<String>(key)),
      matching: find.byType(IconButton),
    ),
  );
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

void _expectCatalogueMode(
  WidgetTester tester,
  JurisVisualMode expected,
) {
  final BuildContext panelContext = tester.element(
    find.byKey(const ValueKey<String>('selected-case-panel')),
  );
  expect(
    Theme.of(panelContext).extension<JurisSurfaces>()!.canvas,
    JurisSurfaces.forMode(expected).canvas,
  );
}

Future<void> _selectCatalogueVisualMode(
  WidgetTester tester,
  JurisVisualModeSelection selection,
) async {
  final Finder action = find.byKey(
    const ValueKey<String>('catalog-visual-mode-action'),
  );
  expect(action.hitTestable(), findsOneWidget);
  await tester.tap(action);
  await tester.pumpAndSettle();
  final Finder option = find.byKey(
    ValueKey<String>('catalog-visual-mode-${selection.name}'),
  );
  expect(option.hitTestable(), findsOneWidget);
  await tester.tap(option);
  await tester.pumpAndSettle();
}

Future<void> _revealMastheadControl(
  WidgetTester tester,
  Finder target,
) async {
  final Finder viewport = find.byKey(
    const PageStorageKey<String>('case-catalog'),
  );
  final ScrollableState scrollable = tester.state<ScrollableState>(
    _catalogueScrollable(),
  );
  for (int gesture = 0; gesture <= _catalogueRevealMaximumSteps; gesture++) {
    if (target.evaluate().length == 1 &&
        target.hitTestable().evaluate().length == 1) {
      return;
    }
    if (gesture == _catalogueRevealMaximumSteps) {
      break;
    }
    final double before = scrollable.position.pixels;
    await tester.drag(
      viewport,
      const Offset(0, _catalogueRevealGestureDistance),
    );
    await tester.pumpAndSettle();
    if (target.evaluate().length == 1 &&
        target.hitTestable().evaluate().length == 1) {
      return;
    }
    if (scrollable.position.pixels >= before - 0.5 &&
        scrollable.position.pixels <= scrollable.position.minScrollExtent) {
      break;
    }
  }
  fail(
    'Could not reveal masthead control through public scrolling; '
    'built=${target.evaluate().length} '
    'hitTestable=${target.hitTestable().evaluate().length} '
    'pixels=${scrollable.position.pixels} '
    'min=${scrollable.position.minScrollExtent}.',
  );
}

void _expectFocusOutlineVisible(WidgetTester tester, Finder outline) {
  expect(outline, findsOneWidget);
  final Finder animatedContainer = find.descendant(
    of: outline,
    matching: find.byType(AnimatedContainer),
  );
  expect(animatedContainer, findsOneWidget);
  final AnimatedContainer widget = tester.widget<AnimatedContainer>(
    animatedContainer,
  );
  final BoxDecoration decoration = widget.decoration! as BoxDecoration;
  final Border border = decoration.border! as Border;
  final JurisSurfaces surfaces =
      Theme.of(tester.element(outline)).extension<JurisSurfaces>()!;
  expect(border.top.color, surfaces.focusRing);
  expect(border.top.width, JurisBorders.standardWeights.focus);
}

Future<void> _revealSelectorControl(
  WidgetTester tester,
  Finder target,
) async {
  await _boundedCatalogueReveal(
    tester,
    description: target.toString(),
    isVisible: () =>
        target.evaluate().length == 1 &&
        target.hitTestable().evaluate().length == 1,
    finderState: () => 'built=${target.evaluate().length} '
        'hitTestable=${target.hitTestable().evaluate().length}',
  );
  expect(target, findsOneWidget);
  expect(target.hitTestable(), findsOneWidget);
}

const int _catalogueRevealMaximumSteps = 12;
const double _catalogueRevealGestureDistance = 240;
const Offset _catalogueRevealGesture = Offset(
  0,
  -_catalogueRevealGestureDistance,
);

Future<void> _revealCatalogueAction(
  WidgetTester tester,
  Finder target,
) async {
  final Finder viewport = find.byKey(
    const PageStorageKey<String>('case-catalog'),
  );
  final Finder scrollableFinder = _catalogueScrollable();
  if (viewport.evaluate().length != 1 ||
      scrollableFinder.evaluate().length != 1) {
    fail(
      'Cannot reveal catalogue action: '
      'viewport=${viewport.evaluate().length} '
      'outerScrollable=${scrollableFinder.evaluate().length}.',
    );
  }
  final ScrollableState scrollable =
      tester.state<ScrollableState>(scrollableFinder);
  final ScrollPosition initialPosition = scrollable.position;
  if (!initialPosition.hasContentDimensions) {
    fail('Catalogue action reveal requires complete outer scroll dimensions.');
  }
  final double initialRemaining =
      initialPosition.maxScrollExtent > initialPosition.pixels
          ? initialPosition.maxScrollExtent - initialPosition.pixels
          : 0;
  final int maximumGestures =
      (initialRemaining / _catalogueRevealGestureDistance).ceil();
  final int maximumChecks = maximumGestures + 1;

  for (int check = 0; check < maximumChecks; check += 1) {
    final int built = target.evaluate().length;
    final int hitTestable = target.hitTestable().evaluate().length;
    if (built > 1 || hitTestable > 1) {
      fail(
        'Catalogue action identity is ambiguous. '
        '${_actionRevealDiagnostics(
          scrollable,
          target,
          initialRemaining: initialRemaining,
          maximumGestures: maximumGestures,
          completedGestures: check,
          completedChecks: check + 1,
        )}',
      );
    }
    if (_isExactHitTestable(target)) {
      return;
    }
    if (check == maximumGestures) {
      break;
    }
    final double before = scrollable.position.pixels;
    await tester.drag(viewport, _catalogueRevealGesture);
    await tester.pumpAndSettle();
    if (_isExactHitTestable(target)) {
      return;
    }
    final double after = scrollable.position.pixels;
    if (after <= before + 0.5) {
      fail(
        'Player-visible action reveal stalled. '
        '${_actionRevealDiagnostics(
          scrollable,
          target,
          initialRemaining: initialRemaining,
          maximumGestures: maximumGestures,
          completedGestures: check + 1,
          completedChecks: check + 2,
        )}',
      );
    }
  }

  fail(
    'Player-visible action reveal exhausted its ScrollPosition-derived bound. '
    '${_actionRevealDiagnostics(
      scrollable,
      target,
      initialRemaining: initialRemaining,
      maximumGestures: maximumGestures,
      completedGestures: maximumGestures,
      completedChecks: maximumChecks,
    )}',
  );
}

bool _isExactHitTestable(Finder target) {
  return target.evaluate().length == 1 &&
      target.hitTestable().evaluate().length == 1;
}

String _actionRevealDiagnostics(
  ScrollableState scrollable,
  Finder target, {
  required double initialRemaining,
  required int maximumGestures,
  required int completedGestures,
  required int completedChecks,
}) {
  final ScrollPosition position = scrollable.position;
  final double remaining = position.maxScrollExtent > position.pixels
      ? position.maxScrollExtent - position.pixels
      : 0;
  return '${_catalogueRevealEnvironment(scrollable)} '
      'remaining=${remaining.toStringAsFixed(1)} '
      'initialRemaining=${initialRemaining.toStringAsFixed(1)} '
      'gestures=$completedGestures/$maximumGestures '
      'checks=$completedChecks/${maximumGestures + 1} '
      'built=${target.evaluate().length} '
      'hitTestable=${target.hitTestable().evaluate().length}';
}

Future<CaseIndex> _revealCaseIndex(WidgetTester tester) async {
  final Finder selectorWidget = find.byType(CaseIndex);
  final Finder selectorRoot = find.byKey(
    const ValueKey<String>('case-index'),
  );
  final Finder publicSurfaces = find.descendant(
    of: selectorRoot,
    matching: find.byWidgetPredicate((Widget widget) {
      final Key? key = widget.key;
      if (key is! ValueKey<String>) {
        return false;
      }
      final String value = key.value;
      return value.startsWith('case-index-item-') ||
          value == 'case-index-previous' ||
          value == 'case-index-next' ||
          value == 'browse-all-cases';
    }),
  );

  await _boundedCatalogueReveal(
    tester,
    description: 'public case selector',
    isVisible: () =>
        selectorWidget.evaluate().length == 1 &&
        selectorRoot.evaluate().length == 1 &&
        publicSurfaces.hitTestable().evaluate().isNotEmpty,
    finderState: () => 'CaseIndex=${selectorWidget.evaluate().length} '
        'selectorRoot=${selectorRoot.evaluate().length} '
        'publicSurfaces=${publicSurfaces.evaluate().length} '
        'hitTestable=${publicSurfaces.hitTestable().evaluate().length}',
  );

  expect(selectorWidget, findsOneWidget);
  expect(selectorRoot, findsOneWidget);
  expect(publicSurfaces.hitTestable(), findsAtLeastNWidgets(1));
  return tester.widget<CaseIndex>(selectorWidget);
}

Future<void> _boundedCatalogueReveal(
  WidgetTester tester, {
  required String description,
  required bool Function() isVisible,
  required String Function() finderState,
}) async {
  final Finder viewport = find.byKey(
    const PageStorageKey<String>('case-catalog'),
  );
  final Finder scrollableFinder = _catalogueScrollable();
  if (viewport.evaluate().length != 1 ||
      scrollableFinder.evaluate().length != 1) {
    fail(
      'Cannot reveal $description: viewport=${viewport.evaluate().length} '
      'outerScrollable=${scrollableFinder.evaluate().length}.',
    );
  }
  final ScrollableState scrollable =
      tester.state<ScrollableState>(scrollableFinder);

  for (int step = 0; step <= _catalogueRevealMaximumSteps; step += 1) {
    if (isVisible()) {
      return;
    }
    final String diagnostic = '${_catalogueRevealEnvironment(scrollable)} '
        'step=$step/$_catalogueRevealMaximumSteps ${finderState()}';
    if (step == _catalogueRevealMaximumSteps) {
      fail('Bounded reveal exhausted for $description. $diagnostic');
    }

    final double before = scrollable.position.pixels;
    await tester.drag(viewport, _catalogueRevealGesture);
    await tester.pumpAndSettle();
    final double after = scrollable.position.pixels;
    if (isVisible()) {
      return;
    }
    if (after <= before + 0.5) {
      fail(
        'Player-visible scrolling stalled while revealing $description. '
        'before=$before after=$after $diagnostic',
      );
    }
  }
}

String _catalogueRevealEnvironment(ScrollableState scrollable) {
  final MediaQueryData media = MediaQuery.of(scrollable.context);
  final ScrollPosition position = scrollable.position;
  final String locale =
      Localizations.localeOf(scrollable.context).toLanguageTag();
  final double effectiveTextScale = media.textScaler.scale(16) / 16;
  return 'viewport=${media.size.width.toStringAsFixed(0)}x'
      '${media.size.height.toStringAsFixed(0)} locale=$locale '
      'textScale=${effectiveTextScale.toStringAsFixed(2)} '
      'scroll=${position.pixels.toStringAsFixed(1)}/'
      '${position.maxScrollExtent.toStringAsFixed(1)}';
}

void _expectBuiltCaseIndexGeometryParity(
  WidgetTester tester, {
  required String locale,
}) {
  for (final String caseId in _authoritativeCaseIds) {
    final Finder itemFinder = find.byKey(
      ValueKey<String>('case-index-item-$caseId'),
    );
    if (itemFinder.evaluate().length == 1) {
      _expectCaseIndexCardGeometryParity(
        tester,
        caseId: caseId,
        locale: locale,
      );
    }
  }
}

void _expectCaseIndexCardGeometryParity(
  WidgetTester tester, {
  required String caseId,
  required String locale,
}) {
  final Finder itemFinder = find.byKey(
    ValueKey<String>('case-index-item-$caseId'),
  );
  final Finder contentFinder = find.byKey(
    ValueKey<String>('case-index-content-$caseId'),
  );
  final Finder markFinder = find.byKey(
    ValueKey<String>('case-index-mark-$caseId'),
  );
  final Finder titleFinder = find.byKey(
    ValueKey<String>('case-index-title-$caseId'),
  );
  final Finder topicFinder = find.byKey(
    ValueKey<String>('case-index-topic-$caseId'),
  );
  for (final Finder finder in <Finder>[
    itemFinder,
    contentFinder,
    markFinder,
    titleFinder,
    topicFinder,
  ]) {
    if (finder.evaluate().length != 1) {
      fail(
        'Full-card diagnostic requires one presentation role for $finder; '
        'found ${finder.evaluate().length}.',
      );
    }
  }

  final RenderBox itemBox = tester.renderObject<RenderBox>(itemFinder);
  final Semantics itemSemantics = tester.widget<Semantics>(itemFinder);
  final bool selected = itemSemantics.properties.selected ?? false;
  final RenderBox contentBox = tester.renderObject<RenderBox>(contentFinder);
  final RenderBox markBox = tester.renderObject<RenderBox>(markFinder);
  final RenderParagraph titleParagraph =
      tester.renderObject<RenderParagraph>(titleFinder);
  final RenderParagraph topicParagraph =
      tester.renderObject<RenderParagraph>(topicFinder);
  final List<RenderParagraph> markParagraphs = find
      .descendant(of: markFinder, matching: find.byType(RichText))
      .evaluate()
      .map((Element element) => element.renderObject)
      .whereType<RenderParagraph>()
      .toList(growable: false);
  if (markParagraphs.length != 2) {
    fail(
      'Full-card diagnostic requires two mark paragraphs; '
      'found ${markParagraphs.length}.',
    );
  }
  final RenderParagraph positionParagraph = markParagraphs.first;
  final RenderParagraph jurisdictionParagraph = markParagraphs.last;

  final BuildContext context = tester.element(titleFinder);
  final ThemeData theme = Theme.of(context);
  final JurisSpacing spacing = theme.extension<JurisSpacing>()!;
  final JurisBorders borders = theme.extension<JurisBorders>()!;
  final JurisTypography typography = theme.extension<JurisTypography>()!;
  final TextScaler textScaler = MediaQuery.textScalerOf(context);
  final TextDirection textDirection = Directionality.of(context);
  final Locale? resolvedLocale = Localizations.maybeLocaleOf(context);
  final double maximumBorderInset = borders.focus + borders.emphasis;
  final double estimatorContentWidth = math.max(
    1,
    itemBox.size.width - (2 * maximumBorderInset) - (2 * spacing.md),
  );
  final double estimatorMarkInnerWidth = math.max(
    1,
    estimatorContentWidth - (2 * spacing.md),
  );

  final _DiagnosticParagraphGeometry actualPosition =
      _diagnoseRenderParagraph(positionParagraph);
  final _DiagnosticParagraphGeometry actualJurisdiction =
      _diagnoseRenderParagraph(jurisdictionParagraph);
  final _DiagnosticParagraphGeometry actualTitle =
      _diagnoseRenderParagraph(titleParagraph);
  final _DiagnosticParagraphGeometry actualTopic =
      _diagnoseRenderParagraph(topicParagraph);
  final _DiagnosticParagraphGeometry estimatedPosition =
      _diagnoseEstimatedParagraph(
    actualPosition.text,
    typography.caseIndex,
    textScaler: textScaler,
    textDirection: textDirection,
    locale: resolvedLocale,
    maxWidth: estimatorMarkInnerWidth,
  );
  final _DiagnosticParagraphGeometry estimatedJurisdiction =
      _diagnoseEstimatedParagraph(
    actualJurisdiction.text,
    typography.metadata,
    textScaler: textScaler,
    textDirection: textDirection,
    locale: resolvedLocale,
    maxWidth: math.min(180, estimatorMarkInnerWidth),
    maxLines: 1,
    ellipsis: '\u2026',
  );
  final _DiagnosticParagraphGeometry estimatedTitle =
      _diagnoseEstimatedParagraph(
    actualTitle.text,
    theme.textTheme.titleMedium ?? const TextStyle(),
    textScaler: textScaler,
    textDirection: textDirection,
    locale: resolvedLocale,
    maxWidth: estimatorContentWidth,
  );
  final _DiagnosticParagraphGeometry estimatedTopic =
      _diagnoseEstimatedParagraph(
    actualTopic.text,
    theme.textTheme.bodySmall ?? const TextStyle(),
    textScaler: textScaler,
    textDirection: textDirection,
    locale: resolvedLocale,
    maxWidth: estimatorContentWidth,
  );

  final double requiredMarkRunWidth =
      estimatedPosition.size.width.ceilToDouble() +
          spacing.sm +
          estimatedJurisdiction.size.width.ceilToDouble();
  final double availableMarkRunWidth = math
      .max(
        0,
        estimatorMarkInnerWidth - 0.5,
      )
      .floorToDouble();
  final bool estimatedMarkWraps = requiredMarkRunWidth > availableMarkRunWidth;
  final double estimatedMarkTextHeight = estimatedMarkWraps
      ? estimatedPosition.size.height +
          spacing.xs +
          estimatedJurisdiction.size.height
      : math.max(
          estimatedPosition.size.height,
          estimatedJurisdiction.size.height,
        );
  final double estimatedMarkHeight = (2 * spacing.sm) + estimatedMarkTextHeight;
  final double actualCardBorder =
      selected ? borders.emphasis : borders.standard;
  final double actualNaturalExtent = (2 * (borders.focus + actualCardBorder)) +
      (2 * spacing.md) +
      markBox.size.height +
      spacing.sm +
      titleParagraph.size.height +
      spacing.xs +
      topicParagraph.size.height;
  final double estimatedSelectedExtent = (2 * maximumBorderInset) +
      (2 * spacing.md) +
      estimatedMarkHeight +
      spacing.sm +
      estimatedTitle.size.height +
      spacing.xs +
      estimatedTopic.size.height;
  final String firstDivergence = _firstGeometryDivergence(
    actualMarkHeight: markBox.size.height,
    estimatedMarkHeight: estimatedMarkHeight,
    actualTitle: actualTitle,
    estimatedTitle: estimatedTitle,
    actualTopic: actualTopic,
    estimatedTopic: estimatedTopic,
    estimatorTitleWidth: estimatorContentWidth,
    estimatorTopicWidth: estimatorContentWidth,
    actualNaturalExtent: actualNaturalExtent,
    measuredItemExtent: itemBox.size.height,
  );
  const double tolerance = 0.01;
  expect(
    estimatorContentWidth,
    lessThanOrEqualTo(titleParagraph.constraints.maxWidth + tolerance),
    reason: '$locale/$caseId title estimator width must be conservative.',
  );
  expect(
    estimatorContentWidth,
    lessThanOrEqualTo(topicParagraph.constraints.maxWidth + tolerance),
    reason: '$locale/$caseId topic estimator width must be conservative.',
  );
  expect(
    estimatedMarkHeight + tolerance,
    greaterThanOrEqualTo(markBox.size.height),
    reason: '$locale/$caseId mark estimator must contain rendered mark.',
  );
  expect(
    estimatedTitle.lineHeights.length,
    greaterThanOrEqualTo(actualTitle.lineHeights.length),
    reason: '$locale/$caseId title estimator cannot lose rendered lines.',
  );
  expect(
    estimatedTitle.size.height + tolerance,
    greaterThanOrEqualTo(actualTitle.renderSize.height),
    reason: '$locale/$caseId title estimator must contain rendered text.',
  );
  expect(
    estimatedTopic.lineHeights.length,
    greaterThanOrEqualTo(actualTopic.lineHeights.length),
    reason: '$locale/$caseId topic estimator cannot lose rendered lines.',
  );
  expect(
    estimatedTopic.size.height + tolerance,
    greaterThanOrEqualTo(actualTopic.renderSize.height),
    reason: '$locale/$caseId topic estimator must contain rendered text.',
  );
  expect(
    estimatedSelectedExtent + tolerance,
    greaterThanOrEqualTo(actualNaturalExtent),
    reason: '$locale/$caseId estimated card must contain natural geometry.',
  );
  expect(
    itemBox.size.height + tolerance,
    greaterThanOrEqualTo(actualNaturalExtent),
    reason: '$locale/$caseId fixed item extent must contain natural geometry.',
  );
  expect(
    contentBox.constraints.maxWidth,
    greaterThanOrEqualTo(estimatorContentWidth),
  );
  expect(firstDivergence, 'OTHER',
      reason: '$locale/$caseId geometry diverged.');
}

_DiagnosticParagraphGeometry _diagnoseRenderParagraph(
  RenderParagraph paragraph,
) {
  final double layoutMaxWidth =
      paragraph.softWrap || paragraph.overflow == TextOverflow.ellipsis
          ? paragraph.constraints.maxWidth
          : double.infinity;
  final TextPainter painter = TextPainter(
    text: paragraph.text,
    textAlign: paragraph.textAlign,
    textDirection: paragraph.textDirection,
    textScaler: paragraph.textScaler,
    maxLines: paragraph.maxLines,
    ellipsis: paragraph.overflow == TextOverflow.ellipsis ? '\u2026' : null,
    locale: paragraph.locale,
    strutStyle: paragraph.strutStyle,
    textWidthBasis: paragraph.textWidthBasis,
    textHeightBehavior: paragraph.textHeightBehavior,
  )..layout(
      minWidth: paragraph.constraints.minWidth,
      maxWidth: layoutMaxWidth,
    );
  final _DiagnosticParagraphGeometry geometry = _DiagnosticParagraphGeometry(
    text: paragraph.text.toPlainText(),
    size: painter.size,
    renderSize: paragraph.size,
    maxWidth: paragraph.constraints.maxWidth,
    lineHeights: painter
        .computeLineMetrics()
        .map((line) => line.height)
        .toList(growable: false),
    style: paragraph.text.style,
    textScaler: paragraph.textScaler,
    locale: paragraph.locale,
    textDirection: paragraph.textDirection,
    maxLines: paragraph.maxLines,
    softWrap: paragraph.softWrap,
    overflow: paragraph.overflow,
    textWidthBasis: paragraph.textWidthBasis,
    textHeightBehavior: paragraph.textHeightBehavior,
    strutStyle: paragraph.strutStyle,
  );
  painter.dispose();
  return geometry;
}

_DiagnosticParagraphGeometry _diagnoseEstimatedParagraph(
  String text,
  TextStyle style, {
  required TextScaler textScaler,
  required TextDirection textDirection,
  required Locale? locale,
  required double maxWidth,
  int? maxLines,
  String? ellipsis,
}) {
  final TextPainter painter = TextPainter(
    text: TextSpan(text: text, style: style),
    textDirection: textDirection,
    textScaler: textScaler,
    locale: locale,
    maxLines: maxLines,
    ellipsis: ellipsis,
  )..layout(maxWidth: maxWidth);
  final _DiagnosticParagraphGeometry geometry = _DiagnosticParagraphGeometry(
    text: text,
    size: painter.size,
    renderSize: painter.size,
    maxWidth: maxWidth,
    lineHeights: painter
        .computeLineMetrics()
        .map((line) => line.height)
        .toList(growable: false),
    style: style,
    textScaler: textScaler,
    locale: locale,
    textDirection: textDirection,
    maxLines: maxLines,
    softWrap: true,
    overflow: ellipsis == null ? TextOverflow.clip : TextOverflow.ellipsis,
    textWidthBasis: TextWidthBasis.parent,
    textHeightBehavior: null,
    strutStyle: null,
  );
  painter.dispose();
  return geometry;
}

String _firstGeometryDivergence({
  required double actualMarkHeight,
  required double estimatedMarkHeight,
  required _DiagnosticParagraphGeometry actualTitle,
  required _DiagnosticParagraphGeometry estimatedTitle,
  required _DiagnosticParagraphGeometry actualTopic,
  required _DiagnosticParagraphGeometry estimatedTopic,
  required double estimatorTitleWidth,
  required double estimatorTopicWidth,
  required double actualNaturalExtent,
  required double measuredItemExtent,
}) {
  const double tolerance = 0.01;
  if ((actualMarkHeight - estimatedMarkHeight).abs() > tolerance) {
    return 'MARK_HEIGHT';
  }
  if (estimatorTitleWidth > actualTitle.maxWidth + tolerance) {
    return 'TITLE_WIDTH';
  }
  if (!_sameMetricStyle(actualTitle.style, estimatedTitle.style)) {
    return 'TITLE_STYLE';
  }
  if (actualTitle.lineHeights.length != estimatedTitle.lineHeights.length) {
    return 'TITLE_LINE_COUNT';
  }
  if ((actualTitle.renderSize.height - estimatedTitle.size.height).abs() >
      tolerance) {
    return 'TITLE_HEIGHT';
  }
  if (estimatorTopicWidth > actualTopic.maxWidth + tolerance) {
    return 'TOPIC_WIDTH';
  }
  if (!_sameMetricStyle(actualTopic.style, estimatedTopic.style)) {
    return 'TOPIC_STYLE';
  }
  if (actualTopic.lineHeights.length != estimatedTopic.lineHeights.length) {
    return 'TOPIC_LINE_COUNT';
  }
  if ((actualTopic.renderSize.height - estimatedTopic.size.height).abs() >
      tolerance) {
    return 'TOPIC_HEIGHT';
  }
  if (actualNaturalExtent > measuredItemExtent + tolerance) {
    return 'PADDING_OR_GAP';
  }
  return 'OTHER';
}

bool _sameMetricStyle(TextStyle? actual, TextStyle? estimated) {
  return actual?.fontFamily == estimated?.fontFamily &&
      actual?.fontSize == estimated?.fontSize &&
      actual?.height == estimated?.height &&
      actual?.fontWeight == estimated?.fontWeight &&
      actual?.letterSpacing == estimated?.letterSpacing &&
      actual?.inherit == estimated?.inherit;
}

final class _DiagnosticParagraphGeometry {
  const _DiagnosticParagraphGeometry({
    required this.text,
    required this.size,
    required this.renderSize,
    required this.maxWidth,
    required this.lineHeights,
    required this.style,
    required this.textScaler,
    required this.locale,
    required this.textDirection,
    required this.maxLines,
    required this.softWrap,
    required this.overflow,
    required this.textWidthBasis,
    required this.textHeightBehavior,
    required this.strutStyle,
  });

  final String text;
  final Size size;
  final Size renderSize;
  final double maxWidth;
  final List<double> lineHeights;
  final TextStyle? style;
  final TextScaler textScaler;
  final Locale? locale;
  final TextDirection textDirection;
  final int? maxLines;
  final bool softWrap;
  final TextOverflow overflow;
  final TextWidthBasis textWidthBasis;
  final TextHeightBehavior? textHeightBehavior;
  final StrutStyle? strutStyle;
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

Future<List<String>> _restoreStartFocusThroughVisibleActions(
  WidgetTester tester, {
  required Finder startAction,
  required Finder detailsAction,
}) async {
  final Map<String, Finder> candidates = <String, Finder>{
    'start-case-action': startAction,
    'case-details-action': detailsAction,
  };
  final Map<String, Finder> visibleActions = <String, Finder>{};
  for (final MapEntry<String, Finder> entry in candidates.entries) {
    final int built = entry.value.evaluate().length;
    final int hitTestable = entry.value.hitTestable().evaluate().length;
    if (built > 1 || hitTestable > 1) {
      fail(
        'Action ${entry.key} is ambiguous: '
        'built=$built hitTestable=$hitTestable.',
      );
    }
    if (built == 1 && hitTestable == 1) {
      visibleActions[entry.key] = entry.value;
    }
  }
  if (!visibleActions.containsKey('start-case-action')) {
    fail(
      'Start is not player-visible before focus restoration. '
      'visible=${visibleActions.keys.toList(growable: false)} '
      'primary=${_primaryFocusDescription()}',
    );
  }

  final int maximumTraversalKeys = visibleActions.length + 1;
  final List<String> visitedOwners = <String>[
    _visibleActionFocusOwner(visibleActions),
  ];
  for (int traversalCount = 0;
      traversalCount < maximumTraversalKeys;
      traversalCount += 1) {
    if (_primaryFocusIsWithin(startAction)) {
      return List<String>.unmodifiable(visitedOwners);
    }
    await tester.sendKeyDownEvent(LogicalKeyboardKey.shiftLeft);
    try {
      await tester.sendKeyEvent(LogicalKeyboardKey.tab);
    } finally {
      await tester.sendKeyUpEvent(LogicalKeyboardKey.shiftLeft);
    }
    await tester.pumpAndSettle();
    visitedOwners.add(_visibleActionFocusOwner(visibleActions));
    if (_primaryFocusIsWithin(startAction)) {
      return List<String>.unmodifiable(visitedOwners);
    }
  }

  fail(
    'Start focus was not restored within $maximumTraversalKeys public '
    'reverse-traversal keys. current=${_primaryFocusDescription()} '
    'visited=$visitedOwners '
    'visible=${visibleActions.keys.toList(growable: false)}',
  );
}

String _visibleActionFocusOwner(Map<String, Finder> visibleActions) {
  for (final MapEntry<String, Finder> entry in visibleActions.entries) {
    if (_primaryFocusIsWithin(entry.value)) {
      return entry.key;
    }
  }
  return _primaryFocusDescription();
}

String _primaryFocusDescription() {
  final FocusNode? focus = FocusManager.instance.primaryFocus;
  final Widget? owner = focus?.context?.widget;
  return 'outside-actions('
      'debugLabel=${focus?.debugLabel ?? '<none>'}, '
      'widget=${owner?.runtimeType ?? '<none>'})';
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
  final CaseIndex index =
      find.byType(CaseIndex).evaluate().single.widget as CaseIndex;
  expect(
    index.cases.map((MobileCaseDefinition item) => item.caseId),
    _authoritativeCaseIds,
  );
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
    this.visualModeController,
  });

  final CaseCatalogBundle bundle;
  final CaseVisualManifest manifest;
  final String initialLocale;
  final double textScale;
  final bool highContrast;
  final bool reducedMotion;
  final CaseStartCallback onStartCase;
  final ValueChanged<String>? onLocaleChanged;
  final JurisVisualModeController? visualModeController;

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
        visualModeController: widget.visualModeController,
      ),
    );
  }
}
