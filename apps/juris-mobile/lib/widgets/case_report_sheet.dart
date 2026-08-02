import 'package:flutter/material.dart';

import '../app/gameplay_locale.dart';
import '../models/game_snapshot.dart';

/// Read-only post-matter report shown once every active lifecycle branch has
/// reached a terminal state.
class CaseReportSheet extends StatelessWidget {
  const CaseReportSheet({
    required this.snapshot,
    required this.summary,
    super.key,
  });

  final GameSnapshot snapshot;
  final CaseOutcomeSummaryView summary;

  @override
  Widget build(BuildContext context) {
    final TextTheme text = Theme.of(context).textTheme;
    final ColorScheme colors = Theme.of(context).colorScheme;

    return SafeArea(
      top: false,
      child: SingleChildScrollView(
        padding: const EdgeInsets.fromLTRB(24, 8, 24, 28),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: <Widget>[
            Text(
              GameplayLocale.text(context, 'Case report', 'Отчёт по делу'),
              style: text.headlineSmall,
            ),
            const SizedBox(height: 6),
            Text(
              snapshot.matterTitle,
              style: text.titleMedium?.copyWith(
                color: colors.onSurfaceVariant,
              ),
            ),
            const SizedBox(height: 24),
            _ReportSection(
              title: GameplayLocale.text(context, 'Outcome', 'Исход'),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: <Widget>[
                  _ReportRow(
                    label: GameplayLocale.text(context, 'Result', 'Результат'),
                    value: _judicialResultLabel(
                          context,
                          snapshot.judicialResult,
                        ) ??
                        _caseResultLabel(context, snapshot.caseResultStatus),
                  ),
                  if (snapshot.judicialDecisionInstance != null)
                    _ReportRow(
                      label: GameplayLocale.text(
                        context,
                        'Court instance',
                        'Судебная инстанция',
                      ),
                      value: _judicialDecisionInstanceLabel(
                        context,
                        snapshot.judicialDecisionInstance!,
                      ),
                    ),
                  _ReportRow(
                    label: GameplayLocale.text(
                      context,
                      'Matter status',
                      'Статус дела',
                    ),
                    value: _matterLifecycleLabel(
                      context,
                      snapshot.matterLifecycle,
                    ),
                  ),
                  _ReportRow(
                    label: GameplayLocale.text(
                      context,
                      'Procedural stage',
                      'Процессуальная стадия',
                    ),
                    value: snapshot.stage,
                  ),
                  _ReportRow(
                    label:
                        GameplayLocale.text(context, 'Engagement', 'Поручение'),
                    value: _engagementLabel(context, snapshot.engagementStatus),
                  ),
                  const SizedBox(height: 10),
                  Text(summary.headline, style: text.titleLarge),
                  const SizedBox(height: 6),
                  Text(summary.finalStatus, style: text.titleSmall),
                  const SizedBox(height: 12),
                  Text(summary.detail),
                  const SizedBox(height: 10),
                  Text(
                    '${GameplayLocale.text(context, 'Closed', 'Завершено')} '
                    '${summary.closedAt}',
                    style: text.bodySmall?.copyWith(
                      color: colors.onSurfaceVariant,
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 14),
            _ReportSection(
              title: GameplayLocale.text(
                context,
                'Financial result',
                'Финансовый результат',
              ),
              child: Column(
                children: <Widget>[
                  _ReportRow(
                    label: GameplayLocale.text(
                      context,
                      'Award / settlement',
                      'Присуждение / урегулирование',
                    ),
                    value: _eur(summary.awardEur),
                  ),
                  _ReportRow(
                    label: summary.awardEur == 0 && summary.costsEur > 0
                        ? GameplayLocale.text(
                            context,
                            'Adverse costs',
                            'Расходы в пользу другой стороны',
                          )
                        : GameplayLocale.text(
                            context,
                            'Costs awarded',
                            'Присуждённые расходы',
                          ),
                    value: _eur(summary.costsEur),
                  ),
                  _ReportRow(
                    label: GameplayLocale.text(
                      context,
                      'Legal spend',
                      'Юридические расходы',
                    ),
                    value: _eur(snapshot.spendEur),
                  ),
                  _ReportRow(
                    label: GameplayLocale.text(
                      context,
                      'Billable time',
                      'Учтённое время',
                    ),
                    value:
                        '${snapshot.billableHours.toStringAsFixed(1)}${GameplayLocale.of(context) == 'ru' ? 'ч' : 'h'}',
                  ),
                ],
              ),
            ),
            if (snapshot.caseResultStatus.isAdverse ||
                _isAdverseOutcome(summary)) ...<Widget>[
              const SizedBox(height: 14),
              _ReportSection(
                title: GameplayLocale.text(
                  context,
                  'Professional consequences',
                  'Профессиональные последствия',
                ),
                child: Column(
                  children: <Widget>[
                    _ReportRow(
                      label: GameplayLocale.text(
                        context,
                        'Professional standing',
                        'Профессиональная репутация',
                      ),
                      value: '${snapshot.ethics}/100',
                    ),
                    _ReportRow(
                      label: GameplayLocale.text(
                        context,
                        'Client trust',
                        'Доверие клиента',
                      ),
                      value: '${snapshot.clientTrust}/100',
                    ),
                    _ReportRow(
                      label: GameplayLocale.text(
                        context,
                        'Internal review',
                        'Внутренняя проверка',
                      ),
                      value: snapshot.ethics < 50 ||
                              summary.headline.contains('terminated')
                          ? GameplayLocale.text(
                              context,
                              'Required',
                              'Обязательна',
                            )
                          : GameplayLocale.text(
                              context,
                              'Recommended',
                              'Рекомендуется',
                            ),
                    ),
                    if (summary.headline.contains('terminated'))
                      _ReportRow(
                        label: GameplayLocale.text(
                          context,
                          'Potential fee write-off',
                          'Возможное списание гонорара',
                        ),
                        value: _eur(snapshot.spendEur),
                      ),
                  ],
                ),
              ),
            ],
            const SizedBox(height: 14),
            _ReportSection(
              title: GameplayLocale.text(
                context,
                'Performance',
                'Показатели',
              ),
              child: Column(
                children: <Widget>[
                  _ReportRow(
                    label: GameplayLocale.text(
                      context,
                      'Case strength',
                      'Сила позиции',
                    ),
                    value: '${snapshot.caseStrength}/100',
                  ),
                  _ReportRow(
                    label: GameplayLocale.text(
                      context,
                      'Merits',
                      'Обоснованность',
                    ),
                    value: '${snapshot.merits}/100',
                  ),
                  _ReportRow(
                    label: GameplayLocale.text(
                      context,
                      'Evidence',
                      'Доказательства',
                    ),
                    value: '${snapshot.evidenceScore}/100',
                  ),
                  _ReportRow(
                    label:
                        GameplayLocale.text(context, 'Procedure', 'Процедура'),
                    value: '${snapshot.procedure}/100',
                  ),
                  _ReportRow(
                    label: GameplayLocale.text(
                      context,
                      'Client trust',
                      'Доверие клиента',
                    ),
                    value: '${snapshot.clientTrust}/100',
                  ),
                  _ReportRow(
                    label: GameplayLocale.text(context, 'Ethics', 'Этика'),
                    value: '${snapshot.ethics}/100',
                  ),
                ],
              ),
            ),
            if (summary.keySuccesses.isNotEmpty) ...<Widget>[
              const SizedBox(height: 14),
              _ReportSection(
                title: GameplayLocale.text(
                  context,
                  'Key successes',
                  'Ключевые успехи',
                ),
                child: _ReportList(
                  entries: summary.keySuccesses,
                  icon: Icons.check_circle_outline,
                ),
              ),
            ],
            if (summary.missedOpportunities.isNotEmpty) ...<Widget>[
              const SizedBox(height: 14),
              _ReportSection(
                title: GameplayLocale.text(
                  context,
                  'Missed opportunities',
                  'Упущенные возможности',
                ),
                child: _ReportList(
                  entries: summary.missedOpportunities,
                  icon: Icons.warning_amber_outlined,
                ),
              ),
            ],
            const SizedBox(height: 22),
            OutlinedButton(
              onPressed: () => Navigator.pop(context),
              child: Text(
                GameplayLocale.text(context, 'Close', 'Закрыть'),
              ),
            ),
          ],
        ),
      ),
    );
  }

  static bool _isAdverseOutcome(CaseOutcomeSummaryView summary) {
    final String headline = summary.headline.toLowerCase();
    return headline.contains('dismissed') ||
        headline.contains('terminated') ||
        headline.contains('adverse');
  }

  static String _eur(int value) {
    final String digits = value.toString();
    final StringBuffer result = StringBuffer();
    for (int index = 0; index < digits.length; index += 1) {
      final int remaining = digits.length - index;
      result.write(digits[index]);
      if (remaining > 1 && remaining % 3 == 1) {
        result.write(',');
      }
    }
    return 'EUR $result';
  }
}

String _caseResultLabel(BuildContext context, CaseResultStatus status) {
  if (GameplayLocale.of(context) != 'ru') {
    return status.label;
  }
  return switch (status) {
    CaseResultStatus.ongoing => 'Рассмотрение продолжается',
    CaseResultStatus.wonAtFirstInstance => 'Победа в первой инстанции',
    CaseResultStatus.mixedAtFirstInstance =>
      'Смешанный результат первой инстанции',
    CaseResultStatus.lostAtFirstInstance => 'Поражение в первой инстанции',
    CaseResultStatus.wonOnAppeal => 'Победа в апелляции',
    CaseResultStatus.lostOnAppeal => 'Поражение в апелляции',
    CaseResultStatus.remittedAfterCassation =>
      'Направлено на новое рассмотрение',
    CaseResultStatus.settled => 'Урегулировано',
    CaseResultStatus.withdrawn => 'Отозвано',
  };
}

String? _judicialResultLabel(
  BuildContext context,
  JudicialResult? result,
) {
  if (result == null) {
    return null;
  }
  if (GameplayLocale.of(context) != 'ru') {
    return result.label;
  }
  return switch (result) {
    JudicialResult.won => 'Победа',
    JudicialResult.lost => 'Поражение',
    JudicialResult.partiallyWon => 'Частичная победа',
    JudicialResult.dismissed => 'Требования отклонены',
    JudicialResult.unknown => 'Неизвестное решение',
  };
}

String _judicialDecisionInstanceLabel(
  BuildContext context,
  JudicialDecisionInstance instance,
) {
  if (GameplayLocale.of(context) != 'ru') {
    return instance.label;
  }
  return switch (instance) {
    JudicialDecisionInstance.firstInstance => 'Первая инстанция',
    JudicialDecisionInstance.appeal => 'Апелляция',
    JudicialDecisionInstance.cassation => 'Кассация',
    JudicialDecisionInstance.unknown => 'Неизвестная судебная инстанция',
  };
}

String _matterLifecycleLabel(
  BuildContext context,
  MatterLifecycleStatus status,
) {
  if (GameplayLocale.of(context) != 'ru') {
    return status.label;
  }
  return switch (status) {
    MatterLifecycleStatus.active => 'Активно',
    MatterLifecycleStatus.postJudgment =>
      'После решения — доступны средства обжалования',
    MatterLifecycleStatus.appeal => 'Апелляция',
    MatterLifecycleStatus.cassation => 'Кассация',
    MatterLifecycleStatus.enforcement => 'Исполнение',
    MatterLifecycleStatus.closed => 'Закрыто',
    MatterLifecycleStatus.unknown => 'Неизвестный статус',
  };
}

String _engagementLabel(BuildContext context, EngagementStatus status) {
  if (GameplayLocale.of(context) != 'ru') {
    return status.label;
  }
  return switch (status) {
    EngagementStatus.active => 'Поручение активно',
    EngagementStatus.awaitingClientInstructions =>
      'Ожидаются инструкции клиента',
    EngagementStatus.terminatedByClient => 'Прекращено клиентом',
    EngagementStatus.completed => 'Поручение завершено',
  };
}

class _ReportSection extends StatelessWidget {
  const _ReportSection({required this.title, required this.child});

  final String title;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    final ColorScheme colors = Theme.of(context).colorScheme;
    return DecoratedBox(
      decoration: BoxDecoration(
        color: colors.surfaceContainerHigh,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: colors.outlineVariant),
      ),
      child: Padding(
        padding: const EdgeInsets.all(18),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: <Widget>[
            Text(title, style: Theme.of(context).textTheme.titleMedium),
            const SizedBox(height: 12),
            child,
          ],
        ),
      ),
    );
  }
}

class _ReportRow extends StatelessWidget {
  const _ReportRow({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        children: <Widget>[
          Expanded(child: Text(label)),
          const SizedBox(width: 12),
          Text(value, style: Theme.of(context).textTheme.titleSmall),
        ],
      ),
    );
  }
}

class _ReportList extends StatelessWidget {
  const _ReportList({required this.entries, required this.icon});

  final List<String> entries;
  final IconData icon;

  @override
  Widget build(BuildContext context) {
    return Column(
      children: entries
          .map(
            (String entry) => Padding(
              padding: const EdgeInsets.symmetric(vertical: 5),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: <Widget>[
                  Icon(icon, size: 19),
                  const SizedBox(width: 10),
                  Expanded(child: Text(entry)),
                ],
              ),
            ),
          )
          .toList(growable: false),
    );
  }
}
