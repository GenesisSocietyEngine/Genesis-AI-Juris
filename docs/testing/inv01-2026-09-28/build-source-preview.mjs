// Standalone synthetic rendering only. No API calls, uploads or stored audit events.
import { build } from 'esbuild';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createElement as h } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
const directory=resolve('.artifacts/source-review-preview');mkdirSync(directory,{recursive:true});
for(const version of ['before','after']) {
  const code=version==='before'?execFileSync('git',['show','a84316c:app/matters/MattersClient.tsx'],{encoding:'utf8'}):readFileSync('app/matters/MattersClient.tsx','utf8');
  const result=await build({entryPoints:['app/matters/MattersClient.tsx'],bundle:true,write:false,format:'esm',platform:'node',packages:'external',jsx:'automatic',loader:{'.css':'empty'},plugins:[{name:'isolated-render',setup(b){
    b.onLoad({filter:/MattersClient\.tsx$/},()=>({contents:code+'\nexport {EvidenceSection,DocumentsSection};',loader:'tsx',resolveDir:resolve('app/matters')}));
    b.onLoad({filter:/\.module\.css$/},()=>({contents:'export default new Proxy({}, {get:(_,key)=>String(key)});',loader:'js'}));
    b.onResolve({filter:/^next\/navigation$/},()=>({path:'router',namespace:'stub'}));b.onLoad({filter:/.*/,namespace:'stub'},()=>({contents:'export function useRouter(){return {push(){},refresh(){}}}'}));
  }}]});
  const bundle=resolve(directory,version+'.mjs');writeFileSync(bundle,result.outputFiles[0].text);
  const {EvidenceSection,DocumentsSection}=await import(pathToFileURL(bundle).href);
  const anchor={id:'synthetic_anchor',documentId:'synthetic_document',documentVersionId:'synthetic_version_1',documentTitle:'Synthetic capacity reconciliation with a deliberately long document title',versionOrdinal:1,pageNumber:2,paragraph:'4',excerpt:'This synthetic excerpt confirms 300 slots. It is a component fixture, not case evidence.',reviewState:'accepted',retiredAt:null};
  const matter={id:'synthetic_case',classification:'synthetic',permissions:{canWrite:false,canReview:false},anchors:[anchor],assertions:[{id:'synthetic_assertion',type:'fact',status:'accepted',statement:'Inspect the exact source of this synthetic assertion.',sourceAnchorIds:[anchor.id]}]};
  const documents=[{id:'synthetic_document',title:anchor.documentTitle,status:'accepted_source',type:'other',classification:'synthetic',currentVersionId:'synthetic_version_2',versions:[{id:'synthetic_version_1',ordinal:1,originalFilename:'synthetic-v1.txt',extractionStatus:'ready',byteLength:100,mediaType:'text/plain'},{id:'synthetic_version_2',ordinal:2,originalFilename:'synthetic-v2.txt',extractionStatus:'ready',byteLength:200,mediaType:'text/plain'}]}];
  const activity=[{id:'synthetic_audit',sequence:1,eventType:'dossier_updated',summaryCode:'DOCUMENT_ACCEPTED_SOURCE',objectType:'document',objectId:'synthetic_document',reviewedDocumentVersionId:'synthetic_version_1',actorId:'synthetic_reviewer',occurredAt:'2026-09-28T00:00:00Z'}];
  const markup=renderToStaticMarkup(h('main',{className:'shell'},h('div',{className:'content'},h('p',null,'Standalone synthetic component preview — no live case, stored review, upload or authority.'),h(EvidenceSection,{matter,documents,packages:[],proposals:[],cursor:null,view:'user',mutationKey:null}),h(DocumentsSection,{matter,documents,activity,onNavigate(){},view:'user',mutationKey:null}))));
  const css=['app/workspace-design.css','app/matters/matters.module.css'].map(p=>readFileSync(p,'utf8')).join('\n');
  writeFileSync(resolve(directory,version+'.html'),'<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>'+version+' · synthetic citation component</title><style>'+css+'</style></head><body>'+markup+'</body></html>');
}
