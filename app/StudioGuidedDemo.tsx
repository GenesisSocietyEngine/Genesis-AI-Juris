"use client";

type Locale = "en" | "ru";

export default function StudioGuidedDemo({ locale }: { locale: Locale }) {
  const transcript = locale === "en" ? [
    "Open Studio in User view and follow one case throughout: Five Flats, Three Countries.",
    "Start with one compact instruction covering the PRC client, five English flats, £1m price, 80% financing, Liechtenstein route and 10% return target.",
    "Understand with AI expands that line into a read-only canonical case prompt with fixed facts, open assumptions, return definitions, lawful baseline, risks and evidence gates.",
    "Review and set the missing parameters: interest-only debt, 5% vacancy, management, repairs, operating costs, structure setup, annual administration and downside assumptions.",
    "Generate and inspect the 27-node, 31-connection graph. Edit a node or relationship and keep every revision undoable.",
    "Calculate the transparent outcome: £24,328 annual cash flow, 11.3% pre-tax cash-on-cash and 1.41x debt-service coverage.",
    "Generate the client-facing PDF from the same reviewed Studio state, including economics, decision map, registers, node conditions, checklist and fingerprint.",
  ] : [
    "Откройте Studio в пользовательском режиме и проведите один кейс через весь процесс: Five Flats, Three Countries.",
    "Начните с одной компактной инструкции: клиент из КНР, пять квартир в Англии, цена £1 млн, 80% финансирования, маршрут через Лихтенштейн и цель 10% годовой доходности.",
    "«Понять с ИИ» разворачивает строку в канонический промпт только для чтения: фиксированные факты, открытые допущения, определения доходности, законный базовый вариант, риски и доказательственные гейты.",
    "Проверьте и задайте недостающие параметры: interest-only долг, 5% вакансии, управление, ремонт, операционные расходы, стоимость структуры, ежегодное администрирование и downside-сценарий.",
    "Сгенерируйте и проверьте граф из 27 нодов и 31 связи. Измените ноду или связь, сохранив возможность Undo для каждой ревизии.",
    "Рассчитайте прозрачный outcome: £24 328 годового cash flow, 11,3% pre-tax cash-on-cash и покрытие долга 1,41x.",
    "Создайте клиентский PDF из того же проверенного состояния Studio: экономика, карта решений, реестры, условия нодов, checklist и fingerprint.",
  ];
  return <article className="help-video-card help-video-card-featured" id="studio-expert-demo">
    <video controls preload="metadata" playsInline poster="/help/studio-ai-guided-demo-poster.jpg" aria-describedby="guided-video-description guided-video-transcript">
      <source src="/help/studio-ai-guided-demo.en.mp4" type="video/mp4"/>
      {locale === "en" ? "Your browser does not support HTML video. Use the transcript below." : "Ваш браузер не поддерживает HTML-видео. Используйте расшифровку ниже."}
    </video>
    <div className="help-video-copy"><span>00 · 03:00 · STUDIO END TO END</span><h3>{locale === "en" ? "Five Flats, Three Countries — complete Studio workflow" : "Five Flats, Three Countries — весь процесс в Studio"}</h3><p id="guided-video-description">{locale === "en" ? "One guided expert walkthrough: shortest brief, canonical prompt, reviewed parameters, 27-node graph, transparent financial outcome and PDF report — entirely inside Studio and using the same case throughout." : "Единая экспертная демонстрация: краткий ввод, канонический промпт, проверенные параметры, граф из 27 нодов, прозрачный финансовый outcome и PDF — только в Studio и на одном кейсе."}</p><a className="secondary-cta help-video-direct-link" href="/help/studio-demo">{locale === "en" ? "Open full demo" : "Открыть полный ролик"}</a></div>
    <details className="help-transcript" id="guided-video-transcript"><summary>{locale === "en" ? "Read transcript" : "Открыть расшифровку"}</summary><ol>{transcript.map((item) => <li key={item}>{item}</li>)}</ol></details>
  </article>;
}
