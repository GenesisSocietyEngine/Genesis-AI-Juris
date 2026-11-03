import assert from "node:assert/strict";
import test from "node:test";
import {mkdirSync,writeFileSync} from "node:fs";
import {resolve} from "node:path";
import {pathToFileURL} from "node:url";
import {build} from "esbuild";
import {materialHash,type StudioMaterialCitation} from "../app/studio-materials";

type Element={type:unknown;props:Record<string,unknown>&{children?:unknown}};
function hooks(){const slots:Array<{value?:unknown;deps?:unknown[];cleanup?:()=>void}>=[];let cursor=0,effects:Array<()=>void>=[];const next=()=>slots[cursor++]??(slots[cursor-1]={});return{begin(){cursor=0;effects=[];},flush(){effects.forEach(run=>run());},unmount(){slots.forEach(s=>s.cleanup?.());},useState(initial:unknown){const s=next();if(!('value'in s))s.value=initial;return[s.value,(v:unknown)=>{s.value=typeof v==='function'?v(s.value):v;}];},useRef(initial:unknown){const s=next();if(!('value'in s))s.value={current:initial};return s.value;},useEffect(run:()=>void|(()=>void),deps:unknown[]){const s=next();if(!s.deps||!deps.every((v,i)=>Object.is(v,s.deps![i])))effects.push(()=>{s.cleanup?.();s.deps=deps;s.cleanup=run()||undefined;});}};}
const globals=globalThis as typeof globalThis&{__citedUi?:{hooks:ReturnType<typeof hooks>;hold?:Promise<void>;fail?:boolean}};
const bundle=await build({entryPoints:['app/StudioCitedPassages.tsx'],bundle:true,write:false,format:'esm',platform:'node',packages:'external',jsx:'automatic',loader:{'.css':'empty','.module.css':'empty'},plugins:[{name:'cited-ui',setup(b){
 b.onResolve({filter:/^react$/},()=>({path:'hooks',namespace:'cited'}));b.onResolve({filter:/^\.\/studio-materials$/},()=>({path:'materials',namespace:'cited'}));
 b.onLoad({filter:/.*/,namespace:'cited'},a=>({loader:'js',resolveDir:process.cwd(),contents:a.path==='hooks'?['useState','useRef','useEffect','useLayoutEffect'].map(n=>`export const ${n}=(...a)=>globalThis.__citedUi.hooks.${n==='useLayoutEffect'?'useEffect':n}(...a);`).join('\n'):`import {materialHash as real} from './app/studio-materials.ts';export async function materialHash(text){const c=globalThis.__citedUi;if(c.hold)await c.hold;if(c.fail)throw Error('Synthetic hash failure');return real(text);}` }));
}}]});mkdirSync('.artifacts/cited-passages-ui',{recursive:true});const path=resolve('.artifacts/cited-passages-ui/component.mjs');writeFileSync(path,bundle.outputFiles[0].text);const Component=(await import(pathToFileURL(path).href)).default;
function elements(v:unknown):Element[]{if(Array.isArray(v))return v.flatMap(elements);if(!v||typeof v!=='object'||!('props'in v))return[];const e=v as Element;return[e,...elements(e.props.children)];}
function text(v:unknown):string{if(Array.isArray(v))return v.map(text).join(' ');if(typeof v==='string'||typeof v==='number')return String(v);return v&&typeof v==='object'&&'props'in v?text((v as Element).props.children):'';}
function button(tree:unknown,label:string){const e=elements(tree).find(e=>e.type==='button'&&String(e.props['aria-label']??text(e)).includes(label));assert.ok(e,label);return e;}
const citation:StudioMaterialCitation={id:'D01:v1:Mandate',document:'D01',version:1,section:'Mandate',text:'Exact fictional source: café — retained bytes.',verbatimInNode:true,selectedInSourceScenario:true};
function fixture(locale:'en'|'ru'='en',returning=true){const runtime={hooks:hooks(),hold:undefined as Promise<void>|undefined,fail:false};globals.__citedUi=runtime;let context:object={},citations=[citation],returns=0;const focuses:string[]=[];
 const trigger={isConnected:true,focus(){focuses.push('trigger');},scrollIntoView(){}};const root={contains:(x:unknown)=>x===trigger},passage={focus(){focuses.push('passage');},scrollIntoView(){}};
 const render=()=>{runtime.hooks.begin();const tree=Component({locale,context,citations,onReturnToFinding:returning?()=>returns++:undefined});for(const e of elements(tree)){const ref=e.props.ref as {current:unknown}|undefined;if(ref)ref.current=e.props.tabIndex===-1?passage:root;}runtime.hooks.flush();return tree;};
 return{runtime,render,trigger,focuses,get returns(){return returns;},replace(next=[citation]){context={};citations=next;},setCitations(next:StudioMaterialCitation[]){citations=next;},close(){runtime.hooks.unmount();delete globals.__citedUi;},async settle(predicate:(tree:unknown)=>boolean){for(let i=0;i<100;i++){const tree=render();if(predicate(tree))return tree;await new Promise(r=>setTimeout(r,5));}throw Error('Reader did not settle');}};
}

for(const locale of ['en','ru'] as const)test(`${locale}: one source control opens literal text, hashes shown bytes and returns through the provided Review action`,async()=>{
 const f=fixture(locale),before=JSON.stringify(citation);
 try{let tree=f.render();assert.equal(elements(tree).filter(e=>e.props.tabIndex===-1).length,0);const open=button(tree,locale==='en'?'Read D01':'Открыть D01');(open.props.onClick as (e:unknown)=>void)({currentTarget:f.trigger});tree=f.render();assert.ok(text(tree).includes(citation.text!));assert.equal(f.focuses[0],'passage');
 const hash=await materialHash(citation.text!);tree=await f.settle(t=>text(t).includes(hash));assert.equal(f.focuses.filter(x=>x==='passage').length,1,'hash completion must not refocus the reader');
 (button(tree,locale==='en'?'Back to review finding':'Вернуться к замечанию').props.onClick as ()=>void)();assert.equal(f.returns,1);assert.equal(JSON.stringify(citation),before);
 (button(tree,locale==='en'?'Close passage':'Закрыть фрагмент').props.onClick as ()=>void)();tree=f.render();assert.equal(elements(tree).filter(e=>e.props.tabIndex===-1).length,0);assert.equal(f.focuses.at(-1),'trigger');
 }finally{f.close();}
});

test('changed source/access context conceals prior text, rejects stale callbacks and cancels a late hash',async()=>{
 const f=fixture();let release!:()=>void;f.runtime.hold=new Promise<void>(r=>release=r);
 try{let tree=f.render();(button(tree,'Read D01').props.onClick as (e:unknown)=>void)({currentTarget:f.trigger});tree=f.render();const staleReturn=button(tree,'Back to review finding').props.onClick as ()=>void,staleClose=button(tree,'Close passage').props.onClick as ()=>void;
 f.replace([{...citation,text:'Different current source bytes.'}]);tree=f.render();assert.equal(elements(tree).filter(e=>e.props.tabIndex===-1).length,0);staleReturn();staleClose();assert.equal(f.returns,0);assert.deepEqual(f.focuses,['passage']);release();await new Promise(r=>setTimeout(r,10));assert.ok(!text(f.render()).includes(citation.text!));
 }finally{release?.();f.close();}
});

test('unavailable exact versions have no opening/hash action and standalone reading invents no Review origin',()=>{
 const f=fixture('en',false);try{f.setCitations([{...citation,id:'D01:v99:Mandate',version:99,text:null,verbatimInNode:false}]);let tree=f.render();assert.match(text(tree),/v\s*99/);assert.match(text(tree),/No substitute version/);assert.equal(elements(tree).filter(e=>e.type==='button').length,0);
 f.setCitations([citation]);tree=f.render();(button(tree,'Read D01').props.onClick as (e:unknown)=>void)({currentTarget:f.trigger});tree=f.render();assert.ok(!text(tree).includes('Back to review finding'));assert.ok(button(tree,'Close passage'));
 }finally{f.close();}
});

test('node mismatch stays qualified and hash failures never imply verification or approval',async()=>{
 const f=fixture();f.runtime.fail=true;try{f.setCitations([{...citation,verbatimInNode:false,selectedInSourceScenario:false}]);let tree=f.render();(button(tree,'Read D01').props.onClick as (e:unknown)=>void)({currentTarget:f.trigger});tree=await f.settle(t=>text(t).includes('Hash unavailable'));assert.match(text(tree),/not present verbatim/);assert.match(text(tree),/Other retained version/);assert.match(text(tree),/does not accept the evidence/);assert.ok(!text(tree).includes('approved source'));}finally{f.close();}
});


test('a passage that becomes unavailable in the same context rejects old reader callbacks',()=>{
 const f=fixture();try{let tree=f.render();(button(tree,'Read D01').props.onClick as (e:unknown)=>void)({currentTarget:f.trigger});tree=f.render();const oldReturn=button(tree,'Back to review finding').props.onClick as ()=>void,oldClose=button(tree,'Close passage').props.onClick as ()=>void;
 f.setCitations([]);assert.equal(f.render(),null);oldReturn();oldClose();assert.equal(f.returns,0);assert.deepEqual(f.focuses,['passage']);
 }finally{f.close();}
});

for(const locale of ['en','ru'] as const)test(`${locale}: compact citations retain visible qualifications and full literal text`,()=>{
 const f=fixture(locale);try{
  f.setCitations([{...citation,verbatimInNode:false,selectedInSourceScenario:false}]);let tree=f.render();
  const open=button(tree,locale==='en'?'Read D01':'Открыть D01');
  assert.ok(text(open).length<String(open.props['aria-label']).length);
  assert.ok(String(open.props['aria-label']).replace(/\s/g,'').startsWith(text(open).replace(/\s/g,'')),'accessible name starts with the complete visible label');
  assert.ok(text(tree).includes(locale==='en'?'not accepted evidence':'не принятое доказательство'));
  (open.props.onClick as (e:unknown)=>void)({currentTarget:f.trigger});tree=f.render();
  const literal=elements(tree).find(e=>e.props.lang==='en');assert.ok(literal);assert.equal(text(literal),citation.text);
  const details=elements(tree).filter(e=>e.type==='details');assert.equal(details.length,1);assert.equal(details[0].props.open,undefined);
  const visible=elements(tree).filter(e=>e.type==='p'&&!elements(details[0]).includes(e)).map(text).join(' ');
  assert.ok(visible.includes(locale==='en'?'scenario unchanged':'сценарий не изменён'));
  assert.ok(visible.includes(locale==='en'?'Node text differs':'Текст узла отличается'));
 }finally{f.close();}
});
