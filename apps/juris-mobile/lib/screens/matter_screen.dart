import 'package:flutter/material.dart';

import '../models/game_snapshot.dart';
import '../widgets/metric_tile.dart';
import '../widgets/section_card.dart';

/// Matter dashboard: the player's operational view of case state and resources.
class MatterScreen extends StatelessWidget {
  const MatterScreen({
    required this.snapshot,
    required this.onShowActions,
    super.key,
  });

  final GameSnapshot snapshot;
  final VoidCallback onShowActions;

  @override
  Widget build(BuildContext context) {
    return CustomScrollView(
      key: const PageStorageKey<String>('matter-scroll'),
      slivers: <Widget>[
        SliverPadding(
          padding: const EdgeInsets.fromLTRB(16, 12, 16, 120),
          sliver: SliverList.list(
            children: <Widget>[
              _MatterHeader(snapshot: snapshot),
              if (snapshot.isClosed &&
                  snapshot.outcomeSummary != null) ...<Widget>[
                const SizedBox(height: 16),
                _OutcomeCard(summary: snapshot.outcomeSummary!),
              ],
              const SizedBox(height: 16),
              _MetricGrid(snapshot: snapshot),
              const SizedBox(height: 16),
              if (snapshot.settlementOffer != null) ...<Widget>[
                _SettlementCard(offer: snapshot.settlementOffer!),
                const SizedBox(height: 16),
              ],
              _EvidenceCard(evidence: snapshot.evidence),
              const SizedBox(height: 16),
              if (snapshot.actions.isNotEmpty)
                FilledButton.icon(
                  onPressed: onShowActions,
                  icon: const Icon(Icons.playlist_add_check_circle_outlined),
                  label: Text(
                    'Review ${snapshot.actions.length} available actions',
                  ),
                ),
            ],
          ),
        ),
      ],
    );
  }
}

class _MatterHeader extends StatelessWidget {
  const _MatterHeader({required this.snapshot});

  final GameSnapshot snapshot;

  @override
  Widget build(BuildContext context) {
    final ColorScheme colors = Theme.of(context).colorScheme;
    return SectionCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          Text(
            snapshot.matterTitle,
            style: Theme.of(context).textTheme.headlineSmall,
          ),
          const SizedBox(height: 8),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: <Widget>[
              Chip(label: Text(snapshot.stage)),
              if (snapshot.judicialResult != null)
                Chip(
                  avatar: Icon(
                    snapshot.judicialResult!.isAdverse
                        ? Icons.cancel_outlined
                        : Icons.gavel_outlined,
                    size: 18,
                  ),
                  label: Text(
                    'Decision: ${snapshot.judicialResult!.label}',
                  ),
                ),
              Chip(
                label: Text(
                  'Matter status: ${snapshot.matterLifecycle.label}',
                ),
              ),
              Chip(
                avatar: Icon(
                  snapshot.caseResultStatus.isAdverse
                      ? Icons.cancel_outlined
                      : snapshot.caseResultStatus == CaseResultStatus.ongoing
                          ? Icons.timelapse_outlined
                          : Icons.verified_outlined,
                  size: 18,
                ),
                label: Text(snapshot.caseResultStatus.label),
              ),
              Chip(label: Text(snapshot.engagementStatus.label)),
              Chip(label: Text(snapshot.mode)),
              Chip(label: Text('Seed ${snapshot.seed}')),
            ],
          ),
          const SizedBox(height: 18),
          Row(
            children: <Widget>[
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: <Widget>[
                    Text(
                      'Case strength',
                      style: Theme.of(context).textTheme.labelLarge?.copyWith(
                            color: colors.onSurfaceVariant,
                          ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      '${snapshot.caseStrength}/100',
                      style: Theme.of(context).textTheme.displaySmall,
                    ),
                  ],
                ),
              ),
              SizedBox(
                width: 72,
                height: 72,
                child: CircularProgressIndicator(
                  value: snapshot.caseStrength / 100,
                  strokeWidth: 8,
                  backgroundColor: colors.surfaceContainerHighest,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _OutcomeCard extends StatelessWidget {
  const _OutcomeCard({required this.summary});

  final CaseOutcomeSummaryView summary;

  @override
  Widget build(BuildContext context) {
    return SectionCard(
      title: 'Final outcome',
      subtitle: summary.closedAt,
      trailing: const Icon(Icons.verified_outlined),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          Text(
            summary.headline,
            style: Theme.of(context).textTheme.titleLarge,
          ),
          const SizedBox(height: 6),
          Text(summary.finalStatus),
          const SizedBox(height: 10),
          Text(summary.detail),
        ],
      ),
    );
  }
}

class _MetricGrid extends StatelessWidget {
  const _MetricGrid({required this.snapshot});

  final GameSnapshot snapshot;

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (BuildContext context, BoxConstraints constraints) {
        final int columns = constraints.maxWidth >= 900
            ? 4
            : constraints.maxWidth >= 480
                ? 2
                : 1;
        final double width =
            (constraints.maxWidth - ((columns - 1) * 12)) / columns;
        final double budgetProgress = snapshot.authorizedBudgetEur == 0
            ? 0
            : snapshot.spendEur / snapshot.authorizedBudgetEur;

        final List<Widget> tiles = <Widget>[
          MetricTile(
            label: 'Budget',
            value: 'EUR ${_money(snapshot.spendEur)}',
            detail:
                'EUR ${_money(snapshot.remainingBudgetEur)} authority remaining',
            icon: Icons.account_balance_wallet_outlined,
            progress: budgetProgress,
          ),
          MetricTile(
            label: 'Evidence',
            value: '${snapshot.evidenceScore}/100',
            detail: '${snapshot.evidence.length} discovered items',
            icon: Icons.fact_check_outlined,
            progress: snapshot.evidenceScore / 100,
          ),
          MetricTile(
            label: 'Workload',
            value: '${snapshot.billableHours.toStringAsFixed(1)}h',
            detail:
                'Fatigue ${snapshot.fatigue} · strain ${snapshot.cumulativeStrain}',
            icon: Icons.schedule_outlined,
          ),
          MetricTile(
            label: 'Professional standing',
            value: '${snapshot.ethics}/100',
            detail: 'Client trust ${snapshot.clientTrust}/100',
            icon: Icons.balance_outlined,
            progress: snapshot.ethics / 100,
          ),
        ];

        return Wrap(
          spacing: 12,
          runSpacing: 12,
          children: tiles
              .map((Widget tile) => SizedBox(width: width, child: tile))
              .toList(growable: false),
        );
      },
    );
  }
}

class _SettlementCard extends StatelessWidget {
  const _SettlementCard({required this.offer});

  final SettlementOfferView offer;

  @override
  Widget build(BuildContext context) {
    final ColorScheme colors = Theme.of(context).colorScheme;
    return SectionCard(
      title: 'Settlement offer · revision ${offer.revision}',
      trailing: Icon(Icons.handshake_outlined, color: colors.primary),
      child: Row(
        children: <Widget>[
          Expanded(
            child: Text(
              'EUR ${_money(offer.amountEur)}',
              style: Theme.of(context).textTheme.headlineMedium,
            ),
          ),
          Text(
            'Expires ${offer.expiresAt}',
            style: Theme.of(context).textTheme.bodySmall?.copyWith(
                  color: colors.onSurfaceVariant,
                ),
          ),
        ],
      ),
    );
  }
}

class _EvidenceCard extends StatelessWidget {
  const _EvidenceCard({required this.evidence});

  final List<EvidenceView> evidence;

  @override
  Widget build(BuildContext context) {
    return SectionCard(
      title: 'Known evidence',
      subtitle: 'Only evidence authorized by the engine may appear here.',
      child: Column(
        children: evidence
            .map(
              (EvidenceView item) => ListTile(
                contentPadding: EdgeInsets.zero,
                leading: CircleAvatar(
                  child: Icon(
                    item.isAdverse
                        ? Icons.warning_amber_rounded
                        : Icons.description_outlined,
                  ),
                ),
                title: Text(item.title),
                subtitle: Text(item.detail),
                trailing: Text('${item.reliability}%'),
              ),
            )
            .toList(growable: false),
      ),
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
