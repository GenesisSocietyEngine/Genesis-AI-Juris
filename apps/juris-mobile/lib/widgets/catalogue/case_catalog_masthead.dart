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
    required this.visualModeSelection,
    required this.resolvedVisualMode,
    required this.onVisualModeSelected,
  });

  final CaseCatalogBundle bundle;
  final String locale;
  final CaseCatalogFilter selectedFilter;
  final ValueChanged<String> onLocaleSelected;
  final ValueChanged<CaseCatalogFilter> onFilterSelected;
  final JurisVisualModeSelection visualModeSelection;
  final JurisVisualMode resolvedVisualMode;
  final ValueChanged<JurisVisualModeSelection> onVisualModeSelected;

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
            Text(
              chrome.applicationName.toUpperCase(),
              style: typography.caseIndex.copyWith(
                color: surfaces.brandGold,
              ),
            ),
            Wrap(
              spacing: spacing.sm,
              runSpacing: spacing.sm,
              children: <Widget>[
                _VisualModeControl(
                  selection: visualModeSelection,
                  resolvedMode: resolvedVisualMode,
                  chrome: chrome,
                  onSelected: onVisualModeSelected,
                ),
                _LanguageControl(
                  locale: locale,
                  supportedLocales: bundle.supportedLocales,
                  tooltip: bundle.text(locale, 'language'),
                  onSelected: onLocaleSelected,
                ),
              ],
            ),
          ],
        ),
        SizedBox(height: spacing.xl),
        Semantics(
          header: true,
          child: Text(
            bundle.text(locale, 'library_title'),
            style: typography.screenDisplay,
          ),
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

final class _VisualModeControl extends StatelessWidget {
  const _VisualModeControl({
    required this.selection,
    required this.resolvedMode,
    required this.chrome,
    required this.onSelected,
  });

  final JurisVisualModeSelection selection;
  final JurisVisualMode resolvedMode;
  final CinematicCatalogueStrings chrome;
  final ValueChanged<JurisVisualModeSelection> onSelected;

  @override
  Widget build(BuildContext context) {
    final JurisTypography typography =
        Theme.of(context).extension<JurisTypography>()!;
    final String resolvedLabel = _visualModeLabel(resolvedMode);
    final String selectionLabel = switch (selection) {
      JurisVisualModeSelection.automatic => chrome.automaticMode,
      JurisVisualModeSelection.office => 'OFFICE',
      JurisVisualModeSelection.afterHours => 'AFTER HOURS',
    };
    final String semanticLabel = '${chrome.appearance}: $selectionLabel. '
        '${chrome.currentMode}: $resolvedLabel';
    return PopupMenuButton<JurisVisualModeSelection>(
      key: const ValueKey<String>('catalog-visual-mode-action'),
      tooltip: semanticLabel,
      initialValue: selection,
      onSelected: onSelected,
      itemBuilder: (BuildContext context) => JurisVisualModeSelection.values
          .map(
            (JurisVisualModeSelection candidate) =>
                CheckedPopupMenuItem<JurisVisualModeSelection>(
              key: ValueKey<String>(
                'catalog-visual-mode-${candidate.name}',
              ),
              value: candidate,
              checked: candidate == selection,
              child: Text(
                switch (candidate) {
                  JurisVisualModeSelection.automatic => chrome.automaticMode,
                  JurisVisualModeSelection.office => 'OFFICE',
                  JurisVisualModeSelection.afterHours => 'AFTER HOURS',
                },
              ),
            ),
          )
          .toList(growable: false),
      child: Semantics(
        button: true,
        label: semanticLabel,
        excludeSemantics: true,
        child: Builder(
          builder: (BuildContext focusContext) => JurisFocusOutline(
            key: const ValueKey<String>('catalog-visual-mode-focus'),
            focused: Focus.of(focusContext).hasFocus,
            child: JurisMinimumTarget(
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 12),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: <Widget>[
                    const Icon(Icons.contrast_outlined, size: 20),
                    const SizedBox(width: 8),
                    Flexible(
                      child: Column(
                        mainAxisSize: MainAxisSize.min,
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: <Widget>[
                          Text(selectionLabel),
                          if (selection == JurisVisualModeSelection.automatic)
                            Text(
                              resolvedLabel,
                              style: typography.statusStamp.copyWith(
                                color: Theme.of(context)
                                    .colorScheme
                                    .onSurfaceVariant,
                              ),
                            ),
                        ],
                      ),
                    ),
                    const SizedBox(width: 4),
                    const Icon(Icons.arrow_drop_down, size: 20),
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

String _visualModeLabel(JurisVisualMode mode) => switch (mode) {
      JurisVisualMode.office => 'OFFICE',
      JurisVisualMode.afterHours => 'AFTER HOURS',
    };

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
      child: Semantics(
        button: true,
        label: '$tooltip: ${_languageAutonym(locale)}',
        excludeSemantics: true,
        child: Builder(
          builder: (BuildContext focusContext) => JurisFocusOutline(
            key: const ValueKey<String>('catalog-language-focus'),
            focused: Focus.of(focusContext).hasFocus,
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
