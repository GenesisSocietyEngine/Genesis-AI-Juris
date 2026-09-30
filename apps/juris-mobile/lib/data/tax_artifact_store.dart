import 'dart:convert';
import 'dart:io';
import 'package:crypto/crypto.dart';
import 'package:path_provider/path_provider.dart';

/// Separate authoring sidecar: never modifies a scenario or gameplay save.
final class TaxArtifactStore {
  TaxArtifactStore({Future<Directory> Function()? directoryProvider})
      : _directoryProvider =
            directoryProvider ?? getApplicationSupportDirectory;
  final Future<Directory> Function() _directoryProvider;
  Future<void> _pending = Future<void>.value();
  Future<File> _file(String caseId) async {
    final Directory root = await _directoryProvider();
    final Directory directory = Directory('${root.path}/tax_authoring_v1');
    await directory.create(recursive: true);
    return File(
      '${directory.path}/${sha256.convert(utf8.encode(caseId))}.json',
    );
  }

  Future<Map<String, dynamic>?> read(String caseId) async {
    await _pending;
    return _read(await _file(caseId), caseId);
  }

  Future<Map<String, dynamic>?> _read(File file, String caseId) async {
    final File backup = File('${file.path}.bak');
    if (!await file.exists()) {
      if (!await backup.exists()) return null;
      await backup.rename(file.path);
    }
    try {
      final dynamic value = jsonDecode(await file.readAsString());
      if (value is! Map<String, dynamic> || value['case_id'] != caseId) {
        throw const FormatException('Tax artifact identity mismatch.');
      }
      // Future envelopes are returned intact for read-only recovery/export.
      return value;
    } on FormatException {
      if (!await backup.exists()) rethrow;
      final dynamic value = jsonDecode(await backup.readAsString());
      if (value is! Map<String, dynamic> || value['case_id'] != caseId) rethrow;
      // Retain corrupt bytes for recovery, never silently erase them.
      await file.rename(
        '${file.path}.corrupt-${DateTime.now().microsecondsSinceEpoch}',
      );
      await backup.rename(file.path);
      return value;
    }
  }

  Future<void> write(String caseId, Map<String, dynamic> artifact) {
    final String encoded = jsonEncode(artifact); // Snapshot before waiting.
    final Future<void> operation = _pending.then((_) async {
      final File file = await _file(caseId);
      final Map<String, dynamic>? previous = await _read(file, caseId);
      if (previous != null &&
          previous['schema'] != 'tax-authoring-artifact-v1') {
        throw const FormatException('A newer artifact is preserved read-only.');
      }
      if (artifact['case_id'] != caseId ||
          artifact['schema'] != 'tax-authoring-artifact-v1') {
        throw const FormatException('Invalid artifact identity/version.');
      }
      final File temporary = File('${file.path}.tmp');
      final File backup = File('${file.path}.bak');
      await temporary.writeAsString(encoded, flush: true);
      if (await temporary.readAsString() != encoded)
        throw const FileSystemException('Tax write verification failed.');
      if (await backup.exists()) await backup.delete();
      if (await file.exists()) await file.rename(backup.path);
      try {
        await temporary.rename(file.path);
      } on Object {
        if (!await file.exists() && await backup.exists())
          await backup.rename(file.path);
        rethrow;
      }
      // Keep last valid generation: enables process-termination recovery.
    });
    _pending = operation.then<void>((_) {}, onError: (Object _) {});
    return operation;
  }

  Future<String> export(Map<String, dynamic> artifact) async {
    final Directory root = await _directoryProvider();
    final File file = File(
      '${root.path}/tax-workspace-${DateTime.now().microsecondsSinceEpoch}.json',
    );
    await file.writeAsString(
      const JsonEncoder.withIndent('  ').convert(artifact),
      flush: true,
    );
    return file.path;
  }
}
