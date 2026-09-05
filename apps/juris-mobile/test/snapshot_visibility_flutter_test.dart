import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:juris_mobile/app/gameplay_locale.dart';
import 'package:juris_mobile/data/rust_scenario_repository.dart';
import 'package:juris_mobile/data/scenario_bridge_client.dart';
import 'package:juris_mobile/data/scenario_snapshot_mapper.dart';
import 'package:juris_mobile/models/case_catalog.dart';
import 'package:juris_mobile/models/game_snapshot.dart';
import 'package:juris_mobile/screens/calendar_screen.dart';
import 'package:juris_mobile/screens/dossier_screen.dart';
import 'package:juris_mobile/screens/inbox_screen.dart';

const String _revealedFactId = 'sentinel_revealed_fact';
const String _revealedEvidenceId = 'sentinel_revealed_evidence';
const String _revealedInboxId = 'sentinel_revealed_inbox';
const String _revealedDeadlineId = 'sentinel_revealed_deadline';
const String _neverVisibleEvidenceId = 'sentinel_never_visible_evidence';

const String _revealedFactEn = 'EN REVEALED FACT SENTINEL';
const String _revealedEvidenceEn = 'EN REVEALED EVIDENCE SENTINEL';
const String _revealedInboxEn = 'EN REVEALED INBOX SENTINEL';
const String _revealedDeadlineEn = 'EN REVEALED DEADLINE SENTINEL';
const String _neverVisibleEn = 'EN NEVER VISIBLE SENTINEL';

const String _revealedFactRu = 'RU РАСКРЫТЫЙ ФАКТ МАРКЕР';
const String _revealedEvidenceRu = 'RU РАСКРЫТОЕ ДОКАЗАТЕЛЬСТВО МАРКЕР';
const String _revealedInboxRu = 'RU РАСКРЫТОЕ СООБЩЕНИЕ МАРКЕР';
const String _revealedDeadlineRu = 'RU РАСКРЫТЫЙ СРОК МАРКЕР';
const String _neverVisibleRu = 'RU НИКОГДА НЕ ВИДИМЫЙ МАРКЕР';

void main() {
  final MobileCaseDefinition definition = _visibilityCaseDefinition();

  test('mapper consumes only Rust-projected rows without hidden-row totals',
      () {
    final GameSnapshot initialEnglish = ScenarioSnapshotMapper.map(
      source: _visibilitySnapshot(revealed: false),
      caseDefinition: definition,
    );
    final GameSnapshot initialRussian = ScenarioSnapshotMapper.map(
      source: _visibilitySnapshot(revealed: false),
      caseDefinition: definition,
      locale: 'ru',
    );

    for (final GameSnapshot snapshot in <GameSnapshot>[
      initialEnglish,
      initialRussian,
    ]) {
      expect(snapshot.knownFactsRevision, 1);
      expect(snapshot.merits, 100);
      expect(snapshot.evidenceScore, 100);
      expect(snapshot.evidence, hasLength(1));
      expect(snapshot.inbox, hasLength(1));
      expect(snapshot.deadlines, isEmpty);
      expect(snapshot.dossier!.facts, hasLength(1));
      expect(snapshot.dossier!.evidence, hasLength(1));
      expect(_playerText(snapshot), isNot(contains('sentinel_revealed_')));
      expect(_playerText(snapshot), isNot(contains(_neverVisibleEvidenceId)));
      expect(_playerText(snapshot), isNot(contains(_neverVisibleEn)));
      expect(_playerText(snapshot), isNot(contains(_neverVisibleRu)));
    }
    expect(_playerText(initialEnglish), isNot(contains(_revealedFactEn)));
    expect(_playerText(initialEnglish), isNot(contains(_revealedEvidenceEn)));
    expect(_playerText(initialEnglish), isNot(contains(_revealedInboxEn)));
    expect(_playerText(initialEnglish), isNot(contains(_revealedDeadlineEn)));
    expect(_playerText(initialRussian), isNot(contains(_revealedFactRu)));
    expect(_playerText(initialRussian), isNot(contains(_revealedEvidenceRu)));
    expect(_playerText(initialRussian), isNot(contains(_revealedInboxRu)));
    expect(_playerText(initialRussian), isNot(contains(_revealedDeadlineRu)));

    final GameSnapshot revealedEnglish = ScenarioSnapshotMapper.map(
      source: _visibilitySnapshot(revealed: true),
      caseDefinition: definition,
    );
    final GameSnapshot revealedRussian = ScenarioSnapshotMapper.map(
      source: _visibilitySnapshot(revealed: true),
      caseDefinition: definition,
      locale: 'ru',
    );

    for (final GameSnapshot snapshot in <GameSnapshot>[
      revealedEnglish,
      revealedRussian,
    ]) {
      expect(snapshot.knownFactsRevision, 2);
      expect(snapshot.merits, 62);
      expect(snapshot.evidenceScore, 100);
      expect(
        snapshot.evidence.map((EvidenceView item) => item.id),
        <String>['visible_evidence', _revealedEvidenceId],
      );
      expect(
        snapshot.inbox.map((InboxItemView item) => item.id),
        <String>['visible_inbox', _revealedInboxId],
      );
      expect(snapshot.deadlines.single.id, _revealedDeadlineId);
      expect(snapshot.dossier!.facts.last.id, _revealedFactId);
      expect(_playerText(snapshot), isNot(contains(_neverVisibleEvidenceId)));
      expect(_playerText(snapshot), isNot(contains(_neverVisibleEn)));
      expect(_playerText(snapshot), isNot(contains(_neverVisibleRu)));
    }
    expect(_playerText(revealedEnglish), contains(_revealedFactEn));
    expect(_playerText(revealedEnglish), contains(_revealedEvidenceEn));
    expect(_playerText(revealedEnglish), contains(_revealedInboxEn));
    expect(_playerText(revealedEnglish), contains(_revealedDeadlineEn));
    expect(_playerText(revealedRussian), contains(_revealedFactRu));
    expect(_playerText(revealedRussian), contains(_revealedEvidenceRu));
    expect(_playerText(revealedRussian), contains(_revealedInboxRu));
    expect(_playerText(revealedRussian), contains(_revealedDeadlineRu));
  });

  test('repository exposes entities only after the bridge reveal response', () {
    for (final String locale in <String>['en', 'ru']) {
      final List<String> revealedText = locale == 'ru'
          ? <String>[
              _revealedFactRu,
              _revealedEvidenceRu,
              _revealedInboxRu,
              _revealedDeadlineRu,
            ]
          : <String>[
              _revealedFactEn,
              _revealedEvidenceEn,
              _revealedInboxEn,
              _revealedDeadlineEn,
            ];
      final _VisibilityBridgeClient client = _VisibilityBridgeClient();
      final RustScenarioRepository repository = RustScenarioRepository(
        caseDefinition: definition,
        bridgeClient: client,
        locale: locale,
      );

      expect(client.responseCount, 1);
      expect(repository.snapshot.knownFactsRevision, 1);
      expect(repository.snapshot.evidence, hasLength(1));
      expect(repository.snapshot.inbox, hasLength(1));
      expect(repository.snapshot.deadlines, isEmpty);
      expect(_playerText(repository.snapshot),
          isNot(contains('sentinel_revealed_')));
      for (final String text in revealedText) {
        expect(_playerText(repository.snapshot), isNot(contains(text)));
      }

      final result = repository.applyAction('reveal_entities');

      expect(result.isRisky, isFalse);
      expect(client.responseCount, 2);
      expect(repository.snapshot.knownFactsRevision, 2);
      expect(repository.snapshot.evidence.last.id, _revealedEvidenceId);
      expect(repository.snapshot.inbox.last.id, _revealedInboxId);
      expect(repository.snapshot.deadlines.single.id, _revealedDeadlineId);
      expect(repository.snapshot.dossier!.facts.last.id, _revealedFactId);
      for (final String text in revealedText) {
        expect(_playerText(repository.snapshot), contains(text));
      }
      expect(
          _playerText(repository.snapshot), isNot(contains(_neverVisibleEn)));
      expect(
          _playerText(repository.snapshot), isNot(contains(_neverVisibleRu)));
      repository.dispose();
    }
  });

  testWidgets('player screens render a reveal only after Rust emits it', (
    WidgetTester tester,
  ) async {
    final GameSnapshot initial = ScenarioSnapshotMapper.map(
      source: _visibilitySnapshot(revealed: false),
      caseDefinition: definition,
      locale: 'ru',
    );
    final GameSnapshot revealed = ScenarioSnapshotMapper.map(
      source: _visibilitySnapshot(revealed: true),
      caseDefinition: definition,
      locale: 'ru',
    );

    await tester.pumpWidget(
      _testApp(
        DossierScreen(dossier: initial.dossier!, locale: 'ru'),
      ),
    );
    expect(find.text(_revealedFactRu), findsNothing);
    expect(find.text(_revealedEvidenceRu), findsNothing);
    expect(find.text(_revealedDeadlineRu), findsNothing);
    expect(find.text(_neverVisibleRu), findsNothing);

    await tester.pumpWidget(
      _testApp(
        DossierScreen(dossier: revealed.dossier!, locale: 'ru'),
      ),
    );
    await tester.scrollUntilVisible(
      find.text(_revealedDeadlineRu),
      300,
      scrollable: find.byType(Scrollable).last,
      maxScrolls: 10,
    );
    expect(find.text(_revealedFactRu), findsOneWidget);
    expect(find.text(_revealedEvidenceRu), findsOneWidget);
    expect(find.text(_revealedDeadlineRu), findsOneWidget);
    expect(find.text(_neverVisibleRu), findsNothing);

    await tester.pumpWidget(
      _testApp(
        InboxScreen(
          snapshot: initial,
          onMessageTap: (_) {},
          onCaseReportTap: () {},
        ),
      ),
    );
    expect(find.text(_revealedInboxRu), findsNothing);
    expect(
      find.byKey(const ValueKey<String>('inbox-item-$_revealedInboxId')),
      findsNothing,
    );

    await tester.pumpWidget(
      _testApp(
        InboxScreen(
          snapshot: revealed,
          onMessageTap: (_) {},
          onCaseReportTap: () {},
        ),
      ),
    );
    expect(find.text(_revealedInboxRu), findsOneWidget);
    expect(
      find.byKey(const ValueKey<String>('inbox-item-$_revealedInboxId')),
      findsOneWidget,
    );

    await tester.pumpWidget(
      _testApp(
        CalendarScreen(
          snapshot: initial,
          onOpenRelatedAction: (_) {},
        ),
      ),
    );
    expect(find.text(_revealedDeadlineRu), findsNothing);
    expect(
      find.byKey(const ValueKey<String>('calendar-item-$_revealedDeadlineId')),
      findsNothing,
    );

    await tester.pumpWidget(
      _testApp(
        CalendarScreen(
          snapshot: revealed,
          onOpenRelatedAction: (_) {},
        ),
      ),
    );
    expect(find.text(_revealedDeadlineRu), findsOneWidget);
    expect(
      find.byKey(const ValueKey<String>('calendar-item-$_revealedDeadlineId')),
      findsOneWidget,
    );
    expect(find.text(_neverVisibleRu), findsNothing);
  });

  testWidgets('English player screens obey the same authoritative reveal', (
    WidgetTester tester,
  ) async {
    final GameSnapshot initial = ScenarioSnapshotMapper.map(
      source: _visibilitySnapshot(revealed: false),
      caseDefinition: definition,
    );
    final GameSnapshot revealed = ScenarioSnapshotMapper.map(
      source: _visibilitySnapshot(revealed: true),
      caseDefinition: definition,
    );

    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: DossierScreen(dossier: initial.dossier!, locale: 'en'),
        ),
      ),
    );
    expect(find.text(_revealedFactEn), findsNothing);
    expect(find.text(_revealedEvidenceEn), findsNothing);
    expect(find.text(_revealedDeadlineEn), findsNothing);
    expect(find.text(_neverVisibleEn), findsNothing);

    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: DossierScreen(dossier: revealed.dossier!, locale: 'en'),
        ),
      ),
    );
    await tester.scrollUntilVisible(
      find.text(_revealedDeadlineEn),
      300,
      scrollable: find.byType(Scrollable).last,
      maxScrolls: 10,
    );
    expect(find.text(_revealedFactEn), findsOneWidget);
    expect(find.text(_revealedEvidenceEn), findsOneWidget);
    expect(find.text(_revealedDeadlineEn), findsOneWidget);
    expect(find.text(_neverVisibleEn), findsNothing);

    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: InboxScreen(
            snapshot: initial,
            onMessageTap: (_) {},
            onCaseReportTap: () {},
          ),
        ),
      ),
    );
    expect(find.text(_revealedInboxEn), findsNothing);

    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: InboxScreen(
            snapshot: revealed,
            onMessageTap: (_) {},
            onCaseReportTap: () {},
          ),
        ),
      ),
    );
    expect(find.text(_revealedInboxEn), findsOneWidget);
    expect(find.text(_neverVisibleEn), findsNothing);
  });
}

Widget _testApp(Widget child) {
  return MaterialApp(
    home: GameplayLocale(locale: 'ru', child: Scaffold(body: child)),
  );
}

String _playerText(GameSnapshot snapshot) {
  return <String>[
    snapshot.matterTitle,
    snapshot.stage,
    ...snapshot.evidence.expand(
      (EvidenceView item) => <String>[item.id, item.title, item.detail],
    ),
    ...snapshot.inbox.expand(
      (InboxItemView item) => <String>[
        item.id,
        item.sender,
        item.subject,
        item.body,
        ...item.resolutionActionIds,
      ],
    ),
    ...snapshot.deadlines.expand(
      (DeadlineView item) => <String>[
        item.id,
        item.title,
        if (item.relatedActionId != null) item.relatedActionId!,
      ],
    ),
    if (snapshot.dossier case final dossier?) ...<String>[
      ...dossier.facts.expand((item) => <String>[item.id, item.statement]),
      ...dossier.evidence.expand(
        (item) => <String>[
          item.id,
          item.title,
          if (item.description != null) item.description!,
          ...item.supportsFactIds,
          ...item.contradictsFactIds,
        ],
      ),
      ...dossier.deadlines.expand(
        (item) => <String>[item.id, item.title],
      ),
    ],
  ].join('|');
}

MobileCaseDefinition _visibilityCaseDefinition() {
  return MobileCaseDefinition.fromJson(<String, dynamic>{
    'case_id': 'snapshot_visibility_fixture',
    'scenario_id': 'snapshot_visibility_fixture',
    'sort_order': 999,
    'seed': 17,
    'status': 'playable',
    'difficulty': 'introductory',
    'jurisdiction': 'BE',
    'practice_area': 'civil_litigation',
    'player_client_id': 'client',
    'player_role': 'Counsel',
    'identity_file': 'test-only',
    'scenario_file': null,
    'scenario_available': true,
    'scenario': <String, dynamic>{
      'metadata': <String, String>{
        'id': 'snapshot_visibility_fixture',
        'title': 'Snapshot visibility fixture',
      },
      'initial_stage': 'intake',
      'stages': <Map<String, dynamic>>[
        <String, dynamic>{'id': 'intake', 'title': 'Intake'},
      ],
    },
    'runtime_adapter': 'scenario_definition_v1',
    'readiness': <String, bool>{
      'identity': true,
      'scenario_definition': true,
      'diagnostics': true,
      'path_simulation': true,
      'engine_runtime': true,
      'mobile_bundle': true,
    },
    'localizations': <String, dynamic>{
      'en': _caseText('Snapshot visibility fixture'),
      'ru': _caseText('Проверка видимости снимка'),
    },
    'scenario_localizations': <String, dynamic>{
      'en': _scenarioLocalization(
        fact: _revealedFactEn,
        evidence: _revealedEvidenceEn,
        inbox: _revealedInboxEn,
        deadline: _revealedDeadlineEn,
        neverVisible: _neverVisibleEn,
      ),
      'ru': _scenarioLocalization(
        fact: _revealedFactRu,
        evidence: _revealedEvidenceRu,
        inbox: _revealedInboxRu,
        deadline: _revealedDeadlineRu,
        neverVisible: _neverVisibleRu,
      ),
    },
  });
}

Map<String, dynamic> _caseText(String caption) => <String, dynamic>{
      'caption': caption,
      'topic': 'Visibility',
      'short_title': caption,
      'synopsis': 'Test fixture.',
      'player_client_name': 'Client',
      'player_client_role': 'Claimant',
      'legal_issues': <String>['Visibility'],
    };

Map<String, dynamic> _scenarioLocalization({
  required String fact,
  required String evidence,
  required String inbox,
  required String deadline,
  required String neverVisible,
}) {
  return <String, dynamic>{
    'facts': <String, dynamic>{
      _revealedFactId: <String, String>{'statement': fact},
      'sentinel_never_visible_fact': <String, String>{
        'statement': neverVisible,
      },
    },
    'evidence': <String, dynamic>{
      _revealedEvidenceId: <String, String>{'title': evidence},
      _neverVisibleEvidenceId: <String, String>{'title': neverVisible},
    },
    'inbox_items': <String, dynamic>{
      _revealedInboxId: <String, String>{
        'sender': 'Runtime',
        'subject': inbox,
        'body': '$inbox body',
      },
      'sentinel_never_visible_inbox': <String, String>{
        'subject': neverVisible,
        'body': neverVisible,
      },
    },
    'deadlines': <String, dynamic>{
      _revealedDeadlineId: <String, String>{'title': deadline},
      'sentinel_never_visible_deadline': <String, String>{
        'title': neverVisible,
      },
    },
  };
}

Map<String, dynamic> _visibilitySnapshot({required bool revealed}) {
  final List<Map<String, dynamic>> facts = <Map<String, dynamic>>[
    <String, dynamic>{
      'id': 'visible_fact',
      'statement': 'Visible fact',
      'status': 'proven',
    },
    if (revealed)
      <String, dynamic>{
        'id': _revealedFactId,
        'statement': 'Revealed fact fallback',
        'status': 'disputed',
      },
  ];
  final List<Map<String, dynamic>> evidence = <Map<String, dynamic>>[
    <String, dynamic>{
      'id': 'visible_evidence',
      'title': 'Visible evidence',
      'kind': 'document',
      'available': true,
    },
    if (revealed)
      <String, dynamic>{
        'id': _revealedEvidenceId,
        'title': 'Revealed evidence fallback',
        'kind': 'document',
        'available': true,
      },
  ];
  final List<Map<String, dynamic>> inbox = <Map<String, dynamic>>[
    <String, dynamic>{
      'id': 'visible_inbox',
      'sender': 'Runtime',
      'subject': 'Visible inbox',
      'body': 'Visible body',
      'visible': true,
      'resolved': false,
      'action_required': false,
      'resolution_action_ids': <String>[],
    },
    if (revealed)
      <String, dynamic>{
        'id': _revealedInboxId,
        'sender': 'Runtime',
        'subject': 'Revealed inbox fallback',
        'body': 'Revealed body fallback',
        'visible': true,
        'resolved': false,
        'action_required': false,
        'resolution_action_ids': <String>[],
      },
  ];
  final List<Map<String, dynamic>> deadlines = <Map<String, dynamic>>[
    if (revealed)
      <String, dynamic>{
        'id': _revealedDeadlineId,
        'title': 'Revealed deadline fallback',
        'due_at_minutes': 360,
        'status': 'open',
        'completion_action_ids': <String>[],
      },
  ];

  return <String, dynamic>{
    'snapshot_schema_version': 1,
    'scenario_id': 'snapshot_visibility_fixture',
    'seed': 17,
    'stage_id': 'intake',
    'stage_title': 'Intake',
    'clock_minutes': 60,
    'clock_mode': 'foreground',
    'judicial_result': null,
    'judicial_decision_instance': null,
    'matter_lifecycle': 'active',
    'is_closed': false,
    'resolved_outcome': null,
    'terminal': false,
    'flags': <String, bool>{},
    'facts': facts,
    'evidence': evidence,
    'deadlines': deadlines,
    'inbox': inbox,
    'available_actions': <Map<String, dynamic>>[
      if (!revealed)
        <String, dynamic>{
          'id': 'reveal_entities',
          'title': 'Reveal entities',
          'description': 'Reveal the intended player entities.',
          'time_cost_minutes': 5,
          'cost_eur': 0,
        },
    ],
    'fired_event_ids': <String>[],
    'outcome': null,
    'dossier': <String, dynamic>{
      'projection_schema_version': 1,
      'procedure': <String, dynamic>{
        'stage_id': 'intake',
        'stage_title': 'Intake',
        'clock_minutes': 60,
        'matter_lifecycle': 'active',
        'is_closed': false,
        'matter_status': 'open',
      },
      'judicial_result': null,
      'judicial_decision_instance': null,
      'facts': facts,
      'evidence': <Map<String, dynamic>>[
        <String, dynamic>{
          'id': 'visible_evidence',
          'title': 'Visible evidence',
          'kind': 'document',
          'description': 'Visible description',
          'supports_fact_ids': <String>['visible_fact'],
          'contradicts_fact_ids': <String>[],
        },
        if (revealed)
          <String, dynamic>{
            'id': _revealedEvidenceId,
            'title': 'Revealed evidence fallback',
            'kind': 'document',
            'description': 'Revealed description fallback',
            'supports_fact_ids': <String>[_revealedFactId],
            'contradicts_fact_ids': <String>[],
          },
      ],
      'deadlines': <Map<String, dynamic>>[
        if (revealed)
          <String, dynamic>{
            'id': _revealedDeadlineId,
            'title': 'Revealed deadline fallback',
            'due_at_minutes': 360,
            'status': 'open',
            'remedies': <Map<String, dynamic>>[],
          },
      ],
      'outcome': null,
    },
  };
}

final class _VisibilityBridgeClient implements ScenarioBridgeClient {
  bool _revealed = false;
  int responseCount = 0;

  @override
  String execute(String encodedRequest) {
    final Map<String, dynamic> request =
        jsonDecode(encodedRequest) as Map<String, dynamic>;
    switch (request['command']) {
      case 'create_session':
        return _response('session_created');
      case 'dispatch':
        if (request['action_id'] != 'reveal_entities' || _revealed) {
          return jsonEncode(<String, dynamic>{
            'type': 'error',
            'code': 'action_unavailable',
            'message': 'Unavailable action',
          });
        }
        _revealed = true;
        return _response('snapshot');
      case 'dispose_session':
        return jsonEncode(<String, dynamic>{
          'type': 'session_disposed',
          'session_id': 1,
          'disposed': true,
        });
      default:
        return jsonEncode(<String, dynamic>{
          'type': 'error',
          'code': 'unsupported_command',
          'message': 'Unsupported command',
        });
    }
  }

  String _response(String type) {
    responseCount += 1;
    return jsonEncode(<String, dynamic>{
      'type': type,
      'session_id': 1,
      'snapshot': _visibilitySnapshot(revealed: _revealed),
    });
  }
}
