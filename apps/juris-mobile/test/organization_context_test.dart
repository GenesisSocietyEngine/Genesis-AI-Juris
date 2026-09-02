import 'dart:async';

import 'package:flutter_test/flutter_test.dart';
import 'package:juris_mobile/organization_context.dart';

const String organizationA = 'org_AAAAAAAAAAAAAAAA';
const String organizationB = 'org_BBBBBBBBBBBBBBBB';
const String organizationC = 'org_CCCCCCCCCCCCCCCC';

void main() {
  test('confidential uploads remain disabled with the exact warning', () async {
    final OrganizationContextCoordinator coordinator =
        OrganizationContextCoordinator(clearTenantState: (_) async {});
    final OrganizationContext context = await coordinator.switchTo(
      organizationId: organizationA,
      displayName: 'Example A',
      authorizationVersion: 1,
      sessionVersion: 1,
    );

    expect(context.confidentialUploadsEnabled, isFalse);
    expect(context.syntheticOrDeidentifiedRequired, isTrue);
    expect(context.uploadWarning, confidentialUploadWarning);
    expect(
      confidentialUploadWarning,
      'Confidential document mode is not active. Do not upload privileged, '
      'client-identifying, or live production documents. Use only synthetic or '
      'properly de-identified material.',
    );
  });

  test(
    'tenant state is cleared before a different context becomes current',
    () async {
      final Completer<void> cleared = Completer<void>();
      final List<TenantClearRequest> requests = <TenantClearRequest>[];
      final OrganizationContextCoordinator coordinator =
          OrganizationContextCoordinator(
        clearTenantState: (request) async {
          requests.add(request);
          await cleared.future;
        },
      );
      final OrganizationContext first = await coordinator.switchTo(
        organizationId: organizationA,
        displayName: 'Example A',
        authorizationVersion: 4,
        sessionVersion: 8,
      );
      final OrganizationContextPermit firstPermit = coordinator.authorize(
        organizationId: organizationA,
        authorizationVersion: 4,
        sessionVersion: 8,
        generation: first.generation,
      );

      final Future<OrganizationContext> pending = coordinator.switchTo(
        organizationId: organizationB,
        displayName: 'Example B',
        authorizationVersion: 1,
        sessionVersion: 1,
      );
      expect(coordinator.current, isNull);
      expect(coordinator.isBlocked, isTrue);
      expect(
        () => coordinator.authorize(
          organizationId: organizationA,
          authorizationVersion: 4,
          sessionVersion: 8,
          generation: first.generation,
        ),
        throwsA(isA<OrganizationContextException>()),
      );
      expect(
        () => coordinator.validatePermit(firstPermit),
        throwsA(isA<OrganizationContextException>()),
      );

      await Future<void>.delayed(Duration.zero);
      expect(requests.single.organizationId, organizationA);
      expect(
        requests.single.reason,
        TenantInvalidationReason.organizationSwitch,
      );
      expect(requests.single.generation, first.generation);

      cleared.complete();
      final OrganizationContext second = await pending;
      expect(second.organizationId, organizationB);
      expect(coordinator.isBlocked, isFalse);
    },
  );

  test(
    'a failed clear blocks both old and target tenant until retry succeeds',
    () async {
      bool fail = true;
      final List<String> clearedOrganizations = <String>[];
      final OrganizationContextCoordinator coordinator =
          OrganizationContextCoordinator(
        clearTenantState: (request) async {
          clearedOrganizations.add(request.organizationId);
          if (fail) throw StateError('synthetic clear failure');
        },
      );
      final OrganizationContext first = await coordinator.switchTo(
        organizationId: organizationA,
        displayName: 'Example A',
        authorizationVersion: 1,
        sessionVersion: 1,
      );

      await expectLater(
        coordinator.switchTo(
          organizationId: organizationB,
          displayName: 'Example B',
          authorizationVersion: 1,
          sessionVersion: 1,
        ),
        throwsA(
          isA<OrganizationContextException>().having(
            (error) => error.code,
            'code',
            'tenant_state_clear_failed',
          ),
        ),
      );
      expect(coordinator.current, isNull);
      expect(coordinator.isBlocked, isTrue);
      expect(
        () => coordinator.authorize(
          organizationId: organizationA,
          authorizationVersion: 1,
          sessionVersion: 1,
          generation: first.generation,
        ),
        throwsA(isA<OrganizationContextException>()),
      );

      fail = false;
      final OrganizationContext recovered = await coordinator.switchTo(
        organizationId: organizationB,
        displayName: 'Example B',
        authorizationVersion: 1,
        sessionVersion: 1,
      );
      expect(recovered.organizationId, organizationB);
      expect(clearedOrganizations, <String>[organizationA, organizationA]);
    },
  );

  test(
    'a queued switch supersedes an in-flight switch before it can activate',
    () async {
      final List<String> clearOrder = <String>[];
      final List<Completer<void>> gates = <Completer<void>>[];
      final OrganizationContextCoordinator coordinator =
          OrganizationContextCoordinator(
        clearTenantState: (request) async {
          clearOrder.add(request.organizationId);
          final Completer<void> gate = Completer<void>();
          gates.add(gate);
          await gate.future;
        },
      );
      await coordinator.switchTo(
        organizationId: organizationA,
        displayName: 'A',
        authorizationVersion: 1,
        sessionVersion: 1,
      );

      final Future<OrganizationContext> toB = coordinator.switchTo(
        organizationId: organizationB,
        displayName: 'B',
        authorizationVersion: 1,
        sessionVersion: 1,
      );
      await Future<void>.delayed(Duration.zero);
      expect(clearOrder, <String>[organizationA]);

      final Future<OrganizationContext> toC = coordinator.switchTo(
        organizationId: organizationC,
        displayName: 'C',
        authorizationVersion: 1,
        sessionVersion: 1,
      );
      final Future<void> bWasSuperseded = expectLater(
        toB,
        throwsA(
          isA<OrganizationContextException>().having(
            (error) => error.code,
            'code',
            'organization_context_superseded',
          ),
        ),
      );
      expect(coordinator.current, isNull);
      gates[0].complete();
      await bWasSuperseded;
      final OrganizationContext finalContext = await toC;
      expect(clearOrder, <String>[organizationA]);
      expect(finalContext.organizationId, organizationC);
      expect(coordinator.current?.organizationId, organizationC);
    },
  );

  test(
    'authorization rejects cross-tenant and stale context versions',
    () async {
      final OrganizationContextCoordinator coordinator =
          OrganizationContextCoordinator(clearTenantState: (_) async {});
      final OrganizationContext context = await coordinator.switchTo(
        organizationId: organizationA,
        displayName: 'Same display name',
        authorizationVersion: 7,
        sessionVersion: 3,
      );

      final OrganizationContextPermit permit = coordinator.authorize(
        organizationId: organizationA,
        authorizationVersion: 7,
        sessionVersion: 3,
        generation: context.generation,
      );
      expect(permit.organizationId, organizationA);
      expect(() => coordinator.validatePermit(permit), returnsNormally);

      final OrganizationContextCoordinator otherCoordinator =
          OrganizationContextCoordinator(clearTenantState: (_) async {});
      await otherCoordinator.switchTo(
        organizationId: organizationA,
        displayName: 'Same display name',
        authorizationVersion: 7,
        sessionVersion: 3,
      );
      expect(
        () => otherCoordinator.validatePermit(permit),
        throwsA(isA<OrganizationContextException>()),
      );
      for (final ({
        String organizationId,
        int auth,
        int session,
        int generation,
      }) candidate
          in <({String organizationId, int auth, int session, int generation})>[
        (
          organizationId: organizationB,
          auth: 7,
          session: 3,
          generation: context.generation,
        ),
        (
          organizationId: organizationA,
          auth: 6,
          session: 3,
          generation: context.generation,
        ),
        (
          organizationId: organizationA,
          auth: 7,
          session: 2,
          generation: context.generation,
        ),
        (
          organizationId: organizationA,
          auth: 7,
          session: 3,
          generation: context.generation - 1,
        ),
      ]) {
        expect(
          () => coordinator.authorize(
            organizationId: candidate.organizationId,
            authorizationVersion: candidate.auth,
            sessionVersion: candidate.session,
            generation: candidate.generation,
          ),
          throwsA(
            isA<OrganizationContextException>().having(
              (error) => error.code,
              'code',
              'organization_context_denied',
            ),
          ),
        );
      }
    },
  );

  test(
    'starting invalidation immediately revokes authorization and permits',
    () async {
      final Completer<void> cleared = Completer<void>();
      final List<TenantClearRequest> requests = <TenantClearRequest>[];
      final OrganizationContextCoordinator coordinator =
          OrganizationContextCoordinator(
        clearTenantState: (request) async {
          requests.add(request);
          await cleared.future;
        },
      );
      final OrganizationContext context = await coordinator.switchTo(
        organizationId: organizationA,
        displayName: 'Example A',
        authorizationVersion: 2,
        sessionVersion: 3,
      );
      final OrganizationContextPermit permit = coordinator.authorize(
        organizationId: organizationA,
        authorizationVersion: 2,
        sessionVersion: 3,
        generation: context.generation,
      );

      final Future<void> invalidating = coordinator.invalidate(
        TenantInvalidationReason.sessionRevocation,
      );
      expect(coordinator.current, isNull);
      expect(coordinator.isBlocked, isTrue);
      expect(
        () => coordinator.authorize(
          organizationId: organizationA,
          authorizationVersion: 2,
          sessionVersion: 3,
          generation: context.generation,
        ),
        throwsA(isA<OrganizationContextException>()),
      );
      expect(
        () => coordinator.validatePermit(permit),
        throwsA(isA<OrganizationContextException>()),
      );

      await Future<void>.delayed(Duration.zero);
      expect(
          requests.single.reason, TenantInvalidationReason.sessionRevocation);
      expect(requests.single.generation, context.generation);
      cleared.complete();
      await invalidating;
    },
  );

  test(
    'all authority invalidations clear tenant state and revoke context',
    () async {
      const List<TenantInvalidationReason> reasons = <TenantInvalidationReason>[
        TenantInvalidationReason.signOut,
        TenantInvalidationReason.membershipRemoval,
        TenantInvalidationReason.policyChange,
        TenantInvalidationReason.sessionRevocation,
      ];
      for (final TenantInvalidationReason reason in reasons) {
        final List<TenantClearRequest> requests = <TenantClearRequest>[];
        final OrganizationContextCoordinator coordinator =
            OrganizationContextCoordinator(
          clearTenantState: (request) async {
            requests.add(request);
          },
        );
        final OrganizationContext context = await coordinator.switchTo(
          organizationId: organizationA,
          displayName: 'Example',
          authorizationVersion: 1,
          sessionVersion: 1,
        );
        await coordinator.invalidate(reason);
        expect(requests.single.reason, reason);
        expect(coordinator.current, isNull);
        expect(
          () => coordinator.authorize(
            organizationId: organizationA,
            authorizationVersion: 1,
            sessionVersion: 1,
            generation: context.generation,
          ),
          throwsA(isA<OrganizationContextException>()),
        );
      }
    },
  );

  test('invalid or regressing server context is rejected', () async {
    final OrganizationContextCoordinator coordinator =
        OrganizationContextCoordinator(clearTenantState: (_) async {});
    await expectLater(
      coordinator.switchTo(
        organizationId: 'display-name-is-not-authority',
        displayName: 'Display',
        authorizationVersion: 0,
        sessionVersion: 1,
      ),
      throwsA(isA<OrganizationContextException>()),
    );
    await coordinator.switchTo(
      organizationId: organizationA,
      displayName: 'Display',
      authorizationVersion: 5,
      sessionVersion: 5,
    );
    await expectLater(
      coordinator.switchTo(
        organizationId: organizationA,
        displayName: 'Display',
        authorizationVersion: 4,
        sessionVersion: 5,
      ),
      throwsA(
        isA<OrganizationContextException>().having(
          (error) => error.code,
          'code',
          'stale_authorization_version',
        ),
      ),
    );
  });
}
