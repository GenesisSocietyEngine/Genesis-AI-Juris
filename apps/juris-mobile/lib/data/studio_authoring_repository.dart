import '../models/studio_scenario_draft.dart';
import 'scenario_bridge_client.dart';

final class StudioDiagnostic {
  const StudioDiagnostic({
    required this.code,
    required this.severity,
    required this.path,
    required this.message,
  });

  factory StudioDiagnostic.fromJson(Map<String, dynamic> source) {
    return StudioDiagnostic(
      code: source['code'] as String? ?? 'unknown_diagnostic',
      severity: source['severity'] as String? ?? 'error',
      path: source['path'] as String? ?? '',
      message: source['message'] as String? ?? 'Validation failed.',
    );
  }

  final String code;
  final String severity;
  final String path;
  final String message;
}

final class StudioValidationResult {
  const StudioValidationResult({
    required this.valid,
    required this.diagnostics,
  });

  final bool valid;
  final List<StudioDiagnostic> diagnostics;
}

final class StudioRouteTestResult {
  const StudioRouteTestResult({
    required this.executedActionIds,
    required this.outcomeId,
  });

  final List<String> executedActionIds;
  final String outcomeId;
}

/// Coordinates Flutter authoring with the authoritative Rust bridge.
final class StudioAuthoringRepository {
  const StudioAuthoringRepository(this._bridgeClient);

  final ScenarioBridgeClient _bridgeClient;

  StudioValidationResult validate(StudioScenarioDraft draft) {
    final ScenarioBridgeResponse response = _execute(
      ScenarioBridgeCommand.validateScenario(draft.toJson()),
    );
    if (response.isError) {
      throw StudioBridgeException(
        code: response.errorCode ?? 'validation_failed',
        message: response.errorMessage ?? 'Rust validation failed.',
      );
    }
    if (response.type != 'scenario_validated' || response.valid == null) {
      throw const StudioBridgeException(
        code: 'invalid_validation_response',
        message: 'Rust returned an incomplete validation response.',
      );
    }
    return StudioValidationResult(
      valid: response.valid!,
      diagnostics: response.diagnostics
          .map(StudioDiagnostic.fromJson)
          .toList(growable: false),
    );
  }

  StudioRouteTestResult runFirstAvailableRoute(StudioScenarioDraft draft) {
    final ScenarioBridgeResponse created = _execute(
      ScenarioBridgeCommand.createSession(
        scenario: draft.toJson(),
        seed: 54,
      ),
    );
    if (created.isError ||
        created.sessionId == null ||
        created.snapshot == null) {
      throw StudioBridgeException(
        code: created.errorCode ?? 'route_session_failed',
        message: created.errorMessage ?? 'Rust could not start the route.',
      );
    }

    final int sessionId = created.sessionId!;
    Map<String, dynamic> snapshot = created.snapshot!;
    final List<String> executed = <String>[];
    try {
      for (int turn = 0; turn < 64; turn += 1) {
        final dynamic outcome = snapshot['resolved_outcome'];
        if (outcome is String && outcome.isNotEmpty) {
          return StudioRouteTestResult(
            executedActionIds: List<String>.unmodifiable(executed),
            outcomeId: outcome,
          );
        }
        final List<dynamic> available =
            snapshot['available_actions'] as List<dynamic>? ??
                const <dynamic>[];
        final Map<String, dynamic>? action =
            available.whereType<Map<String, dynamic>>().firstOrNull;
        final String? actionId = action?['id'] as String?;
        if (actionId == null || actionId.isEmpty) {
          throw const StudioBridgeException(
            code: 'route_dead_end',
            message: 'The authored route reached a non-terminal dead end.',
          );
        }
        final ScenarioBridgeResponse dispatched = _execute(
          ScenarioBridgeCommand.dispatch(
            sessionId: sessionId,
            actionId: actionId,
          ),
        );
        if (dispatched.isError || dispatched.snapshot == null) {
          throw StudioBridgeException(
            code: dispatched.errorCode ?? 'route_dispatch_failed',
            message:
                dispatched.errorMessage ?? 'Rust rejected an authored action.',
          );
        }
        executed.add(actionId);
        snapshot = dispatched.snapshot!;
      }
      throw const StudioBridgeException(
        code: 'route_limit_exceeded',
        message: 'The route did not resolve within 64 authoritative actions.',
      );
    } finally {
      _execute(ScenarioBridgeCommand.disposeSession(sessionId));
    }
  }

  ScenarioBridgeResponse _execute(String request) {
    try {
      return ScenarioBridgeResponse.parse(_bridgeClient.execute(request));
    } on StudioBridgeException {
      rethrow;
    } on Object catch (error) {
      throw StudioBridgeException(
        code: 'bridge_transport_failed',
        message: 'The Rust bridge could not be reached: $error',
      );
    }
  }
}

final class StudioBridgeException implements Exception {
  const StudioBridgeException({required this.code, required this.message});

  final String code;
  final String message;

  @override
  String toString() => '$code: $message';
}
