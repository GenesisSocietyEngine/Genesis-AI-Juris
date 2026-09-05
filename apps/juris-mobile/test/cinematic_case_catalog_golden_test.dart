import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:juris_mobile/models/case_catalog.dart';
import 'package:juris_mobile/screens/case_catalog_screen.dart';
import 'package:juris_mobile/visual_identity/case_visual_manifest.dart';

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
    if (!skipCanonicalVisualGoldens) {
      await loadCatalogueGoldenFonts();
    }
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
      await expectVisualGolden(
        tester,
        'catalogue_compact_first_en_360x800_dpr1_ts100_hc0_rm0.png',
        directory: canonicalCatalogueGoldenDirectory,
      );
    },
    skip: skipCanonicalVisualGoldens,
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
      await expectVisualGolden(
        tester,
        'catalogue_compact_long_title_ru_360x800_dpr1_ts100_hc0_rm0.png',
        directory: canonicalCatalogueGoldenDirectory,
      );
    },
    skip: skipCanonicalVisualGoldens,
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

      await expectVisualGolden(
        tester,
        'catalogue_compact_greenfire_en_412x915_dpr1_ts100_hc0_rm0.png',
        directory: canonicalCatalogueGoldenDirectory,
      );
    },
    skip: skipCanonicalVisualGoldens,
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

      _expectCompleteIndex(bundle);
      await expectVisualGolden(
        tester,
        'catalogue_wide_complete_index_ru_800x1280_dpr1_ts100_hc0_rm0.png',
        directory: canonicalCatalogueGoldenDirectory,
      );
    },
    skip: skipCanonicalVisualGoldens,
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

      _expectCompleteIndex(bundle);
      await expectVisualGolden(
        tester,
        'catalogue_wide_complete_index_en_1024x768_dpr1_ts100_hc0_rm0.png',
        directory: canonicalCatalogueGoldenDirectory,
      );
    },
    skip: skipCanonicalVisualGoldens,
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

      await expectVisualGolden(
        tester,
        'catalogue_compact_actions_en_412x915_dpr1_ts200_hc0_rm1.png',
        directory: canonicalCatalogueGoldenDirectory,
      );
    },
    skip: skipCanonicalVisualGoldens,
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
    final Finder indexItem = find.byKey(
      ValueKey<String>('case-index-item-$caseId'),
    );
    await tester.ensureVisible(indexItem);
    await tester.pump();
    final Semantics semantics = tester.widget<Semantics>(indexItem);
    semantics.properties.onTap!();
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 400));
  }
  if (ensureCompleteIndex) {
    await tester.ensureVisible(
      find.byKey(const ValueKey<String>('case-index')),
    );
    await tester.pump();
  }
  expect(find.byKey(const ValueKey<String>('selected-case-panel')), findsOne);
  expect(tester.takeException(), isNull);
  expect(tester.binding.transientCallbackCount, 0);
}

void _expectCompleteIndex(CaseCatalogBundle bundle) {
  expect(find.byKey(const ValueKey<String>('case-index')), findsOneWidget);
  for (final MobileCaseDefinition item in bundle.cases) {
    expect(
      find.byKey(ValueKey<String>('case-index-item-${item.caseId}')),
      findsOneWidget,
    );
  }
}

void _ignoreStart(
  MobileCaseDefinition _,
  String __,
  CaseCatalogBundle ___,
) {}
