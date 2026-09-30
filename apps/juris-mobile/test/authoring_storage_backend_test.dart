import 'dart:convert';
import 'dart:io';
import 'package:crypto/crypto.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:juris_mobile/data/authoring_storage_backend.dart';
import 'package:juris_mobile/data/studio_draft_store.dart';
import 'package:juris_mobile/data/tax_artifact_store.dart';
import 'package:juris_mobile/models/studio_scenario_draft.dart';
import 'support/tax_artifact_fixture.dart';

void main() {
  late _Fixture f;
  setUp(() async {
    f = await _Fixture.create();
  });
  tearDown(() => f.root.delete(recursive: true));

  test('published import commits exact pair and returns sealed snapshot tokens',
      () async {
    final AuthoringImportCommit committed = await f.commit();
    expect(await f.w.readAsBytes(), utf8.encode(f.afterW));
    expect(await f.t.readAsBytes(), utf8.encode(f.afterT));
    final Directory completed = Directory(committed.completedPath);
    expect(await completed.exists(), isTrue);
    expect(await File('${completed.path}/original.json').readAsBytes(),
        utf8.encode(f.original));
    final StudioWorkspaceSnapshot workspace =
        StudioWorkspaceSnapshot.fromImportCommit(committed);
    final TaxArtifactSnapshot tax =
        TaxArtifactSnapshot.fromImportCommit(committed);
    expect(workspace.contentSha256,
        (await f.workspace.readSnapshot()).contentSha256);
    expect(tax.contentSha256,
        (await f.sidecar.readSnapshot(f.caseId)).contentSha256);
    expect(tax.artifact!['request']['context']['scenario_fingerprint'],
        'deliberately-stale-import-source');
    expect(tax.artifact!['legacy'], jsonDecode(f.original)['legacy']);
    expect(tax.artifact!['calculation'], isNull);
    expect(workspace.workspace!.activeStage, StudioWorkflowStage.describe);
    expect(workspace.workspace!.completedStages, isEmpty);
    await f.workspace.writeIfUnchanged(workspace, f.beforeWorkspace);
    await f.sidecar.writeIfUnchanged(tax, f.oldTax);
    expect(
        (await f.workspace.read())!.draft.title, f.beforeWorkspace.draft.title);
    expect((await f.sidecar.read(f.caseId))!['artifact_revision'], '1');
    expect(
        await completed.exists(), isTrue); // Completed intent must not replay.
  });

  for (final String changed in ['workspace', 'tax']) {
    test('stale $changed token refuses before any staging or pair mutation',
        () async {
      if (changed == 'workspace')
        await f.w.writeAsString('${await f.w.readAsString()}\n');
      else
        await f.t.writeAsString('${await f.t.readAsString()}\n');
      final Map<String, List<int>> before = await _files(f.root);
      await expectLater(f.commit(), throwsA(isA<AuthoringRecoveryException>()));
      expect(await _files(f.root), before);
      expect(await Directory('${f.root.path}/authoring_import_v1').exists(),
          isFalse);
    });
  }

  test('BOM originals and committed snapshot tokens retain exact UTF-8 bytes',
      () async {
    final String original = '\ufeff${f.original}';
    final AuthoringImportCommit committed = await f.commit(
        workspaceAfter: '\ufeff${f.afterW}',
        taxAfter: '\ufeff${f.afterT}',
        originalJson: original);
    final StudioWorkspaceSnapshot workspace =
        StudioWorkspaceSnapshot.fromImportCommit(committed);
    final TaxArtifactSnapshot tax =
        TaxArtifactSnapshot.fromImportCommit(committed);
    expect(workspace.contentSha256,
        (await f.workspace.readSnapshot()).contentSha256);
    expect(tax.contentSha256,
        (await f.sidecar.readSnapshot(f.caseId)).contentSha256);
    expect(workspace.originalJson, '\ufeff${f.afterW}');
    expect(tax.originalJson, '\ufeff${f.afterT}');
    expect(tax.artifact!['artifact_revision'], '2');
    expect(await File('${committed.completedPath}/original.json').readAsBytes(),
        utf8.encode(original));
    expect(await File(await f.sidecar.exportOriginal(tax)).readAsBytes(),
        utf8.encode('\ufeff${f.afterT}'));
    await f.workspace.writeIfUnchanged(workspace, f.beforeWorkspace);
    await f.sidecar.writeIfUnchanged(tax, f.oldTax);
  });

  for (final String state in [
    'both-before',
    'tax-after',
    'workspace-after',
    'both-after',
    'tax-retired',
    'workspace-retired',
    'partial-promotion'
  ]) {
    for (final String first in ['workspace', 'tax']) {
      test('$state recovery through $first first is exact and idempotent',
          () async {
        final Directory pending = await f.pending();
        if (state == 'tax-after' ||
            state == 'both-after' ||
            state == 'workspace-retired') await f.t.writeAsString(f.afterT);
        if (state == 'workspace-after' || state == 'both-after')
          await f.w.writeAsString(f.afterW);
        if (state == 'tax-retired')
          await f.t.rename('${pending.path}/retired-tax');
        if (state == 'workspace-retired')
          await f.w.rename('${pending.path}/retired-workspace');
        if (state == 'partial-promotion')
          await File('${pending.path}/promotion-tax')
              .writeAsString('{ interrupted copy');
        if (first == 'workspace')
          await f.workspace.read();
        else
          await f.sidecar.read(f.caseId);
        expect(await f.w.readAsBytes(), utf8.encode(f.afterW));
        expect(await f.t.readAsBytes(), utf8.encode(f.afterT));
        final Directory completed =
            Directory('${pending.parent.path}/completed-${_Fixture.id}');
        expect(await File('${completed.path}/original.json').readAsBytes(),
            utf8.encode(f.original));
        if (state == 'partial-promotion') {
          final List<File> partial = (await completed.list().toList())
              .whereType<File>()
              .where((file) => file.path.contains('promotion-tax.partial-'))
              .toList();
          expect(partial, hasLength(1));
          expect(await partial.single.readAsString(), '{ interrupted copy');
        }
        final Map<String, List<int>> after = await _files(f.root);
        await Future.wait([f.workspace.read(), f.sidecar.read(f.caseId)]);
        expect(await _files(f.root), after);
        await expectLater(
            f.workspace.writeIfUnchanged(f.wToken, f.beforeWorkspace),
            throwsA(isA<StudioStorageException>()));
        await expectLater(f.sidecar.writeIfUnchanged(f.tToken, f.oldTax),
            throwsA(isA<TaxStorageException>()));
        expect(await _files(f.root), after);
      });
    }
  }

  for (final String conflict in [
    'future-manifest',
    'missing-manifest',
    'missing-payload',
    'changed-payload',
    'future-target',
    'new-target',
    'future-auxiliary',
    'missing-no-retired',
    'wrong-retired',
    'extra-file',
    'nonregular-promotion',
    'multiple-pending'
  ]) {
    test('$conflict blocks both stores without changing any retained bytes',
        () async {
      final Directory pending = await f.pending();
      final File manifestFile = File('${pending.path}/manifest.json');
      switch (conflict) {
        case 'future-manifest':
          final Map value = jsonDecode(await manifestFile.readAsString());
          value['schema'] = 'authoring-import-intent-v99';
          await manifestFile.writeAsString(jsonEncode(value));
        case 'missing-manifest':
          await manifestFile.rename('${f.root.path}/retained-manifest');
        case 'missing-payload':
          await File('${pending.path}/tax_after.json')
              .rename('${f.root.path}/retained-payload');
        case 'changed-payload':
          await File('${pending.path}/tax_after.json')
              .writeAsString(f.afterT + ' ');
        case 'future-target':
          await f.t.writeAsString(jsonEncode(
              {...f.oldTax, 'schema': 'tax-authoring-artifact-v99'}));
        case 'new-target':
          await f.w.writeAsString('${f.afterW}\n');
        case 'future-auxiliary':
          await File('${f.t.path}.tmp').writeAsString(jsonEncode(
              {...f.oldTax, 'schema': 'tax-authoring-artifact-v99'}));
        case 'missing-no-retired':
          await f.t.rename('${f.root.path}/retained-external-target');
        case 'wrong-retired':
          await f.t.rename('${pending.path}/retired-tax');
          await File('${pending.path}/retired-tax').writeAsString(f.afterT);
        case 'extra-file':
          await File('${pending.path}/future-extension.json')
              .writeAsString('{}');
        case 'nonregular-promotion':
          await Directory('${pending.path}/promotion-tax').create();
        case 'multiple-pending':
          await Directory('${pending.parent.path}/pending-${'2' * 32}')
              .create();
      }
      final Map<String, List<int>> before = await _files(f.root);
      await expectLater(
          f.workspace.read(), throwsA(isA<StudioStorageException>()));
      await expectLater(
          f.sidecar.read(f.caseId), throwsA(isA<TaxStorageException>()));
      await expectLater(f.workspace.write(f.beforeWorkspace),
          throwsA(isA<StudioStorageException>()));
      await expectLater(f.sidecar.write(f.caseId, f.oldTax),
          throwsA(isA<TaxStorageException>()));
      expect(await _files(f.root), before);
      // Held edits/originals remain exportable even when authoritative I/O is blocked.
      expect(await File(await f.sidecar.exportOriginal(f.tToken)).readAsBytes(),
          utf8.encode(f.tToken.originalJson!));
      expect(
          await File(await f.workspace.exportScenario(f.beforeWorkspace.draft))
              .exists(),
          isTrue);
      for (final MapEntry<String, List<int>> entry in before.entries) {
        expect((await _files(f.root))[entry.key], entry.value);
      }
    });
  }

  test('inert incomplete staging does not replace old pair or disappear',
      () async {
    final Directory pending = await f.pending();
    final Directory staging =
        await pending.rename('${pending.parent.path}/staging-${_Fixture.id}');
    await File('${staging.path}/manifest.json').writeAsString('{ partial');
    final Map<String, List<int>> before = await _files(f.root);
    expect(
        (await f.workspace.read())!.draft.title, f.beforeWorkspace.draft.title);
    expect((await f.sidecar.read(f.caseId))!['artifact_revision'], '1');
    expect(await _files(f.root), before);
  });

  test('initially absent targets recover without inventing before payloads',
      () async {
    await f.w.delete();
    await f.t.delete();
    f.wToken = await f.workspace.readSnapshot();
    f.tToken = await f.sidecar.readSnapshot(f.caseId);
    final Map<String, dynamic> after = jsonDecode(f.afterT);
    after['artifact_revision'] = '1';
    after['request']['context']['revision'] = '1';
    f.afterT = jsonEncode(after);
    await f.pending();
    await f.sidecar.read(f.caseId);
    expect(await f.w.readAsString(), f.afterW);
    expect(await f.t.readAsString(), f.afterT);
  });

  for (final String role in ['workspace', 'tax', 'original']) {
    test('literal surrogate in $role rejects before UTF-8 freezing or staging',
        () async {
      final String literal = String.fromCharCode(0xd800);
      String submitted(String source, String field) => source.replaceAll(
          'Imported source',
          'Imported ${role == field ? literal : '\ufffd'} source');
      final String submittedW = submitted(f.afterW, 'workspace');
      final String submittedT = submitted(f.afterT, 'tax');
      final String submittedOriginal = submitted(f.original, 'original');
      final List<List<int>> codeUnits = [
        submittedW.codeUnits.toList(),
        submittedT.codeUnits.toList(),
        submittedOriginal.codeUnits.toList()
      ];
      final Map<String, List<int>> before = await _files(f.root);
      bool providerCalled = false;
      await expectLater(
          Future.sync(() => AuthoringStorageBackend.importPair(() async {
                providerCalled = true;
                return f.root;
              },
                  caseId: f.caseId,
                  expectedWorkspaceTarget: f.wToken.storageTarget,
                  expectedWorkspaceSha256: f.wToken.contentSha256,
                  expectedTaxTarget: f.tToken.storageTarget,
                  expectedTaxSha256: f.tToken.contentSha256,
                  workspaceAfter: submittedW,
                  taxAfter: submittedT,
                  originalJson: submittedOriginal)),
          throwsA(isA<FormatException>().having((error) => error.message,
              'message', contains('exact valid UTF-8'))));
      expect(providerCalled, isFalse);
      expect([
        submittedW.codeUnits,
        submittedT.codeUnits,
        submittedOriginal.codeUnits
      ], codeUnits);
      expect(await _files(f.root), before);
      expect(await Directory('${f.root.path}/authoring_import_v1').exists(),
          isFalse);
    });
  }

  test('literal surrogate case ID rejects before provider or path derivation',
      () async {
    final String caseId = '${f.caseId}${String.fromCharCode(0xd800)}';
    final Map<String, List<int>> before = await _files(f.root);
    bool providerCalled = false;
    expect(
        () => AuthoringStorageBackend.importPair(() async {
              providerCalled = true;
              return f.root;
            },
                caseId: caseId,
                expectedWorkspaceTarget: f.wToken.storageTarget,
                expectedWorkspaceSha256: f.wToken.contentSha256,
                expectedTaxTarget: f.tToken.storageTarget,
                expectedTaxSha256: f.tToken.contentSha256,
                workspaceAfter: f.afterW,
                taxAfter: f.afterT,
                originalJson: f.original),
        throwsA(isA<FormatException>()
            .having((error) => error.message, 'message', contains('case ID'))));
    expect(providerCalled, isFalse);
    expect(await _files(f.root), before);
    expect(await Directory('${f.root.path}/authoring_import_v1').exists(),
        isFalse);
  });

  test('valid leading U+FEFF case ID retains exact identity and hashed path',
      () async {
    final _Fixture prefixed = await _Fixture.create(casePrefix: '\ufeff');
    try {
      final AuthoringImportCommit committed = await prefixed.commit();
      expect(committed.caseId, prefixed.caseId);
      final TaxArtifactSnapshot snapshot =
          TaxArtifactSnapshot.fromImportCommit(committed);
      expect(snapshot.storageTarget, prefixed.tToken.storageTarget);
      expect(snapshot.artifact!['case_id'], prefixed.caseId);
      expect(snapshot.contentSha256,
          (await prefixed.sidecar.readSnapshot(prefixed.caseId)).contentSha256);
      expect(prefixed.t.path,
          contains(sha256.convert(utf8.encode(prefixed.caseId)).toString()));
    } finally {
      await prefixed.root.delete(recursive: true);
    }
  });

  for (final String invalid in [
    'oversized-promotion',
    'oversized-retired',
    'nonregular-promotion',
    'coexisting-retired',
    'completed-collision',
    'no-file-headroom'
  ]) {
    test('$invalid in later workspace domain refuses before tax promotion',
        () async {
      final Directory pending = await f.pending();
      switch (invalid) {
        case 'oversized-promotion':
          await File('${pending.path}/promotion-workspace')
              .writeAsBytes(List.filled(4 * 1024 * 1024 + 1, 0x20));
        case 'oversized-retired':
          await File('${pending.path}/retired-workspace')
              .writeAsBytes(List.filled(4 * 1024 * 1024 + 1, 0x20));
        case 'nonregular-promotion':
          await Directory('${pending.path}/promotion-workspace').create();
        case 'coexisting-retired':
          await f.w.copy('${pending.path}/retired-workspace');
        case 'completed-collision':
          await Directory('${pending.parent.path}/completed-${_Fixture.id}')
              .create();
        case 'no-file-headroom':
          for (int i = 0; i < 25; i++) {
            await File('${pending.path}/promotion-workspace.partial-$i')
                .writeAsString('retained partial $i');
          }
      }
      final Map<String, List<int>> before = await _files(f.root);
      await expectLater(
          f.sidecar.read(f.caseId), throwsA(isA<TaxStorageException>()));
      expect(await _files(f.root), before);
      await expectLater(
          f.workspace.read(), throwsA(isA<StudioStorageException>()));
      expect(await _files(f.root), before);
      expect(await pending.exists(), isTrue);
      if (invalid == 'nonregular-promotion') {
        expect(await Directory('${pending.path}/promotion-workspace').exists(),
            isTrue);
      }
    });
  }
}

final class _Fixture {
  _Fixture(
      this.root,
      this.workspace,
      this.sidecar,
      this.beforeWorkspace,
      this.oldTax,
      this.original,
      this.afterW,
      this.afterT,
      this.wToken,
      this.tToken);
  static const String id = '11111111111111111111111111111111';
  final Directory root;
  final ApplicationSupportStudioDraftStore workspace;
  final TaxArtifactStore sidecar;
  final StudioWorkspace beforeWorkspace;
  final Map<String, dynamic> oldTax;
  final String original, afterW;
  String afterT;
  StudioWorkspaceSnapshot wToken;
  TaxArtifactSnapshot tToken;
  String get caseId => beforeWorkspace.draft.caseId;
  File get w => File(wToken.storageTarget);
  File get t => File(tToken.storageTarget);

  static Future<_Fixture> create({String casePrefix = ''}) async {
    final Directory root =
        await Directory.systemTemp.createTemp('authoring-journal-');
    final ApplicationSupportStudioDraftStore workspace =
        ApplicationSupportStudioDraftStore(directoryProvider: () async => root);
    final TaxArtifactStore sidecar =
        TaxArtifactStore(directoryProvider: () async => root);
    final Map<String, dynamic> source =
        StudioScenarioDraft.guidedExample().toJson();
    source['metadata']['id'] = '$casePrefix${source['metadata']['id']}';
    final StudioScenarioDraft before = StudioScenarioDraft.fromJson(source);
    final StudioWorkspace oldWorkspace = StudioWorkspace(
        draft: before,
        activeStage: StudioWorkflowStage.caseMap,
        completedStages: {StudioWorkflowStage.describe});
    final Map<String, dynamic> oldTax = taxArtifactFixture('old draft')
      ..['case_id'] = before.caseId
      ..['scenario'] = before.toJson();
    oldTax['request']['context']['case_id'] = before.caseId;
    await workspace.write(oldWorkspace);
    await sidecar.write(before.caseId, oldTax);
    final StudioScenarioDraft imported = before.updateIdentity(
        title: 'Imported source',
        jurisdiction: 'BE',
        role: 'Counsel',
        premise: 'Preserved import');
    final Map<String, dynamic> original = jsonDecode(jsonEncode(oldTax));
    original['scenario'] = imported.toJson();
    original['request']['context']['scenario_fingerprint'] =
        'deliberately-stale-import-source';
    original['artifact_revision'] = '500';
    original['request']['context']['revision'] = '500';
    original['calculation'] = {'untrusted': true};
    final String raw = '  ${jsonEncode(original)}\r\n';
    final Map<String, dynamic> after = jsonDecode(raw);
    after['artifact_revision'] = '2';
    after['request']['context']['revision'] = '2';
    after['calculation'] = null;
    final String afterW = jsonEncode({
      'schema_version': 1,
      'active_stage': 'describe',
      'completed_stages': [],
      'scenario': imported.toJson()
    });
    return _Fixture(
        root,
        workspace,
        sidecar,
        oldWorkspace,
        oldTax,
        raw,
        afterW,
        jsonEncode(after),
        await workspace.readSnapshot(),
        await sidecar.readSnapshot(before.caseId));
  }

  Future<AuthoringImportCommit> commit(
          {String? workspaceAfter, String? taxAfter, String? originalJson}) =>
      AuthoringStorageBackend.importPair(() async => root,
          caseId: caseId,
          expectedWorkspaceTarget: wToken.storageTarget,
          expectedWorkspaceSha256: wToken.contentSha256,
          expectedTaxTarget: tToken.storageTarget,
          expectedTaxSha256: tToken.contentSha256,
          workspaceAfter: workspaceAfter ?? afterW,
          taxAfter: taxAfter ?? afterT,
          originalJson: originalJson ?? original);

  Future<Directory> pending() async {
    final Directory pending =
        await Directory('${root.path}/authoring_import_v1/pending-$id')
            .create(recursive: true);
    final Map<String, List<int>?> payloads = {
      'original': utf8.encode(original),
      'workspace_after': utf8.encode(afterW),
      'tax_after': utf8.encode(afterT),
      'workspace_before': await w.exists() ? await w.readAsBytes() : null,
      'tax_before': await t.exists() ? await t.readAsBytes() : null
    };
    Map<String, Object>? descriptor(List<int>? bytes) => bytes == null
        ? null
        : {'bytes': bytes.length, 'sha256': sha256.convert(bytes).toString()};
    for (final entry in payloads.entries) {
      if (entry.value != null)
        await File('${pending.path}/${entry.key}.json')
            .writeAsBytes(entry.value!);
    }
    final Map<String, dynamic> aux = {};
    for (final String role in ['workspace', 'tax']) {
      for (final String suffix in ['bak', 'tmp']) {
        final File file =
            File('${role == 'workspace' ? w.path : t.path}.$suffix');
        aux['${role}_$suffix'] =
            descriptor(await file.exists() ? await file.readAsBytes() : null);
      }
    }
    await File('${pending.path}/manifest.json').writeAsString(jsonEncode({
      'schema': 'authoring-import-intent-v1',
      'transaction_id': id,
      'case_id': caseId,
      'payloads': {
        for (final entry in payloads.entries) entry.key: descriptor(entry.value)
      },
      'auxiliary': aux
    }));
    return pending;
  }
}

Future<Map<String, List<int>>> _files(Directory root) async => {
      for (final File file
          in (await root.list(recursive: true, followLinks: false).toList())
              .whereType<File>())
        file.path: await file.readAsBytes(),
    };
