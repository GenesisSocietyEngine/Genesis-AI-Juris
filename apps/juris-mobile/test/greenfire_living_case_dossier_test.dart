import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:juris_mobile/app/app_theme.dart';
import 'package:juris_mobile/living_case/greenfire_living_case_dossier_screen.dart';
import 'package:juris_mobile/models/dossier_projection.dart';
import 'package:juris_mobile/visual_identity/case_visual_manifest.dart';

void main() {
  testWidgets('renders only projected material and selects visible evidence',
      (WidgetTester tester) async {
    await _pump(tester, locale: 'en');

    expect(find.text('Visible incident fact'), findsOneWidget);
    expect(find.text('Inspection record'), findsOneWidget);
    expect(find.text('Selected visible document'), findsNothing);
    expect(find.text('Unprojected legal theory'), findsNothing);

    await tester.tap(find.text('Inspection record'));
    await tester.pump();

    expect(find.text('Visible record description'), findsOneWidget);
    expect(find.text('Selected visible document'), findsOneWidget);
  });

  testWidgets('exposes RU chrome without changing projected material',
      (WidgetTester tester) async {
    await _pump(tester, locale: 'ru');

    expect(find.text('Досье GreenFire'), findsOneWidget);
    expect(find.text('ВИДИМЫЕ ФАКТЫ'), findsOneWidget);
    expect(find.text('Visible incident fact'), findsOneWidget);
  });
}

Future<void> _pump(WidgetTester tester, {required String locale}) async {
  await tester.pumpWidget(
    MaterialApp(
      theme: JurisTheme.dark(),
      home: MediaQuery(
        data: const MediaQueryData(disableAnimations: true),
        child: GreenFireLivingCaseDossierScreen(
          dossier: _dossier,
          treatment: CaseVisualManifest.builtInDefaultTreatment,
          locale: locale,
        ),
      ),
    ),
  );
  await tester.pump();
}

const DossierProjectionView _dossier = DossierProjectionView(
  projectionSchemaVersion: 1,
  procedure: DossierProcedureView(
    stageId: 'response',
    stageTitle: 'Immediate response',
    clockMinutes: 180,
    matterLifecycle: DossierLifecycleStatus.active,
    isClosed: false,
    matterStatus: DossierMatterStatus.open,
  ),
  facts: <DossierFactView>[
    DossierFactView(
      id: 'visible_fact',
      statement: 'Visible incident fact',
      status: DossierFactStatus.alleged,
    ),
  ],
  evidence: <DossierEvidenceView>[
    DossierEvidenceView(
      id: 'inspection_record',
      title: 'Inspection record',
      kind: 'document',
      description: 'Visible record description',
      supportsFactIds: <String>['visible_fact'],
      contradictsFactIds: <String>[],
    ),
  ],
  deadlines: <DossierDeadlineView>[
    DossierDeadlineView(
      id: 'initial_regulatory_response_deadline',
      title: 'Initial regulatory response',
      dueAtMinutes: 2160,
      status: DossierDeadlineStatus.open,
      remedies: <DossierRemedyView>[
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
