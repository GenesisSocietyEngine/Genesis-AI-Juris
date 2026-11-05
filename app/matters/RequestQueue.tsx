"use client";

import { useEffect, useState, type ReactNode } from "react";
import type { RequestItem } from "./matter-view-model";
import { EMPTY_REQUEST_FILTERS, REQUEST_GROUPS, requestGroup, requestResponsibleKey, selectRequestQueue } from "./request-queue";
import styles from "./request-queue.module.css";

export default function RequestQueue({ requests, focusedRequestId, locale = "en", renderRequest }: {
  requests: RequestItem[]; focusedRequestId?: string; locale?: "en" | "ru"; renderRequest: (request: RequestItem) => ReactNode;
}) {
  const en = locale === "en";
  const [filters, setFilters] = useState(EMPTY_REQUEST_FILTERS);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const timer = window.setInterval(() => setNow(Date.now()), 60_000); return () => window.clearInterval(timer); }, []);
  const visible = selectRequestQueue(requests, filters, now);
  const target = requests.find(request => request.id === focusedRequestId && !visible.includes(request));
  const owners = [...new Map(requests.map(request => [requestResponsibleKey(request), request])).entries()];
  const nameCounts = new Map<string, number>();
  for (const [, request] of owners) if (request.requestedFrom) nameCounts.set(request.requestedFrom, (nameCounts.get(request.requestedFrom) ?? 0) + 1);
  const labels = en ? { overdue: "Overdue", upcoming: "Upcoming", undated: "No valid due date", resolved: "Received, waived or cancelled", other: "Other statuses" } : { overdue: "Просрочено", upcoming: "Предстоящие", undated: "Нет корректного срока", resolved: "Получено, снято или отменено", other: "Другие статусы" };
  return <section className={styles.queue} aria-label={en ? "Information request queue" : "Очередь запросов информации"}>
    <h3>{en ? "Information requests" : "Запросы информации"}</h3>
    <p>{en ? "Receiving information does not accept its evidence. Review the linked source separately." : "Получение информации не означает принятие доказательств. Проверьте связанный источник отдельно."}</p>
    <div className={styles.filters}>
      <label>{en ? "Find a request" : "Найти запрос"}<input type="search" value={filters.query} maxLength={200} placeholder={en ? "Question, reason, person or ID" : "Вопрос, основание, имя или ID"} onChange={event => setFilters({ ...filters, query: event.target.value })}/></label>
      <label>{en ? "Status" : "Статус"}<select value={filters.status} onChange={event => setFilters({ ...filters, status: event.target.value })}>{["all", "open", "overdue", "received", "waived", "cancelled"].map((value, i) => <option key={value} value={value}>{(en ? ["All statuses", "Open", "Overdue", "Received", "Waived", "Cancelled"] : ["Все статусы", "Открыто", "Просрочено", "Получено", "Снято", "Отменено"])[i]}</option>)}</select></label>
      <label>{en ? "Priority" : "Приоритет"}<select value={filters.priority} onChange={event => setFilters({ ...filters, priority: event.target.value })}>{["all", "urgent", "high", "normal", "low"].map((value, i) => <option key={value} value={value}>{(en ? ["All priorities", "Urgent", "High", "Normal", "Low"] : ["Все приоритеты", "Срочный", "Высокий", "Обычный", "Низкий"])[i]}</option>)}</select></label>
      <label>{en ? "Responsible person" : "Ответственный"}<select value={filters.responsible} onChange={event => setFilters({ ...filters, responsible: event.target.value })}><option value="all">{en ? "Everyone" : "Все"}</option>{owners.map(([key, request]) => <option key={key} value={key}>{request.requestedFrom ?? (en ? "Not assigned" : "Не назначен")}{request.requestedFromParticipantId && (nameCounts.get(request.requestedFrom ?? "") ?? 0) > 1 ? ` · ${request.requestedFromParticipantId}` : ""}</option>)}</select></label>
      <button type="button" onClick={() => setFilters(EMPTY_REQUEST_FILTERS)}>{en ? "Clear filters" : "Сбросить фильтры"}</button>
    </div>
    <p role="status">{en ? `${visible.length} of ${requests.length} loaded requests` : `Найдено ${visible.length} из ${requests.length} загруженных запросов`}</p>
    {target && <section className={styles.target} aria-label={en ? "Opened request outside filters" : "Открытый запрос вне фильтров"}><h4>{en ? "Opened request" : "Открытый запрос"}</h4><p>{en ? "This exact request is shown separately because it does not match your filters." : "Этот запрос показан отдельно, поскольку он не соответствует фильтрам."}</p>{renderRequest(target)}</section>}
    {visible.length === 0 && <p>{requests.length ? (en ? "No matching requests. Change or clear the filters." : "Совпадений нет. Измените или сбросьте фильтры.") : (en ? "No information requests have been recorded." : "Запросы информации пока не зарегистрированы.")}</p>}
    {REQUEST_GROUPS.map(group => { const items = visible.filter(request => requestGroup(request, now) === group); return items.length ? <section key={group} className={styles.group} aria-label={labels[group]}><h4>{labels[group]} <span>{items.length}</span></h4>{items.map(renderRequest)}</section> : null; })}
  </section>;
}
