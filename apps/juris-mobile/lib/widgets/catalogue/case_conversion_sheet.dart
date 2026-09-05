import 'package:flutter/material.dart';

import '../../models/case_catalog.dart';

/// Presentation of the existing conversion/readiness data for one case.
final class CaseConversionSheet extends StatelessWidget {
  const CaseConversionSheet({
    super.key,
    required this.bundle,
    required this.locale,
    required this.caseDefinition,
  });

  final CaseCatalogBundle bundle;
  final String locale;
  final MobileCaseDefinition caseDefinition;

  @override
  Widget build(BuildContext context) {
    final CaseReadiness readiness = caseDefinition.readiness;
    final LocalizedCaseText text = caseDefinition.localized(
      locale,
      bundle.defaultLocale,
    );
    return SingleChildScrollView(
      padding: const EdgeInsets.fromLTRB(20, 0, 20, 32),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          Text(
            bundle.text(locale, 'conversion_title'),
            style: Theme.of(context).textTheme.headlineSmall,
          ),
          const SizedBox(height: 8),
          Text(text.caption),
          Text(
            text.topic,
            style: TextStyle(color: Theme.of(context).colorScheme.primary),
          ),
          const SizedBox(height: 16),
          Text(bundle.text(locale, 'conversion_explanation')),
          const SizedBox(height: 20),
          _ReadinessTile(
            label: bundle.text(locale, 'identity_ready'),
            ready: readiness.identity,
            bundle: bundle,
            locale: locale,
          ),
          _ReadinessTile(
            label: bundle.text(locale, 'scenario_present'),
            ready: readiness.scenarioDefinition,
            bundle: bundle,
            locale: locale,
          ),
          _ReadinessTile(
            label: bundle.text(locale, 'diagnostics_ready'),
            ready: readiness.diagnostics,
            bundle: bundle,
            locale: locale,
          ),
          _ReadinessTile(
            label: bundle.text(locale, 'path_ready'),
            ready: readiness.pathSimulation,
            bundle: bundle,
            locale: locale,
          ),
          _ReadinessTile(
            label: bundle.text(locale, 'engine_runtime_ready'),
            ready: readiness.engineRuntime,
            bundle: bundle,
            locale: locale,
          ),
          _ReadinessTile(
            label: bundle.text(locale, 'mobile_ready'),
            ready: readiness.mobileBundle,
            bundle: bundle,
            locale: locale,
          ),
          const SizedBox(height: 20),
          _MetadataRow(
            icon: Icons.memory_outlined,
            label: bundle.text(locale, 'runtime_adapter'),
            value: caseDefinition.runtimeAdapter ??
                bundle.text(locale, 'not_available'),
          ),
          const SizedBox(height: 10),
          _MetadataRow(
            icon: Icons.description_outlined,
            label: bundle.text(locale, 'scenario_file'),
            value: caseDefinition.scenarioFile ??
                bundle.text(locale, 'not_available'),
          ),
          const SizedBox(height: 20),
          Text(
            bundle.text(locale, 'legal_issues'),
            style: Theme.of(context).textTheme.titleMedium,
          ),
          const SizedBox(height: 8),
          ...text.legalIssues.map(
            (String issue) => Padding(
              padding: const EdgeInsets.only(bottom: 6),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: <Widget>[
                  const Text('• '),
                  Expanded(child: Text(issue)),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

final class _MetadataRow extends StatelessWidget {
  const _MetadataRow({
    required this.icon,
    required this.label,
    required this.value,
  });

  final IconData icon;
  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: <Widget>[
        Icon(icon, size: 20),
        const SizedBox(width: 10),
        Expanded(
          child: Text.rich(
            TextSpan(
              children: <InlineSpan>[
                TextSpan(
                  text: '$label: ',
                  style: const TextStyle(fontWeight: FontWeight.w600),
                ),
                TextSpan(text: value),
              ],
            ),
          ),
        ),
      ],
    );
  }
}

final class _ReadinessTile extends StatelessWidget {
  const _ReadinessTile({
    required this.label,
    required this.ready,
    required this.bundle,
    required this.locale,
  });

  final String label;
  final bool ready;
  final CaseCatalogBundle bundle;
  final String locale;

  @override
  Widget build(BuildContext context) {
    return ListTile(
      contentPadding: EdgeInsets.zero,
      leading: Icon(
        ready ? Icons.check_circle : Icons.pending_outlined,
        color: ready
            ? Theme.of(context).colorScheme.primary
            : Theme.of(context).colorScheme.onSurfaceVariant,
      ),
      title: Text(label),
      trailing: Text(bundle.text(locale, ready ? 'ready' : 'pending')),
    );
  }
}
