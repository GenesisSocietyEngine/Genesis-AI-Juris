"use client";

import TrainingVideo from "./TrainingVideo";
import { CaseVantDomainGuide } from "./CaseVantDomainNotice";
import { helpContent } from "./help-content";
import type { AppView } from "./studio-entry";

export default function HelpCenter({ locale, onNavigate }: { locale: "en" | "ru"; onNavigate: (view: AppView) => void }) {
  const en = locale === "en";
  const { guides, faq } = helpContent[locale];
  const personal = `/matters?collection=personal&lang=${locale}`;
  return <main className="learning-page page-width">
    <header className="learning-heading"><span>{en ? "HELP & TRAINING · UPDATED 5 OCTOBER 2026" : "ПОМОЩЬ И ОБУЧЕНИЕ · ОБНОВЛЕНО 5 ОКТЯБРЯ 2026"}</span><h1>{en ? "Your first case in CaseVant" : "Ваш первый кейс в CaseVant"}</h1><p>{en ? "Describe the decision, review the structure, confirm the save and inspect the report. Start with the current guides below." : "Опишите решение, проверьте структуру, подтвердите сохранение и изучите отчёт. Начните с актуальных инструкций ниже."}</p></header>
    <div className="learning-start"><button onClick={() => onNavigate("demos")}><b>{en ? "Explore a demo" : "Изучить демо"}</b><span>{en ? "Follow a fictional example" : "Пройти учебный пример"}</span></button><button onClick={() => onNavigate("templates")}><b>{en ? "Choose a template" : "Выбрать шаблон"}</b><span>{en ? "Use questions for your own case" : "Начать с вопросов для своего кейса"}</span></button><button onClick={() => onNavigate("studio")}><b>{en ? "Open Case Studio" : "Открыть Студию"}</b><span>{en ? "Write a brief or import a file" : "Описать задачу или импортировать файл"}</span></button></div>
    <section className="learning-guides" id="guides"><h2>{en ? "Current step-by-step guides" : "Актуальные пошаговые инструкции"}</h2>{guides.map(([title,body],i) => <details key={title} open={i===0}><summary>{String(i+1).padStart(2,"0")} · {title}</summary><p>{body}</p></details>)}</section>
    <div className="training-downloads"><a href={`/help/casevant-quick-start.${locale}.md`} download>{en ? "Download current quick start (.md)" : "Скачать актуальную инструкцию (.md)"}</a><a href={personal} target="_blank" rel="noopener noreferrer">{en ? "Open My cases → Personal in a new tab" : "Открыть «Мои кейсы → Личные» в новой вкладке"}</a></div>
    <section className="learning-practice"><h2>{en ? "Practise with a fictional case" : "Попробуйте на учебном кейсе"}</h2><p>{en ? "Use the supplier-change brief: identify the decision, deadline, alternatives and evidence. Give the draft a title, confirm a workspace save, reopen it from Personal and inspect a PDF." : "Используйте задачу о смене поставщика: определите решение, срок, варианты и доказательства. Назовите черновик, подтвердите сохранение, откройте его из «Личных» и проверьте PDF."}</p><a href={en ? "/help/supplier-change-practice.md" : "/help/supplier-change-practice.ru.md"} download>{en ? "Download the practice brief (.md)" : "Скачать учебную задачу (.md)"}</a><p>{en ? "This ordinary text brief contains no embedded canonical graph. If you already have a complete canonical export, use the exact-file guide instead. Use fictional practice data." : "Это обычный текст без встроенного канонического графа. Если у вас есть полный канонический экспорт, используйте инструкцию точного восстановления. Для упражнения вводите вымышленные данные."}</p></section>
    <section className="learning-guides" id="troubleshooting"><h2>{en ? "Questions & troubleshooting" : "Вопросы и помощь"}</h2>{faq.map(([q,a]) => <details key={q}><summary>{q}</summary><p>{a}</p></details>)}</section>
    <CaseVantDomainGuide locale={locale}/>
    <TrainingVideo locale={locale}/>
    <div className="training-downloads"><a className="secondary-cta" href={personal} target="_blank" rel="noopener noreferrer">{en ? "My cases → Personal" : "Мои кейсы → Личные"}</a><a className="secondary-cta" href={`/account?lang=${locale}&return_to=${encodeURIComponent(personal)}`} target="_blank" rel="noopener noreferrer">{en ? "Account & sign-in" : "Аккаунт и вход"}</a></div>
  </main>;
}
