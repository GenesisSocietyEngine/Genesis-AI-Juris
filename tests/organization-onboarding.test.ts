import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { build } from "esbuild";
import { createElement, type ComponentType } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { NavigationController } from "../app/navigation-controller";
import { readWithTimeout, ReadTimeoutError } from "../app/read-with-timeout";
import { organizationIssue } from "../app/organizations/organization-admin-model";
import { workspaceDestination } from "../app/workspace-navigation";

// Actual components with synthetic controller state; not hosted authentication evidence.
const built = await build({ stdin: { contents: `import React from 'react';import NavigationSession from './app/NavigationSession';import Organizations from './app/organizations/OrganizationsClient';export default function Page({controller}){return <NavigationSession controller={controller}><Organizations signedIn={true} signInUrl="/signin-with-chatgpt?return_to=%2Forganizations"/></NavigationSession>}`, resolveDir: process.cwd(), loader: "tsx" }, bundle: true, write: false, outfile: ".artifacts/organization-onboarding/page.mjs", format: "esm", platform: "node", packages: "external", jsx: "automatic", loader: { ".css": "empty" }, plugins: [{ name: "test-link", setup(plugin) {
  plugin.onResolve({ filter: /^next\/link$/ }, () => ({ path: "link", namespace: "test" }));
  plugin.onLoad({ filter: /.*/, namespace: "test" }, () => ({ contents: `import React from 'react';export default function Link(props){return React.createElement('a',props)}`, loader: "js", resolveDir: process.cwd() }));
} }] });
mkdirSync(".artifacts/organization-onboarding", { recursive: true });
const file = resolve(".artifacts/organization-onboarding/page.mjs"); writeFileSync(file, built.outputFiles[0].text);
const Page = (await import(pathToFileURL(file).href)).default as ComponentType<{ controller: NavigationController }>;
const identity = { displayName: "Synthetic first user", email: "first@example.test", authSource: "chatgpt" };
const newProfile = { authenticated: true, identity, actorId: null, organizations: [], selected: null, profileRequired: true };

test("first sign-in renders an actionable profile prerequisite, never an organization spinner", async () => {
  const controller = new NavigationController({ transport: async () => Response.json(newProfile), leave: () => {}, clear: () => {} });
  await controller.refresh();
  const html = renderToStaticMarkup(createElement(Page, { controller }));
  assert.match(html, /Complete your profile/); assert.match(html, /Complete profile<\/a>/);
  assert.match(html, /After saving your profile, you will return here/);
  assert.doesNotMatch(html, /Loading organizations/); assert.match(html, /Sign out/);
  const account = workspaceDestination("/account", "/organizations?lang=ru&organization=org_synthetic_review#organization-users");
  assert.equal(new URL(account, "https://example.test").searchParams.get("return_to"), "/organizations?lang=ru&organization=org_synthetic_review#organization-users");
});

test("expired authority hides the onboarding identity and offers access recovery instead of endless loading", async () => {
  const controller = new NavigationController({ transport: async () => Response.json(newProfile), leave: () => {}, clear: () => {} });
  await controller.refresh(); controller.invalidate("expired");
  const html = renderToStaticMarkup(createElement(Page, { controller }));
  assert.doesNotMatch(html, /Synthetic first user|Complete your profile|Loading organizations/);
  assert.match(html, /Refresh access/);
});

test("profile completion refresh obtains server-authorized personal workspace", async () => {
  const actorId = "actor_synthetic_first_user", id = "org_synthetic_personal_user";
  const organization = { id, actorId, name: "Personal workspace", role: "org_owner", status: "active", revision: 1, membershipRevision: 1, selection: `${id}.1.1.${actorId}` };
  let response: unknown = newProfile;
  const controller = new NavigationController({ transport: async () => Response.json(response), leave: () => {}, clear: () => {} });
  await controller.refresh(); assert.equal(controller.getSnapshot().profileRequired, true);
  response = { ...newProfile, profileRequired: false, actorId, organizations: [organization], selected: organization };
  await controller.refresh(); assert.equal(controller.getSnapshot().profileRequired, false);
  assert.equal(controller.getSnapshot().selected?.id, id);
});

test("read deadline settles stalled response bodies, aborts transport, and accepts an explicit fresh retry", async t => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  let signal: AbortSignal | undefined;
  const pending = readWithTimeout(async s => { signal = s; return new Promise<never>(() => {}); });
  const rejected = assert.rejects(pending, ReadTimeoutError);
  t.mock.timers.tick(15000); await rejected; assert.equal(signal?.aborted, true);
  assert.equal(await readWithTimeout(async () => "current organizations"), "current organizations");
  const notice = organizationIssue({ code: "read_timeout", status: 0, scope: "page" }, "en");
  assert.equal(notice.recovery, "refresh"); assert.match(notice.message, /took too long/);
  const committed = organizationIssue({ code: "read_timeout", status: 0, scope: "page", refreshOnly: true }, "en");
  assert.match(committed.message, /change was saved/); assert.match(committed.message, /do not submit/);
});

test("cancelled read rejects promptly and cannot surface its late successful result", async () => {
  const parent = new AbortController(); let resolveRead!: (value: string) => void;
  const pending = readWithTimeout(() => new Promise<string>(resolve => { resolveRead = resolve; }), { signal: parent.signal });
  const rejected = assert.rejects(pending, { name: "AbortError" }); parent.abort(); await rejected;
  resolveRead("old private organizations");
});

test("session read timeout exits checking and late response cannot reauthorize the workspace", async t => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  let deliver!: (value: Response) => void;
  const controller = new NavigationController({ transport: () => new Promise(resolve => { deliver = resolve; }), leave: () => {}, clear: () => {} });
  const pending = controller.refresh(); t.mock.timers.tick(15000); await pending;
  assert.equal(controller.getSnapshot().phase, "error"); assert.equal(controller.getSnapshot().identity, null);
  deliver(Response.json(newProfile)); await Promise.resolve(); await Promise.resolve();
  assert.equal(controller.getSnapshot().phase, "error");
});
