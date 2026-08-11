import 'package:flutter/foundation.dart';

import '../models/game_snapshot.dart';

/// One final player-visible Inbox entry prepared for rendering.
///
/// Attention is deliberately explicit and locale-neutral. It is derived only
/// from the projected status on the same item that the Inbox renders.
@immutable
final class DisplayedInboxEntry {
  const DisplayedInboxEntry({
    required this.item,
    required this.requiresAttention,
  });

  final InboxItemView item;
  final bool requiresAttention;
}

/// Immutable presentation aggregate shared by every Inbox count consumer.
///
/// The adapter performs the Inbox's final filtering and newest-first ordering
/// before exposing both the displayed entries and their attention count. This
/// prevents summaries and badges from counting a different collection than
/// the rendered tiles.
@immutable
final class InboxPresentation {
  InboxPresentation._(List<DisplayedInboxEntry> displayedEntries)
      : displayedEntries = List<DisplayedInboxEntry>.unmodifiable(
          displayedEntries,
        );

  factory InboxPresentation.from(
    Iterable<InboxItemView> source, {
    bool Function(InboxItemView item)? include,
  }) {
    final List<_IndexedInboxItem> ordered = source
        .toList(growable: false)
        .asMap()
        .entries
        .where(
          (MapEntry<int, InboxItemView> entry) =>
              include?.call(entry.value) ?? true,
        )
        .map(
          (MapEntry<int, InboxItemView> entry) => _IndexedInboxItem(
            sourceIndex: entry.key,
            item: entry.value,
          ),
        )
        .toList(growable: false)
      ..sort((_IndexedInboxItem left, _IndexedInboxItem right) {
        final int momentComparison = _messageMoment(
          right.item.receivedAt,
        ).compareTo(_messageMoment(left.item.receivedAt));
        if (momentComparison != 0) {
          return momentComparison;
        }
        return right.sourceIndex.compareTo(left.sourceIndex);
      });

    return InboxPresentation._(
      ordered
          .map(
            (_IndexedInboxItem entry) => DisplayedInboxEntry(
              item: entry.item,
              requiresAttention:
                  entry.item.status == InboxStatus.actionRequired,
            ),
          )
          .toList(growable: false),
    );
  }

  final List<DisplayedInboxEntry> displayedEntries;

  int get attentionRequiredCount => displayedEntries
      .where((DisplayedInboxEntry entry) => entry.requiresAttention)
      .length;

  static int _messageMoment(String label) {
    final RegExpMatch? match = RegExp(
      r'^(?:Day|День)\s+(\d+)\s+·\s+(\d{1,2}):(\d{2})$',
    ).firstMatch(label);
    if (match == null) {
      return 0;
    }

    final int day = int.tryParse(match.group(1) ?? '') ?? 0;
    final int hour = int.tryParse(match.group(2) ?? '') ?? 0;
    final int minute = int.tryParse(match.group(3) ?? '') ?? 0;
    return (day * 24 * 60) + (hour * 60) + minute;
  }
}

@immutable
final class _IndexedInboxItem {
  const _IndexedInboxItem({required this.sourceIndex, required this.item});

  final int sourceIndex;
  final InboxItemView item;
}
