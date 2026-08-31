import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:juris_mobile/app/app_theme.dart';
import 'package:juris_mobile/data/scenario_bridge_client.dart';
import 'package:juris_mobile/data/studio_authoring_repository.dart';
import 'package:juris_mobile/data/studio_draft_store.dart';
import 'package:juris_mobile/models/studio_scenario_draft.dart';
import 'package:juris_mobile/screens/studio_wizard_screen.dart';

void main() {
  testWidgets('Guided Studio exposes the shared six-stage low-entry workflow', (
    WidgetTester tester,
  ) async {
    await tester.pumpWidget(
      MaterialApp(
        theme: JurisTheme.dark(),
        home: StudioWizardScreen(
          repository: StudioAuthoringRepository(_WizardBridge()),
          store: _MemoryStudioStore(),
          locale: 'en',
          onExit: () {},
        ),
      ),
    );
    await tester.pumpAndSettle();

    for (int step = 1; step <= 6; step += 1) {
      expect(find.byKey(ValueKey<String>('studio-step-$step')), findsOneWidget);
    }
    expect(find.text('Use a guided example'), findsOneWidget);
    expect(find.text('Describe my own case'), findsOneWidget);
    expect(find.text('Import canonical JSON'), findsOneWidget);
    expect(find.text('Advisory decision'), findsOneWidget);
    expect(find.textContaining('Decision memorandum'), findsOneWidget);

    await tester.tap(find.byKey(const ValueKey<String>('studio-guided-example')));
    await tester.pumpAndSettle();
    expect(find.text('Supplier transition dispute'), findsWidgets);
    expect(
      tester.widget<FilledButton>(
        find.byKey(const ValueKey<String>('studio-continue')),
      ).onPressed,
      isNotNull,
    );
  });

  testWidgets('Finish unlocks only after validation and execution in Rust', (
    WidgetTester tester,
  ) async {
    final _MemoryStudioStore store = _MemoryStudioStore(
      StudioWorkspace(
        draft: StudioScenarioDraft.guidedExample(),
        activeStage: StudioWorkflowStage.runCompare,
        completedStages: <StudioWorkflowStage>{
          StudioWorkflowStage.describe,
          StudioWorkflowStage.reviewAiDraft,
          StudioWorkflowStage.factsAssumptions,
          StudioWorkflowStage.caseMap,
        },
      ),
    );
    await tester.pumpWidget(
      MaterialApp(
        theme: JurisTheme.dark(),
        home: StudioWizardScreen(
          repository: StudioAuthoringRepository(_WizardBridge()),
          store: store,
          locale: 'en',
          onExit: () {},
        ),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('Rust validation and route test'), findsOneWidget);
    await tester.tap(find.byKey(const ValueKey<String>('studio-rust-gate')));
    await tester.pumpAndSettle();

    expect(find.text('Schema valid'), findsOneWidget);
    expect(find.textContaining('2 actions'), findsOneWidget);
    expect(
      tester.widget<FilledButton>(
        find.byKey(const ValueKey<String>('studio-continue')),
      ).onPressed,
      isNotNull,
    );
  });

  testWidgets('case map exposes package-defined read-only projections', (
    WidgetTester tester,
  ) async {
    final _MemoryStudioStore store = _MemoryStudioStore(
      StudioWorkspace(
        draft: StudioScenarioDraft.guidedExample(),
        activeStage: StudioWorkflowStage.caseMap,
        completedStages: <StudioWorkflowStage>{
          StudioWorkflowStage.describe,
          StudioWorkflowStage.reviewAiDraft,
          StudioWorkflowStage.factsAssumptions,
        },
      ),
    );
    await tester.pumpWidget(
      MaterialApp(
        theme: JurisTheme.dark(),
        home: StudioWizardScreen(
          repository: StudioAuthoringRepository(_WizardBridge()),
          store: store,
          locale: 'en',
          onExit: () {},
        ),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('Professional case views'), findsOneWidget);
    expect(
      find.byKey(
        const ValueKey<String>('studio-case-view-simulation'),
      ),
      findsOneWidget,
    );
    expect(find.textContaining('Rust remains the validation authority'), findsOneWidget);
    await tester.tap(
      find.byKey(const ValueKey<String>('studio-case-view-timeline')),
    );
    await tester.pumpAndSettle();
    expect(
      find.byKey(
        const ValueKey<String>('studio-case-view-panel-timeline'),
      ),
      findsOneWidget,
    );
    expect(find.text('Understand the matter'), findsWidgets);
  });
}

final class _MemoryStudioStore implements StudioDraftStore {
  _MemoryStudioStore([this.workspace]);

  StudioWorkspace? workspace;

  @override
  Future<StudioWorkspace?> read() async => workspace;

  @override
  Future<void> write(StudioWorkspace workspace) async {
    this.workspace = workspace;
  }

  @override
  Future<String> exportScenario(StudioScenarioDraft draft) async {
    return '/tmp/${draft.caseId}.scenario.json';
  }
}

final class _WizardBridge implements ScenarioBridgeClient {
  int _turn = 0;

  @override
  String execute(String encodedRequest) {
    final Map<String, dynamic> request =
        jsonDecode(encodedRequest) as Map<String, dynamic>;
    switch (request['command']) {
      case 'validate_scenario':
        return '{"type":"scenario_validated","valid":true,"diagnostics":[]}';
      case 'create_session':
        _turn = 0;
        return jsonEncode(<String, dynamic>{
          'type': 'session_created',
          'session_id': 54,
          'snapshot': _snapshot('assess_case'),
        });
      case 'dispatch':
        _turn += 1;
        return jsonEncode(<String, dynamic>{
          'type': 'snapshot',
          'session_id': 54,
          'snapshot': _turn == 1
              ? _snapshot('close_case')
              : <String, dynamic>{
                  'available_actions': <dynamic>[],
                  'resolved_outcome': 'guided_resolution',
                },
        });
      case 'dispose_session':
        return '{"type":"session_disposed","session_id":54,"disposed":true}';
      default:
        throw StateError('Unexpected command ${request['command']}');
    }
  }

  Map<String, dynamic> _snapshot(String id) => <String, dynamic>{
        'available_actions': <Map<String, dynamic>>[
          <String, dynamic>{'id': id},
        ],
      };
}
