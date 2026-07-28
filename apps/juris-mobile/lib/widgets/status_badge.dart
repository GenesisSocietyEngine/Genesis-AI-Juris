import 'package:flutter/material.dart';

import '../models/game_snapshot.dart';

/// Small semantic status label used in inbox and deadline lists.
class StatusBadge extends StatelessWidget {
  const StatusBadge.inbox(this.status, {super.key}) : deadlineStatus = null;

  const StatusBadge.deadline(this.deadlineStatus, {super.key}) : status = null;

  final InboxStatus? status;
  final DeadlineStatus? deadlineStatus;

  @override
  Widget build(BuildContext context) {
    // Read informational messages intentionally show no pill. The absence of
    // the badge is the familiar mail-app signal that the message has already
    // been opened, while action-required and resolved states remain explicit.
    if (status == InboxStatus.read) {
      return const SizedBox.shrink();
    }

    final _BadgeSpec spec = status != null
        ? _inboxSpec(context, status!)
        : _deadlineSpec(context, deadlineStatus!);

    return DecoratedBox(
      decoration: BoxDecoration(
        color: spec.background,
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: spec.foreground.withValues(alpha: 0.35)),
      ),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 4),
        child: Text(
          spec.label,
          style: Theme.of(context).textTheme.labelSmall?.copyWith(
                color: spec.foreground,
                fontWeight: FontWeight.w600,
              ),
        ),
      ),
    );
  }

  _BadgeSpec _inboxSpec(BuildContext context, InboxStatus value) {
    final ColorScheme colors = Theme.of(context).colorScheme;
    switch (value) {
      case InboxStatus.actionRequired:
        return _BadgeSpec(
            'ACTION REQUIRED', colors.error, colors.errorContainer);
      case InboxStatus.unread:
        return _BadgeSpec('UNREAD', colors.primary, colors.primaryContainer);
      case InboxStatus.read:
        // Handled by the early return in build().
        return _BadgeSpec(
          'READ',
          colors.onSurfaceVariant,
          colors.surfaceContainerHighest,
        );
      case InboxStatus.resolved:
        return _BadgeSpec(
            'RESOLVED', colors.tertiary, colors.tertiaryContainer);
      case InboxStatus.archived:
        return _BadgeSpec(
          'ARCHIVED',
          colors.onSurfaceVariant,
          colors.surfaceContainerHighest,
        );
    }
  }

  _BadgeSpec _deadlineSpec(BuildContext context, DeadlineStatus value) {
    final ColorScheme colors = Theme.of(context).colorScheme;
    switch (value) {
      case DeadlineStatus.open:
        return _BadgeSpec('OPEN', colors.primary, colors.primaryContainer);
      case DeadlineStatus.scheduled:
        return _BadgeSpec(
          'SCHEDULED',
          colors.primary,
          colors.primaryContainer,
        );
      case DeadlineStatus.rescheduled:
        return _BadgeSpec(
          'RESCHEDULED',
          colors.tertiary,
          colors.tertiaryContainer,
        );
      case DeadlineStatus.done:
        return _BadgeSpec('DONE', colors.tertiary, colors.tertiaryContainer);
      case DeadlineStatus.missed:
        return _BadgeSpec('MISSED', colors.error, colors.errorContainer);
      case DeadlineStatus.cancelled:
        return _BadgeSpec(
          'CANCELLED',
          colors.onSurfaceVariant,
          colors.surfaceContainerHighest,
        );
    }
  }
}

class _BadgeSpec {
  const _BadgeSpec(this.label, this.foreground, this.background);

  final String label;
  final Color foreground;
  final Color background;
}
