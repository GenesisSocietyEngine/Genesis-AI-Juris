/** Presentation only: Rust owns every financial calculation. Monetary wire
 * values are canonical signed i64 cents; never convert them to Number. */
export type TaxValueLanguage = "en" | "ru";
export type TaxDisplayCurrency = "EUR" | "GBP" | "USD";

const locales: Record<TaxValueLanguage, string> = { en: "en-GB", ru: "ru-RU" };
const i64Min = BigInt("-9223372036854775808"), i64Max = BigInt("9223372036854775807");
const zero = BigInt(0), hundred = BigInt(100);
const unavailable = (language: TaxValueLanguage) => language === "ru" ? "Недоступно" : "Unavailable";

function integer(value: bigint, language: TaxValueLanguage) {
  return new Intl.NumberFormat(locales[language], { maximumFractionDigits: 0 }).format(value);
}

function hundredths(value: bigint, language: TaxValueLanguage) {
  const magnitude = value < zero ? -value : value;
  return `${value < zero ? "-" : ""}${integer(magnitude / hundred, language)}${language === "ru" ? "," : "."}${(magnitude % hundred).toString().padStart(2, "0")}`;
}

export function formatTaxMoneyCents(cents: string | null, currency: string, language: TaxValueLanguage): string {
  if (currency !== "EUR" && currency !== "GBP" && currency !== "USD") throw new Error("Unsupported two-decimal tax currency");
  if (cents === null) return unavailable(language);
  if (typeof cents !== "string" || cents.length > 20 || !/^(?:0|-?[1-9][0-9]*)$/.test(cents)) throw new Error("Invalid canonical tax cents");
  const value = BigInt(cents);
  if (value < i64Min || value > i64Max) throw new Error("Tax cents exceed signed i64");
  return `${hundredths(value, language)} ${currency}`;
}

/** A basis point is one hundredth of a percentage point, including signed ROI. */
export function formatTaxBasisPoints(basisPoints: number | null, language: TaxValueLanguage): string {
  if (basisPoints === null) return unavailable(language);
  if (!Number.isInteger(basisPoints) || basisPoints < -2_147_483_648 || basisPoints > 2_147_483_647) throw new Error("Invalid signed i32 tax basis points");
  return `${hundredths(BigInt(basisPoints), language)}%`;
}

export function formatTaxMonths(months: number | null, language: TaxValueLanguage): string {
  if (months === null) return unavailable(language);
  if (!Number.isInteger(months) || months < 0 || months > 4_294_967_295) throw new Error("Invalid unsigned tax months");
  return `${integer(BigInt(months), language)} ${language === "ru" ? "мес." : months === 1 ? "month" : "months"}`;
}
