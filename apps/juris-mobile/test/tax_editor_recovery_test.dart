import 'dart:convert';
import 'dart:io';

import 'package:crypto/crypto.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:juris_mobile/data/scenario_bridge_client.dart';
import 'package:juris_mobile/data/tax_artifact_store.dart';
import 'package:juris_mobile/data/tax_authoring_repository.dart';
import 'package:juris_mobile/screens/tax_editor_screen.dart';

import 'support/tax_artifact_fixture.dart';

void main() {
  setUp(() {
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
        .setMockMethodCallHandler(SystemChannels.platform, (_) async => null);
  });
  tearDown(() {
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
        .setMockMethodCallHandler(SystemChannels.platform, null);
  });
  testWidgets('conflicting Save retains edits/export until explicit reopen',
      (tester) async {
    await tester.runAsync(() async {
      final Directory root = await _root();
      final TaxArtifactStore store =
          TaxArtifactStore(directoryProvider: () async => root);
      await store.write('case1', taxArtifactFixture('100.00'));
      await _mount(tester, store);
      final TaxArtifactStore competitor =
          TaxArtifactStore(directoryProvider: () async => root);
      final TaxArtifactSnapshot competing =
          await competitor.readSnapshot('case1');
      await _edit(tester, '300.00');
      await competitor.writeIfUnchanged(
          competing, taxArtifactFixture('200.00'));
      await _tap(tester, find.byKey(const ValueKey('tax-save')));
      expect(find.textContaining('Another saved generation changed.'),
          findsOneWidget);
      expect(
          find
              .textContaining('Another saved generation changed.')
              .hitTestable(),
          findsOneWidget);
      expect(find.byKey(const ValueKey('tax-reopen')).hitTestable(),
          findsOneWidget);
      expect(_text(tester), '300.00');
      expect((await store.read('case1'))!['edit']['baseline_annual_tax_cost'],
          '200.00');
      expect(
          tester
              .widget<FilledButton>(find.byKey(const ValueKey('tax-save')))
              .onPressed,
          isNull);
      expect(find.textContaining('Saved on this device.'), findsNothing);

      String? clipboard;
      tester.binding.defaultBinaryMessenger
          .setMockMethodCallHandler(SystemChannels.platform, (call) async {
        if (call.method == 'Clipboard.setData')
          clipboard = (call.arguments as Map)['text'] as String;
        return null;
      });
      addTearDown(() => tester.binding.defaultBinaryMessenger
          .setMockMethodCallHandler(SystemChannels.platform, null));
      await _tap(tester, find.byKey(const ValueKey('tax-export')));
      await _waitFor(
          tester,
          () => find
              .textContaining('Exported and copied:')
              .evaluate()
              .isNotEmpty);
      final File exported =
          (await root.list().toList()).whereType<File>().single;
      expect(
          jsonDecode(await exported.readAsString())['edit']
              ['baseline_annual_tax_cost'],
          '300.00');
      expect(
          jsonDecode(clipboard!)['edit']['baseline_annual_tax_cost'], '300.00');

      await _tap(tester, find.byKey(const ValueKey('tax-reopen')));
      expect(find.text('Reopen and discard your edits?'), findsOneWidget);
      await _tap(tester, find.widgetWithText(TextButton, 'Keep editing'));
      expect(_text(tester), '300.00');
      expect(find.textContaining('Another saved generation changed.'),
          findsOneWidget);
      await _tap(tester, find.byKey(const ValueKey('tax-reopen')));
      await _tap(tester, find.widgetWithText(TextButton, 'Reopen and discard'));
      expect(_text(tester, generation: 1), '200.00');
      expect(find.textContaining('Another saved generation changed.'),
          findsNothing);
      await _edit(tester, '400.00', generation: 1);
      await _tap(tester, find.byKey(const ValueKey('tax-save')));
      expect((await store.read('case1'))!['edit']['baseline_annual_tax_cost'],
          '400.00');
      expect(find.textContaining('Saved on this device.'), findsOneWidget);
      expect(tester.takeException(), isNull);
    });
  });

  testWidgets(
      'successive saves advance their own token without inventing revisions',
      (tester) async {
    await tester.runAsync(() async {
      final Directory root = await _root();
      final TaxArtifactStore store =
          TaxArtifactStore(directoryProvider: () async => root);
      await store.write('case1', taxArtifactFixture('100.00'));
      await _mount(tester, store);
      await _edit(tester, 'unfinished.');
      await _tap(tester, find.byKey(const ValueKey('tax-save')));
      expect((await store.read('case1'))!['artifact_revision'], '2');
      await _tap(tester, find.byKey(const ValueKey('tax-save')));
      expect((await store.read('case1'))!['artifact_revision'], '2');
      expect(_text(tester), 'unfinished.');
      await _edit(tester, '300.00');
      await _tap(tester, find.byKey(const ValueKey('tax-save')));
      expect((await store.read('case1'))!['artifact_revision'], '3');
      expect(find.textContaining('Another saved generation changed.'),
          findsNothing);
      expect(tester.takeException(), isNull);
    });
  });

  testWidgets(
      'read failure stays read-only through Retry, then opens restored data',
      (tester) async {
    await tester.runAsync(() async {
      final Directory root = await _root();
      bool unavailable = true;
      final TaxArtifactStore store =
          TaxArtifactStore(directoryProvider: () async {
        if (unavailable) throw const FileSystemException('test unavailable');
        return root;
      });
      final _StorageBridge bridge = await _mount(tester, store);
      _expectReadOnly();
      expect(bridge.commands, isEmpty);
      await _tap(tester, find.byKey(const ValueKey('tax-reopen')));
      _expectReadOnly();
      expect(bridge.commands, isEmpty);
      await TaxArtifactStore(directoryProvider: () async => root)
          .write('case1', taxArtifactFixture('restored.'));
      unavailable = false;
      await _tap(tester, find.byKey(const ValueKey('tax-reopen')));
      expect(_text(tester, generation: 2), 'restored.');
      expect(find.textContaining('Saved analysis is read-only.'), findsNothing);
      expect(tester.takeException(), isNull);
    });
  });

  for (final String suffix in ['', '.tmp']) {
    testWidgets('opaque $suffix load hides mutations and retains export/retry',
        (tester) async {
      await tester.runAsync(() async {
        final Directory root = await _root();
        final TaxArtifactStore store =
            TaxArtifactStore(directoryProvider: () async => root);
        await store.write('case1', taxArtifactFixture('current'));
        final File target = _target(root);
        final String future = jsonEncode(taxArtifactFixture('future')
          ..['schema'] = 'tax-authoring-artifact-v99');
        await File('${target.path}$suffix').writeAsString(future);
        final String primary = await target.readAsString();
        final _StorageBridge bridge = await _mount(tester, store);
        _expectReadOnly();
        expect(find.byKey(const ValueKey('tax-export')), findsOneWidget);
        expect(bridge.commands, isEmpty);
        await _tap(tester, find.byKey(const ValueKey('tax-reopen')));
        _expectReadOnly();
        expect(await target.readAsString(), primary);
        expect(await File('${target.path}$suffix').readAsString(), future);
        expect(tester.takeException(), isNull);
      });
    });
  }

  testWidgets(
      'future auxiliary appearing during edits blocks save without losing them',
      (tester) async {
    await tester.runAsync(() async {
      final Directory root = await _root();
      final TaxArtifactStore store =
          TaxArtifactStore(directoryProvider: () async => root);
      await store.write('case1', taxArtifactFixture('current'));
      await _mount(tester, store);
      await _edit(tester, 'unsaved.');
      final File temporary = File('${_target(root).path}.tmp');
      final String future = jsonEncode(taxArtifactFixture('future')
        ..['schema'] = 'tax-authoring-artifact-v99');
      await temporary.writeAsString(future);
      await _tap(tester, find.byKey(const ValueKey('tax-save')));
      _expectReadOnly();
      expect(await temporary.readAsString(), future);
      expect((await store.read('case1'))!['edit']['baseline_annual_tax_cost'],
          'current');
      expect(find.textContaining('Saved on this device.'), findsNothing);
      await _tap(tester, find.byKey(const ValueKey('tax-export')));
      await _waitFor(
          tester,
          () => find
              .textContaining('Exported and copied:')
              .evaluate()
              .isNotEmpty);
      final File exported =
          (await root.list().toList()).whereType<File>().single;
      expect(
          jsonDecode(await exported.readAsString())['edit']
              ['baseline_annual_tax_cost'],
          'unsaved.');
      await _tap(tester, find.byKey(const ValueKey('tax-reopen')));
      expect(find.text('Reopen and discard your edits?'), findsOneWidget);
      await _tap(tester, find.widgetWithText(TextButton, 'Keep editing'));
      expect(tester.takeException(), isNull);
    });
  });
}

Future<Directory> _root() async {
  final Directory root =
      await Directory.systemTemp.createTemp('tax-editor-recovery-');
  addTearDown(() => root.delete(recursive: true));
  return root;
}

File _target(Directory root) => File(
    '${root.path}/tax_authoring_v1/${sha256.convert(utf8.encode('case1'))}.json');
Future<_StorageBridge> _mount(
    WidgetTester tester, TaxArtifactStore store) async {
  final _StorageBridge bridge = _StorageBridge();
  await tester.pumpWidget(MaterialApp(
      home: TaxEditorScreen(
          scenario: taxArtifactFixture()['scenario'] as Map<String, dynamic>,
          repository: TaxAuthoringRepository(bridge),
          locale: 'en',
          store: store)));
  await _settle(tester);
  return bridge;
}

void _expectReadOnly() {
  expect(find.textContaining('Saved analysis is read-only.'), findsOneWidget);
  expect(find.byType(TextFormField), findsNothing);
  expect(find.byKey(const ValueKey('tax-save')), findsNothing);
  expect(find.byKey(const ValueKey('tax-calculate')), findsNothing);
  expect(find.text('Import analysis / legacy input'), findsNothing);
}

String _text(WidgetTester tester, {int generation = 0}) => tester
    .widget<EditableText>(find.descendant(
        of: find.byKey(ValueKey('tax-$generation-baseline_annual_tax_cost')),
        matching: find.byType(EditableText)))
    .controller
    .text;
Future<void> _edit(WidgetTester tester, String value,
    {int generation = 0}) async {
  final Finder field =
      find.byKey(ValueKey('tax-$generation-baseline_annual_tax_cost'));
  await tester.ensureVisible(field);
  await tester.enterText(field, value);
  await tester.pump();
}

Future<void> _tap(WidgetTester tester, Finder finder) async {
  await tester.ensureVisible(finder);
  await tester.tap(finder);
  await _settle(tester);
}

Future<void> _settle(WidgetTester tester) => _waitFor(
    tester,
    () =>
        find.byType(CircularProgressIndicator).evaluate().isEmpty &&
        find.text('Saving…').evaluate().isEmpty);
Future<void> _waitFor(WidgetTester tester, bool Function() ready) async {
  for (int i = 0; i < 250; i++) {
    await Future<void>.delayed(const Duration(milliseconds: 20));
    await tester.pump();
    if (ready()) {
      await tester.pumpAndSettle();
      return;
    }
  }
  throw StateError('Filesystem/widget operation did not settle.');
}

// Storage lifecycle spy only. Native financial acceptance is separate.
final class _StorageBridge implements ScenarioBridgeClient {
  final List<String> commands = [];
  @override
  String execute(String encoded) {
    final Map<String, dynamic> command =
        jsonDecode(encoded) as Map<String, dynamic>;
    commands.add(command['command'] as String);
    if (command['command'] == 'tax_capabilities')
      return jsonEncode({
        'type': 'tax_capabilities',
        'transport_protocol': 'tax-economics-json-v1',
        'input_schema': 'tax-economics-input-v2',
        'result_schema': 'tax-economics-result-v2',
        'application_policy': 'tax-editor-v1',
      });
    if (command['command'] == 'tax_prepare')
      return jsonEncode({
        'type': 'tax_prepared',
        'request': taxArtifactFixture()['request'],
      });
    throw StateError(
        'Unexpected command in storage test: ${command['command']}');
  }
}
