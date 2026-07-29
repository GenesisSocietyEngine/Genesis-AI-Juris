import 'package:flutter/material.dart';

import '../data/case_catalog_repository.dart';
import '../data/case_runtime_factory.dart';
import '../data/demo_game_repository.dart';
import '../models/case_catalog.dart';
import '../screens/case_catalog_screen.dart';
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
  }) : catalogRepository = null;

  const JurisApp.catalog({
    this.catalogRepository = const CaseCatalogRepository(),
    super.key,
  }) : repository = null;

  final DemoGameRepository? repository;
  final CaseCatalogRepository? catalogRepository;

  @override
  State<JurisApp> createState() => _JurisAppState();
}

class _JurisAppState extends State<JurisApp> {
  DemoGameRepository? _activeRepository;
  String? _activeCaseId;

  bool get _usesCatalog => widget.repository == null;

  @override
  void initState() {
    super.initState();
    _activeRepository = widget.repository;
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
      home: _buildHome(),
    );
  }

  Widget _buildHome() {
    final DemoGameRepository? activeRepository = _activeRepository;
    if (activeRepository != null) {
      return HomeShell(
        key: ValueKey<String?>(_activeCaseId),
        repository: activeRepository,
        onExitToCaseCatalog: _usesCatalog ? _exitToCatalog : null,
      );
    }

    return CaseCatalogLoaderScreen(
      repository: widget.catalogRepository!,
      onStartCase: _startCase,
    );
  }

  void _startCase(MobileCaseDefinition caseDefinition) {
    final DemoGameRepository repository =
        CaseRuntimeFactory.create(caseDefinition);
    setState(() {
      _activeRepository = repository;
      _activeCaseId = caseDefinition.caseId;
    });
  }

  void _exitToCatalog() {
    final DemoGameRepository? previous = _activeRepository;
    setState(() {
      _activeRepository = null;
      _activeCaseId = null;
    });
    previous?.dispose();
  }
}
