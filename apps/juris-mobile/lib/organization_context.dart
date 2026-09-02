import 'dart:async';

const String confidentialUploadWarning =
    'Confidential document mode is not active. Do not upload privileged, '
    'client-identifying, or live production documents. Use only synthetic or '
    'properly de-identified material.';

enum ConfidentialDocumentMode { disabled, validation }

enum TenantInvalidationReason {
  organizationSwitch,
  signOut,
  membershipRemoval,
  policyChange,
  sessionRevocation,
}

final class OrganizationContext {
  const OrganizationContext({
    required this.organizationId,
    required this.displayName,
    required this.authorizationVersion,
    required this.sessionVersion,
    required this.generation,
    required this.confidentialDocumentMode,
  });

  final String organizationId;
  final String displayName;
  final int authorizationVersion;
  final int sessionVersion;
  final int generation;
  final ConfidentialDocumentMode confidentialDocumentMode;

  bool get confidentialUploadsEnabled => false;
  bool get syntheticOrDeidentifiedRequired => true;
  String get uploadWarning => confidentialUploadWarning;
}

final class TenantClearRequest {
  const TenantClearRequest({
    required this.organizationId,
    required this.reason,
    required this.generation,
  });

  final String organizationId;
  final TenantInvalidationReason reason;
  final int generation;
}

typedef TenantStateClearer = Future<void> Function(TenantClearRequest request);

final class OrganizationContextPermit {
  const OrganizationContextPermit._({
    required Object issuer,
    required this.organizationId,
    required this.authorizationVersion,
    required this.sessionVersion,
    required this.generation,
  }) : _issuer = issuer;

  final Object _issuer;
  final String organizationId;
  final int authorizationVersion;
  final int sessionVersion;
  final int generation;
}

final class OrganizationContextCoordinator {
  OrganizationContextCoordinator({required TenantStateClearer clearTenantState})
      : _clearTenantState = clearTenantState;

  static final RegExp _opaqueId = RegExp(r'^[A-Za-z0-9_-]{20,128}$');

  final TenantStateClearer _clearTenantState;
  final Object _permitIssuer = Object();
  Future<void> _exclusiveTail = Future<void>.value();
  OrganizationContext? _current;
  String? _unclearedOrganizationId;
  int? _unclearedGeneration;
  int _generation = 0;
  int _intent = 0;

  OrganizationContext? get current => _current;
  int get generation => _generation;
  bool get isBlocked => _unclearedOrganizationId != null;

  Future<OrganizationContext> switchTo({
    required String organizationId,
    required String displayName,
    required int authorizationVersion,
    required int sessionVersion,
    ConfidentialDocumentMode confidentialDocumentMode =
        ConfidentialDocumentMode.disabled,
  }) {
    final OrganizationContext? previous = _current;
    try {
      _validateCandidate(
        organizationId: organizationId,
        authorizationVersion: authorizationVersion,
        sessionVersion: sessionVersion,
      );
      if (previous != null &&
          previous.organizationId == organizationId &&
          authorizationVersion < previous.authorizationVersion) {
        throw const OrganizationContextException(
          code: 'stale_authorization_version',
        );
      }
      if (previous != null &&
          previous.organizationId == organizationId &&
          sessionVersion < previous.sessionVersion) {
        throw const OrganizationContextException(
          code: 'stale_session_version',
        );
      }
    } on OrganizationContextException catch (error, stackTrace) {
      return Future<OrganizationContext>.error(error, stackTrace);
    }

    final int intent = _beginAuthorityChange();
    final int requestGeneration = _generation;
    return _runExclusive(() async {
      _throwIfSuperseded(intent);
      final String? blockedOrganization = _unclearedOrganizationId;
      final String? organizationToClear =
          blockedOrganization ?? _current?.organizationId;

      if (organizationToClear != null) {
        await _clearOrBlock(
          organizationToClear,
          TenantInvalidationReason.organizationSwitch,
        );
      }
      _throwIfSuperseded(intent);

      final OrganizationContext next = OrganizationContext(
        organizationId: organizationId,
        displayName: displayName.trim(),
        authorizationVersion: authorizationVersion,
        sessionVersion: sessionVersion,
        generation: requestGeneration,
        confidentialDocumentMode: confidentialDocumentMode,
      );
      _current = next;
      return next;
    });
  }

  Future<void> invalidate(TenantInvalidationReason reason) {
    final int intent = _beginAuthorityChange();
    return _runExclusive(() async {
      if (intent != _intent) return;
      final String? organizationToClear =
          _unclearedOrganizationId ?? _current?.organizationId;
      if (organizationToClear != null) {
        await _clearOrBlock(organizationToClear, reason);
      }
    });
  }

  OrganizationContextPermit authorize({
    required String organizationId,
    required int authorizationVersion,
    required int sessionVersion,
    required int generation,
  }) {
    final OrganizationContext? context = _current;
    if (_unclearedOrganizationId != null || context == null) {
      throw const OrganizationContextException(
        code: 'organization_context_denied',
      );
    }
    if (context.organizationId != organizationId ||
        context.authorizationVersion != authorizationVersion ||
        context.sessionVersion != sessionVersion ||
        context.generation != generation) {
      throw const OrganizationContextException(
        code: 'organization_context_denied',
      );
    }
    return OrganizationContextPermit._(
      issuer: _permitIssuer,
      organizationId: context.organizationId,
      authorizationVersion: context.authorizationVersion,
      sessionVersion: context.sessionVersion,
      generation: context.generation,
    );
  }

  void validatePermit(OrganizationContextPermit permit) {
    final OrganizationContext? context = _current;
    if (_unclearedOrganizationId != null ||
        context == null ||
        !identical(permit._issuer, _permitIssuer) ||
        context.organizationId != permit.organizationId ||
        context.authorizationVersion != permit.authorizationVersion ||
        context.sessionVersion != permit.sessionVersion ||
        context.generation != permit.generation) {
      throw const OrganizationContextException(
        code: 'organization_context_denied',
      );
    }
  }

  int _beginAuthorityChange() {
    final OrganizationContext? previous = _current;
    _intent += 1;
    _generation += 1;
    _current = null;
    if (previous != null) {
      if (_unclearedOrganizationId == null) {
        _unclearedOrganizationId = previous.organizationId;
        _unclearedGeneration = previous.generation;
      }
    }
    return _intent;
  }

  void _throwIfSuperseded(int intent) {
    if (intent != _intent) {
      throw const OrganizationContextException(
        code: 'organization_context_superseded',
      );
    }
  }

  void _validateCandidate({
    required String organizationId,
    required int authorizationVersion,
    required int sessionVersion,
  }) {
    if (!_opaqueId.hasMatch(organizationId)) {
      throw const OrganizationContextException(code: 'invalid_organization_id');
    }
    if (authorizationVersion < 1) {
      throw const OrganizationContextException(
        code: 'invalid_authorization_version',
      );
    }
    if (sessionVersion < 1) {
      throw const OrganizationContextException(code: 'invalid_session_version');
    }
  }

  Future<void> _clearOrBlock(
    String organizationId,
    TenantInvalidationReason reason,
  ) async {
    final int generationToClear = _unclearedGeneration ?? _generation;
    _current = null;
    _unclearedOrganizationId = organizationId;
    _unclearedGeneration ??= generationToClear;
    try {
      await _clearTenantState(
        TenantClearRequest(
          organizationId: organizationId,
          reason: reason,
          generation: generationToClear,
        ),
      );
      if (_unclearedOrganizationId == organizationId) {
        _unclearedOrganizationId = null;
        _unclearedGeneration = null;
      }
    } on Object catch (error) {
      throw OrganizationContextException(
        code: 'tenant_state_clear_failed',
        cause: error,
      );
    }
  }

  Future<T> _runExclusive<T>(Future<T> Function() operation) async {
    final Future<void> predecessor = _exclusiveTail;
    final Completer<void> release = Completer<void>();
    _exclusiveTail = release.future;
    await predecessor;
    try {
      return await operation();
    } finally {
      release.complete();
    }
  }
}

final class OrganizationContextException implements Exception {
  const OrganizationContextException({required this.code, this.cause});

  final String code;
  final Object? cause;

  @override
  String toString() => code;
}
