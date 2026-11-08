"use client";
import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { useNavigationController, useNavigationSession } from "../NavigationSession";
import { useInterfaceLocale, useWorkspaceLocation } from "../use-interface-locale";
import { CaseworkController } from "./controller";
import CaseworkEditor from "./Editor";
import { message, words } from "./presentation";
import type { Locale } from "./model";
import lib from "../library/library.module.css";
const Ctx = createContext<CaseworkController | null>(null);
export function useCasework() {
  const controller = useContext(Ctx);
  if (!controller) throw Error("Casework host missing");
  return {
    controller,
    s: useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot),
  };
}
export default function CaseworkHost({ children }: { children: ReactNode }) {
  const nav = useNavigationController(),
    session = useNavigationSession(),
    [locale] = useInterfaceLocale(),
    url = new URL(useWorkspaceLocation(), "https://workspace.invalid");
  const active =
    (url.pathname === "/work" && url.searchParams.get("view") === "progress") ||
    (url.pathname === "/library" && url.searchParams.get("view") === "templates");
  const [controller] = useState(() => new CaseworkController(nav, (p, i) => fetch(p, i)));
  const s = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot),
    detach = useRef<null | (() => void)>(null);
  useEffect(() => {
    if (active && !detach.current) detach.current = controller.attach();
  }, [active, controller]);
  useEffect(
    () => () => {
      detach.current?.();
      detach.current = null;
    },
    [controller],
  );
  return (
    <Ctx.Provider value={controller}>
      {children}
      {session.phase === "ready" && !session.endingSession && !session.busy && s.loaded && s.draft && (
        <CaseworkEditor key={s.draft.id} controller={controller} locale={locale} />
      )}
    </Ctx.Provider>
  );
}
export function Feedback({ locale }: { locale: Locale }) {
  const { controller: c, s } = useCasework(),
    t = words(locale);
  return (
    <>
      {!s.draft && s.issue && (
        <p className={lib.recovery} role="alert">
          {message(s.issue, locale)}{" "}
          {s.pending ? (
            <button disabled={s.saving || s.locked} onClick={() => void c.save()}>
              {t("Check save", "Проверить сохранение")}
            </button>
          ) : (
            s.issue === "load" && <button onClick={() => void c.refresh()}>{t("Retry", "Повторить")}</button>
          )}
        </p>
      )}
      {s.notice && (
        <p className={lib.message} role="status">
          {message(s.notice, locale)}
        </p>
      )}
      {s.loading && !s.loaded && <p role="status">{t("Loading…", "Загрузка…")}</p>}
    </>
  );
}
