import 'dart:convert';

import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:juris_mobile/data/demo_game_repository.dart';
import 'package:juris_mobile/living_case/living_case_view_model.dart';
import 'package:juris_mobile/living_case/living_case_visual_manifest.dart';
import 'package:juris_mobile/models/case_catalog.dart';
import 'package:juris_mobile/models/game_snapshot.dart';
import 'package:juris_mobile/models/pressure_countermove.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  late MobileCaseDefinition greenfire;
  late LivingCaseVisualManifest manifest;

  setUpAll(() async {
    final Map<String, dynamic> bundleJson = jsonDecode(
      await rootBundle.loadString(
        'assets/case_catalog/mobile_case_bundle.json',
      ),
    ) as Map<String, dynamic>;
    greenfire = CaseCatalogBundle.fromJson(bundleJson).cases.singleWhere(
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

  LivingCaseViewModel modelFor(GameSnapshot snapshot) => LivingCaseViewModel(
        caseDefinition: greenfire,
        snapshot: snapshot,
        manifest: manifest,
        locale: 'en',
      );

  test('correlates exact actor, request, responses, and deadline values', () {
    final GameSnapshot snapshot = _snapshot(
      pressure: const ActivePressureView(
        pressureId: 'regulator_document_request_pressure',
        sourceActorId: 'port_haven_environment_authority',
        sourceActorName: 'Port Haven Environmental Authority',
        dueAtMinute: 2160,
        remainingMinutes: 540,
        availableResponseActionIds: <String>[
          'release_unreviewed_documents',
          'future_response',
          'submit_initial_regulatory_response',
        ],
      ),
    );
    final LivingCaseViewModel model = modelFor(snapshot);

    expect(model.activePressure?.remainingMinutes, 540);
    expect(model.visibleRequest?.id, 'regulator_document_request');
    expect(
      model.responseActions.map((GameActionView action) => action.id),
      <String>[
        'release_unreviewed_documents',
        'submit_initial_regulatory_response',
      ],
    );
    expect(model.deadline.state, LivingCaseDeadlineState.active);
    expect(model.deadlineProgress, closeTo(0.75, 0.0001));
  });

  test('does not show regulator identity when actor correlation fails', () {
    final LivingCaseViewModel model = modelFor(
      _snapshot(
        pressure: const ActivePressureView(
          pressureId: 'regulator_document_request_pressure',
          sourceActorId: 'future_actor',
          sourceActorName: 'Future Actor',
          dueAtMinute: 2160,
          remainingMinutes: 2000,
          availableResponseActionIds: <String>[
            'submit_initial_regulatory_response',
          ],
        ),
      ),
    );

    expect(model.activePressure, isNull);
    expect(model.visibleRequest, isNull);
    expect(model.responseActions, isEmpty);
    expect(model.deadlineProgress, isNull);
  });

  test('historical projection does not invent F1 pressure', () {
    final LivingCaseViewModel model = modelFor(
      _snapshot(clearPressure: true),
    );

    expect(model.activePressure, isNull);
    expect(model.visibleRequest, isNull);
    expect(model.deadline.state, LivingCaseDeadlineState.inactive);
  });

  test('display progress clamps malformed remaining values', () {
    LivingCaseViewModel model = modelFor(
      _snapshot(
        pressure: const ActivePressureView(
          pressureId: 'regulator_document_request_pressure',
          sourceActorId: 'port_haven_environment_authority',
          sourceActorName: 'Authority',
          dueAtMinute: 100,
          remainingMinutes: 400,
          availableResponseActionIds: <String>[],
        ),
      ),
    );
    expect(model.deadlineProgress, 0);

    model = modelFor(
      _snapshot(
        pressure: const ActivePressureView(
          pressureId: 'regulator_document_request_pressure',
          sourceActorId: 'port_haven_environment_authority',
          sourceActorName: 'Authority',
          dueAtMinute: 100,
          remainingMinutes: -20,
          availableResponseActionIds: <String>[],
        ),
      ),
    );
    expect(model.deadlineProgress, 1);
  });
}

GameSnapshot _snapshot({
  ActivePressureView? pressure,
  bool clearPressure = false,
}) {
  final GameSnapshot base = DemoGameRepository(seed: 41).snapshot;
  return base.copyWith(
    inbox: const <InboxItemView>[
      InboxItemView(
        id: 'regulator_document_request',
        sender: 'Port Haven Environmental Authority',
        subject: 'Environmental authority demands records',
        body: 'The authority requests visible records.',
        receivedAt: 'Day 1 · 10:00',
        status: InboxStatus.actionRequired,
        resolutionActionIds: <String>[
          'submit_initial_regulatory_response',
          'release_unreviewed_documents',
        ],
      ),
    ],
    deadlines: const <DeadlineView>[
      DeadlineView(
        id: 'initial_regulatory_response_deadline',
        title: 'Initial regulatory response',
        dueAt: 'Day 2 · 20:00',
        status: DeadlineStatus.open,
        detail: 'Respond to the visible request.',
      ),
    ],
    actions: const <GameActionView>[
      GameActionView(
        id: 'submit_initial_regulatory_response',
        title: 'Submit reviewed response',
        description: 'Submit the reviewed initial response.',
        timeLabel: '3h',
        costEur: 0,
        tone: ActionTone.primary,
      ),
      GameActionView(
        id: 'release_unreviewed_documents',
        title: 'Release unreviewed documents',
        description: 'Release the requested files without review.',
        timeLabel: '3h',
        costEur: 0,
        tone: ActionTone.danger,
      ),
    ],
    pressureAndCountermove: pressure == null
        ? null
        : PressureAndCountermoveView(
            projectionSchemaVersion: 1,
            activePressures: <ActivePressureView>[pressure],
          ),
    clearPressureAndCountermove: clearPressure || pressure == null,
  );
}
