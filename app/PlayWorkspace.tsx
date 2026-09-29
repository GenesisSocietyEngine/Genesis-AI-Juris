"use client";

import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { Icon, metricLabels } from "./JurisViewShared";
import { actionUseKey, decisionAvailability } from "./game-engine";
import type { DecisionRecord, InboxEntry, Locale, OutcomeClass, ServerPlaySessionState, UiText } from "./JurisApp";
import type { RunLedger } from "./run-ledger";
import type { DecisionOption, MetricKey, Scenario } from "./types";

const OperationsDossier = lazy(() => import("./OperationsDossier"));

function formatCaseClock(totalMinutes: number) {
  const safe = Math.max(0, totalMinutes);
  const day = Math.floor(safe / 1440) + 1;
  const minuteOfDay = safe % 1440;
  return { day, time: `${String(Math.floor(minuteOfDay / 60)).padStart(2, "0")}:${String(minuteOfDay % 60).padStart(2, "0")}` };
}

function PlayView({ locale, text, scenario, stage, stageIndex, metrics, ledger, decisionLog, caseMinute, actionUseCounts, completedDeadlineIds, missedDeadlineIds, canonicalState, dossierRef, setDossierRef, setSelectedOption, advanceTime, timeBusy, outcome, sessionSync, exportSession, replayCase, returnLibrary, returnToStudio = false, returnLabel, requestFeedback }: {
  locale: Locale; text: UiText; scenario: Scenario; stage: Scenario["stages"][number]; stageIndex: number; metrics: Record<MetricKey, number>;
  ledger: RunLedger; decisionLog: DecisionRecord[]; caseMinute: number; actionUseCounts: Record<string, number>; completedDeadlineIds: string[];
  missedDeadlineIds: string[]; canonicalState?: ServerPlaySessionState; dossierRef: string | null; setDossierRef: (ref: string) => void;
  setSelectedOption: (option: DecisionOption) => void; advanceTime: (minutes: number) => void; timeBusy: boolean; outcome: OutcomeClass | null;
  sessionSync: "opening" | "server" | "local" | "stale" | "error"; exportSession: () => void; replayCase: () => void;
  returnLibrary: () => void; returnToStudio?: boolean; returnLabel?: string; requestFeedback: (contextType: "case" | "stage", contextId?: string) => void;
}) {
  const visibleMaterials = canonicalState?.availableEvidenceIds
    ? scenario.materials.filter((material) => canonicalState.availableEvidenceIds?.includes(material.ref))
    : scenario.materials;
  const activeMaterial = visibleMaterials.find((material) => material.ref === dossierRef) ?? visibleMaterials[0] ?? scenario.materials[0];
  const [inboxOpen, setInboxOpen] = useState(false);
  const [selectedInboxIndex, setSelectedInboxIndex] = useState(0);
  const decisionRef = useRef<HTMLElement>(null);
  const clock = formatCaseClock(caseMinute);
  const activeActionIds = new Set(stage.options.map((option) => option.id));
  const visitedStageIds = new Set(decisionLog.map((entry) => entry.stageId));
  const workflowInbox = canonicalState?.visibleInboxIds
    ? scenario.workflowInbox.filter((item) => canonicalState.visibleInboxIds?.includes(item.id))
    : scenario.workflowInbox.filter((item) => item.initiallyVisible || item.resolutionActions.some((action) => activeActionIds.has(action)));
  const resolvedOptionIds = new Set(decisionLog.map((entry) => entry.option.id));
  const unresolvedWorkflowInbox = canonicalState?.resolvedInboxIds
    ? workflowInbox.filter((item) => !canonicalState.resolvedInboxIds?.includes(item.id))
    : workflowInbox.filter((item) => !item.resolutionActions.some((action) => resolvedOptionIds.has(action)));
  const inboxEntries: InboxEntry[] = [
    {
      id: `${stage.id}-situation`,
      status: locale === "en" ? "ACTION REQUIRED" : "ТРЕБУЕТСЯ ДЕЙСТВИЕ",
      title: stage.headline[locale],
      source: stage.source[locale],
      body: stage.brief[locale],
    },
    ...unresolvedWorkflowInbox.map((item) => ({
      id: item.id,
      status: item.actionRequired ? (locale === "en" ? "ACTION REQUIRED" : "ТРЕБУЕТСЯ ДЕЙСТВИЕ") : (locale === "en" ? "CASE UPDATE" : "ОБНОВЛЕНИЕ ДЕЛА"),
      title: item.subject[locale],
      source: locale === "en" ? "Versioned case inbox" : "Версионный Inbox дела",
      body: item.body[locale],
    })),
  ];
  const deadlineRows = scenario.deadlines.filter((deadline) => !canonicalState?.activeDeadlineIds || canonicalState.activeDeadlineIds.includes(deadline.id)).map((deadline) => {
    const completed = completedDeadlineIds.includes(deadline.id);
    const missed = missedDeadlineIds.includes(deadline.id);
    const dueAtMinute = canonicalState?.deadlineDueMinutes?.[deadline.id] ?? deadline.dueAtMinute;
    const remaining = dueAtMinute - caseMinute;
    return { deadline, dueAtMinute, completed, missed, remaining };
  }).sort((left, right) => left.dueAtMinute - right.dueAtMinute);
  const nextDeadline = deadlineRows.find((row) => !row.completed && !row.missed);
  const availableCount = sessionSync === "opening" ? 0 : stage.options.filter((option) => {
    if (scenario.mobileParity) return Boolean(option.canonicalActionId && canonicalState?.availableActionIds?.includes(option.canonicalActionId));
    const uses = actionUseCounts[actionUseKey(option)] ?? 0;
    return decisionAvailability(option, metrics, uses).available;
  }).length;

  function remainingLabel(minutes: number) {
    const absolute = Math.abs(minutes);
    const days = Math.floor(absolute / 1440);
    const hours = Math.floor((absolute % 1440) / 60);
    const mins = absolute % 60;
    const value = [days ? `${days}d` : "", hours ? `${hours}h` : "", `${mins}m`].filter(Boolean).join(" ");
    return minutes < 0 ? (locale === "en" ? `${value} overdue` : `просрочено на ${value}`) : (locale === "en" ? `${value} remaining` : `осталось ${value}`);
  }

  function revealDecisions() {
    decisionRef.current?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });
    window.setTimeout(() => {
      decisionRef.current?.querySelector<HTMLButtonElement>(".decision-options button")?.focus();
    }, 380);
  }
  if (outcome) return <DebriefView locale={locale} text={text} scenario={scenario} metrics={metrics} ledger={ledger} decisionLog={decisionLog} outcome={outcome} canonicalOutcome={canonicalState?.canonicalOutcome} exportSession={exportSession} replayCase={replayCase} returnLibrary={returnLibrary} returnToStudio={returnToStudio} returnLabel={returnLabel} requestFeedback={() => requestFeedback("case")}/>;
  return <main className="operations-view"><aside className="case-rail"><button className="rail-back" onClick={returnLibrary}><span>←</span>{returnLabel ?? (returnToStudio ? text.studio : text.library)}</button><div className="rail-case"><small>{locale === "en" ? "Active case" : "Текущий кейс"}</small><b>{scenario.title[locale]}</b><span>{scenario.jurisdiction}</span></div><div className="workflow-depth"><span>{scenario.stages.length} {locale === "en" ? "stages" : "этапов"}</span><span>{scenario.mobileParity?.actionCount ?? scenario.stages.reduce((sum, item) => sum + item.options.length, 0)} {locale === "en" ? "actions" : "действий"}</span></div><div className={`run-authority ${sessionSync}`}><span>{sessionSync === "server" ? (locale === "en" ? "Progress saved online" : "Прогресс сохранён онлайн") : sessionSync === "opening" ? (locale === "en" ? "Starting case…" : "Запуск кейса…") : sessionSync === "stale" ? (locale === "en" ? "Progress restored" : "Прогресс восстановлен") : sessionSync === "error" ? (locale === "en" ? "Progress could not be synced" : "Не удалось синхронизировать прогресс") : (locale === "en" ? "Preview on this device" : "Предпросмотр на этом устройстве")}</span></div><ol className="stage-list">{scenario.stages.map((item, index) => <li key={item.id} className={index === stageIndex ? "active" : visitedStageIds.has(item.id) ? "done" : ""} aria-current={index === stageIndex ? "step" : undefined}><span>{index + 1}</span><div><b>{item.phase[locale]}</b><small>{item.terminal ? (locale === "en" ? "Outcome" : "Исход") : ""}</small></div></li>)}</ol><details className="rail-version"><summary>{locale === "en" ? "Technical details" : "Технические сведения"}</summary><div><span>{scenario.caseId} · v{scenario.version}</span><br/><code>{scenario.fingerprint}</code></div></details></aside>
    <section className="command-center">
      <div className="command-header">
        <div>
          <div className="eyebrow"><span className="live-dot"/>{locale === "en" ? "Operations" : "Операции"} · {text.day} {clock.day}</div>
          <h1>{scenario.title[locale]}</h1>
          <p>{stage.phase[locale]} <span>·</span> {clock.time}</p>
        </div>
        <div className="clock-controls">
          <div className="command-clock"><span>{clock.time}</span><small>{text.day} {clock.day}</small></div>
          {scenario.mobileParity?.foregroundClock && <div className="time-advance-controls" aria-label={locale === "en" ? "Advance case time" : "Продвинуть время дела"}>
            <button disabled={timeBusy || sessionSync === "opening" || !canonicalState?.availableActionIds} onClick={() => advanceTime(60)}>+1h</button>
            <button disabled={timeBusy || sessionSync === "opening" || !canonicalState?.availableActionIds} onClick={() => advanceTime(360)}>+6h</button>
          </div>}
        </div>
      </div>
      <RunLedgerPanel locale={locale} ledger={ledger} day={clock.day} />
      <MetricPanel locale={locale} metrics={metrics} compact/>
      <nav className="operations-guide" aria-label={locale === "en" ? "How to play" : "Как пройти кейс"}>
        <a href="#operation-brief"><b>1</b>{locale === "en" ? "Read the brief" : "Изучите задачу"}</a>
        <a href="#operations-dossier-title"><b>2</b>{locale === "en" ? "Review documents" : "Проверьте документы"}</a>
        <button type="button" onClick={revealDecisions}><b>3</b>{locale === "en" ? "Choose an action" : "Выберите действие"}</button>
      </nav>
      <article className="engagement-brief" id="operation-brief">
        <div><span>{locale === "en" ? "INITIAL SITUATION / MANDATE" : "НАЧАЛЬНАЯ СИТУАЦИЯ / ПОРУЧЕНИЕ"}</span></div>
        <p>{scenario.opening[locale]}</p>
      </article>
      <div className="ops-ledger">
        <button
          className="ledger-control ledger-inbox"
          onClick={() => { setSelectedInboxIndex(0); setInboxOpen(true); }}
          aria-haspopup="dialog"
          aria-label={`${text.attention}: ${inboxEntries.length}`}
        >
          <span>{text.attention}</span>
          <b>{inboxEntries.length}</b>
          <small>{locale === "en" ? "Review updates" : "Проверьте обновления"}</small>
          <Icon name="arrow"/>
        </button>
        <button
          className="ledger-control ledger-decisions"
          onClick={revealDecisions}
          aria-label={`${text.decisions}: ${availableCount}`}
        >
          <span>{text.decisions}</span>
          <b>{availableCount}</b>
          <small>RESPONSE WINDOW OPEN</small>
          <Icon name="arrow"/>
        </button>
      </div>
      <section className="deadline-ledger" aria-label={locale === "en" ? "Case deadlines" : "Дедлайны дела"}>
        <div className="deadline-heading"><div><span>{locale === "en" ? "DEADLINE CONTROL" : "КОНТРОЛЬ СРОКОВ"}</span><h2>{locale === "en" ? "Time changes the case" : "Время изменяет дело"}</h2></div><code>{deadlineRows.length.toString().padStart(2,"0")} DEADLINES</code></div>
        {deadlineRows.length === 0 ? <p className="no-deadlines">{locale === "en" ? "No authored deadline is active in this introductory matter." : "В этом вводном деле нет настроенных дедлайнов."}</p> : <div className="deadline-list">{deadlineRows.map(({deadline,dueAtMinute,completed,missed,remaining}) => <div key={deadline.id} className={`deadline-row ${completed ? "complete" : missed ? "missed" : remaining <= 180 ? "urgent" : ""}`}><span className="deadline-state">{completed ? "✓" : missed ? "!" : "◷"}</span><div><b>{deadline.title[locale]}</b><small>{completed ? (locale === "en" ? "Completed" : "Выполнено") : missed ? remainingLabel(remaining) : remainingLabel(remaining)}</small></div><time>D{Math.floor(dueAtMinute/1440)+1} · {formatCaseClock(dueAtMinute).time}</time></div>)}</div>}
      </section>
      <article className="situation-panel">
        <div className="situation-top"><span>{text.situation}</span>{!scenario.mobileParity && <code>{stage.source[locale]}</code>}</div>
        <h2>{stage.headline[locale]}</h2>
        <p>{stage.brief[locale]}</p>
        <div className={`pressure-band ${nextDeadline && nextDeadline.remaining <= 180 ? "active" : ""}`}>
          <Icon name={nextDeadline && nextDeadline.remaining <= 180 ? "alert" : "check"}/>
          <div><small>{text.pressure}</small><b>{nextDeadline ? `${nextDeadline.deadline.title[locale]} · ${remainingLabel(nextDeadline.remaining)}` : text.noPressure}</b></div>
        </div>
      </article>
      <section className="decision-entry" ref={decisionRef} tabIndex={-1}>
        <div>
          <span>STAGE {String(stageIndex+1).padStart(2,"0")} / {String(scenario.stages.length).padStart(2,"0")}</span>
          <h2>{locale === "en" ? "Analysis, engagement and available work" : "Анализ, принятие поручения и доступная работа"}</h2>
          <p>{locale === "en" ? "Choose an action below. Time and the quoted cost are recorded after you confirm." : "Выберите действие ниже. После подтверждения продвигается время и фиксируется указанная стоимость."}</p>
        </div>
        <div className="decision-options">
          {stage.options.map((option) => {
            const uses = actionUseCounts[actionUseKey(option)] ?? 0;
            const authoredAvailability = decisionAvailability(option, metrics, uses);
            const available = scenario.mobileParity
              ? Boolean(option.canonicalActionId && canonicalState?.availableActionIds?.includes(option.canonicalActionId))
              : authoredAvailability.available;
            const exhausted = scenario.mobileParity ? uses > 0 && option.repeatability === "once" : authoredAvailability.exhausted;
            const authoredCost = scenario.mobileParity ? option.costAuthored === true : true;
            const economics = `${option.minutes} ${locale === "en" ? "min" : "мин"} · ${authoredCost ? `€ ${option.cost.toLocaleString()}` : (locale === "en" ? "Cost not specified" : "Стоимость не указана")}`;
            const nextDay = option.completionDayOffset !== undefined && option.completionDayOffset > 0 ? (locale === "en" ? " · NEXT WORKDAY" : " · СЛЕДУЮЩИЙ РАБОЧИЙ ДЕНЬ") : "";
            const stateLabel = sessionSync === "opening"
              ? (locale === "en" ? "OPENING SERVER RUN" : "ЗАПУСК СЕРВЕРНОГО РАСЧЁТА")
              : exhausted
                ? (locale === "en" ? "COMPLETED" : "ВЫПОЛНЕНО")
                : !available
                  ? scenario.mobileParity
                    ? (locale === "en" ? "LOCKED BY CANONICAL RULE" : "ЗАБЛОКИРОВАНО КАНОНИЧЕСКИМ ПРАВИЛОМ")
                    : (locale === "en" ? "LOCKED BY RULE" : "ЗАБЛОКИРОВАНО ПРАВИЛОМ")
                  : `${economics}${nextDay}${option.repeatability === "limited" ? ` · ${uses}/${option.maxUses}` : ""}`;
            const title = !scenario.mobileParity && !available && !exhausted
              ? authoredAvailability.blockedGuards.map((guard) => `${guard.metric} ${guard.comparison} ${guard.value}`).join(", ")
              : undefined;
            return <button key={option.id} disabled={sessionSync === "opening" || !available} onClick={() => setSelectedOption(option)} title={title}><span>{option.label[locale]}</span><small>{stateLabel}</small><Icon name={sessionSync === "opening" || !available ? exhausted ? "check" : "alert" : "arrow"}/></button>;
          })}
        </div>
      </section>
      <button className="case-feedback-cta secondary-cta" onClick={() => requestFeedback("stage", stage.id)}><Icon name="file"/>{locale === "en" ? "Give feedback on this stage" : "Дать отзыв об этой стадии"}</button>
      {inboxOpen && (
        <InboxPanel
          locale={locale}
          entries={inboxEntries}
          selectedIndex={selectedInboxIndex}
          selectEntry={setSelectedInboxIndex}
          close={() => setInboxOpen(false)}
          openMaterial={(ref) => {
            setDossierRef(ref);
            setInboxOpen(false);
            window.setTimeout(() => document.querySelector(".dossier-pane")?.scrollIntoView({ behavior: "smooth", block: "start" }), 80);
          }}
        />
      )}
    </section>
    <Suspense fallback={<aside className="dossier-pane" aria-busy="true">{locale === "en" ? "Loading documents…" : "Загрузка документов…"}</aside>}><OperationsDossier locale={locale} materials={visibleMaterials} activeMaterial={activeMaterial} selectMaterial={setDossierRef} caseId={scenario.caseId} decisions={decisionLog}/></Suspense></main>;
}

function DebriefView({ locale, text, scenario, metrics, ledger, decisionLog, outcome, canonicalOutcome, exportSession, replayCase, returnLibrary, returnToStudio = false, returnLabel, requestFeedback }: { locale: Locale; text: UiText; scenario: Scenario; metrics: Record<MetricKey, number>; ledger: RunLedger; decisionLog: DecisionRecord[]; outcome: OutcomeClass; canonicalOutcome?: NonNullable<DecisionOption["resolvedOutcome"]>; exportSession: () => void; replayCase: () => void; returnLibrary: () => void; returnToStudio?: boolean; returnLabel?: string; requestFeedback: () => void }) {
  const exactOutcome = canonicalOutcome ?? [...decisionLog].reverse().find((entry) => entry.option.resolvedOutcome)?.option.resolvedOutcome;
  const presentation = {
    strong: {
      classLabel: locale === "en" ? "FAVORABLE OUTCOME" : "БЛАГОПРИЯТНЫЙ ИСХОД",
      posture: locale === "en" ? "Position protected" : "Позиция защищена",
      explanation: locale === "en"
        ? "Evidence integrity, institutional trust and the legal position outweighed the remaining exposure."
        : "Целостность доказательств, институциональное доверие и правовая позиция перевесили оставшуюся экспозицию.",
      icon: "check",
    },
    mixed: {
      classLabel: locale === "en" ? "MIXED OUTCOME" : "СМЕШАННЫЙ ИСХОД",
      posture: locale === "en" ? "Position remains contested" : "Позиция остаётся спорной",
      explanation: locale === "en"
        ? "Material strengths were offset by unresolved exposure. The matter remains defensible, but not fully controlled."
        : "Сильные стороны были уравновешены нерешённой экспозицией. Дело остаётся защищаемым, но не полностью контролируемым.",
      icon: "file",
    },
    weak: {
      classLabel: locale === "en" ? "ADVERSE OUTCOME" : "НЕБЛАГОПРИЯТНЫЙ ИСХОД",
      posture: locale === "en" ? "Position compromised" : "Позиция ослаблена",
      explanation: locale === "en"
        ? "Accumulated exposure and institutional weaknesses outweighed the position preserved by individual decisions."
        : "Накопленная экспозиция и институциональные слабости перевесили позицию, сохранённую отдельными решениями.",
      icon: "alert",
    },
  }[outcome];

  return (
    <main className="debrief-view page-width">
      <div className="debrief-mark"><span>CASE CLOSED</span><b>{scenario.id.includes(".studio.") ? "STUDIO" : String(scenario.order / 10).padStart(2, "0")}</b></div>
      <div className="eyebrow"><span className="live-dot"/>{text.complete}</div>
      <h1>{scenario.title[locale]}</h1>

      <section className={`outcome-verdict outcome-${outcome}`}>
        <div className="verdict-classification">
          <span className="verdict-icon"><Icon name={presentation.icon} size={27}/></span>
          <small>{presentation.classLabel}</small>
          <b>{presentation.posture}</b>
        </div>
        <div className="verdict-narrative">
          <span>{locale === "en" ? "FINAL CASE OUTCOME" : "ИТОГОВЫЙ РЕЗУЛЬТАТ ДЕЛА"}</span>
          <h2>{exactOutcome?.title[locale] ?? scenario.outcomes[outcome][locale]}</h2>
          <p>{exactOutcome?.summary[locale] ?? presentation.explanation}</p>
        </div>
      </section>

      <section className="financial-result">
        <div className="financial-heading">
          <div><span>{locale === "en" ? "FINANCIAL RESULT" : "ФИНАНСОВЫЙ РЕЗУЛЬТАТ"}</span><h2>{locale === "en" ? "Matter economics" : "Экономика дела"}</h2></div>
          <small>{ledger.financialOutcomeAuthored ? (locale === "en" ? "Outcome quantified by the source case" : "Исход количественно задан в исходном кейсе") : (locale === "en" ? "Outcome amount is not authored in this source case" : "Сумма исхода не задана в исходном кейсе")}</small>
        </div>
        <dl className="financial-grid">
          <div><dt>{locale === "en" ? (ledger.costCoverage === "complete" || ledger.spendAuthoritative ? "Legal spend" : "Known legal spend") : (ledger.costCoverage === "complete" || ledger.spendAuthoritative ? "Юридические расходы" : "Известные юридические расходы")}</dt><dd>€ {ledger.spendEur.toLocaleString()}</dd></div>
          <div><dt>{locale === "en" ? (ledger.billableCoverage === "complete" ? "Billable time" : "Known billable time") : (ledger.billableCoverage === "complete" ? "Учтённое время" : "Известное учтённое время")}</dt><dd>{ledger.billableCoverage === "not-authored" ? "—" : `${(ledger.billableMinutes / 60).toFixed(1)} h`}</dd></div>
          <div><dt>{locale === "en" ? "Award / settlement" : "Присуждение / урегулирование"}</dt><dd>{ledger.financialOutcomeAuthored ? `€ ${ledger.awardEur.toLocaleString()}` : "—"}</dd></div>
          <div><dt>{locale === "en" ? "Outcome costs" : "Расходы по исходу"}</dt><dd>{ledger.financialOutcomeAuthored ? `€ ${ledger.outcomeCostsEur.toLocaleString()}` : "—"}</dd></div>
          <div className="financial-net"><dt>{locale === "en" ? "Net financial result" : "Чистый финансовый результат"}</dt><dd>{ledger.financialOutcomeAuthored && (ledger.costCoverage === "complete" || ledger.spendAuthoritative) ? `€ ${(ledger.awardEur - ledger.outcomeCostsEur - ledger.spendEur).toLocaleString()}` : ledger.financialOutcomeAuthored ? (locale === "en" ? "Partially quantified" : "Рассчитан частично") : (locale === "en" ? "Not quantified" : "Не рассчитан")}</dd></div>
          {ledger.authorizedBudgetEur > 0 && <div className={ledger.spendEur > ledger.authorizedBudgetEur ? "budget-exceeded" : ""}><dt>{ledger.spendEur > ledger.authorizedBudgetEur ? (locale === "en" ? "Budget exceeded" : "Превышение бюджета") : (locale === "en" ? "Budget remaining" : "Остаток бюджета")}</dt><dd>€ {Math.abs(ledger.authorizedBudgetEur - ledger.spendEur).toLocaleString()}</dd></div>}
        </dl>
        {ledger.costCoverage !== "complete" && <p className="financial-caveat">{ledger.spendAuthoritative ? (locale === "en" ? "The total spend is authoritative in the canonical runtime; some individual actions do not carry a separate cost annotation." : "Итоговые расходы авторитетно рассчитаны каноническим runtime; для отдельных действий стоимость отдельно не размечена.") : (locale === "en" ? "Only action costs explicitly authored in the canonical mobile scenario are included; no missing values were invented." : "Учтены только затраты, явно заданные в каноническом мобильном сценарии; отсутствующие значения не выдумывались.")}</p>}
      </section>

      <section className="final-posture">
        <div className="final-posture-heading">
          <span>{locale === "en" ? "Final institutional posture" : "Итоговая институциональная позиция"}</span>
          <small>{locale === "en" ? `Values after ${decisionLog.length} confirmed decision${decisionLog.length === 1 ? "" : "s"}` : `Значения после подтверждённых решений: ${decisionLog.length}`}</small>
        </div>
        <MetricPanel locale={locale} metrics={metrics} compact/>
      </section>

      <div className="debrief-grid">
        <section>
          <h2>{text.actionLog}</h2>
          {decisionLog.map((entry, index) => (
            <article key={`${entry.option.id}-${index}`} className="log-entry">
              <span>{String(index + 1).padStart(2, "0")}</span>
              <div>
                <small>{entry.stage}</small>
                <b>{entry.option.label[locale]}</b>
                <p>{entry.option.result[locale]}</p>
                <div className="log-effects">
                  {(Object.entries(entry.option.effects) as Array<[MetricKey, number]>).map(([key, value]) => (
                    <i key={key} className={value >= 0 ? "positive" : "negative"}>{metricLabels[locale][key]} {value >= 0 ? "+" : ""}{value}</i>
                  ))}
                </div>
              </div>
            </article>
          ))}
        </section>
        <aside className="outcome-reasons">
          <h2>{locale === "en" ? "Why this outcome" : "Почему получен этот исход"}</h2>
          <p>{locale === "en" ? "Each confirmed response changed the final posture. These were the decisive consequences:" : "Каждый подтверждённый ответ изменял итоговую позицию. Определяющими стали следующие последствия:"}</p>
          <ol>
            {decisionLog.map((entry, index) => <li key={entry.option.id}><span>{String(index + 1).padStart(2, "0")}</span><p>{entry.option.result[locale]}</p></li>)}
          </ol>
          <div className="canonical-note"><Icon name="file"/><p>{text.canonNote}</p></div>
        </aside>
      </div>

      <div className="debrief-actions">
        <button className="secondary-cta" onClick={returnLibrary}>{returnLabel ?? (returnToStudio ? (locale === "en" ? "Return to Studio" : "Вернуться в Studio") : text.returnLibrary)}</button>
        <button className="secondary-cta" onClick={requestFeedback}><Icon name="file"/>{text.feedback}</button>
        <button className="secondary-cta" onClick={exportSession}><Icon name="download"/>{text.exportPlay}</button>
        <button className="primary-cta" onClick={replayCase}><Icon name="reset"/>{locale === "en" ? "Replay this case" : "Пройти кейс заново"}</button>
      </div>
    </main>
  );
}

function InboxPanel({ locale, entries, selectedIndex, selectEntry, close, openMaterial }: { locale: Locale; entries: InboxEntry[]; selectedIndex: number; selectEntry: (index: number) => void; close: () => void; openMaterial: (ref: string) => void }) {
  const entry = entries[selectedIndex] ?? entries[0];
  return (
    <div className="inbox-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) close(); }}>
      <section className="inbox-panel" role="dialog" aria-modal="true" aria-labelledby="inbox-panel-title">
        <header>
          <div>
            <span>OPERATIONAL INBOX</span>
            <h2 id="inbox-panel-title">{locale === "en" ? "Attention required" : "Требуют внимания"}</h2>
          </div>
          <b>{entries.length.toString().padStart(2, "0")}</b>
          <button onClick={close} aria-label={locale === "en" ? "Close inbox" : "Закрыть входящие"}><Icon name="close"/></button>
        </header>
        <div className="inbox-panel-body">
          <nav aria-label={locale === "en" ? "Attention messages" : "Сообщения, требующие внимания"}>
            {entries.map((item, index) => (
              <button key={item.id} className={index === selectedIndex ? "active" : ""} onClick={() => selectEntry(index)}>
                <span>{String(index + 1).padStart(2, "0")}</span>
                <div><small>{item.status}</small><b>{item.title}</b><code>{item.source}</code></div>
                <Icon name="arrow"/>
              </button>
            ))}
          </nav>
          <article className="inbox-message">
            <div className="message-register"><span>{entry.status}</span><code>{entry.id}</code></div>
            <h3>{entry.title}</h3>
            <p>{entry.body}</p>
            <dl>
              <div><dt>SOURCE / TIME</dt><dd>{entry.source}</dd></div>
              <div><dt>STATUS</dt><dd>{locale === "en" ? "Unread · visible record" : "Не прочитано · видимая запись"}</dd></div>
            </dl>
            <div className="message-actions">
              <button className="secondary-cta" onClick={close}>{locale === "en" ? "Return to operation" : "Вернуться к операции"}</button>
              {entry.materialRef && <button className="primary-cta" onClick={() => openMaterial(entry.materialRef!)}>{locale === "en" ? "Open linked material" : "Открыть связанный материал"}<Icon name="arrow"/></button>}
            </div>
          </article>
        </div>
      </section>
    </div>
  );
}

function MetricPanel({ locale, metrics, compact = false }: { locale: Locale; metrics: Record<MetricKey, number>; compact?: boolean }) {
  return <div className={`metric-panel ${compact ? "compact" : ""}`}>{(Object.keys(metrics) as MetricKey[]).map((key) => <div key={key} className={`metric metric-${key}`}><div><span>{metricLabels[locale][key]}</span><b>{metrics[key]}</b></div><i><em style={{ width: `${metrics[key]}%` }}/></i></div>)}</div>;
}

function RunLedgerPanel({ locale, ledger, day }: { locale: Locale; ledger: RunLedger; day: number }) {
  const en = locale === "en";
  const remaining = ledger.authorizedBudgetEur > 0 ? ledger.authorizedBudgetEur - ledger.spendEur : null;
  return <section className="run-ledger" aria-label={en ? "Current case resources" : "Текущие ресурсы дела"}>
    {(ledger.costCoverage !== "not-authored" || ledger.spendAuthoritative) && <div className={remaining !== null && remaining < 0 ? "resource-alert" : ""}><span>{ledger.costCoverage === "complete" || ledger.spendAuthoritative ? (en ? "Total spend" : "Всего затрат") : (en ? "Known spend" : "Известные затраты")}</span><b>€ {ledger.spendEur.toLocaleString()}</b>{remaining !== null && <small>{remaining < 0 ? `${en ? "Exceeded" : "Превышение"}: € ${Math.abs(remaining).toLocaleString()}` : `${en ? "Remaining" : "Остаток"}: € ${remaining.toLocaleString()}`}</small>}</div>}
    {ledger.staminaModelled && <div className={ledger.stamina < 35 ? "resource-alert" : ""}><span>{en ? "Stamina" : "Выносливость"}</span><b>{ledger.stamina}/100</b><small>{en ? "Fatigue" : "Усталость"} {ledger.fatigue} · {en ? "strain" : "нагрузка"} {ledger.cumulativeStrain}</small></div>}
    <div><span>{en ? "Working day" : "Рабочий день"}</span><b>{String(day).padStart(2, "0")}</b><small>{en ? "Check the deadlines below" : "Проверьте сроки ниже"}</small></div>
    {ledger.billableCoverage !== "not-authored" && <div><span>{en ? "Billable time" : "Учтённое время"}</span><b>{(ledger.billableMinutes / 60).toFixed(1)} {en ? "h" : "ч"}</b><small>{ledger.billableMinutes.toLocaleString()} {en ? "min" : "мин"}</small></div>}
  </section>;
}

function DecisionModal({ locale, text, scenario, stageHeadline, option, isResult, busy, close, dispatch, advance, finalStage }: { locale: Locale; text: UiText; scenario: Scenario; stageHeadline: string; option: DecisionOption; isResult: boolean; busy: boolean; close: () => void; dispatch: () => void | Promise<void>; advance: () => void; finalStage: boolean }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const previous = document.activeElement;
    if (!dialog.open) dialog.showModal();
    return () => {
      if (dialog.open) dialog.close();
      if (previous instanceof HTMLElement && previous.isConnected) previous.focus({ preventScroll: true });
    };
  }, []);
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const active = document.activeElement;
    if (!dialog.contains(active) || active === dialog || (active instanceof HTMLButtonElement && active.disabled)) {
      (dialog.querySelector<HTMLButtonElement>("button:not(:disabled)") ?? dialog).focus({ preventScroll: true });
    }
  }, [busy, isResult]);
  const completionTime = option.completionMinuteOfDay === undefined
    ? null
    : `${String(Math.floor(option.completionMinuteOfDay / 60)).padStart(2, "0")}:${String(option.completionMinuteOfDay % 60).padStart(2, "0")}`;
  const nextWorkday = option.completionDayOffset !== undefined && option.completionDayOffset > 0;
  const authoredCost = scenario.mobileParity ? option.costAuthored === true : true;
  const workloadAuthored = option.fatigueDelta !== undefined || option.strainDelta !== undefined || option.resetsFatigue;
  const fatigueLabel = option.resetsFatigue
    ? (locale === "en" ? "fatigue reset" : "сброс усталости")
    : `${locale === "en" ? "fatigue" : "усталость"} ${(option.fatigueDelta ?? 0) >= 0 ? "+" : ""}${option.fatigueDelta ?? 0}`;
  return (
    <dialog ref={dialogRef} className="modal-backdrop decision-dialog-shell" tabIndex={-1} aria-labelledby="decision-title" aria-busy={busy}
      onCancel={(event) => { event.preventDefault(); if (!isResult && !busy) close(); }}
      onMouseDown={(event) => { if (event.target === event.currentTarget && !isResult && !busy) close(); }}>
      <section className={`decision-modal ${isResult ? "result" : ""}`}>
        {!isResult && <button className="modal-close" onClick={close} disabled={busy} aria-label={text.cancel}><Icon name="close"/></button>}
        <div className="modal-register">{isResult ? "DISPATCH RECORD" : "RESPONSE REVIEW"}<span>{scenario.caseId}</span></div>
        <div className="modal-icon"><Icon name={isResult ? "check" : "file"} size={30}/></div>
        <span className="modal-kicker">{isResult ? text.consequence : text.review}</span>
        <h2 id="decision-title">{option.label[locale]}</h2>
        <p className="modal-context">{isResult ? option.result[locale] : option.detail[locale]}</p>
        {!isResult && <div className="modal-source"><small>{locale === "en" ? "Current situation" : "Текущая ситуация"}</small><p>{stageHeadline}</p></div>}
        <dl className="decision-cost">
          <div><dt>{text.cost}</dt><dd>{authoredCost ? `EUR ${option.cost.toLocaleString()}` : (locale === "en" ? "Not specified" : "Не указана")}</dd></div>
          <div><dt>{text.duration}</dt><dd>{option.minutes} min</dd></div>
          {option.billableMinutes !== undefined && <div><dt>{locale === "en" ? "Billable time" : "Учтённое время"}</dt><dd>{option.billableMinutes} {locale === "en" ? "min" : "мин"}</dd></div>}
          {workloadAuthored && <div><dt>{locale === "en" ? "Workload" : "Нагрузка"}</dt><dd>{fatigueLabel} · {locale === "en" ? "strain" : "напряжение"} {(option.strainDelta ?? 0) >= 0 ? "+" : ""}{option.strainDelta ?? 0}</dd></div>}
          {nextWorkday && <div className="decision-calendar"><dt>{locale === "en" ? "Calendar transition" : "Переход календаря"}</dt><dd>{locale === "en" ? "Next workday" : "Следующий рабочий день"}{completionTime ? ` · ${completionTime}` : ""}</dd></div>}
        </dl>
        <div className="effect-preview">{(Object.entries(option.effects) as Array<[MetricKey, number]>).map(([key,value]) => <span key={key} className={value >= 0 ? "positive" : "negative"}>{metricLabels[locale][key]} {value >= 0 ? "+" : ""}{value}</span>)}</div>
        <div className="modal-actions">
          {!isResult && <button className="secondary-cta" onClick={close} disabled={busy}>{text.cancel}</button>}
          <button className="primary-cta" disabled={busy} onClick={isResult ? advance : dispatch}>{busy ? (locale === "en" ? "Recording…" : "Фиксация…") : isResult ? (finalStage ? text.debrief : text.continueCase) : text.confirm}<Icon name="arrow"/></button>
        </div>
      </section>
    </dialog>
  );
}

export { DecisionModal };
export default PlayView;
