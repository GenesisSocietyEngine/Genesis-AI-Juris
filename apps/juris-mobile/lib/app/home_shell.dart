import 'dart:async';

import 'package:flutter/material.dart';

import '../data/game_runtime_repository.dart';
import '../design/juris_design.dart';
import '../living_case/greenfire_living_case_dossier_screen.dart';
import '../living_case/greenfire_living_case_outcome_screen.dart';
import '../living_case/greenfire_living_case_workspace.dart';
import '../living_case/living_case_visual_manifest.dart';
import '../models/case_catalog.dart';
import '../models/game_snapshot.dart';
import '../presentation/inbox_presentation.dart';
import '../screens/ai_associate_screen.dart';
import '../screens/calendar_screen.dart';
import '../screens/career_screen.dart';
import '../screens/dossier_screen.dart';
import '../screens/inbox_screen.dart';
import '../screens/matter_screen.dart';
import '../screens/training_debrief_screen.dart';
import '../widgets/action_picker_sheet.dart';
import '../widgets/case_report_sheet.dart';
import '../widgets/inbox_message_sheet.dart';
import 'app_theme.dart';
import 'gameplay_locale.dart';

/// Adaptive application shell shared by phone, tablet, and desktop previews.
///
/// Below 700 logical pixels it uses a horizontally revealable destination bar.
/// Wider windows switch to [NavigationRail] without changing destination state.
class HomeShell extends StatefulWidget {
  const HomeShell({
    required this.repository,
    this.locale = 'en',
    this.caseDefinition,
    this.livingCaseVisualManifest,
    this.visualModeController,
    this.onExitToCaseCatalog,
    this.enableLiveClockInTests = false,
    super.key,
  });

  final GameRuntimeRepository repository;
  final String locale;
  final MobileCaseDefinition? caseDefinition;
  final LivingCaseVisualManifest? livingCaseVisualManifest;
  final JurisVisualModeController? visualModeController;
  final VoidCallback? onExitToCaseCatalog;
  final bool enableLiveClockInTests;

  @override
  State<HomeShell> createState() => _HomeShellState();
}

class _HomeShellState extends State<HomeShell> with WidgetsBindingObserver {
  static const bool _runningUnderFlutterTest =
      bool.fromEnvironment('FLUTTER_TEST');

  String _selectedDestinationId = 'inbox';
  Timer? _liveClockTimer;
  bool _clockPaused = false;
  bool _clockTickInProgress = false;
  bool _persistenceInProgress = false;
  int _openModalCount = 0;
  SimulationClockSpeed _clockSpeed = SimulationClockSpeed.standard;
  late JurisVisualModeController _visualModeController;
  late bool _ownsVisualModeController;

  @override
  void initState() {
    super.initState();
    _configureVisualModeController();
    WidgetsBinding.instance.addObserver(this);
    _startLiveClock();
  }

  @override
  void didUpdateWidget(covariant HomeShell oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.visualModeController != widget.visualModeController) {
      if (_ownsVisualModeController) {
        _visualModeController.dispose();
      }
      _configureVisualModeController();
    }
    if (oldWidget.repository != widget.repository) {
      _startLiveClock();
    }
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) {
      _startLiveClock();
    } else {
      _liveClockTimer?.cancel();
      _liveClockTimer = null;
    }
  }

  @override
  void dispose() {
    _liveClockTimer?.cancel();
    WidgetsBinding.instance.removeObserver(this);
    if (_ownsVisualModeController) {
      _visualModeController.dispose();
    }
    super.dispose();
  }

  void _configureVisualModeController() {
    final JurisVisualModeController? injected = widget.visualModeController;
    _ownsVisualModeController = injected == null;
    _visualModeController = injected ?? JurisVisualModeController();
  }

  void _startLiveClock() {
    _liveClockTimer?.cancel();
    _liveClockTimer = null;
    if ((_runningUnderFlutterTest && !widget.enableLiveClockInTests) ||
        _clockPaused ||
        _openModalCount > 0 ||
        !widget.repository.supportsLiveClock ||
        widget.repository.isTerminal) {
      return;
    }

    _liveClockTimer = Timer.periodic(
      _clockSpeed.tickInterval,
      (Timer timer) {
        if (!mounted ||
            _clockPaused ||
            _openModalCount > 0 ||
            _clockTickInProgress ||
            !widget.repository.supportsLiveClock ||
            widget.repository.isTerminal) {
          if (!widget.repository.supportsLiveClock ||
              widget.repository.isTerminal) {
            timer.cancel();
            _liveClockTimer = null;
          }
          return;
        }

        _clockTickInProgress = true;
        try {
          widget.repository.advanceTimeByMinutes(1);
        } on Object catch (error) {
          timer.cancel();
          _liveClockTimer = null;
          if (mounted) {
            setState(() => _clockPaused = true);
            final String message = widget.repository.clockErrorMessage ??
                'Simulation clock stopped: $error';
            ScaffoldMessenger.of(context).showSnackBar(
              SnackBar(
                content: Text(message),
                showCloseIcon: true,
              ),
            );
          }
        } finally {
          _clockTickInProgress = false;
        }
      },
    );
  }

  void _toggleClock() {
    setState(() => _clockPaused = !_clockPaused);
    _startLiveClock();
  }

  void _selectClockSpeed(SimulationClockSpeed speed) {
    if (_clockSpeed == speed) {
      return;
    }
    setState(() => _clockSpeed = speed);
    _startLiveClock();
  }

  void _setModalVisible(bool visible) {
    if (visible) {
      _openModalCount += 1;
    } else if (_openModalCount > 0) {
      _openModalCount -= 1;
    }
    if (visible) {
      _liveClockTimer?.cancel();
      _liveClockTimer = null;
    } else if (_openModalCount == 0 && mounted) {
      _startLiveClock();
    }
  }

  Future<T?> _whileClockSuspended<T>(Future<T?> Function() showModal) async {
    _setModalVisible(true);
    try {
      return await showModal();
    } finally {
      _setModalVisible(false);
    }
  }

  void _restUntilNextWorkday() {
    try {
      widget.repository.restUntilNextWorkday();
    } on Object catch (error) {
      if (!mounted) {
        return;
      }
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            '${GameplayLocale.text(context, 'Could not advance to the next workday', 'Не удалось перейти к следующему рабочему дню')}: $error',
          ),
          showCloseIcon: true,
        ),
      );
    }
  }

  List<_Destination> _destinationsFor(
    BuildContext context,
    GameSnapshot snapshot,
    InboxPresentation inboxPresentation,
  ) =>
      <_Destination>[
        _Destination(
          id: 'inbox',
          label: GameplayLocale.text(context, 'Inbox', 'Входящие'),
          semanticPurpose: GameplayLocale.text(
            context,
            'Review projected messages and required responses',
            'Просмотр сообщений и требуемых ответов',
          ),
          icon: Icons.inbox_outlined,
          selectedIcon: Icons.inbox,
          builder: () => InboxScreen(
            snapshot: snapshot,
            presentation: inboxPresentation,
            sessionClockLabel: _sessionClockLabel(context),
            onShowActions:
                snapshot.actions.isEmpty ? null : () => _showActions(snapshot),
            onMessageTap: _showInboxMessage,
            onCaseReportTap: () => _showCaseReport(snapshot),
          ),
        ),
        _Destination(
          id: 'matter',
          label: GameplayLocale.text(context, 'Matter', 'Дело'),
          semanticPurpose: GameplayLocale.text(
            context,
            'Open the current matter workspace',
            'Открыть рабочее пространство текущего дела',
          ),
          icon: Icons.gavel_outlined,
          selectedIcon: Icons.gavel,
          builder: () => _buildMatterContent(snapshot, inboxPresentation),
        ),
        _Destination(
          id: 'calendar',
          label: GameplayLocale.text(context, 'Calendar', 'Календарь'),
          semanticPurpose: GameplayLocale.text(
            context,
            'Review projected deadlines and work periods',
            'Просмотр сроков и рабочих периодов',
          ),
          icon: Icons.event_outlined,
          selectedIcon: Icons.event,
          builder: () => CalendarScreen(
            snapshot: snapshot,
            onRestUntilNextWorkday: widget.repository.supportsLiveClock &&
                    !widget.repository.isTerminal
                ? _restUntilNextWorkday
                : null,
            onModalVisibilityChanged: _setModalVisible,
            onOpenRelatedAction: (String actionId) => _showActions(
              snapshot,
              onlyActionId: actionId,
            ),
          ),
        ),
        _Destination(
          id: 'ai',
          label: 'AI',
          semanticPurpose: GameplayLocale.text(
            context,
            'Open the AI associate workspace',
            'Открыть рабочее пространство ИИ-ассистента',
          ),
          icon: Icons.auto_awesome_outlined,
          selectedIcon: Icons.auto_awesome,
          builder: () => AiAssociateScreen(
            snapshot: snapshot,
            onShowActions: () => _showActions(snapshot, aiOnly: true),
          ),
        ),
        _Destination(
          id: 'career',
          label: GameplayLocale.text(context, 'Career', 'Карьера'),
          semanticPurpose: GameplayLocale.text(
            context,
            'Review projected career progress',
            'Просмотр прогресса карьеры',
          ),
          icon: Icons.account_circle_outlined,
          selectedIcon: Icons.account_circle,
          builder: () => CareerScreen(snapshot: snapshot),
        ),
      ];

  @override
  Widget build(BuildContext context) {
    return ValueListenableBuilder<JurisVisualModeSelection>(
      valueListenable: _visualModeController,
      builder: (
        BuildContext context,
        JurisVisualModeSelection selection,
        Widget? child,
      ) {
        return _buildShell(context, selection);
      },
    );
  }

  Widget _buildShell(
    BuildContext context,
    JurisVisualModeSelection selection,
  ) {
    return ListenableBuilder(
      listenable: widget.repository,
      builder: (BuildContext context, Widget? child) {
        final GameSnapshot snapshot = widget.repository.snapshot;
        final InboxPresentation inboxPresentation =
            InboxPresentation.from(snapshot.inbox);
        final JurisVisualMode resolvedMode = JurisVisualModeResolver.resolve(
          selection: selection,
          projectedTimeLabel: snapshot.timeLabel,
        );
        return Theme(
          data: JurisTheme.forMode(
            resolvedMode,
            highContrast: MediaQuery.highContrastOf(context),
          ),
          child: GameplayLocale(
            locale: widget.locale,
            child: LayoutBuilder(
              builder: (BuildContext context, BoxConstraints constraints) {
                final List<_Destination> destinations = _destinationsFor(
                  context,
                  snapshot,
                  inboxPresentation,
                );
                final int selectedIndex = destinations.indexWhere(
                  (_Destination destination) =>
                      destination.id == _selectedDestinationId,
                );
                final int effectiveSelectedIndex =
                    selectedIndex < 0 ? 0 : selectedIndex;
                final _Destination selectedDestination =
                    destinations[effectiveSelectedIndex];
                final bool useRail = constraints.maxWidth >= 700;
                final Widget content = selectedDestination.builder();
                final bool isGreenFireLivingCase =
                    widget.caseDefinition != null &&
                        widget.livingCaseVisualManifest != null &&
                        widget.livingCaseVisualManifest!.supportsCase(
                          widget.caseDefinition!.caseId,
                        );
                final bool contentOwnsContext =
                    selectedDestination.id == 'inbox' ||
                        (isGreenFireLivingCase &&
                            selectedDestination.id == 'matter');
                final JurisTypography typography =
                    Theme.of(context).extension<JurisTypography>() ??
                        JurisTypography.standard;
                final JurisSurfaces surfaces =
                    Theme.of(context).extension<JurisSurfaces>() ??
                        JurisSurfaces.dark;

                return Scaffold(
                  appBar: AppBar(
                    toolbarHeight: 52,
                    leading: widget.onExitToCaseCatalog == null
                        ? null
                        : IconButton(
                            tooltip: GameplayLocale.text(
                              context,
                              'Back to case library',
                              'Назад в библиотеку дел',
                            ),
                            onPressed: _persistenceInProgress
                                ? null
                                : widget.onExitToCaseCatalog,
                            icon: const Icon(Icons.arrow_back),
                          ),
                    title: Text(
                      'GENESIS: JURIS',
                      maxLines: 1,
                      style: typography.controlLabel.copyWith(
                        color: surfaces.ink,
                        fontWeight: FontWeight.w700,
                        letterSpacing: 0.7,
                      ),
                    ),
                    actions: <Widget>[
                      IconButton(
                        key: const ValueKey<String>('session-controls-button'),
                        tooltip: GameplayLocale.text(
                          context,
                          'Session controls',
                          'Управление сеансом',
                        ),
                        onPressed: _persistenceInProgress
                            ? null
                            : () => _showSessionControls(snapshot),
                        icon: _persistenceInProgress
                            ? const Icon(Icons.hourglass_top)
                            : const Icon(Icons.tune),
                      ),
                      const SizedBox(width: 8),
                    ],
                  ),
                  body: AbsorbPointer(
                    absorbing: _persistenceInProgress,
                    child: useRail
                        ? Row(
                            children: <Widget>[
                              NavigationRail(
                                key: const ValueKey<String>(
                                  'professional-wide-navigation',
                                ),
                                selectedIndex: effectiveSelectedIndex,
                                onDestinationSelected: _persistenceInProgress
                                    ? null
                                    : (int index) => _selectDestination(
                                          destinations[index].id,
                                        ),
                                labelType: NavigationRailLabelType.all,
                                destinations: destinations
                                    .map(
                                      (_Destination destination) =>
                                          NavigationRailDestination(
                                        icon: _NavigationRailFocusIndicator(
                                          key: ValueKey<String>(
                                            'wide-destination-focus-${destination.id}',
                                          ),
                                          child: _navigationIcon(
                                            destination.icon,
                                            destination.id,
                                            inboxPresentation
                                                .attentionRequiredCount,
                                          ),
                                        ),
                                        selectedIcon:
                                            _NavigationRailFocusIndicator(
                                          key: ValueKey<String>(
                                            'wide-destination-focus-${destination.id}',
                                          ),
                                          child: _navigationIcon(
                                            destination.selectedIcon,
                                            destination.id,
                                            inboxPresentation
                                                .attentionRequiredCount,
                                          ),
                                        ),
                                        label: Semantics(
                                          key: ValueKey<String>(
                                            'wide-destination-${destination.id}',
                                          ),
                                          label: destination.label,
                                          hint: destination.semanticPurpose,
                                          selected: destination.id ==
                                              _selectedDestinationId,
                                          child: ExcludeSemantics(
                                            child: Text(destination.label),
                                          ),
                                        ),
                                      ),
                                    )
                                    .toList(growable: false),
                              ),
                              const VerticalDivider(width: 1),
                              Expanded(
                                child: contentOwnsContext
                                    ? content
                                    : Column(
                                        children: <Widget>[
                                          _SessionIdentityHeader(
                                            destinationLabel:
                                                selectedDestination.label,
                                            matterTitle: snapshot.matterTitle,
                                            dayLabel: snapshot.dayLabel,
                                            timeLabel: snapshot.timeLabel,
                                            stage: snapshot.stage,
                                            clockLabel:
                                                _sessionClockLabel(context),
                                          ),
                                          const Divider(height: 1),
                                          Expanded(child: content),
                                        ],
                                      ),
                              ),
                            ],
                          )
                        : contentOwnsContext
                            ? content
                            : Column(
                                children: <Widget>[
                                  _SessionIdentityHeader(
                                    destinationLabel: selectedDestination.label,
                                    matterTitle: snapshot.matterTitle,
                                    dayLabel: snapshot.dayLabel,
                                    timeLabel: snapshot.timeLabel,
                                    stage: snapshot.stage,
                                    clockLabel: _sessionClockLabel(context),
                                  ),
                                  const Divider(height: 1),
                                  Expanded(child: content),
                                ],
                              ),
                  ),
                  bottomNavigationBar: useRail
                      ? null
                      : _CompactDestinationBar(
                          key: const ValueKey<String>(
                            'professional-compact-navigation',
                          ),
                          selectedDestinationId: _selectedDestinationId,
                          enabled: !_persistenceInProgress,
                          destinations: destinations
                              .map(
                                (_Destination destination) =>
                                    _CompactDestination(
                                  id: destination.id,
                                  label: destination.label,
                                  semanticPurpose: destination.semanticPurpose,
                                  icon: _navigationIcon(
                                    destination.id == _selectedDestinationId
                                        ? destination.selectedIcon
                                        : destination.icon,
                                    destination.id,
                                    inboxPresentation.attentionRequiredCount,
                                  ),
                                ),
                              )
                              .toList(growable: false),
                          onSelected: _selectDestination,
                        ),
                  floatingActionButton: contentOwnsContext ||
                          snapshot.actions.isEmpty ||
                          _persistenceInProgress
                      ? null
                      : FloatingActionButton.extended(
                          key: const ValueKey<String>(
                            'available-decisions-control',
                          ),
                          tooltip: GameplayLocale.text(
                            context,
                            'Available decisions: ${snapshot.actions.length}',
                            'Доступно решений: ${snapshot.actions.length}',
                          ),
                          onPressed: () => _showActions(snapshot),
                          icon: const Icon(
                              Icons.playlist_add_check_circle_outlined),
                          label: Text(
                            '${GameplayLocale.text(context, 'Decisions', 'Решения')}'
                            ' · ${snapshot.actions.length}',
                          ),
                        ),
                );
              },
            ),
          ),
        );
      },
    );
  }

  Widget _buildMatterContent(
    GameSnapshot snapshot,
    InboxPresentation inboxPresentation,
  ) {
    final MobileCaseDefinition? caseDefinition = widget.caseDefinition;
    final LivingCaseVisualManifest? manifest = widget.livingCaseVisualManifest;
    if (caseDefinition != null &&
        manifest != null &&
        manifest.supportsCase(caseDefinition.caseId)) {
      return GreenFireLivingCaseWorkspace(
        snapshot: snapshot,
        caseDefinition: caseDefinition,
        manifest: manifest,
        locale: widget.locale,
        inboxPresentation: inboxPresentation,
        sessionClockLabel: _sessionClockLabel(context),
        onShowActions: () => _showActions(snapshot),
        onShowDossier: () => _showDossier(snapshot),
        onShowTrainingDebrief: () => _showTrainingDebrief(snapshot),
        onShowPressureResponses: (List<String> actionIds) => _showActions(
          snapshot,
          onlyActionIds: actionIds,
        ),
      );
    }
    return MatterScreen(
      snapshot: snapshot,
      onShowActions: () => _showActions(snapshot),
      onShowDossier: () => _showDossier(snapshot),
      onShowTrainingDebrief: () => _showTrainingDebrief(snapshot),
      onShowPressureResponses: (List<String> actionIds) => _showActions(
        snapshot,
        onlyActionIds: actionIds,
      ),
    );
  }

  Widget _navigationIcon(
    IconData icon,
    String destinationId,
    int attentionRequiredCount,
  ) {
    if (destinationId != 'inbox' || attentionRequiredCount == 0) {
      return Icon(icon);
    }
    return Badge(
      label: Text('$attentionRequiredCount'),
      child: Icon(icon),
    );
  }

  void _selectDestination(String destinationId) {
    if (destinationId == _selectedDestinationId) {
      return;
    }
    setState(() => _selectedDestinationId = destinationId);
  }

  String _sessionClockLabel(BuildContext context) {
    if (!widget.repository.supportsLiveClock || widget.repository.isTerminal) {
      return GameplayLocale.text(
        context,
        'Action-driven clock',
        'Часы по действиям',
      );
    }
    final String state = _clockPaused
        ? GameplayLocale.text(context, 'Paused', 'Пауза')
        : GameplayLocale.text(context, 'Running', 'Идут');
    return '$state · ${_clockSpeed.label}';
  }

  Future<void> _showSessionControls(GameSnapshot snapshot) async {
    final JurisVisualMode resolvedMode = JurisVisualModeResolver.resolve(
      selection: _visualModeController.selection,
      projectedTimeLabel: snapshot.timeLabel,
    );
    final Object? result = await _whileClockSuspended<Object>(
      () => showModalBottomSheet<Object>(
        context: context,
        useSafeArea: true,
        isScrollControlled: true,
        showDragHandle: true,
        builder: (BuildContext sheetContext) => GameplayLocale(
          locale: widget.locale,
          child: _SessionControlsSurface(
            dayLabel: snapshot.dayLabel,
            timeLabel: snapshot.timeLabel,
            stage: snapshot.stage,
            clockSupported: widget.repository.supportsLiveClock &&
                !widget.repository.isTerminal,
            persistenceSupported: widget.repository.supportsPersistence,
            persistenceInProgress: _persistenceInProgress,
            clockPaused: _clockPaused,
            clockSpeed: _clockSpeed,
            visualModeSelection: _visualModeController.selection,
            resolvedVisualMode: resolvedMode,
          ),
        ),
      ),
    );

    if (result == null || !mounted) {
      return;
    }
    switch (result) {
      case final SimulationClockSpeed speed:
        _selectClockSpeed(speed);
      case final JurisVisualModeSelection selection:
        _visualModeController.selection = selection;
      case _SessionCommand.toggleClock:
        _toggleClock();
      case _SessionCommand.reset:
        await _confirmReset();
      case _PersistenceAction.save:
        await _saveGame();
      case _PersistenceAction.load:
        await _confirmLoadGame();
      default:
        break;
    }
  }

  Future<void> _showInboxMessage(InboxItemView item) async {
    // Opening an informational message consumes its unread state immediately.
    // Action-required messages remain unresolved until the mapped gameplay
    // response is actually completed.
    widget.repository.markInboxItemRead(item.id);
    final GameSnapshot currentSnapshot = widget.repository.snapshot;
    final InboxItemView currentItem = currentSnapshot.inbox.firstWhere(
      (InboxItemView candidate) => candidate.id == item.id,
      orElse: () => item,
    );
    final List<GameActionView> actions = _actionsForInboxItem(
      currentSnapshot,
      currentItem,
    );
    final String? actionId = await _whileClockSuspended<String>(
      () => showModalBottomSheet<String>(
        context: context,
        useSafeArea: true,
        isScrollControlled: true,
        showDragHandle: true,
        builder: (BuildContext context) => InboxMessageSheet(
          item: currentItem,
          actions: actions,
          settlementOffer: currentItem.id == 'settlement-offer'
              ? currentSnapshot.settlementOffer
              : null,
        ),
      ),
    );

    if (actionId == null || !mounted) {
      return;
    }

    final ActionExecutionResult result =
        widget.repository.applyAction(actionId);
    if (!mounted) {
      return;
    }
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text('${result.title}: ${result.message}'),
        showCloseIcon: true,
      ),
    );
  }

  List<GameActionView> _actionsForInboxItem(
    GameSnapshot snapshot,
    InboxItemView item,
  ) {
    if (item.resolutionActionIds.isNotEmpty) {
      final Set<String> projectedActionIds = item.resolutionActionIds.toSet();
      return snapshot.actions
          .where(
            (GameActionView action) => projectedActionIds.contains(action.id),
          )
          .toList(growable: false);
    }

    // Backward-compatible presentation fallback for older snapshots that do
    // not yet project scenario-defined inbox/action relationships.
    final Set<String> actionIds;
    if (item.id.startsWith('judgment-day-')) {
      actionIds = <String>{'inform-client-judgment'};
    } else if (item.id.startsWith('counterparty-cassation-')) {
      actionIds = <String>{'prepare-cassation-response'};
    } else if (item.id.startsWith('client-review-options-') ||
        item.id == 'appeal-advice-request') {
      actionIds = <String>{'prepare-appeal-advice'};
    } else if (item.id == 'appeal-client-instructions') {
      actionIds = <String>{
        'seek-client-appeal-authorization',
        'accept-judgment-and-close',
      };
    } else if (item.id == 'cassation-assessment-request') {
      actionIds = <String>{'assess-cassation-grounds'};
    } else if (item.id == 'cassation-client-instructions') {
      actionIds = <String>{
        'seek-client-cassation-authorization',
        'accept-appellate-judgment',
      };
    } else if (item.id.startsWith('expert-report-ready')) {
      actionIds = <String>{'review-expert-report'};
    } else if (item.id == 'junior-findings-ready') {
      actionIds = <String>{'review-junior-findings'};
    } else {
      actionIds = switch (item.id) {
        'opening-request' => <String>{
            'run-conflict-check',
            'accept-immediately',
          },
        'cfo-pressure' => <String>{'reply-cfo'},
        'proceedings-commenced' => <String>{'prepare-statement-of-claim'},
        'settlement-offer' => <String>{
            'future-settle',
            'reject-settlement',
          },
        _ => const <String>{},
      };
    }

    return snapshot.actions
        .where((GameActionView action) => actionIds.contains(action.id))
        .toList(growable: false);
  }

  Future<void> _showCaseReport(GameSnapshot snapshot) async {
    final CaseOutcomeSummaryView? summary = snapshot.outcomeSummary;
    if (!snapshot.isClosed || summary == null) {
      return;
    }

    await _whileClockSuspended<void>(
      () => showModalBottomSheet<void>(
        context: context,
        useSafeArea: true,
        isScrollControlled: true,
        showDragHandle: true,
        builder: (BuildContext context) => CaseReportSheet(
          snapshot: snapshot,
          summary: summary,
        ),
      ),
    );
  }

  Future<void> _showDossier(GameSnapshot snapshot) async {
    final dossier = snapshot.dossier;
    if (dossier == null) {
      return;
    }

    final String? actionId = await _whileClockSuspended<String>(
      () => Navigator.of(context).push<String>(
        MaterialPageRoute<String>(
          builder: (BuildContext routeContext) {
            final MobileCaseDefinition? definition = widget.caseDefinition;
            final LivingCaseVisualManifest? manifest =
                widget.livingCaseVisualManifest;
            return GameplayLocale(
              locale: widget.locale,
              child: definition != null &&
                      manifest != null &&
                      manifest.supportsCase(definition.caseId)
                  ? GreenFireLivingCaseDossierScreen(
                      dossier: dossier,
                      treatment: manifest.caseTreatment,
                      locale: widget.locale,
                    )
                  : DossierScreen(
                      dossier: dossier,
                      locale: widget.locale,
                    ),
            );
          },
        ),
      ),
    );

    if (actionId == null || !mounted) {
      return;
    }
    await _showActions(
      widget.repository.snapshot,
      onlyActionId: actionId,
    );
  }

  Future<void> _showTrainingDebrief(GameSnapshot snapshot) async {
    final debrief = snapshot.trainingDebrief;
    if (debrief == null) {
      return;
    }

    final TrainingDebriefNavigationAction? result =
        await _whileClockSuspended<TrainingDebriefNavigationAction>(
      () => Navigator.of(context).push<TrainingDebriefNavigationAction>(
        MaterialPageRoute<TrainingDebriefNavigationAction>(
          builder: (BuildContext routeContext) {
            final MobileCaseDefinition? definition = widget.caseDefinition;
            final LivingCaseVisualManifest? manifest =
                widget.livingCaseVisualManifest;
            final LivingCaseOutcomeTreatment? outcomeTreatment =
                definition != null &&
                        manifest != null &&
                        manifest.supportsCase(definition.caseId) &&
                        debrief.scenarioId == definition.scenarioId
                    ? manifest.outcomeTreatment(debrief.resolvedOutcomeId)
                    : null;
            return GameplayLocale(
              locale: widget.locale,
              child: outcomeTreatment == null
                  ? TrainingDebriefScreen(
                      debrief: debrief,
                      locale: widget.locale,
                    )
                  : GreenFireLivingCaseOutcomeScreen(
                      debrief: debrief,
                      treatment: manifest!.caseTreatment,
                      outcomeTreatment: outcomeTreatment,
                      locale: widget.locale,
                    ),
            );
          },
        ),
      ),
    );

    if (result == TrainingDebriefNavigationAction.replay && mounted) {
      await _confirmReset();
    }
  }

  Future<void> _showActions(
    GameSnapshot snapshot, {
    bool aiOnly = false,
    String? onlyActionId,
    List<String>? onlyActionIds,
  }) async {
    final List<GameActionView> actions = onlyActionIds != null
        ? onlyActionIds
            .expand(
              (String actionId) => snapshot.actions
                  .where((GameActionView action) => action.id == actionId)
                  .take(1),
            )
            .toList(growable: false)
        : onlyActionId != null
            ? snapshot.actions
                .where(
                  (GameActionView action) => action.id == onlyActionId,
                )
                .toList(growable: false)
            : aiOnly
                ? snapshot.actions
                    .where(
                      (GameActionView action) =>
                          action.presentationTags.contains('ai') ||
                          action.title.toLowerCase().contains('ai associate'),
                    )
                    .toList(growable: false)
                : snapshot.actions;

    if (actions.isEmpty) {
      if (!mounted) {
        return;
      }
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            GameplayLocale.text(
              context,
              'No matching actions are available now.',
              'Подходящие действия сейчас недоступны.',
            ),
          ),
        ),
      );
      return;
    }

    final String? actionId = await _whileClockSuspended<String>(
      () => showModalBottomSheet<String>(
        context: context,
        useSafeArea: true,
        isScrollControlled: true,
        showDragHandle: true,
        builder: (BuildContext context) => ActionPickerSheet(
          actions: actions,
          locale: widget.locale,
        ),
      ),
    );

    if (actionId == null || !mounted) {
      return;
    }

    final ActionExecutionResult result =
        widget.repository.applyAction(actionId);
    if (!mounted) {
      return;
    }
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text('${result.title}: ${result.message}'),
        showCloseIcon: true,
      ),
    );
  }

  Future<void> _confirmReset() async {
    final bool? confirmed = await _whileClockSuspended<bool>(
      () => showDialog<bool>(
        context: context,
        builder: (BuildContext context) => AlertDialog(
          title: Text(
            GameplayLocale.text(
              context,
              'Reset playtest?',
              'Сбросить прохождение?',
            ),
          ),
          content: Text(
            GameplayLocale.of(context) == 'ru'
                ? 'Сценарий ${widget.repository.snapshot.matterTitle} начнётся '
                    'заново в День 1 · 08:00 с seed '
                    '${widget.repository.snapshot.seed}.'
                : 'This restarts ${widget.repository.snapshot.matterTitle} at '
                    'Day 1 · 08:00 with seed '
                    '${widget.repository.snapshot.seed}.',
          ),
          actions: <Widget>[
            TextButton(
              onPressed: () => Navigator.pop(context, false),
              child: Text(
                GameplayLocale.text(context, 'Cancel', 'Отмена'),
              ),
            ),
            FilledButton(
              onPressed: () => Navigator.pop(context, true),
              child: Text(
                GameplayLocale.text(context, 'Reset', 'Сбросить'),
              ),
            ),
          ],
        ),
      ),
    );

    if (confirmed == true) {
      widget.repository.reset();
      setState(() {
        _clockPaused = false;
        _clockSpeed = SimulationClockSpeed.standard;
      });
      _startLiveClock();
    }
  }

  Future<void> _saveGame() async {
    if (_persistenceInProgress) {
      return;
    }
    setState(() => _persistenceInProgress = true);
    _setModalVisible(true);
    try {
      await widget.repository.saveGame();
      if (!mounted) {
        return;
      }
      ScaffoldMessenger.of(context)
        ..clearSnackBars()
        ..showSnackBar(
          SnackBar(
            content: Text(
              _localized(
                'Game saved successfully.',
                'Игра успешно сохранена.',
              ),
            ),
            showCloseIcon: true,
          ),
        );
    } on GamePersistenceException catch (error) {
      _showPersistenceError(error);
    } on Object catch (error) {
      _showPersistenceError(
        GamePersistenceException(
          code: 'save_failed',
          message: error.toString(),
        ),
      );
    } finally {
      if (mounted) {
        setState(() => _persistenceInProgress = false);
      }
      _setModalVisible(false);
    }
  }

  Future<void> _confirmLoadGame() async {
    if (_persistenceInProgress) {
      return;
    }
    setState(() => _persistenceInProgress = true);
    _setModalVisible(true);
    try {
      final bool? confirmed = await showDialog<bool>(
        context: context,
        builder: (BuildContext context) => AlertDialog(
          title: Text(
            _localized(
              'Load saved game?',
              'Загрузить сохранённую игру?',
            ),
          ),
          content: Text(
            _localized(
              'Current unsaved progress will be replaced only after the saved game passes compatibility and integrity checks.',
              'Текущий несохранённый прогресс будет заменён только после проверки совместимости и целостности сохранения.',
            ),
          ),
          actions: <Widget>[
            TextButton(
              key: const ValueKey<String>('cancel-load-game'),
              onPressed: () => Navigator.pop(context, false),
              child: Text(
                _localized('Cancel', 'Отмена'),
              ),
            ),
            FilledButton(
              key: const ValueKey<String>('confirm-load-game'),
              onPressed: () => Navigator.pop(context, true),
              child: Text(
                _localized('Load', 'Загрузить'),
              ),
            ),
          ],
        ),
      );
      if (confirmed != true) {
        return;
      }

      await widget.repository.loadGame();
      if (!mounted) {
        return;
      }
      ScaffoldMessenger.of(context)
        ..clearSnackBars()
        ..showSnackBar(
          SnackBar(
            content: Text(
              _localized(
                'Saved game loaded.',
                'Сохранённая игра загружена.',
              ),
            ),
            showCloseIcon: true,
          ),
        );
    } on GamePersistenceException catch (error) {
      _showPersistenceError(error);
    } on Object catch (error) {
      _showPersistenceError(
        GamePersistenceException(
          code: 'load_failed',
          message: error.toString(),
        ),
      );
    } finally {
      if (mounted) {
        setState(() => _persistenceInProgress = false);
      }
      _setModalVisible(false);
    }
  }

  void _showPersistenceError(GamePersistenceException error) {
    if (!mounted) {
      return;
    }
    final bool russian = widget.locale == 'ru';
    final String message = switch (error.code) {
      'save_not_found' =>
        russian ? 'Сохранённая игра не найдена.' : 'No saved game was found.',
      'unknown_save_schema' ||
      'unknown_save_schema_version' ||
      'incompatible_runtime' ||
      'unknown_save_scenario' ||
      'scenario_fingerprint_mismatch' =>
        russian
            ? 'Сохранение несовместимо с текущей версией сценария.'
            : 'The save is incompatible with this scenario version.',
      'invalid_save_json' ||
      'unknown_save_command' ||
      'unknown_save_action' ||
      'invalid_save_time_advance' ||
      'illegal_save_command_sequence' ||
      'save_integrity_mismatch' =>
        russian
            ? 'Сохранение повреждено и не было загружено.'
            : 'The save is corrupted and was not loaded.',
      _ => error.message,
    };
    ScaffoldMessenger.of(context)
      ..clearSnackBars()
      ..showSnackBar(
        SnackBar(
          content: Text(message),
          showCloseIcon: true,
        ),
      );
  }

  String _localized(String english, String russian) =>
      widget.locale == 'ru' ? russian : english;
}

enum _PersistenceAction { save, load }

enum _SessionCommand { toggleClock, reset }

class _Destination {
  const _Destination({
    required this.id,
    required this.label,
    required this.semanticPurpose,
    required this.icon,
    required this.selectedIcon,
    required this.builder,
  });

  final String id;
  final String label;
  final String semanticPurpose;
  final IconData icon;
  final IconData selectedIcon;
  final Widget Function() builder;
}

class _NavigationRailFocusIndicator extends StatelessWidget {
  const _NavigationRailFocusIndicator({
    required this.child,
    super.key,
  });

  final Widget child;

  @override
  Widget build(BuildContext context) {
    final bool focused = Focus.of(context).hasFocus;
    return JurisFocusOutline(
      focused: focused,
      child: Padding(
        padding: const EdgeInsets.all(2),
        child: child,
      ),
    );
  }
}

class _SessionIdentityHeader extends StatelessWidget {
  const _SessionIdentityHeader({
    required this.destinationLabel,
    required this.matterTitle,
    required this.dayLabel,
    required this.timeLabel,
    required this.stage,
    required this.clockLabel,
  });

  final String destinationLabel;
  final String matterTitle;
  final String dayLabel;
  final String timeLabel;
  final String stage;
  final String clockLabel;

  @override
  Widget build(BuildContext context) {
    final ThemeData theme = Theme.of(context);
    final JurisSpacing spacing =
        theme.extension<JurisSpacing>() ?? JurisSpacing.standard;
    final JurisDensity density =
        theme.extension<JurisDensity>() ?? JurisDensity.standard;
    final JurisTypography typography =
        theme.extension<JurisTypography>() ?? JurisTypography.standard;
    return LayoutBuilder(
      builder: (BuildContext context, BoxConstraints constraints) {
        final JurisDensityMetrics metrics = density.resolve(
          constraints.maxWidth >= 700
              ? JurisDensityMode.comfortable
              : JurisDensityMode.compact,
        );
        return Semantics(
          container: true,
          header: true,
          excludeSemantics: true,
          label: '$destinationLabel. $matterTitle. '
              '$dayLabel, $timeLabel, $stage. $clockLabel.',
          child: Padding(
            key: const ValueKey<String>('professional-session-header'),
            padding: EdgeInsets.symmetric(
              horizontal: constraints.maxWidth >= 700
                  ? spacing.wideGutter
                  : spacing.compactGutter,
              vertical: metrics.contentInset,
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: <Widget>[
                Text(
                  destinationLabel,
                  style: typography.screenDisplay.copyWith(
                    color: theme.colorScheme.onSurface,
                  ),
                ),
                SizedBox(height: metrics.sectionRhythm / 2),
                Text(
                  matterTitle,
                  style: typography.bodyCompact.copyWith(
                    color: theme.colorScheme.onSurfaceVariant,
                    fontWeight: FontWeight.w600,
                  ),
                ),
                SizedBox(height: metrics.sectionRhythm),
                Wrap(
                  spacing: spacing.md,
                  runSpacing: spacing.xs,
                  children: <Widget>[
                    _SessionMetadataLabel(
                      icon: Icons.calendar_today_outlined,
                      label: dayLabel,
                    ),
                    _SessionMetadataLabel(
                      icon: Icons.schedule,
                      label: timeLabel,
                    ),
                    _SessionMetadataLabel(
                      icon: Icons.account_tree_outlined,
                      label: stage,
                    ),
                    _SessionMetadataLabel(
                      icon: Icons.speed,
                      label: clockLabel,
                    ),
                  ],
                ),
              ],
            ),
          ),
        );
      },
    );
  }
}

class _SessionMetadataLabel extends StatelessWidget {
  const _SessionMetadataLabel({required this.icon, required this.label});

  final IconData icon;
  final String label;

  @override
  Widget build(BuildContext context) {
    final ThemeData theme = Theme.of(context);
    final JurisTypography typography =
        theme.extension<JurisTypography>() ?? JurisTypography.standard;
    return Semantics(
      label: label,
      child: ExcludeSemantics(
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: <Widget>[
            Icon(icon, size: 16, color: theme.colorScheme.onSurfaceVariant),
            const SizedBox(width: 4),
            Flexible(
              child: Text(
                label,
                style: typography.timestamp.copyWith(
                  color: theme.colorScheme.onSurfaceVariant,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _CompactDestination {
  const _CompactDestination({
    required this.id,
    required this.label,
    required this.semanticPurpose,
    required this.icon,
  });

  final String id;
  final String label;
  final String semanticPurpose;
  final Widget icon;
}

class _CompactDestinationBar extends StatefulWidget {
  const _CompactDestinationBar({
    required this.destinations,
    required this.selectedDestinationId,
    required this.enabled,
    required this.onSelected,
    super.key,
  });

  final List<_CompactDestination> destinations;
  final String selectedDestinationId;
  final bool enabled;
  final ValueChanged<String> onSelected;

  @override
  State<_CompactDestinationBar> createState() => _CompactDestinationBarState();
}

class _CompactDestinationBarState extends State<_CompactDestinationBar> {
  final Map<String, GlobalKey> _destinationKeys = <String, GlobalKey>{};

  @override
  void initState() {
    super.initState();
    _scheduleSelectedReveal();
  }

  @override
  void didUpdateWidget(covariant _CompactDestinationBar oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.selectedDestinationId != widget.selectedDestinationId) {
      _scheduleSelectedReveal();
    }
  }

  void _scheduleSelectedReveal() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final BuildContext? selectedContext =
          _destinationKeys[widget.selectedDestinationId]?.currentContext;
      if (!mounted || selectedContext == null) {
        return;
      }
      Scrollable.ensureVisible(
        selectedContext,
        alignment: 0.5,
        duration: Duration.zero,
      );
    });
  }

  @override
  Widget build(BuildContext context) {
    final ThemeData theme = Theme.of(context);
    final JurisSpacing spacing =
        theme.extension<JurisSpacing>() ?? JurisSpacing.standard;
    return Material(
      color: theme.colorScheme.surfaceContainerLow,
      child: SafeArea(
        top: false,
        child: Semantics(
          container: true,
          label: GameplayLocale.text(
            context,
            'Primary destinations',
            'Основные разделы',
          ),
          child: FocusTraversalGroup(
            policy: OrderedTraversalPolicy(),
            child: SingleChildScrollView(
              key: const ValueKey<String>('compact-destination-scroll'),
              scrollDirection: Axis.horizontal,
              padding: EdgeInsets.symmetric(horizontal: spacing.xs),
              child: Row(
                children: <Widget>[
                  for (int index = 0;
                      index < widget.destinations.length;
                      index++)
                    FocusTraversalOrder(
                      order: NumericFocusOrder(index.toDouble()),
                      child: KeyedSubtree(
                        key: _destinationKeys.putIfAbsent(
                          widget.destinations[index].id,
                          GlobalKey.new,
                        ),
                        child: _CompactDestinationButton(
                          destination: widget.destinations[index],
                          selected: widget.destinations[index].id ==
                              widget.selectedDestinationId,
                          enabled: widget.enabled,
                          onSelected: widget.onSelected,
                        ),
                      ),
                    ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _CompactDestinationButton extends StatelessWidget {
  const _CompactDestinationButton({
    required this.destination,
    required this.selected,
    required this.enabled,
    required this.onSelected,
  });

  final _CompactDestination destination;
  final bool selected;
  final bool enabled;
  final ValueChanged<String> onSelected;

  @override
  Widget build(BuildContext context) {
    final ThemeData theme = Theme.of(context);
    final JurisSpacing spacing =
        theme.extension<JurisSpacing>() ?? JurisSpacing.standard;
    final JurisTypography typography =
        theme.extension<JurisTypography>() ?? JurisTypography.standard;
    return Builder(
      builder: (BuildContext itemContext) => Semantics(
        key: ValueKey<String>('compact-destination-${destination.id}'),
        button: true,
        selected: selected,
        enabled: enabled,
        label: destination.label,
        hint: destination.semanticPurpose,
        child: Tooltip(
          message: destination.semanticPurpose,
          child: InkWell(
            onTap: enabled ? () => onSelected(destination.id) : null,
            onFocusChange: (bool focused) {
              if (!focused) {
                return;
              }
              WidgetsBinding.instance.addPostFrameCallback((_) {
                if (itemContext.mounted) {
                  Scrollable.ensureVisible(
                    itemContext,
                    alignment: 0.5,
                    duration: Duration.zero,
                  );
                }
              });
            },
            child: ExcludeSemantics(
              child: ConstrainedBox(
                constraints: const BoxConstraints(
                  minWidth: 72,
                  minHeight: 64,
                ),
                child: Builder(
                  builder: (BuildContext focusContext) => JurisFocusOutline(
                    key: ValueKey<String>(
                      'compact-destination-focus-${destination.id}',
                    ),
                    focused: Focus.of(focusContext).hasFocus,
                    child: Padding(
                      padding: EdgeInsets.symmetric(
                        horizontal: spacing.md,
                        vertical: spacing.sm,
                      ),
                      child: Column(
                        mainAxisSize: MainAxisSize.min,
                        children: <Widget>[
                          IconTheme(
                            data: IconThemeData(
                              color: selected
                                  ? theme.colorScheme.primary
                                  : theme.colorScheme.onSurfaceVariant,
                            ),
                            child: destination.icon,
                          ),
                          SizedBox(height: spacing.xs),
                          Text(
                            destination.label,
                            softWrap: false,
                            style: typography.controlLabel.copyWith(
                              color: selected
                                  ? theme.colorScheme.primary
                                  : theme.colorScheme.onSurfaceVariant,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _SessionControlsSurface extends StatelessWidget {
  const _SessionControlsSurface({
    required this.dayLabel,
    required this.timeLabel,
    required this.stage,
    required this.clockSupported,
    required this.persistenceSupported,
    required this.persistenceInProgress,
    required this.clockPaused,
    required this.clockSpeed,
    required this.visualModeSelection,
    required this.resolvedVisualMode,
  });

  final String dayLabel;
  final String timeLabel;
  final String stage;
  final bool clockSupported;
  final bool persistenceSupported;
  final bool persistenceInProgress;
  final bool clockPaused;
  final SimulationClockSpeed clockSpeed;
  final JurisVisualModeSelection visualModeSelection;
  final JurisVisualMode resolvedVisualMode;

  @override
  Widget build(BuildContext context) {
    final ThemeData theme = Theme.of(context);
    final JurisSpacing spacing =
        theme.extension<JurisSpacing>() ?? JurisSpacing.standard;
    final JurisTypography typography =
        theme.extension<JurisTypography>() ?? JurisTypography.standard;
    final bool russian = GameplayLocale.of(context) == 'ru';
    final String resolvedModeLabel =
        resolvedVisualMode == JurisVisualMode.office ? 'OFFICE' : 'AFTER HOURS';
    return SafeArea(
      top: false,
      child: Semantics(
        container: true,
        label: GameplayLocale.text(
          context,
          'Session controls',
          'Управление сеансом',
        ),
        child: SingleChildScrollView(
          key: const ValueKey<String>('session-controls-surface'),
          padding: EdgeInsets.fromLTRB(
            spacing.lg,
            spacing.sm,
            spacing.lg,
            spacing.xxl,
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: <Widget>[
              Row(
                children: <Widget>[
                  Expanded(
                    child: Text(
                      GameplayLocale.text(
                        context,
                        'Session controls',
                        'Управление сеансом',
                      ),
                      style: typography.sectionTitle,
                    ),
                  ),
                  IconButton(
                    key: const ValueKey<String>('session-controls-close'),
                    tooltip: GameplayLocale.text(context, 'Close', 'Закрыть'),
                    onPressed: () => Navigator.pop(context),
                    icon: const Icon(Icons.close),
                  ),
                ],
              ),
              SizedBox(height: spacing.xs),
              Text(
                '$dayLabel · $timeLabel · $stage',
                style: typography.timestamp.copyWith(
                  color: theme.colorScheme.onSurfaceVariant,
                ),
              ),
              SizedBox(height: spacing.lg),
              _SessionSectionLabel(
                label: GameplayLocale.text(
                  context,
                  'Simulation clock',
                  'Игровые часы',
                ),
              ),
              PopupMenuButton<SimulationClockSpeed>(
                key: const ValueKey<String>('simulation-speed-menu'),
                tooltip: russian
                    ? 'Скорость симуляции: ${clockSpeed.label}'
                    : 'Simulation speed: ${clockSpeed.label}',
                initialValue: clockSpeed,
                enabled: clockSupported && !persistenceInProgress,
                onSelected: (SimulationClockSpeed speed) =>
                    Navigator.pop(context, speed),
                itemBuilder: (BuildContext context) =>
                    SimulationClockSpeed.values
                        .map(
                          (SimulationClockSpeed speed) =>
                              PopupMenuItem<SimulationClockSpeed>(
                            value: speed,
                            height: 64,
                            child: Column(
                              mainAxisSize: MainAxisSize.min,
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: <Widget>[
                                Text(speed.label),
                                Text(
                                  russian
                                      ? '${speed.gameMinutesPerRealMinute} '
                                          'игровых мин / реальную мин'
                                      : '${speed.gameMinutesPerRealMinute} '
                                          'game min / real min',
                                  style: theme.textTheme.bodySmall,
                                ),
                              ],
                            ),
                          ),
                        )
                        .toList(growable: false),
                child: ListTile(
                  minTileHeight: 48,
                  leading: const Icon(Icons.speed),
                  title: Text(
                    GameplayLocale.text(
                      context,
                      'Simulation speed',
                      'Скорость симуляции',
                    ),
                  ),
                  subtitle: Text(clockSpeed.label),
                  trailing: const Icon(Icons.arrow_drop_down),
                ),
              ),
              Tooltip(
                message: clockPaused
                    ? GameplayLocale.text(
                        context,
                        'Resume simulation clock',
                        'Продолжить игровые часы',
                      )
                    : GameplayLocale.text(
                        context,
                        'Pause simulation clock',
                        'Приостановить игровые часы',
                      ),
                child: ListTile(
                  key: const ValueKey<String>('simulation-pause-toggle'),
                  minTileHeight: 48,
                  enabled: clockSupported && !persistenceInProgress,
                  leading: Icon(
                    clockPaused
                        ? Icons.play_circle_outline
                        : Icons.pause_circle_outline,
                  ),
                  title: Text(
                    clockPaused
                        ? GameplayLocale.text(context, 'Resume', 'Продолжить')
                        : GameplayLocale.text(context, 'Pause', 'Пауза'),
                  ),
                  onTap: () =>
                      Navigator.pop(context, _SessionCommand.toggleClock),
                ),
              ),
              const Divider(),
              _SessionSectionLabel(
                label: GameplayLocale.text(
                  context,
                  'Appearance',
                  'Оформление',
                ),
              ),
              for (final JurisVisualModeSelection selection
                  in JurisVisualModeSelection.values)
                _VisualModeOption(
                  selection: selection,
                  selected: selection == visualModeSelection,
                  resolvedModeLabel: resolvedModeLabel,
                ),
              const Divider(),
              _SessionSectionLabel(
                label: GameplayLocale.text(
                  context,
                  'Saved session',
                  'Сохранённый сеанс',
                ),
              ),
              PopupMenuButton<_PersistenceAction>(
                key: const ValueKey<String>('save-load-menu'),
                tooltip: GameplayLocale.text(
                  context,
                  'Saved game',
                  'Сохранённая игра',
                ),
                enabled: persistenceSupported && !persistenceInProgress,
                onSelected: (_PersistenceAction action) =>
                    Navigator.pop(context, action),
                itemBuilder: (BuildContext context) =>
                    <PopupMenuEntry<_PersistenceAction>>[
                  PopupMenuItem<_PersistenceAction>(
                    key: const ValueKey<String>('save-game-action'),
                    value: _PersistenceAction.save,
                    child: ListTile(
                      leading: const Icon(Icons.save_outlined),
                      title: Text(
                        GameplayLocale.text(
                          context,
                          'Save game',
                          'Сохранить игру',
                        ),
                      ),
                    ),
                  ),
                  PopupMenuItem<_PersistenceAction>(
                    key: const ValueKey<String>('load-game-action'),
                    value: _PersistenceAction.load,
                    child: ListTile(
                      leading: const Icon(Icons.restore_page_outlined),
                      title: Text(
                        GameplayLocale.text(
                          context,
                          'Load game',
                          'Загрузить игру',
                        ),
                      ),
                    ),
                  ),
                ],
                child: ListTile(
                  minTileHeight: 48,
                  enabled: persistenceSupported && !persistenceInProgress,
                  leading: const Icon(Icons.save_outlined),
                  title: Text(
                    GameplayLocale.text(
                      context,
                      'Save or load game',
                      'Сохранить или загрузить игру',
                    ),
                  ),
                  trailing: const Icon(Icons.arrow_drop_down),
                ),
              ),
              ListTile(
                key: const ValueKey<String>('reset-demo-action'),
                minTileHeight: 48,
                enabled: !persistenceInProgress,
                leading: const Icon(Icons.restart_alt),
                title: Text(
                  GameplayLocale.text(
                    context,
                    'Reset deterministic demo',
                    'Сбросить прохождение',
                  ),
                ),
                onTap: () => Navigator.pop(context, _SessionCommand.reset),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _SessionSectionLabel extends StatelessWidget {
  const _SessionSectionLabel({required this.label});

  final String label;

  @override
  Widget build(BuildContext context) {
    final JurisTypography typography =
        Theme.of(context).extension<JurisTypography>() ??
            JurisTypography.standard;
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 8, 16, 4),
      child: Text(label, style: typography.statusStamp),
    );
  }
}

class _VisualModeOption extends StatelessWidget {
  const _VisualModeOption({
    required this.selection,
    required this.selected,
    required this.resolvedModeLabel,
  });

  final JurisVisualModeSelection selection;
  final bool selected;
  final String resolvedModeLabel;

  @override
  Widget build(BuildContext context) {
    final String label = switch (selection) {
      JurisVisualModeSelection.automatic =>
        GameplayLocale.text(context, 'Automatic', 'Автоматически'),
      JurisVisualModeSelection.office => 'OFFICE',
      JurisVisualModeSelection.afterHours => 'AFTER HOURS',
    };
    final String? subtitle = selection == JurisVisualModeSelection.automatic
        ? '${GameplayLocale.text(context, 'Current', 'Сейчас')}: '
            '$resolvedModeLabel'
        : null;
    return Semantics(
      key: ValueKey<String>('visual-mode-${selection.name}'),
      button: true,
      selected: selected,
      excludeSemantics: true,
      label: subtitle == null ? label : '$label. $subtitle',
      onTap: () => Navigator.pop(context, selection),
      child: ListTile(
        minTileHeight: 48,
        selected: selected,
        leading: Icon(
          selected ? Icons.radio_button_checked : Icons.radio_button_off,
        ),
        title: Text(label),
        subtitle: subtitle == null ? null : Text(subtitle),
        trailing: selected ? const Icon(Icons.check) : null,
        onTap: () => Navigator.pop(context, selection),
      ),
    );
  }
}
