"use client";
import { visibleActions, type ActionCollection, type QueueState } from "./action-collection";
import { formatMatterDate } from "./matter-view-model";
import type { MatterActionTarget } from "./matter-actions";

export default function MatterActionCenter({ collection, queue, onQueueChange, onOpen, onRefresh }: { collection: ActionCollection; queue: QueueState; onQueueChange: (patch: Partial<Pick<QueueState, "filter" | "showAll">>) => void; onOpen: (target: MatterActionTarget) => void; onRefresh: () => void }) {
  const visible = visibleActions(collection, queue);
  return <section id="matter-next-actions" className="action-center" aria-labelledby="matter-next-actions-title" tabIndex={-1}>
    <header><div><h2 id="matter-next-actions-title">Next actions</h2><p>Open the exact record, complete its review and return here.</p></div><span role="status">{collection.availability === "current" ? `${visible.filteredCount} in this filter · ${visible.total} total` : "Current total unavailable"}</span></header>
    <div className="action-filters" role="group" aria-label="Filter case actions">{(["all", "blocking", "review"] as const).map(filter => <button type="button" key={filter} aria-pressed={queue.filter === filter} onClick={() => onQueueChange({ filter, showAll: false })}>{filter === "all" ? "All" : filter === "blocking" ? "Blocking" : "Reviews"}</button>)}</div>
    {collection.availability !== "current" && <p role="status">These actions have not been confirmed against the complete current case. <button type="button" onClick={onRefresh}>Update case actions</button></p>}
    <div className="action-tile-grid">{visible.items.map(action => <button type="button" key={action.key} data-action-key={action.key} className="action-tile" onClick={() => onOpen({ ...action.target, originActionKey: action.key })}>
      <span className="action-tile-copy"><strong>{action.title}</strong><span>{action.reasons.map(reason => reason.explanation).join(" ")}</span><small>{[action.blocking ? "Blocking" : "Review", action.owner, action.priority, action.dueAt ? formatMatterDate(action.dueAt) : null].filter(Boolean).join(" · ")}</small></span><span className="action-tile-next">Open →</span>
    </button>)}</div>
    {visible.filteredCount > 6 && <button type="button" className="secondary-cta" onClick={() => onQueueChange({ showAll: !queue.showAll })} aria-expanded={queue.showAll}>{queue.showAll ? "Show first six" : collection.availability === "current" ? `View all ${visible.filteredCount} actions` : `View ${visible.filteredCount} loaded actions`}</button>}
    {visible.empty === "no_matches" && <p role="status">No actions in this filter. Choose All to see the remaining work.</p>}
    {visible.empty === "complete" && <p role="status">No remaining actions are reported for this revision. Independent approval is recorded separately.</p>}
  </section>;
}
