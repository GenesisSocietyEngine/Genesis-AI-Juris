import 'package:flutter/material.dart';

import '../app/gameplay_locale.dart';
import '../models/game_snapshot.dart';
import '../widgets/section_card.dart';
import '../widgets/status_badge.dart';

/// Mobile inbox that treats messages as game state rather than narrative log.
///
/// Messages are ordered newest-first, matching a conventional mail client.
/// Attention state remains visible through badges and the summary card without
/// moving old messages above newer procedural events.
class InboxScreen extends StatelessWidget {
  const InboxScreen({
    required this.snapshot,
    required this.onMessageTap,
    required this.onCaseReportTap,
    super.key,
  });

  final GameSnapshot snapshot;
  final ValueChanged<InboxItemView> onMessageTap;
  final VoidCallback onCaseReportTap;

  @override
  Widget build(BuildContext context) {
    final List<MapEntry<int, InboxItemView>> ordered =
        snapshot.inbox.asMap().entries.toList(growable: false)
          ..sort(
            (
              MapEntry<int, InboxItemView> left,
              MapEntry<int, InboxItemView> right,
            ) {
              final int momentComparison = _messageMoment(
                right.value.receivedAt,
              ).compareTo(_messageMoment(left.value.receivedAt));
              if (momentComparison != 0) {
                return momentComparison;
              }

              // Later insertions win when two world events share a timestamp.
              return right.key.compareTo(left.key);
            },
          );

    return CustomScrollView(
      key: const PageStorageKey<String>('inbox-scroll'),
      slivers: <Widget>[
        SliverPadding(
          padding: const EdgeInsets.fromLTRB(16, 12, 16, 120),
          sliver: SliverList.list(
            children: <Widget>[
              _InboxSummary(snapshot: snapshot),
              if (snapshot.outcomeSummary != null) ...<Widget>[
                const SizedBox(height: 16),
                _CaseClosedCard(
                  snapshot: snapshot,
                  summary: snapshot.outcomeSummary!,
                  onTap: onCaseReportTap,
                ),
              ],
              const SizedBox(height: 16),
              if (ordered.isEmpty)
                SectionCard(
                  child: Text(
                    GameplayLocale.text(
                      context,
                      'The inbox is clear.',
                      'Входящих сообщений нет.',
                    ),
                  ),
                )
              else
                ...ordered.map(
                  (MapEntry<int, InboxItemView> entry) => Padding(
                    padding: const EdgeInsets.only(bottom: 12),
                    child: _InboxMessageCard(
                      item: entry.value,
                      onTap: () => onMessageTap(entry.value),
                    ),
                  ),
                ),
            ],
          ),
        ),
      ],
    );
  }

  int _messageMoment(String label) {
    final RegExpMatch? match = RegExp(
      r'^(?:Day|День)\s+(\d+)\s+·\s+(\d{1,2}):(\d{2})$',
    ).firstMatch(label);
    if (match == null) {
      return 0;
    }

    final int day = int.tryParse(match.group(1) ?? '') ?? 0;
    final int hour = int.tryParse(match.group(2) ?? '') ?? 0;
    final int minute = int.tryParse(match.group(3) ?? '') ?? 0;
    return (day * 24 * 60) + (hour * 60) + minute;
  }
}

class _InboxSummary extends StatelessWidget {
  const _InboxSummary({required this.snapshot});

  final GameSnapshot snapshot;

  @override
  Widget build(BuildContext context) {
    final ColorScheme colors = Theme.of(context).colorScheme;
    return DecoratedBox(
      decoration: BoxDecoration(
        color: colors.primaryContainer.withValues(alpha: 0.55),
        borderRadius: BorderRadius.circular(24),
        border: Border.all(color: colors.primary.withValues(alpha: 0.35)),
      ),
      child: Padding(
        padding: const EdgeInsets.all(18),
        child: Row(
          children: <Widget>[
            CircleAvatar(
              radius: 24,
              backgroundColor: colors.primary,
              foregroundColor: colors.onPrimary,
              child: Text('${snapshot.unhandledRequiredMessages}'),
            ),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: <Widget>[
                  Text(
                    GameplayLocale.of(context) == 'ru'
                        ? _russianAttentionLabel(
                            snapshot.unhandledRequiredMessages,
                          )
                        : snapshot.unhandledRequiredMessages == 1
                            ? '1 response requires attention'
                            : '${snapshot.unhandledRequiredMessages} responses require attention',
                    style: Theme.of(context).textTheme.titleMedium,
                  ),
                  const SizedBox(height: 4),
                  Text(
                    '${snapshot.matterTitle} · ${snapshot.mode} · '
                    'seed ${snapshot.seed}',
                    style: Theme.of(context).textTheme.bodySmall?.copyWith(
                          color: colors.onSurfaceVariant,
                        ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _CaseClosedCard extends StatelessWidget {
  const _CaseClosedCard({
    required this.snapshot,
    required this.summary,
    required this.onTap,
  });

  final GameSnapshot snapshot;
  final CaseOutcomeSummaryView summary;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final ColorScheme colors = Theme.of(context).colorScheme;
    return Semantics(
      button: true,
      label: GameplayLocale.text(
        context,
        'Open final case report',
        'Открыть итоговый отчёт по делу',
      ),
      child: SectionCard(
        key: const ValueKey<String>('case-closed-card'),
        onTap: onTap,
        title: GameplayLocale.text(context, 'CASE CLOSED', 'ДЕЛО ЗАВЕРШЕНО'),
        subtitle: summary.closedAt,
        trailing: Icon(
          Icons.chevron_right,
          color: colors.onSurfaceVariant,
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: <Widget>[
            Text(
              summary.headline,
              style: Theme.of(context).textTheme.titleLarge,
            ),
            const SizedBox(height: 6),
            Text(summary.finalStatus),
            const SizedBox(height: 12),
            Text(
              '${GameplayLocale.text(context, 'Award / settlement', 'Присуждение / урегулирование')}: '
              'EUR ${_money(summary.awardEur)} · '
              '${GameplayLocale.text(context, 'Legal spend', 'Юридические расходы')}: '
              'EUR ${_money(snapshot.spendEur)}',
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    color: colors.onSurfaceVariant,
                  ),
            ),
            const SizedBox(height: 12),
            Text(
              GameplayLocale.text(
                context,
                'View case report',
                'Открыть отчёт по делу',
              ),
              style: Theme.of(context).textTheme.labelLarge?.copyWith(
                    color: colors.primary,
                  ),
            ),
          ],
        ),
      ),
    );
  }
}

class _InboxMessageCard extends StatelessWidget {
  const _InboxMessageCard({
    required this.item,
    required this.onTap,
  });

  final InboxItemView item;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final bool urgent = item.status == InboxStatus.actionRequired;
    final ColorScheme colors = Theme.of(context).colorScheme;

    return Semantics(
      button: true,
      label:
          '${GameplayLocale.text(context, 'Open message from', 'Открыть сообщение от')} '
          '${item.sender}: ${item.subject}',
      child: SectionCard(
        key: ValueKey<String>('inbox-item-${item.id}'),
        onTap: onTap,
        title: item.sender,
        subtitle: item.receivedAt,
        trailing: Row(
          mainAxisSize: MainAxisSize.min,
          children: <Widget>[
            StatusBadge.inbox(item.status),
            const SizedBox(width: 6),
            Icon(
              Icons.chevron_right,
              size: 20,
              color: colors.onSurfaceVariant,
            ),
          ],
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: <Widget>[
            Text(
              item.subject,
              style: Theme.of(context).textTheme.titleSmall?.copyWith(
                    color: urgent ? colors.primary : colors.onSurface,
                  ),
            ),
            const SizedBox(height: 8),
            Text(item.body),
          ],
        ),
      ),
    );
  }
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
  return value < 0 ? '-$result' : result.toString();
}

String _russianAttentionLabel(int count) {
  final int lastTwo = count % 100;
  final int last = count % 10;
  if (last == 1 && lastTwo != 11) {
    return '$count ответ требует внимания';
  }
  if (last >= 2 && last <= 4 && (lastTwo < 12 || lastTwo > 14)) {
    return '$count ответа требуют внимания';
  }
  return '$count ответов требуют внимания';
}
