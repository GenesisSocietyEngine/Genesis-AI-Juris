import 'dart:convert';
import 'dart:io';
import 'package:crypto/crypto.dart';
import 'package:path_provider/path_provider.dart';

import 'authoring_storage_coordinator.dart';
import 'tax_authoring_repository.dart';

/// An exact saved generation, separate from the caller's editable copy.
final class TaxArtifactSnapshot {
  const TaxArtifactSnapshot._(this.caseId, this._target, this._encoded,
      this.originalJson, this.contentSha256, this.readOnlyError);
  final String caseId;
  final String _target;
  final String? _encoded;

  /// Original valid UTF-8 JSON, including whitespace, numeric tokens and BOM.
  /// Use this for opaque recovery, rather than re-encoding [artifact].
  final String? originalJson;
  final String? contentSha256;
  final TaxStorageException? readOnlyError;
  String? get readOnlyReason => readOnlyError?.message;
  Map<String, dynamic>? get artifact =>
      _encoded == null ? null : jsonDecode(_encoded) as Map<String, dynamic>;
}

final class TaxStorageException implements Exception {
  const TaxStorageException({required this.code, required this.message});
  final String code;
  final String message;
  @override
  String toString() => '$code: $message';
}

/// Separate authoring sidecar: never modifies a scenario or gameplay save.
/// Coordination is in-isolate only; aggregate import is not a transaction.
final class TaxArtifactStore {
  TaxArtifactStore({Future<Directory> Function()? directoryProvider})
      : _directoryProvider =
            directoryProvider ?? getApplicationSupportDirectory;
  final Future<Directory> Function() _directoryProvider;
  static int _sequence = 0;

  Future<T> _atFile<T>(String caseId, Future<T> Function(File) action) =>
      AuthoringStorageCoordinator.run(_directoryProvider, (lease) async {
        final File file = await lease.file(
            'tax_authoring_v1', '${sha256.convert(utf8.encode(caseId))}.json');
        return action(file);
      });

  Future<Map<String, dynamic>?> read(String caseId) async =>
      (await readSnapshot(caseId)).artifact;

  Future<TaxArtifactSnapshot> readSnapshot(String caseId) async {
    try {
      return await _atFile(caseId, (file) => _readSnapshot(file, caseId));
    } on TaxStorageException {
      rethrow;
    } on Object catch (error) {
      throw TaxStorageException(
          code: 'tax_read_failed',
          message: 'Could not reopen the saved analysis: $error');
    }
  }

  /// Compatibility replacement API. Read-edit-write callers should use tokens.
  Future<void> write(String caseId, Map<String, dynamic> artifact) async {
    final _TaxFile next = _freeze(caseId, artifact);
    try {
      await _atFile(caseId, (file) async {
        final TaxArtifactSnapshot previous = await _readSnapshot(file, caseId);
        _requireWritable(previous);
        await _replaceVerified(file, caseId, next);
      });
    } on TaxStorageException {
      rethrow;
    } on Object catch (error) {
      throw TaxStorageException(
          code: 'tax_write_failed',
          message:
              'Could not save the analysis. Your edits are retained: $error');
    }
  }

  Future<TaxArtifactSnapshot> writeIfUnchanged(
      TaxArtifactSnapshot expected, Map<String, dynamic> artifact) async {
    final _TaxFile next = _freeze(expected.caseId, artifact);
    _requireWritable(expected);
    try {
      return await _atFile(expected.caseId, (file) async {
        if (_identity(file) != expected._target) throw _conflict();
        final TaxArtifactSnapshot current =
            await _readSnapshot(file, expected.caseId);
        _requireWritable(current);
        if (current.contentSha256 != expected.contentSha256) throw _conflict();
        await _replaceVerified(file, expected.caseId, next);
        return _snapshot(file, expected.caseId, next);
      });
    } on TaxStorageException {
      rethrow;
    } on Object catch (error) {
      throw TaxStorageException(
          code: 'tax_write_failed',
          message:
              'Could not save the analysis. Your edits are retained: $error');
    }
  }

  static TaxStorageException _conflict() => const TaxStorageException(
      code: 'tax_conflict',
      message: 'Another saved generation changed. Your edits are retained. '
          'Export them or explicitly reopen the saved analysis before saving.');

  static void _requireWritable(TaxArtifactSnapshot value) {
    if (value.readOnlyError != null) throw value.readOnlyError!;
  }

  static String _identity(File file) =>
      Platform.isWindows ? file.path.toLowerCase() : file.path;

  static _TaxFile _freeze(String caseId, Map<String, dynamic> artifact) {
    try {
      // Encode and validate the same detached value before any provider/queue.
      final List<int> bytes = utf8.encode(jsonEncode(artifact));
      final _TaxFile value = _decode(bytes, caseId);
      if (!value.supported) throw const FormatException('Unsupported artifact');
      return value;
    } on Object {
      throw const TaxStorageException(
          code: 'tax_invalid_artifact',
          message: 'The analysis identity or editable format is invalid. '
              'No saved data was changed.');
    }
  }

  static _TaxFile _decode(List<int> bytes, String caseId) {
    try {
      final String encoded = utf8.decode(bytes);
      final dynamic value = jsonDecode(encoded);
      if (value is! Map<String, dynamic>) return _TaxFile(bytes);
      if (value['case_id'] != caseId) {
        return _TaxFile(bytes, wrongIdentity: true);
      }
      return _TaxFile(bytes,
          encoded: encoded, supported: validTaxArtifact(value));
    } on FormatException {
      return _TaxFile(bytes);
    }
  }

  static Future<_TaxFile?> _inspect(File file, String caseId) async {
    final FileSystemEntityType type =
        await FileSystemEntity.type(file.path, followLinks: false);
    if (type == FileSystemEntityType.notFound) return null;
    if (type != FileSystemEntityType.file) {
      throw FileSystemException('Expected a regular analysis file.', file.path);
    }
    return _decode(await file.readAsBytes(), caseId);
  }

  static TaxStorageException? _restriction(_TaxFile? value) {
    if (value?.encoded != null && !value!.supported) {
      return const TaxStorageException(
          code: 'tax_unsupported',
          message: 'An unsupported saved or interrupted analysis is preserved. '
              'Editing is disabled until it can be recovered.');
    }
    if (value?.wrongIdentity == true) {
      return const TaxStorageException(
          code: 'tax_recovery_required',
          message: 'A retained analysis file belongs to another case. '
              'Existing files are preserved for recovery.');
    }
    return null;
  }

  static TaxArtifactSnapshot _snapshot(
          File file, String caseId, _TaxFile? value,
          [TaxStorageException? restriction]) =>
      TaxArtifactSnapshot._(
          caseId,
          _identity(file),
          value?.encoded,
          value?.originalJson,
          value == null ? null : sha256.convert(value.bytes).toString(),
          restriction);

  static Future<TaxArtifactSnapshot> _readSnapshot(
      File target, String caseId) async {
    final _TaxFile? current = await _inspect(target, caseId);
    // An identity-matching opaque primary never downgrades to an older backup.
    if (current?.encoded != null && !current!.supported) {
      return _snapshot(target, caseId, current, _restriction(current));
    }
    final File backup = File('${target.path}.bak');
    final File temporary = File('${target.path}.tmp');
    final _TaxFile? previous = await _inspect(backup, caseId);
    final _TaxFile? orphan = await _inspect(temporary, caseId);
    final TaxStorageException? restriction =
        _restriction(previous) ?? _restriction(orphan);
    // A committed generation wins; opaque auxiliary work still blocks writes.
    if (current?.supported == true) {
      return _snapshot(target, caseId, current, restriction);
    }
    if (restriction != null) throw restriction;
    if (previous?.supported == true) {
      if (current != null) await _preserve(target, 'corrupt');
      await backup.copy(target.path);
      await _verify(target, previous!.bytes);
      return _snapshot(target, caseId, previous);
    }
    if (current != null || previous != null || orphan != null) {
      throw TaxStorageException(
          code: 'tax_recovery_required',
          message: 'The saved analysis needs recovery. Existing files were '
              'retained at ${target.parent.path}.');
    }
    return _snapshot(target, caseId, null);
  }

  static Future<void> _preserve(File file, String reason) async {
    String path;
    do {
      path = '${file.path}.$reason-'
          '${DateTime.now().microsecondsSinceEpoch}-${_sequence++}';
    } while (await FileSystemEntity.type(path, followLinks: false) !=
        FileSystemEntityType.notFound);
    await file.rename(path);
  }

  static Future<void> _verify(File file, List<int> expected) async {
    final List<int> actual = await file.readAsBytes();
    if (actual.length != expected.length) {
      throw FileSystemException(
          'Analysis write verification failed.', file.path);
    }
    for (int i = 0; i < expected.length; i++) {
      if (expected[i] != actual[i]) {
        throw FileSystemException(
            'Analysis write verification failed.', file.path);
      }
    }
  }

  static Future<void> _replaceVerified(
      File target, String caseId, _TaxFile next) async {
    final File temporary = File('${target.path}.tmp');
    final File backup = File('${target.path}.bak');
    final _TaxFile? orphan = await _inspect(temporary, caseId);
    final _TaxFile? previous = await _inspect(backup, caseId);
    final TaxStorageException? restriction =
        _restriction(previous) ?? _restriction(orphan);
    if (restriction != null) throw restriction;
    if (orphan != null) await _preserve(temporary, 'interrupted');
    await temporary.writeAsBytes(next.bytes, flush: true);
    await _verify(temporary, next.bytes);
    if (previous != null) {
      if (!previous.supported) {
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
      // Failed payload and prior committed generation remain recoverable.
      rethrow;
    }
  }

  Future<String> export(Map<String, dynamic> artifact) async {
    // Semantic map export: freezes edits, but re-encodes JSON representation.
    final String encoded = const JsonEncoder.withIndent('  ').convert(artifact);
    return _exportEncoded(encoded);
  }

  /// Export the loaded generation exactly, without re-reading or re-encoding.
  Future<String> exportOriginal(TaxArtifactSnapshot snapshot) async {
    final String? encoded = snapshot.originalJson;
    if (encoded == null) {
      throw const TaxStorageException(
          code: 'tax_export_failed',
          message: 'There is no saved analysis to export.');
    }
    return _exportEncoded(encoded);
  }

  Future<String> _exportEncoded(String encoded) async {
    try {
      return await AuthoringStorageCoordinator.run(_directoryProvider,
          (lease) async {
        File file;
        do {
          file = File('${lease.rootPath}/tax-workspace-'
              '${DateTime.now().microsecondsSinceEpoch}-${_sequence++}.json');
        } while (await FileSystemEntity.type(file.path, followLinks: false) !=
            FileSystemEntityType.notFound);
        await file.writeAsString(encoded, flush: true);
        await _verify(file, utf8.encode(encoded));
        return file.path;
      });
    } on Object catch (error) {
      throw TaxStorageException(
          code: 'tax_export_failed',
          message: 'Could not export the analysis: $error');
    }
  }
}

final class _TaxFile {
  const _TaxFile(this.bytes,
      {this.encoded, this.supported = false, this.wrongIdentity = false});
  final List<int> bytes;
  final String? encoded;
  // utf8.decode consumes a BOM; retain it separately from JSON parsing.
  String? get originalJson => encoded == null
      ? null
      : bytes.length >= 3 &&
              bytes[0] == 0xef &&
              bytes[1] == 0xbb &&
              bytes[2] == 0xbf
          ? '\ufeff$encoded'
          : encoded;
  final bool supported;
  final bool wrongIdentity;
}
