import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:flutter_test/flutter_test.dart';

import '../test_driver/tax_driver_guard.dart';

void main() {
  test('success returns only after driver close and skips failure diagnostics',
      () async {
    final List<String> events = <String>[];
    final int value = await runTaxDriverPhase<int>(
      operation: () async => 7,
      timeout: const Duration(seconds: 1),
      onFailure: (_, __) async => events.add('failure'),
      close: () async => events.add('close'),
    );
    expect(value, 7);
    expect(events, <String>['close']);
  });

  test('request and diagnostic/close hangs each have real bounded deadlines',
      () async {
    final Stopwatch clock = Stopwatch()..start();
    final List<String> events = <String>[];
    final List<String> cleanupErrors = <String>[];
    await expectLater(
      runTaxDriverPhase<void>(
        operation: () => Completer<void>().future,
        timeout: const Duration(milliseconds: 30),
        onFailure: (Object error, _) {
          expect(error, isA<TimeoutException>());
          events.add('diagnostic');
          return Completer<void>().future;
        },
        diagnosticsTimeout: const Duration(milliseconds: 30),
        close: () {
          events.add('close');
          return Completer<void>().future;
        },
        closeTimeout: const Duration(milliseconds: 30),
        reportCleanupError: cleanupErrors.add,
      ),
      throwsA(isA<TimeoutException>()),
    );
    expect(events, <String>['diagnostic', 'close']);
    expect(cleanupErrors, hasLength(2));
    expect(clock.elapsed, lessThan(const Duration(seconds: 2)));
  });

  test('diagnostic and close exceptions cannot replace primary failure',
      () async {
    final StateError primary = StateError('request failed');
    await expectLater(
      runTaxDriverPhase<void>(
        operation: () async => throw primary,
        timeout: const Duration(seconds: 1),
        onFailure: (_, __) async => throw StateError('diagnostic failed'),
        close: () async => throw StateError('close failed'),
      ),
      throwsA(same(primary)),
    );
  });

  test('a close failure cannot produce successful phase completion', () async {
    await expectLater(
      runTaxDriverPhase<void>(
        operation: () async {},
        timeout: const Duration(seconds: 1),
        onFailure: (_, __) async {},
        close: () async => throw StateError('close failed'),
      ),
      throwsStateError,
    );
  });

  test('late response cannot invoke success retention after timeout', () async {
    final Completer<String> response = Completer<String>();
    int proofs = 0;
    final Future<void> guarded = runTaxDriverPhase<String>(
      operation: () => response.future,
      timeout: const Duration(milliseconds: 20),
      onFailure: (_, __) async {},
      close: () async {},
    ).then((_) => proofs++);
    await expectLater(guarded, throwsA(isA<TimeoutException>()));
    response.complete('late apparent success');
    await Future<void>.delayed(const Duration(milliseconds: 30));
    expect(proofs, 0);
  });

  test('VM diagnostics issue only read-only RPCs and exclude frame locals',
      () async {
    final HttpServer server =
        await HttpServer.bind(InternetAddress.loopbackIPv4, 0);
    final List<String> methods = <String>[];
    server.listen((HttpRequest request) async {
      expect(request.uri.path, '/token/ws');
      final WebSocket socket = await WebSocketTransformer.upgrade(request);
      socket.listen((dynamic raw) {
        final Map<String, dynamic> message = jsonDecode(raw as String);
        final String method = message['method'] as String;
        methods.add(method);
        final Map<String, dynamic> result = switch (method) {
          'getVM' => <String, dynamic>{
              'pid': 7,
              'isolates': <dynamic>[
                {'id': 'i', 'name': 'main'}
              ]
            },
          'getIsolate' => <String, dynamic>{
              'runnable': true,
              'pauseEvent': {'kind': 'Resume'}
            },
          'getStack' => <String, dynamic>{
              'frames': <dynamic>[
                {
                  'index': 0,
                  'function': {'name': 'pending'},
                  'vars': 'private input'
                }
              ],
              'asyncCausalFrames': <dynamic>[
                {'index': 1, 'kind': 'AsyncSuspensionMarker'}
              ]
            },
          _ => throw StateError('Unexpected mutation method $method'),
        };
        socket.add(jsonEncode(
            {'jsonrpc': '2.0', 'id': message['id'], 'result': result}));
      });
    });
    try {
      final Map<String, dynamic> result =
          await captureTaxDriverVm('http://127.0.0.1:${server.port}/token/');
      expect(methods, <String>['getVM', 'getIsolate', 'getStack']);
      expect(result['acceptance'], false);
      expect(result['read_only'], true);
      expect(jsonEncode(result), isNot(contains('private input')));
      expect(jsonEncode(result), contains('AsyncSuspensionMarker'));
    } finally {
      await server.close(force: true);
    }
  });

  test('VM RPC nonresponse produces a bounded diagnostic error', () async {
    final HttpServer server =
        await HttpServer.bind(InternetAddress.loopbackIPv4, 0);
    server.listen((HttpRequest request) async {
      final WebSocket socket = await WebSocketTransformer.upgrade(request);
      socket.listen((_) {});
    });
    final Stopwatch clock = Stopwatch()..start();
    try {
      final Map<String, dynamic> result = await captureTaxDriverVm(
        'http://127.0.0.1:${server.port}/token/',
        rpcTimeout: const Duration(milliseconds: 30),
      );
      expect(result['error'], contains('TimeoutException'));
      expect(clock.elapsed, lessThan(const Duration(seconds: 2)));
    } finally {
      await server.close(force: true);
    }
  });

  test('real driver subprocess exits despite live hung operation and no proof',
      () async {
    final Map<String, dynamic> packages =
        jsonDecode(await File('.dart_tool/package_config.json').readAsString());
    final Map<String, dynamic> flutter = (packages['packages'] as List<dynamic>)
        .cast<Map<String, dynamic>>()
        .singleWhere(
            (Map<String, dynamic> value) => value['name'] == 'flutter');
    final Uri sdk = Uri.parse('${flutter['rootUri']}/');
    final String executable = sdk
        .resolve('../../bin/cache/dart-sdk/bin/'
            '${Platform.isWindows ? 'dart.exe' : 'dart'}')
        .toFilePath();
    final Directory directory =
        await Directory.systemTemp.createTemp('tax-deadline-');
    final File proof = File('${directory.path}/proof.json');
    const String previousProof = 'previous verified phase\r\n{"preserve":true}';
    await proof.writeAsString(previousProof, flush: true);
    final Stopwatch clock = Stopwatch()..start();
    final Process process = await Process.start(executable,
        <String>['test/fixtures/tax_driver_deadline_probe.dart', proof.path]);
    final Future<String> output = process.stdout.transform(utf8.decoder).join();
    final Future<String> error = process.stderr.transform(utf8.decoder).join();
    try {
      expect(await process.exitCode.timeout(const Duration(seconds: 4)), 1);
      expect(await output, isNot(contains('All tests passed.')));
      expect(await error, contains('bounded phase timeout; no acceptance'));
      expect(await proof.readAsString(), previousProof);
      expect(clock.elapsed, lessThan(const Duration(seconds: 4)));
    } finally {
      process.kill();
      await directory.delete(recursive: true);
    }
  });
}
