// PREPARATION ONLY. Not installed, launched, or accepted on iOS.
// Future bytes are host-constructed while Runner is stopped. No I/O fault hook.
import 'dart:convert';
import 'dart:io';
import 'package:crypto/crypto.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';
import 'package:juris_mobile/app/juris_app.dart';
import 'package:juris_mobile/data/native_scenario_bridge_client.dart';
import 'package:juris_mobile/data/scenario_bridge_client.dart';
import 'package:juris_mobile/data/studio_authoring_services.dart';
import 'package:juris_mobile/data/studio_draft_store.dart';
import 'package:juris_mobile/models/case_type_registry.dart';
import 'package:juris_mobile/models/studio_scenario_draft.dart';
import 'package:path_provider/path_provider.dart';

const phases = <String>[
  'baseline-write',
  'baseline-read',
  'workspace-future',
  'tax-future-unsafe',
  'import-future-unsafe',
  'tax-future-safe',
  'import-future-safe',
  'tax-future-tmp',
  'tax-future-bak',
  'restored-read',
];
const selectedTest = 'production application future data preservation';
const schema = 'tax-ios-future-application-v1';
const storageRoots = <String>[
  'guided_studio_v1',
  'tax_authoring_v1',
  'authoring_import_v1',
];
late _Checkpoints _checkpoints;

void main() {
  final binding = IntegrationTestWidgetsFlutterBinding.ensureInitialized();
  // Register synchronously: flutter drive does not await an async main.
  testWidgets(selectedTest, (tester) async {
    const source = String.fromEnvironment('JURIS_ACCEPTANCE_SOURCE_SHA');
    const nonce = String.fromEnvironment('JURIS_ACCEPTANCE_RUN_NONCE');
    expect(RegExp(r'^[a-f0-9]{40}$').hasMatch(source), isTrue);
    expect(nonce, isNotEmpty);
    expect(Platform.isIOS, isTrue); // This target cannot relabel Android proof.
    final support = await getApplicationSupportDirectory();
    final controlFile = File('${support.path}/ios-future-control.json');
    // The first launch has no host control and may only establish the baseline.
    final List<int>? controlBytes = await controlFile.exists()
        ? await controlFile.readAsBytes()
        : null;
    final Map<String, dynamic>? control = controlBytes == null
        ? null
        : jsonDecode(utf8.decode(controlBytes)) as Map<String, dynamic>;
    final String phase = control?['phase'] as String? ?? 'baseline-write';
    expect(phases, contains(phase));
    _checkpoints = _Checkpoints(source, phase);
    if (control != null) {
      expect(control.keys.toSet(), <String>{
        'schema',
        'phase',
        'phase_index',
        'source_sha',
        'run_nonce',
        'previous_pid',
        'baseline_sha256',
        'fixture_base64',
      });
      expect(control['schema'], 'ios-future-host-control-v1');
      expect(control['phase_index'], phases.indexOf(phase));
      expect(control['source_sha'], source);
      expect(control['run_nonce'], nonce);
      expect(control['previous_pid'], isA<int>());
      expect(control['previous_pid'] as int, greaterThan(0));
      expect(control['previous_pid'], isNot(pid));
      expect(control['phase'], isNot('baseline-write'));
    }
    final baselineFile = File('${support.path}/ios-future-baseline.json');
    final Map<String, dynamic>? baseline = phase == 'baseline-write'
        ? null
        : jsonDecode(await baselineFile.readAsString()) as Map<String, dynamic>;
    if (baseline != null) {
      expect(baseline['schema'], schema);
      expect(baseline['source_sha'], source);
      expect(baseline['run_nonce'], nonce);
      expect(baseline['completed_phase'], 'baseline-write');
      expect(
        sha256.convert(await baselineFile.readAsBytes()).toString(),
        control!['baseline_sha256'],
      );
    }
    final before = await inventory(support);
    if (baseline == null) {
      // Empty owned directories are permitted but remain distinct from absent.
      // Any retained child or regular file refuses bootstrap without erasure.
      expect(before.keys, everyElement(isIn(storageRoots)));
      expect(before.values, everyElement(equals({'directory': true})));
      expect(await baselineFile.exists(), isFalse);
    }
    late _ObservedWorkspaceStore workspaceStore;
    final services = StudioAuthoringServices.applicationSupport(
      observeWorkspace: (store) {
        workspaceStore = _ObservedWorkspaceStore(store);
        return workspaceStore;
      },
    );
    final bridge = _ObservedNativeBridge();
    final details = <String, dynamic>{};
    await tester.pumpWidget(
      JurisApp.catalog(
        scenarioBridgeClient: bridge,
        studioAuthoringServices: services,
      ),
    );
    await binding.waitUntilFirstFrameRasterized.timeout(
      const Duration(seconds: 45),
    );
    final clipboardBefore = (await Clipboard.getData(
      Clipboard.kTextPlain,
    ))?.text;
    await _tap(tester, find.byKey(const ValueKey('product-navigation-menu')));
    await _tap(
      tester,
      find.byKey(const ValueKey('product-navigation-menu-studio')),
    );

    if (phase == 'workspace-future') {
      await _waitFor(
        tester,
        find.byKey(const ValueKey('studio-recovery-message')),
      );
      expect(find.text('Workspace recovery required'), findsOneWidget);
      for (final key in [
        'studio-title-field',
        'studio-import-scenario',
        'studio-save-export',
        'studio-guided-example',
      ]) {
        expect(find.byKey(ValueKey(key)), findsNothing);
      }
      await _tap(tester, find.byKey(const ValueKey('studio-retry-open')));
      expect(
        find.byKey(const ValueKey('studio-recovery-message')),
        findsOneWidget,
      );
      await _tap(tester, find.byKey(const ValueKey('studio-exit-action')));
      await _tap(tester, find.byKey(const ValueKey('product-navigation-menu')));
      await _tap(
        tester,
        find.byKey(const ValueKey('product-navigation-menu-studio')),
      );
      await _waitFor(
        tester,
        find.byKey(const ValueKey('studio-recovery-message')),
      );
      expect(bridge.calculations, isEmpty);
      expect(await inventory(support), before);
      details['persistent_recovery'] = true;
    } else if (phase.startsWith('import-future-')) {
      // Navigating workflow steps is itself a legitimate progress write.
      // Freeze the complete pair AFTER navigation, BEFORE the actual import.
      await _tap(tester, find.byKey(const ValueKey('studio-step-1')));
      await workspaceStore.settleWrites();
      final importBefore = await inventory(support);
      final raw = base64Decode(control!['fixture_base64'] as String);
      await Clipboard.setData(ClipboardData(text: _exactText(raw)));
      expect(
        utf8.encode((await Clipboard.getData(Clipboard.kTextPlain))!.text!),
        raw,
      );
      await _tap(tester, find.byKey(const ValueKey('studio-import-scenario')));
      final expected = phase.endsWith('unsafe')
          ? 'Aggregate number would change value when imported. Original input is unchanged.'
          : 'Unsupported analysis workspace. Original input is unchanged.';
      await _waitFor(tester, find.textContaining(expected));
      expect(find.textContaining('Source imported and saved.'), findsNothing);
      expect(await inventory(support), importBefore);
      expect(bridge.calculations, isEmpty);
      details.addAll({
        'import_before': importBefore,
        'expected_refusal': expected,
        'imported_raw_base64': base64Encode(raw),
        'navigation_progress_before_import': true,
      });
    } else {
      if (phase == 'baseline-write') {
        await _tap(tester, find.byKey(const ValueKey('studio-guided-example')));
        await _tap(tester, find.byType(DropdownButtonFormField<CaseTypeId>));
        await _tap(tester, find.text('Tax planning').last);
        for (int step = 0; step < 3; step++) {
          await _tap(tester, find.byKey(const ValueKey('studio-continue')));
        }
      }
      await workspaceStore.settleWrites();
      await _tap(
        tester,
        find.byKey(const ValueKey('studio-case-view-economics')),
      );
      await _tap(tester, find.text('Edit tax analysis'));
      if (phase.startsWith('tax-future-')) {
        await _waitFor(
          tester,
          find.textContaining('unsupported saved or interrupted analysis'),
        );
        expect(find.byKey(const ValueKey('tax-save')), findsNothing);
        expect(find.byKey(const ValueKey('tax-calculate')), findsNothing);
        expect(find.text('Import analysis / legacy input'), findsNothing);
        expect(find.text('Calculated result'), findsNothing);
        expect(bridge.command('tax_capabilities'), isEmpty);
        expect(bridge.command('tax_prepare'), isEmpty);
        expect(bridge.calculations, isEmpty);
        if (phase.endsWith('safe') || phase.endsWith('unsafe')) {
          final raw = base64Decode(control!['fixture_base64'] as String);
          final exportsBefore = await exports(support);
          await _tap(tester, find.byKey(const ValueKey('tax-export')));
          await _waitFor(tester, find.textContaining('Exported and copied: '));
          final exportsAfter = await exports(support);
          final names = exportsAfter.keys
              .where((name) => !exportsBefore.containsKey(name))
              .toList();
          expect(names, hasLength(1));
          expect(
            base64Decode(exportsAfter[names.single]!['base64'] as String),
            raw,
          );
          expect(
            utf8.encode((await Clipboard.getData(Clipboard.kTextPlain))!.text!),
            raw,
          );
          details['export'] = {
            'path': names.single,
            ...exportsAfter[names.single]!,
          };
          details['clipboard_export_base64'] = base64Encode(raw);
        }
        expect(await inventory(support), before);
        details['tax_read_only'] = true;
      } else {
        await _waitFor(
          tester,
          find.byKey(const ValueKey('tax-0-baseline_annual_tax_cost')),
        );
        if (phase == 'baseline-write') {
          await _enter(tester, 'baseline_annual_tax_cost', '250000.00');
          await _enter(tester, 'optimized_annual_tax_cost', '200000.00');
          await _tap(tester, find.byKey(const ValueKey('tax-calculate')));
        }
        await _waitFor(tester, find.text('Calculated result'));
        expect(bridge.command('tax_capabilities'), hasLength(1));
        expect(bridge.command('tax_prepare'), hasLength(1));
        expect(bridge.calculations, hasLength(1));
        expect(
          bridge.calculations.single['response']['type'],
          'tax_calculated',
        );
        if (phase == 'baseline-write') {
          await _save(tester);
          await _save(tester);
        }
        await workspaceStore.settleWrites();
        final workspace = (await workspaceStore.read())!;
        final artifact = (await services.taxArtifacts.read(
          workspace.draft.caseId,
        ))!;
        if (baseline != null) {
          expect(workspace.draft.toJson(), baseline['scenario']);
          expect(_progress(workspace), baseline['workspace_progress']);
          expect(artifact, baseline['artifact']);
          expect(await inventory(support), before);
        }
        details.addAll({
          'scenario': workspace.draft.toJson(),
          'workspace_progress': _progress(workspace),
          'artifact': artifact,
          'workspace_envelope': jsonDecode(
            await File(
              '${support.path}/guided_studio_v1/workspace.json',
            ).readAsString(),
          ),
        });
      }
    }
    await workspaceStore.settleWrites();
    expect(tester.takeException(), isNull);
    // Acceptance output is produced only after all assertions and screenshot.
    await binding.takeScreenshot('$phase-future');
    final completed = <String, dynamic>{
      'schema': schema,
      'selected_test': selectedTest,
      'phase': phase,
      'completed_phase': phase,
      'phase_index': phases.indexOf(phase),
      'control_sha256': controlBytes == null
          ? null
          : sha256.convert(controlBytes).toString(),
      'source_sha': source,
      'run_nonce': nonce,
      'pid': pid,
      'previous_pid': control?['previous_pid'],
      'platform': Platform.operatingSystem,
      'support_path': support.path,
      'entry_method': 'programmatic_flutter_test',
      'constructed_fixture': phase.contains('future'),
      'interruption_evidence': false,
      'before': before,
      'after': await inventory(support),
      'native_calls': bridge.calls,
      'clipboard_before': clipboardBefore,
      'clipboard_after': (await Clipboard.getData(Clipboard.kTextPlain))?.text,
      ...details,
    };
    if (phase == 'baseline-write') {
      await baselineFile.writeAsString(jsonEncode(completed), flush: true);
    }
    final receipt = File('${support.path}/ios-future-receipt-$phase.json');
    expect(await receipt.exists(), isFalse);
    await receipt.writeAsString(jsonEncode(completed), flush: true);
    binding.reportData = {...?binding.reportData, ...completed};
  }, timeout: const Timeout(Duration(minutes: 3)));
}

String _exactText(List<int> bytes) =>
    utf8.decode([0x20, ...bytes]).substring(1);
Map<String, dynamic> _bytes(List<int> bytes) => {
  'bytes': bytes.length,
  'sha256': sha256.convert(bytes).toString(),
  'base64': base64Encode(bytes),
};
Future<Map<String, dynamic>> inventory(Directory support) async {
  final result = <String, dynamic>{};
  for (final name in storageRoots) {
    final directory = Directory('${support.path}/$name');
    final type = await FileSystemEntity.type(
      directory.path,
      followLinks: false,
    );
    if (type == FileSystemEntityType.notFound) continue;
    expect(type, FileSystemEntityType.directory);
    result[name] = {'directory': true};
    await for (final entity in directory.list(
      recursive: true,
      followLinks: false,
    )) {
      final type = await FileSystemEntity.type(entity.path, followLinks: false);
      expect(
        type == FileSystemEntityType.file ||
            type == FileSystemEntityType.directory,
        isTrue,
      );
      final relative = entity.path.substring(support.path.length + 1);
      result[relative] = type == FileSystemEntityType.file
          ? _bytes(await File(entity.path).readAsBytes())
          : {'directory': true};
    }
  }
  return result;
}

Future<Map<String, Map<String, dynamic>>> exports(Directory support) async {
  final result = <String, Map<String, dynamic>>{};
  await for (final entity in support.list(followLinks: false)) {
    final name = entity.path.substring(support.path.length + 1);
    if (!RegExp(r'^tax-workspace-[0-9]+-[0-9]+\.json$').hasMatch(name))
      continue;
    expect(
      await FileSystemEntity.type(entity.path, followLinks: false),
      FileSystemEntityType.file,
    );
    result[name] = _bytes(await File(entity.path).readAsBytes());
  }
  return result;
}

// The UI/save helpers and pass-through stores below are copied from PR72's
// matched-service target, with the native wrapper retaining raw exchange bytes.

final class _Checkpoints {
  _Checkpoints(this.source, this.phase);
  final String source;
  final String phase;
  int _sequence = 0;
  void _mark(String name, int sequence, String state) {
    debugPrint(
      'tax_application checkpoint=$name sequence=$sequence '
      'state=$state phase=$phase source=$source',
    );
  }

  T sync<T>(String name, T Function() operation) {
    final int sequence = ++_sequence;
    _mark(name, sequence, 'start');
    final T value = operation();
    _mark(name, sequence, 'end');
    return value;
  }

  Future<T> wait<T>(String name, Future<T> Function() operation) async {
    final int sequence = ++_sequence;
    _mark(name, sequence, 'start');
    try {
      final T value = await Future<T>.sync(
        operation,
      ).timeout(const Duration(seconds: 45));
      _mark(name, sequence, 'end');
      return value;
    } on Object {
      _mark(name, sequence, 'failed');
      rethrow;
    }
  }
}

Map<String, dynamic> _progress(StudioWorkspace workspace) => <String, dynamic>{
  'active_stage': workspace.activeStage.wireName,
  'completed_stages':
      workspace.completedStages
          .map((StudioWorkflowStage stage) => stage.wireName)
          .toList()
        ..sort(),
};

Future<void> _enter(
  WidgetTester tester,
  String id,
  String value, {
  int generation = 0,
}) async {
  final Finder field = find.byKey(ValueKey('tax-$generation-$id'));
  await _waitFor(tester, field);
  await tester.ensureVisible(field);
  await tester.enterText(field, value);
  await _checkpoints.wait('entry-settle', () => tester.pumpAndSettle());
  _expectField(tester, id, value, generation: generation);
}

void _expectField(
  WidgetTester tester,
  String id,
  String value, {
  int generation = 0,
}) {
  final Finder field = find.descendant(
    of: find.byKey(ValueKey('tax-$generation-$id')),
    matching: find.byType(EditableText),
  );
  expect(tester.widget<EditableText>(field).controller.text, value);
}

Future<void> _waitFor(WidgetTester tester, Finder finder) async {
  final DateTime deadline = DateTime.now().add(const Duration(seconds: 45));
  while (finder.evaluate().isEmpty && DateTime.now().isBefore(deadline)) {
    await _checkpoints.wait(
      'find-frame',
      () => tester.pump(const Duration(milliseconds: 100)),
    );
  }
  expect(finder, findsWidgets);
  await _checkpoints.wait('find-settle', () => tester.pumpAndSettle());
}

Future<void> _tap(WidgetTester tester, Finder finder) async {
  await _waitFor(tester, finder);
  await tester.ensureVisible(finder);
  await tester.tap(finder);
  await _checkpoints.wait('tap-settle', () => tester.pumpAndSettle());
  expect(tester.takeException(), isNull);
}

Future<void> _save(WidgetTester tester) async {
  final Finder save = find.byKey(const ValueKey('tax-save'));
  await _waitFor(tester, save);
  await tester.ensureVisible(save);
  expect(save.hitTestable(), findsOneWidget);
  expect(tester.widget<FilledButton>(save).onPressed, isNotNull);
  await tester.tap(save);
  await _checkpoints.wait('save-frame', tester.pump);
  final DateTime deadline = DateTime.now().add(const Duration(seconds: 45));
  bool completed() =>
      tester.widget<FilledButton>(save).onPressed != null &&
      find
          .text('Saved on this device. Reopen Economics to continue.')
          .evaluate()
          .isNotEmpty;
  while (!completed() && DateTime.now().isBefore(deadline)) {
    await _checkpoints.wait(
      'save-wait-frame',
      () => tester.pump(const Duration(milliseconds: 100)),
    );
  }
  expect(
    completed(),
    isTrue,
    reason: 'The real asynchronous artifact write must complete.',
  );
  expect(tester.takeException(), isNull);
}

final class _ObservedWorkspaceStore implements ConditionalStudioDraftStore {
  _ObservedWorkspaceStore(this._store);
  final ConditionalStudioDraftStore _store;
  final List<Future<void>> _writes = <Future<void>>[];
  Future<void> settleWrites() async {
    for (int index = 0; index < _writes.length; index++) {
      await _writes[index];
    }
  }

  @override
  Future<StudioWorkspace?> read() => _store.read();
  @override
  Future<StudioWorkspaceSnapshot> readSnapshot() => _store.readSnapshot();
  @override
  Future<StudioWorkspaceSnapshot> writeIfUnchanged(
    StudioWorkspaceSnapshot expected,
    StudioWorkspace workspace,
  ) {
    final Future<StudioWorkspaceSnapshot> operation = _store.writeIfUnchanged(
      expected,
      workspace,
    );
    _writes.add(operation);
    return operation;
  }

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
  List<Map<String, dynamic>> command(String name) => calls
      .where((Map<String, dynamic> call) => call['request']['command'] == name)
      .toList(growable: false);
  List<Map<String, dynamic>> get calculations => command('tax_calculate');
  @override
  String execute(String encodedRequest) {
    final String response = _native.execute(encodedRequest);
    calls.add(<String, dynamic>{
      'request_json': encodedRequest,
      'response_json': response,
      'request': jsonDecode(encodedRequest),
      'response': jsonDecode(response),
    });
    return response;
  }
}
