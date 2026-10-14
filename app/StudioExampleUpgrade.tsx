"use client";
import { useLayoutEffect, useMemo, useRef, useState } from "react";
import type { StudioDraft } from "./types";
import type { ExampleUpgrade } from "./example-upgrade";
import styles from "./studio-overview.module.css";

function readableContent(value: unknown): string {
  if (value === null) return "—";
  if (typeof value === "object" && value && "title" in value && "detail" in value) return String(value.title) + "\n\n" + String(value.detail);
  return typeof value === "string" ? value : JSON.stringify(value, null, 2);
}
function recordLabel(change: ExampleUpgrade["changes"][number]): string {
  const value = change.after ?? change.before;
  return typeof value === "object" && value && "title" in value ? String(value.title) : change.id.replace(/[_-]/g, " ");
}

export default function StudioExampleUpgrade({ draft, locale, authority, onUpgrade }: {
  draft: StudioDraft; locale: "en" | "ru";
  authority?: { allowed: boolean; verify: () => Promise<() => boolean> };
  onUpgrade?: (expectedFingerprint: string, next: StudioDraft) => boolean;
}) {
  const context = useMemo(() => ({ draft, authority, onUpgrade, locale }), [draft, authority, onUpgrade, locale]);
  const committed = useRef<typeof context | null>(null);
  useLayoutEffect(() => { committed.current = context; return () => { committed.current = null; }; }, [context]);
  const [result, setResult] = useState<{ context: typeof context; review?: ExampleUpgrade; notice?: string } | null>(null);
  const [busy, setBusy] = useState(false), pending = useRef(false);
  const t = (en: string, ru: string) => locale === "en" ? en : ru;
  const active = result?.context === context ? result : null;
  const allowed = Boolean(authority?.allowed && onUpgrade);
  async function run(accept: boolean) {
    if (!allowed || pending.current || committed.current !== context) return;
    pending.current = true; setBusy(true);
    const current = () => committed.current === context && Boolean(context.authority?.allowed);
    try {
      const verified = await authority!.verify();
      if (!current() || !verified()) return;
      const api = await import("./example-upgrade");
      if (accept && active?.review) {
        const next = await api.createReviewedExampleUpgrade(draft, active.review, () => current() && verified());
        if (!current() || !verified()) return;
        if (next && onUpgrade!(active.review.workingFingerprint, next)) return;
        setResult({ context, notice: t("No change was made. Check again after saving or updating your case.", "Изменений нет. Повторите проверку после сохранения или изменения дела.") });
      } else {
        const review = await api.prepareExampleUpgrade(draft);
        if (current() && verified()) setResult({ context, ...(review ? { review } : { notice: t("No supported newer template is available for this exact source. Your case remains unchanged.", "Для точного источника нет поддерживаемого нового шаблона. Дело не изменено.") }) });
      }
    } catch {
      if (current()) setResult({ context, notice: t("Comparison could not be loaded. Your case remains unchanged; try again.", "Сравнение не загружено. Дело не изменено; повторите попытку.") });
    } finally { pending.current = false; setBusy(false); }
  }
  if (!draft.exampleSource) return null;
  return <section className={styles.block} aria-labelledby="example-upgrade-title">
    <h3 id="example-upgrade-title">{t("Example template updates", "Обновления шаблона примера")}</h3>
    <p>{t("Review a newer example before opening an independent working copy. Save or export your current work first. Your edits, evidence review, tax work and approvals stay with the original case and are not transferred.", "Проверьте новый пример перед открытием независимой рабочей копии. Сначала сохраните или экспортируйте текущую работу. Ваши изменения, проверка материалов, налоговая работа и согласования остаются в исходном деле и не переносятся.")}</p>
    <button type="button" disabled={!allowed || busy} onClick={() => void run(false)}>{busy ? t("Checking…", "Проверка…") : t("Check for template updates", "Проверить обновления шаблона")}</button>
    {active?.notice && <p role="status">{active.notice}</p>}
    {active?.review && <div>
      <p>{t("Template", "Шаблон")} {active.review.fromVersion} → {active.review.toVersion}. {active.review.changes.length} {t("semantic changes", "содержательных изменений")}; {active.review.localChanges.length} {t("local differences stay in your original", "локальных отличий остаются в исходном деле")}.</p>
      <details><summary>{t("Review template changes", "Изменения шаблона")}</summary>{active.review.changes.map(change => <details key={change.area + change.id}><summary>{change.before === null ? t("Added", "Добавлено") : change.after === null ? t("Removed", "Удалено") : t("Changed", "Изменено")} · {recordLabel(change)}</summary><p>{t("Previous", "Ранее")}</p><pre className={styles.auditOriginal}>{readableContent(change.before)}</pre><p>{t("New", "Теперь")}</p><pre className={styles.auditOriginal}>{readableContent(change.after)}</pre><details><summary>{t("Inspect complete content", "Проверить полное содержание")}</summary><pre className={styles.auditOriginal}>{JSON.stringify({ before: change.before, after: change.after }, null, 2)}</pre></details></details>)}</details>
      {active.review.localChanges.length > 0 && <details><summary>{t("Review local differences that will not transfer", "Локальные отличия, которые не будут перенесены")}</summary>{active.review.localChanges.map(change => <details key={change.area + change.id}><summary>{recordLabel(change)}</summary><pre className={styles.auditOriginal}>{readableContent(change.after)}</pre></details>)}</details>}
      <div className={styles.auditFilters}><button type="button" disabled={!allowed || busy} onClick={() => void run(true)}>{t("Open updated example as a new copy", "Открыть обновлённый пример новой копией")}</button>
      <button type="button" disabled={busy} onClick={() => setResult(null)}>{t("Cancel", "Отмена")}</button></div>
    </div>}
  </section>;
}
