import 'studio_scenario_draft.dart';

final class StudioWorkspace {
  const StudioWorkspace({
    required this.draft,
    required this.activeStage,
    required this.completedStages,
  });

  final StudioScenarioDraft draft;
  final StudioWorkflowStage activeStage;
  final Set<StudioWorkflowStage> completedStages;
}
