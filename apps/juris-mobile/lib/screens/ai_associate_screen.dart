import 'package:flutter/material.dart';

import '../models/game_snapshot.dart';
import '../widgets/section_card.dart';

/// Read-only view of the official AI associate and its constrained work product.
class AiAssociateScreen extends StatelessWidget {
  const AiAssociateScreen({
    required this.snapshot,
    required this.onShowActions,
    super.key,
  });

  final GameSnapshot snapshot;
  final VoidCallback onShowActions;

  @override
  Widget build(BuildContext context) {
    final int remaining = snapshot.aiRequestLimit - snapshot.aiRequestsUsed;
    return ListView(
      key: const PageStorageKey<String>('ai-scroll'),
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 120),
      children: <Widget>[
        SectionCard(
          child: Row(
            children: <Widget>[
              CircleAvatar(
                radius: 28,
                backgroundColor: Theme.of(context).colorScheme.primaryContainer,
                child: const Icon(Icons.auto_awesome, size: 28),
              ),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: <Widget>[
                    Text(
                      'AI associate',
                      style: Theme.of(context).textTheme.titleLarge,
                    ),
                    const SizedBox(height: 4),
                    Text(
                      '$remaining of ${snapshot.aiRequestLimit} requests remaining',
                      style: Theme.of(context).textTheme.bodySmall?.copyWith(
                            color:
                                Theme.of(context).colorScheme.onSurfaceVariant,
                          ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 16),
        SectionCard(
          title: 'Latest work product',
          subtitle:
              'The assistant receives authorized facts only and cannot mutate simulation state.',
          child: snapshot.latestAiNote == null
              ? const _NoAiWork()
              : SelectableText(snapshot.latestAiNote!),
        ),
        const SizedBox(height: 16),
        SectionCard(
          title: 'Authority boundary',
          child: Column(
            children: const <Widget>[
              _BoundaryRow(
                icon: Icons.visibility_outlined,
                text: 'May read only facts explicitly supplied by the engine.',
              ),
              _BoundaryRow(
                icon: Icons.block_outlined,
                text:
                    'Cannot discover evidence, spend money, or change reputation.',
              ),
              _BoundaryRow(
                icon: Icons.verified_user_outlined,
                text:
                    'Every output requires human verification before reliance.',
              ),
            ],
          ),
        ),
        const SizedBox(height: 16),
        FilledButton.icon(
          onPressed: remaining > 0 ? onShowActions : null,
          icon: const Icon(Icons.auto_awesome),
          label: const Text('Show AI actions'),
        ),
      ],
    );
  }
}

class _NoAiWork extends StatelessWidget {
  const _NoAiWork();

  @override
  Widget build(BuildContext context) {
    return const Padding(
      padding: EdgeInsets.symmetric(vertical: 18),
      child: Center(
        child: Column(
          children: <Widget>[
            Icon(Icons.description_outlined, size: 40),
            SizedBox(height: 10),
            Text('No AI work product has been requested.'),
          ],
        ),
      ),
    );
  }
}

class _BoundaryRow extends StatelessWidget {
  const _BoundaryRow({required this.icon, required this.text});

  final IconData icon;
  final String text;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          Icon(icon, size: 20, color: Theme.of(context).colorScheme.primary),
          const SizedBox(width: 12),
          Expanded(child: Text(text)),
        ],
      ),
    );
  }
}
