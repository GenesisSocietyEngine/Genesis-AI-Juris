import type { TaxEconomicsV1 } from "./types";

export type TaxRateInferenceContext = {
  prompt: string;
  jurisdiction: string;
  caseText?: string;
};

export type RateOrigin = "prompt" | "jurisdiction_default" | "manual";

const AUTO_SYNC_BLOCK = /\n*\[STUDIO REVIEWED ECONOMIC PARAMETERS — AUTO-SYNC\][\s\S]*?\[\/STUDIO REVIEWED ECONOMIC PARAMETERS\]\n*/giu;
const RATE_SOURCE_LINE = /(?:^|\n)Tax-rate sources: baseline=(prompt|jurisdiction_default|manual|unset); optimized=(prompt|jurisdiction_default|manual|unset)\.[^\n]*/u;
export function prefillTaxRates(model: TaxEconomicsV1, context: TaxRateInferenceContext): TaxEconomicsV1 {
  const sourcePrompt = context.prompt.replace(AUTO_SYNC_BLOCK, "\n");
  const explicitBaseline = labelledRate(sourcePrompt, [
    "baseline(?:\\s+tax)?\\s+rate", "base(?:\\s+tax)?\\s+rate", "current(?:\\s+tax)?\\s+rate", "pre[-\\s]?structure(?:\\s+tax)?\\s+rate",
    "базов(?:ая|ую)\\s+ставк(?:а|у)(?:\\s+налога)?", "текущ(?:ая|ую)\\s+ставк(?:а|у)(?:\\s+налога)?",
  ]);
  const explicitOptimized = labelledRate(sourcePrompt, [
    "optimi[sz]ed(?:\\s+tax)?\\s+rate", "post[-\\s]?structure(?:\\s+tax)?\\s+rate", "tax\\s+rate\\s+after\\s+optimi[sz]ation",
    "оптимизированн(?:ая|ую)\\s+ставк(?:а|у)(?:\\s+налога)?", "ставк(?:а|у)\\s+после\\s+оптимизации",
  ]);
  const defaults = jurisdictionDefaults(`${context.jurisdiction}\n${context.caseText ?? ""}`);
  const origins = taxRateOrigins(model.assumptions);
  const baseline = chooseRate(model.baselineTaxRateBps, origins.baseline, explicitBaseline, defaults?.baseline);
  const optimized = chooseRate(model.optimizedTaxRateBps, origins.optimized, explicitOptimized, defaults?.optimized);
  const assumptions = withTaxRateOrigins(model.assumptions, baseline.origin, optimized.origin);
  if (baseline.bps === model.baselineTaxRateBps && optimized.bps === model.optimizedTaxRateBps
    && assumptions === model.assumptions) return model;
  return {
    ...model,
    baselineTaxRateBps: baseline.bps,
    optimizedTaxRateBps: optimized.bps,
    assumptions,
  };
}

export function taxRateOrigin(model: TaxEconomicsV1, field: "baseline" | "optimized") {
  return taxRateOrigins(model.assumptions)[field];
}

export function markManualTaxRate(model: TaxEconomicsV1, field: "baseline" | "optimized") {
  const origins = taxRateOrigins(model.assumptions);
  origins[field] = "manual";
  return withTaxRateOrigins(model.assumptions, origins.baseline, origins.optimized);
}

function chooseRate(currentBps: number, currentOrigin: RateOrigin, explicitBps: number | null, fallbackBps: number | undefined) {
  if (currentOrigin === "manual" || (!currentOrigin && currentBps !== 0)) return { bps: currentBps, origin: currentOrigin };
  if (explicitBps !== null) return { bps: explicitBps, origin: "prompt" as const };
  if (fallbackBps !== undefined) return { bps: fallbackBps, origin: "jurisdiction_default" as const };
  return { bps: currentOrigin === "prompt" || currentOrigin === "jurisdiction_default" ? 0 : currentBps, origin: undefined };
}

function labelledRate(source: string, labels: string[]) {
  for (const label of labels) {
    const match = source.match(new RegExp(`(?:${label})\\s*(?:[:=–—-]|is|of|at|составляет|равна)?\\s*(\\d{1,3}(?:[.,]\\d{1,2})?)\\s*(?:%|percent|процент(?:а|ов)?)`, "iu"));
    if (!match) continue;
    const percent = Number(match[1].replace(",", "."));
    if (Number.isFinite(percent) && percent >= 0 && percent <= 100) return Math.round(percent * 100);
  }
  return null;
}

function jurisdictionDefaults(source: string): { baseline: number; optimized: number } | null {
  const text = source.toLocaleLowerCase("en");
  const ukProperty = /(?:england|united kingdom|\bu\.?k\.?)\b/.test(text) && /(?:flat|property|properties|real estate|rent|аренд|недвижим)/.test(text);
  if (!ukProperty) return null;
  return { baseline: 4_000, optimized: 2_500 };
}

function taxRateOrigins(assumptions: string): { baseline?: RateOrigin; optimized?: RateOrigin } {
  const match = assumptions.match(RATE_SOURCE_LINE);
  const origin = (value?: string) => value && value !== "unset" ? value as RateOrigin : undefined;
  return { baseline: origin(match?.[1]), optimized: origin(match?.[2]) };
}

function withTaxRateOrigins(assumptions: string, baseline?: RateOrigin, optimized?: RateOrigin) {
  const source = assumptions.replace(RATE_SOURCE_LINE, "").trim();
  const defaultNote = baseline === "jurisdiction_default" || optimized === "jurisdiction_default"
    ? " UK property defaults dated 2026-08-24; verify the taxpayer, profit band, finance-cost treatment and vehicle."
    : "";
  return `${source}${source ? "\n" : ""}Tax-rate sources: baseline=${baseline ?? "unset"}; optimized=${optimized ?? "unset"}.${defaultNote}`;
}
