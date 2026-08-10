import 'package:flutter/material.dart';

import '../../design/juris_design.dart';
import '../../models/case_catalog.dart';
import '../../visual_identity/cinematic_catalogue_strings.dart';

enum CaseCatalogFilter { all, playable, authoring }

/// Unframed catalogue heading, language control, notice, and filters.
final class CaseCatalogMasthead extends StatelessWidget {
  const CaseCatalogMasthead({
    super.key,
    required this.bundle,
    required this.locale,
    required this.selectedFilter,
    required this.onLocaleSelected,
    required this.onFilterSelected,
  });

  final CaseCatalogBundle bundle;
  final String locale;
  final CaseCatalogFilter selectedFilter;
  final ValueChanged<String> onLocaleSelected;
  final ValueChanged<CaseCatalogFilter> onFilterSelected;

  @override
  Widget build(BuildContext context) {
    final ThemeData theme = Theme.of(context);
    final JurisSpacing? spacing = theme.extension<JurisSpacing>();
    final JurisTypography? typography = theme.extension<JurisTypography>();
    final JurisSurfaces? surfaces = theme.extension<JurisSurfaces>();
    if (spacing == null || typography == null || surfaces == null) {
      throw FlutterError(
        'CaseCatalogMasthead requires spacing, typography, and surfaces.',
      );
    }
    final CinematicCatalogueStrings chrome =
        CinematicCatalogueStrings.of(locale);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: <Widget>[
        Wrap(
          alignment: WrapAlignment.spaceBetween,
          crossAxisAlignment: WrapCrossAlignment.center,
          spacing: spacing.lg,
          runSpacing: spacing.sm,
          children: <Widget>[
            Semantics(
              header: true,
              child: Text(
                chrome.applicationName.toUpperCase(),
                style: typography.caseIndex.copyWith(
                  color: surfaces.brandGold,
                ),
              ),
            ),
            _LanguageControl(
              locale: locale,
              supportedLocales: bundle.supportedLocales,
              tooltip: bundle.text(locale, 'language'),
              onSelected: onLocaleSelected,
            ),
          ],
        ),
        SizedBox(height: spacing.lg),
        Text(
          bundle.text(locale, 'library_title'),
          style: typography.sectionTitle,
        ),
        SizedBox(height: spacing.sm),
        ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 760),
          child: Text(
            bundle.text(locale, 'library_subtitle'),
            style: typography.bodyReading.copyWith(
              color: theme.colorScheme.onSurfaceVariant,
            ),
          ),
        ),
        SizedBox(height: spacing.md),
        Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: <Widget>[
            Icon(
              Icons.theater_comedy_outlined,
              size: 20,
              color: surfaces.circuitCyan,
            ),
            SizedBox(width: spacing.sm),
            Expanded(
              child: Text(
                bundle.fictionalNotice(locale),
                style: typography.caption.copyWith(
                  color: theme.colorScheme.onSurfaceVariant,
                ),
              ),
            ),
          ],
        ),
        SizedBox(height: spacing.lg),
        Wrap(
          spacing: spacing.sm,
          runSpacing: spacing.sm,
          children: <Widget>[
            _FilterChip(
              key: const ValueKey<String>('catalog-filter-all'),
              label: bundle.text(locale, 'all_cases'),
              selected: selectedFilter == CaseCatalogFilter.all,
              onSelected: () => onFilterSelected(CaseCatalogFilter.all),
            ),
            _FilterChip(
              key: const ValueKey<String>('catalog-filter-playable'),
              label: bundle.text(locale, 'playable_cases'),
              selected: selectedFilter == CaseCatalogFilter.playable,
              onSelected: () => onFilterSelected(CaseCatalogFilter.playable),
            ),
            _FilterChip(
              key: const ValueKey<String>('catalog-filter-authoring'),
              label: bundle.text(locale, 'authoring_cases'),
              selected: selectedFilter == CaseCatalogFilter.authoring,
              onSelected: () => onFilterSelected(CaseCatalogFilter.authoring),
            ),
          ],
        ),
      ],
    );
  }
}

final class _LanguageControl extends StatelessWidget {
  const _LanguageControl({
    required this.locale,
    required this.supportedLocales,
    required this.tooltip,
    required this.onSelected,
  });

  final String locale;
  final List<String> supportedLocales;
  final String tooltip;
  final ValueChanged<String> onSelected;

  @override
  Widget build(BuildContext context) {
    return PopupMenuButton<String>(
      key: const ValueKey<String>('catalog-language-action'),
      tooltip: tooltip,
      initialValue: locale,
      onSelected: onSelected,
      itemBuilder: (BuildContext context) {
        return supportedLocales
            .map(
              (String candidate) => CheckedPopupMenuItem<String>(
                value: candidate,
                checked: candidate == locale,
                child: Text(_languageAutonym(candidate)),
              ),
            )
            .toList(growable: false);
      },
      child: JurisMinimumTarget(
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 12),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: <Widget>[
              const Icon(Icons.language, size: 20),
              const SizedBox(width: 8),
              Text(_languageAutonym(locale)),
              const SizedBox(width: 4),
              const Icon(Icons.arrow_drop_down, size: 20),
            ],
          ),
        ),
      ),
    );
  }
}

String _languageAutonym(String locale) {
  return switch (locale.toLowerCase().split(RegExp('[-_]')).first) {
    'en' => 'English',
    'ru' => 'Русский',
    _ => locale.toUpperCase(),
  };
}

final class _FilterChip extends StatelessWidget {
  const _FilterChip({
    super.key,
    required this.label,
    required this.selected,
    required this.onSelected,
  });

  final String label;
  final bool selected;
  final VoidCallback onSelected;

  @override
  Widget build(BuildContext context) {
    return JurisMinimumTarget(
      child: ChoiceChip(
        label: Text(label),
        selected: selected,
        onSelected: (_) => onSelected(),
      ),
    );
  }
}
