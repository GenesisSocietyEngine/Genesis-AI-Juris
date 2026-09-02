import {
  isOpaqueId,
  isPositiveSafeInteger,
  isSha256,
  isVerifiedTenantResourceManifest,
} from "./tenant-foundation";
import type {
  ConfidentialDocumentMode,
  DossierRole,
  OrganizationRole,
  OrganizationStatus,
  TenantResourceEnvironment,
  ValidationDataClassification,
  VerifiedTenantResourceManifest,
} from "./tenant-foundation";

export const ROLE_ACTION_POLICY_VERSION = "phase-b-role-action-policy.v1" as const;
export const DOSSIER_EXPORT_APPROVAL_VERSION =
  "dossier-export-approval.v1" as const;
export const POLICY_ACTIVATION_APPROVAL_VERSION =
  "policy-activation-approval.v1" as const;
export const TENANT_SESSION_MAX_LIFETIME_SECONDS = 7 * 86_400;

export const TENANT_ACTIONS = [
  "oidc_callback",
  "invitation_acceptance",
  "organization_read",
  "organization_update",
  "member_invite",
  "member_suspend",
  "member_remove",
  "member_role_assign",
  "identity_connection_read",
  "identity_connection_manage",
  "policy_read",
  "policy_manage",
  "organization_audit_read",
  "tenant_export_request",
  "dossier_read",
  "dossier_update",
  "dossier_member_enrol",
  "dossier_member_remove",
  "dossier_owner_transfer",
  "document_upload",
  "document_read",
  "document_delete_request",
  "extraction_request",
  "ocr_request",
  "citation_read",
  "citation_manage",
  "evidence_read",
  "evidence_manage",
  "task_read",
  "task_manage",
  "review_read",
  "review_submit",
  "report_read",
  "report_generate",
  "dossier_export_request",
  "retention_purge_request",
  "legal_hold_read",
  "legal_hold_create_request",
  "legal_hold_create_approve",
  "legal_hold_release_request",
  "legal_hold_release_approve",
  "dossier_audit_read",
] as const;

export type TenantAction = (typeof TENANT_ACTIONS)[number];
export type AuthorizationRequestClass =
  | "identity"
  | "organization"
  | "dossier"
  | "compliance_export"
  | "security";
export type AuthorizationScope = "identity" | "organization" | "dossier";

export const ACTION_SCOPES: Partial<
  Record<TenantAction, readonly AuthorizationScope[]>
> = {
  legal_hold_create_approve: ["organization", "dossier"],
  legal_hold_release_approve: ["organization", "dossier"],
};

export const REQUEST_CLASS_ACTIONS = {
  identity: ["oidc_callback", "invitation_acceptance"],
  organization: [
    "organization_read",
    "member_remove",
    "member_role_assign",
    "identity_connection_read",
    "organization_audit_read",
  ],
  dossier: [
    "dossier_read",
    "dossier_update",
    "dossier_member_enrol",
    "dossier_member_remove",
    "dossier_owner_transfer",
    "document_upload",
    "document_read",
    "document_delete_request",
    "extraction_request",
    "ocr_request",
    "citation_read",
    "citation_manage",
    "evidence_read",
    "evidence_manage",
    "task_read",
    "task_manage",
    "review_read",
    "review_submit",
    "report_read",
    "report_generate",
    "dossier_export_request",
    "retention_purge_request",
    "legal_hold_read",
    "legal_hold_create_request",
    "legal_hold_release_request",
    "dossier_audit_read",
  ],
  compliance_export: ["tenant_export_request"],
  security: [
    "organization_update",
    "member_invite",
    "member_suspend",
    "identity_connection_manage",
    "policy_read",
    "policy_manage",
    "legal_hold_create_approve",
    "legal_hold_release_approve",
  ],
} as const satisfies Record<AuthorizationRequestClass, readonly TenantAction[]>;

export const ORGANIZATION_ROLE_ACTIONS = {
  org_owner: [
    "organization_read",
    "organization_update",
    "member_invite",
    "member_suspend",
    "member_remove",
    "member_role_assign",
    "identity_connection_read",
    "identity_connection_manage",
    "policy_read",
    "policy_manage",
    "organization_audit_read",
    "tenant_export_request",
  ],
  org_admin: [
    "organization_read",
    "organization_update",
    "member_invite",
    "member_suspend",
    "identity_connection_read",
    "identity_connection_manage",
    "policy_read",
    "policy_manage",
    "organization_audit_read",
    "tenant_export_request",
    "legal_hold_create_approve",
    "legal_hold_release_approve",
  ],
  member: ["organization_read", "identity_connection_read", "policy_read"],
  auditor: [
    "organization_read",
    "identity_connection_read",
    "policy_read",
    "organization_audit_read",
  ],
} as const satisfies Record<OrganizationRole, readonly TenantAction[]>;

export const DOSSIER_ROLE_ACTIONS = {
  owner: [
    "dossier_read",
    "dossier_update",
    "dossier_member_enrol",
    "dossier_member_remove",
    "dossier_owner_transfer",
    "document_upload",
    "document_read",
    "document_delete_request",
    "extraction_request",
    "ocr_request",
    "citation_read",
    "citation_manage",
    "evidence_read",
    "evidence_manage",
    "task_read",
    "task_manage",
    "review_read",
    "review_submit",
    "report_read",
    "report_generate",
    "dossier_export_request",
    "retention_purge_request",
    "legal_hold_read",
    "legal_hold_create_request",
    "legal_hold_release_request",
    "dossier_audit_read",
  ],
  contributor: [
    "dossier_read",
    "dossier_update",
    "document_upload",
    "document_read",
    "extraction_request",
    "ocr_request",
    "citation_read",
    "citation_manage",
    "evidence_read",
    "evidence_manage",
    "task_read",
    "task_manage",
    "review_read",
    "report_read",
    "report_generate",
    "legal_hold_read",
    "dossier_audit_read",
  ],
  reviewer: [
    "dossier_read",
    "document_read",
    "citation_read",
    "evidence_read",
    "task_read",
    "review_read",
    "review_submit",
    "report_read",
    "report_generate",
    "legal_hold_read",
    "legal_hold_create_approve",
    "legal_hold_release_approve",
    "dossier_audit_read",
  ],
  viewer: [
    "dossier_read",
    "document_read",
    "citation_read",
    "evidence_read",
    "task_read",
    "review_read",
    "report_read",
    "legal_hold_read",
  ],
} as const satisfies Record<DossierRole, readonly TenantAction[]>;

export const DELEGATED_ORG_ADMIN_ACTIONS = [
  "member_invite",
  "member_suspend",
] as const satisfies readonly TenantAction[];
export const COMPLIANCE_AUTHORITY_ACTIONS = [
  "tenant_export_request",
] as const satisfies readonly TenantAction[];
export const SEPARATION_OF_DUTIES_ACTIONS = [
  "legal_hold_create_approve",
  "legal_hold_release_approve",
] as const satisfies readonly TenantAction[];
export const TENANT_MANIFEST_REQUIRED_ACTIONS = [
  "document_upload",
  "document_read",
  "document_delete_request",
  "extraction_request",
  "ocr_request",
  "report_generate",
  "dossier_export_request",
  "retention_purge_request",
  "tenant_export_request",
] as const satisfies readonly TenantAction[];
export const PHASE_B_SERVER_DISABLED_ACTIONS = [
  "document_upload",
  "extraction_request",
  "ocr_request",
] as const satisfies readonly TenantAction[];

const delegatedOrgAdminActions = new Set<TenantAction>(
  DELEGATED_ORG_ADMIN_ACTIONS,
);
const complianceAuthorityActions = new Set<TenantAction>(
  COMPLIANCE_AUTHORITY_ACTIONS,
);
const separationOfDutiesActions = new Set<TenantAction>(
  SEPARATION_OF_DUTIES_ACTIONS,
);
const tenantManifestRequiredActions = new Set<TenantAction>(
  TENANT_MANIFEST_REQUIRED_ACTIONS,
);
const phaseBServerDisabledActions = new Set<TenantAction>(
  PHASE_B_SERVER_DISABLED_ACTIONS,
);

const DOSSIER_ACTIONS = new Set<TenantAction>([
  ...REQUEST_CLASS_ACTIONS.dossier,
  "legal_hold_create_approve",
  "legal_hold_release_approve",
]);
const IDENTITY_ACTIONS = new Set<TenantAction>(REQUEST_CLASS_ACTIONS.identity);

export interface AuthorizationRequest {
  requestClass: AuthorizationRequestClass;
  scope: AuthorizationScope;
  action: TenantAction;
  actorId: string;
  organizationId?: string;
  dossierId?: string;
  expectedOrganizationAuthorizationVersion?: number;
  expectedMembershipAuthorizationVersion?: number;
  expectedParticipantAuthorizationVersion?: number;
  expectedPolicyRevision?: number;
  expectedIdentityConfigurationVersion?: number;
  expectedResourceRevision?: number;
  expectedTenantManifestRevision?: number;
  dataClassification?: ValidationDataClassification;
  submittedDelegatedGrant?: { id: string; revision: number };
  submittedComplianceAuthority?: {
    grantId: string;
    grantRevision: number;
    exportRequestId: string;
    manifestDigest: string;
    dossierIds: readonly string[];
  };
  submittedSecurityApproval?: { requestId: string; revision: number };
}

export interface ActiveSessionContext {
  id: string;
  actorId: string;
  organizationId: string;
  status: "active" | "revoked";
  authenticationMethod: "local" | "chatgpt" | "entra_oidc";
  organizationAuthorizationVersion: number;
  membershipAuthorizationVersion: number;
  policyRevision: number;
  identityConnectionId?: string;
  identityConfigurationVersion?: number;
  expiresAtEpochSeconds: number;
  issuedAtEpochSeconds: number;
}

export interface OrganizationAuthorizationContext {
  id: string;
  status: OrganizationStatus;
  confidentialDocumentMode: ConfidentialDocumentMode;
  authorizationVersion: number;
}

export interface OrganizationMembershipContext {
  actorId: string;
  organizationId: string;
  status: "active" | "suspended" | "removed";
  role: OrganizationRole;
  authorizationVersion: number;
}

export interface DossierAuthorizationContext {
  id: string;
  organizationId: string;
}

export interface DossierParticipantContext {
  actorId: string;
  organizationId: string;
  dossierId: string;
  status: "active" | "suspended" | "removed";
  role: DossierRole;
  authorizationVersion: number;
}

export interface CurrentDelegatedGrant {
  id: string;
  currentGrantId: string;
  revision: number;
  currentRevision: number;
  organizationId: string;
  actorId: string;
  action: "member_invite" | "member_suspend";
  status: "active" | "revoked" | "superseded";
  expiresAtEpochSeconds: number;
  membershipAuthorizationVersion: number;
  policyRevision: number;
}

export interface ComplianceExportAuthority {
  grantId: string;
  currentGrantId: string;
  grantRevision: number;
  currentGrantRevision: number;
  organizationId: string;
  actorId: string;
  status: "active" | "revoked" | "superseded";
  expiresAtEpochSeconds: number;
  membershipAuthorizationVersion: number;
  policyRevision: number;
  exportRequest: {
    id: string;
    organizationId: string;
    manifestDigest: string;
    requestReceiptSha256: string;
    currentRequestReceiptSha256: string;
    requestedByActorId: string;
    expiresAtEpochSeconds: number;
    state: "pending" | "approved" | "rejected" | "expired" | "consumed";
    stateAuthorizationVersion: number;
    currentStateAuthorizationVersion: number;
    dossierIds: readonly string[];
    ownerApprovals: readonly {
      dossierId: string;
      exportRequestId: string;
      approvalVersion: typeof DOSSIER_EXPORT_APPROVAL_VERSION;
      approvalReceiptId: string;
      approvalReceiptSha256: string;
      currentApprovalReceiptSha256: string;
      requestReceiptSha256: string;
      organizationId: string;
      approvedByActorId: string;
      currentOwnerActorId: string;
      ownerMembershipAuthorizationVersion: number;
      currentOwnerMembershipAuthorizationVersion: number;
      dossierManifestSha256: string;
      currentDossierManifestSha256: string;
      policyRevision: number;
      expiresAtEpochSeconds: number;
      status: "active" | "revoked" | "superseded";
    }[];
  };
}

/** Durable adapters must implement the same compare-and-swap in one transaction. */
export class InMemoryExportAcquisitionStore {
  readonly #states = new Map<
    string,
    {
      organizationId: string;
      exportRequestId: string;
      version: number;
      status: "approved" | "rejected" | "expired" | "consumed";
      expiresAtEpochSeconds: number;
    }
  >();
  readonly #tails = new Map<string, Promise<void>>();
  readonly #trustedNowEpochSeconds: () => number;

  constructor(
    trustedNowEpochSeconds: () => number = () => Math.floor(Date.now() / 1_000),
  ) {
    this.#trustedNowEpochSeconds = trustedNowEpochSeconds;
  }

  seed(input: {
    organizationId: string;
    exportRequestId: string;
    version: number;
    status: "approved" | "rejected" | "expired" | "consumed";
    expiresAtEpochSeconds: number;
  }): void {
    const snapshot = structuredClone(input);
    const key = `${snapshot.organizationId}:${snapshot.exportRequestId}`;
    if (
      !isOpaqueId(snapshot.organizationId) ||
      !isOpaqueId(snapshot.exportRequestId) ||
      !isPositiveSafeInteger(snapshot.version) ||
      !isPositiveSafeInteger(snapshot.expiresAtEpochSeconds) ||
      !["approved", "rejected", "expired", "consumed"].includes(
        snapshot.status,
      ) ||
      this.#states.has(key)
    ) {
      throw new TypeError("invalid export state");
    }
    this.#states.set(key, snapshot);
  }

  inspectForTest(organizationId: string, exportRequestId: string) {
    const state = this.#states.get(`${organizationId}:${exportRequestId}`);
    return state ? structuredClone(state) : undefined;
  }

  async acquire(input: {
    organizationId: string;
    exportRequestId: string;
    expectedVersion: number;
  }): Promise<boolean> {
    const snapshot = structuredClone(input);
    const nowEpochSeconds = this.#trustedNowEpochSeconds();
    if (
      !isOpaqueId(snapshot.organizationId) ||
      !isOpaqueId(snapshot.exportRequestId) ||
      !isPositiveSafeInteger(snapshot.expectedVersion) ||
      !isPositiveSafeInteger(nowEpochSeconds)
    ) {
      return false;
    }
    const key = `${snapshot.organizationId}:${snapshot.exportRequestId}`;
    let release!: () => void;
    const prior = this.#tails.get(key) ?? Promise.resolve();
    this.#tails.set(
      key,
      new Promise<void>((resolve) => {
        release = resolve;
      }),
    );
    await prior;
    try {
      const state = this.#states.get(key);
      if (
        !state ||
        state.organizationId !== snapshot.organizationId ||
        state.exportRequestId !== snapshot.exportRequestId ||
        state.status !== "approved" ||
        state.version !== snapshot.expectedVersion ||
        state.expiresAtEpochSeconds <= nowEpochSeconds
      ) {
        return false;
      }
      this.#states.set(key, {
        ...state,
        status: "consumed",
        version: state.version + 1,
      });
      return true;
    } finally {
      release();
    }
  }
}

export interface PolicyActivationApproval {
  approvalVersion: typeof POLICY_ACTIVATION_APPROVAL_VERSION;
  requestId: string;
  currentRequestId: string;
  requestRevision: number;
  currentRequestRevision: number;
  organizationId: string;
  expectedCurrentPolicyRevision: number;
  expectedCurrentPointerVersion: number;
  targetPolicyRevision: number;
  targetPolicyReceiptSha256: string;
  requestedByActorId: string;
  approvedByActorId: string;
  approverRole: "org_owner" | "org_admin";
  approverMembershipAuthorizationVersion: number;
  currentApproverMembershipAuthorizationVersion: number;
  approvalReceiptId: string;
  approvalReceiptSha256: string;
  currentApprovalReceiptSha256: string;
  expiresAtEpochSeconds: number;
  status: "approved" | "revoked" | "superseded";
}

/**
 * Reference compare-and-swap for the operation that advances a current-policy
 * pointer. Draft `policy_manage` authorization alone can never call this path.
 */
export class InMemoryPolicyActivationStore {
  readonly #states = new Map<
    string,
    { organizationId: string; policyRevision: number; pointerVersion: number }
  >();
  readonly #tails = new Map<string, Promise<void>>();
  readonly #trustedNowEpochSeconds: () => number;

  constructor(
    trustedNowEpochSeconds: () => number = () => Math.floor(Date.now() / 1_000),
  ) {
    this.#trustedNowEpochSeconds = trustedNowEpochSeconds;
  }

  seed(
    organizationId: string,
    policyRevision: number,
    pointerVersion = 1,
  ): void {
    if (
      !isOpaqueId(organizationId) ||
      !isPositiveSafeInteger(policyRevision) ||
      !isPositiveSafeInteger(pointerVersion) ||
      this.#states.has(organizationId)
    ) {
      throw new TypeError("invalid policy pointer state");
    }
    this.#states.set(organizationId, {
      organizationId,
      policyRevision,
      pointerVersion,
    });
  }

  inspectForTest(organizationId: string) {
    const state = this.#states.get(organizationId);
    return state ? structuredClone(state) : undefined;
  }

  async activate(input: {
    organizationId: string;
    expectedCurrentPolicyRevision: number;
    expectedCurrentPointerVersion: number;
    targetPolicyRevision: number;
    targetPolicyReceiptSha256: string;
    authenticatedApproverActorId: string;
    approval: PolicyActivationApproval;
  }): Promise<boolean> {
    const snapshot = structuredClone(input);
    const nowEpochSeconds = this.#trustedNowEpochSeconds();
    if (
      !isOpaqueId(snapshot.organizationId) ||
      !isOpaqueId(snapshot.authenticatedApproverActorId) ||
      !isPositiveSafeInteger(snapshot.expectedCurrentPolicyRevision) ||
      !isPositiveSafeInteger(snapshot.expectedCurrentPointerVersion) ||
      !isPositiveSafeInteger(snapshot.targetPolicyRevision) ||
      !isPositiveSafeInteger(nowEpochSeconds) ||
      !isSha256(snapshot.targetPolicyReceiptSha256)
    ) {
      return false;
    }
    let release!: () => void;
    const prior = this.#tails.get(snapshot.organizationId) ?? Promise.resolve();
    this.#tails.set(
      snapshot.organizationId,
      new Promise<void>((resolve) => {
        release = resolve;
      }),
    );
    await prior;
    try {
      const state = this.#states.get(snapshot.organizationId);
      const approval = snapshot.approval;
      if (
        !state ||
        state.policyRevision !== snapshot.expectedCurrentPolicyRevision ||
        state.pointerVersion !== snapshot.expectedCurrentPointerVersion ||
        snapshot.targetPolicyRevision !== state.policyRevision + 1 ||
        approval.approvalVersion !== POLICY_ACTIVATION_APPROVAL_VERSION ||
        !isOpaqueId(approval.requestId) ||
        approval.requestId !== approval.currentRequestId ||
        !isPositiveSafeInteger(approval.requestRevision) ||
        approval.requestRevision !== approval.currentRequestRevision ||
        approval.organizationId !== snapshot.organizationId ||
        approval.expectedCurrentPolicyRevision !== state.policyRevision ||
        approval.expectedCurrentPointerVersion !== state.pointerVersion ||
        approval.targetPolicyRevision !== snapshot.targetPolicyRevision ||
        approval.targetPolicyReceiptSha256 !==
          snapshot.targetPolicyReceiptSha256 ||
        !isOpaqueId(approval.requestedByActorId) ||
        !isOpaqueId(approval.approvedByActorId) ||
        approval.requestedByActorId === approval.approvedByActorId ||
        approval.approvedByActorId !== snapshot.authenticatedApproverActorId ||
        !["org_owner", "org_admin"].includes(approval.approverRole) ||
        !isPositiveSafeInteger(
          approval.approverMembershipAuthorizationVersion,
        ) ||
        approval.approverMembershipAuthorizationVersion !==
          approval.currentApproverMembershipAuthorizationVersion ||
        !isOpaqueId(approval.approvalReceiptId) ||
        !isSha256(approval.approvalReceiptSha256) ||
        approval.approvalReceiptSha256 !==
          approval.currentApprovalReceiptSha256 ||
        approval.expiresAtEpochSeconds <= nowEpochSeconds ||
        approval.status !== "approved"
      ) {
        return false;
      }
      this.#states.set(snapshot.organizationId, {
        organizationId: snapshot.organizationId,
        policyRevision: snapshot.targetPolicyRevision,
        pointerVersion: state.pointerVersion + 1,
      });
      return true;
    } finally {
      release();
    }
  }
}

export interface CurrentSecurityApproval {
  requestId: string;
  currentRequestId: string;
  revision: number;
  currentRevision: number;
  organizationId: string;
  targetDossierId: string;
  action: "legal_hold_create_approve" | "legal_hold_release_approve";
  requestAction: "legal_hold_create_request" | "legal_hold_release_request";
  requestedByActorId: string;
  approvedByActorId: string;
  approverBasis: "dossier_reviewer" | "organization_admin";
  targetObjectGraphSha256: string;
  requestRecordBindingReceiptSha256: string;
  approvalSessionBindingSha256: string;
  separationOfDutiesReceiptSha256: string;
  approvalMembershipAuthorizationVersion: number;
  currentApprovalMembershipAuthorizationVersion: number;
  policyRevision: number;
  approvalReceiptId: string;
  approvalReceiptSha256: string;
  currentApprovalReceiptSha256: string;
  expiresAtEpochSeconds: number;
  status: "approved" | "revoked" | "superseded";
}

export interface AuthorizationContext {
  nowEpochSeconds: number;
  identityBoundary?: {
    verified: boolean;
    actorId: string;
    action: "oidc_callback" | "invitation_acceptance";
  };
  session?: ActiveSessionContext;
  organization?: OrganizationAuthorizationContext;
  membership?: OrganizationMembershipContext;
  policy?: {
    organizationId: string;
    revision: number;
    currentRevision: number;
    status: "current" | "superseded";
  };
  identityConnection?: {
    id: string;
    organizationId: string;
    enabled: boolean;
    configurationVersion: number;
    currentConfigurationVersion: number;
  };
  dossier?: DossierAuthorizationContext;
  participant?: DossierParticipantContext;
  resource?: {
    organizationId: string;
    dossierId?: string;
    revision: number;
    currentRevision: number;
    resourceDigest: string;
  };
  delegatedGrant?: CurrentDelegatedGrant;
  complianceAuthority?: ComplianceExportAuthority;
  securityApproval?: CurrentSecurityApproval;
  tenantManifest?: VerifiedTenantResourceManifest;
  decisionReceiptBoundary?: {
    requestCorrelationSha256: string;
    deploymentSha: string;
    environment: "development" | "validation";
    authenticationMethod:
      | "entra_oidc"
      | "session_cookie"
      | "invitation_token"
      | "local_test";
  };
}

export type AuthorizationAuditReason =
  | "class_or_scope_denied"
  | "identity_boundary_denied"
  | "session_denied"
  | "tenant_boundary_denied"
  | "organization_inactive"
  | "membership_denied"
  | "stale_authorization"
  | "stale_policy"
  | "identity_connection_denied"
  | "role_denied"
  | "participant_denied"
  | "stale_grant"
  | "manifest_denied"
  | "separation_of_duties_denied"
  | "malformed_context_denied"
  | "stale_resource_denied"
  | "decision_receipt_boundary_denied"
  | "phase_not_enabled";

export interface AuthorizationDecisionReceipt {
  schemaVersion: "authorization-decision-receipt.v1";
  eventType: "authorization_decision";
  evidenceStatus: "complete" | "incomplete";
  actorId: string | null;
  sessionId: string | null;
  authenticationMethod:
    | "entra_oidc"
    | "session_cookie"
    | "invitation_token"
    | "local_test"
    | "unverified";
  organizationId: string | null;
  dossierId: string | null;
  targetDossierId: string | null;
  resourceDigest: string | null;
  requestClass: AuthorizationRequestClass | "unrecognized";
  scope: AuthorizationScope | "unrecognized";
  action: TenantAction | "unrecognized";
  policyVersion: typeof ROLE_ACTION_POLICY_VERSION;
  organizationAuthorizationVersion: number | null;
  membershipAuthorizationVersion: number | null;
  participantAuthorizationVersion: number | null;
  policyRevision: number | null;
  identityConfigurationVersion: number | null;
  resourceRevision: number | null;
  tenantManifestRevision: number | null;
  requestCorrelationSha256: string | null;
  outcome: "allowed" | "denied";
  reasonCode: "authorized" | AuthorizationAuditReason;
  serverTimestampEpochSeconds: number | null;
  deploymentSha: string | null;
  environment: TenantResourceEnvironment | "unverified";
  reviewerActorId: string | null;
}

export type AuthorizationDecision =
  | {
      allowed: true;
      code: "allowed";
      organizationAuthorizationVersion?: number;
      membershipAuthorizationVersion?: number;
      participantAuthorizationVersion?: number;
      receipt: AuthorizationDecisionReceipt;
    }
  | {
      allowed: false;
      code: "denied";
      auditReason: AuthorizationAuditReason;
      receipt: AuthorizationDecisionReceipt;
    };

export type PublicAuthorizationResult =
  | { ok: true; status: 204; code: "authorized" }
  | { ok: false; status: 404; code: "resource_unavailable" };

export function toPublicAuthorizationResult(
  decision: AuthorizationDecision,
): PublicAuthorizationResult {
  return decision.allowed
    ? { ok: true, status: 204, code: "authorized" }
    : { ok: false, status: 404, code: "resource_unavailable" };
}

function receiptBoundaryIsComplete(
  request: AuthorizationRequest,
  context: AuthorizationContext,
): boolean {
  const boundary = context.decisionReceiptBoundary;
  const identityScope = request.scope === "identity";
  return Boolean(
    boundary &&
      isSha256(boundary.requestCorrelationSha256) &&
      /^[a-f0-9]{40}$/u.test(boundary.deploymentSha) &&
      ["entra_oidc", "session_cookie", "invitation_token", "local_test"].some(
        (method) => method === boundary.authenticationMethod,
      ) &&
      (boundary.environment === "development" ||
        boundary.environment === "validation") &&
      isPositiveSafeInteger(context.nowEpochSeconds) &&
      isOpaqueId(request.actorId) &&
      (identityScope ||
        (isOpaqueId(context.session?.id) &&
          isOpaqueId(context.organization?.id) &&
          isSha256(context.resource?.resourceDigest) &&
          isPositiveSafeInteger(
            request.expectedOrganizationAuthorizationVersion,
          ) &&
          isPositiveSafeInteger(
            request.expectedMembershipAuthorizationVersion,
          ) &&
          isPositiveSafeInteger(request.expectedPolicyRevision) &&
          isPositiveSafeInteger(request.expectedResourceRevision) &&
          (request.scope !== "dossier" ||
            isPositiveSafeInteger(
              request.expectedParticipantAuthorizationVersion,
            )))),
  );
}

function buildDecisionReceipt(
  request: AuthorizationRequest,
  context: AuthorizationContext,
  outcome: "allowed" | "denied",
  reasonCode: "authorized" | AuthorizationAuditReason,
): AuthorizationDecisionReceipt {
  const boundary = context.decisionReceiptBoundary;
  const complete = receiptBoundaryIsComplete(request, context);
  return Object.freeze({
    schemaVersion: "authorization-decision-receipt.v1",
    eventType: "authorization_decision",
    evidenceStatus: complete ? "complete" : "incomplete",
    actorId:
      SEPARATION_OF_DUTIES_ACTIONS.includes(request.action as never) &&
      isOpaqueId(context.securityApproval?.requestedByActorId)
        ? context.securityApproval.requestedByActorId
        : isOpaqueId(request.actorId)
          ? request.actorId
          : null,
    sessionId: isOpaqueId(context.session?.id) ? context.session.id : null,
    authenticationMethod:
      boundary &&
      ["entra_oidc", "session_cookie", "invitation_token", "local_test"].includes(
        boundary.authenticationMethod,
      )
        ? boundary.authenticationMethod
        : "unverified",
    organizationId: isOpaqueId(context.organization?.id)
      ? context.organization.id
      : null,
    dossierId:
      request.scope === "dossier" && isOpaqueId(context.dossier?.id)
        ? context.dossier.id
        : null,
    targetDossierId:
      request.scope === "organization" &&
      separationOfDutiesActions.has(request.action) &&
      isOpaqueId(context.resource?.dossierId)
        ? context.resource.dossierId
        : null,
    resourceDigest: isSha256(context.resource?.resourceDigest)
      ? context.resource.resourceDigest
      : null,
    requestClass: Object.prototype.hasOwnProperty.call(
      REQUEST_CLASS_ACTIONS,
      request.requestClass,
    )
      ? request.requestClass
      : "unrecognized",
    scope: ["identity", "organization", "dossier"].includes(request.scope)
      ? request.scope
      : "unrecognized",
    action: TENANT_ACTIONS.some((action) => action === request.action)
      ? request.action
      : "unrecognized",
    policyVersion: ROLE_ACTION_POLICY_VERSION,
    organizationAuthorizationVersion: isPositiveSafeInteger(
      request.expectedOrganizationAuthorizationVersion,
    )
      ? request.expectedOrganizationAuthorizationVersion
      : null,
    membershipAuthorizationVersion: isPositiveSafeInteger(
      request.expectedMembershipAuthorizationVersion,
    )
      ? request.expectedMembershipAuthorizationVersion
      : null,
    participantAuthorizationVersion: isPositiveSafeInteger(
      request.expectedParticipantAuthorizationVersion,
    )
      ? request.expectedParticipantAuthorizationVersion
      : null,
    policyRevision: isPositiveSafeInteger(request.expectedPolicyRevision)
      ? request.expectedPolicyRevision
      : null,
    identityConfigurationVersion: isPositiveSafeInteger(
      request.expectedIdentityConfigurationVersion,
    )
      ? request.expectedIdentityConfigurationVersion
      : null,
    resourceRevision: isPositiveSafeInteger(request.expectedResourceRevision)
      ? request.expectedResourceRevision
      : null,
    tenantManifestRevision: isPositiveSafeInteger(
      request.expectedTenantManifestRevision,
    )
      ? request.expectedTenantManifestRevision
      : null,
    requestCorrelationSha256: isSha256(boundary?.requestCorrelationSha256)
      ? boundary.requestCorrelationSha256
      : null,
    outcome,
    reasonCode,
    serverTimestampEpochSeconds: isPositiveSafeInteger(context.nowEpochSeconds)
      ? context.nowEpochSeconds
      : null,
    deploymentSha:
      boundary && /^[a-f0-9]{40}$/u.test(boundary.deploymentSha)
        ? boundary.deploymentSha
        : null,
    environment:
      boundary?.environment === "development" ||
      boundary?.environment === "validation"
        ? boundary.environment
        : "unverified",
    reviewerActorId:
      separationOfDutiesActions.has(request.action) &&
      isOpaqueId(context.securityApproval?.approvedByActorId)
      ? context.securityApproval.approvedByActorId
      : null,
  });
}

function deny(
  request: AuthorizationRequest,
  context: AuthorizationContext,
  auditReason: AuthorizationAuditReason,
): AuthorizationDecision {
  return {
    allowed: false,
    code: "denied",
    auditReason,
    receipt: buildDecisionReceipt(request, context, "denied", auditReason),
  };
}

function allow(
  request: AuthorizationRequest,
  context: AuthorizationContext,
): AuthorizationDecision {
  return {
    allowed: true,
    code: "allowed",
    ...(isPositiveSafeInteger(request.expectedOrganizationAuthorizationVersion)
      ? {
          organizationAuthorizationVersion:
            request.expectedOrganizationAuthorizationVersion,
        }
      : {}),
    ...(isPositiveSafeInteger(request.expectedMembershipAuthorizationVersion)
      ? {
          membershipAuthorizationVersion:
            request.expectedMembershipAuthorizationVersion,
        }
      : {}),
    ...(isPositiveSafeInteger(request.expectedParticipantAuthorizationVersion)
      ? {
          participantAuthorizationVersion:
            request.expectedParticipantAuthorizationVersion,
        }
      : {}),
    receipt: buildDecisionReceipt(request, context, "allowed", "authorized"),
  };
}

function includesAction(
  values: readonly TenantAction[] | unknown,
  action: TenantAction,
): boolean {
  return Array.isArray(values) && values.some((value) => value === action);
}

function scopeAllows(action: TenantAction, scope: AuthorizationScope): boolean {
  const explicitScopes = ACTION_SCOPES[action];
  if (explicitScopes) {
    return explicitScopes.some((candidate) => candidate === scope);
  }
  if (IDENTITY_ACTIONS.has(action)) {
    return scope === "identity";
  }
  if (DOSSIER_ACTIONS.has(action)) {
    return scope === "dossier";
  }
  return scope === "organization";
}

function exactUniqueSetEqual(
  left: readonly string[],
  right: readonly string[],
): boolean {
  const leftSet = new Set(left);
  const rightSet = new Set(right);
  return (
    leftSet.size === left.length &&
    rightSet.size === right.length &&
    leftSet.size === rightSet.size &&
    [...leftSet].every((value) => rightSet.has(value))
  );
}

function hasCurrentDelegatedAuthority(
  request: AuthorizationRequest,
  context: AuthorizationContext,
): boolean {
  const submitted = request.submittedDelegatedGrant;
  const grant = context.delegatedGrant;
  return Boolean(
    submitted &&
      grant &&
      isOpaqueId(submitted.id) &&
      isPositiveSafeInteger(submitted.revision) &&
      isOpaqueId(grant.id) &&
      isPositiveSafeInteger(grant.revision) &&
      grant.status === "active" &&
      grant.expiresAtEpochSeconds > context.nowEpochSeconds &&
      grant.id === grant.currentGrantId &&
      grant.revision === grant.currentRevision &&
      submitted.id === grant.id &&
      submitted.revision === grant.revision &&
      grant.organizationId === request.organizationId &&
      grant.actorId === request.actorId &&
      grant.action === request.action &&
      grant.membershipAuthorizationVersion === context.membership?.authorizationVersion &&
      grant.membershipAuthorizationVersion === request.expectedMembershipAuthorizationVersion &&
      grant.policyRevision === context.policy?.currentRevision &&
      grant.policyRevision === request.expectedPolicyRevision
  );
}

function hasCurrentComplianceAuthority(
  request: AuthorizationRequest,
  context: AuthorizationContext,
): boolean {
  const submitted = request.submittedComplianceAuthority;
  const authority = context.complianceAuthority;
  const manifest = context.tenantManifest;
  if (
    !submitted ||
    !authority ||
    !manifest ||
    authority.status !== "active" ||
    authority.expiresAtEpochSeconds <= context.nowEpochSeconds ||
    authority.membershipAuthorizationVersion !== context.membership?.authorizationVersion ||
    authority.membershipAuthorizationVersion !== request.expectedMembershipAuthorizationVersion ||
    authority.policyRevision !== context.policy?.currentRevision ||
    authority.policyRevision !== request.expectedPolicyRevision ||
    authority.grantId !== authority.currentGrantId ||
    authority.grantRevision !== authority.currentGrantRevision ||
    submitted.grantId !== authority.grantId ||
    submitted.grantRevision !== authority.grantRevision ||
    submitted.exportRequestId !== authority.exportRequest.id ||
    submitted.manifestDigest !== authority.exportRequest.manifestDigest ||
    submitted.manifestDigest !== manifest.canonicalManifestSha256 ||
    !Array.isArray(submitted.dossierIds) ||
    !Array.isArray(authority.exportRequest.dossierIds) ||
    !Array.isArray(authority.exportRequest.ownerApprovals) ||
    !isOpaqueId(authority.grantId) ||
    !isPositiveSafeInteger(authority.grantRevision) ||
    !isOpaqueId(authority.exportRequest.id) ||
    !isOpaqueId(authority.exportRequest.requestedByActorId) ||
    !isSha256(authority.exportRequest.requestReceiptSha256) ||
    authority.exportRequest.requestReceiptSha256 !==
      authority.exportRequest.currentRequestReceiptSha256 ||
    authority.exportRequest.expiresAtEpochSeconds <= context.nowEpochSeconds ||
    authority.exportRequest.state !== "approved" ||
    authority.exportRequest.stateAuthorizationVersion !== authority.exportRequest.currentStateAuthorizationVersion ||
    !isPositiveSafeInteger(authority.exportRequest.stateAuthorizationVersion) ||
    !isSha256(authority.exportRequest.manifestDigest) ||
    !Array.from(submitted.dossierIds).every(isOpaqueId) ||
    !Array.from(authority.exportRequest.dossierIds).every(isOpaqueId) ||
    !Array.from(authority.exportRequest.ownerApprovals).every(
      (approval) =>
        approval !== null &&
        typeof approval === "object" &&
        isOpaqueId(approval.dossierId) &&
        isOpaqueId(approval.exportRequestId) &&
        approval.approvalVersion === DOSSIER_EXPORT_APPROVAL_VERSION &&
        isOpaqueId(approval.approvalReceiptId) &&
        isSha256(approval.approvalReceiptSha256) &&
        isSha256(approval.currentApprovalReceiptSha256) &&
        isSha256(approval.requestReceiptSha256) &&
        isOpaqueId(approval.organizationId) &&
        isOpaqueId(approval.approvedByActorId) &&
        isOpaqueId(approval.currentOwnerActorId) &&
        isSha256(approval.dossierManifestSha256) &&
        ["active", "revoked", "superseded"].includes(approval.status),
    ) ||
    authority.organizationId !== request.organizationId ||
    authority.actorId !== request.actorId ||
    authority.exportRequest.organizationId !== request.organizationId ||
    authority.exportRequest.requestedByActorId !== authority.actorId ||
    !exactUniqueSetEqual(submitted.dossierIds, authority.exportRequest.dossierIds) ||
    !exactUniqueSetEqual(
      authority.exportRequest.ownerApprovals.map((approval) => approval.dossierId),
      authority.exportRequest.dossierIds,
    ) ||
    new Set(
      authority.exportRequest.ownerApprovals.map(
        (approval) => approval.approvalReceiptId,
      ),
    ).size !== authority.exportRequest.ownerApprovals.length
  ) {
    return false;
  }
  return authority.exportRequest.dossierIds.every((dossierId) => {
    const approval = authority.exportRequest.ownerApprovals.find(
      (item) => item.dossierId === dossierId,
    );
    return Boolean(
      approval &&
        approval.status === "active" &&
        approval.organizationId === request.organizationId &&
        approval.exportRequestId === authority.exportRequest.id &&
        approval.requestReceiptSha256 ===
          authority.exportRequest.requestReceiptSha256 &&
        approval.approvalVersion === DOSSIER_EXPORT_APPROVAL_VERSION &&
        approval.approvalReceiptSha256 ===
          approval.currentApprovalReceiptSha256 &&
        approval.ownerMembershipAuthorizationVersion === approval.currentOwnerMembershipAuthorizationVersion &&
        approval.policyRevision === request.expectedPolicyRevision &&
        approval.expiresAtEpochSeconds > context.nowEpochSeconds &&
        approval.approvedByActorId === approval.currentOwnerActorId &&
        approval.approvedByActorId !== authority.exportRequest.requestedByActorId &&
        approval.dossierManifestSha256 === approval.currentDossierManifestSha256,
    );
  });
}

function hasCurrentSecurityApproval(
  request: AuthorizationRequest,
  context: AuthorizationContext,
): boolean {
  const submitted = request.submittedSecurityApproval;
  const approval = context.securityApproval;
  const expectedRequestAction =
    request.action === "legal_hold_create_approve"
      ? "legal_hold_create_request"
      : "legal_hold_release_request";
  const expectedApproverBasis =
    request.scope === "dossier" ? "dossier_reviewer" : "organization_admin";
  const scopeBindingIsExact =
    request.scope === "dossier"
      ? approval?.targetDossierId === request.dossierId
      : request.dossierId === undefined &&
        approval?.targetDossierId === context.resource?.dossierId;
  const receiptDigestsAreValid = Boolean(
    approval &&
      context.resource &&
      isSha256(approval.targetObjectGraphSha256) &&
      approval.targetObjectGraphSha256 === context.resource.resourceDigest &&
      isSha256(approval.requestRecordBindingReceiptSha256) &&
      isSha256(approval.approvalSessionBindingSha256) &&
      isSha256(approval.separationOfDutiesReceiptSha256),
  );
  return Boolean(
    submitted &&
      approval &&
      isOpaqueId(submitted.requestId) &&
      isPositiveSafeInteger(submitted.revision) &&
      isOpaqueId(approval.requestId) &&
      isOpaqueId(approval.targetDossierId) &&
      isPositiveSafeInteger(approval.revision) &&
      approval.status === "approved" &&
      approval.requestId === approval.currentRequestId &&
      approval.revision === approval.currentRevision &&
      submitted.requestId === approval.requestId &&
      submitted.revision === approval.revision &&
      approval.organizationId === request.organizationId &&
      scopeBindingIsExact &&
      approval.action === request.action &&
      approval.requestAction === expectedRequestAction &&
      approval.approverBasis === expectedApproverBasis &&
      isOpaqueId(approval.requestedByActorId) &&
      isOpaqueId(approval.approvedByActorId) &&
      approval.approvedByActorId === request.actorId &&
      approval.requestedByActorId !== approval.approvedByActorId &&
      approval.approvalMembershipAuthorizationVersion ===
        context.membership?.authorizationVersion &&
      approval.approvalMembershipAuthorizationVersion ===
        approval.currentApprovalMembershipAuthorizationVersion &&
      approval.policyRevision === request.expectedPolicyRevision &&
      approval.expiresAtEpochSeconds > context.nowEpochSeconds &&
      isOpaqueId(approval.approvalReceiptId) &&
      isSha256(approval.approvalReceiptSha256) &&
      approval.approvalReceiptSha256 ===
        approval.currentApprovalReceiptSha256 &&
      receiptDigestsAreValid,
  );
}

function hasUsableTenantManifest(
  request: AuthorizationRequest,
  context: AuthorizationContext,
): boolean {
  const verified = context.tenantManifest;
  const organization = context.organization;
  if (
    !isVerifiedTenantResourceManifest(verified) ||
    !organization ||
    verified.verificationVersion !== "tenant-resource-manifest-verification.v1" ||
    verified.schemaId !==
      "https://genesis.invalid/contracts/tenant-resource-manifest.v1.schema.json" ||
    !isSha256(verified.schemaValidationReceiptSha256) ||
    !isSha256(verified.canonicalManifestSha256) ||
    !Number.isFinite(verified.validUntilEpochSeconds) ||
    verified.validUntilEpochSeconds <= 0 ||
    !isPositiveSafeInteger(request.expectedTenantManifestRevision) ||
    verified.manifestRevision !== request.expectedTenantManifestRevision ||
    verified.manifestRevision !== verified.currentManifestRevision ||
    verified.validUntilEpochSeconds <= context.nowEpochSeconds ||
    verified.productionEvidenceStatus !== "unverified_external_dependency" ||
    verified.manifest.organization_id !== request.organizationId ||
    verified.manifest.organization_id !== organization.id ||
    verified.manifest.environment === "production" ||
    verified.manifest.activation !== "validation" ||
    organization.confidentialDocumentMode !== "validation" ||
    (request.dataClassification !== "synthetic" &&
      request.dataClassification !== "deidentified")
  ) {
    return false;
  }
  return true;
}

/**
 * Central deny-by-default policy decision point. Every non-identity authorization
 * requires exact session, tenant, resource, membership, version, and (for dossier
 * scope) participant alignment. Organization roles never create ambient dossier
 * access.
 */
export function decideTenantAuthorization(
  request: AuthorizationRequest,
  context: AuthorizationContext,
): AuthorizationDecision {
  if (
    !Object.prototype.hasOwnProperty.call(
      REQUEST_CLASS_ACTIONS,
      request.requestClass,
    ) ||
    !includesAction(REQUEST_CLASS_ACTIONS[request.requestClass], request.action) ||
    !scopeAllows(request.action, request.scope)
  ) {
    return deny(request, context, "class_or_scope_denied");
  }
  if (!isOpaqueId(request.actorId) || !isPositiveSafeInteger(context.nowEpochSeconds)) {
    return deny(request, context, "malformed_context_denied");
  }
  if (!receiptBoundaryIsComplete(request, context)) {
    return deny(request, context, "decision_receipt_boundary_denied");
  }
  if (phaseBServerDisabledActions.has(request.action)) {
    return deny(request, context, "phase_not_enabled");
  }

  if (request.scope === "identity") {
    return context.identityBoundary?.verified === true &&
      context.identityBoundary.actorId === request.actorId &&
      context.identityBoundary.action === request.action
      ? allow(request, context)
      : deny(request, context, "identity_boundary_denied");
  }

  const session = context.session;
  const organization = context.organization;
  const membership = context.membership;
  const policy = context.policy;
  const resource = context.resource;
  if (
    !session ||
    !isOpaqueId(session.id) ||
    !isOpaqueId(session.actorId) ||
    !isOpaqueId(session.organizationId) ||
    !["local", "chatgpt", "entra_oidc"].includes(
      session.authenticationMethod,
    ) ||
    !isPositiveSafeInteger(session.organizationAuthorizationVersion) ||
    !isPositiveSafeInteger(session.membershipAuthorizationVersion) ||
    !isPositiveSafeInteger(session.policyRevision) ||
    !isPositiveSafeInteger(session.issuedAtEpochSeconds) ||
    !isPositiveSafeInteger(session.expiresAtEpochSeconds) ||
    session.status !== "active" ||
    session.issuedAtEpochSeconds > context.nowEpochSeconds ||
    session.issuedAtEpochSeconds <
      context.nowEpochSeconds - TENANT_SESSION_MAX_LIFETIME_SECONDS ||
    session.expiresAtEpochSeconds >
      session.issuedAtEpochSeconds + TENANT_SESSION_MAX_LIFETIME_SECONDS ||
    session.expiresAtEpochSeconds <= context.nowEpochSeconds ||
    session.actorId !== request.actorId
  ) {
    return deny(request, context, "session_denied");
  }
  if (
    !isOpaqueId(request.organizationId) ||
    !organization ||
    !isOpaqueId(organization.id) ||
    !isPositiveSafeInteger(organization.authorizationVersion) ||
    !resource ||
    !isOpaqueId(resource.organizationId) ||
    !isSha256(resource.resourceDigest) ||
    session.organizationId !== request.organizationId ||
    organization.id !== request.organizationId ||
    resource.organizationId !== request.organizationId
  ) {
    return deny(request, context, "tenant_boundary_denied");
  }
  if (
    !isPositiveSafeInteger(request.expectedResourceRevision) ||
    !isPositiveSafeInteger(resource.revision) ||
    !isPositiveSafeInteger(resource.currentRevision) ||
    resource.revision !== resource.currentRevision ||
    resource.currentRevision !== request.expectedResourceRevision
  ) {
    return deny(request, context, "stale_resource_denied");
  }
  if (organization.status !== "active") {
    return deny(request, context, "organization_inactive");
  }
  if (
    !membership ||
    !isOpaqueId(membership.actorId) ||
    !isOpaqueId(membership.organizationId) ||
    !isPositiveSafeInteger(membership.authorizationVersion) ||
    membership.status !== "active" ||
    membership.actorId !== request.actorId ||
    membership.organizationId !== request.organizationId
  ) {
    return deny(request, context, "membership_denied");
  }
  if (
    !isPositiveSafeInteger(
      request.expectedOrganizationAuthorizationVersion,
    ) ||
    session.organizationAuthorizationVersion !==
      request.expectedOrganizationAuthorizationVersion ||
    organization.authorizationVersion !==
      request.expectedOrganizationAuthorizationVersion ||
    !isPositiveSafeInteger(
      request.expectedMembershipAuthorizationVersion,
    ) ||
    session.membershipAuthorizationVersion !==
      request.expectedMembershipAuthorizationVersion ||
    membership.authorizationVersion !==
      request.expectedMembershipAuthorizationVersion
  ) {
    return deny(request, context, "stale_authorization");
  }
  if (
    !policy ||
    !isOpaqueId(policy.organizationId) ||
    !isPositiveSafeInteger(policy.revision) ||
    !isPositiveSafeInteger(policy.currentRevision) ||
    !isPositiveSafeInteger(request.expectedPolicyRevision) ||
    policy.organizationId !== request.organizationId ||
    policy.status !== "current" ||
    policy.revision !== policy.currentRevision ||
    policy.currentRevision !== request.expectedPolicyRevision ||
    session.policyRevision !== request.expectedPolicyRevision
  ) {
    return deny(request, context, "stale_policy");
  }
  const sessionUsesEntra = session.authenticationMethod === "entra_oidc";
  if (
    sessionUsesEntra
      ? !context.identityConnection ||
        !isOpaqueId(session.identityConnectionId) ||
        !isPositiveSafeInteger(session.identityConfigurationVersion) ||
        !isPositiveSafeInteger(request.expectedIdentityConfigurationVersion) ||
        !isOpaqueId(context.identityConnection.id) ||
        !isOpaqueId(context.identityConnection.organizationId) ||
        !isPositiveSafeInteger(context.identityConnection.configurationVersion) ||
        !isPositiveSafeInteger(
          context.identityConnection.currentConfigurationVersion,
        ) ||
        context.identityConnection.enabled !== true ||
        context.identityConnection.organizationId !== request.organizationId ||
        context.identityConnection.id !== session.identityConnectionId ||
        context.identityConnection.configurationVersion !==
          context.identityConnection.currentConfigurationVersion ||
        context.identityConnection.currentConfigurationVersion !==
          request.expectedIdentityConfigurationVersion ||
        session.identityConfigurationVersion !==
          request.expectedIdentityConfigurationVersion
      : session.identityConnectionId !== undefined ||
        session.identityConfigurationVersion !== undefined ||
        request.expectedIdentityConfigurationVersion !== undefined
  ) {
    return deny(request, context, "identity_connection_denied");
  }

  if (request.scope === "dossier") {
    const dossier = context.dossier;
    const participant = context.participant;
    if (
      !isOpaqueId(request.dossierId) ||
      !dossier ||
      !isOpaqueId(dossier.id) ||
      !isOpaqueId(dossier.organizationId) ||
      !participant ||
      !isOpaqueId(participant.actorId) ||
      !isOpaqueId(participant.organizationId) ||
      !isOpaqueId(participant.dossierId) ||
      !isPositiveSafeInteger(participant.authorizationVersion) ||
      dossier.id !== request.dossierId ||
      dossier.organizationId !== request.organizationId ||
      resource.dossierId !== request.dossierId ||
      participant.dossierId !== request.dossierId ||
      participant.organizationId !== request.organizationId ||
      participant.actorId !== request.actorId ||
      participant.status !== "active" ||
      !isPositiveSafeInteger(request.expectedParticipantAuthorizationVersion) ||
      participant.authorizationVersion !==
        request.expectedParticipantAuthorizationVersion
    ) {
      return deny(request, context, "participant_denied");
    }
    const dossierRoleAllows = includesAction(
      DOSSIER_ROLE_ACTIONS[participant.role],
      request.action,
    );
    if (!dossierRoleAllows) {
      return deny(request, context, "role_denied");
    }
  } else if (
    request.dossierId !== undefined ||
    (separationOfDutiesActions.has(request.action)
      ? !isOpaqueId(resource.dossierId)
      : resource.dossierId !== undefined) ||
    !includesAction(ORGANIZATION_ROLE_ACTIONS[membership.role], request.action)
  ) {
    return deny(request, context, "role_denied");
  }

  if (
    membership.role === "org_admin" &&
    delegatedOrgAdminActions.has(request.action) &&
    !hasCurrentDelegatedAuthority(request, context)
  ) {
    return deny(request, context, "stale_grant");
  }
  if (
    complianceAuthorityActions.has(request.action) &&
    !hasCurrentComplianceAuthority(request, context)
  ) {
    return deny(request, context, "stale_grant");
  }
  if (
    separationOfDutiesActions.has(request.action) &&
    !hasCurrentSecurityApproval(request, context)
  ) {
    return deny(request, context, "separation_of_duties_denied");
  }
  if (
    tenantManifestRequiredActions.has(request.action) &&
    !hasUsableTenantManifest(request, context)
  ) {
    return deny(request, context, "manifest_denied");
  }

  return allow(request, context);
}
