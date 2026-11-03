"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { materialHash, type StudioMaterialCitation } from "./studio-materials";
import styles from "./studio-evidence-workspace.module.css";

export default function StudioCitedPassages({ citations, context, locale, onReturnToFinding }: {
  citations: StudioMaterialCitation[]; context: object; locale: "en" | "ru"; onReturnToFinding?: () => void;
}) {
  const root = useRef<HTMLElement>(null);
  const passage = useRef<HTMLElement>(null);
  const currentContext = useRef<object | null>(context);
  const currentReading = useRef<{ context: object; id: string; text: string } | null>(null);
  useLayoutEffect(() => { currentContext.current = context; return () => { currentContext.current = null; }; }, [context]);
  const [reading, setReading] = useState<{ context: object; id: string; text: string; trigger: HTMLButtonElement } | null>(null);
  const [integrity, setIntegrity] = useState<{ context: object; id: string; text: string; hash: string | null } | null>(null);
  const citation = reading?.context === context ? citations.find(item => item.id === reading.id && item.text === reading.text) : undefined;
  const active = citation?.text !== null && citation ? citation : undefined;
  const activeId = active?.id, activeText = active?.text;
  const t = (en: string, ru: string) => locale === "en" ? en : ru;
  useLayoutEffect(() => {
    currentReading.current = activeId && activeText != null ? { context, id: activeId, text: activeText } : null;
    if (activeText != null && passage.current) {
      passage.current.focus({ preventScroll: true });
      passage.current.scrollIntoView({ block: "start", behavior: "auto" });
    }
    return () => { currentReading.current = null; };
  }, [context, activeId, activeText]);
  useEffect(() => {
    let current = true;
    if (activeId && activeText != null) {
      const id = activeId, text = activeText;
      void materialHash(text).then(hash => { if (current) setIntegrity({ context, id, text, hash }); })
        .catch(() => { if (current) setIntegrity({ context, id, text, hash: null }); });
    }
    return () => { current = false; };
  }, [context, activeId, activeText]);
  if (!citations.length) return null;
  const shownHash = integrity?.context === context && integrity.id === active?.id && integrity.text === active?.text ? integrity : null;
  function stillReading() {
    return currentContext.current === context && currentReading.current?.context === context
      && currentReading.current.id === activeId && currentReading.current.text === activeText;
  }
  function close() {
    if (!active || !reading || !stillReading()) return;
    const trigger = reading.trigger;
    setReading(null);
    if (trigger.isConnected && root.current?.contains(trigger)) {
      trigger.focus({ preventScroll: true });
      trigger.scrollIntoView({ block: "center", behavior: "auto" });
    }
  }
  return <section ref={root} aria-label={t("Cited passages for this node", "Цитируемые фрагменты этого узла")}>
    <h4>{t("Cited passages", "Цитируемые фрагменты")}</h4>
    <p className={styles.meta}>{t("Fictional reference · English · not accepted evidence", "Вымышленный источник · английский · не принятое доказательство")}</p>
    <ul className={styles.citationList}>{citations.map(item => <li key={item.id}>
      {item.text !== null ? <button type="button" className={styles.secondary} aria-label={`${t("Read ", "Открыть ")}${item.document} v${item.version} § ${item.section}${t(" — cited passage", " — цитируемый фрагмент")}`} onClick={event => { if (currentContext.current === context) setReading({ context, id: item.id, text: item.text!, trigger: event.currentTarget }); }}>
        {t("Read ", "Открыть ")}{item.document} v{item.version} § {item.section}
      </button> : <><strong>{item.document} v{item.version} § {item.section}</strong><p>{t("Exact retained passage unavailable. No substitute version has been opened.", "Точный сохранённый фрагмент недоступен. Другая версия не была подставлена.")}</p></>}
    </li>)}</ul>
    {active && <section ref={passage} tabIndex={-1} className={`${styles.notice} ${styles.reviewTitle}`} aria-label={t("Cited passage", "Цитируемый фрагмент")}>
      <h4>{active.document} v{active.version} § {active.section}</h4>
      <p className={styles.meta}>{active.selectedInSourceScenario
        ? t("Source scenario version · reassess working changes", "Версия исходного сценария · проверьте рабочие изменения")
        : t("Other retained version · scenario unchanged", "Другая сохранённая версия · сценарий не изменён")}</p>
      <p className={styles.materialText} lang="en">{active.text}</p>
      {!active.verbatimInNode && <p>{t("Node text differs from this passage · check the link before relying on it", "Текст узла отличается · проверьте связь перед использованием")}</p>}
      <details><summary>{t("Source identity and integrity", "Идентификатор и целостность источника")}</summary>
        <p>{t("Retained fictional reference text in English. Reading it does not accept the evidence or approve the conclusion.", "Сохранённый вымышленный источник на английском. Просмотр не подтверждает доказательство и не утверждает вывод.")}</p>
        {!active.verbatimInNode && <p>{t("The full cited passage is not present verbatim in this node. Review the relationship before relying on it.", "Полный цитируемый фрагмент не содержится в узле дословно. Проверьте связь перед использованием.")}</p>}
        <p>{active.document} v{active.version} § {active.section}</p>
        <p>{t("SHA-256 of the displayed section text", "SHA-256 показанного текста фрагмента")}</p>
        <p className={styles.materialText}><code>{shownHash ? shownHash.hash ?? t("Hash unavailable", "Хеш недоступен") : t("Calculating…", "Вычисление…")}</code></p>
      </details>
      <div className={styles.actions}><button type="button" className={styles.secondary} onClick={close}>{t("Close passage", "Закрыть фрагмент")}</button>
        {onReturnToFinding && <button type="button" className={styles.primary} onClick={() => { if (active && stillReading()) onReturnToFinding(); }}>{t("← Back to review finding", "← Вернуться к замечанию")}</button>}
      </div>
    </section>}
  </section>;
}
