"use client";
import { caseTypePlaybook } from "./case-type-playbooks";
import type { StudioDraft } from "./types";
import type { StudioCheck } from "./studio-validation";
import styles from "./studio-evidence-workspace.module.css";

export default function StudioPackageValidationCard({ locale, draft, checks, checking = false, onOpen }: {
  locale: "en" | "ru"; draft: StudioDraft; checks: StudioCheck[]; checking?: boolean; onOpen: (check: StudioCheck) => void;
}) {
  const playbook = caseTypePlaybook(draft.caseType), warnings = checks.filter(check => check.level === "warn");
  const t = (en: string, ru: string) => locale === "en" ? en : ru;
  return <section className={`${styles.surface} page-width`} aria-labelledby="package-validation-title">
    <header className={styles.header}><div><p className={styles.eyebrow}>{t("CASE COMPLETENESS", "ПОЛНОТА КЕЙСА")}</p><h2 id="package-validation-title">{t("Check the structure before review", "Проверьте структуру перед рецензией")}</h2><p>{t("These checks find missing case details and connections. They do not approve your evidence or conclusions.", "Проверки находят недостающие данные и связи. Они не утверждают доказательства или выводы.")}</p></div>{warnings.length ? <button type="button" className={styles.primary} disabled={checking} onClick={() => onOpen(warnings[0])}>{t(`Review ${warnings.length} item${warnings.length === 1 ? "" : "s"} →`, `Проверить замечания: ${warnings.length} →`)}</button> : <span role="status" className={styles.count}>{checking ? t("Checking…", "Проверяем…") : t("Structure checks complete", "Проверки структуры пройдены")}</span>}</header>
    {warnings.length > 1 && <details><summary>{t("See all outstanding checks", "Все замечания")}</summary><ul className={styles.rows}>{warnings.map((check, index) => <li key={check.id ?? index}><p>{check.text}</p><button type="button" className={styles.secondary} disabled={checking} onClick={() => onOpen(check)}>{t("Open correction →", "Открыть исправление →")}</button></li>)}</ul></details>}
    <details><summary>{t("Category guidance and expected output", "Требования категории и ожидаемый результат")}</summary><h3>{playbook.test.label[locale]}</h3><p>{playbook.summary[locale]}</p><p><strong>{t("Work towards: ", "Результат работы: ")}</strong>{playbook.primaryOutcome[locale]}</p><p>{t("Review the original sources and reasoning before professional approval.", "Проверьте исходные материалы и обоснование до профессионального утверждения.")}</p></details>
  </section>;
}
