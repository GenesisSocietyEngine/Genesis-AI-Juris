import '../models/studio_scenario_draft.dart';
import 'studio_draft_store.dart';

/// One editor's save chain. Only its own successful saves advance its token.
/// It never reloads a generation to authorize an existing in-memory edit.
final class StudioWorkspaceSession {
  StudioWorkspaceSession._(this._store, this._snapshot, StudioWorkspace? loaded)
      : _loaded = loaded == null ? null : _freeze(loaded);
  final StudioDraftStore _store;
  final StudioWorkspace? _loaded;
  StudioWorkspaceSnapshot? _snapshot;
  Future<void> _tail = Future<void>.value();
  int _failureEpoch = 0;
  Object? _lastError;
  bool _blocked = false;

  static Future<StudioWorkspaceSession> open(StudioDraftStore store) async {
    if (store is ConditionalStudioDraftStore) {
      final StudioWorkspaceSnapshot snapshot = await store.readSnapshot();
      return StudioWorkspaceSession._(store, snapshot, snapshot.workspace);
    }
    return StudioWorkspaceSession._(store, null, await store.read());
  }

  StudioWorkspace? get loaded => _loaded == null ? null : _freeze(_loaded);
  StudioWorkspaceSnapshot? get snapshot => _snapshot;
  bool get isBlocked => _blocked;
  Object? get lastError => _lastError;

  static StudioWorkspace _freeze(StudioWorkspace value) => StudioWorkspace(
        draft: StudioScenarioDraft.fromJson(value.draft.toJson()),
        activeStage: value.activeStage,
        completedStages: Set<StudioWorkflowStage>.of(value.completedStages),
      );

  Future<void> save(StudioWorkspace next) {
    final StudioWorkspace frozen = _freeze(next);
    return _enqueue(() async {
      final StudioDraftStore store = _store;
      if (store is ConditionalStudioDraftStore) {
        _snapshot = await store.writeIfUnchanged(_snapshot!, frozen);
      } else {
        await store.write(frozen);
      }
    });
  }

  /// Import follows the editor's own acknowledged saves; its sealed result is
  /// the only token advancement. The callback must not reload workspace state.
  Future<void> importSnapshot(
      Future<StudioWorkspaceSnapshot> Function(StudioWorkspaceSnapshot)
          operation) {
    if (_store is! ConditionalStudioDraftStore) {
      throw const StudioStorageException(
          code: 'aggregate_unavailable',
          message: 'This workspace does not provide matched analysis storage.');
    }
    return _enqueue(() async => _snapshot = await operation(_snapshot!));
  }

  Future<void> _enqueue(Future<void> Function() action) {
    final int epoch = _failureEpoch;
    final Future<void> operation = _tail.then((_) async {
      if (_blocked || epoch != _failureEpoch) {
        throw _lastError!;
      }
      try {
        await action();
        _lastError = null;
      } on Object catch (error) {
        _lastError = error;
        _failureEpoch++;
        _blocked = error is StudioStorageException &&
            (error.code == 'workspace_conflict' ||
                error.code == 'workspace_unsupported' ||
                error.code == 'workspace_recovery_required' ||
                error.code == 'authoring_recovery_required');
        rethrow;
      }
    });
    // A failing call still reports to its caller, while the queue can drain.
    _tail = operation.then<void>((_) {}, onError: (Object _) {});
    return operation;
  }

  /// Used before an operation that needs every already submitted save complete.
  Future<void> settle() async {
    await _tail;
    if (_lastError != null) throw _lastError!;
  }
}
