import 'package:flutter/material.dart';

import '../design/juris_accessibility.dart';
import '../design/juris_surfaces.dart';
import '../visual_identity/case_visual_manifest.dart';

/// Resolves one Living Case treatment at the accessibility boundary.
CaseVisualTreatment resolveLivingCaseTreatment(
  BuildContext context,
  CaseVisualTreatment treatment,
) {
  final JurisSurfaces surfaces =
      Theme.of(context).extension<JurisSurfaces>() ?? JurisSurfaces.dark;
  return CaseVisualTreatment(
    motif: treatment.motif,
    palette: JurisCasePaletteResolver.resolve(
      palette: treatment.palette,
      surfaces: surfaces,
      highContrast: MediaQuery.highContrastOf(context),
    ),
    artSeed: treatment.artSeed,
  );
}
