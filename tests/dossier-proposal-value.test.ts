import assert from "node:assert/strict";
import test from "node:test";
import { assertionStatement } from "../app/dossier-proposal-value";
import type { JsonValue } from "../app/dossier-contract";

test("acceptance reads generated v1 statements and preserves legacy manual values", () => {
  const statement = "CaseVant v209 version two / Вторая версия.";
  const values: JsonValue[] = [statement, { statement }, { schema_version: 1, statement }];
  for (const value of values) {
    assert.equal(assertionStatement(value), statement);
  }
});

test("acceptance rejects unsupported envelopes and malformed statements", () => {
  const values: JsonValue[] = [null, [], 1, {}, { schema_version: 1 },
    { schema_version: 2, statement: "x" }, { schema_version: "1", statement: "x" },
    { statement: "x", authoritative: true }, { schema_version: 1, statement: "x", extra: true },
    { schema_version: 1, statement: "" }, { statement: "  " }, { statement: "x\u0000" }, { statement: 1 }, { statement: "x".repeat(20_001) }];
  for (const value of values) {
    assert.throws(() => assertionStatement(value));
  }
});
