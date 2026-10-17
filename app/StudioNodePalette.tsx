"use client";

import type { DragEvent } from "react";
import type { StudioNodeType } from "./types";
import { Icon } from "./JurisViewShared";

export default function StudioNodePalette({ locale, types, labels, colors, canAdd, onAdd, onDragStart, onDragEnd }: {
  locale: "en" | "ru"; types: StudioNodeType[]; labels: Record<StudioNodeType, string>; colors: Record<StudioNodeType, string>;
  canAdd: boolean; onAdd: (type: StudioNodeType) => void; onDragStart: (event: DragEvent<HTMLButtonElement>, type: StudioNodeType) => void; onDragEnd: () => void;
}) {
  return (<aside className="node-palette"><div className="pane-heading"><span>{locale === "en" ? "Add node" : "Добавить узел"}</span><b>{String(types.length).padStart(2,"0")}</b></div>
    {types.map(type => <button key={type} disabled={!canAdd} draggable={canAdd} onDragStart={event => onDragStart(event, type)} onDragEnd={onDragEnd} onClick={() => onAdd(type)}><i style={{background:colors[type]}}/><span>{labels[type]}</span><Icon name="plus"/></button>)}
    <p>{locale === "en" ? "Drag a node onto the map, or click to add it in the visible centre. Changes can be undone." : "Перетащите узел на карту или нажмите, чтобы добавить его по центру. Изменения можно отменить."}</p>
  </aside>);
}
