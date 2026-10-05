#!/usr/bin/env python3
"""Render the CaseVant illustrated course without invented application UI.

Input mapping JSON maps every screen scene's screenKey to an actual capture.
Instruction scenes are always explicit cards; they cannot imply a saved action.
Narration is synthesized one sentence/clause at a time. ffprobe timings drive
both the baked-in captions and WebVTT. Atempo is used only when needed and may
not exceed 1.18; otherwise authoring must shorten the source narration.
"""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
from illustrations import render_illustration
import argparse, concurrent.futures, hashlib, json, math, re, subprocess, wave

ROOT=Path(__file__).resolve().parent
W,H=1920,1080
DURATION=30.0
BG='#f0f7ff'; NAVY='#18383c'; MUTED='#506477'; BLUE='#176d67'; LINE='#d9e2ed'
FONT='/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'
BOLD='/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'

def run(args):
    subprocess.run([str(x) for x in args], check=True, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)

def duration(path):
    p=subprocess.run(['ffprobe','-v','error','-show_entries','format=duration','-of','default=noprint_wrappers=1:nokey=1',str(path)],capture_output=True,text=True,check=True)
    return float(p.stdout)

def font(size,bold=False):return ImageFont.truetype(BOLD if bold else FONT,size)
def text_width(draw,text,f):return draw.textlength(text,font=f)

def wrap(draw,text,f,width):
    lines=[]; line=''
    for word in text.split():
        attempt=(line+' '+word).strip()
        if line and text_width(draw,attempt,f)>width:lines.append(line);line=word
        else:line=attempt
    if line:lines.append(line)
    return lines

def block(draw,text,xy,width,size=25,fill=NAVY,bold=False,leading=1.35):
    f=font(size,bold);x,y=xy
    for line in wrap(draw,text,f,width):draw.text((x,y),line,font=f,fill=fill);y+=round(size*leading)
    return y

def split_cues(text):
    sentences=re.split(r'(?<=[.!?])\s+(?=[A-Z])',text.strip())
    result=[]
    for sentence in sentences:
        if len(sentence.split())<=34:result.append(sentence);continue
        pieces=re.split(r'(?<=[,;:])\s+',sentence)
        pending=''
        for piece in pieces:
            proposed=(pending+' '+piece).strip()
            if pending and len(proposed.split())>30:result.append(pending);pending=piece
            else:pending=proposed
        if pending:result.append(pending)
    return result

def speech_text(text):
    # Retain transcript wording, but make abbreviations pronounceable.
    return text.replace('PRC-resident','P R C resident').replace('KYC','K Y C').replace('PDF','P D F').replace('AI','A I').replace('CaseVant','Case Vant')

def prepare_scene(scene,cache):
    sid=scene['id']; directory=cache/'audio'/sid;directory.mkdir(parents=True,exist_ok=True)
    texts=split_cues(scene['narration']); raws=[]
    for i,text in enumerate(texts):
        source=directory/f'{i:02}.txt';raw=directory/f'{i:02}-raw.wav';spoken=speech_text(text)
        existing=source.read_text() if source.exists() else None
        if existing!=spoken or not raw.exists():
            source.write_text(spoken)
            run(['ffmpeg','-nostdin','-y','-v','error','-f','lavfi','-i',f'flite=textfile={source}:voice=slt','-ar','24000','-ac','1','-c:a','pcm_s16le',raw])
        raws.append((text,raw,duration(raw)))
    start=.65;gap=.16;end_min=.65
    total=sum(x[2] for x in raws)
    available=DURATION-start-end_min-gap*(len(raws)-1)
    tempo=max(1.0,total/available)
    if tempo>1.18:raise ValueError(f"Scene {sid}: narration requires tempo {tempo:.3f}; shorten script")
    cues=[];cursor=start
    for i,(text,raw,raw_duration) in enumerate(raws):
        final=directory/f'{i:02}.wav'
        if tempo>1.00001:
            run(['ffmpeg','-nostdin','-y','-v','error','-i',raw,'-af',f'atempo={tempo:.8f}','-ar','24000','-ac','1','-c:a','pcm_s16le',final])
        else:final.write_bytes(raw.read_bytes())
        actual=duration(final);cues.append(dict(text=text,audio=str(final),start=cursor,end=cursor+actual,rawDuration=raw_duration));cursor+=actual+gap
    # Compose exact samples; no speech trimming is allowed.
    samples=bytearray(int(DURATION*24000)*2)
    for cue in cues:
        with wave.open(cue['audio'],'rb') as wav:
            assert wav.getnchannels()==1 and wav.getframerate()==24000 and wav.getsampwidth()==2
            pcm=wav.readframes(wav.getnframes())
        at=round(cue['start']*24000)*2
        if at+len(pcm)>len(samples):raise ValueError(f'Speech overflow in scene {sid}')
        samples[at:at+len(pcm)]=pcm
    combined=directory/'scene.wav'
    with wave.open(str(combined),'wb') as wav:wav.setnchannels(1);wav.setsampwidth(2);wav.setframerate(24000);wav.writeframes(samples)
    return dict(id=sid,cues=cues,tempo=tempo,lastSpeechEnd=cues[-1]['end'],duration=DURATION,audio=str(combined))

def chapter_time(idx):return f'{idx//2:02d}:{(idx%2)*30:02d}'

def render_base(scene,idx,mapping):
    im=Image.new('RGB',(W,H),BG);d=ImageDraw.Draw(im)
    d.rectangle((0,0,W,101),fill='white')
    mark=Image.open(ROOT.parent.parent/'public/brand/casevant-mark.png').convert('RGBA')
    mark.thumbnail((52,52),Image.Resampling.LANCZOS)
    im.paste(mark,(28,22),mark)
    d.text((94,20),'CaseVant',font=font(22,True),fill=NAVY)
    d.text((94,51),'MAKE YOUR CASE.  /  CASEVANT.PRO  /  5 OCTOBER 2026',font=font(16),fill=MUTED)
    d.text((1452,27),f'{chapter_time(idx)} – {chapter_time(idx+1)}',font=font(23,True),fill=NAVY)
    d.text((1735,31),f'{idx+1:02d} / 20',font=font(18),fill=MUTED)
    # Actual UI gets its native dimensions: 1363 × 936 capture fits without distortion.
    left=(26,115,1413,1057)
    if scene['kind']=='screen':
        path=Path(mapping[scene['screenKey']]);shot=Image.open(path).convert('RGB')
        maxw,maxh=left[2]-left[0]-12,left[3]-left[1]-12
        shot.thumbnail((maxw,maxh),Image.Resampling.LANCZOS)
        d.rounded_rectangle(left,radius=12,fill='white',outline=LINE,width=1)
        im.paste(shot,(left[0]+(left[2]-left[0]-shot.width)//2,left[1]+(left[3]-left[1]-shot.height)//2))
    elif scene['kind']=='illustration':
        render_illustration(im,scene,font,block)
    else:
        d.rounded_rectangle(left,radius=14,fill='#152f4d')
        d.rounded_rectangle((65,155,1310,216),radius=8,fill='#e4b35b')
        d.text((86,172),'ACCOUNT WORKFLOW • INSTRUCTIONS',font=font(26,True),fill='#172b3a')
        y=block(d,scene['title'],(85,276),1220,52,'white',True,1.2)
        y=block(d,'The steps below explain the workflow. An authenticated completion was not recorded.',(85,y+35),1175,30,'#c9d7e8',False,1.4)
        y+=60
        for j,takeaway in enumerate(scene['takeaways']):
            d.ellipse((87,y+1,139,y+53),fill='#335b86')
            d.text((104,y+11),str(j+1),font=font(23,True),fill='white')
            ey=block(d,takeaway,(165,y+3),1070,33,'white',True,1.3)
            y=max(y+90,ey+30)
        block(d,'Use supported sign-in. Verify the returned result before relying on it.',(86,942),1190,23,'#c9d7e8')
    x=1440;rw=440
    d.text((x,126),scene['chapter'].upper(),font=font(17,True),fill=BLUE)
    y=block(d,scene['title'],(x,164),rw,34,NAVY,True,1.15)
    d.line((x,y+24,x+rw,y+24),fill=LINE,width=2);y+=47
    for j,takeaway in enumerate(scene['takeaways']):
        d.ellipse((x,y+3,x+26,y+29),fill='#dce8fa')
        d.text((x+8,y+5),str(j+1),font=font(14,True),fill=BLUE)
        y=block(d,takeaway,(x+41,y),rw-41,23,NAVY,False,1.35)+24
    if y>650:raise ValueError(f'Takeaway rail overflow scene {scene["id"]}: {y}')
    d.rounded_rectangle((x,657,1888,1015),radius=12,fill='white',outline=LINE,width=1)
    d.text((x+22,678),'NARRATION',font=font(14,True),fill=MUTED)
    label='ACCOUNT INSTRUCTIONS' if scene['kind']=='instruction' else ('ILLUSTRATED WORKFLOW' if scene['kind']=='illustration' else 'ACTUAL APPLICATION SCREEN')
    d.text((x,1031),label,font=font(14,True),fill=BLUE if scene['kind']=='screen' else '#956716')
    d.rectangle((0,1071,W,1079),fill='#d8e1ec')
    d.rectangle((0,1071,round(W*(idx+1)/20),1079),fill=BLUE)
    return im

def add_caption(base,text):
    im=base.copy();d=ImageDraw.Draw(im)
    size=23
    while len(wrap(d,text,font(size),402))*size*1.37>282 and size>19:size-=1
    y=block(d,text,(1462,715),402,size,NAVY,False,1.37)
    if y>1006:raise ValueError('Caption overflow')
    return im

def vtt_time(seconds):
    ms=round(seconds*1000);h,ms=divmod(ms,3600000);m,ms=divmod(ms,60000);s,ms=divmod(ms,1000)
    return f'{h:02d}:{m:02d}:{s:02d}.{ms:03d}'

def main():
    p=argparse.ArgumentParser();p.add_argument('--script',default=str(ROOT/'training-script.json'));p.add_argument('--mapping',default=str(ROOT/'screen-map.json'));p.add_argument('--output',default=str(ROOT/'output'));p.add_argument('--prepare-audio',action='store_true');args=p.parse_args()
    script=json.loads(Path(args.script).read_text());scenes=script['scenes'];assert len(scenes)==20 and script['durationSeconds']==600
    cache=ROOT/'render-cache';cache.mkdir(exist_ok=True);out=Path(args.output);out.mkdir(parents=True,exist_ok=True)
    with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:audio=list(pool.map(lambda s:prepare_scene(s,cache),scenes))
    (cache/'audio-timing.json').write_text(json.dumps(audio,indent=2))
    print(json.dumps({'audioScenes':len(audio),'maxTempo':max(x['tempo'] for x in audio),'lastSpeechEnds':[round(x['lastSpeechEnd'],2) for x in audio]},indent=2),flush=True)
    if args.prepare_audio:return
    mapping_file=Path(args.mapping).resolve();mapping=json.loads(mapping_file.read_text());mapping={key:str((mapping_file.parent/Path(value)).resolve()) for key,value in mapping.items()};frames=cache/'frames';frames.mkdir(exist_ok=True)
    concat=[];vtt=['WEBVTT','','NOTE Only the opening screen is an actual application screenshot. Other visuals are labeled illustrations or account instructions, not acceptance recordings.',''];transcript=['# '+script['title'],'','Runtime: 10:00 · English narration','',script['format'],'','Authenticated save, AI and organization-case segments are instructions, not recorded completion.',''];n=1
    for idx,(scene,track) in enumerate(zip(scenes,audio)):
        if scene['kind']=='screen' and scene['screenKey'] not in mapping:raise ValueError(f'Missing real screenshot: {scene["screenKey"]}')
        base=render_base(scene,idx,mapping);cues=track['cues']
        # Frames change at measured speech onsets; captions stay through small pauses.
        for j,cue in enumerate(cues):
            start=0 if j==0 else cue['start'];end=cues[j+1]['start'] if j+1<len(cues) else DURATION
            frame=frames/f'{idx:02}-{j:02}.png';add_caption(base,cue['text']).save(frame,optimize=True)
            with Image.open(frame) as checked:checked.verify()
            concat.extend([f"file '{frame}'",f'duration {end-start:.8f}'])
            vtt.extend([str(n),f"{vtt_time(idx*30+cue['start'])} --> {vtt_time(idx*30+cue['end'])}",cue['text'],'']);n+=1
        transcript.extend([f"## {chapter_time(idx)} — {scene['title']}",'',f"Mode: {'Account workflow instructions — completion not recorded' if scene['kind']=='instruction' else ('Illustrated workflow — not an application screenshot' if scene['kind']=='illustration' else 'Actual opening application screenshot')}",'',scene['narration'],''])
        if idx==0:
            # Poster must describe the format honestly rather than imitate a video player.
            poster=base.copy();pd=ImageDraw.Draw(poster)
            pd.rounded_rectangle((220,390,1210,730),radius=24,fill=NAVY)
            block(pd,'From canonical file\nto a new case'.replace('\n',' '),(275,438),880,53,'white',True,1.23)
            pd.text((278,602),'10-MINUTE NARRATED WALKTHROUGH',font=font(25,True),fill='#b7cdef')
            pd.text((278,653),'Five Flats, Three Borders · Studio essentials',font=font(24),fill='white')
            poster.save(out/'poster.jpg',quality=92,optimize=True)
    concat.append(concat[-2]);(cache/'frames.ffconcat').write_text('\n'.join(concat)+'\n')
    (out/'captions.en.vtt').write_text('\n'.join(vtt));(out/'transcript.md').write_text('\n'.join(transcript))
    joined=cache/'narration.wav'
    with wave.open(str(joined),'wb') as dest:
        dest.setnchannels(1);dest.setsampwidth(2);dest.setframerate(24000)
        for track in audio:
            with wave.open(track['audio'],'rb') as src:dest.writeframes(src.readframes(src.getnframes()))
    movie=out/'casevant-training-20261005.en.mp4'
    command=['ffmpeg','-nostdin','-y','-v','error','-xerror','-f','concat','-safe','0','-i',cache/'frames.ffconcat','-i',joined,'-t','600','-vf','fps=2,format=yuv420p','-c:v','libx264','-preset','veryfast','-tune','stillimage','-crf','23','-threads','4','-c:a','aac','-b:a','48k','-ar','24000','-movflags','+faststart','-metadata','title='+script['title'],'-metadata','comment='+script['format'],movie]
    run(command)
    if movie.stat().st_size>=24*1024*1024:
        command[command.index('-crf')+1]='29';run(command)
    if movie.stat().st_size>=24*1024*1024:raise ValueError('MP4 exceeds 24 MiB; reduce asset rate before integration')
    probe=json.loads(subprocess.run(['ffprobe','-v','error','-show_format','-show_streams','-of','json',str(movie)],capture_output=True,text=True,check=True).stdout)
    if abs(float(probe['format']['duration'])-600)>.15:raise ValueError('Output duration is not 600 seconds')
    for stream in probe['streams']:
        if stream['codec_type'] in ('audio','video') and abs(float(stream.get('duration',0))-600)>.55:
            raise ValueError(f"Incomplete {stream['codec_type']} stream")
    check={'file':str(movie),'bytes':movie.stat().st_size,'sha256':hashlib.sha256(movie.read_bytes()).hexdigest(),'durationSeconds':float(probe['format']['duration']),'sceneCount':20,'sceneDurationSeconds':30,'screenScenes':sum(s['kind']=='screen' for s in scenes),'illustrationScenes':sum(s['kind']=='illustration' for s in scenes),'instructionScenes':sum(s['kind']=='instruction' for s in scenes),'captionCues':n-1,'maxNarrationTempo':max(x['tempo'] for x in audio),'lastSpeechEnds':[round(x['lastSpeechEnd'],3) for x in audio],'streams':[{'type':s['codec_type'],'codec':s['codec_name'],'width':s.get('width'),'height':s.get('height'),'duration':s.get('duration')} for s in probe['streams']]}
    (out/'verification.json').write_text(json.dumps(check,indent=2)+'\n');print(json.dumps(check,indent=2),flush=True)

if __name__=='__main__':main()
