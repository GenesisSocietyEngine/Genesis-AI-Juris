"use client";
import {
  visibleActions,
  type ActionCollection,
  type QueueState,
} from "./action-collection";
import { formatMatterDate } from "./matter-view-model";
import type { MatterActionTarget } from "./matter-actions";
import { overviewAction } from "./overview-action-copy";

type Props = {
  collection: ActionCollection;
  queue: QueueState;
  onQueueChange: (
    patch: Partial<Pick<QueueState, "filter" | "showAll">>,
  ) => void;
  onOpen: (target: MatterActionTarget) => void;
  onRefresh: () => void;
  locale?: "en" | "ru";
  canApprove?: boolean;
};
export default function MatterActionCenter({
  collection,
  queue,
  onQueueChange,
  onOpen,
  onRefresh,
  locale = "en",
  canApprove = false,
}: Props) {
  const visible = visibleActions(collection, queue),
    t = (en: string, ru: string) => (locale === "ru" ? ru : en);
  return (
    <section
      id="matter-next-actions"
      className="action-center"
      aria-labelledby="matter-next-actions-title"
      tabIndex={-1}
    >
      <header>
        <h2 id="matter-next-actions-title">
          {t("Next actions", "Следующие действия")}
        </h2>
        <span role="status">
          {collection.availability === "current"
            ? t(
                `${visible.filteredCount} in this filter · ${visible.total} total`,
                `Показано: ${visible.filteredCount} · Всего: ${visible.total}`,
              )
            : t("Current total unavailable", "Общее количество недоступно")}
        </span>
      </header>
      <div
        className="action-filters"
        role="group"
        aria-label={t("Filter case actions", "Фильтр действий по делу")}
      >
        {(["all", "blocking", "review"] as const).map((filter) => (
          <button
            type="button"
            key={filter}
            aria-pressed={queue.filter === filter}
            onClick={() => onQueueChange({ filter, showAll: false })}
          >
            {filter === "all"
              ? t("All", "Все")
              : filter === "blocking"
                ? t("Blocking", "Препятствия")
                : t("Reviews", "Проверки")}
          </button>
        ))}
      </div>
      {collection.availability !== "current" && (
        <p role="status">
          {t(
            "Refresh the case to confirm the remaining actions.",
            "Обновите дело, чтобы проверить оставшиеся действия.",
          )}{" "}
          <button type="button" onClick={onRefresh}>
            {t("Update case actions", "Обновить действия")}
          </button>
        </p>
      )}
      <div className="action-tile-grid">
        {visible.items.map((action) => (
          <article key={action.key}>
            <button
              type="button"
              data-action-key={action.key}
              aria-label={overviewAction(
                action.title,
                action.target,
                locale,
                canApprove,
              )}
              className="action-tile"
              onClick={() =>
                onOpen({ ...action.target, originActionKey: action.key })
              }
            >
              <span className="action-tile-copy">
                <strong>
                  {overviewAction(
                    action.title,
                    action.target,
                    locale,
                    canApprove,
                  )}
                </strong>
                <small>
                  {[
                    action.blocking
                      ? t("Blocking", "Препятствие")
                      : t("Review", "Проверка"),
                    action.owner,
                    action.priority,
                    action.dueAt
                      ? formatMatterDate(action.dueAt, locale)
                      : null,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </small>
              </span>
            </button>
            {action.reasons.some(
              (r) => r.code === "REVIEWER_APPROVAL_MISSING",
            ) && (
              <p>
                {t(
                  "An independent reviewer must approve the report.",
                  "Отчёт должен утвердить независимый проверяющий.",
                )}
              </p>
            )}
            <details>
              <summary>{t("Record details", "Сведения о записи")}</summary>
              {action.reasons.map((r) => (
                <p key={r.code + r.explanation}>{r.explanation}</p>
              ))}
            </details>
          </article>
        ))}
      </div>
      {visible.filteredCount > 6 && (
        <button
          type="button"
          className="secondary-cta"
          onClick={() => onQueueChange({ showAll: !queue.showAll })}
          aria-expanded={queue.showAll}
        >
          {queue.showAll
            ? t("Show first six", "Показать первые шесть")
            : t(
                `View ${visible.filteredCount} actions`,
                `Показать действия (${visible.filteredCount})`,
              )}
        </button>
      )}
      {visible.empty === "no_matches" && (
        <p role="status">
          {t(
            "No actions in this filter. Choose All to see the remaining work.",
            "Действий по этому фильтру нет. Выберите «Все».",
          )}
        </p>
      )}
      {visible.empty === "complete" && (
        <p role="status">
          {t(
            "No remaining actions. Reviewer approval is recorded separately.",
            "Действий больше нет. Утверждение проверяющего фиксируется отдельно.",
          )}
        </p>
      )}
    </section>
  );
}
