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
let action = "";
function visit(node: ts.Node) {
  if (ts.isFunctionDeclaration(node) && node.name?.text === "action") action = node.getText(source);
  ts.forEachChild(node, visit);
}
visit(source); assert.ok(action);
const bundle = await build({ stdin: { loader: "ts", resolveDir: resolve("app/organizations"), contents: `
import {validOrganizationReceipt,invitationRecipientIssue} from './organization-admin-model';
export default function(env) {
 const {navigation,workspace,fetch,load,window,record}=env;
 const selected=workspace.selected,busyRef={current:false},mounted={current:true},refreshSelection={current:undefined},locale='en';
 const t=(en,ru)=>en,setBusy=value=>record.busy=value,setIssue=value=>record.issue=value,setNotice=value=>record.notice=value;
 const setRecipient=value=>record.recipient=value,setInvitation=value=>record.invitation=value,setWorkspace=value=>record.workspace=value;
 const setVerifiedEpoch=value=>record.verifiedEpoch=value,formCommitted=form=>record.committed=form;
 ${action}
 return {action,refreshSelection};
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
  const h = handler({ navigation, workspace, record,
    fetch: async () => deferred ? deferred() : Response.json({ organization: added }, { status: 201 }),
    load: async (_signal: unknown, selection: string) => { loads.push(selection); if (failLoad) throw { code: "read_timeout", status: 0 }; available = [original, added]; return { ...workspace, organizations: available, selected: selection === added.id ? added : original }; },
    window: { history: { state: null, replaceState: (...args: unknown[]) => navigations.push(args) }, dispatchEvent: () => navigations.push("event"), location: { href: `https://synthetic.invalid/organizations?organization=${original.id}`, assign: (url: string) => navigations.push(url), reload: () => navigations.push("reload") } },
  });
  let resets = 0;
  const form = { reset: () => { resets++; } };
  return { ...h, navigation, record, workspace, loads, navigations, form, resets: () => resets,
    failLoad: () => { failLoad = true; }, defer: (value: () => Promise<Response>) => { deferred = value; } };
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
