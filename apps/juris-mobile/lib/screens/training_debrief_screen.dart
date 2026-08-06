import 'package:flutter/material.dart';

import '../models/training_debrief.dart';
import '../widgets/section_card.dart';

/// Result returned to the shell after the read-only debrief route closes.
enum TrainingDebriefNavigationAction { replay }

/// Full-screen post-case review projected by the authoritative Rust runtime.
///
/// The screen receives only the nested debrief projection. It cannot infer
/// eligibility or reconstruct decisions from the broader game snapshot.
class TrainingDebriefScreen extends StatelessWidget {
  const TrainingDebriefScreen({
    required this.debrief,
    required this.locale,
    super.key,
  });

  final TrainingDebriefView debrief;
  final String locale;

  bool get _isRussian => locale == 'ru';

  String _text(String english, String russian) =>
      _isRussian ? russian : english;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      key: const ValueKey<String>('training-debrief-screen'),
      appBar: AppBar(
        title: Text(_text('Training debrief', 'Разбор прохождения')),
      ),
      body: SingleChildScrollView(
        key: const PageStorageKey<String>('training-debrief-scroll'),
        padding: const EdgeInsets.fromLTRB(16, 12, 16, 32),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: <Widget>[
            _resultSection(context),
            const SizedBox(height: 12),
            _decisionTrailSection(context),
            const SizedBox(height: 12),
            _timeAndResourcesSection(context),
            const SizedBox(height: 12),
            _reflectionSection(context),
            const SizedBox(height: 20),
            FilledButton.icon(
              key: const ValueKey<String>('training-debrief-replay-button'),
              onPressed: () => Navigator.of(context).pop(
                TrainingDebriefNavigationAction.replay,
              ),
              icon: const Icon(Icons.replay_outlined),
              label: Text(
                _text('Replay this case', 'Переиграть это дело'),
              ),
            ),
            const SizedBox(height: 8),
            OutlinedButton(
              key: const ValueKey<String>('training-debrief-back-button'),
              onPressed: () => Navigator.of(context).pop(),
              child: Text(_text('Back to matter', 'Вернуться к делу')),
            ),
          ],
        ),
      ),
    );
  }

  Widget _resultSection(BuildContext context) {
    return SectionCard(
      key: const ValueKey<String>('training-debrief-result-section'),
      title: _text('Result', 'Результат'),
      subtitle: debrief.scenarioTitle,
      trailing: const Icon(Icons.flag_outlined),
      child: Column(
        children: <Widget>[
          _DetailRow(
            label: _text('Resolved outcome', 'Итоговый исход'),
            value: debrief.resolvedOutcomeTitle,
          ),
          _DetailRow(
            label: _text('Final scenario time', 'Итоговое время сценария'),
            value: _absoluteMoment(debrief.finalScenarioMinute),
          ),
          _DetailRow(
            label: _text('Matter lifecycle', 'Жизненный цикл дела'),
            value: _lifecycleLabel(debrief.matterLifecycle),
          ),
          _DetailRow(
            label: _text('Matter status', 'Статус дела'),
            value: _matterStatusLabel(debrief.matterStatus),
          ),
        ],
      ),
    );
  }

  Widget _decisionTrailSection(BuildContext context) {
    return SectionCard(
      key: const ValueKey<String>('training-debrief-decisions-section'),
      title: _text('Decision trail', 'Ход решений'),
      subtitle: _isRussian
          ? '${debrief.executedActions.length} выполненных действий в авторитетном порядке'
          : '${debrief.executedActions.length} executed actions in authoritative order',
      trailing: const Icon(Icons.route_outlined),
      child: debrief.executedActions.isEmpty
          ? Text(
              _text(
                'No player actions were recorded for this run.',
                'В этом прохождении действия игрока не зафиксированы.',
              ),
            )
          : Column(
              key: const ValueKey<String>('training-debrief-action-list'),
              children: debrief.executedActions
                  .map(
                    (TrainingDebriefActionView action) => Semantics(
                      label: _actionSemantics(action),
                      child: ListTile(
                        key: ValueKey<String>(
                          'training-debrief-action-${action.sequence}-${action.actionId}',
                        ),
                        contentPadding: EdgeInsets.zero,
                        leading: CircleAvatar(
                          child: Text('${action.sequence}'),
                        ),
                        title: Text(action.title),
                        subtitle: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: <Widget>[
                            Text(
                              '${_text('Completed', 'Завершено')} '
                              '${_absoluteMoment(action.completionMinute)}',
                            ),
                            Text(
                              '${_text('Duration', 'Длительность')}: '
                              '${_duration(action.timeCostMinutes)} · '
                              '${_text('Billable', 'Учтено')}: '
                              '${_duration(action.billableMinutes)} · '
                              '${_text('Cost', 'Стоимость')}: '
                              '${_money(action.costEur)}',
                            ),
                          ],
                        ),
                      ),
                    ),
                  )
                  .toList(growable: false),
            ),
    );
  }

  Widget _timeAndResourcesSection(BuildContext context) {
    return SectionCard(
      key: const ValueKey<String>('training-debrief-resources-section'),
      title: _text('Time and resources', 'Время и ресурсы'),
      subtitle: _text(
        'Deterministic totals from this completed run',
        'Детерминированные итоги завершённого прохождения',
      ),
      trailing: const Icon(Icons.account_balance_wallet_outlined),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: <Widget>[
          _DetailRow(
            label: _text('Action time', 'Время действий'),
            value: _duration(debrief.totalActionTimeMinutes),
          ),
          _DetailRow(
            label: _text('Billable time', 'Учтённое время'),
            value: _duration(debrief.totalBillableMinutes),
          ),
          _DetailRow(
            label: _text('Action costs', 'Стоимость действий'),
            value: _money(debrief.totalActionCostEur),
          ),
          if (debrief.resources.isEmpty)
            Padding(
              padding: const EdgeInsets.only(top: 8),
              child: Text(
                _text(
                  'No additional resource balances were projected.',
                  'Дополнительные остатки ресурсов не представлены.',
                ),
              ),
            )
          else ...<Widget>[
            const Divider(height: 24),
            ...debrief.resources.map(
              (TrainingDebriefResourceView resource) => Padding(
                key: ValueKey<String>(
                  'training-debrief-resource-${resource.resourceId}',
                ),
                padding: const EdgeInsets.symmetric(vertical: 6),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: <Widget>[
                    Text(
                      resource.label,
                      style: Theme.of(context).textTheme.titleSmall,
                    ),
                    const SizedBox(height: 2),
                    Text(
                      '${_text('Initial', 'Исходно')}: '
                      '${_resourceValue(resource, resource.initialValue)} · '
                      '${_text('Current', 'Сейчас')}: '
                      '${_resourceValue(resource, resource.currentValue)}',
                    ),
                  ],
                ),
              ),
            ),
          ],
        ],
      ),
    );
  }

  Widget _reflectionSection(BuildContext context) {
    return SectionCard(
      key: const ValueKey<String>('training-debrief-reflection-section'),
      title: _text('Reflection', 'Вопросы для анализа'),
      subtitle: _text(
        'Questions for your next replay, not a score or legal opinion',
        'Вопросы для следующего прохождения, а не оценка или юридическое заключение',
      ),
      trailing: const Icon(Icons.psychology_alt_outlined),
      child: Column(
        children: debrief.reflectionPromptIds
            .asMap()
            .entries
            .map(
              (MapEntry<int, String> entry) => ListTile(
                key: ValueKey<String>(
                  'training-debrief-reflection-${entry.value}',
                ),
                contentPadding: EdgeInsets.zero,
                leading: const Icon(Icons.help_outline),
                title: Text(_reflectionPrompt(entry.value)),
              ),
            )
            .toList(growable: false),
      ),
    );
  }

  String _actionSemantics(TrainingDebriefActionView action) {
    return _isRussian
        ? 'Решение ${action.sequence}: ${action.title}. Завершено '
            '${_absoluteMoment(action.completionMinute)}. Стоимость '
            '${_money(action.costEur)}.'
        : 'Decision ${action.sequence}: ${action.title}. Completed '
            '${_absoluteMoment(action.completionMinute)}. Cost '
            '${_money(action.costEur)}.';
  }

  String _reflectionPrompt(String id) {
    return switch (id) {
      'decisive_fact_or_evidence' => _text(
          'Which revealed fact or item of evidence most changed your strategy?',
          'Какой раскрытый факт или доказательство сильнее всего изменили вашу стратегию?',
        ),
      'deadline_or_procedural_pressure' => _text(
          'Which deadline or procedural constraint created the greatest pressure?',
          'Какой срок или процессуальное ограничение создали наибольшее давление?',
        ),
      'time_or_budget_tradeoff' => _text(
          'Where did you trade time or budget for a stronger position?',
          'Где вы обменяли время или бюджет на более сильную позицию?',
        ),
      'alternative_replay_strategy' => _text(
          'What different strategy would you like to test on replay?',
          'Какую другую стратегию вы хотите проверить при повторном прохождении?',
        ),
      _ => _text(
          'What else from this run would you examine before replaying?',
          'Что ещё в этом прохождении стоит проанализировать перед повторной игрой?',
        ),
    };
  }

  String _lifecycleLabel(TrainingDebriefMatterLifecycle lifecycle) {
    return switch (lifecycle) {
      TrainingDebriefMatterLifecycle.active => _text('Active', 'Активно'),
      TrainingDebriefMatterLifecycle.postJudgment =>
        _text('Post-judgment', 'После решения'),
      TrainingDebriefMatterLifecycle.appeal => _text('Appeal', 'Апелляция'),
      TrainingDebriefMatterLifecycle.cassation =>
        _text('Cassation', 'Кассация'),
      TrainingDebriefMatterLifecycle.enforcement =>
        _text('Enforcement', 'Исполнение'),
      TrainingDebriefMatterLifecycle.closed => _text('Closed', 'Закрыто'),
      TrainingDebriefMatterLifecycle.unknown => _text('Unknown', 'Неизвестно'),
    };
  }

  String _matterStatusLabel(TrainingDebriefMatterStatus status) {
    return switch (status) {
      TrainingDebriefMatterStatus.open => _text('Open', 'Открыто'),
      TrainingDebriefMatterStatus.recoverable =>
        _text('Recoverable', 'Можно исправить'),
      TrainingDebriefMatterStatus.closed => _text('Closed', 'Закрыто'),
      TrainingDebriefMatterStatus.unknown => _text('Unknown', 'Неизвестно'),
    };
  }

  String _absoluteMoment(int elapsedMinutes) {
    final int absoluteMinutes = 8 * 60 + elapsedMinutes;
    final int day = absoluteMinutes ~/ 1440 + 1;
    final int minuteOfDay = absoluteMinutes % 1440;
    final String hour = (minuteOfDay ~/ 60).toString().padLeft(2, '0');
    final String minute = (minuteOfDay % 60).toString().padLeft(2, '0');
    return '${_text('Day', 'День')} $day · $hour:$minute';
  }

  String _duration(int minutes) {
    final int hours = minutes ~/ 60;
    final int remainder = minutes % 60;
    if (hours == 0) {
      return '$remainder ${_text('min', 'мин')}';
    }
    if (remainder == 0) {
      return '$hours ${_text('h', 'ч')}';
    }
    return '$hours ${_text('h', 'ч')} $remainder ${_text('min', 'мин')}';
  }

  String _money(int value) {
    final String digits = value.abs().toString();
    final StringBuffer result = StringBuffer();
    for (int index = 0; index < digits.length; index += 1) {
      if (index > 0 && (digits.length - index) % 3 == 0) {
        result.write(',');
      }
      result.write(digits[index]);
    }
    return 'EUR ${value < 0 ? '-' : ''}$result';
  }

  String _resourceValue(TrainingDebriefResourceView resource, int value) {
    if (resource.resourceId.endsWith('_eur')) {
      return _money(value);
    }
    if (resource.resourceId.endsWith('_minutes')) {
      return _duration(value);
    }
    return '$value';
  }
}

class _DetailRow extends StatelessWidget {
  const _DetailRow({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 5),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          Expanded(child: Text(label)),
          const SizedBox(width: 12),
          Expanded(
            child: Text(
              value,
              textAlign: TextAlign.end,
              style: Theme.of(context).textTheme.titleSmall,
            ),
          ),
        ],
      ),
    );
  }
}
