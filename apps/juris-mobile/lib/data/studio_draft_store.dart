import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:path_provider/path_provider.dart';

import '../models/case_type_registry.dart';
import '../models/studio_scenario_draft.dart';

typedef StudioDirectoryProvider = Future<Directory> Function();

final class StudioWorkspace {
  const StudioWorkspace({
    required this.draft,
    required this.activeStage,
    required this.completedStages,
  });

  final StudioScenarioDraft draft;
  final StudioWorkflowStage activeStage;
  final Set<StudioWorkflowStage> completedStages;
}

abstract interface class StudioDraftStore {
  Future<StudioWorkspace?> read();
  Future<void> write(StudioWorkspace workspace);
  Future<String> exportScenario(StudioScenarioDraft draft);
}

/// Device-local persistence for the canonical scenario plus UI progress only.
final class ApplicationSupportStudioDraftStore implements StudioDraftStore {
  ApplicationSupportStudioDraftStore(
      {StudioDirectoryProvider? directoryProvider})
      : _directoryProvider =
            directoryProvider ?? getApplicationSupportDirectory;

  final StudioDirectoryProvider _directoryProvider;
  // Screens can recreate their stores. Serialize the actual shared file, not
  // just one store instance, including reads between writes in this isolate.
  static final Map<String, Future<void>> _pendingByPath = {};
  static Future<void> _resolvingPaths = Future<void>.value();
  static int _recoverySequence = 0;

  @override
  Future<StudioWorkspace?> read() async {
    try {
      return await _atFile('guided_studio_v1', 'workspace.json',
          (File file) async {
        final _StoredFile? stored = await _recover(file, _decodeWorkspace);
        return stored?.value as StudioWorkspace?;
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
    final String encoded = const JsonEncoder.withIndent('  ').convert({
      'schema_version': 1,
      'active_stage': workspace.activeStage.wireName,
      'completed_stages': workspace.completedStages
          .map((StudioWorkflowStage stage) => stage.wireName)
          .toList(growable: false),
      'scenario': workspace.draft.toJson(),
    });
    return _write(
            'guided_studio_v1', 'workspace.json', encoded, _decodeWorkspace)
        .then<void>((_) {});
  }

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

  Future<File> _file(String directory, String name) async {
    final Directory root = await _directoryProvider();
    final Directory folder =
        Directory('${root.path}${Platform.pathSeparator}$directory');
    await folder.create(recursive: true);
    final String resolved = await folder.resolveSymbolicLinks();
    return File('$resolved${Platform.pathSeparator}$name');
  }

  Future<T> _atFile<T>(
      String directory, String name, Future<T> Function(File) action) {
    final Completer<T> result = Completer<T>();
    // Reserve in call order even when two providers resolve the same root at
    // different speeds. Only resolution is global; file I/O is queued per path.
    _resolvingPaths = _resolvingPaths.then((_) async {
      try {
        final File file = await _file(directory, name);
        _serial(file, () => action(file)).then<void>(result.complete,
            onError: (Object error, StackTrace stack) =>
                result.completeError(error, stack));
      } on Object catch (error, stack) {
        result.completeError(error, stack);
      }
    });
    return result.future;
  }

  static Future<T> _serial<T>(File file, Future<T> Function() action) {
    final String path =
        Platform.isWindows ? file.path.toLowerCase() : file.path;
    final Future<T> operation =
        (_pendingByPath[path] ?? Future<void>.value()).then((_) => action());
    final Future<void> tail =
        operation.then<void>((_) {}, onError: (Object _) {});
    _pendingByPath[path] = tail;
    tail.then((_) {
      if (identical(_pendingByPath[path], tail)) _pendingByPath.remove(path);
    });
    return operation;
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
      File file, Object Function(String) decode) async {
    final FileSystemEntityType type =
        await FileSystemEntity.type(file.path, followLinks: false);
    if (type == FileSystemEntityType.notFound) return null;
    if (type != FileSystemEntityType.file) {
      throw FileSystemException('Expected a regular Studio file.', file.path);
    }
    String encoded = '';
    try {
      encoded = utf8.decode(await file.readAsBytes());
      return _StoredFile(encoded, value: decode(encoded));
    } on _UnsupportedStudioData catch (error) {
      return _StoredFile(encoded, unsupported: error.message);
    } on FormatException {
      return _StoredFile(encoded);
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

  static StudioWorkspace _decodeWorkspace(String encoded) {
    final dynamic source = jsonDecode(encoded);
    if (source is! Map<String, dynamic> ||
        !source.containsKey('schema_version')) {
      throw const FormatException('Invalid Studio workspace envelope.');
    }
    if (source['schema_version'] != 1 ||
        source.keys.any((String key) => !{
              'schema_version',
              'scenario',
              'active_stage',
              'completed_stages'
            }.contains(key))) {
      throw const _UnsupportedStudioData(
          'Unsupported Studio workspace format.');
    }
    final StudioScenarioDraft draft = _decodeScenario(source['scenario']);
    final Object? active = source['active_stage'];
    final Object? completed = source['completed_stages'];
    if ((active != null && active is! String) ||
        (completed != null && completed is! List<dynamic>)) {
      throw const FormatException('Invalid Studio progress.');
    }
    StudioWorkflowStage stage(Object? value) {
      if (value is! String)
        throw const FormatException('Invalid Studio stage.');
      for (final StudioWorkflowStage stage in StudioWorkflowStage.values) {
        if (value == stage.wireName) return stage;
      }
      throw const _UnsupportedStudioData('Unsupported Studio workflow stage.');
    }

    return StudioWorkspace(
      draft: draft,
      activeStage:
          active == null ? StudioWorkflowStage.describe : stage(active),
      completedStages: ((completed as List<dynamic>?) ?? const <dynamic>[])
          .map(stage)
          .toSet(),
    );
  }

  static StudioScenarioDraft _decodeScenario(dynamic source) {
    if (source is! Map<String, dynamic> ||
        !source.containsKey('schema_version')) {
      throw const FormatException('Invalid canonical scenario.');
    }
    if (source['schema_version'] != '1.0') {
      throw const _UnsupportedStudioData(
          'Unsupported canonical scenario version.');
    }
    final dynamic metadata = source['metadata'];
    final dynamic jurisdiction = source['jurisdiction'];
    if (metadata is! Map<String, dynamic> ||
        jurisdiction is! Map<String, dynamic> ||
        !['id', 'title', 'summary', 'content_version']
            .every((String key) => metadata[key] is String) ||
        (metadata['id'] as String).isEmpty ||
        source['initial_stage'] is! String ||
        !['code', 'pack_version']
            .every((String key) => jurisdiction[key] is String)) {
      throw const FormatException('Invalid canonical scenario identity.');
    }
    if (metadata['case_type'] != null) {
      try {
        CaseTypeReference.fromJson(metadata['case_type']);
      } on FormatException {
        throw const _UnsupportedStudioData('Unsupported case-type package.');
      }
    }
    const Map<String, List<String>> fields = {
      'stages': ['id', 'title', 'kind'],
      'actions': ['id', 'title'],
      'outcomes': ['id', 'title', 'summary', 'terminal_stage'],
      'facts': ['id', 'statement', 'initial_status'],
      'actors': ['id', 'name', 'role'],
      'evidence': ['id', 'title', 'kind'],
    };
    for (final String field in fields.keys) {
      final dynamic items = source[field];
      if (items == null && ['facts', 'actors', 'evidence'].contains(field))
        continue;
      if (items is! List<dynamic> ||
          items.any((dynamic item) =>
              item is! Map<String, dynamic> ||
              !fields[field]!.every((String key) => item[key] is String) ||
              (item['description'] != null &&
                  item['description'] is! String))) {
        throw FormatException('Invalid canonical scenario $field.');
      }
    }
    return StudioScenarioDraft.fromJson(source);
  }
}

final class _StoredFile {
  const _StoredFile(this.encoded, {this.value, this.unsupported});
  final String encoded;
  final Object? value;
  final String? unsupported;
}

final class _UnsupportedStudioData implements Exception {
  const _UnsupportedStudioData(this.message);
  final String message;
}

final class StudioStorageException implements Exception {
  const StudioStorageException({required this.code, required this.message});
  final String code;
  final String message;
  @override
  String toString() => '$code: $message';
}
