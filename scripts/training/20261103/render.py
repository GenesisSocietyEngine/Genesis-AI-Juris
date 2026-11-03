"""Current workflow illustrations, offline narration and no subtitle generation.

Frames use titles and action labels only. Narration is never painted on frames.
Original October/November recordings are not edited or overwritten.
"""
import argparse, hashlib, json, re, shutil, struct, subprocess, wave
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[3]
SOURCE = ROOT / 'app/training-current.json'
W, H = 1920, 1080
NAVY, TEAL, LIME, MUTED = '#16343f', '#08777e', '#d4ef73', '#526978'

def sha(path): return hashlib.sha256(path.read_bytes()).hexdigest()
def command(args): subprocess.run([str(x) for x in args], check=True, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)
def font(size, bold=False): return ImageFont.truetype('C:/Windows/Fonts/arialbd.ttf' if bold else 'C:/Windows/Fonts/arial.ttf', size)
def lines(draw, text, face, width):
    result, line = [], ''
    for word in text.split():
        proposed = (line + ' ' + word).strip()
        if line and draw.textlength(proposed, font=face) > width: result.append(line); line = word
        else: line = proposed
    return result + ([line] if line else [])

def frame(scene, index):
    image = Image.new('RGB', (W,H), '#f1f7ff'); draw = ImageDraw.Draw(image)
    draw.rectangle((0,0,W,128), fill='white'); draw.rectangle((0,0,W,8), fill=TEAL)
    draw.text((72,44), 'CaseVant', font=font(38,True), fill=NAVY)
    draw.text((1250,53), 'WORKFLOW GUIDE  /  3 NOV 2026', font=font(22,True), fill=TEAL)
    draw.text((76,177), f'{index+1:02d}  /  WORKFLOW ILLUSTRATION', font=font(23,True), fill=TEAL)
    y = 237
    for line in lines(draw, scene['title']['en'], font(66,True), 1720):
        draw.text((72,y),line,font=font(66,True),fill=NAVY); y += 78
    y = max(410,y+45)
    for number, step in enumerate(scene['steps'],1):
        draw.rounded_rectangle((74,y,1845,y+122), radius=18, fill='white', outline='#bed4e3', width=2)
        draw.ellipse((105,y+28,171,y+94),fill=LIME)
        draw.text((127,y+43),str(number),font=font(30,True),fill=NAVY)
        wrapped = lines(draw,step,font(38,True),1580); assert len(wrapped)<=2
        for row,line in enumerate(wrapped): draw.text((206,y+24+row*43),line,font=font(38,True),fill=NAVY)
        y += 145
    assert y < 976, 'Visual overflow'
    draw.text((76,1000),'Instructions • English synthetic narration • Verify results in your own case',font=font(24),fill=MUTED)
    for part in range(8): draw.rectangle((74+part*222,1053,74+part*222+208,1062),fill=TEAL if part<=index else '#cedfe9')
    return image

def boxes(data,start=0,end=None):
    end=len(data) if end is None else end; at=start
    while at+8<=end:
        size,kind=struct.unpack_from('>I4s',data,at); header=8
        if size==1: size=struct.unpack_from('>Q',data,at+8)[0]; header=16
        if size==0: size=end-at
        assert size>=header and at+size<=end
        yield kind,at+header,at+size,at
        at+=size

def inspect_movie(path):
    data=path.read_bytes(); top=list(boxes(data)); moov=next(x for x in top if x[0]==b'moov')
    handlers=[]; duration=None
    for kind,start,end,_ in boxes(data,moov[1],moov[2]):
        if kind==b'mvhd':
            assert data[start]==0
            scale,ticks=struct.unpack_from('>II',data,start+12); duration=ticks/scale
        if kind==b'trak':
            mdia=next(x for x in boxes(data,start,end) if x[0]==b'mdia')
            hdlr=next(x for x in boxes(data,mdia[1],mdia[2]) if x[0]==b'hdlr')
            handlers.append(data[hdlr[1]+8:hdlr[1]+12].decode('ascii'))
    assert sorted(handlers)==['soun','vide'], handlers
    assert moov[3]<next(x[3] for x in top if x[0]==b'mdat')
    return {'durationSeconds':duration,'handlers':handlers,'subtitleStreams':0,'fastStart':True}

def main():
    parser=argparse.ArgumentParser(); parser.add_argument('--ffmpeg',required=True);parser.add_argument('--audio',required=True);args=parser.parse_args()
    script=json.loads(SOURCE.read_text(encoding='utf-8')); output=ROOT/'public/help/training-20261103'; output.mkdir(exist_ok=True)
    frames=ROOT/'scripts/training/20261103/frames';frames.mkdir(exist_ok=True)
    scratch=ROOT/'.artifacts/help-update-20261103/render';scratch.mkdir(parents=True,exist_ok=True)
    image_entries=[];scene_receipts=[]
    joined=scratch/"narration.wav"
    audio_output=wave.open(str(joined),"wb");audio_output.setparams((1,2,24000,0,"NONE","not compressed"))
    for index,scene in enumerate(script['scenes']):
        image=frame(scene,index); path=frames/(scene['id']+'.jpg');image.save(path,quality=94,subsampling=0)
        if index==0: image.save(output/'poster.jpg',quality=94,subsampling=0)
        audio=Path(args.audio)/(scene['id']+'.wav')
        with wave.open(str(audio)) as wav: spoken=wav.getnframes()/wav.getframerate()
        assert 1<spoken<29.5, (scene['id'],spoken)
        with wave.open(str(audio)) as wav:
            assert (wav.getnchannels(),wav.getsampwidth(),wav.getframerate())==(1,2,24000)
            samples=wav.getnframes();audio_output.writeframes(wav.readframes(samples)+bytes((30*24000-samples)*2))
        image_entries.append(path);scene_receipts.append({'id':scene['id'],'at':scene['at'],'frameSha256':sha(path),'speechSeconds':round(spoken,3),'frameKind':'workflow illustration, not an application screenshot'})
    audio_output.close()
    concat=scratch/'frames.txt';concat.write_text(''.join("file '"+p.as_posix()+"'\nduration 30\n" for p in image_entries)+"file '"+image_entries[-1].as_posix()+"'\n",encoding='utf-8')
    movie=scratch/'guide.en.mp4'
    command([args.ffmpeg,'-nostdin','-y','-v','error','-f','concat','-safe','0','-i',concat,'-i',joined,'-t','240','-vf','fps=2,setpts=PTS-STARTPTS,format=yuv420p','-c:v','libx264','-preset','veryfast','-tune','stillimage','-crf','21','-threads','2','-c:a','aac','-b:a','64k','-ar','24000','-movflags','+faststart',movie])
    info=inspect_movie(movie);assert abs(info['durationSeconds']-240)<.25;assert movie.stat().st_size<8*1024*1024
    command([args.ffmpeg,'-nostdin','-v','error','-xerror','-i',movie,'-f','null','-'])
    first=subprocess.run([args.ffmpeg,'-hide_banner','-i',str(movie),'-vf','showinfo','-frames:v','1','-an','-f','null','-'],capture_output=True,text=True,check=True).stderr
    first_time=float(re.search(r'pts_time:([0-9.-]+)',first)[1]);assert abs(first_time)<.00005
    info['firstVideoFrameSeconds']=first_time
    shutil.copyfile(movie,output/'guide.en.mp4')
    for locale in ['en','ru']:
        text=['# '+script['title'][locale],'','Updated 3 November 2026 · 4:00 · English synthetic narration · no subtitles','',script['format'],'']
        for scene in script['scenes']: text += [f"## {scene['at']//60}:{scene['at']%60:02d} — {scene['title'][locale]}",'',scene['narration'][locale],'']
        (output/('transcript.'+locale+'.md')).write_text('\n'.join(text),encoding='utf-8',newline='\n')
    assets=[{'path':'/help/training-20261103/'+p.name,'bytes':p.stat().st_size,'sha256':sha(p)} for p in sorted(output.iterdir()) if p.name!='manifest.json']
    receipt={'format':script['format'],'date':script['date'],'workflowSourceCommit':script['sourceCommit'],'narration':'Offline Microsoft Zira Desktop synthetic voice; no provider call','scriptSha256':sha(SOURCE),'rendererSha256':sha(Path(__file__)),'fullyDecoded':True,'burnedInNarration':False,**info,'scenes':scene_receipts,'assets':assets}
    (output/'manifest.json').write_text(json.dumps(receipt,indent=2)+'\n',encoding='utf-8',newline='\n');print(json.dumps({'video':str(movie),'bytes':movie.stat().st_size,**info}))

if __name__=='__main__': main()
