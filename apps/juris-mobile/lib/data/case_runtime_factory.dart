import '../models/case_catalog.dart';
import 'demo_game_repository.dart';
import 'game_runtime_repository.dart';
import 'game_save_store.dart';
import 'native_scenario_bridge_client.dart';
import 'rust_scenario_repository.dart';
import 'scenario_bridge_client.dart';

/// Temporary runtime registry used until the generic Rust snapshot/action
/// bridge can launch any validated scenario file.
///
/// Catalog rendering is already fully data-driven. Gameplay launch is kept
/// explicit so an outline or unsupported scenario can never silently open the
/// Failed ERP demo under the wrong identity.
abstract final class CaseRuntimeFactory {
  static const String failedErpDemoAdapter = 'demo_failed_erp';
  static const String rustScenarioAdapter = 'rust_scenario_v1';

  static bool supports(MobileCaseDefinition caseDefinition) {
    return switch (caseDefinition.runtimeAdapter) {
      failedErpDemoAdapter => caseDefinition.scenarioAvailable,
      rustScenarioAdapter => caseDefinition.scenarioAvailable &&
          caseDefinition.readiness.engineRuntime &&
          caseDefinition.scenario != null,
      _ => false,
    };
  }

  static GameRuntimeRepository create(
    MobileCaseDefinition caseDefinition, {
    String locale = 'en',
    ScenarioBridgeClient? scenarioBridgeClient,
    GameSaveStore? gameSaveStore,
  }) {
    if (!supports(caseDefinition)) {
      throw StateError(
        'No supported mobile runtime adapter for ${caseDefinition.caseId}',
      );
    }
    if (caseDefinition.runtimeAdapter == failedErpDemoAdapter) {
      return DemoGameRepository(seed: caseDefinition.seed);
    }
    return RustScenarioRepository(
      caseDefinition: caseDefinition,
      locale: locale,
      bridgeClient: scenarioBridgeClient ?? NativeScenarioBridgeClient(),
      saveStore: gameSaveStore,
    );
  }
}
