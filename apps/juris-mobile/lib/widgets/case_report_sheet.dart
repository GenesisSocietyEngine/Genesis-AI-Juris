import 'package:flutter/material.dart';

import '../models/game_snapshot.dart';

/// Read-only post-matter report shown once every active lifecycle branch has
/// reached a terminal state.
class CaseReportSheet extends StatelessWidget {
  const CaseReportSheet({
    required this.snapshot,
    required this.summary,
    super.key,
  });

  final GameSnapshot snapshot;
  final CaseOutcomeSummaryView summary;

  @override
  Widget build(BuildContext context) {
    final TextTheme text = Theme.of(context).textTheme;
    final ColorScheme colors = Theme.of(context).colorScheme;

    return SafeArea(
      top: false,
      child: SingleChildScrollView(
        padding: const EdgeInsets.fromLTRB(24, 8, 24, 28),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: <Widget>[
            Text('Case report', style: text.headlineSmall),
            const SizedBox(height: 6),
            Text(
              snapshot.matterTitle,
              style: text.titleMedium?.copyWith(
                color: colors.onSurfaceVariant,
              ),
            ),
            const SizedBox(height: 24),
            _ReportSection(
              title: 'Outcome',
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: <Widget>[
                  Text(summary.headline, style: text.titleLarge),
                  const SizedBox(height: 6),
                  Text(summary.finalStatus, style: text.titleSmall),
                  const SizedBox(height: 12),
                  Text(summary.detail),
                  const SizedBox(height: 10),
                  Text(
                    'Closed ${summary.closedAt}',
                    style: text.bodySmall?.copyWith(
                      color: colors.onSurfaceVariant,
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 14),
            _ReportSection(
              title: 'Financial result',
              child: Column(
                children: <Widget>[
                  _ReportRow(
                    label: 'Award / settlement',
                    value: _eur(summary.awardEur),
                  ),
                  _ReportRow(
                    label: 'Costs awarded',
                    value: _eur(summary.costsEur),
                  ),
                  _ReportRow(
                    label: 'Legal spend',
                    value: _eur(snapshot.spendEur),
                  ),
                  _ReportRow(
                    label: 'Billable time',
                    value: '${snapshot.billableHours.toStringAsFixed(1)}h',
                  ),
                ],
              ),
            ),
            const SizedBox(height: 14),
            _ReportSection(
              title: 'Performance',
              child: Column(
                children: <Widget>[
                  _ReportRow(
                    label: 'Case strength',
                    value: '${snapshot.caseStrength}/100',
                  ),
                  _ReportRow(label: 'Merits', value: '${snapshot.merits}/100'),
                  _ReportRow(
                    label: 'Evidence',
                    value: '${snapshot.evidenceScore}/100',
                  ),
                  _ReportRow(
                    label: 'Procedure',
                    value: '${snapshot.procedure}/100',
                  ),
                  _ReportRow(
                    label: 'Client trust',
                    value: '${snapshot.clientTrust}/100',
                  ),
                  _ReportRow(label: 'Ethics', value: '${snapshot.ethics}/100'),
                ],
              ),
            ),
            if (summary.keySuccesses.isNotEmpty) ...<Widget>[
              const SizedBox(height: 14),
              _ReportSection(
                title: 'Key successes',
                child: _ReportList(
                  entries: summary.keySuccesses,
                  icon: Icons.check_circle_outline,
                ),
              ),
            ],
            if (summary.missedOpportunities.isNotEmpty) ...<Widget>[
              const SizedBox(height: 14),
              _ReportSection(
                title: 'Missed opportunities',
                child: _ReportList(
                  entries: summary.missedOpportunities,
                  icon: Icons.warning_amber_outlined,
                ),
              ),
            ],
            const SizedBox(height: 22),
            OutlinedButton(
              onPressed: () => Navigator.pop(context),
              child: const Text('Close'),
            ),
          ],
        ),
      ),
    );
  }

  static String _eur(int value) {
    final String digits = value.toString();
    final StringBuffer result = StringBuffer();
    for (int index = 0; index < digits.length; index += 1) {
      final int remaining = digits.length - index;
      result.write(digits[index]);
      if (remaining > 1 && remaining % 3 == 1) {
        result.write(',');
      }
    }
    return 'EUR $result';
  }
}

class _ReportSection extends StatelessWidget {
  const _ReportSection({required this.title, required this.child});

  final String title;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    final ColorScheme colors = Theme.of(context).colorScheme;
    return DecoratedBox(
      decoration: BoxDecoration(
        color: colors.surfaceContainerHigh,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: colors.outlineVariant),
      ),
      child: Padding(
        padding: const EdgeInsets.all(18),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: <Widget>[
            Text(title, style: Theme.of(context).textTheme.titleMedium),
            const SizedBox(height: 12),
            child,
          ],
        ),
      ),
    );
  }
}

class _ReportRow extends StatelessWidget {
  const _ReportRow({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        children: <Widget>[
          Expanded(child: Text(label)),
          const SizedBox(width: 12),
          Text(value, style: Theme.of(context).textTheme.titleSmall),
        ],
      ),
    );
  }
}

class _ReportList extends StatelessWidget {
  const _ReportList({required this.entries, required this.icon});

  final List<String> entries;
  final IconData icon;

  @override
  Widget build(BuildContext context) {
    return Column(
      children: entries
          .map(
            (String entry) => Padding(
              padding: const EdgeInsets.symmetric(vertical: 5),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: <Widget>[
                  Icon(icon, size: 19),
                  const SizedBox(width: 10),
                  Expanded(child: Text(entry)),
                ],
              ),
            ),
          )
          .toList(growable: false),
    );
  }
}
