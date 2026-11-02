"""Encode actual browser step captures; never synthesize application screens.
Usage: python render_scenarios.py --ffmpeg /absolute/path/to/ffmpeg
Requires Python stdlib and an FFmpeg build with libx264. No provider calls.
"""
import argparse, hashlib, json, re, subprocess, tempfile
from pathlib import Path

parser=argparse.ArgumentParser();parser.add_argument('--ffmpeg',required=True);args=parser.parse_args()
base=Path(__file__).resolve().parent;root=base.parents[2]
config=json.loads((base/'scenarios.json').read_text(encoding='utf-8'));captures=json.loads((base/'captures.json').read_text(encoding='utf-8'))
out=root/'public/help/scenarios-20261102';out.mkdir(parents=True,exist_ok=True)
sha=lambda data:hashlib.sha256(data).hexdigest()
def run(arguments):
    result=subprocess.run([args.ffmpeg,'-nostdin','-hide_banner',*map(str,arguments)],capture_output=True,text=True)
    if result.returncode: raise RuntimeError(result.stderr[-5000:])
    return result.stderr
def stamp(seconds): return f'{seconds//3600:02}:{seconds//60%60:02}:{seconds%60:02}.000'
metadata=[];manifest={'schema':'casevant.scenario-recordings.v1','date':config['date'],'sourceCommit':captures['sourceCommit'],'environment':captures['environment'],'format':captures['format'],'audio':'none; English and Russian descriptive captions/transcripts','scenarios':[]}
for scenario in config['scenarios']:
    selected=[]
    for step in scenario['steps']:
        matching=[x for x in captures['captures'] if x['scenario']==scenario['id'] and x['step']==step['id']]
        assert len(matching)==1
        capture=matching[0];file=base/capture['file'];assert file.resolve().is_relative_to((base/'screens').resolve())
        assert sha(file.read_bytes())==capture['sha256'];assert file.read_bytes()[:3]==b'\xff\xd8\xff'
        selected.append(capture)
    sizes=set()
    for capture in selected:
        log=run(['-i',base/capture['file'],'-frames:v','1','-f','null','-'])
        match=re.search(r'Video:.*?\b(\d{2,5})x(\d{2,5})\b',log);assert match
        sizes.add((int(match[1]),int(match[2])))
    assert len(sizes)==1
    capture_width,capture_height=sizes.pop()
    width,height=(capture_width+1)//2*2,(capture_height+1)//2*2
    duration=config['secondsPerStep']*len(selected);movie=out/(scenario['id']+'.mp4')
    with tempfile.TemporaryDirectory(prefix='casevant-scenario-') as temp:
        concat=Path(temp)/'frames.ffconcat'
        lines=['ffconcat version 1.0']
        for capture in selected:
            path=(base/capture['file']).as_posix();assert "'" not in path
            lines += [f"file '{path}'",f"duration {config['secondsPerStep']}"]
        lines += [f"file '{(base/selected[-1]['file']).as_posix()}'"]
        concat.write_text('\n'.join(lines)+'\n',encoding='utf-8')
        run(['-y','-v','error','-f','concat','-safe','0','-i',concat,'-t',duration,'-vf','pad=ceil(iw/2)*2:ceil(ih/2)*2:color=white,fps=12,format=yuv420p','-c:v','libx264','-preset','veryfast','-tune','stillimage','-crf','20','-threads','4','-an','-movflags','+faststart','-metadata','title='+scenario['title']['en'],'-metadata','comment='+captures['format'],movie])
    assert movie.stat().st_size<24*1024*1024
    log=run(['-i',movie,'-f','null','-']);match=re.search(r'Duration: (\d+):(\d+):(\d+\.\d+)',log);assert match
    actual=int(match[1])*3600+int(match[2])*60+float(match[3]);assert abs(actual-duration)<0.2
    assert 'Video: h264' in log and 'Audio:' not in log
    poster=out/(scenario['id']+'-poster.jpg');run(['-y','-v','error','-i',base/selected[0]['file'],'-frames:v','1','-update','1','-q:v','2',poster])
    prefix='/help/scenarios-20261102/'+scenario['id']
    item={'id':scenario['id'],'title':scenario['title'],'description':scenario['description'],'durationSeconds':duration,'width':width,'height':height,'video':prefix+'.mp4','poster':prefix+'-poster.jpg','sourceCommit':captures['sourceCommit'],'capturedDate':config['date'],'steps':[]}
    for locale in ('en','ru'):
        vtt=['WEBVTT',''];transcript=['# '+scenario['title'][locale],'',('Actual browser step captures, edited into a silent video. Isolated local preview; fictional/synthetic data. Not continuous footage or authenticated save/AI/download acceptance.' if locale=='en' else 'Кадры реального браузера, смонтированные в немое видео. Изолированная локальная версия; вымышленные данные. Это не непрерывная запись и не подтверждение входа, сохранения, AI или скачивания.'),'',f"Source: {captures['sourceCommit']}; captured: {config['date']}.",'']
        for index,step in enumerate(scenario['steps']):
            at=index*config['secondsPerStep'];end=at+config['secondsPerStep']
            vtt += [f'{stamp(at)} --> {stamp(end)}',step[locale],'']
            transcript += [f'## {at//60}:{at%60:02} — {step["id"]}',step[locale],'']
            if locale=='en': item['steps'].append({'at':at,'text':{'en':step['en'],'ru':step['ru']}})
        (out/(scenario['id']+f'.{locale}.vtt')).write_text('\n'.join(vtt),encoding='utf-8',newline='\n')
        (out/(scenario['id']+f'.{locale}.md')).write_text('\n'.join(transcript),encoding='utf-8',newline='\n')
    metadata.append(item)
    files=[movie,poster,*[out/(scenario['id']+f'.{locale}.{suffix}') for locale in ('en','ru') for suffix in ('vtt','md')]]
    manifest['scenarios'].append({'id':scenario['id'],'durationSeconds':duration,'width':width,'height':height,'captureWidth':capture_width,'captureHeight':capture_height,'encodingPadding':'at most one pixel on the right/bottom for H264; no source capture bytes changed','fullyDecoded':True,'captures':selected,'assets':[{'path':'/'+str(file.relative_to(root/'public')).replace('\\','/'),'bytes':file.stat().st_size,'sha256':sha(file.read_bytes())} for file in files]})
(root/'app/scenario-recordings.json').write_text(json.dumps(metadata,ensure_ascii=False,indent=2)+'\n',encoding='utf-8',newline='\n')
(out/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n',encoding='utf-8',newline='\n')
print(json.dumps({'recordings':len(metadata),'seconds':sum(x['durationSeconds'] for x in metadata),'assets':len(list(out.iterdir())),'allFramesHashed':True,'allMoviesDecoded':True}))
