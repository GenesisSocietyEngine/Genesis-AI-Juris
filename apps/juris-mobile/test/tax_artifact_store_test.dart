import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:crypto/crypto.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:juris_mobile/data/authoring_storage_coordinator.dart';
import 'package:juris_mobile/data/studio_draft_store.dart';
import 'package:juris_mobile/data/tax_artifact_store.dart';
import 'package:juris_mobile/models/studio_scenario_draft.dart';

import 'support/tax_artifact_fixture.dart';

void main() {
  late Directory root;
  late File target;
  late TaxArtifactStore store;
  setUp(() async {
    root = await Directory.systemTemp.createTemp('tax-preservation-');
    await Directory('${root.path}/tax_authoring_v1').create();
    target = File('${root.path}/tax_authoring_v1/'
        '${sha256.convert(utf8.encode('case1'))}.json');
    store = TaxArtifactStore(directoryProvider: () async => root);
  });
  tearDown(() => root.delete(recursive: true));

  test('snapshots retain incomplete and unknown content as detached copies',
      () async {
    final TaxArtifactSnapshot absent = await store.readSnapshot('case1');
    expect(absent.artifact, isNull);
    expect(absent.contentSha256, isNull);
    final Map<String, dynamic> original = taxArtifactFixture();
    final TaxArtifactSnapshot saved =
        await store.writeIfUnchanged(absent, original);
    expect(saved.artifact, original);
    expect(saved.contentSha256,
        sha256.convert(await target.readAsBytes()).toString());
    saved.artifact!['edit']['baseline_annual_tax_cost'] =
        'mutated returned copy';
    expect(saved.artifact, original);
    final TaxArtifactSnapshot next =
        await store.writeIfUnchanged(saved, taxArtifactFixture('2'));
    expect(next.contentSha256, isNot(saved.contentSha256));
    expect(
        await File('${target.path}.bak').readAsString(), jsonEncode(original));
    expect(await store.read('case1'), taxArtifactFixture('2'));
  });

  test('queued writes validate frozen bytes, not later caller mutation',
      () async {
    final Completer<Directory> release = Completer<Directory>();
    final Completer<void> entered = Completer<void>();
    final TaxArtifactStore delayed = TaxArtifactStore(directoryProvider: () {
      entered.complete();
      return release.future;
    });
    final Map<String, dynamic> value = taxArtifactFixture('frozen');
    final String frozen = jsonEncode(value);
    final Future<void> writing = delayed.write('case1', value);
    value['schema'] = 'tax-authoring-artifact-v99';
    value['edit']['baseline_annual_tax_cost'] = 'changed after call';
    await entered.future;
    release.complete(root);
    await writing;
    expect(await target.readAsString(), frozen);
  });

  test('invalid frozen envelope rejects before resolving a provider', () async {
    bool invoked = false;
    final TaxArtifactStore delayed =
        TaxArtifactStore(directoryProvider: () async {
      invoked = true;
      return root;
    });
    final Map<String, dynamic> value = taxArtifactFixture()
      ..['schema'] = 'tax-authoring-artifact-v99';
    final Future<void> writing = delayed.write('case1', value);
    value['schema'] = 'tax-authoring-artifact-v1';
    await expectLater(writing, throwsA(_code('tax_invalid_artifact')));
    expect(invoked, isFalse);
    expect(await target.exists(), isFalse);
  });

  for (final String state in [
    'missing',
    'corrupt',
    'malformed UTF8',
    'wrong case'
  ]) {
    test('$state primary recovers exact supported backup without moving it',
        () async {
      final List<int>? original = switch (state) {
        'missing' => null,
        'corrupt' => utf8.encode('{ partial'),
        'malformed UTF8' => [0xff, 0xfe, 0x00],
        _ =>
          utf8.encode(jsonEncode(taxArtifactFixture()..['case_id'] = 'other')),
      };
      if (original != null) await target.writeAsBytes(original);
      final String backup = const JsonEncoder.withIndent('   ')
          .convert(taxArtifactFixture('backup'));
      await File('${target.path}.bak').writeAsString(backup);
      final TaxArtifactSnapshot recovered = await store.readSnapshot('case1');
      expect(recovered.artifact, taxArtifactFixture('backup'));
      expect(recovered.readOnlyReason, isNull);
      expect(await target.readAsString(), backup);
      expect(await File('${target.path}.bak').readAsString(), backup);
      final List<File> preserved = await _matching(target, '.corrupt-');
      expect(preserved.length, original == null ? 0 : 1);
      if (original != null)
        expect(await preserved.single.readAsBytes(), original);
      expect((await store.readSnapshot('case1')).contentSha256,
          recovered.contentSha256);
    });
  }

  for (final String shape in [
    'future schema',
    'future protocol',
    'opaque known shape'
  ]) {
    test('$shape primary stays authoritative and read-only', () async {
      final Map<String, dynamic> value = taxArtifactFixture('retained');
      switch (shape) {
        case 'future schema':
          value['schema'] = 'tax-authoring-artifact-v99';
        case 'future protocol':
          value['request']['transport_protocol'] = 'tax-v99';
        default:
          value['edit'] = {'unknown_editor': 'not editable'};
      }
      final String bytes = ' \n${jsonEncode(value)}\n';
      await target.writeAsString(bytes);
      await File('${target.path}.bak')
          .writeAsString(jsonEncode(taxArtifactFixture('older')));
      final Map<String, List<int>> before = await _files(target.parent);
      final TaxArtifactSnapshot snapshot = await store.readSnapshot('case1');
      expect(snapshot.artifact, value);
      expect(snapshot.readOnlyError!.code, 'tax_unsupported');
      await expectLater(store.write('case1', taxArtifactFixture()),
          throwsA(_code('tax_unsupported')));
      await expectLater(store.writeIfUnchanged(snapshot, taxArtifactFixture()),
          throwsA(_code('tax_unsupported')));
      expect(await _files(target.parent), before);
    });
  }

  for (final String suffix in ['.bak', '.tmp']) {
    for (final String shape in ['future', 'opaque', 'wrong case']) {
      test('$shape $suffix blocks writes beside a supported primary', () async {
        final Map<String, dynamic> auxiliary = taxArtifactFixture('auxiliary');
        switch (shape) {
          case 'future':
            auxiliary['schema'] = 'tax-authoring-artifact-v99';
          case 'opaque':
            auxiliary['request']['input_schema'] = 'input-v99';
          default:
            auxiliary['case_id'] = 'other';
        }
        await target.writeAsString(jsonEncode(taxArtifactFixture('current')));
        await File('${target.path}$suffix')
            .writeAsString(jsonEncode(auxiliary));
        final Map<String, List<int>> before = await _files(target.parent);
        final TaxArtifactSnapshot snapshot = await store.readSnapshot('case1');
        expect(snapshot.artifact, taxArtifactFixture('current'));
        expect(snapshot.readOnlyReason, isNotNull);
        await expectLater(
            store.writeIfUnchanged(snapshot, taxArtifactFixture('new')),
            throwsA(isA<TaxStorageException>()));
        await expectLater(store.write('case1', taxArtifactFixture('new')),
            throwsA(isA<TaxStorageException>()));
        expect(await _files(target.parent), before);
      });
    }
  }

  final Map<String, Map<String, String>> unresolved = {
    'malformed backup only': {'.bak': '{ partial'},
    'future backup only': {
      '.bak': jsonEncode(
          taxArtifactFixture()..['schema'] = 'tax-authoring-artifact-v99')
    },
    'supported temp only': {
      '.tmp': jsonEncode(taxArtifactFixture('uncommitted'))
    },
    'malformed temp only': {'.tmp': 'unfinished'},
    'future temp only': {
      '.tmp': jsonEncode(
          taxArtifactFixture()..['schema'] = 'tax-authoring-artifact-v99')
    },
    'corrupt primary and backup': {'': 'corrupt', '.bak': 'also corrupt'},
    'supported backup with future temp': {
      '.bak': jsonEncode(taxArtifactFixture('backup')),
      '.tmp': jsonEncode(
          taxArtifactFixture()..['schema'] = 'tax-authoring-artifact-v99')
    },
  };
  for (final MapEntry<String, Map<String, String>> state
      in unresolved.entries) {
    test('${state.key} preserves every byte without creating an empty analysis',
        () async {
      for (final MapEntry<String, String> file in state.value.entries) {
        await File('${target.path}${file.key}').writeAsString(file.value);
      }
      final Map<String, List<int>> before = await _files(target.parent);
      await expectLater(
          store.readSnapshot('case1'), throwsA(isA<TaxStorageException>()));
      await expectLater(store.write('case1', taxArtifactFixture()),
          throwsA(isA<TaxStorageException>()));
      expect(await _files(target.parent), before);
    });
  }

  for (final List<int> orphan in [
    utf8.encode('{ unfinished'),
    [0xff, 0xfe],
    utf8.encode(jsonEncode(taxArtifactFixture('uncommitted')))
  ]) {
    test(
        'next write preserves orphan ${orphan.length} bytes and corrupt backup',
        () async {
      final String committed = jsonEncode(taxArtifactFixture('committed'));
      await target.writeAsString(committed);
      await File('${target.path}.tmp').writeAsBytes(orphan);
      await File('${target.path}.bak').writeAsString('broken backup');
      final TaxArtifactSnapshot before = await store.readSnapshot('case1');
      expect(before.artifact, taxArtifactFixture('committed'));
      expect(await File('${target.path}.tmp').readAsBytes(), orphan);
      await store.writeIfUnchanged(before, taxArtifactFixture('next'));
      expect(
          await (await _matching(target, '.tmp.interrupted-'))
              .single
              .readAsBytes(),
          orphan);
      expect(
          await (await _matching(target, '.bak.corrupt-'))
              .single
              .readAsString(),
          'broken backup');
      expect(await File('${target.path}.bak').readAsString(), committed);
    });
  }

  test('old-primary-moved boundary recovers backup and retains complete temp',
      () async {
    final String committed = jsonEncode(taxArtifactFixture('committed'));
    final String interrupted = jsonEncode(taxArtifactFixture('not committed'));
    await File('${target.path}.bak').writeAsString(committed);
    await File('${target.path}.tmp').writeAsString(interrupted);
    final TaxArtifactSnapshot recovered = await store.readSnapshot('case1');
    expect(recovered.artifact, taxArtifactFixture('committed'));
    expect(await target.readAsString(), committed);
    expect(await File('${target.path}.bak').readAsString(), committed);
    expect(await File('${target.path}.tmp').readAsString(), interrupted);
    await store.writeIfUnchanged(recovered, taxArtifactFixture('next'));
    expect(
        await (await _matching(target, '.tmp.interrupted-'))
            .single
            .readAsString(),
        interrupted);
  });

  test('two editors cannot overwrite a different exact-byte generation',
      () async {
    await store.write('case1', taxArtifactFixture('A'));
    final TaxArtifactStore other =
        TaxArtifactStore(directoryProvider: () async => root);
    final TaxArtifactSnapshot left = await store.readSnapshot('case1');
    final TaxArtifactSnapshot right = await other.readSnapshot('case1');
    final TaxArtifactSnapshot committed =
        await store.writeIfUnchanged(left, taxArtifactFixture('B'));
    final Map<String, List<int>> before = await _files(target.parent);
    await expectLater(other.writeIfUnchanged(right, taxArtifactFixture('C')),
        throwsA(_code('tax_conflict')));
    expect(await _files(target.parent), before);
    await store.writeIfUnchanged(committed, taxArtifactFixture('B again'));
    expect(await other.read('case1'), taxArtifactFixture('B again'));
  });

  test('absence tokens conflict after creation; formatting is part of identity',
      () async {
    final TaxArtifactSnapshot absent = await store.readSnapshot('case1');
    await store.write('case1', taxArtifactFixture());
    await expectLater(
        store.writeIfUnchanged(absent, taxArtifactFixture('stale')),
        throwsA(_code('tax_conflict')));
    final TaxArtifactSnapshot snapshot = await store.readSnapshot('case1');
    await target.writeAsString(
        const JsonEncoder.withIndent(' ').convert(snapshot.artifact));
    await expectLater(
        store.writeIfUnchanged(snapshot, taxArtifactFixture('stale')),
        throwsA(_code('tax_conflict')));
  });

  test('tokens are tied to the resolved store root', () async {
    final TaxArtifactSnapshot original = await store.readSnapshot('case1');
    final Directory otherRoot =
        await Directory('${root.path}/other-root').create();
    final TaxArtifactStore other =
        TaxArtifactStore(directoryProvider: () async => otherRoot);
    await expectLater(other.writeIfUnchanged(original, taxArtifactFixture()),
        throwsA(_code('tax_conflict')));
    expect(await other.read('case1'), isNull);
  });

  test('delayed first provider cannot reorder recreated store writes or reads',
      () async {
    await store.write('case1', taxArtifactFixture('initial'));
    final Completer<Directory> release = Completer<Directory>();
    final TaxArtifactStore slow =
        TaxArtifactStore(directoryProvider: () => release.future);
    final Future<void> first = slow.write('case1', taxArtifactFixture('first'));
    final Future<Map<String, dynamic>?> middle = store.read('case1');
    final Future<void> last = store.write('case1', taxArtifactFixture('last'));
    release.complete(root);
    await first;
    expect(await middle, taxArtifactFixture('first'));
    await last;
    expect(await store.read('case1'), taxArtifactFixture('last'));
  });

  test('a read reserved before a write cannot observe the later write',
      () async {
    await store.write('case1', taxArtifactFixture('initial'));
    final Completer<Directory> release = Completer<Directory>();
    final TaxArtifactStore slow =
        TaxArtifactStore(directoryProvider: () => release.future);
    final Future<Map<String, dynamic>?> reading = slow.read('case1');
    final Future<void> writing =
        store.write('case1', taxArtifactFixture('later'));
    release.complete(root);
    expect(await reading, taxArtifactFixture('initial'));
    await writing;
  });

  test(
      'overlapping recreated stores share temporary files without interleaving',
      () async {
    final TaxArtifactStore alias = TaxArtifactStore(
        directoryProvider: () async => Directory('${root.path}/.'));
    await Future.wait(List.generate(
        20,
        (int index) => (index.isEven ? store : alias)
            .write('case1', taxArtifactFixture('$index'))));
    expect(await store.read('case1'), taxArtifactFixture('19'));
    expect(jsonDecode(await File('${target.path}.bak').readAsString()),
        taxArtifactFixture('18'));
    expect(await _matching(target, '.tmp.interrupted-'), isEmpty);
  });

  test('failed operations do not poison later queued recovery and writes',
      () async {
    await File('${target.path}.tmp').writeAsString('interrupted');
    await expectLater(store.write('case1', taxArtifactFixture()),
        throwsA(_code('tax_recovery_required')));
    await File('${target.path}.tmp')
        .rename('${target.path}.tmp.retained-by-test');
    await store.write('case1', taxArtifactFixture('retry'));
    expect(await store.read('case1'), taxArtifactFixture('retry'));
  });

  for (final String suffix in ['', '.tmp', '.bak']) {
    test('non-regular $suffix entry blocks I/O without removing it', () async {
      await Directory('${target.path}$suffix').create();
      await expectLater(store.read('case1'), throwsA(_code('tax_read_failed')));
      await expectLater(store.write('case1', taxArtifactFixture()),
          throwsA(_code('tax_write_failed')));
      expect(await Directory('${target.path}$suffix').exists(), isTrue);
    });
  }

  test(
      'export freezes content before waiting and never replaces a prior export',
      () async {
    final Completer<Directory> release = Completer<Directory>();
    final TaxArtifactStore delayed =
        TaxArtifactStore(directoryProvider: () => release.future);
    final Map<String, dynamic> value = taxArtifactFixture()
      ..['schema'] = 'future';
    final String frozen = const JsonEncoder.withIndent('  ').convert(value);
    final Future<String> exporting = delayed.export(value);
    value['schema'] = 'changed';
    release.complete(root);
    final String first = await exporting;
    final String second = await store.export(value);
    expect(second, isNot(first));
    expect(await File(first).readAsString(), frozen);
    expect(jsonDecode(await File(second).readAsString()), value);
  });

  test('workspace and sidecar share root lease while unrelated roots proceed',
      () async {
    final Completer<void> entered = Completer<void>();
    final Completer<void> release = Completer<void>();
    final Future<void> held =
        AuthoringStorageCoordinator.run(() async => root, (_) {
      entered.complete();
      return release.future;
    });
    await entered.future;
    bool workspaceDone = false, taxDone = false;
    final ApplicationSupportStudioDraftStore workspace =
        ApplicationSupportStudioDraftStore(
            directoryProvider: () async => Directory('${root.path}/.'));
    final Future<void> writingWorkspace = workspace
        .write(StudioWorkspace(
            draft: StudioScenarioDraft.guidedExample(),
            activeStage: StudioWorkflowStage.describe,
            completedStages: {}))
        .then((_) => workspaceDone = true);
    final Future<void> writingTax =
        store.write('case1', taxArtifactFixture()).then((_) => taxDone = true);
    final Directory other = await Directory('${root.path}/unrelated').create();
    await TaxArtifactStore(directoryProvider: () async => other)
        .write('case1', taxArtifactFixture('other'));
    expect(workspaceDone, isFalse);
    expect(taxDone, isFalse);
    release.complete();
    await Future.wait([held, writingWorkspace, writingTax]);
    expect(await workspace.read(), isNotNull);
    expect(await store.read('case1'), taxArtifactFixture());
  });
}

Matcher _code(String code) => isA<TaxStorageException>()
    .having((TaxStorageException error) => error.code, 'code', code);
Future<List<File>> _matching(File target, String suffix) async =>
    (await target.parent.list().toList())
        .whereType<File>()
        .where((file) => file.uri.pathSegments.last
            .startsWith('${target.uri.pathSegments.last}$suffix'))
        .toList();
Future<Map<String, List<int>>> _files(Directory directory) async => {
      for (final File file
          in (await directory.list().toList()).whereType<File>())
        file.path: await file.readAsBytes(),
    };
