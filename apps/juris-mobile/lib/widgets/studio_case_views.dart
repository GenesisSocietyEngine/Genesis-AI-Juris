import 'package:flutter/material.dart';

import '../models/case_type_registry.dart';
import '../models/studio_case_view_projection.dart';
import '../models/studio_scenario_draft.dart';
import 'section_card.dart';

final class StudioCaseViews extends StatefulWidget {
  const StudioCaseViews({
    required this.draft,
    required this.locale,
    super.key,
  });

  final StudioScenarioDraft draft;
  final String locale;

  @override
  State<StudioCaseViews> createState() => _StudioCaseViewsState();
}

final class _StudioCaseViewsState extends State<StudioCaseViews> {
  late StudioCaseViewId _activeView;

  bool get _ru => widget.locale == 'ru';

  @override
  void initState() {
    super.initState();
    _activeView = _definition.views.first;
  }

  @override
  void didUpdateWidget(covariant StudioCaseViews oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (!_definition.views.contains(_activeView)) {
      _activeView = _definition.views.first;
    }
  }

  CaseTypeDefinition get _definition => caseTypeDefinition(widget.draft.caseType.id);

  String _t(String en, String ru) => _ru ? ru : en;

  @override
  Widget build(BuildContext context) {
    final StudioCaseViewProjection projection =
        projectStudioCaseView(widget.draft, _activeView);
    return SectionCard(
      title: _t(
        'Professional case views',
        'Профессиональные представления кейса',
      ),
      subtitle: _t(
        'Each view is read from the same canonical scenario. Switching views '
            'never changes the draft; Rust remains the validation authority.',
        'Все представления читают один canonical-сценарий. Переключение не '
            'меняет черновик; Rust остаётся авторитетным валидатором.',
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: <Widget>[
          SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            child: Row(
              children: <Widget>[
                for (final StudioCaseViewId view in _definition.views)
                  Padding(
                    padding: const EdgeInsets.only(right: 8),
                    child: ChoiceChip(
                      key: ValueKey<String>(
                        'studio-case-view-${view.wireName}',
                      ),
                      label: Text(
                        '${_viewLabel(view)}  '
                        '${projectStudioCaseView(widget.draft, view).items.length}',
                      ),
                      selected: view == _activeView,
                      onSelected: (_) => setState(() => _activeView = view),
                    ),
                  ),
              ],
            ),
          ),
          const SizedBox(height: 16),
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: <Widget>[
              Expanded(
                child: Text(
                  _viewDescription(_activeView),
                  style: TextStyle(
                    color: Theme.of(context).colorScheme.onSurfaceVariant,
                  ),
                ),
              ),
              const SizedBox(width: 12),
              Text(
                '${projection.sourceStageCount} S · '
                '${projection.sourceActionCount} A',
                style: Theme.of(context).textTheme.labelSmall,
              ),
            ],
          ),
          const SizedBox(height: 12),
          if (projection.items.isEmpty)
            Container(
              key: ValueKey<String>(
                'studio-case-view-panel-${_activeView.wireName}',
              ),
              padding: const EdgeInsets.all(20),
              decoration: BoxDecoration(
                border: Border.all(color: Theme.of(context).dividerColor),
              ),
              child: Text(_emptyMessage(_activeView)),
            )
          else
            Column(
              key: ValueKey<String>(
                'studio-case-view-panel-${_activeView.wireName}',
              ),
              children: <Widget>[
                for (final (int index, StudioCaseViewItem item)
                    in projection.items.indexed) ...<Widget>[
                  _ProjectionItem(
                    index: index,
                    item: item,
                    locale: widget.locale,
                  ),
                  if (index < projection.items.length - 1)
                    const SizedBox(height: 8),
                ],
              ],
            ),
        ],
      ),
    );
  }

  String _viewLabel(StudioCaseViewId id) => switch (id) {
        StudioCaseViewId.issueMap => _t('Issues', 'Вопросы'),
        StudioCaseViewId.evidenceMap => _t('Evidence', 'Доказательства'),
        StudioCaseViewId.decisionTable => _t('Decisions', 'Решения'),
        StudioCaseViewId.taskPlan => _t('Process', 'Процесс'),
        StudioCaseViewId.timeline => _t('Timeline', 'Хронология'),
        StudioCaseViewId.economics => _t('Economics', 'Экономика'),
        StudioCaseViewId.simulation => _t('Simulation', 'Симуляция'),
      };

  String _viewDescription(StudioCaseViewId id) => switch (id) {
        StudioCaseViewId.issueMap => _t(
            'Issues and their connected options.',
            'Вопросы и связанные варианты.',
          ),
        StudioCaseViewId.evidenceMap => _t(
            'Facts and evidence, including unlinked record items.',
            'Факты и доказательства, включая несвязанные материалы.',
          ),
        StudioCaseViewId.decisionTable => _t(
            'Options, availability, consequences and effort.',
            'Варианты, доступность, последствия и трудозатраты.',
          ),
        StudioCaseViewId.taskPlan => _t(
            'Stages, work sequence and planned effort.',
            'Этапы, последовательность работ и плановые трудозатраты.',
          ),
        StudioCaseViewId.timeline => _t(
            'Stages and deadlines in authored order.',
            'Этапы и сроки в заданном порядке.',
          ),
        StudioCaseViewId.economics => _t(
            'Route effort and the authored resource envelope.',
            'Трудозатраты маршрута и заданный ресурсный бюджет.',
          ),
        StudioCaseViewId.simulation => _t(
            'Playable route and terminal outcomes.',
            'Игровой маршрут и финальные исходы.',
          ),
      };

  String _emptyMessage(StudioCaseViewId id) => switch (id) {
        StudioCaseViewId.issueMap => _t(
            'Add a non-terminal stage and connect an action.',
            'Добавьте незавершающий этап и свяжите действие.',
          ),
        StudioCaseViewId.evidenceMap => _t(
            'Add a fact or evidence record.',
            'Добавьте факт или доказательство.',
          ),
        StudioCaseViewId.decisionTable => _t(
            'Add an action to create the first decision option.',
            'Добавьте действие, чтобы создать первый вариант решения.',
          ),
        StudioCaseViewId.taskPlan => _t(
            'Add a stage to create the process.',
            'Добавьте этап, чтобы создать процесс.',
          ),
        StudioCaseViewId.timeline => _t(
            'Add a stage or deadline to create the timeline.',
            'Добавьте этап или срок, чтобы создать хронологию.',
          ),
        StudioCaseViewId.economics => _t(
            'Add route effort or resources to compare economics.',
            'Добавьте трудозатраты или ресурсы для сравнения экономики.',
          ),
        StudioCaseViewId.simulation => _t(
            'Add stages, actions and an outcome to form a route.',
            'Добавьте этапы, действия и исход для создания маршрута.',
          ),
      };
}

final class _ProjectionItem extends StatelessWidget {
  const _ProjectionItem({
    required this.index,
    required this.item,
    required this.locale,
  });

  final int index;
  final StudioCaseViewItem item;
  final String locale;

  @override
  Widget build(BuildContext context) {
    final ColorScheme colors = Theme.of(context).colorScheme;
    return Container(
      key: ValueKey<String>('studio-case-view-item-${item.id}'),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: colors.surfaceContainerLow,
        border: Border.all(
          color: item.needsAttention ? colors.error : colors.outlineVariant,
        ),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          CircleAvatar(
            radius: 16,
            backgroundColor: item.needsAttention
                ? colors.errorContainer
                : colors.primaryContainer,
            child: Text('${index + 1}'),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: <Widget>[
                Text(
                  item.kind.toUpperCase(),
                  style: Theme.of(context).textTheme.labelSmall,
                ),
                const SizedBox(height: 4),
                Text(item.title, style: Theme.of(context).textTheme.titleMedium),
                if (item.detail.isNotEmpty) ...<Widget>[
                  const SizedBox(height: 5),
                  Text(item.detail),
                ],
                const SizedBox(height: 9),
                Wrap(
                  spacing: 8,
                  runSpacing: 6,
                  children: <Widget>[
                    _MetaChip(label: item.primaryMeta),
                    if (item.secondaryMeta.isNotEmpty)
                      _MetaChip(label: item.secondaryMeta),
                    if (item.needsAttention)
                      _MetaChip(
                        label: locale == 'ru'
                            ? 'Требует внимания'
                            : 'Needs attention',
                        attention: true,
                      ),
                  ],
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

final class _MetaChip extends StatelessWidget {
  const _MetaChip({required this.label, this.attention = false});

  final String label;
  final bool attention;

  @override
  Widget build(BuildContext context) {
    final ColorScheme colors = Theme.of(context).colorScheme;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 5),
      decoration: BoxDecoration(
        color: attention ? colors.errorContainer : colors.surfaceContainerHigh,
        borderRadius: BorderRadius.circular(4),
      ),
      child: Text(label, style: Theme.of(context).textTheme.labelSmall),
    );
  }
}
