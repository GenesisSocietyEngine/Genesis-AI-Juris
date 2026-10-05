"use client";

import type { AppView } from "./studio-entry";
import GenesisNavigation from "./GenesisNavigation";

export default function AppNavigation({ locale, view, studioOnly, workspaceLocation, navigate, openOperations, restoreSession, exportSession, hasActiveScenario, toggleLocale, newCase, importCase, allowDeparture }: {
  locale: "en" | "ru";
  view: AppView;
  studioOnly: boolean;
  workspaceLocation: string;
  navigate: (view: AppView) => void;
  openOperations: () => void;
  restoreSession: () => void;
  exportSession: () => void;
  hasActiveScenario: boolean;
  toggleLocale: () => void;
  allowDeparture?: () => boolean;
  newCase?: () => void;
  importCase?: () => void;
}) {
  const en = locale === "en";
  return <GenesisNavigation expandable locale={locale} location={workspaceLocation} active={view}
    onNavigate={(next) => next === "play" ? openOperations() : navigate(next as AppView)}
    onLanguage={toggleLocale}
    allowDeparture={allowDeparture} newCase={newCase} importCase={importCase}
    operationsActions={<><button type="button" onClick={restoreSession}>{en ? "Restore a play session" : "Восстановить прохождение"}</button>{hasActiveScenario && <button type="button" onClick={exportSession}>{en ? "Export play session" : "Экспорт прохождения"}</button>}</>}
    menu={<>
      <hr/>
      {studioOnly && <a href="https://www.falcon-merlin.com/" target="_top">Falcon-Merlin.com</a>}
    </>}/>;
}
