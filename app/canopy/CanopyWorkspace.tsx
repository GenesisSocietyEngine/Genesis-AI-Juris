"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { buildCanopyPackage, type CanopyScenarioId } from "../canopy-fixture";
import { CanopyWorkingCopy, type CanopyPublicationStatus, type CanopyTransport, type Session } from "../canopy-workflow";
import { actionUseKey, decisionAvailability } from "../game-engine";
import { organizationScopedUrl, scopedOrganizationHeaders } from "../organization-client";
import { workspaceDestination } from "../workspace-navigation";
import { useInterfaceLocale, useWorkspaceLocation } from "../use-interface-locale";
import { canopyRunStatus, canopyWorkingCopyPath } from "./canopy-client-state";
import { canopyScenarioCopy, canopyStateLabel } from "./canopy-ui-copy";
import type { LocalText } from "../types";
import styles from "./canopy.module.css";

const api: CanopyTransport = (path, init = {}) => fetch(path, {
  ...init, credentials: "same-origin", cache: "no-store",
  headers: { ...scopedOrganizationHeaders(), ...init.headers },
});
type Proposal = { proposal_id: string; proposal_type: string; review_state: string; proposed_value: { statement?: string } };
type Output = { output_id: string; format: string; state: string; reviewer_actor_id: string | null; download_url: string };
type Detail = { status: string; revision: number; readiness: unknown; current_role: string; permissions: { can_write: boolean; can_review: boolean; can_generate_output: boolean } };

export default function CanopyWorkspace({ dossierId, initialScenario }: { dossierId: string; initialScenario: CanopyScenarioId }) {
  const location = useWorkspaceLocation();
  const [locale] = useInterfaceLocale();
  const t = (en: string, ru: string) => locale === "ru" ? ru : en;
  const local = (value: string | LocalText) => typeof value === "string" ? value : value[locale];
  const [copy, setCopy] = useState<CanopyWorkingCopy | null>(null);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [scenarioId, setScenarioId] = useState(initialScenario);
  const [session, setSession] = useState<Session | null>(null);
  const [publication, setPublication] = useState<CanopyPublicationStatus | null>(null);
  const [publicationIssue, setPublicationIssue] = useState(false);
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [outputs, setOutputs] = useState<Output[]>([]);
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const running = useRef(false);
  const refreshGeneration = useRef({ value: 0 });
  const prepared = useMemo(() => copy?.package(scenarioId) ?? buildCanopyPackage(scenarioId), [copy, scenarioId]);
  const matterPath = workspaceDestination("/matters?dossier=" + encodeURIComponent(dossierId), location);

  const refresh = useCallback(async () => {
    const generation = ++refreshGeneration.current.value;
    setPublication(null); setPublicationIssue(false);
    const restored = await CanopyWorkingCopy.resume(api, dossierId);
    const [overview, pending, generated, published] = await Promise.all([
      restored.get(), restored.get("proposals"), restored.get("outputs"),
      restored.publicationStatus().then(value => ({ value, failed: false }), () => ({ value: null, failed: true })),
    ]);
    if (generation !== refreshGeneration.current.value) return;
    setCopy(restored); setScenarioId(restored.currentScenario);
    setDetail(overview.dossier as Detail); setProposals(pending.proposals as Proposal[]);
    setOutputs(generated.outputs as Output[]); setPublication(published.value); setPublicationIssue(published.failed);
    setSession(null);
    const url = new URL(window.location.href);
    const requestedRun = url.searchParams.get("dossier") === dossierId ? url.searchParams.get("run") : null;
    const run = requestedRun ?? restored.lastSessionKey;
    if (!run) return;
    const response = await api("/api/play-sessions?sessionKey=" + encodeURIComponent(run));
    if (!response.ok) throw new Error("Recorded session could not be read: " + response.status);
    const stored = ((await response.json()) as { session: Session }).session;
    if (generation !== refreshGeneration.current.value) return;
    if (canopyRunStatus(stored, restored.package()) === "mismatch") {
      if (requestedRun) throw new Error("Recorded session does not match this copy's current scenario. Inspect the session in My cases.");
      // The retained prior run remains evidence after a source update; it is not
      // the current scenario's active run and must not block a fresh review.
      return;
    }
    setSession(stored);
  }, [dossierId]);

  useEffect(() => {
    let cancelled = false;
    const generationCounter = refreshGeneration.current;
    void Promise.resolve().then(refresh).catch(cause => { if (!cancelled) setError(String(cause)); });
    return () => { cancelled = true; generationCounter.value++; };
  }, [refresh]);

  async function act(fn: () => Promise<unknown>) {
    if (running.current) return;
    running.current = true; setBusy(true); setError("");
    try { await fn(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : String(cause)); }
    finally { running.current = false; setBusy(false); }
  }
  function remember(id: CanopyScenarioId, run?: string) {
    const path = canopyWorkingCopyPath(window.location.pathname + window.location.search, dossierId, id, run);
    window.history.replaceState(window.history.state, "", path);
    window.dispatchEvent(new Event("genesis-interface-change"));
  }

  if (!copy || !detail) return <section aria-busy={!error || busy}>
    <p role={error ? "alert" : "status"}>{error ? t("The copy could not be reopened. Retry or inspect it in My cases.", "Не удалось открыть копию. Повторите запрос или проверьте её в «Моих делах».") : t("Loading the private working copy…", "Загрузка приватной рабочей копии…")}</p>
    {error && <><div className={styles.tabs}><button disabled={busy} onClick={() => void act(refresh)}>{t("Retry opening", "Повторить открытие")}</button><Link href={matterPath}>{t("Open My cases", "Открыть мои дела")}</Link></div><details><summary>{t("Verification details", "Технические сведения")}</summary><pre>{error}</pre></details></>}
  </section>;

  const working = copy;
  const canWrite = detail.permissions?.can_write === true;
  const canReview = detail.permissions?.can_review === true;
  const runStatus = canopyRunStatus(session, prepared);
  const stage = session ? prepared.scenario.stages.find(item => item.id === session.state.currentStageId) : undefined;
  const actual = runStatus === "completed";
  const sourcesReady = prepared.declaration.controls.every(ref => working.sources[ref.document + "@" + ref.version]?.reviewed);
  const proposalsReady = working.reviewedScenarios.has(scenarioId) && !proposals.some(item => item.review_state === "pending");
  const next = working.independent ? null : scenarioId === "base" ? "upside" : scenarioId === "upside" ? "hard_stop" : null;
  const nextAction = !canReview ? t("You have read-only access. Inspect sources and reports in My cases; a case editor must complete preparation.", "У вас доступ только для чтения. Источники и отчёты доступны в «Моих делах»; подготовку завершает участник с правом редактирования.")
    : !sourcesReady ? t("Review the controlling sources and their exact passages below.", "Проверьте определяющие источники и их точные фрагменты ниже.")
    : !proposalsReady ? t("Review every pending proposal. Resume preparation if the scenario declaration is missing.", "Проверьте все ожидающие предложения. Если декларации сценария нет, продолжите подготовку.")
    : publicationIssue ? t("Retry the publication check using Refresh.", "Повторите проверку публикации кнопкой обновления.")
    : publication?.state !== "ready" ? t("Publish the exact scenario in Studio, then return and refresh.", "Опубликуйте точную версию сценария в Studio, затем вернитесь и обновите состояние.")
    : runStatus === "none" ? t("Start the recorded session.", "Начните записываемое прохождение.")
    : runStatus === "active" ? t("Choose the next available decision in the recorded run.", "Выберите следующее доступное решение в прохождении.")
    : runStatus !== "completed" ? t("Inspect the unexpected session result in My cases before continuing.", "Перед продолжением проверьте неожиданный результат сессии в «Моих делах».")
    : working.lastSessionKey !== session?.sessionKey ? t("Link the completed run and controlling evidence.", "Свяжите завершённое прохождение с определяющими доказательствами.")
    : !outputs.length ? t("Resolve the release questions in My cases, then generate the snapshot reports.", "Разрешите вопросы допуска в «Моих делах», затем сформируйте отчёты по снимку.")
    : t("Check report currency and independent approval in My cases.", "Проверьте актуальность отчёта и независимое утверждение в «Моих делах».");

  return <section aria-label={t("Executable Canopy working copy", "Рабочая копия Canopy")} aria-busy={busy}>
    <h2>{t("Working copy · ", "Рабочая копия · ") + canopyScenarioCopy(scenarioId, locale).label}</h2>
    <p>{t("Lifecycle: ", "Статус дела: ")}<strong>{canopyStateLabel(detail.status, locale)}</strong>.</p>
    <p>{t("Your case role: ", "Ваша роль в деле: ")}<strong>{canopyStateLabel(detail.current_role, locale)}</strong>. {t("Owners and contributors prepare the case. Reviewers approve an exact report independently in My cases. The server checks permissions again for every action.", "Владелец и участники с правом редактирования подготавливают дело. Проверяющий независимо утверждает конкретный отчёт в «Моих делах». Сервер повторно проверяет права при каждом действии.")}</p>
    <p className={styles.nextAction} role="status"><strong>{t("Next step: ", "Следующий шаг: ")}</strong>{nextAction}</p>
    <nav className={styles.stepLinks} aria-label={t("Working copy steps", "Этапы рабочей копии")}>
      <a href="#canopy-review">{t("1. Sources", "1. Источники")}</a><a href="#canopy-proposals">{t("2. Proposals", "2. Предложения")}</a><a href="#canopy-run">{t("3. Run", "3. Прохождение")}</a><a href="#canopy-reports">{t("4. Reports", "4. Отчёты")}</a>
    </nav>
    <p><Link href={matterPath}>{t("Open case overview, release questions and independent report review", "Открыть обзор дела, вопросы допуска и независимую проверку отчёта")}</Link></p>
    <div className={styles.tabs}><button disabled={busy} onClick={() => void act(refresh)}>{t("Refresh authoritative state", "Обновить состояние с сервера")}</button>
      <button className={styles.secondaryButton} disabled={busy || !canWrite} onClick={() => void act(async () => { await working.prepareScenario(scenarioId); await working.prepareDemoProposals(scenarioId, scenarioId === "base" || working.independent); await refresh(); })}>{t("Resume missing preparation", "Продолжить подготовку")}</button></div>
    <details><summary>{t("Readiness and verification details", "Готовность и технические сведения")}</summary><pre>{JSON.stringify({ dossierId, revision: detail.revision, readiness: detail.readiness }, null, 2)}</pre></details>
    {error && <><p role="alert" className={styles.issue}>{t("The action did not complete. Refresh the server state before retrying; completed steps remain saved. Check your organization access and the exact published package if the error persists.", "Действие не завершилось. Перед повтором обновите состояние с сервера: выполненные шаги сохранены. Если ошибка повторяется, проверьте доступ к организации и точную опубликованную версию пакета.")}</p><details><summary>{t("Error details", "Сведения об ошибке")}</summary><pre>{error}</pre></details></>}

    <h3 id="canopy-review">{t("Sources and exact passages", "Источники и точные фрагменты")}</h3>
    <p>{t("Open each source before accepting it. Acceptance records your review; it does not grant production clearance.", "Откройте каждый источник перед принятием. Принятие фиксирует вашу проверку и не предоставляет допуск к производству.")}</p>
    {Object.entries(working.sources).map(([key, binding]) => { const [id, version] = key.split("@"); return <div className={styles.reviewRow} key={key}>
      <a href={"#" + id + "-v" + version}>{id} v{version} · {t("source sections", "фрагменты источника")}</a>
      <span>{binding.current ? t("Current version", "Текущая версия") : t("Historical version", "Историческая версия")} · {binding.reviewed ? t("Accepted passages", "Фрагменты приняты") : t("Pending review", "Ожидает проверки")}</span>
      <button disabled={busy || !canReview || binding.reviewed} onClick={() => void act(async () => { await working.reviewSource(id, Number(version)); await refresh(); })}>{t("Accept this source and its passages", "Принять источник и его фрагменты")}</button>
      <details><summary>{t("Verification details · exact passage IDs", "Технические сведения · идентификаторы фрагментов")}</summary><pre>{JSON.stringify(binding, null, 2)}</pre></details>
    </div>; })}

    <h3 id="canopy-proposals">{t("Prepared demo proposals", "Подготовленные учебные предложения")}</h3>
    <p>{t("These proposals were prepared in advance, not generated by a live AI model. Accept, reject or edit each explicitly. Source statements stay in their original language.", "Эти предложения подготовлены заранее, а не созданы работающей AI-моделью. Примите, отклоните или исправьте каждое явно. Утверждения показаны на языке оригинала.")}</p>
    {!proposals.length && <p>{t("No proposals were returned. Resume preparation to add missing demo proposals.", "Предложений пока нет. Продолжите подготовку, чтобы добавить недостающие учебные предложения.")}</p>}
    {proposals.map(proposal => <details key={proposal.proposal_id} className={styles.reviewRow}>
      <summary>{canopyStateLabel(proposal.proposal_type, locale)} · {canopyStateLabel(proposal.review_state, locale)} · <span lang="en">{proposal.proposed_value.statement?.slice(0, 90)}</span></summary>
      <p lang="en">{proposal.proposed_value.statement}</p>
      {proposal.review_state === "pending" && <><label>{t("Edited statement", "Исправленное утверждение")}<textarea value={edits[proposal.proposal_id] ?? proposal.proposed_value.statement ?? ""} onChange={event => setEdits({ ...edits, [proposal.proposal_id]: event.target.value })}/></label>
        <div className={styles.tabs}><button disabled={busy || !canReview} onClick={() => void act(async () => { await working.reviewProposal(proposal.proposal_id, "reject"); await refresh(); })}>{t("Reject", "Отклонить")}</button>
          <button disabled={busy || !canReview} onClick={() => void act(async () => { await working.reviewProposal(proposal.proposal_id, "accept"); await refresh(); })}>{t("Accept", "Принять")}</button>
          <button disabled={busy || !canReview || !edits[proposal.proposal_id]?.trim()} onClick={() => void act(async () => { await working.reviewProposal(proposal.proposal_id, "edit_and_accept", edits[proposal.proposal_id]); await refresh(); })}>{t("Edit and accept", "Применить правку и принять")}</button></div></>}
    </details>)}

    <h3 id="canopy-run">{t("Decision map and recorded run", "Схема решения и записываемое прохождение")}</h3>
    <p>{t("Review the exact draft in Studio. An authorized publisher must publish that version through the normal process before a recorded run. Your private case stays private.", "Проверьте точный черновик в Studio. Перед записываемым прохождением пользователь с правом публикации должен опубликовать эту версию штатным способом. Ваше приватное дело остаётся приватным.")}</p>
    <p role="status">{publicationIssue ? t("The publication check failed. Your case has loaded; refresh to retry the catalogue check.", "Не удалось проверить публикацию. Дело загружено; обновите состояние для повторной проверки каталога.")
      : publication === null ? t("Checking the published scenario…", "Проверка опубликованного сценария…")
      : publication.state === "ready" ? t("The exact scenario version is published. Complete source and proposal reviews, then start.", "Точная версия сценария опубликована. Завершите проверку источников и предложений, затем начните прохождение.")
      : publication.state === "missing" ? t("This version is not published here. Download the exact draft, import and review it in Studio, then publish through the ordinary process. Return here and refresh afterwards.", "На этой площадке версия ещё не опубликована. Скачайте точный черновик, импортируйте и проверьте его в Studio, затем опубликуйте штатным способом. После публикации вернитесь и обновите состояние.")
      : t("The published version differs from this scenario. The publisher must reconcile the package before a run. Existing immutable publications cannot be overwritten.", "Опубликованная версия отличается от этого сценария. Перед запуском издателю нужно согласовать пакет. Существующая неизменяемая публикация не должна перезаписываться.")}</p>
    <p><a download={scenarioId + ".studio-draft.json"} href={"data:application/json;charset=utf-8," + encodeURIComponent(JSON.stringify(prepared.draft, null, 2))}>{t("Download exact Studio draft", "Скачать точный черновик Studio")}</a> · <Link href={workspaceDestination(scenarioId === "base" ? "/studio?example=canopy" : "/studio", location)}>{scenarioId === "base" ? t("Open exact Base in Studio", "Открыть точный Base в Studio") : t("Open Studio", "Открыть Studio")}</Link></p>
    <button disabled={busy || !canReview || Boolean(session) || !sourcesReady || !proposalsReady || publication?.state !== "ready"} onClick={() => void act(async () => {
      const published = await working.publicationStatus(scenarioId); setPublication(published); if (published.state !== "ready") return;
      const run = new URL(window.location.href).searchParams.get("run") ?? crypto.randomUUID(); remember(scenarioId, run);
      const started = await working.startRun(scenarioId, run); setSession(started.session); remember(scenarioId, started.session.sessionKey);
    })}>{t("Start recorded session", "Начать записываемое прохождение")}</button>
    {session && <article className={styles.comparison}>
      <p>{actual || runStatus === "unexpected" ? t("Actual recorded outcome", "Фактический записанный исход") : runStatus === "active" ? t("Run in progress", "Прохождение выполняется") : t("Session needs verification", "Сессия требует проверки")} · {session.completedAt ?? session.startedAt}</p>
      <h3 lang="en">{stage ? local(stage.headline) : t("Exact session stage unavailable", "Точный этап сессии недоступен")}</h3>
      {runStatus === "active" && stage?.options.map(option => { const available = decisionAvailability(option, session.state.metrics, session.state.actionUseCounts[actionUseKey(option)] ?? 0).available; return <p key={option.id}><button lang="en" disabled={busy || !canReview || !available} onClick={() => void act(async () => { setSession(await working.advanceRun(session, option.id)); })}>{local(option.label)}</button>{!available && <span> {t("Unavailable under evaluated controls", "Недоступно по проверенным условиям")}</span>}</p>; })}
      {actual && <><p>{t("The terminal stage matches this reviewed scenario. The expected comparison card below is a separate explanation; independent report approval is still required.", "Конечный этап соответствует этому проверенному сценарию. Карточка ожидаемого исхода ниже — отдельное пояснение; независимое утверждение отчёта по-прежнему требуется.")}</p><button disabled={busy || !canReview} onClick={() => void act(async () => { const run = await working.finishRun(scenarioId, session.sessionKey); await working.linkScenarioEvidence(scenarioId, run.packageRef); await refresh(); })}>{t("Link completed run and controlling evidence", "Связать завершённое прохождение и доказательства")}</button></>}
      {(runStatus === "unexpected" || runStatus === "mismatch") && <p role="alert" className={styles.issue}>{t("This result does not match the expected pinned route. Inspect it in My cases before linking or generating reports.", "Результат не соответствует ожидаемому зафиксированному маршруту. Проверьте его в «Моих делах» перед связыванием и формированием отчётов.")}</p>}
      <details><summary>{t("Verification details · server session and controls", "Технические сведения · серверная сессия и контроли")}</summary><pre>{JSON.stringify(session, null, 2)}</pre></details>
    </article>}

    <h3 id="canopy-reports">{t("Analytical reports and independent review", "Аналитические отчёты и независимая проверка")}</h3>
    <p>{t("For an early draft, open the exact Base in Studio and use Generate report → Preview. It is preliminary and does not carry independent approval. The governed PDF and JSON below require a completed linked run and the case's evidence gates.", "Для раннего черновика откройте точный Base в Studio и выберите «Сформировать отчёт» → предпросмотр. Это предварительный отчёт без независимого утверждения. PDF и JSON по снимку ниже требуют завершённого связанного прохождения и выполнения условий доказательности дела.")}</p>
    <p>{t("Resolve evidence-status questions in the case overview before sealing. A received answer records evidence status; it does not authorize production.", "Перед фиксацией снимка разрешите вопросы о состоянии доказательств в обзоре дела. Полученный ответ фиксирует состояние доказательства, но не разрешает производство.")}</p>
    <button disabled={busy || !detail.permissions?.can_generate_output || !actual || working.lastSessionKey !== session?.sessionKey} onClick={() => void act(async () => { await working.seal(); await refresh(); })}>{t("Seal snapshot and generate PDF / JSON", "Зафиксировать снимок и сформировать PDF / JSON")}</button>
    {!outputs.length && <p>{t("No snapshot reports yet. The next-step guide above shows what remains before generation.", "Отчётов по снимку пока нет. Подсказка следующего шага выше показывает, что нужно завершить.")}</p>}
    {outputs.map(output => <p key={output.output_id}>{canopyStateLabel(output.format, locale)} · {canopyStateLabel(output.state, locale)} {t("as of this read", "на момент загрузки")} · {output.reviewer_actor_id ? t("exact-output approval recorded", "утверждение этого файла зафиксировано") : t("no independent approval", "без независимого утверждения")} · <a href={organizationScopedUrl(output.download_url)}>{t("Open report", "Открыть отчёт")}</a>{output.format === "json_manifest" && <> · <a href={organizationScopedUrl("/api/dossiers/" + dossierId + "/outputs/" + output.output_id + "/presentation")}>{t("Short presentation memo · not approved", "Краткое презентационное мемо · не утверждено")}</a></>}</p>)}
    {next && <p><button disabled={busy || !canWrite || working.lastScenario !== scenarioId} onClick={() => void act(async () => { await working.prepareUpdate(next); setScenarioId(next); setSession(null); remember(next); await refresh(); })}>{next === "upside" ? t("Prepare Upside evidence update", "Подготовить благоприятное обновление источников") : t("Prepare clearance failure update", "Подготовить событие неудачной проверки допуска")}</button> {t("Updates this copy explicitly and requires fresh review. Prior approved files stay immutable and may become stale. Downside uses a separate clean copy.", "Явно обновляет эту копию и требует новой проверки. Ранее утверждённые файлы остаются неизменными и могут устареть. Неблагоприятный сценарий использует отдельную копию.")}</p>}
  </section>;
}
