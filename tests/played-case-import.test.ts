import assert from "node:assert/strict";
import test from "node:test";
import { commitPlayedCaseServerSession } from "../app/played-case-loader";

const scenario = {
  caseId: "canonical_case",
  version: "1.4.0",
  fingerprint: `sha256-${"a".repeat(64)}`,
};

const session = {
  ...scenario,
  sessionKey: "session-1",
  status: "active",
  revision: 7,
};

test("matching-revision played-case import reaches the commit boundary exactly once", () => {
  const imported = { commits: 0, revision: -1 };

  commitPlayedCaseServerSession(true, session, scenario, "session-1", 7, (accepted) => {
    imported.commits += 1;
    imported.revision = accepted.revision;
  });

  assert.deepEqual(imported, { commits: 1, revision: 7 });
});

test("mismatching-revision played-case import is rejected before any state mutation", () => {
  const imported = { commits: 0, revision: -1 };

  assert.throws(() => {
    commitPlayedCaseServerSession(true, session, scenario, "session-1", 6, (accepted) => {
      imported.commits += 1;
      imported.revision = accepted.revision;
    });
  }, /changed since this file was exported/);

  assert.deepEqual(imported, { commits: 0, revision: -1 });
});

test("played-case import rejects fingerprint tampering before the commit boundary", () => {
  let committed = false;

  assert.throws(() => {
    commitPlayedCaseServerSession(true, { ...session, fingerprint: `sha256-${"b".repeat(64)}` }, scenario, "session-1", 7, () => {
      committed = true;
    });
  }, /unavailable/);

  assert.equal(committed, false);
});

test("played-case import rejects a different returned session key before commit", () => {
  let committed = false;

  assert.throws(() => {
    commitPlayedCaseServerSession(true, { ...session, sessionKey: "session-2" }, scenario, "session-1", 7, () => {
      committed = true;
    });
  }, /unavailable/);

  assert.equal(committed, false);
});
