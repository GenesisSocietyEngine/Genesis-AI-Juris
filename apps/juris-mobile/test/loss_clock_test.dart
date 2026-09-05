import 'package:flutter_test/flutter_test.dart';
import 'package:juris_mobile/data/demo_game_repository.dart';
import 'package:juris_mobile/models/game_snapshot.dart';

void main() {
  test('foreground clock advances deterministic game minutes', () {
    final DemoGameRepository repository = DemoGameRepository(seed: 20260724);
    repository.applyAction('accept-immediately');

    expect(repository.snapshot.timeLabel, '08:15');
    repository.advanceTimeByMinutes(1);

    expect(repository.snapshot.timeLabel, '08:16');
    expect(repository.snapshot.inactivityMinutes, 1);
  });

  test('sustained inactivity warns the client and terminates engagement', () {
    final DemoGameRepository repository = DemoGameRepository(seed: 20260724);
    repository.applyAction('accept-immediately');

    repository.advanceTimeByMinutes(180);
    expect(repository.snapshot.clientWarningLevel, 1);
    expect(
      repository.snapshot.inbox.any(
        (InboxItemView item) => item.subject == 'Urgent engagement warning',
      ),
      isTrue,
    );

    repository.advanceTimeByMinutes(120);
    expect(repository.snapshot.clientWarningLevel, 2);
    expect(
      repository.snapshot.inbox.any(
        (InboxItemView item) =>
            item.subject == 'Final warning before termination',
      ),
      isTrue,
    );

    repository.advanceTimeByMinutes(180);
    expect(repository.snapshot.stage, 'Resolved');
    expect(repository.snapshot.actions, isEmpty);
    expect(repository.snapshot.clientTrust, 0);
    expect(
      repository.snapshot.outcomeSummary?.headline,
      'Client terminated engagement',
    );
  });

  test('substantive work resets the current inactivity escalation', () {
    final DemoGameRepository repository = DemoGameRepository(seed: 20260724);
    repository.applyAction('accept-immediately');
    repository.advanceTimeByMinutes(180);

    expect(repository.snapshot.clientWarningLevel, 1);
    repository.applyAction('request-documents');

    expect(repository.snapshot.stage, 'Pre-litigation');
    expect(repository.snapshot.inactivityMinutes, 0);
    expect(repository.snapshot.clientWarningLevel, 0);
  });

  test('repeated rest can terminate an inactive engagement', () {
    final DemoGameRepository repository = DemoGameRepository(seed: 20260724);
    repository.applyAction('accept-immediately');

    for (int index = 0; index < 4; index += 1) {
      repository.applyAction('rest');
    }

    expect(repository.snapshot.stage, 'Resolved');
    expect(
      repository.snapshot.outcomeSummary?.headline,
      'Client terminated engagement',
    );
  });

  test('missed claim filing deadline produces procedural dismissal', () {
    final DemoGameRepository repository = DemoGameRepository(seed: 20260724);
    repository.applyAction('run-conflict-check');
    repository.applyAction('request-documents');
    repository.applyAction('reject-settlement');
    repository.applyAction('commence-proceedings');

    for (int index = 0; index < 4; index += 1) {
      repository.applyAction('rest');
    }

    expect(repository.snapshot.stage, 'Resolved');
    expect(
      repository.snapshot.outcomeSummary?.headline,
      'Claim dismissed by procedural default',
    );
    expect(repository.snapshot.outcomeSummary?.awardEur, 0);
    expect(repository.snapshot.outcomeSummary?.costsEur, 12000);
  });

  test('missed mandatory hearing cannot be rescued by the seed', () {
    final DemoGameRepository repository = _buildHearingMatter(
      seed: 20260724,
    );

    repository.applyAction('wait-until-hearing');
    repository.advanceTimeByMinutes((6 * 60) + 1);
    expect(repository.snapshot.stage, 'Judgment pending');

    repository.applyAction('rest');
    final InboxItemView judgment = repository.snapshot.inbox.singleWhere(
      (InboxItemView item) => item.id.startsWith('judgment-day-'),
    );

    expect(judgment.subject, contains('procedural default'));
    expect(judgment.body, contains('cannot be overridden'));
  });

  test('poor hearing preparation can produce a full merits loss', () {
    final DemoGameRepository repository = _buildHearingMatter(
      seed: 20260701,
    );

    repository.applyAction('wait-until-hearing');
    repository.applyAction('attend-hearing');
    repository.applyAction('rest');

    final InboxItemView judgment = repository.snapshot.inbox.singleWhere(
      (InboxItemView item) => item.id.startsWith('judgment-day-'),
    );
    expect(judgment.subject, 'Judgment: claim dismissed');
    expect(judgment.body,
        contains('Weak evidence, procedure, and hearing preparation'));
  });

  test('strong hearing preparation preserves the favorable branch', () {
    final DemoGameRepository repository = _buildHearingMatter(
      seed: 20260724,
    );

    repository.applyAction('prepare-hearing-strategy');
    repository.applyAction('prepare-key-witness');
    repository.applyAction('reconcile-damages-schedule');
    repository.applyAction('wait-until-hearing');
    repository.applyAction('attend-hearing');
    repository.applyAction('rest');

    final InboxItemView judgment = repository.snapshot.inbox.singleWhere(
      (InboxItemView item) => item.id.startsWith('judgment-day-'),
    );
    expect(judgment.subject, 'Judgment: claim substantially upheld');
  });
}

DemoGameRepository _buildHearingMatter({required int seed}) {
  final DemoGameRepository repository = DemoGameRepository(seed: seed);
  repository.applyAction('run-conflict-check');
  repository.applyAction('prepare-partner-brief');
  repository.applyAction('issue-preservation-notice');
  repository.applyAction('request-documents');
  repository.applyAction('reject-settlement');
  repository.applyAction('commence-proceedings');
  repository.applyAction('prepare-statement-of-claim');
  repository.applyAction('prepare-evidence-bundle');
  return repository;
}
