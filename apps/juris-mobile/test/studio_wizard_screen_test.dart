import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:crypto/crypto.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:juris_mobile/app/app_theme.dart';
import 'package:juris_mobile/data/scenario_bridge_client.dart';
import 'package:juris_mobile/data/studio_authoring_repository.dart';
import 'package:juris_mobile/data/studio_authoring_services.dart';
import 'package:juris_mobile/data/studio_draft_store.dart';
import 'package:juris_mobile/data/tax_artifact_store.dart';
import 'package:juris_mobile/models/case_type_playbook.dart';
import 'package:juris_mobile/models/case_type_registry.dart';
import 'package:juris_mobile/models/studio_scenario_draft.dart';
import 'package:juris_mobile/screens/studio_wizard_screen.dart';
import 'package:juris_mobile/screens/tax_editor_screen.dart';
import 'package:juris_mobile/widgets/studio_case_views.dart';
import 'support/tax_artifact_fixture.dart';

final CaseTypePlaybookRegistry _testPlaybooks =
    CaseTypePlaybookRegistry.fromJson(
  jsonDecode(
    File('../../contracts/case-type-playbooks.v1.json').readAsStringSync(),
  ),
);

void main() {
  testWidgets('replacing the matched root cancels pending tax navigation',
      (WidgetTester tester) async {
    await tester.runAsync(() async {
      final Directory firstRoot =
              await Directory.systemTemp.createTemp('wizard-old-root-'),
          nextRoot = await Directory.systemTemp.createTemp('wizard-new-root-');
      addTearDown(() async {
        await firstRoot.delete(recursive: true);
        await nextRoot.delete(recursive: true);
      });
      late _PausedWorkspaceStore observed;
      final StudioAuthoringServices first =
          StudioAuthoringServices.applicationSupport(
              directoryProvider: () async => firstRoot,
              observeWorkspace: (store) =>
                  observed = _PausedWorkspaceStore(store));
      final StudioAuthoringServices next =
          StudioAuthoringServices.applicationSupport(
              directoryProvider: () async => nextRoot);
      await first.workspace.write(_readyWorkspace(StudioWorkflowStage.caseMap));
      final StudioScenarioDraft nextDraft = StudioScenarioDraft.guidedExample()
          .updateIdentity(
              title: 'Different root source',
              jurisdiction: 'BE',
              role: 'Reviewer',
              premise: 'New root');
      await next.workspace.write(StudioWorkspace(
          draft: nextDraft,
          activeStage: StudioWorkflowStage.describe,
          completedStages: {}));
      await _mountStore(tester, first.workspace,
          authoringServices: first, waitForDisk: true);
      observed.release = Completer<void>();
      tester
          .widget<StudioCaseViews>(find.byType(StudioCaseViews))
          .onTaxEconomics!();
      await observed.entered.future;
      await tester.pump();
      expect(find.byType(TextField), findsWidgets);
      expect(
          tester
              .widgetList<TextField>(find.byType(TextField))
              .every((field) => field.readOnly),
          isTrue);
      await _mountStore(tester, next.workspace,
          authoringServices: next, waitForDisk: true);
      observed.release!.complete();
      await observed.finished.future;
      await tester.pumpAndSettle();
      expect(find.byType(TaxEditorScreen), findsNothing);
      expect(
          tester
              .widget<TextField>(
                  find.byKey(const ValueKey('studio-title-field')))
              .controller!
              .text,
          'Different root source');
      expect(
          (await next.workspace.read())!.draft.title, 'Different root source');
      expect(await Directory('${nextRoot.path}/tax_authoring_v1').exists(),
          isFalse);
      expect(tester.takeException(), isNull);
    });
  });

  testWidgets('unmatched custom workspace never opens implicit tax storage',
      (WidgetTester tester) async {
    final _MemoryStudioStore store = _MemoryStudioStore()
      ..workspace = _readyWorkspace(StudioWorkflowStage.describe);
    final Map<String, dynamic> imported = taxArtifactFixture();
    imported['scenario'] = store.workspace!.draft.toJson();
    int pathCalls = 0, clipboardWrites = 0;
    const MethodChannel paths =
        MethodChannel('plugins.flutter.io/path_provider');
    tester.binding.defaultBinaryMessenger.setMockMethodCallHandler(paths,
        (call) async {
      pathCalls++;
      throw StateError('Unexpected implicit storage');
    });
    tester.binding.defaultBinaryMessenger
        .setMockMethodCallHandler(SystemChannels.platform, (call) async {
      if (call.method == 'Clipboard.getData')
        return {'text': jsonEncode(imported)};
      if (call.method == 'Clipboard.setData') clipboardWrites++;
      return null;
    });
    addTearDown(() {
      tester.binding.defaultBinaryMessenger
          .setMockMethodCallHandler(paths, null);
      tester.binding.defaultBinaryMessenger
          .setMockMethodCallHandler(SystemChannels.platform, null);
    });
    await _mountStore(tester, store);
    await tester.tap(find.text('Import scenario or analysis workspace'));
    await tester.pumpAndSettle();
    expect(find.textContaining('unavailable for this custom workspace'),
        findsOneWidget);
    expect(store.writes, 0);
    expect(pathCalls, 0);
    expect(clipboardWrites, 0);
    expect(
        tester
            .widget<TextField>(find.byKey(const ValueKey('studio-title-field')))
            .controller!
            .text,
        store.workspace!.draft.title);
  });

  testWidgets(
      'clipboard wait freezes controls and unmount cancels before persistence',
      (WidgetTester tester) async {
    final _MemoryStudioStore store = _MemoryStudioStore()
      ..workspace = _readyWorkspace(StudioWorkflowStage.describe);
    final Completer<Map<String, String>> clipboard =
        Completer<Map<String, String>>();
    tester.binding.defaultBinaryMessenger
        .setMockMethodCallHandler(SystemChannels.platform, (call) async {
      if (call.method == 'Clipboard.getData') return clipboard.future;
      return null;
    });
    addTearDown(() => tester.binding.defaultBinaryMessenger
        .setMockMethodCallHandler(SystemChannels.platform, null));
    await _mountStore(tester, store);
    await tester.tap(find.text('Import scenario or analysis workspace'));
    await tester.pump();
    expect(
        tester
            .widget<TextField>(find.byKey(const ValueKey('studio-title-field')))
            .readOnly,
        isTrue);
    expect(
        tester
            .widget<AbsorbPointer>(
                find.byKey(const ValueKey('studio-busy-controls')))
            .absorbing,
        isTrue);
    expect(
        tester
            .widget<IconButton>(
                find.byKey(const ValueKey('studio-exit-action')))
            .onPressed,
        isNull);
    await tester.pumpWidget(const SizedBox.shrink());
    clipboard.complete(
        {'text': jsonEncode(StudioScenarioDraft.guidedExample().toJson())});
    await tester.pumpAndSettle();
    expect(store.writes, 0);
    expect(tester.takeException(), isNull);
  });

  testWidgets('stale workspace edits remain exportable until explicit reopen', (
    WidgetTester tester,
  ) async {
    await tester.runAsync(() async {
      final Directory root = await Directory.systemTemp.createTemp(
        'wizard-cas-',
      );
      addTearDown(() => root.delete(recursive: true));
      final ApplicationSupportStudioDraftStore store =
          ApplicationSupportStudioDraftStore(
        directoryProvider: () async => root,
      );
      StudioWorkspace workspace(String title) => StudioWorkspace(
            draft: StudioScenarioDraft.guidedExample().updateIdentity(
              title: title,
              jurisdiction: 'BE',
              role: 'Counsel',
              premise: 'Retained source',
            ),
            activeStage: StudioWorkflowStage.describe,
            completedStages: {},
          );
      await store.write(workspace('Loaded generation'));
      await _mountStore(tester, store, waitForDisk: true);
      await _waitForStudio(
        tester,
        () => find
            .byKey(const ValueKey('studio-title-field'))
            .evaluate()
            .isNotEmpty,
      );
      await store.write(workspace('Another editor saved'));
      final Finder title = find.byKey(const ValueKey('studio-title-field'));
      await tester.enterText(title, 'My unsaved title');
      await _waitForStudio(
        tester,
        () =>
            find
                .byKey(const ValueKey('studio-reopen-saved'))
                .evaluate()
                .isNotEmpty &&
            _saveStatus(tester) == 'Not saved',
      );
      expect(
        find.byKey(const ValueKey('studio-reopen-saved')).hitTestable(),
        findsOneWidget,
      );
      expect((await store.read())!.draft.title, 'Another editor saved');
      expect(
        tester.widget<TextField>(title).controller!.text,
        'My unsaved title',
      );

      String? clipboard;
      tester.binding.defaultBinaryMessenger.setMockMethodCallHandler(
        SystemChannels.platform,
        (call) async {
          if (call.method == 'Clipboard.setData')
            clipboard = (call.arguments as Map)['text'] as String;
          return null;
        },
      );
      addTearDown(
        () => tester.binding.defaultBinaryMessenger.setMockMethodCallHandler(
          SystemChannels.platform,
          null,
        ),
      );
      await tester.tap(find.byKey(const ValueKey('studio-export-unsaved')));
      await _waitForStudio(tester, () => clipboard != null);
      expect(jsonDecode(clipboard!)['metadata']['title'], 'My unsaved title');
      expect((await store.read())!.draft.title, 'Another editor saved');
      await tester.ensureVisible(
        find.byKey(const ValueKey('studio-reopen-saved')),
      );
      await tester.tap(find.byKey(const ValueKey('studio-reopen-saved')));
      await tester.pumpAndSettle();
      await tester.tap(find.widgetWithText(TextButton, 'Keep editing'));
      await tester.pumpAndSettle();
      expect(
        tester.widget<TextField>(title).controller!.text,
        'My unsaved title',
      );
      await tester.ensureVisible(title);
      await tester.enterText(title, 'Still unsaved');
      await _waitForStudio(tester, () => _saveStatus(tester) == 'Not saved');
      expect((await store.read())!.draft.title, 'Another editor saved');
      await tester.ensureVisible(
        find.byKey(const ValueKey('studio-reopen-saved')),
      );
      await tester.tap(find.byKey(const ValueKey('studio-reopen-saved')));
      await tester.pumpAndSettle();
      await tester.tap(find.widgetWithText(TextButton, 'Reopen and discard'));
      await _waitForStudio(
        tester,
        () =>
            find
                .byKey(const ValueKey('studio-reopen-saved'))
                .evaluate()
                .isEmpty &&
            find.byType(CircularProgressIndicator).evaluate().isEmpty,
      );
      expect(
        tester.widget<TextField>(title).controller!.text,
        'Another editor saved',
      );
      await tester.ensureVisible(title);
      await tester.enterText(title, 'Authorized new edit');
      await _waitForStudio(tester, () => _saveStatus(tester) == 'Auto-saved');
      expect((await store.read())!.draft.title, 'Authorized new edit');
      expect(tester.takeException(), isNull);
    });
  });

  for (final String state in ['supported', 'conflict', 'future']) {
    testWidgets(
        'tax workspace import $state uses the observed sidecar generation',
        (WidgetTester tester) async {
      await tester.runAsync(() async {
        final Directory root =
            await Directory.systemTemp.createTemp('wizard-tax-import-');
        addTearDown(() => root.delete(recursive: true));
        final StudioScenarioDraft scenario =
            StudioScenarioDraft.guidedExample();
        Map<String, dynamic> artifact(String text) {
          final Map<String, dynamic> value = taxArtifactFixture(text);
          value['case_id'] = scenario.caseId;
          value['scenario'] = scenario.toJson();
          value['request']['context']['case_id'] = scenario.caseId;
          return value;
        }

        final TaxArtifactStore sidecar =
            TaxArtifactStore(directoryProvider: () async => root);
        await sidecar.write(scenario.caseId, artifact('existing'));
        final File target = File('${root.path}/tax_authoring_v1/'
            '${sha256.convert(utf8.encode(scenario.caseId))}.json');
        final Map<String, dynamic> replacement = artifact('imported');
        replacement['calculation'] = {'untrusted_cached': true};
        if (state == 'future') {
          await target.writeAsString(jsonEncode(
              artifact('future')..['schema'] = 'tax-authoring-artifact-v99'));
        }
        final String before = await target.readAsString();
        int resolutions = 0;
        const MethodChannel paths =
            MethodChannel('plugins.flutter.io/path_provider');
        tester.binding.defaultBinaryMessenger.setMockMethodCallHandler(paths,
            (call) async {
          expect(call.method, 'getApplicationSupportDirectory');
          resolutions++;
          if (state == 'conflict' && resolutions == 2) {
            // An independently committed generation appeared after snapshot
            // read and before conditional write. Direct disk setup avoids
            // reentering the shared coordinator from a provider callback.
            await target.writeAsString(jsonEncode(artifact('competing')));
          }
          return root.path;
        });
        tester.binding.defaultBinaryMessenger
            .setMockMethodCallHandler(SystemChannels.platform, (call) async {
          if (call.method == 'Clipboard.getData')
            return {'text': jsonEncode(replacement)};
          return null;
        });
        addTearDown(() {
          tester.binding.defaultBinaryMessenger
              .setMockMethodCallHandler(paths, null);
          tester.binding.defaultBinaryMessenger
              .setMockMethodCallHandler(SystemChannels.platform, null);
        });
        final StudioAuthoringServices services =
            StudioAuthoringServices.applicationSupport();
        final ConditionalStudioDraftStore workspace = services.workspace;
        await _mountStore(tester, workspace,
            waitForDisk: true, authoringServices: services);
        resolutions = 0;
        await tester.tap(find.text('Import scenario or analysis workspace'));
        final Finder completed = state == 'supported'
            ? find.textContaining('Source imported and saved.')
            : find.textContaining('Import failed:');
        for (int i = 0; i < 250 && completed.evaluate().isEmpty; i++) {
          await Future<void>.delayed(const Duration(milliseconds: 20));
          await tester.pump();
        }
        await tester.pumpAndSettle();
        expect(completed, findsOneWidget);
        if (state == 'supported') {
          final StudioWorkspace savedWorkspace = (await workspace.read())!;
          expect(savedWorkspace.draft.toJson(), scenario.toJson());
          expect(savedWorkspace.activeStage, StudioWorkflowStage.describe);
          expect(savedWorkspace.completedStages, isEmpty);
          final Map<String, dynamic> saved =
              (await sidecar.read(scenario.caseId))!;
          expect(saved['edit']['baseline_annual_tax_cost'], 'imported');
          expect(saved['artifact_revision'], '2');
          expect(saved['calculation'], isNull);
          expect(saved['request']['context']['scenario_fingerprint'],
              replacement['request']['context']['scenario_fingerprint']);
          expect(saved['legacy'], replacement['legacy']);
        } else {
          expect(await workspace.read(), isNull);
          expect(await target.readAsString(),
              state == 'future' ? before : jsonEncode(artifact('competing')));
        }
        expect(tester.takeException(), isNull);
      });
    });
  }

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

Future<void> _mountStore(WidgetTester tester, StudioDraftStore store,
    {bool waitForDisk = false,
    StudioAuthoringServices? authoringServices}) async {
  await tester.pumpWidget(
    MaterialApp(
      theme: JurisTheme.dark(),
      home: StudioWizardScreen(
        repository: StudioAuthoringRepository(_WizardBridge()),
        store: store,
        authoringServices: authoringServices,
        locale: 'en',
        onExit: () {},
        playbookRegistry: _testPlaybooks,
      ),
    ),
  );
  if (waitForDisk) {
    await _waitForStudio(tester,
        () => find.byType(CircularProgressIndicator).evaluate().isEmpty);
  } else {
    await tester.pumpAndSettle();
  }
}

Future<void> _waitForStudio(WidgetTester tester, bool Function() ready) async {
  for (int i = 0; i < 250; i++) {
    await Future<void>.delayed(const Duration(milliseconds: 20));
    await tester.pump();
    if (ready()) {
      await tester.pumpAndSettle();
      return;
    }
  }
  throw StateError('Studio persistence did not settle.');
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

final class _PausedWorkspaceStore implements ConditionalStudioDraftStore {
  _PausedWorkspaceStore(this.inner);
  final ConditionalStudioDraftStore inner;
  final Completer<void> entered = Completer<void>(),
      finished = Completer<void>();
  Completer<void>? release;
  @override
  Future<StudioWorkspaceSnapshot> readSnapshot() => inner.readSnapshot();
  @override
  Future<StudioWorkspaceSnapshot> writeIfUnchanged(
      StudioWorkspaceSnapshot expected, StudioWorkspace workspace) async {
    entered.complete();
    await release!.future;
    final StudioWorkspaceSnapshot result =
        await inner.writeIfUnchanged(expected, workspace);
    finished.complete();
    return result;
  }

  @override
  Future<StudioWorkspace?> read() => inner.read();
  @override
  Future<void> write(StudioWorkspace workspace) => inner.write(workspace);
  @override
  Future<String> exportScenario(StudioScenarioDraft draft) =>
      inner.exportScenario(draft);
}
