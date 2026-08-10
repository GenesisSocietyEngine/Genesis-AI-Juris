import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';

import 'case_visual_manifest.dart';

typedef CaseVisualManifestAssetLoader = Future<String> Function(
  String assetPath,
);
typedef CaseVisualManifestDiagnostic = void Function(
  Object error,
  StackTrace stackTrace,
);

/// Loads the presentation-only manifest once and caches either it or fallback.
final class CaseVisualManifestRepository {
  CaseVisualManifestRepository({
    this.assetPath = 'assets/visual_identity/case_visual_manifest.v1.json',
    this.assetLoader,
    this.onDiagnostic,
  });

  final String assetPath;
  final CaseVisualManifestAssetLoader? assetLoader;
  final CaseVisualManifestDiagnostic? onDiagnostic;

  Future<CaseVisualManifest>? _cachedLoad;

  Future<CaseVisualManifest> load() {
    return _cachedLoad ??= _loadOnce();
  }

  Future<CaseVisualManifest> _loadOnce() async {
    try {
      final String encoded = assetLoader == null
          ? await rootBundle.loadString(assetPath)
          : await assetLoader!(assetPath);
      final dynamic decoded = jsonDecode(encoded);
      if (decoded is! Map<String, dynamic>) {
        throw const FormatException(
          'Case visual manifest must be a JSON object',
        );
      }
      return CaseVisualManifest.fromJson(decoded);
    } on Object catch (error, stackTrace) {
      _emitDiagnostic(error, stackTrace);
      return CaseVisualManifest.safeFallback;
    }
  }

  void _emitDiagnostic(Object error, StackTrace stackTrace) {
    try {
      final CaseVisualManifestDiagnostic? diagnostic = onDiagnostic;
      if (diagnostic != null) {
        diagnostic(error, stackTrace);
      } else if (kDebugMode) {
        debugPrint(
          'Case visual manifest `$assetPath` failed to load; using the safe '
          'default treatment. $error',
        );
      }
    } on Object {
      // Diagnostics cannot turn a presentation-only asset failure into a
      // blocked case library.
    }
  }
}
