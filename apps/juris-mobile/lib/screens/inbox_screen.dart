import 'package:flutter/material.dart';

import '../models/game_snapshot.dart';
import '../widgets/section_card.dart';
import '../widgets/status_badge.dart';

/// Mobile inbox that treats messages as game state rather than narrative log.
///
/// Every message tile is tappable. Action-required items open a contextual
/// response flow, while resolved and informational items still open a readable
/// detail view. This mirrors familiar mail applications and removes the need
/// to find the global Actions button before answering a specific sender.
class InboxScreen extends StatelessWidget {
  const InboxScreen({
    required this.snapshot,
    required this.onMessageTap,
    super.key,
  });

  final GameSnapshot snapshot;
  final ValueChanged<InboxItemView> onMessageTap;

  @override
  Widget build(BuildContext context) {
    final List<InboxItemView> sorted = List<InboxItemView>.from(snapshot.inbox)
      ..sort((InboxItemView left, InboxItemView right) {
        final int leftPriority = _priority(left.status);
        final int rightPriority = _priority(right.status);
        return leftPriority.compareTo(rightPriority);
      });

    return CustomScrollView(
      key: const PageStorageKey<String>('inbox-scroll'),
      slivers: <Widget>[
        SliverPadding(
          padding: const EdgeInsets.fromLTRB(16, 12, 16, 120),
          sliver: SliverList.list(
            children: <Widget>[
              _InboxSummary(snapshot: snapshot),
              const SizedBox(height: 16),
              if (sorted.isEmpty)
                const SectionCard(
                  child: Text('The inbox is clear.'),
                )
              else
                ...sorted.map(
                  (InboxItemView item) => Padding(
                    padding: const EdgeInsets.only(bottom: 12),
                    child: _InboxMessageCard(
                      item: item,
                      onTap: () => onMessageTap(item),
                    ),
                  ),
                ),
            ],
          ),
        ),
      ],
    );
  }

  int _priority(InboxStatus status) {
    return switch (status) {
      InboxStatus.actionRequired => 0,
      InboxStatus.unread => 1,
      InboxStatus.resolved => 2,
      InboxStatus.archived => 3,
    };
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
                    snapshot.unhandledRequiredMessages == 1
                        ? '1 response requires attention'
                        : '${snapshot.unhandledRequiredMessages} responses require attention',
                    style: Theme.of(context).textTheme.titleMedium,
                  ),
                  const SizedBox(height: 4),
                  Text(
                    '${snapshot.matterTitle} · ${snapshot.mode} · seed ${snapshot.seed}',
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
      label: 'Open message from ${item.sender}: ${item.subject}',
      child: SectionCard(
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
