"use client";

import { lazy, Suspense } from "react";

const HelpFaq = lazy(() => import("./HelpFaq"));

type Locale = "en" | "ru";

function ArrowIcon() {
  return (
    <svg className="icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 12h14M14 7l5 5-5 5" />
    </svg>
  );
}

export default function HelpView({ locale, openCommunity, openStudio }: { locale: Locale; openCommunity: () => void; openStudio: () => void }) {
  const steps = locale === "en" ? [
    ["Choose a case", "Use search, practice filters, tags, difficulty and duration to select a relevant matter."],
    ["Work the record", "Review the opening situation, inbox, evidence provenance, deadlines and available decisions."],
    ["Inspect consequences", "Every confirmed action advances time and changes the legal, evidential and institutional position."],
    ["Control access", "Keep a case on this device, save a restricted custom case to your workspace, mark it Private, or prepare a reviewed version for the General Library."],
  ] : [
    ["Выберите кейс", "Используйте поиск, фильтры практики, теги, сложность и длительность."],
    ["Работайте с материалами", "Изучите ситуацию, Inbox, доказательства, сроки и доступные решения."],
    ["Разберите последствия", "Каждое действие продвигает время и меняет правовую и институциональную позицию."],
    ["Управляйте доступом", "Храните кейс на устройстве, сохраняйте ограниченный custom-кейс в workspace, включайте «Приватно» или готовьте проверенную версию для Общей библиотеки."],
  ];
  const editorTranscript = locale === "en" ? [
    "Open Case Studio. Every prompt and visual change stays in one authoring record.",
    "Add evidence, connect it to a decision, and rename an actor with the exact-command fallback.",
    "Review the deterministic operation plan before applying graph changes.",
    "Apply the plan as one transaction, inspect its exact diff, or undo it.",
    "Add, rename and connect a node directly in the visual editor.",
    "Relink an existing relationship, then check the graph and launch the player.",
  ] : [
    "Откройте Case Studio. Промпты и визуальные правки сохраняются в единой истории кейса.",
    "Добавьте доказательство, связь и переименуйте участника через резервный режим точных команд.",
    "До применения проверьте детерминированный план операций над графом.",
    "Примените план одной транзакцией, изучите точный diff или отмените изменение.",
    "Добавьте, переименуйте и соедините узел прямо в визуальном редакторе.",
    "Перепривяжите существующую связь, проверьте граф и запустите плеер.",
  ];
  const playTranscript = locale === "en" ? [
    "Confirm that Check & play reports the current graph as ready.",
    "Launch your case in the same Operations player used by published scenarios.",
    "Review the record, available evidence, deadline, and linked decision options.",
    "Confirm a decision and observe its consequence, clock, metrics, and deadline state.",
    "Finish the branch and inspect the complete debrief for your own case.",
  ] : [
    "Убедитесь, что раздел «Проверить и играть» отмечает текущий граф как готовый.",
    "Запустите кейс в том же плеере Operations, что используется для опубликованных сценариев.",
    "Изучите материалы, доказательства, срок и варианты связанного решения.",
    "Подтвердите выбор и проследите его последствия, время, метрики и состояние срока.",
    "Завершите ветвь и изучите полный разбор собственного кейса.",
  ];
  return <main className="help-view page-width">
    <section className="help-hero"><span>QUICK HELP</span><h1>{locale === "en" ? "How GENESIS: JURIS works" : "Как работает GENESIS: JURIS"}</h1><p>{locale === "en" ? "A practical legal-simulation system: read the evolving matter, make consequential decisions, learn from the debrief and help practitioners improve the next version." : "Практическая система юридических симуляций: изучайте развивающееся дело, принимайте значимые решения, анализируйте результат и помогайте улучшать следующую версию."}</p></section>
    <section className="help-steps">{steps.map(([title, body], index) => <article key={title}><span>{String(index + 1).padStart(2, "0")}</span><h2>{title}</h2><p>{body}</p></article>)}</section>
    <section className="help-video-guides" aria-labelledby="help-video-guides-title">
      <header><span>GUIDED DEMOS</span><h2 id="help-video-guides-title">{locale === "en" ? "Create, refine, then play" : "Создайте, доработайте и пройдите"}</h2><p>{locale === "en" ? "These captioned walkthroughs cover the stable visual editor, exact-command fallback and player. The current AI-first flow is explained in the open guide below." : "Ролики с субтитрами показывают стабильный визуальный редактор, резервный режим точных команд и плеер. Актуальный AI-first процесс описан в открытом руководстве ниже."}</p></header>
      <div className="help-video-grid">
        <article className="help-video-card">
          <video controls preload="metadata" playsInline poster="/help/case-studio-iterative-editing-poster.jpg" aria-describedby="editor-video-description editor-video-transcript">
            <source src="/help/case-studio-iterative-editing.mp4" type="video/mp4" />
            <track kind="captions" src="/help/case-studio-iterative-editing.en.vtt" srcLang="en" label="English" default={locale === "en"} />
            <track kind="captions" src="/help/case-studio-iterative-editing.ru.vtt" srcLang="ru" label="Русский" default={locale === "ru"} />
            {locale === "en" ? "Your browser does not support HTML video. Use the transcript below." : "Ваш браузер не поддерживает HTML-видео. Используйте расшифровку ниже."}
          </video>
          <div className="help-video-copy"><span>01 · 00:26</span><h3>{locale === "en" ? "Visual editing & exact-command fallback" : "Визуальные правки и точные команды"}</h3><p id="editor-video-description">{locale === "en" ? "This recording demonstrates the deterministic fallback and stable graph controls. In the current release, Understand with AI is the primary entry point and always requires review before apply." : "Запись показывает детерминированный резервный режим и стабильные элементы графа. В текущей версии основной вход — «Понять с ИИ» с обязательной проверкой до применения."}</p></div>
          <details className="help-transcript" id="editor-video-transcript"><summary>{locale === "en" ? "Read transcript" : "Открыть расшифровку"}</summary><ol>{editorTranscript.map((item) => <li key={item}>{item}</li>)}</ol></details>
        </article>
        <article className="help-video-card">
          <video controls preload="metadata" playsInline poster="/help/play-your-studio-case-poster.jpg" aria-describedby="play-video-description play-video-transcript">
            <source src="/help/play-your-studio-case.mp4" type="video/mp4" />
            <track kind="captions" src="/help/play-your-studio-case.en.vtt" srcLang="en" label="English" default={locale === "en"} />
            <track kind="captions" src="/help/play-your-studio-case.ru.vtt" srcLang="ru" label="Русский" default={locale === "ru"} />
            {locale === "en" ? "Your browser does not support HTML video. Use the transcript below." : "Ваш браузер не поддерживает HTML-видео. Используйте расшифровку ниже."}
          </video>
          <div className="help-video-copy"><span>02 · 00:17</span><h3>{locale === "en" ? "Play your own Studio case" : "Прохождение своего кейса"}</h3><p id="play-video-description">{locale === "en" ? "Compile the current graph into the complete runtime, make a linked decision, observe its operational consequences, and finish with a full debrief." : "Скомпилируйте текущий граф в полный игровой сценарий, примите связанное решение, проследите операционные последствия и завершите кейс полным разбором."}</p></div>
          <details className="help-transcript" id="play-video-transcript"><summary>{locale === "en" ? "Read transcript" : "Открыть расшифровку"}</summary><ol>{playTranscript.map((item) => <li key={item}>{item}</li>)}</ol></details>
        </article>
      </div>
    </section>
    <Suspense fallback={<section className="help-faq"><h2>{locale === "en" ? "Loading help…" : "Загрузка помощи…"}</h2></section>}><HelpFaq locale={locale} /></Suspense>
    <div className="help-actions"><button className="secondary-cta" onClick={openCommunity}>{locale === "en" ? "Register or update profile" : "Регистрация и профиль"}</button><button className="primary-cta" onClick={openStudio}>{locale === "en" ? "Open Case Studio" : "Открыть Case Studio"}<ArrowIcon /></button></div>
  </main>;
}
