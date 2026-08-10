import 'package:flutter/material.dart';

import '../visual_identity/case_visual_manifest.dart';

/// Provides one already-resolved presentation treatment to a visual subtree.
///
/// Resolution by case ID remains the repository/catalogue's responsibility.
final class CaseTreatmentScope extends InheritedWidget {
  const CaseTreatmentScope({
    super.key,
    required this.treatment,
    required super.child,
  });

  final CaseVisualTreatment treatment;

  static CaseVisualTreatment of(BuildContext context) {
    final CaseTreatmentScope? scope =
        context.dependOnInheritedWidgetOfExactType<CaseTreatmentScope>();
    if (scope == null) {
      throw FlutterError.fromParts(<DiagnosticsNode>[
        ErrorSummary('No CaseTreatmentScope found.'),
        ErrorDescription(
          'A visual primitive requested a CaseVisualTreatment, but its '
          'subtree has no CaseTreatmentScope ancestor.',
        ),
      ]);
    }
    return scope.treatment;
  }

  static CaseVisualTreatment? maybeOf(BuildContext context) {
    return context
        .dependOnInheritedWidgetOfExactType<CaseTreatmentScope>()
        ?.treatment;
  }

  @override
  bool updateShouldNotify(CaseTreatmentScope oldWidget) {
    return treatment != oldWidget.treatment;
  }
}
