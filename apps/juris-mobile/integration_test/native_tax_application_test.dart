// Production application acceptance using the real native bridge and stores.
// Text entry is programmatic; this is not OS keyboard or device accessibility proof.
import 'dart:convert';
import 'dart:io';

import 'package:crypto/crypto.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';
import 'package:juris_mobile/app/juris_app.dart';
import 'package:juris_mobile/data/native_scenario_bridge_client.dart';
import 'package:juris_mobile/data/scenario_bridge_client.dart';
import 'package:juris_mobile/data/studio_draft_store.dart';
import 'package:juris_mobile/data/tax_artifact_store.dart';
import 'package:juris_mobile/models/case_type_registry.dart';
import 'package:juris_mobile/models/studio_scenario_draft.dart';
import 'package:path_provider/path_provider.dart';

const List<String> _phases = <String>[
  'write',
  'read',
  'incomplete-write',
  'incomplete-read',
  'legacy-write',
  'legacy-read',
];
const String _schema = 'tax-mobile-application-acceptance-v2';
const String _testName =
    'production application tax journey across process restart';
const String _blankRateError =
    'Current rate (basis points): Enter a whole number.';
late _Checkpoints _checkpoints;
// Exact original also exercised with Android IME input. Preserve whitespace,
// exponent notation and inactive amount inputs through native conversion.
const String _legacyRates =
    '{"kind":"tax-economics-v1","currency":"EUR","baselineAnnualTaxCost":50000,"optimizedAnnualTaxCost":30000,"implementationCost":1000,"annualMaintenanceCost":200,"terminalTaxOrUnwindCost":500,"analysisHorizonMonths":18,"annualDiscountRateBps":0,"benefitRealizationBps":10000,"assumptions":"  Synthetic legacy assumptions preserved verbatim.  ","taxInputBasis":"rates","annualTaxBase":250000,"baselineTaxRateBps":2000,"optimizedTaxRateBps":1200,"fx":{"provider":"ECB", "sourceCurrency":"GBP", "targetCurrency":"EUR", "rate":1.2300e+0, "asOf":"2026-09-29"}}';

void main() {
  final IntegrationTestWidgetsFlutterBinding binding =
      IntegrationTestWidgetsFlutterBinding.ensureInitialized();
  // flutter drive launches this as an application entrypoint, not through the
  // flutter test loader that awaits main. Register before any asynchronous I/O.
  testWidgets(_testName, (WidgetTester tester) async {
    const String source = String.fromEnvironment('JURIS_ACCEPTANCE_SOURCE_SHA');
    const String runNonce =
        String.fromEnvironment('JURIS_ACCEPTANCE_RUN_NONCE');
    if (!RegExp(r'^[a-f0-9]{40}$').hasMatch(source) || runNonce.isEmpty) {
      throw StateError('An exact source and per-run nonce are required.');
    }
    _checkpoints = _Checkpoints(source, 'bootstrap');
    final Directory support = await _checkpoints.wait(
        'application-support', getApplicationSupportDirectory);
    final File proof = File('${support.path}/tax-application-acceptance.json');
    final Map<String, dynamic>? previous = await _checkpoints.wait(
      'previous-proof',
      () async => await proof.exists()
          ? await _readProof(proof, source, runNonce)
          : null,
    );
    final int index =
        previous == null ? 0 : (previous['phase_index'] as int) + 1;
    if (index >= _phases.length) {
      throw StateError(
          'This isolated journey has already completed all phases.');
    }
    // No phase is compiled into the app. The same binary advances only from its
    // source/nonce-bound proof; the independent driver checks the expected phase.
    final String phase = _phases[index];
    _checkpoints = _Checkpoints(source, phase);
    debugPrint('tax_application phase=$phase source=$source state=started');
    final _ObservedWorkspaceStore workspaceStore = _checkpoints.sync(
        'workspace-construction', _ObservedWorkspaceStore.new);
    final TaxArtifactStore taxStore =
        _checkpoints.sync('tax-store-construction', TaxArtifactStore.new);
    final _ObservedNativeBridge bridge = _checkpoints.sync(
        'native-bridge-construction', _ObservedNativeBridge.new);
    File pairFile(String writePhase) =>
        File('${support.path}/tax-application-acceptance-$writePhase.json');
    if (previous == null) {
      // Never erase another simulator user's saved work to make a test pass.
      expect(
        await _checkpoints.wait('fresh-workspace-read', workspaceStore.read),
        isNull,
        reason: 'Use a fresh isolated simulator for the write phase.',
      );
      expect(await proof.exists(), isFalse);
      for (final String writePhase in <String>[
        'write',
        'incomplete-write',
        'legacy-write',
      ]) {
        expect(await pairFile(writePhase).exists(), isFalse);
      }
      final Directory sidecars = Directory('${support.path}/tax_authoring_v1');
      if (await sidecars.exists()) {
        expect(
          await sidecars.list().isEmpty,
          isTrue,
          reason: 'Retain existing sidecars, including interrupted files.',
        );
      }
    } else {
      expect(previous['phase'], _phases[index - 1]);
      expect(
        previous['pid'],
        isNot(pid),
        reason: 'Each journey must execute in a new OS process.',
      );
      final StudioWorkspace before = (await _checkpoints.wait(
          'cold-workspace-read', workspaceStore.read))!;
      expect(before.draft.toJson(), previous['scenario']);
      expect(_progress(before), previous['workspace_progress']);
      expect(
        await _checkpoints.wait(
            'cold-tax-read', () => taxStore.read(before.draft.caseId)),
        previous['artifact'],
        reason: 'Verify persisted inputs before opening the production UI.',
      );
    }

    await _checkpoints.wait(
      'pump-production-widget',
      () => tester.pumpWidget(
        JurisApp.catalog(
          scenarioBridgeClient: bridge,
          studioDraftStore: workspaceStore,
        ),
      ),
    );
    await _checkpoints.wait(
        'first-frame-rasterized', () => binding.waitUntilFirstFrameRasterized);
    await _tap(tester, find.byKey(const ValueKey('product-navigation-menu')));
    await _tap(
      tester,
      find.byKey(const ValueKey('product-navigation-menu-studio')),
    );
    if (phase == 'write') {
      await _tap(tester, find.byKey(const ValueKey('studio-guided-example')));
      await _tap(tester, find.byType(DropdownButtonFormField<CaseTypeId>));
      await _tap(tester, find.text('Tax planning').last);
      for (int step = 0; step < 3; step++) {
        await _tap(tester, find.byKey(const ValueKey('studio-continue')));
      }
    }
    await _checkpoints.wait(
        'settle-workspace-writes', workspaceStore.settleWrites);
    await _tap(
      tester,
      find.byKey(const ValueKey('studio-case-view-economics')),
    );
    await _tap(tester, find.text('Edit tax analysis'));
    await _waitFor(
      tester,
      find.byKey(const ValueKey('tax-0-baseline_annual_tax_cost')),
    );
    expect(bridge.command('tax_capabilities'), hasLength(1));
    expect(bridge.command('tax_prepare'), hasLength(1));

    Map<String, dynamic>? importedLegacy;
    if (phase == 'write') {
      expect(bridge.calculations, isEmpty);
      await _enter(tester, 'baseline_annual_tax_cost', '250000.00');
      await _enter(tester, 'optimized_annual_tax_cost', '200000.00');
      await _tap(tester, find.byKey(const ValueKey('tax-calculate')));
    }
    if (<String>['write', 'read', 'incomplete-write'].contains(phase)) {
      await _waitFor(tester, find.text('Calculated result'));
      _expectField(tester, 'baseline_annual_tax_cost', '250000.00');
      _expectField(tester, 'optimized_annual_tax_cost', '200000.00');
      expect(bridge.calculations, hasLength(1));
      final Map<String, dynamic> result = _result(bridge.calculations.single);
      expect(result['recognized_annual_tax_saving'], '5000000');
      expect(result['lifecycle_net_benefit'], '50000000');
      if (phase != 'write') {
        final Map<String, dynamic> baseline = await _readProof(
          pairFile('write'),
          source,
          runNonce,
        );
        expect(
          bridge.calculations,
          _calculations(baseline),
          reason: 'Cold reopen must repeat the complete native exchange.',
        );
      }
    }

    if (phase == 'incomplete-write') {
      await _tap(tester, find.byKey(const ValueKey('tax-0-Tax input-amounts')));
      await _tap(tester, find.text('Calculate from base and rates').last);
      await _enter(tester, 'baseline_tax_rate_bps', '2500');
      await _enter(tester, 'optimized_tax_rate_bps', '2000');
      await _tap(tester, find.byKey(const ValueKey('tax-calculate')));
      expect(bridge.calculations, hasLength(2));
      final Map<String, dynamic> error =
          bridge.calculations.last['response'] as Map<String, dynamic>;
      expect(error['type'], 'tax_error');
      expect(jsonEncode(error['detail']), contains('missing_tax_base'));
      expect(find.text('Calculated result'), findsNothing);
      await _waitFor(
        tester,
        find.text(
          'Complete and confirm the tax-base components, or enter '
          'a documented manual base.',
        ),
      );
      await _enter(tester, 'baseline_tax_rate_bps', '');
    }
    if (phase == 'incomplete-write' || phase == 'incomplete-read') {
      final int count = bridge.calculations.length;
      expect(
        count,
        phase == 'incomplete-write' ? 2 : 0,
        reason: 'An incomplete saved draft must not calculate on reopen.',
      );
      _expectField(tester, 'baseline_tax_rate_bps', '');
      _expectField(tester, 'optimized_tax_rate_bps', '2000');
      expect(find.text('Calculated result'), findsNothing);
      await _tap(tester, find.byKey(const ValueKey('tax-calculate')));
      await _waitFor(tester, find.text(_blankRateError));
      expect(find.textContaining('FormatException'), findsNothing);
      expect(
        bridge.calculations,
        hasLength(count),
        reason: 'Blank numeric text must remain a local validation error.',
      );
      _expectField(tester, 'baseline_tax_rate_bps', '');
    }

    if (phase == 'legacy-write') {
      expect(bridge.calculations, isEmpty);
      await _tap(tester, find.text('Import analysis / legacy input'));
      final Finder dialog = find.byType(AlertDialog);
      await _tap(
        tester,
        find.descendant(
          of: dialog,
          matching: find.byType(DropdownButtonFormField<String>),
        ),
      );
      await _tap(tester, find.text('Legacy rates / FX (v1)').last);
      final Finder original = find.descendant(
        of: dialog,
        matching: find.byType(TextField),
      );
      await tester.enterText(original, _legacyRates);
      expect(tester.widget<TextField>(original).controller!.text, _legacyRates);
      await _tap(tester, find.widgetWithText(TextButton, 'Import'));
      expect(bridge.command('tax_import'), hasLength(1));
      final Map<String, dynamic> imported = bridge.command('tax_import').single;
      expect(imported['request']['schema'], 'web_rates_fx_v1');
      expect(imported['request']['original_json'], _legacyRates);
      expect(imported['response']['type'], 'tax_imported');
      // Snapshot the whole real native result before any active-request edits.
      importedLegacy = jsonDecode(jsonEncode(imported['response']['legacy']))
          as Map<String, dynamic>;
      expect(importedLegacy['status']['status'], 'converted');
      expect(importedLegacy['original_json'], _legacyRates);
      expect(
        importedLegacy['original_sha256'],
        sha256.convert(utf8.encode(_legacyRates)).toString(),
      );
      expect(_legacyRates.length, 552);
      expect(
        importedLegacy['status']['draft']['request']['input']['override_owner'],
        isNull,
      );
      expect(
        importedLegacy['status']['draft']['request']['input']['override_as_of'],
        isNull,
      );
      await _enter(
        tester,
        'override_owner',
        'SyntheticReviewer',
        generation: 1,
      );
      await _enter(tester, 'override_as_of', '2026-09-30', generation: 1);
      await _tap(
        tester,
        find.text('I reviewed and confirm both entered tax rates'),
      );
      await _tap(tester, find.byKey(const ValueKey('tax-calculate')));
    }
    if (phase == 'legacy-write' || phase == 'legacy-read') {
      await _waitFor(tester, find.text('Calculated result'));
      expect(bridge.calculations, hasLength(1));
      final Map<String, dynamic> result = _result(bridge.calculations.single);
      expect(result['annualized_net_benefit'], '1913334');
      expect(result['lifecycle_net_benefit'], '2820000');
      final int generation = phase == 'legacy-write' ? 1 : 0;
      _expectField(
        tester,
        'override_owner',
        'SyntheticReviewer',
        generation: generation,
      );
      _expectField(
        tester,
        'override_as_of',
        '2026-09-30',
        generation: generation,
      );
      if (phase == 'legacy-read') {
        final Map<String, dynamic> imported = await _readProof(
          pairFile('legacy-write'),
          source,
          runNonce,
        );
        expect(
          bridge.calculations,
          _calculations(imported),
          reason: 'Legacy reopen must freshly repeat the native exchange.',
        );
        importedLegacy = imported['artifact']['legacy'] as Map<String, dynamic>;
      }
    }
    expect(
      bridge.command('tax_import'),
      hasLength(phase == 'legacy-write' ? 1 : 0),
    );

    await _save(tester);
    await workspaceStore.settleWrites();
    final StudioWorkspace workspace = (await workspaceStore.read())!;
    expect(workspace.activeStage, StudioWorkflowStage.caseMap);
    final Map<String, dynamic> progress = _progress(workspace);
    final Map<String, dynamic> artifact = (await taxStore.read(
      workspace.draft.caseId,
    ))!;
    expect(artifact['artifact_revision'], '${index ~/ 2 + 1}');
    if (previous != null) {
      expect(workspace.draft.toJson(), previous['scenario']);
      expect(progress, previous['workspace_progress']);
    }
    if (phase.startsWith('incomplete-')) {
      expect(artifact['calculation'], isNull);
      expect(artifact['edit']['baseline_tax_rate_bps'], '');
      expect(artifact['edit']['optimized_tax_rate_bps'], '2000');
      expect(artifact['request']['input']['tax_input_basis'], 'rates');
    }
    if (importedLegacy != null) {
      expect(
        artifact['legacy'],
        importedLegacy,
        reason: 'The whole native converted record must remain immutable.',
      );
      expect(
        artifact['request']['input']['override_owner'],
        'SyntheticReviewer',
      );
      expect(artifact['request']['input']['override_as_of'], '2026-09-30');
      expect(artifact['rates_confirmed'], isTrue);
    }
    if (index.isOdd) {
      final Map<String, dynamic> pair = await _readProof(
        pairFile(_phases[index - 1]),
        source,
        runNonce,
      );
      expect(pair['phase_index'], index - 1);
      expect(pair['pid'], previous!['pid']);
      expect(workspace.draft.toJson(), pair['scenario']);
      expect(progress, pair['workspace_progress']);
      expect(
        artifact,
        pair['artifact'],
        reason: 'Cold reopen must preserve the complete saved artifact.',
      );
    }
    // Await both real asynchronous writes; unchanged saves preserve revisions.
    await _save(tester);
    expect(await taxStore.read(workspace.draft.caseId), artifact);
    expect(tester.takeException(), isNull);
    if (Platform.isAndroid) {
      await binding.convertFlutterSurfaceToImage();
      await tester.pump();
    }
    await binding.takeScreenshot('$phase-editor');
    final Map<String, dynamic> completed = <String, dynamic>{
      'schema': _schema,
      'selected_test': _testName,
      'phase': phase,
      'completed_phase': phase,
      'phase_index': index,
      'pid': pid,
      'previous_pid': previous?['pid'],
      'platform': Platform.operatingSystem,
      'entry_method': 'programmatic_flutter_test',
      'artifact': artifact,
      'scenario': workspace.draft.toJson(),
      'workspace_progress': progress,
      'native_calls': bridge.calls,
      'source_sha': source,
      'run_nonce': runNonce,
    };
    // Advance only after every assertion and screenshot succeeds. Pair receipts
    // survive global advancement so later cold reads compare the original write.
    if (index.isEven) {
      expect(await pairFile(phase).exists(), isFalse);
      await pairFile(phase).writeAsString(jsonEncode(completed), flush: true);
    }
    await proof.writeAsString(jsonEncode(completed), flush: true);
    binding.reportData = <String, dynamic>{
      ...?binding.reportData,
      ...completed,
    };
  }, timeout: const Timeout(Duration(minutes: 3)));
}

final class _Checkpoints {
  _Checkpoints(this.source, this.phase);
  final String source;
  final String phase;
  int _sequence = 0;
  void _mark(String name, int sequence, String state) {
    debugPrint('tax_application checkpoint=$name sequence=$sequence '
        'state=$state phase=$phase source=$source');
  }

  T sync<T>(String name, T Function() operation) {
    final int sequence = ++_sequence;
    _mark(name, sequence, 'start');
    final T value = operation();
    _mark(name, sequence, 'end');
    return value;
  }

  Future<T> wait<T>(String name, Future<T> Function() operation) async {
    final int sequence = ++_sequence;
    _mark(name, sequence, 'start');
    try {
      final T value =
          await Future<T>.sync(operation).timeout(const Duration(seconds: 45));
      _mark(name, sequence, 'end');
      return value;
    } on Object {
      _mark(name, sequence, 'failed');
      rethrow;
    }
  }
}

Future<Map<String, dynamic>> _readProof(
  File file,
  String source,
  String nonce,
) async {
  final Map<String, dynamic> value =
      jsonDecode(await file.readAsString()) as Map<String, dynamic>;
  final dynamic index = value['phase_index'];
  if (value['schema'] != _schema ||
      value['selected_test'] != _testName ||
      value['source_sha'] != source ||
      value['run_nonce'] != nonce ||
      index is! int ||
      index < 0 ||
      index >= _phases.length ||
      value['phase'] != _phases[index] ||
      value['completed_phase'] != _phases[index] ||
      value['pid'] is! int ||
      (value['pid'] as int) <= 0 ||
      value['artifact'] is! Map<String, dynamic> ||
      value['scenario'] is! Map<String, dynamic> ||
      value['workspace_progress'] is! Map<String, dynamic> ||
      value['native_calls'] is! List<dynamic>) {
    throw StateError(
      'Previous phase proof is incomplete or belongs to another run.',
    );
  }
  return value;
}

Map<String, dynamic> _progress(StudioWorkspace workspace) => <String, dynamic>{
      'active_stage': workspace.activeStage.wireName,
      'completed_stages': workspace.completedStages
          .map((StudioWorkflowStage stage) => stage.wireName)
          .toList()
        ..sort(),
    };

List<dynamic> _calculations(Map<String, dynamic> proof) =>
    (proof['native_calls'] as List<dynamic>)
        .where((dynamic call) => call['request']['command'] == 'tax_calculate')
        .toList(growable: false);

Map<String, dynamic> _result(Map<String, dynamic> call) {
  expect(call['response']['type'], 'tax_calculated');
  return call['response']['calculation']['result'] as Map<String, dynamic>;
}

Future<void> _enter(
  WidgetTester tester,
  String id,
  String value, {
  int generation = 0,
}) async {
  final Finder field = find.byKey(ValueKey('tax-$generation-$id'));
  await _waitFor(tester, field);
  await tester.ensureVisible(field);
  await tester.enterText(field, value);
  await _checkpoints.wait('entry-settle', () => tester.pumpAndSettle());
  _expectField(tester, id, value, generation: generation);
}

void _expectField(
  WidgetTester tester,
  String id,
  String value, {
  int generation = 0,
}) {
  final Finder field = find.descendant(
    of: find.byKey(ValueKey('tax-$generation-$id')),
    matching: find.byType(EditableText),
  );
  expect(tester.widget<EditableText>(field).controller.text, value);
}

Future<void> _waitFor(WidgetTester tester, Finder finder) async {
  final DateTime deadline = DateTime.now().add(const Duration(seconds: 45));
  while (finder.evaluate().isEmpty && DateTime.now().isBefore(deadline)) {
    await _checkpoints.wait(
        'find-frame', () => tester.pump(const Duration(milliseconds: 100)));
  }
  expect(finder, findsWidgets);
  await _checkpoints.wait('find-settle', () => tester.pumpAndSettle());
}

Future<void> _tap(WidgetTester tester, Finder finder) async {
  await _waitFor(tester, finder);
  await tester.ensureVisible(finder);
  await tester.tap(finder);
  await _checkpoints.wait('tap-settle', () => tester.pumpAndSettle());
  expect(tester.takeException(), isNull);
}

Future<void> _save(WidgetTester tester) async {
  final Finder save = find.byKey(const ValueKey('tax-save'));
  await _waitFor(tester, save);
  await tester.ensureVisible(save);
  expect(save.hitTestable(), findsOneWidget);
  expect(tester.widget<FilledButton>(save).onPressed, isNotNull);
  await tester.tap(save);
  await _checkpoints.wait('save-frame', tester.pump);
  final DateTime deadline = DateTime.now().add(const Duration(seconds: 45));
  bool completed() =>
      tester.widget<FilledButton>(save).onPressed != null &&
      find
          .text('Saved on this device. Reopen Economics to continue.')
          .evaluate()
          .isNotEmpty;
  while (!completed() && DateTime.now().isBefore(deadline)) {
    await _checkpoints.wait('save-wait-frame',
        () => tester.pump(const Duration(milliseconds: 100)));
  }
  expect(
    completed(),
    isTrue,
    reason: 'The real asynchronous artifact write must complete.',
  );
  expect(tester.takeException(), isNull);
}

final class _ObservedWorkspaceStore implements StudioDraftStore {
  final ApplicationSupportStudioDraftStore _store =
      ApplicationSupportStudioDraftStore();
  final List<Future<void>> _writes = <Future<void>>[];
  Future<void> settleWrites() async {
    for (int index = 0; index < _writes.length; index++) {
      await _writes[index];
    }
  }

  @override
  Future<StudioWorkspace?> read() => _store.read();
  @override
  Future<void> write(StudioWorkspace workspace) {
    final Future<void> operation = _store.write(workspace);
    _writes.add(operation);
    return operation;
  }

  @override
  Future<String> exportScenario(StudioScenarioDraft draft) =>
      _store.exportScenario(draft);
}

final class _ObservedNativeBridge implements ScenarioBridgeClient {
  final NativeScenarioBridgeClient _native = NativeScenarioBridgeClient();
  final List<Map<String, dynamic>> calls = <Map<String, dynamic>>[];
  List<Map<String, dynamic>> command(String name) => calls
      .where((Map<String, dynamic> call) => call['request']['command'] == name)
      .toList(growable: false);
  List<Map<String, dynamic>> get calculations => command('tax_calculate');
  @override
  String execute(String encodedRequest) {
    final String response = _native.execute(encodedRequest);
    calls.add(<String, dynamic>{
      'request': jsonDecode(encodedRequest),
      'response': jsonDecode(response),
    });
    return response;
  }
}
