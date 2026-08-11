import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:juris_mobile/app/app_theme.dart';
import 'package:juris_mobile/app/home_shell.dart';
import 'package:juris_mobile/data/demo_game_repository.dart';
import 'package:juris_mobile/data/game_runtime_repository.dart';
import 'package:juris_mobile/living_case/greenfire_living_case_workspace.dart';
import 'package:juris_mobile/living_case/living_case_visual_manifest.dart';
import 'package:juris_mobile/models/case_catalog.dart';
import 'package:juris_mobile/models/game_snapshot.dart';
import 'package:juris_mobile/models/pressure_countermove.dart';
import 'package:juris_mobile/screens/matter_screen.dart';
import 'package:juris_mobile/widgets/action_picker_sheet.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  late MobileCaseDefinition greenfire;
  late LivingCaseVisualManifest manifest;

  setUpAll(() async {
    greenfire = CaseCatalogBundle.fromJson(
      jsonDecode(
        await rootBundle.loadString(
          'assets/case_catalog/mobile_case_bundle.json',
        ),
      ) as Map<String, dynamic>,
    ).cases.singleWhere(
          (MobileCaseDefinition item) =>
              item.caseId == 'greenfire_first_72_hours',
        );
    manifest = LivingCaseVisualManifest.fromJson(
      jsonDecode(
        await rootBundle.loadString(
          'assets/visual_identity/living_case_visual_manifest.v1.json',
        ),
      ) as Map<String, dynamic>,
    );
  });

  testWidgets('exact response keeps confirmation and dispatch pipeline',
      (WidgetTester tester) async {
    final _LivingRepository repository = _LivingRepository();
    await _pumpShell(tester, repository, greenfire, manifest);
    await tester.tap(find.text('Matter'));
    await tester.pump();

    final Finder response = find.byKey(
      const ValueKey<String>(
        'greenfire-response-submit_initial_regulatory_response',
      ),
    );
    await tester.ensureVisible(response);
    await tester.tap(response);
    await tester.pumpAndSettle();

    expect(find.byType(ActionPickerSheet), findsOneWidget);
    final Finder sheetAction = find.descendant(
      of: find.byType(ActionPickerSheet),
      matching: find.text('Submit reviewed initial response'),
    );
    await tester.tap(sheetAction);
    await tester.pumpAndSettle();
    expect(repository.appliedActionIds, isEmpty);

    await tester.tap(find.text('Yes'));
    await tester.pumpAndSettle();
    expect(
      repository.appliedActionIds,
      <String>['submit_initial_regulatory_response'],
    );
    repository.dispose();
  });

  testWidgets('manifest absence keeps the generic matter screen',
      (WidgetTester tester) async {
    final _LivingRepository repository = _LivingRepository();
    await _pumpShell(tester, repository, greenfire, null);
    await tester.tap(find.text('Matter'));
    await tester.pump();

    expect(find.byType(MatterScreen), findsOneWidget);
    expect(
      find.byKey(const ValueKey<String>('greenfire-living-case-workspace')),
      findsNothing,
    );
    repository.dispose();
  });

  testWidgets('workspace semantics, targets, focus, and 200 percent text fit',
      (WidgetTester tester) async {
    final SemanticsHandle semantics = tester.ensureSemantics();
    addTearDown(tester.view.reset);
    tester.view.physicalSize = const Size(412, 915);
    tester.view.devicePixelRatio = 1;
    final _LivingRepository repository = _LivingRepository();

    await tester.pumpWidget(
      MaterialApp(
        theme: JurisTheme.dark(),
        home: MediaQuery(
          data: const MediaQueryData(
            size: Size(412, 915),
            textScaler: TextScaler.linear(2),
            disableAnimations: true,
          ),
          child: Scaffold(
            body: GreenFireLivingCaseWorkspace(
              snapshot: repository.snapshot,
              caseDefinition: greenfire,
              manifest: manifest,
              locale: 'en',
              onShowActions: () {},
              onShowDossier: () {},
              onShowTrainingDebrief: () {},
              onShowPressureResponses: (_) {},
            ),
          ),
        ),
      ),
    );
    await tester.pump();

    expect(
      find.bySemanticsLabel(
        RegExp('ACTIVE PRESSURE.*Port Haven Environmental Authority'),
      ),
      findsOneWidget,
    );
    final Finder responses = find.byKey(
      const ValueKey<String>(
        'greenfire-response-submit_initial_regulatory_response',
      ),
    );
    expect(tester.getSize(responses).height, greaterThanOrEqualTo(48));
    await tester.sendKeyEvent(LogicalKeyboardKey.tab);
    await tester.pump();
    expect(FocusManager.instance.primaryFocus, isNotNull);
    expect(tester.takeException(), isNull);
    semantics.dispose();
    repository.dispose();
  });
}

Future<void> _pumpShell(
  WidgetTester tester,
  GameRuntimeRepository repository,
  MobileCaseDefinition definition,
  LivingCaseVisualManifest? manifest,
) async {
  await tester.pumpWidget(
    MaterialApp(
      theme: JurisTheme.dark(),
      home: MediaQuery(
        data: const MediaQueryData(disableAnimations: true),
        child: HomeShell(
          repository: repository,
          caseDefinition: definition,
          livingCaseVisualManifest: manifest,
        ),
      ),
    ),
  );
  await tester.pump();
}

final class _LivingRepository extends GameRuntimeRepository {
  _LivingRepository()
      : _snapshot = DemoGameRepository(seed: 41).snapshot.copyWith(
          inbox: const <InboxItemView>[
            InboxItemView(
              id: 'regulator_document_request',
              sender: 'Port Haven Environmental Authority',
              subject: 'Environmental authority demands records',
              body: 'The authority requests visible records.',
              receivedAt: 'Day 1 · 10:00',
              status: InboxStatus.actionRequired,
            ),
          ],
          actions: const <GameActionView>[
            GameActionView(
              id: 'submit_initial_regulatory_response',
              title: 'Submit reviewed initial response',
              description: 'Submit the reviewed response.',
              timeLabel: '3h',
              costEur: 0,
              tone: ActionTone.primary,
            ),
            GameActionView(
              id: 'release_unreviewed_documents',
              title: 'Release unreviewed documents',
              description: 'Release the visible files without review.',
              timeLabel: '3h',
              costEur: 0,
              tone: ActionTone.danger,
            ),
          ],
          pressureAndCountermove: const PressureAndCountermoveView(
            projectionSchemaVersion: 1,
            activePressures: <ActivePressureView>[
              ActivePressureView(
                pressureId: 'regulator_document_request_pressure',
                sourceActorId: 'port_haven_environment_authority',
                sourceActorName: 'Port Haven Environmental Authority',
                dueAtMinute: 2160,
                remainingMinutes: 540,
                availableResponseActionIds: <String>[
                  'submit_initial_regulatory_response',
                  'release_unreviewed_documents',
                ],
              ),
            ],
          ),
        );

  final GameSnapshot _snapshot;
  final List<String> appliedActionIds = <String>[];

  @override
  GameSnapshot get snapshot => _snapshot;

  @override
  bool get isTerminal => false;

  @override
  bool get supportsLiveClock => false;

  @override
  String? get clockErrorMessage => null;

  @override
  void advanceTimeByMinutes(int minutes) {}

  @override
  ActionExecutionResult applyAction(String actionId) {
    appliedActionIds.add(actionId);
    return const ActionExecutionResult(
      title: 'Response submitted',
      message: 'The authoritative runtime accepted the response.',
      isRisky: false,
    );
  }

  @override
  void markInboxItemRead(String itemId) {}

  @override
  void reset() {}
}
