import 'dart:async';

import 'package:flutter/material.dart';

import '../data/game_runtime_repository.dart';
import '../models/game_snapshot.dart';
import '../screens/ai_associate_screen.dart';
import '../screens/calendar_screen.dart';
import '../screens/career_screen.dart';
import '../screens/inbox_screen.dart';
import '../screens/matter_screen.dart';
import '../widgets/action_picker_sheet.dart';
import '../widgets/case_report_sheet.dart';
import '../widgets/inbox_message_sheet.dart';
import 'gameplay_locale.dart';

/// Adaptive application shell shared by phone, tablet, and desktop previews.
///
/// Below 700 logical pixels it uses a Material 3 [NavigationBar]. Wider
/// windows switch to [NavigationRail] without changing the destination state.
class HomeShell extends StatefulWidget {
  const HomeShell(
      {required this.repository,
      this.locale = 'en',
      this.onExitToCaseCatalog,
      this.enableLiveClockInTests = false,
      super.key});

  final GameRuntimeRepository repository;
  final String locale;
  final VoidCallback? onExitToCaseCatalog;
  final bool enableLiveClockInTests;

  @override
  State<HomeShell> createState() => _HomeShellState();
}

class _HomeShellState extends State<HomeShell> with WidgetsBindingObserver {
  static const bool _runningUnderFlutterTest =
      bool.fromEnvironment('FLUTTER_TEST');

  int _selectedIndex = 0;
  Timer? _liveClockTimer;
  bool _clockPaused = false;
  bool _clockTickInProgress = false;
  int _openModalCount = 0;
  SimulationClockSpeed _clockSpeed = SimulationClockSpeed.standard;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _startLiveClock();
  }

  @override
  void didUpdateWidget(covariant HomeShell oldWidget) {
    super.didUpdateWidget(oldWidget);
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
    super.dispose();
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
    } else if (_openModalCount == 0) {
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

  List<_Destination> _destinationsFor(BuildContext context) => <_Destination>[
        _Destination(
          'inbox',
          GameplayLocale.text(context, 'Inbox', 'Входящие'),
          Icons.inbox_outlined,
          Icons.inbox,
        ),
        _Destination(
          'matter',
          GameplayLocale.text(context, 'Matter', 'Дело'),
          Icons.gavel_outlined,
          Icons.gavel,
        ),
        _Destination(
          'calendar',
          GameplayLocale.text(context, 'Calendar', 'Календарь'),
          Icons.event_outlined,
          Icons.event,
        ),
        const _Destination(
          'ai',
          'AI',
          Icons.auto_awesome_outlined,
          Icons.auto_awesome,
        ),
        _Destination(
          'career',
          GameplayLocale.text(context, 'Career', 'Карьера'),
          Icons.account_circle_outlined,
          Icons.account_circle,
        ),
      ];

  @override
  Widget build(BuildContext context) {
    return ListenableBuilder(
      listenable: widget.repository,
      builder: (BuildContext context, Widget? child) {
        final GameSnapshot snapshot = widget.repository.snapshot;
        return GameplayLocale(
          locale: widget.locale,
          child: LayoutBuilder(
            builder: (BuildContext context, BoxConstraints constraints) {
              final List<_Destination> destinations = _destinationsFor(context);
              final bool useRail = constraints.maxWidth >= 700;
              final Widget content = _buildContent(snapshot);

              return Scaffold(
                appBar: AppBar(
                  leading: widget.onExitToCaseCatalog == null
                      ? null
                      : IconButton(
                          tooltip: GameplayLocale.text(
                            context,
                            'Back to case library',
                            'Назад в библиотеку дел',
                          ),
                          onPressed: widget.onExitToCaseCatalog,
                          icon: const Icon(Icons.arrow_back),
                        ),
                  title: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: <Widget>[
                      Text(destinations[_selectedIndex].label),
                      Text(
                        '${snapshot.dayLabel} · ${snapshot.timeLabel} · ${snapshot.stage}',
                        style:
                            Theme.of(context).textTheme.labelMedium?.copyWith(
                                  color: Theme.of(context)
                                      .colorScheme
                                      .onSurfaceVariant,
                                ),
                      ),
                    ],
                  ),
                  actions: <Widget>[
                    PopupMenuButton<SimulationClockSpeed>(
                      key: const ValueKey<String>('simulation-speed-menu'),
                      tooltip: GameplayLocale.of(context) == 'ru'
                          ? 'Скорость симуляции: ${_clockSpeed.label} · '
                              '${_clockSpeed.gameMinutesPerRealMinute} игровых мин / реальную мин'
                          : 'Simulation speed: ${_clockSpeed.label} · '
                              '${_clockSpeed.gameMinutesPerRealMinute} game min / real min',
                      initialValue: _clockSpeed,
                      enabled: widget.repository.supportsLiveClock &&
                          !widget.repository.isTerminal,
                      onSelected: _selectClockSpeed,
                      itemBuilder: (BuildContext context) =>
                          SimulationClockSpeed.values
                              .map(
                                (SimulationClockSpeed speed) =>
                                    PopupMenuItem<SimulationClockSpeed>(
                                  value: speed,
                                  height: 64,
                                  child: Column(
                                    mainAxisSize: MainAxisSize.min,
                                    crossAxisAlignment:
                                        CrossAxisAlignment.start,
                                    children: <Widget>[
                                      Text(
                                        speed.label,
                                        style: Theme.of(context)
                                            .textTheme
                                            .labelLarge,
                                      ),
                                      const SizedBox(height: 2),
                                      Text(
                                        GameplayLocale.of(context) == 'ru'
                                            ? '${speed.gameMinutesPerRealMinute} '
                                                'игровых мин / реальную мин'
                                            : '${speed.gameMinutesPerRealMinute} '
                                                'game min / real min',
                                        style: Theme.of(context)
                                            .textTheme
                                            .bodySmall,
                                      ),
                                    ],
                                  ),
                                ),
                              )
                              .toList(growable: false),
                      icon: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: <Widget>[
                          const Icon(Icons.speed),
                          const SizedBox(width: 2),
                          Text(_clockSpeed.label),
                        ],
                      ),
                    ),
                    IconButton(
                      key: const ValueKey<String>('simulation-pause-toggle'),
                      tooltip: _clockPaused
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
                      onPressed: widget.repository.supportsLiveClock &&
                              !widget.repository.isTerminal
                          ? _toggleClock
                          : null,
                      icon: Icon(
                        _clockPaused
                            ? Icons.play_circle_outline
                            : Icons.pause_circle_outline,
                      ),
                    ),
                    IconButton(
                      tooltip: GameplayLocale.text(
                        context,
                        'Reset deterministic demo',
                        'Сбросить прохождение',
                      ),
                      onPressed: _confirmReset,
                      icon: const Icon(Icons.restart_alt),
                    ),
                    const SizedBox(width: 8),
                  ],
                ),
                body: useRail
                    ? Row(
                        children: <Widget>[
                          NavigationRail(
                            selectedIndex: _selectedIndex,
                            onDestinationSelected: _selectDestination,
                            labelType: NavigationRailLabelType.all,
                            leading: Padding(
                              padding: const EdgeInsets.only(bottom: 16),
                              child: _MatterMonogram(
                                requiredMessages:
                                    snapshot.unhandledRequiredMessages,
                              ),
                            ),
                            destinations: destinations
                                .map(
                                  (_Destination destination) =>
                                      NavigationRailDestination(
                                    icon: Icon(destination.icon),
                                    selectedIcon:
                                        Icon(destination.selectedIcon),
                                    label: Text(destination.label),
                                  ),
                                )
                                .toList(growable: false),
                          ),
                          const VerticalDivider(width: 1),
                          Expanded(child: content),
                        ],
                      )
                    : content,
                bottomNavigationBar: useRail
                    ? null
                    : NavigationBar(
                        selectedIndex: _selectedIndex,
                        onDestinationSelected: _selectDestination,
                        destinations: destinations
                            .map(
                              (_Destination destination) =>
                                  NavigationDestination(
                                icon: _navigationIcon(
                                  destination.icon,
                                  destination.id,
                                  snapshot,
                                ),
                                selectedIcon: _navigationIcon(
                                  destination.selectedIcon,
                                  destination.id,
                                  snapshot,
                                ),
                                label: destination.label,
                              ),
                            )
                            .toList(growable: false),
                      ),
                floatingActionButton: snapshot.actions.isEmpty
                    ? null
                    : FloatingActionButton.extended(
                        onPressed: () => _showActions(snapshot),
                        icon: const Icon(
                            Icons.playlist_add_check_circle_outlined),
                        label: Text(
                          '${GameplayLocale.text(context, 'Actions', 'Действия')}'
                          ' · ${snapshot.actions.length}',
                        ),
                      ),
              );
            },
          ),
        );
      },
    );
  }

  Widget _buildContent(GameSnapshot snapshot) {
    // Build only the visible destination. The screens use PageStorage keys for
    // scroll restoration, while avoiding eager decoding of the branding image
    // and other off-screen content on memory-constrained phones.
    return switch (_selectedIndex) {
      0 => InboxScreen(
          snapshot: snapshot,
          onMessageTap: _showInboxMessage,
          onCaseReportTap: () => _showCaseReport(snapshot),
        ),
      1 => MatterScreen(
          snapshot: snapshot,
          onShowActions: () => _showActions(snapshot),
        ),
      2 => CalendarScreen(
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
      3 => AiAssociateScreen(
          snapshot: snapshot,
          onShowActions: () => _showActions(snapshot, aiOnly: true),
        ),
      4 => CareerScreen(snapshot: snapshot),
      _ => InboxScreen(
          snapshot: snapshot,
          onMessageTap: _showInboxMessage,
          onCaseReportTap: () => _showCaseReport(snapshot),
        ),
    };
  }

  Widget _navigationIcon(
    IconData icon,
    String destinationId,
    GameSnapshot snapshot,
  ) {
    if (destinationId != 'inbox' || snapshot.unhandledRequiredMessages == 0) {
      return Icon(icon);
    }
    return Badge(
      label: Text('${snapshot.unhandledRequiredMessages}'),
      child: Icon(icon),
    );
  }

  void _selectDestination(int index) {
    setState(() => _selectedIndex = index);
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
    if (summary == null) {
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

  Future<void> _showActions(
    GameSnapshot snapshot, {
    bool aiOnly = false,
    String? onlyActionId,
  }) async {
    final List<GameActionView> actions = onlyActionId != null
        ? snapshot.actions
            .where(
              (GameActionView action) => action.id == onlyActionId,
            )
            .toList(growable: false)
        : aiOnly
            ? snapshot.actions
                .where(
                  (GameActionView action) =>
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
}

class _Destination {
  const _Destination(this.id, this.label, this.icon, this.selectedIcon);

  final String id;
  final String label;
  final IconData icon;
  final IconData selectedIcon;
}

class _MatterMonogram extends StatelessWidget {
  const _MatterMonogram({required this.requiredMessages});

  final int requiredMessages;

  @override
  Widget build(BuildContext context) {
    return Badge(
      isLabelVisible: requiredMessages > 0,
      label: Text('$requiredMessages'),
      child: CircleAvatar(
        backgroundColor: Theme.of(context).colorScheme.primaryContainer,
        foregroundColor: Theme.of(context).colorScheme.onPrimaryContainer,
        child: const Text('AJ'),
      ),
    );
  }
}
