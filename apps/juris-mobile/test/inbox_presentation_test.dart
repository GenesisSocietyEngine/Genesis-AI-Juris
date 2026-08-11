import 'package:flutter_test/flutter_test.dart';
import 'package:juris_mobile/models/game_snapshot.dart';
import 'package:juris_mobile/presentation/inbox_presentation.dart';

void main() {
  test('zero displayed entries has zero attention', () {
    final InboxPresentation presentation = InboxPresentation.from(
      const <InboxItemView>[],
    );

    expect(presentation.displayedEntries, isEmpty);
    expect(presentation.attentionRequiredCount, 0);
  });

  test('one and four attention entries count the final displayed set', () {
    final InboxPresentation one = InboxPresentation.from(<InboxItemView>[
      _item('one', InboxStatus.actionRequired, 1),
    ]);
    final InboxPresentation four = InboxPresentation.from(<InboxItemView>[
      for (int index = 0; index < 4; index += 1)
        _item('required-$index', InboxStatus.actionRequired, index),
    ]);

    expect(one.attentionRequiredCount, 1);
    expect(four.attentionRequiredCount, 4);
    expect(
      four.displayedEntries.where(
        (DisplayedInboxEntry entry) => entry.requiresAttention,
      ),
      hasLength(4),
    );
  });

  test('mixed entries expose explicit locale-neutral attention state', () {
    final InboxPresentation presentation = InboxPresentation.from(
      <InboxItemView>[
        _item('required', InboxStatus.actionRequired, 1),
        _item('unread', InboxStatus.unread, 2),
        _item('read', InboxStatus.read, 3),
        _item('resolved', InboxStatus.resolved, 4),
      ],
    );

    expect(presentation.attentionRequiredCount, 1);
    expect(
      presentation.displayedEntries
          .singleWhere(
            (DisplayedInboxEntry entry) => entry.item.id == 'required',
          )
          .requiresAttention,
      isTrue,
    );
    expect(
      presentation.displayedEntries
          .where(
            (DisplayedInboxEntry entry) => entry.item.id != 'required',
          )
          .every(
            (DisplayedInboxEntry entry) => !entry.requiresAttention,
          ),
      isTrue,
    );
  });

  test('filtering and ordering cannot diverge from the counted collection', () {
    final InboxPresentation presentation = InboxPresentation.from(
      <InboxItemView>[
        _item('old-required', InboxStatus.actionRequired, 1),
        _item('hidden-required', InboxStatus.actionRequired, 4),
        _item('new-information', InboxStatus.unread, 5),
        _item('new-required', InboxStatus.actionRequired, 5),
      ],
      include: (InboxItemView item) => item.id != 'hidden-required',
    );

    expect(
      presentation.displayedEntries
          .map((DisplayedInboxEntry entry) => entry.item.id),
      <String>['new-required', 'new-information', 'old-required'],
    );
    expect(presentation.attentionRequiredCount, 2);
  });

  test('a projected resolution removes exactly one attention entry', () {
    final InboxItemView required = _item(
      'required',
      InboxStatus.actionRequired,
      1,
    );
    final InboxPresentation before = InboxPresentation.from(
      <InboxItemView>[required],
    );
    final InboxPresentation after = InboxPresentation.from(
      <InboxItemView>[required.copyWith(status: InboxStatus.resolved)],
    );

    expect(before.attentionRequiredCount, 1);
    expect(after.attentionRequiredCount, 0);
    expect(after.displayedEntries.single.requiresAttention, isFalse);
  });
}

InboxItemView _item(String id, InboxStatus status, int minute) {
  return InboxItemView(
    id: id,
    sender: 'Sender $id',
    subject: 'Subject $id',
    body: 'Body $id',
    receivedAt: 'Day 1 · 08:${minute.toString().padLeft(2, '0')}',
    status: status,
  );
}
