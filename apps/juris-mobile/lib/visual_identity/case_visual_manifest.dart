import 'dart:ui';

import 'package:flutter/foundation.dart';

/// The finite set of code-owned visual compositions available to case art.
enum CaseVisualMotif {
  institutionalGrid('institutional_grid'),
  systemsGrid('systems_grid'),
  freightRoutes('freight_routes'),
  industrialHaze('industrial_haze'),
  supplyChain('supply_chain'),
  aquiferContours('aquifer_contours');

  const CaseVisualMotif(this.wireName);

  final String wireName;

  static CaseVisualMotif parse(String value) {
    for (final CaseVisualMotif motif in values) {
      if (motif.wireName == value) {
        return motif;
      }
    }
    throw FormatException('Unknown visual motif `$value`');
  }
}

/// Semantic colours used by deterministic dark-cover artwork.
@immutable
final class CaseVisualPalette {
  const CaseVisualPalette({
    required this.background,
    required this.surface,
    required this.accent,
    required this.signal,
  });

  factory CaseVisualPalette.fromJson(
    Map<String, dynamic> json, {
    String path = 'palette',
  }) {
    _requireExactKeys(
      json,
      const <String>{'background', 'surface', 'accent', 'signal'},
      path,
    );
    return CaseVisualPalette(
      background: _parseOpaqueRgb(json['background'], '$path.background'),
      surface: _parseOpaqueRgb(json['surface'], '$path.surface'),
      accent: _parseOpaqueRgb(json['accent'], '$path.accent'),
      signal: _parseOpaqueRgb(json['signal'], '$path.signal'),
    );
  }

  final Color background;
  final Color surface;
  final Color accent;
  final Color signal;

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        other is CaseVisualPalette &&
            background == other.background &&
            surface == other.surface &&
            accent == other.accent &&
            signal == other.signal;
  }

  @override
  int get hashCode => Object.hash(background, surface, accent, signal);
}

/// One presentation-only treatment, independent of scenario authority.
@immutable
final class CaseVisualTreatment {
  const CaseVisualTreatment({
    required this.motif,
    required this.palette,
    required this.artSeed,
  });

  factory CaseVisualTreatment.fromJson(
    Map<String, dynamic> json, {
    String path = 'treatment',
  }) {
    _requireExactKeys(
      json,
      const <String>{'motif', 'palette', 'art_seed'},
      path,
    );
    return CaseVisualTreatment(
      motif: CaseVisualMotif.parse(_requiredString(json, 'motif', path)),
      palette: CaseVisualPalette.fromJson(
        _requiredObject(json, 'palette', path),
        path: '$path.palette',
      ),
      artSeed: _requiredSeed(json, 'art_seed', path),
    );
  }

  final CaseVisualMotif motif;
  final CaseVisualPalette palette;
  final int artSeed;

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        other is CaseVisualTreatment &&
            motif == other.motif &&
            palette == other.palette &&
            artSeed == other.artSeed;
  }

  @override
  int get hashCode => Object.hash(motif, palette, artSeed);
}

/// Immutable Case Visual Manifest v1.
///
/// The model deliberately knows only presentation treatments and case IDs. It
/// has no dependency on catalogue, scenario, fingerprint, save, or runtime
/// models.
@immutable
final class CaseVisualManifest {
  CaseVisualManifest._({
    required this.schemaVersion,
    required this.defaultTreatment,
    required Map<String, CaseVisualTreatment> caseTreatments,
  }) : caseTreatments = Map<String, CaseVisualTreatment>.unmodifiable(
          caseTreatments,
        );

  factory CaseVisualManifest.fromJson(Map<String, dynamic> json) {
    _requireExactKeys(
      json,
      const <String>{
        'schema_version',
        'default_treatment',
        'case_treatments',
      },
      'manifest',
    );

    final dynamic rawSchemaVersion = json['schema_version'];
    if (rawSchemaVersion is! int || rawSchemaVersion != 1) {
      throw const FormatException('manifest.schema_version must be integer 1');
    }

    final CaseVisualTreatment defaultTreatment = CaseVisualTreatment.fromJson(
      _requiredObject(json, 'default_treatment', 'manifest'),
      path: 'manifest.default_treatment',
    );
    if (defaultTreatment.motif != CaseVisualMotif.institutionalGrid) {
      throw const FormatException(
        'manifest.default_treatment must use institutional_grid',
      );
    }
    final List<dynamic> rawTreatments =
        _requiredList(json, 'case_treatments', 'manifest');
    final Map<String, CaseVisualTreatment> treatments =
        <String, CaseVisualTreatment>{};

    for (int index = 0; index < rawTreatments.length; index += 1) {
      final String path = 'manifest.case_treatments[$index]';
      final Map<String, dynamic> rawTreatment =
          _asObject(rawTreatments[index], path);
      _requireExactKeys(
        rawTreatment,
        const <String>{'case_id', 'motif', 'palette', 'art_seed'},
        path,
      );
      final String caseId = _requiredString(rawTreatment, 'case_id', path);
      if (caseId.trim() != caseId) {
        throw FormatException('$path.case_id must be trimmed');
      }
      if (treatments.containsKey(caseId)) {
        throw FormatException('Duplicate case_id `$caseId`');
      }
      final CaseVisualTreatment treatment = CaseVisualTreatment.fromJson(
        <String, dynamic>{
          'motif': rawTreatment['motif'],
          'palette': rawTreatment['palette'],
          'art_seed': rawTreatment['art_seed'],
        },
        path: path,
      );
      if (treatment.motif == CaseVisualMotif.institutionalGrid) {
        throw FormatException(
          '$path.motif cannot use the reserved institutional_grid',
        );
      }
      treatments[caseId] = treatment;
    }

    return CaseVisualManifest._(
      schemaVersion: rawSchemaVersion,
      defaultTreatment: defaultTreatment,
      caseTreatments: treatments,
    );
  }

  static const CaseVisualTreatment builtInDefaultTreatment =
      CaseVisualTreatment(
    motif: CaseVisualMotif.institutionalGrid,
    palette: CaseVisualPalette(
      background: Color(0xFF07111F),
      surface: Color(0xFF0E1B2B),
      accent: Color(0xFFC7A35B),
      signal: Color(0xFF57B7D9),
    ),
    artSeed: 14248,
  );

  static final CaseVisualManifest safeFallback = CaseVisualManifest._(
    schemaVersion: 1,
    defaultTreatment: builtInDefaultTreatment,
    caseTreatments: const <String, CaseVisualTreatment>{},
  );

  final int schemaVersion;
  final CaseVisualTreatment defaultTreatment;
  final Map<String, CaseVisualTreatment> caseTreatments;

  CaseVisualTreatment resolve(String caseId) {
    return caseTreatments[caseId] ?? defaultTreatment;
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        other is CaseVisualManifest &&
            schemaVersion == other.schemaVersion &&
            defaultTreatment == other.defaultTreatment &&
            _treatmentMapsEqual(caseTreatments, other.caseTreatments);
  }

  @override
  int get hashCode {
    final List<String> caseIds = caseTreatments.keys.toList()..sort();
    return Object.hash(
      schemaVersion,
      defaultTreatment,
      Object.hashAll(
        caseIds.map(
          (String caseId) => Object.hash(caseId, caseTreatments[caseId]),
        ),
      ),
    );
  }
}

bool _treatmentMapsEqual(
  Map<String, CaseVisualTreatment> left,
  Map<String, CaseVisualTreatment> right,
) {
  if (left.length != right.length) {
    return false;
  }
  for (final MapEntry<String, CaseVisualTreatment> entry in left.entries) {
    if (right[entry.key] != entry.value) {
      return false;
    }
  }
  return true;
}

void _requireExactKeys(
  Map<String, dynamic> json,
  Set<String> expected,
  String path,
) {
  final Set<String> actual = json.keys.toSet();
  final List<String> missing = expected.difference(actual).toList()..sort();
  final List<String> unknown = actual.difference(expected).toList()..sort();
  if (missing.isNotEmpty || unknown.isNotEmpty) {
    throw FormatException(
      '$path has invalid keys; missing=$missing unknown=$unknown',
    );
  }
}

Map<String, dynamic> _requiredObject(
  Map<String, dynamic> json,
  String field,
  String path,
) {
  return _asObject(json[field], '$path.$field');
}

Map<String, dynamic> _asObject(dynamic value, String path) {
  if (value is Map<String, dynamic>) {
    return value;
  }
  throw FormatException('$path must be an object');
}

List<dynamic> _requiredList(
  Map<String, dynamic> json,
  String field,
  String path,
) {
  final dynamic value = json[field];
  if (value is List<dynamic>) {
    return value;
  }
  throw FormatException('$path.$field must be an array');
}

String _requiredString(
  Map<String, dynamic> json,
  String field,
  String path,
) {
  final dynamic value = json[field];
  if (value is String && value.isNotEmpty) {
    return value;
  }
  throw FormatException('$path.$field must be a non-empty string');
}

int _requiredSeed(
  Map<String, dynamic> json,
  String field,
  String path,
) {
  final dynamic value = json[field];
  if (value is! int || value < 0 || value > 65535) {
    throw FormatException('$path.$field must be an integer from 0 to 65535');
  }
  return value;
}

Color _parseOpaqueRgb(dynamic value, String path) {
  if (value is! String || !RegExp(r'^#[0-9a-fA-F]{6}$').hasMatch(value)) {
    throw FormatException('$path must be an opaque #RRGGBB colour');
  }
  return Color(0xFF000000 | int.parse(value.substring(1), radix: 16));
}
