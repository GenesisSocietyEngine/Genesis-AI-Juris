import assert from "node:assert/strict";
import { test } from "node:test";
import { enrollmentRoster, enrollmentChoices, memberIdIssue } from "../app/matters/participant-enrollment-model";
import { WorkspaceController } from "../app/matters/workspace-controller";

const member = (actorId: string, name = "Synthetic person", status = "active") => ({ actorId, name, status });
const response = (members: ReturnType<typeof member>[], role = "org_owner") => ({ selected: { status: "active", role }, members });
test("roster projection preserves the existing directory permission boundary and discards unrelated fields", () => {
  for (const role of ["org_owner", "org_admin", "auditor"]) {
    const roster = enrollmentRoster({ ...response([member("actor_person")], role), email: "never-retain@example.test", events: ["private"] });
    assert.equal(roster.status, "ready");
    assert.deepEqual(roster.members, [{ actorId: "actor_person", name: "Synthetic person", active: true }]);
    assert.ok(!JSON.stringify(roster).includes("private"));
  }
  assert.deepEqual(enrollmentRoster(response([member("actor_hidden")], "member")), { status: "restricted", members: [], limited: false });
  assert.equal(enrollmentRoster({ ...response([]), selected: { status: "suspended", role: "org_owner" } }).status, "unavailable");
  assert.equal(enrollmentRoster({ selected: { status: "active", role: "org_owner" } }).status, "unavailable");
  assert.equal(enrollmentRoster(response([member("actor_repeat"), member("actor_repeat")])).status, "unavailable");
});
test("choices exclude inactive and all prior case participants; duplicate names are compared before exclusion", () => {
  const roster = enrollmentRoster(response([
    member("actor_unique", "Only person"), member("actor_prior", "Already present"),
    member("actor_removed", "Removed"), member("actor_suspended", "Suspended", "suspended"),
    member("actor_matcha", " Alex  Smith "), member("actor_matchb", "alex smith", "removed"),
    member("actor_blank", ""), member("actor_removed_org", "Old member", "removed"),
  ]));
  const result = enrollmentChoices(roster, [{ actorId: "actor_prior" }, { actorId: "actor_removed" }]);
  assert.deepEqual(result.choices.map(value => value.actorId), ["actor_unique"]);
  assert.equal(result.ambiguous, true);
  assert.equal(enrollmentRoster(response(Array.from({ length: 100 }, (_, index) => member("actor_" + index.toString().padStart(3, "0"), "Person " + index)))).limited, true);
  assert.equal(enrollmentRoster(response(Array.from({ length: 101 }, (_, index) => member("actor_" + index.toString().padStart(3, "0"))))).status, "unavailable");
});
test("advanced member ID validation rejects email without adding identity resolution", () => {
  assert.equal(memberIdIssue("someone@example.test"), "email");
  assert.equal(memberIdIssue("A display name"), "invalid");
  assert.equal(memberIdIssue("actor_invalid!"), "invalid");
  assert.equal(memberIdIssue("_actor_invalid"), "invalid");
  assert.equal(memberIdIssue("-actor_invalid"), "invalid");
  assert.equal(memberIdIssue(" actor_exact_member "), null);
});

const identity = { actorId: "actor_owner", organizationId: "org_selected.1.1.actor_owner" };
function harness() {
  let role = "org_owner", caseRole = "owner", orgStatus = 200;
  const people = [member("actor_first", "Synthetic first")];
  let wait: Promise<void> | undefined;
  const owner = new WorkspaceController({ identity, transport: async path => {
    const url = new URL(path, "https://test.invalid");
    if (url.pathname === "/api/organizations") {
      const body = { selected: { ...identity, selection: identity.organizationId, status: "active", role }, members: [...people] };
      const pending = wait; wait = undefined; if (pending) await pending;
      return Response.json(body, { status: orgStatus });
    }
    if (/^\/api\/dossiers\/[^/]+$/u.test(url.pathname)) return Response.json({ dossier: {
      dossier_id: url.pathname.split("/").at(-1), title: "Synthetic case", revision: 1,
      permissions: { role: caseRole, can_manage_participants: caseRole === "owner" }, participants: [],
    } });
    return Response.json({ documents: [], source_anchors: [], assertions: [], proposals: [], decision_packages: [], snapshots: [], outputs: [], requests: [], deadlines: [], events: [] });
  } });
  return { owner, people, role: (value: string) => { role = value; }, caseRole: (value: string) => { caseRole = value; },
    orgStatus: (value: number) => { orgStatus = value; }, defer: (value: Promise<void>) => { wait = value; } };
}
test("roster is case-owner-only, reverified on refresh, and clears immediately on authority loss", async () => {
  const h = harness(); h.owner.enter("case_first"); await h.owner.load();
  assert.equal(h.owner.getSnapshot().roster.members[0]?.actorId, "actor_first");
  h.caseRole("viewer"); await h.owner.load(); assert.deepEqual(h.owner.getSnapshot().roster.members, []);
  h.caseRole("owner"); h.role("member"); await h.owner.load(); assert.equal(h.owner.getSnapshot().roster.status, "restricted");
  h.role("org_owner"); await h.owner.load(); h.owner.suspendAuthority();
  assert.deepEqual(h.owner.getSnapshot().roster.members, []);
  await h.owner.load(); assert.equal(h.owner.getSnapshot().roster.status, "ready");
  h.owner.revokeAuthority(); assert.deepEqual(h.owner.getSnapshot().roster.members, []);
});
test("a delayed earlier roster cannot revive names after changing case or account authority", async () => {
  const h = harness(); h.owner.enter("case_first"); await h.owner.load();
  let finish!: () => void; h.defer(new Promise<void>(resolve => { finish = resolve; }));
  const old = h.owner.load(); assert.equal(h.owner.getSnapshot().roster.status, "loading");
  h.owner.enter("case_second"); h.people.splice(0, 1, member("actor_second", "Synthetic second")); await h.owner.load();
  finish(); await old; assert.deepEqual(h.owner.getSnapshot().roster.members.map(value => value.actorId), ["actor_second"]);
  h.defer(new Promise<void>(resolve => { finish = resolve; })); const beforeLogout = h.owner.load();
  h.owner.revokeAuthority(); finish(); await beforeLogout; assert.deepEqual(h.owner.getSnapshot().roster.members, []);
});
test("latest same-case refresh wins; failed refresh and disposal retain no roster", async () => {
  const h = harness(); h.owner.enter("case_first"); await h.owner.load();
  let finish!: () => void; h.defer(new Promise<void>(resolve => { finish = resolve; })); const old = h.owner.load();
  h.people.splice(0, 1, member("actor_latest", "Synthetic latest")); await h.owner.load();
  finish(); await old; assert.equal(h.owner.getSnapshot().roster.members[0]?.actorId, "actor_latest");
  h.orgStatus(503); await h.owner.load(); assert.equal(h.owner.getSnapshot().roster.status, "unavailable");
  h.orgStatus(200); await h.owner.load(); h.owner.dispose(); assert.deepEqual(h.owner.getSnapshot().roster.members, []);
});

test("confirmed enrollment resets its form even when follow-up reload fails; rejected POST preserves drafts", async () => {
  const h = harness(); h.owner.enter("case_first"); await h.owner.load();
  h.owner.rememberDraft("enrollment-manual", "actor_first", "");
  const read = h.owner.options.transport;
  h.owner.options.transport = async (path, init) => {
    if (init?.method === "POST") { h.orgStatus(503); return Response.json({ participant: { actor_id: "actor_first" } }, { status: 201 }); }
    return read(path, init);
  };
  assert.equal(await h.owner.mutate("/api/dossiers/case_first/participants", "participant-enroll", { method: "POST" }, "Added"), true);
  assert.equal(h.owner.getSnapshot().enrollmentCompletion, 1);
  assert.equal(h.owner.draft("enrollment-manual"), undefined);
  assert.equal(h.owner.getSnapshot().roster.status, "unavailable");
  const denied = harness(); denied.owner.enter("case_first"); await denied.owner.load();
  denied.owner.rememberDraft("enrollment-manual", "actor_first", "");
  const previous = denied.owner.options.transport;
  denied.owner.options.transport = async (path, init) => init?.method === "POST" ? Response.json({}, { status: 409 }) : previous(path, init);
  assert.equal(await denied.owner.mutate("/api/dossiers/case_first/participants", "participant-enroll", { method: "POST" }, "Added"), false);
  assert.equal(denied.owner.getSnapshot().enrollmentCompletion, 0);
  assert.equal(denied.owner.draft("enrollment-manual"), "actor_first");
});
