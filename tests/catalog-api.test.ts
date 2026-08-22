import assert from "node:assert/strict";
import test from "node:test";
import {
  DEFAULT_CATALOGUE_LIMIT,
  MAX_CATALOGUE_LIMIT,
  decodeCatalogueCursor,
  encodeCatalogueCursor,
  fingerprintEtag,
  ifNoneMatchMatches,
  manifestCacheControl,
  parseCatalogueQuery,
  type CatalogueFilters,
} from "../app/api/catalog/catalog-query";

test("catalogue query defaults to a bounded first page", () => {
  const result = parseCatalogueQuery(new URLSearchParams());
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.value.limit, DEFAULT_CATALOGUE_LIMIT);
  assert.equal(result.value.cursor, null);
  assert.deepEqual(result.value.filters, { tags: [] });
});

test("catalogue query caps limits and normalizes supported filters", () => {
  const params = new URLSearchParams({
    limit: "999",
    q: "  Evidence  ",
    jurisdiction: "BE · Commercial",
    practiceArea: "Commercial disputes",
    difficulty: "Advanced",
    tags: "ERP,evidence,erp",
  });
  params.append("tag", "litigation");
  const result = parseCatalogueQuery(params);
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.value.limit, MAX_CATALOGUE_LIMIT);
  assert.deepEqual(result.value.filters, {
    q: "Evidence",
    jurisdiction: "BE · Commercial",
    practiceArea: "Commercial disputes",
    difficulty: "Advanced",
    tags: ["litigation", "ERP", "evidence"],
  });
});

test("catalogue cursors round-trip and are bound to the active filters", () => {
  const filters: CatalogueFilters = { q: "налог", jurisdiction: "Belgium · EU", tags: ["Tax", "PPT"] };
  const cursor = encodeCatalogueCursor({ id: "be_tax_case_001" }, filters);
  assert.deepEqual(decodeCatalogueCursor(cursor, filters), { id: "be_tax_case_001" });
  assert.equal(decodeCatalogueCursor(cursor, { ...filters, q: "customs" }), null);
  assert.equal(decodeCatalogueCursor(cursor, { ...filters, jurisdiction: "belgium · eu" }), null);
  assert.throws(() => encodeCatalogueCursor({ id: `${"a".repeat(129)}` }, filters), /case ID/i);

  const parsed = parseCatalogueQuery(new URLSearchParams({ q: "налог", jurisdiction: "Belgium · EU", tags: "Tax,PPT", cursor }));
  assert.equal(parsed.ok, true);
  if (parsed.ok) assert.deepEqual(parsed.value.cursor, { id: "be_tax_case_001" });
});

test("catalogue query rejects ambiguous and malformed input", () => {
  assert.equal(parseCatalogueQuery(new URLSearchParams("limit=0")).ok, false);
  assert.equal(parseCatalogueQuery(new URLSearchParams("limit=1.5")).ok, false);
  assert.equal(parseCatalogueQuery(new URLSearchParams("q=one&q=two")).ok, false);
  assert.equal(parseCatalogueQuery(new URLSearchParams({ q: "x".repeat(121) })).ok, false);
  assert.equal(parseCatalogueQuery(new URLSearchParams({ cursor: "not-a-cursor" })).ok, false);
  assert.equal(parseCatalogueQuery(new URLSearchParams({ tags: Array.from({ length: 11 }, (_, index) => `tag-${index}`).join(",") })).ok, false);
});

test("versioned manifest cache helpers produce strong validators", () => {
  const fingerprint = `sha256-${"a".repeat(64)}`;
  const etag = fingerprintEtag(fingerprint);
  assert.equal(etag, `"${fingerprint}"`);
  assert.equal(ifNoneMatchMatches(etag, etag), true);
  assert.equal(ifNoneMatchMatches(`W/${etag}`, etag), true);
  assert.equal(ifNoneMatchMatches(`"other", ${etag}`, etag), true);
  assert.equal(ifNoneMatchMatches("*", etag), true);
  assert.equal(ifNoneMatchMatches('"sha256-mismatch"', etag), false);
  assert.equal(manifestCacheControl(true), "public, max-age=31536000, immutable");
  assert.equal(manifestCacheControl(false), "public, max-age=60, stale-while-revalidate=300");
  assert.throws(() => fingerprintEtag("untrusted\r\nheader"), /fingerprint/i);
});
