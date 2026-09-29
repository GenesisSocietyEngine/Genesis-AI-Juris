import 'dart:convert';
import 'dart:ffi';
import 'dart:io';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:juris_mobile/data/native_scenario_bridge_client.dart';
import 'package:juris_mobile/data/tax_artifact_store.dart';
import 'package:juris_mobile/data/tax_authoring_repository.dart';
import 'package:juris_mobile/screens/tax_editor_screen.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  const String library = String.fromEnvironment('JURIS_TAX_NATIVE_LIBRARY');
  const String directory =
      String.fromEnvironment('JURIS_TAX_RESTART_DIRECTORY');
  const String phase = String.fromEnvironment('JURIS_TAX_RESTART_PHASE');
  if (library.isEmpty ||
      directory.isEmpty ||
      !['write', 'read'].contains(phase))
    throw StateError(
        'Explicit native library, isolated directory and phase required.');
  testWidgets('native tax separate process $phase',
      (WidgetTester tester) async {
    await tester.runAsync(() async {
      final Map<String, dynamic> scenario = jsonDecode(
          File('test/fixtures/guided_studio_scenario.json')
              .readAsStringSync()) as Map<String, dynamic>;
      final String caseId =
          (scenario['metadata'] as Map<String, dynamic>)['id'] as String;
      final TaxArtifactStore store =
          TaxArtifactStore(directoryProvider: () async => Directory(directory));
      final TaxAuthoringRepository repository = TaxAuthoringRepository(
          NativeScenarioBridgeClient(library: DynamicLibrary.open(library)));
      if (phase == 'write') expect(await store.read(caseId), isNull);
      await tester.pumpWidget(MaterialApp(
          home: TaxEditorScreen(
              scenario: scenario,
              repository: repository,
              locale: 'en',
              store: store)));
      await settleIo(tester);
      if (phase == 'write') {
        await tester.enterText(
            find.byKey(const ValueKey('tax-0-baseline_annual_tax_cost')),
            '250000.00');
        await tester.enterText(
            find.byKey(const ValueKey('tax-0-optimized_annual_tax_cost')),
            '200000.00');
        await tester.ensureVisible(find.byKey(const ValueKey('tax-calculate')));
        await tester.tap(find.byKey(const ValueKey('tax-calculate')));
        await settleIo(tester);
        await tester.ensureVisible(find.byKey(const ValueKey('tax-save')));
        await tester.tap(find.byKey(const ValueKey('tax-save')));
        await settleIo(tester);
        final Map<String, dynamic> saved = (await store.read(caseId))!;
        expect(saved['artifact_revision'], '1');
        expect(
            ((saved['calculation'] as Map<String, dynamic>)['result']
                as Map<String, dynamic>)['recognized_annual_tax_saving'],
            '5000000');
      } else {
        expect(find.text('250000.00'), findsOneWidget);
        expect(find.text('Calculated result'), findsOneWidget);
        final Map<String, dynamic> saved = (await store.read(caseId))!;
        expect(saved['artifact_revision'], '1');
        expect(
            ((saved['calculation'] as Map<String, dynamic>)['result']
                as Map<String, dynamic>)['recognized_annual_tax_saving'],
            '5000000');
      }
      expect(tester.takeException(), isNull);
    });
  });
}

Future<void> settleIo(WidgetTester tester) async {
  for (int i = 0; i < 250; i++) {
    await Future<void>.delayed(const Duration(milliseconds: 20));
    await tester.pump();
    if (find.byType(CircularProgressIndicator).evaluate().isEmpty &&
        find.text('Saving…').evaluate().isEmpty) {
      await tester.pumpAndSettle();
      return;
    }
  }
  throw StateError('UI did not finish real filesystem work within 5 seconds.');
}
