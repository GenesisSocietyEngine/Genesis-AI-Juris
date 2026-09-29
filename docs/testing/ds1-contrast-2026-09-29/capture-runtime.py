import subprocess,json,sys,time,hashlib,datetime
from pathlib import Path
ROOT=Path(r'C:/PROJECTS/Genesis-Juris-DS1-2026-09-29')
OUT=ROOT/'docs/testing/ds1-contrast-2026-09-29'
AB=r'C:/PROJECTS/Genesis-Juris-DS1-Tools-2026-09-29/node_modules/agent-browser/bin/agent-browser-win32-x64.exe'
phase=sys.argv[1]
session='ds1-contrast'
command_notes=[]
def ab(*args,js=None,allow_error=False):
 p=subprocess.run([AB,'--session',session,'--json',*map(str,args)],input=js,capture_output=True,text=True,encoding='utf-8',timeout=45)
 try:d=json.loads(p.stdout)
 except Exception:d={'success':False,'error':p.stderr or p.stdout}
 if not d.get('success'):
  if allow_error:command_notes.append({'command':list(args),'message':d.get('error'),'validated_separately':True});return None
  raise RuntimeError(str(args)+' '+str(d))
 return d.get('data',{})
def ev(js):return ab('eval','--stdin',js=js).get('result')
READ=r"""(els)=>{const rgba=x=>{let m=x.match(/[\d.]+/g);if(!m)return[0,0,0,0];return[+m[0],+m[1],+m[2],m[3]===undefined?1:+m[3]]};const blend=(a,b)=>[0,1,2].map(i=>a[i]*a[3]+b[i]*(1-a[3])).concat(1);const lum=c=>c.slice(0,3).map(v=>v/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4).reduce((a,v,i)=>a+v*[.2126,.7152,.0722][i],0);return[...els].map(e=>{let chain=[],p=e;while(p){const s=getComputedStyle(p);chain.push({tag:p.tagName,class:p.className,color:s.backgroundColor,image:s.backgroundImage});p=p.parentElement}let bg=[255,255,255,1];for(const a of [...chain].reverse())bg=blend(rgba(a.color),bg);const s=getComputedStyle(e),fg=blend(rgba(s.color),bg),x=lum(fg),y=lum(bg),r=e.getBoundingClientRect();return{text:e.textContent,aria:e.getAttribute('aria-label'),class:e.className,color:s.color,background:s.backgroundColor,effectiveBackground:bg,contrast:(Math.max(x,y)+.05)/(Math.min(x,y)+.05),font:s.fontSize,opacity:s.opacity,outline:{color:s.outlineColor,width:s.outlineWidth,style:s.outlineStyle,offset:s.outlineOffset},shadow:s.boxShadow,focus:e.matches(':focus-visible'),hover:e.matches(':hover'),selected:e.closest('.graph-node-shell')?.classList.contains('selected')??e.classList.contains('active'),nodeColor:e.closest('.graph-node-shell')?.style.getPropertyValue('--node-color'),box:{x:r.x,y:r.y,w:r.width,h:r.height},visible:!!(r.width&&r.height)&&s.visibility!=='hidden',backgroundChain:chain.filter(x=>x.color!=='rgba(0, 0, 0, 0)'||x.image!=='none')}})}"""
def read(selector):return ev('('+READ+')(document.querySelectorAll('+json.dumps(selector)+'))')
def click(selector):ev('document.querySelector('+json.dumps(selector)+').click()');time.sleep(.08)
def hover_at_center(selector):
 ev("document.querySelector("+json.dumps(selector)+").scrollIntoView({behavior:'instant',block:'center',inline:'center'})");time.sleep(.15)
 box=ev("(()=>{const r=document.querySelector("+json.dumps(selector)+").getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2}})()")
 ab('mouse','move',round(box['x']),round(box['y']))
def focus_keyboard(selector):
 ev('document.querySelector('+json.dumps(selector)+').focus()')
 ab('press','Shift+Tab');ab('press','Tab')
def rest():ab('mouse','move',0,0);ev('document.activeElement?.blur()')
def shot(name,selector=None):
 if selector:ab('scrollintoview',selector)
 ab('screenshot',OUT/(phase+'-'+name+'.png'))
def theme(mode):
 ev("""(()=>{const dark=document.querySelector('.app-shell').classList.contains('theme-after-hours');if(dark!=="""+str(mode=='after-hours').lower()+"""){const b=[...document.querySelectorAll('button')].find(x=>x.textContent===(dark?'Use light theme':'Use dark theme'));if(!b)throw Error('theme button missing');const d=b.closest('details');if(d&&!d.open)d.querySelector('summary').click();b.click();if(d?.open)d.querySelector('summary').click();}return true})()""")
 time.sleep(.1)
 assert ev("document.querySelector('.app-shell').classList.contains('theme-"+mode+"')")
def capture(mode,host,w,h):
 ab('set','viewport',w,h,allow_error=True)
 actual=ev('({w:innerWidth,h:innerHeight,dpr:devicePixelRatio,outerWidth,outerHeight,cssZoom:getComputedStyle(document.documentElement).zoom})')
 assert(actual['w'],actual['h'])==(w,h),actual
 theme(mode)
 if not ev("document.querySelector('#studio-relations').open"):click('#studio-relations>summary')
 rec={'host':host,'theme':mode,'viewport':actual,'url':ev('location.href'),'shell':ev("document.querySelector('.app-shell').className"),'utc':datetime.datetime.now(datetime.timezone.utc).isoformat()}
 rest()
 rec['guide']=read('.studio-guide li.done button>b')
 assert len(rec['guide'])==3
 focus_keyboard('.studio-guide li.done button')
 rec['guideFocus']=read('.studio-guide li.done button')
 shot(f'{host}-{mode}-{w}-guide','.studio-guide')
 rest()
 # Each idle number is measured while a different node is selected.
 click('[aria-label="Focus node 10"]');rest()
 nums=read('.graph-node-number')
 click('[aria-label="Focus node 1"]');rest()
 nums2=read('.graph-node-number')
 rec['nodeIdle']=[x for x in nums if not x['selected']]+[x for x in nums2 if x['aria']=='Focus node 10']
 assert len(rec['nodeIdle'])==10
 rec['nodeSelected']=[];rec['nodeFocus']=[];rec['nodeHover']=[]
 for n in (range(1,11) if w==1366 else [1,10]):
  selector=f'[aria-label="Focus node {n}"]'
  click(selector);rest()
  rec['nodeSelected']+=read(selector)
  click(f'[aria-label="Focus node {n%10+1}"]');rest()
  focus_keyboard(selector)
  rec['nodeFocus']+=read(selector)
  rest();hover_at_center(selector)
  hover=read(selector)
  if not hover[0]['hover']:raise RuntimeError('hover not established '+selector)
  rec['nodeHover']+=hover
 shot(f'{host}-{mode}-{w}-graph','.graph-viewport')
 rec['relations']={}
 for direction,selector in [('source','#relation-source-ds1_link_1'),('destination','[aria-label="Focus destination node 2"]')]:
  click('[aria-label="Focus node 10"]');rest()
  normal=read(selector)[0]
  hover_at_center(selector);hover=read(selector)[0]
  rest();focus_keyboard(selector);focus=read(selector)[0]
  click(selector);rest();active=read(selector)[0]
  rec['relations'][direction]={'normal':normal,'hover':hover,'focus':focus,'active':active}
  (OUT/(phase+'-current-scenario.json')).write_text(json.dumps(rec,indent=2),encoding='utf-8')
  if not hover['hover'] or not focus['focus'] or not active['selected']:raise RuntimeError('relation state not established '+direction+' '+json.dumps({'hover':hover['hover'],'focus':focus['focus'],'active':active['selected']}))
  focus_keyboard(selector)
  shot(f'{host}-{mode}-{w}-{direction}',selector)
 rec['layout']=ev('({width:innerWidth,documentWidth:document.documentElement.scrollWidth,bodyWidth:document.body.scrollWidth})')
 return rec
result={'phase':phase,'sourceBase':subprocess.check_output(['git','-C',str(ROOT),'rev-parse','HEAD']).decode().strip(),'cssSha256':hashlib.sha256((ROOT/'app/globals.css').read_bytes()).hexdigest(),'startedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'scenarios':[]}
try:
 for host,ses in [('falcon','ds1-contrast'),('generic','ds1-generic')]:
  session=ses
  assert ev("document.querySelectorAll('.graph-node-number').length")==10
  for mode in ['office','after-hours']:
   for w,h in ([(1366,768)] if phase=='before' else [(1366,768),(1024,768),(390,844)]):
    print(json.dumps({'progress':phase,'host':host,'theme':mode,'viewport':[w,h]}),flush=True)
    result['scenarios'].append(capture(mode,host,w,h))
    (OUT/(phase+'-runtime.json')).write_text(json.dumps(result,indent=2)+'\n',encoding='utf-8')
 result['completedAt']=datetime.datetime.now(datetime.timezone.utc).isoformat()
except Exception as e:
 result['failure']=str(e)
 raise
finally:
 result['commandNotes']=command_notes
 (OUT/(phase+'-runtime.json')).write_text(json.dumps(result,indent=2)+'\n',encoding='utf-8')
