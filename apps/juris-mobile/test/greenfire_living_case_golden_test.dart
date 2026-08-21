import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:juris_mobile/data/demo_game_repository.dart';
import 'package:juris_mobile/design/case_treatment_scope.dart';
import 'package:juris_mobile/living_case/greenfire_living_case_dossier_screen.dart';
import 'package:juris_mobile/living_case/greenfire_living_case_outcome_screen.dart';
import 'package:juris_mobile/living_case/greenfire_living_case_workspace.dart';
import 'package:juris_mobile/living_case/living_case_visual_manifest.dart';
import 'package:juris_mobile/models/case_catalog.dart';
import 'package:juris_mobile/models/dossier_projection.dart';
import 'package:juris_mobile/models/game_snapshot.dart';
import 'package:juris_mobile/models/pressure_countermove.dart';
import 'package:juris_mobile/models/training_debrief.dart';

import 'support/visual_golden_harness.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  late MobileCaseDefinition greenfire;
  late LivingCaseVisualManifest manifest;

  setUpAll(() async {
    if (!skipCanonicalVisualGoldens) {
      await loadCatalogueGoldenFonts();
    }
    final CaseCatalogBundle bundle = CaseCatalogBundle.fromJson(
      jsonDecode(
        await rootBundle.loadString(
          'assets/case_catalog/mobile_case_bundle.json',
        ),
      ) as Map<String, dynamic>,
    );
    greenfire = bundle.cases.singleWhere(
      (MobileCaseDefinition item) => item.caseId == 'greenfire_first_72_hours',
    );
    manifest = LivingCaseVisualManifest.fromJson(
      jsonDecode(
        await rootBundle.loadString(
          'assets/visual_identity/living_case_visual_manifest.v1.json',
        ),
      ) as Map<String, dynamic>,
    );
  });

  testWidgets('GF-01 opening', (WidgetTester tester) async {
    await pumpVisualGolden(
      tester,
      configuration: _configuration(const Size(412, 915)),
      subject: CaseTreatmentScope(
        treatment: manifest.caseTreatment,
        child: GreenFireLivingCaseOpeningFrame(
          locale: 'en',
          title: greenfire.localized('en', 'en').shortTitle,
          onEnter: () {},
        ),
      ),
    );
    await _expect(tester, 'gf01_opening_en_412x915.png');
  }, skip: skipCanonicalVisualGoldens);

  testWidgets('GF-02 request workspace', (WidgetTester tester) async {
    await _pumpWorkspace(tester, greenfire, manifest, _activeSnapshot());
    await _expect(tester, 'gf02_request_workspace_en_412x915.png');
  }, skip: skipCanonicalVisualGoldens);

  testWidgets('GF-03 RU pressure detail', (WidgetTester tester) async {
    await _pumpWorkspace(
      tester,
      greenfire,
      manifest,
      _activeSnapshot(),
      locale: 'ru',
    );
    await _expect(tester, 'gf03_pressure_detail_ru_412x915.png');
  }, skip: skipCanonicalVisualGoldens);

  testWidgets('GF-04 EN 200 percent actions', (WidgetTester tester) async {
    await _pumpWorkspace(
      tester,
      greenfire,
      manifest,
      _activeSnapshot(),
      textScale: 2,
    );
    await _expect(tester, 'gf04_actions_en_412x915_ts200.png');
  }, skip: skipCanonicalVisualGoldens);

  testWidgets('GF-05 high contrast missed reveal', (WidgetTester tester) async {
    await _pumpWorkspace(
      tester,
      greenfire,
      manifest,
      _missedSnapshot(),
      highContrast: true,
    );
    await _expect(tester, 'gf05_missed_en_412x915_hc1.png');
  }, skip: skipCanonicalVisualGoldens);

  testWidgets('GF-06 RU dossier material', (WidgetTester tester) async {
    await _pumpDossier(tester, manifest, locale: 'ru');
    await _expect(tester, 'gf06_dossier_material_ru_412x915.png');
  }, skip: skipCanonicalVisualGoldens);

  testWidgets('GF-07 selected visible document', (WidgetTester tester) async {
    await _pumpDossier(tester, manifest);
    await tester.tap(find.text('Inspection record'));
    await tester.pump();
    await _expect(tester, 'gf07_selected_document_en_412x915.png');
  }, skip: skipCanonicalVisualGoldens);

  testWidgets('GF-08 actor-correlated regulator request',
      (WidgetTester tester) async {
    await _pumpWorkspace(
      tester,
      greenfire,
      manifest,
      _activeSnapshot(),
      size: const Size(800, 600),
    );
    expect(find.text('Port Haven Environmental Authority'), findsWidgets);
    await _expect(tester, 'gf08_regulator_request_en_800x600.png');
  }, skip: skipCanonicalVisualGoldens);

  testWidgets('GF-09 protected debrief', (WidgetTester tester) async {
    await _pumpOutcome(
      tester,
      manifest,
      LivingCaseOutcomeTreatment.protected,
    );
    await _expect(tester, 'gf09_protected_debrief_en_412x915.png');
  }, skip: skipCanonicalVisualGoldens);

  testWidgets('GF-10 RU high contrast compromised debrief',
      (WidgetTester tester) async {
    await _pumpOutcome(
      tester,
      manifest,
      LivingCaseOutcomeTreatment.compromised,
      locale: 'ru',
      highContrast: true,
    );
    await _expect(tester, 'gf10_compromised_debrief_ru_412x915_hc1.png');
  }, skip: skipCanonicalVisualGoldens);

  testWidgets('GF-11 wide workspace', (WidgetTester tester) async {
    await _pumpWorkspace(
      tester,
      greenfire,
      manifest,
      _activeSnapshot(),
      size: const Size(1024, 768),
    );
    await _expect(tester, 'gf11_workspace_en_1024x768.png');
  }, skip: skipCanonicalVisualGoldens);

  testWidgets('GF-12 portrait dossier context', (WidgetTester tester) async {
    await _pumpDossier(
      tester,
      manifest,
      size: const Size(800, 1280),
    );
    await _expect(tester, 'gf12_dossier_context_en_800x1280.png');
  }, skip: skipCanonicalVisualGoldens);

  testWidgets('GF-13 wide protected debrief', (WidgetTester tester) async {
    await _pumpOutcome(
      tester,
      manifest,
      LivingCaseOutcomeTreatment.protected,
      size: const Size(1024, 768),
    );
    await _expect(tester, 'gf13_protected_debrief_en_1024x768.png');
  }, skip: skipCanonicalVisualGoldens);

  testWidgets('GF-14 historical F0 has no invented pressure',
      (WidgetTester tester) async {
    await _pumpWorkspace(
      tester,
      greenfire,
      manifest,
      _historicalSnapshot(),
    );
    expect(find.text('Port Haven Environmental Authority'), findsNothing);
    await _expect(tester, 'gf14_historical_f0_en_412x915.png');
  }, skip: skipCanonicalVisualGoldens);
}

VisualGoldenConfiguration _configuration(
  Size size, {
  String locale = 'en',
  double textScale = 1,
  bool highContrast = false,
}) =>
    VisualGoldenConfiguration(
      logicalSize: size,
      locale: Locale(locale),
      textScale: textScale,
      highContrast: highContrast,
      reducedMotion: true,
    );

Future<void> _pumpWorkspace(
  WidgetTester tester,
  MobileCaseDefinition definition,
  LivingCaseVisualManifest manifest,
  GameSnapshot snapshot, {
  String locale = 'en',
  double textScale = 1,
  bool highContrast = false,
  Size size = const Size(412, 915),
}) =>
    pumpVisualGolden(
      tester,
      configuration: _configuration(
        size,
        locale: locale,
        textScale: textScale,
        highContrast: highContrast,
      ),
      subject: Scaffold(
        body: GreenFireLivingCaseWorkspace(
          snapshot: snapshot,
          caseDefinition: definition,
          manifest: manifest,
          locale: locale,
          onShowActions: () {},
          onShowDossier: () {},
          onShowTrainingDebrief: () {},
          onShowPressureResponses: (_) {},
        ),
      ),
    );

Future<void> _pumpDossier(
  WidgetTester tester,
  LivingCaseVisualManifest manifest, {
  String locale = 'en',
  Size size = const Size(412, 915),
}) =>
    pumpVisualGolden(
      tester,
      configuration: _configuration(size, locale: locale),
      subject: GreenFireLivingCaseDossierScreen(
        dossier: _dossier(DossierDeadlineStatus.open),
        matterTitle: 'GreenFire: The First 72 Hours',
        treatment: manifest.caseTreatment,
        locale: locale,
      ),
    );

Future<void> _pumpOutcome(
  WidgetTester tester,
  LivingCaseVisualManifest manifest,
  LivingCaseOutcomeTreatment outcome, {
  String locale = 'en',
  bool highContrast = false,
  Size size = const Size(412, 915),
}) =>
    pumpVisualGolden(
      tester,
      configuration: _configuration(
        size,
        locale: locale,
        highContrast: highContrast,
      ),
      subject: GreenFireLivingCaseOutcomeScreen(
        debrief: _debrief(
          outcome == LivingCaseOutcomeTreatment.protected
              ? 'protected_crisis_position'
              : 'compromised_crisis_position',
        ),
        treatment: manifest.caseTreatment,
        outcomeTreatment: outcome,
        locale: locale,
      ),
    );

Future<void> _expect(WidgetTester tester, String fileName) =>
    expectVisualGolden(
      tester,
      fileName,
      directory: canonicalLivingCaseGoldenDirectory,
    );

GameSnapshot _activeSnapshot() => _baseSnapshot(
      pressure: const ActivePressureView(
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
      deadlineStatus: DossierDeadlineStatus.open,
    );

GameSnapshot _missedSnapshot() => _baseSnapshot(
      deadlineStatus: DossierDeadlineStatus.missed,
    );

GameSnapshot _historicalSnapshot() {
  final GameSnapshot base = DemoGameRepository(seed: 41).snapshot;
  return base.copyWith(
    inbox: const <InboxItemView>[],
    deadlines: const <DeadlineView>[],
    actions: const <GameActionView>[],
    dossier: _dossier(DossierDeadlineStatus.unknown),
    clearPressureAndCountermove: true,
  );
}

GameSnapshot _baseSnapshot({
  ActivePressureView? pressure,
  required DossierDeadlineStatus deadlineStatus,
}) {
  final GameSnapshot base = DemoGameRepository(seed: 41).snapshot;
  return base.copyWith(
    inbox: const <InboxItemView>[
      InboxItemView(
        id: 'regulator_document_request',
        sender: 'Port Haven Environmental Authority',
        subject: 'Environmental authority demands records',
        body:
            'The authority requests site plans, permits, inspections, and incident messages.',
        receivedAt: 'Day 1 · 10:00',
        status: InboxStatus.actionRequired,
      ),
    ],
    deadlines: <DeadlineView>[
      DeadlineView(
        id: 'initial_regulatory_response_deadline',
        title: 'Initial regulatory response',
        dueAt: 'Day 2 · 20:00',
        status: deadlineStatus == DossierDeadlineStatus.missed
            ? DeadlineStatus.missed
            : DeadlineStatus.open,
        detail: 'Respond to the visible request.',
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
    dossier: _dossier(deadlineStatus),
    pressureAndCountermove: pressure == null
        ? null
        : PressureAndCountermoveView(
            projectionSchemaVersion: 1,
            activePressures: <ActivePressureView>[pressure],
          ),
    clearPressureAndCountermove: pressure == null,
  );
}

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
      facts: const <DossierFactView>[
        DossierFactView(
          id: 'incident_occurred',
          statement: 'A fire occurred at the Port Haven facility.',
          status: DossierFactStatus.admitted,
        ),
      ],
      evidence: const <DossierEvidenceView>[
        DossierEvidenceView(
          id: 'inspection_record',
          title: 'Inspection record',
          kind: 'document',
          description:
              'The projected inspection record is available for review.',
          supportsFactIds: <String>['incident_occurred'],
          contradictsFactIds: <String>[],
        ),
      ],
      deadlines: <DossierDeadlineView>[
        DossierDeadlineView(
          id: 'initial_regulatory_response_deadline',
          title: 'Initial regulatory response',
          dueAtMinutes: 2160,
          status: status,
          remedies: const <DossierRemedyView>[
            DossierRemedyView(
              actionId: 'submit_initial_regulatory_response',
              title: 'Submit reviewed response',
              description: 'Submit the visible response.',
              timeCostMinutes: 180,
              costEur: 0,
            ),
          ],
        ),
      ],
    );

TrainingDebriefView _debrief(String outcomeId) => TrainingDebriefView(
      projectionSchemaVersion: 1,
      scenarioId: 'greenfire_first_72_hours',
      scenarioTitle: 'GreenFire: The First 72 Hours',
      resolvedOutcomeId: outcomeId,
      resolvedOutcomeTitle: outcomeId == 'protected_crisis_position'
          ? 'Protected crisis position'
          : 'Compromised crisis position',
      finalScenarioMinute: 4320,
      matterLifecycle: TrainingDebriefMatterLifecycle.closed,
      matterStatus: TrainingDebriefMatterStatus.closed,
      executedActions: const <TrainingDebriefActionView>[
        TrainingDebriefActionView(
          actionId: 'submit_initial_regulatory_response',
          title: 'Submit reviewed initial response',
          sequence: 1,
          completionMinute: 360,
          timeCostMinutes: 180,
          costEur: 0,
          billableMinutes: 180,
        ),
      ],
      resources: const <TrainingDebriefResourceView>[],
      reflectionPromptIds: const <String>[],
    );
