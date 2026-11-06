import { WorkspaceIcon } from "./CaseVantIcon";
import type { StudioDraft } from "./types";
import { studioWorkbenchCounts } from "./studio-workbench";

export default function StudioWorkbenchSummary({ draft, locale, reviewCount, checking, onSources, onMap, onReview }: {
  draft: StudioDraft; locale: "en" | "ru"; reviewCount: number; checking: boolean;
  onSources: () => void; onMap: () => void; onReview: () => void;
}) {
  const en = locale === "en", counts = studioWorkbenchCounts(draft);
  const cards = [
    { label: en ? "Case records" : "Записи дела", value: counts.records, icon: "cases", tone: "blue", action: onSources },
    { label: en ? "Evidence records" : "Доказательства", value: counts.evidence, icon: "document", tone: "teal", action: onSources },
    { label: en ? "Flow connections" : "Связи в схеме", value: counts.connections, icon: "flow", tone: "purple", action: onMap },
    { label: checking ? (en ? "Checking the draft…" : "Проверка черновика…") : (en ? "Review items" : "Замечания"), value: checking ? "—" : reviewCount, icon: "tasks", tone: reviewCount ? "amber" : "teal", action: onReview },
  ];
  return <section className="studio-workbench-summary page-width" aria-label={en ? "Case indicators" : "Показатели дела"}>
    {cards.map(card => <button key={card.icon} type="button" data-tone={card.tone} onClick={card.action}><WorkspaceIcon name={card.icon}/><span><strong>{card.value}</strong><span>{card.label}</span></span></button>)}
  </section>;
}
