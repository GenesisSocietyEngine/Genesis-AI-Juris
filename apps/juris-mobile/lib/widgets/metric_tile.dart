import 'package:flutter/material.dart';

/// Compact dashboard metric that stays legible on narrow phones.
class MetricTile extends StatelessWidget {
  const MetricTile({
    required this.label,
    required this.value,
    required this.icon,
    this.detail,
    this.progress,
    super.key,
  });

  final String label;
  final String value;
  final IconData icon;
  final String? detail;
  final double? progress;

  @override
  Widget build(BuildContext context) {
    final ColorScheme colors = Theme.of(context).colorScheme;
    return DecoratedBox(
      decoration: BoxDecoration(
        color: colors.surfaceContainerLow,
        borderRadius: BorderRadius.circular(18),
        border:
            Border.all(color: colors.outlineVariant.withValues(alpha: 0.55)),
      ),
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: <Widget>[
            Row(
              children: <Widget>[
                Icon(icon, size: 18, color: colors.primary),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    label,
                    style: Theme.of(context).textTheme.labelLarge?.copyWith(
                          color: colors.onSurfaceVariant,
                        ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 10),
            Text(value, style: Theme.of(context).textTheme.headlineSmall),
            if (detail != null) ...<Widget>[
              const SizedBox(height: 3),
              Text(
                detail!,
                style: Theme.of(context).textTheme.bodySmall?.copyWith(
                      color: colors.onSurfaceVariant,
                    ),
              ),
            ],
            if (progress != null) ...<Widget>[
              const SizedBox(height: 10),
              LinearProgressIndicator(
                value: progress!.clamp(0, 1),
                borderRadius: BorderRadius.circular(999),
              ),
            ],
          ],
        ),
      ),
    );
  }
}
