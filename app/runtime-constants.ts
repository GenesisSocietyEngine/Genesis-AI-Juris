import type { MetricKey } from "./types";

export const PRODUCT_RELEASE = "v62" as const;

export const initialMetrics: Record<MetricKey, number> = {
  position: 52,
  evidence: 46,
  trust: 50,
  exposure: 38,
};
