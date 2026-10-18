"use client";
import { useEffect, useState, type ComponentType } from "react";
import { withLocalChunkRecovery } from "./stale-chunk-recovery";

/** Late success/failure belongs only to the mounted request, never a departed case. */
export async function loadStudioPanel<T>(load: () => Promise<T>, active: () => boolean, loaded: (module: T) => void, failed: () => void) {
  try { const module = await withLocalChunkRecovery(load); if (active()) loaded(module); }
  catch { if (active()) failed(); }
}

export default function StudioDeferredPanel<P extends { locale: "en" | "ru" }>({ load, panelProps }: {
  load: () => Promise<{ default: ComponentType<P> }>; panelProps: P;
}) {
  const [Panel, setPanel] = useState<ComponentType<P> | null>(null);
  const [failed, setFailed] = useState(false), [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    void loadStudioPanel(load, () => active, module => setPanel(() => module.default), () => setFailed(true));
    return () => { active = false; };
  }, [load, attempt]);
  if (Panel) return <Panel {...panelProps}/>;
  const en = panelProps.locale === "en";
  return <div className="studio-panel-load" role={failed ? "alert" : "status"}>
    <p>{failed ? en ? "This panel could not load. Your case and unsaved edits remain open." : "Не удалось загрузить панель. Кейс и несохранённые правки остаются открытыми." : en ? "Loading panel…" : "Загрузка панели…"}</p>
    {failed && <button type="button" onClick={() => { setFailed(false); setAttempt(value => value + 1); }}>{en ? "Retry panel" : "Повторить загрузку"}</button>}
  </div>;
}
