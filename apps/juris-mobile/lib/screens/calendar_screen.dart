import 'package:flutter/material.dart';

import '../app/gameplay_locale.dart';
import '../models/game_snapshot.dart';
import '../widgets/section_card.dart';
import '../widgets/status_badge.dart';

/// Deadline and workload screen.
class CalendarScreen extends StatelessWidget {
  const CalendarScreen({
    required this.snapshot,
    required this.onOpenRelatedAction,
    this.onRestUntilNextWorkday,
    this.onModalVisibilityChanged,
    super.key,
  });

  final GameSnapshot snapshot;

  /// Opens the standard action confirmation flow for a calendar-item action.
  ///
  /// The calendar never mutates state directly. It only identifies the related
  /// action; the repository remains responsible for validating and executing
  /// it, matching the authority boundary planned for the Rust bridge.
  final ValueChanged<String> onOpenRelatedAction;
  final VoidCallback? onRestUntilNextWorkday;
  final ValueChanged<bool>? onModalVisibilityChanged;

  @override
  Widget build(BuildContext context) {
    return ListView(
      key: const PageStorageKey<String>('calendar-scroll'),
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 120),
      children: <Widget>[
        SectionCard(
          title: GameplayLocale.text(
            context,
            'Workday capacity',
            'Ресурс рабочего дня',
          ),
          subtitle: GameplayLocale.text(
            context,
            'Rest recovers acute fatigue but only slowly reduces strain.',
            'Отдых снимает острую усталость, но медленно уменьшает накопленное напряжение.',
          ),
          child: Column(
            children: <Widget>[
              _ProgressRow(
                label: GameplayLocale.text(
                  context,
                  'Billable time',
                  'Учтённое время',
                ),
                value:
                    '${snapshot.billableHours.toStringAsFixed(1)} ${GameplayLocale.text(context, 'h total', 'ч всего')}',
                progress: (snapshot.billableHours / 9).clamp(0, 1),
              ),
              const SizedBox(height: 14),
              _ProgressRow(
                label: GameplayLocale.text(
                  context,
                  'Acute fatigue',
                  'Острая усталость',
                ),
                value: '${snapshot.fatigue}/100',
                progress: snapshot.fatigue / 100,
              ),
              const SizedBox(height: 14),
              _ProgressRow(
                label: GameplayLocale.text(
                  context,
                  'Cumulative strain',
                  'Накопленное напряжение',
                ),
                value: '${snapshot.cumulativeStrain}/100',
                progress: snapshot.cumulativeStrain / 100,
              ),
              if (onRestUntilNextWorkday != null) ...<Widget>[
                const SizedBox(height: 18),
                SizedBox(
                  width: double.infinity,
                  child: OutlinedButton.icon(
                    key: const ValueKey<String>('rest-until-next-workday'),
                    onPressed: onRestUntilNextWorkday,
                    icon: const Icon(Icons.bedtime_outlined),
                    label: Text(
                      GameplayLocale.text(
                        context,
                        'Rest until next workday · 08:00',
                        'Отдыхать до следующего рабочего дня · 08:00',
                      ),
                    ),
                  ),
                ),
              ],
            ],
          ),
        ),
        const SizedBox(height: 16),
        SectionCard(
          title: GameplayLocale.text(
            context,
            'Deadlines and hearings',
            'Сроки и слушания',
          ),
          subtitle: snapshot.deadlines.isEmpty
              ? GameplayLocale.text(
                  context,
                  'No deadlines or court events have been opened yet.',
                  'Сроки и судебные события ещё не открыты.',
                )
              : GameplayLocale.text(
                  context,
                  'Mandatory events continue while the player works or rests.',
                  'Обязательные события продолжаются во время работы и отдыха.',
                ),
          child: snapshot.deadlines.isEmpty
              ? const _EmptyCalendar()
              : Column(
                  children: snapshot.deadlines
                      .map(
                        (DeadlineView deadline) => _DeadlineRow(
                          deadline: deadline,
                          onTap: () async {
                            final String? primaryActionId =
                                _primaryActionFor(deadline);
                            final bool rescheduleActionAvailable =
                                deadline.rescheduleActionId != null &&
                                    snapshot.actions.any(
                                      (GameActionView action) =>
                                          action.id ==
                                          deadline.rescheduleActionId,
                                    );

                            onModalVisibilityChanged?.call(true);
                            final String? actionId;
                            try {
                              actionId = await _showDeadlineDetails(
                                context,
                                deadline,
                                primaryActionId: primaryActionId,
                                rescheduleActionAvailable:
                                    rescheduleActionAvailable,
                              );
                            } finally {
                              onModalVisibilityChanged?.call(false);
                            }
                            if (actionId != null) {
                              onOpenRelatedAction(actionId);
                            }
                          },
                        ),
                      )
                      .toList(growable: false),
                ),
        ),
      ],
    );
  }

  String? _primaryActionFor(DeadlineView item) {
    final String? directActionId = item.relatedActionId;
    if (directActionId != null &&
        snapshot.actions.any(
          (GameActionView action) => action.id == directActionId,
        )) {
      return directActionId;
    }

    // A hearing is not attendable before its scheduled time. The repository
    // exposes an explicit clock-advance action throughout the preparation
    // period, allowing the player to skip remaining optional work deliberately.
    if (item.isHearing &&
        item.status == DeadlineStatus.scheduled &&
        snapshot.actions.any(
          (GameActionView action) => action.id == 'wait-until-hearing',
        )) {
      return 'wait-until-hearing';
    }

    return null;
  }
}

class _ProgressRow extends StatelessWidget {
  const _ProgressRow({
    required this.label,
    required this.value,
    required this.progress,
  });

  final String label;
  final String value;
  final double progress;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: <Widget>[
        Row(
          children: <Widget>[
            Expanded(child: Text(label)),
            Text(value),
          ],
        ),
        const SizedBox(height: 8),
        LinearProgressIndicator(
          value: progress,
          borderRadius: BorderRadius.circular(999),
        ),
      ],
    );
  }
}

class _DeadlineRow extends StatelessWidget {
  const _DeadlineRow({
    required this.deadline,
    required this.onTap,
  });

  final DeadlineView deadline;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final IconData statusIcon = switch (deadline.status) {
      DeadlineStatus.open => Icons.radio_button_checked,
      DeadlineStatus.scheduled => Icons.account_balance_outlined,
      DeadlineStatus.rescheduled => Icons.event_repeat_outlined,
      DeadlineStatus.done => Icons.check_circle_outline,
      DeadlineStatus.missed => Icons.error_outline,
      DeadlineStatus.cancelled => Icons.event_busy_outlined,
    };

    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          key: ValueKey<String>('calendar-item-${deadline.id}'),
          onTap: onTap,
          borderRadius: BorderRadius.circular(14),
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 10),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: <Widget>[
                Padding(
                  padding: const EdgeInsets.only(top: 4),
                  child: Icon(statusIcon, size: 18),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: <Widget>[
                      Row(
                        children: <Widget>[
                          Expanded(
                            child: Text(
                              deadline.title,
                              style: Theme.of(context).textTheme.titleSmall,
                            ),
                          ),
                          StatusBadge.deadline(deadline.status),
                          const SizedBox(width: 4),
                          const Icon(Icons.chevron_right, size: 20),
                        ],
                      ),
                      const SizedBox(height: 4),
                      Text(deadline.dueAt),
                      if (deadline.rescheduleStatus !=
                          RescheduleRequestStatus.none) ...<Widget>[
                        const SizedBox(height: 4),
                        Text(
                          _rescheduleStatusLabel(deadline.rescheduleStatus),
                          style: Theme.of(context)
                              .textTheme
                              .labelMedium
                              ?.copyWith(
                                color: Theme.of(context).colorScheme.secondary,
                              ),
                        ),
                      ],
                      const SizedBox(height: 4),
                      Text(
                        deadline.detail,
                        style: Theme.of(context).textTheme.bodySmall?.copyWith(
                              color: Theme.of(context)
                                  .colorScheme
                                  .onSurfaceVariant,
                            ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

Future<String?> _showDeadlineDetails(
  BuildContext context,
  DeadlineView deadline, {
  required String? primaryActionId,
  required bool rescheduleActionAvailable,
}) {
  return showModalBottomSheet<String>(
    context: context,
    useSafeArea: true,
    isScrollControlled: true,
    showDragHandle: true,
    builder: (BuildContext context) {
      final ColorScheme colors = Theme.of(context).colorScheme;
      final bool isHearing = deadline.isHearing;
      return Padding(
        padding: const EdgeInsets.fromLTRB(24, 4, 24, 24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: <Widget>[
            Text(
              isHearing
                  ? GameplayLocale.text(
                      context,
                      'Hearing details',
                      'Сведения о слушании',
                    )
                  : GameplayLocale.text(
                      context,
                      'Deadline details',
                      'Сведения о сроке',
                    ),
              style: Theme.of(context).textTheme.labelLarge?.copyWith(
                    color: colors.primary,
                  ),
            ),
            const SizedBox(height: 8),
            Text(
              deadline.title,
              style: Theme.of(context).textTheme.headlineSmall,
            ),
            const SizedBox(height: 14),
            Row(
              children: <Widget>[
                StatusBadge.deadline(deadline.status),
                const SizedBox(width: 10),
                Expanded(
                  child: Text(
                    '${isHearing ? GameplayLocale.text(context, 'Scheduled', 'Назначено') : GameplayLocale.text(context, 'Due', 'Срок')} ${deadline.dueAt}',
                    style: Theme.of(context).textTheme.titleSmall,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 18),
            Text(deadline.detail),
            if (isHearing) ...<Widget>[
              const SizedBox(height: 14),
              Text(
                GameplayLocale.text(
                  context,
                  'Attendance remains mandatory unless the court grants a rescheduling request.',
                  'Явка остаётся обязательной, пока суд не удовлетворит ходатайство о переносе.',
                ),
                style: Theme.of(context).textTheme.bodySmall?.copyWith(
                      color: colors.onSurfaceVariant,
                    ),
              ),
            ],
            if (deadline.rescheduleStatus !=
                RescheduleRequestStatus.none) ...<Widget>[
              const SizedBox(height: 16),
              DecoratedBox(
                decoration: BoxDecoration(
                  color: colors.secondaryContainer.withValues(alpha: 0.45),
                  borderRadius: BorderRadius.circular(14),
                  border: Border.all(
                    color: colors.secondary.withValues(alpha: 0.30),
                  ),
                ),
                child: Padding(
                  padding: const EdgeInsets.all(14),
                  child: Text(
                    _rescheduleStatusExplanation(deadline),
                  ),
                ),
              ),
            ],
            if (deadline.status == DeadlineStatus.missed &&
                deadline.missedConsequence != null) ...<Widget>[
              const SizedBox(height: 14),
              Text(
                GameplayLocale.text(context, 'Consequence', 'Последствие'),
                style: Theme.of(context).textTheme.titleSmall?.copyWith(
                      color: colors.error,
                    ),
              ),
              const SizedBox(height: 6),
              Text(deadline.missedConsequence!),
            ],
            const SizedBox(height: 24),
            if (primaryActionId != null)
              FilledButton.icon(
                onPressed: () => Navigator.pop(context, primaryActionId),
                icon: Icon(
                  primaryActionId == 'wait-until-hearing'
                      ? Icons.schedule
                      : Icons.play_circle_outline,
                ),
                label: Text(
                  primaryActionId == 'wait-until-hearing'
                      ? GameplayLocale.text(
                          context,
                          'Advance clock to hearing',
                          'Перевести часы к слушанию',
                        )
                      : GameplayLocale.text(
                          context,
                          'Open related action',
                          'Открыть связанное действие',
                        ),
                ),
              ),
            if (rescheduleActionAvailable) ...<Widget>[
              if (primaryActionId != null) const SizedBox(height: 10),
              OutlinedButton.icon(
                onPressed: () => Navigator.pop(
                  context,
                  deadline.rescheduleActionId,
                ),
                icon: const Icon(Icons.event_repeat_outlined),
                label: Text(
                  GameplayLocale.text(
                    context,
                    'Request rescheduling',
                    'Запросить перенос',
                  ),
                ),
              ),
            ],
            if (primaryActionId == null && !rescheduleActionAvailable)
              OutlinedButton(
                onPressed: () => Navigator.pop(context),
                child: Text(
                  _closedButtonLabel(
                    deadline,
                    GameplayLocale.of(context) == 'ru',
                  ),
                ),
              )
            else
              TextButton(
                onPressed: () => Navigator.pop(context),
                child: Text(
                  GameplayLocale.text(context, 'Close', 'Закрыть'),
                ),
              ),
          ],
        ),
      );
    },
  );
}

String _closedButtonLabel(DeadlineView item, bool russian) {
  return switch (item.status) {
    DeadlineStatus.open =>
      russian ? 'Связанное действие недоступно' : 'Related action unavailable',
    DeadlineStatus.scheduled =>
      russian ? 'Действие пока недоступно' : 'No action available yet',
    DeadlineStatus.rescheduled => russian
        ? 'Заменено более поздним слушанием'
        : 'Replaced by a later hearing',
    DeadlineStatus.done => russian ? 'Выполнено' : 'Completed',
    DeadlineStatus.missed => russian ? 'Закрыть' : 'Close',
    DeadlineStatus.cancelled => russian ? 'Отменено' : 'Cancelled',
  };
}

String _rescheduleStatusLabel(RescheduleRequestStatus status) {
  return switch (status) {
    RescheduleRequestStatus.none => '',
    RescheduleRequestStatus.pending => 'Reschedule request pending',
    RescheduleRequestStatus.granted => 'Reschedule request granted',
    RescheduleRequestStatus.denied => 'Reschedule request denied',
    RescheduleRequestStatus.withdrawn => 'Reschedule request withdrawn',
  };
}

String _rescheduleStatusExplanation(DeadlineView hearing) {
  return switch (hearing.rescheduleStatus) {
    RescheduleRequestStatus.none => '',
    RescheduleRequestStatus.pending =>
      'The court has received the request. The original hearing at '
          '${hearing.dueAt} remains binding until a decision is issued.',
    RescheduleRequestStatus.granted => hearing.replacementItemId == null
        ? 'The court granted the request and will issue a replacement date.'
        : 'The court granted the request. A replacement hearing is listed '
            'separately in the Calendar.',
    RescheduleRequestStatus.denied =>
      'The court denied the request. The scheduled hearing remains binding.',
    RescheduleRequestStatus.withdrawn =>
      'The request was withdrawn. The scheduled hearing remains binding.',
  };
}

class _EmptyCalendar extends StatelessWidget {
  const _EmptyCalendar();

  @override
  Widget build(BuildContext context) {
    return const Padding(
      padding: EdgeInsets.symmetric(vertical: 20),
      child: Center(
        child: Column(
          children: <Widget>[
            Icon(Icons.event_available_outlined, size: 40),
            SizedBox(height: 10),
            Text('Complete intake to open professional deadlines.'),
          ],
        ),
      ),
    );
  }
}
