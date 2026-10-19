"use client";

import { useState } from "react";
import { STUDIO_NODE_MENU_PAGE_SIZE, studioNodeMenuOptions, studioNodeMenuPage } from "./studio-node-menu";
import type { StudioLink, StudioNode, StudioNodeType } from "./types";

export default function StudioNodeConnections({ nodes, links, sourceId, locale, labels, disabled, onConnect, onNode }: {
  nodes: StudioNode[]; links: StudioLink[]; sourceId: string; locale: "en" | "ru";
  labels: Record<StudioNodeType, string>; disabled: boolean;
  onConnect: (targetId: string) => string; onNode: (id: string) => void;
}) {
  const [targetId, setTargetId] = useState("");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(0);
  const [message, setMessage] = useState("");
  const en = locale === "en";
  const byId = new Map(nodes.map(node => [node.id, node]));
  const outgoing = links.filter(link => link.from === sourceId);
  const incoming = links.filter(link => link.to === sourceId);
  const connected = new Set(outgoing.map(link => link.to));
  const candidates = nodes.filter(node => node.id !== sourceId && !connected.has(node.id));
  const menu = studioNodeMenuPage(candidates, query, page);
  const target = byId.get(targetId);
  const alreadyConnected = connected.has(targetId);
  // Keep the chosen destination visible through search, paging and successful add.
  const options = studioNodeMenuOptions(menu.nodes, byId, targetId);
  return <section className="inspector-destination-picker" aria-label={en ? "Node connections" : "Связи узла"}>
    <h4>{en ? "Existing connections" : "Текущие связи"}</h4>
    <p>{en ? `${incoming.length} incoming · ${outgoing.length} outgoing` : `${incoming.length} входящих · ${outgoing.length} исходящих`}</p>
    {!incoming.length && !outgoing.length && <p>{en ? "This node has no connections yet." : "У этого узла пока нет связей."}</p>}
    {!!(incoming.length || outgoing.length) && <ul className="inspector-connections">{[...outgoing, ...incoming].map(link => {
      const isOutgoing = link.from === sourceId, other = isOutgoing ? link.to : link.from;
      return <li key={`${isOutgoing ? "out" : "in"}-${link.id}`}><span>{isOutgoing ? (en ? "To" : "К") : (en ? "From" : "От")}</span> <button type="button" disabled={!byId.has(other)} onClick={() => onNode(other)}>{byId.get(other)?.title ?? (en ? "Missing node" : "Узел отсутствует")}</button></li>;
    })}</ul>}
    <h4>{en ? "Add a connection" : "Добавить связь"}</h4>
    <p>{en ? "Choose a destination, then add it. Existing connections stay in place. Save to workspace to keep draft changes." : "Выберите назначение и добавьте связь. Текущие связи сохраняются. Сохраните изменения черновика в рабочем пространстве."}</p>
    {candidates.length > STUDIO_NODE_MENU_PAGE_SIZE && <label><span>{en ? "Find destination" : "Найти назначение"}</span><input type="search" value={query} placeholder={en ? "Title, type or ID" : "Название, тип или ID"} onChange={event => { setQuery(event.target.value); setPage(0); }}/></label>}
    <label><span>{en ? "New destination" : "Новое назначение"}</span><select id="studio-connect-node" disabled={disabled} value={target ? targetId : ""} onChange={event => { setTargetId(event.target.value); setMessage(""); }}>
      <option value="">{en ? "Choose destination…" : "Выберите узел…"}</option>
      {options.map(node => <option key={node.id} value={node.id}>{labels[node.type]} · {node.title}{connected.has(node.id) ? (en ? " — Already connected" : " — Уже связан") : ""}</option>)}
    </select></label>
    {menu.pageCount > 1 && <div className="node-menu-pagination"><span>{menu.start}–{menu.end} / {menu.total}</span><button type="button" disabled={menu.page === 0} onClick={() => setPage(menu.page - 1)} aria-label={en ? "Previous destinations" : "Предыдущие назначения"}>←</button><button type="button" disabled={menu.page >= menu.pageCount - 1} onClick={() => setPage(menu.page + 1)} aria-label={en ? "Next destinations" : "Следующие назначения"}>→</button></div>}
    {!candidates.length && <p>{en ? "No additional destinations are available." : "Дополнительных назначений нет."}</p>}
    {candidates.length > 0 && !menu.total && <p>{en ? "No matching destinations. Clear the search to see available nodes." : "Совпадений нет. Очистите поиск для просмотра доступных узлов."}</p>}
    <button type="button" className="secondary-cta" disabled={disabled || !target || alreadyConnected || links.length >= 500} onClick={() => {
      const issue = onConnect(targetId);
      setMessage(issue);
    }}>{alreadyConnected ? (en ? "Connected in draft" : "Связано в черновике") : (en ? "Add connection" : "Добавить связь")}</button>
    <p role="status" aria-live="polite">{message || (alreadyConnected ? (en ? `Connected to ${target?.title}. Save to workspace to persist draft changes.` : `Связано с «${target?.title}». Сохраните изменения в рабочем пространстве.`) : "")}</p>
    {links.length >= 500 && <p>{en ? "The 500-connection limit has been reached." : "Достигнут лимит: 500 связей."}</p>}
  </section>;
}
