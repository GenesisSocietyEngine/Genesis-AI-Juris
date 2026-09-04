import { ecbCrossRate, parseEcbDailyReferenceRates } from "../../../ecb-fx";

export const dynamic = "force-dynamic";
const ECB_DAILY_RATES_URL = "https://www.ecb.europa.eu/stats/eurofxref/eurofxref-daily.xml";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const sourceCurrency = (url.searchParams.get("from") ?? "").trim().toUpperCase();
  const targetCurrency = (url.searchParams.get("to") ?? "").trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(sourceCurrency) || !/^[A-Z]{3}$/.test(targetCurrency)) {
    return Response.json({ error: "Use three-letter ISO currency codes." }, { status: 400, headers: { "Cache-Control": "no-store" } });
  }
  try {
    const response = await fetch(ECB_DAILY_RATES_URL, {
      headers: { Accept: "application/xml", "User-Agent": "GENESIS-JURIS/18 ECB-reference-rates" },
      signal: AbortSignal.timeout(8_000),
    });
    if (!response.ok) throw new Error("ECB request failed");
    const rates = parseEcbDailyReferenceRates(await response.text());
    const rate = ecbCrossRate(rates, sourceCurrency, targetCurrency);
    return Response.json({ provider: "ECB", sourceCurrency, targetCurrency, rate, asOf: rates.asOf }, {
      headers: { "Cache-Control": "public, max-age=900, s-maxage=3600, stale-while-revalidate=86400" },
    });
  } catch (error) {
    const unavailable = error instanceof Error && /unavailable/.test(error.message);
    return Response.json({ error: unavailable ? error.message : "The current ECB reference rate is temporarily unavailable." }, {
      status: unavailable ? 422 : 503,
      headers: { "Cache-Control": "no-store" },
    });
  }
}
