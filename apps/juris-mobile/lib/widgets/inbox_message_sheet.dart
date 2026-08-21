import 'package:flutter/material.dart';

import '../app/gameplay_locale.dart';
import '../design/juris_design.dart';
import '../models/game_snapshot.dart';
import 'status_badge.dart';

const double _representativeBodyFontSize = 16;
const double _largeTextLayoutThreshold = 1.3;

/// Contextual message detail and response sheet.
///
/// The global action picker remains useful for strategic work. This sheet is
/// different: it begins from one concrete message and exposes only responses
/// that are relevant to that message. A settlement offer therefore has an
/// explicit Yes/No decision instead of forcing the player to infer that
/// dismissing a generic confirmation means rejecting the offer.
class InboxMessageSheet extends StatelessWidget {
  const InboxMessageSheet({
    required this.item,
    required this.actions,
    this.settlementOffer,
    super.key,
  });

  final InboxItemView item;
  final List<GameActionView> actions;
  final SettlementOfferView? settlementOffer;

  @override
  Widget build(BuildContext context) {
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
    final JurisRadii radii =
        theme.extension<JurisRadii>() ?? JurisRadii.standard;
    final JurisBorders borders =
        theme.extension<JurisBorders>() ?? JurisBorders.standardWeights;
    final JurisDensityMetrics metrics =
        density.resolve(JurisDensityMode.compact);
    final double textScale =
        MediaQuery.textScalerOf(context).scale(_representativeBodyFontSize) /
            _representativeBodyFontSize;
    final bool prefersExpandedViewport = textScale > _largeTextLayoutThreshold;
    final double sheetHeightFactor = prefersExpandedViewport
        ? 0.92
        : settlementOffer != null
            ? 0.86
            : actions.isEmpty
                ? 0.56
                : 0.72;

    return FractionallySizedBox(
      key: const ValueKey<String>('inbox-message-sheet'),
      heightFactor: sheetHeightFactor,
      alignment: Alignment.bottomCenter,
      child: SafeArea(
        top: false,
        child: SingleChildScrollView(
          key: const ValueKey<String>('inbox-message-scroll'),
          padding: EdgeInsets.fromLTRB(
            metrics.contentInset,
            spacing.xs,
            metrics.contentInset,
            spacing.lg,
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: <Widget>[
              LayoutBuilder(
                builder: (BuildContext context, BoxConstraints constraints) {
                  final Widget metadata = Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: <Widget>[
                      Text(item.sender, style: typography.documentTitle),
                      SizedBox(height: spacing.xs),
                      Text(
                        item.receivedAt,
                        style: typography.timestamp.copyWith(
                          color: surfaces.mutedInk,
                        ),
                      ),
                    ],
                  );
                  final Widget status = StatusBadge.inbox(item.status);
                  if (prefersExpandedViewport || constraints.maxWidth < 420) {
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
              SizedBox(height: spacing.xl),
              Semantics(
                key: const ValueKey<String>('inbox-message-subject'),
                header: true,
                child: Text(item.subject, style: typography.sectionTitle),
              ),
              SizedBox(height: spacing.md),
              Text(item.body, style: typography.bodyReading),
              if (settlementOffer != null) ...<Widget>[
                SizedBox(height: spacing.lg),
                DecoratedBox(
                  decoration: BoxDecoration(
                    color: surfaces.elevatedSurface,
                    borderRadius: BorderRadius.circular(radii.medium),
                    border: Border.all(
                      color: surfaces.rule,
                      width: borders.standard,
                    ),
                  ),
                  child: Padding(
                    padding: EdgeInsets.all(metrics.contentInset),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: <Widget>[
                        Text(
                          '${GameplayLocale.text(context, 'Offer', 'Предложение')} '
                          'EUR ${_formatInt(settlementOffer!.amountEur)}',
                          style: typography.documentTitle,
                        ),
                        SizedBox(height: spacing.xs),
                        Text(
                          '${GameplayLocale.text(context, 'Revision', 'Редакция')} '
                          '${settlementOffer!.revision} · '
                          '${GameplayLocale.text(context, 'expires', 'истекает')} '
                          '${settlementOffer!.expiresAt}',
                          style: typography.bodyCompact.copyWith(
                            color: surfaces.mutedInk,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ],
              SizedBox(height: spacing.xl),
              Divider(color: surfaces.rule),
              SizedBox(height: spacing.md),
              if (actions.isEmpty)
                OutlinedButton(
                  key: const ValueKey<String>('inbox-message-close'),
                  onPressed: () => Navigator.pop(context),
                  child: Text(
                    GameplayLocale.text(context, 'Close', 'Закрыть'),
                  ),
                )
              else ...<Widget>[
                Text(
                  item.status == InboxStatus.actionRequired
                      ? GameplayLocale.text(
                          context,
                          'Your response',
                          'Ваш ответ',
                        )
                      : GameplayLocale.text(
                          context,
                          'Available actions',
                          'Доступные действия',
                        ),
                  style: typography.documentTitle,
                ),
                SizedBox(height: spacing.md),
                ...actions.map(
                  (GameActionView action) => Padding(
                    padding: EdgeInsets.only(bottom: spacing.sm),
                    child: _ResponseButton(
                      key: ValueKey<String>('inbox-response-${action.id}'),
                      action: action,
                      settlementOffer: settlementOffer,
                    ),
                  ),
                ),
                TextButton(
                  key: const ValueKey<String>('inbox-message-not-now'),
                  onPressed: () => Navigator.pop(context),
                  child: Text(
                    GameplayLocale.text(context, 'Not now', 'Не сейчас'),
                  ),
                ),
              ],
              SizedBox(height: spacing.lg),
            ],
          ),
        ),
      ),
    );
  }
}

class _ResponseButton extends StatelessWidget {
  const _ResponseButton({
    required this.action,
    required this.settlementOffer,
    super.key,
  });

  final GameActionView action;
  final SettlementOfferView? settlementOffer;

  @override
  Widget build(BuildContext context) {
    final bool isYes = action.id == 'future-settle';
    final bool isNo = action.id == 'reject-settlement';
    final String label = switch (action.id) {
      'future-settle' => settlementOffer == null
          ? GameplayLocale.text(
              context,
              'Yes — accept the offer',
              'Да — принять предложение',
            )
          : '${GameplayLocale.text(context, 'Yes — accept', 'Да — принять')} '
              'EUR ${_formatInt(settlementOffer!.amountEur)}',
      'reject-settlement' => GameplayLocale.text(
          context,
          'No — reject the offer',
          'Нет — отклонить предложение',
        ),
      _ => action.title,
    };

    final ButtonStyle? dangerStyle = isNo
        ? OutlinedButton.styleFrom(
            foregroundColor: Theme.of(context).colorScheme.error,
          )
        : null;

    if (isYes) {
      return FilledButton.icon(
        onPressed: () => _confirm(context, label),
        icon: const Icon(Icons.check_circle_outline),
        label: Text(label),
      );
    }

    if (isNo) {
      return OutlinedButton.icon(
        style: dangerStyle,
        onPressed: () => _confirm(context, label),
        icon: const Icon(Icons.cancel_outlined),
        label: Text(label),
      );
    }

    return FilledButton.tonalIcon(
      onPressed: () => _confirm(context, label),
      icon: const Icon(Icons.reply_outlined),
      label: Text(label),
    );
  }

  Future<void> _confirm(BuildContext context, String responseLabel) async {
    final bool? confirmed = await showDialog<bool>(
      context: context,
      builder: (BuildContext context) => AlertDialog(
        key: ValueKey<String>('inbox-confirmation-${action.id}'),
        scrollable: true,
        title: Text(action.title),
        content: Text(
          '${GameplayLocale.text(context, 'Response', 'Ответ')}: '
          '$responseLabel\n\n${action.description}'
          '\n\n${GameplayLocale.text(context, 'Time', 'Время')}: ${action.timeLabel}'
          '\n${GameplayLocale.text(context, 'Cost', 'Стоимость')}: '
          'EUR ${_formatInt(action.costEur)}'
          '${action.riskNote == null ? '' : '\n\n${GameplayLocale.text(context, 'Known risk', 'Известный риск')}: ${action.riskNote}'}',
        ),
        actions: <Widget>[
          TextButton(
            key: ValueKey<String>('inbox-confirm-no-${action.id}'),
            onPressed: () => Navigator.pop(context, false),
            child: Text(GameplayLocale.text(context, 'No', 'Нет')),
          ),
          FilledButton(
            key: ValueKey<String>('inbox-confirm-yes-${action.id}'),
            onPressed: () => Navigator.pop(context, true),
            child: Text(GameplayLocale.text(context, 'Yes', 'Да')),
          ),
        ],
      ),
    );

    if (confirmed == true && context.mounted) {
      Navigator.pop(context, action.id);
    }
  }
}

String _formatInt(int value) {
  final String digits = value.abs().toString();
  final StringBuffer result = StringBuffer();
  for (int i = 0; i < digits.length; i += 1) {
    if (i > 0 && (digits.length - i) % 3 == 0) {
      result.write(',');
    }
    result.write(digits[i]);
  }
  return value < 0 ? '-$result' : result.toString();
}
