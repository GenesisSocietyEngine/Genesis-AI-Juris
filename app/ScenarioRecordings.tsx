"use client";

import {useEffect,useRef,useState} from 'react';
import {createRecordingMedia} from './recording-media';
import recordings from './scenario-recordings.json';
import styles from './scenario-recordings.module.css';

function Recording({recording,locale}:{recording:typeof recordings[number];locale:'en'|'ru'}) {
  const video=useRef<HTMLVideoElement>(null),pending=useRef<number|null>(null),resume=useRef(false);
  const media=useRef<ReturnType<typeof createRecordingMedia>|null>(null),active=useRef(true);
  useEffect(()=>{active.current=true;return()=>{active.current=false;media.current?.dispose();media.current=null;};},[]);
  const [notice,setNotice]=useState('');
  const en=locale==='en',time=(seconds:number)=>`${Math.floor(seconds/60)}:${String(seconds%60).padStart(2,'0')}`;
  async function seek(seconds:number,play=false) {
    if(!video.current)return;
    resume.current=play;
    pending.current=seconds;
    video.current.pause();
    video.current.focus();
    setNotice(en?'Loading the short recording…':'Загружается короткая запись…');
    media.current??=createRecordingMedia(recording.video,{fetch:(path,options)=>fetch(path,options),create:blob=>URL.createObjectURL(blob),revoke:url=>URL.revokeObjectURL(url)});
    try {
      const url=await media.current.load();
      if(!active.current||!video.current)return;
      if(video.current.src!==url){video.current.src=url;video.current.load();}
      else if(video.current.readyState>0&&pending.current!==null){video.current.currentTime=pending.current;pending.current=null;}
    }catch{if(active.current)setNotice(en?'Unable to load this step. Read the steps below or download the transcript.':'Не удалось загрузить шаг. Прочитайте шаги ниже или скачайте расшифровку.');}
  }
  function applyStep() {
    const player=video.current;
    if(!player?.src.startsWith('blob:')||pending.current===null)return;
    player.currentTime=pending.current;pending.current=null;
    if(resume.current){resume.current=false;void player.play().catch(()=>{if(active.current)setNotice(en?'Ready. Press Play to continue.':'Готово. Нажмите «Воспроизвести».');});}
  }
  return <article className={styles.card} aria-labelledby={`recording-${recording.id}`}>
    <header><p className={styles.meta}>{time(recording.durationSeconds)} · {en?'RECORDED 2 NOVEMBER 2026':'ЗАПИСАНО 2 НОЯБРЯ 2026'}</p><h3 id={`recording-${recording.id}`}>{recording.title[locale]}</h3><p>{recording.description[locale]}</p></header>
    <video ref={video} controls playsInline preload="none" style={{aspectRatio:`${recording.width}/${recording.height}`}} poster={recording.poster} aria-label={recording.title[locale]} aria-describedby={`scope-${recording.id}`} onPlay={()=>{if(video.current&&!video.current.src.startsWith('blob:'))void seek(video.current.currentTime,true);else setNotice(en?'Playing recording.':'Запись воспроизводится.');}} onSeeked={()=>{const seconds=Math.round(video.current?.currentTime??0);setNotice(video.current?.paused?(en?`Step selected at ${time(seconds)}. Press Play to continue.`:`Выбран шаг ${time(seconds)}. Нажмите «Воспроизвести».`):(en?'Playing recording.':'Запись воспроизводится.'));}} onLoadedMetadata={applyStep} onError={()=>setNotice(en?'Video unavailable. Read the steps below or download the transcript.':'Видео недоступно. Прочитайте шаги ниже или скачайте расшифровку.')}>
      <source src={recording.video} type="video/mp4"/>
      <track kind="captions" srcLang="en" label="English" src={recording.video.replace('.mp4','.en.vtt')} default={en}/>
      <track kind="captions" srcLang="ru" label="Русский" src={recording.video.replace('.mp4','.ru.vtt')} default={!en}/>
      {en?'Read the steps below if video playback is unavailable.':'Если видео не воспроизводится, прочитайте шаги ниже.'}
    </video>
    <div className={styles.body}><p id={`scope-${recording.id}`} className={styles.meta}>{en?'Edited step captures from the actual local preview. Fictional/synthetic data, English interface, no audio; EN/RU captions. Authenticated saves, AI and file delivery are not demonstrated.':'Смонтированные кадры реальной локальной версии. Вымышленные данные, английский интерфейс, без звука; субтитры EN/RU. Вход, сохранение, AI и получение файлов не показаны.'}</p>
      <div className={styles.downloads}><a href={recording.video} download>{en?'Download video (.mp4)':'Скачать видео (.mp4)'}</a><a href={recording.video.replace('.mp4',`.${locale}.md`)} download>{en?'Download transcript (.md)':'Скачать расшифровку (.md)'}</a><a href={recording.video.replace('.mp4',`.${locale}.vtt`)} download>{en?'Download captions (.vtt)':'Скачать субтитры (.vtt)'}</a></div>
      <p role="status" className={styles.meta}>{notice}</p>
      <details><summary>{en?'Read steps or jump to a step':'Прочитать шаги или перейти к шагу'}</summary><ol>{recording.steps.map(step=><li key={step.at}><button type="button" onClick={()=>seek(step.at)} aria-label={`${en?'Select step at':'Выбрать шаг'} ${time(step.at)}`}><time>{time(step.at)}</time><span>{step.text[locale]}</span></button></li>)}</ol></details>
    </div>
  </article>;
}

export default function ScenarioRecordings({locale}:{locale:'en'|'ru'}) {
  const en=locale==='en';
  return <section id="recordings" tabIndex={-1} className={styles.section} aria-labelledby="scenario-recordings-title">
    <header><p className={styles.eyebrow}>{en?'LEARN BY FOLLOWING A TASK':'ОБУЧЕНИЕ НА КОНКРЕТНЫХ ЗАДАЧАХ'}</p><h2 id="scenario-recordings-title">{en?'Scenario recordings':'Записи сценариев'}</h2><p>{en?'Two short walkthroughs of source inspection and local editing. Use fullscreen for screen details, read the steps below, or download the material.':'Два коротких примера проверки источников и локального редактирования. Для деталей включите полный экран, прочитайте шаги ниже или скачайте материалы.'}</p></header>
    <div className={styles.grid}>{recordings.map(recording=><Recording key={recording.id} recording={recording} locale={locale}/>)}</div>
  </section>;
}
