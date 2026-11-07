"use client";

import { useEffect, useRef } from "react";
import { WorkspaceIcon } from "../CaseVantIcon";
import { workspaceDestination, currentCaseOverviewDestination } from "../workspace-navigation";
import styles from "./work-tabs.module.css";

export const WORK_VIEWS = [
  { id: "home", en: "Home", ru: "Главная", icon: "home" },
  { id: "tasks", en: "Tasks", ru: "Задачи", icon: "tasks" },
  { id: "calendar", en: "Calendar", ru: "Календарь", icon: "calendar" },
  { id: "reminders", en: "Reminders", ru: "Напоминания", icon: "reminder" },
  { id: "templates", en: "Workflow templates", ru: "Шаблоны процессов", icon: "template" },
  { id: "people", en: "People", ru: "Участники", icon: "people" },
  { id: "workflows", en: "Workflows", ru: "Процессы", icon: "flow" },
  { id: "cases", en: "Case overview", ru: "Обзор дел", icon: "cases" },
  { id: "studio", en: "AI Studio", ru: "ИИ Студия", icon: "studio" },
  { id: "library", en: "Library", ru: "Библиотека", icon: "document" },
] as const;

export type WorkView = typeof WORK_VIEWS[number]["id"];

/** Local work views retain their controller. Cross-page links use the suite's departure guard. */
export default function WorkTabs({ locale, active, location, onView, onStudio, onCaseOverview }: {
  locale: "en" | "ru"; active: WorkView; location: string;
  onView?: (view: Exclude<WorkView, "studio" | "library">) => void;
  onStudio?: () => void;
  onCaseOverview?: () => void;
}) {
  const nav = useRef<HTMLElement>(null);
  useEffect(() => {
    const element = nav.current;
    if (element && element.scrollWidth > element.clientWidth) element.querySelector<HTMLElement>("[aria-current=page]")?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [active, locale]);
  const caseOverview = currentCaseOverviewDestination(location);
  return <nav ref={nav} className={styles.tabs} aria-label={locale === "en" ? "Workspace views" : "Разделы рабочего пространства"}>
    {WORK_VIEWS.map(item => {
      const content = <><WorkspaceIcon name={item.icon}/><span>{locale === "en" ? item.en : item.id === "cases" && (onCaseOverview || caseOverview) ? "Обзор дела" : item.ru}</span></>;
      if (item.id === "cases" && onCaseOverview) return <button key={item.id} type="button" aria-current={active === "cases" ? "page" : undefined} onClick={onCaseOverview}>{content}</button>;
      if (item.id === "cases" && caseOverview) return <a key={item.id} href={caseOverview}>{content}</a>;
      if (item.id === "studio" && onStudio) return <button key={item.id} type="button" aria-current={active === "studio" ? "page" : undefined} onClick={onStudio}>{content}</button>;
      if (item.id === "library") return <a key={item.id} href={active === "library" ? location : workspaceDestination("/library", location)} aria-current={active === item.id ? "page" : undefined}>{content}</a>;
      return onView && item.id !== "studio"
        ? <button key={item.id} type="button" aria-current={active === item.id ? "page" : undefined} onClick={() => onView(item.id as Exclude<WorkView, "studio" | "library">)}>{content}</button>
        : <a key={item.id} href={workspaceDestination(item.id === "studio" ? "/studio?studio_panel=workbench" : `/work?view=${item.id}`, location)} aria-current={active === item.id ? "page" : undefined}>{content}</a>;
    })}
  </nav>;
}
