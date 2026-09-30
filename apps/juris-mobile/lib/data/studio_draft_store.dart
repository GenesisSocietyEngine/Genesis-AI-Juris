import 'dart:convert';
import 'dart:io';

import 'package:crypto/crypto.dart';
import 'package:path_provider/path_provider.dart';

import '../models/studio_scenario_draft.dart';
import '../models/studio_workspace.dart';
import 'authoring_storage_backend.dart';
import 'authoring_storage_coordinator.dart';
import 'studio_workspace_codec.dart';

export '../models/studio_workspace.dart';

typedef StudioDirectoryProvider = Future<Directory> Function();

abstract interface class StudioDraftStore {
  Future<StudioWorkspace?> read();
  Future<void> write(StudioWorkspace workspace);
  Future<String> exportScenario(StudioScenarioDraft draft);
}

abstract interface class ConditionalStudioDraftStore
    implements StudioDraftStore {
  Future<StudioWorkspaceSnapshot> readSnapshot();
  Future<StudioWorkspaceSnapshot> writeIfUnchanged(
    StudioWorkspaceSnapshot expected,
    StudioWorkspace workspace,
  );
}

/// A loaded generation bound to its resolved target, separate from editor state.
final class StudioWorkspaceSnapshot {
  StudioWorkspaceSnapshot._(this._target, List<int>? bytes)
      : _bytes = bytes == null ? null : List<int>.unmodifiable(bytes);
  final String _target;

  /// Internal aggregate-service identity; callers cannot mutate this token.
  String get storageTarget => _target;
  final List<int>? _bytes;
  String? get contentSha256 =>
      _bytes == null ? null : sha256.convert(_bytes).toString();
  StudioWorkspace? get workspace => _bytes == null
      ? null
      : ApplicationSupportStudioDraftStore._decodeWorkspace(
          utf8.decode(_bytes),
        );
  String? get originalJson {
    final List<int>? bytes = _bytes;
    if (bytes == null) return null;
    final String encoded = utf8.decode(bytes);
    return bytes.length >= 3 &&
            bytes[0] == 0xef &&
            bytes[1] == 0xbb &&
            bytes[2] == 0xbf
        ? '\ufeff$encoded'
        : encoded;
  }

  factory StudioWorkspaceSnapshot.fromImportCommit(
          AuthoringImportCommit commit) =>
      StudioWorkspaceSnapshot._(
          ApplicationSupportStudioDraftStore._identity(
              File('${commit.rootPath}/guided_studio_v1/workspace.json')),
          utf8.encode(commit.workspaceJson));
}

/// Device-local persistence for the canonical scenario plus UI progress only.
final class ApplicationSupportStudioDraftStore
    implements ConditionalStudioDraftStore {
  ApplicationSupportStudioDraftStore({
    StudioDirectoryProvider? directoryProvider,
  }) : _directoryProvider = directoryProvider ?? getApplicationSupportDirectory;

  final StudioDirectoryProvider _directoryProvider;
  static int _recoverySequence = 0;

  @override
  Future<StudioWorkspace?> read() async => (await readSnapshot()).workspace;

  @override
  Future<StudioWorkspaceSnapshot> readSnapshot() async {
    try {
      return await _atFile('guided_studio_v1', 'workspace.json', (
        File file,
      ) async {
        final _StoredFile? stored = await _recover(file, _decodeWorkspace);
        return StudioWorkspaceSnapshot._(_identity(file), stored?.bytes);
      });
    } on StudioStorageException {
      rethrow;
    } on Object catch (error) {
      throw StudioStorageException(
        code: 'workspace_read_failed',
        message: 'Could not reopen the Studio workspace: $error',
      );
    }
  }

  @override
  Future<void> write(StudioWorkspace workspace) {
    // Freeze caller-owned collections before path resolution or queue waits.
    final String encoded = _encodeWorkspace(workspace);
    return _write(
      'guided_studio_v1',
      'workspace.json',
      encoded,
      _decodeWorkspace,
    ).then<void>((_) {});
  }

  static String _encodeWorkspace(StudioWorkspace workspace) =>
      const JsonEncoder.withIndent('  ').convert({
        'schema_version': 1,
        'active_stage': workspace.activeStage.wireName,
        'completed_stages': workspace.completedStages
            .map((StudioWorkflowStage stage) => stage.wireName)
            .toList(growable: false),
        'scenario': workspace.draft.toJson(),
      });

  static String _identity(File file) =>
      Platform.isWindows ? file.path.toLowerCase() : file.path;

  @override
  Future<StudioWorkspaceSnapshot> writeIfUnchanged(
    StudioWorkspaceSnapshot expected,
    StudioWorkspace workspace,
  ) async {
    // The encoded next generation is detached before the first await.
    final String encoded = _encodeWorkspace(workspace);
    try {
      _decodeWorkspace(encoded);
      return await _atFile('guided_studio_v1', 'workspace.json', (file) async {
        if (_identity(file) != expected._target) throw _conflict();
        final _StoredFile? current = await _recover(file, _decodeWorkspace);
        final String? digest =
            current == null ? null : sha256.convert(current.bytes).toString();
        if (digest != expected.contentSha256) throw _conflict();
        await _replaceVerified(file, encoded, _decodeWorkspace);
        return StudioWorkspaceSnapshot._(_identity(file), utf8.encode(encoded));
      });
    } on StudioStorageException {
      rethrow;
    } on Object catch (error) {
      throw StudioStorageException(
        code: 'workspace_write_failed',
        message: 'Could not persist the Studio workspace: $error',
      );
    }
  }

  static StudioStorageException _conflict() => const StudioStorageException(
        code: 'workspace_conflict',
        message:
            'Another saved workspace generation changed. Your edits are retained. '
            'Export them or explicitly reopen the saved workspace before saving.',
      );

  @override
  Future<String> exportScenario(StudioScenarioDraft draft) {
    final String safeId =
        draft.caseId.replaceAll(RegExp(r'[^A-Za-z0-9._-]'), '_');
    final String encoded =
        const JsonEncoder.withIndent(' ').convert(draft.toJson());
    return _write(
        'studio_exports_v1',
        '${safeId.isEmpty ? 'studio_case' : safeId}.scenario.json',
        encoded,
        (String value) => _decodeScenario(jsonDecode(value)));
  }

  Future<T> _atFile<T>(
      String directory, String name, Future<T> Function(File) action) async {
    Future<T> operate(AuthoringStorageLease lease) async =>
        action(await lease.file(directory, name));
    try {
      if (directory == 'studio_exports_v1') {
        return await AuthoringStorageCoordinator.run(
            _directoryProvider, operate);
      }
      return await AuthoringStorageBackend.run(_directoryProvider, operate);
    } on AuthoringRecoveryException catch (error) {
      throw StudioStorageException(
          code: 'authoring_recovery_required', message: error.message);
    }
  }

  Future<String> _write(String directory, String name, String encoded,
      Object Function(String) decode) async {
    try {
      decode(encoded);
      return await _atFile(directory, name, (File target) async {
        await _recover(target, decode);
        await _replaceVerified(target, encoded, decode);
        return target.path;
      });
    } on StudioStorageException {
      rethrow;
    } on Object catch (error) {
      throw StudioStorageException(
        code: 'workspace_write_failed',
        message: 'Could not persist the Studio workspace: $error',
      );
    }
  }

  static Future<_StoredFile?> _inspect(
    File file,
    Object Function(String) decode,
  ) async {
    final FileSystemEntityType type = await FileSystemEntity.type(
      file.path,
      followLinks: false,
    );
    if (type == FileSystemEntityType.notFound) return null;
    if (type != FileSystemEntityType.file) {
      throw FileSystemException('Expected a regular Studio file.', file.path);
    }
    final List<int> bytes = await file.readAsBytes();
    String encoded = '';
    try {
      encoded = utf8.decode(bytes);
      return _StoredFile(encoded, bytes: bytes, value: decode(encoded));
    } on UnsupportedStudioData catch (error) {
      return _StoredFile(encoded, bytes: bytes, unsupported: error.message);
    } on FormatException {
      return _StoredFile(encoded, bytes: bytes);
    }
  }

  static void _requireSupported(File file, _StoredFile? stored) {
    if (stored?.unsupported != null) {
      throw StudioStorageException(
        code: 'workspace_unsupported',
        message: '${stored!.unsupported} Original file retained: ${file.path}',
      );
    }
  }

  static Future<_StoredFile?> _recover(
      File target, Object Function(String) decode) async {
    final _StoredFile? current = await _inspect(target, decode);
    _requireSupported(target, current);
    // A completed generation always wins over an older backup or orphan temp.
    if (current?.value != null) return current;
    final File backup = File('${target.path}.bak');
    final _StoredFile? previous = await _inspect(backup, decode);
    _requireSupported(backup, previous);
    if (previous?.value != null) {
      if (current != null) await _preserve(target, 'corrupt');
      // Retain the validated backup through recovery, including a failed copy.
      await backup.copy(target.path);
      if (await target.readAsString() != previous!.encoded) {
        throw const FileSystemException('Studio recovery verification failed.');
      }
      return previous;
    }
    final File temporary = File('${target.path}.tmp');
    if (current != null ||
        previous != null ||
        await FileSystemEntity.type(temporary.path, followLinks: false) !=
            FileSystemEntityType.notFound) {
      throw StudioStorageException(
        code: 'workspace_recovery_required',
        message: 'The saved workspace needs recovery. Existing files were '
            'retained at ${target.parent.path}.',
      );
    }
    return null;
  }

  static Future<void> _preserve(File file, String reason) async {
    String path;
    do {
      path = '${file.path}.$reason-'
          '${DateTime.now().microsecondsSinceEpoch}-${_recoverySequence++}';
    } while (await FileSystemEntity.type(path, followLinks: false) !=
        FileSystemEntityType.notFound);
    await file.rename(path);
  }

  static Future<void> _replaceVerified(
      File target, String encoded, Object Function(String) decode) async {
    final File temporary = File('${target.path}.tmp');
    final File backup = File('${target.path}.bak');
    final _StoredFile? orphan = await _inspect(temporary, decode);
    final _StoredFile? previous = await _inspect(backup, decode);
    // Future data in any generation is never overwritten by an older writer.
    _requireSupported(temporary, orphan);
    _requireSupported(backup, previous);
    if (orphan != null) await _preserve(temporary, 'interrupted');
    await temporary.writeAsString(encoded, flush: true);
    if (await temporary.readAsString() != encoded) {
      throw const FileSystemException('Studio write verification failed.');
    }
    if (previous != null) {
      if (previous.value == null) {
        await _preserve(backup, 'corrupt');
      } else {
        await backup.delete();
      }
    }
    if (await target.exists()) await target.rename(backup.path);
    try {
      await temporary.rename(target.path);
    } on Object {
      if (!await target.exists() && await backup.exists()) {
        await backup.copy(target.path);
      }
      // Keep the failed write's temp bytes for recovery; never erase in finally.
      rethrow;
    }
    // Keep the last committed generation for process-termination recovery.
  }

  static StudioWorkspace _decodeWorkspace(String encoded) =>
      StudioWorkspaceCodec.decode(encoded);
  static StudioScenarioDraft _decodeScenario(dynamic source) =>
      StudioWorkspaceCodec.decodeScenario(source);
}

final class _StoredFile {
  const _StoredFile(
    this.encoded, {
    required this.bytes,
    this.value,
    this.unsupported,
  });
  final String encoded;
  final List<int> bytes;
  final Object? value;
  final String? unsupported;
}

final class StudioStorageException implements Exception {
  const StudioStorageException({required this.code, required this.message});
  final String code;
  final String message;
  @override
  String toString() => '$code: $message';
}
