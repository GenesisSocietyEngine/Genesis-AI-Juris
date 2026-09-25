"use client";
import { useEffect, useId, useRef, useSyncExternalStore } from "react";
import type { DispositionRecoveryController } from "./disposition-recovery-controller";
import styles from "./matters.module.css";

/** Parent owns the controller beyond panel close/reopen for this case visit. */
export default function DispositionRecovery({ controller, onReturn, signInHref, citations = [] }: { controller: DispositionRecoveryController; onReturn: () => void; signInHref: string; citations?: Array<{ id: string; label: string }> }) {
  const state = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot);
  const id = useId();
  const reasonRef = useRef<HTMLTextAreaElement>(null), alertRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (state.busy) return;
    if (state.field === "reason") reasonRef.current?.focus();
    else if (["resource_denied", "case_denied", "session_expired"].includes(state.phase)) alertRef.current?.focus();
  }, [state.phase, state.busy, state.field]);
  const hidden = !state.authorityVisible;
  const frozen = state.busy || !["editing", "validation", "conflict"].includes(state.phase);
  const draft = state.draft;
  const record = hidden ? null : state.record;
  return <section className={styles.metadataEditor} aria-labelledby={id + "-title"}>
    <h4 id={id + "-title"}>Review outcome</h4>
    {state.message && <div ref={alertRef} tabIndex={-1} role={["updated", "confirmed", "updating"].includes(state.phase) ? "status" : "alert"}><p>{state.message}</p></div>}
    {state.busy && <p role="status">{state.phase === "updating" ? "Updating case actions…" : "Checking the exact review…"}</p>}
    {state.requiresSignIn && <a href={signInHref} target="_top">Sign in with the original account</a>}
    {state.phase === "idle" && <button className={styles.secondaryButton} onClick={() => void controller.open()}>Open review →</button>}
    {hidden && !state.resourceBlocked && state.phase !== "idle" && <button disabled={state.busy} onClick={() => void controller.open()}>Check access again</button>}
    {!hidden && state.receipt && <div><p>Saved revision {state.receipt.revision}. Original dates, citation acceptance and audit history are preserved.</p>{["update_failed", "confirmed"].includes(state.phase) && <button disabled={state.busy} onClick={() => void controller.refreshCase()}>{state.phase === "confirmed" ? "Update case actions" : "Retry update"}</button>}</div>}
    {record && record.disposition != null && !state.receipt && <RecordedOutcome value={record.disposition}/>}
    {!hidden && record && draft && !state.receipt && (!record.disposition || state.operation) && <form className={styles.actionForm} onSubmit={event => { event.preventDefault(); void controller.save(); }}>
      <p>{record.record.title ?? record.record.excerpt ?? "Historical review"}{record.record.dueAt && ` · ${record.record.dueAt} (${record.record.timezone})`}</p>
      <div className={styles.consequenceBox}><strong>Effect on case readiness</strong><p>{record.readiness_effect}</p><p>{record.current_output_ids.length} current report(s) will become outdated.</p></div>
      {record.dependent_assertions.length > 0 && <div><strong>Assertions requiring separate review</strong><ul>{record.dependent_assertions.map(assertion => <li key={assertion.id}>{assertion.statement} · {assertion.status}</li>)}</ul></div>}
      <fieldset disabled={frozen} style={{ border: 0, margin: 0, padding: 0, minWidth: 0 }}>
        {record.kind === "deadline" && <label className={styles.field}><span>Outcome</span><select value={draft.status} onChange={event => controller.setDraft({ ...draft, status: event.target.value })}><option value="completed">Fulfilled</option><option value="waived">Waived</option><option value="cancelled">No longer applicable</option></select></label>}
        {citations.length > 0 && <label className={styles.field}><span>{record.kind === "citation" ? "Proposed replacement citation (optional)" : "Supporting citation (optional)"}</span><select value={draft.support} onChange={event => controller.setDraft({ ...draft, support: event.target.value })}><option value="">No citation selected</option>{citations.filter(citation => citation.id !== controller.scope.recordId).map(citation => <option key={citation.id} value={citation.id}>{citation.label}</option>)}</select><small>Selection does not automatically update dependent assertions.</small></label>}
        <label className={styles.field}><span>Reason and supporting reference</span><textarea ref={reasonRef} aria-invalid={state.field === "reason" || undefined} required minLength={5} maxLength={2000} value={draft.reason} onChange={event => controller.setDraft({ ...draft, reason: event.target.value })}/></label>
      </fieldset>
      {state.phase === "unknown" && <p>The original proposal is frozen until its outcome is resolved.</p>}
      {["editing", "validation"].includes(state.phase) && <button className={styles.primaryButton} type="submit" disabled={state.busy || !record.can_review}>Confirm and save outcome</button>}
      {!record.can_review && <p>{record.unavailable_reason ?? "Your role can inspect this record. Ask an authorized reviewer to record the outcome."}</p>}
    </form>}
    {!hidden && state.operation && state.phase === "unknown" && <div className={styles.inlineActions}>
      <button disabled={state.busy} className={styles.primaryButton} onClick={() => void controller.checkOriginal()}>Check original save</button>
      {state.replayEligible && <button disabled={state.busy} className={styles.secondaryButton} onClick={() => void controller.replayOriginal()}>Retry the identical original save</button>}
    </div>}
    {!hidden && state.phase === "conflict" && <div><p>Submitted revision: {state.operation ? JSON.parse(state.operation.body).expectedRevision : "—"}. Current reviewed revision: {record?.revision ?? "not loaded"}.</p><button disabled={state.busy} onClick={() => void controller.compareConflict()}>Load current record for comparison</button>{!record?.disposition && <button disabled={state.busy || !record || record.revision === (state.operation ? JSON.parse(state.operation.body).expectedRevision : null)} onClick={() => record && controller.confirmComparedRevision(record.revision)}>I reviewed the current record and my proposal</button>}</div>}
    {!hidden && !state.operation && !record && state.phase !== "idle" && <button disabled={state.busy} onClick={() => void controller.open()}>Retry opening the record</button>}
    <button type="button" className={styles.linkButton} onClick={onReturn}>Return to case overview</button>
  </section>;
}

function RecordedOutcome({ value }: { value: unknown }) {
  const row = value !== null && typeof value === "object" ? value as Record<string, unknown> : {};
  const text = (key: string) => typeof row[key] === "string" ? String(row[key]) : null;
  return <div className={styles.consequenceBox}><strong>Outcome already recorded</strong><p>{text("newStatus") ?? "Citation retired"}{text("occurredAt") && ` · ${text("occurredAt")}`}</p><p>{text("reason") ?? "Open the case audit to inspect the recorded reason."}</p><p>Original dates, citation acceptance and audit history are preserved. This outcome cannot be overwritten here.</p></div>;
}
