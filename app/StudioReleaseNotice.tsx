"use client";

import { useEffect, useRef, useState } from "react";
import { fetchStudioRelease, studioRelease, studioReleaseKey, type StudioRelease } from "./studio-release";
import styles from "./studio-release-notice.module.css";

export type StudioReleaseNoticeProps = {
  locale: "en" | "ru"; canSave: boolean; canExport: boolean; busy: boolean;
  onSave: () => void; onExport: () => void;
};

/** No reload, persistence, draft transfer, focus change or authority decision. */
export default function StudioReleaseNotice(props: StudioReleaseNoticeProps) {
  const [available, setAvailable] = useState<StudioRelease | null>(null);
  const [dismissed, setDismissed] = useState<string | null>(null);
  const returnFocus = useRef<HTMLElement | null>(null);
  const announced = useRef<string | null>(null);
  useEffect(() => {
    const current = studioRelease();
    if (!current) return;
    const currentKey = studioReleaseKey(current);
    let disposed = false, pending = false, lastCheck = -Infinity;
    let controller: AbortController | undefined;
    let deadline: ReturnType<typeof setTimeout> | undefined;
    async function check() {
      if (disposed || pending || document.visibilityState !== "visible" || Date.now() - lastCheck < 60_000) return;
      lastCheck = Date.now(); pending = true;
      const active = new AbortController(); controller = active;
      deadline = setTimeout(() => active.abort(), 5000);
      try {
        const latest = await fetchStudioRelease(active.signal);
        if (!disposed && !active.signal.aborted && latest) {
          const key = studioReleaseKey(latest);
          if (key !== currentKey && key !== announced.current) {
            const focused = document.activeElement;
            if (focused instanceof HTMLElement && !focused.closest("[data-studio-release-notice]")) returnFocus.current = focused;
            announced.current = key;
          }
          setAvailable(key === currentKey ? null : latest);
        }
      } catch { /* Offline/failing checks leave the editor and current notice alone. */ }
      finally { clearTimeout(deadline); pending = false; }
    }
    const initial = setTimeout(() => void check(), 5000);
    const interval = setInterval(() => void check(), 300_000);
    const visible = () => { void check(); };
    window.addEventListener("focus", visible); document.addEventListener("visibilitychange", visible);
    return () => { disposed = true; controller?.abort(); clearTimeout(initial); clearTimeout(deadline); clearInterval(interval); window.removeEventListener("focus", visible); document.removeEventListener("visibilitychange", visible); };
  }, []);
  if (!available || dismissed === studioReleaseKey(available)) return null;
  return <StudioReleaseNoticeContent {...props} onDismiss={() => {
    setDismissed(studioReleaseKey(available));
    const target = returnFocus.current;
    if (target?.isConnected && target.getClientRects().length && !target.closest("[inert]")) target.focus({ preventScroll: true });
  }}/>;
}

export function StudioReleaseNoticeContent({ locale, canSave, canExport, busy, onSave, onExport, onDismiss }: StudioReleaseNoticeProps & { onDismiss: () => void }) {
  const en = locale === "en";
  return <aside data-studio-release-notice className={`${styles.notice} page-width`} aria-label={en ? "CaseVant update" : "Обновление CaseVant"}>
    <p role="status"><strong>{en ? "CaseVant has been updated." : "CaseVant обновлён."}</strong> {en ? "Your current work stays in this tab." : "Текущая работа остаётся в этой вкладке."}</p>
    <div className={styles.actions}>
      <details><summary>{en ? "Update options" : "Варианты обновления"}</summary>
        <p>{en ? "Save or export before moving. Unadded form input stays only in this tab. An export is not a confirmed workspace save." : "Перед переходом сохраните или экспортируйте кейс. Недобавленные записи форм остаются только в этой вкладке. Экспорт не подтверждает сохранение в рабочем пространстве."}</p>
        <div className={styles.actions}>
          {canSave && <button type="button" className="primary-cta" disabled={busy} onClick={onSave}>{en ? "Save current case" : "Сохранить текущий кейс"}</button>}
          {canExport && <button type="button" className="secondary-cta" disabled={busy} onClick={onExport}>{en ? "Export current case" : "Экспортировать текущий кейс"}</button>}
          <a className="secondary-cta" href={`/studio?lang=${locale}`} target="_blank" rel="noopener noreferrer">{en ? "Open updated Studio in a new tab" : "Открыть новую Studio в отдельной вкладке"}</a>
        </div>
        <p>{en ? "Reopen a confirmed saved copy from My cases in the new tab. Keep this tab until all work is preserved." : "В новой вкладке откройте подтверждённую сохранённую копию из «Моих кейсов». Не закрывайте текущую вкладку, пока вся работа не сохранена."}</p>
      </details>
      <button type="button" className="secondary-cta" onClick={onDismiss}>{en ? "Keep working" : "Продолжить работу"}</button>
    </div>
  </aside>;
}
