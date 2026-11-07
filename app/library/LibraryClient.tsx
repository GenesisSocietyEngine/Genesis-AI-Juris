"use client";
import { useEffect, useState, useSyncExternalStore } from "react";
import { useNavigationController, useNavigationSession } from "../NavigationSession";
import { useInterfaceLocale, useWorkspaceLocation } from "../use-interface-locale";
import WorkspaceCaseContext from "../WorkspaceCaseContext";
import { workspaceDestination } from "../workspace-navigation";
import { WorkspaceIcon } from "../CaseVantIcon";
import WorkTabs from "../work/WorkTabs";
import { WorkController } from "../work/work-controller";
import { LibraryController } from "./library-controller";
import { verifiedLibraryReturn } from "./library-navigation";
import FirmLibrarySection from "./FirmLibrarySection";
import FirmUploadDialog, { libraryFeedback } from "./FirmUploadDialog";
import type { FirmDocument } from "./firm-document-model";
import styles from "../work/work.module.css";
import lib from "./library.module.css";

const sections = [
  ["cases", "Case documents", "Документы дел"],
  ["firm", "Firm documents", "Документы фирмы"],
  ["templates", "Templates", "Шаблоны"],
  ["demo", "Demo", "Демо"],
] as const;
export default function LibraryClient({
  controller: supplied,
  workController: suppliedWork,
}: {
  controller?: LibraryController;
  workController?: WorkController;
}) {
  const navigation = useNavigationController(),
    session = useNavigationSession();
  const [controller] = useState(
    () => supplied ?? new LibraryController(navigation, (path, init) => fetch(path, init)),
  );
  const [work] = useState(
    () => suppliedWork ?? new WorkController(navigation, (path, init) => fetch(path, init)),
  );
  const state = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot);
  const cases = useSyncExternalStore(work.subscribe, work.getSnapshot, work.getSnapshot);
  const [locale] = useInterfaceLocale(),
    browserLocation = useWorkspaceLocation(),
    [query, setQuery] = useState("");
  useEffect(() => controller.attach(), [controller]);
  useEffect(() => work.attach(), [work]);
  const location =
    session.phase === "ready" && !session.busy && !session.endingSession && cases.loaded
      ? verifiedLibraryReturn(browserLocation, session.selected?.selection, cases.cases)
      : browserLocation;
  useEffect(() => {
    const current = window.location.pathname + window.location.search + window.location.hash;
    if (current !== browserLocation || location === current) return;
    window.history.replaceState(window.history.state, "", location);
    window.dispatchEvent(new Event("genesis-interface-change"));
  }, [browserLocation, location]);
  const t = (en: string, ru: string) => (locale === "ru" ? ru : en);
  if (session.phase !== "ready" || session.endingSession || session.busy) return null;
  const url = new URL(location, "https://workspace.invalid"),
    view = sections.find(([key]) => key === url.searchParams.get("view"))?.[0] ?? "cases";
  const href = (path: string) => workspaceDestination(path, location);
  const caseId = new URL(href("/matters"), url).searchParams.get("dossier");
  const currentCase = cases.cases.find((c) => c.id === caseId),
    visible = cases.cases
      .filter((c) => c.title.toLocaleLowerCase(locale).includes(query.trim().toLocaleLowerCase(locale)))
      .sort((a, b) => Number(b.id === caseId) - Number(a.id === caseId));
  const changeView = (value: string) => {
    if (value === view) return;
    const next = new URL(window.location.href);
    next.searchParams.set("view", value);
    window.history.pushState(window.history.state, "", next);
    window.dispatchEvent(new Event("genesis-interface-change"));
    setQuery("");
  };
  const download = async (record: FirmDocument) => {
    const blob = await controller.download(record);
    if (!blob) return;
    const objectURL = URL.createObjectURL(blob),
      a = document.createElement("a");
    a.href = objectURL;
    a.download = record.filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(objectURL), 1000);
  };
  return (
    <main className={`${styles.workspace} ${lib.workspace}`}>
      <WorkTabs locale={locale} active="library" location={location} />
      <header className={styles.heading}>
        <div>
          <p className={styles.eyebrow}>{session.selected?.name}</p>
          <h1>
            <WorkspaceIcon name="document" />
            {t("Library", "Библиотека")}
          </h1>
        </div>
        <button
          disabled={state.loading || state.saving || state.locked}
          onClick={() => {
            void controller.refresh();
            void work.refresh();
          }}
        >
          {t("Refresh", "Обновить")}
        </button>
      </header>
      <WorkspaceCaseContext location={location} name={currentCase?.title} locale={locale} />
      <nav className={lib.tabs} aria-label={t("Library sections", "Разделы библиотеки")}>
        {sections.map(([key, en, ru]) => (
          <button key={key} aria-current={view === key ? "page" : undefined} onClick={() => changeView(key)}>
            {t(en, ru)}
          </button>
        ))}
      </nav>
      {view === "cases" && cases.issue && <p role="alert">{cases.issue}</p>}
      {view === "firm" && !state.draft && state.issue && (
        <p role="alert" className={lib.message}>
          {libraryFeedback(state.issue, locale)}
        </p>
      )}
      {view === "firm" && state.notice && (
        <p role="status" className={lib.message}>
          {libraryFeedback(state.notice, locale)}
        </p>
      )}
      {view === "cases" ? (
        <section>
          <h2>{t("Case documents", "Документы дел")}</h2>
          <p>
            {t(
              "Choose a case to work with its evidence, versions and reports.",
              "Выберите дело для работы с доказательствами, версиями и отчётами.",
            )}
          </p>
          <label className={lib.search}>
            {t("Find a case", "Найти дело")}
            <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} />
          </label>
          {!cases.loaded ? (
            <p role="status">
              {cases.issue
                ? t("Cases unavailable. Refresh to retry.", "Дела недоступны. Обновите.")
                : t("Loading cases…", "Загрузка дел…")}
            </p>
          ) : visible.length ? (
            <ul className={styles.workList}>
              {visible.map((c) => (
                <li key={c.id}>
                  <a
                    className={styles.workRow}
                    href={href(
                      `/matters?collection=team&dossier=${encodeURIComponent(c.id)}&section=documents`,
                    )}
                  >
                    <WorkspaceIcon name="cases" />
                    <strong>{c.title}</strong>
                    <span>
                      {c.id === caseId
                        ? t("Current case · Open documents", "Текущее дело · Открыть документы")
                        : t("Open documents", "Открыть документы")}{" "}
                      →
                    </span>
                  </a>
                </li>
              ))}
            </ul>
          ) : (
            <p>
              {query
                ? t("No matching cases.", "Подходящих дел нет.")
                : t("No accessible cases yet.", "Доступных дел пока нет.")}
            </p>
          )}
        </section>
      ) : view === "firm" ? (
        <FirmLibrarySection
          key={session.selected?.selection}
          controller={controller}
          state={state}
          locale={locale}
          download={download}
        />
      ) : view === "templates" ? (
        <section>
          <h2>{t("Templates", "Шаблоны")}</h2>
          <ul className={styles.workList}>
            <li>
              <a className={styles.workRow} href={href("/templates")}>
                <WorkspaceIcon name="template" />
                <span>
                  <strong>{t("Case templates", "Шаблоны дел")}</strong>
                  <small>
                    {t(
                      "Start AI-assisted case building from a reusable brief.",
                      "Начните создание дела с повторно используемого задания.",
                    )}
                  </small>
                </span>
              </a>
            </li>
            <li>
              <a className={styles.workRow} href={href("/work?view=templates")}>
                <WorkspaceIcon name="flow" />
                <span>
                  <strong>{t("Workflow templates", "Шаблоны процессов")}</strong>
                  <small>
                    {t(
                      "Configure task and event sequences, then apply them to a case.",
                      "Настройте последовательность задач и событий для дела.",
                    )}
                  </small>
                </span>
              </a>
            </li>
          </ul>
        </section>
      ) : (
        <section>
          <h2>{t("Demo cases", "Демо-кейсы")}</h2>
          <p>
            {t(
              "Explore sample cases and their AI workflows and outcome reports.",
              "Изучите примеры дел, ИИ-процессы и отчёты.",
            )}
          </p>
          <a href={href("/studio?view=demos")}>{t("Browse demo cases", "Открыть демо-кейсы")} →</a>
        </section>
      )}
      {state.draft && (
        <FirmUploadDialog
          controller={controller}
          state={state}
          locale={locale}
          organization={session.selected?.name ?? ""}
        />
      )}
    </main>
  );
}
