import 'package:flutter/material.dart';

import '../models/game_snapshot.dart';

/// Bottom sheet that explains an action before execution.
///
/// Legal choices frequently carry hidden-looking consequences. The sheet makes
/// time, cost, and known risk visible before the player commits, while the
/// eventual Rust engine remains responsible for actual eligibility and effects.
class ActionPickerSheet extends StatelessWidget {
  const ActionPickerSheet({
    required this.actions,
    this.locale = 'en',
    super.key,
  });

  final List<GameActionView> actions;
  final String locale;

  String _text(String english, String russian) =>
      locale == 'ru' ? russian : english;

  @override
  Widget build(BuildContext context) {
    return DraggableScrollableSheet(
      expand: false,
      initialChildSize: 0.72,
      minChildSize: 0.42,
      maxChildSize: 0.94,
      builder: (BuildContext context, ScrollController controller) {
        return ListView(
          controller: controller,
          padding: const EdgeInsets.fromLTRB(20, 4, 20, 32),
          children: <Widget>[
            Text(_text('Available actions', 'Доступные действия'),
                style: Theme.of(context).textTheme.headlineSmall),
            const SizedBox(height: 6),
            Text(
              _text(
                'Every action advances the world. Review time, cost, and known risk before committing.',
                'Каждое действие двигает мир вперёд. Перед подтверждением проверьте время, стоимость и известный риск.',
              ),
              style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                    color: Theme.of(context).colorScheme.onSurfaceVariant,
                  ),
            ),
            const SizedBox(height: 18),
            ...actions.map(
              (GameActionView action) => Padding(
                padding: const EdgeInsets.only(bottom: 12),
                child: _ActionCard(action: action, locale: locale),
              ),
            ),
          ],
        );
      },
    );
  }
}

class _ActionCard extends StatelessWidget {
  const _ActionCard({required this.action, required this.locale});

  final GameActionView action;
  final String locale;

  String _text(String english, String russian) =>
      locale == 'ru' ? russian : english;

  @override
  Widget build(BuildContext context) {
    final ColorScheme colors = Theme.of(context).colorScheme;
    final Color accent = switch (action.tone) {
      ActionTone.primary => colors.primary,
      ActionTone.neutral => colors.secondary,
      ActionTone.warning => colors.tertiary,
      ActionTone.danger => colors.error,
    };

    return Card(
      child: InkWell(
        borderRadius: BorderRadius.circular(20),
        onTap: () => _confirm(context),
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: <Widget>[
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: <Widget>[
                  Icon(Icons.arrow_circle_right_outlined, color: accent),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Text(
                      action.title,
                      style: Theme.of(context).textTheme.titleMedium,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 10),
              Text(action.description),
              const SizedBox(height: 12),
              Wrap(
                spacing: 8,
                runSpacing: 8,
                children: <Widget>[
                  _InfoChip(icon: Icons.schedule, label: action.timeLabel),
                  _InfoChip(
                    icon: Icons.payments_outlined,
                    label: 'EUR ${_formatInt(action.costEur)}',
                  ),
                ],
              ),
              if (action.riskNote != null) ...<Widget>[
                const SizedBox(height: 12),
                Text(
                  action.riskNote!,
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(
                        color: colors.error,
                      ),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }

  Future<void> _confirm(BuildContext context) async {
    final bool? execute = await showDialog<bool>(
      context: context,
      builder: (BuildContext context) => AlertDialog(
        title: Text(action.title),
        content: Text(
          '${action.description}\n\n${_text('Time', 'Время')}: ${action.timeLabel}\n'
          '${_text('Cost', 'Стоимость')}: EUR ${_formatInt(action.costEur)}'
          '${action.riskNote == null ? '' : '\n\n${_text('Known risk', 'Известный риск')}: ${action.riskNote}'}',
        ),
        actions: <Widget>[
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: Text(_text('No', 'Нет')),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(context, true),
            child: Text(_text('Yes', 'Да')),
          ),
        ],
      ),
    );

    if (execute == true && context.mounted) {
      Navigator.pop(context, action.id);
    }
  }
}

class _InfoChip extends StatelessWidget {
  const _InfoChip({required this.icon, required this.label});

  final IconData icon;
  final String label;

  @override
  Widget build(BuildContext context) {
    return Chip(
      avatar: Icon(icon, size: 16),
      label: Text(label),
      visualDensity: VisualDensity.compact,
    );
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
