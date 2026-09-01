import 'dart:convert';
import 'dart:io';

import 'package:path_provider/path_provider.dart';

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

  @override
  Future<StudioWorkspace?> read() async {
    final File file = await _workspaceFile();
    if (!await file.exists()) {
      return null;
    }
    try {
      final dynamic decoded = jsonDecode(await file.readAsString());
      if (decoded is! Map<String, dynamic> ||
          decoded['schema_version'] != 1 ||
          decoded['scenario'] is! Map<String, dynamic>) {
        throw const FormatException('Unsupported Studio workspace envelope.');
      }
      final List<dynamic> completed =
          decoded['completed_stages'] as List<dynamic>? ?? const <dynamic>[];
      return StudioWorkspace(
        draft: StudioScenarioDraft.fromJson(
          decoded['scenario'] as Map<String, dynamic>,
        ),
        activeStage: StudioWorkflowStage.parse(
          decoded['active_stage'] as String?,
        ),
        completedStages: completed
            .whereType<String>()
            .map(StudioWorkflowStage.parse)
            .toSet(),
      );
    } on Object catch (error) {
      throw StudioStorageException(
        code: 'workspace_read_failed',
        message: 'Could not reopen the Studio workspace: $error',
      );
    }
  }

  @override
  Future<void> write(StudioWorkspace workspace) async {
    final String encoded = const JsonEncoder.withIndent('  ').convert(
      <String, dynamic>{
        'schema_version': 1,
        'active_stage': workspace.activeStage.wireName,
        'completed_stages': workspace.completedStages
            .map((StudioWorkflowStage stage) => stage.wireName)
            .toList(growable: false),
        'scenario': workspace.draft.toJson(),
      },
    );
    await _replaceVerified(await _workspaceFile(), encoded);
  }

  @override
  Future<String> exportScenario(StudioScenarioDraft draft) async {
    final Directory root = await _directoryProvider();
    final Directory exports = Directory(
      '${root.path}${Platform.pathSeparator}studio_exports_v1',
    );
    await exports.create(recursive: true);
    final String safeId = draft.caseId.replaceAll(
      RegExp(r'[^A-Za-z0-9._-]'),
      '_',
    );
    final File file = File(
      '${exports.path}${Platform.pathSeparator}'
      '${safeId.isEmpty ? 'studio_case' : safeId}.scenario.json',
    );
    final String encoded = const JsonEncoder.withIndent(' ').convert(
      draft.toJson(),
    );
    await _replaceVerified(file, encoded);
    return file.path;
  }

  Future<File> _workspaceFile() async {
    final Directory root = await _directoryProvider();
    final Directory studio = Directory(
      '${root.path}${Platform.pathSeparator}guided_studio_v1',
    );
    await studio.create(recursive: true);
    return File('${studio.path}${Platform.pathSeparator}workspace.json');
  }

  Future<void> _replaceVerified(File target, String encoded) async {
    final File temporary = File('${target.path}.tmp');
    final File backup = File('${target.path}.bak');
    try {
      if (await temporary.exists()) {
        await temporary.delete();
      }
      await temporary.writeAsString(encoded, flush: true);
      if (await temporary.readAsString() != encoded) {
        throw const FileSystemException('Studio write verification failed.');
      }
      if (await backup.exists()) {
        await backup.delete();
      }
      if (await target.exists()) {
        await target.rename(backup.path);
      }
      try {
        await temporary.rename(target.path);
      } on Object {
        if (await backup.exists() && !await target.exists()) {
          await backup.rename(target.path);
        }
        rethrow;
      }
      if (await backup.exists()) {
        await backup.delete();
      }
    } on Object catch (error) {
      throw StudioStorageException(
        code: 'workspace_write_failed',
        message: 'Could not persist the Studio workspace: $error',
      );
    } finally {
      if (await temporary.exists()) {
        await temporary.delete();
      }
    }
  }
}

final class StudioStorageException implements Exception {
  const StudioStorageException({required this.code, required this.message});

  final String code;
  final String message;

  @override
  String toString() => '$code: $message';
}
