import 'dart:io';

import 'package:path_provider/path_provider.dart';

/// Opaque persistence boundary for authoritative Rust command-log saves.
///
/// Implementations store UTF-8 JSON without interpreting runtime state.
abstract interface class GameSaveStore {
  Future<void> write(String slotId, String encodedSave);

  Future<String> read(String slotId);

  Future<bool> exists(String slotId);
}

typedef SaveDirectoryProvider = Future<Directory> Function();

/// Small platform-safe file store used by Save v1.
///
/// A verified temporary file and backup are used so a failed replacement can
/// restore the previous save. The authoritative integrity check still belongs
/// to Rust when the file is loaded.
final class ApplicationSupportGameSaveStore implements GameSaveStore {
  ApplicationSupportGameSaveStore({
    SaveDirectoryProvider? directoryProvider,
  }) : _directoryProvider = directoryProvider ?? getApplicationSupportDirectory;

  final SaveDirectoryProvider _directoryProvider;

  @override
  Future<bool> exists(String slotId) async {
    return (await _targetFile(slotId)).exists();
  }

  @override
  Future<String> read(String slotId) async {
    final File target = await _targetFile(slotId);
    if (!await target.exists()) {
      throw GameSaveStorageException(
        code: 'save_not_found',
        message: 'No saved game exists for $slotId.',
      );
    }
    try {
      return await target.readAsString();
    } on Object catch (error) {
      throw GameSaveStorageException(
        code: 'save_read_failed',
        message: 'Could not read the saved game: $error',
      );
    }
  }

  @override
  Future<void> write(String slotId, String encodedSave) async {
    final File target = await _targetFile(slotId);
    final File temporary = File('${target.path}.tmp');
    final File backup = File('${target.path}.bak');
    try {
      if (await temporary.exists()) {
        await temporary.delete();
      }
      await temporary.writeAsString(encodedSave, flush: true);
      if (await temporary.readAsString() != encodedSave) {
        throw const FileSystemException(
          'Temporary save verification failed',
        );
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
      throw GameSaveStorageException(
        code: 'save_write_failed',
        message: 'Could not persist the saved game: $error',
      );
    } finally {
      if (await temporary.exists()) {
        await temporary.delete();
      }
    }
  }

  Future<File> _targetFile(String slotId) async {
    if (!RegExp(r'^[A-Za-z0-9][A-Za-z0-9._-]*$').hasMatch(slotId)) {
      throw GameSaveStorageException(
        code: 'invalid_save_slot',
        message: 'Invalid save slot identifier: $slotId',
      );
    }
    final Directory support = await _directoryProvider();
    final Directory saves = Directory(
      '${support.path}${Platform.pathSeparator}scenario_saves_v1',
    );
    await saves.create(recursive: true);
    return File(
      '${saves.path}${Platform.pathSeparator}$slotId.json',
    );
  }
}

final class GameSaveStorageException implements Exception {
  const GameSaveStorageException({
    required this.code,
    required this.message,
  });

  final String code;
  final String message;

  @override
  String toString() => '$code: $message';
}
