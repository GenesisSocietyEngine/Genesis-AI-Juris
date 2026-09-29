"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { CANOPY_DISCLOSURE, CANOPY_QUESTION, CANOPY_TITLE, CANOPY_SCENARIOS, CANOPY_SOURCES, canopySourceText, type CanopyScenarioId } from "../canopy-fixture";
import { CanopyWorkingCopy, type CanopyTransport } from "../canopy-workflow";
import { scopedOrganizationHeaders } from "../organization-client";
import { workspaceDestination } from "../workspace-navigation";
import { useInterfaceLocale, useWorkspaceLocation } from "../use-interface-locale";
import { canopyWorkingCopyPath, loadCanopyCopies, readCanopyLocation, type CanopyListItem } from "./canopy-client-state";
import { canopyScenarioCopy } from "./canopy-ui-copy";
import { canopySemanticInputDiff } from "../canopy-inputs";
import CanopyWorkspace from "./CanopyWorkspace";
import styles from "./canopy.module.css";

const transport: CanopyTransport = (path, init = {}) => fetch(path, {
  ...init, credentials: "same-origin", cache: "no-store",
  headers: { ...scopedOrganizationHeaders(), ...init.headers },
});

export default function CanopyClient() {
  const [locale] = useInterfaceLocale();
  const location = useWorkspaceLocation();
  const t = (en: string, ru: string) => locale === "ru" ? ru : en;
  const [selected, setSelected] = useState<CanopyScenarioId>("base");
  const [copies, setCopies] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [preparationIssue, setPreparationIssue] = useState(false);
  const [existing, setExisting] = useState<CanopyListItem[]>([]);
  const [listLoading, setListLoading] = useState(true);
  const [listIssue, setListIssue] = useState(false);
  const [listAttempt, setListAttempt] = useState(0);
  const creating = useRef(false);
  const opened = readCanopyLocation(location);
  useEffect(() => {
    const controller = new AbortController();
    void loadCanopyCopies(transport, controller.signal).then(items => {
      if (!controller.signal.aborted) { setExisting(items); setListLoading(false); }
    }).catch(() => {
      if (!controller.signal.aborted) { setListIssue(true); setListLoading(false); }
    });
    return () => controller.abort();
  }, [listAttempt]);
  const scenario = CANOPY_SCENARIOS.find(item => item.id === selected)!;
  const scenarioText = canopyScenarioCopy(selected, locale);
  const mattersPath = workspaceDestination("/matters", location);
  function reloadCopies() { setListIssue(false); setListLoading(true); setListAttempt(value => value + 1); }
  function openCopy(id: string, scenarioId: CanopyScenarioId = "base") {
    const path = canopyWorkingCopyPath(window.location.pathname + window.location.search, id, scenarioId);
    if (path !== window.location.pathname + window.location.search) window.history.pushState(window.history.state, "", path);
    window.dispatchEvent(new Event("genesis-interface-change"));
  }
  async function createCopy() {
    if (creating.current) return;
    creating.current = true;
    setBusy(true); setPreparationIssue(false);
    try {
      const copy = await CanopyWorkingCopy.create(transport, id => {
        setCopies(current => [...current, id]); openCopy(id, selected);
      }, selected);
      await copy.prepareScenario(selected);
      await copy.prepareDemoProposals(selected);
      openCopy(copy.dossierId, selected);
    } catch { setPreparationIssue(true); }
    finally { creating.current = false; setBusy(false); reloadCopies(); }
  }

  return <main className={styles.page}>
    <div className={styles.breadcrumb}><Link href={mattersPath}>{t("My cases", "Мои дела")}</Link><span>{t("Featured demo · Synthetic demonstration", "Учебный пример · Вымышленные данные")}</span></div>
    <header className={styles.header}>
      <div><p className={styles.eyebrow}>{t("INVESTMENT AND OPERATING COMMITTEE", "ИНВЕСТИЦИОННЫЙ И ОПЕРАЦИОННЫЙ КОМИТЕТ")}</p>
        <h1>{t(CANOPY_TITLE, "Project Canopy — решение о расширении площадки")}</h1>
        <p>{t(CANOPY_QUESTION, "Принять предложение об эксплуатации площадки, разрешить только переходный пилот на 90 дней, пересогласовать условия и отложить или отказаться?")}</p>
      </div>
      <div className={styles.start}>
        <button disabled={busy} onClick={() => void createCopy()}>{busy ? t("Preparing sources and pending proposals…", "Подготавливаются источники и предложения…") : t("Create clean copy · ", "Создать отдельную копию · ") + scenarioText.label}</button>
        <p>{t("A new private Matter contains sources for the selected pinned scenario, exact anchors, three open release questions and pending proposals. Each copy keeps its own review and approvals.", "В новом приватном деле будут источники выбранного сценария, ссылки на их фрагменты, три открытых вопроса допуска и предложения для проверки. У каждой копии своя история проверки и утверждений.")}</p>
        <label>{t("Open existing demo", "Открыть сохранённую копию")}<select disabled={busy || listLoading || !existing.length} value={existing.some(item => item.dossier_id === opened?.id) ? opened!.id : ""} onChange={event => { if (event.target.value) openCopy(event.target.value); }}>
          <option value="">{t("Select a retained copy", "Выберите сохранённую копию")}</option>
          {existing.map(item => <option key={item.dossier_id} value={item.dossier_id}>{item.title} · {item.updated_at}</option>)}
        </select></label>
        {listLoading ? <p role="status">{t("Loading saved copies…", "Загрузка сохранённых копий…")}</p> : listIssue ? <p role="alert">{t("Saved copies could not be listed. Retry or open My cases.", "Не удалось загрузить список копий. Повторите запрос или откройте «Мои дела».")}</p> : <p>{existing.length ? t("Up to 25 recent Canopy copies are shown. Use My cases for the complete list.", "Показаны до 25 недавних копий Canopy. Полный список доступен в «Моих делах».") : t("No saved Canopy copies were found. Create a copy to begin.", "Сохранённых копий Canopy не найдено. Создайте копию, чтобы начать.")}</p>}
        <button className={styles.secondaryButton} disabled={listLoading || busy} onClick={reloadCopies}>{t("Refresh saved copies", "Обновить список копий")}</button>
      </div>
    </header>
    <p className={styles.disclosure}>{t(CANOPY_DISCLOSURE, "В этом примере все организации, документы, люди и цифры вымышлены. Использованы только общедоступные отраслевые подходы; пример не представляет данные, результаты, контроли или решения Greeneration.")}</p>
    {preparationIssue && <p role="alert" className={styles.issue}>{t("Preparation stopped. The partial copy is retained; refresh it and use Resume missing preparation. Reviews remain explicit.", "Подготовка остановлена. Уже созданная часть копии сохранена: откройте её и выберите «Продолжить подготовку». Источники и предложения требуют отдельного подтверждения.")} <Link href={mattersPath}>{t("Inspect My cases", "Открыть мои дела")}</Link></p>}
    <div aria-live="polite">{copies.map((id, index) => <p key={id}>{t("Working copy", "Рабочая копия")} {index + 1} {t("retained.", "сохранена.")} <Link href={workspaceDestination("/matters?dossier=" + encodeURIComponent(id), location)}>{t("Open sources, pending proposals and release questions", "Открыть источники, предложения и вопросы допуска")}</Link></p>)}</div>
    {opened && !busy && <CanopyWorkspace key={opened.id} dossierId={opened.id} initialScenario={opened.scenario}/>}
    <section aria-labelledby="comparison-title"><h2 id="comparison-title">{t("Compare the prepared scenarios", "Сравните подготовленные сценарии")}</h2>
      <p>{t("These are expected outcomes of the declared assumptions. The selected card does not run a simulation, accept evidence or approve an output.", "Это ожидаемые исходы при заявленных допущениях. Выбор карточки не запускает симуляцию, не принимает доказательства и не утверждает отчёт.")}</p>
      <div className={styles.tabs} role="group" aria-label={t("Prepared scenario", "Подготовленный сценарий")}>{CANOPY_SCENARIOS.map(item => <button key={item.id} disabled={busy} aria-pressed={selected === item.id} onClick={() => setSelected(item.id)}>{canopyScenarioCopy(item.id, locale).label}</button>)}</div>
      <article className={styles.comparison}><p>{t("Expected outcome — not run", "Ожидаемый исход · запуск не выполнен")}</p><h3>{scenarioText.recommendation}</h3><dl>
        <div><dt>{t("What changed", "Что изменилось")}</dt><dd>{scenarioText.changed}</dd></div>
        <div><dt>{t("Why the recommendation changes", "Почему меняется рекомендация")}</dt><dd>{scenarioText.why}</dd></div>
        <div><dt>{t("Controlling evidence", "Определяющие источники")}</dt><dd>{scenario.controls.map(control => <a key={control.document + control.section} href={"#" + control.document + "-v" + control.version}>{control.document} v{control.version} § {control.section}</a>)}</dd></div>
      </dl><details><summary>{t("Verification details · pinned inputs and difference from Upside", "Параметры проверки · исходные значения и отличие от благоприятного сценария")}</summary><pre>{JSON.stringify({inputs:scenario.inputs,diff:canopySemanticInputDiff(CANOPY_SCENARIOS.find(s=>s.id==="upside")!.inputs,scenario.inputs)},null,2)}</pre></details></article>
    </section>
    <section aria-labelledby="source-title"><h2 id="source-title">{t("Immutable source packet", "Неизменяемый пакет источников")}</h2>
      <p>{t("Historical versions are retained alongside the staffing, clearance and assumption addenda. All figures are illustrative; the economic sheet shows the arithmetic and assumptions.", "Исторические версии сохранены вместе с дополнениями о персонале, допуске и допущениях. Цифры учебные; экономический лист показывает расчёты и исходные предположения.")}</p>
      {locale === "ru" && <p>Тексты источников и записанной схемы показаны на языке оригинала — английском. Перевод интерфейса не изменяет их содержание и контрольные суммы.</p>}
      <div className={styles.sources}>{CANOPY_SOURCES.map(source => <details key={source.id + source.version} id={source.id + "-v" + source.version}>
        <summary lang="en">{source.id} v{source.version} — {source.title}</summary>
        {Object.entries(source.sections).map(([section, text]) => <div key={section} lang="en"><h3>§ {section}</h3><p>{text}</p></div>)}
        <a download={source.id + "-v" + source.version + ".md"} href={"data:text/markdown;charset=utf-8," + encodeURIComponent(canopySourceText(source))}>{t("Download this exact source", "Скачать эту версию источника")}</a>
      </details>)}</div>
    </section>
    <section className={styles.notes}><h2>{t("Review and continue", "Проверьте и продолжите")}</h2>
      <p>{t("Reject the claim that all indicated demand is signed; edit the demand/capacity claim before accepting it. Prepared demo proposals have no live-model provenance. Initial production-release questions remain open until supporting evidence is reviewed.", "Отклоните утверждение, что весь заявленный спрос подписан. Исправьте утверждение о спросе и мощности перед принятием. Учебные предложения подготовлены заранее и не являются ответом работающей AI-модели. Вопросы допуска остаются открытыми до проверки подтверждающих источников.")}</p>
      <p>{t("Follow Base → Upside → Hard stop in the walkthrough. Downside is an independently initialized stress copy. Each run requires the exact normally published Studio package. Completed server sessions supply Actual outcomes; expected cards never execute a run.", "Основной маршрут: базовый → благоприятный → стоп-условие. Неблагоприятный сценарий проверяется в отдельной копии. Для каждого запуска нужна точная версия пакета, опубликованная штатным способом. Фактический исход появляется только после завершённого серверного прохождения.")}</p>
      <p>{t("Snapshot PDF and JSON, independent exact-output approval and current/stale status remain in the Matter output register. The shorter presentation memo is a distinct, unapproved extract.", "PDF и JSON по снимку дела, независимое утверждение конкретного файла и его актуальность хранятся в реестре отчётов дела. Краткое презентационное мемо — отдельная неутверждённая выдержка.")}</p>
    </section>
  </main>;
}
