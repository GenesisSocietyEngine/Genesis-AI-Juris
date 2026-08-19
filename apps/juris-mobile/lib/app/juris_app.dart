import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';

import '../data/case_catalog_repository.dart';
import '../data/case_runtime_factory.dart';
import '../data/game_runtime_repository.dart';
import '../data/game_save_store.dart';
import '../data/scenario_bridge_client.dart';
import '../design/juris_design.dart';
import '../living_case/living_case_visual_manifest.dart';
import '../living_case/living_case_visual_manifest_repository.dart';
import '../models/case_catalog.dart';
import '../screens/case_catalog_screen.dart';
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
    this.visualModeController,
    super.key,
  })  : catalogRepository = null,
        visualManifestRepository = null,
        livingCaseVisualManifestRepository = null,
        scenarioBridgeClient = null,
        gameSaveStore = null;

  const JurisApp.catalog({
    this.catalogRepository = const CaseCatalogRepository(),
    this.visualManifestRepository,
    this.livingCaseVisualManifestRepository,
    this.scenarioBridgeClient,
    this.gameSaveStore,
    this.visualModeController,
    super.key,
  }) : repository = null;

  final GameRuntimeRepository? repository;
  final CaseCatalogRepository? catalogRepository;
  final CaseVisualManifestRepository? visualManifestRepository;
  final LivingCaseVisualManifestRepository? livingCaseVisualManifestRepository;
  final ScenarioBridgeClient? scenarioBridgeClient;
  final GameSaveStore? gameSaveStore;
  final JurisVisualModeController? visualModeController;

  @override
  State<JurisApp> createState() => _JurisAppState();
}

class _JurisAppState extends State<JurisApp> {
  GameRuntimeRepository? _activeRepository;
  CaseVisualManifestRepository? _visualManifestRepository;
  LivingCaseVisualManifestRepository? _livingCaseVisualManifestRepository;
  Future<LivingCaseVisualManifest?>? _livingCaseVisualManifestLoad;
  MobileCaseDefinition? _activeCaseDefinition;
  String? _activeCaseId;
  String _activeLocale = 'en';
  late JurisVisualModeController _visualModeController;
  late bool _ownsVisualModeController;

  bool get _usesCatalog => widget.repository == null;

  @override
  void initState() {
    super.initState();
    _configureVisualModeController();
    _activeRepository = widget.repository;
    _activeRepository?.addListener(_handleActiveRepositoryChanged);
    _syncProjectedTime();
    if (_usesCatalog) {
      _visualManifestRepository =
          widget.visualManifestRepository ?? CaseVisualManifestRepository();
      _configureLivingCaseManifestRepository();
    }
  }

  @override
  void didUpdateWidget(JurisApp oldWidget) {
    super.didUpdateWidget(oldWidget);
    final bool previouslyUsedCatalog = oldWidget.repository == null;
    if (oldWidget.visualModeController != widget.visualModeController) {
      if (_ownsVisualModeController) {
        _visualModeController.dispose();
      }
      _configureVisualModeController();
      _syncProjectedTime();
    }
    if (!_usesCatalog && oldWidget.repository != widget.repository) {
      final GameRuntimeRepository? previousActive = _activeRepository;
      _activeRepository?.removeListener(_handleActiveRepositoryChanged);
      _activeRepository = widget.repository;
      _activeRepository?.addListener(_handleActiveRepositoryChanged);
      _syncProjectedTime();
      if (previouslyUsedCatalog &&
          previousActive != null &&
          previousActive != _activeRepository) {
        previousActive.dispose();
      }
    } else if (_usesCatalog && !previouslyUsedCatalog) {
      _activeRepository?.removeListener(_handleActiveRepositoryChanged);
      _activeRepository = null;
      _visualModeController.clearProjectedTime();
    }
    if (!_usesCatalog) {
      _visualManifestRepository = null;
      _livingCaseVisualManifestRepository = null;
      _livingCaseVisualManifestLoad = null;
    } else if (!previouslyUsedCatalog ||
        oldWidget.visualManifestRepository != widget.visualManifestRepository) {
      _visualManifestRepository =
          widget.visualManifestRepository ?? CaseVisualManifestRepository();
    }
    if (_usesCatalog &&
        (!previouslyUsedCatalog ||
            oldWidget.livingCaseVisualManifestRepository !=
                widget.livingCaseVisualManifestRepository)) {
      _configureLivingCaseManifestRepository();
    }
  }

  @override
  void dispose() {
    _activeRepository?.removeListener(_handleActiveRepositoryChanged);
    if (_usesCatalog) {
      _activeRepository?.dispose();
    }
    if (_ownsVisualModeController) {
      _visualModeController.dispose();
    }
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return ValueListenableBuilder<JurisVisualModeSelection>(
      valueListenable: _visualModeController,
      builder: (
        BuildContext context,
        JurisVisualModeSelection selection,
        Widget? child,
      ) {
        final JurisVisualMode mode = _visualModeController.resolvedMode;
        final ThemeData highContrastTheme = JurisTheme.forMode(
          mode,
          highContrast: true,
        );
        return MaterialApp(
          debugShowCheckedModeBanner: false,
          title: 'GENESIS: AI Juris',
          theme: JurisTheme.forMode(mode),
          highContrastTheme: highContrastTheme,
          highContrastDarkTheme: highContrastTheme,
          locale: Locale(_activeLocale),
          supportedLocales: const <Locale>[
            Locale('en'),
            Locale('ru'),
          ],
          localizationsDelegates: GlobalMaterialLocalizations.delegates,
          home: _buildHome(),
        );
      },
    );
  }

  Widget _buildHome() {
    final GameRuntimeRepository? activeRepository = _activeRepository;
    if (activeRepository != null) {
      final Widget Function(LivingCaseVisualManifest?) buildShell =
          (LivingCaseVisualManifest? manifest) => HomeShell(
                key: ValueKey<String?>(_activeCaseId),
                repository: activeRepository,
                locale: _activeLocale,
                caseDefinition: _activeCaseDefinition,
                livingCaseVisualManifest: manifest,
                visualModeController: _visualModeController,
                onExitToCaseCatalog: _usesCatalog ? _exitToCatalog : null,
              );
      final Future<LivingCaseVisualManifest?>? manifestLoad =
          _livingCaseVisualManifestLoad;
      if (_activeCaseDefinition != null && manifestLoad != null) {
        return FutureBuilder<LivingCaseVisualManifest?>(
          future: manifestLoad,
          builder: (
            BuildContext context,
            AsyncSnapshot<LivingCaseVisualManifest?> manifestSnapshot,
          ) =>
              buildShell(manifestSnapshot.data),
        );
      }
      return buildShell(null);
    }

    return CaseCatalogLoaderScreen(
      repository: widget.catalogRepository!,
      visualManifestRepository: _visualManifestRepository!,
      locale: _activeLocale,
      visualModeController: _visualModeController,
      onLocaleChanged: _setCatalogLocale,
      onStartCase: _startCase,
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
      _activeRepository?.removeListener(_handleActiveRepositoryChanged);
      _activeRepository = repository;
      _activeRepository!.addListener(_handleActiveRepositoryChanged);
      _activeCaseId = caseDefinition.caseId;
      _activeCaseDefinition = caseDefinition;
      _activeLocale = locale;
      _syncProjectedTime();
    });
  }

  void _exitToCatalog() {
    final GameRuntimeRepository? previous = _activeRepository;
    previous?.removeListener(_handleActiveRepositoryChanged);
    setState(() {
      _activeRepository = null;
      _activeCaseId = null;
      _activeCaseDefinition = null;
      _activeLocale = 'en';
      _visualModeController.clearProjectedTime();
    });
    previous?.dispose();
  }

  void _configureLivingCaseManifestRepository() {
    _livingCaseVisualManifestRepository =
        widget.livingCaseVisualManifestRepository ??
            LivingCaseVisualManifestRepository();
    _livingCaseVisualManifestLoad = _livingCaseVisualManifestRepository!.load();
  }

  void _configureVisualModeController() {
    final JurisVisualModeController? injected = widget.visualModeController;
    _ownsVisualModeController = injected == null;
    _visualModeController = injected ?? JurisVisualModeController();
  }

  void _handleActiveRepositoryChanged() {
    _syncProjectedTime();
  }

  void _syncProjectedTime() {
    _visualModeController.updateProjectedTimeLabel(
      _activeRepository?.snapshot.timeLabel,
    );
  }
}
