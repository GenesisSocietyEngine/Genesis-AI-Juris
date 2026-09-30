import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:crypto/crypto.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:juris_mobile/data/studio_authoring_services.dart';
import 'package:juris_mobile/data/studio_draft_store.dart';
import 'package:juris_mobile/data/studio_workspace_session.dart';
import 'package:juris_mobile/data/tax_artifact_store.dart';
import 'package:juris_mobile/models/studio_scenario_draft.dart';
import 'support/tax_artifact_fixture.dart';

void main() {
  late Directory root;
  late StudioAuthoringServices services;
  late StudioScenarioDraft scenario;
  late StudioWorkspaceSnapshot workspace;
  late TaxArtifactSnapshot tax;
  late String original;
  setUp(() async {
    root = await Directory.systemTemp.createTemp('matched-authoring-');
    services = StudioAuthoringServices.applicationSupport(
        directoryProvider: () async => root);
    scenario = StudioScenarioDraft.guidedExample();
    await services.workspace.write(_workspace(scenario));
    final Map<String, dynamic> artifact = _artifact(scenario);
    await services.taxArtifacts.write(scenario.caseId, artifact);
    workspace = await services.workspace.readSnapshot();
    tax = await services.taxArtifacts.readSnapshot(scenario.caseId);
    artifact['scenario']['metadata']['title'] = 'Imported exact source';
    artifact['artifact_revision'] = '99';
    artifact['request']['context']['scenario_fingerprint'] = 'stale-import';
    artifact['calculation'] = {'untrusted': true};
    original = '\ufeff  ${jsonEncode(artifact)}\r\n';
  });
  tearDown(() => root.delete(recursive: true));

  Future<StudioAggregateImportResult> commit() => services.importTaxWorkspace(
      expectedWorkspace: workspace, expectedTax: tax, originalJson: original);

  test(
      'matched import retains whole original and stale context without native calls',
      () async {
    final StudioAggregateImportResult result = await commit();
    final Map<String, dynamic> saved = result.taxArtifact.artifact!;
    expect(saved['artifact_revision'], '2');
    expect(saved['request']['context']['revision'], '2');
    expect(saved['request']['context']['scenario_fingerprint'], 'stale-import');
    expect(saved['legacy'], _artifact(scenario)['legacy']);
    expect(saved['calculation'], isNull);
    expect(result.workspace.workspace!.draft.title, 'Imported exact source');
    expect(
        result.workspace.workspace!.activeStage, StudioWorkflowStage.describe);
    expect(result.workspace.workspace!.completedStages, isEmpty);
    expect(
        await File('${result.retainedPackagePath}/original.json').readAsBytes(),
        utf8.encode(original));
    expect(result.workspace.contentSha256,
        (await services.workspace.readSnapshot()).contentSha256);
    expect(
        result.taxArtifact.contentSha256,
        (await services.taxArtifacts.readSnapshot(scenario.caseId))
            .contentSha256);
  });

  for (final String changed in ['workspace', 'tax']) {
    test('$changed conflict preserves all files and does not stage', () async {
      final File file = File(
          changed == 'workspace' ? workspace.storageTarget : tax.storageTarget);
      await file.writeAsString('${await file.readAsString()}\n');
      final Map<String, String> before = await _hashes(root);
      await expectLater(
          commit(),
          throwsA(isA<StudioStorageException>()
              .having((e) => e.code, 'code', 'workspace_conflict')));
      expect(await _hashes(root), before);
      expect(await Directory('${root.path}/authoring_import_v1').exists(),
          isFalse);
    });
  }

  test('snapshots from another root refuse without changing either root',
      () async {
    final Directory otherRoot =
        await Directory.systemTemp.createTemp('other-authoring-');
    try {
      final StudioAuthoringServices other =
          StudioAuthoringServices.applicationSupport(
              directoryProvider: () async => otherRoot);
      workspace = await other.workspace.readSnapshot();
      final Map<String, String> before = await _hashes(root),
          otherBefore = await _hashes(otherRoot);
      await expectLater(commit(), throwsA(isA<StudioStorageException>()));
      expect(await _hashes(root), before);
      expect(await _hashes(otherRoot), otherBefore);
    } finally {
      await otherRoot.delete(recursive: true);
    }
  });

  for (final String previous in [
    '18446744073709551614',
    '18446744073709551615',
    '18446744073709551616'
  ]) {
    test('native revision boundary preserves or advances $previous safely',
        () async {
      final Map<String, dynamic> value = _artifact(scenario);
      value['artifact_revision'] = previous;
      value['request']['context']['revision'] = previous;
      await services.taxArtifacts.write(scenario.caseId, value);
      tax = await services.taxArtifacts.readSnapshot(scenario.caseId);
      final Map<String, String> before = await _hashes(root);
      final String retainedOriginal = original;
      if (previous == '18446744073709551614') {
        final StudioAggregateImportResult result = await commit();
        expect(result.taxArtifact.artifact!['artifact_revision'],
            '18446744073709551615');
        expect(result.taxArtifact.artifact!['request']['context']['revision'],
            '18446744073709551615');
      } else {
        await expectLater(commit(), throwsFormatException);
        expect(await _hashes(root), before);
        expect(await Directory('${root.path}/authoring_import_v1').exists(),
            isFalse);
      }
      expect(original, retainedOriginal);
    });
  }

  test(
      'future original and numerically lossy original leave current work untouched',
      () async {
    final Map<String, String> before = await _hashes(root);
    for (final String invalid in [
      original.replaceFirst(
          'tax-authoring-artifact-v1', 'tax-authoring-artifact-v99'),
      original.replaceFirst('"unknown_extension":[1,2]',
          '"unknown_extension":[18446744073709551617,2]'),
    ]) {
      await expectLater(
          services.importTaxWorkspace(
              expectedWorkspace: workspace,
              expectedTax: tax,
              originalJson: invalid),
          throwsFormatException);
      expect(await _hashes(root), before);
    }
  });

  test(
      'importing a different case keeps former sidecar exact and starts revision one',
      () async {
    final Map<String, dynamic> next = _artifact(scenario);
    next['case_id'] = 'another-case';
    next['scenario']['metadata']['id'] = 'another-case';
    next['request']['context']['case_id'] = 'another-case';
    final List<int> old = await File(tax.storageTarget).readAsBytes();
    final StudioAggregateImportResult result =
        await services.importTaxWorkspace(
            expectedWorkspace: workspace,
            expectedTax:
                await services.taxArtifacts.readSnapshot('another-case'),
            originalJson: jsonEncode(next));
    expect(result.taxArtifact.artifact!['artifact_revision'], '1');
    expect(result.workspace.workspace!.draft.caseId, 'another-case');
    expect(await File(tax.storageTarget).readAsBytes(), old);
  });

  test(
      'observed conditional wrapper chains own save then import without refreshing permission',
      () async {
    late _ObservedStore observer;
    services = StudioAuthoringServices.applicationSupport(
        directoryProvider: () async => root,
        observeWorkspace: (store) => observer = _ObservedStore(store));
    final StudioWorkspaceSession session =
        await StudioWorkspaceSession.open(services.workspace);
    final Completer<void> release = Completer<void>();
    observer.release = release.future;
    final Future<void> save = session.save(_workspace(scenario.updateIdentity(
        title: 'Own queued edit',
        jurisdiction: 'BE',
        role: 'Counsel',
        premise: 'Before import')));
    final Future<void> imported = session.importSnapshot((expected) async {
      expect(expected.workspace!.draft.title, 'Own queued edit');
      return (await services.importTaxWorkspace(
              expectedWorkspace: expected,
              expectedTax: tax,
              originalJson: original))
          .workspace;
    });
    release.complete();
    await Future.wait([save, imported]);
    expect(observer.reads, 1);
    expect(observer.writes, 1);
    expect(session.snapshot!.workspace!.draft.title, 'Imported exact source');
    await session.save(session.snapshot!.workspace!);
    expect(observer.reads, 1);
    expect(observer.writes, 2);
  });
}

StudioWorkspace _workspace(StudioScenarioDraft scenario) => StudioWorkspace(
    draft: scenario,
    activeStage: StudioWorkflowStage.caseMap,
    completedStages: {StudioWorkflowStage.describe});

Map<String, dynamic> _artifact(StudioScenarioDraft scenario) {
  final Map<String, dynamic> value = taxArtifactFixture('incomplete draft');
  value['case_id'] = scenario.caseId;
  value['scenario'] = scenario.toJson();
  value['request']['context']['case_id'] = scenario.caseId;
  return value;
}

Future<Map<String, String>> _hashes(Directory root) async => {
      for (final File file
          in (await root.list(recursive: true, followLinks: false).toList())
              .whereType<File>())
        file.path: sha256.convert(await file.readAsBytes()).toString(),
    };

final class _ObservedStore implements ConditionalStudioDraftStore {
  _ObservedStore(this.inner);
  final ConditionalStudioDraftStore inner;
  int reads = 0, writes = 0;
  Future<void>? release;
  @override
  Future<StudioWorkspaceSnapshot> readSnapshot() {
    reads++;
    return inner.readSnapshot();
  }

  @override
  Future<StudioWorkspaceSnapshot> writeIfUnchanged(
      StudioWorkspaceSnapshot expected, StudioWorkspace next) async {
    writes++;
    await release;
    return inner.writeIfUnchanged(expected, next);
  }

  @override
  Future<StudioWorkspace?> read() => inner.read();
  @override
  Future<void> write(StudioWorkspace value) => inner.write(value);
  @override
  Future<String> exportScenario(StudioScenarioDraft draft) =>
      inner.exportScenario(draft);
}
