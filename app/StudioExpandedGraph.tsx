"use client";

import { useEffect, useId, useRef } from "react";
import type { StudioLink, StudioNode } from "./types";
import styles from "./studio-expanded-graph.module.css";

type Props = {
  /** Already projected by Studio's existing layout; this view never changes them. */
  nodes: StudioNode[];
  links: StudioLink[];
  locale: "en" | "ru";
  onClose: () => void;
  onNode: (id: string) => void;
};

const nodeWidth = 165;
function nodeHeight(node: StudioNode) {
  const lines = Math.max(1, Math.ceil(node.title.trim().length / 18));
  return Math.max(96, 40 + lines * 17);
}

/** Drawing only: preserve the supplied coordinates and each recorded relation. */
function relationPath(from: StudioNode, to: StudioNode) {
  if (Math.abs(to.x - from.x) > Math.abs(to.y - from.y)) {
    const right = to.x >= from.x;
    const startX = from.x + (right ? nodeWidth : 0), endX = to.x + (right ? 0 : nodeWidth);
    const startY = from.y + nodeHeight(from) / 2, endY = to.y + nodeHeight(to) / 2;
    const bend = Math.max(40, Math.abs(endX - startX) * .4) * (right ? 1 : -1);
    return `M ${startX} ${startY} C ${startX + bend} ${startY}, ${endX - bend} ${endY}, ${endX} ${endY}`;
  }
  const down = to.y >= from.y;
  const startX = from.x + nodeWidth / 2, endX = to.x + nodeWidth / 2;
  const startY = from.y + (down ? nodeHeight(from) : 0), endY = to.y + (down ? 0 : nodeHeight(to));
  const bend = Math.max(40, Math.abs(endY - startY) * .4) * (down ? 1 : -1);
  return `M ${startX} ${startY} C ${startX} ${startY + bend}, ${endX} ${endY - bend}, ${endX} ${endY}`;
}

export default function StudioExpandedGraph({ nodes, links, locale, onClose, onNode }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const identity = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const titleId = `expanded-map-title-${identity}`, descriptionId = `expanded-map-description-${identity}`;
  const markerId = `expanded-map-arrow-${identity}`;
  const t = (en: string, ru: string) => locale === "en" ? en : ru;
  const byId = new Map(nodes.map(node => [node.id, node]));
  const coordinatesAvailable = nodes.every(node => Number.isFinite(node.x) && Number.isFinite(node.y));
  const missing = links.filter(link => !byId.has(link.from) || !byId.has(link.to));
  const minX = Math.min(0, ...nodes.map(node => node.x)) - 80;
  const minY = Math.min(0, ...nodes.map(node => node.y)) - 80;
  const maxX = Math.max(300, ...nodes.map(node => node.x + nodeWidth)) + 80;
  const maxY = Math.max(200, ...nodes.map(node => node.y + nodeHeight(node))) + 80;

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const previous = document.activeElement;
    if (!dialog.open) dialog.showModal();
    return () => {
      if (dialog.open) dialog.close();
      if (previous instanceof HTMLElement && previous.isConnected
        && !previous.closest('[hidden], [inert], [aria-hidden="true"]')
        && previous.getClientRects().length > 0) previous.focus({ preventScroll: true });
    };
  }, []);

  function inspect(id: string) {
    if (!byId.has(id)) return;
    onClose();
    onNode(id);
  }

  return <dialog ref={dialogRef} className={styles.dialog} aria-labelledby={titleId} aria-describedby={descriptionId}
    onCancel={event => { event.preventDefault(); onClose(); }}>
    <div className={styles.content}>
      <header className={styles.header}>
        <div><h2 id={titleId}>{t("Expanded decision map", "Развёрнутая карта решений")}</h2>
          <p id={descriptionId}>{t("Read-only overview. Select a node to inspect it at full size in the case. No outcome is selected or approved by this view.", "Обзор без редактирования. Выберите узел, чтобы открыть его в деле в полном размере. Этот вид не выбирает и не утверждает исход.")}</p></div>
        <button type="button" onClick={onClose}>{t("Close expanded map", "Закрыть развёрнутую карту")}</button>
      </header>
      <div className={styles.toolbar}>
        <span>{nodes.length} {t("nodes", "узлов")} · {links.length} {t("connections", "связей")}</span>
        <label>{t("Inspect a node", "Открыть узел")}<select value="" onChange={event => inspect(event.target.value)}>
          <option value="">{t("Choose a recorded step…", "Выберите записанный этап…")}</option>
          {nodes.map((node, index) => <option key={node.id} value={node.id}>{index + 1}. {node.title || t("Untitled node", "Узел без названия")}</option>)}
        </select></label>
      </div>
      {missing.length > 0 && <p className={styles.warning} role="status">{t(`${missing.length} recorded connection(s) have a missing endpoint and cannot be drawn. Repair them in the existing case editor.`, `У ${missing.length} записанных связей отсутствует конец; их нельзя отобразить. Исправьте связи в редакторе дела.`)}</p>}
      {!nodes.length ? <p className={styles.warning}>{t("No nodes are recorded yet.", "Узлы пока не записаны.")}</p> : !coordinatesAvailable
        ? <p className={styles.warning} role="status">{t("Map coordinates are unavailable. Use the node selector to inspect the recorded content.", "Координаты карты недоступны. Откройте записанное содержание через выбор узла.")}</p>
        : <svg className={styles.map} viewBox={`${minX} ${minY} ${maxX - minX} ${maxY - minY}`} role="group" aria-label={t("Read-only decision map", "Карта решений без редактирования")}>
          <defs><marker id={markerId} markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto" markerUnits="userSpaceOnUse"><path d="M 0 0 L 8 4 L 0 8 Z" className={styles.arrow}/></marker></defs>
          {links.map(link => {
            const from = byId.get(link.from), to = byId.get(link.to);
            if (!from || !to) return null;
            const name = `${from.title} → ${to.title}${link.rule?.label ? ` · ${link.rule.label}` : ""}`;
            return <g key={link.id} data-link-id={link.id} role="img" aria-label={name}><title>{name}</title><path d={relationPath(from, to)} className={styles.relation} markerEnd={`url(#${markerId})`}/></g>;
          })}
          {nodes.map((node, index) => <g key={node.id} data-node-id={node.id} data-node-type={node.type}
            className={styles.node} transform={`translate(${node.x} ${node.y})`} role="button" tabIndex={0}
            aria-label={`${index + 1}. ${node.title || t("Untitled node", "Узел без названия")}. ${t("Open case detail", "Открыть в деле")}`}
            onClick={() => inspect(node.id)} onKeyDown={event => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); inspect(node.id); } }}>
            <title>{node.title || t("Untitled node", "Узел без названия")}</title>
            <rect width={nodeWidth} height={nodeHeight(node)} rx="8"/>
            <foreignObject x="10" y="9" width={nodeWidth - 20} height={nodeHeight(node) - 18}>
              <div className={styles.nodeText}><span>{index + 1}</span><b>{node.title || t("Untitled node", "Узел без названия")}</b></div>
            </foreignObject>
          </g>)}
        </svg>}
    </div>
  </dialog>;
}
