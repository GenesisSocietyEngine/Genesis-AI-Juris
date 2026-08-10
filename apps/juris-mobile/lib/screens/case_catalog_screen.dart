import 'package:flutter/material.dart';

import '../data/case_catalog_repository.dart';
import '../data/case_runtime_factory.dart';
import '../models/case_catalog.dart';
import '../visual_identity/case_visual_manifest.dart';
import '../visual_identity/case_visual_manifest_repository.dart';
import '../visual_identity/cinematic_catalogue_strings.dart';
import '../widgets/catalogue/case_catalog_layout.dart';
import '../widgets/catalogue/case_catalog_masthead.dart';
import '../widgets/catalogue/case_conversion_sheet.dart';
import '../widgets/catalogue/case_index.dart';
import '../widgets/catalogue/cinematic_case_panel.dart';

typedef CaseStartCallback = void Function(
  MobileCaseDefinition caseDefinition,
  String locale,
  CaseCatalogBundle contentInventory,
);

/// Loads the authoritative catalogue and presentation manifest as independent
/// inputs. A visual failure resolves to the manifest repository's safe default
/// and can never block the authoritative library.
class CaseCatalogLoaderScreen extends StatefulWidget {
  const CaseCatalogLoaderScreen({
    required this.repository,
    required this.visualManifestRepository,
    required this.locale,
    required this.onLocaleChanged,
    required this.onStartCase,
    super.key,
  });

  final CaseCatalogRepository repository;
  final CaseVisualManifestRepository visualManifestRepository;
  final String locale;
  final ValueChanged<String> onLocaleChanged;
  final CaseStartCallback onStartCase;

  @override
  State<CaseCatalogLoaderScreen> createState() =>
      _CaseCatalogLoaderScreenState();
}

class _CaseCatalogLoaderScreenState extends State<CaseCatalogLoaderScreen> {
  late Future<_LoadedCatalogue> _catalogue;

  @override
  void initState() {
    super.initState();
    _catalogue = _load();
  }

  @override
  void didUpdateWidget(CaseCatalogLoaderScreen oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.repository != widget.repository ||
        oldWidget.visualManifestRepository != widget.visualManifestRepository) {
      _catalogue = _load();
    }
  }

  Future<_LoadedCatalogue> _load() async {
    final Future<CaseVisualManifest> visual =
        widget.visualManifestRepository.load();
    final CaseCatalogBundle bundle = await widget.repository.load();
    return _LoadedCatalogue(bundle: bundle, manifest: await visual);
  }

  void _retry() {
    setState(() {
      _catalogue = _load();
    });
  }

  @override
  Widget build(BuildContext context) {
    final CinematicCatalogueStrings chrome =
        CinematicCatalogueStrings.of(widget.locale);
    return FutureBuilder<_LoadedCatalogue>(
      future: _catalogue,
      builder: (
        BuildContext context,
        AsyncSnapshot<_LoadedCatalogue> snapshot,
      ) {
        if (snapshot.connectionState != ConnectionState.done) {
          return Scaffold(
            body: Center(
              child: Semantics(
                label: chrome.loadingLibrary,
                liveRegion: true,
                child: const ExcludeSemantics(
                  child: CircularProgressIndicator(),
                ),
              ),
            ),
          );
        }
        if (snapshot.hasError || !snapshot.hasData) {
          return Scaffold(
            body: SafeArea(
              child: Center(
                child: Padding(
                  padding: const EdgeInsets.all(24),
                  child: Semantics(
                    container: true,
                    liveRegion: true,
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: <Widget>[
                        const Icon(Icons.error_outline, size: 48),
                        const SizedBox(height: 16),
                        Text(
                          chrome.loadFailed,
                          textAlign: TextAlign.center,
                        ),
                        const SizedBox(height: 16),
                        FilledButton.icon(
                          key: const ValueKey<String>(
                            'catalog-retry-action',
                          ),
                          onPressed: _retry,
                          icon: const Icon(Icons.refresh),
                          label: Text(chrome.retry),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            ),
          );
        }

        final _LoadedCatalogue loaded = snapshot.requireData;
        return CaseCatalogScreen(
          bundle: loaded.bundle,
          visualManifest: loaded.manifest,
          initialLocale: widget.locale,
          onLocaleChanged: widget.onLocaleChanged,
          onStartCase: widget.onStartCase,
        );
      },
    );
  }
}

final class _LoadedCatalogue {
  const _LoadedCatalogue({required this.bundle, required this.manifest});

  final CaseCatalogBundle bundle;
  final CaseVisualManifest manifest;
}

class CaseCatalogScreen extends StatefulWidget {
  const CaseCatalogScreen({
    required this.bundle,
    required this.onStartCase,
    this.visualManifest,
    this.initialLocale,
    this.onLocaleChanged,
    super.key,
  });

  final CaseCatalogBundle bundle;
  final CaseVisualManifest? visualManifest;
  final String? initialLocale;
  final ValueChanged<String>? onLocaleChanged;
  final CaseStartCallback onStartCase;

  @override
  State<CaseCatalogScreen> createState() => _CaseCatalogScreenState();
}

class _CaseCatalogScreenState extends State<CaseCatalogScreen> {
  late String _locale;
  CaseCatalogFilter _filter = CaseCatalogFilter.all;
  String? _selectedCaseId;

  @override
  void initState() {
    super.initState();
    _locale = _supportedLocale(
      widget.initialLocale ?? widget.bundle.defaultLocale,
    );
    _selectedCaseId =
        widget.bundle.cases.isEmpty ? null : widget.bundle.cases.first.caseId;
  }

  @override
  void didUpdateWidget(CaseCatalogScreen oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.initialLocale != widget.initialLocale &&
        widget.initialLocale != null) {
      _locale = _supportedLocale(widget.initialLocale!);
    }
    if (oldWidget.bundle != widget.bundle) {
      _locale = _supportedLocale(_locale);
      _selectedCaseId = _reconciledSelection(
        _visibleCases(filter: _filter),
        _selectedCaseId,
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final List<MobileCaseDefinition> visibleCases = _visibleCases(
      filter: _filter,
    );
    final MobileCaseDefinition? selected = _selectedDefinition(visibleCases);
    final CaseVisualManifest manifest =
        widget.visualManifest ?? CaseVisualManifest.safeFallback;

    return Scaffold(
      body: CaseCatalogLayout(
        masthead: CaseCatalogMasthead(
          bundle: widget.bundle,
          locale: _locale,
          selectedFilter: _filter,
          onLocaleSelected: _setLocale,
          onFilterSelected: _setFilter,
        ),
        indexBuilder: (BuildContext context, bool wide) {
          if (visibleCases.isEmpty) {
            return const SizedBox.shrink();
          }
          return CaseIndex(
            bundle: widget.bundle,
            locale: _locale,
            cases: visibleCases,
            selectedCaseId: _selectedCaseId,
            vertical: wide,
            onSelected: _selectCase,
          );
        },
        panelBuilder: (BuildContext context, bool wide) {
          if (selected == null) {
            return _EmptyCatalogueState(
              message: widget.bundle.text(_locale, 'no_cases'),
            );
          }
          final int index = visibleCases.indexOf(selected);
          return CinematicCasePanel(
            key: const ValueKey<String>('selected-case-panel'),
            bundle: widget.bundle,
            locale: _locale,
            caseDefinition: selected,
            treatment: manifest.resolve(selected.caseId),
            index: index,
            total: visibleCases.length,
            wide: wide,
            onStart: () => widget.onStartCase(
              selected,
              _locale,
              widget.bundle,
            ),
            onDetails: () => _showDetails(selected),
          );
        },
      ),
    );
  }

  String _supportedLocale(String candidate) {
    return widget.bundle.supportedLocales.contains(candidate)
        ? candidate
        : widget.bundle.defaultLocale;
  }

  List<MobileCaseDefinition> _visibleCases({
    required CaseCatalogFilter filter,
  }) {
    return widget.bundle.cases.where((MobileCaseDefinition item) {
      return switch (filter) {
        CaseCatalogFilter.all => true,
        CaseCatalogFilter.playable => CaseRuntimeFactory.supports(item),
        CaseCatalogFilter.authoring => !CaseRuntimeFactory.supports(item),
      };
    }).toList(growable: false);
  }

  MobileCaseDefinition? _selectedDefinition(
    List<MobileCaseDefinition> visibleCases,
  ) {
    for (final MobileCaseDefinition definition in visibleCases) {
      if (definition.caseId == _selectedCaseId) {
        return definition;
      }
    }
    return null;
  }

  String? _reconciledSelection(
    List<MobileCaseDefinition> visibleCases,
    String? current,
  ) {
    if (visibleCases.any(
      (MobileCaseDefinition definition) => definition.caseId == current,
    )) {
      return current;
    }
    return visibleCases.isEmpty ? null : visibleCases.first.caseId;
  }

  void _setLocale(String locale) {
    final String supported = _supportedLocale(locale);
    if (supported == _locale) {
      return;
    }
    setState(() => _locale = supported);
    widget.onLocaleChanged?.call(supported);
  }

  void _setFilter(CaseCatalogFilter filter) {
    if (filter == _filter) {
      return;
    }
    final List<MobileCaseDefinition> nextVisible = _visibleCases(
      filter: filter,
    );
    setState(() {
      _filter = filter;
      _selectedCaseId = _reconciledSelection(
        nextVisible,
        _selectedCaseId,
      );
    });
  }

  void _selectCase(String caseId) {
    if (caseId == _selectedCaseId ||
        !_visibleCases(filter: _filter).any(
          (MobileCaseDefinition definition) => definition.caseId == caseId,
        )) {
      return;
    }
    setState(() => _selectedCaseId = caseId);
  }

  Future<void> _showDetails(MobileCaseDefinition caseDefinition) {
    return showModalBottomSheet<void>(
      context: context,
      useSafeArea: true,
      isScrollControlled: true,
      showDragHandle: true,
      builder: (BuildContext context) {
        return CaseConversionSheet(
          bundle: widget.bundle,
          locale: _locale,
          caseDefinition: caseDefinition,
        );
      },
    );
  }
}

final class _EmptyCatalogueState extends StatelessWidget {
  const _EmptyCatalogueState({required this.message});

  final String message;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      container: true,
      liveRegion: true,
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 48),
        child: Center(child: Text(message, textAlign: TextAlign.center)),
      ),
    );
  }
}
