import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import ts from "typescript";
import { build } from "esbuild";
import { NavigationController } from "../app/navigation-controller";

// Exercise the actual administration mutation handler, not a copied state
// machine. DOM input/focus and ordinary authentication are separate browser checks.
const source = ts.createSourceFile("OrganizationsClient.tsx", readFileSync("app/organizations/OrganizationsClient.tsx", "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
let action = "", refresh = "";
function visit(node: ts.Node) {
  if (ts.isFunctionDeclaration(node) && node.name?.text === "action") action = node.getText(source);
  if (ts.isFunctionDeclaration(node) && node.name?.text === "refresh") refresh = node.getText(source);
  ts.forEachChild(node, visit);
}
visit(source); assert.ok(action); assert.ok(refresh);
const bundle = await build({ stdin: { loader: "ts", resolveDir: resolve("app/organizations"), contents: `
import {validOrganizationReceipt,invitationRecipientIssue} from './organization-admin-model';
export default function(env) {
 const {navigation,workspace,fetch,load,window,record}=env;
 const selected=workspace.selected,busyRef={current:false},mounted={current:true},refreshSelection={current:undefined},locale='en';
 let issue=null;
 const t=(en,ru)=>en,setBusy=value=>record.busy=value,setIssue=value=>{issue=value;record.issue=value;},setNotice=value=>record.notice=value;
 const setRecipient=value=>record.recipient=value,setInvitation=value=>record.invitation=value,setWorkspace=value=>record.workspace=value;
 const setVerifiedEpoch=value=>record.verifiedEpoch=value,formCommitted=form=>record.committed=form;
 ${action}
 ${refresh}
 return {action,refresh,refreshSelection};
}` }, bundle: true, write: false, platform: "node", format: "esm" });
const file = resolve(".artifacts/organization-context/handler.mjs");
mkdirSync(resolve(".artifacts/organization-context"), { recursive: true }); writeFileSync(file, bundle.outputFiles[0].text);
const handler = (await import(pathToFileURL(file).href)).default;

const actorId = "actor_synthetic_context_owner";
const org = (id: string) => ({ id, actorId, name: "Same synthetic name", role: "org_owner", status: "active", revision: 1, membershipRevision: 1, selection: `${id}.1.1.${actorId}` });
const original = org("org_synthetic_original"), added = org("org_synthetic_added_team");
async function harness() {
  let available = [original];
  const session = () => ({ authenticated: true, identity: { displayName: "Synthetic owner", email: "owner@example.test", authSource: "local" }, actorId, organizations: available, selected: original, profileRequired: false });
  const navigation = new NavigationController({ transport: async () => Response.json(session()), leave: () => {}, clear: () => {} });
  await navigation.refresh(original.id);
  const workspace = { actorId, selected: original, organizations: available, members: [], requests: [], events: [] };
  const record: Record<string, unknown> = { recipient: "unsaved@example.test", workspace };
  const loads: unknown[] = [], navigations: unknown[] = [];
  let failLoad = false, deferred: (() => Promise<Response>) | null = null;
  let changedSelection: typeof original | null | undefined;
  let deferredLoad: (() => Promise<unknown>) | null = null;
  const h = handler({ navigation, workspace, record,
    fetch: async () => deferred ? deferred() : Response.json({ organization: added }, { status: 201 }),
    load: async (_signal: unknown, selection: string) => { loads.push(selection); if (failLoad) throw { code: "read_timeout", status: 0 }; if (deferredLoad) return deferredLoad(); available = [original, added]; return { ...workspace, organizations: available, selected: changedSelection === undefined ? (selection === added.id ? added : original) : changedSelection }; },
    window: { history: { state: null, replaceState: (...args: unknown[]) => navigations.push(args) }, dispatchEvent: () => navigations.push("event"), location: { href: `https://synthetic.invalid/organizations?organization=${original.id}`, assign: (url: string) => navigations.push(url), reload: () => navigations.push("reload") } },
  });
  let resets = 0;
  const form = { reset: () => { resets++; } };
  return { ...h, navigation, record, workspace, loads, navigations, form, resets: () => resets,
    failLoad: () => { failLoad = true; }, defer: (value: () => Promise<Response>) => { deferred = value; },
    changeSelection: (value: typeof original | null) => { changedSelection = value; },
    deferLoad: (value: () => Promise<unknown>) => { deferredLoad = value; } };
}

for (const scope of ["create", "accept"]) test(`${scope} refreshes the choices while retaining managed organization and unrelated input`, async () => {
  const h = await harness(); await h.action({ action: scope, name: added.name, token: "synthetic" }, h.form);
  assert.deepEqual(h.loads, [original.id]); assert.deepEqual(h.navigations, []);
  assert.equal((h.record.workspace as typeof h.workspace).selected.id, original.id);
  assert.equal((h.record.workspace as typeof h.workspace).organizations.length, 2);
  assert.equal(h.record.recipient, "unsaved@example.test"); assert.equal(h.resets(), 1); assert.equal(h.record.committed, h.form);
  assert.match(String(h.record.notice), /Use Manage in the list/);
  await h.navigation.refresh(original.id); assert.equal(h.navigation.getSnapshot().phase, "ready");
});

test("confirmed create followed by read failure offers refresh without replay or context switch", async () => {
  const h = await harness(); h.failLoad(); await h.action({ action: "create", name: added.name }, h.form);
  assert.deepEqual(h.record.issue, { code: "read_timeout", status: 0, scope: "page", refreshOnly: true });
  assert.equal(h.refreshSelection.current, original.id); assert.equal(h.record.recipient, "unsaved@example.test");
  assert.deepEqual(h.navigations, []); assert.equal(h.resets(), 1);
});

test("revocation during create fences its successful late receipt", async () => {
  const h = await harness(); let finish!: (response: Response) => void;
  h.defer(() => new Promise<Response>(resolve => { finish = resolve; }));
  const pending = h.action({ action: "create", name: added.name }, h.form);
  h.navigation.sessionBoundary("revoke"); finish(Response.json({ organization: added }, { status: 201 })); await pending;
  assert.equal(h.navigation.getSnapshot().phase, "denied"); assert.deepEqual(h.loads, []);
  assert.deepEqual(h.navigations, []); assert.equal(h.resets(), 0); assert.equal(h.record.workspace, h.workspace);
});

for (const selected of [null, { ...original, role: "member", membershipRevision: 2, selection: `${original.id}.1.2.${actorId}` }]) test(`refresh withdraws stale navigation authority for ${selected ? "a changed role revision" : "a successful missing-membership response"}`, async () => {
  const h = await harness(); h.changeSelection(selected); await h.refresh();
  assert.equal(h.navigation.getSnapshot().phase, "denied");
  assert.equal(h.navigation.getSnapshot().selected, null); assert.equal(h.navigation.getSnapshot().identity, null);
  assert.equal(h.record.workspace, h.workspace, "withdraw rather than adopt a new authority projection");
  assert.deepEqual(h.navigations, []);
});

test("refresh with unchanged membership retains ready navigation and unrelated input", async () => {
  const h = await harness(); await h.refresh();
  assert.equal(h.navigation.getSnapshot().phase, "ready");
  assert.equal(h.navigation.getSnapshot().selected?.selection, original.selection);
  assert.equal(h.record.recipient, "unsaved@example.test");
});

test("revocation during a refresh read fences its late workspace result", async () => {
  const h = await harness(); let finish!: (value: unknown) => void;
  h.deferLoad(() => new Promise(resolve => { finish = resolve; }));
  const pending = h.refresh(); h.navigation.sessionBoundary("revoke");
  finish({ ...h.workspace, organizations: [original, added] }); await pending;
  assert.equal(h.navigation.getSnapshot().phase, "denied");
  assert.equal(h.record.workspace, h.workspace); assert.equal(h.record.verifiedEpoch, undefined);
  assert.deepEqual(h.navigations, []);
});

for (const operation of ["refresh", "action"] as const) test(`${operation} cannot restore obsolete error feedback after authority withdrawal`, async () => {
  const h = await harness(); let fail!: (error: unknown) => void;
  if (operation === "refresh") h.deferLoad(() => new Promise((_resolve, reject) => { fail = reject; }));
  else h.defer(() => new Promise<Response>((_resolve, reject) => { fail = reject; }));
  const pending = operation === "refresh" ? h.refresh() : h.action({ action: "create", name: added.name }, h.form);
  h.navigation.sessionBoundary("revoke"); fail({ code: "obsolete", status: 0 }); await pending;
  assert.equal(h.navigation.getSnapshot().phase, "denied");
  assert.ok(h.record.issue == null, "denied access must not promise retained input or suggest resubmitting an obsolete operation");
  assert.equal(h.record.notice, operation === "action" ? "" : undefined);
  assert.equal(h.resets(), 0); assert.deepEqual(h.navigations, []);
});

test("a current refresh failure still offers ordinary retry", async () => {
  const h = await harness(); h.failLoad(); await h.refresh();
  assert.equal(h.navigation.getSnapshot().phase, "ready");
  assert.equal((h.record.issue as { code: string }).code, "read_timeout");
  assert.equal(h.record.recipient, "unsaved@example.test");
});
