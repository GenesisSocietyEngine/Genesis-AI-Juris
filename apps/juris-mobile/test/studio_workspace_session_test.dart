import 'dart:async';
import 'dart:io';
import 'package:flutter_test/flutter_test.dart';
import 'package:juris_mobile/data/studio_draft_store.dart';
import 'package:juris_mobile/data/studio_workspace_session.dart';
import 'package:juris_mobile/models/studio_scenario_draft.dart';

void main() {
  late Directory root;
  late ApplicationSupportStudioDraftStore disk;
  late _ObservedConditionalStore observed;
  setUp(() async {
    root = await Directory.systemTemp.createTemp('studio-save-chain-');
    disk = ApplicationSupportStudioDraftStore(
      directoryProvider: () async => root,
    );
    observed = _ObservedConditionalStore(disk);
    await disk.write(_workspace('original'));
  });
  tearDown(() => root.delete(recursive: true));

  test(
    'queued saves freeze inputs and chain only their own successful tokens',
    () async {
      final StudioWorkspaceSession session = await StudioWorkspaceSession.open(
        observed,
      );
      final Completer<void> release = Completer<void>();
      observed.beforeWrite = (_) => release.future;
      final Set<StudioWorkflowStage> stages = {StudioWorkflowStage.describe};
      final Future<void> first = session.save(_workspace('first', stages));
      final Future<void> second = session.save(_workspace('second'));
      stages.clear();
      release.complete();
      await Future.wait([first, second]);
      await session.settle();
      expect(observed.reads, 1);
      expect(observed.writes, 2);
      expect(observed.saved[0].completedStages, {StudioWorkflowStage.describe});
      expect((await disk.read())!.draft.title, 'second');
      expect(session.snapshot!.workspace!.draft.title, 'second');
      expect(session.loaded!.draft.title, 'original');
    },
  );

  test(
    'middle conflict blocks all queued and later edits without fresh reads',
    () async {
      final StudioWorkspaceSession session = await StudioWorkspaceSession.open(
        observed,
      );
      final Completer<void> entered = Completer<void>(),
          release = Completer<void>();
      observed.beforeWrite = (index) async {
        if (index == 2) {
          entered.complete();
          await release.future;
        }
      };
      await session.save(_workspace('own first'));
      final Future<void> conflicting = session.save(_workspace('stale second'));
      final Future<void> queued = session.save(_workspace('stale third'));
      final Future<void> conflictCheck = expectLater(
        conflicting,
        throwsA(_conflict),
      );
      final Future<void> queuedCheck = expectLater(queued, throwsA(_conflict));
      await entered.future;
      await disk.write(_workspace('other editor'));
      release.complete();
      await Future.wait([conflictCheck, queuedCheck]);
      await expectLater(
        session.save(_workspace('still stale')),
        throwsA(_conflict),
      );
      await expectLater(session.settle(), throwsA(_conflict));
      expect(observed.reads, 1);
      expect(observed.writes, 2);
      expect(session.isBlocked, isTrue);
      expect(session.snapshot!.workspace!.draft.title, 'own first');
      expect((await disk.read())!.draft.title, 'other editor');
      final StudioWorkspaceSession reopened = await StudioWorkspaceSession.open(
        observed,
      );
      await reopened.save(_workspace('explicit reopen authorizes new edit'));
      expect(observed.reads, 2);
      expect(
        (await disk.read())!.draft.title,
        'explicit reopen authorizes new edit',
      );
    },
  );

  test(
    'transient failure skips already queued work; new retry retains its token',
    () async {
      final StudioWorkspaceSession session = await StudioWorkspaceSession.open(
        observed,
      );
      observed.beforeWrite = (_) async {
        throw const StudioStorageException(
          code: 'workspace_write_failed',
          message: 'Unavailable',
        );
      };
      final Future<void> first = session.save(_workspace('failed'));
      final Future<void> queued = session.save(_workspace('must skip'));
      await Future.wait([
        expectLater(first, throwsA(isA<StudioStorageException>())),
        expectLater(queued, throwsA(isA<StudioStorageException>())),
      ]);
      expect(observed.writes, 1);
      expect(session.isBlocked, isFalse);
      expect(session.snapshot!.workspace!.draft.title, 'original');
      observed.beforeWrite = null;
      await session.save(_workspace('retry'));
      expect(observed.reads, 1);
      expect(observed.writes, 2);
      expect((await disk.read())!.draft.title, 'retry');
    },
  );

  test(
    'an unacknowledged commit conflicts on retry instead of fetching permission',
    () async {
      final StudioWorkspaceSession session = await StudioWorkspaceSession.open(
        observed,
      );
      observed.failAfterCommit = true;
      await expectLater(
        session.save(_workspace('committed but unacknowledged')),
        throwsA(isA<StudioStorageException>()),
      );
      observed.failAfterCommit = false;
      await expectLater(
        session.save(_workspace('retry must not overwrite')),
        throwsA(_conflict),
      );
      expect(observed.reads, 1);
      expect(session.isBlocked, isTrue);
      expect((await disk.read())!.draft.title, 'committed but unacknowledged');
    },
  );
}

final Matcher _conflict = isA<StudioStorageException>().having(
  (error) => error.code,
  'code',
  'workspace_conflict',
);
StudioWorkspace _workspace(String title, [Set<StudioWorkflowStage>? stages]) =>
    StudioWorkspace(
      draft: StudioScenarioDraft.guidedExample().updateIdentity(
        title: title,
        jurisdiction: 'BE',
        role: 'Counsel',
        premise: 'Source',
      ),
      activeStage: StudioWorkflowStage.describe,
      completedStages: stages ?? {},
    );

final class _ObservedConditionalStore implements ConditionalStudioDraftStore {
  _ObservedConditionalStore(this.disk);
  final ApplicationSupportStudioDraftStore disk;
  int reads = 0, writes = 0;
  bool failAfterCommit = false;
  Future<void> Function(int)? beforeWrite;
  final List<StudioWorkspace> saved = [];
  @override
  Future<StudioWorkspaceSnapshot> readSnapshot() {
    reads++;
    return disk.readSnapshot();
  }

  @override
  Future<StudioWorkspaceSnapshot> writeIfUnchanged(
    StudioWorkspaceSnapshot expected,
    StudioWorkspace next,
  ) async {
    writes++;
    await beforeWrite?.call(writes);
    final StudioWorkspaceSnapshot committed = await disk.writeIfUnchanged(
      expected,
      next,
    );
    saved.add(next);
    if (failAfterCommit)
      throw const StudioStorageException(
        code: 'workspace_write_failed',
        message: 'Acknowledgement failed',
      );
    return committed;
  }

  @override
  Future<StudioWorkspace?> read() =>
      throw StateError('Conditional callers must load a token');
  @override
  Future<void> write(StudioWorkspace value) =>
      throw StateError('Conditional callers must not replace');
  @override
  Future<String> exportScenario(StudioScenarioDraft draft) =>
      disk.exportScenario(draft);
}
