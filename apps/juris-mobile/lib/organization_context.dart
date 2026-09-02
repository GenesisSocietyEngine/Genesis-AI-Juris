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
    required this.organizationId,
    required this.authorizationVersion,
    required this.sessionVersion,
    required this.generation,
  });

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
  Future<void> _exclusiveTail = Future<void>.value();
  OrganizationContext? _current;
  String? _unclearedOrganizationId;
  int _generation = 0;

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
    return _runExclusive(() async {
      _validateCandidate(
        organizationId: organizationId,
        authorizationVersion: authorizationVersion,
        sessionVersion: sessionVersion,
      );
      final OrganizationContext? previous = _current;
      final String? blockedOrganization = _unclearedOrganizationId;
      final String? organizationToClear =
          blockedOrganization ?? previous?.organizationId;

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
        throw const OrganizationContextException(code: 'stale_session_version');
      }

      if (organizationToClear != null) {
        await _clearOrBlock(
          organizationToClear,
          TenantInvalidationReason.organizationSwitch,
        );
      }

      _generation += 1;
      final OrganizationContext next = OrganizationContext(
        organizationId: organizationId,
        displayName: displayName.trim(),
        authorizationVersion: authorizationVersion,
        sessionVersion: sessionVersion,
        generation: _generation,
        confidentialDocumentMode: confidentialDocumentMode,
      );
      _current = next;
      _unclearedOrganizationId = null;
      return next;
    });
  }

  Future<void> invalidate(TenantInvalidationReason reason) {
    return _runExclusive(() async {
      final String? organizationToClear =
          _unclearedOrganizationId ?? _current?.organizationId;
      if (organizationToClear == null) {
        _current = null;
        return;
      }
      await _clearOrBlock(organizationToClear, reason);
      _generation += 1;
      _current = null;
      _unclearedOrganizationId = null;
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
      organizationId: context.organizationId,
      authorizationVersion: context.authorizationVersion,
      sessionVersion: context.sessionVersion,
      generation: context.generation,
    );
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
    _current = null;
    _unclearedOrganizationId = organizationId;
    try {
      await _clearTenantState(
        TenantClearRequest(
          organizationId: organizationId,
          reason: reason,
          generation: _generation,
        ),
      );
    } on Object catch (error) {
      _generation += 1;
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
