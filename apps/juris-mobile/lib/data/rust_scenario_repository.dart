import '../models/case_catalog.dart';
import '../models/game_snapshot.dart';
import 'game_runtime_repository.dart';
import 'scenario_bridge_client.dart';
import 'scenario_snapshot_mapper.dart';

/// Flutter repository backed by one authoritative Rust scenario session.
final class RustScenarioRepository extends GameRuntimeRepository {
  RustScenarioRepository({
    required this.caseDefinition,
    required ScenarioBridgeClient bridgeClient,
    this.locale = 'en',
  }) : _bridgeClient = bridgeClient {
    _createSession();
  }

  final MobileCaseDefinition caseDefinition;
  final String locale;
  final ScenarioBridgeClient _bridgeClient;
  final Set<String> _locallyReadInboxIds = <String>{};

  late int _sessionId;
  late Map<String, dynamic> _rawSnapshot;
  late GameSnapshot _snapshot;
  String? _clockErrorMessage;
  bool _disposed = false;

  @override
  GameSnapshot get snapshot => _snapshot;

  @override
  bool get isTerminal => _snapshot.outcomeSummary != null;

  @override
  bool get supportsLiveClock =>
      _clockErrorMessage == null && _rawSnapshot['clock_mode'] == 'foreground';

  @override
  String? get clockErrorMessage => _clockErrorMessage;

  @override
  ActionExecutionResult applyAction(String actionId) {
    final GameActionView? selected = _snapshot.actions
        .where((GameActionView action) => action.id == actionId)
        .firstOrNull;
    final ScenarioBridgeResponse response = _execute(
      ScenarioBridgeCommand.dispatch(
        sessionId: _sessionId,
        actionId: actionId,
      ),
    );
    if (response.isError) {
      return ActionExecutionResult(
        title: selected?.title ?? actionId,
        message: response.errorMessage ?? 'The action was rejected.',
        isRisky: true,
      );
    }

    _acceptSnapshot(response);
    notifyListeners();
    final String message = _snapshot.outcomeSummary == null
        ? '${locale == 'ru' ? 'Стадия' : 'Stage'}: ${_snapshot.stage}.'
        : '${locale == 'ru' ? 'Исход' : 'Outcome'}: '
            '${_snapshot.outcomeSummary!.headline}.';
    return ActionExecutionResult(
      title: selected?.title ?? actionId,
      message: message,
      isRisky: false,
    );
  }

  @override
  void advanceTimeByMinutes(int minutes) {
    try {
      final ScenarioBridgeResponse response = _execute(
        ScenarioBridgeCommand.advanceTime(
          sessionId: _sessionId,
          minutes: minutes,
        ),
      );
      if (response.isError) {
        final String message =
            response.errorMessage ?? 'The scenario clock command was rejected.';
        _stopClockWithError(message);
        throw ScenarioClockAdvanceException(
          code: response.errorCode ?? 'clock_advance_failed',
          message: message,
        );
      }

      _acceptSnapshot(response);
      notifyListeners();
    } on ScenarioClockAdvanceException {
      rethrow;
    } on Object catch (error) {
      final String message = 'Scenario clock transport failed: $error';
      _stopClockWithError(message);
      throw ScenarioClockAdvanceException(
        code: 'clock_transport_failed',
        message: message,
      );
    }
  }

  @override
  void markInboxItemRead(String itemId) {
    if (!_locallyReadInboxIds.add(itemId)) {
      return;
    }
    _remap();
    notifyListeners();
  }

  @override
  void reset() {
    _disposeNativeSession();
    _locallyReadInboxIds.clear();
    _clockErrorMessage = null;
    _createSession();
    notifyListeners();
  }

  @override
  void dispose() {
    _disposeNativeSession();
    _disposed = true;
    super.dispose();
  }

  void _createSession() {
    final Map<String, dynamic>? scenario = caseDefinition.scenario;
    if (scenario == null) {
      throw StateError(
        '${caseDefinition.caseId} has no bundled scenario definition',
      );
    }
    final ScenarioBridgeResponse response = _execute(
      ScenarioBridgeCommand.createSession(
        scenario: scenario,
        seed: caseDefinition.seed,
      ),
    );
    if (response.isError) {
      throw StateError(
        '${response.errorCode}: ${response.errorMessage}',
      );
    }
    final int? sessionId = response.sessionId;
    if (sessionId == null) {
      throw const FormatException(
        'create_session response must contain session_id',
      );
    }
    _sessionId = sessionId;
    _acceptSnapshot(response);
  }

  ScenarioBridgeResponse _execute(String request) {
    if (_disposed) {
      throw StateError('Scenario repository has already been disposed');
    }
    return ScenarioBridgeResponse.parse(_bridgeClient.execute(request));
  }

  void _acceptSnapshot(ScenarioBridgeResponse response) {
    final Map<String, dynamic>? next = response.snapshot;
    if (next == null) {
      throw FormatException(
        '${response.type} response must contain a snapshot',
      );
    }
    _rawSnapshot = next;
    _remap();
  }

  void _remap() {
    _snapshot = ScenarioSnapshotMapper.map(
      source: _rawSnapshot,
      caseDefinition: caseDefinition,
      locale: locale,
      locallyReadInboxIds: _locallyReadInboxIds,
    );
  }

  void _stopClockWithError(String message) {
    _clockErrorMessage = message;
    notifyListeners();
  }

  void _disposeNativeSession() {
    if (_disposed) {
      return;
    }
    try {
      _execute(ScenarioBridgeCommand.disposeSession(_sessionId));
    } on Object {
      // Widget disposal is best effort. The process registry is reclaimed
      // with the native library even after a transport failure.
    }
  }
}

/// Controlled failure used by the shell to pause automatic ticking without
/// discarding the last valid authoritative snapshot.
final class ScenarioClockAdvanceException implements Exception {
  const ScenarioClockAdvanceException({
    required this.code,
    required this.message,
  });

  final String code;
  final String message;

  @override
  String toString() => '$code: $message';
}

extension<T> on Iterable<T> {
  T? get firstOrNull {
    final Iterator<T> iterator = this.iterator;
    return iterator.moveNext() ? iterator.current : null;
  }
}
