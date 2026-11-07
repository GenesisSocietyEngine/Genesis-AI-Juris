import { WorkspaceIcon } from "./CaseVantIcon";
import { currentCaseOverviewDestination, workspaceDestination } from "./workspace-navigation";
import styles from "./library/library.module.css";
export default function WorkspaceCaseContext({
  location,
  name,
  locale,
}: {
  location: string;
  name?: string;
  locale: "en" | "ru";
}) {
  const overview = currentCaseOverviewDestination(location);
  if (!overview) return null;
  const en = locale === "en";
  return (
    <aside className={styles.context} aria-label={en ? "Current case" : "Текущее дело"}>
      <span className={styles.caseIdentity}>
        <WorkspaceIcon name="cases" />
        <strong>{name || (en ? "Current case" : "Текущее дело")}</strong>
      </span>
      <a href={overview}>{en ? "Return to case overview" : "Вернуться к обзору дела"}</a>
      <a href={workspaceDestination("/studio?studio_panel=workbench", location)}>
        {en ? "Open AI Studio" : "Открыть ИИ Студию"}
      </a>
    </aside>
  );
}
