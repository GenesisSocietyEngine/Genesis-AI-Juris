import 'dart:convert';

/// Native transport boundary for the JSON protocol owned by
/// `juris-mobile-bridge`.
///
/// The implementation will be platform-specific, but repositories above this
/// interface remain transport-neutral and only exchange UTF-8 JSON commands.
abstract interface class ScenarioBridgeClient {
  String execute(String encodedRequest);
}

/// Stable request builders shared by native bridge implementations and tests.
abstract final class ScenarioBridgeCommand {
  static String createSession({
    required Map<String, dynamic> scenario,
    required int seed,
  }) {
    return jsonEncode(<String, dynamic>{
      'command': 'create_session',
      'scenario': scenario,
      'seed': seed,
    });
  }

  static String snapshot(int sessionId) {
    return jsonEncode(<String, dynamic>{
      'command': 'snapshot',
      'session_id': sessionId,
    });
  }

  static String dispatch({
    required int sessionId,
    required String actionId,
  }) {
    return jsonEncode(<String, dynamic>{
      'command': 'dispatch',
      'session_id': sessionId,
      'action_id': actionId,
    });
  }

  static String advanceTime({
    required int sessionId,
    required int minutes,
  }) {
    return jsonEncode(<String, dynamic>{
      'command': 'advance_time',
      'session_id': sessionId,
      'minutes': minutes,
    });
  }

  static String saveSession(int sessionId) {
    return jsonEncode(<String, dynamic>{
      'command': 'save_session',
      'session_id': sessionId,
    });
  }

  static String loadSession({
    required Map<String, dynamic> scenario,
    required String encodedSave,
  }) {
    return jsonEncode(<String, dynamic>{
      'command': 'load_session',
      'scenario': scenario,
      'encoded_save': encodedSave,
    });
  }

  static String disposeSession(int sessionId) {
    return jsonEncode(<String, dynamic>{
      'command': 'dispose_session',
      'session_id': sessionId,
    });
  }
}

/// Parsed response envelope. Domain snapshot conversion belongs in the future
/// Rust-backed repository, not in widgets or the native transport.
class ScenarioBridgeResponse {
  const ScenarioBridgeResponse._(this.payload);

  factory ScenarioBridgeResponse.parse(String encoded) {
    final dynamic decoded = jsonDecode(encoded);
    if (decoded is! Map<String, dynamic>) {
      throw const FormatException('Bridge response must be a JSON object');
    }
    final dynamic type = decoded['type'];
    if (type is! String || type.isEmpty) {
      throw const FormatException(
        'Bridge response must contain a non-empty type',
      );
    }
    return ScenarioBridgeResponse._(decoded);
  }

  final Map<String, dynamic> payload;

  String get type => payload['type'] as String;

  bool get isError => type == 'error';

  int? get sessionId => payload['session_id'] as int?;

  Map<String, dynamic>? get snapshot {
    final dynamic value = payload['snapshot'];
    return value is Map<String, dynamic> ? value : null;
  }

  String? get errorCode => payload['code'] as String?;

  String? get errorMessage => payload['message'] as String?;

  String? get encodedSave => payload['encoded_save'] as String?;
}
