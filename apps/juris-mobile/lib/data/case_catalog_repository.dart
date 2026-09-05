import 'dart:convert';

import 'package:flutter/services.dart';

import '../models/case_catalog.dart';

typedef CaseCatalogAssetLoader = Future<String> Function(String assetPath);

class CaseCatalogRepository {
  const CaseCatalogRepository({
    this.assetPath = 'assets/case_catalog/mobile_case_bundle.json',
    this.assetLoader,
  });

  final String assetPath;
  final CaseCatalogAssetLoader? assetLoader;

  Future<CaseCatalogBundle> load() async {
    final String encoded = assetLoader == null
        ? await rootBundle.loadString(assetPath)
        : await assetLoader!(assetPath);
    final dynamic decoded = jsonDecode(encoded);
    if (decoded is! Map<String, dynamic>) {
      throw const FormatException('Mobile case bundle must be a JSON object');
    }
    return CaseCatalogBundle.fromJson(decoded);
  }
}
