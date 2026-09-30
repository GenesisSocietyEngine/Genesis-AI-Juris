import 'dart:convert';
import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:juris_mobile/data/scenario_bridge_client.dart';
import 'package:juris_mobile/data/tax_artifact_store.dart';
import 'package:juris_mobile/data/tax_authoring_repository.dart';
import 'package:juris_mobile/screens/tax_editor_screen.dart';

const String _rateConfirmation =
    'I reviewed and confirm both entered tax rates';
const String _componentConfirmation = 'I confirm this amount and its source';

void main() {
  for (final ({String field, String raw, String message, String corrected}) row
      in <({String field, String raw, String message, String corrected})>[
    (
      field: 'baseline_annual_tax_cost',
      raw: '250000.00x',
      message:
          'Current annual tax: Enter an amount with at most two decimal places, using a dot.',
      corrected: '250000.00'
    ),
    (
      field: 'baseline_annual_tax_cost',
      raw: '1000000000001.00',
      message: 'Current annual tax: Amount exceeds the supported range.',
      corrected: '-0.01'
    ),
    (
      field: 'baseline_tax_rate_bps',
      raw: '',
      message: 'Current rate (basis points): Enter a whole number.',
      corrected: '1800'
    ),
  ]) {
    testWidgets(
        'invalid ${row.field} ${row.raw} retains draft and gives guidance',
        (WidgetTester tester) async {
      await tester.runAsync(() async {
        final bool money = row.field == 'baseline_annual_tax_cost';
        final _EditorFixture fixture =
            await _mount(tester, basis: money ? 'amounts' : 'rates');
        final Finder field = find.byKey(ValueKey('tax-0-${row.field}'));
        final TextField text = tester.widget<TextField>(
            find.descendant(of: field, matching: find.byType(TextField)));
        expect(text.keyboardType,
            TextInputType.numberWithOptions(decimal: money, signed: true));
        expect(text.autocorrect, isFalse);
        await tester.enterText(field, row.raw);
        await tester.pump();
        if (!money) await _tap(tester, find.text(_rateConfirmation));
        await _tap(tester, find.byKey(const ValueKey('tax-calculate')));
        expect(find.text(row.message), findsOneWidget);
        expect(find.textContaining('FormatException'), findsNothing);
        expect(fixture.bridge.calculations, isEmpty);
        await _tap(tester, find.byKey(const ValueKey('tax-save')));
        final Map<String, dynamic> saved = (await fixture.store.read('case1'))!;
        expect((saved['edit'] as Map<String, dynamic>)[row.field], row.raw);
        expect(saved['calculation'], isNull);

        await tester.enterText(field, row.corrected);
        await tester.pump();
        if (!money) await _tap(tester, find.text(_rateConfirmation));
        await _tap(tester, find.byKey(const ValueKey('tax-calculate')));
        final Map<String, dynamic> request = fixture
            .bridge.calculations.single['request'] as Map<String, dynamic>;
        expect((request['input'] as Map<String, dynamic>)[row.field],
            money ? taxCents(row.corrected) : int.parse(row.corrected));
        expect(tester.takeException(), isNull);
      });
    });
  }

  for (final String field in <String>[
    'baseline_tax_rate_bps',
    'optimized_tax_rate_bps',
  ]) {
    testWidgets('editing imported $field requires fresh confirmation',
        (WidgetTester tester) async {
      await tester.runAsync(() async {
        final _EditorFixture fixture = await _mount(tester);
        expect(_confirmation(tester, _rateConfirmation).value, isTrue);

        await tester.enterText(find.byKey(ValueKey('tax-0-$field')), '1800');
        await tester.pump();
        expect(_confirmation(tester, _rateConfirmation).value, isFalse);
        await _tap(tester, find.byKey(const ValueKey('tax-calculate')));
        expect(fixture.bridge.calculations, isEmpty);
        expect(
            find.textContaining('Review and explicitly confirm both tax rates'),
            findsOneWidget);

        await _tap(tester, find.byKey(const ValueKey('tax-save')));
        final Map<String, dynamic> saved = (await fixture.store.read('case1'))!;
        expect(saved['rates_confirmed'], isFalse);
        expect((saved['edit'] as Map<String, dynamic>)[field], '1800');
        expect(saved['calculation'], isNull);

        await _tap(tester, find.text(_rateConfirmation));
        await _tap(tester, find.byKey(const ValueKey('tax-calculate')));
        expect(fixture.bridge.calculations, hasLength(1));
        final Map<String, dynamic> request = fixture
            .bridge.calculations.single['request'] as Map<String, dynamic>;
        expect((request['input'] as Map<String, dynamic>)[field], 1800);
        expect(tester.takeException(), isNull);
      });
    });
  }

  for (final String field in <String>['period', 'jurisdiction']) {
    testWidgets('editing component $field removes its prior confirmation',
        (WidgetTester tester) async {
      await tester.runAsync(() async {
        final _EditorFixture fixture = await _mount(tester, component: true);
        await _tap(tester, find.text('Income component'));
        expect(_confirmation(tester, _componentConfirmation).value, isTrue);
        final String replacement = field == 'period' ? '2027' : 'FR';

        await tester.enterText(
            find.byKey(ValueKey('tax-0-income-$field')), replacement);
        await tester.pump();
        expect(_confirmation(tester, _componentConfirmation).value, isFalse);
        await _tap(tester, find.byKey(const ValueKey('tax-calculate')));
        final Map<String, dynamic> sent =
            (fixture.bridge.calculations.single['bindings'] as List<dynamic>)
                .single as Map<String, dynamic>;
        expect(sent[field], replacement);
        expect(sent['confirmed'], isFalse);

        await _tap(tester, find.byKey(const ValueKey('tax-save')));
        final Map<String, dynamic> saved = (await fixture.store.read('case1'))!;
        final Map<String, dynamic> binding =
            (saved['bindings'] as List<dynamic>).single as Map<String, dynamic>;
        expect(binding[field], replacement);
        expect(binding['confirmed'], isFalse);
        expect(saved['calculation'], isNull);

        await _tap(tester, find.text(_componentConfirmation));
        await _tap(tester, find.byKey(const ValueKey('tax-calculate')));
        expect(fixture.bridge.calculations, hasLength(2));
        final Map<String, dynamic> confirmed =
            (fixture.bridge.calculations.last['bindings'] as List<dynamic>)
                .single as Map<String, dynamic>;
        expect(confirmed[field], replacement);
        expect(confirmed['confirmed'], isTrue);
        expect(tester.takeException(), isNull);
      });
    });
  }
}

CheckboxListTile _confirmation(WidgetTester tester, String label) => tester
    .widget<CheckboxListTile>(find.widgetWithText(CheckboxListTile, label));

Future<void> _tap(WidgetTester tester, Finder finder) async {
  await tester.ensureVisible(finder);
  await tester.tap(finder);
  await _settleIo(tester);
}

Future<void> _settleIo(WidgetTester tester) async {
  for (int attempt = 0; attempt < 250; attempt++) {
    await Future<void>.delayed(const Duration(milliseconds: 20));
    await tester.pump();
    if (find.byType(CircularProgressIndicator).evaluate().isEmpty &&
        find.text('Saving…').evaluate().isEmpty) {
      await tester.pumpAndSettle();
      return;
    }
  }
  throw StateError('Editor filesystem work did not complete within 5 seconds.');
}

Future<_EditorFixture> _mount(WidgetTester tester,
    {bool component = false, String basis = 'rates'}) async {
  final Directory directory =
      await Directory.systemTemp.createTemp('tax-confirmation-');
  addTearDown(() => directory.delete(recursive: true));
  final TaxArtifactStore store =
      TaxArtifactStore(directoryProvider: () async => directory);
  final Map<String, dynamic> scenario = <String, dynamic>{
    'metadata': <String, dynamic>{'id': 'case1'},
    'facts': <dynamic>[
      <String, dynamic>{'id': 'income_fact', 'statement': 'Annual income'},
    ],
  };
  final Map<String, dynamic> input = <String, dynamic>{
    'currency': 'EUR',
    'tax_input_basis': basis,
    'tax_base_mode': 'derived',
    'assumptions': '',
    'baseline_annual_tax_cost': '0',
    'optimized_annual_tax_cost': '0',
    'implementation_cost': '0',
    'annual_maintenance_cost': '0',
    'terminal_tax_or_unwind_cost': '0',
    'annual_tax_base_override': null,
    'baseline_tax_rate_bps': 2500,
    'optimized_tax_rate_bps': 2000,
    'analysis_horizon_months': 12,
    'annual_discount_rate_bps': 0,
    'benefit_realization_bps': 10000,
  };
  final Map<String, dynamic> request = <String, dynamic>{
    'input_schema': 'tax-economics-input-v2',
    'transport_protocol': 'tax-economics-json-v1',
    'application_policy': 'tax-editor-v1',
    'context': <String, dynamic>{
      'case_id': 'case1',
      'artifact_id': 'tax_case1',
      'revision': '1',
      'scenario_fingerprint': 'fixture-fingerprint',
    },
    'input': input,
  };
  await store.write('case1', <String, dynamic>{
    'schema': 'tax-authoring-artifact-v1',
    'case_id': 'case1',
    'scenario': scenario,
    'artifact_revision': '1',
    'request': request,
    'edit': <String, dynamic>{
      for (final String field in <String>[
        'baseline_annual_tax_cost',
        'optimized_annual_tax_cost',
        'implementation_cost',
        'annual_maintenance_cost',
        'terminal_tax_or_unwind_cost',
      ])
        field: '0.00',
      'annual_tax_base_override': '',
      for (final String field in <String>[
        'baseline_tax_rate_bps',
        'optimized_tax_rate_bps',
        'analysis_horizon_months',
        'annual_discount_rate_bps',
        'benefit_realization_bps',
      ])
        field: '${input[field]}',
    },
    'bindings': <dynamic>[
      if (component)
        <String, dynamic>{
          'component_id': 'income',
          'label': 'Income component',
          'category': 'taxable_income',
          'amount_text': '100.00',
          'currency': 'EUR',
          'fact_id': 'income_fact',
          'source_field': 'amount',
          'scenario_fingerprint': 'fixture-fingerprint',
          'period': '2026',
          'jurisdiction': 'BE',
          'note': '',
          'include_in_calculation': true,
          'confirmed': true,
          'confirmation_owner': 'Reviewer',
          'confirmation_as_of': '2026-09-29',
        },
    ],
    'benefits': <dynamic>[],
    'required_component_ids': <dynamic>[],
    'legacy': component
        ? null
        : <String, dynamic>{
            'status': <String, dynamic>{
              'status': 'converted',
              'draft': <String, dynamic>{
                'unavailable_legacy_fields': <String>[
                  'baselineTaxRate',
                  'optimizedTaxRate',
                ],
              },
            },
          },
    'rates_confirmed': true,
    'calculation': null,
  });
  final _RecordingTaxBridge bridge = _RecordingTaxBridge(request);
  await tester.pumpWidget(MaterialApp(
      home: TaxEditorScreen(
          scenario: scenario,
          repository: TaxAuthoringRepository(bridge),
          locale: 'en',
          store: store)));
  await _settleIo(tester);
  return _EditorFixture(store, bridge);
}

final class _EditorFixture {
  const _EditorFixture(this.store, this.bridge);
  final TaxArtifactStore store;
  final _RecordingTaxBridge bridge;
}

// Checks the editor's confirmation gate and exact outbound state. Financial
// validation and calculation remain covered by the native bridge suites.
final class _RecordingTaxBridge implements ScenarioBridgeClient {
  _RecordingTaxBridge(this.request);
  final Map<String, dynamic> request;
  final List<Map<String, dynamic>> calculations = <Map<String, dynamic>>[];

  @override
  String execute(String encoded) {
    final Map<String, dynamic> command =
        jsonDecode(encoded) as Map<String, dynamic>;
    switch (command['command']) {
      case 'tax_capabilities':
        return jsonEncode(<String, dynamic>{
          'type': 'tax_capabilities',
          'transport_protocol': 'tax-economics-json-v1',
          'input_schema': 'tax-economics-input-v2',
          'result_schema': 'tax-economics-result-v2',
          'application_policy': 'tax-editor-v1',
        });
      case 'tax_prepare':
        return jsonEncode(<String, dynamic>{
          'type': 'tax_prepared',
          'request': request,
        });
      case 'tax_calculate':
        calculations.add(command);
        return jsonEncode(<String, dynamic>{
          'type': 'tax_error',
          'detail': <String, dynamic>{'code': 'incomplete_binding'},
        });
      default:
        throw StateError('Unexpected test command: ${command['command']}');
    }
  }
}
