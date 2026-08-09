import 'package:flutter/material.dart';

import '../data/case_catalog_repository.dart';
import '../data/case_runtime_factory.dart';
import '../models/case_catalog.dart';

enum _CaseFilter { all, playable, authoring }

typedef CaseStartCallback = void Function(
  MobileCaseDefinition caseDefinition,
  String locale,
  CaseCatalogBundle contentInventory,
);

class CaseCatalogLoaderScreen extends StatefulWidget {
  const CaseCatalogLoaderScreen({
    required this.repository,
    required this.onStartCase,
    super.key,
  });

  final CaseCatalogRepository repository;
  final CaseStartCallback onStartCase;

  @override
  State<CaseCatalogLoaderScreen> createState() =>
      _CaseCatalogLoaderScreenState();
}

class _CaseCatalogLoaderScreenState extends State<CaseCatalogLoaderScreen> {
  late Future<CaseCatalogBundle> _bundle;

  @override
  void initState() {
    super.initState();
    _bundle = widget.repository.load();
  }

  void _retry() {
    setState(() {
      _bundle = widget.repository.load();
    });
  }

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<CaseCatalogBundle>(
      future: _bundle,
      builder: (
        BuildContext context,
        AsyncSnapshot<CaseCatalogBundle> snapshot,
      ) {
        if (snapshot.connectionState != ConnectionState.done) {
          return const Scaffold(
            body: Center(child: CircularProgressIndicator()),
          );
        }
        if (snapshot.hasError || !snapshot.hasData) {
          return Scaffold(
            appBar: AppBar(title: const Text('GENESIS: AI Juris')),
            body: Center(
              child: Padding(
                padding: const EdgeInsets.all(24),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: <Widget>[
                    const Icon(Icons.error_outline, size: 48),
                    const SizedBox(height: 16),
                    const Text(
                      'The case library could not be loaded.',
                      textAlign: TextAlign.center,
                    ),
                    const SizedBox(height: 8),
                    Text(
                      '${snapshot.error}',
                      textAlign: TextAlign.center,
                      style: Theme.of(context).textTheme.bodySmall,
                    ),
                    const SizedBox(height: 16),
                    FilledButton.icon(
                      onPressed: _retry,
                      icon: const Icon(Icons.refresh),
                      label: const Text('Retry'),
                    ),
                  ],
                ),
              ),
            ),
          );
        }

        return CaseCatalogScreen(
          bundle: snapshot.requireData,
          onStartCase: widget.onStartCase,
        );
      },
    );
  }
}

class CaseCatalogScreen extends StatefulWidget {
  const CaseCatalogScreen({
    required this.bundle,
    required this.onStartCase,
    super.key,
  });

  final CaseCatalogBundle bundle;
  final CaseStartCallback onStartCase;

  @override
  State<CaseCatalogScreen> createState() => _CaseCatalogScreenState();
}

class _CaseCatalogScreenState extends State<CaseCatalogScreen> {
  late String _locale;
  _CaseFilter _filter = _CaseFilter.all;

  @override
  void initState() {
    super.initState();
    _locale = widget.bundle.defaultLocale;
  }

  @override
  Widget build(BuildContext context) {
    final List<MobileCaseDefinition> visibleCases =
        widget.bundle.cases.where(_matchesFilter).toList(growable: false);
    final String title = widget.bundle.text(_locale, 'library_title');

    return Scaffold(
      appBar: AppBar(
        title: Text(title),
        actions: <Widget>[
          PopupMenuButton<String>(
            tooltip: widget.bundle.text(_locale, 'language'),
            initialValue: _locale,
            onSelected: (String locale) {
              setState(() => _locale = locale);
            },
            itemBuilder: (BuildContext context) {
              return widget.bundle.supportedLocales
                  .map(
                    (String locale) => PopupMenuItem<String>(
                      value: locale,
                      child: Text(locale.toUpperCase()),
                    ),
                  )
                  .toList(growable: false);
            },
            icon: const Icon(Icons.language),
          ),
          const SizedBox(width: 8),
        ],
      ),
      body: CustomScrollView(
        key: const PageStorageKey<String>('case-catalog'),
        slivers: <Widget>[
          SliverPadding(
            padding: const EdgeInsets.fromLTRB(16, 16, 16, 8),
            sliver: SliverToBoxAdapter(
              child: _LibraryHeader(
                title: title,
                subtitle: widget.bundle.text(
                  _locale,
                  'library_subtitle',
                ),
                fictionalNotice: widget.bundle.fictionalNotice(_locale),
              ),
            ),
          ),
          SliverPadding(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
            sliver: SliverToBoxAdapter(
              child: Wrap(
                spacing: 8,
                runSpacing: 8,
                children: <Widget>[
                  ChoiceChip(
                    label: Text(
                      widget.bundle.text(_locale, 'all_cases'),
                    ),
                    selected: _filter == _CaseFilter.all,
                    onSelected: (_) => _setFilter(_CaseFilter.all),
                  ),
                  ChoiceChip(
                    label: Text(
                      widget.bundle.text(_locale, 'playable_cases'),
                    ),
                    selected: _filter == _CaseFilter.playable,
                    onSelected: (_) => _setFilter(_CaseFilter.playable),
                  ),
                  ChoiceChip(
                    label: Text(
                      widget.bundle.text(_locale, 'authoring_cases'),
                    ),
                    selected: _filter == _CaseFilter.authoring,
                    onSelected: (_) => _setFilter(_CaseFilter.authoring),
                  ),
                ],
              ),
            ),
          ),
          if (visibleCases.isEmpty)
            SliverFillRemaining(
              hasScrollBody: false,
              child: Center(
                child: Text(widget.bundle.text(_locale, 'no_cases')),
              ),
            )
          else
            SliverPadding(
              padding: const EdgeInsets.fromLTRB(16, 8, 16, 32),
              sliver: SliverList.separated(
                itemCount: visibleCases.length,
                separatorBuilder: (_, __) => const SizedBox(height: 12),
                itemBuilder: (BuildContext context, int index) {
                  final MobileCaseDefinition caseDefinition =
                      visibleCases[index];
                  return _CaseCard(
                    bundle: widget.bundle,
                    locale: _locale,
                    caseDefinition: caseDefinition,
                    onStart: () => widget.onStartCase(
                      caseDefinition,
                      _locale,
                      widget.bundle,
                    ),
                    onConversionPlan: () => _showConversionPlan(
                      caseDefinition,
                    ),
                  );
                },
              ),
            ),
        ],
      ),
    );
  }

  bool _matchesFilter(MobileCaseDefinition item) {
    return switch (_filter) {
      _CaseFilter.all => true,
      _CaseFilter.playable => CaseRuntimeFactory.supports(item),
      _CaseFilter.authoring => !CaseRuntimeFactory.supports(item),
    };
  }

  void _setFilter(_CaseFilter filter) {
    setState(() => _filter = filter);
  }

  Future<void> _showConversionPlan(
    MobileCaseDefinition caseDefinition,
  ) {
    final LocalizedCaseText text = caseDefinition.localized(
      _locale,
      widget.bundle.defaultLocale,
    );
    return showModalBottomSheet<void>(
      context: context,
      useSafeArea: true,
      isScrollControlled: true,
      showDragHandle: true,
      builder: (BuildContext context) {
        return _ConversionSheet(
          bundle: widget.bundle,
          locale: _locale,
          caseDefinition: caseDefinition,
          text: text,
        );
      },
    );
  }
}

class _LibraryHeader extends StatelessWidget {
  const _LibraryHeader({
    required this.title,
    required this.subtitle,
    required this.fictionalNotice,
  });

  final String title;
  final String subtitle;
  final String fictionalNotice;

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: <Widget>[
            Text(title, style: Theme.of(context).textTheme.headlineSmall),
            const SizedBox(height: 8),
            Text(subtitle),
            const SizedBox(height: 16),
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: <Widget>[
                Icon(
                  Icons.theater_comedy_outlined,
                  color: Theme.of(context).colorScheme.primary,
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Text(
                    fictionalNotice,
                    style: Theme.of(context).textTheme.bodySmall,
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

class _CaseCard extends StatelessWidget {
  const _CaseCard({
    required this.bundle,
    required this.locale,
    required this.caseDefinition,
    required this.onStart,
    required this.onConversionPlan,
  });

  final CaseCatalogBundle bundle;
  final String locale;
  final MobileCaseDefinition caseDefinition;
  final VoidCallback onStart;
  final VoidCallback onConversionPlan;

  @override
  Widget build(BuildContext context) {
    final LocalizedCaseText text = caseDefinition.localized(
      locale,
      bundle.defaultLocale,
    );
    final bool launchable = CaseRuntimeFactory.supports(caseDefinition);
    final ColorScheme colors = Theme.of(context).colorScheme;

    return Card(
      clipBehavior: Clip.antiAlias,
      child: Padding(
        padding: const EdgeInsets.all(18),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: <Widget>[
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: <Widget>[
                Chip(
                  avatar: Icon(
                    launchable
                        ? Icons.play_circle_outline
                        : Icons.construction_outlined,
                    size: 18,
                  ),
                  label: Text(_statusLabel()),
                ),
                Chip(
                  avatar: const Icon(Icons.signal_cellular_alt, size: 18),
                  label: Text(
                    bundle.text(locale, caseDefinition.difficulty.name),
                  ),
                ),
                Chip(
                  avatar: const Icon(Icons.account_balance_outlined, size: 18),
                  label: Text(caseDefinition.jurisdiction),
                ),
              ],
            ),
            const SizedBox(height: 14),
            Text(
              text.caption,
              style: Theme.of(context).textTheme.titleLarge,
            ),
            const SizedBox(height: 6),
            Text(
              text.topic,
              style: Theme.of(context).textTheme.titleMedium?.copyWith(
                    color: colors.primary,
                  ),
            ),
            const SizedBox(height: 12),
            Text(text.synopsis),
            const SizedBox(height: 16),
            _MetadataRow(
              icon: Icons.business_outlined,
              label: bundle.text(locale, 'player_client'),
              value: text.playerClientName,
            ),
            const SizedBox(height: 8),
            _MetadataRow(
              icon: Icons.balance_outlined,
              label: bundle.text(locale, 'player_role'),
              value: bundle.text(locale, caseDefinition.playerRole),
            ),
            const SizedBox(height: 16),
            Row(
              children: <Widget>[
                Expanded(
                  child: FilledButton.icon(
                    onPressed: launchable ? onStart : null,
                    icon: const Icon(Icons.play_arrow),
                    label: Text(bundle.text(locale, 'start_case')),
                  ),
                ),
                const SizedBox(width: 10),
                IconButton.filledTonal(
                  tooltip: bundle.text(locale, 'conversion_plan'),
                  onPressed: onConversionPlan,
                  icon: const Icon(Icons.schema_outlined),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  String _statusLabel() {
    if (CaseRuntimeFactory.supports(caseDefinition)) {
      return bundle.text(locale, 'playable');
    }
    return bundle.text(locale, caseDefinition.status.name);
  }
}

class _MetadataRow extends StatelessWidget {
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

class _ConversionSheet extends StatelessWidget {
  const _ConversionSheet({
    required this.bundle,
    required this.locale,
    required this.caseDefinition,
    required this.text,
  });

  final CaseCatalogBundle bundle;
  final String locale;
  final MobileCaseDefinition caseDefinition;
  final LocalizedCaseText text;

  @override
  Widget build(BuildContext context) {
    final CaseReadiness readiness = caseDefinition.readiness;
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

class _ReadinessTile extends StatelessWidget {
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
      trailing: Text(
        bundle.text(locale, ready ? 'ready' : 'pending'),
      ),
    );
  }
}
