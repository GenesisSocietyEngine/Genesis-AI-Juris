import type { TaxEconomicsV1 } from "./types";

export type TaxRateInferenceContext = {
  prompt: string;
  jurisdiction: string;
  caseText?: string;
};

export type RateOrigin = "prompt" | "jurisdiction_default" | "manual";

type TaxRateOrigins = {
  baseline: RateOrigin | undefined;
  optimized: RateOrigin | undefined;
};

type RateSelection = {
  bps: number;
  origin: RateOrigin | undefined;
};

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
  const defaults = jurisdictionDefaults(context.jurisdiction, context.caseText ?? "");
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

export function manualTaxRateChange(
  model: TaxEconomicsV1,
  field: "baseline" | "optimized",
  basisPoints: number,
): Partial<TaxEconomicsV1> | null {
  const assumptions = markManualTaxRate(model, field);
  const current = field === "baseline" ? model.baselineTaxRateBps : model.optimizedTaxRateBps;
  if (current === basisPoints && assumptions === model.assumptions) return null;
  return field === "baseline"
    ? { baselineTaxRateBps: basisPoints, assumptions }
    : { optimizedTaxRateBps: basisPoints, assumptions };
}

function chooseRate(currentBps: number, currentOrigin: RateOrigin | undefined, explicitBps: number | null, fallbackBps: number | undefined): RateSelection {
  if (currentOrigin === "manual" || (!currentOrigin && currentBps !== 0)) return { bps: currentBps, origin: currentOrigin };
  if (explicitBps !== null) return { bps: explicitBps, origin: "prompt" };
  if (fallbackBps !== undefined) return { bps: fallbackBps, origin: "jurisdiction_default" };
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

function jurisdictionDefaults(jurisdiction: string, caseText: string): { baseline: number; optimized: number } | null {
  const normalizedJurisdiction = jurisdiction.toLocaleLowerCase("en").replace(/\bnew\s+england\b/gu, "");
  const propertyContext = `${jurisdiction}\n${caseText}`.toLocaleLowerCase("en");
  const ukProperty = /(?:\bengland\b|\bunited kingdom\b|\bu\.?k\.?\b)/u.test(normalizedJurisdiction)
    && /(?:\b(?:flats?|propert(?:y|ies)|real estate|rent(?:al|als|ed|ing|s)?)\b|аренд|недвижим)/u.test(propertyContext);
  if (!ukProperty) return null;
  return { baseline: 4_000, optimized: 2_500 };
}

function taxRateOrigins(assumptions: string): TaxRateOrigins {
  const match = assumptions.match(RATE_SOURCE_LINE);
  return { baseline: parseRateOrigin(match?.[1]), optimized: parseRateOrigin(match?.[2]) };
}

function parseRateOrigin(value: string | undefined): RateOrigin | undefined {
  if (value === "prompt" || value === "jurisdiction_default" || value === "manual") return value;
  return undefined;
}

function withTaxRateOrigins(assumptions: string, baseline?: RateOrigin, optimized?: RateOrigin) {
  const source = assumptions.replace(RATE_SOURCE_LINE, "").trim();
  const defaultNote = baseline === "jurisdiction_default" || optimized === "jurisdiction_default"
    ? " UK property defaults dated 2026-08-24; verify the taxpayer, profit band, finance-cost treatment and vehicle."
    : "";
  return `${source}${source ? "\n" : ""}Tax-rate sources: baseline=${baseline ?? "unset"}; optimized=${optimized ?? "unset"}.${defaultNote}`;
}
