import {build} from 'esbuild';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {resolve,join,dirname} from 'node:path';
import {pathToFileURL} from 'node:url';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {CANOPY_SOURCES} from '../app/canopy-fixture.ts';

const root=resolve(import.meta.dirname,'..');
const args=process.argv.slice(2),get=key=>{const at=args.indexOf(key);return at<0?undefined:args[at+1];};
const ref=get('--ref'),label=get('--label')??'current';
if(ref&&!/^[a-f0-9]{40}$/.test(ref))throw Error('Use an exact source commit');
if(!/^[a-z0-9_-]+$/.test(label))throw Error('Invalid measurement label');
const output=join(root,'.artifacts','studio-compactness',label);mkdirSync(output,{recursive:true});
const source=path=>ref?execFileSync('git',['show',`${ref}:${path}`],{cwd:root,encoding:'utf8'}):readFileSync(join(root,path),'utf8');
const hashes={};
async function component(path,reader=false){const contents=source(path);hashes[path]=createHash('sha256').update(contents).digest('hex');const result=await build({stdin:{contents,resolveDir:dirname(join(root,path)),sourcefile:path,loader:'tsx'},bundle:true,write:false,format:'esm',platform:'node',packages:'external',jsx:'automatic',loader:{'.css':'empty','.module.css':'empty'},plugins:reader?[{name:'measurement-hooks',setup(b){b.onResolve({filter:/^react$/},()=>({path:'hooks',namespace:'measurement'}));b.onLoad({filter:/.*/,namespace:'measurement'},()=>({contents:`export const useState=(v)=>globalThis.__compactMeasurement.state(v);export const useRef=(v)=>({current:v});export const useEffect=()=>{};export const useLayoutEffect=()=>{};`,loader:'js'}));}}]:[]});const filename=join(output,reader?'reader.mjs':'guide.mjs');writeFileSync(filename,result.outputFiles[0].text);return(await import(pathToFileURL(filename).href)).default;}
// Native closed-details model only: no CSS layout, focus, viewport or user timing.
function measure(html){let depth=0;const details=[],words=[];let buttons=0,summaries=0,headings=0;const visible=()=>details.every(x=>x.open||x.summary!==null);for(const token of html.match(/<!--[\s\S]*?-->|<[^>]+>|[^<]+/g)??[]){if(token.startsWith('<!--'))continue;if(token.startsWith('</')){const tag=token.match(/^<\/([\w-]+)/)?.[1];if(tag==='summary'&&details.length)details.at(-1).summary=null;if(tag==='details')details.pop();depth--;continue;}if(token.startsWith('<')){const tag=token.match(/^<([\w-]+)/)?.[1];if(!tag)continue;const closed=/\/$/.test(token.slice(0,-1))||['input','br','img','hr','meta','link'].includes(tag);if(tag==='details')details.push({open:/\sopen(?:\s|=|>)/.test(token),summary:null});if(tag==='summary'&&details.length)details.at(-1).summary=depth;if(visible()){if(tag==='button')buttons++;if(tag==='summary')summaries++;if(/^h[1-6]$/.test(tag))headings++;}if(!closed)depth++;continue;}if(visible())words.push(token);}const text=words.join(' ').replace(/&#x([0-9a-f]+);/gi,(_,x)=>String.fromCodePoint(parseInt(x,16))).replace(/&#(\d+);/g,(_,x)=>String.fromCodePoint(Number(x))).replace(/&(amp|lt|gt|quot|apos);/g,(_,x)=>({amp:'&',lt:'<',gt:'>',quot:'"',apos:"'"}[x])).replace(/\s+/g,' ').trim();return{visibleTextCharacters:text.length,nativeButtons:buttons,disclosureSummaries:summaries,headings};}
const Guide=await component('app/StudioFirstCaseGuide.tsx'),Reader=await component('app/StudioCitedPassages.tsx',true),noop=()=>{};
const sourceSection=CANOPY_SOURCES.find(s=>s.id==='D01'&&s.version===1).sections.Mandate;
const citation={id:'D01:v1:Mandate',document:'D01',version:1,section:'Mandate',text:sourceSection,verbatimInNode:true,selectedInSourceScenario:true};
const result={scope:'Component SSR plus native closed-details visibility model; not browser pixels, interaction or retrieval timing',sourceRef:ref??'working-tree',sourceHashes:hashes,guide:{},reader:{},sectionSha256:createHash('sha256').update(sourceSection).digest('hex')};
for(const locale of ['en','ru']){result.guide[locale]={};for(const [name,state]of Object.entries({empty:{hasStructure:false,hasTitle:false},untitled:{hasTitle:false},unsaved:{},saved:{saved:true,saveConfirmedInSession:true},oversized:{canSave:false},saving:{busy:true,busyReason:'saving'}})){const html=renderToStaticMarkup(createElement(Guide,{locale,hasStructure:true,hasTitle:true,saved:false,busy:false,canSave:true,needsSignIn:false,onBrief:noop,onTitle:noop,onSave:noop,onReport:noop,...state}));writeFileSync(join(output,`guide-${locale}-${name}.html`),html);result.guide[locale][name]=measure(html);}result.reader[locale]={};for(const opened of [false,true]){const context={};let slot=0;globalThis.__compactMeasurement={state:v=>[slot++===0&&opened?{context,id:citation.id,text:sourceSection,trigger:{}}:v,noop]};const tree=Reader({citations:[citation],context,locale,onReturnToFinding:noop}),html=renderToStaticMarkup(tree);delete globalThis.__compactMeasurement;writeFileSync(join(output,`reader-${locale}-${opened?'open':'closed'}.html`),html);result.reader[locale][opened?'open':'closed']=measure(html);}}
writeFileSync(join(output,'measurement.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({output:join(output,'measurement.json'),guide:result.guide,reader:result.reader,sectionSha256:result.sectionSha256}));
