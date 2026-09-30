import 'dart:convert';
import 'dart:ffi';
import 'dart:io';
import 'dart:ui' as ui;
import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:juris_mobile/app/app_theme.dart';
import 'package:juris_mobile/data/native_scenario_bridge_client.dart';
import 'package:juris_mobile/data/tax_artifact_store.dart';
import 'package:juris_mobile/data/tax_authoring_repository.dart';
import 'package:juris_mobile/screens/tax_editor_screen.dart';

import '../test/support/visual_golden_harness.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  const String libraryPath = String.fromEnvironment('JURIS_TAX_NATIVE_LIBRARY');
  if (libraryPath.isEmpty)
    throw StateError('Provide the actual built native library path.');
  setUpAll(loadJurisGoldenFonts);
  final TaxAuthoringRepository repository = TaxAuthoringRepository(
      NativeScenarioBridgeClient(library: DynamicLibrary.open(libraryPath)));
  final Map<String, dynamic> scenario = jsonDecode(
          File('test/fixtures/guided_studio_scenario.json').readAsStringSync())
      as Map<String, dynamic>;
  testWidgets('edit, Rust calculate, save, dispose and reopen from disk',
      (WidgetTester tester) async {
    tester.view.physicalSize = const ui.Size(390, 844);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
    await tester.runAsync(() async {
      final Directory directory =
          await Directory.systemTemp.createTemp('juris-tax-native-');
      addTearDown(() => directory.delete(recursive: true));
      TaxArtifactStore store() =>
          TaxArtifactStore(directoryProvider: () async => directory);
      Widget editor() => RepaintBoundary(
          key: const ValueKey('tax-capture'),
          child: MaterialApp(
              theme: JurisTheme.dark(),
              home: TaxEditorScreen(
                  scenario: scenario,
                  repository: repository,
                  locale: 'en',
                  store: store())));
      await tester.pumpWidget(editor());
      await settleIo(tester);
      expect(repository.isSupported(), true);
      await captureTax(tester, 'tax-editor-narrow.png');
      await tester.enterText(
          find.byKey(const ValueKey('tax-0-baseline_annual_tax_cost')),
          '250000.00');
      await tester.enterText(
          find.byKey(const ValueKey('tax-0-optimized_annual_tax_cost')),
          '200000.00');
      await tester.enterText(
          find.byKey(const ValueKey('tax-0-implementation_cost')), '1000.00');
      await tester.ensureVisible(find.byKey(const ValueKey('tax-calculate')));
      await tester.tap(find.byKey(const ValueKey('tax-calculate')));
      await settleIo(tester);
      expect(find.textContaining('Calculation complete'), findsOneWidget);
      await captureTax(tester, 'tax-result-narrow.png');
      await tester.ensureVisible(find.byKey(const ValueKey('tax-save')));
      await tester.tap(find.byKey(const ValueKey('tax-save')));
      await settleIo(tester);
      final String caseId =
          (scenario['metadata'] as Map<String, dynamic>)['id'] as String;
      final Map<String, dynamic> saved = (await store().read(caseId))!;
      expect(
          ((saved['calculation'] as Map<String, dynamic>)['result']
              as Map<String, dynamic>)['recognized_annual_tax_saving'],
          '5000000');
      expect(saved['artifact_revision'], '1');
      // An ordinary second Save must retain the validated result and revision.
      await tester.ensureVisible(find.byKey(const ValueKey('tax-save')));
      await tester.tap(find.byKey(const ValueKey('tax-save')));
      await settleIo(tester);
      expect(await store().read(caseId), saved);
      expect(find.text('Calculated result'), findsOneWidget);
      await tester.pumpWidget(const SizedBox.shrink());
      await settleIo(tester);
      await tester.pumpWidget(editor());
      await settleIo(tester);
      final Map<String, dynamic> reopened = (await store().read(caseId))!;
      expect(reopened, saved);
      expect(find.text('250000.00'), findsOneWidget);
      expect(find.text('Calculated result'), findsOneWidget);
      // Reopen performs a fresh native calculation without changing inputs.
      // Saving it must survive another disposal and disk reopening.
      await tester.ensureVisible(find.byKey(const ValueKey('tax-save')));
      await tester.tap(find.byKey(const ValueKey('tax-save')));
      await settleIo(tester);
      expect(await store().read(caseId), saved);
      await tester.pumpWidget(const SizedBox.shrink());
      await settleIo(tester);
      await tester.pumpWidget(editor());
      await settleIo(tester);
      expect(find.text('Calculated result'), findsOneWidget);
      // Actual edits still advance the revision, including incomplete drafts.
      await tester.enterText(
          find.byKey(const ValueKey('tax-0-baseline_annual_tax_cost')),
          'unfinished');
      await tester.ensureVisible(find.byKey(const ValueKey('tax-save')));
      await tester.tap(find.byKey(const ValueKey('tax-save')));
      await settleIo(tester);
      final Map<String, dynamic> incomplete = (await store().read(caseId))!;
      expect(incomplete['artifact_revision'], '2');
      expect(
          (incomplete['edit']
              as Map<String, dynamic>)['baseline_annual_tax_cost'],
          'unfinished');
      expect(incomplete['calculation'], isNull);
      expect(tester.takeException(), isNull);
    });
  });
  test('downside and incomplete native results are distinct', () {
    final Map<String, dynamic> p =
        repository.prepare(scenario, 'tax_native', '0', 'EUR');
    final Map<String, dynamic> request = p['request'] as Map<String, dynamic>;
    final Map<String, dynamic> input = request['input'] as Map<String, dynamic>;
    input['optimized_annual_tax_cost'] = '500000';
    input['implementation_cost'] = '10000';
    final Map<String, dynamic> result =
        repository.calculate(scenario, request, [], []);
    expect(result['type'], 'tax_calculated');
    expect(
        BigInt.parse(((result['calculation'] as Map<String, dynamic>)['result']
                as Map<String, dynamic>)['lifecycle_net_benefit'] as String)
            .isNegative,
        true);
    input['tax_input_basis'] = 'rates';
    final Map<String, dynamic> missing =
        repository.calculate(scenario, request, [], []);
    expect(missing['type'], 'tax_error');
    expect(missing['calculation'], isNull);
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

Future<void> captureTax(WidgetTester tester, String filename) async {
  const String directory =
      String.fromEnvironment('JURIS_TAX_SCREENSHOT_DIRECTORY');
  if (directory.isEmpty) return;
  final RenderRepaintBoundary boundary =
      tester.renderObject(find.byKey(const ValueKey('tax-capture')));
  final ui.Image image = await boundary.toImage(pixelRatio: 1);
  final data = await image.toByteData(format: ui.ImageByteFormat.png);
  await Directory(directory).create(recursive: true);
  await File('$directory/$filename').writeAsBytes(data!.buffer.asUint8List());
  image.dispose();
}
