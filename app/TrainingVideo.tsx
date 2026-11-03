"use client";

import { useEffect, useRef, useState } from "react";
import training from "./training-current.json";
import { createRecordingMedia } from "./recording-media";

export default function TrainingVideo({ locale = "en" }: { locale?: "en" | "ru" }) {
  const video = useRef<HTMLVideoElement>(null), pending = useRef<number | null>(null), resume = useRef(false);
  const media = useRef<ReturnType<typeof createRecordingMedia> | null>(null), active = useRef(true);
  const [notice, setNotice] = useState("");
  const en = locale === "en", time = (seconds: number) => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2,"0")}`;
  useEffect(() => { active.current = true; return () => { active.current = false; media.current?.dispose(); media.current = null; }; }, []);
  async function seek(seconds: number, play = false) {
    if (!video.current) return;
    pending.current = seconds; resume.current = play; video.current.pause(); video.current.focus(); video.current.scrollIntoView({ block: "center", behavior: "auto" });
    setNotice(en ? "Loading the guide…" : "Загружается руководство…");
    media.current ??= createRecordingMedia(training.video, { fetch: (path, options) => fetch(path, options), create: blob => URL.createObjectURL(blob), revoke: url => URL.revokeObjectURL(url) });
    try {
      const url = await media.current.load();
      if (!active.current || !video.current) return;
      if (video.current.src !== url) { video.current.src = url; video.current.load(); }
      else if (video.current.readyState > 0) applyChapter();
    } catch { if (active.current) setNotice(en ? "Video could not load. Use the transcript or download link below." : "Видео не загрузилось. Откройте расшифровку или ссылку для скачивания."); }
  }
  function applyChapter() {
    const player = video.current;
    if (!player?.src.startsWith("blob:") || pending.current === null) return;
    player.currentTime = pending.current; pending.current = null;
    if (resume.current) { resume.current = false; void player.play().catch(() => { if (active.current) setNotice(en ? "Ready. Press Play to continue." : "Готово. Нажмите «Воспроизвести»."); }); }
  }
  return <section className="training-player" id="training" tabIndex={-1} aria-labelledby="training-title">
    <header><span>{time(training.durationSeconds)} · {en ? "ENGLISH NARRATION · UPDATED 3 NOVEMBER 2026" : "АНГЛИЙСКАЯ ОЗВУЧКА · ОБНОВЛЕНО 3 НОЯБРЯ 2026"}</span><h2 id="training-title">{training.title[locale]}</h2><p>{en ? "From an independent working case to sources, evidence changes, Review, saving and reports." : "От самостоятельного рабочего кейса к источникам, изменениям материалов, проверке, сохранению и отчётам."}</p></header>
    <video ref={video} controls preload="none" playsInline poster={training.poster} aria-label={training.title[locale]} aria-describedby="training-format" onLoadedMetadata={applyChapter}
      onPlay={() => { if (video.current && !video.current.src.startsWith("blob:")) void seek(video.current.currentTime, true); else setNotice(en ? "Playing guide." : "Руководство воспроизводится."); }}
      onSeeked={() => setNotice(!video.current?.paused ? (en ? "Playing guide." : "Руководство воспроизводится.") : en ? `Chapter at ${time(Math.floor(video.current?.currentTime ?? 0))}. Press Play if paused.` : `Глава: ${time(Math.floor(video.current?.currentTime ?? 0))}. Если видео на паузе, нажмите «Воспроизвести».`)}
      onError={() => setNotice(en ? "Video could not load. Use the transcript or download link below." : "Видео не загрузилось. Откройте расшифровку или ссылку для скачивания.")}>
      <source src={training.video} type="video/mp4"/>
      {en ? "Use the transcript or download the MP4 below." : "Откройте расшифровку или скачайте MP4 ниже."}
    </video>
    <p id="training-format" className="training-format">{en ? "Narrated workflow illustrations. No subtitles. For small screens, use fullscreen or read the English/Russian transcript below." : "Иллюстрации рабочего процесса с озвучкой. Без субтитров. На небольшом экране включите полный экран или прочитайте текст на английском/русском ниже."}</p>
    <div className="training-downloads"><button type="button" className="secondary-cta" onClick={() => void seek(0, true)}>{en ? "Play video" : "Воспроизвести видео"}</button><a href={training.video} download>{en ? "Download video" : "Скачать видео"}</a><a href="/help/training-20261103/transcript.en.md" download>{en ? "English transcript" : "Текст на английском"}</a><a href="/help/training-20261103/transcript.ru.md" download>{en ? "Russian transcript" : "Текст на русском"}</a><a href={`/studio?view=help&lang=${locale}#guides`}>{en ? "Current guides" : "Актуальные инструкции"}</a></div>
    <p className="training-format" role="status">{notice}</p>
    <details className="training-chapters"><summary>{en ? "Jump to a chapter" : "Перейти к главе"}</summary><ol>{training.scenes.map(scene => <li key={scene.id}><button type="button" onClick={() => void seek(scene.at)}><time>{time(scene.at)}</time><span>{scene.title[locale]}</span></button></li>)}</ol></details>
    <details className="training-transcript"><summary>{en ? "Read the full transcript" : "Прочитать расшифровку"}</summary>{training.scenes.map(scene => <section key={scene.id}><h3>{scene.title[locale]}</h3><p>{scene.narration[locale]}</p></section>)}</details>
    <details className="training-transcript"><summary>{en ? "About this guide and earlier material" : "О руководстве и предыдущих материалах"}</summary>
      <p>{en ? "Instructional illustrations with offline synthetic narration, based on the v174 workflow. This is not a screen recording or proof of authenticated saves, AI execution or file delivery. Check results in your own case." : "Учебные иллюстрации с синтезированной локально озвучкой по рабочему процессу v174. Это не запись экрана и не подтверждение входа, сохранения, работы AI или получения файлов. Проверяйте результаты в своём кейсе."}</p>
      <p>{en ? "Export case brief (.md) offers Working brief and Prepared brief. Prepared brief does not record human review or approval." : "Экспорт описания кейса (.md) предлагает рабочее и подготовленное описание. Подготовленное описание не фиксирует проверку или утверждение человеком."}</p>
      <a href="/help/casevant-training-20261005-transcript.md" download>{en ? "Earlier Five Flats, Three Borders transcript · 5 October 2026" : "Предыдущий текст Five Flats, Three Borders · 5 октября 2026"}</a>
    </details>
  </section>;
}
