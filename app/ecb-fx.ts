export type EcbReferenceRates = {
  asOf: string;
  perEuro: Record<string, number>;
};

export function parseEcbDailyReferenceRates(xml: string): EcbReferenceRates {
  const date = xml.match(/<Cube\s+time=['"](\d{4}-\d{2}-\d{2})['"]/i)?.[1] ?? "";
  const perEuro: Record<string, number> = { EUR: 1 };
  for (const match of xml.matchAll(/<Cube\s+currency=['"]([A-Z]{3})['"]\s+rate=['"]([0-9]+(?:\.[0-9]+)?)['"]\s*\/?\s*>/gi)) {
    const rate = Number(match[2]);
    if (Number.isFinite(rate) && rate > 0) perEuro[match[1].toUpperCase()] = rate;
  }
  if (!date || Object.keys(perEuro).length < 2) throw new Error("ECB reference-rate response is incomplete");
  return { asOf: date, perEuro };
}

export function ecbCrossRate(rates: EcbReferenceRates, sourceCurrency: string, targetCurrency: string) {
  const source = sourceCurrency.toUpperCase();
  const target = targetCurrency.toUpperCase();
  const sourcePerEuro = rates.perEuro[source];
  const targetPerEuro = rates.perEuro[target];
  if (!sourcePerEuro || !targetPerEuro) throw new Error("ECB reference rate is unavailable for this currency");
  return targetPerEuro / sourcePerEuro;
}
