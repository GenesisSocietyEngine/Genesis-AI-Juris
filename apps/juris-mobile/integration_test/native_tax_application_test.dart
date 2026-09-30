// Production application acceptance using the real native bridge and stores.
import 'dart:convert';
import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';
import 'package:juris_mobile/app/juris_app.dart';
import 'package:juris_mobile/data/native_scenario_bridge_client.dart';
import 'package:juris_mobile/data/scenario_bridge_client.dart';
import 'package:juris_mobile/data/studio_draft_store.dart';
import 'package:juris_mobile/data/tax_artifact_store.dart';
import 'package:juris_mobile/models/case_type_registry.dart';
import 'package:juris_mobile/models/studio_scenario_draft.dart';
import 'package:path_provider/path_provider.dart';

void main() {
  final IntegrationTestWidgetsFlutterBinding binding =
      IntegrationTestWidgetsFlutterBinding.ensureInitialized();
  const String phase = String.fromEnvironment('JURIS_TAX_APP_PHASE');
  const String source = String.fromEnvironment('JURIS_ACCEPTANCE_SOURCE_SHA');
  const String runNonce = String.fromEnvironment('JURIS_ACCEPTANCE_RUN_NONCE');
  if (phase != 'write' && phase != 'read') {
    throw StateError(
        'Select write or read on an isolated acceptance simulator.');
  }
  if (!RegExp(r'^[a-f0-9]{40}$').hasMatch(source) || runNonce.isEmpty) {
    throw StateError('An exact source and per-run nonce are required.');
  }
  testWidgets('production application tax $phase across process restart',
      (WidgetTester tester) async {
    final Directory support = await getApplicationSupportDirectory();
    final File proof = File('${support.path}/tax-application-acceptance.json');
    final _ObservedWorkspaceStore workspaceStore = _ObservedWorkspaceStore();
    final TaxArtifactStore taxStore = TaxArtifactStore();
    final _ObservedNativeBridge bridge = _ObservedNativeBridge();
    Map<String, dynamic>? previous;
    if (phase == 'write') {
      // Never erase another simulator user's saved work to make a test pass.
      expect(await workspaceStore.read(), isNull,
          reason: 'Use a fresh isolated simulator for the write phase.');
      expect(await proof.exists(), isFalse);
      final Directory sidecars = Directory('${support.path}/tax_authoring_v1');
      if (await sidecars.exists()) {
        expect(await sidecars.list().isEmpty, isTrue,
            reason: 'Retain existing sidecars, including interrupted files.');
      }
    } else {
      previous = jsonDecode(await proof.readAsString()) as Map<String, dynamic>;
      expect(previous['source_sha'], source);
      expect(previous['run_nonce'], runNonce);
      expect(previous['pid'], isNot(pid),
          reason: 'The read journey must execute in a new OS process.');
    }

    await tester.pumpWidget(JurisApp.catalog(
        scenarioBridgeClient: bridge, studioDraftStore: workspaceStore));
    await _waitFor(
        tester, find.byKey(const ValueKey('product-navigation-menu')));
    await _tap(tester, find.byKey(const ValueKey('product-navigation-menu')));
    await _tap(
        tester, find.byKey(const ValueKey('product-navigation-menu-studio')));
    if (phase == 'write') {
      await _waitFor(
          tester, find.byKey(const ValueKey('studio-guided-example')));
      await _tap(tester, find.byKey(const ValueKey('studio-guided-example')));
      final Finder matter = find.byType(DropdownButtonFormField<CaseTypeId>);
      await _tap(tester, matter);
      await _tap(tester, find.text('Tax planning').last);
      for (int step = 0; step < 3; step++) {
        await _tap(tester, find.byKey(const ValueKey('studio-continue')));
      }
    }
    await workspaceStore.settleWrites();
    await _waitFor(
        tester, find.byKey(const ValueKey('studio-case-view-economics')));
    await _tap(
        tester, find.byKey(const ValueKey('studio-case-view-economics')));
    await _tap(tester, find.text('Edit tax analysis'));
    await _waitFor(
        tester, find.byKey(const ValueKey('tax-0-baseline_annual_tax_cost')));

    if (phase == 'write') {
      await tester.enterText(
          find.byKey(const ValueKey('tax-0-baseline_annual_tax_cost')),
          '250000.00');
      await tester.enterText(
          find.byKey(const ValueKey('tax-0-optimized_annual_tax_cost')),
          '200000.00');
      await _tap(tester, find.byKey(const ValueKey('tax-calculate')));
    }
    await _waitFor(tester, find.text('Calculated result'));
    for (final MapEntry<String, String> input in <String, String>{
      'baseline_annual_tax_cost': '250000.00',
      'optimized_annual_tax_cost': '200000.00',
    }.entries) {
      final Finder field = find.descendant(
          of: find.byKey(ValueKey('tax-0-${input.key}')),
          matching: find.byType(EditableText));
      expect(tester.widget<EditableText>(field).controller.text, input.value);
    }
    final List<Map<String, dynamic>> calculations = bridge.calls
        .where((Map<String, dynamic> call) =>
            (call['request'] as Map<String, dynamic>)['command'] ==
            'tax_calculate')
        .toList(growable: false);
    expect(calculations, hasLength(1),
        reason: 'A current result requires an actual native calculation.');
    final Map<String, dynamic> response =
        calculations.single['response'] as Map<String, dynamic>;
    expect(response['type'], 'tax_calculated');
    final Map<String, dynamic> result = (response['calculation']
        as Map<String, dynamic>)['result'] as Map<String, dynamic>;
    expect(result['recognized_annual_tax_saving'], '5000000');
    expect(result['lifecycle_net_benefit'], '50000000');

    await _save(tester);
    await workspaceStore.settleWrites();
    final StudioWorkspace workspace = (await workspaceStore.read())!;
    expect(workspace.activeStage, StudioWorkflowStage.caseMap);
    final Map<String, dynamic> progress = <String, dynamic>{
      'active_stage': workspace.activeStage.wireName,
      'completed_stages': workspace.completedStages
          .map((StudioWorkflowStage stage) => stage.wireName)
          .toList()
        ..sort(),
    };
    final Map<String, dynamic> artifact =
        (await taxStore.read(workspace.draft.caseId))!;
    if (phase == 'write') {
      expect(artifact['artifact_revision'], '1');
      await proof.writeAsString(
          jsonEncode(<String, dynamic>{
            'pid': pid,
            'source_sha': source,
            'run_nonce': runNonce,
            'artifact': artifact,
            'scenario': workspace.draft.toJson(),
            'workspace_progress': progress,
            'native': calculations.single,
          }),
          flush: true);
    } else {
      expect(workspace.draft.toJson(), previous!['scenario']);
      expect(progress, previous['workspace_progress']);
      expect(artifact, previous['artifact']);
      expect(calculations.single, previous['native'],
          reason:
              'Reopen must freshly reproduce the complete native exchange.');
    }
    // Two unchanged saves must preserve the complete revision-bound artifact.
    await _save(tester);
    expect(await taxStore.read(workspace.draft.caseId), artifact);
    expect(tester.takeException(), isNull);
    if (Platform.isAndroid) {
      await binding.convertFlutterSurfaceToImage();
      await tester.pump();
    }
    await binding.takeScreenshot('$phase-editor');
    binding.reportData = <String, dynamic>{
      ...?binding.reportData,
      'schema': 'tax-mobile-application-acceptance-v1',
      'phase': phase,
      'pid': pid,
      'previous_pid': previous?['pid'],
      'platform': Platform.operatingSystem,
      'artifact': artifact,
      'scenario': workspace.draft.toJson(),
      'workspace_progress': progress,
      'native_calls': bridge.calls,
      'source_sha': source,
      'run_nonce': runNonce,
    };
  });
}

Future<void> _waitFor(WidgetTester tester, Finder finder) async {
  final DateTime deadline = DateTime.now().add(const Duration(seconds: 45));
  while (finder.evaluate().isEmpty && DateTime.now().isBefore(deadline)) {
    await tester.pump(const Duration(milliseconds: 100));
  }
  expect(finder, findsWidgets);
  await tester.pumpAndSettle();
}

Future<void> _tap(WidgetTester tester, Finder finder) async {
  await _waitFor(tester, finder);
  await tester.ensureVisible(finder);
  await tester.tap(finder);
  await tester.pumpAndSettle();
  expect(tester.takeException(), isNull);
}

Future<void> _save(WidgetTester tester) async {
  final Finder save = find.byKey(const ValueKey('tax-save'));
  await _waitFor(tester, save);
  await tester.ensureVisible(save);
  expect(save.hitTestable(), findsOneWidget);
  expect(tester.widget<FilledButton>(save).onPressed, isNotNull);
  await tester.tap(save);
  await tester.pump();
  final DateTime deadline = DateTime.now().add(const Duration(seconds: 45));
  bool completed() =>
      tester.widget<FilledButton>(save).onPressed != null &&
      find
          .text('Saved on this device. Reopen Economics to continue.')
          .evaluate()
          .isNotEmpty;
  while (!completed() && DateTime.now().isBefore(deadline)) {
    await tester.pump(const Duration(milliseconds: 100));
  }
  expect(completed(), isTrue,
      reason: 'The real asynchronous artifact write must complete.');
  expect(tester.takeException(), isNull);
}

final class _ObservedWorkspaceStore implements StudioDraftStore {
  final ApplicationSupportStudioDraftStore _store =
      ApplicationSupportStudioDraftStore();
  final List<Future<void>> _writes = <Future<void>>[];
  Future<void> settleWrites() async {
    for (int index = 0; index < _writes.length; index++) {
      await _writes[index];
    }
  }

  @override
  Future<StudioWorkspace?> read() => _store.read();
  @override
  Future<void> write(StudioWorkspace workspace) {
    final Future<void> operation = _store.write(workspace);
    _writes.add(operation);
    return operation;
  }

  @override
  Future<String> exportScenario(StudioScenarioDraft draft) =>
      _store.exportScenario(draft);
}

final class _ObservedNativeBridge implements ScenarioBridgeClient {
  final NativeScenarioBridgeClient _native = NativeScenarioBridgeClient();
  final List<Map<String, dynamic>> calls = <Map<String, dynamic>>[];
  @override
  String execute(String encodedRequest) {
    final String response = _native.execute(encodedRequest);
    calls.add(<String, dynamic>{
      'request': jsonDecode(encodedRequest),
      'response': jsonDecode(response),
    });
    return response;
  }
}
