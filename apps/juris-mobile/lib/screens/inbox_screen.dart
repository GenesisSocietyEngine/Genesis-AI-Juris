import 'package:flutter/material.dart';

import '../app/gameplay_locale.dart';
import '../design/juris_design.dart';
import '../models/game_snapshot.dart';
import '../presentation/inbox_presentation.dart';
import '../widgets/juris_action_dock.dart';
import '../widgets/section_card.dart';
import '../widgets/status_badge.dart';

const double _representativeBodyFontSize = 16;
const double _largeTextLayoutThreshold = 1.3;

/// Mobile inbox that treats messages as game state rather than narrative log.
///
/// Messages are ordered newest-first as one institutional event ledger.
/// Attention state remains visible without moving an older message above a
/// newer procedural event.
class InboxScreen extends StatelessWidget {
  const InboxScreen({
    required this.snapshot,
    required this.onMessageTap,
    required this.onCaseReportTap,
    this.presentation,
    this.sessionClockLabel,
    this.onShowActions,
    super.key,
  });

  final GameSnapshot snapshot;
  final ValueChanged<InboxItemView> onMessageTap;
  final VoidCallback onCaseReportTap;
  final InboxPresentation? presentation;
  final String? sessionClockLabel;
  final VoidCallback? onShowActions;

  @override
  Widget build(BuildContext context) {
    final InboxPresentation inbox =
        presentation ?? InboxPresentation.from(snapshot.inbox);
    final ThemeData theme = Theme.of(context);
    final JurisSpacing spacing =
        theme.extension<JurisSpacing>() ?? JurisSpacing.standard;
    final Widget? actionDock = snapshot.actions.isEmpty || onShowActions == null
        ? null
        : JurisActionDock(
            eyebrow: GameplayLocale.text(
              context,
              'RESPONSE DESK',
              'ЦЕНТР ОТВЕТОВ',
            ),
            label: GameplayLocale.text(
              context,
              'Review available decisions',
              'Рассмотреть доступные решения',
            ),
            count: snapshot.actions.length,
            semanticLabel: GameplayLocale.text(
              context,
              'Available decisions: ${snapshot.actions.length}',
              'Доступно решений: ${snapshot.actions.length}',
            ),
            controlKey: const ValueKey<String>(
              'available-decisions-control',
            ),
            onPressed: onShowActions!,
          );

    final Widget ledger = CustomScrollView(
      key: const PageStorageKey<String>('inbox-scroll'),
      slivers: <Widget>[
        SliverPadding(
          padding: EdgeInsets.fromLTRB(
            spacing.compactGutter,
            spacing.md,
            spacing.compactGutter,
            0,
          ),
          sliver: SliverList.list(
            children: <Widget>[
              _InboxSummary(
                snapshot: snapshot,
                attentionRequiredCount: inbox.attentionRequiredCount,
                sessionClockLabel: sessionClockLabel,
              ),
              if (snapshot.outcomeSummary != null) ...<Widget>[
                SizedBox(height: spacing.lg),
                _CaseClosedCard(
                  snapshot: snapshot,
                  summary: snapshot.outcomeSummary!,
                  onTap: onCaseReportTap,
                ),
              ],
              SizedBox(height: spacing.md),
            ],
          ),
        ),
        if (inbox.displayedEntries.isEmpty)
          SliverPadding(
            padding: EdgeInsets.symmetric(horizontal: spacing.compactGutter),
            sliver: SliverToBoxAdapter(
              child: SectionCard(
                child: Text(
                  GameplayLocale.text(
                    context,
                    'The inbox is clear.',
                    'Входящих сообщений нет.',
                  ),
                ),
              ),
            ),
          )
        else
          SliverPadding(
            padding: EdgeInsets.symmetric(horizontal: spacing.compactGutter),
            sliver: SliverList(
              delegate: SliverChildBuilderDelegate(
                (BuildContext context, int index) {
                  final DisplayedInboxEntry entry =
                      inbox.displayedEntries[index];
                  return _InboxMessageCard(
                    entry: entry,
                    position: index + 1,
                    first: index == 0,
                    last: index == inbox.displayedEntries.length - 1,
                    onTap: () => onMessageTap(entry.item),
                  );
                },
                childCount: inbox.displayedEntries.length,
              ),
            ),
          ),
        SliverToBoxAdapter(
          child: SizedBox(height: spacing.lg),
        ),
      ],
    );
    if (actionDock == null) {
      return ledger;
    }
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: <Widget>[
        Expanded(child: ledger),
        SafeArea(
          top: false,
          child: Padding(
            padding: EdgeInsets.fromLTRB(
              spacing.compactGutter,
              spacing.xs,
              spacing.compactGutter,
              spacing.sm,
            ),
            child: actionDock,
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
    required this.sessionClockLabel,
  });

  final GameSnapshot snapshot;
  final int attentionRequiredCount;
  final String? sessionClockLabel;

  @override
  Widget build(BuildContext context) {
    final ThemeData theme = Theme.of(context);
    final JurisSpacing spacing =
        theme.extension<JurisSpacing>() ?? JurisSpacing.standard;
    final JurisTypography typography =
        theme.extension<JurisTypography>() ?? JurisTypography.standard;
    final JurisSurfaces surfaces = theme.extension<JurisSurfaces>() ??
        (theme.brightness == Brightness.light
            ? JurisSurfaces.office
            : JurisSurfaces.dark);
    final JurisBorders borders =
        theme.extension<JurisBorders>() ?? JurisBorders.standardWeights;
    final bool largeText = MediaQuery.textScalerOf(context).scale(1) > 1.3;
    final bool requiresAttention = attentionRequiredCount > 0;
    final Color stateColor =
        requiresAttention ? surfaces.danger : surfaces.success;
    final Widget mark = ExcludeSemantics(
      key: const ValueKey<String>('inbox-attention-summary-mark'),
      child: ConstrainedBox(
        constraints: const BoxConstraints(minWidth: 48, minHeight: 48),
        child: Align(
          alignment: AlignmentDirectional.centerEnd,
          child: requiresAttention
              ? Text(
                  '$attentionRequiredCount',
                  style: typography.documentTitle.copyWith(
                    color: stateColor,
                    fontWeight: FontWeight.w700,
                  ),
                )
              : Icon(
                  Icons.check_outlined,
                  color: stateColor,
                ),
        ),
      ),
    );
    return DecoratedBox(
      key: const ValueKey<String>('inbox-attention-ledger'),
      decoration: BoxDecoration(
        border: Border(
          left: BorderSide(color: stateColor, width: borders.emphasis),
          bottom: BorderSide(color: surfaces.rule, width: borders.standard),
        ),
      ),
      child: Padding(
        padding: EdgeInsets.fromLTRB(
          spacing.md,
          spacing.xs,
          spacing.xs,
          spacing.md,
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: <Widget>[
            Text(
              GameplayLocale.text(
                context,
                'INCOMING CASE RECORD',
                'ВХОДЯЩИЙ РЕЕСТР ДЕЛА',
              ),
              style: typography.statusStamp.copyWith(
                color: surfaces.brass,
                letterSpacing: 0.7,
              ),
            ),
            SizedBox(height: spacing.xs),
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: <Widget>[
                Expanded(
                  child: Text(
                    GameplayLocale.text(context, 'Inbox', 'Входящие'),
                    style: largeText
                        ? typography.documentTitle
                        : typography.sectionTitle,
                  ),
                ),
                SizedBox(width: spacing.sm),
                mark,
              ],
            ),
            SizedBox(height: spacing.xs),
            Text(
              _attentionLabel(context, attentionRequiredCount),
              style: typography.controlLabel.copyWith(
                color: requiresAttention ? surfaces.danger : surfaces.ink,
                fontWeight: FontWeight.w700,
              ),
            ),
            SizedBox(height: spacing.sm),
            Text(
              '${snapshot.matterTitle} · ${snapshot.dayLabel} · '
              '${snapshot.timeLabel} · ${snapshot.stage}',
              style: typography.bodyCompact.copyWith(
                color: surfaces.mutedInk,
                fontWeight: FontWeight.w600,
              ),
            ),
            if (sessionClockLabel != null) ...<Widget>[
              SizedBox(height: spacing.xs),
              Text(
                sessionClockLabel!,
                style: typography.timestamp.copyWith(
                  color: surfaces.mutedInk,
                ),
              ),
            ],
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
    required this.position,
    required this.first,
    required this.last,
    required this.onTap,
  });

  final DisplayedInboxEntry entry;
  final int position;
  final bool first;
  final bool last;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final InboxItemView item = entry.item;
    final bool urgent = entry.requiresAttention;
    final ThemeData theme = Theme.of(context);
    final JurisSpacing spacing =
        theme.extension<JurisSpacing>() ?? JurisSpacing.standard;
    final JurisDensity density =
        theme.extension<JurisDensity>() ?? JurisDensity.standard;
    final JurisTypography typography =
        theme.extension<JurisTypography>() ?? JurisTypography.standard;
    final JurisSurfaces surfaces = theme.extension<JurisSurfaces>() ??
        (theme.brightness == Brightness.light
            ? JurisSurfaces.office
            : JurisSurfaces.dark);
    final JurisBorders borders =
        theme.extension<JurisBorders>() ?? JurisBorders.standardWeights;
    final JurisDensityMetrics metrics =
        density.resolve(JurisDensityMode.compact);
    final BorderSide rule = BorderSide(
      color: surfaces.rule,
      width: borders.standard,
    );
    final BorderSide marginalRule = BorderSide(
      color: urgent ? surfaces.danger : surfaces.brass,
      width: urgent ? borders.emphasis : borders.standard,
    );

    return MergeSemantics(
      child: Semantics(
        key: ValueKey<String>('inbox-item-semantics-${item.id}'),
        button: true,
        hint: GameplayLocale.text(
          context,
          'Open message',
          'Открыть сообщение',
        ),
        child: DecoratedBox(
          decoration: BoxDecoration(
            color: first ? surfaces.elevatedSurface : surfaces.baseSurface,
            border: Border(
              left: marginalRule,
              top: first ? rule : BorderSide.none,
              right: first ? rule : BorderSide.none,
              bottom: BorderSide(
                color: surfaces.rule,
                width: last ? borders.emphasis : borders.standard,
              ),
            ),
          ),
          child: Material(
            key: ValueKey<String>('inbox-item-${item.id}'),
            color: Colors.transparent,
            child: InkWell(
              onTap: onTap,
              onFocusChange: (bool focused) {
                if (!focused) {
                  return;
                }
                WidgetsBinding.instance.addPostFrameCallback((_) {
                  if (context.mounted) {
                    Scrollable.ensureVisible(
                      context,
                      alignment: 0.5,
                      duration: Duration.zero,
                    );
                  }
                });
              },
              child: Builder(
                builder: (BuildContext focusContext) => _InboxFocusOutline(
                  key: ValueKey<String>('inbox-item-focus-${item.id}'),
                  focused: Focus.of(focusContext).hasFocus,
                  child: ConstrainedBox(
                    constraints: BoxConstraints(
                      minHeight: (theme.extension<JurisTargets>() ??
                              JurisTargets.accessible)
                          .minimumInteractiveExtent,
                    ),
                    child: Padding(
                      padding: EdgeInsets.all(metrics.contentInset),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: <Widget>[
                          LayoutBuilder(
                            builder: (
                              BuildContext context,
                              BoxConstraints constraints,
                            ) {
                              final double textScale = MediaQuery.textScalerOf(
                                    context,
                                  ).scale(_representativeBodyFontSize) /
                                  _representativeBodyFontSize;
                              final Widget metadata = Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: <Widget>[
                                  Text(
                                    '${GameplayLocale.text(context, 'RECORD', 'ЗАПИСЬ')} '
                                    '${position.toString().padLeft(2, '0')}',
                                    style: typography.statusStamp.copyWith(
                                      color: urgent
                                          ? surfaces.danger
                                          : surfaces.brass,
                                      letterSpacing: 0.5,
                                    ),
                                  ),
                                  SizedBox(height: spacing.xs),
                                  Text(
                                    item.sender,
                                    style: typography.bodyCompact.copyWith(
                                      color: surfaces.ink,
                                      fontWeight: FontWeight.w600,
                                    ),
                                  ),
                                  SizedBox(height: spacing.hairline),
                                  Text(
                                    item.receivedAt,
                                    style: typography.timestamp.copyWith(
                                      color: surfaces.mutedInk,
                                    ),
                                  ),
                                ],
                              );
                              final Widget status = StatusBadge.inbox(
                                item.status,
                                key: urgent
                                    ? ValueKey<String>(
                                        'inbox-attention-status-${item.id}',
                                      )
                                    : null,
                              );
                              if (textScale > _largeTextLayoutThreshold ||
                                  constraints.maxWidth < 420) {
                                return Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: <Widget>[
                                    metadata,
                                    SizedBox(height: spacing.sm),
                                    status,
                                  ],
                                );
                              }
                              return Row(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: <Widget>[
                                  Expanded(child: metadata),
                                  SizedBox(width: spacing.md),
                                  status,
                                ],
                              );
                            },
                          ),
                          SizedBox(height: spacing.md),
                          Text(
                            item.subject,
                            style: typography.documentTitle.copyWith(
                              color: urgent ? surfaces.danger : surfaces.ink,
                            ),
                          ),
                          SizedBox(height: spacing.sm),
                          Text(
                            item.body,
                            maxLines: first ? 3 : 2,
                            overflow: TextOverflow.ellipsis,
                            style: typography.bodyCompact.copyWith(
                              color: surfaces.mutedInk,
                            ),
                          ),
                          SizedBox(height: spacing.sm),
                          Align(
                            alignment: AlignmentDirectional.centerEnd,
                            child: Row(
                              mainAxisAlignment: MainAxisAlignment.end,
                              children: <Widget>[
                                Flexible(
                                  child: Text(
                                    GameplayLocale.text(
                                      context,
                                      'Open record',
                                      'Открыть запись',
                                    ),
                                    textAlign: TextAlign.end,
                                    style: typography.controlLabel.copyWith(
                                      color: surfaces.cyan,
                                    ),
                                  ),
                                ),
                                SizedBox(width: spacing.xs),
                                Icon(
                                  Icons.arrow_forward,
                                  size: 18,
                                  color: surfaces.cyan,
                                ),
                              ],
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _InboxFocusOutline extends StatelessWidget {
  const _InboxFocusOutline({
    required this.focused,
    required this.child,
    super.key,
  });

  final bool focused;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    final ThemeData theme = Theme.of(context);
    if (theme.extension<JurisSurfaces>() != null &&
        theme.extension<JurisBorders>() != null &&
        theme.extension<JurisRadii>() != null &&
        theme.extension<JurisMotion>() != null) {
      return JurisFocusOutline(focused: focused, child: child);
    }
    return AnimatedContainer(
      duration: Duration.zero,
      decoration: BoxDecoration(
        border: Border.all(
          color: focused ? theme.colorScheme.primary : Colors.transparent,
          width: 2,
        ),
        borderRadius: BorderRadius.circular(12),
      ),
      child: child,
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
