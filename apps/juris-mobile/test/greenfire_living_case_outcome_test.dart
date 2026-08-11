import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:juris_mobile/app/app_theme.dart';
import 'package:juris_mobile/living_case/greenfire_living_case_outcome_screen.dart';
import 'package:juris_mobile/living_case/living_case_visual_manifest.dart';
import 'package:juris_mobile/models/training_debrief.dart';
import 'package:juris_mobile/visual_identity/case_visual_manifest.dart';

void main() {
  testWidgets('presents exact protected outcome projection',
      (WidgetTester tester) async {
    await _pump(
      tester,
      locale: 'en',
      treatment: LivingCaseOutcomeTreatment.protected,
    );

    expect(find.text('POSITION PROTECTED'), findsOneWidget);
    expect(find.text('Protected crisis position'), findsOneWidget);
    expect(find.text('Preserve evidence'), findsOneWidget);
    expect(find.text('Invented score'), findsNothing);
  });

  testWidgets('presents RU compromised outcome with high contrast',
      (WidgetTester tester) async {
    await _pump(
      tester,
      locale: 'ru',
      treatment: LivingCaseOutcomeTreatment.compromised,
      highContrast: true,
    );

    expect(find.text('ПОЗИЦИЯ ОСЛАБЛЕНА'), findsOneWidget);
    expect(
        find.byKey(const ValueKey<String>(
          'greenfire-outcome-compromised',
        )),
        findsOneWidget);
  });
}

Future<void> _pump(
  WidgetTester tester, {
  required String locale,
  required LivingCaseOutcomeTreatment treatment,
  bool highContrast = false,
}) async {
  await tester.pumpWidget(
    MaterialApp(
      theme: JurisTheme.dark(),
      home: MediaQuery(
        data: MediaQueryData(
          disableAnimations: true,
          highContrast: highContrast,
        ),
        child: GreenFireLivingCaseOutcomeScreen(
          debrief: _debrief,
          treatment: CaseVisualManifest.builtInDefaultTreatment,
          outcomeTreatment: treatment,
          locale: locale,
        ),
      ),
    ),
  );
  await tester.pump();
}

final TrainingDebriefView _debrief = TrainingDebriefView(
  projectionSchemaVersion: 1,
  scenarioId: 'greenfire_first_72_hours',
  scenarioTitle: 'GreenFire: The First 72 Hours',
  resolvedOutcomeId: 'protected_crisis_position',
  resolvedOutcomeTitle: 'Protected crisis position',
  finalScenarioMinute: 4320,
  matterLifecycle: TrainingDebriefMatterLifecycle.closed,
  matterStatus: TrainingDebriefMatterStatus.closed,
  executedActions: const <TrainingDebriefActionView>[
    TrainingDebriefActionView(
      actionId: 'preserve_evidence',
      title: 'Preserve evidence',
      sequence: 1,
      completionMinute: 60,
      timeCostMinutes: 60,
      costEur: 1000,
      billableMinutes: 60,
    ),
  ],
  resources: const <TrainingDebriefResourceView>[],
  reflectionPromptIds: const <String>[],
);
