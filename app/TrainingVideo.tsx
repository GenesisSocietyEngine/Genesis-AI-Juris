"use client";

import { useRef, useState } from "react";
import training from "./training-content.json";

export default function TrainingVideo({ locale = "en" }: { locale?: "en" | "ru" }) {
  const video = useRef<HTMLVideoElement>(null);
  const [notice, setNotice] = useState("");
  const en = locale === "en";
  function seek(seconds: number) {
    if (!video.current) return;
    video.current.currentTime = seconds;
    video.current.focus();
    setNotice(en ? `Chapter selected at ${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}. Press Play to continue.` : "Глава выбрана. Нажмите «Воспроизвести».");
  }
  return <section className="training-player" id="training" aria-labelledby="training-title">
    <header><span>10:00 · {en ? "ENGLISH NARRATION + CAPTIONS" : "АНГЛИЙСКАЯ ОЗВУЧКА И СУБТИТРЫ"}</span><h2 id="training-title">{en ? "From canonical file to a new case" : "От канонического файла к новому кейсу"}</h2><p>{en ? "Follow Five Flats, Three Borders through import, evidence, the decision map and reporting. Then start your own case." : "Пройдите Five Flats, Three Borders: импорт, доказательства, карта решений и отчёт. Затем создайте свой кейс."}</p></header>
    <video ref={video} controls preload="metadata" playsInline poster="/help/juris-training-10min-poster.jpg" aria-describedby="training-format" onError={() => setNotice(en ? "Video could not load. Use the transcript or download link below." : "Видео не загрузилось. Откройте расшифровку или ссылку для скачивания.")}>
      <source src="/help/juris-training-10min.en.mp4" type="video/mp4"/>
      <track kind="captions" src="/help/juris-training-10min.en.vtt" srcLang="en" label="English" default/>
      {en ? "Use the transcript or download the MP4 below." : "Откройте расшифровку или скачайте MP4 ниже."}
    </video>
    <p id="training-format" className="training-format">{en ? "Narrated, illustrated walkthrough with one application capture and labeled account instructions. Authenticated saves, AI requests and organization-case creation are explained, not presented as recorded successful actions." : "Иллюстрированное обучение с озвучкой, одним снимком приложения и отдельными инструкциями для аккаунта. Сохранение после входа, AI-запросы и создание дела организации объясняются, а не выдаются за записанные успешные действия."}</p>
    <div className="training-downloads"><a href="/help/juris-training-10min.en.mp4" download>{en ? "Download video" : "Скачать видео"}</a><a href="/help/juris-training-10min-transcript.md" download>{en ? "Download transcript" : "Скачать расшифровку"}</a><a href="/help/juris-training-10min.en.vtt" download>{en ? "English captions" : "Английские субтитры"}</a></div>
    <p className="visually-hidden" role="status">{notice}</p>
    <details className="training-chapters" open><summary>{en ? "Jump to a chapter" : "Перейти к главе"}</summary><ol>{training.scenes.filter((scene,index,all) => index === 0 || scene.chapter !== all[index-1].chapter).map(scene => {
      const seconds = (Number(scene.id)-1)*30;
      return <li key={scene.id}><button type="button" onClick={() => seek(seconds)}><time>{Math.floor(seconds/60)}:{String(seconds%60).padStart(2,"0")}</time><span>{scene.chapter}</span></button></li>;
    })}</ol></details>
    <details className="training-transcript"><summary>{en ? "Read the full transcript" : "Прочитать расшифровку"}</summary>{training.scenes.map(scene => <section key={scene.id}><h3>{scene.title}{scene.kind === "instruction" ? " · Instructions" : ""}</h3><p>{scene.narration}</p></section>)}</details>
  </section>;
}
