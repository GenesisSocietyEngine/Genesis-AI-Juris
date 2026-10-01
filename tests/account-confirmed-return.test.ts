import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import ts from "typescript";
import { NavigationController } from "../app/navigation-controller";

// Execute the actual credential/profile handlers with the real departure
// controller. The held guard models busy=true until the handler's finally;
// actual browser dialog/navigation acceptance is a separate application check.
const source = ts.createSourceFile("AccountClient.tsx", readFileSync("app/account/AccountClient.tsx", "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const functions = new Map<string, string>();
const names = ["submit", "saveProfile", "accountRequest", "returnToWorkspace"];
function visit(node: ts.Node) {
  if (ts.isFunctionDeclaration(node) && node.name && names.includes(node.name.text)) functions.set(node.name.text, node.getText(source));
  ts.forEachChild(node, visit);
}
visit(source);
for (const name of ["submit", "saveProfile", "accountRequest"]) assert.ok(functions.has(name), `Actual ${name} handler is required`);
const compiled = ts.transpileModule(`
export default function(env) {
  const {navigation,record,fetch,window,identity,profileKnown=true}=env;
  const returnTo='/studio?view=studio&custom_case=1&lang=en',initialProfile=null,locale='en';
  const t=(en,ru)=>en,router={refresh:()=>record.refreshes++};
  let busy=null;
  const setBusy=value=>{busy=value;record.busy=value;};
  const setError=value=>record.error=value,setMessage=value=>record.message=value,setRecoveryCode=value=>record.recoveryCode=value;
  const formCommitted=()=>{record.commits++;record.dirty=false;};
  class FormData { constructor(form){this.form=form;} get(name){return this.form.values.get(name)??null;} }
  ${[...functions.values()].join("\n")}
  return {submit,saveProfile};
}`, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } });
const directory = resolve(".artifacts/account-confirmed-return");
mkdirSync(directory, { recursive: true });
const modulePath = resolve(directory, "actual-handlers.mjs");
writeFileSync(modulePath, compiled.outputText);
type Operation = "login" | "profile";
type State = { busy: string | null; dirty: boolean; commits: number; resets: number; refreshes: number; error: string; message: string; recoveryCode: string;
  requests: string[]; leaves: { url: string; pending: boolean; warn: boolean }[] };
type Form = { values: Map<string, string>; reset(): void };
type Handlers = { submit(action: "login" | "register" | "recover" | "reset", event: { preventDefault(): void; currentTarget: Form }): Promise<void>;
  saveProfile(event: { preventDefault(): void; currentTarget: Form }): Promise<void> };
const actual = (await import(pathToFileURL(modulePath).href)).default as (environment: object) => Handlers;

function harness(operation: Operation) {
  const record: State = { busy: null, dirty: true, commits: 0, resets: 0, refreshes: 0, error: "", message: "", recoveryCode: "", requests: [], leaves: [] };
  const navigation = new NavigationController({ transport: async () => Response.json({}), leave: () => assert.fail("Unexpected controller leave"), clear: () => {} });
  navigation.register({}, { risk: () => record.busy !== null ? "pending" : record.dirty ? "dirty" : "clear", suspend: () => {}, deny: () => {} });
  let response: () => Promise<Response> = async () => Response.json(operation === "login" ? { authenticated: true, authSource: "local" } : { saved: true });
  let failNavigation = false;
  const form: Form = { values: new Map([["email", "synthetic@example.test"], ["password", "Synthetic-password-1!"], ["newPassword", "Synthetic-password-1!"], ["confirmPassword", "Synthetic-password-1!"], ["displayName", "Keep this display name"], ["professionalRole", "practitioner"]]),
    reset() { record.resets++; this.values.clear(); } };
  const identity = operation === "profile" ? { email: "synthetic@example.test", displayName: "Synthetic reviewer", authSource: "local" } : null;
  const handlers = actual({ navigation, record, identity,
    fetch: async (path: string) => { record.requests.push(path); return response(); },
    window: { location: { assign(url: string) {
      record.leaves.push({ url, pending: navigation.risk() === "pending", warn: navigation.warnBeforeUnload() });
      if (failNavigation) throw new Error("Navigation unavailable");
    } } },
  });
  const event = { currentTarget: form, preventDefault() {} };
  return { navigation, record, form, handlers, event,
    invoke: () => operation === "login" ? handlers.submit("login", event) : handlers.saveProfile(event),
    respond: (next: () => Promise<Response>) => { response = next; },
    failNavigation: () => { failNavigation = true; },
  };
}

for (const operation of ["login", "profile"] as const) {
  test(`confirmed ${operation} approves only its intended return while the form guard is still pending`, async () => {
    const h = harness(operation);
    let finish!: (response: Response) => void;
    h.respond(() => new Promise(resolve => { finish = resolve; }));
    const pending = h.invoke();
    assert.equal(h.navigation.risk(), "pending"); assert.equal(h.navigation.warnBeforeUnload(), true);
    assert.deepEqual(h.record.leaves, []); assert.equal(h.record.commits, 0); assert.equal(h.record.resets, 0);
    finish(Response.json({ authenticated: true, saved: true })); await pending;
    assert.deepEqual(h.record.leaves, [{ url: "/studio?view=studio&custom_case=1&lang=en", pending: true, warn: false }]);
    assert.equal(h.record.commits, 1); assert.equal(h.record.busy, null); assert.equal(h.record.error, "");
    assert.equal(h.record.resets, operation === "login" ? 1 : 0);
    assert.equal(h.navigation.warnBeforeUnload(), false);
  });

  test(`failed ${operation} retains input and departure protection`, async () => {
    for (const failure of ["http", "network", "json"] as const) {
      const h = harness(operation), original = [...h.form.values];
      h.respond(async () => {
        if (failure === "network") throw Error("Network unavailable");
        return failure === "json" ? new Response("not JSON", { status: 200 }) : Response.json({ error: "Not saved" }, { status: 500 });
      });
      await h.invoke();
      assert.deepEqual(h.form.values, new Map(original)); assert.equal(h.record.resets, 0); assert.equal(h.record.commits, 0);
      assert.deepEqual(h.record.leaves, []); assert.equal(h.navigation.warnBeforeUnload(), true); assert.ok(h.record.error);
    }
  });

  test(`late ${operation} success cannot approve return after authority changes`, async () => {
    const h = harness(operation), original = [...h.form.values];
    let finish!: (response: Response) => void;
    h.respond(() => new Promise(resolve => { finish = resolve; }));
    const pending = h.invoke(); h.navigation.sessionBoundary("revoke");
    finish(Response.json({ authenticated: true, saved: true })); await pending;
    assert.deepEqual(h.record.leaves, []); assert.equal(h.record.commits, 0); assert.equal(h.record.resets, 0);
    assert.deepEqual(h.form.values, new Map(original)); assert.equal(h.navigation.warnBeforeUnload(), true);
  });

  test(`${operation} checks authority again after the response body arrives`, async () => {
    const h = harness(operation), original = [...h.form.values];
    let finish!: (value: object) => void, bodyStarted!: () => void;
    const started = new Promise<void>(resolve => { bodyStarted = resolve; });
    const response = Response.json({});
    response.json = () => { bodyStarted(); return new Promise(resolve => { finish = resolve; }); };
    h.respond(async () => response);
    const pending = h.invoke(); await started; h.navigation.sessionBoundary("revoke");
    finish({ authenticated: true, saved: true }); await pending;
    assert.deepEqual(h.record.leaves, []); assert.equal(h.record.commits, 0); assert.equal(h.record.resets, 0);
    assert.deepEqual(h.form.values, new Map(original)); assert.equal(h.navigation.warnBeforeUnload(), true);
  });

  test(`throwing ${operation} navigation cancels approval and restores later departure warnings`, async () => {
    const h = harness(operation); h.failNavigation(); await h.invoke();
    assert.equal(h.record.leaves.length, 1); assert.equal(h.record.leaves[0].pending, true); assert.equal(h.record.leaves[0].warn, false);
    assert.equal(h.record.error, "Navigation unavailable"); assert.equal(h.record.busy, null);
    h.record.dirty = true;
    assert.equal(h.navigation.warnBeforeUnload(), true, "A failed assign must not leave a global departure exemption");
    h.record.busy = "new-operation";
    assert.equal(h.navigation.risk(), "pending"); assert.equal(h.navigation.warnBeforeUnload(), true);
  });
}

for (const action of ["register", "recover", "reset"] as const) test(`successful ${action} does not approve an unrelated departure`, async () => {
  const h = harness("login"); await h.handlers.submit(action, h.event);
  assert.deepEqual(h.record.leaves, []); h.record.dirty = true;
  assert.equal(h.navigation.warnBeforeUnload(), true);
});

test("already authenticated login refreshes identity without approving a return", async () => {
  const h = harness("login"), original = [...h.form.values];
  h.respond(async () => Response.json({ code: "already_authenticated", error: "Sign out first" }, { status: 409 }));
  await h.invoke(); assert.equal(h.record.refreshes, 1); assert.deepEqual(h.record.leaves, []);
  assert.equal(h.record.commits, 0); assert.deepEqual(h.form.values, new Map(original)); assert.equal(h.navigation.warnBeforeUnload(), true);
});
