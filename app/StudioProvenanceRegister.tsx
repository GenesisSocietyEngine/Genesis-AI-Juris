"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { StudioDraft } from "./types";
import type { ExampleProvenance } from "./example-provenance";
import type { ProjectionDisposition } from "./projection-audit";
import { startReportDownload } from "./report-download";
import styles from "./studio-overview.module.css";

export default function StudioProvenanceRegister({ draft, locale, onNode, authority }: {
  draft: StudioDraft; locale: "en" | "ru"; onNode: (id: string) => void;
  authority?: { allowed: boolean; verify: () => Promise<() => boolean> };
}) {
  const context = useMemo(() => ({ draft, locale, authority }), [draft, locale, authority]);
  const committed = useRef<typeof context | null>(null);
  const [result, setResult] = useState<{ context: typeof context; manifest: ExampleProvenance | null; failed?: boolean } | null>(null);
  const [filter, setFilter] = useState<"all" | ProjectionDisposition>("all");
  const [query, setQuery] = useState("");
  const [limit, setLimit] = useState(20);
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  const [notice, setNotice] = useState<{ context: typeof context; text: string } | null>(null);
  useLayoutEffect(() => { committed.current = context; return () => { committed.current = null; }; }, [context]);
  useEffect(() => {
    let cancelled = false;
    void import("./example-provenance").then(module => module.buildExampleProvenance(draft)).then(manifest => {
      if (!cancelled && committed.current === context) setResult({ context, manifest });
    }).catch(() => { if (!cancelled && committed.current === context) setResult({ context, manifest: null, failed: true }); });
    return () => { cancelled = true; };
  }, [context, draft]);
  const t = (en: string, ru: string) => locale === "en" ? en : ru;
  const labels: Record<"all" | ProjectionDisposition, string> = {
    all: t("All dispositions", "Все виды записей"), retained: t("Retained source/context", "Сохранённый источник/контекст"),
    reference_only: t("Reference only", "Только эталонный материал"), task: t("Converted planning task", "Преобразованная задача"),
    hypothetical: t("Hypothetical scenario/condition", "Гипотетический сценарий/условие"),
    excluded_gameplay: t("Excluded gameplay", "Исключённая игровая механика"), requires_review: t("Projection review required", "Требуется проверка преобразования"),
  };
  const comparison = { unchanged: t("unchanged", "без изменений"), changed: t("changed", "изменена"), missing: t("missing", "отсутствует") };
  const statement = { asserted: t("recorded assertion; not independently verified", "записанное утверждение; не проверено независимо"), assumed: t("assumption", "допущение"),
    legacy_asserted_default: t("statement status omitted in source; legacy default", "статус не указан в источнике; историческое значение по умолчанию") };
  const active = result?.context === context ? result : null;
  const manifest = active?.manifest;
  const entries = manifest?.entries.filter(entry => (filter === "all" || entry.disposition === filter)
    && (!query.trim() || [entry.sourceId, entry.path, entry.kind, entry.reason, ...entry.targets].join(" ").toLowerCase().includes(query.trim().toLowerCase()))) ?? [];
  async function download() {
    if (!authority?.allowed || pending.current || committed.current !== context) return;
    pending.current = true; setBusy(true); setNotice(null);
    try {
      const authorized = await authority.verify();
      const current = () => committed.current === context && Boolean(context.authority?.allowed) && authorized();
      if (!current()) return;
      const { prepareExampleProvenanceDownload } = await import("./example-provenance");
      const output = await prepareExampleProvenanceDownload(draft, current);
      if (!output || !current()) return;
      startReportDownload(new Blob([output.content], { type: output.mime }), output.filename);
      if (current()) setNotice({ context, text: t("Audit downloaded. No source acceptance or professional approval was recorded.", "Аудит скачан. Принятие доказательств или профессиональное утверждение не зафиксировано.") });
    } catch {
      if (committed.current === context) setNotice({ context, text: t("Audit unavailable. Verify current access and template lineage; your case is unchanged.", "Аудит недоступен. Проверьте доступ и исходную версию; кейс не изменён.") });
    } finally { pending.current = false; if (committed.current) setBusy(false); }
  }
  return <section className={styles.block} aria-labelledby="studio-provenance-title">
    <h3 id="studio-provenance-title">{t("Provenance and projection register", "Реестр происхождения и преобразования")}</h3>
    <p>{t("Read-only audit of the declared example reference. Synthetic source material, working statements and human-approved evidence remain separate. Matching a published template reference is not proof of case authorship or professional approval.", "Аудит заявленной эталонной версии без изменения кейса. Учебные источники, рабочие утверждения и принятые человеком доказательства различаются. Совпадение эталона не доказывает авторство или профессиональное утверждение.")}</p>
    {!active ? <p role="status">{t("Preparing source audit…", "Подготовка аудита источников…")}</p>
      : !manifest ? <p role="status">{active.failed ? t("The audit could not load. Your case is unchanged.", "Не удалось загрузить аудит. Кейс не изменён.")
        : t("No exact supported example reference. Historical or unrecognized cases remain readable; no current template was substituted or applied.", "Точная поддерживаемая эталонная версия не найдена. Исторический или неизвестный кейс доступен; новый шаблон не подставлен и не применён.")}</p>
        : <>
          <p><b>{t("Declared template reference", "Заявленная эталонная версия")}:</b> <code>{manifest.source.caseId}</code> v{manifest.source.version} · {manifest.source.language.toUpperCase()}</p>
          {manifest.projectionSource && <p><b>{t("Original simulation source", "Исходная симуляция")}:</b> v{manifest.projectionSource.version} · <code>{manifest.projectionSource.fingerprint}</code></p>}
          <p role="status">{t("Professional review: not recorded.", "Профессиональная проверка: не зафиксирована.")} {manifest.status.workingContentChanged
            ? t("The working model differs from its source template; review amendments.", "Рабочая модель отличается от эталона; проверьте изменения.")
            : t("The working model matches the reference content; this does not establish approval.", "Содержимое рабочей модели совпадает с эталоном; это не означает утверждение.")}</p>
          {manifest.status.integrityIssues.length > 0 && <div role="alert" className={styles.notice}>{t("Projection coverage failed; export is blocked. No case data was repaired or replaced.", "Проверка покрытия не пройдена; экспорт заблокирован. Данные кейса не исправлены и не заменены.")}<ul>{manifest.status.integrityIssues.map(issue => <li key={issue}><code>{issue}</code></li>)}</ul></div>}
          <p>{manifest.status.requiresReview} {t("source entries need projection review.", "исходных записей требуют проверки преобразования.")} {manifest.status.workingChanges} {t("changed, missing or added working records.", "изменённых, отсутствующих или добавленных рабочих записей.")}</p>
          <div className={styles.auditFilters}><label>{t("Disposition", "Вид записи")}<select value={filter} onChange={event => { setFilter(event.target.value as typeof filter); setLimit(20); }}>{Object.entries(labels).map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></label>
            <label>{t("Find source ID or graph record", "Найти ID источника или запись")}<input value={query} onChange={event => { setQuery(event.target.value); setLimit(20); }}/></label></div>
          <p role="status">{Math.min(limit, entries.length)} / {entries.length} {t("matching entries", "совпадающих записей")}</p>
          <ul className={styles.records}>{entries.slice(0, limit).map(entry => <li key={entry.path}>
            <b>{labels[entry.disposition]}</b> · <code>{entry.sourceId}</code>
            <p className={styles.muted}><code>{entry.path}</code></p><p lang="en">{entry.reason}</p>
            {entry.workingTargets.map(target => <p key={target.id}>{target.state === "missing" ? <span><code>{target.id}</code> — {t("missing from working case", "отсутствует в рабочем кейсе")}</span>
              : <button type="button" onClick={() => onNode(target.id)}>{t("Inspect working record", "Открыть рабочую запись")}: {target.id}</button>} · {t("Compared with template", "Сравнение с эталоном")}: {comparison[target.state]}{target.statementStatus ? " · " + (statement[target.statementStatus as keyof typeof statement] ?? t("unrecognized statement status; review required", "неизвестный статус; требуется проверка")) : ""}</p>)}
            <details className={styles.source}><summary>{t("Inspect original source value and hash", "Открыть исходное значение и хеш")}</summary><div className={styles.fragment}><p>{t("Authored synthetic source value, not uploaded evidence or a recorded outcome.", "Авторское учебное значение, не загруженное доказательство или зафиксированный исход.")}</p><code>{entry.sourceFingerprint}</code><pre className={styles.auditOriginal}>{JSON.stringify(entry.original, null, 2)}</pre></div></details>
          </li>)}</ul>
          {entries.length > limit && <button type="button" onClick={() => setLimit(value => value + 20)}>{t("Show 20 more entries", "Показать ещё 20 записей")}</button>}
          {manifest.workingOnlyNodeIds.length > 0 && <details className={styles.source}><summary>{t("Working additions without template attribution", "Рабочие дополнения без эталонного происхождения")}</summary><ul>{manifest.workingOnlyNodeIds.map(id => <li key={id}><button type="button" onClick={() => onNode(id)}>{id}</button></li>)}</ul></details>}
          <p><button type="button" disabled={!authority?.allowed || busy || manifest.status.integrityIssues.length > 0} onClick={() => void download()}>{busy ? t("Preparing audit…", "Подготовка аудита…") : t("Download provenance audit (JSON)", "Скачать аудит происхождения (JSON)")}</button></p>
          <p className={styles.muted}>{t("Separate audit artifact, not a Studio import package, analytical report, approved source packet or evidence-acceptance record. Original source values stay in their authored language.", "Отдельный аудит, не пакет импорта Studio, аналитический отчёт, утверждённый пакет источников или запись принятия доказательств. Исходные значения сохраняют язык оригинала.")}</p>
        </>}
    {notice?.context === context && <p role="status">{notice.text}</p>}
  </section>;
}
