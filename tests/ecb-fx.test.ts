import assert from "node:assert/strict";
import test from "node:test";
import { ecbCrossRate, parseEcbDailyReferenceRates } from "../app/ecb-fx";

test("ECB daily XML produces deterministic EUR and cross-currency rates", () => {
  const rates = parseEcbDailyReferenceRates(`<?xml version="1.0"?><Envelope><Cube><Cube time="2026-08-21"><Cube currency="USD" rate="1.20"/><Cube currency="GBP" rate="0.80"/></Cube></Cube></Envelope>`);
  assert.equal(rates.asOf, "2026-08-21");
  assert.equal(ecbCrossRate(rates, "EUR", "GBP"), 0.8);
  assert.ok(Math.abs(ecbCrossRate(rates, "GBP", "USD") - 1.5) < 1e-12);
  assert.throws(() => ecbCrossRate(rates, "AED", "EUR"), /unavailable/);
});

test("ECB parser rejects an incomplete provider response", () => {
  assert.throws(() => parseEcbDailyReferenceRates("<Envelope />"), /incomplete/);
});
