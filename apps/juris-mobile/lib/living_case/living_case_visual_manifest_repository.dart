import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';

import 'living_case_visual_manifest.dart';

typedef LivingCaseManifestAssetLoader = Future<String> Function(String path);
typedef LivingCaseManifestDiagnostic = void Function(
  Object error,
  StackTrace stackTrace,
);

final class LivingCaseVisualManifestRepository {
  LivingCaseVisualManifestRepository({
    this.assetPath =
        'assets/visual_identity/living_case_visual_manifest.v1.json',
    this.assetLoader,
    this.onDiagnostic,
  });

  final String assetPath;
  final LivingCaseManifestAssetLoader? assetLoader;
  final LivingCaseManifestDiagnostic? onDiagnostic;

  Future<LivingCaseVisualManifest?>? _cachedLoad;

  Future<LivingCaseVisualManifest?> load() => _cachedLoad ??= _loadOnce();

  Future<LivingCaseVisualManifest?> _loadOnce() async {
    try {
      final String encoded = assetLoader == null
          ? await rootBundle.loadString(assetPath)
          : await assetLoader!(assetPath);
      final dynamic decoded = jsonDecode(encoded);
      if (decoded is! Map<String, dynamic>) {
        throw const FormatException('Living Case manifest must be an object');
      }
      return LivingCaseVisualManifest.fromJson(decoded);
    } on Object catch (error, stackTrace) {
      try {
        if (onDiagnostic != null) {
          onDiagnostic!(error, stackTrace);
        } else if (kDebugMode) {
          debugPrint('Living Case manifest disabled: $error');
        }
      } on Object {
        // A diagnostic cannot turn presentation fallback into a product error.
      }
      return null;
    }
  }
}
