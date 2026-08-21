import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:juris_mobile/app/app_theme.dart';
import 'package:juris_mobile/app/home_shell.dart';
import 'package:juris_mobile/data/demo_game_repository.dart';
import 'package:juris_mobile/data/game_runtime_repository.dart';
import 'package:juris_mobile/design/juris_design.dart';
import 'package:juris_mobile/living_case/greenfire_living_case_workspace.dart';
import 'package:juris_mobile/living_case/living_case_visual_manifest.dart';
import 'package:juris_mobile/models/case_catalog.dart';
import 'package:juris_mobile/models/dossier_projection.dart';
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
        'greenfire-review-pressure-responses',
      ),
    );
    await _revealWorkspaceControl(tester, response);
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
        theme: JurisTheme.afterHours(),
        home: MediaQuery(
          data: const MediaQueryData(
            size: Size(412, 915),
            textScaler: TextScaler.linear(2),
            disableAnimations: true,
            padding: EdgeInsets.only(bottom: 18),
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

    final Finder workspaceScroll = find.byKey(
      const PageStorageKey<String>('greenfire-living-case-scroll'),
    );
    final SingleChildScrollView scroll =
        tester.widget<SingleChildScrollView>(workspaceScroll);
    final Column scrollColumn = scroll.child! as Column;
    final Padding contentPadding = scrollColumn.children[1] as Padding;
    final EdgeInsets resolvedPadding = contentPadding.padding.resolve(
      TextDirection.ltr,
    );
    expect(MediaQuery.paddingOf(tester.element(workspaceScroll)).bottom, 18);
    expect(resolvedPadding.bottom, JurisSpacing.standard.lg + 18);
    expect(find.text('ACTIVE PRESSURE'), findsOneWidget);
    expect(
      find.textContaining('Port Haven Environmental Authority'),
      findsWidgets,
    );
    final Finder responses = find.byKey(
      const ValueKey<String>('greenfire-review-pressure-responses'),
    );
    expect(tester.getSize(responses).height, greaterThanOrEqualTo(48));
    await tester.sendKeyEvent(LogicalKeyboardKey.tab);
    await tester.pump();
    expect(FocusManager.instance.primaryFocus, isNotNull);
    expect(tester.takeException(), isNull);
    semantics.dispose();
    repository.dispose();
  });

  testWidgets(
    'operations keep attention decisions and responses distinct without dispatch',
    (WidgetTester tester) async {
      final SemanticsHandle semantics = tester.ensureSemantics();
      final _LivingRepository repository = _LivingRepository();
      addTearDown(repository.dispose);
      final GameSnapshot snapshot = repository.snapshot.copyWith(
        dossier: _dossier(DossierDeadlineStatus.open),
        inbox: <InboxItemView>[
          const InboxItemView(
            id: 'unrelated_board_escalation',
            sender: 'GreenFire Board',
            subject: 'Unrelated newer board escalation',
            body: 'The board asks for an unrelated update.',
            receivedAt: 'Day 1 · 10:30',
            status: InboxStatus.actionRequired,
          ),
          ...repository.snapshot.inbox,
        ],
      );
      List<String>? responseIds;
      bool actionsOpened = false;
      bool dossierOpened = false;
      await _pumpWorkspace(
        tester,
        definition: greenfire,
        manifest: manifest,
        snapshot: snapshot,
        mode: JurisVisualMode.office,
        onShowActions: () => actionsOpened = true,
        onShowDossier: () => dossierOpened = true,
        onShowPressureResponses: (List<String> ids) => responseIds = ids,
      );

      expect(
        tester
            .getSemantics(
              find.byKey(
                const ValueKey<String>('greenfire-attention-count'),
              ),
            )
            .label,
        'Inbox attention: 2',
      );
      expect(
        tester
            .getSemantics(
              find.byKey(const ValueKey<String>('greenfire-decision-count')),
            )
            .label,
        'Available decisions: 2',
      );
      expect(
        tester
            .widget<Text>(
              find.byKey(
                const ValueKey<String>('greenfire-pressure-response-count'),
              ),
            )
            .data,
        '2',
      );
      expect(find.text('Open'), findsWidgets);
      final Finder situation = find.byKey(
        const ValueKey<String>('greenfire-current-situation'),
      );
      expect(
        find.descendant(
          of: situation,
          matching: find.text('Port Haven Environmental Authority'),
        ),
        findsOneWidget,
      );
      expect(
        find.descendant(
          of: situation,
          matching: find.text('Environmental authority demands records'),
        ),
        findsOneWidget,
      );
      expect(
        find.descendant(
          of: situation,
          matching: find.text('The authority requests visible records.'),
        ),
        findsOneWidget,
      );
      expect(
        find.descendant(
          of: situation,
          matching: find.text('Day 1 · 10:00'),
        ),
        findsOneWidget,
      );
      expect(
        find.descendant(
          of: situation,
          matching: find.text('Action required'),
        ),
        findsOneWidget,
      );
      expect(
        find.descendant(
          of: situation,
          matching: find.text('Unrelated newer board escalation'),
        ),
        findsNothing,
      );
      final Finder pressurePanel = find.byKey(
        const ValueKey<String>('greenfire-pressure-panel'),
      );
      expect(
        find.descendant(
          of: pressurePanel,
          matching: find.textContaining('Port Haven Environmental Authority'),
        ),
        findsWidgets,
      );
      expect(
        find.descendant(
          of: pressurePanel,
          matching: find.byWidgetPredicate(
            (Widget widget) =>
                widget is Text &&
                (widget.data?.contains('Initial regulatory response') ??
                    false) &&
                (widget.data?.contains('Active') ?? false),
          ),
        ),
        findsOneWidget,
      );
      expect(
        find.descendant(
          of: pressurePanel,
          matching: find.text('540'),
        ),
        findsNothing,
      );
      expect(
        find.descendant(
          of: pressurePanel,
          matching: find.textContaining('game minutes remaining'),
        ),
        findsNothing,
      );

      final Finder responses = find.byKey(
        const ValueKey<String>('greenfire-review-pressure-responses'),
      );
      await _revealWorkspaceControl(tester, responses);
      await tester.tap(responses);
      await tester.pump();
      expect(
        responseIds,
        <String>[
          'submit_initial_regulatory_response',
          'release_unreviewed_documents',
        ],
      );
      expect(repository.appliedActionIds, isEmpty);

      final Finder dossier = find.byKey(
        const ValueKey<String>('greenfire-open-dossier'),
      );
      await _revealWorkspaceControl(tester, dossier);
      await tester.tap(dossier);
      await tester.pump();
      expect(dossierOpened, isTrue);

      final Finder actions = find.byKey(
        const ValueKey<String>('greenfire-review-all-actions'),
      );
      await _revealWorkspaceControl(tester, actions);
      await tester.tap(actions);
      await tester.pump();
      expect(actionsOpened, isTrue);
      expect(repository.appliedActionIds, isEmpty);
      expect(tester.takeException(), isNull);
      semantics.dispose();
    },
  );

  testWidgets('inactive pressure is compact while a missed deadline stays red',
      (WidgetTester tester) async {
    final _LivingRepository repository = _LivingRepository();
    addTearDown(repository.dispose);
    final GameSnapshot inactive = _inactiveSnapshot(repository.snapshot);
    await _pumpWorkspace(
      tester,
      definition: greenfire,
      manifest: manifest,
      snapshot: inactive,
      size: const Size(360, 800),
      mode: JurisVisualMode.office,
    );

    final Finder pressure = find.byKey(
      const ValueKey<String>('greenfire-pressure-panel'),
    );
    expect(tester.getSize(pressure).height, lessThan(260));
    expect(
      find.descendant(
        of: pressure,
        matching: find.text('No configured regulatory pressure is active.'),
      ),
      findsOneWidget,
    );
    final Finder situation = find.byKey(
      const ValueKey<String>('greenfire-current-situation'),
    );
    expect(
      find.descendant(
        of: situation,
        matching: find.text('No configured regulatory pressure is active.'),
      ),
      findsOneWidget,
    );
    expect(
      find.descendant(
        of: situation,
        matching: find.text('Environmental authority demands records'),
      ),
      findsNothing,
    );
    expect(
      find.descendant(of: situation, matching: find.text('Board instruction')),
      findsNothing,
    );
    expect(
      find.descendant(
        of: situation,
        matching: find.text('Site records request'),
      ),
      findsNothing,
    );
    expect(
      find.byKey(
        const ValueKey<String>('greenfire-review-pressure-responses'),
      ),
      findsNothing,
    );
    expect(
      tester
          .getSemantics(
            find.byKey(const ValueKey<String>('greenfire-attention-count')),
          )
          .label,
      'Inbox attention: 3',
    );
    expect(
      tester
          .getSemantics(
            find.byKey(const ValueKey<String>('greenfire-decision-count')),
          )
          .label,
      'Available decisions: 1',
    );
    BoxDecoration decoration =
        tester.widget<Container>(pressure).decoration! as BoxDecoration;
    Border border = decoration.border! as Border;
    BuildContext pressureContext = tester.element(pressure);
    expect(
      border.top.color,
      Theme.of(pressureContext).extension<JurisSurfaces>()!.rule,
    );

    await _pumpWorkspace(
      tester,
      definition: greenfire,
      manifest: manifest,
      snapshot: inactive.copyWith(
        dossier: _dossier(DossierDeadlineStatus.missed),
      ),
      size: const Size(360, 800),
      mode: JurisVisualMode.afterHours,
    );
    expect(find.textContaining('Missed'), findsOneWidget);
    decoration =
        tester.widget<Container>(pressure).decoration! as BoxDecoration;
    border = decoration.border! as Border;
    pressureContext = tester.element(pressure);
    expect(
      border.top.color,
      Theme.of(pressureContext).extension<JurisSurfaces>()!.danger,
    );
    expect(tester.takeException(), isNull);
  });

  const List<
      ({
        String name,
        Size size,
        String locale,
        double textScale,
        JurisVisualMode mode,
        bool active,
      })> accessibilityMatrix = <({
    String name,
    Size size,
    String locale,
    double textScale,
    JurisVisualMode mode,
    bool active,
  })>[
    (
      name: '360 office en inactive operations remain reachable',
      size: Size(360, 800),
      locale: 'en',
      textScale: 1,
      mode: JurisVisualMode.office,
      active: false,
    ),
    (
      name: '360 office ru at 200 percent operations remain reachable',
      size: Size(360, 800),
      locale: 'ru',
      textScale: 2,
      mode: JurisVisualMode.office,
      active: true,
    ),
    (
      name: '412 after hours en at 200 percent operations remain reachable',
      size: Size(412, 915),
      locale: 'en',
      textScale: 2,
      mode: JurisVisualMode.afterHours,
      active: true,
    ),
    (
      name: '699 office ru compact boundary operations remain reachable',
      size: Size(699, 1000),
      locale: 'ru',
      textScale: 2,
      mode: JurisVisualMode.office,
      active: true,
    ),
    (
      name: '700 after hours en wide boundary operations remain reachable',
      size: Size(700, 1000),
      locale: 'en',
      textScale: 2,
      mode: JurisVisualMode.afterHours,
      active: true,
    ),
    (
      name: '800 office ru tablet portrait operations remain reachable',
      size: Size(800, 1280),
      locale: 'ru',
      textScale: 1,
      mode: JurisVisualMode.office,
      active: false,
    ),
    (
      name: '1024 after hours en tablet landscape operations remain reachable',
      size: Size(1024, 768),
      locale: 'en',
      textScale: 1,
      mode: JurisVisualMode.afterHours,
      active: true,
    ),
  ];
  for (final state in accessibilityMatrix) {
    testWidgets(state.name, (WidgetTester tester) async {
      final _LivingRepository repository = _LivingRepository();
      addTearDown(repository.dispose);
      final GameSnapshot snapshot = state.active
          ? repository.snapshot.copyWith(
              dossier: _dossier(DossierDeadlineStatus.open),
            )
          : _inactiveSnapshot(repository.snapshot);
      await _pumpWorkspace(
        tester,
        definition: greenfire,
        manifest: manifest,
        snapshot: snapshot,
        size: state.size,
        locale: state.locale,
        textScale: state.textScale,
        mode: state.mode,
      );

      expect(
        find.byKey(
          const ValueKey<String>('greenfire-operations-ledger'),
        ),
        findsOneWidget,
      );
      final BuildContext workspaceContext = tester.element(
        find.byKey(
          const ValueKey<String>('greenfire-living-case-workspace'),
        ),
      );
      expect(
        Theme.of(workspaceContext).extension<JurisSurfaces>()!.canvas,
        JurisSurfaces.forMode(state.mode).canvas,
      );
      if (state.active) {
        final Finder responses = find.byKey(
          const ValueKey<String>('greenfire-review-pressure-responses'),
        );
        await _revealWorkspaceControl(tester, responses);
        expect(responses.hitTestable(), findsOneWidget);
        expect(tester.getSize(responses).height, greaterThanOrEqualTo(48));
      } else {
        final Finder dossier = find.byKey(
          const ValueKey<String>('greenfire-open-dossier'),
        );
        await _revealWorkspaceControl(tester, dossier);
        expect(dossier.hitTestable(), findsOneWidget);
        expect(tester.getSize(dossier).height, greaterThanOrEqualTo(48));
      }
      expect(tester.takeException(), isNull);
    });
  }
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

Future<void> _pumpWorkspace(
  WidgetTester tester, {
  required MobileCaseDefinition definition,
  required LivingCaseVisualManifest manifest,
  required GameSnapshot snapshot,
  Size size = const Size(412, 915),
  String locale = 'en',
  double textScale = 1,
  JurisVisualMode mode = JurisVisualMode.afterHours,
  VoidCallback? onShowActions,
  VoidCallback? onShowDossier,
  VoidCallback? onShowTrainingDebrief,
  ValueChanged<List<String>>? onShowPressureResponses,
}) async {
  addTearDown(tester.view.reset);
  tester.view.physicalSize = size;
  tester.view.devicePixelRatio = 1;
  await tester.pumpWidget(
    MaterialApp(
      theme: JurisTheme.forMode(mode),
      home: MediaQuery(
        data: MediaQueryData(
          size: size,
          textScaler: TextScaler.linear(textScale),
          disableAnimations: true,
        ),
        child: Scaffold(
          body: GreenFireLivingCaseWorkspace(
            snapshot: snapshot,
            caseDefinition: definition,
            manifest: manifest,
            locale: locale,
            onShowActions: onShowActions ?? () {},
            onShowDossier: onShowDossier ?? () {},
            onShowTrainingDebrief: onShowTrainingDebrief ?? () {},
            onShowPressureResponses: onShowPressureResponses ?? (_) {},
          ),
        ),
      ),
    ),
  );
  await tester.pumpAndSettle();
}

Future<void> _revealWorkspaceControl(
  WidgetTester tester,
  Finder target,
) async {
  final Finder viewport = find.byKey(
    const PageStorageKey<String>('greenfire-living-case-scroll'),
  );
  expect(viewport, findsOneWidget);
  final Finder scrollableFinder = find.descendant(
    of: viewport,
    matching: find.byType(Scrollable),
  );
  expect(scrollableFinder, findsOneWidget);
  final ScrollableState scrollable = tester.state<ScrollableState>(
    scrollableFinder,
  );
  for (int gesture = 0; gesture <= 12; gesture += 1) {
    if (target.evaluate().length == 1 &&
        target.hitTestable().evaluate().length == 1) {
      return;
    }
    if (gesture == 12) {
      break;
    }
    final double before = scrollable.position.pixels;
    await tester.drag(viewport, const Offset(0, -200));
    await tester.pumpAndSettle();
    if (scrollable.position.pixels <= before + 0.5 &&
        scrollable.position.pixels >=
            scrollable.position.maxScrollExtent - 0.5) {
      break;
    }
  }
  fail(
    'Could not reveal Operations control through bounded public scrolling: '
    '$target built=${target.evaluate().length} '
    'hitTestable=${target.hitTestable().evaluate().length} '
    'pixels=${scrollable.position.pixels} '
    'max=${scrollable.position.maxScrollExtent}.',
  );
}

GameSnapshot _inactiveSnapshot(GameSnapshot active) => active.copyWith(
      inbox: const <InboxItemView>[
        InboxItemView(
          id: 'regulator_document_request',
          sender: 'Port Haven Environmental Authority',
          subject: 'Environmental authority demands records',
          body: 'The authority requests visible records.',
          receivedAt: 'Day 1 · 10:00',
          status: InboxStatus.actionRequired,
        ),
        InboxItemView(
          id: 'board_instruction',
          sender: 'GreenFire Board',
          subject: 'Board instruction',
          body: 'The board requests a status update.',
          receivedAt: 'Day 1 · 09:45',
          status: InboxStatus.actionRequired,
        ),
        InboxItemView(
          id: 'site_request',
          sender: 'Site director',
          subject: 'Site records request',
          body: 'The site director requests guidance.',
          receivedAt: 'Day 1 · 09:30',
          status: InboxStatus.actionRequired,
        ),
      ],
      actions: <GameActionView>[active.actions.first],
      dossier: _dossier(DossierDeadlineStatus.open),
      matterLifecycle: MatterLifecycleStatus.active,
      isClosed: false,
      clearPressureAndCountermove: true,
      clearTrainingDebrief: true,
      clearOutcomeSummary: true,
    );

DossierProjectionView _dossier(DossierDeadlineStatus status) =>
    DossierProjectionView(
      projectionSchemaVersion: 1,
      procedure: const DossierProcedureView(
        stageId: 'immediate_response',
        stageTitle: 'Immediate response',
        clockMinutes: 180,
        matterLifecycle: DossierLifecycleStatus.active,
        isClosed: false,
        matterStatus: DossierMatterStatus.open,
      ),
      facts: const <DossierFactView>[],
      evidence: const <DossierEvidenceView>[],
      deadlines: <DossierDeadlineView>[
        DossierDeadlineView(
          id: 'initial_regulatory_response_deadline',
          title: 'Initial regulatory response',
          dueAtMinutes: 2160,
          status: status,
          remedies: const <DossierRemedyView>[],
        ),
      ],
    );

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
