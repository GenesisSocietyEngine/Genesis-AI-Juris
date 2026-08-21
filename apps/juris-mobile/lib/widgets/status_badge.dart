import 'package:flutter/material.dart';

import '../app/gameplay_locale.dart';
import '../design/juris_design.dart';
import '../models/game_snapshot.dart';

/// Small semantic status label used in inbox and deadline lists.
class StatusBadge extends StatelessWidget {
  const StatusBadge.inbox(this.status, {super.key}) : deadlineStatus = null;

  const StatusBadge.deadline(this.deadlineStatus, {super.key}) : status = null;

  final InboxStatus? status;
  final DeadlineStatus? deadlineStatus;

  @override
  Widget build(BuildContext context) {
    final _BadgeSpec spec = status != null
        ? _inboxSpec(context, status!)
        : _deadlineBadgeSpec(context, deadlineStatus!);
    final ThemeData theme = Theme.of(context);
    final JurisSpacing spacing =
        theme.extension<JurisSpacing>() ?? JurisSpacing.standard;
    final JurisRadii radii =
        theme.extension<JurisRadii>() ?? JurisRadii.standard;
    final JurisBorders borders =
        theme.extension<JurisBorders>() ?? JurisBorders.standardWeights;
    final JurisTypography typography =
        theme.extension<JurisTypography>() ?? JurisTypography.standard;

    return Semantics(
      label: spec.label,
      child: ExcludeSemantics(
        child: DecoratedBox(
          decoration: BoxDecoration(
            color: spec.background,
            borderRadius: BorderRadius.circular(
              status == null ? radii.pill : radii.small,
            ),
            border: Border.all(
              color: spec.foreground.withValues(
                alpha: status == null ? 0.35 : 0.45,
              ),
              width: borders.standard,
            ),
          ),
          child: Padding(
            padding: EdgeInsets.symmetric(
              horizontal: status == null ? 9 : spacing.sm,
              vertical: status == null ? 4 : spacing.xs,
            ),
            child: Text(
              spec.label,
              textAlign: TextAlign.center,
              style: (status == null
                      ? theme.textTheme.labelSmall
                      : typography.statusStamp)
                  ?.copyWith(
                color: spec.foreground,
                fontWeight: FontWeight.w600,
              ),
            ),
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
          inboxStatusLabel(context, value),
          colors.error,
          colors.errorContainer,
        );
      case InboxStatus.unread:
        return _BadgeSpec(
          inboxStatusLabel(context, value),
          colors.primary,
          colors.primaryContainer,
        );
      case InboxStatus.read:
        return _BadgeSpec(
          inboxStatusLabel(context, value),
          colors.onSurfaceVariant,
          colors.surfaceContainerHighest,
        );
      case InboxStatus.resolved:
        return _BadgeSpec(
          inboxStatusLabel(context, value),
          colors.tertiary,
          colors.tertiaryContainer,
        );
      case InboxStatus.archived:
        return _BadgeSpec(
          inboxStatusLabel(context, value),
          colors.onSurfaceVariant,
          colors.surfaceContainerHighest,
        );
    }
  }
}

String inboxStatusLabel(BuildContext context, InboxStatus value) {
  return switch (value) {
    InboxStatus.actionRequired => GameplayLocale.text(
        context,
        'ACTION REQUIRED',
        'ТРЕБУЕТСЯ ДЕЙСТВИЕ',
      ),
    InboxStatus.unread =>
      GameplayLocale.text(context, 'UNREAD', 'НЕ ПРОЧИТАНО'),
    InboxStatus.read => GameplayLocale.text(context, 'READ', 'ПРОЧИТАНО'),
    InboxStatus.resolved => GameplayLocale.text(context, 'RESOLVED', 'РЕШЕНО'),
    InboxStatus.archived =>
      GameplayLocale.text(context, 'ARCHIVED', 'В АРХИВЕ'),
  };
}

_BadgeSpec _deadlineBadgeSpec(BuildContext context, DeadlineStatus value) {
  final ColorScheme colors = Theme.of(context).colorScheme;
  switch (value) {
    case DeadlineStatus.open:
      return _BadgeSpec(
        GameplayLocale.text(context, 'OPEN', 'ОТКРЫТ'),
        colors.primary,
        colors.primaryContainer,
      );
    case DeadlineStatus.scheduled:
      return _BadgeSpec(
        GameplayLocale.text(context, 'SCHEDULED', 'НАЗНАЧЕН'),
        colors.primary,
        colors.primaryContainer,
      );
    case DeadlineStatus.rescheduled:
      return _BadgeSpec(
        GameplayLocale.text(context, 'RESCHEDULED', 'ПЕРЕНЕСЁН'),
        colors.tertiary,
        colors.tertiaryContainer,
      );
    case DeadlineStatus.done:
      return _BadgeSpec(
        GameplayLocale.text(context, 'DONE', 'ВЫПОЛНЕН'),
        colors.tertiary,
        colors.tertiaryContainer,
      );
    case DeadlineStatus.missed:
      return _BadgeSpec(
        GameplayLocale.text(context, 'MISSED', 'ПРОПУЩЕН'),
        colors.error,
        colors.errorContainer,
      );
    case DeadlineStatus.cancelled:
      return _BadgeSpec(
        GameplayLocale.text(context, 'CANCELLED', 'ОТМЕНЁН'),
        colors.onSurfaceVariant,
        colors.surfaceContainerHighest,
      );
  }
}

class _BadgeSpec {
  const _BadgeSpec(this.label, this.foreground, this.background);

  final String label;
  final Color foreground;
  final Color background;
}
