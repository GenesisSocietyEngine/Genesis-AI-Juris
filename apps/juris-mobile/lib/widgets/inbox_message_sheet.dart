import 'package:flutter/material.dart';

import '../models/game_snapshot.dart';
import 'status_badge.dart';

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
    final ColorScheme colors = Theme.of(context).colorScheme;

    return DraggableScrollableSheet(
      initialChildSize: settlementOffer != null
          ? 0.86
          : actions.isEmpty
              ? 0.56
              : 0.72,
      minChildSize: 0.45,
      maxChildSize: 0.92,
      expand: false,
      builder: (BuildContext context, ScrollController controller) {
        return Column(
          children: <Widget>[
            Expanded(
              child: ListView(
                controller: controller,
                padding: const EdgeInsets.fromLTRB(20, 4, 20, 16),
                children: <Widget>[
                  Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: <Widget>[
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: <Widget>[
                            Text(
                              item.sender,
                              style: Theme.of(context).textTheme.headlineSmall,
                            ),
                            const SizedBox(height: 4),
                            Text(
                              item.receivedAt,
                              style: Theme.of(context)
                                  .textTheme
                                  .bodySmall
                                  ?.copyWith(
                                    color: colors.onSurfaceVariant,
                                  ),
                            ),
                          ],
                        ),
                      ),
                      StatusBadge.inbox(item.status),
                    ],
                  ),
                  const SizedBox(height: 20),
                  Text(
                    item.subject,
                    style: Theme.of(context).textTheme.titleLarge,
                  ),
                  const SizedBox(height: 12),
                  Text(
                    item.body,
                    style: Theme.of(context).textTheme.bodyLarge,
                  ),
                  if (settlementOffer != null) ...<Widget>[
                    const SizedBox(height: 18),
                    DecoratedBox(
                      decoration: BoxDecoration(
                        color: colors.primaryContainer.withValues(alpha: 0.45),
                        borderRadius: BorderRadius.circular(18),
                        border: Border.all(
                          color: colors.primary.withValues(alpha: 0.35),
                        ),
                      ),
                      child: Padding(
                        padding: const EdgeInsets.all(16),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: <Widget>[
                            Text(
                              'Offer EUR ${_formatInt(settlementOffer!.amountEur)}',
                              style: Theme.of(context).textTheme.titleMedium,
                            ),
                            const SizedBox(height: 4),
                            Text(
                              'Revision ${settlementOffer!.revision} · '
                              'expires ${settlementOffer!.expiresAt}',
                            ),
                          ],
                        ),
                      ),
                    ),
                  ],
                ],
              ),
            ),

            // Response controls remain visible while the message content scrolls.
            SafeArea(
              top: false,
              child: DecoratedBox(
                decoration: BoxDecoration(
                  color: colors.surface,
                  border: Border(
                    top: BorderSide(color: colors.outlineVariant),
                  ),
                ),
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(20, 14, 20, 12),
                  child: actions.isEmpty
                      ? SizedBox(
                          width: double.infinity,
                          child: OutlinedButton(
                            onPressed: () => Navigator.pop(context),
                            child: const Text('Close'),
                          ),
                        )
                      : Column(
                          mainAxisSize: MainAxisSize.min,
                          crossAxisAlignment: CrossAxisAlignment.stretch,
                          children: <Widget>[
                            Text(
                              item.status == InboxStatus.actionRequired
                                  ? 'Your response'
                                  : 'Available actions',
                              style: Theme.of(context).textTheme.titleMedium,
                            ),
                            const SizedBox(height: 10),
                            ...actions.map(
                              (GameActionView action) => Padding(
                                padding: const EdgeInsets.only(bottom: 8),
                                child: _ResponseButton(
                                  action: action,
                                  settlementOffer: settlementOffer,
                                ),
                              ),
                            ),
                            TextButton(
                              onPressed: () => Navigator.pop(context),
                              child: const Text('Not now'),
                            ),
                          ],
                        ),
                ),
              ),
            ),
          ],
        );
      },
    );
  }
}

class _ResponseButton extends StatelessWidget {
  const _ResponseButton({
    required this.action,
    required this.settlementOffer,
  });

  final GameActionView action;
  final SettlementOfferView? settlementOffer;

  @override
  Widget build(BuildContext context) {
    final bool isYes = action.id == 'future-settle';
    final bool isNo = action.id == 'reject-settlement';
    final String label = switch (action.id) {
      'future-settle' => settlementOffer == null
          ? 'Yes — accept the offer'
          : 'Yes — accept EUR ${_formatInt(settlementOffer!.amountEur)}',
      'reject-settlement' => 'No — reject the offer',
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
        title: Text(action.title),
        content: Text(
          'Response: $responseLabel\n\n${action.description}'
          '\n\nTime: ${action.timeLabel}'
          '\nCost: EUR ${_formatInt(action.costEur)}'
          '${action.riskNote == null ? '' : '\n\nKnown risk: ${action.riskNote}'}',
        ),
        actions: <Widget>[
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('No'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(context, true),
            child: const Text('Yes'),
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
