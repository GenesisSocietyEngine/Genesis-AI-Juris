"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { readWithTimeout, ReadTimeoutError } from "./read-with-timeout";
import { createOperationsDiagnostic } from "./operations-diagnostic";

type DashboardState = "current" | "no_data" | "partial" | "stale";

interface Aggregate {
  replayInternalFailures: number;
  expectedRevisionMismatches: number;
  expectedFingerprintMismatches: number;
  internalRevisionMismatches: number;
  internalFingerprintMismatches: number;
  historicalMisses: number;
  internalHistoricalMisses: number;
}

interface ActiveAlert {
  id: string;
  severity: "diagnostic" | "warning" | "critical";
  window: "5m" | "10m" | "15m";
  count: number;
  ratio: number | null;
  label: string;
  threshold: string;
  owner: string;
  action: string;
  rollbackCriterion: string;
  source: "platform_logs" | "product_d1" | "split" | "not_collected";
  evaluation: "active_in_admin_dashboard"
    | "manual_platform_configuration_required"
    | "dashboard_with_platform_fallback"
    | "dashboard_absolute_rate_not_collected"
    | "not_collected";
  externalNotification: "unavailable";
}

interface RequestHealth {
  source: "worker_platform_logs";
  state: "external_unavailable";
  exactQueryAvailable: false;
  externalNotification: "unavailable";
  productD1Persistence: false;
  manualConfiguration: readonly string[];
}

interface ProductHealth {
  source: "product_d1";
  state: "exact_anomalies_only";
  externalNotification: "unavailable";
  d1BackedSignalScope: readonly string[];
  platformLogOnlySignalScope: readonly string[];
  d1FailureHealth: {
    source: "worker_platform_logs";
    state: "external_unavailable";
    externalNotification: "unavailable";
    productD1Persistence: false;
    coverage: "instrumented_operations_only";
    platformWideCoverage: false;
    instrumentedRoutes: readonly string[];
    instrumentedLogicalRepositories: readonly string[];
    manualConfiguration: readonly string[];
  };
  unrecordedSuccessScope: readonly string[];
  successMetrics: "not_collected";
}

interface DashboardPayload {
  schema: string;
  policyRevision: number;
  generatedAt: string;
  overviewWindowMinutes: number;
  retentionDays: number;
  staleAfterMinutes: number;
  state: DashboardState;
  fromInclusive: string;
  toExclusive: string;
  aggregate: Aggregate;
  requestHealth: RequestHealth;
  productHealth: ProductHealth;
  latestEvent: { eventName: string; route: string; outcome: string; occurredAt: string } | null;
  release: {
    deploymentVersion: string;
    webCommit: string;
    bundleRevision: number;
    runtimeRevision: string;
    playedCaseSchemaRevision: number;
  } | null;
  alerts: ActiveAlert[];
}

class OperationsAccessError extends Error {}

function timestamp(value: string | null) {
  if (!value) return "No anomaly event received";
  const date = new Date(value);
  return Number.isFinite(date.valueOf()) ? date.toLocaleString() : "Invalid timestamp";
}

function Metric({ label, value, detail }: { label: string; value: string | number; detail?: string }) {
  return <div className="operations-metric"><dt>{label}</dt><dd>{value}</dd>{detail && <small>{detail}</small>}</div>;
}

export default function OperationsDashboard({ locale }: { locale: "en" | "ru" }) {
  const [payload, setPayload] = useState<DashboardPayload | null>(null);
  const [phase, setPhase] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [receivedAt, setReceivedAt] = useState("");
  const [downloadError, setDownloadError] = useState(false);
  const requestRef = useRef<AbortController | null>(null);
  const copy = locale === "ru" ? {
    eyebrow: "ЭКСПЛУАТАЦИОННАЯ ТЕЛЕМЕТРИЯ · ТОЛЬКО ДЛЯ АДМИНИСТРАТОРА",
    title: "Состояние платформы",
    refresh: "Обновить",
    loading: "Загрузка агрегированной телеметрии…",
    unavailable: "Эксплуатационная телеметрия временно недоступна.",
    noData: "В этом окне нет сохранённых событий аномалий. Это не показатель общего здоровья запросов; проверьте поток журналов платформы.",
    stale: "Последнее сохранённое событие аномалии старше допустимого интервала свежести.",
    partial: "Данные аномалий неполны или идентификатор релиза неоднозначен.",
    healthy: "Ни один порог аномалий из D1 не активен.",
    externalUnavailable: "Внешнее уведомление недоступно",
    accessRequired: "Войдите в аккаунт администратора, чтобы открыть диагностику.",
    timeout: "Ответ не получен за 15 секунд. Повторите обновление.",
  } : {
    eyebrow: "OPERATIONAL TELEMETRY · ADMIN ONLY",
    title: "Platform health",
    refresh: "Refresh",
    loading: "Loading aggregated telemetry…",
    unavailable: "Operational telemetry is temporarily unavailable.",
    noData: "No persisted anomaly event exists in this window. This is not a request-health reading; inspect the platform log stream.",
    stale: "The latest persisted anomaly event is older than the freshness allowance.",
    partial: "Anomaly data is incomplete or the release identity is ambiguous.",
    healthy: "No D1-backed anomaly threshold is active.",
    externalUnavailable: "External notification unavailable",
    accessRequired: "Sign in with an administrator account to open diagnostics.",
    timeout: "No response within 15 seconds. Try refreshing again.",
  };

  const load = useCallback(async () => {
    requestRef.current?.abort();
    const controller = new AbortController();
    requestRef.current = controller;
    setRefreshing(true);
    setError("");
    try {
      const result = await readWithTimeout(async signal => {
        const response = await fetch("/api/admin/operations", {
          cache: "no-store",
          credentials: "same-origin",
          headers: { Accept: "application/json" },
          signal,
        });
        if (response.status === 401 || response.status === 403) throw new OperationsAccessError();
        const value = await response.json().catch(() => null) as DashboardPayload | null;
        if (!response.ok || !value || !["current", "no_data", "partial", "stale"].includes(value.state) || !value.aggregate || !value.requestHealth || !value.productHealth?.d1FailureHealth || !Array.isArray(value.alerts)) throw new Error();
        return value;
      }, { signal: controller.signal, timeoutMs: 15000 });
      if (controller.signal.aborted) return;
      setPayload(result);
      setReceivedAt(new Date().toISOString());
      setDownloadError(false);
      setPhase("ready");
    } catch (caught) {
      if (controller.signal.aborted) return;
      if (caught instanceof OperationsAccessError) { setPayload(null); setAutoRefresh(false); }
      setError(caught instanceof OperationsAccessError ? copy.accessRequired : caught instanceof ReadTimeoutError ? copy.timeout : copy.unavailable);
      setPhase("error");
    } finally {
      if (!controller.signal.aborted) setRefreshing(false);
      if (requestRef.current === controller) requestRef.current = null;
    }
  }, [copy.unavailable, copy.accessRequired, copy.timeout]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => {
      window.clearTimeout(timer);
      requestRef.current?.abort();
    };
  }, [load]);

  useEffect(() => {
    if (!autoRefresh) return;
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible" && !requestRef.current) void load();
    }, 60000);
    return () => window.clearInterval(timer);
  }, [autoRefresh, load]);

  function downloadDiagnostic() {
    if (!payload) return;
    try {
      const body = JSON.stringify(createOperationsDiagnostic(payload, receivedAt, Boolean(error)), null, 2);
      const url = URL.createObjectURL(new Blob([body], { type: "application/json" }));
      const link = document.createElement("a");
      link.href = url;
      link.download = "casevant-operations-diagnostic.json";
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      setDownloadError(false);
    } catch { setDownloadError(true); }
  }

  if (phase === "loading") {
    return <section className="operations-dashboard operations-dashboard-loading" aria-live="polite"><p>{copy.loading}</p></section>;
  }
  if (!payload) {
    return <section className="operations-dashboard operations-dashboard-error" role="alert"><p>{error || copy.unavailable}</p><button type="button" onClick={() => void load()} disabled={refreshing}>{copy.refresh}</button></section>;
  }

  const aggregate = payload.aggregate;
  const stateMessage = payload.state === "no_data" ? copy.noData : payload.state === "stale" ? copy.stale : payload.state === "partial" ? copy.partial : "";
  return <section className={`operations-dashboard state-${payload.state}`} aria-labelledby="operations-dashboard-title">
    <header className="operations-dashboard-header">
      <div><span>{copy.eyebrow}</span><h2 id="operations-dashboard-title">{copy.title}</h2><p>{payload.overviewWindowMinutes}-minute anomaly overview · policy v{payload.policyRevision} · {payload.retentionDays}-day retention</p></div>
      <div className="operations-dashboard-status"><b>{payload.state.replace("_", " ")}</b><button type="button" onClick={() => void load()} disabled={refreshing}>{refreshing ? "…" : copy.refresh}</button></div>
    </header>

    <section className="operations-diagnostic-tools" aria-labelledby="operations-diagnostic-title">
      <div><h3 id="operations-diagnostic-title">{locale === "en" ? "Diagnostic snapshot" : "Диагностический снимок"}</h3>
        <p>{locale === "en" ? "Last successful read" : "Последнее успешное чтение"}: <time dateTime={receivedAt}>{timestamp(receivedAt)}</time></p>
        <p>{locale === "en" ? "This view covers retained anomalies. Automatic incident notifications are not connected; an administrator must inspect the dashboard and platform logs." : "Здесь показаны сохранённые аномалии. Автоматические уведомления об инцидентах не подключены: администратор должен проверять панель и журналы платформы."}</p>
      </div>
      <div className="operations-diagnostic-actions">
        <label><input type="checkbox" checked={autoRefresh} onChange={event => setAutoRefresh(event.target.checked)}/><span>{locale === "en" ? "Refresh every minute while this page is visible" : "Обновлять каждую минуту, пока страница видна"}</span></label>
        <button type="button" className="secondary-cta" onClick={downloadDiagnostic} disabled={refreshing}>{locale === "en" ? "Download diagnostic summary" : "Скачать сводку диагностики"}</button>
        <small>{locale === "en" ? "Release details and anomaly counts only. No case content or account identifiers." : "Только сведения о релизе и счётчики аномалий. Без содержимого кейсов и идентификаторов аккаунтов."}</small>
      </div>
    </section>
    {error && <div className="operations-refresh-error" role="alert"><b>{locale === "en" ? "Refresh failed — showing the previous snapshot" : "Обновление не удалось — показан предыдущий снимок"}</b><p>{error}</p><button type="button" className="secondary-cta" disabled={refreshing} onClick={() => void load()}>{locale === "en" ? "Try again" : "Повторить"}</button></div>}
    {downloadError && <p role="alert">{locale === "en" ? "The diagnostic file could not be downloaded. Try again." : "Не удалось скачать файл диагностики. Повторите попытку."}</p>}

    {stateMessage && <p className="operations-state-message" role="status">{stateMessage}</p>}

    <section className="operations-release operations-request-health" aria-labelledby="request-health-title">
      <div className="operations-section-heading"><div><span>PLATFORM LOG STREAM</span><h3 id="request-health-title">Worker request health</h3></div><b>{copy.externalUnavailable}</b></div>
      <p>Request outcomes, latency, normalized route class, response class, deployment identity, and exceptions are emitted only to capacity-isolated Worker logs. They never create a product-D1 telemetry write.</p>
      <p>This Site runtime has no connected log-query or alert-provisioning surface, so this panel does not fabricate request totals, rates, latency, 4xx classifications, 5xx counts, or exception counts from missing D1 rows.</p>
      <dl>
        <div><dt>Source</dt><dd><code>{payload.requestHealth.source}</code></dd></div>
        <div><dt>Product D1 persistence</dt><dd>{payload.requestHealth.productD1Persistence ? "Enabled" : "Disabled"}</dd></div>
        <div><dt>Exact query connected</dt><dd>{payload.requestHealth.exactQueryAvailable ? "Yes" : "No"}</dd></div>
        <div><dt>External notification</dt><dd>{payload.requestHealth.externalNotification}</dd></div>
      </dl>
      <details><summary>Manual platform configuration required</summary><ol>{payload.requestHealth.manualConfiguration.map((instruction) => <li key={instruction}>{instruction}</li>)}</ol></details>
    </section>

    <section className="operations-alerts" aria-labelledby="operations-alerts-title">
      <div className="operations-section-heading"><div><span>D1-BACKED ALERTS</span><h3 id="operations-alerts-title">Exact persisted-anomaly thresholds</h3></div><b>{payload.alerts.length.toString().padStart(2, "0")}</b></div>
      {payload.alerts.length === 0 ? <p className="operations-alert-clear">{copy.healthy}</p> : <div className="operations-alert-list">{payload.alerts.map((alert) => <article className={`severity-${alert.severity}`} key={alert.id}>
        <header><strong>{alert.label}</strong><span>{alert.severity} · {alert.window}</span></header>
        <p>{alert.threshold}. Observed {alert.count}{alert.ratio === null ? "" : ` · ${(alert.ratio * 100).toFixed(1)}%`}.</p>
        <dl><div><dt>Owner</dt><dd>{alert.owner}</dd></div><div><dt>Action</dt><dd>{alert.action}</dd></div><div><dt>Rollback</dt><dd>{alert.rollbackCriterion}</dd></div><div><dt>External notification</dt><dd>{alert.externalNotification}</dd></div></dl>
      </article>)}</div>}
    </section>

    <div className="operations-metric-groups">
      <section><header><span>PLATFORM LOG STREAM</span><h3>Instrumented D1 operation failures</h3><p>Busy, timeout, and internal-failure signals open the telemetry circuit and are never written back to product D1. v53 covers only the listed instrumented operations; it is not platform-wide and does not cover auth, users, or all D1 operations. No count is fabricated here.</p></header><dl>
        <Metric label="Source" value={payload.productHealth.d1FailureHealth.source}/>
        <Metric label="Coverage" value={payload.productHealth.d1FailureHealth.coverage.replaceAll("_", " ")}/>
        <Metric label="Instrumented routes" value={payload.productHealth.d1FailureHealth.instrumentedRoutes.join(", ")}/>
        <Metric label="Logical repositories" value={payload.productHealth.d1FailureHealth.instrumentedLogicalRepositories.join(", ")}/>
        <Metric label="Platform-wide coverage" value={payload.productHealth.d1FailureHealth.platformWideCoverage ? "Yes" : "No"}/>
        <Metric label="Product D1 persistence" value="Disabled"/>
        <Metric label="Dashboard count" value="Unavailable"/>
        <Metric label="External notification" value={payload.productHealth.d1FailureHealth.externalNotification}/>
      </dl><details><summary>Manual D1 failure-log configuration</summary><ol>{payload.productHealth.d1FailureHealth.manualConfiguration.map((instruction) => <li key={instruction}>{instruction}</li>)}</ol></details></section>
      <section><header><span>REPLAY & INTEGRITY</span><h3>Exact retained anomalies</h3><p>Absolute anomaly thresholds are evaluated from D1. Attempt-rate and success-latency metrics are intentionally not collected.</p></header><dl>
        <Metric label="Replay internal failures" value={aggregate.replayInternalFailures}/>
        <Metric label="Expected revision / fingerprint" value={`${aggregate.expectedRevisionMismatches} / ${aggregate.expectedFingerprintMismatches}`}/>
        <Metric label="Internal revision / fingerprint" value={`${aggregate.internalRevisionMismatches} / ${aggregate.internalFingerprintMismatches}`}/>
        <Metric label="Historical lookup misses" value={aggregate.historicalMisses} detail={`${aggregate.internalHistoricalMisses} internal`}/>
      </dl></section>
    </div>

    <section className="operations-release" aria-labelledby="operations-release-title">
      <div className="operations-section-heading"><div><span>ANOMALY RELEASE IDENTITY</span><h3 id="operations-release-title">Latest persisted signal</h3></div><b>{payload.release?.deploymentVersion ?? "—"}</b></div>
      <dl><div><dt>Web commit</dt><dd><code>{payload.release?.webCommit ?? "unavailable"}</code></dd></div><div><dt>Bundle</dt><dd>{payload.release?.bundleRevision ?? "—"}</dd></div><div><dt>Runtime</dt><dd>{payload.release?.runtimeRevision ?? "—"}</dd></div><div><dt>Played-case schema</dt><dd>{payload.release?.playedCaseSchemaRevision ?? "—"}</dd></div><div><dt>Latest anomaly</dt><dd>{timestamp(payload.latestEvent?.occurredAt ?? null)}</dd></div><div><dt>Event class</dt><dd>{payload.latestEvent ? `${payload.latestEvent.eventName} · ${payload.latestEvent.route} · ${payload.latestEvent.outcome}` : "No anomaly event received"}</dd></div></dl>
      <p>Generated {timestamp(payload.generatedAt)} · stale after {payload.staleAfterMinutes} minutes · schema <code>{payload.schema}</code></p>
    </section>
  </section>;
}
