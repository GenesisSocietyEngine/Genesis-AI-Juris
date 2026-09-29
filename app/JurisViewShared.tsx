"use client";

import type * as React from "react";
import type { Locale } from "./JurisApp";
import type { MetricKey } from "./types";

const metricLabels: Record<Locale, Record<MetricKey, string>> = {
  en: { position: "Position", evidence: "Evidence", trust: "Trust", exposure: "Exposure" },
  ru: { position: "Позиция", evidence: "Доказательства", trust: "Доверие", exposure: "Экспозиция" },
};

const iconPaths: Record<string, React.ReactNode> = {
  library: <><path d="M4 5.5h16M6 3v5M18 3v5M5 10h14v10H5z"/><path d="M9 14h6M9 17h4"/></>,
  play: <><path d="M4 19V8l8-4 8 4v11"/><path d="M8 19v-6h8v6M3 19h18"/></>,
  studio: <><path d="M6 5h4v4H6zM14 15h4v4h-4zM16 4v7M8 13v6M10 7h6M8 15h6"/></>,
  video: <><rect x="3" y="5" width="18" height="14" rx="1"/><path d="m10 9 5 3-5 3z"/></>,
  moon: <path d="M20 15.5A8 8 0 0 1 8.5 4 8.5 8.5 0 1 0 20 15.5Z"/>,
  sun: <><circle cx="12" cy="12" r="3.5"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9 7 7M17 17l2.1 2.1M19.1 4.9 17 7M7 17l-2.1 2.1"/></>,
  globe: <><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18"/></>,
  arrow: <path d="M5 12h14M14 7l5 5-5 5"/>,
  file: <><path d="M6 3h8l4 4v14H6z"/><path d="M14 3v5h5M9 12h6M9 16h6"/></>,
  alert: <><path d="m12 3 9 17H3z"/><path d="M12 9v5M12 17.5v.1"/></>,
  person: <><circle cx="12" cy="8" r="4"/><path d="M4.5 21c.8-4.3 3.3-6.5 7.5-6.5s6.7 2.2 7.5 6.5"/></>,
  close: <path d="M6 6l12 12M18 6 6 18"/>, check: <path d="m4 12 5 5L20 6"/>,
  plus: <path d="M12 5v14M5 12h14"/>,
  download: <><path d="M12 3v12M7 10l5 5 5-5M4 19h16"/></>,
  upload: <><path d="M12 16V4M7 9l5-5 5 5M4 20h16"/></>,
  save: <><path d="M5 3h12l2 2v16H5z"/><path d="M8 3v6h8V3M8 21v-7h8v7"/></>,
  reset: <><path d="M5 8V4M5 4h4"/><path d="M5.5 4.5A8 8 0 1 1 4 14"/></>,
  trash: <><path d="M4 7h16M9 7V4h6v3M7 7l1 14h8l1-14M10 11v6M14 11v6"/></>,
  spark: <><path d="m12 2 1.8 5.2L19 9l-5.2 1.8L12 16l-1.8-5.2L5 9l5.2-1.8z"/><path d="m19 15 .8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z"/></>,
};

function Icon({ name, size = 20 }: { name: string; size?: number }) {
  return <svg className="icon" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{iconPaths[name]}</svg>;
}

async function readJsonResponse<T>(response: Response): Promise<T | null> {
  if (!response.ok) return null;
  return await response.json() as T;
}

export { Icon, metricLabels, readJsonResponse };
