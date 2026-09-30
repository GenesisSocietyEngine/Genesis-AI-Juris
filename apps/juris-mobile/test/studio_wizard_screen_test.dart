import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:juris_mobile/app/app_theme.dart';
import 'package:juris_mobile/data/scenario_bridge_client.dart';
import 'package:juris_mobile/data/studio_authoring_repository.dart';
import 'package:juris_mobile/data/studio_draft_store.dart';
import 'package:juris_mobile/models/case_type_playbook.dart';
import 'package:juris_mobile/models/case_type_registry.dart';
import 'package:juris_mobile/models/studio_scenario_draft.dart';
import 'package:juris_mobile/screens/studio_wizard_screen.dart';

final CaseTypePlaybookRegistry _testPlaybooks =
    CaseTypePlaybookRegistry.fromJson(
  jsonDecode(
    File('../../contracts/case-type-playbooks.v1.json').readAsStringSync(),
  ),
);

void main() {
  for (final String code in [
    'workspace_unsupported',
    'workspace_recovery_required',
    'workspace_read_failed'
  ]) {
    testWidgets(
        '$code stays read-only across retry without creating a blank save',
        (WidgetTester tester) async {
      final _MemoryStudioStore store = _MemoryStudioStore()
        ..readError =
            StudioStorageException(code: code, message: 'Original retained.');
      await _mountStore(tester, store);
      expect(find.text('Workspace recovery required'), findsOneWidget);
      expect(find.byKey(const ValueKey('studio-title-field')), findsNothing);
      expect(find.byKey(const ValueKey('studio-guided-example')), findsNothing);
      expect(find.byKey(const ValueKey('studio-continue')), findsNothing);
      expect(_saveStatus(tester), 'Read-only');
      await tester.tap(find.byKey(const ValueKey('studio-retry-open')));
      await tester.pumpAndSettle();
      expect(find.text('Workspace recovery required'), findsOneWidget);
      expect(store.writes, 0);
      expect(store.exports, 0);
      expect(tester.takeException(), isNull);

      store.readError = null;
      store.workspace = _readyWorkspace(StudioWorkflowStage.describe);
      await tester.tap(find.byKey(const ValueKey('studio-retry-open')));
      await tester.pumpAndSettle();
      expect(find.text('Workspace recovery required'), findsNothing);
      expect(find.byKey(const ValueKey('studio-title-field')), findsOneWidget);
      expect(_saveStatus(tester), 'Auto-saved');
      expect(store.writes, 0);
    });
  }

  testWidgets(
      'autosave reports pending and failure while retaining editable text',
      (WidgetTester tester) async {
    final _MemoryStudioStore store = _MemoryStudioStore();
    await _mountStore(tester, store);
    expect(_saveStatus(tester), 'Not saved yet');
    store.pendingWrite = Completer<void>();
    store.writeError = const StudioStorageException(
        code: 'workspace_write_failed', message: 'Disk unavailable.');
    await tester.tap(find.byKey(const ValueKey('studio-guided-example')));
    await tester.pump();
    expect(_saveStatus(tester), 'Saving…');
    store.pendingWrite!.complete();
    await tester.pumpAndSettle();
    expect(_saveStatus(tester), 'Not saved');
    expect(find.textContaining('Save failed:'), findsOneWidget);
    expect(
        tester
            .widget<TextField>(find.byKey(const ValueKey('studio-title-field')))
            .controller!
            .text,
        'Supplier transition dispute');
    expect(store.workspace, isNull);
    expect(tester.takeException(), isNull);

    store.pendingWrite = null;
    store.writeError = null;
    await tester.enterText(
        find.byKey(const ValueKey('studio-title-field')), 'Retried title');
    await tester.pumpAndSettle();
    expect(_saveStatus(tester), 'Auto-saved');
    expect(store.workspace!.draft.title, 'Retried title');
  });

  testWidgets('awaited save failure prevents export and never announces Saved',
      (WidgetTester tester) async {
    final _MemoryStudioStore store =
        _MemoryStudioStore(_readyWorkspace(StudioWorkflowStage.runCompare));
    await _mountStore(tester, store);
    await tester.tap(find.byKey(const ValueKey('studio-rust-gate')));
    await tester.pumpAndSettle();
    await tester.tap(find.byKey(const ValueKey('studio-continue')));
    await tester.pumpAndSettle();
    store.writeError = const StudioStorageException(
        code: 'workspace_write_failed', message: 'Disk unavailable.');
    final Finder export = find.byKey(const ValueKey('studio-save-export'));
    await tester.ensureVisible(export);
    await tester.tap(export);
    await tester.pumpAndSettle();
    expect(store.exports, 0);
    expect(find.textContaining('Saved. The exported file'), findsNothing);
    expect(find.textContaining('Save failed:'), findsOneWidget);
    expect(_saveStatus(tester), 'Not saved');
    expect(tester.takeException(), isNull);
  });

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
          playbookRegistry: _testPlaybooks,
        ),
      ),
    );
    await tester.pumpAndSettle();

    for (int step = 1; step <= 6; step += 1) {
      expect(find.byKey(ValueKey<String>('studio-step-$step')), findsOneWidget);
    }
    expect(find.text('Use a guided example'), findsOneWidget);
    expect(find.text('Describe my own case'), findsOneWidget);
    expect(find.text('Import scenario or analysis workspace'), findsOneWidget);
    expect(find.text('Advisory decision'), findsOneWidget);
    expect(find.textContaining('Decision memorandum'), findsOneWidget);

    await tester
        .tap(find.byKey(const ValueKey<String>('studio-guided-example')));
    await tester.pumpAndSettle();
    expect(find.text('Supplier transition dispute'), findsWidgets);
    expect(
      tester
          .widget<FilledButton>(
            find.byKey(const ValueKey<String>('studio-continue')),
          )
          .onPressed,
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
          playbookRegistry: _testPlaybooks,
        ),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('Compile and play every deterministic route'),
        findsOneWidget);
    await tester.tap(find.byKey(const ValueKey<String>('studio-rust-gate')));
    await tester.pumpAndSettle();

    expect(find.text('Package ready'), findsOneWidget);
    expect(find.textContaining('2 actions'), findsOneWidget);
    expect(
      tester
          .widget<FilledButton>(
            find.byKey(const ValueKey<String>('studio-continue')),
          )
          .onPressed,
      isNotNull,
    );
  });

  testWidgets('advisory package validates without executing a fake route', (
    WidgetTester tester,
  ) async {
    final _WizardBridge bridge = _WizardBridge();
    final StudioScenarioDraft advisory = StudioScenarioDraft.guidedExample()
        .updateCaseType(CaseTypeId.generalAdvisory);
    final _MemoryStudioStore store = _MemoryStudioStore(
      StudioWorkspace(
        draft: advisory,
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
          repository: StudioAuthoringRepository(bridge),
          store: store,
          locale: 'en',
          onExit: () {},
          playbookRegistry: _testPlaybooks,
        ),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('Review evidence coverage and compare options'),
        findsOneWidget);
    await tester.tap(find.byKey(const ValueKey<String>('studio-rust-gate')));
    await tester.pumpAndSettle();

    expect(find.text('Package ready'), findsOneWidget);
    expect(bridge.routeCalls, 0);
    expect(
      tester
          .widget<FilledButton>(
            find.byKey(const ValueKey<String>('studio-continue')),
          )
          .onPressed,
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
          playbookRegistry: _testPlaybooks,
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
    expect(find.textContaining('Rust remains the validation authority'),
        findsOneWidget);
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
  Object? readError;
  Object? writeError;
  Completer<void>? pendingWrite;
  int writes = 0;
  int exports = 0;

  @override
  Future<StudioWorkspace?> read() async {
    if (readError != null) throw readError!;
    return workspace;
  }

  @override
  Future<void> write(StudioWorkspace workspace) async {
    writes++;
    await pendingWrite?.future;
    if (writeError != null) throw writeError!;
    this.workspace = workspace;
  }

  @override
  Future<String> exportScenario(StudioScenarioDraft draft) async {
    exports++;
    return '/tmp/${draft.caseId}.scenario.json';
  }
}

Future<void> _mountStore(WidgetTester tester, StudioDraftStore store) async {
  await tester.pumpWidget(MaterialApp(
    theme: JurisTheme.dark(),
    home: StudioWizardScreen(
        repository: StudioAuthoringRepository(_WizardBridge()),
        store: store,
        locale: 'en',
        onExit: () {},
        playbookRegistry: _testPlaybooks),
  ));
  await tester.pumpAndSettle();
}

String? _saveStatus(WidgetTester tester) => tester
    .widget<Semantics>(find.byKey(const ValueKey('studio-save-status')))
    .properties
    .label;

StudioWorkspace _readyWorkspace(StudioWorkflowStage stage) => StudioWorkspace(
        draft: StudioScenarioDraft.guidedExample(),
        activeStage: stage,
        completedStages: {
          StudioWorkflowStage.describe,
          StudioWorkflowStage.reviewAiDraft,
          StudioWorkflowStage.factsAssumptions,
          StudioWorkflowStage.caseMap
        });

final class _WizardBridge implements ScenarioBridgeClient {
  int _turn = 0;
  int routeCalls = 0;

  @override
  String execute(String encodedRequest) {
    final Map<String, dynamic> request =
        jsonDecode(encodedRequest) as Map<String, dynamic>;
    switch (request['command']) {
      case 'validate_scenario':
        return '{"type":"scenario_validated","valid":true,"diagnostics":[]}';
      case 'create_session':
        routeCalls += 1;
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
