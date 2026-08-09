import '../models/case_catalog.dart';
import 'game_runtime_repository.dart';
import 'game_save_store.dart';
import 'native_scenario_bridge_client.dart';
import 'rust_scenario_repository.dart';
import 'scenario_bridge_client.dart';

/// Runtime registry for validated mobile scenario definitions.
///
/// Catalog rendering is already fully data-driven. Gameplay launch is kept
/// explicit so an outline or unsupported scenario can never silently open the
/// wrong runtime under another case identity.
abstract final class CaseRuntimeFactory {
  static const String rustScenarioAdapter = 'rust_scenario_v1';

  static bool supports(MobileCaseDefinition caseDefinition) {
    return switch (caseDefinition.runtimeAdapter) {
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
    CaseCatalogBundle? contentInventory,
  }) {
    if (!supports(caseDefinition)) {
      throw StateError(
        'No supported mobile runtime adapter for ${caseDefinition.caseId}',
      );
    }
    return RustScenarioRepository(
      caseDefinition: caseDefinition,
      locale: locale,
      bridgeClient: scenarioBridgeClient ?? NativeScenarioBridgeClient(),
      saveStore: gameSaveStore,
      contentInventory: contentInventory,
    );
  }
}
