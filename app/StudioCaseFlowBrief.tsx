"use client";

import { appendCaseFlowOutline } from "./studio-case-flow-brief";
import styles from "./studio-case-flow-brief.module.css";

export default function StudioCaseFlowBrief({ prompt, locale, disabled, onPrepare, compact = false }: {
  prompt: string; locale: "en" | "ru"; disabled: boolean; onPrepare: (prompt: string) => void; compact?: boolean;
}) {
  const result = appendCaseFlowOutline(prompt, locale);
  const en = locale === "en";
  const content = <aside className={styles.brief} aria-label={en ? "Case-flow brief guide" : "Подготовка плана дела"}>
    <div><strong>{en ? "Plan the logic of your case" : "Продумайте логику дела"}</strong>
      <p>{en ? "Add an outline for objectives, evidence, dates and alternative paths. Fill it in above, then analyse and review the proposal." : "Добавьте план: цели, доказательства, даты и альтернативные пути. Заполните его выше, затем запустите анализ и проверьте предложение."}</p>
      <small>{en ? "Your existing text stays intact. Evidence references are author notes; they do not select or verify documents." : "Ваш текст сохранится. Ссылки на доказательства — заметки автора; они не выбирают и не проверяют документы."}</small>
    </div>
    <div className={styles.action}><button type="button" className="secondary-cta" disabled={disabled || result.status !== "ready"} aria-describedby="case-flow-outline-status" onClick={() => { if (!disabled && result.status === "ready") onPrepare(result.prompt); }}>
      {en ? "Add case-flow outline" : "Добавить план дела"}
    </button><small id="case-flow-outline-status" role="status">{result.status === "already_present"
      ? (en ? "Outline already in the brief. Edit it above." : "План уже добавлен. Отредактируйте его выше.")
      : result.status === "too_long"
        ? (en ? "Not enough space within the 64,000-character limit. Shorten the brief to add the outline." : "Недостаточно места в пределах 64 000 символов. Сократите описание, чтобы добавить план.")
        : (en ? "Adds editable headings; no analysis starts." : "Добавляет редактируемые заголовки; анализ не запускается.")}</small></div>
  </aside>;
  return compact ? <details className="studio-brief-guide"><summary>{en ? "Use a guided brief" : "Добавить план описания"}</summary>{content}</details> : content;
}
