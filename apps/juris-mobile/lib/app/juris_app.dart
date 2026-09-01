import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';

import '../data/case_catalog_repository.dart';
import '../data/case_runtime_factory.dart';
import '../data/game_runtime_repository.dart';
import '../data/game_save_store.dart';
import '../data/native_scenario_bridge_client.dart';
import '../data/professional_workspace_launcher.dart';
import '../data/scenario_bridge_client.dart';
import '../data/studio_authoring_repository.dart';
import '../data/studio_draft_store.dart';
import '../models/case_catalog.dart';
import '../screens/case_catalog_screen.dart';
import '../screens/studio_wizard_screen.dart';
import '../visual_identity/case_visual_manifest_repository.dart';
import 'app_theme.dart';
import 'home_shell.dart';
import 'product_navigation.dart';

/// Root application widget.
///
/// Tests and legacy embedding may still inject one deterministic repository
/// directly. The production mobile entrypoint now uses [JurisApp.catalog], so
/// the app starts from a data-driven template catalogue and creates the correct
/// runtime only after the player selects a supported scenario.
class JurisApp extends StatefulWidget {
  const JurisApp({
    required this.repository,
    this.professionalWorkspaceLauncher =
        const AllowlistedProfessionalWorkspaceLauncher(),
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
    this.professionalWorkspaceLauncher =
        const AllowlistedProfessionalWorkspaceLauncher(),
    super.key,
  }) : repository = null;

  final GameRuntimeRepository? repository;
  final CaseCatalogRepository? catalogRepository;
  final CaseVisualManifestRepository? visualManifestRepository;
  final ScenarioBridgeClient? scenarioBridgeClient;
  final GameSaveStore? gameSaveStore;
  final StudioDraftStore? studioDraftStore;
  final ProfessionalWorkspaceLauncher professionalWorkspaceLauncher;

  @override
  State<JurisApp> createState() => _JurisAppState();
}

class _JurisAppState extends State<JurisApp> {
  final GlobalKey<NavigatorState> _navigatorKey = GlobalKey<NavigatorState>();
  final GlobalKey<ScaffoldMessengerState> _scaffoldMessengerKey =
      GlobalKey<ScaffoldMessengerState>();
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
      navigatorKey: _navigatorKey,
      scaffoldMessengerKey: _scaffoldMessengerKey,
      locale: Locale(_activeLocale),
      supportedLocales: const <Locale>[Locale('en'), Locale('ru')],
      localizationsDelegates: GlobalMaterialLocalizations.delegates,
      builder: (BuildContext context, Widget? child) {
        return JurisProductNavigationScope(
          controller: JurisProductNavigationController(
            openMyCases: _openMyCases,
            openTemplates: _openTemplates,
            openStudio: _openStudio,
            openAccount: _openAccount,
          ),
          child: child ?? const SizedBox.shrink(),
        );
      },
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

  void _openTemplates() {
    if (!_usesCatalog) {
      _showNavigationMessage(
        _activeLocale == 'ru'
            ? 'Шаблоны недоступны в этом встроенном режиме.'
            : 'Templates are unavailable in this embedded mode.',
      );
      return;
    }
    _scheduleOnRootRoute(() {
      final GameRuntimeRepository? previous = _activeRepository;
      if (previous == null && !_studioOpen) {
        return;
      }
      setState(() {
        _studioOpen = false;
        _studioRepository = null;
        _activeRepository = null;
        _activeCaseId = null;
      });
      previous?.dispose();
    });
  }

  void _openStudio() {
    _scheduleOnRootRoute(() {
      final ScenarioBridgeClient bridge =
          widget.scenarioBridgeClient ?? NativeScenarioBridgeClient();
      setState(() {
        _studioRepository = StudioAuthoringRepository(bridge);
        _studioOpen = true;
      });
    });
  }

  void _closeStudio() {
    setState(() {
      _studioOpen = false;
      _studioRepository = null;
    });
  }

  void _scheduleOnRootRoute(VoidCallback transition) {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) {
        return;
      }
      _navigatorKey.currentState?.popUntil(
        (Route<dynamic> route) => route.isFirst,
      );
      transition();
    });
  }

  void _openMyCases() {
    unawaited(
      _openProfessionalWorkspace(ProfessionalWorkspaceDestination.myCases),
    );
  }

  void _openAccount() {
    unawaited(
      _openProfessionalWorkspace(ProfessionalWorkspaceDestination.account),
    );
  }

  Future<void> _openProfessionalWorkspace(
    ProfessionalWorkspaceDestination destination,
  ) async {
    try {
      await widget.professionalWorkspaceLauncher.open(destination);
    } on ProfessionalWorkspaceLaunchException catch (error) {
      _showNavigationMessage(error.message);
    } on Object {
      _showNavigationMessage(
        _activeLocale == 'ru'
            ? 'Не удалось открыть защищённое рабочее пространство. Проверьте подключение и повторите попытку.'
            : 'The secure workspace could not be opened. Check your connection and try again.',
      );
    }
  }

  void _showNavigationMessage(String message) {
    _scaffoldMessengerKey.currentState
      ?..clearSnackBars()
      ..showSnackBar(SnackBar(content: Text(message), showCloseIcon: true));
  }
}
