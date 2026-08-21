import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:juris_mobile/app/home_shell.dart';
import 'package:juris_mobile/design/juris_design.dart';
import 'package:juris_mobile/models/case_catalog.dart';
import 'package:juris_mobile/models/game_snapshot.dart';
import 'package:juris_mobile/presentation/inbox_presentation.dart';
import 'package:juris_mobile/screens/case_catalog_screen.dart';
import 'package:juris_mobile/widgets/action_picker_sheet.dart';

import 'support/immutable_golden_identity.dart';
import 'support/professional_ui_pilot_v2_fixtures.dart';
import 'support/professional_ui_pilot_v2_golden_harness.dart';
import 'support/professional_ui_pilot_v2_golden_identities.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  late ProfessionalUiPilotV2Content content;
  late ProfessionalUiPilotV2Fixtures fixtures;

  setUpAll(() async {
    if (!skipProfessionalUiPilotV2Goldens) {
      await loadProfessionalUiPilotV2GoldenFonts();
    }
    content = await ProfessionalUiPilotV2Content.load();
    fixtures = ProfessionalUiPilotV2Fixtures(content.greenFire);
  });

  group(
    'professional UI pilot V2 renders',
    () {
      testWidgets('catalogue phone OFFICE EN', (WidgetTester tester) async {
        await _pumpCatalogue(
          tester,
          content: content,
          configuration: _configuration(
            size: const Size(360, 800),
            locale: 'en',
            mode: JurisVisualMode.office,
          ),
        );
        await _capture(
          tester,
          'professional_ui_pilot_v2_catalogue_phone_office_en.png',
        );
      });

      testWidgets('catalogue phone OFFICE RU 200 percent', (
        WidgetTester tester,
      ) async {
        await _pumpCatalogue(
          tester,
          content: content,
          configuration: _configuration(
            size: const Size(360, 800),
            locale: 'ru',
            mode: JurisVisualMode.office,
            textScale: 2,
          ),
          selectedCaseId: professionalUiPilotV2GoldenShellCaseId,
        );
        await _capture(
          tester,
          'professional_ui_pilot_v2_catalogue_phone_office_ru_ts200.png',
        );
      });

      testWidgets('catalogue tablet landscape AFTER HOURS EN', (
        WidgetTester tester,
      ) async {
        await _pumpCatalogue(
          tester,
          content: content,
          configuration: _configuration(
            size: const Size(1024, 768),
            locale: 'en',
            mode: JurisVisualMode.afterHours,
          ),
          selectedCaseId: professionalUiPilotV2GreenFireCaseId,
        );
        expect(
          find.byKey(const ValueKey<String>('case-index')),
          findsOneWidget,
        );
        await _capture(
          tester,
          'professional_ui_pilot_v2_catalogue_tablet_landscape_after_hours_en.png',
        );
      });

      testWidgets('Operations phone OFFICE inactive Pressure', (
        WidgetTester tester,
      ) async {
        final ProfessionalUiPilotV2Repository repository = await _pumpShell(
          tester,
          content: content,
          fixtures: fixtures,
          active: false,
          configuration: _configuration(
            size: const Size(360, 800),
            locale: 'en',
            mode: JurisVisualMode.office,
          ),
        );
        await _openMatter(tester);
        expect(repository.snapshot.pressureAndCountermove, isNull);
        expect(
          find.byKey(const ValueKey<String>('greenfire-pressure-panel')),
          findsOneWidget,
        );
        expect(
          find.byKey(
            const ValueKey<String>('greenfire-review-pressure-responses'),
          ),
          findsNothing,
        );
        await _capture(
          tester,
          'professional_ui_pilot_v2_operations_phone_office_inactive.png',
        );
      });

      testWidgets('Operations phone AFTER HOURS active Pressure', (
        WidgetTester tester,
      ) async {
        final ProfessionalUiPilotV2Repository repository = await _pumpShell(
          tester,
          content: content,
          fixtures: fixtures,
          active: true,
          configuration: _configuration(
            size: const Size(412, 915),
            locale: 'en',
            mode: JurisVisualMode.afterHours,
          ),
        );
        await _openMatter(tester);
        expect(
          repository.snapshot.pressureAndCountermove!.activePressures,
          hasLength(1),
        );
        expect(
          find.byKey(
            const ValueKey<String>('greenfire-review-pressure-responses'),
          ),
          findsOneWidget,
        );
        await _capture(
          tester,
          'professional_ui_pilot_v2_operations_phone_after_hours_active_pressure.png',
        );
      });

      testWidgets('Inbox phone OFFICE with four required messages', (
        WidgetTester tester,
      ) async {
        final ProfessionalUiPilotV2Repository repository = await _pumpShell(
          tester,
          content: content,
          fixtures: fixtures,
          active: true,
          configuration: _configuration(
            size: const Size(412, 915),
            locale: 'en',
            mode: JurisVisualMode.office,
          ),
        );
        _expectFourRequiredMessages(repository.snapshot);
        expect(
          find.byKey(const ValueKey<String>('available-decisions-control')),
          findsOneWidget,
        );
        await _capture(
          tester,
          'professional_ui_pilot_v2_inbox_phone_office.png',
        );
      });

      testWidgets('Inbox phone RU 200 percent AFTER HOURS', (
        WidgetTester tester,
      ) async {
        final ProfessionalUiPilotV2Repository repository = await _pumpShell(
          tester,
          content: content,
          fixtures: fixtures,
          active: true,
          configuration: _configuration(
            size: const Size(360, 800),
            locale: 'ru',
            mode: JurisVisualMode.afterHours,
            textScale: 2,
          ),
        );
        _expectFourRequiredMessages(repository.snapshot);
        expect(find.text('Входящие'), findsWidgets);
        await _capture(
          tester,
          'professional_ui_pilot_v2_inbox_phone_after_hours_ru_ts200.png',
        );
      });

      testWidgets('Dossier phone OFFICE EN', (WidgetTester tester) async {
        await _pumpShell(
          tester,
          content: content,
          fixtures: fixtures,
          active: true,
          configuration: _configuration(
            size: const Size(412, 915),
            locale: 'en',
            mode: JurisVisualMode.office,
          ),
        );
        await _openDossier(tester);
        expect(
          find.byKey(
            const ValueKey<String>('greenfire-dossier-layout-compact'),
          ),
          findsOneWidget,
        );
        await _capture(
          tester,
          'professional_ui_pilot_v2_dossier_phone_office_en.png',
        );
      });

      testWidgets('Dossier tablet portrait AFTER HOURS RU', (
        WidgetTester tester,
      ) async {
        await _pumpShell(
          tester,
          content: content,
          fixtures: fixtures,
          active: true,
          configuration: _configuration(
            size: const Size(800, 1280),
            locale: 'ru',
            mode: JurisVisualMode.afterHours,
          ),
        );
        await _openDossier(tester);
        expect(
          find.byKey(const ValueKey<String>('greenfire-dossier-layout-wide')),
          findsOneWidget,
        );
        await _capture(
          tester,
          'professional_ui_pilot_v2_dossier_tablet_portrait_after_hours_ru.png',
        );
      });

      testWidgets('responsive shell wide navigation AFTER HOURS EN', (
        WidgetTester tester,
      ) async {
        await _pumpShell(
          tester,
          content: content,
          fixtures: fixtures,
          active: true,
          configuration: _configuration(
            size: const Size(1024, 768),
            locale: 'en',
            mode: JurisVisualMode.afterHours,
          ),
        );
        expect(
          find.byKey(const ValueKey<String>('professional-wide-navigation')),
          findsOneWidget,
        );
        final Semantics selectedInbox = tester.widget<Semantics>(
          find.byKey(const ValueKey<String>('wide-destination-inbox')),
        );
        expect(selectedInbox.properties.selected, isTrue);
        await _capture(
          tester,
          'professional_ui_pilot_v2_shell_wide_navigation_after_hours_en.png',
        );
      });

      testWidgets('Operations active AFTER HOURS high contrast EN', (
        WidgetTester tester,
      ) async {
        await _pumpShell(
          tester,
          content: content,
          fixtures: fixtures,
          active: true,
          configuration: _configuration(
            size: const Size(412, 915),
            locale: 'en',
            mode: JurisVisualMode.afterHours,
            highContrast: true,
          ),
        );
        await _openMatter(tester);
        final BuildContext workspaceContext = tester.element(
          find.byKey(
            const ValueKey<String>('greenfire-living-case-workspace'),
          ),
        );
        expect(MediaQuery.highContrastOf(workspaceContext), isTrue);
        await _capture(
          tester,
          'professional_ui_pilot_v2_operations_phone_after_hours_high_contrast_en.png',
        );
      });

      testWidgets('catalogue phone OFFICE reduced motion EN', (
        WidgetTester tester,
      ) async {
        await _pumpCatalogue(
          tester,
          content: content,
          configuration: _configuration(
            size: const Size(412, 915),
            locale: 'en',
            mode: JurisVisualMode.office,
            reducedMotion: true,
          ),
          selectedCaseId: professionalUiPilotV2GreenFireCaseId,
        );
        expect(tester.binding.transientCallbackCount, 0);
        await _capture(
          tester,
          'professional_ui_pilot_v2_catalogue_phone_office_reduced_motion_en.png',
        );
      });

      testWidgets('Inbox message scenario response phone OFFICE EN', (
        WidgetTester tester,
      ) async {
        await _pumpShell(
          tester,
          content: content,
          fixtures: fixtures,
          active: true,
          configuration: _configuration(
            size: const Size(412, 915),
            locale: 'en',
            mode: JurisVisualMode.office,
          ),
        );
        await _openRegulatorMessageAtResponse(tester);
        _expectInsideRootOverlay(
          find.byKey(const ValueKey<String>('inbox-message-sheet')),
        );
        await _capture(
          tester,
          'professional_ui_pilot_v2_inbox_message_scenario_response_phone_office_en.png',
        );
      });

      testWidgets('available decisions sheet phone OFFICE EN', (
        WidgetTester tester,
      ) async {
        await _pumpShell(
          tester,
          content: content,
          fixtures: fixtures,
          active: true,
          configuration: _configuration(
            size: const Size(412, 915),
            locale: 'en',
            mode: JurisVisualMode.office,
          ),
        );
        await _openAvailableDecisions(tester);
        _expectInsideRootOverlay(find.byType(ActionPickerSheet));
        await _capture(
          tester,
          'professional_ui_pilot_v2_available_decisions_sheet_phone_office_en.png',
        );
      });

      testWidgets('decision confirmation phone OFFICE EN', (
        WidgetTester tester,
      ) async {
        final ProfessionalUiPilotV2Repository repository = await _pumpShell(
          tester,
          content: content,
          fixtures: fixtures,
          active: true,
          configuration: _configuration(
            size: const Size(412, 915),
            locale: 'en',
            mode: JurisVisualMode.office,
          ),
        );
        await _openAvailableDecisions(tester);
        final String firstActionTitle = repository.snapshot.actions.first.title;
        final Finder firstAction = find.descendant(
          of: find.byType(ActionPickerSheet),
          matching: find.text(firstActionTitle),
        );
        expect(firstAction, findsOneWidget);
        await tester.tap(firstAction);
        await settleProfessionalUiPilotV2Golden(tester);
        expect(find.byType(AlertDialog), findsOneWidget);
        _expectInsideRootOverlay(find.byType(AlertDialog));
        await _capture(
          tester,
          'professional_ui_pilot_v2_decision_confirmation_phone_office_en.png',
        );
      });

      testWidgets('Dossier selected evidence provenance phone OFFICE EN', (
        WidgetTester tester,
      ) async {
        await _pumpShell(
          tester,
          content: content,
          fixtures: fixtures,
          active: true,
          configuration: _configuration(
            size: const Size(412, 915),
            locale: 'en',
            mode: JurisVisualMode.office,
          ),
        );
        await _openDossier(tester);
        final Finder evidence = find.byKey(
          const ValueKey<String>(
            'greenfire-evidence-$professionalUiPilotV2SelectedEvidenceId',
          ),
        );
        await _revealByDragging(
          tester,
          viewportKey: const PageStorageKey<String>(
            'greenfire-dossier-scroll',
          ),
          target: evidence,
        );
        await tester.tap(evidence);
        await settleProfessionalUiPilotV2Golden(tester);
        Finder withinSelectedEvidence(String text) => find.descendant(
              of: evidence,
              matching: find.text(text),
            );
        expect(
          withinSelectedEvidence('Selected visible document'),
          findsOneWidget,
        );
        expect(
            withinSelectedEvidence('Supports visible facts'), findsOneWidget);
        expect(
          withinSelectedEvidence('No supporting fact links are projected.'),
          findsOneWidget,
        );
        expect(
          withinSelectedEvidence('No contradicting fact links are projected.'),
          findsOneWidget,
        );
        expect(
          withinSelectedEvidence('Referenced visible fact is unavailable.'),
          findsNothing,
        );
        await _capture(
          tester,
          'professional_ui_pilot_v2_dossier_selected_evidence_provenance_phone_office_en.png',
        );
      });
    },
    skip: skipProfessionalUiPilotV2Goldens,
  );

  test('professional UI pilot V2 golden identities are exact', () {
    expectImmutableGoldenPathSet(professionalUiPilotV2GoldenSet);
    for (final ImmutableGoldenIdentity identity
        in professionalUiPilotV2GoldenSet.identities) {
      expectImmutableGoldenIdentity(identity);
    }
  });
}

ProfessionalUiPilotV2GoldenConfiguration _configuration({
  required Size size,
  required String locale,
  required JurisVisualMode mode,
  double textScale = 1,
  bool highContrast = false,
  bool reducedMotion = false,
}) =>
    ProfessionalUiPilotV2GoldenConfiguration(
      logicalSize: size,
      locale: Locale(locale),
      mode: mode,
      textScale: textScale,
      highContrast: highContrast,
      reducedMotion: reducedMotion,
    );

Future<void> _pumpCatalogue(
  WidgetTester tester, {
  required ProfessionalUiPilotV2Content content,
  required ProfessionalUiPilotV2GoldenConfiguration configuration,
  String? selectedCaseId,
}) async {
  await pumpProfessionalUiPilotV2Golden(
    tester,
    configuration: configuration,
    subjectBuilder: (JurisVisualModeController visualModeController) =>
        CaseCatalogScreen(
      bundle: content.bundle,
      visualManifest: content.catalogueManifest,
      initialLocale: configuration.locale.languageCode,
      visualModeController: visualModeController,
      onStartCase: _ignoreStart,
    ),
  );
  if (selectedCaseId != null) {
    await _selectCatalogueCase(tester, selectedCaseId);
  }
  expect(
    find.byKey(const ValueKey<String>('selected-case-panel')),
    findsOneWidget,
  );
}

Future<ProfessionalUiPilotV2Repository> _pumpShell(
  WidgetTester tester, {
  required ProfessionalUiPilotV2Content content,
  required ProfessionalUiPilotV2Fixtures fixtures,
  required ProfessionalUiPilotV2GoldenConfiguration configuration,
  required bool active,
}) async {
  final GameSnapshot snapshot = active
      ? fixtures.active(locale: configuration.locale.languageCode)
      : fixtures.inactive(locale: configuration.locale.languageCode);
  final ProfessionalUiPilotV2Repository repository =
      ProfessionalUiPilotV2Repository(snapshot);
  addTearDown(repository.dispose);
  await pumpProfessionalUiPilotV2Golden(
    tester,
    configuration: configuration,
    subjectBuilder: (JurisVisualModeController visualModeController) =>
        HomeShell(
      repository: repository,
      locale: configuration.locale.languageCode,
      caseDefinition: content.greenFire,
      livingCaseVisualManifest: content.livingCaseManifest,
      visualModeController: visualModeController,
    ),
  );
  return repository;
}

Future<void> _selectCatalogueCase(
  WidgetTester tester,
  String caseId,
) async {
  final Finder browseAll = find.byKey(
    const ValueKey<String>('browse-all-cases'),
  );
  final double logicalWidth =
      tester.view.physicalSize.width / tester.view.devicePixelRatio;
  final bool compact = logicalWidth < 800;
  if (compact) {
    await _revealByDragging(
      tester,
      viewportKey: const PageStorageKey<String>('case-catalog'),
      target: browseAll,
    );
    await tester.tap(browseAll);
    await settleProfessionalUiPilotV2Golden(tester);

    final Finder row = find.byKey(ValueKey<String>('browse-case-$caseId'));
    await _revealByDragging(
      tester,
      viewportKey: const ValueKey<String>('browse-all-case-list'),
      target: row,
    );
    await tester.tap(row);
  } else {
    final Finder row = find.byKey(
      ValueKey<String>('case-index-item-$caseId'),
    );
    await _revealByDragging(
      tester,
      viewportKey: const ValueKey<String>('wide-case-list'),
      target: row,
    );
    await tester.tap(row);
  }
  await settleProfessionalUiPilotV2Golden(tester);
}

Future<void> _openMatter(WidgetTester tester) async {
  final Finder compact = find.byKey(
    const ValueKey<String>('compact-destination-matter'),
  );
  final Finder wide = find.byKey(
    const ValueKey<String>('wide-destination-matter'),
  );
  final Finder target = compact.evaluate().isNotEmpty ? compact : wide;
  expect(target, findsOneWidget);
  await tester.tap(target);
  await settleProfessionalUiPilotV2Golden(tester);
  expect(
    find.byKey(const ValueKey<String>('greenfire-living-case-workspace')),
    findsOneWidget,
  );
}

Future<void> _openDossier(WidgetTester tester) async {
  await _openMatter(tester);
  final Finder openDossier = find.byKey(
    const ValueKey<String>('greenfire-open-dossier'),
  );
  await _revealByDragging(
    tester,
    viewportKey: const PageStorageKey<String>(
      'greenfire-living-case-scroll',
    ),
    target: openDossier,
  );
  await tester.tap(openDossier);
  await settleProfessionalUiPilotV2Golden(tester);
  expect(
    find.byKey(const ValueKey<String>('greenfire-dossier-screen')),
    findsOneWidget,
  );
}

Future<void> _openRegulatorMessageAtResponse(WidgetTester tester) async {
  final Finder message = find.byKey(
    const ValueKey<String>(
      'inbox-item-$professionalUiPilotV2RegulatorMessageId',
    ),
  );
  await _revealByDragging(
    tester,
    viewportKey: const PageStorageKey<String>('inbox-scroll'),
    target: message,
  );
  await tester.tap(message);
  await settleProfessionalUiPilotV2Golden(tester);
  expect(
    find.byKey(const ValueKey<String>('inbox-message-sheet')),
    findsOneWidget,
  );
  final Finder response = find.byKey(
    const ValueKey<String>(
      'inbox-response-submit_initial_regulatory_response',
    ),
  );
  await _revealByDragging(
    tester,
    viewportKey: const ValueKey<String>('inbox-message-scroll'),
    target: response,
  );
}

Future<void> _openAvailableDecisions(WidgetTester tester) async {
  final Finder control = find.byKey(
    const ValueKey<String>('available-decisions-control'),
  );
  expect(control.hitTestable(), findsOneWidget);
  await tester.tap(control);
  await settleProfessionalUiPilotV2Golden(tester);
  expect(find.byType(ActionPickerSheet), findsOneWidget);
}

Future<void> _revealByDragging(
  WidgetTester tester, {
  required Key viewportKey,
  required Finder target,
  int maximumGestures = 32,
}) async {
  final Finder viewport = find.byKey(viewportKey);
  expect(viewport, findsOneWidget);
  for (int gesture = 0; gesture <= maximumGestures; gesture += 1) {
    if (target.hitTestable().evaluate().length == 1) {
      return;
    }
    if (gesture == maximumGestures) {
      break;
    }
    await tester.drag(viewport, const Offset(0, -220));
    await settleProfessionalUiPilotV2Golden(tester);
  }
  fail(
    'Could not reveal $target through $viewportKey; '
    'built=${target.evaluate().length}, '
    'hitTestable=${target.hitTestable().evaluate().length}.',
  );
}

void _expectFourRequiredMessages(GameSnapshot snapshot) {
  final InboxPresentation presentation = InboxPresentation.from(snapshot.inbox);
  expect(presentation.attentionRequiredCount, 4);
  expect(
    presentation.displayedEntries.where(
      (DisplayedInboxEntry entry) => entry.requiresAttention,
    ),
    hasLength(4),
  );
}

void _expectInsideRootOverlay(Finder content) {
  expect(
    find.descendant(
      of: find.byKey(professionalUiPilotV2GoldenBoundaryKey),
      matching: content,
    ),
    findsOneWidget,
  );
}

Future<void> _capture(WidgetTester tester, String fileName) async {
  expect(tester.takeException(), isNull);
  expect(tester.binding.transientCallbackCount, 0);
  await expectProfessionalUiPilotV2Golden(tester, fileName);
}

void _ignoreStart(
  MobileCaseDefinition _,
  String __,
  CaseCatalogBundle ___,
) {}
