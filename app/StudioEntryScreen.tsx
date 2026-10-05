"use client";

import { WorkspaceIcon } from "./GenesisNavigation";

export default function StudioEntryScreen({ locale, recentTitle, savedCasesHref = "/matters", onCreate, onImport, onDemo, onBrowseDemos, onContinue }: {
  locale: "en" | "ru";
  recentTitle: string;
  savedCasesHref?: string;
  onCreate: () => void;
  onImport: () => void;
  onDemo: () => void;
  onBrowseDemos?: () => void;
  onContinue: () => void;
}) {
  const en = locale === "en";
  return <main className="studio-entry page-width">
    <header className="workspace-page-header casevant-entry-header">
      <span className="workspace-eyebrow">{en ? "Case Studio" : "Студия кейсов"}</span>
      <h1 lang="en">Make your case.</h1>
      <p lang="en">Evidence, options and outcomes. Connected.</p>
    </header>
    <section className="studio-entry-start" aria-labelledby="entry-start-title">
      <div className="studio-entry-intro">
        <span className="workspace-icon-tile"><WorkspaceIcon name="studio"/></span>
        <h2 id="entry-start-title">{en ? "Start with a case" : "Начните с кейса"}</h2>
        <p>{en ? "Documents, evidence and reasoning stay connected in one decision package." : "Документы, доказательства и обоснования связаны в едином пакете решений."}</p>
        <div className="entry-create-actions">
          <button type="button" className="primary-cta" onClick={onCreate}><WorkspaceIcon name="plus"/>{en ? "Create a case" : "Создать кейс"}</button>
          <button type="button" className="entry-import" onClick={onImport}><WorkspaceIcon name="upload"/><span>{en ? "Import case or prompt" : "Импортировать кейс или промпт"}<small>JSON · Markdown · TXT</small></span></button>
        </div>
        <p className="entry-saving-note">{en ? "You can start without signing in. Sign in when you save to keep the case in your account and return later." : "Начать можно без входа. При сохранении войдите в аккаунт, чтобы вернуться к кейсу позже."}</p>
      </div>
      <div className="studio-entry-demo">
        <span className="workspace-eyebrow">{en ? "Explore an example" : "Изучите пример"}</span>
        <h2>{en ? "New here? Explore a complete example" : "Впервые здесь? Изучите готовый пример"}</h2>
        <p>{en ? "Start with Project Canopy: read the provisional decision, inspect its sources and explore what still needs review." : "Начните с Project Canopy: изучите предварительный вывод, источники и вопросы, требующие проверки."}</p>
        <button type="button" className="secondary-cta" onClick={onDemo}>{en ? "Open Canopy overview" : "Открыть обзор Canopy"}</button>
        <small>{en ? "Find the proposed decision, open a supporting source and spot what still needs checking. No sign-in needed." : "Найдите предварительное решение, откройте подтверждающий источник и определите, что ещё нужно проверить. Вход не требуется."}</small>
        {onBrowseDemos && <button type="button" className="secondary-cta" onClick={onBrowseDemos}>{en ? "All demos & training simulations" : "Все демо и учебные симуляции"}</button>}
      </div>
    </section>
    <section className="studio-entry-recent" aria-labelledby="entry-recent-title">
      <div className="workspace-section-heading"><h2 id="entry-recent-title">{en ? "Continue recent work" : "Продолжите работу"}</h2><a href={savedCasesHref}>{en ? "My cases — Personal / Team" : "Мои кейсы — Личные / Команда"}</a></div>
      {recentTitle ? <button type="button" className="entry-recent-case" onClick={onContinue}><WorkspaceIcon name="studio"/><span><b>{recentTitle}</b><small>{en ? "Current working draft" : "Текущий рабочий черновик"}</small></span></button>
        : <div className="entry-recent-empty"><WorkspaceIcon name="cases"/><p>{en ? "Create or import a case to begin. Find saved Studio drafts in My cases → Personal. Use Team for your organization’s shared cases; an organization is not needed for a personal draft." : "Создайте или импортируйте кейс. Сохранённые черновики Studio находятся в «Мои кейсы → Личные». Общие дела организации — в разделе «Команда»; для личного черновика организация не нужна."}</p></div>}
    </section>
    <div className="studio-entry-method"><span>{en ? "A clear path to your decision package" : "Понятный путь к пакету решений"}</span><ol>{(en ? ["Brief", "Review", "Evidence", "Decision map", "Test", "Report"] : ["Задача", "Проверка", "Материалы", "Карта", "Тест", "Отчёт"]).map((step,i)=><li key={step}><b>{i+1}</b>{step}</li>)}</ol></div>
  </main>;
}
