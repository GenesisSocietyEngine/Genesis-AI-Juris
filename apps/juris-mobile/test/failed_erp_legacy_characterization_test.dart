import 'dart:convert';
import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:juris_mobile/data/case_runtime_factory.dart';
import 'package:juris_mobile/data/demo_game_repository.dart';
import 'package:juris_mobile/data/game_runtime_repository.dart';
import 'package:juris_mobile/data/game_save_store.dart';
import 'package:juris_mobile/models/case_catalog.dart';
import 'package:juris_mobile/models/game_snapshot.dart';

/// Characterizes the executable Failed ERP Dart runtime before it is replaced
/// by an authoritative Rust scenario.
///
/// These expectations intentionally describe behavior, including legacy
/// defects and differences from `content/cases/failed_erp.json`. They are a
/// migration baseline, not a specification that requires defects to survive.
void main() {
  const int canonicalSeed = 20260724;

  group('Failed ERP legacy Dart characterization', () {
    test('opening snapshot, seed, resources, and action order are exact', () {
      final DemoGameRepository repository = DemoGameRepository(
        seed: canonicalSeed,
      );
      final GameSnapshot snapshot = repository.snapshot;

      expect(snapshot.version, '0.5.0-alpha.4 remedies and variable live clock');
      expect(snapshot.seed, canonicalSeed);
      expect(snapshot.mode, 'Assisted');
      expect(snapshot.dayLabel, 'Day 1');
      expect(snapshot.timeLabel, '08:00');
      expect(snapshot.stage, 'Intake');
      expect(snapshot.caseResultStatus, CaseResultStatus.ongoing);
      expect(snapshot.engagementStatus, EngagementStatus.active);
      expect(snapshot.matterTitle, 'The Failed ERP Implementation');
      expect(
        <String, int>{
          'caseStrength': snapshot.caseStrength,
          'merits': snapshot.merits,
          'evidence': snapshot.evidenceScore,
          'procedure': snapshot.procedure,
          'leverage': snapshot.leverage,
          'spendEur': snapshot.spendEur,
          'authorizedBudgetEur': snapshot.authorizedBudgetEur,
          'billableMinutes': snapshot.billableMinutes,
          'fatigue': snapshot.fatigue,
          'cumulativeStrain': snapshot.cumulativeStrain,
          'ethics': snapshot.ethics,
          'clientTrust': snapshot.clientTrust,
        },
        <String, int>{
          'caseStrength': 43,
          'merits': 52,
          'evidence': 28,
          'procedure': 55,
          'leverage': 35,
          'spendEur': 0,
          'authorizedBudgetEur': 25000,
          'billableMinutes': 0,
          'fatigue': 0,
          'cumulativeStrain': 0,
          'ethics': 70,
          'clientTrust': 50,
        },
      );
      expect(snapshot.inactivityMinutes, 0);
      expect(snapshot.clientWarningLevel, 0);
      expect(snapshot.aiRequestsUsed, 0);
      expect(snapshot.aiRequestLimit, 5);
      expect(snapshot.knownFactsRevision, 1);
      expect(snapshot.deadlines, isEmpty);
      expect(snapshot.evidence.map((EvidenceView item) => item.id), <String>[
        'contract',
      ]);
      expect(
        snapshot.actions.map(_actionCharacterization),
        <String>[
          'run-conflict-check|1h|350',
          'accept-immediately|15m|0',
          'ask-ai-research|1h 30m|750',
        ],
      );
    });

    test('claimant-side intake and investigation behavior are exact', () {
      final DemoGameRepository repository = DemoGameRepository(
        seed: canonicalSeed,
      );

      expect(repository.snapshot.inbox.single.sender, 'Client CEO');
      expect(
        repository.snapshot.inbox.single.body,
        allOf(
          contains('Our ERP supplier terminated the project'),
          contains('losses of EUR 240,000'),
        ),
      );

      repository.applyAction('run-conflict-check');
      final GameSnapshot investigation = repository.snapshot;

      expect(investigation.stage, 'Investigation');
      expect(investigation.timeLabel, '09:00');
      expect(investigation.spendEur, 350);
      expect(investigation.billableMinutes, 60);
      expect(investigation.ethics, 72);
      expect(investigation.fatigue, 2);
      expect(
        investigation.actions.map(_actionCharacterization),
        <String>[
          'reply-cfo|30m|0',
          'request-documents|8h|2000',
          'delegate-review|1h|1800',
          'ask-ai-research|1h 30m|750',
          'prepare-partner-brief|2h|0',
          'issue-preservation-notice|1h|250',
          'rest|Until 08:00|0',
        ],
      );
      expect(
        investigation.deadlines.map(_deadlineCharacterization),
        <String>[
          'partner-brief|Day 1 · 15:00|open|prepare-partner-brief',
          'preservation|Day 2 · 17:00|open|issue-preservation-notice',
        ],
      );
    });

    test('executed offer and turnaround values override stale JSON template',
        () async {
      final Map<String, dynamic> template = jsonDecode(
        await _repositoryFile('content/cases/failed_erp.json').readAsString(),
      ) as Map<String, dynamic>;
      expect(template['id'], 'failed-erp-implementation');
      expect(template['opponent_initial_offer_eur'], 60000);
      expect(template['junior_review_turnaround_minutes'], 240);

      final DemoGameRepository repository = DemoGameRepository(
        seed: canonicalSeed,
      );
      repository.applyAction('run-conflict-check');
      repository.applyAction('delegate-review');

      expect(repository.snapshot.timeLabel, '10:00');
      expect(repository.snapshot.juniorReviewStatus,
          JuniorReviewStatus.inProgress);
      expect(repository.snapshot.juniorReviewDueDay, 1);
      expect(repository.snapshot.juniorReviewDueMinute, 13 * 60 + 30);
      expect(
        repository.snapshot.juniorReviewDueMinute - 10 * 60,
        210,
        reason: 'Executed Dart behavior is 3h30, not the JSON 4h value.',
      );

      repository.applyAction('request-documents');
      expect(repository.snapshot.stage, 'Pre-litigation');
      expect(repository.snapshot.timeLabel, '17:30');
      expect(repository.snapshot.spendEur, 4150);
      expect(repository.snapshot.billableMinutes, 600);
      expect(repository.snapshot.settlementOffer?.amountEur, 64500);
      expect(repository.snapshot.settlementOffer?.expiresAt,
          'Day 2 · 17:30');
      expect(repository.snapshot.settlementOffer?.amountEur,
          isNot(template['opponent_initial_offer_eur']));
    });

    test('legacy evidence stays flat and never produces a Dossier', () {
      final DemoGameRepository repository = DemoGameRepository(
        seed: canonicalSeed,
      );

      expect(repository.snapshot.dossier, isNull);
      expect(repository.snapshot.knownFactsRevision, 1);

      repository.applyAction('run-conflict-check');
      repository.applyAction('request-documents');

      expect(repository.snapshot.knownFactsRevision, 2);
      expect(repository.snapshot.dossier, isNull);
      expect(
        repository.snapshot.evidence.map((EvidenceView item) => item.id),
        <String>['contract', 'changes', 'emails', 'acceptance'],
      );
    });

    test('factory selects Dart runtime and does not touch a supplied save store',
        () async {
      final CaseCatalogBundle bundle = CaseCatalogBundle.fromJson(
        jsonDecode(
          await _repositoryFile(
            'apps/juris-mobile/assets/case_catalog/mobile_case_bundle.json',
          ).readAsString(),
        ) as Map<String, dynamic>,
      );
      final MobileCaseDefinition failedErp = bundle.cases.singleWhere(
        (MobileCaseDefinition item) =>
            item.caseId == 'be_commercial_failed_erp_001',
      );
      final _TrackingGameSaveStore saveStore = _TrackingGameSaveStore();

      expect(failedErp.sortOrder, 10);
      expect(failedErp.seed, canonicalSeed);
      expect(failedErp.runtimeAdapter,
          CaseRuntimeFactory.failedErpDemoAdapter);
      expect(failedErp.scenario, isNull);

      final GameRuntimeRepository repository = CaseRuntimeFactory.create(
        failedErp,
        gameSaveStore: saveStore,
      );
      expect(repository, isA<DemoGameRepository>());
      expect(repository.supportsPersistence, isFalse);
      expect(await repository.hasSavedGame(), isFalse);
      await expectLater(
        repository.saveGame(),
        throwsA(
          isA<GamePersistenceException>().having(
            (GamePersistenceException error) => error.code,
            'code',
            'persistence_unsupported',
          ),
        ),
      );
      await expectLater(
        repository.loadGame(),
        throwsA(
          isA<GamePersistenceException>().having(
            (GamePersistenceException error) => error.code,
            'code',
            'persistence_unsupported',
          ),
        ),
      );
      expect(saveStore.operationCount, 0);
    });

    test('settlement resolves for EUR 64,500 and closes the legacy matter', () {
      final DemoGameRepository repository = DemoGameRepository(
        seed: canonicalSeed,
      );
      repository.applyAction('run-conflict-check');
      repository.applyAction('request-documents');

      expect(
        repository.snapshot.actions.map((GameActionView item) => item.id),
        containsAllInOrder(<String>['future-settle', 'reject-settlement']),
      );
      repository.applyAction('future-settle');

      expect(repository.snapshot.stage, 'Resolved');
      expect(repository.snapshot.caseResultStatus, CaseResultStatus.settled);
      expect(repository.snapshot.engagementStatus, EngagementStatus.completed);
      expect(repository.snapshot.actions, isEmpty);
      expect(repository.snapshot.settlementOffer, isNull);
      expect(repository.snapshot.outcomeSummary?.headline, 'Matter settled');
      expect(repository.snapshot.outcomeSummary?.awardEur, 64500);
      expect(repository.isTerminal, isTrue);
      expect(repository.snapshot.isClosed, isTrue);
    });

    test('crossing the partner deadline records the exact legacy penalties',
        () {
      final DemoGameRepository repository = DemoGameRepository(
        seed: canonicalSeed,
      );
      repository.applyAction('run-conflict-check');

      repository.advanceTimeByMinutes(6 * 60);
      expect(repository.snapshot.timeLabel, '15:00');
      expect(
        _deadline(repository.snapshot, 'partner-brief').status,
        DeadlineStatus.open,
      );
      final int procedureAtDueMinute = repository.snapshot.procedure;
      final int clientTrustAtDueMinute = repository.snapshot.clientTrust;

      repository.advanceTimeByMinutes(1);
      expect(repository.snapshot.timeLabel, '15:01');
      expect(
        _deadline(repository.snapshot, 'partner-brief').status,
        DeadlineStatus.missed,
      );
      expect(repository.snapshot.procedure, procedureAtDueMinute - 6);
      expect(repository.snapshot.clientTrust, clientTrustAtDueMinute - 5);
      expect(
        repository.snapshot.actions.map((GameActionView item) => item.id),
        isNot(contains('prepare-partner-brief')),
      );
      expect(
        repository.snapshot.inbox.map((InboxItemView item) => item.subject),
        contains('Partner risk brief missed'),
      );
    });

    test('procedural default is a terminal legacy loss with no judicial state',
        () {
      final DemoGameRepository repository = DemoGameRepository(
        seed: canonicalSeed,
      );
      repository.applyAction('run-conflict-check');
      repository.applyAction('request-documents');
      repository.applyAction('reject-settlement');
      repository.applyAction('commence-proceedings');

      for (int day = 0; day < 4; day += 1) {
        repository.applyAction('rest');
      }

      expect(repository.snapshot.stage, 'Resolved');
      expect(repository.snapshot.caseResultStatus,
          CaseResultStatus.lostAtFirstInstance);
      expect(repository.snapshot.engagementStatus, EngagementStatus.completed);
      expect(repository.snapshot.outcomeSummary?.headline,
          'Claim dismissed by procedural default');
      expect(repository.snapshot.outcomeSummary?.awardEur, 0);
      expect(repository.snapshot.outcomeSummary?.costsEur, 12000);
      expect(repository.snapshot.judicialResult, isNull);
      expect(repository.snapshot.judicialDecisionInstance, isNull);
      expect(repository.snapshot.matterLifecycle, MatterLifecycleStatus.active);
      expect(repository.snapshot.isClosed, isTrue);
      expect(repository.isTerminal, isTrue);
    });

    test('merits loss remains playable through claimant appeal assessment', () {
      final DemoGameRepository repository = _buildHearingMatter(
        seed: 20260701,
      );
      repository.applyAction('wait-until-hearing');
      repository.applyAction('attend-hearing');
      repository.applyAction('rest');

      expect(repository.snapshot.stage, 'Post-judgment');
      expect(repository.snapshot.caseResultStatus,
          CaseResultStatus.lostAtFirstInstance);
      expect(repository.snapshot.outcomeSummary, isNull);
      expect(repository.snapshot.isClosed, isFalse);
      expect(repository.isTerminal, isFalse);
      expect(repository.snapshot.judicialResult, isNull);
      expect(repository.snapshot.matterLifecycle, MatterLifecycleStatus.active);
      expect(
        repository.snapshot.inbox.singleWhere(
          (InboxItemView item) => item.id.startsWith('judgment-day-'),
        ).subject,
        'Judgment: claim dismissed',
      );

      repository.applyAction('inform-client-judgment');
      expect(repository.snapshot.stage, 'Appeal assessment');
      expect(repository.snapshot.engagementStatus,
          EngagementStatus.awaitingClientInstructions);
      expect(
        repository.snapshot.actions.map((GameActionView item) => item.id),
        <String>['prepare-appeal-advice', 'accept-judgment-and-close'],
      );
      expect(
        _deadline(repository.snapshot, 'appeal-deadline').relatedActionId,
        'prepare-appeal-advice',
      );
    });
  });
}

String _actionCharacterization(GameActionView action) =>
    '${action.id}|${action.timeLabel}|${action.costEur}';

String _deadlineCharacterization(DeadlineView deadline) =>
    '${deadline.id}|${deadline.dueAt}|${deadline.status.name}|'
    '${deadline.relatedActionId}';

DeadlineView _deadline(GameSnapshot snapshot, String id) {
  return snapshot.deadlines.singleWhere((DeadlineView item) => item.id == id);
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

File _repositoryFile(String repositoryRelativePath) {
  final List<File> candidates = <File>[
    File(repositoryRelativePath),
    File('../../$repositoryRelativePath'),
  ];
  return candidates.firstWhere(
    (File file) => file.existsSync(),
    orElse: () => throw StateError(
      'Could not locate repository file $repositoryRelativePath from '
      '${Directory.current.path}.',
    ),
  );
}

final class _TrackingGameSaveStore implements GameSaveStore {
  int operationCount = 0;

  @override
  Future<bool> exists(String slotId) async {
    operationCount += 1;
    return false;
  }

  @override
  Future<String> read(String slotId) async {
    operationCount += 1;
    throw StateError('The legacy runtime must not read from the save store.');
  }

  @override
  Future<void> write(String slotId, String encodedSave) async {
    operationCount += 1;
    throw StateError('The legacy runtime must not write to the save store.');
  }
}
