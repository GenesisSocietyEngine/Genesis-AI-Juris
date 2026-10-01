import 'dart:async';
import 'dart:convert';
import 'dart:io';

/// A real host deadline; FlutterDriver's request timeout only emits a warning.
/// A timed-out operation cannot be cancelled by Future.timeout. The executable
/// caller must exit nonzero after this throws, rather than await that operation.
Future<T> runTaxDriverPhase<T>({
  required Future<T> Function() operation,
  required Duration timeout,
  required Future<void> Function(Object, StackTrace) onFailure,
  required Future<void> Function() close,
  Duration diagnosticsTimeout = const Duration(seconds: 20),
  Duration closeTimeout = const Duration(seconds: 3),
  void Function(String)? reportCleanupError,
}) async {
  bool operationFailed = false;
  try {
    return await Future<T>.sync(operation).timeout(timeout);
  } on Object catch (error, stack) {
    operationFailed = true;
    try {
      await Future<void>.sync(
        () => onFailure(error, stack),
      ).timeout(diagnosticsTimeout);
    } on Object catch (diagnosticError) {
      reportCleanupError?.call('Failure diagnostics: $diagnosticError');
    }
    Error.throwWithStackTrace(error, stack);
  } finally {
    try {
      await Future<void>.sync(close).timeout(closeTimeout);
    } on Object catch (closeError) {
      reportCleanupError?.call('Driver close: $closeError');
      if (!operationFailed) rethrow;
    }
  }
}

/// Read-only VM RPCs only. Never pause/resume, evaluate, or modify the app.
/// Bounded by the caller as well as per-connect/per-RPC limits. Retains frame
/// locations and async causal stacks without application locals/heap contents.
Future<Map<String, dynamic>> captureTaxDriverVm(
  String? serviceUrl, {
  Duration rpcTimeout = const Duration(seconds: 2),
  int isolateLimit = 8,
}) async {
  final Map<String, dynamic> result = <String, dynamic>{
    'acceptance': false,
    'read_only': true,
    'captured_utc': DateTime.now().toUtc().toIso8601String(),
  };
  if (serviceUrl == null || serviceUrl.isEmpty) {
    return result..['unavailable'] = 'VM_SERVICE_URL is absent';
  }
  final Uri service = Uri.parse(serviceUrl);
  if (!<String>['http', 'https', 'ws', 'wss'].contains(service.scheme) ||
      !<String>['127.0.0.1', 'localhost', '::1'].contains(service.host)) {
    return result..['unavailable'] = 'Expected a local VM service';
  }
  final Uri socketUri = service.replace(
    scheme: <String>['https', 'wss'].contains(service.scheme) ? 'wss' : 'ws',
    path: service.path.endsWith('/ws')
        ? service.path
        : '${service.path.endsWith('/') ? service.path : '${service.path}/'}ws',
  );
  final WebSocket socket = await WebSocket.connect(
    socketUri.toString(),
  ).timeout(rpcTimeout);
  final Map<String, Completer<Map<String, dynamic>>> pending =
      <String, Completer<Map<String, dynamic>>>{};
  int sequence = 0;
  void failPending(Object error) {
    for (final Completer<Map<String, dynamic>> item in pending.values) {
      if (!item.isCompleted) item.completeError(error);
    }
    pending.clear();
  }

  final StreamSubscription<dynamic> messages = socket.listen(
    (dynamic raw) {
      try {
        final Map<String, dynamic> message =
            jsonDecode(raw as String) as Map<String, dynamic>;
        final Completer<Map<String, dynamic>>? item = pending.remove(
          message['id'],
        );
        if (item == null) return;
        if (message['error'] != null) {
          item.completeError(StateError('VM RPC failed: ${message['error']}'));
        } else {
          item.complete(message['result'] as Map<String, dynamic>);
        }
      } on Object catch (error) {
        failPending(error);
      }
    },
    onError: (Object error) => failPending(error),
    onDone: () => failPending(StateError('VM diagnostic socket closed')),
  );
  Future<Map<String, dynamic>> rpc(
    String method, [
    Map<String, dynamic> params = const <String, dynamic>{},
  ]) async {
    if (!<String>['getVM', 'getIsolate', 'getStack'].contains(method)) {
      throw StateError('Unsupported diagnostic RPC');
    }
    final String id = '${++sequence}';
    final Completer<Map<String, dynamic>> item =
        Completer<Map<String, dynamic>>();
    pending[id] = item;
    try {
      socket.add(
        jsonEncode(<String, dynamic>{
          'jsonrpc': '2.0',
          'id': id,
          'method': method,
          'params': params,
        }),
      );
      return await item.future.timeout(rpcTimeout);
    } finally {
      pending.remove(id);
    }
  }

  List<Map<String, dynamic>> frames(dynamic values) =>
      (values as List<dynamic>? ?? <dynamic>[]).take(32).map((dynamic value) {
        final Map<String, dynamic> frame = value as Map<String, dynamic>;
        return <String, dynamic>{
          for (final String key in <String>[
            'index',
            'kind',
            'function',
            'location',
          ])
            if (frame.containsKey(key)) key: frame[key],
        };
      }).toList(growable: false);
  try {
    final Map<String, dynamic> vm = await rpc('getVM');
    result['vm'] = <String, dynamic>{
      for (final String key in <String>['pid', 'version', 'operatingSystem'])
        if (vm.containsKey(key)) key: vm[key],
    };
    final List<dynamic> refs = vm['isolates'] as List<dynamic>? ?? <dynamic>[];
    result['isolate_count'] = refs.length;
    result['isolate_limit'] = isolateLimit;
    final List<Map<String, dynamic>> isolates = <Map<String, dynamic>>[];
    result['isolates'] = isolates;
    for (final dynamic ref in refs.take(isolateLimit)) {
      final Map<String, dynamic> item = <String, dynamic>{
        'id': ref['id'],
        'name': ref['name'],
      };
      isolates.add(item);
      try {
        final Map<String, dynamic> isolate = await rpc(
          'getIsolate',
          <String, dynamic>{'isolateId': ref['id']},
        );
        item['pause_event'] = isolate['pauseEvent'];
        item['runnable'] = isolate['runnable'];
        final Map<String, dynamic> stack = await rpc(
          'getStack',
          <String, dynamic>{'isolateId': ref['id'], 'limit': 32},
        );
        item['frames'] = frames(stack['frames']);
        item['async_causal_frames'] = frames(stack['asyncCausalFrames']);
        item['truncated'] = stack['truncated'];
      } on Object catch (error) {
        item['error'] = '$error';
      }
    }
  } on Object catch (error) {
    result['error'] = '$error';
  } finally {
    failPending(StateError('Diagnostic capture finished'));
    await messages.cancel().timeout(rpcTimeout);
    await socket.close().timeout(rpcTimeout);
  }
  return result;
}
