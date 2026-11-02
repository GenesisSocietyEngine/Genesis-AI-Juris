"use client";

import { useRef, useState } from "react";

/** A URL is an opening intent, never authority to read or replace a case. */
export function unavailableSavedCaseId(input: { phase: string; signOutPending: boolean; currentCaseId: number | null; requested: string | null }) {
  if (input.phase !== "unavailable" || input.signOutPending || input.currentCaseId !== null || !input.requested || !/^[1-9][0-9]*$/.test(input.requested)) return null;
  const id = Number(input.requested);
  return Number.isSafeInteger(id) ? id : null;
}

export default function StudioSavedCaseAccessNotice({ id, locale, disabled, retry }: {
  id: number; locale: "en" | "ru"; disabled: boolean; retry: () => Promise<void>;
}) {
  const en = locale === "en";
  const inFlight = useRef(false);
  const [busy, setBusy] = useState(false);
  async function checkAccess() {
    if (disabled || inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    try { await retry(); }
    catch { /* Failed verification leaves the same unverified notice in place. */ }
    finally { inFlight.current = false; setBusy(false); }
  }
  return <section className="page-width learning-note" aria-labelledby="studio-saved-access-title">
    <h2 id="studio-saved-access-title">{en ? "Your saved case has not loaded" : "Сохранённый кейс ещё не загружен"}</h2>
    <p id="studio-saved-access-status" role="status">{en
      ? `Access could not be verified for saved case #${id}. Refresh access to retry opening it. Your work and saved cases have not been replaced.`
      : `Не удалось проверить доступ к сохранённому кейсу №${id}. Обновите доступ, чтобы повторить открытие. Ваша работа и сохранённые кейсы не заменены.`}</p>
    <button type="button" className="secondary-cta" disabled={disabled || busy} aria-describedby="studio-saved-access-status" onClick={() => void checkAccess()}>{busy
      ? en ? "Checking access…" : "Проверяем доступ…"
      : en ? "Refresh access" : "Обновить доступ"}</button>
  </section>;
}
