import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { prepareExampleVersion } from "../app/example-registry";
import { caseFingerprint } from "../app/case-integrity";
import { createExampleWorkingCopy } from "../app/example-working-copy";

const rows = JSON.parse(readFileSync("tests/converted-example-v24-baseline.json", "utf8")) as Array<{id:string;language:"en"|"ru";version:string;fingerprint:string;workingSourceFingerprint:string}>;
for (const row of rows) test(`frozen deployed 2.4.0 ${row.id} ${row.language} source and copy fingerprints`, async () => {
  const {draft} = await prepareExampleVersion(`converted:${row.id}`, row.language, row.version);
  assert.equal(caseFingerprint(draft), row.fingerprint);
  assert.equal(createExampleWorkingCopy(draft).exampleSource?.fingerprint, row.workingSourceFingerprint);
});
