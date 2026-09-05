import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import {
  createOidcAuthorizationTransaction,
  InMemoryOidcTransactionStore,
  validateOidcCallback,
  type EntraOidcConnection,
  type OidcCodeVerifier,
  type VerifiedOidcClaims,
} from "../app/entra-oidc";
import {
  ACTION_SCOPES,
  DOSSIER_EXPORT_APPROVAL_VERSION,
  decideTenantAuthorization,
  DOSSIER_ROLE_ACTIONS,
  COMPLIANCE_AUTHORITY_ACTIONS,
  DELEGATED_ORG_ADMIN_ACTIONS,
  InMemoryExportAcquisitionStore,
  InMemoryPolicyActivationStore,
  ORGANIZATION_ROLE_ACTIONS,
  PHASE_B_SERVER_DISABLED_ACTIONS,
  POLICY_ACTIVATION_APPROVAL_VERSION,
  REQUEST_CLASS_ACTIONS,
  SEPARATION_OF_DUTIES_ACTIONS,
  TENANT_ACTIONS,
  TENANT_MANIFEST_REQUIRED_ACTIONS,
  toPublicAuthorizationResult,
  type AuthorizationContext,
  type AuthorizationRequest,
} from "../app/tenant-authorization";
import {
  CONFIDENTIAL_UPLOAD_WARNING,
  canonicalJson,
  createDigestOnlyInvitation,
  decodeUtf8,
  InMemoryInvitationStore,
  InMemorySecurityReceiptChain,
  isUploadClassificationPermitted,
  LocalTestEnvelopeKms,
  ORGANIZATION_STATUSES,
  sha256Hex,
  stableKeyRotationState,
  transitionKeyRotation,
  transitionOrganizationLifecycle,
  VALIDATION_DATA_RESTRICTION,
  TENANT_RESOURCE_ACTIVATIONS,
  TENANT_RESOURCE_COMPONENTS,
  TENANT_RESOURCE_ENVIRONMENTS,
  TENANT_RESOURCE_MANIFEST_REQUIRED_FIELDS,
  TENANT_RESOURCE_MANIFEST_VERSION,
  TENANT_RESOURCE_R2_NAMESPACES,
  verifyTenantResourceManifest,
  verifySecurityReceiptChain,
  type EnvelopeAssociatedData,
  type InvitationRecord,
  type KeyRotationCommand,
  type KeyRotationState,
  type SecurityReceipt,
  type SecurityReceiptInput,
  type TenantResourceManifest,
  type VerifiedTenantResourceManifest,
} from "../app/tenant-foundation";

const NOW = 1_788_256_800;
const ORG_A = "org_phase_b_alpha_00000001";
const ORG_B = "org_phase_b_bravo_00000002";
const ACTOR_A = "actor_phase_b_alpha_00001";
const ACTOR_B = "actor_phase_b_bravo_00002";
const DOSSIER_A = "dossier_phase_b_alpha_0001";
const DOSSIER_B = "dossier_phase_b_bravo_0002";
const MANIFEST_B = "b".repeat(64);
const RESOURCE_DIGEST = "c".repeat(64);
const REQUEST_CORRELATION = "d".repeat(64);
const DEPLOYMENT_SHA = "e".repeat(40);
const PUBLIC_DENIAL = {
  ok: false,
  status: 404,
  code: "resource_unavailable",
} as const;

interface PolicyManifest {
  manifest_version: string;
  organization_statuses: string[];
  request_classes: Record<string, string[]>;
  action_scopes: Record<string, string[]>;
  organization_roles: Record<string, string[]>;
  dossier_roles: Record<string, string[]>;
  delegated_authority: { actions: string[] };
  compliance_authority_actions: string[];
  separation_of_duties_actions: string[];
  tenant_manifest_required_actions: string[];
  confidential_activation_required_actions: string[];
  confidential_upload_warning: string;
  validation_data_restriction: string;
}

interface FrozenOrganizationSchema {
  properties: {
    authorization: {
      properties: { action: { enum: string[] } };
    };
  };
}

interface FrozenTenantManifestSchema {
  required: string[];
  properties: {
    manifest_version: { const: string };
    environment: { enum: string[] };
    activation: { enum: string[] };
    r2: { properties: Record<string, unknown> };
    processing_components: { properties: Record<string, unknown> };
  };
}

function sorted(values: readonly string[]): string[] {
  return [...values].sort();
}

test("all frozen Phase A schema documents parse and declare Draft 2020-12", () => {
  for (const name of [
    "organization-contract.v1.schema.json",
    "tenant-resource-manifest.v1.schema.json",
    "confidential-document-policy.v1.schema.json",
  ]) {
    const schema = JSON.parse(
      readFileSync(resolve(process.cwd(), `contracts/${name}`), "utf8"),
    ) as { $schema?: string; $id?: string };
    assert.equal(schema.$schema, "https://json-schema.org/draft/2020-12/schema");
    assert.match(schema.$id ?? "", /^https:\/\/genesis\.invalid\/contracts\//u);
  }
});

test("shared Phase B role/action manifest is complete and in lockstep with the typed PDP", () => {
  const manifest = JSON.parse(
    readFileSync(
      resolve(process.cwd(), "contracts/phase-b-role-action-policy.v1.json"),
      "utf8",
    ),
  ) as PolicyManifest;
  const frozenSchema = JSON.parse(
    readFileSync(
      resolve(process.cwd(), "contracts/organization-contract.v1.schema.json"),
      "utf8",
    ),
  ) as FrozenOrganizationSchema;
  const tenantManifestSchema = JSON.parse(
    readFileSync(
      resolve(process.cwd(), "contracts/tenant-resource-manifest.v1.schema.json"),
      "utf8",
    ),
  ) as FrozenTenantManifestSchema;

  assert.equal(manifest.manifest_version, "phase-b-role-action-policy.v1");
  assert.deepEqual(manifest.organization_statuses, ORGANIZATION_STATUSES);
  assert.equal(manifest.organization_statuses.includes("closing"), false);
  assert.equal(manifest.confidential_upload_warning, CONFIDENTIAL_UPLOAD_WARNING);
  assert.equal(manifest.validation_data_restriction, VALIDATION_DATA_RESTRICTION);
  assert.deepEqual(sorted(Object.keys(manifest.action_scopes)), sorted(Object.keys(ACTION_SCOPES)));
  for (const [action, scopes] of Object.entries(ACTION_SCOPES)) {
    assert.deepEqual(sorted(manifest.action_scopes[action] ?? []), sorted(scopes));
  }
  assert.deepEqual(
    sorted(manifest.delegated_authority.actions),
    sorted(DELEGATED_ORG_ADMIN_ACTIONS),
  );
  assert.deepEqual(
    sorted(manifest.compliance_authority_actions),
    sorted(COMPLIANCE_AUTHORITY_ACTIONS),
  );
  assert.deepEqual(
    sorted(manifest.separation_of_duties_actions),
    sorted(SEPARATION_OF_DUTIES_ACTIONS),
  );
  assert.deepEqual(
    sorted(manifest.tenant_manifest_required_actions),
    sorted(TENANT_MANIFEST_REQUIRED_ACTIONS),
  );
  assert.deepEqual(
    sorted(manifest.confidential_activation_required_actions),
    sorted(PHASE_B_SERVER_DISABLED_ACTIONS),
  );
  assert.equal(
    tenantManifestSchema.properties.manifest_version.const,
    TENANT_RESOURCE_MANIFEST_VERSION,
  );
  assert.deepEqual(
    tenantManifestSchema.required,
    TENANT_RESOURCE_MANIFEST_REQUIRED_FIELDS,
  );
  assert.deepEqual(
    tenantManifestSchema.properties.environment.enum,
    TENANT_RESOURCE_ENVIRONMENTS,
  );
  assert.deepEqual(
    tenantManifestSchema.properties.activation.enum,
    TENANT_RESOURCE_ACTIVATIONS,
  );
  assert.deepEqual(
    sorted(Object.keys(tenantManifestSchema.properties.r2.properties)),
    sorted(TENANT_RESOURCE_R2_NAMESPACES),
  );
  assert.deepEqual(
    sorted(
      Object.keys(tenantManifestSchema.properties.processing_components.properties),
    ),
    sorted(TENANT_RESOURCE_COMPONENTS),
  );

  const actionsFromClasses: string[] = [];
  for (const [requestClass, actions] of Object.entries(REQUEST_CLASS_ACTIONS)) {
    assert.deepEqual(sorted(manifest.request_classes[requestClass] ?? []), sorted(actions));
    actionsFromClasses.push(...actions);
  }
  assert.equal(new Set(actionsFromClasses).size, actionsFromClasses.length);
  assert.deepEqual(sorted(actionsFromClasses), sorted(TENANT_ACTIONS));
  assert.deepEqual(
    sorted(TENANT_ACTIONS),
    sorted(frozenSchema.properties.authorization.properties.action.enum),
  );

  for (const [role, actions] of Object.entries(ORGANIZATION_ROLE_ACTIONS)) {
    assert.deepEqual(sorted(manifest.organization_roles[role] ?? []), sorted(actions));
  }
  for (const [role, actions] of Object.entries(DOSSIER_ROLE_ACTIONS)) {
    assert.deepEqual(sorted(manifest.dossier_roles[role] ?? []), sorted(actions));
  }
});

function dossierFixture(): {
  request: AuthorizationRequest;
  context: AuthorizationContext;
} {
  return {
    request: {
      requestClass: "dossier",
      scope: "dossier",
      action: "dossier_read",
      actorId: ACTOR_A,
      organizationId: ORG_A,
      dossierId: DOSSIER_A,
      expectedOrganizationAuthorizationVersion: 7,
      expectedMembershipAuthorizationVersion: 5,
      expectedParticipantAuthorizationVersion: 3,
      expectedPolicyRevision: 11,
      expectedResourceRevision: 11,
    },
    context: {
      nowEpochSeconds: NOW,
      session: {
        id: "session_phase_b_alpha_001",
        actorId: ACTOR_A,
        organizationId: ORG_A,
        status: "active",
        authenticationMethod: "local",
        organizationAuthorizationVersion: 7,
        membershipAuthorizationVersion: 5,
        policyRevision: 11,
        issuedAtEpochSeconds: NOW - 60,
        expiresAtEpochSeconds: NOW + 600,
      },
      organization: {
        id: ORG_A,
        status: "active",
        confidentialDocumentMode: "disabled",
        authorizationVersion: 7,
      },
      membership: {
        actorId: ACTOR_A,
        organizationId: ORG_A,
        status: "active",
        role: "member",
        authorizationVersion: 5,
      },
      dossier: { id: DOSSIER_A, organizationId: ORG_A },
      participant: {
        actorId: ACTOR_A,
        organizationId: ORG_A,
        dossierId: DOSSIER_A,
        status: "active",
        role: "viewer",
        authorizationVersion: 3,
      },
      policy: {
        organizationId: ORG_A,
        revision: 11,
        currentRevision: 11,
        status: "current",
      },
      resource: {
        organizationId: ORG_A,
        dossierId: DOSSIER_A,
        revision: 11,
        currentRevision: 11,
        resourceDigest: RESOURCE_DIGEST,
      },
      decisionReceiptBoundary: {
        requestCorrelationSha256: REQUEST_CORRELATION,
        deploymentSha: DEPLOYMENT_SHA,
        environment: "validation",
        authenticationMethod: "local_test",
      },
    },
  };
}

function cloneFixture(): ReturnType<typeof dossierFixture> {
  return structuredClone(dossierFixture());
}

function assertPrivateDenial(
  request: AuthorizationRequest,
  context: AuthorizationContext,
): void {
  const decision = decideTenantAuthorization(request, context);
  assert.equal(decision.allowed, false);
  assert.deepEqual(toPublicAuthorizationResult(decision), PUBLIC_DENIAL);
}

test("PDP permits only an exact active dossier participant and denies ambient organization access", () => {
  const fixture = dossierFixture();
  const decision = decideTenantAuthorization(fixture.request, fixture.context);
  assert.equal(decision.allowed, true);
  assert.equal(decision.receipt.evidenceStatus, "complete");
  assert.equal(decision.receipt.resourceRevision, 11);
  assert.equal(decision.receipt.organizationAuthorizationVersion, 7);
  assert.equal(decision.receipt.membershipAuthorizationVersion, 5);
  assert.equal(decision.receipt.participantAuthorizationVersion, 3);
  assert.equal(decision.receipt.policyRevision, 11);
  assert.equal(decision.receipt.outcome, "allowed");
  assert.equal(Object.isFrozen(decision.receipt), true);

  const roleDenied = cloneFixture();
  roleDenied.request.action = "dossier_update";
  assertPrivateDenial(roleDenied.request, roleDenied.context);

  const ambientAdmin = cloneFixture();
  ambientAdmin.context.membership!.role = "org_admin";
  delete ambientAdmin.context.participant;
  assertPrivateDenial(ambientAdmin.request, ambientAdmin.context);

  const removedParticipant = cloneFixture();
  removedParticipant.context.membership!.role = "org_owner";
  removedParticipant.context.participant!.status = "removed";
  assertPrivateDenial(removedParticipant.request, removedParticipant.context);
});

test("PDP denies every cross-tenant, cross-dossier, and cross-actor substitution identically", () => {
  const substitutions: Array<(fixture: ReturnType<typeof dossierFixture>) => void> = [
    (fixture) => {
      fixture.request.organizationId = ORG_B;
    },
    (fixture) => {
      fixture.context.session!.organizationId = ORG_B;
    },
    (fixture) => {
      fixture.context.organization!.id = ORG_B;
    },
    (fixture) => {
      fixture.context.membership!.organizationId = ORG_B;
    },
    (fixture) => {
      fixture.context.resource!.organizationId = ORG_B;
    },
    (fixture) => {
      fixture.context.dossier!.organizationId = ORG_B;
    },
    (fixture) => {
      fixture.context.participant!.organizationId = ORG_B;
    },
    (fixture) => {
      fixture.request.dossierId = DOSSIER_B;
    },
    (fixture) => {
      fixture.context.resource!.dossierId = DOSSIER_B;
    },
    (fixture) => {
      fixture.context.dossier!.id = DOSSIER_B;
    },
    (fixture) => {
      fixture.context.participant!.dossierId = DOSSIER_B;
    },
    (fixture) => {
      fixture.request.actorId = ACTOR_B;
    },
    (fixture) => {
      fixture.context.session!.actorId = ACTOR_B;
    },
    (fixture) => {
      fixture.context.membership!.actorId = ACTOR_B;
    },
    (fixture) => {
      fixture.context.participant!.actorId = ACTOR_B;
    },
  ];

  for (const substitute of substitutions) {
    const fixture = cloneFixture();
    substitute(fixture);
    assertPrivateDenial(fixture.request, fixture.context);
  }
});

test("PDP binds independent organization, membership, participant, policy, and resource versions", () => {
  const current = dossierFixture();
  assert.equal(
    decideTenantAuthorization(current.request, current.context).allowed,
    true,
  );
  assert.notEqual(
    current.request.expectedOrganizationAuthorizationVersion,
    current.request.expectedMembershipAuthorizationVersion,
  );
  assert.notEqual(
    current.request.expectedMembershipAuthorizationVersion,
    current.request.expectedParticipantAuthorizationVersion,
  );

  const mutations: Array<(fixture: ReturnType<typeof dossierFixture>) => void> = [
    (fixture) => {
      fixture.context.session!.status = "revoked";
    },
    (fixture) => {
      fixture.context.session!.expiresAtEpochSeconds = NOW;
    },
    (fixture) => {
      fixture.context.membership!.status = "suspended";
    },
    (fixture) => {
      fixture.context.participant!.status = "suspended";
    },
    (fixture) => {
      fixture.request.expectedOrganizationAuthorizationVersion = 6;
    },
    (fixture) => {
      fixture.context.session!.organizationAuthorizationVersion = 8;
    },
    (fixture) => {
      fixture.context.organization!.authorizationVersion = 8;
    },
    (fixture) => {
      fixture.request.expectedMembershipAuthorizationVersion = 4;
    },
    (fixture) => {
      fixture.context.session!.membershipAuthorizationVersion = 6;
    },
    (fixture) => {
      fixture.context.membership!.authorizationVersion = 6;
    },
    (fixture) => {
      fixture.request.expectedParticipantAuthorizationVersion = 2;
    },
    (fixture) => {
      fixture.context.participant!.authorizationVersion = 4;
    },
    (fixture) => {
      fixture.request.expectedPolicyRevision = 10;
    },
    (fixture) => {
      fixture.context.session!.policyRevision = 12;
    },
    (fixture) => {
      fixture.context.policy!.currentRevision = 12;
    },
    (fixture) => {
      fixture.context.policy!.status = "superseded";
    },
    (fixture) => {
      fixture.request.expectedResourceRevision = 10;
    },
    (fixture) => {
      fixture.context.resource!.currentRevision = 12;
    },
    (fixture) => {
      fixture.context.resource!.revision = 10;
    },
    (fixture) => {
      fixture.context.resource!.resourceDigest = "invalid";
    },
    (fixture) => {
      delete fixture.context.decisionReceiptBoundary;
    },
    (fixture) => {
      fixture.context.decisionReceiptBoundary!.authenticationMethod =
        "unknown" as unknown as "local_test";
    },
  ];
  for (const mutate of mutations) {
    const fixture = cloneFixture();
    mutate(fixture);
    assertPrivateDenial(fixture.request, fixture.context);
  }

  for (const status of ["provisioning", "suspended", "closed"] as const) {
    const fixture = cloneFixture();
    fixture.context.organization!.status = status;
    assertPrivateDenial(fixture.request, fixture.context);
  }
});

test("Entra-backed PDP sessions fail closed on disabled or advanced identity configuration", () => {
  const fixture = dossierFixture();
  fixture.context.session = {
    ...fixture.context.session!,
    authenticationMethod: "entra_oidc",
    identityConnectionId: "identity_connection_alpha_001",
    identityConfigurationVersion: 4,
  };
  fixture.request.expectedIdentityConfigurationVersion = 4;
  fixture.context.identityConnection = {
    id: "identity_connection_alpha_001",
    organizationId: ORG_A,
    enabled: true,
    configurationVersion: 4,
    currentConfigurationVersion: 4,
  };
  assert.equal(
    decideTenantAuthorization(fixture.request, fixture.context).allowed,
    true,
  );

  const disabled = structuredClone(fixture);
  disabled.context.identityConnection!.enabled = false;
  const disabledDecision = decideTenantAuthorization(
    disabled.request,
    disabled.context,
  );
  assert.equal(disabledDecision.allowed, false);
  if (disabledDecision.allowed) throw new Error("disabled connection allowed");
  assert.equal(disabledDecision.auditReason, "identity_connection_denied");

  const malformedEnabled = structuredClone(fixture);
  malformedEnabled.context.identityConnection!.enabled =
    "false" as unknown as boolean;
  assertPrivateDenial(malformedEnabled.request, malformedEnabled.context);

  const advanced = structuredClone(fixture);
  advanced.context.identityConnection!.currentConfigurationVersion = 5;
  const advancedDecision = decideTenantAuthorization(
    advanced.request,
    advanced.context,
  );
  assert.equal(advancedDecision.allowed, false);
  if (advancedDecision.allowed) throw new Error("stale connection allowed");
  assert.equal(advancedDecision.auditReason, "identity_connection_denied");
});

test("suspend and resume cannot revive a session bound to an older organization authorization version", () => {
  const suspended = transitionOrganizationLifecycle({
    status: "active",
    command: "suspend",
    requestedByActorId: ACTOR_A,
    approvedByActorId: ACTOR_B,
  });
  assert.equal(suspended.ok, true);
  if (!suspended.ok) throw new Error("synthetic suspension failed");
  const resumed = transitionOrganizationLifecycle({
    status: suspended.status,
    command: "resume",
    requestedByActorId: ACTOR_A,
    approvedByActorId: ACTOR_B,
  });
  assert.equal(resumed.ok, true);
  if (!resumed.ok) throw new Error("synthetic resume failed");

  const fixture = cloneFixture();
  fixture.context.organization!.status = resumed.status;
  fixture.context.organization!.authorizationVersion = 8;
  const decision = decideTenantAuthorization(fixture.request, fixture.context);
  assert.equal(decision.allowed, false);
  if (decision.allowed) throw new Error("stale session unexpectedly revived");
  assert.equal(decision.auditReason, "stale_authorization");
});

test("PDP is deny-by-default for unknown or mismatched request classes and scopes", () => {
  const classMismatch = cloneFixture();
  classMismatch.request.requestClass = "organization";
  assertPrivateDenial(classMismatch.request, classMismatch.context);

  const scopeMismatch = cloneFixture();
  scopeMismatch.request.scope = "organization";
  assertPrivateDenial(scopeMismatch.request, scopeMismatch.context);

  const malformed = cloneFixture();
  (malformed.request as unknown as { action: string }).action = "unregistered_action";
  assertPrivateDenial(malformed.request, malformed.context);

  for (const requestClass of ["__proto__", "toString", "unknown_request_class"]) {
    const unknownClass = cloneFixture();
    (unknownClass.request as unknown as { requestClass: string }).requestClass =
      requestClass;
    assertPrivateDenial(unknownClass.request, unknownClass.context);
  }

  for (const role of ["__proto__", "toString", "unknown_dossier_role"]) {
    const unknownDossierRole = cloneFixture();
    (unknownDossierRole.context.participant as unknown as { role: string }).role = role;
    assertPrivateDenial(unknownDossierRole.request, unknownDossierRole.context);
  }

  for (const role of ["__proto__", "toString", "unknown_organization_role"]) {
    const unknownOrganizationRole = cloneFixture();
    unknownOrganizationRole.request.requestClass = "organization";
    unknownOrganizationRole.request.scope = "organization";
    unknownOrganizationRole.request.action = "organization_read";
    delete unknownOrganizationRole.request.dossierId;
    unknownOrganizationRole.context.resource = {
      organizationId: ORG_A,
      revision: 11,
      currentRevision: 11,
      resourceDigest: RESOURCE_DIGEST,
    };
    delete unknownOrganizationRole.context.dossier;
    delete unknownOrganizationRole.context.participant;
    (unknownOrganizationRole.context.membership as unknown as { role: string }).role =
      role;
    assertPrivateDenial(unknownOrganizationRole.request, unknownOrganizationRole.context);
  }

  const identityRequest: AuthorizationRequest = {
    requestClass: "identity",
    scope: "identity",
    action: "oidc_callback",
    actorId: ACTOR_A,
  };
  assertPrivateDenial(identityRequest, { nowEpochSeconds: NOW });
  assert.equal(
    decideTenantAuthorization(identityRequest, {
      nowEpochSeconds: NOW,
      decisionReceiptBoundary: {
        requestCorrelationSha256: REQUEST_CORRELATION,
        deploymentSha: DEPLOYMENT_SHA,
        environment: "validation",
        authenticationMethod: "local_test",
      },
      identityBoundary: {
        verified: true,
        actorId: ACTOR_A,
        action: "oidc_callback",
      },
    }).allowed,
    true,
  );
});

function delegatedAdminFixture(): {
  request: AuthorizationRequest;
  context: AuthorizationContext;
} {
  const fixture = dossierFixture();
  const request: AuthorizationRequest = {
    requestClass: "security",
    scope: "organization",
    action: "member_invite",
    actorId: ACTOR_A,
    organizationId: ORG_A,
    expectedOrganizationAuthorizationVersion: 7,
    expectedMembershipAuthorizationVersion: 5,
    expectedPolicyRevision: 11,
    expectedResourceRevision: 11,
    submittedDelegatedGrant: { id: "grant_delegate_alpha_001", revision: 3 },
  };
  return {
    request,
    context: {
      ...fixture.context,
      membership: { ...fixture.context.membership!, role: "org_admin" },
      resource: {
        organizationId: ORG_A,
        revision: 11,
        currentRevision: 11,
        resourceDigest: RESOURCE_DIGEST,
      },
      delegatedGrant: {
        id: "grant_delegate_alpha_001",
        currentGrantId: "grant_delegate_alpha_001",
        revision: 3,
        currentRevision: 3,
        organizationId: ORG_A,
        actorId: ACTOR_A,
        action: "member_invite",
        status: "active",
        expiresAtEpochSeconds: NOW + 600,
        membershipAuthorizationVersion: 5,
        policyRevision: 11,
      },
    },
  };
}

test("org-admin delegation is exact and current while org-owner authority remains explicit", () => {
  const fixture = delegatedAdminFixture();
  assert.equal(decideTenantAuthorization(fixture.request, fixture.context).allowed, true);

  const staleMutations: Array<(copy: ReturnType<typeof delegatedAdminFixture>) => void> = [
    (copy) => delete copy.context.delegatedGrant,
    (copy) => {
      copy.context.delegatedGrant!.currentGrantId = "grant_superseding_alpha_2";
    },
    (copy) => {
      copy.context.delegatedGrant!.currentRevision = 4;
    },
    (copy) => {
      copy.context.delegatedGrant!.status = "revoked";
    },
    (copy) => {
      copy.context.delegatedGrant!.organizationId = ORG_B;
    },
    (copy) => {
      copy.context.delegatedGrant!.actorId = ACTOR_B;
    },
    (copy) => {
      copy.context.delegatedGrant!.expiresAtEpochSeconds = NOW;
    },
    (copy) => {
      copy.request.submittedDelegatedGrant!.revision = 2;
    },
  ];
  for (const mutate of staleMutations) {
    const copy = structuredClone(fixture);
    mutate(copy);
    assertPrivateDenial(copy.request, copy.context);
  }

  const owner = structuredClone(fixture);
  owner.context.membership!.role = "org_owner";
  delete owner.context.delegatedGrant;
  delete owner.request.submittedDelegatedGrant;
  assert.equal(decideTenantAuthorization(owner.request, owner.context).allowed, true);
});

function rawValidationTenantManifest(): TenantResourceManifest {
  const verifiedAt = new Date((NOW - 60) * 1000).toISOString();
  const expiresAt = new Date((NOW + 600) * 1000).toISOString();
  const processingComponents = Object.fromEntries(
    TENANT_RESOURCE_COMPONENTS.map((name, index) => [
      name,
      {
        binding_id: `binding_${name}_phase_b_0001`,
        jurisdiction: "eu" as const,
        receipt_sha256: (index % 10).toString().repeat(64),
        verified_at: verifiedAt,
        expires_at: expiresAt,
      },
    ]),
  ) as TenantResourceManifest["processing_components"];
  return {
    manifest_version: TENANT_RESOURCE_MANIFEST_VERSION,
    organization_id: ORG_A,
    environment: "validation",
    hostname: "phase-b.validation.example",
    d1: { id: "d1_phase_b_validation_0001", jurisdiction: "eu" },
    r2: {
      quarantine: {
        id: "r2_quarantine_phase_b_001",
        jurisdiction: "eu",
        namespace: "quarantine",
        access_binding_alias: "quarantine/phase-b-alpha",
      },
      clean: {
        id: "r2_clean_phase_b_0000001",
        jurisdiction: "eu",
        namespace: "clean",
        access_binding_alias: "clean/phase-b-alpha",
      },
      extracted_text: {
        id: "r2_extracted_phase_b_001",
        jurisdiction: "eu",
        namespace: "extracted_text",
        access_binding_alias: "extracted-text/phase-b-alpha",
      },
      exports: {
        id: "r2_exports_phase_b_00001",
        jurisdiction: "eu",
        namespace: "exports",
        access_binding_alias: "exports/phase-b-alpha",
      },
      backups: {
        id: "r2_backups_phase_b_00001",
        jurisdiction: "eu",
        namespace: "backups",
        access_binding_alias: "backups/phase-b-alpha",
      },
    },
    jurisdiction: "eu",
    encryption_key_aliases: {
      live_data: "live/phase-b-alpha/data",
      exports: "export/phase-b-alpha/exports",
      backups: "backup/phase-b-alpha/backups",
      restore: "restore/phase-b-alpha/restore",
    },
    processing_components: processingComponents,
    schema_version: "v16",
    deployment_sha: DEPLOYMENT_SHA,
    activation: "validation",
    verification: {
      receipt_sha256: "f".repeat(64),
      verified_at: verifiedAt,
      expires_at: expiresAt,
    },
  };
}

async function verifiedValidationTenantManifest() {
  const manifest = rawValidationTenantManifest();
  const verified = await verifyTenantResourceManifest({
    manifest,
    expectedOrganizationId: ORG_A,
    expectedDeploymentSha: DEPLOYMENT_SHA,
    expectedCanonicalManifestSha256: await sha256Hex(canonicalJson(manifest)),
    schemaValidationReceiptSha256: "9".repeat(64),
    manifestRevision: 3,
    currentManifestRevision: 3,
    nowEpochSeconds: NOW,
  });
  assert.ok(verified);
  return verified;
}

async function rawApprovedTenantManifest(): Promise<TenantResourceManifest> {
  const manifest = rawValidationTenantManifest();
  manifest.environment = "production";
  manifest.hostname = "phase-b.production.example";
  manifest.activation = "approved";
  for (const [index, name] of TENANT_RESOURCE_COMPONENTS.entries()) {
    manifest.processing_components[name].receipt_sha256 = (index + 1)
      .toString(16)
      .padStart(64, "0");
  }
  const coveredReceipts = Object.fromEntries([
    ["manifest_verification", manifest.verification.receipt_sha256],
    ...TENANT_RESOURCE_COMPONENTS.map((name) => [
      name,
      manifest.processing_components[name].receipt_sha256,
    ]),
  ]) as NonNullable<
    TenantResourceManifest["activation_validation"]
  >["covered_receipts"];
  manifest.activation_validation = {
    validator_version: "tenant-activation-validator.v1",
    evaluated_at: new Date((NOW - 30) * 1000).toISOString(),
    valid_until: manifest.verification.expires_at,
    covered_receipts: coveredReceipts,
    receipt_set_sha256: await sha256Hex(canonicalJson(coveredReceipts)),
    validation_receipt_sha256: "e".repeat(64),
    status: "current",
  };
  return manifest;
}

function forgedTenantManifestCopy(
  value: VerifiedTenantResourceManifest,
): VerifiedTenantResourceManifest {
  return structuredClone(value) as unknown as VerifiedTenantResourceManifest;
}

test("frozen tenant manifests fail closed on extra fields, stale evidence, digest, deployment, or revision drift", async () => {
  const valid = rawValidationTenantManifest();
  const digest = await sha256Hex(canonicalJson(valid));
  const verify = (manifest: unknown, overrides = {}) =>
    verifyTenantResourceManifest({
      manifest,
      expectedOrganizationId: ORG_A,
      expectedDeploymentSha: DEPLOYMENT_SHA,
      expectedCanonicalManifestSha256: digest,
      schemaValidationReceiptSha256: "9".repeat(64),
      manifestRevision: 3,
      currentManifestRevision: 3,
      nowEpochSeconds: NOW,
      ...overrides,
    });
  assert.ok(await verify(valid));
  const mutableDuringVerification = structuredClone(valid);
  const snapshotVerification = verifyTenantResourceManifest({
    manifest: mutableDuringVerification,
    expectedOrganizationId: ORG_A,
    expectedDeploymentSha: DEPLOYMENT_SHA,
    expectedCanonicalManifestSha256: digest,
    schemaValidationReceiptSha256: "9".repeat(64),
    manifestRevision: 3,
    currentManifestRevision: 3,
    nowEpochSeconds: NOW,
  });
  mutableDuringVerification.organization_id = ORG_B;
  mutableDuringVerification.verification.expires_at = "invalid-after-call";
  const snapshotVerified = await snapshotVerification;
  assert.ok(snapshotVerified);
  assert.equal(snapshotVerified.manifest.organization_id, ORG_A);
  assert.equal(Number.isFinite(snapshotVerified.validUntilEpochSeconds), true);
  assert.equal(await verify({ ...valid, unexpected: true }), undefined);
  assert.equal(
    await verify(valid, { expectedCanonicalManifestSha256: MANIFEST_B }),
    undefined,
  );
  assert.equal(await verify(valid, { currentManifestRevision: 4 }), undefined);
  assert.equal(
    await verify(valid, { expectedDeploymentSha: "0".repeat(40) }),
    undefined,
  );
  for (const [namespace, accessBindingAlias] of [
    ["quarantine", "quarantine/"],
    ["clean", "clean/ab"],
    ["exports", `exports/${"x".repeat(149)}`],
  ] as const) {
    const malformedAlias = structuredClone(valid);
    malformedAlias.r2[namespace].access_binding_alias = accessBindingAlias;
    assert.equal(
      await verify(malformedAlias, {
        expectedCanonicalManifestSha256: await sha256Hex(
          canonicalJson(malformedAlias),
        ),
      }),
      undefined,
    );
  }
  const stale = structuredClone(valid);
  stale.processing_components.kms.expires_at = new Date((NOW - 1) * 1000).toISOString();
  assert.equal(await verify(stale), undefined);

  const genuine = await verifiedValidationTenantManifest();
  const forged = forgedTenantManifestCopy(genuine);
  const fixture = dossierFixture();
  fixture.request.action = "document_read";
  fixture.request.dataClassification = "synthetic";
  fixture.request.expectedTenantManifestRevision = genuine.manifestRevision;
  fixture.context.organization!.confidentialDocumentMode = "validation";
  fixture.context.tenantManifest = forged;
  assertPrivateDenial(fixture.request, fixture.context);
});

test("approved manifests require exact component coverage and canonical receipt-set evidence", async () => {
  const verify = async (manifest: TenantResourceManifest) =>
    verifyTenantResourceManifest({
      manifest,
      expectedOrganizationId: ORG_A,
      expectedDeploymentSha: DEPLOYMENT_SHA,
      expectedCanonicalManifestSha256: await sha256Hex(canonicalJson(manifest)),
      schemaValidationReceiptSha256: "9".repeat(64),
      manifestRevision: 4,
      currentManifestRevision: 4,
      nowEpochSeconds: NOW,
    });
  const valid = await rawApprovedTenantManifest();
  assert.ok(await verify(valid));

  const wrongComponent = structuredClone(valid);
  wrongComponent.activation_validation!.covered_receipts.ocr = "a".repeat(64);
  wrongComponent.activation_validation!.receipt_set_sha256 = await sha256Hex(
    canonicalJson(wrongComponent.activation_validation!.covered_receipts),
  );
  assert.equal(await verify(wrongComponent), undefined);

  const wrongSetDigest = structuredClone(valid);
  wrongSetDigest.activation_validation!.receipt_set_sha256 = "b".repeat(64);
  assert.equal(await verify(wrongSetDigest), undefined);

  const nonEarliestExpiry = structuredClone(valid);
  nonEarliestExpiry.activation_validation!.valid_until = new Date(
    (NOW + 599) * 1000,
  ).toISOString();
  assert.equal(await verify(nonEarliestExpiry), undefined);

  const duplicateCoverage = structuredClone(valid);
  duplicateCoverage.activation_validation!.covered_receipts.ocr =
    duplicateCoverage.activation_validation!.covered_receipts.extraction;
  duplicateCoverage.processing_components.ocr.receipt_sha256 =
    duplicateCoverage.processing_components.extraction.receipt_sha256;
  duplicateCoverage.activation_validation!.receipt_set_sha256 = await sha256Hex(
    canonicalJson(duplicateCoverage.activation_validation!.covered_receipts),
  );
  assert.equal(await verify(duplicateCoverage), undefined);
});

async function complianceFixture(): Promise<{
  request: AuthorizationRequest;
  context: AuthorizationContext;
}> {
  const base = dossierFixture();
  const dossierIds = [DOSSIER_A, DOSSIER_B];
  const tenantManifest = await verifiedValidationTenantManifest();
  return {
    request: {
      requestClass: "compliance_export",
      scope: "organization",
      action: "tenant_export_request",
      actorId: ACTOR_A,
      organizationId: ORG_A,
      expectedOrganizationAuthorizationVersion: 7,
      expectedMembershipAuthorizationVersion: 5,
      expectedPolicyRevision: 11,
      expectedResourceRevision: 11,
      expectedTenantManifestRevision: 3,
      dataClassification: "synthetic",
      submittedComplianceAuthority: {
        grantId: "grant_compliance_alpha_001",
        grantRevision: 5,
        exportRequestId: "export_request_alpha_001",
        manifestDigest: tenantManifest.canonicalManifestSha256,
        dossierIds,
      },
    },
    context: {
      ...base.context,
      organization: {
        id: ORG_A,
        status: "active",
        confidentialDocumentMode: "validation",
        authorizationVersion: 7,
      },
      membership: { ...base.context.membership!, role: "org_owner" },
      resource: {
        organizationId: ORG_A,
        revision: 11,
        currentRevision: 11,
        resourceDigest: RESOURCE_DIGEST,
      },
      tenantManifest,
      complianceAuthority: {
        grantId: "grant_compliance_alpha_001",
        currentGrantId: "grant_compliance_alpha_001",
        grantRevision: 5,
        currentGrantRevision: 5,
        organizationId: ORG_A,
        actorId: ACTOR_A,
        status: "active",
        expiresAtEpochSeconds: NOW + 600,
        membershipAuthorizationVersion: 5,
        policyRevision: 11,
        exportRequest: {
          id: "export_request_alpha_001",
          organizationId: ORG_A,
          manifestDigest: tenantManifest.canonicalManifestSha256,
          requestReceiptSha256: "5".repeat(64),
          currentRequestReceiptSha256: "5".repeat(64),
          requestedByActorId: ACTOR_A,
          expiresAtEpochSeconds: NOW + 300,
          state: "approved",
          stateAuthorizationVersion: 2,
          currentStateAuthorizationVersion: 2,
          dossierIds,
          ownerApprovals: [
            {
              dossierId: DOSSIER_A,
              exportRequestId: "export_request_alpha_001",
              approvalVersion: DOSSIER_EXPORT_APPROVAL_VERSION,
              approvalReceiptId: "receipt_alpha_dossier_0001",
              approvalReceiptSha256: "3".repeat(64),
              currentApprovalReceiptSha256: "3".repeat(64),
              requestReceiptSha256: "5".repeat(64),
              organizationId: ORG_A,
              approvedByActorId: "owner_alpha_dossier_0001",
              currentOwnerActorId: "owner_alpha_dossier_0001",
              ownerMembershipAuthorizationVersion: 1,
              currentOwnerMembershipAuthorizationVersion: 1,
              dossierManifestSha256: "1".repeat(64),
              currentDossierManifestSha256: "1".repeat(64),
              policyRevision: 11,
              expiresAtEpochSeconds: NOW + 300,
              status: "active",
            },
            {
              dossierId: DOSSIER_B,
              exportRequestId: "export_request_alpha_001",
              approvalVersion: DOSSIER_EXPORT_APPROVAL_VERSION,
              approvalReceiptId: "receipt_bravo_dossier_0002",
              approvalReceiptSha256: "4".repeat(64),
              currentApprovalReceiptSha256: "4".repeat(64),
              requestReceiptSha256: "5".repeat(64),
              organizationId: ORG_A,
              approvedByActorId: "owner_bravo_dossier_0002",
              currentOwnerActorId: "owner_bravo_dossier_0002",
              ownerMembershipAuthorizationVersion: 1,
              currentOwnerMembershipAuthorizationVersion: 1,
              dossierManifestSha256: "2".repeat(64),
              currentDossierManifestSha256: "2".repeat(64),
              policyRevision: 11,
              expiresAtEpochSeconds: NOW + 300,
              status: "active",
            },
          ],
        },
      },
    },
  };
}

test("tenant export requires a current compliance grant, exact manifest, and every current owner approval", async () => {
  const fixture = await complianceFixture();
  assert.equal(decideTenantAuthorization(fixture.request, fixture.context).allowed, true);

  const mutations: Array<
    (copy: Awaited<ReturnType<typeof complianceFixture>>) => void
  > = [
    (copy) => {
      copy.context.complianceAuthority!.currentGrantId = "grant_newer_compliance_2";
    },
    (copy) => {
      copy.context.complianceAuthority!.currentGrantRevision = 6;
    },
    (copy) => {
      copy.context.complianceAuthority!.status = "revoked";
    },
    (copy) => {
      copy.context.complianceAuthority!.membershipAuthorizationVersion = 4;
    },
    (copy) => {
      copy.context.complianceAuthority!.policyRevision = 10;
    },
    (copy) => {
      copy.context.complianceAuthority!.organizationId = ORG_B;
    },
    (copy) => {
      copy.request.submittedComplianceAuthority!.manifestDigest = MANIFEST_B;
    },
    (copy) => {
      copy.context.complianceAuthority!.exportRequest.ownerApprovals =
        copy.context.complianceAuthority!.exportRequest.ownerApprovals.slice(0, -1);
    },
    (copy) => {
      copy.context.complianceAuthority!.exportRequest.ownerApprovals[0].currentOwnerActorId =
        ACTOR_B;
    },
    (copy) => {
      copy.context.complianceAuthority!.exportRequest.ownerApprovals[0].status = "superseded";
    },
    (copy) => {
      copy.context.complianceAuthority!.exportRequest.state = "consumed";
    },
    (copy) => {
      copy.context.complianceAuthority!.exportRequest.currentStateAuthorizationVersion = 3;
    },
    (copy) => {
      copy.context.complianceAuthority!.exportRequest.expiresAtEpochSeconds = NOW;
    },
    (copy) => {
      copy.context.complianceAuthority!.exportRequest.currentRequestReceiptSha256 =
        "9".repeat(64);
    },
    (copy) => {
      copy.context.complianceAuthority!.exportRequest.ownerApprovals[0].exportRequestId =
        "export_request_other_0001";
    },
    (copy) => {
      copy.context.complianceAuthority!.exportRequest.ownerApprovals[0].requestReceiptSha256 =
        "9".repeat(64);
    },
    (copy) => {
      copy.context.complianceAuthority!.exportRequest.ownerApprovals[0].approvalReceiptSha256 =
        "9".repeat(64);
    },
    (copy) => {
      copy.context.complianceAuthority!.exportRequest.ownerApprovals[0].ownerMembershipAuthorizationVersion =
        2;
    },
    (copy) => {
      copy.context.complianceAuthority!.exportRequest.ownerApprovals[0].policyRevision =
        10;
    },
    (copy) => {
      copy.context.complianceAuthority!.exportRequest.ownerApprovals[0].expiresAtEpochSeconds =
        NOW;
    },
    (copy) => {
      copy.request.submittedComplianceAuthority!.dossierIds = [DOSSIER_A, DOSSIER_A];
    },
    (copy) => {
      (
        copy.request.submittedComplianceAuthority as unknown as {
          dossierIds: unknown;
        }
      ).dossierIds = null;
    },
    (copy) => {
      (
        copy.context.complianceAuthority!.exportRequest as unknown as {
          ownerApprovals: unknown;
        }
      ).ownerApprovals = [null];
    },
    (copy) => {
      const [approval, ...remainingApprovals] =
        copy.context.complianceAuthority!.exportRequest.ownerApprovals;
      assert.ok(approval);
      copy.context.complianceAuthority!.exportRequest.ownerApprovals = [
        approval,
        structuredClone(approval),
        ...remainingApprovals,
      ];
    },
    (copy) => {
      const sparseSubmittedDossiers: string[] = [];
      sparseSubmittedDossiers.length = 1;
      const sparseAuthorityDossiers: string[] = [];
      sparseAuthorityDossiers.length = 1;
      const sparseOwnerApprovals =
        copy.context.complianceAuthority!.exportRequest.ownerApprovals.slice(0, 0);
      sparseOwnerApprovals.length = 1;
      copy.request.submittedComplianceAuthority!.dossierIds =
        sparseSubmittedDossiers;
      copy.context.complianceAuthority!.exportRequest.dossierIds =
        sparseAuthorityDossiers;
      copy.context.complianceAuthority!.exportRequest.ownerApprovals =
        sparseOwnerApprovals;
    },
  ];
  for (const mutate of mutations) {
    const copy = structuredClone(fixture);
    copy.context.tenantManifest = fixture.context.tenantManifest;
    mutate(copy);
    assertPrivateDenial(copy.request, copy.context);
  }
});

test("tenant export binds the requester to the authenticated compliance actor before owner separation", async () => {
  const fixture = await complianceFixture();
  fixture.context.complianceAuthority!.exportRequest.requestedByActorId = ACTOR_B;
  fixture.context.complianceAuthority!.exportRequest.ownerApprovals =
    fixture.context.complianceAuthority!.exportRequest.ownerApprovals.map(
      (approval, index) =>
        index === 0
          ? {
              ...approval,
              approvedByActorId: ACTOR_A,
              currentOwnerActorId: ACTOR_A,
            }
          : approval,
    );

  assertPrivateDenial(fixture.request, fixture.context);

  const malformed = await complianceFixture();
  malformed.context.complianceAuthority!.exportRequest.requestedByActorId = "";
  assertPrivateDenial(malformed.request, malformed.context);
});

test("tenant export acquisition consumes one exact approved request state", async () => {
  const store = new InMemoryExportAcquisitionStore(() => NOW);
  const exportRequestId = "export_request_alpha_atomic_001";
  store.seed({
    organizationId: ORG_A,
    exportRequestId,
    version: 4,
    status: "approved",
    expiresAtEpochSeconds: NOW + 300,
  });
  const input = {
    organizationId: ORG_A,
    exportRequestId,
    expectedVersion: 4,
  };
  const results = await Promise.all(
    Array.from({ length: 16 }, () => store.acquire(input)),
  );
  assert.equal(results.filter(Boolean).length, 1);
  assert.deepEqual(store.inspectForTest(ORG_A, exportRequestId), {
    organizationId: ORG_A,
    exportRequestId,
    version: 5,
    status: "consumed",
    expiresAtEpochSeconds: NOW + 300,
  });
  assert.equal(await store.acquire(input), false);
  assert.equal(
    await store.acquire({ ...input, organizationId: ORG_B }),
    false,
  );

  for (const status of ["rejected", "expired", "consumed"] as const) {
    const denied = new InMemoryExportAcquisitionStore(() => NOW);
    const deniedRequestId = `export_request_${status}_alpha_001`;
    denied.seed({
      organizationId: ORG_A,
      exportRequestId: deniedRequestId,
      version: 1,
      status,
      expiresAtEpochSeconds: NOW + 300,
    });
    assert.equal(
      await denied.acquire({
        ...input,
        exportRequestId: deniedRequestId,
        expectedVersion: 1,
      }),
      false,
    );
  }
  const expired = new InMemoryExportAcquisitionStore(() => NOW);
  expired.seed({
    organizationId: ORG_A,
    exportRequestId: "export_request_expired_now_001",
    version: 1,
    status: "approved",
    expiresAtEpochSeconds: NOW,
  });
  assert.equal(
    await expired.acquire({
      ...input,
      exportRequestId: "export_request_expired_now_001",
      expectedVersion: 1,
    }),
    false,
  );
});

function policyActivationInput() {
  return {
    organizationId: ORG_A,
    expectedCurrentPolicyRevision: 11,
    expectedCurrentPointerVersion: 4,
    targetPolicyRevision: 12,
    targetPolicyReceiptSha256: "6".repeat(64),
    authenticatedApproverActorId: ACTOR_A,
    approval: {
      approvalVersion: POLICY_ACTIVATION_APPROVAL_VERSION,
      requestId: "policy_activation_request_001",
      currentRequestId: "policy_activation_request_001",
      requestRevision: 2,
      currentRequestRevision: 2,
      organizationId: ORG_A,
      expectedCurrentPolicyRevision: 11,
      expectedCurrentPointerVersion: 4,
      targetPolicyRevision: 12,
      targetPolicyReceiptSha256: "6".repeat(64),
      requestedByActorId: ACTOR_B,
      approvedByActorId: ACTOR_A,
      approverRole: "org_admin" as const,
      approverMembershipAuthorizationVersion: 5,
      currentApproverMembershipAuthorizationVersion: 5,
      approvalReceiptId: "policy_activation_receipt_001",
      approvalReceiptSha256: "7".repeat(64),
      currentApprovalReceiptSha256: "7".repeat(64),
      expiresAtEpochSeconds: NOW + 300,
      status: "approved" as const,
    },
  };
}

test("policy activation is a separate approval-bound, one-time operation", async () => {
  const store = new InMemoryPolicyActivationStore(() => NOW);
  store.seed(ORG_A, 11, 4);
  const input = policyActivationInput();
  const results = await Promise.all([store.activate(input), store.activate(input)]);
  assert.equal(results.filter(Boolean).length, 1);
  assert.deepEqual(store.inspectForTest(ORG_A), {
    organizationId: ORG_A,
    policyRevision: 12,
    pointerVersion: 5,
  });

  const mutations: Array<(copy: ReturnType<typeof policyActivationInput>) => void> = [
    (copy) => {
      copy.approval.requestedByActorId = ACTOR_A;
    },
    (copy) => {
      copy.approval.currentRequestRevision = 3;
    },
    (copy) => {
      copy.approval.organizationId = ORG_B;
    },
    (copy) => {
      copy.approval.targetPolicyReceiptSha256 = "8".repeat(64);
    },
    (copy) => {
      copy.approval.currentApproverMembershipAuthorizationVersion = 6;
    },
    (copy) => {
      copy.approval.currentApprovalReceiptSha256 = "9".repeat(64);
    },
    (copy) => {
      copy.approval.expiresAtEpochSeconds = NOW;
    },
    (copy) => {
      copy.expectedCurrentPointerVersion = 3;
    },
  ];
  for (const mutate of mutations) {
    const denied = new InMemoryPolicyActivationStore(() => NOW);
    denied.seed(ORG_A, 11, 4);
    const copy = structuredClone(input);
    mutate(copy);
    assert.equal(await denied.activate(copy), false);
    assert.deepEqual(denied.inspectForTest(ORG_A), {
      organizationId: ORG_A,
      policyRevision: 11,
      pointerVersion: 4,
    });
  }
});

function legalHoldApprovalFixture(): {
  request: AuthorizationRequest;
  context: AuthorizationContext;
} {
  const fixture = dossierFixture();
  return {
    request: {
      ...fixture.request,
      requestClass: "security",
      action: "legal_hold_release_approve",
      submittedSecurityApproval: {
        requestId: "hold_release_request_alpha_1",
        revision: 2,
      },
    },
    context: {
      ...fixture.context,
      membership: { ...fixture.context.membership!, role: "org_admin" },
      participant: { ...fixture.context.participant!, role: "reviewer" },
      securityApproval: {
        requestId: "hold_release_request_alpha_1",
        currentRequestId: "hold_release_request_alpha_1",
        revision: 2,
        currentRevision: 2,
        organizationId: ORG_A,
        targetDossierId: DOSSIER_A,
        action: "legal_hold_release_approve",
        requestAction: "legal_hold_release_request",
        requestedByActorId: ACTOR_B,
        approvedByActorId: ACTOR_A,
        approverBasis: "dossier_reviewer",
        targetObjectGraphSha256: RESOURCE_DIGEST,
        requestRecordBindingReceiptSha256: "2".repeat(64),
        approvalSessionBindingSha256: "3".repeat(64),
        separationOfDutiesReceiptSha256: "4".repeat(64),
        approvalMembershipAuthorizationVersion: 5,
        currentApprovalMembershipAuthorizationVersion: 5,
        policyRevision: 11,
        approvalReceiptId: "hold_approval_receipt_alpha_1",
        approvalReceiptSha256: "5".repeat(64),
        currentApprovalReceiptSha256: "5".repeat(64),
        expiresAtEpochSeconds: NOW + 300,
        status: "approved",
      },
    },
  };
}

test("security approval is scoped, current, independently approved, and never grants ambient dossier access", () => {
  const fixture = legalHoldApprovalFixture();
  assert.equal(decideTenantAuthorization(fixture.request, fixture.context).allowed, true);

  const organizationAdminApproval = structuredClone(fixture);
  organizationAdminApproval.request.scope = "organization";
  delete organizationAdminApproval.request.dossierId;
  organizationAdminApproval.context.resource = {
    organizationId: ORG_A,
    dossierId: DOSSIER_A,
    revision: 11,
    currentRevision: 11,
    resourceDigest: RESOURCE_DIGEST,
  };
  delete organizationAdminApproval.context.dossier;
  delete organizationAdminApproval.context.participant;
  organizationAdminApproval.context.securityApproval!.approverBasis =
    "organization_admin";
  assert.equal(
    decideTenantAuthorization(
      organizationAdminApproval.request,
      organizationAdminApproval.context,
    ).allowed,
    true,
  );
  assert.equal(
    decideTenantAuthorization(
      organizationAdminApproval.request,
      organizationAdminApproval.context,
    ).receipt.dossierId,
    null,
  );
  assert.equal(
    decideTenantAuthorization(
      organizationAdminApproval.request,
      organizationAdminApproval.context,
    ).receipt.targetDossierId,
    DOSSIER_A,
  );
  const wrongOrganizationScopeTarget = structuredClone(organizationAdminApproval);
  wrongOrganizationScopeTarget.context.resource!.dossierId = DOSSIER_B;
  assertPrivateDenial(
    wrongOrganizationScopeTarget.request,
    wrongOrganizationScopeTarget.context,
  );
  organizationAdminApproval.context.membership!.role = "org_owner";
  assertPrivateDenial(
    organizationAdminApproval.request,
    organizationAdminApproval.context,
  );

  const mutations: Array<(copy: ReturnType<typeof legalHoldApprovalFixture>) => void> = [
    (copy) => delete copy.context.participant,
    (copy) => {
      copy.context.securityApproval!.requestedByActorId = ACTOR_A;
    },
    (copy) => {
      copy.context.securityApproval!.requestedByActorId = "";
    },
    (copy) => {
      copy.context.securityApproval!.currentRequestId = "hold_release_request_newer_2";
    },
    (copy) => {
      copy.context.securityApproval!.currentRevision = 3;
    },
    (copy) => {
      copy.context.securityApproval!.organizationId = ORG_B;
    },
    (copy) => {
      copy.context.securityApproval!.targetDossierId = DOSSIER_B;
    },
    (copy) => {
      copy.context.securityApproval!.status = "revoked";
    },
    (copy) => {
      copy.context.securityApproval!.approverBasis = "organization_admin";
    },
    (copy) => {
      copy.context.securityApproval!.requestAction = "legal_hold_create_request";
    },
    (copy) => {
      copy.context.securityApproval!.approvalSessionBindingSha256 = "invalid";
    },
    (copy) => {
      copy.context.securityApproval!.approvalMembershipAuthorizationVersion = 4;
    },
    (copy) => {
      copy.context.securityApproval!.policyRevision = 10;
    },
    (copy) => {
      copy.context.securityApproval!.approvalReceiptSha256 = "9".repeat(64);
    },
    (copy) => {
      copy.context.securityApproval!.expiresAtEpochSeconds = NOW;
    },
    (copy) => {
      copy.context.securityApproval!.targetObjectGraphSha256 = "1".repeat(64);
    },
  ];
  for (const mutate of mutations) {
    const copy = structuredClone(fixture);
    mutate(copy);
    assertPrivateDenial(copy.request, copy.context);
  }
});

async function documentFixture(action: "document_upload" | "document_read") {
  const fixture = dossierFixture();
  fixture.request.action = action;
  fixture.request.dataClassification = "synthetic";
  fixture.request.expectedTenantManifestRevision = 3;
  fixture.context.participant!.role = action === "document_upload" ? "contributor" : "viewer";
  fixture.context.organization!.confidentialDocumentMode = "validation";
  fixture.context.tenantManifest = await verifiedValidationTenantManifest();
  return fixture;
}

test("Phase B keeps document ingestion disabled while safe existing-data reads require a verified validation manifest", async () => {
  assert.equal(isUploadClassificationPermitted("disabled", "synthetic"), false);
  assert.equal(isUploadClassificationPermitted("validation", "synthetic"), false);
  assert.equal(isUploadClassificationPermitted("validation", "deidentified"), false);
  assert.equal(isUploadClassificationPermitted("validation", "confidential"), false);

  const syntheticUpload = await documentFixture("document_upload");
  assert.equal(
    decideTenantAuthorization(syntheticUpload.request, syntheticUpload.context).allowed,
    false,
  );

  for (const classification of ["confidential"] as const) {
    const copy = await documentFixture("document_upload");
    copy.request.dataClassification = classification;
    assertPrivateDenial(copy.request, copy.context);
  }

  const deidentifiedRead = await documentFixture("document_read");
  deidentifiedRead.request.dataClassification = "deidentified";
  assert.equal(
    decideTenantAuthorization(deidentifiedRead.request, deidentifiedRead.context).allowed,
    true,
  );
  const manifestMutations: Array<
    (copy: Awaited<ReturnType<typeof documentFixture>>) => void
  > = [
    (copy) => delete copy.context.tenantManifest,
    (copy) => {
      const forged = forgedTenantManifestCopy(copy.context.tenantManifest!);
      forged.manifest.organization_id = ORG_B;
      copy.context.tenantManifest = forged;
    },
    (copy) => {
      const forged = forgedTenantManifestCopy(copy.context.tenantManifest!);
      forged.currentManifestRevision = 4;
      copy.context.tenantManifest = forged;
    },
    (copy) => {
      const forged = forgedTenantManifestCopy(copy.context.tenantManifest!);
      forged.validUntilEpochSeconds = NOW;
      copy.context.tenantManifest = forged;
    },
    (copy) => {
      const forged = forgedTenantManifestCopy(copy.context.tenantManifest!);
      forged.manifest.activation = "suspended";
      copy.context.tenantManifest = forged;
    },
    (copy) => {
      copy.context.organization!.confidentialDocumentMode = "disabled";
    },
  ];
  for (const mutate of manifestMutations) {
    const copy = await documentFixture("document_read");
    mutate(copy);
    assertPrivateDenial(copy.request, copy.context);
  }
});

test("organization lifecycle stays within the frozen status vocabulary and sensitive transitions require separation", () => {
  assert.deepEqual(ORGANIZATION_STATUSES, [
    "provisioning",
    "active",
    "suspended",
    "closed",
  ]);
  assert.deepEqual(
    transitionOrganizationLifecycle({
      status: "provisioning",
      command: "activate",
      requestedByActorId: ACTOR_A,
    }),
    {
      ok: true,
      previousStatus: "provisioning",
      status: "active",
      event: "activated",
    },
  );
  assert.deepEqual(
    transitionOrganizationLifecycle({
      status: "active",
      command: "suspend",
      requestedByActorId: ACTOR_A,
    }),
    { ok: false, code: "separation_of_duties_required" },
  );
  assert.deepEqual(
    transitionOrganizationLifecycle({
      status: "active",
      command: "close",
      requestedByActorId: ACTOR_A,
      approvedByActorId: ACTOR_B,
    }),
    {
      ok: true,
      previousStatus: "active",
      status: "closed",
      event: "closed",
    },
  );
  assert.deepEqual(
    transitionOrganizationLifecycle({
      status: "closed",
      command: "resume",
      requestedByActorId: ACTOR_A,
      approvedByActorId: ACTOR_B,
    }),
    { ok: false, code: "invalid_transition" },
  );
});

function deterministicRandom() {
  let call = 1;
  return (length: number): Uint8Array => {
    const bytes = new Uint8Array(length);
    for (let index = 0; index < length; index += 1) {
      bytes[index] = (index * 29 + call * 47) % 256;
    }
    call += 1;
    return bytes;
  };
}

async function newInvitation(now = NOW): Promise<{
  secretToken: string;
  record: InvitationRecord;
}> {
  return createDigestOnlyInvitation(
    {
      organizationId: ORG_A,
      intendedIdentityKey: "https://issuer.example\u001ftenant-a\u001fsubject-a",
      exactOrigin: "https://preview.example.test",
      organizationRole: "member",
      dossierAssignment: { dossierId: DOSSIER_A, role: "viewer" },
      nowEpochSeconds: now,
      expiresAtEpochSeconds: now + 300,
    },
    deterministicRandom(),
  );
}

test("invitations persist only a high-entropy digest and are exact-identity, exact-origin, single-use", async () => {
  const invitation = await newInvitation();
  assert.ok(invitation.secretToken.length >= 43);
  assert.match(invitation.record.tokenDigest, /^[a-f0-9]{64}$/u);
  assert.equal(invitation.record.tokenDigest, await sha256Hex(invitation.secretToken));
  assert.equal(JSON.stringify(invitation.record).includes(invitation.secretToken), false);
  assert.equal("secretToken" in invitation.record, false);

  const store = new InMemoryInvitationStore(() => NOW + 1);
  store.insert(invitation.record);
  const input = {
    invitationId: invitation.record.id,
    secretToken: invitation.secretToken,
    authenticatedIdentityKey: invitation.record.intendedIdentityKey,
    exactOrigin: invitation.record.exactOrigin,
  };
  const simultaneous = await Promise.all([store.accept(input), store.accept(input)]);
  assert.equal(simultaneous.filter((result) => result.accepted).length, 1);
  assert.deepEqual(await store.accept(input), {
    accepted: false,
    code: "invitation_unavailable",
  });
  assert.equal(store.inspectForTest(invitation.record.id)?.status, "accepted");
});

test("invitation creation snapshots authority before asynchronous hashing", async () => {
  const input = {
    organizationId: ORG_A,
    intendedIdentityKey: "https://issuer.example\u001ftenant-a\u001fsubject-a",
    exactOrigin: "https://preview.example.test",
    organizationRole: "member" as const,
    dossierAssignment: { dossierId: DOSSIER_A, role: "viewer" as const },
    nowEpochSeconds: NOW,
    expiresAtEpochSeconds: NOW + 300,
  };
  const pending = createDigestOnlyInvitation(input, deterministicRandom());
  input.organizationId = ORG_B;
  input.exactOrigin = "https://attacker.example";
  input.dossierAssignment.dossierId = DOSSIER_B;
  const invitation = await pending;
  assert.equal(invitation.record.organizationId, ORG_A);
  assert.equal(invitation.record.exactOrigin, "https://preview.example.test");
  assert.equal(invitation.record.dossierAssignment?.dossierId, DOSSIER_A);
});

test("wrong invitation token, identity, origin, expiry, and revocation are indistinguishable", async () => {
  const denial = { accepted: false, code: "invitation_unavailable" } as const;
  const variants: Array<{
    mutate: (input: {
      invitationId: string;
      secretToken: string;
      authenticatedIdentityKey: string;
      exactOrigin: string;
    }) => void;
    trustedNowEpochSeconds?: number;
  }> = [
    { mutate: (input) => {
      input.secretToken = `${input.secretToken}x`;
    } },
    { mutate: (input) => {
      input.authenticatedIdentityKey = "https://issuer.example\u001ftenant-a\u001fother";
    } },
    { mutate: (input) => {
      input.exactOrigin = "https://attacker.example";
    } },
    { mutate: () => undefined, trustedNowEpochSeconds: NOW + 301 },
  ];
  for (const variant of variants) {
    const invitation = await newInvitation();
    const store = new InMemoryInvitationStore(
      () => variant.trustedNowEpochSeconds ?? NOW + 1,
    );
    store.insert(invitation.record);
    const input = {
      invitationId: invitation.record.id,
      secretToken: invitation.secretToken,
      authenticatedIdentityKey: invitation.record.intendedIdentityKey,
      exactOrigin: invitation.record.exactOrigin,
    };
    variant.mutate(input);
    assert.deepEqual(await store.accept(input), denial);
  }

  const revoked = await newInvitation();
  const revokedStore = new InMemoryInvitationStore(() => NOW + 1);
  revokedStore.insert(revoked.record);
  assert.equal(revokedStore.revoke(revoked.record.id), true);
  assert.deepEqual(
    await revokedStore.accept({
      invitationId: revoked.record.id,
      secretToken: revoked.secretToken,
      authenticatedIdentityKey: revoked.record.intendedIdentityKey,
      exactOrigin: revoked.record.exactOrigin,
    }),
    denial,
  );
});

test("invitation acceptance ignores caller-supplied backdated clocks", async () => {
  const invitation = await newInvitation();
  const store = new InMemoryInvitationStore(() => NOW + 301);
  store.insert(invitation.record);
  assert.deepEqual(
    await store.accept({
      invitationId: invitation.record.id,
      secretToken: invitation.secretToken,
      authenticatedIdentityKey: invitation.record.intendedIdentityKey,
      exactOrigin: invitation.record.exactOrigin,
      nowEpochSeconds: NOW + 1,
    } as Parameters<InMemoryInvitationStore["accept"]>[0]),
    { accepted: false, code: "invitation_unavailable" },
  );
  assert.equal(store.inspectForTest(invitation.record.id)?.status, "active");
});

test("invitation creation rejects unbounded TTL, non-origin URLs, and email-only identities", async () => {
  const base = {
    organizationId: ORG_A,
    intendedIdentityKey: "https://issuer.example\u001ftenant-a\u001fsubject-a",
    exactOrigin: "https://preview.example.test",
    organizationRole: "member" as const,
    nowEpochSeconds: NOW,
    expiresAtEpochSeconds: NOW + 300,
  };
  for (const invalid of [
    { ...base, expiresAtEpochSeconds: NOW + 59 },
    { ...base, expiresAtEpochSeconds: NOW + 86_401 },
    { ...base, exactOrigin: "http://preview.example.test" },
    { ...base, exactOrigin: "https://preview.example.test/path" },
    { ...base, intendedIdentityKey: "lawyer@example.test" },
    { ...base, organizationRole: "__proto__" },
    {
      ...base,
      dossierAssignment: { dossierId: DOSSIER_A, role: "unknown_role" },
    },
    { ...base, dossierAssignment: null },
  ]) {
    await assert.rejects(
      createDigestOnlyInvitation(
        invalid as unknown as Parameters<typeof createDigestOnlyInvitation>[0],
        deterministicRandom(),
      ),
      /invalid bounded invitation context/u,
    );
  }

  const valid = await newInvitation();
  const invalidStoredRole = structuredClone(valid.record);
  (invalidStoredRole as unknown as { organizationRole: string }).organizationRole =
    "toString";
  assert.throws(
    () => new InMemoryInvitationStore().insert(invalidStoredRole),
    /invalid invitation record/u,
  );
  const invalidStoredDossierRole = structuredClone(valid.record);
  invalidStoredDossierRole.dossierAssignment = {
    dossierId: DOSSIER_A,
    role: "viewer",
  };
  (
    invalidStoredDossierRole.dossierAssignment as unknown as { role: string }
  ).role = "unknown_role";
  assert.throws(
    () => new InMemoryInvitationStore().insert(invalidStoredDossierRole),
    /invalid invitation record/u,
  );
});

const OIDC_CONNECTION: EntraOidcConnection = {
  id: "entra_connection_alpha_001",
  organizationId: ORG_A,
  revision: 4,
  enabled: true,
  issuer: "https://login.microsoftonline.com/tenant-alpha/v2.0",
  tenantId: "tenant-alpha",
  clientId: "client-alpha",
  redirectUri: "https://preview.example.test/api/auth/entra/callback",
};

async function oidcFixture() {
  const created = await createOidcAuthorizationTransaction({
    connection: OIDC_CONNECTION,
    exactOrigin: "https://preview.example.test",
    browserBinding: "browser-tab-binding-alpha",
    nowEpochSeconds: NOW,
  });
  const claims: VerifiedOidcClaims = {
    iss: OIDC_CONNECTION.issuer,
    aud: OIDC_CONNECTION.clientId,
    tid: OIDC_CONNECTION.tenantId,
    oid: "entra-object-alpha",
    nonce: created.authorizationParameters.nonce,
    iat: NOW,
    nbf: NOW - 1,
    exp: NOW + 300,
  };
  const store = new InMemoryOidcTransactionStore();
  store.insert(created.transaction);
  return { ...created, claims, store };
}

test("OIDC authorization creation rejects malformed origin, browser binding, and time", async () => {
  const valid = {
    connection: OIDC_CONNECTION,
    exactOrigin: "https://preview.example.test",
    browserBinding: "browser-tab-binding-alpha",
    nowEpochSeconds: NOW,
  };
  for (const invalid of [
    { ...valid, exactOrigin: "http://preview.example.test" },
    { ...valid, exactOrigin: "https://preview.example.test/path" },
    { ...valid, exactOrigin: "https://preview.example.test/" },
    { ...valid, browserBinding: "" },
    { ...valid, browserBinding: "short" },
    { ...valid, browserBinding: "x".repeat(129) },
    { ...valid, nowEpochSeconds: 0 },
    { ...valid, nowEpochSeconds: Number.NaN },
    { ...valid, nowEpochSeconds: Number.MAX_SAFE_INTEGER },
    {
      ...valid,
      connection: {
        ...OIDC_CONNECTION,
        enabled: "false" as unknown as boolean,
      },
    },
  ]) {
    await assert.rejects(
      createOidcAuthorizationTransaction(invalid),
      /invalid OIDC authorization context|OIDC transaction lifetime|invalid OIDC connection/u,
    );
  }
});

test("OIDC authorization creation snapshots its trust boundary before PKCE hashing", async () => {
  const connection = structuredClone(OIDC_CONNECTION);
  const input = {
    connection,
    exactOrigin: "https://preview.example.test",
    browserBinding: "browser-tab-binding-alpha",
    nowEpochSeconds: NOW,
  };
  const pending = createOidcAuthorizationTransaction(input);
  connection.organizationId = ORG_B;
  connection.redirectUri = "https://attacker.example/callback";
  input.exactOrigin = "https://attacker.example";
  input.browserBinding = "attacker-browser-binding";
  input.nowEpochSeconds = NOW + 500;
  const created = await pending;
  assert.equal(created.transaction.organizationId, ORG_A);
  assert.equal(created.transaction.redirectUri, OIDC_CONNECTION.redirectUri);
  assert.equal(created.transaction.exactOrigin, "https://preview.example.test");
  assert.equal(created.transaction.browserBinding, "browser-tab-binding-alpha");
  assert.equal(created.transaction.createdAtEpochSeconds, NOW);
});

function callbackInput(
  fixture: Awaited<ReturnType<typeof oidcFixture>>,
  verifier?: OidcCodeVerifier,
) {
  return {
    store: fixture.store,
    transactionId: fixture.transaction.id,
    state: fixture.authorizationParameters.state,
    authorizationCode: "synthetic-authorization-code",
    connection: structuredClone(OIDC_CONNECTION),
    exactOrigin: "https://preview.example.test",
    browserBinding: "browser-tab-binding-alpha",
    nowEpochSeconds: NOW + 1,
    verifier,
  };
}

test("Entra callback binds PKCE, state, nonce, connection, browser, issuer, audience, tenant, and stable subject", async () => {
  const fixture = await oidcFixture();
  let verifierInput: Parameters<OidcCodeVerifier>[0] | undefined;
  const verifier: OidcCodeVerifier = async (input) => {
    verifierInput = input;
    return fixture.claims;
  };
  const result = await validateOidcCallback(callbackInput(fixture, verifier));
  assert.deepEqual(result, {
    ok: true,
    organizationId: ORG_A,
    connectionId: OIDC_CONNECTION.id,
    stableIdentityKey: `${OIDC_CONNECTION.issuer}\u001f${OIDC_CONNECTION.tenantId}\u001fentra-object-alpha`,
    subject: "entra-object-alpha",
  });
  assert.equal(verifierInput?.codeVerifier, fixture.transaction.codeVerifier);
  assert.equal(verifierInput?.redirectUri, OIDC_CONNECTION.redirectUri);
  assert.equal(fixture.transaction.stateDigest, await sha256Hex(fixture.authorizationParameters.state));
  assert.equal("state" in fixture.transaction, false);
  assert.equal("nonce" in fixture.transaction, false);
});

test("Entra callback has no success path without an injected cryptographic verifier and rejects replay", async () => {
  const noVerifier = await oidcFixture();
  assert.deepEqual(await validateOidcCallback(callbackInput(noVerifier)), {
    ok: false,
    code: "identity_unavailable",
  });
  assert.equal(noVerifier.store.wasConsumed(noVerifier.transaction.id), true);

  const replay = await oidcFixture();
  const verifier: OidcCodeVerifier = async () => replay.claims;
  const input = callbackInput(replay, verifier);
  assert.equal((await validateOidcCallback(input)).ok, true);
  assert.deepEqual(await validateOidcCallback(input), {
    ok: false,
    code: "identity_unavailable",
  });

  const concurrent = await oidcFixture();
  const concurrentVerifier: OidcCodeVerifier = async () => concurrent.claims;
  const attempts = await Promise.all([
    validateOidcCallback(callbackInput(concurrent, concurrentVerifier)),
    validateOidcCallback(callbackInput(concurrent, concurrentVerifier)),
  ]);
  assert.equal(attempts.filter((result) => result.ok).length, 1);
});

test("Entra callback rejects a non-finite current time", async () => {
  const fixture = await oidcFixture();
  const verifier: OidcCodeVerifier = async () => fixture.claims;
  const input = callbackInput(fixture, verifier);
  input.nowEpochSeconds = Number.NaN;
  assert.deepEqual(await validateOidcCallback(input), {
    ok: false,
    code: "identity_unavailable",
  });
});

test("Entra callback snapshots time and verifier claims across asynchronous boundaries", async () => {
  const timeFixture = await oidcFixture();
  const expiredClaims = structuredClone(timeFixture.claims);
  expiredClaims.exp = NOW - 120;
  let releaseVerifier!: () => void;
  let markVerifierStarted!: () => void;
  const verifierGate = new Promise<void>((resolve) => {
    releaseVerifier = resolve;
  });
  const verifierStarted = new Promise<void>((resolve) => {
    markVerifierStarted = resolve;
  });
  const delayedVerifier: OidcCodeVerifier = async () => {
    markVerifierStarted();
    await verifierGate;
    return expiredClaims;
  };
  const mutableInput = callbackInput(timeFixture, delayedVerifier);
  const pendingTimeDecision = validateOidcCallback(mutableInput);
  await verifierStarted;
  mutableInput.nowEpochSeconds = Number.NaN;
  releaseVerifier();
  assert.deepEqual(await pendingTimeDecision, {
    ok: false,
    code: "identity_unavailable",
  });

  const claimFixture = await oidcFixture();
  const mutableClaims = structuredClone(claimFixture.claims);
  const originalNonce = mutableClaims.nonce;
  mutableClaims.exp = NOW - 120;
  Object.defineProperty(mutableClaims, "nonce", {
    configurable: true,
    enumerable: true,
    get() {
      queueMicrotask(() => {
        mutableClaims.exp = NOW + 300;
      });
      return originalNonce;
    },
  });
  const mutableClaimsVerifier: OidcCodeVerifier = async () => mutableClaims;
  assert.deepEqual(
    await validateOidcCallback(
      callbackInput(claimFixture, mutableClaimsVerifier),
    ),
    { ok: false, code: "identity_unavailable" },
  );
});

test("Entra callback rejects every stale or substituted correlation and connection boundary", async () => {
  const variants: Array<
    (input: ReturnType<typeof callbackInput>, fixture: Awaited<ReturnType<typeof oidcFixture>>) => void
  > = [
    (input) => {
      input.state = `${input.state}x`;
    },
    (input) => {
      input.exactOrigin = "https://attacker.example";
    },
    (input) => {
      input.browserBinding = "different-browser-tab";
    },
    (input) => {
      input.connection.organizationId = ORG_B;
    },
    (input) => {
      input.connection.id = "entra_connection_other_002";
    },
    (input) => {
      input.connection.revision += 1;
    },
    (input) => {
      input.connection.issuer = "https://login.microsoftonline.com/tenant-other/v2.0";
    },
    (input) => {
      input.connection.tenantId = "tenant-other";
    },
    (input) => {
      input.connection.clientId = "client-other";
    },
    (input) => {
      input.connection.redirectUri = "https://preview.example.test/api/auth/other/callback";
    },
    (input) => {
      input.connection.enabled = false;
    },
    (input) => {
      input.connection.enabled = "false" as unknown as boolean;
    },
    (input) => {
      input.nowEpochSeconds = NOW + 301;
    },
    (_input, fixture) => {
      fixture.transaction.codeChallenge = "tampered-code-challenge";
    },
  ];

  for (const mutate of variants) {
    const fixture = await oidcFixture();
    const verifier: OidcCodeVerifier = async () => fixture.claims;
    let input = callbackInput(fixture, verifier);
    if (mutate.length > 1 && fixture.transaction.codeChallenge === "tampered-code-challenge") {
      // Unreachable; retained to keep mutations explicit.
      input = callbackInput(fixture, verifier);
    }
    mutate(input, fixture);
    if (fixture.transaction.codeChallenge === "tampered-code-challenge") {
      const replacement = new InMemoryOidcTransactionStore();
      replacement.insert(fixture.transaction);
      input.store = replacement;
    }
    assert.deepEqual(await validateOidcCallback(input), {
      ok: false,
      code: "identity_unavailable",
    });
  }
});

test("Entra callback rejects fake claims with wrong issuer, aud, tid, nonce, time, signature, or subject", async () => {
  const claimMutations: Array<(claims: VerifiedOidcClaims) => void> = [
    (claims) => {
      claims.iss = "https://login.microsoftonline.com/tenant-other/v2.0";
    },
    (claims) => {
      claims.aud = "client-other";
    },
    (claims) => {
      claims.tid = "tenant-other";
    },
    (claims) => {
      claims.nonce = "wrong-nonce";
    },
    (claims) => {
      claims.exp = NOW - 120;
    },
    (claims) => {
      claims.nbf = NOW + 121;
    },
    (claims) => {
      claims.iat = NOW + 121;
    },
    (claims) => {
      claims.iat = NOW - 121;
    },
    (claims) => {
      delete claims.oid;
      delete claims.sub;
    },
    (claims) => {
      claims.oid = 123 as unknown as string;
    },
    (claims) => {
      claims.oid = "invalid\u001fsubject";
    },
  ];
  for (const mutate of claimMutations) {
    const fixture = await oidcFixture();
    const claims = structuredClone(fixture.claims);
    mutate(claims);
    const verifier: OidcCodeVerifier = async () => claims;
    assert.deepEqual(await validateOidcCallback(callbackInput(fixture, verifier)), {
      ok: false,
      code: "identity_unavailable",
    });
  }

  const failedSignature = await oidcFixture();
  const failedVerifier: OidcCodeVerifier = async () => {
    throw new Error("fake signature rejection");
  };
  assert.deepEqual(
    await validateOidcCallback(callbackInput(failedSignature, failedVerifier)),
    { ok: false, code: "identity_unavailable" },
  );

  await assert.rejects(
    createOidcAuthorizationTransaction({
      connection: { ...OIDC_CONNECTION, issuer: "http://issuer.example" },
      exactOrigin: "https://preview.example.test",
      browserBinding: "browser-tab-binding-alpha",
      nowEpochSeconds: NOW,
    }),
    /exact HTTPS URL/u,
  );
});

test("local-only envelope KMS binds ciphertext to exact key alias and tenant/object AAD", async () => {
  const kms = new LocalTestEnvelopeKms("LOCAL_TEST_ONLY");
  const keyAlias = "org/org-alpha/content-key";
  await kms.addRandomKey(keyAlias, 1);
  const associatedData: EnvelopeAssociatedData = {
    organizationId: ORG_A,
    objectType: "synthetic_test_artifact",
    objectId: "artifact_alpha_0001",
    purpose: "phase_b_validation_only",
    schemaVersion: 1,
  };
  const plaintext = new TextEncoder().encode("synthetic and de-identified fixture only");
  const envelope = await kms.seal({
    keyAlias,
    keyVersion: 1,
    plaintext,
    associatedData,
  });
  assert.deepEqual(Object.keys(envelope).sort(), [
    "aadSha256",
    "algorithm",
    "ciphertext",
    "iv",
    "keyAlias",
    "keyVersion",
  ]);
  assert.equal(
    decodeUtf8(
      await kms.open({
        envelope,
        expectedKeyAlias: keyAlias,
        expectedAssociatedData: associatedData,
      }),
    ),
    "synthetic and de-identified fixture only",
  );

  await assert.rejects(
    kms.open({
      envelope,
      expectedKeyAlias: keyAlias,
      expectedAssociatedData: { ...associatedData, organizationId: ORG_B },
    }),
    /envelope unavailable/u,
  );
  await assert.rejects(
    kms.open({
      envelope,
      expectedKeyAlias: "org/org-bravo/content-key",
      expectedAssociatedData: associatedData,
    }),
    /envelope unavailable/u,
  );
  await assert.rejects(
    kms.open({
      envelope: { ...envelope, ciphertext: `${envelope.ciphertext}A` },
      expectedKeyAlias: keyAlias,
      expectedAssociatedData: associatedData,
    }),
    /envelope unavailable/u,
  );
});

function mustRotate(state: KeyRotationState, command: KeyRotationCommand): KeyRotationState {
  const transition = transitionKeyRotation(state, command);
  assert.equal(transition.ok, true);
  if (!transition.ok) throw new Error("rotation transition failed");
  return transition.state;
}

test("key rotation is an explicit dual-read/single-write state machine with rollback", () => {
  let state = stableKeyRotationState(ORG_A, 3);
  state = mustRotate(state, {
    type: "begin",
    rotationId: "rotation_phase_b_alpha_001",
    rotationVersion: 1,
    toVersion: 4,
  });
  assert.deepEqual(state, {
    phase: "preparing",
    organizationId: ORG_A,
    rotationId: "rotation_phase_b_alpha_001",
    rotationVersion: 1,
    fromVersion: 3,
    toVersion: 4,
    newVersionWriteCount: 0,
    writeVersion: 3,
    readVersions: [3],
  });
  state = mustRotate(state, { type: "activate_new_writes" });
  assert.equal(state.writeVersion, 4);
  assert.deepEqual(state.readVersions, [3, 4]);
  const rewrapEvidence = {
    organizationId: ORG_A,
    rotationId: "rotation_phase_b_alpha_001",
    rotationVersion: 1,
    fromVersion: 3,
    toVersion: 4,
    expectedEnvelopeCount: 2,
    rewrappedEnvelopeCount: 2,
    failures: 0,
    manifestSha256: "6".repeat(64),
  };
  for (const invalidEvidence of [
    { ...rewrapEvidence, organizationId: ORG_B },
    { ...rewrapEvidence, rotationId: "rotation_phase_b_other_0002" },
    { ...rewrapEvidence, rotationVersion: 2 },
    { ...rewrapEvidence, rewrappedEnvelopeCount: 1 },
    { ...rewrapEvidence, failures: 1 },
  ]) {
    assert.deepEqual(
      transitionKeyRotation(state, {
        type: "rewrap_complete",
        evidence: invalidEvidence,
      }),
      { ok: false, code: "invalid_rotation_transition" },
    );
  }
  state = mustRotate(state, { type: "rewrap_complete", evidence: rewrapEvidence });
  assert.equal(state.phase, "verifying");
  const verificationEvidence = {
    organizationId: ORG_A,
    rotationId: "rotation_phase_b_alpha_001",
    rotationVersion: 1,
    manifestSha256: "6".repeat(64),
    verificationReceiptSha256: "7".repeat(64),
    currentVerificationReceiptSha256: "7".repeat(64),
  };
  assert.deepEqual(
    transitionKeyRotation(state, {
      type: "verification_complete",
      evidence: {
        ...verificationEvidence,
        currentVerificationReceiptSha256: "8".repeat(64),
      },
    }),
    { ok: false, code: "invalid_rotation_transition" },
  );
  state = mustRotate(state, {
    type: "verification_complete",
    evidence: verificationEvidence,
  });
  assert.deepEqual(state, {
    phase: "completed",
    organizationId: ORG_A,
    rotationId: "rotation_phase_b_alpha_001",
    rotationVersion: 1,
    currentVersion: 4,
    rewrapManifestSha256: "6".repeat(64),
    verificationReceiptSha256: "7".repeat(64),
    writeVersion: 4,
    readVersions: [4],
  });
  assert.deepEqual(transitionKeyRotation(state, { type: "rollback" }), {
    ok: false,
    code: "invalid_rotation_transition",
  });

  let rollback = mustRotate(stableKeyRotationState(ORG_A, 8), {
    type: "begin",
    rotationId: "rotation_phase_b_alpha_002",
    rotationVersion: 1,
    toVersion: 9,
  });
  rollback = mustRotate(rollback, { type: "activate_new_writes" });
  rollback = mustRotate(rollback, { type: "rollback" });
  assert.deepEqual(rollback, {
    phase: "rolled_back",
    organizationId: ORG_A,
    rotationId: "rotation_phase_b_alpha_002",
    rotationVersion: 1,
    currentVersion: 8,
    attemptedVersion: 9,
    writeVersion: 8,
    readVersions: [8],
  });
  assert.deepEqual(
    transitionKeyRotation(stableKeyRotationState(ORG_A, 3), {
      type: "begin",
      rotationId: "rotation_phase_b_alpha_003",
      rotationVersion: 1,
      toVersion: 5,
    }),
    { ok: false, code: "invalid_rotation_transition" },
  );

  let safeRollback = mustRotate(stableKeyRotationState(ORG_A, 12), {
    type: "begin",
    rotationId: "rotation_phase_b_alpha_004",
    rotationVersion: 1,
    toVersion: 13,
  });
  safeRollback = mustRotate(safeRollback, { type: "activate_new_writes" });
  safeRollback = mustRotate(safeRollback, { type: "record_new_version_write" });
  safeRollback = mustRotate(safeRollback, { type: "rollback" });
  assert.deepEqual(safeRollback, {
    phase: "rollback_rewrapping",
    organizationId: ORG_A,
    rotationId: "rotation_phase_b_alpha_004",
    rotationVersion: 1,
    fromVersion: 12,
    toVersion: 13,
    totalNewVersionWrites: 1,
    rewrappedNewVersionWrites: 0,
    pendingNewVersionWrites: 1,
    writeVersion: 12,
    readVersions: [12, 13],
  });
  assert.deepEqual(
    transitionKeyRotation(safeRollback, {
      type: "verify_rollback_rewrap",
      verificationReceiptSha256: "a".repeat(64),
    }),
    { ok: false, code: "invalid_rotation_transition" },
  );
  safeRollback = mustRotate(safeRollback, {
    type: "record_rollback_rewrap_progress",
    completedWrites: 1,
  });
  assert.equal(safeRollback.phase, "rollback_rewrapping");
  if (safeRollback.phase !== "rollback_rewrapping") {
    throw new Error("rollback progress state missing");
  }
  assert.equal(safeRollback.pendingNewVersionWrites, 0);
  assert.deepEqual(
    transitionKeyRotation(safeRollback, {
      type: "record_rollback_rewrap_progress",
      completedWrites: 1,
    }),
    { ok: true, state: safeRollback },
  );
  assert.deepEqual(
    transitionKeyRotation(safeRollback, {
      type: "record_rollback_rewrap_progress",
      completedWrites: 2,
    }),
    { ok: false, code: "invalid_rotation_transition" },
  );
  const rollbackVerificationReceipt = "a".repeat(64);
  safeRollback = mustRotate(safeRollback, {
    type: "verify_rollback_rewrap",
    verificationReceiptSha256: rollbackVerificationReceipt,
  });
  assert.equal(safeRollback.phase, "rollback_verifying");
  assert.deepEqual(
    transitionKeyRotation(safeRollback, {
      type: "rollback_verification_complete",
      verificationReceiptSha256: "b".repeat(64),
    }),
    { ok: false, code: "invalid_rotation_transition" },
  );
  safeRollback = mustRotate(safeRollback, {
    type: "rollback_verification_complete",
    verificationReceiptSha256: rollbackVerificationReceipt,
  });
  assert.equal(safeRollback.phase, "rolled_back");
  assert.deepEqual(safeRollback.readVersions, [12]);
  if (safeRollback.phase !== "rolled_back") {
    throw new Error("rollback completion state missing");
  }
  assert.equal(
    safeRollback.rollbackVerificationReceiptSha256,
    rollbackVerificationReceipt,
  );
});

function securityReceiptInput(
  overrides: Partial<SecurityReceiptInput> = {},
): SecurityReceiptInput {
  return {
    schemaVersion: "security-receipt.v1",
    eventType: "authorization_decision",
    organizationId: ORG_A,
    actorId: ACTOR_A,
    sessionId: "session_phase_b_alpha_001",
    authenticationMethod: "local_test",
    dossierId: DOSSIER_A,
    action: "dossier_read",
    policyVersion: "phase-b-role-action-policy.v1",
    authorizationVersion: 7,
    resourceRevision: 11,
    requestCorrelationSha256: REQUEST_CORRELATION,
    outcome: "allowed",
    reasonCode: "authorized",
    resourceDigest: RESOURCE_DIGEST,
    occurredAtEpochSeconds: NOW,
    deploymentSha: DEPLOYMENT_SHA,
    environment: "validation",
    ...overrides,
  };
}

test("security receipts serialize concurrent appends, bind required evidence, and reject mutation", async () => {
  const chain = new InMemorySecurityReceiptChain();
  const first = await chain.append(securityReceiptInput());
  const second = await chain.append(securityReceiptInput({
    action: "document_upload",
    outcome: "denied",
    reasonCode: "policy_denied",
    occurredAtEpochSeconds: NOW + 1,
  }));
  assert.equal(first.previousDigest, "0".repeat(64));
  assert.equal(second.previousDigest, first.digest);
  assert.equal(await chain.verify(ORG_A), true);
  assert.equal("update" in chain, false);
  assert.equal("delete" in chain, false);

  const external = chain.entries(ORG_A) as SecurityReceipt[];
  external[0].action = "tampered_external_copy";
  assert.equal(await chain.verify(ORG_A), true);

  const tampered = chain.entries(ORG_A).map((receipt) => ({ ...receipt }));
  tampered[1].outcome = "allowed";
  assert.equal(await verifySecurityReceiptChain(ORG_A, tampered), false);

  const concurrent = new InMemorySecurityReceiptChain();
  const appended = await Promise.all(
    Array.from({ length: 32 }, (_, index) =>
      concurrent.append(
        securityReceiptInput({
          requestCorrelationSha256: index.toString(16).padStart(64, "0"),
          occurredAtEpochSeconds: NOW + index,
        }),
      ),
    ),
  );
  assert.deepEqual(
    appended.map((receipt) => receipt.sequence),
    Array.from({ length: 32 }, (_, index) => index + 1),
  );
  assert.equal(await concurrent.verify(ORG_A), true);

  const queuedChain = new InMemorySecurityReceiptChain();
  const queueHead = queuedChain.append(securityReceiptInput());
  const mutableQueuedInput = securityReceiptInput({
    action: "dossier_update",
    requestCorrelationSha256: "a".repeat(64),
    occurredAtEpochSeconds: NOW + 1,
  });
  const queuedAppend = queuedChain.append(mutableQueuedInput);
  mutableQueuedInput.action = "document_upload";
  mutableQueuedInput.requestCorrelationSha256 = "invalid_after_enqueue";
  mutableQueuedInput.occurredAtEpochSeconds = 0;
  await queueHead;
  const capturedReceipt = await queuedAppend;
  assert.equal(capturedReceipt.action, "dossier_update");
  assert.equal(capturedReceipt.requestCorrelationSha256, "a".repeat(64));
  assert.equal(capturedReceipt.occurredAtEpochSeconds, NOW + 1);
  assert.equal(await queuedChain.verify(ORG_A), true);

  await assert.rejects(
    chain.append(securityReceiptInput({ resourceDigest: DOSSIER_A })),
    /privacy-safe security receipt/u,
  );
  await assert.rejects(
    chain.append({
      ...securityReceiptInput(),
      confidentialDocumentText: "must never enter a receipt",
    } as SecurityReceiptInput),
    /privacy-safe security receipt/u,
  );

  const missingActionInput = structuredClone(
    securityReceiptInput(),
  ) as Partial<SecurityReceiptInput>;
  delete missingActionInput.action;
  await assert.rejects(
    chain.append(missingActionInput as SecurityReceiptInput),
    /privacy-safe security receipt/u,
  );
  await assert.rejects(
    chain.append({
      ...securityReceiptInput(),
      policyVersion: 123,
    } as unknown as SecurityReceiptInput),
    /privacy-safe security receipt/u,
  );

  const [validReceipt] = chain.entries(ORG_A);
  assert.ok(validReceipt);
  const { digest: validDigest, ...validPayload } = validReceipt;
  void validDigest;
  const missingActionPayload = structuredClone(
    validPayload,
  ) as Partial<Omit<SecurityReceipt, "digest">>;
  delete missingActionPayload.action;
  const numericPolicyPayload = {
    ...validPayload,
    policyVersion: 123,
  };
  for (const invalidPayload of [
    missingActionPayload,
    numericPolicyPayload,
  ]) {
    const selfConsistentInvalidReceipt = {
      ...invalidPayload,
      digest: await sha256Hex(canonicalJson(invalidPayload)),
    } as unknown as SecurityReceipt;
    assert.equal(
      await verifySecurityReceiptChain(ORG_A, [selfConsistentInvalidReceipt]),
      false,
    );
  }
});

test("security receipt sequences and digest chains are partitioned by organization", async () => {
  const chain = new InMemorySecurityReceiptChain();
  const alphaFirst = await chain.append(securityReceiptInput());
  const bravoFirst = await chain.append(
    securityReceiptInput({
      organizationId: ORG_B,
      actorId: ACTOR_B,
      sessionId: "session_phase_b_bravo_001",
      dossierId: DOSSIER_B,
      requestCorrelationSha256: "b".repeat(64),
      occurredAtEpochSeconds: NOW - 10,
    }),
  );
  const alphaSecond = await chain.append(
    securityReceiptInput({
      requestCorrelationSha256: "c".repeat(64),
      occurredAtEpochSeconds: NOW + 2,
    }),
  );

  assert.equal(alphaFirst.sequence, 1);
  assert.equal(alphaFirst.previousDigest, "0".repeat(64));
  assert.equal(bravoFirst.sequence, 1);
  assert.equal(bravoFirst.previousDigest, "0".repeat(64));
  assert.equal(alphaSecond.sequence, 2);
  assert.equal(alphaSecond.previousDigest, alphaFirst.digest);
  assert.deepEqual(
    chain.entries(ORG_A).map((receipt) => receipt.sequence),
    [1, 2],
  );
  assert.deepEqual(
    chain.entries(ORG_B).map((receipt) => receipt.sequence),
    [1],
  );
  assert.ok(chain.entries(ORG_A).every((receipt) => receipt.organizationId === ORG_A));
  assert.ok(chain.entries(ORG_B).every((receipt) => receipt.organizationId === ORG_B));
  assert.deepEqual(chain.entries("organization_unknown_receipts_001"), []);
  assert.throws(() => chain.entries("invalid"), /invalid organization receipt scope/u);
  await assert.rejects(
    chain.verify("invalid"),
    /invalid organization receipt scope/u,
  );
  assert.equal(await chain.verify(ORG_A), true);
  assert.equal(await chain.verify(ORG_B), true);
  assert.equal(
    await verifySecurityReceiptChain(ORG_A, chain.entries(ORG_B)),
    false,
  );

  await assert.rejects(
    chain.append(
      securityReceiptInput({
        requestCorrelationSha256: "d".repeat(64),
        occurredAtEpochSeconds: NOW + 1,
      }),
    ),
    /stale organization security receipt input/u,
  );
  const bravoSecond = await chain.append(
    securityReceiptInput({
      organizationId: ORG_B,
      actorId: ACTOR_B,
      sessionId: "session_phase_b_bravo_001",
      dossierId: DOSSIER_B,
      requestCorrelationSha256: "e".repeat(64),
      occurredAtEpochSeconds: NOW - 9,
    }),
  );
  assert.equal(bravoSecond.sequence, 2);
  assert.equal(bravoSecond.previousDigest, bravoFirst.digest);
  const alphaThird = await chain.append(
    securityReceiptInput({
      requestCorrelationSha256: "f".repeat(64),
      occurredAtEpochSeconds: NOW + 3,
    }),
  );
  assert.equal(alphaThird.sequence, 3);
  assert.equal(alphaThird.previousDigest, alphaSecond.digest);

  const { digest: ignoredDigest, ...bravoPayload } = bravoFirst;
  void ignoredDigest;
  const crossTenantPayload: Omit<SecurityReceipt, "digest"> = {
    ...bravoPayload,
    sequence: 2,
    previousDigest: alphaFirst.digest,
  };
  const crossTenantReceipt: SecurityReceipt = {
    ...crossTenantPayload,
    digest: await sha256Hex(canonicalJson(crossTenantPayload)),
  };
  assert.equal(
    await verifySecurityReceiptChain(ORG_A, [alphaFirst, crossTenantReceipt]),
    false,
  );
});

test("concurrent receipt appends serialize independently inside each organization", async () => {
  const chain = new InMemorySecurityReceiptChain();
  const appended = await Promise.all(
    Array.from({ length: 32 }, (_, index) => {
      const isAlpha = index % 2 === 0;
      return chain.append(
        securityReceiptInput({
          organizationId: isAlpha ? ORG_A : ORG_B,
          actorId: isAlpha ? ACTOR_A : ACTOR_B,
          sessionId: isAlpha
            ? "session_phase_b_alpha_001"
            : "session_phase_b_bravo_001",
          dossierId: isAlpha ? DOSSIER_A : DOSSIER_B,
          requestCorrelationSha256: index.toString(16).padStart(64, "0"),
          occurredAtEpochSeconds: NOW + Math.floor(index / 2),
        }),
      );
    }),
  );

  for (const organizationId of [ORG_A, ORG_B]) {
    const organizationReceipts = appended.filter(
      (receipt) => receipt.organizationId === organizationId,
    );
    assert.deepEqual(
      organizationReceipts.map((receipt) => receipt.sequence),
      Array.from({ length: 16 }, (_, index) => index + 1),
    );
    for (let index = 0; index < organizationReceipts.length; index += 1) {
      assert.equal(
        organizationReceipts[index].previousDigest,
        index === 0
          ? "0".repeat(64)
          : organizationReceipts[index - 1].digest,
      );
    }
    assert.equal(await chain.verify(organizationId), true);
  }
});
