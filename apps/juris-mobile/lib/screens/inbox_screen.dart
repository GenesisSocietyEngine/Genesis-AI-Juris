import 'package:flutter/material.dart';

import '../app/gameplay_locale.dart';
import '../models/game_snapshot.dart';
import '../presentation/inbox_presentation.dart';
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
    this.presentation,
    super.key,
  });

  final GameSnapshot snapshot;
  final ValueChanged<InboxItemView> onMessageTap;
  final VoidCallback onCaseReportTap;
  final InboxPresentation? presentation;

  @override
  Widget build(BuildContext context) {
    final InboxPresentation inbox =
        presentation ?? InboxPresentation.from(snapshot.inbox);

    return CustomScrollView(
      key: const PageStorageKey<String>('inbox-scroll'),
      slivers: <Widget>[
        SliverPadding(
          padding: const EdgeInsets.fromLTRB(16, 12, 16, 120),
          sliver: SliverList.list(
            children: <Widget>[
              _InboxSummary(
                snapshot: snapshot,
                attentionRequiredCount: inbox.attentionRequiredCount,
              ),
              if (snapshot.outcomeSummary != null) ...<Widget>[
                const SizedBox(height: 16),
                _CaseClosedCard(
                  snapshot: snapshot,
                  summary: snapshot.outcomeSummary!,
                  onTap: onCaseReportTap,
                ),
              ],
              const SizedBox(height: 16),
              if (inbox.displayedEntries.isEmpty)
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
                ...inbox.displayedEntries.map(
                  (DisplayedInboxEntry entry) => Padding(
                    padding: const EdgeInsets.only(bottom: 12),
                    child: _InboxMessageCard(
                      entry: entry,
                      onTap: () => onMessageTap(entry.item),
                    ),
                  ),
                ),
            ],
          ),
        ),
      ],
    );
  }

}

class _InboxSummary extends StatelessWidget {
  const _InboxSummary({
    required this.snapshot,
    required this.attentionRequiredCount,
  });

  final GameSnapshot snapshot;
  final int attentionRequiredCount;

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
              key: const ValueKey<String>('inbox-attention-summary-mark'),
              radius: 24,
              backgroundColor: attentionRequiredCount == 0
                  ? colors.surfaceContainerHighest
                  : colors.primary,
              foregroundColor: attentionRequiredCount == 0
                  ? colors.onSurfaceVariant
                  : colors.onPrimary,
              child: attentionRequiredCount == 0
                  ? const Icon(Icons.check_outlined)
                  : Text('$attentionRequiredCount'),
            ),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: <Widget>[
                  Text(
                    _attentionLabel(context, attentionRequiredCount),
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
    required this.entry,
    required this.onTap,
  });

  final DisplayedInboxEntry entry;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final InboxItemView item = entry.item;
    final bool urgent = entry.requiresAttention;
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
            StatusBadge.inbox(
              item.status,
              key: urgent
                  ? ValueKey<String>('inbox-attention-status-${item.id}')
                  : null,
            ),
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

String _attentionLabel(BuildContext context, int count) {
  if (count == 0) {
    return GameplayLocale.text(
      context,
      'No responses require attention',
      'Нет ответов, требующих внимания',
    );
  }
  if (GameplayLocale.of(context) == 'ru') {
    return _russianAttentionLabel(count);
  }
  return count == 1
      ? '1 response requires attention'
      : '$count responses require attention';
}
