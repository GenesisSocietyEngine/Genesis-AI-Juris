"use client";

import TrainingVideo from "./TrainingVideo";
import type { AppView } from "./studio-entry";

export default function HelpCenter({ locale, onNavigate }: { locale: "en" | "ru"; onNavigate: (view: AppView) => void }) {
  const en = locale === "en";
  const guides = en ? [
    ["Import a canonical file", "Choose Import case or prompt. For a canonical Markdown file, choose Verify canonical case, inspect the preview, then Apply exact case. Keep the entire file, including its embedded data."],
    ["Review the case", "Follow Brief → Draft review → Facts & evidence → Decision map → Test → Finish. Separate verified facts, estimates, missing evidence and alternatives. Use the actionable checks to return to the relevant field."],
    ["Create an analytical report", "Choose Create analytical report, then Preview PDF or Download PDF. Open the downloaded file and inspect it. A preliminary export is not an independently approved report."],
    ["Start a new case", "Use Case Studio → Create a case for a blank draft, or choose Templates for a case type and intake questions. Preserve current work before accepting a replacement prompt. Add your own facts and evidence."],
    ["Save and reopen", "Save to workspace requires sign-in. Reopen through Saved Studio drafts and verify your changes. Organization cases in My cases are separate records. For a portable handoff, export a case file before leaving."],
  ] : [
    ["Импорт канонического файла", "Выберите «Импортировать кейс или промпт». Для канонического Markdown нажмите «Проверить канонический кейс», изучите результат и примените точный кейс. Сохраните файл целиком, включая встроенные данные."],
    ["Проверка кейса", "Пройдите этапы: задача, проверка черновика, факты и материалы, карта, тест и завершение. Разделяйте подтверждённые факты, оценки и неизвестные данные. Замечания ведут к соответствующему полю."],
    ["Аналитический отчёт", "Выберите «Создать аналитический отчёт», затем просмотр или скачивание PDF. Откройте скачанный файл и проверьте его. Предварительный экспорт не означает независимое утверждение."],
    ["Новый кейс", "Откройте Студию и выберите «Создать кейс» либо используйте Шаблоны. Сохраните текущую работу до замены. Добавьте свои факты и доказательства."],
    ["Сохранение и повторное открытие", "Для сохранения в рабочем пространстве нужен вход. Откройте сохранённый черновик и проверьте изменения. Дела организации в «Мои дела» — отдельные записи. Перед выходом можно экспортировать файл."],
  ];
  const faq = en ? [
    ["Are Demo and Templates duplicates?", "Demo contains worked fictional examples and links to the Practice cases catalogue. Templates create a fresh Studio draft with the selected case type and intake questions. They do not copy a demo's facts, documents or conclusions."],
    ["Does importing a file save it to My cases?", "No. Import opens an editable Studio draft. Save to workspace stores an account-owned Studio draft. My cases contains organization records with their own documents and reviews."],
    ["Why does canonical verification fail?", "Use the complete exported Markdown file, not copied visible text. If the embedded data or fingerprint is missing or mismatched, obtain an intact export. Do not treat ordinary text as an exact restoration."],
    ["What if sign-in is unavailable?", "Keep a permitted export of your work before leaving. Use Account on the published site to sign in. If the sign-in page fails, report the page address and time; do not enter credentials into an error page."],
    ["What if the PDF does not appear?", "Check the browser's downloads and popup settings, then try Preview PDF. A download-started message is not confirmation that a file arrived. Keep the case open and report the displayed error if it persists."],
    ["What if saving times out?", "Do not assume the save failed or repeat it immediately. Reopen the saved draft separately and check its content. Keep an export where permitted. If the result remains uncertain, report the case and operation without exposing private evidence."],
    ["Does a verified file mean the case is approved?", "No. Verification checks the file's structure and identity. Evidence acceptance, current legal sources and independent review remain separate. The Five Flats training file includes a future-dated review field; that field is not proof of legal currency."],
  ] : [
    ["Демо и Шаблоны — одно и то же?", "Демо — готовые учебные примеры и каталог сценариев. Шаблоны создают новый черновик с типом кейса и вопросами, без фактов и выводов демо."],
    ["Импорт сохраняет файл в «Мои дела»?", "Нет. Импорт открывает черновик Studio. Сохранение в workspace относится к аккаунту. «Мои дела» содержит отдельные дела организации."],
    ["Не проходит проверка файла", "Используйте полный экспорт Markdown со встроенными данными. Если данные или контрольная сумма отсутствуют, получите неповреждённый экспорт."],
    ["Не работает вход", "Сначала сохраните разрешённый экспорт. Откройте Аккаунт на опубликованном сайте. Сообщите адрес и время ошибки; не вводите пароль на странице ошибки."],
    ["PDF не появился", "Проверьте загрузки и настройки всплывающих окон, затем попробуйте просмотр PDF. Сообщение о начале загрузки не подтверждает получение файла."],
    ["Сохранение зависло", "Не повторяйте запись сразу. Отдельно откройте сохранённый черновик и проверьте его. Сохраните разрешённый экспорт и сообщите об ошибке."],
    ["Проверенный файл означает утверждённый кейс?", "Нет. Проверяется структура и идентичность файла. Доказательства, актуальность права и независимое утверждение проверяются отдельно."],
  ];
  return <main className="learning-page page-width">
    <header className="learning-heading"><span>{en ? "HELP & TRAINING" : "ПОМОЩЬ И ОБУЧЕНИЕ"}</span><h1>{en ? "Build your first decision package" : "Подготовьте первый пакет решений"}</h1><p>{en ? "Learn with a worked example, start your own case, and keep the result you can explain." : "Изучите пример, создайте свой кейс и сохраните результат с понятным обоснованием."}</p></header>
    <div className="learning-start"><button onClick={() => onNavigate("demos")}><b>{en ? "1. Explore a demo" : "1. Изучить демо"}</b><span>{en ? "Follow a completed fictional example" : "Пройти готовый учебный пример"}</span></button><button onClick={() => onNavigate("templates")}><b>{en ? "2. Choose a template" : "2. Выбрать шаблон"}</b><span>{en ? "Start with questions for your own case" : "Начать с вопросов для своего кейса"}</span></button><button onClick={() => onNavigate("studio")}><b>{en ? "3. Open Case Studio" : "3. Открыть Студию"}</b><span>{en ? "Import a file or create a blank draft" : "Импортировать файл или создать черновик"}</span></button></div>
    <TrainingVideo locale={locale}/>
    <section className="learning-guides" id="guides"><h2>{en ? "Step-by-step guides" : "Пошаговые инструкции"}</h2>{guides.map(([title,body],i) => <details key={title} open={i===0}><summary>{String(i+1).padStart(2,"0")} · {title}</summary><p>{body}</p></details>)}</section>
    <section className="learning-practice"><h2>{en ? "Try it yourself" : "Попробуйте сами"}</h2><p>{en ? "Use your complete Five Flats, Three Borders canonical file. Then create a fictional supplier-change case: identify the decision, deadline, two alternatives and the evidence needed to proceed." : "Используйте полный канонический файл Five Flats, Three Borders. Затем создайте учебный кейс смены поставщика: решение, срок, два варианта и необходимые доказательства."}</p><a href="/help/supplier-change-practice.md" download>{en ? "Download the practice brief (.md)" : "Скачать учебную задачу (.md)"}</a><p>{en ? "The practice brief is ordinary text; it has no embedded canonical graph. Use it to practise authoring." : "Учебная задача — обычный текст без канонического графа. Используйте её для создания кейса."}</p></section>
    <section className="learning-guides" id="troubleshooting"><h2>{en ? "Questions & troubleshooting" : "Вопросы и помощь"}</h2>{faq.map(([q,a]) => <details key={q}><summary>{q}</summary><p>{a}</p></details>)}</section>
    <div className="training-downloads"><button type="button" className="secondary-cta" onClick={() => onNavigate("community")}>{en ? "Open saved Studio drafts" : "Сохранённые черновики Studio"}</button><a className="secondary-cta" href="/account">{en ? "Account & sign-in" : "Аккаунт и вход"}</a></div>
  </main>;
}
