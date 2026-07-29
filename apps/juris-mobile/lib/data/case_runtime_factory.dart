import '../models/case_catalog.dart';
import 'demo_game_repository.dart';

/// Temporary runtime registry used until the generic Rust snapshot/action
/// bridge can launch any validated scenario file.
///
/// Catalog rendering is already fully data-driven. Gameplay launch is kept
/// explicit so an outline or unsupported scenario can never silently open the
/// Failed ERP demo under the wrong identity.
abstract final class CaseRuntimeFactory {
  static const String failedErpDemoAdapter = 'demo_failed_erp';

  static bool supports(MobileCaseDefinition caseDefinition) {
    return caseDefinition.runtimeAdapter == failedErpDemoAdapter &&
        caseDefinition.scenarioAvailable;
  }

  static DemoGameRepository create(MobileCaseDefinition caseDefinition) {
    if (!supports(caseDefinition)) {
      throw StateError(
        'No supported mobile runtime adapter for ${caseDefinition.caseId}',
      );
    }
    return DemoGameRepository(seed: caseDefinition.seed);
  }
}
