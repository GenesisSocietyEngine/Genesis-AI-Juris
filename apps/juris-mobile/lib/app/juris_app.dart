import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';

import '../data/case_catalog_repository.dart';
import '../data/case_runtime_factory.dart';
import '../data/game_runtime_repository.dart';
import '../data/game_save_store.dart';
import '../data/native_scenario_bridge_client.dart';
import '../data/scenario_bridge_client.dart';
import '../data/studio_authoring_repository.dart';
import '../data/studio_draft_store.dart';
import '../models/case_catalog.dart';
import '../screens/case_catalog_screen.dart';
import '../screens/studio_wizard_screen.dart';
import '../visual_identity/case_visual_manifest_repository.dart';
import 'app_theme.dart';
import 'home_shell.dart';

/// Root application widget.
///
/// Tests and legacy embedding may still inject one deterministic repository
/// directly. The production mobile entrypoint now uses [JurisApp.catalog], so
/// the app starts from a data-driven case library and creates the correct
/// runtime only after the player selects a supported scenario.
class JurisApp extends StatefulWidget {
  const JurisApp({
    required this.repository,
    super.key,
  })  : catalogRepository = null,
        visualManifestRepository = null,
        scenarioBridgeClient = null,
        gameSaveStore = null,
        studioDraftStore = null;

  const JurisApp.catalog({
    this.catalogRepository = const CaseCatalogRepository(),
    this.visualManifestRepository,
    this.scenarioBridgeClient,
    this.gameSaveStore,
    this.studioDraftStore,
    super.key,
  }) : repository = null;

  final GameRuntimeRepository? repository;
  final CaseCatalogRepository? catalogRepository;
  final CaseVisualManifestRepository? visualManifestRepository;
  final ScenarioBridgeClient? scenarioBridgeClient;
  final GameSaveStore? gameSaveStore;
  final StudioDraftStore? studioDraftStore;

  @override
  State<JurisApp> createState() => _JurisAppState();
}

class _JurisAppState extends State<JurisApp> {
  GameRuntimeRepository? _activeRepository;
  CaseVisualManifestRepository? _visualManifestRepository;
  String? _activeCaseId;
  String _activeLocale = 'en';
  StudioAuthoringRepository? _studioRepository;
  bool _studioOpen = false;

  bool get _usesCatalog => widget.repository == null;

  @override
  void initState() {
    super.initState();
    _activeRepository = widget.repository;
    if (_usesCatalog) {
      _visualManifestRepository =
          widget.visualManifestRepository ?? CaseVisualManifestRepository();
    }
  }

  @override
  void didUpdateWidget(JurisApp oldWidget) {
    super.didUpdateWidget(oldWidget);
    final bool previouslyUsedCatalog = oldWidget.repository == null;
    if (!_usesCatalog) {
      _visualManifestRepository = null;
    } else if (!previouslyUsedCatalog ||
        oldWidget.visualManifestRepository != widget.visualManifestRepository) {
      _visualManifestRepository =
          widget.visualManifestRepository ?? CaseVisualManifestRepository();
    }
  }

  @override
  void dispose() {
    if (_usesCatalog) {
      _activeRepository?.dispose();
    }
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      debugShowCheckedModeBanner: false,
      title: 'GENESIS: AI Juris',
      theme: JurisTheme.dark(),
      locale: Locale(_activeLocale),
      supportedLocales: const <Locale>[
        Locale('en'),
        Locale('ru'),
      ],
      localizationsDelegates: GlobalMaterialLocalizations.delegates,
      home: _buildHome(),
    );
  }

  Widget _buildHome() {
    if (_studioOpen) {
      return StudioWizardScreen(
        repository: _studioRepository!,
        store: widget.studioDraftStore ?? ApplicationSupportStudioDraftStore(),
        locale: _activeLocale,
        onExit: _closeStudio,
      );
    }
    final GameRuntimeRepository? activeRepository = _activeRepository;
    if (activeRepository != null) {
      return HomeShell(
        key: ValueKey<String?>(_activeCaseId),
        repository: activeRepository,
        locale: _activeLocale,
        onExitToCaseCatalog: _usesCatalog ? _exitToCatalog : null,
      );
    }

    return CaseCatalogLoaderScreen(
      repository: widget.catalogRepository!,
      visualManifestRepository: _visualManifestRepository!,
      locale: _activeLocale,
      onLocaleChanged: _setCatalogLocale,
      onStartCase: _startCase,
      onOpenStudio: _openStudio,
    );
  }

  void _setCatalogLocale(String locale) {
    if (locale == _activeLocale) {
      return;
    }
    setState(() => _activeLocale = locale);
  }

  void _startCase(
    MobileCaseDefinition caseDefinition,
    String locale,
    CaseCatalogBundle contentInventory,
  ) {
    final GameRuntimeRepository repository = CaseRuntimeFactory.create(
      caseDefinition,
      locale: locale,
      scenarioBridgeClient: widget.scenarioBridgeClient,
      gameSaveStore: widget.gameSaveStore,
      contentInventory: contentInventory,
    );
    setState(() {
      _activeRepository = repository;
      _activeCaseId = caseDefinition.caseId;
      _activeLocale = locale;
    });
  }

  void _exitToCatalog() {
    final GameRuntimeRepository? previous = _activeRepository;
    setState(() {
      _activeRepository = null;
      _activeCaseId = null;
      _activeLocale = 'en';
    });
    previous?.dispose();
  }

  void _openStudio() {
    final ScenarioBridgeClient bridge =
        widget.scenarioBridgeClient ?? NativeScenarioBridgeClient();
    setState(() {
      _studioRepository = StudioAuthoringRepository(bridge);
      _studioOpen = true;
    });
  }

  void _closeStudio() {
    setState(() {
      _studioOpen = false;
      _studioRepository = null;
    });
  }
}
