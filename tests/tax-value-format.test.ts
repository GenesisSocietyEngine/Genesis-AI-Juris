import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { formatTaxBasisPoints, formatTaxMoneyCents, formatTaxMonths } from "../app/tax-value-format";

test("tax cents retain exact scale, negatives and signed i64 endpoints in both languages", () => {
  const cases = [
    ["0", "0.00", "0,00"],
    ["1", "0.01", "0,01"],
    ["-1", "-0.01", "-0,01"],
    ["25000000", "250,000.00", "250\u00a0000,00"],
    ["9007199254740993", "90,071,992,547,409.93", "90\u00a0071\u00a0992\u00a0547\u00a0409,93"],
    ["9223372036854775807", "92,233,720,368,547,758.07", "92\u00a0233\u00a0720\u00a0368\u00a0547\u00a0758,07"],
    ["-9223372036854775808", "-92,233,720,368,547,758.08", "-92\u00a0233\u00a0720\u00a0368\u00a0547\u00a0758,08"],
  ];
  for (const [cents, en, ru] of cases) for (const currency of ["EUR", "GBP", "USD"]) {
    assert.equal(formatTaxMoneyCents(cents, currency, "en"), `${en} ${currency}`);
    assert.equal(formatTaxMoneyCents(cents, currency, "ru"), `${ru} ${currency}`);
  }
});

test("nullable tax values are unavailable while numeric zero remains zero", () => {
  assert.equal(formatTaxMoneyCents(null, "EUR", "en"), "Unavailable");
  assert.equal(formatTaxMoneyCents(null, "EUR", "ru"), "Недоступно");
  assert.equal(formatTaxBasisPoints(null, "en"), "Unavailable");
  assert.equal(formatTaxMonths(null, "ru"), "Недоступно");
  assert.equal(formatTaxBasisPoints(0, "en"), "0.00%");
  assert.equal(formatTaxBasisPoints(-1, "en"), "-0.01%");
  assert.equal(formatTaxBasisPoints(1250, "ru"), "12,50%");
  assert.equal(formatTaxBasisPoints(-2_147_483_648, "en"), "-21,474,836.48%");
  assert.equal(formatTaxMonths(0, "en"), "0 months");
  assert.equal(formatTaxMonths(1, "en"), "1 month");
  assert.equal(formatTaxMonths(240, "ru"), "240 мес.");
});

test("malformed and unsupported values never become formatted zero or rounded money", () => {
  for (const cents of ["", "-0", "01", "+1", "1.5", "1e2", " 1", "9223372036854775808", "-9223372036854775809"]) {
    assert.throws(() => formatTaxMoneyCents(cents, "EUR", "en"));
  }
  for (const currency of ["JPY", "KWD", "eur", ""]) assert.throws(() => formatTaxMoneyCents("100", currency, "en"));
  for (const value of [NaN, Infinity, -Infinity, 1.5, 2_147_483_648, -2_147_483_649]) assert.throws(() => formatTaxBasisPoints(value, "en"));
  for (const value of [NaN, Infinity, -1, 1.5, 4_294_967_296]) assert.throws(() => formatTaxMonths(value, "en"));
});

test("the recorded Rust amounts result is displayed at the same monetary magnitude", () => {
  const corpus = JSON.parse(readFileSync(new URL("./fixtures/tax-runtime/web-corpus.json", import.meta.url), "utf8")) as { cases: { name: string; response: string }[] };
  const response = JSON.parse(corpus.cases.find(entry => entry.name === "amounts")!.response);
  const result = response.calculation.result;
  assert.equal(formatTaxMoneyCents(result.baseline_annual_tax_cost, "EUR", "en"), "250,000.00 EUR");
  assert.equal(formatTaxMoneyCents(result.annualized_net_benefit, "EUR", "en"), "49,900.00 EUR");
  assert.equal(formatTaxMoneyCents(result.lifecycle_net_benefit, "EUR", "ru"), "499\u00a0000,00 EUR");
  assert.equal(formatTaxMoneyCents(result.npv, "EUR", "en"), "346,634.95 EUR");
  assert.equal(formatTaxMoneyCents(result.effective_annual_tax_base, "EUR", "en"), "Unavailable");
  assert.equal(formatTaxBasisPoints(result.lifecycle_roi_bps, "en"), "49,900.00%");
});
