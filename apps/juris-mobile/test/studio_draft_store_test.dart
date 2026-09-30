import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:juris_mobile/data/studio_draft_store.dart';
import 'package:juris_mobile/models/studio_scenario_draft.dart';

void main() {
  late Directory root;
  late File target;
  late ApplicationSupportStudioDraftStore store;

  setUp(() async {
    root = await Directory.systemTemp.createTemp('studio-recovery-');
    final Directory directory = Directory('${root.path}/guided_studio_v1');
    await directory.create();
    target = File('${directory.path}/workspace.json');
    store =
        ApplicationSupportStudioDraftStore(directoryProvider: () async => root);
  });
  tearDown(() => root.delete(recursive: true));

  test('empty storage and committed generations round trip with a backup',
      () async {
    expect(await store.read(), isNull);
    await store.write(_workspace('A'));
    await store.write(_workspace('B'));
    expect((await store.read())!.draft.title, 'B');
    expect(
        jsonDecode(await File('${target.path}.bak').readAsString())['scenario']
            ['metadata']['title'],
        'A');
    expect(await File('${target.path}.tmp').exists(), isFalse);
  });

  test('missing primary recovers a supported backup without discarding it',
      () async {
    final Map<String, dynamic> envelope = _envelope('A');
    envelope['scenario']['retained_extension'] = {
      'original': '  exact nested content  ',
      'values': [
        1,
        null,
        {'extra': true}
      ]
    };
    final String saved = const JsonEncoder.withIndent('   ').convert(envelope);
    await File('${target.path}.bak').writeAsString(saved);
    final StudioWorkspace restored = (await store.read())!;
    expect(restored.draft.title, 'A');
    expect(restored.activeStage, StudioWorkflowStage.caseMap);
    expect(restored.completedStages, {StudioWorkflowStage.describe});
    expect(restored.draft.toJson(), envelope['scenario']);
    expect(await target.readAsString(), saved);
    expect(await File('${target.path}.bak').readAsString(), saved);
    await store.write(restored);
    expect((await store.read())!.draft.toJson(), envelope['scenario']);
  });

  for (final List<int> corrupt in <List<int>>[
    utf8.encode('{ interrupted'),
    <int>[0xff, 0xfe, 0x00],
  ]) {
    test('corrupt primary bytes $corrupt survive validated backup recovery',
        () async {
      await target.writeAsBytes(corrupt);
      await File('${target.path}.bak').writeAsString(_encoded('A'));
      expect((await store.read())!.draft.title, 'A');
      final List<File> preserved = await _matching(target, '.corrupt-');
      expect(preserved, hasLength(1));
      expect(await preserved.single.readAsBytes(), corrupt);
      expect(await File('${target.path}.bak').exists(), isTrue);
    });
  }

  test('valid primary wins; next write retains an orphan temp verbatim',
      () async {
    final String orphan = _encoded('uncommitted');
    await target.writeAsString(_encoded('current'));
    await File('${target.path}.bak').writeAsString(_encoded('older'));
    await File('${target.path}.tmp').writeAsString(orphan);
    expect((await store.read())!.draft.title, 'current');
    expect(await File('${target.path}.tmp').readAsString(), orphan);
    await store.write(_workspace('next'));
    final List<File> retained = await _matching(target, '.tmp.interrupted-');
    expect(retained, hasLength(1));
    expect(await retained.single.readAsString(), orphan);
    expect((await store.read())!.draft.title, 'next');
    expect(
        jsonDecode(await File('${target.path}.bak').readAsString())['scenario']
            ['metadata']['title'],
        'current');
  });

  test('new write preserves a corrupt old backup before rotating', () async {
    await target.writeAsString(_encoded('current'));
    await File('${target.path}.bak').writeAsString('broken backup');
    await store.write(_workspace('next'));
    expect(
        await (await _matching(target, '.bak.corrupt-')).single.readAsString(),
        'broken backup');
    expect((await store.read())!.draft.title, 'next');
  });

  final Map<String, Map<String, String>> unresolved = {
    'corrupt primary': {'': 'broken'},
    'both corrupt': {'': 'broken', '.bak': 'also broken'},
    'invalid backup': {'.bak': 'broken'},
    'only valid temp': {'.tmp': _encoded('uncommitted')},
    'only partial temp': {'.tmp': '{ partial'},
  };
  for (final MapEntry<String, Map<String, String>> state
      in unresolved.entries) {
    test('${state.key} blocks reads and writes without discarding bytes',
        () async {
      for (final MapEntry<String, String> file in state.value.entries) {
        await File('${target.path}${file.key}').writeAsString(file.value);
      }
      final Map<String, List<int>> before = await _files(target.parent);
      await expectLater(
          store.read(), throwsA(_storageCode('workspace_recovery_required')));
      await expectLater(store.write(_workspace('replacement')),
          throwsA(_storageCode('workspace_recovery_required')));
      expect(await _files(target.parent), before);
    });
  }

  final Map<String, Map<String, dynamic>> futureStates = {
    'workspace schema': {..._envelope('future'), 'schema_version': 2},
    'extra envelope data': {
      ..._envelope('future'),
      'future_payload': {'keep': true}
    },
    'scenario schema': _futureScenario(),
    'case-type package': _futurePackage(),
    'workflow stage': {..._envelope('future'), 'active_stage': 'future_review'},
  };
  for (final MapEntry<String, Map<String, dynamic>> state
      in futureStates.entries) {
    test('unsupported ${state.key} never downgrades to an older backup',
        () async {
      await target.writeAsString(jsonEncode(state.value));
      await File('${target.path}.bak').writeAsString(_encoded('older'));
      final Map<String, List<int>> before = await _files(target.parent);
      await expectLater(
          store.read(), throwsA(_storageCode('workspace_unsupported')));
      await expectLater(store.write(_workspace('replacement')),
          throwsA(_storageCode('workspace_unsupported')));
      expect(await _files(target.parent), before);
    });
  }

  for (final String suffix in ['.bak', '.tmp']) {
    test('future $suffix stays intact alongside an authoritative valid primary',
        () async {
      await target.writeAsString(_encoded('current'));
      await File('${target.path}$suffix')
          .writeAsString(jsonEncode(futureStates['workspace schema']));
      final Map<String, List<int>> before = await _files(target.parent);
      expect((await store.read())!.draft.title, 'current');
      await expectLater(store.write(_workspace('replacement')),
          throwsA(_storageCode('workspace_unsupported')));
      expect(await _files(target.parent), before);
    });
  }

  test('malformed supported backup is not promoted', () async {
    final Map<String, dynamic> invalid = _envelope('bad');
    (invalid['scenario'] as Map<String, dynamic>)['metadata']['id'] = 7;
    final File backup = File('${target.path}.bak');
    await backup.writeAsString(jsonEncode(invalid));
    await expectLater(
        store.read(), throwsA(_storageCode('workspace_recovery_required')));
    expect(await target.exists(), isFalse);
    expect(await backup.readAsString(), jsonEncode(invalid));
  });

  test('future backup without a primary is never promoted or replaced',
      () async {
    final File backup = File('${target.path}.bak');
    final String saved = jsonEncode(futureStates['workspace schema']);
    await backup.writeAsString(saved);
    await expectLater(
        store.read(), throwsA(_storageCode('workspace_unsupported')));
    await expectLater(store.write(_workspace('replacement')),
        throwsA(_storageCode('workspace_unsupported')));
    expect(await target.exists(), isFalse);
    expect(await backup.readAsString(), saved);
  });

  test(
      'two stores sharing a resolved path preserve read ordering and frozen input',
      () async {
    final Completer<void> entered = Completer<void>();
    final Completer<void> release = Completer<void>();
    final ApplicationSupportStudioDraftStore first =
        ApplicationSupportStudioDraftStore(directoryProvider: () async {
      if (!entered.isCompleted) {
        entered.complete();
        await release.future;
      }
      return root;
    });
    final ApplicationSupportStudioDraftStore second =
        ApplicationSupportStudioDraftStore(
            directoryProvider: () async => Directory('${root.path}/.'));
    final Set<StudioWorkflowStage> completed = {StudioWorkflowStage.describe};
    final Future<void> a = first.write(_workspace('A', completed: completed));
    await entered.future;
    completed.add(StudioWorkflowStage.reportSave);
    final Future<StudioWorkspace?> between = second.read();
    final Future<void> b = second.write(_workspace('B'));
    release.complete();
    await a;
    final StudioWorkspace observed = (await between)!;
    expect(observed.draft.title, 'A');
    expect(observed.completedStages, {StudioWorkflowStage.describe});
    await b;
    expect((await first.read())!.draft.title, 'B');
  });

  test('overlapping store instances cannot share a temporary write generation',
      () async {
    final ApplicationSupportStudioDraftStore other =
        ApplicationSupportStudioDraftStore(directoryProvider: () async => root);
    await Future.wait(List<Future<void>>.generate(
        20,
        (int i) =>
            (i.isEven ? store : other).write(_workspace('generation $i'))));
    expect((await other.read())!.draft.title, 'generation 19');
    expect(await _matching(target, '.tmp.interrupted-'), isEmpty);
    expect(
        jsonDecode(await File('${target.path}.bak').readAsString())['scenario']
            ['metadata']['title'],
        'generation 18');
  });

  test(
      'failed queued write reaches its caller without poisoning later operations',
      () async {
    await target.writeAsString(_encoded('current'));
    final File future = File('${target.path}.tmp');
    await future.writeAsString(jsonEncode(futureStates['workspace schema']));
    await expectLater(store.write(_workspace('blocked')),
        throwsA(_storageCode('workspace_unsupported')));
    expect((await store.read())!.draft.title, 'current');
    await future.rename('${future.path}.retained-by-test');
    await store.write(_workspace('retry'));
    expect((await store.read())!.draft.title, 'retry');
  });

  test('scenario export also refuses to overwrite a future source document',
      () async {
    final StudioScenarioDraft draft = _workspace('current').draft;
    final String path = await store.exportScenario(draft);
    expect(await File(path).readAsString(),
        const JsonEncoder.withIndent(' ').convert(draft.toJson()));
    final Map<String, dynamic> future = draft.toJson()
      ..['schema_version'] = '2.0';
    await File(path).writeAsString(jsonEncode(future));
    await expectLater(store.exportScenario(draft),
        throwsA(_storageCode('workspace_unsupported')));
    expect(await File(path).readAsString(), jsonEncode(future));
  });
}

Matcher _storageCode(String code) => isA<StudioStorageException>()
    .having((StudioStorageException error) => error.code, 'code', code);

StudioWorkspace _workspace(String title,
        {Set<StudioWorkflowStage>? completed}) =>
    StudioWorkspace(
      draft: StudioScenarioDraft.guidedExample().updateIdentity(
          title: title,
          jurisdiction: 'BE',
          role: 'Counsel',
          premise: 'Retained scenario'),
      activeStage: StudioWorkflowStage.caseMap,
      completedStages: completed ?? {StudioWorkflowStage.describe},
    );

Map<String, dynamic> _envelope(String title) => {
      'schema_version': 1,
      'scenario': _workspace(title).draft.toJson(),
      'active_stage': 'case_map',
      'completed_stages': ['describe'],
    };
String _encoded(String title) => jsonEncode(_envelope(title));
Map<String, dynamic> _futureScenario() {
  final Map<String, dynamic> value = _envelope('future');
  value['scenario']['schema_version'] = '2.0';
  return value;
}

Map<String, dynamic> _futurePackage() {
  final Map<String, dynamic> value = _envelope('future');
  value['scenario']['metadata']['case_type']['version'] = '2.0.0';
  return value;
}

Future<List<File>> _matching(File target, String suffix) async =>
    (await target.parent.list().toList())
        .whereType<File>()
        .where((File file) => file.uri.pathSegments.last
            .startsWith('${target.uri.pathSegments.last}$suffix'))
        .toList();
Future<Map<String, List<int>>> _files(Directory directory) async => {
      for (final File file
          in (await directory.list().toList()).whereType<File>())
        file.path: await file.readAsBytes(),
    };
