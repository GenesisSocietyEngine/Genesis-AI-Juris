import { savedOutcomeMessage, type SavedOutcomeState } from "./saved-outcome";
import styles from "./matters.module.css";

export default function SavedOutcomePanel({ state, recordLabel, actorName, supportLabel, onRetry, onAudit, onRecord }: {
  state: SavedOutcomeState; recordLabel: string; actorName?: string; supportLabel?: string;
  onRetry: () => void; onAudit: () => void; onRecord: () => void;
}) {
  const { receipt, phase } = state;
  const outcome = ({ completed: "Fulfilled", waived: "Waived", cancelled: "No longer applicable", retired: "Citation retired" })[receipt.outcome] ?? receipt.outcome;
  return <section className={styles.metadataEditor} aria-label="Recorded review outcome">
    <p role="status" aria-live="polite">{savedOutcomeMessage(state)}</p>
    <h3>{recordLabel}</h3>
    <dl className={styles.factList}>
      <div><dt>Recorded outcome</dt><dd>{outcome}</dd></div>
      <div><dt>Reason</dt><dd>{receipt.reason}</dd></div>
      <div><dt>Recorded by</dt><dd>{actorName ?? "Name not returned"}{receipt.actorRole ? ` · ${receipt.actorRole}` : ""}</dd></div>
      <div><dt>Recorded at</dt><dd>{receipt.occurredAt ? <time dateTime={receipt.occurredAt}>{receipt.occurredAt.replace("T", " ")}</time> : "Time not returned"}</dd></div>
      {receipt.supportingSourceId && <div><dt>Supporting reference</dt><dd>{supportLabel ?? "Citation recorded; open the reviewed record to inspect it"}</dd></div>}
    </dl>
    {receipt.kind === "citation" && <p>Dependent assertions still need separate review. Current reports remain outdated until review and regeneration are complete.</p>}
    {receipt.kind === "deadline" && <p>The original deadline and history are preserved. The key case deadline is unchanged.</p>}
    <div className={styles.inlineActions}>
      {phase === "update_failed" && <button className={styles.primaryButton} type="button" onClick={onRetry}>Retry update</button>}
      <button className={styles.secondaryButton} type="button" disabled={phase !== "updated"} onClick={onRecord}>Open reviewed record</button>
      <button className={styles.secondaryButton} type="button" disabled={phase !== "updated"} onClick={onAudit}>Open exact audit event</button>
    </div>
  </section>;
}
