import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:juris_mobile/app/app_theme.dart';
import 'package:juris_mobile/design/juris_design.dart';
import 'package:juris_mobile/living_case/greenfire_living_case_dossier_screen.dart';
import 'package:juris_mobile/models/dossier_projection.dart';
import 'package:juris_mobile/visual_identity/case_visual_manifest.dart';

void main() {
  testWidgets(
      'presents authoritative identity, procedure, and ordered material',
      (WidgetTester tester) async {
    await _pump(tester, size: const Size(1024, 768));

    expect(find.text(_matterTitle), findsOneWidget);
    expect(find.textContaining('Immediate response'), findsWidgets);
    expect(find.text('Matter open'), findsWidgets);
    expect(find.text('Active'), findsWidgets);
    expect(find.text('Open file'), findsOneWidget);
    expect(find.text('180 min'), findsOneWidget);
    expect(
      find.byKey(const ValueKey<String>('greenfire-dossier-layout-wide')),
      findsOneWidget,
    );
    expect(
      find.byKey(const ValueKey<String>('greenfire-dossier-section-procedure')),
      findsOneWidget,
    );

    await _reveal(
      tester,
      find.byKey(const ValueKey<String>('greenfire-fact-visible_fact')),
    );
    final Finder firstFact =
        find.byKey(const ValueKey<String>('greenfire-fact-visible_fact'));
    final Finder secondFact =
        find.byKey(const ValueKey<String>('greenfire-fact-disputed_fact'));
    expect(firstFact, findsOneWidget);
    expect(secondFact, findsOneWidget);
    expect(tester.getTopLeft(firstFact).dy,
        lessThan(tester.getTopLeft(secondFact).dy));
    expect(find.text('Visible incident fact'), findsWidgets);
    expect(find.text('Disputed timing fact'), findsWidgets);

    await _reveal(
      tester,
      find.byKey(
          const ValueKey<String>('greenfire-evidence-inspection_record')),
    );
    expect(find.text('Inspection record'), findsOneWidget);
    expect(find.text('Visible record description'), findsOneWidget);
    expect(
      find.descendant(
        of: find.byKey(
          const ValueKey<String>('greenfire-evidence-inspection_record'),
        ),
        matching: find.text('Supports visible facts'),
      ),
      findsOneWidget,
    );
    expect(
      find.descendant(
        of: find.byKey(
          const ValueKey<String>('greenfire-evidence-inspection_record'),
        ),
        matching: find.text('Contradicts visible facts'),
      ),
      findsOneWidget,
    );
    expect(find.text('visible_fact'), findsNothing);
    expect(find.text('disputed_fact'), findsNothing);
    expect(find.text('Unprojected legal theory'), findsNothing);
    expect(find.text('Communications'), findsNothing);
    expect(find.text('Source'), findsNothing);

    await _reveal(
      tester,
      find.byKey(
        const ValueKey<String>('greenfire-dossier-section-disposition'),
      ),
    );
    expect(find.text('Partially won'), findsOneWidget);
    expect(find.text('Appeal'), findsOneWidget);
    expect(find.text('Protected interim position'), findsOneWidget);
    expect(
        find.text('The projected position remains protected.'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  testWidgets('evidence selection is public, semantic, and not colour-only',
      (WidgetTester tester) async {
    await _pump(tester, size: const Size(800, 1280));
    final Finder evidence = find.byKey(
      const ValueKey<String>('greenfire-evidence-inspection_record'),
    );
    await _reveal(tester, evidence);

    expect(evidence.hitTestable(), findsOneWidget);
    expect(tester.getSize(evidence).height, greaterThanOrEqualTo(48));
    expect(
      find.descendant(
        of: evidence,
        matching: find.text('Show document details'),
      ),
      findsOneWidget,
    );
    expect(
      find.ancestor(
        of: evidence,
        matching: find.byWidgetPredicate(
          (Widget widget) =>
              widget is Semantics &&
              widget.properties.button == true &&
              widget.properties.selected == false &&
              (widget.properties.label ?? '').contains(
                'Show document details',
              ),
        ),
      ),
      findsOneWidget,
    );

    await tester.tap(evidence);
    await tester.pump();

    expect(find.text('Selected visible document'), findsOneWidget);
    expect(
      find.ancestor(
        of: evidence,
        matching: find.byWidgetPredicate(
          (Widget widget) =>
              widget is Semantics &&
              widget.properties.button == true &&
              widget.properties.selected == true &&
              (widget.properties.label ?? '').contains(
                'Hide document details',
              ),
        ),
      ),
      findsOneWidget,
    );

    await tester.sendKeyEvent(LogicalKeyboardKey.tab);
    await tester.pump();
    expect(tester.takeException(), isNull);
  });

  testWidgets('remedy uses ordinary scrolling and returns its exact action id',
      (WidgetTester tester) async {
    String? selectedActionId;
    await _pumpLauncher(
      tester,
      onResult: (String? value) => selectedActionId = value,
    );
    await tester.tap(find.text('Open dossier'));
    await tester.pumpAndSettle();

    final Finder remedy = find.byKey(
      const ValueKey<String>(
        'greenfire-dossier-remedy-submit_initial_regulatory_response',
      ),
    );
    await _reveal(tester, remedy);

    expect(remedy.hitTestable(), findsOneWidget);
    expect(tester.getSize(remedy).height, greaterThanOrEqualTo(48));
    expect(find.text('Submit the visible response.'), findsOneWidget);
    expect(find.text('180 min · EUR 0'), findsOneWidget);

    await tester.tap(remedy);
    await tester.pumpAndSettle();

    expect(selectedActionId, 'submit_initial_regulatory_response');
    expect(find.text('Open dossier'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  testWidgets('uses honest RU empty and unknown states at 200 percent',
      (WidgetTester tester) async {
    await _pump(
      tester,
      dossier: _emptyDossier,
      locale: 'ru',
      size: const Size(360, 800),
      textScale: 2,
      mode: JurisVisualMode.office,
    );

    expect(find.text('Досье'), findsOneWidget);
    expect(
      find.byKey(const ValueKey<String>('greenfire-dossier-layout-compact')),
      findsOneWidget,
    );
    expect(find.text('Статус дела неизвестен'), findsWidgets);
    expect(find.text('Неизвестно'), findsWidgets);

    await _reveal(tester, find.text('В этой проекции факты не отображаются.'));
    expect(find.text('В этой проекции факты не отображаются.'), findsOneWidget);
    await _reveal(
      tester,
      find.text('В этой проекции доказательства не отображаются.'),
    );
    expect(
      find.text('В этой проекции доказательства не отображаются.'),
      findsOneWidget,
    );
    await _reveal(tester, find.text('В этой проекции сроки не отображаются.'));
    expect(find.text('В этой проекции сроки не отображаются.'), findsOneWidget);
    await _reveal(
      tester,
      find.text(
        'В этой проекции судебный результат или итог не отображается.',
      ),
    );
    expect(
      find.text(
        'В этой проекции судебный результат или итог не отображается.',
      ),
      findsOneWidget,
    );
    expect(tester.takeException(), isNull);
  });

  testWidgets('reports an honest empty remedy state',
      (WidgetTester tester) async {
    await _pump(tester, dossier: _noRemedyDossier);
    await _reveal(
      tester,
      find.text('No remedies are visible for this deadline.'),
    );

    expect(
      find.text('No remedies are visible for this deadline.'),
      findsOneWidget,
    );
    expect(
      find.byKey(
        const ValueKey<String>(
          'greenfire-dossier-remedy-submit_initial_regulatory_response',
        ),
      ),
      findsNothing,
    );
    expect(tester.takeException(), isNull);
  });

  testWidgets('keeps compact and wide boundaries stable across text scale',
      (WidgetTester tester) async {
    await _pump(
      tester,
      locale: 'ru',
      size: const Size(699, 900),
      textScale: 2,
      mode: JurisVisualMode.office,
      highContrast: true,
    );
    expect(
      find.byKey(const ValueKey<String>('greenfire-dossier-layout-compact')),
      findsOneWidget,
    );
    expect(tester.takeException(), isNull);

    await _pump(
      tester,
      size: const Size(700, 900),
      textScale: 2,
      mode: JurisVisualMode.afterHours,
    );
    expect(
      find.byKey(const ValueKey<String>('greenfire-dossier-layout-compact')),
      findsOneWidget,
    );
    expect(tester.takeException(), isNull);

    await _pump(
      tester,
      locale: 'ru',
      size: const Size(800, 1280),
      mode: JurisVisualMode.afterHours,
    );
    expect(
      find.byKey(const ValueKey<String>('greenfire-dossier-layout-wide')),
      findsOneWidget,
    );
    expect(find.text('ИНДЕКС ДЕЛА'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });
}

Future<void> _pump(
  WidgetTester tester, {
  DossierProjectionView dossier = _dossier,
  String locale = 'en',
  Size size = const Size(412, 915),
  double textScale = 1,
  JurisVisualMode mode = JurisVisualMode.office,
  bool highContrast = false,
}) async {
  tester.view.devicePixelRatio = 1;
  tester.view.physicalSize = size;
  addTearDown(tester.view.reset);
  await tester.pumpWidget(
    MaterialApp(
      theme: JurisTheme.forMode(mode, highContrast: highContrast),
      home: MediaQuery(
        data: MediaQueryData(
          size: size,
          textScaler: TextScaler.linear(textScale),
          highContrast: highContrast,
          disableAnimations: true,
          accessibleNavigation: true,
        ),
        child: GreenFireLivingCaseDossierScreen(
          dossier: dossier,
          matterTitle: _matterTitle,
          treatment: CaseVisualManifest.builtInDefaultTreatment,
          locale: locale,
        ),
      ),
    ),
  );
  await tester.pumpAndSettle();
}

Future<void> _pumpLauncher(
  WidgetTester tester, {
  required ValueChanged<String?> onResult,
}) async {
  tester.view.devicePixelRatio = 1;
  tester.view.physicalSize = const Size(412, 915);
  addTearDown(tester.view.reset);
  await tester.pumpWidget(
    MaterialApp(
      theme: JurisTheme.office(),
      home: Builder(
        builder: (BuildContext context) => Scaffold(
          body: Center(
            child: FilledButton(
              onPressed: () async {
                final String? result = await Navigator.of(context).push<String>(
                  MaterialPageRoute<String>(
                    builder: (BuildContext context) =>
                        GreenFireLivingCaseDossierScreen(
                      dossier: _dossier,
                      matterTitle: _matterTitle,
                      treatment: CaseVisualManifest.builtInDefaultTreatment,
                      locale: 'en',
                    ),
                  ),
                );
                onResult(result);
              },
              child: const Text('Open dossier'),
            ),
          ),
        ),
      ),
    ),
  );
  await tester.pumpAndSettle();
}

Future<void> _reveal(WidgetTester tester, Finder target) async {
  final Finder viewport = find.byKey(
    const PageStorageKey<String>('greenfire-dossier-scroll'),
  );
  expect(viewport, findsOneWidget);
  final Finder scrollable = find.descendant(
    of: viewport,
    matching: find.byType(Scrollable),
  );
  expect(scrollable, findsOneWidget);

  double? previousPixels;
  for (int attempt = 0; attempt < 36; attempt += 1) {
    if (target.hitTestable().evaluate().isNotEmpty) {
      return;
    }
    final ScrollableState state = tester.state<ScrollableState>(scrollable);
    final double pixels = state.position.pixels;
    if (previousPixels != null && (pixels - previousPixels).abs() < 0.5) {
      break;
    }
    previousPixels = pixels;
    await tester.drag(scrollable, const Offset(0, -240));
    await tester.pump();
  }
  expect(target.hitTestable(), findsOneWidget);
}

const String _matterTitle = 'GreenFire: The First 72 Hours';

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
  judicialResult: DossierJudicialResult.partiallyWon,
  judicialDecisionInstance: DossierJudicialDecisionInstance.appeal,
  facts: <DossierFactView>[
    DossierFactView(
      id: 'visible_fact',
      statement: 'Visible incident fact',
      status: DossierFactStatus.alleged,
    ),
    DossierFactView(
      id: 'disputed_fact',
      statement: 'Disputed timing fact',
      status: DossierFactStatus.disputed,
    ),
  ],
  evidence: <DossierEvidenceView>[
    DossierEvidenceView(
      id: 'inspection_record',
      title: 'Inspection record',
      kind: 'document',
      description: 'Visible record description',
      supportsFactIds: <String>['visible_fact'],
      contradictsFactIds: <String>['disputed_fact'],
    ),
    DossierEvidenceView(
      id: 'incident_log',
      title: 'Incident log',
      kind: 'record',
      supportsFactIds: <String>[],
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
  outcome: DossierOutcomeView(
    id: 'protected_interim_position',
    title: 'Protected interim position',
    summary: 'The projected position remains protected.',
  ),
);

const DossierProjectionView _emptyDossier = DossierProjectionView(
  projectionSchemaVersion: 1,
  procedure: DossierProcedureView(
    stageId: 'unknown',
    stageTitle: 'Неизвестный этап',
    clockMinutes: 0,
    matterLifecycle: DossierLifecycleStatus.unknown,
    isClosed: false,
    matterStatus: DossierMatterStatus.unknown,
  ),
  facts: <DossierFactView>[],
  evidence: <DossierEvidenceView>[],
  deadlines: <DossierDeadlineView>[],
);

const DossierProjectionView _noRemedyDossier = DossierProjectionView(
  projectionSchemaVersion: 1,
  procedure: DossierProcedureView(
    stageId: 'response',
    stageTitle: 'Immediate response',
    clockMinutes: 180,
    matterLifecycle: DossierLifecycleStatus.active,
    isClosed: false,
    matterStatus: DossierMatterStatus.open,
  ),
  facts: <DossierFactView>[],
  evidence: <DossierEvidenceView>[],
  deadlines: <DossierDeadlineView>[
    DossierDeadlineView(
      id: 'no_remedy_deadline',
      title: 'Deadline without projected remedy',
      dueAtMinutes: 300,
      status: DossierDeadlineStatus.unknown,
      remedies: <DossierRemedyView>[],
    ),
  ],
);
