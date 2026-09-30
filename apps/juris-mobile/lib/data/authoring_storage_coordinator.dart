import 'dart:async';
import 'dart:io';

/// Orders authoring I/O within this isolate, including recreated store instances.
/// This is not a process lock or an aggregate workspace/sidecar transaction.
final class AuthoringStorageCoordinator {
  static Future<void> _resolvingRoots = Future<void>.value();
  static final Map<String, Future<void>> _pendingByRoot = {};

  static Future<T> run<T>(Future<Directory> Function() directoryProvider,
      Future<T> Function(AuthoringStorageLease) action) {
    final Completer<T> result = Completer<T>();
    // Reserve before awaiting providers: a slower earlier caller must not be
    // overtaken by another store resolving the same root more quickly.
    _resolvingRoots = _resolvingRoots.then((_) async {
      try {
        final Directory supplied = await directoryProvider();
        await supplied.create(recursive: true);
        final String root = await supplied.resolveSymbolicLinks();
        final String identity = Platform.isWindows ? root.toLowerCase() : root;
        final Future<T> operation =
            (_pendingByRoot[identity] ?? Future<void>.value())
                .then((_) => action(AuthoringStorageLease._(root)));
        final Future<void> tail =
            operation.then<void>((_) {}, onError: (Object _) {});
        _pendingByRoot[identity] = tail;
        tail.then((_) {
          if (identical(_pendingByRoot[identity], tail)) {
            _pendingByRoot.remove(identity);
          }
        });
        operation.then<void>(result.complete,
            onError: (Object error, StackTrace stack) =>
                result.completeError(error, stack));
      } on Object catch (error, stack) {
        result.completeError(error, stack);
      }
    });
    return result.future;
  }
}

/// Low-level operations in one lease must not reenter public store methods.
final class AuthoringStorageLease {
  const AuthoringStorageLease._(this.rootPath);
  final String rootPath;

  Future<File> file(String directory, String name) async {
    for (final String part in [directory, name]) {
      if (part.isEmpty ||
          part == '.' ||
          part == '..' ||
          part.contains('/') ||
          part.contains('\\')) {
        throw ArgumentError('Expected a direct authoring storage child.');
      }
    }
    final Directory folder = Directory('$rootPath/$directory');
    final FileSystemEntityType type =
        await FileSystemEntity.type(folder.path, followLinks: false);
    if (type == FileSystemEntityType.notFound) {
      await folder.create();
    } else if (type != FileSystemEntityType.directory) {
      throw FileSystemException(
          'Expected an authoring directory.', folder.path);
    }
    return File('${folder.path}/$name');
  }
}
