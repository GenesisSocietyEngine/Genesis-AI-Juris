import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import { buildPinnedStudioReader } from "../scripts/lib/pinned-studio-reader";

function repository() {
  const parent=resolve(".artifacts/pinned-reader-tests");mkdirSync(parent,{recursive:true});
  const root=mkdtempSync(resolve(parent,"fixture-"));mkdirSync(resolve(root,"app"));
  const git=(...args:string[])=>execFileSync("git",["-C",root,...args],{encoding:"utf8",stdio:["ignore","pipe","ignore"]}).trim();
  git("init");
  writeFileSync(resolve(root,"app/studio-aggregate.ts"),"import {marker} from './nested';export function readStudioAggregate(){return marker}");
  writeFileSync(resolve(root,"app/nested.ts"),"export const marker='immutable-historical';");
  writeFileSync(resolve(root,"app/studio-device-storage.ts"),"export function readStudioDeviceDraft(){};export function writeStudioDeviceDraft(){};");
  writeFileSync(resolve(root,"app/studio-revisions.ts"),"export function snapshotStudioDraft(){};export function applyStudioSnapshot(){};");
  git("add","app");git("-c","user.name=Synthetic fixture","-c","user.email=fixture@example.test","commit","-m","Synthetic historical modules");
  return {root,git,commit:git("rev-parse","HEAD"),output:resolve(root,"output")};
}

test("historical module execution and provenance ignore changed working-tree counterparts",async()=>{
  const fixture=repository();
  writeFileSync(resolve(fixture.root,"app/nested.ts"),"export const marker='CURRENT-MUST-NOT-EXECUTE';");
  const first=await buildPinnedStudioReader(fixture.root,fixture.commit,fixture.output);
  assert.equal(first.api.readStudioAggregate(),"immutable-historical");
  assert.ok(first.provenance.modules.some(item=>item.path==="app/nested.ts"));
  assert.equal(first.provenance.externalImports.length,0);
  const second=await buildPinnedStudioReader(fixture.root,fixture.commit,fixture.output);
  assert.equal(second.provenance.bundleSha256,first.provenance.bundleSha256);
  assert.equal(second.provenance.moduleSetSha256,first.provenance.moduleSetSha256);
  await assert.rejects(buildPinnedStudioReader(fixture.root,"HEAD",fixture.output),/exact full Git commit/);
  await assert.rejects(buildPinnedStudioReader(fixture.root,"f".repeat(40),fixture.output));
});

test("missing historical dependencies fail instead of substituting current source",async()=>{
  const fixture=repository();
  writeFileSync(resolve(fixture.root,"app/studio-aggregate.ts"),"import {marker} from './missing';export function readStudioAggregate(){return marker}");
  fixture.git("add","app/studio-aggregate.ts");fixture.git("-c","user.name=Synthetic fixture","-c","user.email=fixture@example.test","commit","-m","Synthetic missing dependency");
  const commit=fixture.git("rev-parse","HEAD");
  writeFileSync(resolve(fixture.root,"app/missing.ts"),"export const marker='DO-NOT-SUBSTITUTE';");
  await assert.rejects(buildPinnedStudioReader(fixture.root,commit,fixture.output),/Missing historical module/);
});

test("unbundled historical runtime packages require their own pinned environment",async()=>{
  const fixture=repository();
  writeFileSync(resolve(fixture.root,"app/studio-aggregate.ts"),"import {marker} from 'unverified-historical-package';export function readStudioAggregate(){return marker}");
  fixture.git("add","app/studio-aggregate.ts");fixture.git("-c","user.name=Synthetic fixture","-c","user.email=fixture@example.test","commit","-m","Synthetic external runtime");
  await assert.rejects(buildPinnedStudioReader(fixture.root,fixture.git("rev-parse","HEAD"),fixture.output),/dependency-pinned execution environment/);
});
