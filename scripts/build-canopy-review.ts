import assert from "node:assert/strict";
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { resolve, relative } from "node:path";
import { CANOPY_DISCLOSURE, CANOPY_SCENARIOS, CANOPY_TITLE, CANOPY_SOURCES, buildCanopyPackage, canopySourceText } from "../app/canopy-fixture";
import { canonicalFingerprint } from "../app/case-integrity";
import { discoverPoppler, inspectPdf, assertA4Portrait, extractPdfText, assertExtractedText, renderAndInspectPdf, sha256File, portablePath, splitExtractedPdfPages, assertPdfDocumentMetadata } from "./tests/report-pdf-qa";

// This command consumes successful local API receipts; it never manufactures
// a simulation, approval or PDF, and cannot access D1, R2 or credentials.
const root=resolve(".artifacts/canopy-v2");
const read=(name:string)=>JSON.parse(readFileSync(resolve(root,name),"utf8"));
const comparison=read("comparison.json") as {kind:string;productionVerified:boolean;browserVerified:boolean;humanReviewed:boolean;exportedAt:string;cleanCopies:string[];receipts:Array<{scenario:string;actualTerminal:string;pdfOutputId:string;jsonOutputId:string;snapshotId:string;packageFingerprint:string;packageVersion:string;inputDigest:string;inputs:unknown;presentation:{sha256:string;approval:string;sourceJsonOutputId:string};sessionKey:string}>;finalOutputs:{outputs:Array<{output_id:string;state:string;content_sha256:string;reviewer_actor_id:string|null}>}};
assert.equal(comparison.kind,"locally-tested-api-receipts");assert.equal(comparison.productionVerified,false);assert.equal(comparison.browserVerified,false);
assert.equal(new Set(comparison.cleanCopies).size,4);
assert.equal(comparison.humanReviewed,false);assert.ok(Number.isFinite(Date.parse(comparison.exportedAt)));
assert.equal(comparison.receipts.length,4);
const tools=discoverPoppler(process.cwd());
assert.deepEqual(tools.versions,JSON.parse(readFileSync("parity/report-pdf-visual-baseline.v1.json","utf8")).rasterizer.versions);
const qa:unknown[]=[];
for(const scenario of CANOPY_SCENARIOS){
 const receipt=comparison.receipts.find(item=>item.scenario===scenario.id)!;assert.ok(receipt,scenario.id);
 assert.equal(receipt.actualTerminal,"studio-"+scenario.terminal);
 assert.equal(receipt.packageFingerprint,buildCanopyPackage(scenario.id,scenario.id!=="base").scenario.fingerprint);
 const model=read(scenario.id+"-governed.json");
 const jsonOutput=comparison.finalOutputs.outputs.find(output=>output.output_id===receipt.jsonOutputId);
 assert.equal(jsonOutput?.content_sha256,"sha256-"+sha256File(resolve(root,scenario.id+"-governed.json")));
 assert.equal(model.snapshot.snapshot_id,receipt.snapshotId);
 assert.ok(model.assertion_register.some((a:{statement:string})=>a.statement.includes(scenario.recommendation)));
 assert.equal(model.generator.renderer_version,"1.2.0");
 const sourceManifest=read(scenario.id+"-snapshot.json");
 assert.equal(sourceManifest.snapshot.snapshot_id,receipt.snapshotId);
 assert.equal(model.source_manifest_sha256,"sha256-"+sha256File(resolve(root,scenario.id+"-snapshot.json")));
 assert.deepEqual(receipt.inputs,scenario.inputs);assert.equal(receipt.inputDigest,canonicalFingerprint(scenario.inputs));
 const draft=read(scenario.id+".studio-draft.json");assert.deepEqual(draft,buildCanopyPackage(scenario.id,scenario.id!=="base").draft);
 assert.equal(receipt.packageVersion,draft.version);
 assert.ok(model.assertion_register.some((a:{statement:string})=>a.statement==="Canopy pinned inputs / "+receipt.inputDigest+": "+JSON.stringify(scenario.inputs)));
 const packageInput=model.snapshot.simulation_inputs.decision_packages.find((item:{package_fingerprint:string})=>item.package_fingerprint===receipt.packageFingerprint);
 assert.ok(packageInput?.simulation_runs.some((run:{reference:string})=>run.reference===receipt.sessionKey));
 const packageProof=model.snapshot.deterministic_receipts.decision_packages.find((item:{package_fingerprint:string})=>item.package_fingerprint===receipt.packageFingerprint);
 assert.ok(packageProof?.simulation_receipts.some((run:{reference:string;receipt_digest:string;runtime_state_digest:string})=>run.reference===receipt.sessionKey&&run.receipt_digest&&run.runtime_state_digest));
 const sourceNames=new Set(CANOPY_SOURCES.map(source=>source.id+"-v"+source.version+".md"));
 for(const document of model.source_register){
  assert.ok(sourceNames.has(document.original_filename),"Source filename must belong to the immutable packet");
  assert.equal(document.content_sha256,"sha256-"+sha256File(resolve(root,"sources",document.original_filename)));
 }
 const approval=read(scenario.id+"-approval.json");
 assert.equal(approval.approval.output_id,receipt.pdfOutputId);
 assert.equal(approval.output.snapshot_id,receipt.snapshotId);
 assert.equal(approval.output.snapshot_digest,model.source_manifest_sha256);
 assert.equal(approval.approval.reviewer_actor_id,approval.output.reviewer_actor_id);
 const state=comparison.finalOutputs.outputs.find(output=>output.output_id===receipt.pdfOutputId);
 assert.ok(state?.reviewer_actor_id,"Exact-output reviewer required");
 assert.equal(state.content_sha256,approval.output.content_sha256);assert.equal(state.reviewer_actor_id,approval.approval.reviewer_actor_id);
 assert.equal(state.state,scenario.id==="base"?"stale":"current");
 const pdf=resolve(root,scenario.id+"-dossier.pdf");
 assert.equal(approval.output.content_sha256,"sha256-"+sha256File(pdf));
 const info=inspectPdf(tools,pdf);assertA4Portrait(info,pdf);
 const text=extractPdfText(tools,pdf,resolve(root,scenario.id+"-dossier.txt"));
 for(const expected of [CANOPY_DISCLOSURE,"EXECUTIVE MEMORANDUM",scenario.recommendation,receipt.snapshotId,"Conditions and no-go rule","Approval and currency"])assertExtractedText(text,expected,scenario.id);
 for(const node of buildCanopyPackage(scenario.id,scenario.id!=="base").draft.nodes)assertExtractedText(text,node.title,scenario.id+" graph node "+node.id);
 const shortPdf=resolve(root,scenario.id+"-presentation.pdf");
 assert.equal(receipt.presentation.approval,"none");assert.equal(receipt.presentation.sourceJsonOutputId,receipt.jsonOutputId);
 assert.equal(sha256File(shortPdf),receipt.presentation.sha256);
 const shortInfo=inspectPdf(tools,shortPdf);assertA4Portrait(shortInfo,shortPdf);assert.ok(shortInfo.pages<=4,"Short memorandum exceeds four pages");
 assertPdfDocumentMetadata(shortInfo,readFileSync(shortPdf),model.dossier.title+" — unapproved presentation extract","en-GB",shortPdf);
 const shortText=extractPdfText(tools,shortPdf,resolve(root,scenario.id+"-presentation.txt"));
 for(const expected of [CANOPY_DISCLOSURE,"PRESENTATION EXTRACT", "NOT APPROVED",scenario.recommendation,receipt.snapshotId,model.source_manifest_sha256,"Approval and currency"])assertExtractedText(shortText,expected,scenario.id+" presentation");
 for(const assertion of model.assertion_register.filter((a:{statement:string})=>a.statement.startsWith("Canopy memo / "))){assertExtractedText(shortText,assertion.statement.slice("Canopy memo / ".length).split(": ").slice(1).join(": "),scenario.id+" complete memo text");}
 const shortTextPages=splitExtractedPdfPages(shortText,shortInfo.pages,shortPdf);
 const alternatives=shortTextPages.find(page=>page.includes("Alternatives and exit"));assert.ok(alternatives);assertExtractedText(alternatives,"D01-v1.md",scenario.id);assertExtractedText(alternatives,"D02-v1.md",scenario.id);
 if(scenario.id==="downside"){assertExtractedText(shortText,"Source-backed baseline: 480 signed packs/week",scenario.id);assertExtractedText(shortText,"Scenario assumption: demand stressed to 300 packs/week",scenario.id);}
 const shortPages=renderAndInspectPdf(tools,shortPdf,resolve(root,"pages",scenario.id+"-presentation"),shortInfo,96);
 qa.push({scenario:scenario.id,kind:"unapproved-presentation",pdfSha256:sha256File(shortPdf),pageCount:shortPages.length,portrait:true,completeMemoText:true,pairedAlternativesCitation:true,pages:shortPages.map(page=>({...page,path:portablePath(root,page.path)}))});
 const pages=renderAndInspectPdf(tools,pdf,resolve(root,"pages",scenario.id),info,96);
 qa.push({scenario:scenario.id,pdfSha256:sha256File(pdf),pageCount:pages.length,portrait:true,requiredText:true,allGraphNodeTitles:true,pages:pages.map(page=>({...page,path:portablePath(root,page.path)}))});
}
const replays=read("replay-verification.json");assert.equal(replays.length,4);
assert.deepEqual(replays.map((r:{scenario:string})=>r.scenario).sort(),CANOPY_SCENARIOS.map(s=>s.id).sort());
for(const replay of replays){const receipt=comparison.receipts.find(r=>r.scenario===replay.scenario)!;assert.equal(replay.kind,"existing-v2-decisions-replayed-through-normal-api");assert.equal(replay.original.sessionKey,receipt.sessionKey);assert.equal(replay.original.fingerprint,receipt.packageFingerprint);assert.notEqual(replay.replay.sessionKey,replay.original.sessionKey);assert.deepEqual(replay.replay.state,replay.original.state);assert.deepEqual(read(replay.scenario+"-played-case.json"),replay.file);assert.equal(replay.constraints.length,replay.original.state.decisions.length);}
assert.deepEqual(read("walkthrough-history.json").semanticDiff,[{field:"clearance",before:"passed",after:"failed"}]);
for(const source of CANOPY_SOURCES)assert.equal(readFileSync(resolve(root,"sources",source.id+"-v"+source.version+".md"),"utf8"),canopySourceText(source));
writeFileSync(resolve(root,"pdf-verification.json"),JSON.stringify({kind:"local-poppler-and-text-verification",visualReview:"Recorded separately in visual-review.md",qa},null,2));
const escape=(value:unknown)=>String(value).replace(/[&<>"']/gu,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[ch]!);
const rows=CANOPY_SCENARIOS.map(scenario=>{
 const receipt=comparison.receipts.find(item=>item.scenario===scenario.id)!;
 const state=comparison.finalOutputs.outputs.find(output=>output.output_id===receipt.pdfOutputId)!;
 return `<article id="${scenario.id}"><p class="label">${escape(scenario.label)} · Recorded result</p><h2>${escape(scenario.recommendation)}</h2><dl><dt>What changed</dt><dd>${escape(scenario.changed)}</dd><dt>Why</dt><dd>${escape(scenario.why)}</dd><dt>Controlling evidence</dt><dd>${scenario.controls.map(c=>`<a href="sources/${c.document}-v${c.version}.md">${c.document} v${c.version} § ${escape(c.section)}</a>`).join(" · ")}</dd></dl><p><a href="${scenario.id}-presentation.pdf">Short presentation memo · NOT APPROVED</a> · <a href="${scenario.id}-dossier.pdf">Full governed PDF and appendix</a> · <a href="${scenario.id}-governed.json">Governed JSON</a> · <a href="${scenario.id}-snapshot.json">Snapshot manifest</a> · <a href="${scenario.id}-approval.json">Exact PDF approval receipt</a></p><p><b>${state.state==="current"?"Current for this scenario copy":"Historical output; later evidence changed"} as of ${escape(comparison.exportedAt)}.</b> Approval remains bound to the PDF. The JSON output has no separate approval receipt. These artifacts do not track future changes.</p><details><summary>Verification details · exact snapshot, package, inputs and recorded session</summary><pre>${escape(JSON.stringify(receipt,null,2))}</pre></details></article>`;
}).join("");
let fallback="";
if(existsSync(resolve(".artifacts/p1-route-tests/erp-decision-report.pdf"))&&existsSync(resolve(".artifacts/p1-route-tests/erp-snapshot.json"))){
 mkdirSync(resolve(root,"fallback"),{recursive:true});
 for(const file of ["erp-decision-report.pdf","erp-snapshot.json"])copyFileSync(resolve(".artifacts/p1-route-tests",file),resolve(root,"fallback",file));
 for(const file of ["01-incident.md","02-event-log.md","03-control-plan.md","erp-d365-pilot.studio-draft.json"])copyFileSync(resolve("docs/testing/erp-pilot-2026-09-05",file),resolve(root,"fallback",file));
 assertA4Portrait(inspectPdf(tools,resolve(root,"fallback/erp-decision-report.pdf")),"ERP fallback");
 fallback='<article><h2>Synthetic D365 duplicate bank-import incident — retained fallback</h2><p><a href="fallback/erp-decision-report.pdf">ERP snapshot PDF</a> · <a href="fallback/erp-snapshot.json">Snapshot JSON</a> · <a href="fallback/erp-d365-pilot.studio-draft.json">Unchanged Studio packet</a></p><p>The route test approves and reopens this exact PDF, then deliberately changes evidence and verifies staleness. Treat this retained snapshot as a read-only demonstration artifact, not a current operational output. No separate offline ERP approval receipt is supplied.</p></article>';
}
const html=`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escape(CANOPY_TITLE)} — local review</title><style>body{max-width:1080px;margin:auto;padding:28px;background:#f8f8f1;color:#213b2e;font:17px/1.6 Arial,sans-serif}h1,h2{font-family:Georgia,serif;line-height:1.3}h1{font-size:36px}a{color:#245b3b}nav{display:flex;gap:20px;flex-wrap:wrap}article{background:white;border:1px solid #bfccb9;margin:24px 0;padding:25px;scroll-margin-top:15px}.label{font-size:14px;text-transform:uppercase;letter-spacing:.06em}dt{font-weight:bold;margin-top:12px}dd{margin:0}pre{white-space:pre-wrap;overflow-wrap:anywhere;font-size:14px}.disclosure{border-left:4px solid #9b834c;padding:14px;background:#eeeada}summary{cursor:pointer}a:focus-visible,summary:focus-visible{outline:3px solid #b28022;outline-offset:4px}@media(max-width:650px){body{padding:16px}h1{font-size:28px}article{padding:18px}}</style><header><p class="label">Local API evidence · production and browser acceptance not verified</p><h1>${escape(CANOPY_TITLE)}</h1><p>Four recorded sessions, accepted source-bound assertions and sealed outputs. This offline page reads the retained receipts; it does not operate a private Matter.</p><p class="disclosure">${escape(CANOPY_DISCLOSURE)}</p><nav>${CANOPY_SCENARIOS.map(s=>`<a href="#${s.id}">${s.label}</a>`).join("")}</nav></header>${rows}<footer><p>Clean-copy verification retained four distinct dossiers and original source versions. The Base copy separately demonstrates stale history; the other three copies remain current as of the recorded export. Real-device, cold-user and ten full presentation rehearsals remain unverified.</p><p><a href="README.md">Opening instructions</a> · <a href="presenter-script.md">Presenter script</a> · <a href="rehearsal-run-sheet.md">Rehearsal run sheet (zero counted)</a> · <a href="verification-summary.json">Verification status</a> · <a href="visual-review.md">PDF visual review</a></p><a href="comparison.json">All local comparison and final output-state receipts</a> · <a href="pdf-verification.json">PDF verification</a></footer></html>`;
writeFileSync(resolve(root,"index.html"),html.replace("<footer>",fallback+"<footer>"));
const files=(directory:string):string[]=>readdirSync(directory,{withFileTypes:true}).flatMap(entry=>entry.isDirectory()?files(resolve(directory,entry.name)):[resolve(directory,entry.name)]);
const hashes=files(root).filter(path=>!path.endsWith("SHA256SUMS.txt")).sort().map(path=>sha256File(path)+"  "+relative(root,path).replaceAll("\\","/")).join("\n")+"\n";
mkdirSync(root,{recursive:true});writeFileSync(resolve(root,"SHA256SUMS.txt"),hashes);
console.log("PASS Canopy V2: four independent receipt chains, bounded API replay, clearance-only diff, exact full-PDF approvals, unapproved short extracts, immutable sources and all A4 rendered pages.");
