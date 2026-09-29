export const REPORT_SOURCE_URL_MAX_ITEMS = 30;
export const REPORT_SOURCE_URL_MAX_LENGTH = 2_048;

export const INVALID_REPORT_SOURCE_URL_MESSAGE =
  "Remove invalid source links; report sources must be canonical HTTPS URLs without embedded credentials.";

export type SanitizedReportSourceUrls = {
  urls: string[];
  rejectedCount: number;
};

/**
 * The report boundary intentionally does not trust Studio normalization. PDF
 * annotations are active links, so every value is independently parsed,
 * canonicalized and constrained immediately before it enters a report model.
 */
export function sanitizeReportSourceUrls(value: unknown): SanitizedReportSourceUrls {
  if (value === undefined || value === null) return { urls: [], rejectedCount: 0 };
  if (!Array.isArray(value)) return { urls: [], rejectedCount: 1 };

  const urls: string[] = [];
  const seen = new Set<string>();
  let rejectedCount = 0;

  for (const candidate of value) {
    if (typeof candidate !== "string") {
      rejectedCount += 1;
      continue;
    }
    const trimmed = candidate.trim();
    if (!trimmed || trimmed.length > REPORT_SOURCE_URL_MAX_LENGTH) {
      rejectedCount += 1;
      continue;
    }

    try {
      const parsed = new URL(trimmed);
      const canonical = parsed.href;
      if (
        parsed.protocol !== "https:"
        || parsed.username !== ""
        || parsed.password !== ""
        || parsed.hostname === ""
        || parsed.origin === "null"
        || canonical.length > REPORT_SOURCE_URL_MAX_LENGTH
      ) {
        rejectedCount += 1;
        continue;
      }
      if (seen.has(canonical)) continue;
      if (urls.length >= REPORT_SOURCE_URL_MAX_ITEMS) {
        rejectedCount += 1;
        continue;
      }
      seen.add(canonical);
      urls.push(canonical);
    } catch {
      rejectedCount += 1;
    }
  }

  return { urls, rejectedCount };
}
