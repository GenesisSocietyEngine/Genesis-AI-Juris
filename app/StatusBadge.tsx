import type { ReactNode } from "react";
import { WorkspaceIcon } from "./CaseVantIcon";

export type StatusTone = "open" | "completed" | "overdue" | "today" | "scheduled" | "past" | "neutral";

export default function StatusBadge({ tone = "neutral", children }: { tone?: StatusTone; children: ReactNode }) {
  return <span className="cv-status" data-tone={tone}>
    {tone === "completed" ? <WorkspaceIcon name="check" /> : <span className="cv-status-dot" aria-hidden="true" />}
    {children}
  </span>;
}
