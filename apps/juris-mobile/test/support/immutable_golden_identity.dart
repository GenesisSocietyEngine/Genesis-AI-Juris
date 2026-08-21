import 'dart:io';

import 'package:crypto/crypto.dart';
import 'package:flutter_test/flutter_test.dart';

final class ImmutableGoldenIdentity {
  const ImmutableGoldenIdentity({
    required this.repositoryRelativePath,
    required this.byteLength,
    required this.sha256Hex,
  });

  final String repositoryRelativePath;
  final int byteLength;
  final String sha256Hex;

  String get fileName => repositoryRelativePath.split('/').last;
}

final class ImmutableGoldenSet {
  const ImmutableGoldenSet({
    required this.repositoryRelativeRoot,
    required this.identities,
  });

  final String repositoryRelativeRoot;
  final List<ImmutableGoldenIdentity> identities;

  ImmutableGoldenIdentity identityNamed(String fileName) {
    for (final ImmutableGoldenIdentity identity in identities) {
      if (identity.fileName == fileName) {
        return identity;
      }
    }
    throw StateError(
      'Immutable golden identity is not declared for $fileName in '
      '$repositoryRelativeRoot.',
    );
  }
}

Directory? _cachedRepositoryRoot;

void expectImmutableGoldenPathSet(ImmutableGoldenSet goldenSet) {
  _validateGoldenSet(goldenSet);
  final Directory repositoryRoot = _repositoryRoot();
  final Directory protectedRoot = Directory(
    _nativePath(repositoryRoot, goldenSet.repositoryRelativeRoot),
  );
  final FileSystemEntityType protectedRootType = FileSystemEntity.typeSync(
    protectedRoot.path,
    followLinks: false,
  );
  if (protectedRootType != FileSystemEntityType.directory) {
    fail(
      'Immutable golden root must exist as a real directory: '
      '${goldenSet.repositoryRelativeRoot}; actual type=$protectedRootType.',
    );
  }

  final List<String> actualPaths = <String>[];
  for (final FileSystemEntity entity in protectedRoot.listSync(
    recursive: true,
    followLinks: false,
  )) {
    final FileSystemEntityType type = FileSystemEntity.typeSync(
      entity.path,
      followLinks: false,
    );
    if (type != FileSystemEntityType.file) {
      fail(
        'Immutable golden roots may contain only the declared regular PNG '
        'files; found ${_repositoryRelativePath(repositoryRoot, entity)} '
        'with type $type.',
      );
    }
    actualPaths.add(_repositoryRelativePath(repositoryRoot, entity));
  }

  final List<String> expectedPaths = goldenSet.identities
      .map(
        (ImmutableGoldenIdentity identity) => identity.repositoryRelativePath,
      )
      .toList(growable: false)
    ..sort();
  actualPaths.sort();
  expect(
    actualPaths,
    orderedEquals(expectedPaths),
    reason: 'Immutable golden path set changed under '
        '${goldenSet.repositoryRelativeRoot}. Missing, additional, renamed, '
        'or substituted files are forbidden.',
  );
}

void expectImmutableGoldenIdentity(ImmutableGoldenIdentity identity) {
  _validateIdentity(identity);
  final Directory repositoryRoot = _repositoryRoot();
  final File file = File(
    _nativePath(repositoryRoot, identity.repositoryRelativePath),
  );
  final FileSystemEntityType type = FileSystemEntity.typeSync(
    file.path,
    followLinks: false,
  );
  if (type != FileSystemEntityType.file) {
    fail(
      'Immutable golden must exist as a regular file: '
      '${identity.repositoryRelativePath}; actual type=$type.',
    );
  }

  expect(
    file.lengthSync(),
    identity.byteLength,
    reason: 'Immutable golden byte length changed: '
        '${identity.repositoryRelativePath}',
  );
  expect(
    sha256.convert(file.readAsBytesSync()).toString(),
    identity.sha256Hex,
    reason: 'Immutable golden SHA-256 changed: '
        '${identity.repositoryRelativePath}',
  );
}

void _validateGoldenSet(ImmutableGoldenSet goldenSet) {
  _validateRelativePath(
    goldenSet.repositoryRelativeRoot,
    field: 'repositoryRelativeRoot',
  );
  if (goldenSet.repositoryRelativeRoot.endsWith('/')) {
    fail('Immutable golden root must not end with a slash.');
  }
  if (goldenSet.identities.isEmpty) {
    fail('Immutable golden set must declare at least one identity.');
  }

  final Set<String> uniquePaths = <String>{};
  final String requiredPrefix = '${goldenSet.repositoryRelativeRoot}/';
  for (final ImmutableGoldenIdentity identity in goldenSet.identities) {
    _validateIdentity(identity);
    if (!identity.repositoryRelativePath.startsWith(requiredPrefix)) {
      fail(
        'Immutable golden path escapes its declared root: '
        '${identity.repositoryRelativePath}.',
      );
    }
    final String leaf = identity.repositoryRelativePath.substring(
      requiredPrefix.length,
    );
    if (leaf.isEmpty || leaf.contains('/')) {
      fail(
        'Immutable golden must be a direct file in its guarded profile root: '
        '${identity.repositoryRelativePath}.',
      );
    }
    if (!uniquePaths.add(identity.repositoryRelativePath)) {
      fail(
        'Duplicate immutable golden path: '
        '${identity.repositoryRelativePath}.',
      );
    }
  }
}

void _validateIdentity(ImmutableGoldenIdentity identity) {
  _validateRelativePath(
    identity.repositoryRelativePath,
    field: 'repositoryRelativePath',
  );
  if (!identity.repositoryRelativePath.endsWith('.png')) {
    fail(
      'Immutable golden identity must name a PNG: '
      '${identity.repositoryRelativePath}.',
    );
  }
  if (identity.byteLength <= 0) {
    fail(
      'Immutable golden byte length must be positive: '
      '${identity.repositoryRelativePath}.',
    );
  }
  if (!RegExp(r'^[0-9a-f]{64}$').hasMatch(identity.sha256Hex)) {
    fail(
      'Immutable golden SHA-256 must be 64 lowercase hexadecimal characters: '
      '${identity.repositoryRelativePath}.',
    );
  }
}

void _validateRelativePath(String path, {required String field}) {
  if (path.isEmpty ||
      path.startsWith('/') ||
      path.contains(r'\') ||
      RegExp(r'^[A-Za-z]:').hasMatch(path)) {
    fail('$field must be a normalized repository-relative path: $path.');
  }
  final List<String> segments = path.split('/');
  if (segments.any(
    (String segment) => segment.isEmpty || segment == '.' || segment == '..',
  )) {
    fail('$field contains an invalid path segment: $path.');
  }
}

Directory _repositoryRoot() {
  final Directory? cached = _cachedRepositoryRoot;
  if (cached != null) {
    return cached;
  }

  Directory candidate = Directory.current.absolute;
  while (true) {
    final bool hasWorkspaceManifest = File(
      _nativePath(candidate, 'Cargo.toml'),
    ).existsSync();
    final bool hasMobileManifest = File(
      _nativePath(candidate, 'apps/juris-mobile/pubspec.yaml'),
    ).existsSync();
    if (hasWorkspaceManifest && hasMobileManifest) {
      _cachedRepositoryRoot = candidate;
      return candidate;
    }

    final Directory parent = candidate.parent;
    if (parent.path == candidate.path) {
      throw StateError(
        'Could not locate the GENESIS repository root from '
        '${Directory.current.path}.',
      );
    }
    candidate = parent;
  }
}

String _nativePath(Directory repositoryRoot, String repositoryRelativePath) {
  return <String>[
    repositoryRoot.path,
    ...repositoryRelativePath.split('/'),
  ].join(Platform.pathSeparator);
}

String _repositoryRelativePath(
  Directory repositoryRoot,
  FileSystemEntity entity,
) {
  final String separator = Platform.pathSeparator;
  final String repositoryPrefix = repositoryRoot.path.endsWith(separator)
      ? repositoryRoot.path
      : '${repositoryRoot.path}$separator';
  final String absolutePath = entity.absolute.path;
  if (!absolutePath.toLowerCase().startsWith(
        repositoryPrefix.toLowerCase(),
      )) {
    fail('File-system entity escapes the repository: $absolutePath.');
  }
  return absolutePath
      .substring(repositoryPrefix.length)
      .replaceAll(separator, '/');
}
