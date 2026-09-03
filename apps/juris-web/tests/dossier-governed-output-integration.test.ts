import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { after, before, test } from "node:test";
import { drizzle } from "drizzle-orm/d1";
import { Miniflare } from "miniflare";
import * as schema from "../db/schema";
import { caseFingerprint, normalizeStudioDraft } from "../app/case-integrity";
import { validatePublishedDecisionPackage } from "../app/dossier-decision-package-integration";
import {
  approveDossierGovernedOutput,
  buildDossierGovernancePdfContent,
  createDossierSnapshot,
  downloadDossierGovernedOutput,
  downloadDossierSnapshotManifest,
  generateDossierGovernedOutput,
  listDossierGovernedOutputs,
  listDossierSnapshots,
  mergeDossierPdfArtifactResources,
  type DossierGovernedError,
  type DossierGovernedContext,
  type DossierGovernedDependencies,
} from "../app/dossier-governed-output-server";
import { compileStudioDraft } from "../app/studio-compiler";
import { reportPdfFixtures } from "../scripts/tests/report-pdf-fixtures";

const migrations = [
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

let miniflare: Miniflare | undefined;
let d1!: D1Database;
let bucket!: R2Bucket;
let serial = 0;

const GOVERNED_PACKAGE_FIXTURE = reportPdfFixtures().find((fixture) =>
  fixture.id === "golden-bhopal-decision-memorandum"
);
if (!GOVERNED_PACKAGE_FIXTURE) {
  throw new Error("The named Bhopal release fixture is required.");
}
const GOVERNED_PACKAGE_DRAFT = normalizeStudioDraft(GOVERNED_PACKAGE_FIXTURE.draft);
const GOVERNED_STUDIO_FINGERPRINT = caseFingerprint(GOVERNED_PACKAGE_DRAFT);
const GOVERNED_COMPILATION = compileStudioDraft(
  GOVERNED_PACKAGE_DRAFT,
  GOVERNED_STUDIO_FINGERPRINT,
);
if (!GOVERNED_COMPILATION.scenario || GOVERNED_COMPILATION.issues.length > 0) {
  throw new Error("The governed package test graph must compile.");
}
const GOVERNED_PACKAGE_FINGERPRINT = GOVERNED_COMPILATION.scenario.fingerprint;
let governedGraphDigest = "";

type Harness = {
  dossierId: string;
  ownerContext: DossierGovernedContext;
  reviewerContext: DossierGovernedContext;
  ownerParticipantId: string;
  reviewerParticipantId: string;
  assertionId: string;
  packageReferenceId: string;
  packageFingerprint: string;
  simulationReceiptIds: string[];
  ownerDependencies: DossierGovernedDependencies;
  reviewerDependencies: DossierGovernedDependencies;
};

function opaque(prefix: string) {
  serial += 1;
  return `${prefix}_${serial.toString(16).padStart(32, "0")}`;
}

function simulationSessionKey() {
  serial += 1;
  return `00000000-0000-4000-8000-${serial.toString(16).padStart(12, "0")}`;
}

async function digest(value: string) {
  const bytes = new Uint8Array(await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value),
  ));
  return `sha256-${[...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("")}`;
}

function fixtureAuditStatement(input: {
  id: string;
  dossierId: string;
  revision: number;
  sequence: number;
  eventType: string;
  objectRefType: string;
  objectRefId: string;
  actorUserId: number;
  actorRef: string;
  actorRole: "owner" | "reviewer";
  occurredAt: string;
  summaryCode: string;
  previousEventId: string | null;
  eventDigest: string;
}) {
  return d1.prepare(`INSERT INTO dossier_audit_events (
    id, dossier_id, dossier_revision, sequence, event_type, object_ref_type,
    object_ref_id, actor_user_id, actor_ref, actor_role, occurred_at,
    summary_code, detail, previous_event_id, event_digest
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '{}', ?, ?)`)
    .bind(
      input.id,
      input.dossierId,
      input.revision,
      input.sequence,
      input.eventType,
      input.objectRefType,
      input.objectRefId,
      input.actorUserId,
      input.actorRef,
      input.actorRole,
      input.occurredAt,
      input.summaryCode,
      input.previousEventId,
      input.eventDigest,
    );
}

function auditDependencies(context: DossierGovernedContext): DossierGovernedDependencies {
  return {
    prepareAuditEvents: async (dossierId, dossierRevision, inputs) => {
      const previous = await d1.prepare(`
        SELECT id, sequence, event_digest
        FROM dossier_audit_events
        WHERE dossier_id = ?
        ORDER BY sequence DESC
        LIMIT 1
      `).bind(dossierId).first<{
        id: string;
        sequence: number;
        event_digest: string;
      }>();
      let previousId = previous?.id ?? null;
      let sequence = previous?.sequence ?? 0;
      const events: Array<typeof schema.dossierAuditEvents.$inferInsert> = [];
      for (const input of inputs) {
        sequence += 1;
        const id = opaque("audit");
        const occurredAt = input.occurredAt ?? new Date().toISOString();
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
          detail: input.detail ?? {},
          previousEventId: previousId,
          eventDigest: await digest(
            `${dossierId}:${dossierRevision}:${sequence}:${id}:${previous?.event_digest ?? ""}`,
          ),
        } satisfies typeof schema.dossierAuditEvents.$inferInsert;
        events.push(event);
        previousId = id;
      }
      return events;
    },
  };
}

async function createSnapshot(harness: Harness, expectedRevision = 3) {
  return createDossierSnapshot({
    context: harness.ownerContext,
    dependencies: harness.ownerDependencies,
    bucket,
    dossierId: harness.dossierId,
    expectedRevision,
    locale: "en",
    audience: "internal",
    redactionProfileId: "pilot-default",
  });
}

async function generateOutput(
  harness: Harness,
  snapshotId: string,
  format: "pdf" | "json_manifest" | "markdown",
  dependencies = harness.ownerDependencies,
) {
  return generateDossierGovernedOutput({
    context: harness.ownerContext,
    dependencies,
    bucket,
    dossierId: harness.dossierId,
    expectedRevision: 3,
    snapshotId,
    format,
  });
}

before(async () => {
  miniflare = new Miniflare({
    workers: [{
      config: {
        name: "dossier-governed-output-integration",
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
          DB: { type: "d1", name: "dossier-governed-output-integration" },
          DOSSIER_DOCUMENTS: {
            type: "r2",
            name: "dossier-governed-output-integration",
          },
        },
      },
      dev: {},
    }],
  });
  d1 = await miniflare.getD1Database(
    "DB",
    "dossier-governed-output-integration",
  ) as unknown as D1Database;
  bucket = await miniflare.getR2Bucket(
    "DOSSIER_DOCUMENTS",
    "dossier-governed-output-integration",
  ) as unknown as R2Bucket;
  for (const name of migrations) {
    const sql = readFileSync(new URL(`../drizzle/${name}`, import.meta.url), "utf8");
    for (const statement of sql.split("--> statement-breakpoint").map((item) => item.trim())) {
      if (statement) await d1.prepare(statement).run();
    }
  }
  const publishedRecord = {
    packageId: GOVERNED_PACKAGE_DRAFT.caseId,
    packageVersion: GOVERNED_PACKAGE_DRAFT.version,
    packageFingerprint: GOVERNED_PACKAGE_FINGERPRINT,
    studioFingerprint: GOVERNED_STUDIO_FINGERPRINT,
    parentPackageId: null,
    parentPackageVersion: null,
    parentPackageFingerprint: null,
    payload: { studioDraft: GOVERNED_PACKAGE_DRAFT },
  };
  const validation = await validatePublishedDecisionPackage(publishedRecord);
  assert.equal(validation.ok, true);
  if (!validation.ok) throw new Error("The governed package fixture did not validate.");
  governedGraphDigest = validation.value.graphDigest;
  await d1.batch([
    d1.prepare(`INSERT INTO cases (
      id, current_version, fingerprint, title, jurisdiction, practice_area,
      sector, difficulty, duration_minutes, status, review_level, author_name,
      reviewer_name, legal_as_of, summary, tags, centrally_managed, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 45, 'published', 'canonical',
      'Test author', 'Test reviewer', ?, ?, ?, true, ?)`).bind(
      GOVERNED_PACKAGE_DRAFT.caseId,
      GOVERNED_PACKAGE_DRAFT.version,
      GOVERNED_PACKAGE_FINGERPRINT,
      GOVERNED_PACKAGE_DRAFT.title,
      GOVERNED_PACKAGE_DRAFT.jurisdiction,
      GOVERNED_PACKAGE_DRAFT.classification?.practiceArea ?? "Regulatory",
      GOVERNED_PACKAGE_DRAFT.classification?.practiceArea ?? "Regulatory",
      GOVERNED_PACKAGE_DRAFT.classification?.difficulty ?? "Advanced",
      GOVERNED_PACKAGE_DRAFT.classification?.legalAsOf ?? null,
      GOVERNED_PACKAGE_DRAFT.premise,
      JSON.stringify(GOVERNED_PACKAGE_DRAFT.classification?.tags ?? []),
      GOVERNED_PACKAGE_DRAFT.updatedAt,
    ),
    d1.prepare(`INSERT INTO case_versions (
      case_id, version, fingerprint, studio_fingerprint, parent_case_id,
      parent_version, parent_fingerprint, change_summary, payload,
      published_at, created_at
    ) VALUES (?, ?, ?, ?, NULL, NULL, NULL, 'Governed graph fixture', ?, ?, ?)`).bind(
      GOVERNED_PACKAGE_DRAFT.caseId,
      GOVERNED_PACKAGE_DRAFT.version,
      GOVERNED_PACKAGE_FINGERPRINT,
      GOVERNED_STUDIO_FINGERPRINT,
      JSON.stringify({ studioDraft: GOVERNED_PACKAGE_DRAFT }),
      GOVERNED_PACKAGE_DRAFT.updatedAt,
      GOVERNED_PACKAGE_DRAFT.updatedAt,
    ),
  ]);
});

after(async () => {
  await miniflare?.dispose();
});

test("migration 0018 and private R2 support governed artifacts", async () => {
  assert.deepEqual(await drizzle(d1, { schema }).select().from(schema.dossierSnapshots), []);
  await bucket.put("private/governed-output-probe", "ok");
  assert.equal(await (await bucket.get("private/governed-output-probe"))?.text(), "ok");
  await bucket.delete("private/governed-output-probe");
});

test("accepted assertion supersession audits the superseder actor/time and type changes cannot omit audit", async () => {
  const harness = await seedHarness("assertion-exact-audit");
  const original = await row<{
    reviewed_by_actor_ref: string;
    reviewed_at: string;
  }>(`
    SELECT reviewed_by_actor_ref, reviewed_at
    FROM dossier_professional_assertions
    WHERE dossier_id = ? AND id = ?
  `, harness.dossierId, harness.assertionId);
  assert.ok(original);
  assert.notEqual(original.reviewed_by_actor_ref, harness.ownerContext.actor.actorId);

  const previous = await row<{ id: string; sequence: number }>(`
    SELECT id, sequence FROM dossier_audit_events
    WHERE dossier_id = ? ORDER BY sequence DESC LIMIT 1
  `, harness.dossierId);
  assert.ok(previous);
  const supersededAt = new Date(Date.now() + 1).toISOString();
  assert.notEqual(original.reviewed_at, supersededAt);
  const supersededAuditId = opaque("audit");
  await d1.batch([
    d1.prepare("UPDATE dossiers SET revision = 4, updated_by_actor_ref = ?, updated_at = ? WHERE id = ? AND revision = 3")
      .bind(harness.ownerContext.actor.actorId, supersededAt, harness.dossierId),
    d1.prepare(`
      UPDATE dossier_professional_assertions
      SET status = 'superseded', updated_by_actor_ref = ?, updated_at = ?
      WHERE dossier_id = ? AND id = ? AND status = 'accepted'
    `).bind(
      harness.ownerContext.actor.actorId,
      supersededAt,
      harness.dossierId,
      harness.assertionId,
    ),
    fixtureAuditStatement({
      id: supersededAuditId,
      dossierId: harness.dossierId,
      revision: 4,
      sequence: previous.sequence + 1,
      eventType: "assertion_reviewed",
      objectRefType: "professional_assertion",
      objectRefId: harness.assertionId,
      actorUserId: harness.ownerContext.actor.userId,
      actorRef: harness.ownerContext.actor.actorId,
      actorRole: "owner",
      occurredAt: supersededAt,
      summaryCode: "PROFESSIONAL_ASSERTION_SUPERSEDED",
      previousEventId: previous.id,
      eventDigest: await digest("assertion-exact-audit:superseded"),
    }),
    d1.prepare(`
      INSERT INTO dossier_revision_receipts
        (dossier_id, resulting_revision, created_by_actor_ref, created_at)
      VALUES (?, 4, ?, ?)
    `).bind(harness.dossierId, harness.ownerContext.actor.actorId, supersededAt),
  ]);
  const supersession = await row<{
    status: string;
    reviewed_by_actor_ref: string;
    reviewed_at: string;
    updated_by_actor_ref: string;
    updated_at: string;
    audit_actor_ref: string;
    audit_occurred_at: string;
  }>(`
    SELECT assertion.status, assertion.reviewed_by_actor_ref,
      assertion.reviewed_at, assertion.updated_by_actor_ref,
      assertion.updated_at, audit.actor_ref AS audit_actor_ref,
      audit.occurred_at AS audit_occurred_at
    FROM dossier_professional_assertions AS assertion
    JOIN dossier_audit_events AS audit
      ON audit.dossier_id = assertion.dossier_id
      AND audit.dossier_revision = 4
      AND audit.event_type = 'assertion_reviewed'
      AND audit.object_ref_type = 'professional_assertion'
      AND audit.object_ref_id = assertion.id
      AND audit.actor_ref = assertion.updated_by_actor_ref
      AND audit.occurred_at = assertion.updated_at
    WHERE assertion.dossier_id = ? AND assertion.id = ?
  `, harness.dossierId, harness.assertionId);
  assert.deepEqual(supersession, {
    status: "superseded",
    reviewed_by_actor_ref: original.reviewed_by_actor_ref,
    reviewed_at: original.reviewed_at,
    updated_by_actor_ref: harness.ownerContext.actor.actorId,
    updated_at: supersededAt,
    audit_actor_ref: harness.ownerContext.actor.actorId,
    audit_occurred_at: supersededAt,
  });

  const mutableAssertionId = opaque("assertion");
  const mutableCreatedAt = new Date(Date.now() + 2).toISOString();
  const mutableAuditId = opaque("audit");
  await d1.batch([
    d1.prepare("UPDATE dossiers SET revision = 5, updated_by_actor_ref = ?, updated_at = ? WHERE id = ? AND revision = 4")
      .bind(harness.ownerContext.actor.actorId, mutableCreatedAt, harness.dossierId),
    d1.prepare(`
      INSERT INTO dossier_professional_assertions (
        id, dossier_id, assertion_type, statement, status,
        created_by_actor_ref, updated_by_actor_ref, created_at, updated_at
      ) VALUES (?, ?, 'fact', 'Mutable draft assertion.', 'needs_review', ?, ?, ?, ?)
    `).bind(
      mutableAssertionId,
      harness.dossierId,
      harness.ownerContext.actor.actorId,
      harness.ownerContext.actor.actorId,
      mutableCreatedAt,
      mutableCreatedAt,
    ),
    fixtureAuditStatement({
      id: mutableAuditId,
      dossierId: harness.dossierId,
      revision: 5,
      sequence: previous.sequence + 2,
      eventType: "assertion_reviewed",
      objectRefType: "professional_assertion",
      objectRefId: mutableAssertionId,
      actorUserId: harness.ownerContext.actor.userId,
      actorRef: harness.ownerContext.actor.actorId,
      actorRole: "owner",
      occurredAt: mutableCreatedAt,
      summaryCode: "PROFESSIONAL_ASSERTION_CREATED",
      previousEventId: supersededAuditId,
      eventDigest: await digest("assertion-exact-audit:mutable-created"),
    }),
    d1.prepare(`
      INSERT INTO dossier_revision_receipts
        (dossier_id, resulting_revision, created_by_actor_ref, created_at)
      VALUES (?, 5, ?, ?)
    `).bind(harness.dossierId, harness.ownerContext.actor.actorId, mutableCreatedAt),
  ]);
  await assert.rejects(
    d1.prepare(`
      UPDATE dossier_professional_assertions
      SET assertion_type = 'date', updated_by_actor_ref = ?, updated_at = ?
      WHERE dossier_id = ? AND id = ?
    `).bind(
      harness.ownerContext.actor.actorId,
      new Date(Date.now() + 3).toISOString(),
      harness.dossierId,
      mutableAssertionId,
    ).run(),
    /FOREIGN KEY constraint failed/u,
  );
  assert.equal(
    (await row<{ assertion_type: string }>(`
      SELECT assertion_type FROM dossier_professional_assertions
      WHERE dossier_id = ? AND id = ?
    `, harness.dossierId, mutableAssertionId))?.assertion_type,
    "fact",
  );
});

test("multi-package PDF composition retains later resources and rejects collisions or unavailable fonts", () => {
  type Definitions = Parameters<typeof mergeDossierPdfArtifactResources>[0];
  const resources = mergeDossierPdfArtifactResources([
    {
      content: [],
      defaultStyle: { font: "Roboto" },
      images: { "first-image": "data:image/png;base64,AA==" },
      patterns: { "first-pattern": { boundingBox: [0, 0, 1, 1], xStep: 1, yStep: 1, pattern: "" } },
      styles: { "first-style": { font: "Roboto", color: "#111111" } },
    },
    {
      content: [{ image: "later-image", style: "later-style" }],
      defaultStyle: { font: "Roboto" },
      images: { "later-image": "data:image/png;base64,AQ==" },
      patterns: { "later-pattern": { boundingBox: [0, 0, 2, 2], xStep: 2, yStep: 2, pattern: "" } },
      styles: { "later-style": { font: "Roboto", color: "#222222" } },
    },
  ] as unknown as Definitions);
  assert.deepEqual(Object.keys(resources.images ?? {}).sort(), ["first-image", "later-image"]);
  assert.deepEqual(Object.keys(resources.patterns ?? {}).sort(), ["first-pattern", "later-pattern"]);
  assert.deepEqual(Object.keys(resources.styles ?? {}).sort(), ["first-style", "later-style"]);

  assert.throws(
    () => mergeDossierPdfArtifactResources([
      { content: [], defaultStyle: { font: "Roboto" }, images: { shared: "first" } },
      { content: [], defaultStyle: { font: "Roboto" }, images: { shared: "second" } },
    ] as unknown as Definitions),
    (error) => {
      assertGovernedError(error, "decision_package_report_resource_conflict");
      return true;
    },
  );
  assert.throws(
    () => mergeDossierPdfArtifactResources([
      { content: [], defaultStyle: { font: "Roboto" } },
      {
        content: [{ text: "Later package", style: "later-font" }],
        defaultStyle: { font: "Roboto" },
        styles: { "later-font": { font: "UnsealedFont" } },
      },
    ] as unknown as Definitions),
    (error) => {
      assertGovernedError(error, "decision_package_report_font_unavailable");
      return true;
    },
  );
});

test("snapshot sealing enforces the pilot redaction contract and persists exact normalized sources", async () => {
  const harness = await seedHarness("snapshot-success");
  const assertPilotRedactionError = (error: unknown) => {
    assertGovernedError(error, "snapshot_redaction_unavailable");
    assert.equal(error.status, 409);
    assert.match(
      error.message,
      /pilot supports only internal.*pilot-default.*deterministic.*versioned redaction/iu,
    );
    return true;
  };
  await assert.rejects(
    createDossierSnapshot({
      context: harness.ownerContext,
      dependencies: harness.ownerDependencies,
      bucket,
      dossierId: harness.dossierId,
      expectedRevision: 3,
      locale: "en",
      audience: "client",
      redactionProfileId: "pilot-default",
    }),
    assertPilotRedactionError,
  );
  await assert.rejects(
    createDossierSnapshot({
      context: harness.ownerContext,
      dependencies: harness.ownerDependencies,
      bucket,
      dossierId: harness.dossierId,
      expectedRevision: 3,
      locale: "en",
      audience: "internal",
      redactionProfileId: "legacy-unversioned",
    }),
    assertPilotRedactionError,
  );
  assert.equal(
    await row<{ count: number }>(
      "SELECT count(*) AS count FROM dossier_snapshots WHERE dossier_id = ?",
      harness.dossierId,
    ).then((item) => item?.count),
    0,
  );
  assert.equal(await objectCount(harness.dossierId), 0);

  const result = await createSnapshot(harness);
  assert.equal(result.snapshot.dossier_revision, 3);
  assert.equal(result.snapshot.document_versions.length, 1);
  assert.equal(result.snapshot.accepted_assertion_ids.length, 1);
  assert.equal(result.snapshot.source_anchor_ids.length, 1);
  assert.deepEqual(
    result.snapshot.decision_packages[0]?.simulation_receipt_ids,
    harness.simulationReceiptIds,
  );
  const deterministic = result.snapshot.deterministic_receipts as {
    decision_packages: Array<{
      graph_validation_reference: string;
      simulation_receipts: Array<{
        reference: string;
        runtime_state_digest: string;
        parameter_binding_digest: string;
        receipt_digest: string;
      }>;
    }>;
    audit_chain: {
      through_sequence: number;
      head: {
        audit_event_id: string;
        dossier_revision: number;
        event_digest: string;
      };
      events: Array<{
        audit_event_id: string;
        sequence: number;
        event_digest: string;
      }>;
    };
  };
  const sealedReceiptProofs = deterministic.decision_packages[0]?.simulation_receipts ?? [];
  assert.deepEqual(
    sealedReceiptProofs.map(({ reference }) => reference),
    harness.simulationReceiptIds,
  );
  for (const proof of sealedReceiptProofs) {
    assert.match(proof.runtime_state_digest, /^sha256-[a-f0-9]{64}$/u);
    assert.match(proof.parameter_binding_digest, /^sha256-[a-f0-9]{64}$/u);
    assert.match(proof.receipt_digest, /^sha256-[a-f0-9]{64}$/u);
  }
  assert.match(
    deterministic.decision_packages[0]!.graph_validation_reference,
    /^graph_validation_v1_[a-f0-9]{64}$/u,
  );
  assert.equal(deterministic.audit_chain.through_sequence, 10);
  assert.equal(deterministic.audit_chain.events.length, 10);
  assert.equal(
    deterministic.audit_chain.head.audit_event_id,
    deterministic.audit_chain.events.at(-1)!.audit_event_id,
  );
  assert.equal(
    deterministic.audit_chain.head.event_digest,
    deterministic.audit_chain.events.at(-1)!.event_digest,
  );
  const simulationInputs = result.snapshot.simulation_inputs as {
    decision_packages: Array<{
      package_fingerprint: string;
      studio_fingerprint: string;
      graph_digest: string;
      graph_validation_reference: string;
    }>;
  };
  assert.deepEqual(simulationInputs.decision_packages[0], {
    ...simulationInputs.decision_packages[0],
    package_fingerprint: GOVERNED_PACKAGE_FINGERPRINT,
    studio_fingerprint: GOVERNED_STUDIO_FINGERPRINT,
    graph_digest: governedGraphDigest,
  });
  assert.match(
    simulationInputs.decision_packages[0]!.graph_validation_reference,
    /^graph_validation_v1_[a-f0-9]{64}$/u,
  );
  assert.match(result.snapshot.manifest_digest, /^sha256-[a-f0-9]{64}$/u);
  assert.equal(
    result.manifest_download_url,
    `/api/dossiers/${harness.dossierId}/snapshots/${result.snapshot.snapshot_id}/manifest`,
  );
  assert.doesNotMatch(
    JSON.stringify(result),
    /manifest_object_reference|dossier-v1\//u,
  );

  const persisted = await row<{
    sealed: number;
    manifest_digest: string;
    manifest_byte_length: number;
    manifest_object_reference: string;
    document_count: number;
    assertion_count: number;
    anchor_count: number;
    package_count: number;
  }>(`
    SELECT snapshot.sealed, snapshot.manifest_digest,
      snapshot.manifest_byte_length, snapshot.manifest_object_reference,
      (SELECT count(*) FROM dossier_snapshot_document_versions source
        WHERE source.dossier_id = snapshot.dossier_id
          AND source.snapshot_id = snapshot.id) AS document_count,
      (SELECT count(*) FROM dossier_snapshot_assertions assertion
        WHERE assertion.dossier_id = snapshot.dossier_id
          AND assertion.snapshot_id = snapshot.id) AS assertion_count,
      (SELECT count(*) FROM dossier_snapshot_anchors anchor
        WHERE anchor.dossier_id = snapshot.dossier_id
          AND anchor.snapshot_id = snapshot.id) AS anchor_count,
      (SELECT count(*) FROM dossier_snapshot_decision_packages package
        WHERE package.dossier_id = snapshot.dossier_id
          AND package.snapshot_id = snapshot.id) AS package_count
    FROM dossier_snapshots snapshot
    WHERE snapshot.dossier_id = ? AND snapshot.id = ?
  `, harness.dossierId, result.snapshot.snapshot_id);
  assert.ok(persisted);
  assert.equal(persisted.sealed, 1);
  assert.equal(persisted.manifest_digest, result.snapshot.manifest_digest);
  assert.ok(persisted.manifest_byte_length > 0);
  assert.deepEqual(
    [persisted.document_count, persisted.assertion_count, persisted.anchor_count, persisted.package_count],
    [1, 1, 1, 1],
  );
  assert.ok(await bucket.head(persisted.manifest_object_reference));

  const response = await downloadDossierSnapshotManifest({
    context: harness.ownerContext,
    bucket,
    dossierId: harness.dossierId,
    snapshotId: result.snapshot.snapshot_id,
  });
  assert.equal(response.status, 200);
  assert.equal(
    response.headers.get("cache-control"),
    "private, no-store, max-age=0, must-revalidate",
  );
  assert.equal(response.headers.get("x-content-sha256"), result.snapshot.manifest_digest);
  const text = await response.text();
  const manifest = JSON.parse(text) as {
    format: string;
    schema_version: number;
    snapshot: { snapshot_id: string; decision_packages: unknown[] };
  };
  assert.equal(manifest.format, "genesis-juris-dossier-snapshot-manifest");
  assert.equal(manifest.snapshot.snapshot_id, result.snapshot.snapshot_id);
  assert.equal(manifest.snapshot.decision_packages.length, 1);
  assert.match(
    text,
    /"runtime_state_digest":"sha256-[a-f0-9]{64}"/u,
  );
  assert.match(
    text,
    /"parameter_binding_digest":"sha256-[a-f0-9]{64}"/u,
  );
  assert.match(text, /"receipt_digest":"sha256-[a-f0-9]{64}"/u);
  assert.match(text, /"graph_validation_reference":"graph_validation_v1_[a-f0-9]{64}"/u);
  assert.match(text, /"audit_chain":\{"events":\[/u);

  const listed = await listDossierSnapshots(harness.ownerContext, harness.dossierId);
  assert.equal(listed.length, 1);
  assert.equal(listed[0]?.snapshot_id, result.snapshot.snapshot_id);
  assert.equal(
    await row<{ count: number }>(`
      SELECT count(*) AS count FROM dossier_audit_events
      WHERE dossier_id = ? AND event_type = 'snapshot_created'
    `, harness.dossierId).then((item) => item?.count),
    1,
  );
  const storedSnapshots: Array<{
    id: string;
    audience: "internal" | "client";
    redactionProfileId: string;
    manifestDigest: string;
    manifestReference: string;
  }> = [];
  for (const [audience, redactionProfileId] of [
    ["client", "pilot-default"],
    ["internal", "legacy-unversioned"],
  ] as const) {
    const storedSnapshotId = opaque("snapshot");
    storedSnapshots.push({
      id: storedSnapshotId,
      audience,
      redactionProfileId,
      manifestDigest: await digest(
        `stored-unsupported-snapshot:${storedSnapshotId}`,
      ),
      manifestReference:
        `dossier-v1/${harness.dossierId}/${storedSnapshotId}/${"f".repeat(64)}`,
    });
  }
  const snapshotInsertGuards: Array<{ name: string; sql: string }> = [];
  for (const name of [
    "dossier_snapshots_pilot_redaction_insert_guard",
    "dossier_snapshots_insert_canonical_state_guard",
  ] as const) {
    const guard = await row<{ sql: string }>(`
      SELECT sql FROM sqlite_schema
      WHERE type = 'trigger' AND name = ?
    `, name);
    assert.ok(guard?.sql);
    snapshotInsertGuards.push({ name, sql: guard.sql });
  }
  const droppedGuardSql: string[] = [];
  try {
    for (const guard of snapshotInsertGuards) {
      await d1.prepare(`DROP TRIGGER ${guard.name}`).run();
      droppedGuardSql.push(guard.sql);
    }
    for (const stored of storedSnapshots) {
      await d1.prepare(`
        INSERT INTO dossier_snapshots (
          id, dossier_id, dossier_revision, simulation_inputs,
          deterministic_receipts, status, readiness, approver_records, locale,
          audience, classification, redaction_profile_id, contract_version,
          report_model_schema_version, renderer_version, build_version,
          manifest_object_reference, manifest_byte_length, manifest_digest,
          sealed, sealed_at, sealed_by_actor_ref, created_by_actor_ref, created_at
        )
        SELECT ?, dossier_id, dossier_revision, simulation_inputs,
          deterministic_receipts, status, readiness, approver_records, locale,
          ?, classification, ?, contract_version, report_model_schema_version,
          renderer_version, build_version, ?, manifest_byte_length, ?, sealed,
          sealed_at, sealed_by_actor_ref, created_by_actor_ref, created_at
        FROM dossier_snapshots
        WHERE dossier_id = ? AND id = ?
      `).bind(
        stored.id,
        stored.audience,
        stored.redactionProfileId,
        stored.manifestReference,
        stored.manifestDigest,
        harness.dossierId,
        result.snapshot.snapshot_id,
      ).run();
    }
  } finally {
    for (const sql of droppedGuardSql) {
      await d1.prepare(sql).run();
    }
  }
  for (const stored of storedSnapshots) {
    await assert.rejects(
      generateOutput(harness, stored.id, "json_manifest"),
      assertPilotRedactionError,
    );
    await assert.rejects(
      downloadDossierSnapshotManifest({
        context: harness.ownerContext,
        bucket,
        dossierId: harness.dossierId,
        snapshotId: stored.id,
      }),
      assertPilotRedactionError,
    );
  }
  assert.equal(
    await row<{ count: number }>(
      "SELECT count(*) AS count FROM dossier_governed_outputs WHERE dossier_id = ?",
      harness.dossierId,
    ).then((item) => item?.count),
    0,
  );

  const validOutput = await generateOutput(
    harness,
    result.snapshot.snapshot_id,
    "json_manifest",
  );
  const validOutputRecord = await row<{ created_at: string }>(`
    SELECT created_at FROM dossier_governed_outputs
    WHERE dossier_id = ? AND id = ?
  `, harness.dossierId, validOutput.output.output_id);
  const historicalAuditHead = await row<{ id: string; sequence: number }>(`
    SELECT id, sequence FROM dossier_audit_events
    WHERE dossier_id = ? ORDER BY sequence DESC LIMIT 1
  `, harness.dossierId);
  assert.ok(validOutputRecord);
  assert.ok(historicalAuditHead);
  const historicalOutputs: Array<{
    id: string;
    snapshotId: string;
    snapshotDigest: string;
    auditId: string;
    auditDigest: string;
  }> = [];
  for (const stored of storedSnapshots) {
    const id = opaque("output");
    historicalOutputs.push({
      id,
      snapshotId: stored.id,
      snapshotDigest: stored.manifestDigest,
      auditId: opaque("audit"),
      auditDigest: await digest(`historical-output:${id}:audit`),
    });
  }
  const outputInsertGuard = await row<{ sql: string }>(`
    SELECT sql FROM sqlite_schema
    WHERE type = 'trigger'
      AND name = 'dossier_governed_outputs_pilot_redaction_guard'
  `);
  assert.ok(outputInsertGuard?.sql);
  await d1.prepare(
    "DROP TRIGGER dossier_governed_outputs_pilot_redaction_guard",
  ).run();
  try {
    const statements: D1PreparedStatement[] = [];
    let previousEventId = historicalAuditHead.id;
    let sequence = historicalAuditHead.sequence;
    for (const historical of historicalOutputs) {
      statements.push(d1.prepare(`
        INSERT INTO dossier_governed_outputs (
          id, dossier_id, snapshot_id, snapshot_digest, format,
          content_reference, content_sha256, filename,
          generator_schema_version, generator_build_version,
          created_by_actor_ref, created_at
        )
        SELECT ?, dossier_id, ?, ?, format, ?, content_sha256, ?,
          generator_schema_version, generator_build_version,
          created_by_actor_ref, created_at
        FROM dossier_governed_outputs
        WHERE dossier_id = ? AND id = ?
      `).bind(
        historical.id,
        historical.snapshotId,
        historical.snapshotDigest,
        `dossier-v1/${harness.dossierId}/${historical.id}/${"e".repeat(64)}`,
        `historical-${historical.id}.json`,
        harness.dossierId,
        validOutput.output.output_id,
      ));
      sequence += 1;
      statements.push(fixtureAuditStatement({
        id: historical.auditId,
        dossierId: harness.dossierId,
        revision: 3,
        sequence,
        eventType: "output_generated",
        objectRefType: "governed_output",
        objectRefId: historical.id,
        actorUserId: harness.ownerContext.actor.userId,
        actorRef: harness.ownerContext.actor.actorId,
        actorRole: "owner",
        occurredAt: validOutputRecord.created_at,
        summaryCode: "DOSSIER_OUTPUT_GENERATED",
        previousEventId,
        eventDigest: historical.auditDigest,
      }));
      previousEventId = historical.auditId;
    }
    await d1.batch(statements);
  } finally {
    await d1.prepare(outputInsertGuard.sql).run();
  }
  for (const historical of historicalOutputs) {
    await assert.rejects(
      downloadDossierGovernedOutput({
        context: harness.ownerContext,
        bucket,
        dossierId: harness.dossierId,
        outputId: historical.id,
      }),
      assertPilotRedactionError,
    );
    await assert.rejects(
      approveDossierGovernedOutput({
        context: harness.reviewerContext,
        dependencies: harness.reviewerDependencies,
        dossierId: harness.dossierId,
        expectedRevision: 3,
        outputId: historical.id,
        reviewerParticipantId: harness.reviewerParticipantId,
      }),
      assertPilotRedactionError,
    );
  }
  assert.equal(
    await row<{ count: number }>(
      "SELECT count(*) AS count FROM dossier_output_approvals WHERE dossier_id = ?",
      harness.dossierId,
    ).then((item) => item?.count),
    0,
  );
});

test("snapshot sealing fails closed when deterministic simulation receipts are absent", async () => {
  const harness = await seedHarness("snapshot-not-ready", []);
  await assert.rejects(
    createSnapshot(harness),
    (error) => {
      assertGovernedError(error, "snapshot_not_ready");
      return true;
    },
  );
  assert.equal(
    await row<{ count: number }>(
      "SELECT count(*) AS count FROM dossier_snapshots WHERE dossier_id = ?",
      harness.dossierId,
    ).then((item) => item?.count),
    0,
  );
  assert.equal(await objectCount(harness.dossierId), 0);
});

test("snapshot sealing rejects tampered v61 or graph bindings and cross-package receipt replay", async () => {
  const tampered = await seedHarness("simulation-tamper");
  await d1.prepare(`
    UPDATE play_sessions SET case_fingerprint = ?
    WHERE session_key = ?
  `).bind(
    await digest("tampered-package-binding"),
    tampered.simulationReceiptIds[0],
  ).run();
  await assert.rejects(
    createSnapshot(tampered),
    (error) => {
      assertGovernedError(error, "simulation_receipt_unverified");
      return true;
    },
  );
  assert.equal(await objectCount(tampered.dossierId), 0);

  const graphTampered = await seedHarness(
    "graph-tamper",
    null,
    await digest("tampered-graph-binding"),
  );
  await assert.rejects(
    createSnapshot(graphTampered),
    (error) => {
      assertGovernedError(error, "decision_package_graph_unverified");
      return true;
    },
  );
  assert.equal(await objectCount(graphTampered.dossierId), 0);

  const replayed = await seedHarness("simulation-replay");
  const replayedAt = new Date().toISOString();
  const replayedPackageReferenceId = opaque("package_reference");
  const replayedAuditId = opaque("audit");
  const previousAudit = await d1.prepare(`
    SELECT id, sequence FROM dossier_audit_events
    WHERE dossier_id = ? ORDER BY sequence DESC LIMIT 1
  `).bind(replayed.dossierId).first<{ id: string; sequence: number }>();
  assert.ok(previousAudit);
  await d1.batch([
    d1.prepare("UPDATE dossiers SET revision = 4, updated_by_actor_ref = ?, updated_at = ? WHERE id = ? AND revision = 3")
      .bind(replayed.ownerContext.actor.actorId, replayedAt, replayed.dossierId),
    d1.prepare(`INSERT INTO dossier_decision_package_references (
      id, dossier_id, package_id, package_version, package_fingerprint,
      source_dossier_revision, state, graph_validation_status, graph_digest,
      simulation_run_references, approval_state, package_type_registry,
      package_type_id, package_type_version, created_by_actor_ref,
      updated_by_actor_ref, created_at, updated_at
    ) VALUES (?, ?, 'case_package_replayed', '1.0.0', ?, 4, 'current',
      'valid', ?, ?, 'published', 'genesis-juris-case-types', 'general',
      '1.0.0', ?, ?, ?, ?)`)
      .bind(
        replayedPackageReferenceId,
        replayed.dossierId,
        await digest("replayed-package"),
        await digest("replayed-graph"),
        JSON.stringify([replayed.simulationReceiptIds[0]]),
        replayed.ownerContext.actor.actorId,
        replayed.ownerContext.actor.actorId,
        replayedAt,
        replayedAt,
      ),
    fixtureAuditStatement({
      id: replayedAuditId,
      dossierId: replayed.dossierId,
      revision: 4,
      sequence: previousAudit.sequence + 1,
      eventType: "decision_package_linked",
      objectRefType: "decision_package_reference",
      objectRefId: replayedPackageReferenceId,
      actorUserId: replayed.ownerContext.actor.userId,
      actorRef: replayed.ownerContext.actor.actorId,
      actorRole: "owner",
      occurredAt: replayedAt,
      summaryCode: "DECISION_PACKAGE_LINKED",
      previousEventId: previousAudit.id,
      eventDigest: await digest("simulation-replay:replayed-package-audit"),
    }),
    d1.prepare(`INSERT INTO dossier_revision_receipts
      (dossier_id, resulting_revision, created_by_actor_ref, created_at)
      VALUES (?, 4, ?, ?)`)
      .bind(replayed.dossierId, replayed.ownerContext.actor.actorId, replayedAt),
  ]);
  await assert.rejects(
    createSnapshot(replayed, 4),
    (error) => {
      assertGovernedError(error, "simulation_receipt_replay");
      return true;
    },
  );
  assert.equal(await objectCount(replayed.dossierId), 0);
});

test("JSON, Markdown, and PDF outputs are exact-snapshot bound, private, current, and idempotent", async () => {
  const harness = await seedHarness("all-output-formats");
  const snapshot = await createSnapshot(harness);
  const snapshotId = snapshot.snapshot.snapshot_id;
  const json = await generateOutput(harness, snapshotId, "json_manifest");
  const markdown = await generateOutput(harness, snapshotId, "markdown");
  const pdf = await generateOutput(harness, snapshotId, "pdf");

  for (const generated of [json, markdown, pdf]) {
    assert.equal(generated.output.snapshot_id, snapshotId);
    assert.equal(generated.output.snapshot_digest, snapshot.snapshot.manifest_digest);
    assert.equal(generated.output.state, "current");
    assert.equal(generated.unchanged, false);
    assert.match(generated.output.content_sha256, /^sha256-[a-f0-9]{64}$/u);
    assert.match(generated.download_url, /^\/api\/dossiers\//u);
    assert.doesNotMatch(
      JSON.stringify(generated),
      /content_reference|dossier-v1\//u,
    );
  }

  const stateRows = await rows<{
    output_id: string;
    sequence: number;
    state: string;
    reason: string | null;
  }>(`
    SELECT output_id, sequence, state, reason
    FROM dossier_output_state_events
    WHERE dossier_id = ?
    ORDER BY output_id, sequence
  `, harness.dossierId);
  assert.equal(stateRows.length, 3);
  assert.ok(stateRows.every((state) =>
    state.sequence === 1 && state.state === "current" && state.reason === null
  ));

  const listed = await listDossierGovernedOutputs(
    harness.ownerContext,
    harness.dossierId,
  );
  assert.equal(listed.length, 3);
  assert.deepEqual(
    listed.map(({ format }) => format).sort(),
    ["json_manifest", "markdown", "pdf"],
  );
  assert.ok(listed.every((output) => output.state === "current"));
  assert.doesNotMatch(JSON.stringify(listed), /content_reference|dossier-v1\//u);

  const jsonResponse = await downloadDossierGovernedOutput({
    context: harness.ownerContext,
    bucket,
    dossierId: harness.dossierId,
    outputId: json.output.output_id,
  });
  assert.equal(jsonResponse.status, 200);
  assert.equal(jsonResponse.headers.get("content-type"), "application/json; charset=utf-8");
  assert.equal(jsonResponse.headers.get("x-content-sha256"), json.output.content_sha256);
  assert.equal(jsonResponse.headers.get("x-dossier-snapshot-id"), snapshotId);
  const report = JSON.parse(await jsonResponse.text()) as {
    format: string;
    source_manifest_sha256: string;
    snapshot: { snapshot_id: string };
    source_register: unknown[];
    assertion_register: unknown[];
    anchor_register: unknown[];
    decision_package_graphs: Array<{
      package_fingerprint: string;
      studio_fingerprint: string;
      graph_digest: string;
      graph_validation_reference: string;
      draft: {
        title: string;
        nodes: unknown[];
        links: unknown[];
      };
    }>;
    audit_receipts: Array<{
      sequence: number;
      event_type: string;
      event_digest: string;
    }>;
  };
  assert.equal(report.format, "genesis-juris-dossier-governed-output-manifest");
  assert.equal(report.source_manifest_sha256, snapshot.snapshot.manifest_digest);
  assert.equal(report.snapshot.snapshot_id, snapshotId);
  assert.deepEqual(
    [
      report.source_register.length,
      report.assertion_register.length,
      report.anchor_register.length,
    ],
    [1, 1, 1],
  );
  assert.equal(report.audit_receipts.length, 10);
  assert.equal(report.audit_receipts[0]?.sequence, 1);
  assert.equal(report.audit_receipts[0]?.event_type, "dossier_created");
  assert.equal(report.decision_package_graphs.length, 1);
  assert.deepEqual(
    {
      package_fingerprint: report.decision_package_graphs[0]!.package_fingerprint,
      studio_fingerprint: report.decision_package_graphs[0]!.studio_fingerprint,
      graph_digest: report.decision_package_graphs[0]!.graph_digest,
    },
    {
      package_fingerprint: GOVERNED_PACKAGE_FINGERPRINT,
      studio_fingerprint: GOVERNED_STUDIO_FINGERPRINT,
      graph_digest: governedGraphDigest,
    },
  );
  assert.match(
    report.decision_package_graphs[0]!.graph_validation_reference,
    /^graph_validation_v1_[a-f0-9]{64}$/u,
  );
  assert.equal(
    report.decision_package_graphs[0]!.draft.title,
    GOVERNED_PACKAGE_DRAFT.title,
  );
  assert.equal(report.decision_package_graphs[0]!.draft.nodes.length, 8);
  assert.equal(report.decision_package_graphs[0]!.draft.links.length, 9);
  assert.ok(
    await row<{ count: number }>(
      "SELECT count(*) AS count FROM dossier_audit_events WHERE dossier_id = ?",
      harness.dossierId,
    ).then((item) => (item?.count ?? 0) > report.audit_receipts.length),
  );

  const markdownResponse = await downloadDossierGovernedOutput({
    context: harness.ownerContext,
    bucket,
    dossierId: harness.dossierId,
    outputId: markdown.output.output_id,
  });
  const markdownText = await markdownResponse.text();
  assert.equal(markdownResponse.headers.get("content-type"), "text/markdown; charset=utf-8");
  assert.match(markdownText, /^# Matter all-output-formats\n/u);
  assert.match(markdownText, new RegExp(`Snapshot ID: ${snapshotId}`, "u"));
  assert.match(markdownText, /## Audit receipt appendix/u);
  assert.doesNotMatch(markdownText, /snapshot_created|output_generated/u);

  const pdfResponse = await downloadDossierGovernedOutput({
    context: harness.ownerContext,
    bucket,
    dossierId: harness.dossierId,
    outputId: pdf.output.output_id,
  });
  const pdfBytes = new Uint8Array(await pdfResponse.arrayBuffer());
  const pdfText = new TextDecoder("latin1").decode(pdfBytes);
  assert.equal(pdfResponse.headers.get("content-type"), "application/pdf");
  assert.match(pdfText, /^%PDF-1\.[3-7]/u);
  assert.ok(pdfBytes.byteLength > 20_000);
  assert.match(pdfText, /\/Subtype\s*\/Type0/u);
  assert.match(pdfText, /startxref/u);
  assert.match(pdfText, /%%EOF/u);
  const pdfPageCount = pdfText.match(/\/Type\s*\/Page\b/gu)?.length ?? 0;
  assert.ok(
    pdfPageCount >= 8,
    `The snapshot-bound Bhopal dossier PDF rendered only ${pdfPageCount} pages.`,
  );

  const jsonReplay = await generateOutput(harness, snapshotId, "json_manifest");
  assert.equal(jsonReplay.unchanged, true);
  assert.equal(jsonReplay.output.output_id, json.output.output_id);
  assert.equal(jsonReplay.output.content_sha256, json.output.content_sha256);
  const pdfReplay = await generateOutput(harness, snapshotId, "pdf");
  assert.equal(pdfReplay.unchanged, true);
  assert.equal(pdfReplay.output.output_id, pdf.output.output_id);
  assert.equal(pdfReplay.output.content_sha256, pdf.output.content_sha256);
  assert.equal(await objectCount(harness.dossierId), 4);
});

test("a replacement snapshot output stales prior-snapshot formats and approval is exact-output reviewer-only", async () => {
  const harness = await seedHarness("stale-and-approve");
  const firstSnapshot = await createSnapshot(harness);
  const firstJson = await generateOutput(
    harness,
    firstSnapshot.snapshot.snapshot_id,
    "json_manifest",
  );
  const firstPdf = await generateOutput(
    harness,
    firstSnapshot.snapshot.snapshot_id,
    "pdf",
  );
  const replacementSnapshot = await createSnapshot(harness);
  const replacement = await generateOutput(
    harness,
    replacementSnapshot.snapshot.snapshot_id,
    "markdown",
  );

  const outputs = await listDossierGovernedOutputs(
    harness.ownerContext,
    harness.dossierId,
  );
  const byId = new Map(outputs.map((output) => [output.output_id, output]));
  for (const oldId of [firstJson.output.output_id, firstPdf.output.output_id]) {
    assert.equal(byId.get(oldId)?.state, "stale");
    assert.equal(
      byId.get(oldId)?.stale_reason,
      "NEW_SNAPSHOT_OUTPUT_GENERATED",
    );
    assert.ok(byId.get(oldId)?.stale_at);
  }
  assert.equal(byId.get(replacement.output.output_id)?.state, "current");

  const oldStates = await rows<{
    output_id: string;
    sequence: number;
    state: string;
    reason: string | null;
  }>(`
    SELECT output_id, sequence, state, reason
    FROM dossier_output_state_events
    WHERE dossier_id = ? AND output_id IN (?, ?)
    ORDER BY output_id, sequence
  `, harness.dossierId, firstJson.output.output_id, firstPdf.output.output_id);
  assert.equal(oldStates.length, 4);
  for (const outputId of [firstJson.output.output_id, firstPdf.output.output_id]) {
    assert.deepEqual(
      oldStates.filter((state) => state.output_id === outputId)
        .map(({ sequence, state, reason }) => ({ sequence, state, reason })),
      [
        { sequence: 1, state: "current", reason: null },
        {
          sequence: 2,
          state: "stale",
          reason: "NEW_SNAPSHOT_OUTPUT_GENERATED",
        },
      ],
    );
  }

  await assert.rejects(
    approveDossierGovernedOutput({
      context: harness.reviewerContext,
      dependencies: harness.reviewerDependencies,
      dossierId: harness.dossierId,
      expectedRevision: 3,
      outputId: firstJson.output.output_id,
      reviewerParticipantId: harness.reviewerParticipantId,
    }),
    (error) => {
      assertGovernedError(error, "output_not_current");
      return true;
    },
  );

  await assert.rejects(
    approveDossierGovernedOutput({
      context: harness.ownerContext,
      dependencies: harness.ownerDependencies,
      dossierId: harness.dossierId,
      expectedRevision: 3,
      outputId: replacement.output.output_id,
      reviewerParticipantId: harness.ownerParticipantId,
    }),
    (error) => {
      assertGovernedError(error, "approval_role_forbidden");
      return true;
    },
  );

  const approved = await approveDossierGovernedOutput({
    context: harness.reviewerContext,
    dependencies: harness.reviewerDependencies,
    dossierId: harness.dossierId,
    expectedRevision: 3,
    outputId: replacement.output.output_id,
    reviewerParticipantId: harness.reviewerParticipantId,
  });
  assert.equal(approved.unchanged, false);
  assert.equal(approved.status_transition_required, true);
  assert.equal(approved.approval.output_id, replacement.output.output_id);
  assert.equal(
    approved.approval.reviewer_participant_id,
    harness.reviewerParticipantId,
  );
  assert.match(approved.approval.approval_digest, /^sha256-[a-f0-9]{64}$/u);
  assert.equal(approved.output.state, "current");
  assert.equal(
    approved.output.reviewer_actor_id,
    harness.reviewerContext.actor.actorId,
  );

  const replay = await approveDossierGovernedOutput({
    context: harness.reviewerContext,
    dependencies: harness.reviewerDependencies,
    dossierId: harness.dossierId,
    expectedRevision: 3,
    outputId: replacement.output.output_id,
    reviewerParticipantId: harness.reviewerParticipantId,
  });
  assert.equal(replay.unchanged, true);
  assert.equal(replay.approval.approval_id, approved.approval.approval_id);

  const approvalBoundSnapshot = await createSnapshot(harness);
  assert.deepEqual(approvalBoundSnapshot.snapshot.approver_records, [{
    reviewer_actor_id: harness.reviewerContext.actor.actorId,
    approved_at: approved.approval.approved_at,
    output_id: replacement.output.output_id,
  }]);
  assert.deepEqual(approvalBoundSnapshot.snapshot.generator, {
    contract_version: "1.0.0",
    report_model_schema_version: 1,
    renderer_version: "1.0.0",
    build_version: "v62-dossier-workspace",
  });
  const approvalBoundPdf = await generateOutput(
    harness,
    approvalBoundSnapshot.snapshot.snapshot_id,
    "pdf",
  );
  const approvalBoundJson = await generateOutput(
    harness,
    approvalBoundSnapshot.snapshot.snapshot_id,
    "json_manifest",
  );
  const approvalBoundJsonResponse = await downloadDossierGovernedOutput({
    context: harness.ownerContext,
    bucket,
    dossierId: harness.dossierId,
    outputId: approvalBoundJson.output.output_id,
  });
  const approvalBoundModel = JSON.parse(await approvalBoundJsonResponse.text()) as Parameters<
    typeof buildDossierGovernancePdfContent
  >[0];
  const visibleValues: string[] = [];
  const collectVisibleValues = (value: unknown): void => {
    if (typeof value === "string") {
      visibleValues.push(value);
      return;
    }
    if (!value || typeof value !== "object") return;
    if (Array.isArray(value)) {
      for (const item of value) collectVisibleValues(item);
      return;
    }
    for (const item of Object.values(value as Record<string, unknown>)) {
      collectVisibleValues(item);
    }
  };
  collectVisibleValues(buildDossierGovernancePdfContent(approvalBoundModel));
  const visibleAppendixText = visibleValues.join("\n");
  assert.match(visibleAppendixText, /Snapshot contract/u);
  assert.match(visibleAppendixText, /Snapshot report-model schema/u);
  assert.match(visibleAppendixText, /Snapshot renderer \/ build/u);
  assert.match(visibleAppendixText, /v62-dossier-workspace/u);
  assert.match(visibleAppendixText, /Sealed simulation and parameter inputs/u);
  assert.ok(visibleAppendixText.includes("parameter_binding_digest"));
  assert.ok(visibleAppendixText.includes(harness.packageFingerprint));
  assert.match(visibleAppendixText, /Approver records at snapshot/u);
  assert.ok(visibleAppendixText.includes(harness.reviewerContext.actor.actorId));
  assert.ok(visibleAppendixText.includes(replacement.output.output_id));
  const approvalBoundPdfResponse = await downloadDossierGovernedOutput({
    context: harness.ownerContext,
    bucket,
    dossierId: harness.dossierId,
    outputId: approvalBoundPdf.output.output_id,
  });
  const approvalBoundPdfBytes = new Uint8Array(await approvalBoundPdfResponse.arrayBuffer());
  const approvalBoundPdfText = new TextDecoder("latin1").decode(approvalBoundPdfBytes);
  assert.match(approvalBoundPdfText, /^%PDF-1\.[3-7]/u);
  assert.match(approvalBoundPdfText, /\/Subtype\s*\/Type0/u);
  assert.ok((approvalBoundPdfText.match(/\/Type\s*\/Page\b/gu)?.length ?? 0) >= 8);

  assert.deepEqual(await row<{
    revision: number;
    status: string;
    approval_count: number;
    approval_audit_count: number;
  }>(`
    SELECT dossier.revision, dossier.status,
      (SELECT count(*) FROM dossier_output_approvals approval
        WHERE approval.dossier_id = dossier.id
          AND approval.output_id = ?) AS approval_count,
      (SELECT count(*) FROM dossier_audit_events audit
        WHERE audit.dossier_id = dossier.id
          AND audit.event_type = 'output_approved'
          AND audit.object_ref_id = ?) AS approval_audit_count
    FROM dossiers dossier
    WHERE dossier.id = ?
  `, replacement.output.output_id, replacement.output.output_id, harness.dossierId), {
    revision: 3,
    status: "draft",
    approval_count: 1,
    approval_audit_count: 1,
  });
});

test("R2 objects are deleted when snapshot or output D1 batches fail", async () => {
  const snapshotHarness = await seedHarness("snapshot-d1-failure");
  const invalidSnapshotAudit: DossierGovernedDependencies = {
    prepareAuditEvents: async (dossierId, revision, inputs) => {
      const events = await snapshotHarness.ownerDependencies.prepareAuditEvents(
        dossierId,
        revision,
        inputs,
      );
      return events.map((event, index) =>
        index === 0 ? { ...event, eventDigest: "invalid-digest" } : event
      );
    },
  };
  await assert.rejects(
    createDossierSnapshot({
      context: snapshotHarness.ownerContext,
      dependencies: invalidSnapshotAudit,
      bucket,
      dossierId: snapshotHarness.dossierId,
      expectedRevision: 3,
      locale: "en",
      audience: "internal",
      redactionProfileId: "pilot-default",
    }),
    (error) => {
      assertGovernedError(error, "snapshot_conflict");
      return true;
    },
  );
  assert.equal(await objectCount(snapshotHarness.dossierId), 0);
  assert.equal(
    await row<{ count: number }>(
      "SELECT count(*) AS count FROM dossier_snapshots WHERE dossier_id = ?",
      snapshotHarness.dossierId,
    ).then((item) => item?.count),
    0,
  );

  const outputHarness = await seedHarness("output-d1-failure");
  const snapshot = await createSnapshot(outputHarness);
  const objectCountBefore = await objectCount(outputHarness.dossierId);
  const invalidOutputAudit: DossierGovernedDependencies = {
    prepareAuditEvents: async (dossierId, revision, inputs) => {
      const events = await outputHarness.ownerDependencies.prepareAuditEvents(
        dossierId,
        revision,
        inputs,
      );
      return events.map((event, index) =>
        index === 0 ? { ...event, eventDigest: "invalid-digest" } : event
      );
    },
  };
  await assert.rejects(
    generateOutput(
      outputHarness,
      snapshot.snapshot.snapshot_id,
      "json_manifest",
      invalidOutputAudit,
    ),
    (error) => {
      assertGovernedError(error, "output_conflict");
      return true;
    },
  );
  assert.equal(await objectCount(outputHarness.dossierId), objectCountBefore);
  assert.equal(
    await row<{ count: number }>(
      "SELECT count(*) AS count FROM dossier_governed_outputs WHERE dossier_id = ?",
      outputHarness.dossierId,
    ).then((item) => item?.count),
    0,
  );
});

test("protected downloads fail closed on R2 checksum or metadata tampering", async () => {
  const snapshotHarness = await seedHarness("snapshot-integrity");
  const snapshot = await createSnapshot(snapshotHarness);
  const manifest = await row<{
    manifest_object_reference: string;
    manifest_digest: string;
  }>(`
    SELECT manifest_object_reference, manifest_digest
    FROM dossier_snapshots
    WHERE dossier_id = ? AND id = ?
  `, snapshotHarness.dossierId, snapshot.snapshot.snapshot_id);
  assert.ok(manifest);
  await bucket.put(manifest.manifest_object_reference, "tampered", {
    httpMetadata: { contentType: "application/json; charset=utf-8" },
    customMetadata: { contentSha256: manifest.manifest_digest },
  });
  await assert.rejects(
    downloadDossierSnapshotManifest({
      context: snapshotHarness.ownerContext,
      bucket,
      dossierId: snapshotHarness.dossierId,
      snapshotId: snapshot.snapshot.snapshot_id,
    }),
    (error) => {
      assertGovernedError(error, "private_object_integrity");
      return true;
    },
  );

  const outputHarness = await seedHarness("output-integrity");
  const outputSnapshot = await createSnapshot(outputHarness);
  const output = await generateOutput(
    outputHarness,
    outputSnapshot.snapshot.snapshot_id,
    "json_manifest",
  );
  const persisted = await row<{
    content_reference: string;
    content_sha256: string;
  }>(`
    SELECT content_reference, content_sha256
    FROM dossier_governed_outputs
    WHERE dossier_id = ? AND id = ?
  `, outputHarness.dossierId, output.output.output_id);
  assert.ok(persisted);
  const exactObject = await bucket.get(persisted.content_reference);
  assert.ok(exactObject);
  const exactBytes = await exactObject.arrayBuffer();
  await bucket.put(persisted.content_reference, exactBytes, {
    httpMetadata: { contentType: "application/json; charset=utf-8" },
    customMetadata: {
      contentSha256: persisted.content_sha256,
      kind: "tampered_output_kind",
    },
  });
  await assert.rejects(
    downloadDossierGovernedOutput({
      context: outputHarness.ownerContext,
      bucket,
      dossierId: outputHarness.dossierId,
      outputId: output.output.output_id,
    }),
    (error) => {
      assertGovernedError(error, "private_object_integrity");
      return true;
    },
  );
});

async function row<T>(sql: string, ...values: unknown[]) {
  return d1.prepare(sql).bind(...values).first<T>();
}

async function rows<T>(sql: string, ...values: unknown[]) {
  return (await d1.prepare(sql).bind(...values).all<T>()).results;
}

async function objectCount(dossierId: string) {
  const listed = await bucket.list({ prefix: `dossier-v1/${dossierId}/` });
  return listed.objects.length;
}

function assertGovernedError(
  error: unknown,
  code: string,
): asserts error is DossierGovernedError {
  assert.ok(error instanceof Error);
  assert.equal((error as { code?: string }).code, code);
}

async function seedHarness(
  label: string,
  simulationReceipts: string[] | null = null,
  graphDigestOverride: string | null = null,
): Promise<Harness> {
  const normalized = label.replaceAll(/[^a-z0-9]/gu, "-").slice(0, 24);
  const ownerEmail = `${normalized}-owner-${serial + 1}@example.test`;
  const reviewerEmail = `${normalized}-reviewer-${serial + 1}@example.test`;
  await d1.batch([
    d1.prepare("INSERT INTO users (email, display_name) VALUES (?, ?)").bind(ownerEmail, `Owner ${label}`),
    d1.prepare("INSERT INTO users (email, display_name) VALUES (?, ?)").bind(reviewerEmail, `Reviewer ${label}`),
  ]);
  const owner = await d1.prepare("SELECT id, actor_id, display_name FROM users WHERE email = ?")
    .bind(ownerEmail).first<{ id: number; actor_id: string; display_name: string }>();
  const reviewer = await d1.prepare("SELECT id, actor_id, display_name FROM users WHERE email = ?")
    .bind(reviewerEmail).first<{ id: number; actor_id: string; display_name: string }>();
  assert.ok(owner);
  assert.ok(reviewer);
  const dossierId = opaque("dossier");
  const reviewerParticipantId = opaque("participant");
  const documentId = opaque("document");
  const versionId = opaque("version");
  const anchorId = opaque("anchor");
  const assertionId = opaque("assertion");
  const packageReferenceId = opaque("package_reference");
  const createdAt = "2026-08-31T10:00:00.000Z";
  const contentSha256 = await digest(`${label}:document`);
  const anchorSha256 = await digest(`${label}:anchor`);
  const graphSha256 = graphDigestOverride ?? governedGraphDigest;
  const packageSha256 = GOVERNED_PACKAGE_FINGERPRINT;
  const resolvedSimulationReceipts = (
    simulationReceipts
    ?? [simulationSessionKey(), simulationSessionKey()]
  ).sort();
  const binaryReference = `dossier-v1/${dossierId}/${versionId}/${"a".repeat(64)}`;
  const initialAuditId = opaque("audit");
  const initialAuditDigest = await digest(`${label}:audit:1`);
  const participantAuditId = opaque("audit");
  const participantAuditDigest = await digest(`${label}:audit:2`);

  await d1.batch([
    d1.prepare(`INSERT INTO dossiers (
      id, reference, title, dossier_type_registry, dossier_type_id,
      dossier_type_version, owner_user_id, owner_actor_id, jurisdictions,
      classification, status, key_deadline_at, key_deadline_timezone,
      created_by_actor_ref, updated_by_actor_ref, created_at, updated_at
    ) VALUES (?, ?, ?, 'genesis-juris-dossier-types', 'general-matter',
      '1.0.0', ?, ?, '["Test"]', 'confidential', 'draft',
      '2026-12-01T10:00:00.000Z', 'UTC', ?, ?, ?, ?)
  `).bind(
    dossierId,
    `REF-${normalized}-${serial}`,
    `Matter ${label}`,
    owner.id,
    owner.actor_id,
    owner.actor_id,
    owner.actor_id,
    createdAt,
    createdAt,
    ),
    d1.prepare(`INSERT INTO dossier_participants (
      id, dossier_id, user_id, actor_id, display_name, role, status,
      created_by_actor_ref, updated_by_actor_ref, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, 'reviewer', 'active', ?, ?, ?, ?)`)
      .bind(reviewerParticipantId, dossierId, reviewer.id, reviewer.actor_id, reviewer.display_name, owner.actor_id, owner.actor_id, createdAt, createdAt),
    d1.prepare(`INSERT INTO dossier_audit_events (
      id, dossier_id, dossier_revision, sequence, event_type, object_ref_type,
      object_ref_id, actor_user_id, actor_ref, actor_role, occurred_at,
      summary_code, detail, previous_event_id, event_digest
    ) VALUES (?, ?, 1, 1, 'dossier_created', 'dossier', ?, ?, ?, 'owner', ?,
      'DOSSIER_CREATED', '{}', NULL, ?)`)
      .bind(
        initialAuditId,
        dossierId,
        dossierId,
        owner.id,
        owner.actor_id,
        createdAt,
        initialAuditDigest,
      ),
    d1.prepare(`INSERT INTO dossier_audit_events (
      id, dossier_id, dossier_revision, sequence, event_type, object_ref_type,
      object_ref_id, actor_user_id, actor_ref, actor_role, occurred_at,
      summary_code, detail, previous_event_id, event_digest
    ) VALUES (?, ?, 1, 2, 'participant_changed', 'participant', ?, ?, ?, 'owner', ?,
      'PARTICIPANT_CHANGED', '{}', ?, ?)`)
      .bind(
        participantAuditId,
        dossierId,
        reviewerParticipantId,
        owner.id,
        owner.actor_id,
        createdAt,
        initialAuditId,
        participantAuditDigest,
      ),
    d1.prepare(`INSERT INTO dossier_revision_receipts
      (dossier_id, resulting_revision, created_by_actor_ref, created_at)
      VALUES (?, 1, ?, ?)`)
      .bind(dossierId, owner.actor_id, createdAt),
  ]);
  const automaticOwner = await d1.prepare(`
    SELECT id FROM dossier_participants
    WHERE dossier_id = ? AND user_id = ? AND actor_id = ?
      AND role = 'owner' AND status = 'active'
  `).bind(dossierId, owner.id, owner.actor_id).first<{ id: string }>();
  assert.ok(automaticOwner);
  const ownerParticipantId = automaticOwner.id;

  await d1.prepare(`INSERT INTO dossier_documents (
    id, dossier_id, title, document_type, source_origin, is_provisional,
    classification, status, tags, created_by_actor_ref, updated_by_actor_ref,
    created_at, updated_at
  ) VALUES (?, ?, 'Primary evidence', 'evidence', 'import', true,
    'confidential', 'received', '[]', ?, ?, ?, ?)`)
    .bind(documentId, dossierId, reviewer.actor_id, reviewer.actor_id, createdAt, createdAt).run();
  const documentAuditId = opaque("audit");
  const versionAuditId = opaque("audit");
  const anchorCreatedAuditId = opaque("audit");
  const anchorReviewedAuditId = opaque("audit");
  const assertionCreatedAuditId = opaque("audit");
  const assertionReviewedAuditId = opaque("audit");
  const [
    documentAuditDigest,
    versionAuditDigest,
    anchorCreatedAuditDigest,
    anchorReviewedAuditDigest,
    assertionCreatedAuditDigest,
    assertionReviewedAuditDigest,
  ] = await Promise.all([
    digest(`${label}:audit:3`),
    digest(`${label}:audit:4`),
    digest(`${label}:audit:5`),
    digest(`${label}:audit:6`),
    digest(`${label}:audit:7`),
    digest(`${label}:audit:8`),
  ]);
  await d1.batch([
    d1.prepare("UPDATE dossiers SET revision = 2, updated_by_actor_ref = ?, updated_at = ? WHERE id = ? AND revision = 1")
      .bind(reviewer.actor_id, createdAt, dossierId),
    d1.prepare(`INSERT INTO dossier_document_versions (
    id, dossier_id, document_id, ordinal, binary_object_reference,
    original_filename, media_type, byte_length, content_sha256,
    uploader_user_id, uploader_actor_ref, uploaded_at, created_by_actor_ref,
    created_at
  ) VALUES (?, ?, ?, 1, ?, 'evidence.txt', 'text/plain', 12, ?, ?, ?, ?, ?, ?)`)
      .bind(versionId, dossierId, documentId, binaryReference, contentSha256, reviewer.id, reviewer.actor_id, createdAt, reviewer.actor_id, createdAt),
    d1.prepare(`INSERT INTO dossier_source_anchors (
    id, dossier_id, document_id, document_version_id, page_number, paragraph,
    anchor_checksum, creator, review_state, reviewer_user_id,
    reviewer_actor_ref, reviewed_at, created_by_actor_ref, created_at
  ) VALUES (?, ?, ?, ?, 1, '1', ?, 'human', 'pending', NULL, NULL, NULL, ?, ?)`)
      .bind(anchorId, dossierId, documentId, versionId, anchorSha256, reviewer.actor_id, createdAt),
    d1.prepare(`
    UPDATE dossier_source_anchors
    SET review_state = 'accepted', reviewer_user_id = ?,
      reviewer_actor_ref = ?, reviewed_at = ?
    WHERE dossier_id = ? AND id = ? AND review_state = 'pending'
    `).bind(
    reviewer.id,
    reviewer.actor_id,
    createdAt,
    dossierId,
    anchorId,
    ),
    d1.prepare(`INSERT INTO dossier_professional_assertions (
    id, dossier_id, assertion_type, statement, status, reviewed_by_user_id,
    reviewed_by_actor_ref, reviewed_at, created_by_actor_ref,
    updated_by_actor_ref, created_at, updated_at
  ) VALUES (?, ?, 'fact', 'The exact accepted fact.', 'needs_review',
    NULL, NULL, NULL, ?, ?, ?, ?)`)
      .bind(assertionId, dossierId, reviewer.actor_id, reviewer.actor_id, createdAt, createdAt),
    d1.prepare(`INSERT INTO dossier_assertion_sources
    (dossier_id, assertion_id, source_anchor_id, created_at) VALUES (?, ?, ?, ?)`)
      .bind(dossierId, assertionId, anchorId, createdAt),
    d1.prepare(`
    UPDATE dossier_professional_assertions
    SET status = 'accepted', reviewed_by_user_id = ?,
      reviewed_by_actor_ref = ?, reviewed_at = ?,
      updated_by_actor_ref = ?, updated_at = ?
    WHERE dossier_id = ? AND id = ? AND status = 'needs_review'
    `).bind(
    reviewer.id,
    reviewer.actor_id,
    createdAt,
    reviewer.actor_id,
    createdAt,
    dossierId,
    assertionId,
    ),
    fixtureAuditStatement({
      id: documentAuditId, dossierId, revision: 2, sequence: 3,
      eventType: "document_created", objectRefType: "document", objectRefId: documentId,
      actorUserId: reviewer.id, actorRef: reviewer.actor_id, actorRole: "reviewer", occurredAt: createdAt,
      summaryCode: "DOCUMENT_CREATED", previousEventId: participantAuditId, eventDigest: documentAuditDigest,
    }),
    fixtureAuditStatement({
      id: versionAuditId, dossierId, revision: 2, sequence: 4,
      eventType: "document_version_created", objectRefType: "document_version", objectRefId: versionId,
      actorUserId: reviewer.id, actorRef: reviewer.actor_id, actorRole: "reviewer", occurredAt: createdAt,
      summaryCode: "DOCUMENT_VERSION_CREATED", previousEventId: documentAuditId, eventDigest: versionAuditDigest,
    }),
    fixtureAuditStatement({
      id: anchorCreatedAuditId, dossierId, revision: 2, sequence: 5,
      eventType: "source_anchor_reviewed", objectRefType: "source_anchor", objectRefId: anchorId,
      actorUserId: reviewer.id, actorRef: reviewer.actor_id, actorRole: "reviewer", occurredAt: createdAt,
      summaryCode: "SOURCE_ANCHOR_CREATED", previousEventId: versionAuditId, eventDigest: anchorCreatedAuditDigest,
    }),
    fixtureAuditStatement({
      id: anchorReviewedAuditId, dossierId, revision: 2, sequence: 6,
      eventType: "source_anchor_reviewed", objectRefType: "source_anchor", objectRefId: anchorId,
      actorUserId: reviewer.id, actorRef: reviewer.actor_id, actorRole: "reviewer", occurredAt: createdAt,
      summaryCode: "SOURCE_ANCHOR_ACCEPTED", previousEventId: anchorCreatedAuditId, eventDigest: anchorReviewedAuditDigest,
    }),
    fixtureAuditStatement({
      id: assertionCreatedAuditId, dossierId, revision: 2, sequence: 7,
      eventType: "assertion_reviewed", objectRefType: "professional_assertion", objectRefId: assertionId,
      actorUserId: reviewer.id, actorRef: reviewer.actor_id, actorRole: "reviewer", occurredAt: createdAt,
      summaryCode: "ASSERTION_CREATED", previousEventId: anchorReviewedAuditId, eventDigest: assertionCreatedAuditDigest,
    }),
    fixtureAuditStatement({
      id: assertionReviewedAuditId, dossierId, revision: 2, sequence: 8,
      eventType: "assertion_reviewed", objectRefType: "professional_assertion", objectRefId: assertionId,
      actorUserId: reviewer.id, actorRef: reviewer.actor_id, actorRole: "reviewer", occurredAt: createdAt,
      summaryCode: "ASSERTION_ACCEPTED", previousEventId: assertionCreatedAuditId, eventDigest: assertionReviewedAuditDigest,
    }),
    d1.prepare(`INSERT INTO dossier_revision_receipts
      (dossier_id, resulting_revision, created_by_actor_ref, created_at)
      VALUES (?, 2, ?, ?)`)
      .bind(dossierId, reviewer.actor_id, createdAt),
  ]);
  for (const [index, sessionKey] of resolvedSimulationReceipts.entries()) {
    await d1.prepare(`INSERT INTO play_sessions (
      session_key, user_email, case_id, case_version, case_fingerprint,
      state, status, revision, started_at, completed_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, 'completed', 2, ?, ?, ?)`)
      .bind(
        sessionKey,
        ownerEmail,
        GOVERNED_PACKAGE_DRAFT.caseId,
        GOVERNED_PACKAGE_DRAFT.version,
        packageSha256,
        JSON.stringify({
          outcome: index % 2 === 0 ? "strong" : "mixed",
          decisions: [{ sequence: 1, optionId: `option-${index + 1}` }],
        }),
        createdAt,
        "2026-08-31T10:03:00.000Z",
        "2026-08-31T10:03:00.000Z",
      ).run();
    const session = await d1.prepare(
      "SELECT id FROM play_sessions WHERE session_key = ?",
    ).bind(sessionKey).first<{ id: number }>();
    assert.ok(session);
    await d1.batch([
      d1.prepare(`INSERT INTO play_events (
        play_session_id, event_id, sequence, event_type, payload, occurred_at
      ) VALUES (?, ?, 0, 'session_started', '{}', ?)`)
        .bind(session.id, `${sessionKey}:0`, createdAt),
      d1.prepare(`INSERT INTO play_events (
        play_session_id, event_id, sequence, event_type, payload, occurred_at
      ) VALUES (?, ?, 1, 'decision_recorded', '{}', '2026-08-31T10:02:00.000Z')`)
        .bind(session.id, `${sessionKey}:1`),
      d1.prepare(`INSERT INTO play_events (
        play_session_id, event_id, sequence, event_type, payload, occurred_at
      ) VALUES (?, ?, 2, 'session_completed', '{}', '2026-08-31T10:03:00.000Z')`)
        .bind(session.id, `${sessionKey}:2`),
    ]);
  }
  const packageLinkedAt = new Date().toISOString();
  const documentReviewAuditId = opaque("audit");
  const packageAuditId = opaque("audit");
  const [documentReviewAuditDigest, packageAuditDigest] = await Promise.all([
    digest(`${label}:audit:9`),
    digest(`${label}:audit:10`),
  ]);
  await d1.batch([
    d1.prepare("UPDATE dossiers SET revision = 3, updated_by_actor_ref = ?, updated_at = ? WHERE id = ? AND revision = 2")
      .bind(reviewer.actor_id, packageLinkedAt, dossierId),
    d1.prepare(`
      UPDATE dossier_documents
      SET status = 'accepted_source', updated_by_actor_ref = ?, updated_at = ?
      WHERE dossier_id = ? AND id = ? AND status = 'received'
        AND is_provisional = false
    `).bind(reviewer.actor_id, packageLinkedAt, dossierId, documentId),
    d1.prepare(`INSERT INTO dossier_decision_package_references (
    id, dossier_id, package_id, package_version, package_fingerprint,
    source_dossier_revision, state, graph_validation_status, graph_digest,
    simulation_run_references, approval_state, package_type_registry,
    package_type_id, package_type_version, created_by_actor_ref,
    updated_by_actor_ref, created_at, updated_at
  ) VALUES (?, ?, ?, ?, ?, 3, 'current', 'valid', ?, ?,
    'published', 'genesis-juris-case-types', 'general', '1.0.0', ?, ?, ?, ?)`)
      .bind(
      packageReferenceId,
      dossierId,
      GOVERNED_PACKAGE_DRAFT.caseId,
      GOVERNED_PACKAGE_DRAFT.version,
      packageSha256,
      graphSha256,
      JSON.stringify(resolvedSimulationReceipts),
      reviewer.actor_id,
      reviewer.actor_id,
        packageLinkedAt,
        packageLinkedAt,
      ),
    fixtureAuditStatement({
      id: documentReviewAuditId, dossierId, revision: 3, sequence: 9,
      eventType: "dossier_updated", objectRefType: "document",
      objectRefId: documentId, actorUserId: reviewer.id, actorRef: reviewer.actor_id,
      actorRole: "reviewer", occurredAt: packageLinkedAt,
      summaryCode: "DOCUMENT_ACCEPTED_SOURCE",
      previousEventId: assertionReviewedAuditId, eventDigest: documentReviewAuditDigest,
    }),
    fixtureAuditStatement({
      id: packageAuditId, dossierId, revision: 3, sequence: 10,
      eventType: "decision_package_linked", objectRefType: "decision_package_reference",
      objectRefId: packageReferenceId, actorUserId: reviewer.id, actorRef: reviewer.actor_id,
      actorRole: "reviewer", occurredAt: packageLinkedAt, summaryCode: "DECISION_PACKAGE_LINKED",
      previousEventId: documentReviewAuditId, eventDigest: packageAuditDigest,
    }),
    d1.prepare(`INSERT INTO dossier_revision_receipts
      (dossier_id, resulting_revision, created_by_actor_ref, created_at)
      VALUES (?, 3, ?, ?)`)
      .bind(dossierId, reviewer.actor_id, packageLinkedAt),
  ]);

  const ownerContext: DossierGovernedContext = {
    db: drizzle(d1, { schema }),
    actor: { userId: owner.id, actorId: owner.actor_id, displayName: owner.display_name, email: ownerEmail, platformAdmin: false },
  };
  const reviewerContext: DossierGovernedContext = {
    db: drizzle(d1, { schema }),
    actor: { userId: reviewer.id, actorId: reviewer.actor_id, displayName: reviewer.display_name, email: reviewerEmail, platformAdmin: false },
  };
  return {
    dossierId,
    ownerContext,
    reviewerContext,
    ownerParticipantId,
    reviewerParticipantId,
    assertionId,
    packageReferenceId,
    packageFingerprint: packageSha256,
    simulationReceiptIds: resolvedSimulationReceipts,
    ownerDependencies: auditDependencies(ownerContext),
    reviewerDependencies: auditDependencies(reviewerContext),
  };
}
