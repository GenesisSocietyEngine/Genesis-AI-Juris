"use client";

import { useEffect, useState } from "react";

type Props = { locale: "en" | "ru" };

export default function StudioAIProgress({ locale }: Props) {
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const estimate = Math.min(94, Math.round(8 + 86 * (1 - Math.exp(-elapsedSeconds / 30))));
  const phase = elapsedSeconds < 8 ? 0 : elapsedSeconds < 25 ? 1 : elapsedSeconds < 50 ? 2 : 3;
  const labels = locale === "en"
    ? ["Preparing context", "Analysing facts", "Building the graph", "Validating proposal"]
    : ["Подготовка контекста", "Анализ фактов", "Построение схемы", "Проверка плана"];
  const elapsed = `${Math.floor(elapsedSeconds / 60)}:${String(elapsedSeconds % 60).padStart(2, "0")}`;

  useEffect(() => {
    const timer = window.setInterval(() => setElapsedSeconds((seconds) => seconds + 1), 1_000);
    return () => window.clearInterval(timer);
  }, []);

  return <section className="prompt-ai-status prompt-ai-progress page-width analysing" role="status" aria-live="polite">
    <ProgressIcon/>
    <div className="ai-progress-body">
      <header><div><b>{labels[phase]}</b><p>{locale === "en" ? "Reading meaning, not keywords, then checking the complete proposal before review." : "Анализируется смысл, а не ключевые слова, затем весь план проверяется перед просмотром."}</p></div><span><strong>{estimate}%</strong><small>{locale === "en" ? `Estimated · ${elapsed} elapsed` : `Оценка · прошло ${elapsed}`}</small></span></header>
      <div className="ai-progress-track" role="progressbar" aria-label={locale === "en" ? "Estimated AI planning progress" : "Оценка прогресса AI-планирования"} aria-valuemin={0} aria-valuemax={100} aria-valuenow={estimate}><i style={{ width: `${estimate}%` }}/></div>
      <ol>{labels.map((label, index) => <li key={label} className={index < phase ? "done" : index === phase ? "active" : ""}><span>{index < phase ? "✓" : index + 1}</span><b>{label}</b></li>)}</ol>
      <small className="ai-progress-note">{locale === "en" ? "Estimated from elapsed time; the model does not stream an exact completion percentage. Complex cases can take up to 90 seconds." : "Оценка основана на прошедшем времени: модель не передаёт точный процент завершения. Сложные кейсы могут занять до 90 секунд."}</small>
    </div>
  </section>;
}

function ProgressIcon() {
  return <svg className="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2l1.4 5.1L18 9l-4.6 1.9L12 16l-1.4-5.1L6 9l4.6-1.9L12 2Zm6 12 .8 2.2L21 17l-2.2.8L18 20l-.8-2.2L15 17l2.2-.8L18 14Z" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/></svg>;
}
