"use client";

type Locale = "en" | "ru";

export default function StudioGuidedDemo({ locale }: { locale: Locale }) {
  const transcript = locale === "en" ? [
    "Open Case Studio in User view and start with a five-line professional brief.",
    "Understand with AI converts the brief into a candidate scheme with semantic nodes, explicit relationships, deadlines, consequences and economic inputs.",
    "Nothing changes until the author reviews every proposed operation and applies the reviewed transaction.",
    "Refine one node directly in the visual editor while preserving the AI proposal and manual edit in the same authoring record.",
    "Add, relink and delete a relationship, then restore the previous graph state with Undo.",
    "Check and play the compiled case, confirm a decision and inspect the €64,500 award, €2,350 spend and €62,150 net result.",
    "Export a professional PDF report whose conclusions remain linked to the reviewed graph, economics and source register.",
  ] : [
    "Откройте Case Studio в пользовательском режиме и начните с пятистрочного профессионального описания.",
    "«Понять с ИИ» превращает описание в проверяемую схему: смысловые ноды, явные связи, сроки, последствия и экономические параметры.",
    "До проверки автором и применения подтверждённой транзакции в кейсе ничего не меняется.",
    "Уточните одну ноду прямо в визуальном редакторе: AI-предложение и ручная правка сохраняются в единой истории.",
    "Добавьте, перепривяжите и удалите связь, затем восстановите предыдущее состояние графа через Undo.",
    "Проверьте и запустите собранный кейс, подтвердите решение и изучите результат: €64 500 присуждено, €2 350 расходов, €62 150 чистого эффекта.",
    "Экспортируйте профессиональный PDF-отчёт, выводы которого связаны с проверенным графом, экономикой и реестром источников.",
  ];
  return <article className="help-video-card help-video-card-featured" id="studio-expert-demo">
    <video controls preload="metadata" playsInline poster="/help/studio-ai-guided-demo-poster.jpg" aria-describedby="guided-video-description guided-video-transcript">
      <source src="/help/studio-ai-guided-demo.mp4" type="video/mp4"/>
      <track kind="captions" src="/help/studio-ai-guided-demo.en.vtt" srcLang="en" label="English" default={locale === "en"}/>
      <track kind="captions" src="/help/studio-ai-guided-demo.ru.vtt" srcLang="ru" label="Русский" default={locale === "ru"}/>
      {locale === "en" ? "Your browser does not support HTML video. Use the transcript below." : "Ваш браузер не поддерживает HTML-видео. Используйте расшифровку ниже."}
    </video>
    <div className="help-video-copy"><span>00 · 02:00 · COMPLETE DEMO</span><h3>{locale === "en" ? "From five-line brief to professional report" : "От пяти строк до профессионального отчёта"}</h3><p id="guided-video-description">{locale === "en" ? "A complete Studio walkthrough for expert review: User view, reviewable AI proposal, manual graph control, Undo, deterministic player, financial result and PDF handoff." : "Полная демонстрация Studio для экспертной оценки: User view, проверяемое AI-предложение, ручное управление графом, Undo, детерминированный плеер, финансовый результат и PDF."}</p><a className="secondary-cta help-video-direct-link" href="/help/studio-demo">{locale === "en" ? "Open direct player" : "Открыть отдельную страницу"}</a></div>
    <details className="help-transcript" id="guided-video-transcript"><summary>{locale === "en" ? "Read transcript" : "Открыть расшифровку"}</summary><ol>{transcript.map((item) => <li key={item}>{item}</li>)}</ol></details>
  </article>;
}
