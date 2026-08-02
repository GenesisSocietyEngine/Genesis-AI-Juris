import 'dart:convert';

import 'package:juris_mobile/models/case_catalog.dart';

/// Debug/integration-only lifecycle content.
///
/// This definition is compiled only into the Android integration test target.
/// It is intentionally absent from the production mobile bundle and catalog.
/// The focused deadline and inbox records make save/load restoration observable
/// at the Flutter presentation boundary without changing production content.
MobileCaseDefinition matterLifecycleAndroidTestCase() {
  final Map<String, dynamic> scenario = jsonDecode(
    _scenarioJson,
  ) as Map<String, dynamic>;
  return MobileCaseDefinition.fromJson(<String, dynamic>{
    'case_id': 'integration_adverse_judgment_with_remedies',
    'scenario_id': 'integration_adverse_judgment_with_remedies',
    'sort_order': 999,
    'seed': 20260802,
    'status': 'playable',
    'difficulty': 'introductory',
    'jurisdiction': 'BE',
    'practice_area': 'civil_litigation',
    'player_client_id': 'integration_client',
    'player_role': 'Counsel',
    'identity_file': 'integration-test-only',
    'scenario_file': null,
    'scenario_available': true,
    'scenario': scenario,
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
      'en': _caseText(
        caption: 'Lifecycle compatibility fixture',
        topic: 'Remedies after adverse judgment',
        shortTitle: 'Lost but open',
        synopsis: 'A first-instance loss with an available appeal.',
        clientName: 'Integration Client',
        clientRole: 'Claimant',
        issue: 'Appeal deadline',
      ),
      'ru': _caseText(
        caption: 'Тест совместимости жизненного цикла',
        topic: 'Средства защиты после неблагоприятного решения',
        shortTitle: 'Проиграно, но не закрыто',
        synopsis: 'Поражение в первой инстанции с доступной апелляцией.',
        clientName: 'Тестовый клиент',
        clientRole: 'Истец',
        issue: 'Срок апелляции',
      ),
    },
    'scenario_localizations': <String, dynamic>{
      'ru': <String, dynamic>{
        'metadata': <String, String>{
          'title': 'Неблагоприятное решение и доступная апелляция',
        },
        'stages': <String, dynamic>{
          'hearing': <String, String>{'title': 'Судебное заседание'},
          'post_judgment_remedies': <String, String>{
            'title': 'Средства защиты после решения',
          },
          'appeal': <String, String>{'title': 'Апелляция'},
          'resolved': <String, String>{'title': 'Завершено'},
        },
        'actions': <String, dynamic>{
          'request_judgment': <String, String>{
            'title': 'Запросить решение',
            'description': 'Передать дело на разрешение суда.',
          },
          'adverse_trial_judgment': <String, String>{
            'title': 'Получить неблагоприятное решение',
            'description': 'Получить решение первой инстанции.',
          },
          'file_appeal': <String, String>{
            'title': 'Подать апелляцию',
            'description': 'Использовать доступное средство обжалования.',
          },
          'waive_appeal': <String, String>{
            'title': 'Отказаться от апелляции и закрыть дело',
            'description': 'Принять результат и явно закрыть дело.',
          },
        },
        'deadlines': <String, dynamic>{
          'appeal_deadline': <String, String>{
            'title': 'Подать апелляцию',
          },
        },
        'inbox_items': <String, dynamic>{
          'adverse_judgment_notice': <String, String>{
            'subject': 'Получено неблагоприятное решение первой инстанции',
            'body':
                'Дело остаётся открытым; апелляция доступна до истечения срока.',
          },
        },
      },
    },
  });
}

Map<String, dynamic> _caseText({
  required String caption,
  required String topic,
  required String shortTitle,
  required String synopsis,
  required String clientName,
  required String clientRole,
  required String issue,
}) {
  return <String, dynamic>{
    'caption': caption,
    'topic': topic,
    'short_title': shortTitle,
    'synopsis': synopsis,
    'player_client_name': clientName,
    'player_client_role': clientRole,
    'legal_issues': <String>[issue],
  };
}

const String _scenarioJson = r'''
{
  "schema_version": "1.0",
  "metadata": {
    "id": "integration_adverse_judgment_with_remedies",
    "title": "Adverse Judgment with Available Remedies",
    "summary": "Android-only fixture proving that a judicial loss does not close a matter.",
    "content_version": "1",
    "tags": ["fixture", "lifecycle", "android"]
  },
  "jurisdiction": {"code": "BE", "pack_version": "1"},
  "initial_stage": "hearing",
  "stages": [
    {
      "id": "hearing",
      "title": "Hearing",
      "kind": "hearing",
      "exit_actions": ["request_judgment", "adverse_trial_judgment"]
    },
    {
      "id": "post_judgment_remedies",
      "title": "Post-judgment remedies",
      "kind": "post_judgment",
      "exit_actions": ["file_appeal", "waive_appeal"]
    },
    {
      "id": "appeal",
      "title": "Appeal",
      "kind": "appeal",
      "exit_actions": ["abandon_appeal"]
    },
    {
      "id": "resolved",
      "title": "Resolved",
      "kind": "resolved",
      "terminal": true
    }
  ],
  "actions": [
    {
      "id": "request_judgment",
      "title": "Request judgment",
      "description": "Submit the matter for a first-instance judgment.",
      "available_when": {"type": "stage_is", "stage": "hearing"},
      "effects": [
        {"type": "set_flag", "flag": "judgment_requested", "value": true},
        {"type": "trigger_event", "event": "hearing_scheduled"}
      ],
      "time_cost_minutes": 15,
      "cost_eur": 250
    },
    {
      "id": "adverse_trial_judgment",
      "title": "Receive adverse trial judgment",
      "description": "Receive the court's first-instance decision.",
      "available_when": {
        "type": "all",
        "conditions": [
          {"type": "stage_is", "stage": "hearing"},
          {"type": "flag_equals", "flag": "judgment_requested", "value": true}
        ]
      },
      "effects": [
        {"type": "trigger_event", "event": "adverse_judgment_delivered"}
      ],
      "time_cost_minutes": 45,
      "cost_eur": 500
    },
    {
      "id": "file_appeal",
      "title": "File appeal",
      "description": "Use the available appellate remedy before its deadline.",
      "available_when": {
        "type": "all",
        "conditions": [
          {"type": "stage_is", "stage": "post_judgment_remedies"},
          {"type": "judicial_result_is", "result": "lost"},
          {"type": "deadline_status_is", "deadline": "appeal_deadline", "status": "open"}
        ]
      },
      "effects": [
        {"type": "complete_deadline", "deadline": "appeal_deadline"},
        {"type": "resolve_inbox_item", "item": "adverse_judgment_notice"},
        {"type": "set_stage", "stage": "appeal"}
      ],
      "time_cost_minutes": 60,
      "cost_eur": 1500
    },
    {
      "id": "waive_appeal",
      "title": "Waive appeal and close",
      "description": "Accept the result and expressly close the matter.",
      "available_when": {
        "type": "all",
        "conditions": [
          {"type": "stage_is", "stage": "post_judgment_remedies"},
          {"type": "judicial_result_is", "result": "lost"}
        ]
      },
      "effects": [
        {"type": "complete_deadline", "deadline": "appeal_deadline"},
        {"type": "resolve_inbox_item", "item": "adverse_judgment_notice"},
        {"type": "set_stage", "stage": "resolved"},
        {"type": "resolve_outcome", "outcome": "final_loss"}
      ],
      "time_cost_minutes": 5,
      "cost_eur": 200
    },
    {
      "id": "abandon_appeal",
      "title": "Abandon appeal and close",
      "description": "End the appeal and expressly close the matter.",
      "available_when": {"type": "stage_is", "stage": "appeal"},
      "effects": [
        {"type": "set_stage", "stage": "resolved"},
        {"type": "resolve_outcome", "outcome": "final_loss"}
      ],
      "time_cost_minutes": 5,
      "cost_eur": 200
    }
  ],
  "facts": [],
  "evidence": [],
  "deadlines": [
    {
      "id": "appeal_deadline",
      "title": "File appeal",
      "due_at": {"day": 0, "minute_of_day": 300},
      "activation_event": "adverse_judgment_delivered",
      "completion_actions": ["file_appeal", "waive_appeal"],
      "missed_event": "appeal_deadline_missed"
    }
  ],
  "async_tasks": [],
  "inbox_items": [
    {
      "id": "adverse_judgment_notice",
      "subject": "Adverse first-instance judgment received",
      "body": "The matter remains open and an appeal is available until the deadline.",
      "created_by_event": "adverse_judgment_delivered",
      "initially_visible": false,
      "action_required": true,
      "resolution_actions": ["file_appeal", "waive_appeal"],
      "expiry_event": "appeal_deadline_missed"
    }
  ],
  "events": [
    {
      "id": "hearing_scheduled",
      "title": "Hearing scheduled",
      "kind": "hearing_scheduled",
      "trigger": {"type": "by_effect"}
    },
    {
      "id": "adverse_judgment_delivered",
      "title": "Adverse first-instance judgment delivered",
      "kind": "hearing_closed",
      "trigger": {"type": "by_effect"},
      "effects": [
        {"type": "set_judicial_result", "result": "lost"},
        {"type": "set_stage", "stage": "post_judgment_remedies"},
        {"type": "create_inbox_item", "item": "adverse_judgment_notice"}
      ]
    },
    {
      "id": "appeal_deadline_missed",
      "title": "Appeal deadline missed",
      "kind": "generic",
      "trigger": {"type": "deadline_missed", "deadline": "appeal_deadline"},
      "effects": [
        {"type": "miss_deadline", "deadline": "appeal_deadline"}
      ]
    }
  ],
  "outcomes": [
    {
      "id": "final_loss",
      "title": "Final loss",
      "summary": "The adverse result became final after waiver of remedies.",
      "terminal_stage": "resolved",
      "condition": {"type": "judicial_result_is", "result": "lost"}
    }
  ]
}
''';
