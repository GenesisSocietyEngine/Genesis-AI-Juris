import 'dart:convert';
import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:juris_mobile/data/scenario_bridge_client.dart';
import 'package:juris_mobile/data/tax_artifact_store.dart';
import 'package:juris_mobile/data/tax_authoring_repository.dart';
import 'package:juris_mobile/screens/tax_editor_screen.dart';

void main() {
  testWidgets(
      'converted legacy snapshot survives edited provenance rates and money',
      (WidgetTester tester) async {
    await tester.runAsync(() async {
      final Directory directory =
          await Directory.systemTemp.createTemp('tax-legacy-preservation-');
      addTearDown(() => directory.delete(recursive: true));
      final TaxArtifactStore store =
          TaxArtifactStore(directoryProvider: () async => directory);
      final _DialogBridge bridge = _DialogBridge(convertedImport: true);
      await tester.pumpWidget(MaterialApp(
        home: TaxEditorScreen(
          scenario: const <String, dynamic>{
            'metadata': <String, dynamic>{'id': 'case1'},
            'facts': <dynamic>[]
          },
          repository: TaxAuthoringRepository(bridge),
          locale: 'en',
          store: store,
        ),
      ));
      await _settleIo(tester);
      Future<void> tap(Finder finder) async {
        await tester.ensureVisible(finder);
        await tester.tap(finder);
        await _settleIo(tester);
      }

      await tap(find.text('Import analysis / legacy input'));
      final Finder dialog = find.byType(AlertDialog);
      await tap(find.descendant(
          of: dialog, matching: find.byType(DropdownButtonFormField<String>)));
      await tap(find.text('Legacy rates / FX (v1)').last);
      const String original = '  {"taxInputBasis":"rates","fx":{}}\n';
      await tester.enterText(
          find.descendant(of: dialog, matching: find.byType(TextField)),
          original);
      await tap(find.widgetWithText(TextButton, 'Import'));
      final Map<String, dynamic> retained =
          jsonDecode(jsonEncode(bridge.importedLegacy)) as Map<String, dynamic>;
      final Map<String, String> edits = <String, String>{
        'override_reason': 'Reviewed manual base',
        'override_owner': 'New confirming person',
        'override_as_of': '2026-09-30',
        'baseline_tax_rate_bps': '1800',
        'optimized_tax_rate_bps': '900',
        'implementation_cost': '1234.56',
      };
      for (final MapEntry<String, String> edit in edits.entries) {
        final Finder field = find.byKey(ValueKey('tax-1-${edit.key}'));
        await tester.ensureVisible(field);
        await tester.enterText(field, edit.value);
        await tester.pump();
      }
      await tap(find.byKey(const ValueKey('tax-save')));
      Map<String, dynamic> saved = (await store.read('case1'))!;
      expect(saved['legacy'], retained,
          reason: 'Editing the active request must not mutate the retained '
              'converted draft or its input hash.');
      final Map<String, dynamic> request =
          saved['request'] as Map<String, dynamic>;
      final Map<String, dynamic> input =
          request['input'] as Map<String, dynamic>;
      expect(input['override_owner'], edits['override_owner']);
      expect(input['override_as_of'], edits['override_as_of']);
      expect(input['override_reason'], edits['override_reason']);
      expect((saved['edit'] as Map<String, dynamic>)['implementation_cost'],
          '1234.56');
      expect(saved['rates_confirmed'], isFalse);
      expect(saved['calculation'], isNull);

      await tap(find.text('I reviewed and confirm both entered tax rates'));
      await tap(find.byKey(const ValueKey('tax-calculate')));
      final Map<String, dynamic> sent =
          bridge.calculations.single['request'] as Map<String, dynamic>;
      final Map<String, dynamic> sentInput =
          sent['input'] as Map<String, dynamic>;
      expect(sentInput['baseline_tax_rate_bps'], 1800);
      expect(sentInput['optimized_tax_rate_bps'], 900);
      expect(sentInput['implementation_cost'], '123456');
      expect(sentInput['override_owner'], edits['override_owner']);
      await tap(find.byKey(const ValueKey('tax-save')));
      saved = (await store.read('case1'))!;
      expect(saved['legacy'], retained);
      final Map<String, dynamic> legacy =
          saved['legacy'] as Map<String, dynamic>;
      expect(legacy['original_json'], original);
      expect(legacy['original_sha256'], 'fixture-original-hash');
      final Map<String, dynamic> draft = (legacy['status']
          as Map<String, dynamic>)['draft'] as Map<String, dynamic>;
      expect(draft['input_hash'], 'fixture-input-hash');
      expect(draft['fx_json'], ' {"rate":1.2300e+0} ');
      expect(
          (draft['request'] as Map<String, dynamic>)['context'],
          (retained['status'] as Map<String, dynamic>)['draft']['request']
              ['context']);
      expect(tester.takeException(), isNull);
    });
  });

  for (final String locale in <String>['en', 'ru']) {
    testWidgets('import format and actions fit enlarged text in $locale',
        (WidgetTester tester) async {
      tester.view.physicalSize = const Size(360, 800);
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.reset);
      await tester.runAsync(() async {
        final Directory directory =
            await Directory.systemTemp.createTemp('tax-import-large-text-');
        addTearDown(() => directory.delete(recursive: true));
        final _DialogBridge bridge = _DialogBridge();
        await tester.pumpWidget(MaterialApp(
          builder: (BuildContext context, Widget? child) => MediaQuery(
              data: MediaQuery.of(context)
                  .copyWith(textScaler: const TextScaler.linear(1.5)),
              child: child!),
          home: TaxEditorScreen(
            scenario: const <String, dynamic>{
              'metadata': <String, dynamic>{'id': 'case1'},
              'facts': <dynamic>[]
            },
            repository: TaxAuthoringRepository(bridge),
            locale: locale,
            store: TaxArtifactStore(directoryProvider: () async => directory),
          ),
        ));
        await _settleIo(tester);
        final Finder open = find.text(locale == 'en'
            ? 'Import analysis / legacy input'
            : 'Импорт анализа / старых данных');
        await tester.ensureVisible(open);
        await tester.tap(open);
        await tester.pumpAndSettle();
        final Finder dialog = find.byType(AlertDialog);
        final Finder selector = find.descendant(
            of: dialog, matching: find.byType(DropdownButtonFormField<String>));
        final Finder selected = find
            .text(locale == 'en' ? 'Saved analysis (v1)' : 'Анализ (v1)')
            .hitTestable();
        final Rect box = tester.getRect(selector);
        final Rect label = tester.getRect(selected);
        expect(box.contains(label.topLeft), isTrue);
        expect(
            box.contains(label.bottomRight - const Offset(0.1, 0.1)), isTrue);
        expect(tester.renderObject<RenderParagraph>(selected).didExceedMaxLines,
            isFalse);
        expect(tester.takeException(), isNull);
        await tester.tap(selector);
        await tester.pumpAndSettle();
        await tester.tap(find
            .text(locale == 'en'
                ? 'Legacy rates / FX (v1)'
                : 'Прежние ставки / FX (v1)')
            .last);
        await tester.pumpAndSettle();
        final Finder legacyLabel = find
            .text(locale == 'en'
                ? 'Legacy rates / FX (v1)'
                : 'Прежние ставки / FX (v1)')
            .hitTestable();
        final Rect legacyBounds = tester.getRect(legacyLabel);
        final Rect selectedBounds = tester.getRect(selector);
        expect(selectedBounds.contains(legacyBounds.topLeft), isTrue);
        expect(
            selectedBounds
                .contains(legacyBounds.bottomRight - const Offset(0.1, 0.1)),
            isTrue);
        expect(
            tester.renderObject<RenderParagraph>(legacyLabel).didExceedMaxLines,
            isFalse);
        final Finder field =
            find.descendant(of: dialog, matching: find.byType(TextField));
        final TextField input = tester.widget<TextField>(field);
        expect(input.autocorrect, isFalse);
        expect(input.enableSuggestions, isFalse);
        const String original = '  {"benefitRealizationBps":10000}\n';
        await tester.enterText(field, original);
        tester.view.viewInsets = const FakeViewPadding(bottom: 250);
        await tester.pumpAndSettle();
        final Finder import = find.widgetWithText(
            TextButton, locale == 'en' ? 'Import' : 'Импорт');
        expect(import.hitTestable(), findsOneWidget);
        expect(
            find
                .widgetWithText(
                    TextButton, locale == 'en' ? 'Cancel' : 'Отмена')
                .hitTestable(),
            findsOneWidget);
        await tester.tap(import);
        await tester.pumpAndSettle();
        expect(bridge.imports.single['schema'], 'web_rates_fx_v1');
        expect(bridge.imports.single['original_json'], original);
        expect(tester.takeException(), isNull);
      });
    });
  }

  for (final String action in <String>[
    'Cancel',
    'system back',
    'Import',
    'Import after editor removed'
  ]) {
    testWidgets('focused tax import survives $action and keyboard dismissal',
        (WidgetTester tester) async {
      tester.view.physicalSize = const Size(400, 900);
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.reset);
      await tester.runAsync(() async {
        final Directory directory =
            await Directory.systemTemp.createTemp('tax-import-dialog-');
        addTearDown(() => directory.delete(recursive: true));
        final _DialogBridge bridge = _DialogBridge();
        final TaxArtifactStore store =
            TaxArtifactStore(directoryProvider: () async => directory);
        final ValueNotifier<bool> showEditor = ValueNotifier<bool>(true);
        addTearDown(showEditor.dispose);
        await tester.pumpWidget(MaterialApp(
          home: ValueListenableBuilder<bool>(
            valueListenable: showEditor,
            builder: (BuildContext context, bool visible, Widget? child) =>
                visible
                    ? TaxEditorScreen(
                        scenario: const <String, dynamic>{
                          'metadata': <String, dynamic>{'id': 'case1'},
                          'facts': <dynamic>[],
                        },
                        repository: TaxAuthoringRepository(bridge),
                        locale: 'en',
                        store: store,
                      )
                    : const SizedBox(),
          ),
        ));
        await _settleIo(tester);
        final Finder cost =
            find.byKey(const ValueKey('tax-0-implementation_cost'));
        await tester.enterText(cost, '123.45');
        await tester.pump();
        final Finder open = find.text('Import analysis / legacy input');
        await tester.ensureVisible(open);
        await tester.tap(open);
        await tester.pumpAndSettle();
        final Finder dialog = find.byType(AlertDialog);
        await tester.tap(find.descendant(
            of: dialog,
            matching: find.byType(DropdownButtonFormField<String>)));
        await tester.pumpAndSettle();
        await tester.tap(find.text('Legacy amounts (v1)').last);
        await tester.pumpAndSettle();
        final Finder field =
            find.descendant(of: dialog, matching: find.byType(TextField));
        const String original = '  {"retained": "original text"}\n';
        await tester.enterText(field, original);
        tester.view.viewInsets = const FakeViewPadding(bottom: 250);
        await tester.pumpAndSettle();
        expect(tester.testTextInput.isVisible, isTrue);

        final bool editorRemoved = action == 'Import after editor removed';
        if (editorRemoved) {
          // The root navigator/dialog remain, but the awaiting editor is gone.
          showEditor.value = false;
          await tester.pump();
          expect(find.byType(TaxEditorScreen), findsNothing);
          expect(dialog, findsOneWidget);
        }
        if (action == 'system back') {
          await tester.binding.handlePopRoute();
        } else {
          await tester.tap(find.widgetWithText(
              TextButton, editorRemoved ? 'Import' : action));
        }
        // The route future completes before the reverse transition removes
        // its TextField. Keyboard metrics rebuild that still-mounted field.
        await tester.pump();
        tester.view.viewInsets = const FakeViewPadding();
        await tester.pump(const Duration(milliseconds: 50));
        expect(tester.takeException(), isNull);
        await tester.pumpAndSettle();
        expect(tester.takeException(), isNull);
        expect(find.byType(AlertDialog), findsNothing);
        expect(find.byType(TaxEditorScreen),
            editorRemoved ? findsNothing : findsOneWidget);
        if (action == 'Import') {
          expect(bridge.imports.single['original_json'], original);
          expect(bridge.imports.single['schema'], 'web_amounts_v1');
          expect(find.textContaining('Original retained.'), findsOneWidget);
        } else {
          expect(bridge.imports, isEmpty);
          expect(await store.read('case1'), isNull);
        }
        if (editorRemoved) return;
        if (action != 'Import') {
          expect(
              tester
                  .widget<EditableText>(find.descendant(
                      of: cost, matching: find.byType(EditableText)))
                  .controller
                  .text,
              '123.45');
        }

        // Reopening starts a fresh editor; cancelled text is not imported.
        await tester.ensureVisible(open);
        await tester.tap(open);
        await tester.pumpAndSettle();
        expect(tester.widget<TextField>(field).controller!.text, isEmpty);
        await tester.tap(find.widgetWithText(TextButton, 'Cancel'));
        await tester.pumpAndSettle();
        expect(tester.takeException(), isNull);
      });
    });
  }
}

Future<void> _settleIo(WidgetTester tester) async {
  for (int attempt = 0; attempt < 250; attempt++) {
    await Future<void>.delayed(const Duration(milliseconds: 20));
    await tester.pump();
    if (find.byType(CircularProgressIndicator).evaluate().isEmpty) {
      await tester.pumpAndSettle();
      return;
    }
  }
  throw StateError('Editor filesystem work did not finish.');
}

// Transport spy for dialog lifecycle and ownership of imported snapshots.
// Hashes are opaque fixture values, not a second native hash implementation.
final class _DialogBridge implements ScenarioBridgeClient {
  _DialogBridge({this.convertedImport = false});
  final bool convertedImport;
  final List<Map<String, dynamic>> imports = <Map<String, dynamic>>[];
  final List<Map<String, dynamic>> calculations = <Map<String, dynamic>>[];
  Map<String, dynamic>? importedLegacy;

  @override
  String execute(String encoded) {
    final Map<String, dynamic> command =
        jsonDecode(encoded) as Map<String, dynamic>;
    if (command['command'] == 'tax_capabilities') {
      return jsonEncode(<String, dynamic>{
        'type': 'tax_capabilities',
        'transport_protocol': 'tax-economics-json-v1',
        'input_schema': 'tax-economics-input-v2',
        'result_schema': 'tax-economics-result-v2',
        'application_policy': 'tax-editor-v1',
      });
    }
    if (command['command'] == 'tax_import') {
      imports.add(command);
      if (convertedImport) {
        final Map<String, dynamic> prepared =
            jsonDecode(execute('{"command":"tax_prepare"}'))
                as Map<String, dynamic>;
        final Map<String, dynamic> request =
            prepared['request'] as Map<String, dynamic>;
        (request['input'] as Map<String, dynamic>).addAll(<String, dynamic>{
          'tax_base_mode': 'manual_override',
          'annual_tax_base_override': '25000000',
          'override_reason': 'Imported manual base',
          'override_owner': 'Original person',
          'override_as_of': '2026-09-29',
        });
        importedLegacy = <String, dynamic>{
          'schema': command['schema'],
          'original_json': command['original_json'],
          'original_sha256': 'fixture-original-hash',
          'status': <String, dynamic>{
            'status': 'converted',
            'draft': <String, dynamic>{
              'request': request,
              'input_hash': 'fixture-input-hash',
              'fx_json': ' {"rate":1.2300e+0} ',
              'inactive_tax_base': null,
              'missing_override_provenance': <dynamic>[],
              'unavailable_legacy_fields': <dynamic>[],
            },
          },
        };
        return jsonEncode(<String, dynamic>{
          'type': 'tax_imported',
          'legacy': importedLegacy,
        });
      }
      return jsonEncode(<String, dynamic>{
        'type': 'tax_imported',
        'legacy': <String, dynamic>{
          'original_json': command['original_json'],
          'status': <String, dynamic>{'status': 'unavailable'},
        },
      });
    }
    if (convertedImport && command['command'] == 'tax_calculate') {
      calculations.add(command);
      return jsonEncode(<String, dynamic>{
        'type': 'tax_error',
        'detail': <String, dynamic>{'code': 'incomplete_input'},
      });
    }
    if (command['command'] != 'tax_prepare') {
      throw StateError('Unexpected dialog command: ${command['command']}');
    }
    return jsonEncode(<String, dynamic>{
      'type': 'tax_prepared',
      'request': <String, dynamic>{
        'input_schema': 'tax-economics-input-v2',
        'transport_protocol': 'tax-economics-json-v1',
        'application_policy': 'tax-editor-v1',
        'context': <String, dynamic>{
          'case_id': 'case1',
          'artifact_id': 'tax_case1',
          'revision': '0',
          'scenario_fingerprint': 'dialog-fixture',
        },
        'input': <String, dynamic>{
          'currency': 'EUR',
          'tax_input_basis': 'rates',
          'tax_base_mode': 'derived',
          'assumptions': '',
          for (final String field in <String>[
            'baseline_annual_tax_cost',
            'optimized_annual_tax_cost',
            'implementation_cost',
            'annual_maintenance_cost',
            'terminal_tax_or_unwind_cost',
          ])
            field: '0',
          'annual_tax_base_override': null,
          'baseline_tax_rate_bps': 2500,
          'optimized_tax_rate_bps': 2000,
          'analysis_horizon_months': 12,
          'annual_discount_rate_bps': 0,
          'benefit_realization_bps': 10000,
        },
      },
    });
  }
}
