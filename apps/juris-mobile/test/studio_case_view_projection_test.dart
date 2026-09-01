import 'package:flutter_test/flutter_test.dart';
import 'package:juris_mobile/models/case_type_registry.dart';
import 'package:juris_mobile/models/studio_case_view_projection.dart';
import 'package:juris_mobile/models/studio_scenario_draft.dart';

void main() {
  test('package-defined views project the canonical mobile scenario', () {
    final StudioScenarioDraft draft = StudioScenarioDraft.guidedExample();
    final CaseTypeDefinition definition = caseTypeDefinition(draft.caseType.id);
    expect(
      definition.views,
      <StudioCaseViewId>[
        StudioCaseViewId.simulation,
        StudioCaseViewId.timeline,
        StudioCaseViewId.evidenceMap,
      ],
    );

    final StudioCaseViewProjection simulation =
        projectStudioCaseView(draft, StudioCaseViewId.simulation);
    expect(simulation.sourceStageCount, 3);
    expect(simulation.sourceActionCount, 2);
    expect(simulation.items.first.title, 'Playable route');
    expect(simulation.items.first.needsAttention, isFalse);

    final StudioCaseViewProjection timeline =
        projectStudioCaseView(draft, StudioCaseViewId.timeline);
    expect(
      timeline.items.map((StudioCaseViewItem item) => item.id),
      <String>['intake', 'strategy', 'resolved'],
    );

    final StudioCaseViewProjection evidence =
        projectStudioCaseView(draft, StudioCaseViewId.evidenceMap);
    expect(evidence.items.length, 3);
    expect(
        evidence.items.every((StudioCaseViewItem item) => item.kind == 'fact'),
        isTrue);
  });

  test('view projection cannot mutate the canonical draft', () {
    final StudioScenarioDraft draft = StudioScenarioDraft.guidedExample();
    final Map<String, dynamic> before = draft.toJson();
    for (final StudioCaseViewId view
        in caseTypeDefinition(draft.caseType.id).views) {
      projectStudioCaseView(draft, view);
    }
    expect(draft.toJson(), before);
  });

  test('timeline derives deadline time from canonical due_at', () {
    final Map<String, dynamic> source =
        StudioScenarioDraft.guidedExample().toJson();
    source['deadlines'] = <Map<String, dynamic>>[
      <String, dynamic>{
        'id': 'reply_deadline',
        'title': 'Send the reply',
        'due_at': <String, dynamic>{'day': 2, 'minute_of_day': 600},
        'completion_actions': <String>['close_case'],
      },
    ];
    final StudioScenarioDraft draft = StudioScenarioDraft.fromJson(source);
    final StudioCaseViewItem deadline = projectStudioCaseView(
      draft,
      StudioCaseViewId.timeline,
    ).items.last;
    expect(deadline.id, 'reply_deadline');
    expect(deadline.primaryMeta, '3480 elapsed min · Day 2 · 10:00');
  });
}
