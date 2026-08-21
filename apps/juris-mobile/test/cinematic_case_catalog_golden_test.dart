import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:juris_mobile/models/case_catalog.dart';
import 'package:juris_mobile/screens/case_catalog_screen.dart';
import 'package:juris_mobile/visual_identity/case_visual_manifest.dart';
import 'package:juris_mobile/visual_identity/cinematic_catalogue_strings.dart';
import 'package:juris_mobile/widgets/catalogue/case_index.dart';

import 'support/historical_golden_identities.dart';
import 'support/immutable_golden_identity.dart';
import 'support/visual_golden_harness.dart';

const String _failedErpId = 'be_commercial_failed_erp_001';
const String _greenFireId = 'greenfire_first_72_hours';
const String _goldenShellId = 'nl_food_safety_goldenshell_001';
const String _desertWaterId = 'us_environmental_desert_water_001';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  late CaseCatalogBundle bundle;
  late CaseVisualManifest manifest;

  setUpAll(() async {
    expectImmutableGoldenPathSet(historicalCatalogueGoldenSet);
    await loadCatalogueGoldenFonts();
    bundle = CaseCatalogBundle.fromJson(
      jsonDecode(
        await rootBundle.loadString(
          'assets/case_catalog/mobile_case_bundle.json',
        ),
      ) as Map<String, dynamic>,
    );
    manifest = CaseVisualManifest.fromJson(
      jsonDecode(
        await rootBundle.loadString(
          'assets/visual_identity/case_visual_manifest.v1.json',
        ),
      ) as Map<String, dynamic>,
    );
  });

  testWidgets(
    'catalogue compact English starts with the first authoritative case',
    (WidgetTester tester) async {
      await _pumpCatalogueGolden(
        tester,
        bundle: bundle,
        manifest: manifest,
        configuration: const VisualGoldenConfiguration(
          logicalSize: Size(360, 800),
          locale: Locale('en'),
        ),
      );

      expect(
        find.text(bundle.cases.first.localized('en', 'en').caption),
        findsOneWidget,
      );
      expectImmutableGoldenIdentity(
        historicalCatalogueGoldenSet.identityNamed(
          'catalogue_compact_first_en_360x800_dpr1_ts100_hc0_rm0.png',
        ),
      );
    },
  );

  testWidgets(
    'catalogue compact Russian renders the representative long title',
    (WidgetTester tester) async {
      await _pumpCatalogueGolden(
        tester,
        bundle: bundle,
        manifest: manifest,
        configuration: const VisualGoldenConfiguration(
          logicalSize: Size(360, 800),
          locale: Locale('ru'),
        ),
        selectedCaseId: _goldenShellId,
      );

      expect(
        find.descendant(
          of: find.byKey(const ValueKey<String>('selected-case-panel')),
          matching: find.text(
            bundle.cases
                .singleWhere(
                  (MobileCaseDefinition item) => item.caseId == _goldenShellId,
                )
                .localized('ru', 'en')
                .topic,
          ),
        ),
        findsOneWidget,
      );
      expectImmutableGoldenIdentity(
        historicalCatalogueGoldenSet.identityNamed(
          'catalogue_compact_long_title_ru_360x800_dpr1_ts100_hc0_rm0.png',
        ),
      );
    },
  );

  testWidgets(
    'catalogue tall compact English renders GreenFire selected',
    (WidgetTester tester) async {
      await _pumpCatalogueGolden(
        tester,
        bundle: bundle,
        manifest: manifest,
        configuration: const VisualGoldenConfiguration(
          logicalSize: Size(412, 915),
          locale: Locale('en'),
        ),
        selectedCaseId: _greenFireId,
      );

      expectImmutableGoldenIdentity(
        historicalCatalogueGoldenSet.identityNamed(
          'catalogue_compact_greenfire_en_412x915_dpr1_ts100_hc0_rm0.png',
        ),
      );
    },
  );

  testWidgets(
    'catalogue portrait tablet Russian renders the complete index',
    (WidgetTester tester) async {
      await _pumpCatalogueGolden(
        tester,
        bundle: bundle,
        manifest: manifest,
        configuration: const VisualGoldenConfiguration(
          logicalSize: Size(800, 1280),
          locale: Locale('ru'),
        ),
        selectedCaseId: _goldenShellId,
      );

      _expectCompleteIndex(tester, bundle);
      expectImmutableGoldenIdentity(
        historicalCatalogueGoldenSet.identityNamed(
          'catalogue_wide_complete_index_ru_800x1280_dpr1_ts100_hc0_rm0.png',
        ),
      );
    },
  );

  testWidgets(
    'catalogue landscape tablet English renders the complete index',
    (WidgetTester tester) async {
      await _pumpCatalogueGolden(
        tester,
        bundle: bundle,
        manifest: manifest,
        configuration: const VisualGoldenConfiguration(
          logicalSize: Size(1024, 768),
          locale: Locale('en'),
        ),
        selectedCaseId: _desertWaterId,
        ensureCompleteIndex: true,
      );

      _expectCompleteIndex(tester, bundle);
      expectImmutableGoldenIdentity(
        historicalCatalogueGoldenSet.identityNamed(
          'catalogue_wide_complete_index_en_1024x768_dpr1_ts100_hc0_rm0.png',
        ),
      );
    },
  );

  testWidgets(
    'catalogue compact 200 percent reduced motion keeps actions reachable',
    (WidgetTester tester) async {
      await _pumpCatalogueGolden(
        tester,
        bundle: bundle,
        manifest: manifest,
        configuration: const VisualGoldenConfiguration(
          logicalSize: Size(412, 915),
          locale: Locale('en'),
          textScale: 2,
          reducedMotion: true,
        ),
        selectedCaseId: _failedErpId,
      );

      final Finder startAction = find.byKey(
        const ValueKey<String>('start-case-action'),
      );
      final Finder detailsAction = find.byKey(
        const ValueKey<String>('case-details-action'),
      );
      await tester.ensureVisible(startAction);
      await tester.pump();
      expect(startAction.hitTestable(), findsOneWidget);
      await tester.ensureVisible(detailsAction);
      await tester.pump();
      expect(detailsAction.hitTestable(), findsOneWidget);
      expect(tester.binding.transientCallbackCount, 0);

      expectImmutableGoldenIdentity(
        historicalCatalogueGoldenSet.identityNamed(
          'catalogue_compact_actions_en_412x915_dpr1_ts200_hc0_rm1.png',
        ),
      );
    },
  );
}

Future<void> _pumpCatalogueGolden(
  WidgetTester tester, {
  required CaseCatalogBundle bundle,
  required CaseVisualManifest manifest,
  required VisualGoldenConfiguration configuration,
  String? selectedCaseId,
  bool ensureCompleteIndex = false,
}) async {
  await pumpVisualGolden(
    tester,
    configuration: configuration,
    subject: CaseCatalogScreen(
      bundle: bundle,
      visualManifest: manifest,
      initialLocale: configuration.locale.languageCode,
      onStartCase: _ignoreStart,
    ),
  );

  if (selectedCaseId case final String caseId) {
    await _selectCatalogueCase(
      tester,
      bundle: bundle,
      caseId: caseId,
    );
  }
  if (ensureCompleteIndex) {
    await tester.ensureVisible(
      find.byKey(const ValueKey<String>('case-index')),
    );
    await tester.pump();
  }
  _expectSelectedCaseAuthority(
    tester,
    bundle: bundle,
    locale: configuration.locale.languageCode,
    caseId: selectedCaseId ?? bundle.cases.first.caseId,
  );
  expect(find.byKey(const ValueKey<String>('selected-case-panel')), findsOne);
  expect(tester.takeException(), isNull);
  expect(tester.binding.transientCallbackCount, 0);
}

Future<void> _selectCatalogueCase(
  WidgetTester tester, {
  required CaseCatalogBundle bundle,
  required String caseId,
}) async {
  final int targetIndex = bundle.cases.indexWhere(
    (MobileCaseDefinition item) => item.caseId == caseId,
  );
  expect(targetIndex, greaterThanOrEqualTo(0));

  final Finder wideList = find.byKey(
    const ValueKey<String>('wide-case-list'),
  );
  if (wideList.evaluate().isNotEmpty) {
    final Finder target = find.byKey(
      ValueKey<String>('case-index-item-$caseId'),
    );
    final Finder scrollable = find.descendant(
      of: wideList,
      matching: find.byType(Scrollable),
    );
    expect(scrollable, findsOneWidget);
    await tester.scrollUntilVisible(
      target,
      180,
      scrollable: scrollable,
      maxScrolls: bundle.cases.length * 4,
    );
    await tester.pumpAndSettle();
    expect(target.hitTestable(), findsOneWidget);
    await tester.tap(target);
    await tester.pumpAndSettle();
    return;
  }

  final Finder next = find.byKey(
    const ValueKey<String>('case-index-next'),
  );
  for (int index = 0; index < targetIndex; index += 1) {
    expect(next.hitTestable(), findsOneWidget);
    await tester.tap(next);
    await tester.pumpAndSettle();
  }
}

void _expectSelectedCaseAuthority(
  WidgetTester tester, {
  required CaseCatalogBundle bundle,
  required String locale,
  required String caseId,
}) {
  final int selectedIndex = bundle.cases.indexWhere(
    (MobileCaseDefinition item) => item.caseId == caseId,
  );
  expect(selectedIndex, greaterThanOrEqualTo(0));
  final MobileCaseDefinition selected = bundle.cases[selectedIndex];
  final LocalizedCaseText text = selected.localized(
    locale,
    bundle.defaultLocale,
  );
  final String position = CinematicCatalogueStrings.of(
    locale,
  ).casePosition(selectedIndex + 1, bundle.cases.length);

  final Finder selectedItem = find.byKey(
    ValueKey<String>('case-index-item-$caseId'),
  );
  expect(selectedItem, findsOneWidget);
  final Semantics semantics = tester.widget<Semantics>(selectedItem);
  expect(semantics.properties.selected, isTrue);
  expect(semantics.properties.label, contains(position));
  expect(semantics.properties.label, contains(text.shortTitle));

  final Finder selectedHeading = find.byKey(
    const ValueKey<String>('selected-case-heading'),
  );
  expect(selectedHeading, findsOneWidget);
  expect(
    find.descendant(of: selectedHeading, matching: find.text(text.topic)),
    findsOneWidget,
  );
}

void _expectCompleteIndex(WidgetTester tester, CaseCatalogBundle bundle) {
  expect(find.byKey(const ValueKey<String>('case-index')), findsOneWidget);
  expect(find.byKey(const ValueKey<String>('wide-case-list')), findsOneWidget);
  final CaseIndex index = tester.widget<CaseIndex>(find.byType(CaseIndex));
  expect(
    index.cases.map((MobileCaseDefinition item) => item.caseId),
    orderedEquals(
      bundle.cases.map((MobileCaseDefinition item) => item.caseId),
    ),
  );
}

void _ignoreStart(
  MobileCaseDefinition _,
  String __,
  CaseCatalogBundle ___,
) {}
