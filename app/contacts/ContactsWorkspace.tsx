"use client";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { WorkspaceIcon } from "../CaseVantIcon";
import { useNavigationController, useNavigationSession } from "../NavigationSession";
import { useInterfaceLocale, useWorkspaceLocation } from "../use-interface-locale";
import { verifiedWorkspaceCaseReturn, workspaceDestination } from "../workspace-navigation";
import WorkspaceCaseContext from "../WorkspaceCaseContext";
import StatusBadge from "../StatusBadge";
import WorkTabs from "../work/WorkTabs";
import FirmPeople from "../work/FirmPeople";
import type { FirmCase, WorkController } from "../work/work-controller";
import { ContactController } from "./contact-controller";
import {
  contactKey,
  relationships,
  type Contact,
  type ContactKind,
  type ContactStatus,
} from "./contact-model";
import { contactMessage, relationshipLabel } from "./contact-copy";
import ContactEditor from "./ContactEditor";
import workStyle from "../work/work.module.css";
import lib from "../library/library.module.css";
import styles from "./contacts.module.css";

type Props = {
  supplied?: ContactController;
  work: WorkController;
  workState: ReturnType<WorkController["getSnapshot"]>;
};
export default function ContactsWorkspace({ supplied, work, workState }: Props) {
  const navigation = useNavigationController(),
    session = useNavigationSession();
  const [controller] = useState(
    () => supplied ?? new ContactController(navigation, (path, init) => fetch(path, init)),
  );
  const state = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot);
  const [locale] = useInterfaceLocale(),
    browserLocation = useWorkspaceLocation();
  useEffect(() => controller.attach(), [controller]);
  const ready = session.phase === "ready" && !session.busy && !session.endingSession;
  const location =
    ready && workState.loaded
      ? verifiedWorkspaceCaseReturn(browserLocation, session.selected?.selection, workState.cases)
      : browserLocation;
  useEffect(() => {
    if (
      location === browserLocation ||
      window.location.pathname + window.location.search + window.location.hash !== browserLocation
    )
      return;
    window.history.replaceState(window.history.state, "", location);
    window.dispatchEvent(new Event("genesis-interface-change"));
  }, [browserLocation, location]);
  if (!ready || !session.selected) return null;
  return (
    <Directory
      key={session.actorId + session.selected.selection}
      controller={controller}
      state={state}
      locale={locale}
      location={location}
      organization={session.selected.name}
      workState={workState}
      refresh={() => {
        void controller.refresh();
        void work.refresh();
      }}
    />
  );
}
type DirectoryProps = {
  controller: ContactController;
  state: ReturnType<ContactController["getSnapshot"]>;
  locale: "en" | "ru";
  location: string;
  organization: string;
  workState: Props["workState"];
  refresh: () => void;
};
function Directory({
  controller,
  state,
  locale,
  location,
  organization,
  workState,
  refresh,
}: DirectoryProps) {
  const t = (en: string, ru: string) => (locale === "ru" ? ru : en);
  const [section, setSection] = useState<ContactKind | "participants">("person");
  const [status, setStatus] = useState<ContactStatus>("active"),
    [query, setQuery] = useState(""),
    [group, setGroup] = useState(""),
    [caseOnly, setCaseOnly] = useState(false);
  const [relationship, setRelationship] = useState("");
  const pane = useRef<HTMLElement>(null),
    results = useRef<HTMLHeadingElement>(null);
  const href = (path: string) => workspaceDestination(path, location);
  const caseId = new URL(href("/matters"), "https://workspace.invalid").searchParams.get("dossier");
  const currentCase = workState.cases.find((c) => c.id === caseId);
  const lookup = new Map(state.entries.map((c) => [c.id, c]));
  const scoped = state.entries.filter(
    (c) =>
      c.kind === section &&
      c.status === status &&
      (!currentCase || !caseOnly || c.caseIds.includes(currentCase.id)),
  );
  const groups = [...new Set(scoped.map((c) => c.group).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b, locale),
  );
  const filtered = scoped
    .filter(
      (c) =>
        (!relationship || c.relationship === relationship) &&
        (!group || c.group === group) &&
        contactKey([c.name, c.email, c.phone, c.group, lookup.get(c.companyId)?.name].join(" ")).includes(
          contactKey(query),
        ),
    )
    .sort((a, b) => a.name.localeCompare(b.name, locale) || a.id.localeCompare(b.id));
  const selected = filtered.find((c) => c.id === state.savedId);
  useEffect(() => {
    if (selected?.id) pane.current?.focus({ preventScroll: !window.matchMedia("(max-width:720px)").matches });
  }, [selected?.id]);
  const saved = state.entries.find((c) => c.id === state.savedId);
  const locked = state.saving || state.locked || Boolean(state.pending) || !state.loaded;
  const switchSection = (s: typeof section) => {
    setSection(s);
    setQuery("");
    setRelationship("");
    setGroup("");
    setStatus("active");
    setCaseOnly(false);
    controller.select("");
  };
  const showContact = (record: Contact) => {
    switchSection(record.kind);
    setStatus(record.status);
    controller.select(record.id);
  };
  const person = section === "person";
  const activeLabel = t("Active", "Активный"),
    archivedLabel = t("Archived", "В архиве");
  return (
    <main className={`${workStyle.workspace} ${lib.workspace} ${styles.workspace}`}>
      <WorkTabs active="people" locale={locale} location={location} />
      <header className={workStyle.heading}>
        <div>
          <p className={workStyle.eyebrow}>{organization}</p>
          <h1>
            <WorkspaceIcon name="people" />
            {t("Contacts", "Контакты")}
          </h1>
        </div>
        <div className={styles.commands}>
          {section !== "participants" && state.canWrite && (
            <>
              <button className={styles.primary} disabled={locked} onClick={() => controller.open(section)}>
                <WorkspaceIcon name="plus" />
                {person ? t("Add person", "Добавить человека") : t("Add company", "Добавить компанию")}
              </button>
              <button disabled={locked} onClick={() => controller.importCsv()}>
                <WorkspaceIcon name="upload" />
                {t("Import CSV", "Импорт CSV")}
              </button>
            </>
          )}
          <button disabled={state.loading || state.saving || state.locked} onClick={refresh}>
            <WorkspaceIcon name="refresh" />
            {t("Refresh", "Обновить")}
          </button>
        </div>
      </header>
      <WorkspaceCaseContext location={location} name={currentCase?.title} locale={locale} />
      <nav className={lib.tabs} aria-label={t("Contact directories", "Справочники контактов")}>
        {(
          [
            ["person", t("People", "Люди"), "account"],
            ["company", t("Companies", "Компании"), "organization"],
            ["participants", t("Case participants", "Участники дел"), "cases"],
          ] as const
        ).map(([key, label, icon]) => (
          <button
            key={key}
            aria-current={section === key ? "page" : undefined}
            disabled={Boolean(state.pending)}
            onClick={() => switchSection(key)}
          >
            <WorkspaceIcon name={icon} />
            {label}
          </button>
        ))}
      </nav>
      {!state.draft && state.issue && (
        <p role="alert" className={styles.problem}>
          {contactMessage(state.issue, locale)}
        </p>
      )}
      {!state.draft && state.pending && (
        <button disabled={state.saving || !state.loaded} onClick={() => void controller.save()}>
          {t("Check original save", "Проверить сохранение")}
        </button>
      )}
      {state.notice && (
        <div className={styles.message}>
          <span role="status">{contactMessage(state.notice, locale)}</span>
          {saved && !selected && (
            <button onClick={() => showContact(saved)}>
              {t("Open saved contact", "Открыть сохранённый контакт")}
            </button>
          )}
        </div>
      )}
      {workState.issue && (
        <p role="alert">
          {t(
            "Case links are unavailable. Refresh to check your access.",
            "Связи с делами недоступны. Обновите список для проверки доступа.",
          )}
        </p>
      )}
      {section === "participants" ? (
        <FirmPeople cases={workState.cases} loaded={workState.loaded} locale={locale} location={location} />
      ) : (
        <>
          <div className={styles.filters}>
            <label>
              {t("Search contacts", "Поиск контактов")}
              <span className={styles.search}>
                <WorkspaceIcon name="search" />
                <input
                  type="search"
                  value={query}
                  placeholder={t("Name, company, email or phone", "Имя, компания, почта или телефон")}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </span>
            </label>
            <label>
              {t("Status", "Статус")}
              <select
                value={status}
                onChange={(e) => {
                  setStatus(e.target.value as ContactStatus);
                  setGroup("");
                }}
              >
                <option value="active">{t("Active", "Активные")}</option>
                <option value="archived">{t("Archived", "В архиве")}</option>
              </select>
            </label>
            <label>
              {t("Relationship", "Отношения")}
              <select value={relationship} onChange={(e) => setRelationship(e.target.value)}>
                <option value="">{t("All relationships", "Все отношения")}</option>
                {relationships.map((value) => (
                  <option key={value} value={value}>
                    {relationshipLabel(value, locale)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              {t("Group", "Группа")}
              <select value={group} onChange={(e) => setGroup(e.target.value)}>
                <option value="">{t("All groups", "Все группы")}</option>
                {groups.map((g) => (
                  <option key={g}>{g}</option>
                ))}
              </select>
            </label>
            {currentCase && (
              <label>
                {t("Case scope", "Дела")}
                <select
                  value={caseOnly ? "current" : "all"}
                  onChange={(e) => {
                    setCaseOnly(e.target.value === "current");
                    setGroup("");
                  }}
                >
                  <option value="all">{t("Whole firm", "Вся фирма")}</option>
                  <option value="current">{t("Current case", "Текущее дело")}</option>
                </select>
              </label>
            )}
          </div>
          {state.loaded && !state.canWrite && (
            <p className={styles.muted}>{t("Read-only directory", "Справочник доступен для чтения")}</p>
          )}
          <div className={styles.panes}>
            <section className={styles.list} aria-label={t("Contact list", "Список контактов")}>
              <h2 ref={results} tabIndex={-1}>
                {person ? t("People", "Люди") : t("Companies", "Компании")}{" "}
                <span role="status">{state.loaded ? filtered.length : "…"}</span>
              </h2>
              {state.loaded ? (
                <>
                  <ul>
                    {filtered.map((c) => (
                      <li key={c.id}>
                        <button
                          className={styles.row}
                          aria-pressed={c.id === selected?.id}
                          onClick={() => controller.select(c.id)}
                        >
                          <ContactGlyph record={c} />
                          <span>
                            <strong>{c.name}</strong>
                            <small>
                              {lookup.get(c.companyId)?.name ||
                                c.group ||
                                c.email ||
                                c.phone ||
                                (person ? t("Person", "Человек") : t("Company", "Компания"))}
                            </small>
                          </span>
                          <WorkspaceIcon name="arrow" />
                        </button>
                      </li>
                    ))}
                  </ul>
                  {!filtered.length && (
                    <p className={styles.empty}>
                      {query || group || relationship || caseOnly
                        ? t(
                            "No matching contacts. Adjust the filters to see more.",
                            "Совпадений нет. Измените фильтры.",
                          )
                        : status === "archived"
                          ? t("No archived contacts here.", "В этом разделе нет архивных контактов.")
                          : person
                            ? t("No people in the firm directory yet.", "В справочнике фирмы пока нет людей.")
                            : t(
                                "No companies in the firm directory yet.",
                                "В справочнике фирмы пока нет компаний.",
                              )}
                    </p>
                  )}
                </>
              ) : (
                <p role="status" className={styles.empty}>
                  {state.issue
                    ? t("Directory unavailable.", "Справочник недоступен.")
                    : t("Loading contacts…", "Загрузка контактов…")}
                </p>
              )}
            </section>
            <section
              className={styles.reading}
              tabIndex={-1}
              ref={pane}
              aria-label={t("Contact details", "Карточка контакта")}
            >
              {selected ? (
                <>
                  <div className={styles.profile}>
                    <ContactGlyph record={selected} />
                    <div>
                      <h2>{selected.name}</h2>
                      <StatusBadge tone={selected.status === "active" ? "completed" : "neutral"}>
                        {selected.status === "active" ? activeLabel : archivedLabel}
                      </StatusBadge>
                      {selected.relationship && (
                        <StatusBadge tone="scheduled">
                          {relationshipLabel(selected.relationship, locale)}
                        </StatusBadge>
                      )}
                    </div>
                  </div>
                  <div className={styles.commands}>
                    {state.canWrite && (
                      <>
                        {selected.status === "active" && (
                          <button disabled={locked} onClick={() => controller.open(selected.kind, selected)}>
                            {t("Edit contact", "Изменить контакт")}
                          </button>
                        )}
                        <button
                          disabled={locked}
                          onClick={() =>
                            void controller.save({
                              action: selected.status === "active" ? "archive" : "restore",
                              id: selected.id,
                              revision: selected.revision,
                            })
                          }
                        >
                          {selected.status === "active"
                            ? t("Archive", "В архив")
                            : t("Restore", "Восстановить")}
                        </button>
                      </>
                    )}
                    <button
                      onClick={() => {
                        controller.select("");
                        results.current?.focus();
                      }}
                    >
                      {t("Close details", "Закрыть карточку")}
                    </button>
                  </div>
                  <dl className={styles.details}>
                    {(
                      [
                        [t("Email", "Эл. почта"), selected.email],
                        [t("Phone", "Телефон"), selected.phone],
                        [t("Group", "Группа"), selected.group],
                        [t("Website", "Сайт"), selected.website],
                        [t("Address", "Адрес"), selected.address],
                      ] as const
                    )
                      .filter(([, v]) => v)
                      .map(([label, v]) => (
                        <div key={label}>
                          <dt>{label}</dt>
                          <dd>{v}</dd>
                        </div>
                      ))}
                    {lookup.has(selected.companyId) && (
                      <div>
                        <dt>{t("Company", "Компания")}</dt>
                        <dd>
                          <button onClick={() => showContact(lookup.get(selected.companyId)!)}>
                            {lookup.get(selected.companyId)!.name}
                          </button>
                        </dd>
                      </div>
                    )}
                  </dl>
                  {selected.kind === "company" && (
                    <CompanyPeople
                      entries={state.entries}
                      id={selected.id}
                      locale={locale}
                      select={showContact}
                    />
                  )}
                  <ContactCases
                    key={selected.id}
                    contact={selected}
                    currentCase={currentCase}
                    cases={workState.loaded ? workState.cases : []}
                    available={workState.loaded && !workState.issue}
                    canWrite={state.canWrite && !locked}
                    locale={locale}
                    href={href}
                    controller={controller}
                  />
                </>
              ) : (
                <div className={styles.emptyDetail}>
                  <WorkspaceIcon name={person ? "account" : "organization"} />
                  <p>
                    {t(
                      "Select a contact to see details and linked cases.",
                      "Выберите контакт для просмотра карточки и связанных дел.",
                    )}
                  </p>
                </div>
              )}
            </section>
          </div>
          {state.batches.length > 0 && state.canWrite && (
            <details className={styles.imports}>
              <summary>{t("Recent imports", "Недавний импорт")}</summary>
              <ul>
                {state.batches.map((b) => (
                  <li key={b.key}>
                    <span>
                      {new Date(b.at).toLocaleString(locale)} · {t("Contacts", "Контакты")} {b.count}
                    </span>
                    <button
                      disabled={locked}
                      onClick={() => void controller.save({ action: "undo", batchKey: b.key })}
                    >
                      {t("Undo import", "Отменить импорт")}
                    </button>
                  </li>
                ))}
              </ul>
            </details>
          )}
        </>
      )}
      {state.draft && <ContactEditor controller={controller} locale={locale} organization={organization} />}
    </main>
  );
}
function ContactGlyph({ record }: { record: Contact }) {
  const initials = record.name
    .split(/\s+/u)
    .slice(0, 2)
    .map((s) => Array.from(s)[0])
    .join("")
    .toUpperCase();
  return (
    <span className={styles.glyph} data-kind={record.kind} aria-hidden="true">
      {record.kind === "company" ? <WorkspaceIcon name="organization" /> : initials}
    </span>
  );
}
function CompanyPeople({
  entries,
  id,
  locale,
  select,
}: {
  entries: Contact[];
  id: string;
  locale: "en" | "ru";
  select: (c: Contact) => void;
}) {
  const people = entries.filter((c) => c.companyId === id);
  return people.length > 0 ? (
    <section>
      <h3>{locale === "ru" ? "Контакты компании" : "People at this company"}</h3>
      <ul className={styles.links}>
        {people.map((p) => (
          <li key={p.id}>
            <button onClick={() => select(p)}>
              {p.name}
              {p.status === "archived" && (locale === "ru" ? " · В архиве" : " · Archived")}
            </button>
          </li>
        ))}
      </ul>
    </section>
  ) : null;
}
function ContactCases({
  contact,
  cases,
  currentCase,
  available,
  canWrite,
  locale,
  href,
  controller,
}: {
  contact: Contact;
  cases: FirmCase[];
  currentCase?: FirmCase;
  available: boolean;
  canWrite: boolean;
  locale: "en" | "ru";
  href: (path: string) => string;
  controller: ContactController;
}) {
  const t = (en: string, ru: string) => (locale === "ru" ? ru : en);
  const linked = cases.filter((c) => contact.caseIds.includes(c.id)),
    choices = cases.filter((c) => c.canWrite && !contact.caseIds.includes(c.id));
  const [choice, setChoice] = useState("");
  const chosen = choices.some((c) => c.id === choice)
    ? choice
    : (choices.find((c) => c.id === currentCase?.id)?.id ?? "");
  const setLink = (action: "link" | "unlink", caseId: string) =>
    void controller.save({ action, id: contact.id, revision: contact.revision, caseId });
  return (
    <section className={styles.caseLinks}>
      <h3>
        <WorkspaceIcon name="cases" />
        {t("Linked cases", "Связанные дела")}
      </h3>
      {available ? (
        <>
          {linked.length ? (
            <ul className={styles.links}>
              {linked.map((c) => (
                <li key={c.id}>
                  <a
                    href={href(
                      "/matters?collection=team&section=overview&dossier=" + encodeURIComponent(c.id),
                    )}
                  >
                    {c.title}
                  </a>
                  {canWrite && c.canWrite && contact.status === "active" && (
                    <button
                      aria-label={t("Unlink", "Отвязать") + " " + c.title}
                      onClick={() => setLink("unlink", c.id)}
                    >
                      {t("Unlink", "Отвязать")}
                    </button>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p className={styles.muted}>
              {t("No linked cases visible to you.", "Среди доступных вам дел связей нет.")}
            </p>
          )}
          {canWrite && contact.status === "active" && choices.length > 0 && (
            <div className={styles.linkForm}>
              <label>
                {t("Case to link", "Дело для связи")}
                <select value={chosen} onChange={(e) => setChoice(e.target.value)}>
                  <option value="">{t("Choose a case", "Выберите дело")}</option>
                  {choices.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.title}
                      {c.id === currentCase?.id ? t(" · Current case", " · Текущее дело") : ""}
                    </option>
                  ))}
                </select>
              </label>
              <button disabled={!chosen} onClick={() => setLink("link", chosen)}>
                {t("Link case", "Связать дело")}
              </button>
            </div>
          )}
        </>
      ) : (
        <p>{t("Refresh cases to see available links.", "Обновите дела для просмотра связей.")}</p>
      )}
    </section>
  );
}
