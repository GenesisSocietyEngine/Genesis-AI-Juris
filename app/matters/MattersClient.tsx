"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent } from "react";
import { PRODUCT_RELEASE } from "../runtime-constants";
import { scopedOrganizationHeaders, organizationScopedUrl } from "../organization-client";
import styles from "./matters.module.css";
import {
  MATTER_DESTINATIONS,
  apiIssueFor,
  availableTransitions,
  destinationForDeepLink,
  formatBytes,
  formatMatterDate,
  isOverdue,
  mutationPayload,
  nextAttention,
  nextPageCursor,
  normalizeActivity,
  normalizeDocuments,
  normalizeMatterDetail,
  normalizeMatterList,
  normalizeOutputs,
  normalizePackages,
  normalizeProposals,
  normalizeRequests,
  normalizeSnapshots,
  proposalGenerationIdempotencyKey,
  readinessSummary,
  sentenceLabel,
  statusLabel,
  transitionConsequences,
  validatePilotFile,
  type ActivityItem,
  type ApiIssue,
  type AssertionItem,
  type DeadlineItem,
  type DecisionPackageItem,
  type DocumentItem,
  type MatterDestination,
  type MatterDetail,
  type MatterStatus,
  type MatterSummary,
  type MatterView,
  type OutputItem,
  type ProposalItem,
  type RequestItem,
  type SnapshotItem,
  type SourceAnchorItem,
  type TransitionOption,
} from "./matter-view-model";

type ResourceKey = "documents" | "requests" | "proposals" | "packages" | "snapshots" | "outputs" | "activity";
type LoadPhase = "loading" | "ready" | "empty" | "error" | "permission";

interface WorkspaceBundle {
  matter: MatterDetail;
  documents: DocumentItem[];
  requests: RequestItem[];
  deadlines: DeadlineItem[];
  proposals: ProposalItem[];
  packages: DecisionPackageItem[];
  snapshots: SnapshotItem[];
  outputs: OutputItem[];
  activity: ActivityItem[];
  activityCursor: string | null;
  proposalCursor: string | null;
  issues: Partial<Record<ResourceKey, ApiIssue>>;
}

interface SettledApi {
  payload: unknown | null;
  issue: ApiIssue | null;
}

class WorkspaceApiError extends Error {
  constructor(readonly status: number, readonly payload: unknown) {
    super("Matter workspace request failed.");
  }
}

const MAX_ACTIVITY_ITEMS = 500;
const MAX_PROPOSAL_ITEMS = 500;
const PENDING_CASE_PROMPT_KEY = "genesis-juris-pending-case-prompt-v1";
const STATUS_FILTERS: Array<MatterStatus | "all"> = [
  "all", "draft", "intake_review", "active", "awaiting_input", "internal_review",
  "output_approved", "closed", "archived", "declined", "cancelled",
];

async function apiRequest(path: string, init: RequestInit = {}): Promise<unknown> {
  const response = await fetch(path, {
    ...init,
    credentials: "same-origin",
    cache: "no-store",
    headers: {
      accept: "application/json",
      ...scopedOrganizationHeaders(),
      ...init.headers,
    },
  });
  let payload: unknown = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }
  if (!response.ok) throw new WorkspaceApiError(response.status, payload);
  return payload;
}

async function settledRequest(path: string, signal?: AbortSignal): Promise<SettledApi> {
  try {
    return { payload: await apiRequest(path, { signal }), issue: null };
  } catch (caught) {
    if (caught instanceof DOMException && caught.name === "AbortError") throw caught;
    if (caught instanceof WorkspaceApiError) return { payload: null, issue: apiIssueFor(caught.status, caught.payload) };
    return { payload: null, issue: apiIssueFor(500, { message: "The service could not be reached." }) };
  }
}

export default function MattersClient() {
  const router = useRouter();
  const [catalogue, setCatalogue] = useState<MatterSummary[]>([]);
  const [catalogueCursor, setCatalogueCursor] = useState<string | null>(null);
  const [cataloguePhase, setCataloguePhase] = useState<LoadPhase>("loading");
  const [catalogueIssue, setCatalogueIssue] = useState<ApiIssue | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [workspace, setWorkspace] = useState<WorkspaceBundle | null>(null);
  const [workspacePhase, setWorkspacePhase] = useState<LoadPhase>("loading");
  const [workspaceIssue, setWorkspaceIssue] = useState<ApiIssue | null>(null);
  const [destination, setDestination] = useState<MatterDestination>("overview");
  const [view, setView] = useState<MatterView>("user");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<MatterStatus | "all">("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [ownershipFilter, setOwnershipFilter] = useState<"all" | "owned" | "shared">("all");
  const [recentFilter, setRecentFilter] = useState<"all" | "7" | "30" | "90">("all");
  const [filterReferenceTime] = useState(() => Date.now());
  const [createOpen, setCreateOpen] = useState(false);
  const [mutationKey, setMutationKey] = useState<string | null>(null);
  const [actionIssue, setActionIssue] = useState<ApiIssue | null>(null);
  const [notice, setNotice] = useState("");
  const matterRequest = useRef(0);
  const matterAbort = useRef<AbortController | null>(null);
  const promptImportRef = useRef<HTMLInputElement | null>(null);

  const loadCatalogue = useCallback(async (preferredId?: string) => {
    setCataloguePhase("loading");
    setCatalogueIssue(null);
    try {
      const payload = await apiRequest("/api/dossiers?limit=50");
      const items = normalizeMatterList(payload);
      setCatalogue(items);
      setCatalogueCursor(nextPageCursor(payload));
      if (items.length === 0) {
        setSelectedId(null);
        setWorkspace(null);
        setCataloguePhase("empty");
        return;
      }
      setSelectedId((current) => {
        if (preferredId && items.some((item) => item.id === preferredId)) return preferredId;
        if (current && items.some((item) => item.id === current)) return current;
        return items[0].id;
      });
      setCataloguePhase("ready");
    } catch (caught) {
      const issue = caught instanceof WorkspaceApiError
        ? apiIssueFor(caught.status, caught.payload)
        : apiIssueFor(500, { message: "The matter catalogue is temporarily unreachable." });
      setCatalogueIssue(issue);
      setCataloguePhase(issue.kind === "permission" ? "permission" : "error");
    }
  }, []);

  async function loadMoreCatalogue() {
    if (!catalogueCursor || catalogue.length >= 200) return;
    setMutationKey("catalogue-more");
    setActionIssue(null);
    try {
      const payload = await apiRequest("/api/dossiers?limit=50&cursor=" + encodeURIComponent(catalogueCursor));
      const page = normalizeMatterList(payload);
      setCatalogue((current) => {
        const known = new Set(current.map((matter) => matter.id));
        return [...current, ...page.filter((matter) => !known.has(matter.id))].slice(0, 200);
      });
      setCatalogueCursor(nextPageCursor(payload));
    } catch (caught) {
      setActionIssue(caught instanceof WorkspaceApiError
        ? apiIssueFor(caught.status, caught.payload)
        : apiIssueFor(500, { message: "The next matter catalogue page could not be loaded." }));
    } finally {
      setMutationKey(null);
    }
  }

  const loadMatter = useCallback(async (dossierId: string) => {
    matterAbort.current?.abort();
    const controller = new AbortController();
    matterAbort.current = controller;
    const requestId = ++matterRequest.current;
    setWorkspacePhase("loading");
    setWorkspaceIssue(null);
    setActionIssue(null);
    try {
      const encodedId = encodeURIComponent(dossierId);
      const detailPayload = await apiRequest("/api/dossiers/" + encodedId, { signal: controller.signal });
      const matter = normalizeMatterDetail(detailPayload);
      if (!matter) throw new WorkspaceApiError(500, { message: "The server returned an unsupported matter envelope." });

      const [documentsResult, requestsResult, proposalsResult, packagesResult, snapshotsResult, outputsResult, activityResult] = await Promise.all([
        settledRequest("/api/dossiers/" + encodedId + "/documents", controller.signal),
        settledRequest("/api/dossiers/" + encodedId + "/requests", controller.signal),
        settledRequest("/api/dossiers/" + encodedId + "/proposals?limit=100", controller.signal),
        settledRequest("/api/dossiers/" + encodedId + "/decision-packages", controller.signal),
        settledRequest("/api/dossiers/" + encodedId + "/snapshots", controller.signal),
        settledRequest("/api/dossiers/" + encodedId + "/outputs", controller.signal),
        settledRequest("/api/dossiers/" + encodedId + "/activity?limit=100", controller.signal),
      ]);
      if (requestId !== matterRequest.current) return;

      const fallbackRequests = normalizeRequests(detailPayload);
      const requestData = requestsResult.payload ? normalizeRequests(requestsResult.payload) : fallbackRequests;
      const activityData = activityResult.payload ? normalizeActivity(activityResult.payload) : normalizeActivity(detailPayload);
      const issues: WorkspaceBundle["issues"] = {};
      const results: Array<[ResourceKey, SettledApi]> = [
        ["documents", documentsResult], ["requests", requestsResult], ["proposals", proposalsResult],
        ["packages", packagesResult], ["snapshots", snapshotsResult], ["outputs", outputsResult], ["activity", activityResult],
      ];
      for (const [key, result] of results) if (result.issue) issues[key] = result.issue;

      setWorkspace({
        matter,
        documents: documentsResult.payload ? normalizeDocuments(documentsResult.payload) : normalizeDocuments(detailPayload),
        requests: requestData.requests,
        deadlines: requestData.deadlines,
        proposals: proposalsResult.payload ? normalizeProposals(proposalsResult.payload) : normalizeProposals(detailPayload),
        packages: packagesResult.payload ? normalizePackages(packagesResult.payload) : normalizePackages(detailPayload),
        snapshots: snapshotsResult.payload ? normalizeSnapshots(snapshotsResult.payload) : normalizeSnapshots(detailPayload),
        outputs: outputsResult.payload ? normalizeOutputs(outputsResult.payload) : normalizeOutputs(detailPayload),
        activity: activityData.items,
        activityCursor: activityData.nextCursor,
        proposalCursor: proposalsResult.payload ? nextPageCursor(proposalsResult.payload) : null,
        issues,
      });
      setWorkspacePhase("ready");
    } catch (caught) {
      if (caught instanceof DOMException && caught.name === "AbortError") return;
      if (requestId !== matterRequest.current) return;
      const issue = caught instanceof WorkspaceApiError
        ? apiIssueFor(caught.status, caught.payload)
        : apiIssueFor(500, { message: "The selected matter could not be loaded." });
      setWorkspaceIssue(issue);
      setWorkspacePhase(issue.kind === "permission" ? "permission" : "error");
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadCatalogue(), 0);
    return () => window.clearTimeout(timer);
  }, [loadCatalogue]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (selectedId) void loadMatter(selectedId);
    }, 0);
    return () => {
      window.clearTimeout(timer);
      matterAbort.current?.abort();
    };
  }, [loadMatter, selectedId]);

  const filteredCatalogue = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    const recentDays = recentFilter === "all" ? null : Number(recentFilter);
    const recentFloor = recentDays === null ? null : filterReferenceTime - recentDays * 86_400_000;
    return catalogue.filter((matter) => {
      if (statusFilter !== "all" && matter.status !== statusFilter) return false;
      if (typeFilter !== "all" && matter.typeLabel !== typeFilter) return false;
      if (ownershipFilter === "owned" && matter.permissions.role !== "owner") return false;
      if (ownershipFilter === "shared" && matter.permissions.role === "owner") return false;
      if (recentFloor !== null && (!matter.updatedAt || Date.parse(matter.updatedAt) < recentFloor)) return false;
      if (!query) return true;
      return [matter.title, matter.reference, matter.typeLabel, matter.ownerName, ...matter.jurisdictions]
        .some((value) => value.toLocaleLowerCase().includes(query));
    }).sort((left, right) => {
      const updated = (Date.parse(right.updatedAt ?? "") || 0) - (Date.parse(left.updatedAt ?? "") || 0);
      return updated || left.id.localeCompare(right.id);
    });
  }, [catalogue, filterReferenceTime, ownershipFilter, recentFilter, search, statusFilter, typeFilter]);

  const catalogueTypes = useMemo(() => [...new Set(catalogue.map((matter) => matter.typeLabel))].sort((left, right) => left.localeCompare(right)), [catalogue]);

  async function importCasePrompt(file: File) {
    setActionIssue(null);
    if (!/\.md$/iu.test(file.name) || file.size > 128_000) {
      setActionIssue(apiIssueFor(422, { message: "Choose one Markdown case prompt no larger than 128 KB." }));
      return;
    }
    const value = await file.text();
    if (!value.trim() || value.length > 64_000) {
      setActionIssue(apiIssueFor(422, { message: "The Markdown case prompt is empty or exceeds the 64,000-character Studio limit." }));
      return;
    }
    window.sessionStorage.setItem(PENDING_CASE_PROMPT_KEY, value);
    router.push("/studio?studio_step=brief&import=markdown");
  }

  async function mutate(path: string, key: string, body: Record<string, unknown>, successMessage: string, method: "POST" | "PUT" = "POST") {
    if (!workspace) return;
    setMutationKey(key);
    setActionIssue(null);
    setNotice("");
    try {
      await apiRequest(path, {
        method,
        headers: { "content-type": "application/json" },
        body: JSON.stringify(mutationPayload(workspace.matter.revision, body)),
      });
      setNotice(successMessage);
      await loadCatalogue(workspace.matter.id);
      await loadMatter(workspace.matter.id);
    } catch (caught) {
      setActionIssue(caught instanceof WorkspaceApiError
        ? apiIssueFor(caught.status, caught.payload)
        : apiIssueFor(500, { message: "The write could not be confirmed." }));
    } finally {
      setMutationKey(null);
    }
  }

  async function createMatter(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    setMutationKey("create");
    setActionIssue(null);
    setNotice("");
    const form = new FormData(event.currentTarget);
    try {
      const payload = await apiRequest("/api/dossiers", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(mutationPayload(0, {
          title: String(form.get("title") ?? "").trim(),
          jurisdictions: [String(form.get("jurisdiction") ?? "").trim()],
          classification: String(form.get("classification") ?? "confidential"),
          priority: String(form.get("priority") ?? "normal"),
        })),
      });
      const created = normalizeMatterDetail(payload) ?? normalizeMatterList(payload)[0] ?? null;
      setCreateOpen(false);
      formElement.reset();
      setNotice("Matter created. Its governed revision is now visible.");
      await loadCatalogue(created?.id);
    } catch (caught) {
      setActionIssue(caught instanceof WorkspaceApiError
        ? apiIssueFor(caught.status, caught.payload)
        : apiIssueFor(500, { message: "The matter could not be created." }));
    } finally {
      setMutationKey(null);
    }
  }

  async function uploadDocument(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!workspace) return;
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const candidate = form.get("file");
    if (!(candidate instanceof File)) {
      setActionIssue(apiIssueFor(422, { message: "Choose one file before continuing." }));
      return;
    }
    const validation = validatePilotFile(candidate);
    if (!validation.ok) {
      setActionIssue(apiIssueFor(422, { message: validation.message }));
      return;
    }
    if (form.get("privacyAcknowledged") !== "yes") {
      setActionIssue(apiIssueFor(422, { message: "Confirm the pilot privacy boundary before uploading." }));
      return;
    }
    form.set("expectedRevision", String(workspace.matter.revision));
    form.set("mediaType", validation.canonicalMediaType);
    setMutationKey("upload");
    setActionIssue(null);
    setNotice("");
    try {
      await apiRequest("/api/dossiers/" + encodeURIComponent(workspace.matter.id) + "/documents", {
        method: "POST",
        body: form,
      });
      setNotice("Document submission accepted. Server validation and extraction state are shown below.");
      formElement.reset();
      await loadCatalogue(workspace.matter.id);
      await loadMatter(workspace.matter.id);
    } catch (caught) {
      setActionIssue(caught instanceof WorkspaceApiError
        ? apiIssueFor(caught.status, caught.payload)
        : apiIssueFor(500, { message: "The document upload could not be confirmed." }));
    } finally {
      setMutationKey(null);
    }
  }

  async function loadMoreActivity() {
    if (!workspace?.activityCursor || workspace.activity.length >= MAX_ACTIVITY_ITEMS) return;
    const dossierId = workspace.matter.id;
    setMutationKey("activity-more");
    setActionIssue(null);
    try {
      const payload = await apiRequest(
        "/api/dossiers/" + encodeURIComponent(dossierId) + "/activity?limit=100&cursor=" + encodeURIComponent(workspace.activityCursor),
      );
      const page = normalizeActivity(payload);
      setWorkspace((current) => current && current.matter.id === dossierId ? {
        ...current,
        activity: [...current.activity, ...page.items].slice(0, MAX_ACTIVITY_ITEMS),
        activityCursor: page.nextCursor,
      } : current);
    } catch (caught) {
      setActionIssue(caught instanceof WorkspaceApiError
        ? apiIssueFor(caught.status, caught.payload)
        : apiIssueFor(500, { message: "The next activity page could not be loaded." }));
    } finally {
      setMutationKey(null);
    }
  }

  async function loadMoreProposals() {
    if (!workspace?.proposalCursor || workspace.proposals.length >= MAX_PROPOSAL_ITEMS) return;
    const dossierId = workspace.matter.id;
    setMutationKey("proposal-more");
    setActionIssue(null);
    try {
      const payload = await apiRequest(
        "/api/dossiers/" + encodeURIComponent(dossierId) + "/proposals?limit=100&cursor=" + encodeURIComponent(workspace.proposalCursor),
      );
      const page = normalizeProposals(payload);
      setWorkspace((current) => current && current.matter.id === dossierId ? {
        ...current,
        proposals: [...current.proposals, ...page].slice(0, MAX_PROPOSAL_ITEMS),
        proposalCursor: nextPageCursor(payload),
      } : current);
    } catch (caught) {
      setActionIssue(caught instanceof WorkspaceApiError
        ? apiIssueFor(caught.status, caught.payload)
        : apiIssueFor(500, { message: "The next proposal page could not be loaded." }));
    } finally {
      setMutationKey(null);
    }
  }

  async function generateAiProposals(documentVersionIds: string[], retryFailed: boolean) {
    if (!workspace || documentVersionIds.length === 0) return;
    const dossierId = workspace.matter.id;
    setMutationKey("proposal-generate");
    setActionIssue(null);
    setNotice("");
    try {
      const sortedDocumentVersionIds = [...documentVersionIds].sort();
      const payload = await apiRequest(
        "/api/dossiers/" + encodeURIComponent(dossierId) + "/proposals/generate",
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            expected_revision: workspace.matter.revision,
            document_version_ids: sortedDocumentVersionIds,
            idempotency_key: await proposalGenerationIdempotencyKey(
              dossierId,
              workspace.matter.revision,
              sortedDocumentVersionIds,
            ),
            data_classification: "synthetic_or_deidentified",
            privacy_disclosure_acknowledged: true,
            retry_failed: retryFailed,
          }),
        },
      );
      const envelope = payload && typeof payload === "object" && !Array.isArray(payload)
        ? payload as Record<string, unknown>
        : {};
      const job = envelope.proposal_generation_job
        && typeof envelope.proposal_generation_job === "object"
        && !Array.isArray(envelope.proposal_generation_job)
        ? envelope.proposal_generation_job as Record<string, unknown>
        : {};
      const proposalCount = Array.isArray(job.proposal_ids) ? job.proposal_ids.length : 0;
      if (
        job.status !== "processing"
        && !(
          job.status === "ready"
          && (
            (job.result_code === "ready_no_candidates" && proposalCount === 0)
            || (job.result_code === "ready_with_candidates" && proposalCount > 0)
          )
        )
      ) throw new Error("The AI proposal response did not match the supported contract.");
      const analyzedRanges = Array.isArray(job.analyzed_sources) ? job.analyzed_sources : [];
      const analyzedCharacters = analyzedRanges.reduce((total, value) => {
        if (!value || typeof value !== "object" || Array.isArray(value)) return total;
        const range = value as Record<string, unknown>;
        const start = typeof range.character_start === "number" ? range.character_start : 0;
        const end = typeof range.character_end === "number" ? range.character_end : start;
        return total + Math.max(0, end - start);
      }, 0);
      const truncatedSources = analyzedRanges.filter((value) =>
        value && typeof value === "object" && !Array.isArray(value)
          && (value as Record<string, unknown>).truncated === true
      ).length;
      const coverage = analyzedRanges.length > 0
        ? ` ${analyzedRanges.length} bounded source range(s), ${analyzedCharacters} characters total, were analyzed.`
          + (truncatedSources > 0 ? ` ${truncatedSources} source(s) exceeded the disclosed context bound.` : "")
        : "";
      setNotice(job.status === "processing"
        ? "An identical AI proposal job is already processing. Manual evidence work remains available."
        : job.result_code === "ready_no_candidates"
          ? "AI analysis completed with no grounded candidates; nothing became authoritative." + coverage
          : `AI analysis created ${proposalCount} grounded proposal(s) for explicit review.` + coverage);
      await loadCatalogue(dossierId);
      await loadMatter(dossierId);
    } catch (caught) {
      setActionIssue(caught instanceof WorkspaceApiError
        ? apiIssueFor(caught.status, caught.payload)
        : apiIssueFor(500, { message: "AI proposal generation could not be confirmed. Manual evidence work remains available." }));
    } finally {
      setMutationKey(null);
    }
  }

  const dossierPath = workspace ? "/api/dossiers/" + encodeURIComponent(workspace.matter.id) : "";

  return <main className={styles.shell}>
    <a className={styles.skipLink} href="#matter-workspace">Skip to matter workspace</a>
    <nav className={styles.topbar} aria-label="Product navigation">
      <Link href="/" className={styles.brand}>
        <Image src="/brand/genesis-juris-codex-mark.svg" width={38} height={38} alt="" priority/>
        <span><b>GENESIS: JURIS</b><small>Product {PRODUCT_RELEASE}</small></span>
      </Link>
      <div className={styles.topLinks}>
        <Link href="/matters" aria-current="page">My cases</Link>
        <Link href="/">Templates</Link>
        <Link href="/studio">Decision Studio</Link>
        <Link href="/account">Account</Link>
      </div>
    </nav>

    <section className={styles.pilotNotice} aria-label="Pilot privacy limitation">
      <strong>Pilot workspace · synthetic or de-identified files only</strong>
      <details>
        <summary>Data limits</summary>
        <p>Formal production privacy controls and malware scanning are not yet claimed. Do not upload client-identifying, privileged, or live production documents.</p>
      </details>
    </section>

    <div className={styles.workspaceLayout}>
      <aside className={styles.catalogue} aria-labelledby="matter-catalogue-title">
        <div className={styles.catalogueHeading}>
          <div><p className={styles.eyebrow}>CASE LIBRARY</p><h1 id="matter-catalogue-title">My cases</h1><p className={styles.catalogueLead}>Open a case, continue your work, or start a new one.</p></div>
          <button type="button" className={styles.iconButton} onClick={() => setCreateOpen((open) => !open)} aria-expanded={createOpen} aria-controls="create-matter-panel">
            <span aria-hidden="true">＋</span><span className={styles.srOnly}>Create a matter</span>
          </button>
        </div>

        <div className={styles.catalogueActions} aria-label="Case library actions">
          <button type="button" onClick={() => setCreateOpen(true)}>New case</button>
          <button type="button" onClick={() => promptImportRef.current?.click()}>Import case prompt (.md)</button>
          <Link href="/?view=library">Browse templates</Link>
          <input ref={promptImportRef} className={styles.srOnly} type="file" accept=".md,text/markdown,text/plain" onChange={(event) => { const file = event.target.files?.[0]; if (file) void importCasePrompt(file); event.target.value = ""; }}/>
        </div>

        <div className={styles.catalogueTools}>
          <label className={styles.field}><span>Search cases</span><input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Title or reference…"/></label>
          <label className={styles.field}><span>Status</span><select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as MatterStatus | "all")}>
            {STATUS_FILTERS.map((status) => <option key={status} value={status}>{status === "all" ? "All statuses" : statusLabel(status)}</option>)}
          </select></label>
          <details className={styles.advancedFilters}>
            <summary>More filters</summary>
            <div>
              <label className={styles.field}><span>Case type</span><select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)}><option value="all">All case types</option>{catalogueTypes.map((type) => <option key={type} value={type}>{type}</option>)}</select></label>
              <label className={styles.field}><span>Ownership</span><select value={ownershipFilter} onChange={(event) => setOwnershipFilter(event.target.value as "all" | "owned" | "shared")}><option value="all">Owned and shared</option><option value="owned">Owned by me</option><option value="shared">Shared with me</option></select></label>
              <label className={styles.field}><span>Recent activity</span><select value={recentFilter} onChange={(event) => setRecentFilter(event.target.value as "all" | "7" | "30" | "90")}><option value="all">Any time</option><option value="7">Last 7 days</option><option value="30">Last 30 days</option><option value="90">Last 90 days</option></select></label>
            </div>
          </details>
        </div>

        <div className={styles.catalogueCount} role="status">{filteredCatalogue.length} case{filteredCatalogue.length === 1 ? "" : "s"}</div>
        {cataloguePhase === "loading" && <LoadingState compact label="Loading your cases"/>}
        {(cataloguePhase === "error" || cataloguePhase === "permission") && catalogueIssue && <IssueState issue={catalogueIssue} onRetry={() => void loadCatalogue()} compact/>}
        {cataloguePhase === "empty" && <div className={styles.catalogueEmpty}><strong>No matters yet</strong><span>Create a synthetic or de-identified pilot workspace to begin.</span></div>}
        {cataloguePhase === "ready" && filteredCatalogue.length === 0 && <div className={styles.catalogueEmpty}><strong>No matching matters</strong><span>Clear the search or choose another lifecycle status.</span></div>}
        <div className={styles.matterList} aria-label="Authorised matters">
          {filteredCatalogue.map((matter) => {
            const summary = readinessSummary(matter.readiness);
            return <button key={matter.id} type="button" className={matter.id === selectedId ? styles.matterCardActive : styles.matterCard} onClick={() => { setSelectedId(matter.id); setDestination("overview"); }} aria-pressed={matter.id === selectedId}>
              <span className={styles.matterCardTop}><b>{matter.reference}</b><em>{statusLabel(matter.status)}</em></span>
              <strong>{matter.title}</strong>
              <span>{matter.typeLabel}{matter.jurisdictions.length ? " · " + matter.jurisdictions.join(", ") : ""}</span>
              {view === "developer" && <>
                <span>{matter.permissions.role === "owner" ? "Owned by me" : "Shared with me"} · {sentenceLabel(matter.permissions.role)}</span>
                <span>Owner: {matter.ownerName} · {matter.documentCount} document{matter.documentCount === 1 ? "" : "s"}</span>
                <span>Priority: {sentenceLabel(matter.priority)}</span>
              </>}
              <span>{matter.keyDeadlineAt ? "Next deadline: " + formatMatterDate(matter.keyDeadlineAt, "en-GB", matter.keyDeadlineTimezone) : "No key deadline recorded"}</span>
              <span className={styles.readinessLine}>{summary.headline}</span>
              <small>Updated {formatMatterDate(matter.updatedAt)}</small>
            </button>;
          })}
        </div>
        {catalogue.length >= 200 ? <p className={styles.catalogueLimit}>Catalogue view is bounded to 200 matters. Refine safe metadata filters to narrow the list.</p> : catalogueCursor && <button type="button" className={styles.catalogueMore} onClick={() => void loadMoreCatalogue()} disabled={mutationKey !== null}>{mutationKey === "catalogue-more" ? "Loading matters…" : "Load more authorised matters"}</button>}
      </aside>

      <section className={styles.content} id="matter-workspace" aria-label="Selected matter workspace">
        <div className={styles.mobileSelectors}>
          <label className={styles.field}><span>Open matter</span><select value={selectedId ?? ""} onChange={(event) => { setSelectedId(event.target.value || null); setDestination("overview"); }} disabled={catalogue.length === 0}>
            {catalogue.length === 0 && <option value="">No authorised matters</option>}
            {catalogue.map((matter) => <option key={matter.id} value={matter.id}>{matter.reference} — {matter.title}</option>)}
          </select></label>
        </div>

        {createOpen && <section className={styles.createPanel} id="create-matter-panel" aria-labelledby="create-matter-title">
          <div className={styles.sectionTitle}><div><p className={styles.eyebrow}>NEW GOVERNED RECORD</p><h2 id="create-matter-title">Create a pilot matter</h2></div><button type="button" className={styles.textButton} onClick={() => setCreateOpen(false)}>Close</button></div>
          <p>Owner, access scope, and the collision-resistant Matter reference come from the trusted server, never from this form.</p>
          <form className={styles.formGrid} onSubmit={createMatter}>
            <label className={styles.field}><span>Title</span><input name="title" required maxLength={240}/></label>
            <label className={styles.field}><span>Jurisdiction</span><input name="jurisdiction" required maxLength={100}/></label>
            <label className={styles.field}><span>Classification</span><select name="classification" defaultValue="confidential"><option value="internal">Internal</option><option value="confidential">Confidential</option><option value="strictly_confidential">Strictly confidential</option></select></label>
            <label className={styles.field}><span>Priority</span><select name="priority" defaultValue="normal"><option value="low">Low</option><option value="normal">Normal</option><option value="high">High</option><option value="urgent">Urgent</option></select></label>
            <button className={styles.primaryButton} disabled={mutationKey !== null}>{mutationKey === "create" ? "Creating…" : "Create matter at revision 0"}</button>
          </form>
        </section>}

        {notice && <div className={styles.successBanner} role="status">{notice}</div>}
        {actionIssue && <IssueState issue={actionIssue} onRetry={actionIssue.kind === "stale" && workspace ? () => void loadMatter(workspace.matter.id) : undefined}/>}

        {cataloguePhase === "empty" && !createOpen && <EmptyWorkspace onCreate={() => setCreateOpen(true)}/>}
        {cataloguePhase === "permission" && catalogueIssue && <IssueState issue={catalogueIssue} onRetry={() => void loadCatalogue()}/>}
        {cataloguePhase === "error" && catalogueIssue && <IssueState issue={catalogueIssue} onRetry={() => void loadCatalogue()}/>}
        {selectedId && workspacePhase === "loading" && <LoadingState label="Opening your case"/>}
        {selectedId && (workspacePhase === "error" || workspacePhase === "permission") && workspaceIssue && <IssueState issue={workspaceIssue} onRetry={() => void loadMatter(selectedId)}/>}

        {workspacePhase === "ready" && workspace && <>
          <nav className={styles.breadcrumbs} aria-label="Case breadcrumb"><button type="button" onClick={() => document.getElementById("matter-catalogue-title")?.scrollIntoView({ block: "start" })}>My cases</button><span aria-hidden="true">→</span><button type="button" onClick={() => setDestination("overview")}>{workspace.matter.title}</button>{destination === "documents" && <><span aria-hidden="true">→</span><strong>Documents &amp; evidence</strong></>}</nav>
          <MatterHero matter={workspace.matter} view={view} setView={setView}/>
          <SectionNavigation destination={destination} onChange={setDestination}/>
          <div className={styles.sectionPanel} role="tabpanel" id={"panel-" + destination} aria-labelledby={"tab-" + destination}>
            {destination === "overview" && <OverviewSection matter={workspace.matter} outputs={workspace.outputs} view={view} mutationKey={mutationKey} onNavigate={setDestination} onTransition={(option, reason) => void mutate(dossierPath + "/transitions", "transition", { newStatus: option.to, reason: reason || null }, "Lifecycle transition recorded at a new revision.")} onUpdate={(fields) => void mutate(dossierPath, "matter-update", fields, "Matter metadata updated at a new revision.", "PUT")} onEnroll={(fields) => void mutate(dossierPath + "/participants", "participant-enroll", fields, "Participant enrolled at a new governed revision.")}/>}
            {destination === "documents" && <DocumentsSection matter={workspace.matter} documents={workspace.documents} issue={workspace.issues.documents} view={view} mutationKey={mutationKey} onUpload={uploadDocument} onReview={(document, decision) => void mutate(dossierPath + "/documents/" + encodeURIComponent(document.id) + "/review", "document-review-" + document.id, { decision }, decision === "accepted_source" ? "Document accepted as a governed source." : "Document rejection recorded.")}/>}
            {destination === "evidence" && <EvidenceSection matter={workspace.matter} documents={workspace.documents} packages={workspace.packages} proposals={workspace.proposals} cursor={workspace.proposalCursor} issue={workspace.issues.proposals} view={view} mutationKey={mutationKey} onGenerate={(documentVersionIds, retryFailed) => void generateAiProposals(documentVersionIds, retryFailed)} onReview={(proposal, action, editedValue, note) => void mutate(dossierPath + "/proposals", "proposal-" + proposal.id, { proposalId: proposal.id, action, editedValue, reviewNote: note || null }, "AI proposal review recorded. The historical proposal remains attributable.")} onCreateAnchor={(fields) => void mutate(dossierPath + "/evidence/anchors", "anchor-create", { action: "create", ...fields }, "Exact manual source anchor recorded for review.")} onReviewAnchor={(anchor, decision) => void mutate(dossierPath + "/evidence/anchors", "anchor-review-" + anchor.id, { action: "review", sourceAnchorId: anchor.id, decision }, "Source-anchor review decision recorded.")} onCreateAssertion={(fields) => void mutate(dossierPath + "/evidence/assertions", "assertion-create", { action: "create", ...fields }, "Professional assertion recorded for review.")} onReviewAssertion={(assertion, decision) => void mutate(dossierPath + "/evidence/assertions", "assertion-review-" + assertion.id, { action: "review", assertionId: assertion.id, decision }, "Professional assertion review decision recorded.")} onLinkEvidence={(fields) => void mutate(dossierPath + "/evidence/links", "evidence-link", { action: "create", ...fields }, "Reviewed evidence linked to the exact graph entity.")} onLoadMore={() => void loadMoreProposals()}/>}
            {destination === "decision-packages" && <DecisionPackagesSection matter={workspace.matter} packages={workspace.packages} snapshots={workspace.snapshots} issue={workspace.issues.packages ?? workspace.issues.snapshots} view={view} mutationKey={mutationKey} onLink={(fields) => void mutate(dossierPath + "/decision-packages", "package-link", fields, "Decision package linked to the visible dossier revision.")} onSnapshot={(fields) => void mutate(dossierPath + "/snapshots", "snapshot-create", fields, "Immutable dossier snapshot created.")}/>}
            {destination === "requests" && <RequestsSection matter={workspace.matter} documents={workspace.documents} requests={workspace.requests} deadlines={workspace.deadlines} issue={workspace.issues.requests} view={view} mutationKey={mutationKey} onCreate={(fields) => void mutate(dossierPath + "/requests", "request-create", fields, "Information request recorded and readiness will be recomputed.")} onSatisfy={(fields) => void mutate(dossierPath + "/requests", "request-satisfy", { action: "update_status", status: "received", ...fields }, "Information request satisfied by an exact Matter document link.")}/>}
            {destination === "outputs" && <OutputsSection matter={workspace.matter} outputs={workspace.outputs} snapshots={workspace.snapshots} issue={workspace.issues.outputs} view={view} mutationKey={mutationKey} onGenerate={(fields) => void mutate(dossierPath + "/outputs", "output-generate", fields, "Governed output request recorded against an immutable snapshot.")} onApprove={(output) => void mutate(dossierPath + "/outputs", "output-approve-" + output.id, { action: "approve", outputId: output.id }, "Reviewer approval recorded for the snapshot-bound output.")}/>}
            {destination === "activity" && <ActivitySection activity={workspace.activity} cursor={workspace.activityCursor} issue={workspace.issues.activity} view={view} mutationKey={mutationKey} onLoadMore={() => void loadMoreActivity()}/>}
          </div>
        </>}
      </section>
    </div>
  </main>;
}

function MatterHero({ matter, view, setView }: { matter: MatterDetail; view: MatterView; setView: (view: MatterView) => void }) {
  const readiness = readinessSummary(matter.readiness);
  return <header className={styles.matterHero}>
    <div className={styles.heroTop}>
      <div className={styles.heroIdentity}>
        <p className={styles.eyebrow}>{matter.reference}{view === "developer" ? ` · REVISION ${matter.revision}` : ""}</p>
        <h1>{matter.title}</h1>
        <p>{matter.typeLabel}{matter.jurisdictions.length ? " · " + matter.jurisdictions.join(" · ") : ""}</p>
      </div>
      <fieldset className={styles.viewToggle}>
        <legend>Workspace detail</legend>
        <button type="button" aria-pressed={view === "user"} onClick={() => setView("user")}>User view</button>
        <button type="button" aria-pressed={view === "developer"} onClick={() => setView("developer")}>Developer view</button>
      </fieldset>
    </div>

    <dl className={styles.heroFacts}>
      <div><dt>Owner</dt><dd>{matter.ownerName}</dd></div>
      <div><dt>Lifecycle status</dt><dd><span className={styles.stateToken}>{statusLabel(matter.status)}</span>{matter.statusReason && <small>{matter.statusReason}</small>}</dd></div>
      <div><dt>Priority & classification</dt><dd>{sentenceLabel(matter.priority)} · {sentenceLabel(matter.classification)}</dd></div>
      <div><dt>Key deadline</dt><dd>{formatMatterDate(matter.keyDeadlineAt, "en-GB", matter.keyDeadlineTimezone)}{matter.keyDeadlineTimezone && <small>{matter.keyDeadlineTimezone}</small>}</dd></div>
    </dl>

    <div className={styles.attentionGrid}>
      <section className={styles.nextAction} aria-labelledby="next-attention-title"><span aria-hidden="true">→</span><div><h2 id="next-attention-title">What needs attention next</h2><p>{nextAttention(matter)}</p></div></section>
      <section className={matter.readiness.ready ? styles.readySummary : styles.blockedSummary} aria-labelledby="readiness-summary-title">
        <span className={styles.statusWord}>{matter.readiness.ready ? "READY" : "NOT READY"}</span>
        <div><h2 id="readiness-summary-title">{readiness.headline}</h2><p>{readiness.detail}</p><small>{readiness.blockedCount} item{readiness.blockedCount === 1 ? "" : "s"} need attention.{view === "developer" ? " Lifecycle status is separate." : ""}</small></div>
      </section>
    </div>

    {view === "developer" && <dl className={styles.developerStrip} aria-label="Developer matter diagnostics">
      <div><dt>Dossier ID</dt><dd><code>{matter.id}</code></dd></div>
      <div><dt>Owner actor ID</dt><dd><code>{matter.ownerActorId ?? "not returned"}</code></dd></div>
      <div><dt>Schema / contract</dt><dd><code>{matter.rawSchemaVersion ?? "?"} / {matter.contractVersion ?? "not returned"}</code></dd></div>
      <div><dt>Build</dt><dd><code>{matter.buildVersion ?? "not returned"}</code></dd></div>
    </dl>}
  </header>;
}

function SectionNavigation({ destination, onChange }: { destination: MatterDestination; onChange: (destination: MatterDestination) => void }) {
  return <nav className={styles.sectionNavigation} aria-label="Matter sections">
    <div className={styles.sectionTabs} role="tablist" aria-label="Matter workspace destinations">
      {MATTER_DESTINATIONS.map((item, index) => <button key={item.key} type="button" role="tab" id={"tab-" + item.key} aria-selected={destination === item.key} aria-controls={"panel-" + item.key} tabIndex={destination === item.key ? 0 : -1} onClick={() => onChange(item.key)}>
        <span>{String(index + 1).padStart(2, "0")}</span>{item.label}
      </button>)}
    </div>
    <label className={styles.mobileSectionSelect}><span>Workspace section</span><select value={destination} onChange={(event) => onChange(event.target.value as MatterDestination)}>{MATTER_DESTINATIONS.map((item) => <option key={item.key} value={item.key}>{item.label}</option>)}</select></label>
  </nav>;
}

function OverviewSection({
  matter,
  outputs,
  view,
  mutationKey,
  onNavigate,
  onTransition,
  onUpdate,
  onEnroll,
}: {
  matter: MatterDetail;
  outputs: OutputItem[];
  view: MatterView;
  mutationKey: string | null;
  onNavigate: (destination: MatterDestination) => void;
  onTransition: (option: TransitionOption, reason: string) => void;
  onUpdate: (fields: Record<string, unknown>) => void;
  onEnroll: (fields: Record<string, unknown>) => void;
}) {
  const [selectedTransition, setSelectedTransition] = useState("");
  const [reason, setReason] = useState("");
  const transitions = availableTransitions(matter.status, matter.permissions.role);
  const option = transitions.find((item) => item.to === selectedTransition) ?? null;
  const currentOutput = outputs.some((output) => output.state === "current");
  const currentReviewerApproval = outputs.some((output) => output.state === "current" && output.approvedAt !== null);
  const canSubmit = Boolean(option)
    && (!option?.requiresReason || reason.trim().length > 0)
    && (!option?.requiresCurrentOutput || currentOutput)
    && (!option?.requiresReviewerApproval || currentReviewerApproval)
    && matter.permissions.canTransition;
  return <div className={styles.sectionStack}>
    <SectionHeading eyebrow="MATTER CONTROL" title="Overview" description="Lifecycle and readiness are related, but they are never the same signal."/>
    <div className={styles.twoColumn}>
      <section className={styles.panel} aria-labelledby="readiness-dimensions-title">
        <div className={styles.panelHeading}><h3 id="readiness-dimensions-title">Readiness by professional check</h3><span>{matter.readiness.dimensions.length || 10} dimensions</span></div>
        {matter.readiness.dimensions.length === 0 ? <EmptyState title="Readiness has not been computed" detail="The API returned no dimension findings for this revision."/> : <div className={styles.readinessGrid}>
          {matter.readiness.dimensions.map((dimension) => <article key={dimension.dimension} className={styles.readinessItem}>
            <div><strong>{sentenceLabel(dimension.dimension)}</strong><span className={styles.stateToken}>{dimension.state === "not_applicable" ? "Not applicable" : dimension.state === "ready" ? "Ready" : "Blocked"}</span></div>
            {dimension.reasons.length === 0 ? <p>{dimension.state === "ready" ? "No blocker recorded." : "No action required for this matter."}</p> : <ul>{dimension.reasons.map((finding) => <li key={finding.code + (finding.relatedObjectId ?? "")}><b>{finding.code}</b><span>{finding.explanation}</span>{finding.deepLink && <button type="button" className={styles.linkButton} onClick={() => onNavigate(destinationForDeepLink(finding.deepLink ?? ""))} aria-label={"Open readiness source for " + finding.code}>Open related record</button>}</li>)}</ul>}
          </article>)}
        </div>}
      </section>

      <section className={styles.panel} aria-labelledby="lifecycle-action-title">
        <div className={styles.panelHeading}><h3 id="lifecycle-action-title">Explicit lifecycle action</h3><span>Current: {statusLabel(matter.status)}</span></div>
        {!matter.permissions.canTransition || transitions.length === 0 ? <NoPermission detail={"Your " + matter.permissions.role + " role has no available transition from this state."}/> : <form className={styles.actionForm} onSubmit={(event) => { event.preventDefault(); if (option && canSubmit) onTransition(option, reason.trim()); }}>
          <label className={styles.field}><span>Move matter to</span><select value={selectedTransition} onChange={(event) => setSelectedTransition(event.target.value)} required><option value="">Choose an explicit status…</option>{transitions.map((item) => <option key={item.to} value={item.to}>{statusLabel(item.to)}</option>)}</select></label>
          {option?.requiresReason && <label className={styles.field}><span>Reason (required)</span><textarea value={reason} onChange={(event) => setReason(event.target.value)} maxLength={1_000} required/></label>}
          {option && <div className={styles.consequenceBox}><strong>Consequences before you confirm</strong><ul>{transitionConsequences(option).map((item) => <li key={item}>{item}</li>)}</ul>{option.requiresCurrentOutput && !currentOutput && <p role="alert">Blocked: no current governed output is visible.</p>}{option.requiresReviewerApproval && !currentReviewerApproval && <p role="alert">Blocked: the current output has no attributable reviewer approval.</p>}</div>}
          <button className={styles.primaryButton} disabled={!canSubmit || mutationKey !== null}>{mutationKey === "transition" ? "Recording transition…" : option ? "Confirm move to " + statusLabel(option.to) : "Choose a status"}</button>
        </form>}
        <dl className={styles.factList}>
          <div><dt>Participant role</dt><dd>{sentenceLabel(matter.permissions.role)}</dd></div>
          <div><dt>Current revision</dt><dd>{matter.revision}</dd></div>
          <div><dt>Created</dt><dd>{formatMatterDate(matter.createdAt)}</dd></div>
          <div><dt>Updated</dt><dd>{formatMatterDate(matter.updatedAt)}</dd></div>
        </dl>
        {matter.permissions.canWrite && <details className={styles.metadataEditor}><summary>Edit bounded matter metadata</summary><form className={styles.actionForm} onSubmit={(event) => { event.preventDefault(); const form = new FormData(event.currentTarget); onUpdate({ title: String(form.get("title") ?? "").trim(), priority: String(form.get("priority") ?? "normal"), classification: String(form.get("classification") ?? "confidential") }); }}><label className={styles.field}><span>Title</span><input name="title" defaultValue={matter.title} required maxLength={240}/></label><label className={styles.field}><span>Priority</span><select name="priority" defaultValue={matter.priority}><option value="low">Low</option><option value="normal">Normal</option><option value="high">High</option><option value="urgent">Urgent</option></select></label><label className={styles.field}><span>Classification</span><select name="classification" defaultValue={matter.classification}><option value="internal">Internal</option><option value="confidential">Confidential</option><option value="strictly_confidential">Strictly confidential</option></select></label><p className={styles.paginationNote}>Owner and access scope cannot be changed from client-supplied metadata.</p><button className={styles.secondaryButton} disabled={mutationKey !== null}>{mutationKey === "matter-update" ? "Saving revision…" : "Save matter metadata"}</button></form></details>}
      </section>
    </div>
    <div className={styles.twoColumn}>
      <section className={styles.panel} aria-labelledby="participant-register-title">
        <div className={styles.panelHeading}>
          <h3 id="participant-register-title">Participant register</h3>
          <span>{matter.participants.filter((participant) => participant.status === "active").length} active</span>
        </div>
        {matter.participants.length === 0
          ? <EmptyState title="No participants returned" detail="The governed participant register is unavailable for this Matter."/>
          : <dl className={styles.factList}>
              {matter.participants.map((participant) => <div key={participant.id}>
                <dt>{participant.displayName}</dt>
                <dd>
                  {sentenceLabel(participant.role)} · {sentenceLabel(participant.status)}
                  {view === "developer" && <><br/><code>{participant.actorId}</code></>}
                </dd>
              </div>)}
            </dl>}
      </section>
      <aside className={styles.panel} aria-labelledby="participant-enrollment-title">
        <div className={styles.panelHeading}>
          <h3 id="participant-enrollment-title">Enroll a participant</h3>
          <span>Owner only</span>
        </div>
        {!matter.permissions.canManageParticipants
          ? <NoPermission detail="The participant register is visible, but only the Matter owner can enroll an account."/>
          : <form className={styles.actionForm} onSubmit={(event) => {
              event.preventDefault();
              const form = new FormData(event.currentTarget);
              onEnroll({
                actorId: String(form.get("actorId") ?? "").trim(),
                role: String(form.get("role") ?? "reviewer"),
              });
            }}>
              <label className={styles.field}>
                <span>Existing account Actor ID</span>
                <input
                  name="actorId"
                  required
                  minLength={8}
                  maxLength={128}
                  autoComplete="off"
                  spellCheck={false}
                  placeholder="actor_…"
                />
              </label>
              <label className={styles.field}>
                <span>Participant role</span>
                <select name="role" defaultValue="reviewer">
                  <option value="reviewer">Reviewer</option>
                  <option value="contributor">Contributor</option>
                  <option value="viewer">Viewer</option>
                </select>
              </label>
              <div className={styles.consequenceBox}>
                <strong>Exact profile enrollment</strong>
                <p>The server resolves this non-guessable Actor ID to an existing professional profile. Email, display name, owner authority, and dossier scope cannot be supplied here.</p>
              </div>
              <button className={styles.primaryButton} disabled={mutationKey !== null}>
                {mutationKey === "participant-enroll" ? "Enrolling participant…" : "Enroll participant at revision " + matter.revision}
              </button>
            </form>}
      </aside>
    </div>
  </div>;
}

function DocumentsSection({ matter, documents, issue, view, mutationKey, onUpload, onReview }: { matter: MatterDetail; documents: DocumentItem[]; issue?: ApiIssue; view: MatterView; mutationKey: string | null; onUpload: (event: FormEvent<HTMLFormElement>) => void; onReview: (document: DocumentItem, decision: "accepted_source" | "rejected") => void }) {
  return <div className={styles.sectionStack}>
    <SectionHeading eyebrow="IMMUTABLE SOURCES" title="Documents" description="Logical documents stay readable while every prior binary version remains separately attributable."/>
    {issue && <IssueState issue={issue} compact/>}
    <section className={styles.uploadPanel} aria-labelledby="safe-upload-title">
      <div><p className={styles.eyebrow}>SAFE PILOT INTAKE</p><h3 id="safe-upload-title">Add a document or version</h3><p>PDF and DOCX up to 25 MiB; TXT and Markdown up to 5 MiB. Filename, media type, size, and content are validated again by the server. No client preview reads the file body.</p></div>
      {!matter.permissions.canWrite ? <NoPermission detail="Your participant role can inspect document metadata but cannot add a source."/> : <form className={styles.uploadForm} onSubmit={onUpload}>
        <label className={styles.field}><span>Logical document title</span><input name="title" required maxLength={500}/></label>
        <label className={styles.field}><span>Upload purpose</span><select name="documentId" defaultValue=""><option value="">Create a new logical document</option>{documents.map((document) => <option key={document.id} value={document.id}>Add a new immutable version of {document.title}</option>)}</select></label>
        <label className={styles.field}><span>Document type</span><input name="documentType" required maxLength={120} placeholder="e.g. witness statement"/></label>
        <label className={styles.field}><span>Classification</span><select name="classification" defaultValue={matter.classification}><option value="internal">Internal</option><option value="confidential">Confidential</option><option value="strictly_confidential">Strictly confidential</option></select></label>
        <label className={styles.fileField}><span>Choose one source file</span><input name="file" type="file" accept=".pdf,.docx,.txt,.md,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain,text/markdown" required/><small>Unsupported or image-only attachments may be retained as “not extractable”; they are never presented as analysed.</small></label>
        <label className={styles.checkField}><input name="privacyAcknowledged" type="checkbox" value="yes" required/><span>I confirm this pilot file is synthetic or de-identified and contains no live privileged or client-identifying material.</span></label>
        <button className={styles.primaryButton} disabled={mutationKey !== null}>{mutationKey === "upload" ? "Submitting securely…" : "Submit for server validation"}</button>
      </form>}
    </section>

    {documents.length === 0 && !issue ? <EmptyState title="No documents in this matter" detail="Add the first synthetic or de-identified source when your role permits."/> : <div className={styles.recordList}>
      {documents.map((document) => {
        const current = document.versions.find((version) => version.id === document.currentVersionId) ?? document.versions[0] ?? null;
        return <article className={styles.documentCard} key={document.id}>
          <div className={styles.recordHeading}><div><span className={styles.stateToken}>{sentenceLabel(document.status)}</span><h3>{document.title}</h3><p>{sentenceLabel(document.type)} · {sentenceLabel(document.classification)}</p></div><div className={styles.versionBadge}><strong>{current ? "v" + current.ordinal : "No version"}</strong><span>Current version</span></div></div>
          {current && <div className={styles.currentVersion}>
            <div><strong>{current.originalFilename}</strong><span>{formatBytes(current.byteLength)} · {current.mediaType}</span></div>
            <div><strong>Extraction: {sentenceLabel(current.extractionStatus)}</strong><span>{current.extractionErrorCode ? "Diagnostic: " + sentenceLabel(current.extractionErrorCode) : "No extraction failure recorded"}</span></div>
            <div><strong>Uploaded {formatMatterDate(current.uploadedAt)}</strong><span>{current.sourceNote ?? "No source note"}</span></div>
            {current.downloadUrl ? <a className={styles.secondaryButton} href={organizationScopedUrl(current.downloadUrl)} aria-label={"Securely download current version of " + document.title}>Secure download</a> : <span className={styles.unavailableAction}>Secure download is not exposed by this pilot API.</span>}
          </div>}
          {(document.status === "received" || document.status === "under_review") && matter.permissions.canReview && <div className={styles.inlineActions} aria-label={"Review " + document.title}>
            <button type="button" className={styles.primaryButton} disabled={mutationKey !== null} onClick={() => onReview(document, "accepted_source")}>{mutationKey === "document-review-" + document.id ? "Recording…" : "Accept as governed source"}</button>
            <button type="button" className={styles.dangerButton} disabled={mutationKey !== null} onClick={() => onReview(document, "rejected")}>Reject document</button>
          </div>}
          <details className={styles.versionHistory}><summary>Version history · {document.versions.length} immutable version{document.versions.length === 1 ? "" : "s"}</summary><ol>{document.versions.map((version) => <li key={version.id} className={version.id === document.currentVersionId ? styles.currentHistoryItem : undefined}>
            <div><strong>Version {version.ordinal}{version.id === document.currentVersionId ? " · CURRENT" : ""}</strong><span>{version.originalFilename}</span></div>
            <dl><div><dt>Extraction</dt><dd>{sentenceLabel(version.extractionStatus)}{version.extractionErrorCode ? " · " + sentenceLabel(version.extractionErrorCode) : ""}</dd></div><div><dt>Size / type</dt><dd>{formatBytes(version.byteLength)} · {version.mediaType}</dd></div><div><dt>Uploaded</dt><dd>{formatMatterDate(version.uploadedAt)}</dd></div>{view === "developer" && <><div><dt>Version ID</dt><dd><code>{version.id}</code></dd></div><div><dt>SHA-256</dt><dd><code>{version.contentSha256 ?? "not returned"}</code></dd></div><div><dt>Predecessor</dt><dd><code>{version.predecessorVersionId ?? "root version"}</code></dd></div></>}</dl>
          </li>)}</ol></details>
          {view === "developer" && <p className={styles.rawId}>Document ID <code>{document.id}</code> · Current pointer <code>{document.currentVersionId || "not returned"}</code></p>}
        </article>;
      })}
    </div>}
  </div>;
}

function EvidenceSection({ matter, documents, packages, proposals, cursor, issue, view, mutationKey, onGenerate, onReview, onCreateAnchor, onReviewAnchor, onCreateAssertion, onReviewAssertion, onLinkEvidence, onLoadMore }: {
  matter: MatterDetail;
  documents: DocumentItem[];
  packages: DecisionPackageItem[];
  proposals: ProposalItem[];
  cursor: string | null;
  issue?: ApiIssue;
  view: MatterView;
  mutationKey: string | null;
  onGenerate: (documentVersionIds: string[], retryFailed: boolean) => void;
  onReview: (proposal: ProposalItem, action: "accept" | "edit_and_accept" | "reject", editedValue: string | null, note: string) => void;
  onCreateAnchor: (fields: Record<string, unknown>) => void;
  onReviewAnchor: (anchor: SourceAnchorItem, decision: "accepted" | "rejected") => void;
  onCreateAssertion: (fields: Record<string, unknown>) => void;
  onReviewAssertion: (assertion: AssertionItem, decision: "accepted" | "rejected") => void;
  onLinkEvidence: (fields: Record<string, unknown>) => void;
  onLoadMore: () => void;
}) {
  const anchorMap = useMemo(() => new Map(matter.anchors.map((anchor) => [anchor.id, anchor])), [matter.anchors]);
  return <div className={styles.sectionStack}>
    <SectionHeading eyebrow="PROFESSIONAL REVIEW" title="Evidence" description="Accepted professional records and AI-proposed changes are deliberately separate."/>
    {issue && <IssueState issue={issue} compact/>}
    <AiProposalGenerationControls matter={matter} documents={documents} mutationKey={mutationKey} onGenerate={onGenerate}/>
    <ManualEvidenceControls matter={matter} documents={documents} packages={packages} mutationKey={mutationKey} onCreateAnchor={onCreateAnchor} onCreateAssertion={onCreateAssertion} onLinkEvidence={onLinkEvidence}/>
    <div className={styles.evidenceColumns}>
      <section className={styles.panel} aria-labelledby="accepted-evidence-title"><div className={styles.panelHeading}><h3 id="accepted-evidence-title">Professional assertions</h3><span>{matter.assertions.length} records</span></div>
        {matter.assertions.length === 0 ? <EmptyState title="No assertions recorded" detail="AI output is not silently promoted into the professional record."/> : <div className={styles.assertionList}>{matter.assertions.map((assertion) => <AssertionCard key={assertion.id} assertion={assertion} anchors={anchorMap} view={view} canReview={matter.permissions.canReview} busy={mutationKey === "assertion-review-" + assertion.id} onReview={onReviewAssertion}/>)}</div>}
      </section>
      <section className={styles.panel} aria-labelledby="proposal-review-title"><div className={styles.panelHeading}><h3 id="proposal-review-title">AI proposal queue</h3><span>{proposals.filter((proposal) => proposal.reviewState === "pending").length} pending</span></div>
        <div className={styles.aiBoundary}><strong>AI-PROPOSED · NOT AUTHORITATIVE</strong><p>Confidence is not evidence. Acceptance is explicit, attributable, and unavailable without an inspectable source anchor.</p></div>
        {proposals.length === 0 ? <EmptyState title="No AI proposals" detail="Manual document and evidence work remains available if AI is unavailable."/> : <div className={styles.proposalList}>{proposals.map((proposal) => <ProposalCard key={proposal.id} proposal={proposal} anchors={anchorMap} canReview={matter.permissions.canReview} view={view} busy={mutationKey === "proposal-" + proposal.id} onReview={onReview}/>)}</div>}
        {proposals.length >= MAX_PROPOSAL_ITEMS ? <p className={styles.paginationNote}>Client review is bounded to 500 proposal records. Use a refined server query to continue.</p> : cursor && <button type="button" className={styles.secondaryButton} onClick={onLoadMore} disabled={mutationKey !== null}>{mutationKey === "proposal-more" ? "Loading proposals…" : "Load next proposal page"}</button>}
      </section>
    </div>
    <section className={styles.sourceRegister} aria-labelledby="source-register-title"><div className={styles.panelHeading}><h3 id="source-register-title">Source anchor register</h3><span>{matter.anchors.length} exact citations</span></div>{matter.anchors.length === 0 ? <EmptyState title="No source anchors returned" detail="Evidence cannot be presented as source-grounded without an exact anchor."/> : <ol>{matter.anchors.map((anchor) => <li id={"source-" + anchor.id} key={anchor.id}><SourceCitation anchor={anchor} view={view} canReview={matter.permissions.canReview} busy={mutationKey === "anchor-review-" + anchor.id} onReview={onReviewAnchor}/></li>)}</ol>}</section>
  </div>;
}

function AiProposalGenerationControls({ matter, documents, mutationKey, onGenerate }: {
  matter: MatterDetail;
  documents: DocumentItem[];
  mutationKey: string | null;
  onGenerate: (documentVersionIds: string[], retryFailed: boolean) => void;
}) {
  const readySources = documents.flatMap((document) => {
    const version = document.versions.find((candidate) => candidate.id === document.currentVersionId);
    return version?.extractionStatus === "ready"
      ? [{ documentTitle: document.title, versionId: version.id, ordinal: version.ordinal }]
      : [];
  });
  return <section className={styles.panel} aria-labelledby="ai-proposal-generation-title">
    <div className={styles.panelHeading}><h3 id="ai-proposal-generation-title">Generate source-grounded AI proposals</h3><span>Explicit review only</span></div>
    <div className={styles.aiBoundary}><strong>AI-PROPOSED · NOT AUTHORITATIVE</strong><p>Selected bounded source ranges may be sent to the configured provider. Uploaded text is treated as untrusted evidence, never as instruction.</p></div>
    {!matter.permissions.canWrite ? <NoPermission detail="Your participant role may inspect proposals but cannot start an AI job."/> : readySources.length === 0 ? <EmptyState title="No extraction-ready current source" detail="Upload a supported text document and wait for its exact current version to reach ready extraction."/> : <form className={styles.actionForm} onSubmit={(event) => {
      event.preventDefault();
      const form = new FormData(event.currentTarget);
      const documentVersionIds = form.getAll("documentVersionIds").map(String);
      if (documentVersionIds.length === 0 || form.get("privacyAcknowledged") !== "yes") return;
      onGenerate(documentVersionIds, form.get("retryFailed") === "yes");
    }}>
      <label className={styles.field}><span>Extraction-ready current versions</span><select name="documentVersionIds" multiple required size={Math.min(readySources.length, 5)}>{readySources.map((source) => <option key={source.versionId} value={source.versionId}>{source.documentTitle} · version {source.ordinal}</option>)}</select></label>
      <label className={styles.checkField}><input type="checkbox" name="privacyAcknowledged" value="yes" required/><span>I confirm these sources are synthetic or de-identified and understand the bounded provider disclosure.</span></label>
      <label className={styles.checkField}><input type="checkbox" name="retryFailed" value="yes"/><span>Retry an identical failed job when its bounded retry policy permits.</span></label>
      <div className={styles.consequenceBox}><strong>Human-review boundary</strong><p>Every candidate must retain an inspectable exact source anchor. Zero grounded candidates is a valid terminal result; provider failure never blocks manual work.</p></div>
      <button className={styles.primaryButton} disabled={mutationKey !== null}>{mutationKey === "proposal-generate" ? "Analyzing bounded sources…" : "Generate proposals for review"}</button>
    </form>}
  </section>;
}

function ManualEvidenceControls({ matter, documents, packages, mutationKey, onCreateAnchor, onCreateAssertion, onLinkEvidence }: {
  matter: MatterDetail;
  documents: DocumentItem[];
  packages: DecisionPackageItem[];
  mutationKey: string | null;
  onCreateAnchor: (fields: Record<string, unknown>) => void;
  onCreateAssertion: (fields: Record<string, unknown>) => void;
  onLinkEvidence: (fields: Record<string, unknown>) => void;
}) {
  const currentSources = documents.flatMap((document) => {
    const version = document.versions.find((candidate) => candidate.id === document.currentVersionId) ?? document.versions[0];
    return version ? [{ documentId: document.id, documentTitle: document.title, versionId: version.id, ordinal: version.ordinal }] : [];
  });
  const acceptedAnchors = matter.anchors.filter((anchor) => anchor.reviewState === "accepted");
  const acceptedAssertions = matter.assertions.filter((assertion) => assertion.status === "accepted");
  const currentPackages = packages.filter((item) => item.state === "current");
  if (!matter.permissions.canWrite) return <NoPermission detail="Your participant role may inspect evidence but cannot add professional material."/>;
  return <div className={styles.twoColumn}>
    <section className={styles.panel} aria-labelledby="manual-evidence-title">
      <div className={styles.panelHeading}><h3 id="manual-evidence-title">Manual exact-source evidence</h3><span>Human authored</span></div>
      {currentSources.length === 0 ? <EmptyState title="A document version is required" detail="Upload a source before creating an exact manual anchor."/> : <form className={styles.actionForm} onSubmit={(event) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        const source = currentSources.find((candidate) => candidate.versionId === String(form.get("documentVersionId") ?? ""));
        if (!source) return;
        onCreateAnchor({
          documentId: source.documentId,
          documentVersionId: source.versionId,
          paragraph: String(form.get("paragraph") ?? "").trim(),
          excerpt: String(form.get("excerpt") ?? "").trim() || null,
        });
      }}>
        <label className={styles.field}><span>Exact immutable source version</span><select name="documentVersionId" required><option value="">Choose a source version</option>{currentSources.map((source) => <option key={source.versionId} value={source.versionId}>{source.documentTitle} · version {source.ordinal}</option>)}</select></label>
        <label className={styles.field}><span>Paragraph or clause locator</span><input name="paragraph" required maxLength={500} placeholder="e.g. clause 12.4 or paragraph 27"/></label>
        <label className={styles.field}><span>Bounded source excerpt (optional)</span><textarea name="excerpt" maxLength={500}/></label>
        <button className={styles.secondaryButton} disabled={mutationKey !== null}>{mutationKey === "anchor-create" ? "Recording anchor…" : "Create source anchor for review"}</button>
      </form>}
      {acceptedAnchors.length > 0 && <form className={styles.actionForm} onSubmit={(event) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        onCreateAssertion({
          assertionType: String(form.get("assertionType") ?? "fact"),
          statement: String(form.get("statement") ?? "").trim(),
          sourceAnchorIds: [String(form.get("sourceAnchorId") ?? "")],
        });
      }}>
        <h4>Create a professional assertion</h4>
        <label className={styles.field}><span>Accepted source anchor</span><select name="sourceAnchorId" required>{acceptedAnchors.map((anchor) => <option key={anchor.id} value={anchor.id}>{sourceCitationLabel(anchor, anchor.id)}</option>)}</select></label>
        <label className={styles.field}><span>Assertion type</span><select name="assertionType" defaultValue="fact"><option value="fact">Fact</option><option value="evidence">Evidence</option><option value="rule">Rule</option><option value="assumption">Assumption</option><option value="date">Date</option><option value="contradiction">Contradiction</option></select></label>
        <label className={styles.field}><span>Professional statement</span><textarea name="statement" required maxLength={8_000}/></label>
        <button className={styles.secondaryButton} disabled={mutationKey !== null}>{mutationKey === "assertion-create" ? "Recording assertion…" : "Create assertion for review"}</button>
      </form>}
    </section>
    <aside className={styles.panel} aria-labelledby="graph-evidence-title">
      <div className={styles.panelHeading}><h3 id="graph-evidence-title">Link reviewed evidence to a graph</h3><span>Exact package entity</span></div>
      {acceptedAnchors.length === 0 || currentPackages.length === 0 ? <EmptyState title="Accepted evidence and a current package are required" detail="Review a source anchor and link an exact decision package before creating a graph relationship."/> : <form className={styles.actionForm} onSubmit={(event) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        const assertionId = String(form.get("assertionId") ?? "");
        onLinkEvidence({
          sourceAnchorId: String(form.get("sourceAnchorId") ?? ""),
          assertionId: assertionId || null,
          decisionPackageReferenceId: String(form.get("decisionPackageReferenceId") ?? ""),
          targetType: String(form.get("targetType") ?? "graph_node"),
          targetId: String(form.get("targetId") ?? "").trim(),
          relation: String(form.get("relation") ?? "supports"),
          professionalMeaning: String(form.get("professionalMeaning") ?? "").trim(),
        });
      }}>
        <label className={styles.field}><span>Current decision package</span><select name="decisionPackageReferenceId" required>{currentPackages.map((item) => <option key={item.id} value={item.id}>{item.packageId} · {item.packageVersion}</option>)}</select></label>
        <label className={styles.field}><span>Accepted source anchor</span><select name="sourceAnchorId" required>{acceptedAnchors.map((anchor) => <option key={anchor.id} value={anchor.id}>{sourceCitationLabel(anchor, anchor.id)}</option>)}</select></label>
        <label className={styles.field}><span>Related accepted assertion (optional)</span><select name="assertionId" defaultValue=""><option value="">No assertion binding</option>{acceptedAssertions.map((assertion) => <option key={assertion.id} value={assertion.id}>{sentenceLabel(assertion.type)} · {assertion.statement.slice(0, 80)}</option>)}</select></label>
        <label className={styles.field}><span>Graph target</span><select name="targetType" defaultValue="graph_node"><option value="graph_node">Graph node</option><option value="graph_edge">Graph edge</option></select></label>
        <label className={styles.field}><span>Exact graph entity ID</span><input name="targetId" required maxLength={80} pattern="[a-z0-9][a-z0-9_-]{0,79}"/></label>
        <label className={styles.field}><span>Relationship</span><select name="relation" defaultValue="supports"><option value="supports">Supports</option><option value="contradicts">Contradicts</option><option value="qualifies">Qualifies</option><option value="supersedes">Supersedes</option><option value="source_for">Source for</option></select></label>
        <label className={styles.field}><span>Professional meaning</span><textarea name="professionalMeaning" required maxLength={1_000}/></label>
        <button className={styles.primaryButton} disabled={mutationKey !== null}>{mutationKey === "evidence-link" ? "Linking evidence…" : "Link evidence to graph entity"}</button>
      </form>}
    </aside>
  </div>;
}

function AssertionCard({ assertion, anchors, view, canReview, busy, onReview }: { assertion: AssertionItem; anchors: Map<string, SourceAnchorItem>; view: MatterView; canReview: boolean; busy: boolean; onReview: (assertion: AssertionItem, decision: "accepted" | "rejected") => void }) {
  return <article className={styles.assertionCard}><div className={styles.recordHeading}><div><span className={styles.stateToken}>{sentenceLabel(assertion.status)}</span><h4>{sentenceLabel(assertion.type)}</h4></div><span>PROFESSIONAL RECORD</span></div><p>{assertion.statement}</p><div className={styles.citationLinks}>{assertion.sourceAnchorIds.length === 0 ? <span>No source anchor recorded</span> : assertion.sourceAnchorIds.map((id) => { const anchor = anchors.get(id); return <a key={id} href={"#source-" + id} aria-label={"Open source citation " + sourceCitationLabel(anchor, id)}>{sourceCitationLabel(anchor, id)}</a>; })}</div>{assertion.status === "needs_review" && canReview && <div className={styles.inlineActions}><button type="button" className={styles.primaryButton} disabled={busy} onClick={() => onReview(assertion, "accepted")}>{busy ? "Recording…" : "Accept assertion"}</button><button type="button" className={styles.dangerButton} disabled={busy} onClick={() => onReview(assertion, "rejected")}>Reject assertion</button></div>}{view === "developer" && <p className={styles.rawId}>Assertion <code>{assertion.id}</code> · reviewed by <code>{assertion.reviewedBy ?? "not returned"}</code> at {formatMatterDate(assertion.reviewedAt)}</p>}</article>;
}

function ProposalCard({ proposal, anchors, canReview, view, busy, onReview }: { proposal: ProposalItem; anchors: Map<string, SourceAnchorItem>; canReview: boolean; view: MatterView; busy: boolean; onReview: (proposal: ProposalItem, action: "accept" | "edit_and_accept" | "reject", editedValue: string | null, note: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [editedValue, setEditedValue] = useState(proposal.proposedValue);
  const [note, setNote] = useState("");
  const sourceAnchors = proposal.sourceAnchorIds.map((id) => anchors.get(id)).filter((anchor): anchor is SourceAnchorItem => Boolean(anchor));
  const grounded = sourceAnchors.length > 0;
  const pending = proposal.reviewState === "pending";
  return <article className={styles.proposalCard} aria-label={"AI proposal: " + sentenceLabel(proposal.type)}>
    <div className={styles.proposalHeader}><div><span>AI-PROPOSED · {sentenceLabel(proposal.reviewState)}</span><h4>{sentenceLabel(proposal.type)}</h4></div>{proposal.confidenceCategory && <b>Model confidence: {sentenceLabel(proposal.confidenceCategory)}{proposal.confidenceScore === null ? "" : " · " + Math.round(proposal.confidenceScore * 100) + "%"}</b>}</div>
    <pre className={styles.proposedValue}>{proposal.proposedValue}</pre>
    <div className={styles.proposalSources}><strong>Inspectable sources</strong>{sourceAnchors.length === 0 ? <p className={styles.blockingText}>No usable source anchor was returned. Acceptance controls are disabled.</p> : sourceAnchors.map((anchor) => <a key={anchor.id} href={"#source-" + anchor.id} aria-label={"Inspect AI proposal source " + sourceCitationLabel(anchor, anchor.id)}>{sourceCitationLabel(anchor, anchor.id)}{anchor.excerpt ? <q>{anchor.excerpt}</q> : null}</a>)}</div>
    <dl className={styles.proposalMeta}><div><dt>Destination</dt><dd>{proposal.destinationType ? sentenceLabel(proposal.destinationType) : "Proposed destination not yet accepted"}</dd></div><div><dt>Provenance</dt><dd>{proposal.provider && proposal.model ? proposal.provider + " / " + proposal.model : "Model receipt not returned"}</dd></div>{proposal.reviewNote && <div><dt>Review note</dt><dd>{proposal.reviewNote}</dd></div>}</dl>
    {pending && canReview && <div className={styles.reviewControls}>
      <label className={styles.field}><span>Attributable review note (optional)</span><input value={note} onChange={(event) => setNote(event.target.value)} maxLength={1_000}/></label>
      {editing && <label className={styles.field}><span>Edit proposed value before acceptance</span><textarea value={editedValue} onChange={(event) => setEditedValue(event.target.value)} maxLength={5_000} rows={6}/></label>}
      <div><button type="button" className={styles.primaryButton} disabled={!grounded || busy} onClick={() => onReview(proposal, editing ? "edit_and_accept" : "accept", editing ? editedValue : null, note)}>{busy ? "Recording review…" : editing ? "Accept edited value" : "Accept with sources"}</button><button type="button" className={styles.secondaryButton} disabled={!grounded || busy} onClick={() => setEditing((value) => !value)}>{editing ? "Cancel edit" : "Edit and accept"}</button><button type="button" className={styles.dangerButton} disabled={busy} onClick={() => onReview(proposal, "reject", null, note)}>Reject proposal</button></div>
    </div>}
    {pending && !canReview && <NoPermission detail="Your participant role may inspect this proposal but cannot accept or reject it."/>}
    {view === "developer" && <p className={styles.rawId}>Proposal <code>{proposal.id}</code> · sources <code>{proposal.sourceAnchorIds.join(", ") || "none"}</code></p>}
  </article>;
}

function SourceCitation({ anchor, view, canReview, busy, onReview }: { anchor: SourceAnchorItem; view: MatterView; canReview: boolean; busy: boolean; onReview: (anchor: SourceAnchorItem, decision: "accepted" | "rejected") => void }) {
  return <article className={styles.sourceCitation}><div><strong>{anchor.documentTitle}</strong><span>{anchor.versionOrdinal ? "Version " + anchor.versionOrdinal + " · " : ""}{anchor.pageNumber ? "Page " + anchor.pageNumber : anchor.heading ?? anchor.section ?? "Document-level anchor"}{anchor.paragraph ? " · paragraph " + anchor.paragraph : ""}</span></div>{anchor.excerpt && <blockquote>{anchor.excerpt}</blockquote>}<span className={styles.stateToken}>Review: {sentenceLabel(anchor.reviewState)}</span>{anchor.reviewState === "pending" && canReview && <div className={styles.inlineActions}><button type="button" className={styles.primaryButton} disabled={busy} onClick={() => onReview(anchor, "accepted")}>{busy ? "Recording…" : "Accept anchor"}</button><button type="button" className={styles.dangerButton} disabled={busy} onClick={() => onReview(anchor, "rejected")}>Reject anchor</button></div>}{view === "developer" && <dl><div><dt>Anchor ID</dt><dd><code>{anchor.id}</code></dd></div><div><dt>Version ID</dt><dd><code>{anchor.documentVersionId}</code></dd></div><div><dt>Checksum</dt><dd><code>{anchor.checksum ?? "not returned"}</code></dd></div></dl>}</article>;
}

function DecisionPackagesSection({ matter, packages, snapshots, issue, view, mutationKey, onLink, onSnapshot }: { matter: MatterDetail; packages: DecisionPackageItem[]; snapshots: SnapshotItem[]; issue?: ApiIssue; view: MatterView; mutationKey: string | null; onLink: (fields: Record<string, unknown>) => void; onSnapshot: (fields: Record<string, unknown>) => void }) {
  return <div className={styles.sectionStack}>
    <SectionHeading eyebrow="DETERMINISTIC DECISIONS" title="Decision packages" description="Graphs consume snapshot-bound evidence as source material; graph edits never rewrite documents."/>
    {issue && <IssueState issue={issue} compact/>}
    <div className={styles.twoColumn}>
      <section className={styles.panel}><div className={styles.panelHeading}><h3>Linked packages</h3><span>{packages.length} exact version{packages.length === 1 ? "" : "s"}</span></div>{packages.length === 0 ? <EmptyState title="No decision package linked" detail="Link an exact existing package version or create one from a governed snapshot."/> : <div className={styles.recordList}>{packages.map((item) => <article key={item.id} className={styles.packageCard}><div className={styles.recordHeading}><div><span className={styles.stateToken}>{sentenceLabel(item.state)}</span><h4>{item.packageId}</h4><p>Version {item.packageVersion}</p></div><b>{sentenceLabel(item.graphValidationStatus)} graph</b></div><dl className={styles.factList}><div><dt>Approval</dt><dd>{sentenceLabel(item.approvalState)}</dd></div><div><dt>Source revision</dt><dd>{item.sourceRevision ?? "Not returned"}</dd></div><div><dt>Updated</dt><dd>{formatMatterDate(item.updatedAt)}</dd></div>{view === "developer" && <><div><dt>Reference ID</dt><dd><code>{item.id}</code></dd></div><div><dt>Package fingerprint</dt><dd><code>{item.packageFingerprint ?? "not returned"}</code></dd></div><div><dt>Graph digest</dt><dd><code>{item.graphDigest ?? "not returned"}</code></dd></div></>}</dl></article>)}</div>}</section>
      <aside className={styles.panel}><div className={styles.panelHeading}><h3>Package actions</h3><span>Revision {matter.revision}</span></div>{!matter.permissions.canWrite ? <NoPermission detail="Your role can inspect packages but cannot link or snapshot them."/> : <>
        <form className={styles.actionForm} onSubmit={(event) => {
          event.preventDefault();
          const form = new FormData(event.currentTarget);
          const graphProposalId = String(form.get("graphProposalId") ?? "").trim();
          const simulationReceiptIds = String(form.get("simulationReceiptIds") ?? "")
            .split(/[\s,]+/u)
            .map((value) => value.trim())
            .filter(Boolean);
          const fields: Record<string, unknown> = {
            packageId: String(form.get("packageId") ?? "").trim(),
            packageVersion: String(form.get("packageVersion") ?? "").trim(),
            packageFingerprint: String(form.get("packageFingerprint") ?? "").trim(),
            simulationReceiptIds,
          };
          if (graphProposalId) fields.graphProposalId = graphProposalId;
          onLink(fields);
        }}>
          <h4>Link an exact existing package</h4>
          <label className={styles.field}><span>Package ID</span><input name="packageId" required maxLength={200}/></label>
          <label className={styles.field}><span>Exact version</span><input name="packageVersion" required maxLength={80}/></label>
          <label className={styles.field}><span>Package fingerprint</span><input name="packageFingerprint" required spellCheck={false} maxLength={100}/></label>
          <label className={styles.field}><span>Accepted graph proposal ID (optional)</span><input name="graphProposalId" spellCheck={false} maxLength={200}/></label>
          <label className={styles.field}><span>Completed simulation receipt IDs (optional)</span><textarea name="simulationReceiptIds" rows={3} placeholder="One UUID per line or comma-separated" spellCheck={false}/></label>
          <div className={styles.consequenceBox}><strong>Exact package proof</strong><p>The server revalidates the published graph, accepted proposal diff, lineage, and every supplied v61 simulation receipt before linking this version.</p></div>
          <button className={styles.primaryButton} disabled={mutationKey !== null}>{mutationKey === "package-link" ? "Linking…" : "Link exact package"}</button>
        </form>
        <form className={styles.actionForm} onSubmit={(event) => { event.preventDefault(); const form = new FormData(event.currentTarget); onSnapshot({ locale: String(form.get("locale") ?? "en"), audience: "internal", redactionProfileId: "pilot-default" }); }}><h4>Create immutable snapshot</h4><label className={styles.field}><span>Locale</span><select name="locale" defaultValue="en"><option value="en">English</option><option value="ru">Русский</option></select></label><div className={styles.consequenceBox}><strong>Internal-only pilot boundary</strong><p>Snapshots use the fixed pilot-default profile. Client-facing exports remain unavailable until deterministic, versioned redaction is implemented.</p></div><button className={styles.secondaryButton} disabled={mutationKey !== null}>{mutationKey === "snapshot-create" ? "Freezing snapshot…" : "Create snapshot from revision " + matter.revision}</button></form>
      </>}</aside>
    </div>
    <section className={styles.panel}><div className={styles.panelHeading}><h3>Snapshot register</h3><span>{snapshots.length} immutable manifest{snapshots.length === 1 ? "" : "s"}</span></div>{snapshots.length === 0 ? <EmptyState title="No snapshot exists" detail="Governed outputs require an exact immutable dossier snapshot."/> : <div className={styles.snapshotGrid}>{snapshots.map((snapshot) => <article key={snapshot.id}><strong>Revision {snapshot.dossierRevision ?? "?"} · {statusLabel(snapshot.status)}</strong><span>{sentenceLabel(snapshot.audience)} · {snapshot.locale} · {sentenceLabel(snapshot.classification)}</span><span>Created {formatMatterDate(snapshot.createdAt)}</span>{view === "developer" && <><code>{snapshot.id}</code><code>{snapshot.manifestDigest ?? "manifest digest not returned"}</code></>}</article>)}</div>}</section>
  </div>;
}

function RequestsSection({ matter, documents, requests, deadlines, issue, view, mutationKey, onCreate, onSatisfy }: { matter: MatterDetail; documents: DocumentItem[]; requests: RequestItem[]; deadlines: DeadlineItem[]; issue?: ApiIssue; view: MatterView; mutationKey: string | null; onCreate: (fields: Record<string, unknown>) => void; onSatisfy: (fields: Record<string, unknown>) => void }) {
  return <div className={styles.sectionStack}>
    <SectionHeading eyebrow="MISSING INFORMATION" title="Requests & deadlines" description="Every request names the gap, responsible professional, due time, and readiness consequence."/>
    {issue && <IssueState issue={issue} compact/>}
    <div className={styles.twoColumn}>
      <section className={styles.panel}><div className={styles.panelHeading}><h3>Information requests</h3><span>{requests.filter((item) => item.status === "open").length} open</span></div>{requests.length === 0 ? <EmptyState title="No information requests" detail="No missing-information workflow has been recorded."/> : <div className={styles.requestList}>{requests.map((request) => { const overdue = isOverdue(request.dueAt, request.status); return <article key={request.id} className={styles.requestCard}><div className={styles.recordHeading}><span className={styles.stateToken}>{overdue ? "OVERDUE · OPEN" : sentenceLabel(request.status)}</span><b>{sentenceLabel(request.priority)} priority</b></div><h4>{request.question}</h4><p>{request.reason}</p><dl><div><dt>Responsible</dt><dd>{request.requestedFrom ?? request.ownerActorId ?? "Owner not returned"}</dd></div><div><dt>Due</dt><dd>{formatMatterDate(request.dueAt, "en-GB", request.timezone)}{request.timezone ? " · " + request.timezone : ""}</dd></div><div><dt>Readiness rule</dt><dd>{request.readinessReasonCode ?? "Not returned"}</dd></div>{view === "developer" && <div><dt>Request ID</dt><dd><code>{request.id}</code></dd></div>}</dl></article>; })}</div>}</section>
      <aside className={styles.panel}><div className={styles.panelHeading}><h3>Request missing information</h3><span>Revision {matter.revision}</span></div>{!matter.permissions.canWrite ? <NoPermission detail="Your role may inspect requests but cannot create one."/> : <form className={styles.actionForm} onSubmit={(event) => { event.preventDefault(); const form = new FormData(event.currentTarget); onCreate({ question: String(form.get("question") ?? "").trim(), reason: String(form.get("reason") ?? "").trim(), priority: String(form.get("priority") ?? "normal"), dueAt: String(form.get("dueAt") ?? "") || null, timezone: String(form.get("timezone") ?? "Europe/Paris"), readinessReasonCode: "INFORMATION_REQUEST_OPEN" }); }}><label className={styles.field}><span>Requested item or question</span><textarea name="question" required maxLength={1_000}/></label><label className={styles.field}><span>Why it is needed</span><textarea name="reason" required maxLength={1_000}/></label><label className={styles.field}><span>Priority</span><select name="priority" defaultValue="normal"><option value="low">Low</option><option value="normal">Normal</option><option value="high">High</option><option value="urgent">Urgent</option></select></label><label className={styles.field}><span>Due date and time</span><input type="datetime-local" name="dueAt"/></label><label className={styles.field}><span>Timezone</span><input name="timezone" defaultValue="Europe/Paris" maxLength={80}/></label><button className={styles.primaryButton} disabled={mutationKey !== null}>{mutationKey === "request-create" ? "Recording request…" : "Create information request"}</button></form>}</aside>
    </div>
    <section className={styles.panel} aria-labelledby="request-satisfaction-title">
      <div className={styles.panelHeading}><h3 id="request-satisfaction-title">Satisfy a request with a Matter source</h3><span>Exact logical document link</span></div>
      {!matter.permissions.canWrite ? <NoPermission detail="Your role cannot change an information-request status."/> : requests.every((item) => item.status !== "open") || documents.length === 0 ? <EmptyState title="An open request and document are required" detail="Upload the satisfying source and keep the request open until the exact link can be recorded."/> : <form className={styles.actionForm} onSubmit={(event) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        onSatisfy({
          requestId: String(form.get("requestId") ?? ""),
          satisfyingDocumentId: String(form.get("satisfyingDocumentId") ?? ""),
        });
      }}>
        <label className={styles.field}><span>Open information request</span><select name="requestId" required>{requests.filter((item) => item.status === "open").map((item) => <option key={item.id} value={item.id}>{item.question}</option>)}</select></label>
        <label className={styles.field}><span>Satisfying logical document</span><select name="satisfyingDocumentId" required>{documents.map((document) => <option key={document.id} value={document.id}>{document.title}</option>)}</select></label>
        <div className={styles.consequenceBox}><strong>Request receipt</strong><p>The link records which governed Matter document satisfied the request; it does not copy document text into activity or list responses.</p></div>
        <button className={styles.primaryButton} disabled={mutationKey !== null}>{mutationKey === "request-satisfy" ? "Recording source link…" : "Mark request received with source"}</button>
      </form>}
    </section>
    <section className={styles.panel}><div className={styles.panelHeading}><h3>Deadline register</h3><span>{deadlines.length} real or projected date{deadlines.length === 1 ? "" : "s"}</span></div>{deadlines.length === 0 ? <EmptyState title="No deadline references returned" detail="Workspace deadlines and projected simulation deadlines remain distinct."/> : <div className={styles.deadlineGrid}>{deadlines.map((deadline) => <article key={deadline.id}><span className={styles.stateToken}>{deadline.critical ? "CRITICAL · " : ""}{sentenceLabel(deadline.status)}</span><h4>{deadline.title}</h4><p>{formatMatterDate(deadline.dueAt, "en-GB", deadline.timezone)} · {sentenceLabel(deadline.kind)}</p>{view === "developer" && <code>{deadline.id}</code>}</article>)}</div>}</section>
  </div>;
}

function OutputsSection({ matter, outputs, snapshots, issue, view, mutationKey, onGenerate, onApprove }: { matter: MatterDetail; outputs: OutputItem[]; snapshots: SnapshotItem[]; issue?: ApiIssue; view: MatterView; mutationKey: string | null; onGenerate: (fields: Record<string, unknown>) => void; onApprove: (output: OutputItem) => void }) {
  const currentSnapshots = snapshots.slice().sort((left, right) => (right.dossierRevision ?? 0) - (left.dossierRevision ?? 0));
  return <div className={styles.sectionStack}>
    <SectionHeading eyebrow="GOVERNED DELIVERABLES" title="Outputs & approvals" description="Every output is bound to one immutable snapshot; later authoritative changes make that relationship visibly stale."/>
    {issue && <IssueState issue={issue} compact/>}
    <div className={styles.twoColumn}>
          <section className={styles.panel}><div className={styles.panelHeading}><h3>Output register</h3><span>{outputs.filter((output) => output.state === "current").length} current</span></div>{outputs.length === 0 ? <EmptyState title="No governed outputs" detail="Create a snapshot before requesting a report or manifest."/> : <div className={styles.outputList}>{outputs.map((output) => <article key={output.id} className={styles.outputCard}><div className={styles.recordHeading}><div><span className={styles.stateToken}>{sentenceLabel(output.state)}</span><h4>{output.filename}</h4><p>{output.format.toUpperCase()} · created {formatMatterDate(output.createdAt)}</p></div><b>{output.approvedAt ? "APPROVED" : "AWAITING APPROVAL"}</b></div>{output.staleReason && <p className={styles.blockingText}>Stale because: {output.staleReason}</p>}<dl><div><dt>Snapshot</dt><dd>{output.snapshotId}</dd></div><div><dt>Reviewer</dt><dd>{output.reviewerActorId ?? "Not assigned"}</dd></div><div><dt>Approved</dt><dd>{formatMatterDate(output.approvedAt)}</dd></div>{view === "developer" && <><div><dt>Output ID</dt><dd><code>{output.id}</code></dd></div><div><dt>Snapshot digest</dt><dd><code>{output.snapshotDigest ?? "not returned"}</code></dd></div><div><dt>Content SHA-256</dt><dd><code>{output.contentSha256 ?? "not returned"}</code></dd></div></>}</dl><div className={styles.inlineActions}>{output.downloadUrl ? <a className={styles.secondaryButton} href={organizationScopedUrl(output.downloadUrl)} aria-label={"Securely download " + output.filename}>Secure download</a> : <span className={styles.unavailableAction}>No secure download capability returned.</span>}{!output.approvedAt && matter.permissions.canApprove && <button type="button" className={styles.primaryButton} disabled={mutationKey !== null || output.state !== "current"} onClick={() => onApprove(output)}>{mutationKey === "output-approve-" + output.id ? "Approving…" : "Approve current output"}</button>}</div></article>)}</div>}</section>
      <aside className={styles.panel}><div className={styles.panelHeading}><h3>Generate from snapshot</h3><span>Never from mutable state</span></div>{!matter.permissions.canGenerateOutput ? <NoPermission detail="Your role cannot generate governed outputs."/> : snapshots.length === 0 ? <EmptyState title="Snapshot required" detail="Create an immutable snapshot in Decision packages first."/> : <form className={styles.actionForm} onSubmit={(event) => { event.preventDefault(); const form = new FormData(event.currentTarget); onGenerate({ action: "generate", snapshotId: String(form.get("snapshotId") ?? ""), format: String(form.get("format") ?? "pdf") }); }}><label className={styles.field}><span>Immutable snapshot</span><select name="snapshotId" required>{currentSnapshots.map((snapshot) => <option key={snapshot.id} value={snapshot.id}>Revision {snapshot.dossierRevision ?? "?"} · {formatMatterDate(snapshot.createdAt)}</option>)}</select></label><label className={styles.field}><span>Output format</span><select name="format" defaultValue="pdf"><option value="pdf">PDF report</option><option value="json_manifest">JSON manifest</option><option value="markdown">Markdown</option></select></label><div className={styles.consequenceBox}><strong>Generation contract</strong><p>The output must retain the exact snapshot digest, source versions, graph receipts, build version, classification, and reviewer state.</p></div><button className={styles.primaryButton} disabled={mutationKey !== null}>{mutationKey === "output-generate" ? "Requesting output…" : "Generate governed output"}</button></form>}</aside>
    </div>
  </div>;
}

function ActivitySection({ activity, cursor, issue, view, mutationKey, onLoadMore }: { activity: ActivityItem[]; cursor: string | null; issue?: ApiIssue; view: MatterView; mutationKey: string | null; onLoadMore: () => void }) {
  return <div className={styles.sectionStack}>
    <SectionHeading eyebrow="ATTRIBUTABLE HISTORY" title="Activity" description="A readable, append-only view of governed events. Full document text and secrets never belong here."/>
    {issue && <IssueState issue={issue} compact/>}
    {activity.length === 0 && !issue ? <EmptyState title="No activity returned" detail="The server has not returned an attributable audit event for this matter."/> : <ol className={styles.timeline}>{activity.map((event) => <li key={event.id}><div className={styles.timelineMarker} aria-hidden="true">{event.sequence ?? "·"}</div><article><div className={styles.recordHeading}><div><span className={styles.stateToken}>{sentenceLabel(event.eventType)}</span><h3>{sentenceLabel(event.summaryCode)}</h3></div><time dateTime={event.occurredAt ?? undefined}>{formatMatterDate(event.occurredAt)}</time></div><p>Actor: {event.actorRole ? sentenceLabel(event.actorRole) : "Role not returned"}{event.actorId ? " · " + event.actorId : ""}</p>{view === "developer" && <dl className={styles.factList}><div><dt>Event ID</dt><dd><code>{event.id}</code></dd></div><div><dt>Object</dt><dd><code>{event.objectType ?? "?"} / {event.objectId ?? "?"}</code></dd></div><div><dt>Digest</dt><dd><code>{event.eventDigest ?? "not returned"}</code></dd></div>{event.detail && <div><dt>Bounded detail</dt><dd><pre>{event.detail}</pre></dd></div>}</dl>}</article></li>)}</ol>}
    {activity.length >= MAX_ACTIVITY_ITEMS ? <p className={styles.paginationNote}>Client activity is bounded to 500 events. Use a refined server query for older history.</p> : cursor && <button type="button" className={styles.secondaryButton} onClick={onLoadMore} disabled={mutationKey !== null}>{mutationKey === "activity-more" ? "Loading history…" : "Load older activity"}</button>}
  </div>;
}

function SectionHeading({ eyebrow, title, description }: { eyebrow: string; title: string; description: string }) {
  return <header className={styles.sectionHeading}><p className={styles.eyebrow}>{eyebrow}</p><div><h2>{title}</h2><p>{description}</p></div></header>;
}

function IssueState({ issue, onRetry, compact = false }: { issue: ApiIssue; onRetry?: () => void; compact?: boolean }) {
  return <section className={compact ? styles.issueCompact : styles.issueState} role={issue.kind === "error" || issue.kind === "stale" ? "alert" : "status"} data-state={issue.kind}>
    <span className={styles.issueLabel}>{issue.kind === "permission" ? "ACCESS STATE" : issue.kind === "stale" ? "STALE REVISION" : issue.kind === "unsupported" ? "PILOT LIMIT" : "REQUEST ERROR"}</span><h2>{issue.title}</h2><p>{issue.message}</p>{issue.detail && <details><summary>Technical detail</summary><p>{issue.detail}</p></details>}{onRetry && <button type="button" className={styles.secondaryButton} onClick={onRetry}>{issue.kind === "stale" ? "Reload current revision" : "Try again"}</button>}{issue.kind === "permission" && <Link className={styles.secondaryButton} href="/account">Open account access</Link>}
  </section>;
}

function LoadingState({ label, compact = false }: { label: string; compact?: boolean }) {
  return <div className={compact ? styles.loadingCompact : styles.loadingState} role="status" aria-live="polite"><span className={styles.loadingMark} aria-hidden="true"/><div><strong>{label}</strong><span>Private metadata only; document bodies are not preloaded.</span></div></div>;
}

function EmptyWorkspace({ onCreate }: { onCreate: () => void }) {
  return <section className={styles.emptyWorkspace}><p className={styles.eyebrow}>DECISION-CENTRIC DOSSIERS</p><h1>Start with one governed professional matter.</h1><p>Bring together source versions, evidence, requests, decision packages, and snapshot-bound outputs without replacing your system of record.</p><button className={styles.primaryButton} type="button" onClick={onCreate}>Create a pilot matter</button><small>Synthetic or de-identified material only during this pilot boundary.</small></section>;
}

function EmptyState({ title, detail }: { title: string; detail: string }) {
  return <div className={styles.emptyState}><strong>{title}</strong><span>{detail}</span></div>;
}

function NoPermission({ detail }: { detail: string }) {
  return <div className={styles.noPermission}><strong>Read-only for this action</strong><span>{detail}</span></div>;
}

function sourceCitationLabel(anchor: SourceAnchorItem | undefined, fallbackId: string): string {
  if (!anchor) return "Source anchor " + fallbackId;
  const location = anchor.pageNumber ? "page " + anchor.pageNumber : anchor.heading ?? anchor.section ?? "document anchor";
  return anchor.documentTitle + ", " + location;
}
