"use client";

import type { StudioDraft } from "./types";
import type { StudioActionTarget } from "./StudioActionPanel";
import type { StudioWorkflowStep } from "./studio-workflow";
import { studioOverview, studioOverviewAction } from "./studio-overview";
import styles from "./studio-overview.module.css";

export type StudioOverviewProps = {
  draft: StudioDraft; locale: "en" | "ru";
  onStep: (step: StudioWorkflowStep) => void;
  onNode: (id: string) => void;
  onAction?: (target: StudioActionTarget) => void;
};

export default function StudioOverview({ draft, locale, onStep, onNode, onAction }: StudioOverviewProps) {
  const model = studioOverview(draft, locale);
  const t = (en: string, ru: string) => locale === "en" ? en : ru;
  const open = (target: StudioActionTarget) => onAction ? onAction(target) : onStep(target.step);
  return <section className={styles.workspace} aria-labelledby="studio-overview-title">
    <header className={styles.header}><div><p className={styles.eyebrow}>{t("CASE OVERVIEW", "ОБЗОР ДЕЛА")}</p><h2 id="studio-overview-title">{t("What needs to be decided", "Какое решение требуется")}</h2></div><span className={styles.status}>{t("Working draft", "Рабочий черновик")}</span></header>
    {model.question ? <><p className={styles.question}>{model.question.length > 650 ? `${model.question.slice(0, 650)}…` : model.question}</p>{model.question.length > 650 && <details><summary>{t("Read the full recorded context", "Прочитать весь контекст")}</summary><p className={styles.preserve}>{model.question}</p></details>}</> : <div className={styles.notice}><p>{t("Describe the decision or question to start this case.", "Опишите вопрос или требуемое решение.")}</p><button type="button" onClick={() => open({ step: 1, id: "studio-case-brief" })}>{t("Add the case question", "Добавить вопрос")}</button></div>}
    <section className={styles.recommendation} aria-labelledby="studio-recommendation-title">
      <h3 id="studio-recommendation-title">{model.recommendation.state === "prepared" ? t("Prepared scenario recommendation", "Рекомендация подготовленного сценария") : model.recommendation.state === "reassessment" ? t("Requires reassessment", "Требует пересмотра") : t("Recommendation not prepared", "Рекомендация не подготовлена")}</h3>
      {model.recommendation.state === "prepared" ? <><p lang="en">{model.recommendation.text}</p><p lang="en">{model.recommendation.basis}</p><p className={styles.muted}>{t("This exact working model matches the reference scenario. It is recorded scenario reasoning, not an executed outcome or independent approval.", "Текущая модель совпадает с эталонным сценарием. Это записанное обоснование сценария, а не результат прохождения или независимое утверждение.")}</p></> : <p>{model.recommendation.state === "reassessment" ? t("This working model differs from the prepared Canopy version. Review the changed inputs and their implications; the old recommendation is not shown as current.", "Рабочая модель отличается от подготовленной версии Canopy. Проверьте изменения и их влияние: прежняя рекомендация не показана как актуальная.") : t("Review the evidence and compare the possible outcomes before recording a recommendation. The first outcome in a graph is not a selected decision.", "Проверьте основания и сравните возможные исходы перед подготовкой рекомендации. Первый исход на схеме не является выбранным решением.")}</p>}
      <button type="button" onClick={() => onStep(3)}>{t("Inspect sources and evidence", "Проверить источники и материалы")}</button>
    </section>
    {model.recommendation.conditions && <section className={styles.block}><h3>{t("Basis and unresolved conditions", "Основания и нерешённые условия")}</h3><p lang="en">{model.recommendation.conditions}</p></section>}
    <div className={styles.columns}>
      <section className={styles.block}><h3>{t("Next actions", "Следующие действия")}</h3>{model.blockers.length ? <ul className={styles.actions}>{model.blockers.map((check, index) => <li key={check.id ?? index}><p>{check.text}</p><button type="button" onClick={() => open(studioOverviewAction(draft, check))}>{t("Open the relevant control", "Открыть нужное поле")}</button></li>)}</ul> : <p>{t("Structure checks are complete. Review the underlying evidence and reasoning; completeness does not establish professional approval.", "Проверки структуры пройдены. Проверьте материалы и обоснование: полнота не означает профессионального утверждения.")}</p>}</section>
      <section className={styles.block}><h3>{t("Possible outcomes", "Возможные исходы")}</h3>{model.outcomes.length ? <ul className={styles.outcomes}>{model.outcomes.map(node => <li key={node.id}><button type="button" onClick={() => onNode(node.id)}>{node.title}</button><p>{node.detail}</p></li>)}</ul> : <><p>{t("No outcome is recorded yet.", "Исходы пока не записаны.")}</p><button type="button" onClick={() => onStep(4)}>{t("Open decision map", "Открыть карту решений")}</button></>}</section>
    </div>
    <footer className={styles.footer}><p>{t("Studio context review and structural completeness are separate from human evidence review, a completed run and approval in the case workflow.", "Проверка контекста и полноты Studio не заменяет человеческую проверку доказательств, завершённое прохождение и утверждение в деле.")}</p><button type="button" disabled={!draft.nodes.length} onClick={() => onStep(6)}>{t("Review report options", "Перейти к отчёту")}</button></footer>
  </section>;
}
