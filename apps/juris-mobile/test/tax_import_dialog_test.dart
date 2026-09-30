import 'dart:convert';
import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:juris_mobile/data/scenario_bridge_client.dart';
import 'package:juris_mobile/data/tax_artifact_store.dart';
import 'package:juris_mobile/data/tax_authoring_repository.dart';
import 'package:juris_mobile/screens/tax_editor_screen.dart';

void main() {
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
        await tester.tap(find.text('web_amounts_v1').last);
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

// Dialog transport spy only: the regression concerns widget/controller
// ownership during route teardown, not native financial validation.
final class _DialogBridge implements ScenarioBridgeClient {
  final List<Map<String, dynamic>> imports = <Map<String, dynamic>>[];

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
      return jsonEncode(<String, dynamic>{
        'type': 'tax_imported',
        'legacy': <String, dynamic>{
          'original_json': command['original_json'],
          'status': <String, dynamic>{'status': 'unavailable'},
        },
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
