import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { after, before, test } from "node:test";
import { drizzle } from "drizzle-orm/d1";
import { Miniflare } from "miniflare";
import pdfMake from "pdfmake/build/pdfmake.js";
import pdfFonts from "pdfmake/build/vfs_fonts.js";
import type { TDocumentDefinitions } from "pdfmake/interfaces";

import * as schema from "../db/schema";
import { caseFingerprint, casePublicationFingerprint, normalizeStudioDraft } from "../app/case-integrity";
import { buildCaseReportArtifacts, type CaseReportOptions } from "../app/case-report";
import { createCanonicalRuntime, canonicalAvailableActionIds, dispatchCanonicalAction } from "../app/canonical-runtime";
import {
  canonicalDossierJson,
  dossierStatusTransitionDecision,
  type DossierAIProposalV1,
  type DossierRole,
} from "../app/dossier-contract";
import {
  validatePublishedDecisionPackage,
} from "../app/dossier-decision-package-integration";
import {
  executeDossierDocumentUpload,
  type DossierDocumentUploadForm,
  type DossierUploadCoordinatorDependencies,
} from "../app/dossier-document-upload-coordinator";
import { validatedPublishedGraphTarget } from "../app/dossier-evidence-graph";
import {
  approveDossierGovernedOutput,
  createDossierSnapshot,
  downloadDossierGovernedOutput,
  generateDossierGovernedOutput,
  listDossierGovernedOutputs,
  type DossierGovernedContext,
  type DossierGovernedDependencies,
} from "../app/dossier-governed-output-server";
import { prepareDossierUpload } from "../app/dossier-private-upload";
import {
  dossierProposalSourceReplacementDecision,
  reviewDossierProposal,
} from "../app/dossier-proposal-review";
import { caseReportGraphLayoutSvg } from "../app/report-graph-pdf";
import {
  authorizeDossierAction,
  DOSSIER_TRUSTED_IDENTITY_SOURCE,
} from "../app/dossier-security";
import { resolvePlayedCaseScenario } from "../app/played-case-loader";
import { normalizePlayableScenario, playableFingerprint } from "../app/playable-integrity";
import { primaryCaseOutput } from "../app/case-type-playbooks";
import { scenarios } from "../app/scenarios";
import {
  parseStudioWorkflowStep,
  restoredStudioWorkflowStep,
  serializedStudioWorkflowStep,
  studioWorkflowStorageKey,
} from "../app/studio-workflow";
import { compileStudioDraft } from "../app/studio-compiler";
import type { StudioDraft } from "../app/types";
import {
  reportPdfFixtures,
  type ReportPdfFixture,
} from "../scripts/tests/report-pdf-fixtures";

const MIGRATIONS = [
  "0000_worthless_supreme_intelligence.sql",
  "0001_right_talon.sql",
  "0002_greedy_darkstar.sql",
  "0003_unusual_zarda.sql",
  "0004_petite_komodo.sql",
  "0005_dapper_nightcrawler.sql",
  "0006_concerned_korath.sql",
  "0007_ambitious_phoenix.sql",
  "0008_first_hitman.sql",
  "0009_medical_princess_powerful.sql",
  "0010_square_scalphunter.sql",
  "0011_operational_events.sql",
  "0012_sleepy_magma_core.sql",
  "0013_sleepy_magma_guards_a.sql",
  "0014_sleepy_magma_guards_b.sql",
  "0015_sleepy_magma_guards_c.sql",
  "0016_polite_sentinels.sql",
  "0017_perfect_marvex.sql",
  "0018_low_calypso.sql",
] as const;

const AT = "2026-09-01T08:00:00.000Z";
const PACKAGE_FIXTURE = reportPdfFixtures().find((fixture) =>
  fixture.id === "golden-bhopal-decision-memorandum"
);
if (!PACKAGE_FIXTURE) throw new Error("The locked Bhopal acceptance fixture is required.");
const PACKAGE_DRAFT = normalizeStudioDraft(PACKAGE_FIXTURE.draft);
const PACKAGE_STUDIO_FINGERPRINT = caseFingerprint(PACKAGE_DRAFT);
const PACKAGE_COMPILATION = compileStudioDraft(PACKAGE_DRAFT, PACKAGE_STUDIO_FINGERPRINT);
if (!PACKAGE_COMPILATION.scenario || PACKAGE_COMPILATION.issues.length > 0) {
  throw new Error("The locked Bhopal acceptance package must compile.");
}
const PACKAGE_FINGERPRINT = PACKAGE_COMPILATION.scenario.fingerprint;

let miniflare: Miniflare | undefined;
let d1!: D1Database;
let bucket!: R2Bucket;
let graphDigest = "";
let serial = 0;
let latestDatabaseBatchError: unknown;

type Statement = ReturnType<D1Database["prepare"]>;
type DossierAuditEventInput =
  Parameters<DossierUploadCoordinatorDependencies["prepareRevisionAuditBatch"]>[2][number];
type StoredActor = {
  id: number;
  actor_id: string;
  display_name: string;
  email: string;
};
type MatterHarness = {
  dossierId: string;
  owner: StoredActor;
  reviewer: StoredActor;
  reviewerParticipantId: string;
  ownerContext: DossierGovernedContext;
  reviewerContext: DossierGovernedContext;
  uploadDependencies: DossierUploadCoordinatorDependencies;
  ownerGovernedDependencies: DossierGovernedDependencies;
  reviewerGovernedDependencies: DossierGovernedDependencies;
};
type UploadResult = {
  document_id: string;
  dossier_revision: number;
  idempotent: boolean;
  version: {
    document_version_id: string;
    ordinal: number;
    predecessor_version_id: string | null;
    content_sha256: string;
    extraction_status: string;
    download_url: string;
  };
};
type PdfMakePage = {
  items: unknown[];
};

const pdfRuntime = pdfMake as unknown as {
  addVirtualFileSystem: (fonts: unknown) => void;
  createPdf: (definition: TDocumentDefinitions) => {
    getBuffer: (callback: (value: Uint8Array) => void) => void;
    _getPages: (
      options: Record<string, never>,
      callback: (pages: PdfMakePage[]) => void,
    ) => void;
  };
};
pdfRuntime.addVirtualFileSystem(pdfFonts);

function opaque(prefix: string) {
  serial += 1;
  return prefix + "_" + serial.toString(16).padStart(32, "0");
}

function simulationSessionKey() {
  serial += 1;
  return "00000000-0000-4000-8000-" + serial.toString(16).padStart(12, "0");
}

async function sha256(value: string | Uint8Array) {
  const bytes = typeof value === "string" ? new TextEncoder().encode(value) : value;
  const source = new Uint8Array(new ArrayBuffer(bytes.byteLength));
  source.set(bytes);
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", source));
  return "sha256-" + [...digest].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function row<T>(sql: string, ...values: unknown[]) {
  return d1.prepare(sql).bind(...values).first<T>();
}

async function rows<T>(sql: string, ...values: unknown[]) {
  return (await d1.prepare(sql).bind(...values).all<T>()).results;
}

async function prepareDossierAuditEvents(
  context: DossierGovernedContext,
  dossierId: string,
  dossierRevision: number,
  inputs: readonly DossierAuditEventInput[],
) {
  let previous = await row<{
    id: string;
    sequence: number;
    event_digest: string;
  }>(
    "SELECT id, sequence, event_digest FROM dossier_audit_events WHERE dossier_id = ? ORDER BY sequence DESC LIMIT 1",
    dossierId,
  );
  const events: Array<typeof schema.dossierAuditEvents.$inferInsert> = [];
  for (const input of inputs) {
    const id = opaque("audit");
    const sequence = (previous?.sequence ?? 0) + 1;
    const occurredAt = input.occurredAt ?? new Date().toISOString();
    const detail = JSON.parse(canonicalDossierJson(input.detail ?? {})) as unknown;
    const eventDigest = await sha256(canonicalDossierJson({
      schema_version: 1,
      dossier_id: dossierId,
      dossier_revision: dossierRevision,
      sequence,
      event_type: input.eventType,
      object_ref_type: input.objectRefType,
      object_ref_id: input.objectRefId,
      actor_id: context.actor.actorId,
      actor_role: input.actorRole,
      occurred_at: occurredAt,
      summary_code: input.summaryCode,
      detail,
      previous_event_id: previous?.id ?? null,
      previous_event_digest: previous?.event_digest ?? null,
    }));
    const event = {
      id,
      dossierId,
      dossierRevision,
      sequence,
      eventType: input.eventType,
      objectRefType: input.objectRefType,
      objectRefId: input.objectRefId,
      actorUserId: context.actor.userId,
      actorRef: context.actor.actorId,
      actorRole: input.actorRole,
      occurredAt,
      summaryCode: input.summaryCode,
      detail,
      previousEventId: previous?.id ?? null,
      eventDigest,
    } satisfies typeof schema.dossierAuditEvents.$inferInsert;
    events.push(event);
    previous = { id, sequence, event_digest: eventDigest };
  }
  return events;
}

async function prepareDossierRevisionAuditBatch(
  context: DossierGovernedContext,
  dossierId: string,
  resultingRevision: number,
  inputs: readonly DossierAuditEventInput[],
) {
  return {
    revisionReceipt: {
      dossierId,
      resultingRevision,
      createdByActorRef: context.actor.actorId,
      createdAt: new Date().toISOString(),
    },
    auditEvents: await prepareDossierAuditEvents(
      context,
      dossierId,
      resultingRevision,
      inputs,
    ),
  };
}

async function exactCurrentGraphEntityExists(
  _context: DossierGovernedContext,
  dossierId: string,
  decisionPackageReferenceId: string,
  targetType: "graph_node" | "graph_edge",
  targetId: string,
) {
  const record = await row<{
    reference_graph_digest: string;
    package_id: string;
    package_version: string;
    package_fingerprint: string;
    studio_fingerprint: string;
    payload: string | Record<string, unknown>;
  }>(
    "SELECT reference.graph_digest AS reference_graph_digest, version.case_id AS package_id, version.version AS package_version, version.fingerprint AS package_fingerprint, version.studio_fingerprint, version.payload FROM dossier_decision_package_references reference INNER JOIN case_versions version ON version.case_id = reference.package_id AND version.version = reference.package_version AND version.fingerprint = reference.package_fingerprint AND version.published_at IS NOT NULL WHERE reference.dossier_id = ? AND reference.id = ? AND reference.state = 'current' AND reference.graph_validation_status = 'valid' AND reference.approval_state = 'published' LIMIT 1",
    dossierId,
    decisionPackageReferenceId,
  );
  if (!record) return false;
  return validatedPublishedGraphTarget({
    referenceGraphDigest: record.reference_graph_digest,
    packageId: record.package_id,
    packageVersion: record.package_version,
    packageFingerprint: record.package_fingerprint,
    studioFingerprint: record.studio_fingerprint,
    payload: typeof record.payload === "string" ? JSON.parse(record.payload) : record.payload,
  }, targetType, targetId);
}

function auditInsert(event: typeof schema.dossierAuditEvents.$inferInsert) {
  return d1.prepare(
    "INSERT INTO dossier_audit_events (id, dossier_id, dossier_revision, sequence, event_type, object_ref_type, object_ref_id, actor_user_id, actor_ref, actor_role, occurred_at, summary_code, detail, previous_event_id, event_digest) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
  ).bind(
    event.id,
    event.dossierId,
    event.dossierRevision,
    event.sequence,
    event.eventType,
    event.objectRefType,
    event.objectRefId,
    event.actorUserId ?? null,
    event.actorRef,
    event.actorRole,
    event.occurredAt,
    event.summaryCode,
    JSON.stringify(event.detail ?? {}),
    event.previousEventId ?? null,
    event.eventDigest,
  );
}

async function applyRevision(
  harness: MatterHarness,
  actorContext: DossierGovernedContext,
  domainStatements: (nextRevision: number, occurredAt: string) => Statement[],
  auditInputs: readonly DossierAuditEventInput[],
) {
  const current = await row<{ revision: number }>(
    "SELECT revision FROM dossiers WHERE id = ?",
    harness.dossierId,
  );
  assert.ok(current);
  const nextRevision = current.revision + 1;
  const occurredAt = new Date().toISOString();
  const prepared = await prepareDossierRevisionAuditBatch(
    actorContext,
    harness.dossierId,
    nextRevision,
    auditInputs.map((input) => ({
      ...input,
      occurredAt: input.occurredAt ?? occurredAt,
    })),
  );
  await d1.batch([
    d1.prepare(
      "UPDATE dossiers SET revision = ?, updated_by_actor_ref = ?, updated_at = ? WHERE id = ? AND revision = ?",
    ).bind(
      nextRevision,
      actorContext.actor.actorId,
      occurredAt,
      harness.dossierId,
      current.revision,
    ),
    ...domainStatements(nextRevision, occurredAt),
    ...prepared.auditEvents.map(auditInsert),
    d1.prepare(
      "INSERT INTO dossier_revision_receipts (dossier_id, resulting_revision, created_by_actor_ref, created_at) VALUES (?, ?, ?, ?)",
    ).bind(
      prepared.revisionReceipt.dossierId,
      prepared.revisionReceipt.resultingRevision,
      prepared.revisionReceipt.createdByActorRef,
      prepared.revisionReceipt.createdAt,
    ),
  ]);
  return nextRevision;
}

async function seedMatter(): Promise<MatterHarness> {
  const ownerEmail = "scenario-a-owner-" + opaque("mail") + "@example.test";
  const reviewerEmail = "scenario-a-reviewer-" + opaque("mail") + "@example.test";
  await d1.batch([
    d1.prepare("INSERT INTO users (email, display_name) VALUES (?, ?)").bind(
      ownerEmail,
      "Scenario A owner",
    ),
    d1.prepare("INSERT INTO users (email, display_name) VALUES (?, ?)").bind(
      reviewerEmail,
      "Scenario A reviewer",
    ),
  ]);
  const owner = await d1.prepare(
    "SELECT id, actor_id, display_name, email FROM users WHERE email = ?",
  ).bind(ownerEmail).first<StoredActor>();
  const reviewer = await d1.prepare(
    "SELECT id, actor_id, display_name, email FROM users WHERE email = ?",
  ).bind(reviewerEmail).first<StoredActor>();
  assert.ok(owner);
  assert.ok(reviewer);

  const dossierId = opaque("dossier");
  const createdAuditId = opaque("audit");
  const reviewerParticipantId = opaque("participant");
  const reviewerAuditId = opaque("audit");
  const seededAt = new Date().toISOString();
  await d1.batch([
    d1.prepare(
      "INSERT INTO dossiers (id, reference, title, dossier_type_registry, dossier_type_id, dossier_type_version, terminology, owner_user_id, owner_actor_id, jurisdictions, classification, priority, status, key_deadline_at, key_deadline_timezone, created_by_actor_ref, updated_by_actor_ref, created_at, updated_at) VALUES (?, ?, ?, 'genesis-juris-dossier-types', 'general-matter', '1.0.0', 'matter', ?, ?, ?, 'strictly_confidential', 'high', 'draft', '2026-12-01T10:00:00.000Z', 'Europe/Paris', ?, ?, ?, ?)",
    ).bind(
      dossierId,
      "MAT-E2E-A-001",
      "Manual professional matter",
      owner.id,
      owner.actor_id,
      JSON.stringify(["Belgium", "European Union"]),
      owner.actor_id,
      owner.actor_id,
      seededAt,
      seededAt,
    ),
    d1.prepare(
      "INSERT INTO dossier_participants (id, dossier_id, user_id, actor_id, display_name, role, status, created_by_actor_ref, updated_by_actor_ref, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 'reviewer', 'active', ?, ?, ?, ?)",
    ).bind(
      reviewerParticipantId,
      dossierId,
      reviewer.id,
      reviewer.actor_id,
      reviewer.display_name,
      owner.actor_id,
      owner.actor_id,
      seededAt,
      seededAt,
    ),
    d1.prepare(
      "INSERT INTO dossier_audit_events (id, dossier_id, dossier_revision, sequence, event_type, object_ref_type, object_ref_id, actor_user_id, actor_ref, actor_role, occurred_at, summary_code, detail, previous_event_id, event_digest) VALUES (?, ?, 1, 1, 'dossier_created', 'dossier', ?, ?, ?, 'owner', ?, 'DOSSIER_CREATED', '{}', NULL, ?)",
    ).bind(
      createdAuditId,
      dossierId,
      dossierId,
      owner.id,
      owner.actor_id,
      seededAt,
      await sha256(dossierId + ":1:1:" + createdAuditId),
    ),
    d1.prepare(
      "INSERT INTO dossier_audit_events (id, dossier_id, dossier_revision, sequence, event_type, object_ref_type, object_ref_id, actor_user_id, actor_ref, actor_role, occurred_at, summary_code, detail, previous_event_id, event_digest) VALUES (?, ?, 1, 2, 'participant_changed', 'participant', ?, ?, ?, 'owner', ?, 'PARTICIPANT_CHANGED', '{}', ?, ?)",
    ).bind(
      reviewerAuditId,
      dossierId,
      reviewerParticipantId,
      owner.id,
      owner.actor_id,
      seededAt,
      createdAuditId,
      await sha256(dossierId + ":1:2:" + reviewerAuditId),
    ),
    d1.prepare(
      "INSERT INTO dossier_revision_receipts (dossier_id, resulting_revision, created_by_actor_ref, created_at) VALUES (?, 1, ?, ?)",
    ).bind(dossierId, owner.actor_id, seededAt),
  ]);

  const database = drizzle(d1, { schema });
  const originalBatch = database.batch.bind(database);
  Object.defineProperty(database, "batch", {
    value: async (...parameters: Parameters<typeof originalBatch>) => {
      try {
        return await originalBatch(...parameters);
      } catch (error) {
        latestDatabaseBatchError = error;
        throw error;
      }
    },
  });
  const ownerContext: DossierGovernedContext = {
    db: database,
    actor: {
      userId: owner.id,
      actorId: owner.actor_id,
      displayName: owner.display_name,
      email: owner.email,
      platformAdmin: false,
    },
  };
  const reviewerContext: DossierGovernedContext = {
    db: database,
    actor: {
      userId: reviewer.id,
      actorId: reviewer.actor_id,
      displayName: reviewer.display_name,
      email: reviewer.email,
      platformAdmin: false,
    },
  };
  return {
    dossierId,
    owner,
    reviewer,
    reviewerParticipantId,
    ownerContext,
    reviewerContext,
    uploadDependencies: {
      requireUploadRole: async () => "owner",
      prepareRevisionAuditBatch: (currentDossierId, revision, inputs) =>
        prepareDossierRevisionAuditBatch(
          ownerContext,
          currentDossierId,
          revision,
          inputs,
        ),
    },
    ownerGovernedDependencies: {
      prepareAuditEvents: (currentDossierId, revision, inputs) =>
        prepareDossierAuditEvents(ownerContext, currentDossierId, revision, inputs),
    },
    reviewerGovernedDependencies: {
      prepareAuditEvents: (currentDossierId, revision, inputs) =>
        prepareDossierAuditEvents(reviewerContext, currentDossierId, revision, inputs),
    },
  };
}

async function uploadTextDocument(input: {
  harness: MatterHarness;
  expectedRevision: number;
  filename: string;
  mediaType: "text/plain" | "text/markdown";
  title: string;
  text: string;
  idempotencyKey: string;
  documentId?: string;
}) {
  const bytes = new TextEncoder().encode(input.text);
  const prepared = await prepareDossierUpload({
    originalFilename: input.filename,
    browserMediaType: input.mediaType,
    declaredMediaType: input.mediaType,
    bytes,
  });
  const file = new File([bytes], input.filename, { type: input.mediaType });
  const form: DossierDocumentUploadForm = {
    file,
    title: input.title,
    documentType: "evidence",
    classification: "strictly_confidential",
    expectedRevision: input.expectedRevision,
    documentId: input.documentId ?? null,
    sourceNote: "v62-scenario-a",
    idempotencyKey: input.idempotencyKey,
    declaredMediaType: input.mediaType,
  };
  const response = await executeDossierDocumentUpload({
    context: input.harness.ownerContext,
    dependencies: input.harness.uploadDependencies,
    bucket,
    dossierId: input.harness.dossierId,
    dossierRevision: input.expectedRevision,
    form,
    prepared,
  });
  if (response.status !== 201) {
    const databaseDetail = latestDatabaseBatchError instanceof Error
      ? latestDatabaseBatchError.stack ?? latestDatabaseBatchError.message
      : String(latestDatabaseBatchError);
    assert.fail(
      "Upload coordinator returned " + response.status + ": "
      + await response.clone().text() + "\nD1 batch: " + databaseDetail,
    );
  }
  return await response.json() as UploadResult;
}

async function seedSimulationReceipt(harness: MatterHarness) {
  const key = simulationSessionKey();
  await d1.prepare(
    "INSERT INTO play_sessions (session_key, user_email, case_id, case_version, case_fingerprint, state, status, revision, started_at, completed_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, 'completed', 2, ?, ?, ?)",
  ).bind(
    key,
    harness.owner.email,
    PACKAGE_DRAFT.caseId,
    PACKAGE_DRAFT.version,
    PACKAGE_FINGERPRINT,
    JSON.stringify({
      outcome: "strong",
      decisions: [{ sequence: 1, optionId: "e2e-option-1" }],
    }),
    AT,
    "2026-09-01T08:03:00.000Z",
    "2026-09-01T08:03:00.000Z",
  ).run();
  const session = await row<{ id: number }>(
    "SELECT id FROM play_sessions WHERE session_key = ?",
    key,
  );
  assert.ok(session);
  await d1.batch([
    d1.prepare(
      "INSERT INTO play_events (play_session_id, event_id, sequence, event_type, payload, occurred_at) VALUES (?, ?, 0, 'session_started', '{}', ?)",
    ).bind(session.id, key + ":0", AT),
    d1.prepare(
      "INSERT INTO play_events (play_session_id, event_id, sequence, event_type, payload, occurred_at) VALUES (?, ?, 1, 'decision_recorded', '{}', '2026-09-01T08:02:00.000Z')",
    ).bind(session.id, key + ":1"),
    d1.prepare(
      "INSERT INTO play_events (play_session_id, event_id, sequence, event_type, payload, occurred_at) VALUES (?, ?, 2, 'session_completed', '{}', '2026-09-01T08:03:00.000Z')",
    ).bind(session.id, key + ":2"),
  ]);
  return key;
}

function reportOptions(fixture: ReportPdfFixture): CaseReportOptions {
  const profile = primaryCaseOutput(fixture.draft.caseType);
  const fingerprint = caseFingerprint(fixture.draft);
  const publicationFingerprint = casePublicationFingerprint(fixture.draft);
  return {
    language: fixture.language,
    profileId: profile.id,
    profileLabel: profile.label[fixture.language],
    audience: fixture.audience,
    confidentiality: "confidential",
    preparedBy: "V62 acceptance author",
    preparedFor: "V62 acceptance reviewer",
    matterReference: "V62-E2E-" + fixture.id,
    includeEconomics: true,
    includeRegisters: true,
    includeSources: true,
    includeAuditTrail: fixture.audience === "internal",
    includeTechnicalIds: fixture.audience === "internal",
    generatedAt: "2026-09-01T12:00:00.000Z",
    currentFingerprint: fingerprint,
    workspaceFingerprint: fingerprint,
    currentPublicationFingerprint: publicationFingerprint,
    workspacePublicationFingerprint: publicationFingerprint,
    privateCase: true,
    reportReceiptStorageScope: null,
    persistReportReceiptOnDevice: false,
    status: fixture.audience === "client" ? "final" : "draft",
    reviewerName: "V62 acceptance reviewer",
    reviewerApproved: true,
  };
}

async function renderPdf(definition: TDocumentDefinitions) {
  const pages = await new Promise<PdfMakePage[]>((resolve) => {
    pdfRuntime.createPdf(definition)._getPages({}, resolve);
  });
  const bytes = await new Promise<Uint8Array>((resolve) => {
    pdfRuntime.createPdf(definition).getBuffer(resolve);
  });
  return { pages, bytes };
}

before(async () => {
  miniflare = new Miniflare({
    workers: [{
      config: {
        name: "dossier-e2e-v62",
        type: "worker",
        compatibilityDate: "2026-09-01",
        manifest: {
          mainModule: "index.mjs",
          modules: {
            "index.mjs": {
              type: "esm",
              contents: "export default { fetch() { return new Response('ok'); } };",
            },
          },
        },
        env: {
          DB: { type: "d1", name: "dossier-e2e-v62" },
          DOSSIER_DOCUMENTS: { type: "r2", name: "dossier-e2e-v62" },
        },
      },
      dev: {},
    }],
  });
  d1 = await miniflare.getD1Database(
    "DB",
    "dossier-e2e-v62",
  ) as unknown as D1Database;
  bucket = await miniflare.getR2Bucket(
    "DOSSIER_DOCUMENTS",
    "dossier-e2e-v62",
  ) as unknown as R2Bucket;
  for (const name of MIGRATIONS) {
    const sql = readFileSync(new URL("../drizzle/" + name, import.meta.url), "utf8");
    for (const statement of sql.split("--> statement-breakpoint").map((item) => item.trim())) {
      if (statement) await d1.prepare(statement).run();
    }
  }

  const published = {
    packageId: PACKAGE_DRAFT.caseId,
    packageVersion: PACKAGE_DRAFT.version,
    packageFingerprint: PACKAGE_FINGERPRINT,
    studioFingerprint: PACKAGE_STUDIO_FINGERPRINT,
    parentPackageId: null,
    parentPackageVersion: null,
    parentPackageFingerprint: null,
    payload: { studioDraft: PACKAGE_DRAFT },
  };
  const validation = await validatePublishedDecisionPackage(published);
  assert.equal(validation.ok, true);
  if (!validation.ok) throw new Error("The Bhopal package validation failed.");
  graphDigest = validation.value.graphDigest;
  await d1.batch([
    d1.prepare(
      "INSERT INTO cases (id, current_version, fingerprint, title, jurisdiction, practice_area, sector, difficulty, duration_minutes, status, review_level, author_name, reviewer_name, legal_as_of, summary, tags, centrally_managed, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 45, 'published', 'canonical', 'V62 author', 'V62 reviewer', ?, ?, ?, true, ?)",
    ).bind(
      PACKAGE_DRAFT.caseId,
      PACKAGE_DRAFT.version,
      PACKAGE_FINGERPRINT,
      PACKAGE_DRAFT.title,
      PACKAGE_DRAFT.jurisdiction,
      PACKAGE_DRAFT.classification?.practiceArea ?? "Regulatory",
      PACKAGE_DRAFT.classification?.practiceArea ?? "Regulatory",
      PACKAGE_DRAFT.classification?.difficulty ?? "Advanced",
      PACKAGE_DRAFT.classification?.legalAsOf ?? null,
      PACKAGE_DRAFT.premise,
      JSON.stringify(PACKAGE_DRAFT.classification?.tags ?? []),
      PACKAGE_DRAFT.updatedAt,
    ),
    d1.prepare(
      "INSERT INTO case_versions (case_id, version, fingerprint, studio_fingerprint, parent_case_id, parent_version, parent_fingerprint, change_summary, payload, published_at, created_at) VALUES (?, ?, ?, ?, NULL, NULL, NULL, 'V62 E2E package', ?, ?, ?)",
    ).bind(
      PACKAGE_DRAFT.caseId,
      PACKAGE_DRAFT.version,
      PACKAGE_FINGERPRINT,
      PACKAGE_STUDIO_FINGERPRINT,
      JSON.stringify({ studioDraft: PACKAGE_DRAFT }),
      PACKAGE_DRAFT.updatedAt,
      PACKAGE_DRAFT.updatedAt,
    ),
  ]);
});

after(async () => {
  await miniflare?.dispose();
});

test("Scenario A - a manual professional matter reaches reviewed snapshot outputs and a source change stales them", async () => {
  const documentReviewRoute = readFileSync(
    new URL(
      "../app/api/dossiers/[dossierId]/documents/[documentId]/review/route.ts",
      import.meta.url,
    ),
    "utf8",
  );
  assert.match(documentReviewRoute, /if \(!isSameOriginMutation\(request\)\)/u);
  assert.match(documentReviewRoute, /Cross-site document review rejected\." \}, 403/u);
  assert.match(
    documentReviewRoute,
    /requireDossierAccess\(context, routeIds\.dossierId, "documents"\)/u,
  );
  assert.match(documentReviewRoute, /Object\.keys\(payload\).*ALLOWED_FIELDS/u);
  assert.match(documentReviewRoute, /document review contains an ambiguous revision/u);
  assert.match(documentReviewRoute, /expectedRevision !== access\.dossier\.revision/u);
  assert.match(documentReviewRoute, /document_not_reviewable/u);
  const documentReviewPost = documentReviewRoute.slice(
    documentReviewRoute.indexOf("export async function POST"),
  );
  assert.ok(
    documentReviewPost.indexOf("isSameOriginMutation")
      < documentReviewPost.indexOf("resolveDossierServerContext"),
  );

  const harness = await seedMatter();
  const matter = await row<{
    owner_actor_id: string;
    jurisdictions: string;
    classification: string;
    priority: string;
    status: string;
    revision: number;
  }>(
    "SELECT owner_actor_id, jurisdictions, classification, priority, status, revision FROM dossiers WHERE id = ?",
    harness.dossierId,
  );
  assert.ok(matter);
  assert.equal(matter.owner_actor_id, harness.owner.actor_id);
  assert.deepEqual(JSON.parse(matter.jurisdictions), ["Belgium", "European Union"]);
  assert.deepEqual(
    [matter.classification, matter.priority, matter.status, matter.revision],
    ["strictly_confidential", "high", "draft", 1],
  );

  const sourceV1Text = "Contract notice dated 31 August 2026. Initial amount EUR 500,000.";
  const sourceV2Text = "Contract notice dated 1 September 2026. Reviewed amount EUR 525,000.";
  const sourceV1 = await uploadTextDocument({
    harness,
    expectedRevision: 1,
    filename: "contract-notice.txt",
    mediaType: "text/plain",
    title: "Contract notice",
    text: sourceV1Text,
    idempotencyKey: "scenario-a-source-v1",
  });
  const chronology = await uploadTextDocument({
    harness,
    expectedRevision: 2,
    filename: "chronology.md",
    mediaType: "text/markdown",
    title: "Matter chronology",
    text: "# Chronology\n\n- 1 September 2026: notice reviewed.\n",
    idempotencyKey: "scenario-a-chronology-v1",
  });
  const instructions = await uploadTextDocument({
    harness,
    expectedRevision: 3,
    filename: "instructions.txt",
    mediaType: "text/plain",
    title: "Client instructions",
    text: "Prepare a source-grounded professional decision memorandum.",
    idempotencyKey: "scenario-a-instructions-v1",
  });
  const sourceV2 = await uploadTextDocument({
    harness,
    expectedRevision: 4,
    filename: "contract-notice.txt",
    mediaType: "text/plain",
    title: "Contract notice",
    text: sourceV2Text,
    idempotencyKey: "scenario-a-source-v2",
    documentId: sourceV1.document_id,
  });
  assert.equal(sourceV2.version.ordinal, 2);
  assert.equal(
    sourceV2.version.predecessor_version_id,
    sourceV1.version.document_version_id,
  );
  assert.equal(new Set([
    sourceV1.document_id,
    chronology.document_id,
    instructions.document_id,
  ]).size, 3);

  const versionRows = await rows<{
    id: string;
    ordinal: number;
    binary_object_reference: string;
    current: number;
  }>(
    "SELECT version.id, version.ordinal, version.binary_object_reference, CASE WHEN current_version.document_version_id = version.id THEN 1 ELSE 0 END AS current FROM dossier_document_versions version LEFT JOIN dossier_document_current_versions current_version ON current_version.dossier_id = version.dossier_id AND current_version.document_id = version.document_id WHERE version.dossier_id = ? AND version.document_id = ? ORDER BY version.ordinal",
    harness.dossierId,
    sourceV1.document_id,
  );
  assert.deepEqual(
    versionRows.map(({ ordinal, current }) => ({ ordinal, current })),
    [{ ordinal: 1, current: 0 }, { ordinal: 2, current: 1 }],
  );
  const retainedV1 = await bucket.get(versionRows[0]!.binary_object_reference);
  assert.ok(retainedV1);
  assert.equal(await retainedV1.text(), sourceV1Text);
  assert.match(sourceV1.version.download_url, /document_version/u);

  for (const documentId of [
    sourceV1.document_id,
    chronology.document_id,
    instructions.document_id,
  ]) {
    await applyRevision(
      harness,
      harness.reviewerContext,
      (_nextRevision, occurredAt) => [
        d1.prepare(`
          UPDATE dossier_documents
          SET status = 'accepted_source', updated_by_actor_ref = ?, updated_at = ?
          WHERE dossier_id = ? AND id = ?
            AND status IN ('received', 'under_review') AND is_provisional = false
        `).bind(
          harness.reviewer.actor_id,
          occurredAt,
          harness.dossierId,
          documentId,
        ),
      ],
      [{
        actorRole: "reviewer",
        eventType: "dossier_updated",
        objectRefType: "document",
        objectRefId: documentId,
        summaryCode: "DOCUMENT_ACCEPTED_SOURCE",
        detail: { action: "review", status: "accepted_source" },
      }],
    );
  }
  const reviewedDocuments = await rows<{
    id: string;
    status: string;
    audit_count: number;
  }>(`
    SELECT document.id, document.status,
      (SELECT count(*) FROM dossier_audit_events AS audit
       WHERE audit.dossier_id = document.dossier_id
         AND audit.event_type = 'dossier_updated'
         AND audit.object_ref_type = 'document'
         AND audit.object_ref_id = document.id
         AND audit.summary_code = 'DOCUMENT_ACCEPTED_SOURCE') AS audit_count
    FROM dossier_documents AS document
    WHERE document.dossier_id = ?
    ORDER BY document.id
  `, harness.dossierId);
  assert.deepEqual(
    reviewedDocuments.map(({ status, audit_count }) => ({ status, audit_count })),
    Array.from({ length: 3 }, () => ({ status: "accepted_source", audit_count: 1 })),
  );

  const anchorId = opaque("source_anchor");
  const assertionId = opaque("assertion");
  const exactExcerpt = "Contract notice dated 1 September 2026.";
  const excerptStart = sourceV2Text.indexOf(exactExcerpt);
  assert.ok(excerptStart >= 0);
  const anchorChecksum = await sha256(exactExcerpt);
  await applyRevision(
    harness,
    harness.reviewerContext,
    (_nextRevision, occurredAt) => [
      d1.prepare(
        "INSERT INTO dossier_source_anchors (id, dossier_id, document_id, document_version_id, page_number, section, heading, paragraph, character_start, character_end, excerpt, anchor_checksum, extraction_version, creator, review_state, created_by_actor_ref, created_at) VALUES (?, ?, ?, ?, 1, 'notice', 'Contract notice', '1', ?, ?, ?, ?, 'genesis-dossier-strict-utf8-v1', 'human', 'pending', ?, ?)",
      ).bind(
        anchorId,
        harness.dossierId,
        sourceV2.document_id,
        sourceV2.version.document_version_id,
        excerptStart,
        excerptStart + exactExcerpt.length,
        exactExcerpt,
        anchorChecksum,
        harness.reviewer.actor_id,
        occurredAt,
      ),
      d1.prepare(
        "UPDATE dossier_source_anchors SET review_state = 'accepted', reviewer_user_id = ?, reviewer_actor_ref = ?, reviewed_at = ? WHERE dossier_id = ? AND id = ? AND review_state = 'pending'",
      ).bind(
        harness.reviewer.id,
        harness.reviewer.actor_id,
        occurredAt,
        harness.dossierId,
        anchorId,
      ),
    ],
    [{
      actorRole: "reviewer",
      eventType: "source_anchor_reviewed",
      objectRefType: "source_anchor",
      objectRefId: anchorId,
      summaryCode: "SOURCE_ANCHOR_ACCEPTED",
      detail: {
        document_version_id: sourceV2.version.document_version_id,
        character_start: excerptStart,
        character_end: excerptStart + exactExcerpt.length,
      },
    }],
  );
  await applyRevision(
    harness,
    harness.reviewerContext,
    (_nextRevision, occurredAt) => [
      d1.prepare(
        "INSERT INTO dossier_professional_assertions (id, dossier_id, assertion_type, statement, status, created_by_actor_ref, updated_by_actor_ref, created_at, updated_at) VALUES (?, ?, 'fact', ?, 'needs_review', ?, ?, ?, ?)",
      ).bind(
        assertionId,
        harness.dossierId,
        exactExcerpt,
        harness.reviewer.actor_id,
        harness.reviewer.actor_id,
        occurredAt,
        occurredAt,
      ),
      d1.prepare(
        "INSERT INTO dossier_assertion_sources (dossier_id, assertion_id, source_anchor_id, created_at) VALUES (?, ?, ?, ?)",
      ).bind(harness.dossierId, assertionId, anchorId, occurredAt),
      d1.prepare(
        "UPDATE dossier_professional_assertions SET status = 'accepted', reviewed_by_user_id = ?, reviewed_by_actor_ref = ?, reviewed_at = ?, updated_by_actor_ref = ?, updated_at = ? WHERE dossier_id = ? AND id = ? AND status = 'needs_review'",
      ).bind(
        harness.reviewer.id,
        harness.reviewer.actor_id,
        occurredAt,
        harness.reviewer.actor_id,
        occurredAt,
        harness.dossierId,
        assertionId,
      ),
    ],
    [{
      actorRole: "reviewer",
      eventType: "assertion_reviewed",
      objectRefType: "professional_assertion",
      objectRefId: assertionId,
      summaryCode: "ASSERTION_ACCEPTED",
      detail: { source_anchor_id: anchorId },
    }],
  );

  const requestId = opaque("information_request");
  await applyRevision(
    harness,
    harness.ownerContext,
    (_nextRevision, occurredAt) => [
      d1.prepare(
        "INSERT INTO dossier_information_requests (id, dossier_id, question, owner_user_id, owner_actor_ref, priority, status, reason, readiness_reason_code, satisfying_document_id, created_by_actor_ref, updated_by_actor_ref, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 'high', 'received', ?, 'INFORMATION_REQUEST_OPEN', ?, ?, ?, ?, ?)",
      ).bind(
        requestId,
        harness.dossierId,
        "Provide the reviewed chronology.",
        harness.owner.id,
        harness.owner.actor_id,
        "Required for decision chronology.",
        chronology.document_id,
        harness.owner.actor_id,
        harness.owner.actor_id,
        occurredAt,
        occurredAt,
      ),
    ],
    [{
      actorRole: "owner",
      eventType: "information_request_changed",
      objectRefType: "information_request",
      objectRefId: requestId,
      summaryCode: "INFORMATION_REQUEST_SATISFIED",
      detail: { satisfying_document_id: chronology.document_id },
    }],
  );

  const simulationReceiptId = await seedSimulationReceipt(harness);
  const packageReferenceId = opaque("package_reference");
  await applyRevision(
    harness,
    harness.ownerContext,
    (nextRevision, occurredAt) => [
      d1.prepare(
        "INSERT INTO dossier_decision_package_references (id, dossier_id, package_id, package_version, package_fingerprint, source_dossier_revision, state, graph_validation_status, graph_digest, simulation_run_references, approval_state, package_type_registry, package_type_id, package_type_version, created_by_actor_ref, updated_by_actor_ref, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, 'current', 'valid', ?, ?, 'published', 'genesis-juris-case-types', 'general', '1.0.0', ?, ?, ?, ?)",
      ).bind(
        packageReferenceId,
        harness.dossierId,
        PACKAGE_DRAFT.caseId,
        PACKAGE_DRAFT.version,
        PACKAGE_FINGERPRINT,
        nextRevision,
        graphDigest,
        JSON.stringify([simulationReceiptId]),
        harness.owner.actor_id,
        harness.owner.actor_id,
        occurredAt,
        occurredAt,
      ),
    ],
    [{
      actorRole: "owner",
      eventType: "decision_package_linked",
      objectRefType: "decision_package_reference",
      objectRefId: packageReferenceId,
      summaryCode: "DECISION_PACKAGE_LINKED",
      detail: {
        package_id: PACKAGE_DRAFT.caseId,
        package_version: PACKAGE_DRAFT.version,
        graph_digest: graphDigest,
        simulation_receipt_id: simulationReceiptId,
      },
    }],
  );

  const graphNodeId = PACKAGE_DRAFT.nodes[0]!.id;
  assert.equal(
    await exactCurrentGraphEntityExists(
      harness.ownerContext,
      harness.dossierId,
      packageReferenceId,
      "graph_node",
      graphNodeId,
    ),
    true,
  );
  const evidenceLinkId = opaque("evidence_link");
  await applyRevision(
    harness,
    harness.reviewerContext,
    (_nextRevision, occurredAt) => [
      d1.prepare(
        "INSERT INTO dossier_evidence_links (id, dossier_id, source_anchor_id, assertion_id, decision_package_reference_id, target_type, target_id, relation, professional_meaning, created_by_actor_ref, reviewed_by_user_id, reviewed_by_actor_ref, reviewed_at, created_at) VALUES (?, ?, ?, ?, ?, 'graph_node', ?, 'supports', ?, ?, ?, ?, ?, ?)",
      ).bind(
        evidenceLinkId,
        harness.dossierId,
        anchorId,
        assertionId,
        packageReferenceId,
        graphNodeId,
        "The exact reviewed notice supports the selected decision-graph node.",
        harness.reviewer.actor_id,
        harness.reviewer.id,
        harness.reviewer.actor_id,
        occurredAt,
        occurredAt,
      ),
    ],
    [{
      actorRole: "reviewer",
      eventType: "evidence_link_changed",
      objectRefType: "evidence_link",
      objectRefId: evidenceLinkId,
      summaryCode: "GRAPH_EVIDENCE_LINKED",
      detail: {
        source_anchor_id: anchorId,
        decision_package_reference_id: packageReferenceId,
        target_type: "graph_node",
        target_id: graphNodeId,
      },
    }],
  );

  const currentRevision = await row<{ revision: number }>(
    "SELECT revision FROM dossiers WHERE id = ?",
    harness.dossierId,
  );
  assert.equal(currentRevision?.revision, 13);
  const snapshot = await createDossierSnapshot({
    context: harness.ownerContext,
    dependencies: harness.ownerGovernedDependencies,
    bucket,
    dossierId: harness.dossierId,
    expectedRevision: 13,
    locale: "en",
    audience: "internal",
    redactionProfileId: "pilot-default",
  });
  assert.equal(snapshot.snapshot.document_versions.length, 3);
  assert.deepEqual(snapshot.snapshot.accepted_assertion_ids, [assertionId]);
  assert.deepEqual(snapshot.snapshot.source_anchor_ids, [anchorId]);
  assert.deepEqual(
    snapshot.snapshot.decision_packages[0]?.simulation_receipt_ids,
    [simulationReceiptId],
  );

  const pdf = await generateDossierGovernedOutput({
    context: harness.ownerContext,
    dependencies: harness.ownerGovernedDependencies,
    bucket,
    dossierId: harness.dossierId,
    expectedRevision: 13,
    snapshotId: snapshot.snapshot.snapshot_id,
    format: "pdf",
  });
  const json = await generateDossierGovernedOutput({
    context: harness.ownerContext,
    dependencies: harness.ownerGovernedDependencies,
    bucket,
    dossierId: harness.dossierId,
    expectedRevision: 13,
    snapshotId: snapshot.snapshot.snapshot_id,
    format: "json_manifest",
  });
  assert.equal(pdf.output.snapshot_id, snapshot.snapshot.snapshot_id);
  assert.equal(json.output.snapshot_digest, snapshot.snapshot.manifest_digest);

  const pdfDownload = await downloadDossierGovernedOutput({
    context: harness.ownerContext,
    bucket,
    dossierId: harness.dossierId,
    outputId: pdf.output.output_id,
  });
  const pdfBytes = new Uint8Array(await pdfDownload.arrayBuffer());
  assert.equal(pdfDownload.headers.get("content-type"), "application/pdf");
  assert.ok(pdfBytes.byteLength > 20_000);
  assert.match(new TextDecoder("latin1").decode(pdfBytes), /^%PDF-1\.[3-7]/u);

  const jsonDownload = await downloadDossierGovernedOutput({
    context: harness.ownerContext,
    bucket,
    dossierId: harness.dossierId,
    outputId: json.output.output_id,
  });
  const manifest = await jsonDownload.json() as {
    snapshot: { snapshot_id: string };
    source_register: unknown[];
    assertion_register: unknown[];
    anchor_register: unknown[];
    decision_package_graphs: Array<{ graph_digest: string }>;
  };
  assert.equal(manifest.snapshot.snapshot_id, snapshot.snapshot.snapshot_id);
  assert.deepEqual(
    [
      manifest.source_register.length,
      manifest.assertion_register.length,
      manifest.anchor_register.length,
      manifest.decision_package_graphs.length,
    ],
    [3, 1, 1, 1],
  );
  assert.equal(manifest.decision_package_graphs[0]?.graph_digest, graphDigest);

  const approval = await approveDossierGovernedOutput({
    context: harness.reviewerContext,
    dependencies: harness.reviewerGovernedDependencies,
    dossierId: harness.dossierId,
    expectedRevision: 13,
    outputId: pdf.output.output_id,
    reviewerParticipantId: harness.reviewerParticipantId,
  });
  assert.equal(approval.output.state, "current");
  assert.equal(approval.approval.reviewer_participant_id, harness.reviewerParticipantId);
  assert.equal(approval.output.reviewer_actor_id, harness.reviewer.actor_id);

  const sourceV3 = await uploadTextDocument({
    harness,
    expectedRevision: 13,
    filename: "contract-notice.txt",
    mediaType: "text/plain",
    title: "Contract notice",
    text: "Replacement notice dated 2 September 2026. Reviewed amount EUR 530,000.",
    idempotencyKey: "scenario-a-source-v3",
    documentId: sourceV1.document_id,
  });
  assert.equal(sourceV3.version.ordinal, 3);
  assert.equal(sourceV3.version.predecessor_version_id, sourceV2.version.document_version_id);
  const outputs = await listDossierGovernedOutputs(
    harness.ownerContext,
    harness.dossierId,
  );
  assert.equal(outputs.length, 2);
  assert.ok(outputs.every((output) =>
    output.state === "stale" && output.stale_reason === "DOCUMENT_VERSION_CHANGED"
  ));
  const retainedV2 = await bucket.get(versionRows[1]!.binary_object_reference);
  assert.ok(retainedV2);
  assert.equal(await retainedV2.text(), sourceV2Text);
  assert.equal(
    await row<{ count: number }>(
      "SELECT count(*) AS count FROM dossier_output_state_events WHERE dossier_id = ? AND state = 'stale' AND reason = 'DOCUMENT_VERSION_CHANGED'",
      harness.dossierId,
    ).then((value) => value?.count),
    2,
  );
});

test("Scenario B - AI candidates remain cited review proposals and only accepted decisions become authoritative", () => {
  const dossierId = "dossier_ai_acceptance_001";
  const documentVersionId = "document_version_ai_001";
  const reviewerActorId = "actor_ai_reviewer_001";
  const types = ["fact", "dated_event", "contradiction", "evidence_link"] as const;
  const anchors = types.map((type) => ({
    anchorId: "source_anchor_ai_" + type,
    documentVersionId,
  }));
  const proposals = types.map((proposalType, index): DossierAIProposalV1 => ({
    object_type: "ai_proposal",
    schema_version: 1,
    proposal_id: "proposal_ai_" + proposalType,
    dossier_id: dossierId,
    source_document_version_ids: [documentVersionId],
    source_anchor_ids: [anchors[index]!.anchorId],
    proposal_type: proposalType,
    proposed_value: proposalType === "evidence_link"
      ? {
          statement: "The cited passage supports the current graph node.",
          target_type: "graph_node",
          target_id: "release",
          decision_package_reference_id: "package_reference_ai_001",
        }
      : { statement: proposalType + " candidate grounded in the cited span." },
    confidence: null,
    model_provenance: {
      provider: "configured-provider",
      model: "configured-model",
      configuration_digest: "sha256-" + "a".repeat(64),
    },
    review_state: "pending",
    reviewing_actor_id: null,
    reviewed_at: null,
    review_note: null,
    accepted_object_type: null,
    accepted_object_id: null,
    created_at: "2026-09-01T10:00:00.000Z",
    created_by: "system-ai",
  }));
  for (const [index, proposal] of proposals.entries()) {
    assert.deepEqual(proposal.source_document_version_ids, [documentVersionId]);
    assert.deepEqual(proposal.source_anchor_ids, [anchors[index]!.anchorId]);
    assert.equal(proposal.confidence, null);
  }

  const common = {
    actorRole: "reviewer" as const,
    actorId: reviewerActorId,
    reviewedAt: "2026-09-01T10:05:00.000Z",
  };
  const acceptedFact = reviewDossierProposal(proposals[0]!, {
    ...common,
    action: "accept",
    acceptedObjectType: "professional_assertion",
    acceptedObjectId: "assertion_ai_fact_001",
    anchorBindings: [anchors[0]!],
  });
  const acceptedEditedDate = reviewDossierProposal(proposals[1]!, {
    ...common,
    action: "accept",
    editedValue: { statement: "The professionally reviewed event occurred on 1 September 2026." },
    acceptedObjectType: "professional_assertion",
    acceptedObjectId: "assertion_ai_date_001",
    note: "Corrected wording while retaining the exact citation.",
    anchorBindings: [anchors[1]!],
  });
  const rejectedContradiction = reviewDossierProposal(proposals[2]!, {
    ...common,
    action: "reject",
    note: "The cited span does not support a contradiction.",
    anchorBindings: [anchors[2]!],
  });
  const acceptedGraphLink = reviewDossierProposal(proposals[3]!, {
    ...common,
    action: "accept",
    acceptedObjectType: "evidence_link",
    acceptedObjectId: "evidence_link_ai_001",
    anchorBindings: [anchors[3]!],
  });

  const reviewed = [
    acceptedFact,
    acceptedEditedDate,
    rejectedContradiction,
    acceptedGraphLink,
  ];
  const authoritativeReviewFlow = reviewed
    .filter((proposal) => proposal.review_state === "accepted")
    .map((proposal) => ({
      proposal_id: proposal.proposal_id,
      object_type: proposal.accepted_object_type,
      object_id: proposal.accepted_object_id,
      source_anchor_ids: proposal.source_anchor_ids,
    }));
  assert.deepEqual(
    authoritativeReviewFlow.map(({ object_type }) => object_type),
    ["professional_assertion", "professional_assertion", "evidence_link"],
  );
  assert.equal(
    authoritativeReviewFlow.some(({ proposal_id }) =>
      proposal_id === rejectedContradiction.proposal_id
    ),
    false,
  );
  assert.equal(rejectedContradiction.accepted_object_id, null);
  assert.deepEqual(
    acceptedEditedDate.proposed_value,
    { statement: "The professionally reviewed event occurred on 1 September 2026." },
  );

  const replacementDecisions = reviewed.map((proposal) =>
    dossierProposalSourceReplacementDecision(proposal, documentVersionId)
  );
  assert.deepEqual(
    replacementDecisions.map(({ result }) => result),
    [
      "accepted_dependency_stale",
      "accepted_dependency_stale",
      "unaffected",
      "accepted_dependency_stale",
    ],
  );
  assert.deepEqual(
    replacementDecisions
      .map((decision) => decision.staleAcceptedObject)
      .filter((value) => value !== null),
    [
      { objectType: "professional_assertion", objectId: "assertion_ai_fact_001" },
      { objectType: "professional_assertion", objectId: "assertion_ai_date_001" },
      { objectType: "evidence_link", objectId: "evidence_link_ai_001" },
    ],
  );
});

test("Scenario C - viewer, contributor and reviewer powers stay distinct through audited lifecycle decisions", () => {
  const dossierId = "dossier_roles_acceptance_001";
  const ownerActorId = "actor_owner_acceptance_001";
  const identity = (actorId: string) => ({
    authenticated: true,
    source: DOSSIER_TRUSTED_IDENTITY_SOURCE,
    actorId,
  });
  const dossier = { dossierId, ownerActorId };
  const participant = (actorId: string, role: DossierRole) => ({
    dossierId,
    actorId,
    role,
    status: "active" as const,
  });
  const viewerActorId = "actor_viewer_acceptance_001";
  const contributorActorId = "actor_contributor_acceptance_001";
  const reviewerActorId = "actor_reviewer_acceptance_001";

  assert.equal(authorizeDossierAction({
    action: "read",
    identity: identity(viewerActorId),
    dossier,
    participant: participant(viewerActorId, "viewer"),
  }).allowed, true);
  assert.deepEqual(authorizeDossierAction({
    action: "upload",
    identity: identity(viewerActorId),
    dossier,
    participant: participant(viewerActorId, "viewer"),
  }), { allowed: false, reason: "ROLE_FORBIDDEN" });
  assert.deepEqual(authorizeDossierAction({
    action: "documents",
    identity: identity(viewerActorId),
    dossier,
    participant: participant(viewerActorId, "viewer"),
  }), { allowed: false, reason: "ROLE_FORBIDDEN" });
  assert.equal(authorizeDossierAction({
    action: "upload",
    identity: identity(contributorActorId),
    dossier,
    participant: participant(contributorActorId, "contributor"),
  }).allowed, true);
  assert.deepEqual(authorizeDossierAction({
    action: "approve",
    identity: identity(contributorActorId),
    dossier,
    participant: participant(contributorActorId, "contributor"),
  }), { allowed: false, reason: "ROLE_FORBIDDEN" });
  assert.equal(authorizeDossierAction({
    action: "approve",
    identity: identity(reviewerActorId),
    dossier,
    participant: participant(reviewerActorId, "reviewer"),
  }).allowed, true);
  assert.equal(authorizeDossierAction({
    action: "documents",
    identity: identity(reviewerActorId),
    dossier,
    participant: participant(reviewerActorId, "reviewer"),
  }).allowed, true);

  assert.deepEqual(dossierStatusTransitionDecision({
    from: "active",
    to: "archived",
    actor_role: "reviewer",
    reason: "Attempted shortcut.",
  }), {
    allowed: false,
    code: "TRANSITION_FORBIDDEN",
    requirements: [],
    consequences: [],
  });
  const lifecycle = [
    {
      from: "internal_review",
      to: "output_approved",
      actor_role: "reviewer",
      has_current_output: true,
      has_reviewer_approval: true,
    },
    {
      from: "output_approved",
      to: "closed",
      actor_role: "reviewer",
      reason: "Professional work completed.",
    },
    {
      from: "closed",
      to: "archived",
      actor_role: "reviewer",
      reason: "Retention lifecycle started.",
    },
    {
      from: "archived",
      to: "active",
      actor_role: "reviewer",
      reason: "New material requires reopening.",
    },
  ] as const;
  const auditedTransitions = lifecycle.map((transition, index) => {
    const decision = dossierStatusTransitionDecision(transition);
    assert.equal(decision.allowed, true);
    if (!decision.allowed) return assert.fail("Expected a permitted lifecycle transition.");
    return {
      transition_id: "status_transition_e2e_" + String(index + 1).padStart(3, "0"),
      revision_before: index + 1,
      revision_after: index + 2,
      from: transition.from,
      to: transition.to,
      actor_role: transition.actor_role,
      consequences: decision.consequences,
      audit_event: "dossier_status_transitioned",
    };
  });
  assert.deepEqual(
    auditedTransitions.map(({ to }) => to),
    ["output_approved", "closed", "archived", "active"],
  );
  assert.ok(auditedTransitions.every((entry) =>
    entry.revision_after === entry.revision_before + 1
    && entry.audit_event === "dossier_status_transitioned"
    && entry.consequences.includes("recompute_readiness")
  ));
});

test("Scenario D - v61 validation, simulation, anonymous PDF and Studio save-return remain dossier-free", async () => {
  const dossierCountBefore = await row<{ count: number }>(
    "SELECT count(*) AS count FROM dossiers",
  );
  const existing = scenarios[0]!;
  const resolved = await resolvePlayedCaseScenario({
    id: existing.id,
    caseId: existing.caseId,
    contentVersion: existing.version,
    fingerprint: existing.fingerprint,
  }, [existing], async () => assert.fail("Cached v61 import must not require a manifest request."));
  const normalized = normalizePlayableScenario(structuredClone(resolved.scenario));
  assert.equal(playableFingerprint(normalized), existing.fingerprint);
  assert.equal(resolved.legacyTiming, false);

  const initialRuntime = createCanonicalRuntime(existing.caseId, 62);
  const actionId = canonicalAvailableActionIds(initialRuntime)[0];
  assert.ok(actionId);
  const simulated = dispatchCanonicalAction(initialRuntime, actionId);
  assert.equal(simulated.sourceFingerprint, initialRuntime.sourceFingerprint);
  assert.equal(simulated.actionUses[actionId], 1);
  assert.notDeepEqual(simulated, initialRuntime);

  const anonymousFixture = reportPdfFixtures().find((fixture) =>
    fixture.id === "golden-general_advisory-en-internal"
  );
  assert.ok(anonymousFixture);
  const anonymousArtifacts = buildCaseReportArtifacts(
    anonymousFixture.draft,
    reportOptions(anonymousFixture),
  );
  const anonymousPdf = await renderPdf(anonymousArtifacts.definition);
  assert.ok(anonymousPdf.pages.length > 0);
  assert.ok(anonymousPdf.pages.every((page) => page.items.length > 0));
  assert.match(
    new TextDecoder("latin1").decode(anonymousPdf.bytes),
    /^%PDF-1\.[3-7]/u,
  );

  assert.equal(restoredStudioWorkflowStep(true, 6, 6), 1);
  const savedStep = serializedStudioWorkflowStep(5);
  const restoredStep = restoredStudioWorkflowStep(
    false,
    null,
    parseStudioWorkflowStep(savedStep),
  );
  assert.equal(restoredStep, 5);
  assert.equal(
    studioWorkflowStorageKey(existing.caseId),
    "genesis-juris:studio-workflow:v1:" + existing.caseId,
  );
  const appSource = readFileSync(new URL("../app/JurisApp.tsx", import.meta.url), "utf8");
  assert.match(appSource, /return_to=.*view=studio&auth_retry=1/u);
  assert.match(appSource, /setDraft\(pending\.draft\)/u);
  assert.match(appSource, /shareDraftRef\.current\(pending\.action, pending\)/u);

  const dossierCountAfter = await row<{ count: number }>(
    "SELECT count(*) AS count FROM dossiers",
  );
  assert.deepEqual(dossierCountAfter, dossierCountBefore);
});

test("Scenario E - named Bhopal and bilingual cyclic stress PDFs keep whole portrait nodes and resolvable connector pairs", async () => {
  const bhopal: ReportPdfFixture = {
    ...PACKAGE_FIXTURE,
    draft: {
      ...structuredClone(PACKAGE_FIXTURE.draft),
      nodes: PACKAGE_FIXTURE.draft.nodes.map((node) => ({
        ...node,
        detail: ((node.detail + " ").repeat(4)).trim(),
      })),
    },
  };
  const stressBase = reportPdfFixtures().find((fixture) =>
    fixture.id === "stress-cyclic-repair"
  );
  assert.ok(stressBase);
  const stressDraft: StudioDraft = {
    ...structuredClone(stressBase.draft),
    caseId: "v62_e2e_bilingual_cyclic_stress",
    title: "Bilingual cyclic evidence stress - Двуязычная проверка циклических доказательств",
    premise: (
      "A long bilingual professional record tests branching, cycles, page transitions and complete source-grounded wording. "
      + "Длинная двуязычная профессиональная запись проверяет ветвление, циклы, переходы между страницами и полноту формулировок. "
    ).repeat(4).trim(),
    nodes: stressBase.draft.nodes.map((node, index) => ({
      ...node,
      title: "Cross-border evidence record " + String(index + 1).padStart(2, "0")
        + " - Трансграничная проверка доказательств с полной формулировкой",
      detail: (
        "Retain source, owner, date, limitation, verification status and reviewer qualification without clipping. "
        + "Сохранить источник, владельца, дату, ограничение, статус проверки и квалификацию рецензента без обрезки. "
      ).repeat(4).trim(),
    })),
  };
  const stress: ReportPdfFixture = {
    id: "e2e-bilingual-cyclic-stress",
    family: "e2e-stress",
    tags: ["stress", "bilingual", "cyclic", "branching", "release-blocking"],
    language: "ru",
    audience: "internal",
    draft: stressDraft,
  };

  for (const fixture of [bhopal, stress]) {
    const artifacts = buildCaseReportArtifacts(
      fixture.draft,
      reportOptions(fixture),
    );
    const rendered = await renderPdf(artifacts.definition);
    const layout = artifacts.layoutModel;
    assert.ok(rendered.pages.length > 0);
    for (const [index, page] of rendered.pages.entries()) {
      assert.ok(
        page.items.length > 0,
        fixture.id + " rendered blank report page " + String(index + 1),
      );
    }
    const pdfSource = new TextDecoder("latin1").decode(rendered.bytes);
    assert.match(pdfSource, /^%PDF-1\.[3-7]/u);
    assert.match(pdfSource, /%%EOF/u);
    assert.doesNotMatch(pdfSource, /\/Rotate\s+90\b/u);
    assert.deepEqual(layout.paper, {
      height: 297_000,
      orientation: "portrait",
      unit: "micrometre",
      width: 210_000,
    });
    assert.notEqual(
      (artifacts.definition as { pageOrientation?: string }).pageOrientation,
      "landscape",
    );

    const nodeById = new Map(layout.nodes.map((node) => [node.id, node]));
    assert.equal(nodeById.size, fixture.draft.nodes.length);
    for (const sourceNode of fixture.draft.nodes) {
      const node = nodeById.get(sourceNode.id);
      assert.ok(node, fixture.id + " omitted node " + sourceNode.id);
      assert.equal(node.text.title.fullText, sourceNode.title);
      assert.equal(node.text.detail.fullText, sourceNode.detail);
      assert.equal(
        node.text.title.lines.some((line) =>
          line.text.endsWith("...") || line.text.endsWith("…")
        ),
        false,
      );
      assert.ok(
        node.box.y >= layout.graphFrame.y
        && node.box.y + node.box.height <= layout.graphFrame.y + layout.graphFrame.height,
      );
      assert.equal(
        layout.graphPages.find((page) => page.id === node.pageId)?.nodeIds.includes(node.id),
        true,
      );
    }
    for (const layer of layout.layoutLayers) {
      assert.ok(layer.nodeIds.every((nodeId) =>
        nodeById.get(nodeId)?.pageId === layer.pageId
      ));
    }

    const edgeById = new Map(fixture.draft.links.map((edge) => [edge.id, edge]));
    const endpointIds = layout.graphPages.flatMap((page) => page.connectorEndpointIds);
    for (const pair of layout.crossPageConnectorPairs) {
      const edge = edgeById.get(pair.edgeId);
      assert.ok(edge, fixture.id + " invented connector edge " + pair.edgeId);
      assert.equal(pair.outgoing.nodeId, edge.from);
      assert.equal(pair.incoming.nodeId, edge.to);
      assert.equal(pair.outgoing.targetPageId, pair.incoming.pageId);
      assert.equal(pair.incoming.targetPageId, pair.outgoing.pageId);
      assert.equal(
        endpointIds.filter((endpointId) => endpointId.startsWith(pair.id + ":")).length,
        2,
      );
      const outgoingSvg = caseReportGraphLayoutSvg(layout, pair.outgoing.pageId, fixture.language);
      const incomingSvg = caseReportGraphLayoutSvg(layout, pair.incoming.pageId, fixture.language);
      assert.match(outgoingSvg, new RegExp('data-connector-endpoint="' + pair.id + ':OUT"'));
      assert.match(incomingSvg, new RegExp('data-connector-endpoint="' + pair.id + ':IN"'));
      assert.match(outgoingSvg, new RegExp('data-target-node="' + pair.incoming.nodeRef + '"'));
      assert.match(incomingSvg, new RegExp('data-target-node="' + pair.outgoing.nodeRef + '"'));
    }
    assert.equal(endpointIds.length, layout.crossPageConnectorPairs.length * 2);
  }

  const bhopalArtifacts = buildCaseReportArtifacts(
    bhopal.draft,
    reportOptions(bhopal),
  );
  assert.ok(bhopalArtifacts.layoutModel.graphPages.length > 1);
  assert.ok(bhopalArtifacts.layoutModel.crossPageConnectorPairs.length > 0);

  const stressArtifacts = buildCaseReportArtifacts(
    stress.draft,
    reportOptions(stress),
  );
  assert.ok(stressArtifacts.layoutModel.graphPages.length >= 3);
  assert.ok(stressArtifacts.layoutModel.crossPageConnectorPairs.length >= 2);
  assert.ok(stressArtifacts.layoutModel.cyclicRepairs.length > 0);
  assert.ok(stressArtifacts.layoutModel.nodes.some((node) =>
    node.text.title.lines.length > 1
  ));
});
