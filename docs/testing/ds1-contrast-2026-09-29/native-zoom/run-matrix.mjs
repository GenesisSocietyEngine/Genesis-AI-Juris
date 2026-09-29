import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
const root = 'C:/PROJECTS/Genesis-Juris-DS1-Tools-2026-09-29/zoom-extension';
const cli = 'C:/PROJECTS/Genesis-Juris-DS1-Tools-2026-09-29/node_modules/agent-browser/bin/agent-browser-win32-x64.exe';
const session = 'ds1-zoom-probe';
const phase = process.argv[2] || 'before';
if (!['before','after'].includes(phase)) throw new Error('phase must be before or after');
const out = path.join(root,phase);
fs.mkdirSync(out,{recursive:true});
const fixture='C:/PROJECTS/Genesis-Juris-DS1-2026-09-29/docs/testing/ds1-contrast-2026-09-29/synthetic-contrast-fixture.json';
const commandLog=[];
const themeFilter=process.argv[3]||null;
function cmd(args,input) {
  const r=spawnSync(cli,['--session',session,'--json',...args],{input,encoding:'utf8',timeout:45000,windowsHide:true,maxBuffer:12*1024*1024});
  commandLog.push({args,status:r.status,stdout:r.stdout,stderr:r.stderr});
  fs.writeFileSync(path.join(out,'commands.json'),JSON.stringify(commandLog,null,2));
  if(r.status!==0) throw new Error(JSON.stringify({args,...r}));
  const text=r.stdout.trim();
  let result;
  try {result=JSON.parse(text);} catch {throw new Error('Bad command JSON: '+text);}
  if(!result.success) throw new Error(JSON.stringify(result));
  return result.data;
}
function evaluate(code){return cmd(['eval','--stdin'],code).result;}
function settle(){evaluate('new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve(true))))');}
function activate(selector){cmd(['focus',selector]);cmd(['press','Enter']);settle();}
function park(){cmd(['focus','.studio-case-breadcrumb button']);cmd(['mouse','move','0','0']);}
function measure(){return evaluate(`(()=>{
const parse=s=>{const a=s.match(/[\\d.]+/g)?.map(Number)||[0,0,0,0];return [a[0],a[1],a[2],a[3]??1]};
const lum=c=>c.slice(0,3).map(v=>v/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4).reduce((a,v,i)=>a+v*[.2126,.7152,.0722][i],0);
const ratio=(a,b)=>{const x=lum(a),y=lum(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05)};
const pick=e=>{const s=getComputedStyle(e),f=parse(s.color),b=parse(s.backgroundColor),r=e.getBoundingClientRect();return {text:e.textContent,label:e.getAttribute('aria-label'),color:s.color,background:s.backgroundColor,fontSize:s.fontSize,opacity:s.opacity,outline:{color:s.outlineColor,width:s.outlineWidth,style:s.outlineStyle,offset:s.outlineOffset},selected:!!e.closest('.graph-node-shell.selected'),active:e.classList.contains('active'),focus:e.matches(':focus'),focusVisible:e.matches(':focus-visible'),hover:e.matches(':hover'),ratio:b[3]===1?ratio(f,b):null,opaqueBackground:b[3]===1,rect:{x:r.x,y:r.y,width:r.width,height:r.height}}};
return {url:location.href,shell:document.querySelector('.app-shell').className,innerWidth,innerHeight,outerWidth,outerHeight,dpr:devicePixelRatio,htmlZoom:getComputedStyle(document.documentElement).zoom,bodyZoom:getComputedStyle(document.body).zoom,guide:[...document.querySelectorAll('.studio-guide li.done button>b')].map(pick),nodes:[...document.querySelectorAll('.graph-node-number')].map(pick),source:pick(document.querySelector('.graph-relations li:first-child .relation-node-tag:not(.destination)')),destination:pick(document.querySelector('.graph-relations li:first-child .relation-node-tag.destination'))};
})()`);}
function screenshot(name,selector){cmd(['scrollintoview',selector]);cmd(['screenshot',path.join(out,name+'.png')]);}
const source='.graph-relations li:first-child .relation-node-tag:not(.destination)';
const dest='.graph-relations li:first-child .relation-node-tag.destination';
const num=n=>`.graph-node-shell:nth-of-type(${n}) .graph-node-number`;
const node=(type)=>`#studio-node-ds1_${type}`;
const number=(type)=>`.graph-node-shell:has(${node(type)}) .graph-node-number`;
const types=['trigger','actor','fact','evidence','deadline','decision','entity','tax_rule','cash_flow','outcome'];
const report=themeFilter?JSON.parse(fs.readFileSync(path.join(out,'report.json'),'utf8')):{phase,mechanism:'Chrome tabs.setZoom automatic per-tab; no CSS zoom or emulation',cases:[]};
if(themeFilter)report.cases=report.cases.filter(c=>!c.key.endsWith(themeFilter));
fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));
for(const host of ['generic','falcon']) {
  const url=host==='generic'?'http://127.0.0.1:4197/?lang=en&view=studio':'http://127.0.0.1:4197/studio?lang=en';
  cmd(['close']);
  cmd(['--profile',path.join(root,'profile'),'--executable-path','C:/Users/User/.cache/puppeteer/chrome/win64-154.0.8037.57/chrome-win64/chrome.exe','--extension',root,'open',url]);
  cmd(['wait','input[type=file][accept*=markdown]']);
  cmd(['upload','input[type=file][accept*=markdown]',fixture]);
  cmd(['wait','.studio-guide li.done button>b']);
  cmd(['wait','.graph-relations']);
  if(!evaluate("document.querySelector('#studio-relations').open")) activate('#studio-relations > summary');
  for(const theme of ['office','after-hours'].filter(t=>!themeFilter||t===themeFilter)) {
    const key=host+'-'+theme;
    console.log('START '+phase+' '+key);
    const baseline=evaluate(fs.readFileSync(path.join(root,'probe-100.js'),'utf8'));
    if(!evaluate(`document.querySelector('.app-shell').classList.contains('theme-${theme}')`)) {
      evaluate("(()=>{const d=document.querySelector('.genesis-nav-more');if(!d.open)d.querySelector('summary').click();d.querySelector('button').click();return true;})()");
      settle();
    }
    const actualShell=evaluate("document.querySelector('.app-shell').className");
    if(!actualShell.split(' ').includes('theme-'+theme)||(actualShell.includes('studio-host-falcon')!==(host==='falcon'))) throw new Error('Wrong rendered theme/host '+actualShell+' expected '+host+' '+theme);
    if(evaluate("document.querySelector('.genesis-nav-more').open")) evaluate("document.querySelector('.genesis-nav-more>summary').click()");
    const zoom=evaluate(fs.readFileSync(path.join(root,'probe-200.js'),'utf8'));
    if(zoom.receipt?.factor!==2 || baseline.receipt?.factor!==1 || zoom.outerWidth!==baseline.outerWidth || zoom.outerHeight!==baseline.outerHeight || zoom.cssZoom!=='1' || zoom.bodyZoom!=='1' || Math.abs(zoom.dpr/baseline.dpr-2)>.01) throw new Error('Native zoom receipt failed: '+JSON.stringify({baseline,zoom}));
    const c={key,baseline,zoom,states:{},screenshots:[]};
    activate(number('outcome'));park();c.states.idleFirstNine=measure();
    screenshot(key+'-guide','.studio-guide');c.screenshots.push(key+'-guide.png');
    screenshot(key+'-graph','.graph-canvas');c.screenshots.push(key+'-graph.png');
    activate(number('trigger'));park();c.states.idleTenth=measure();
    c.selectedPalette=[];
    for(const type of types){activate(number(type));park();const m=measure();c.selectedPalette.push({type,...m.nodes.find(n=>n.selected)});}
    activate(source);park();c.states.sourceActive=measure();screenshot(key+'-source-active',source);c.screenshots.push(key+'-source-active.png');
    activate(dest);park();c.states.destinationActive=measure();screenshot(key+'-destination-active',dest);c.screenshots.push(key+'-destination-active.png');
    activate(number('outcome'));park();cmd(['press','Tab']);cmd(['focus',source]);settle();c.states.sourceFocus=measure();screenshot(key+'-source-focus',source);c.screenshots.push(key+'-source-focus.png');
    cmd(['press','Tab']);cmd(['focus',dest]);settle();c.states.destinationFocus=measure();screenshot(key+'-destination-focus',dest);c.screenshots.push(key+'-destination-focus.png');
    if(!c.states.sourceFocus.source.focusVisible||!c.states.destinationFocus.destination.focusVisible) throw new Error('Real focus-visible not established');
    report.cases.push(c);fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));
    console.log('DONE '+phase+' '+key);
  }
}
console.log('COMPLETE '+phase+' cases='+report.cases.length);
