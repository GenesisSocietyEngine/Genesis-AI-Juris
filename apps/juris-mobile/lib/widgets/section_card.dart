import 'package:flutter/material.dart';

/// Consistent section surface used across the information-dense legal UI.
///
/// [onTap] is optional because most section cards are read-only dashboards,
/// while Inbox cards behave as interactive messages. Keeping the tap contract
/// on the shared surface preserves one visual language and gives the full card
/// a reliable Material hit target instead of making only a small icon tappable.
class SectionCard extends StatelessWidget {
  const SectionCard({
    required this.child,
    this.title,
    this.subtitle,
    this.trailing,
    this.onTap,
    this.padding = const EdgeInsets.all(16),
    super.key,
  });

  final String? title;
  final String? subtitle;
  final Widget? trailing;
  final VoidCallback? onTap;
  final EdgeInsetsGeometry padding;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return Card(
      clipBehavior: onTap == null ? Clip.none : Clip.antiAlias,
      child: InkWell(
        onTap: onTap,
        child: Padding(
          padding: padding,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: <Widget>[
              if (title != null || trailing != null)
                Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: <Widget>[
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: <Widget>[
                          if (title != null)
                            Text(
                              title!,
                              style: Theme.of(context).textTheme.titleMedium,
                            ),
                          if (subtitle != null) ...<Widget>[
                            const SizedBox(height: 4),
                            Text(
                              subtitle!,
                              style: Theme.of(context)
                                  .textTheme
                                  .bodySmall
                                  ?.copyWith(
                                    color: Theme.of(context)
                                        .colorScheme
                                        .onSurfaceVariant,
                                  ),
                            ),
                          ],
                        ],
                      ),
                    ),
                    if (trailing != null) trailing!,
                  ],
                ),
              if (title != null || subtitle != null || trailing != null)
                const SizedBox(height: 14),
              child,
            ],
          ),
        ),
      ),
    );
  }
}
