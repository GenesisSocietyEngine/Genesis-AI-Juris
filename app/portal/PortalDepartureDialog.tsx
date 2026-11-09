"use client";
import { useId, useLayoutEffect, useRef } from "react";
import { departureChangeLabel } from "../departure-presentation";
import { portalWarning, type PortalChange } from "./departure";

/** Account/recipient switches inside the independent portal have no staff navigation rail. */
export default function PortalDepartureDialog({ locale, changes, signOut, stay, review, discard }: {
  locale: "en" | "ru"; changes: readonly PortalChange[]; signOut: boolean;
  stay: () => void; review: () => void; discard: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null), heading = useId(), description = useId();
  const en = locale === "en", copy = portalWarning[locale];
  useLayoutEffect(() => {
    const node = dialog.current;
    node?.showModal();
    return () => node?.close();
  }, []);
  function finish(action: () => void) {
    // Native close restores focus to the opener. Do this before Review moves it to the form.
    dialog.current?.close();
    action();
  }
  return <dialog ref={dialog} className="genesis-navigation-confirm" aria-labelledby={heading} aria-describedby={description}
    onCancel={event => { event.preventDefault(); finish(stay); }}>
    <h2 id={heading}>{copy.title}</h2>
    <ul id={description}>{changes.map(change => <li key={change}>{departureChangeLabel(change, locale)}</li>)}</ul>
    <p>{copy.detail}</p>
    <div>
      <button type="button" autoFocus onClick={() => finish(stay)}>{en ? "Stay here" : "Остаться"}</button>
      <button type="button" className="departure-save" onClick={() => finish(review)}>{copy.review}</button>
      <button type="button" className="departure-discard" onClick={() => finish(discard)}>
        {signOut ? (en ? "Discard and sign out" : "Отменить и выйти") : (en ? "Discard and switch" : "Отменить и перейти")}
      </button>
    </div>
  </dialog>;
}
