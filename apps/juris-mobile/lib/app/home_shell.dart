import 'package:flutter/material.dart';

import '../data/demo_game_repository.dart';
import '../models/game_snapshot.dart';
import '../screens/ai_associate_screen.dart';
import '../screens/calendar_screen.dart';
import '../screens/career_screen.dart';
import '../screens/inbox_screen.dart';
import '../screens/matter_screen.dart';
import '../widgets/action_picker_sheet.dart';
import '../widgets/inbox_message_sheet.dart';

/// Adaptive application shell shared by phone, tablet, and desktop previews.
///
/// Below 700 logical pixels it uses a Material 3 [NavigationBar]. Wider
/// windows switch to [NavigationRail] without changing the destination state.
class HomeShell extends StatefulWidget {
  const HomeShell({required this.repository, super.key});

  final DemoGameRepository repository;

  @override
  State<HomeShell> createState() => _HomeShellState();
}

class _HomeShellState extends State<HomeShell> {
  int _selectedIndex = 0;

  static const List<_Destination> _destinations = <_Destination>[
    _Destination('Inbox', Icons.inbox_outlined, Icons.inbox),
    _Destination('Matter', Icons.gavel_outlined, Icons.gavel),
    _Destination('Calendar', Icons.event_outlined, Icons.event),
    _Destination('AI', Icons.auto_awesome_outlined, Icons.auto_awesome),
    _Destination('Career', Icons.account_circle_outlined, Icons.account_circle),
  ];

  @override
  Widget build(BuildContext context) {
    return ListenableBuilder(
      listenable: widget.repository,
      builder: (BuildContext context, Widget? child) {
        final GameSnapshot snapshot = widget.repository.snapshot;
        return LayoutBuilder(
          builder: (BuildContext context, BoxConstraints constraints) {
            final bool useRail = constraints.maxWidth >= 700;
            final Widget content = _buildContent(snapshot);

            return Scaffold(
              appBar: AppBar(
                title: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: <Widget>[
                    Text(_destinations[_selectedIndex].label),
                    Text(
                      '${snapshot.dayLabel} · ${snapshot.timeLabel} · ${snapshot.stage}',
                      style: Theme.of(context).textTheme.labelMedium?.copyWith(
                            color:
                                Theme.of(context).colorScheme.onSurfaceVariant,
                          ),
                    ),
                  ],
                ),
                actions: <Widget>[
                  IconButton(
                    tooltip: 'Reset deterministic demo',
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
                          destinations: _destinations
                              .map(
                                (_Destination destination) =>
                                    NavigationRailDestination(
                                  icon: Icon(destination.icon),
                                  selectedIcon: Icon(destination.selectedIcon),
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
                      destinations: _destinations
                          .map(
                            (_Destination destination) => NavigationDestination(
                              icon: _navigationIcon(
                                destination.icon,
                                destination.label,
                                snapshot,
                              ),
                              selectedIcon: _navigationIcon(
                                destination.selectedIcon,
                                destination.label,
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
                      icon:
                          const Icon(Icons.playlist_add_check_circle_outlined),
                      label: Text('Actions · ${snapshot.actions.length}'),
                    ),
            );
          },
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
        ),
      1 => MatterScreen(
          snapshot: snapshot,
          onShowActions: () => _showActions(snapshot),
        ),
      2 => CalendarScreen(
          snapshot: snapshot,
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
        ),
    };
  }

  Widget _navigationIcon(
    IconData icon,
    String label,
    GameSnapshot snapshot,
  ) {
    if (label != 'Inbox' || snapshot.unhandledRequiredMessages == 0) {
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
    final String? actionId = await showModalBottomSheet<String>(
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
    } else if (item.id.startsWith('client-review-options-')) {
      actionIds = <String>{'assess-claimant-review-options'};
    } else if (item.id.startsWith('expert-report-ready')) {
      actionIds = <String>{'review-expert-report'};
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
        const SnackBar(content: Text('No matching actions are available now.')),
      );
      return;
    }

    final String? actionId = await showModalBottomSheet<String>(
      context: context,
      useSafeArea: true,
      isScrollControlled: true,
      showDragHandle: true,
      builder: (BuildContext context) => ActionPickerSheet(actions: actions),
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
    final bool? confirmed = await showDialog<bool>(
      context: context,
      builder: (BuildContext context) => AlertDialog(
        title: const Text('Reset playtest?'),
        content: const Text(
          'This returns the UI demo to Day 1 at 08:00 with seed 20260724.',
        ),
        actions: <Widget>[
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('Cancel'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(context, true),
            child: const Text('Reset'),
          ),
        ],
      ),
    );

    if (confirmed == true) {
      widget.repository.reset();
    }
  }
}

class _Destination {
  const _Destination(this.label, this.icon, this.selectedIcon);

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
