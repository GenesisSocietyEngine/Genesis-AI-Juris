import { useEffect, useState, type ComponentType } from "react";
import { withLocalChunkRecovery } from "./stale-chunk-recovery";
import type { StudioRelationRuleEditorProps } from "./StudioRelationRuleEditor";

export async function loadStudioOptionEditor<T>(load: () => Promise<T>, active: () => boolean, loaded: (module: T) => void, failed: () => void) {
  try {
    const loadedModule = await withLocalChunkRecovery(load);
    if (active()) loaded(loadedModule);
  } catch { if (active()) failed(); }
}

/** An optional editor load may fail; it must never reload or replace the open case. */
export default function StudioRelationRuleEditorLoader(props: StudioRelationRuleEditorProps) {
  const [Editor, setEditor] = useState<ComponentType<StudioRelationRuleEditorProps> | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    void loadStudioOptionEditor(() => import("./StudioRelationRuleEditor"), () => active,
      loadedModule => setEditor(() => loadedModule.default), () => setFailed(true));
    return () => { active = false; };
  }, [attempt]);
  if (Editor) return <Editor {...props}/>;
  return <div className="relation-rule-editor studio-option-load" role={failed ? "alert" : "status"}>
    <p>{failed
      ? props.locale === "en" ? "The option editor could not load. Your case and unsaved edits remain open." : "Не удалось загрузить редактор варианта. Кейс и несохранённые правки остаются открытыми."
      : props.locale === "en" ? "Loading option editor…" : "Загрузка редактора варианта…"}</p>
    {failed && <button type="button" onClick={() => { setFailed(false); setAttempt(value => value + 1); }}>{props.locale === "en" ? "Retry option editor" : "Повторить загрузку редактора"}</button>}
  </div>;
}
