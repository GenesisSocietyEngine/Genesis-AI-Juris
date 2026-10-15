import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { retainPreviousClientAssets } from "../build/retained-client-assets";
import { retainedDeploymentAssets } from "../build/deployment-assets";

const currentCommit = "a".repeat(40), previousCommit = "b".repeat(40);
function fixture(root: string, name: string, commit: string, files: Record<string, string>) {
  const dist = join(root, name); mkdirSync(join(dist, ".openai"), { recursive: true }); mkdirSync(join(dist, "client/.vite"), { recursive: true }); mkdirSync(join(dist, "client/_next/static"), { recursive: true }); mkdirSync(join(dist, "server"));
  const hosting=JSON.stringify({project_id:"synthetic-casevant",d1:"DB"});writeFileSync(join(dist,".openai/hosting.json"),hosting);
  writeFileSync(join(dist, ".openai/release-provenance.json"), JSON.stringify({schema:"genesis.juris.build-identity.v1",sourceCommit:commit,applicationInputsSha256:"c".repeat(64),hostingConfigSha256:createHash("sha256").update(hosting).digest("hex")}));
  writeFileSync(join(dist, "client/.vite/manifest.json"), JSON.stringify(Object.fromEntries(Object.keys(files).map(file => [file,{file:"_next/static/"+file}]))));
  for(const [file,content] of Object.entries(files)) writeFileSync(join(dist,"client/_next/static",file),content);
  writeFileSync(join(dist,"server/index.js"),name+" worker"); writeFileSync(join(dist,"client/tax-runtime-entry.json"),name+" manifest");
  return dist;
}
test("retention preserves previous lazy dependencies without replacing current files, fixed URLs, worker or manifest; older chains do not grow", () => {
  const root=mkdtempSync(join(tmpdir(),"casevant-retention-"));
  try {
    const current=fixture(root,"current",currentCommit,{"new.js":"new code","shared.js":"shared code"});
    const previous=fixture(root,"previous",previousCommit,{"old.js":"old lazy code","shared.js":"shared code"});
    writeFileSync(join(previous,"client/_next/static/older.js"),"earlier generation deliberately excluded");
    const before = ["server/index.js","client/tax-runtime-entry.json","client/.vite/manifest.json","client/_next/static/new.js"].map(p=>readFileSync(join(current,p),"utf8"));
    const result=retainPreviousClientAssets(current,previous,currentCommit,previousCommit);
    assert.equal(result.previousAssets,2);assert.equal(result.newlyRetainedAssets,1);
    assert.equal(readFileSync(join(current,"client/_next/static/old.js"),"utf8"),"old lazy code");assert.equal(existsSync(join(current,"client/_next/static/older.js")),false);
    assert.deepEqual(["server/index.js","client/tax-runtime-entry.json","client/.vite/manifest.json","client/_next/static/new.js"].map(p=>readFileSync(join(current,p),"utf8")),before);
    assert.equal(retainedDeploymentAssets(current,currentCommit).length,2);
    assert.equal(retainPreviousClientAssets(current,previous,currentCommit,previousCommit).newlyRetainedAssets,0,"same-artifact repeat is idempotent");
    assert.throws(()=>retainedDeploymentAssets(current,"e".repeat(40)),/stale/);
    const receiptPath=join(current,".openai/retained-client-assets.json"), receiptText=readFileSync(receiptPath,"utf8");
    writeFileSync(receiptPath,JSON.stringify({...JSON.parse(receiptText),version:99}));assert.throws(()=>retainedDeploymentAssets(current,currentCommit),/Invalid or stale/);writeFileSync(receiptPath,receiptText);
    writeFileSync(join(current,"client/_next/static/old.js"),"tampered old bytes");assert.throws(()=>retainedDeploymentAssets(current,currentCommit),/bytes differ/);
  } finally {rmSync(root,{recursive:true,force:true});}
});
test("retention refuses a well-formed artifact from a different Site before publishing any of its files",()=>{
  const root=mkdtempSync(join(tmpdir(),"casevant-retention-site-"));
  try{
    const current=fixture(root,"current",currentCommit,{"new.js":"new"}),previous=fixture(root,"previous",previousCommit,{"old.js":"old"});
    const hosting=JSON.stringify({project_id:"different-site",d1:"DB"});writeFileSync(join(previous,".openai/hosting.json"),hosting);
    const metadataPath=join(previous,".openai/release-provenance.json"),metadata=JSON.parse(readFileSync(metadataPath,"utf8"));metadata.hostingConfigSha256=createHash("sha256").update(hosting).digest("hex");writeFileSync(metadataPath,JSON.stringify(metadata));
    assert.throws(()=>retainPreviousClientAssets(current,previous,currentCommit,previousCommit),/different Site/);assert.equal(existsSync(join(current,"client/_next/static/old.js")),false);
  }finally{rmSync(root,{recursive:true,force:true});}
});
test("immutable URL collisions and wrong artifact source fail before any files are copied", () => {
  const root=mkdtempSync(join(tmpdir(),"casevant-retention-collision-"));
  try {
    const current=fixture(root,"current",currentCommit,{"shared.js":"new bytes with reused name"});
    const previous=fixture(root,"previous",previousCommit,{"old.js":"old lazy code","shared.js":"old bytes"});
    assert.throws(()=>retainPreviousClientAssets(current,previous,currentCommit,previousCommit),/collision/);
    assert.equal(existsSync(join(current,"client/_next/static/old.js")),false);assert.equal(existsSync(join(current,".openai/retained-client-assets.json")),false);
    assert.throws(()=>retainPreviousClientAssets(current,previous,currentCommit,"f".repeat(40)),/metadata differs/);
    assert.equal(existsSync(join(current,"client/_next/static/old.js")),false);
  } finally {rmSync(root,{recursive:true,force:true});}
});
