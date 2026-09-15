"use client";

import { WorkspaceIcon } from "./GenesisNavigation";

export default function StudioEntryScreen({ locale, recentTitle, savedCasesHref = "/matters", onCreate, onImport, onDemo, onContinue }: {
  locale: "en" | "ru";
  recentTitle: string;
  savedCasesHref?: string;
  onCreate: () => void;
  onImport: () => void;
  onDemo: () => void;
  onContinue: () => void;
}) {
  const en = locale === "en";
  return <main className="studio-entry page-width">
    <header className="workspace-page-header">
      <span className="workspace-eyebrow">{en ? "Your decision workspace" : "Ваше пространство решений"}</span>
      <h1>{en ? "Case Studio" : "Студия кейсов"}</h1>
      <p>{en ? "Bring the facts together. Build a decision you can explain." : "Соберите факты. Подготовьте решение, которое можно объяснить."}</p>
    </header>
    <section className="studio-entry-start" aria-labelledby="entry-start-title">
      <div className="studio-entry-intro">
        <span className="workspace-icon-tile"><WorkspaceIcon name="studio"/></span>
        <h2 id="entry-start-title">{en ? "Start with a case" : "Начните с кейса"}</h2>
        <p>{en ? "Documents, evidence and reasoning stay connected in one decision package." : "Документы, доказательства и обоснования связаны в едином пакете решений."}</p>
        <div className="entry-create-actions">
          <button type="button" className="secondary-cta" onClick={onCreate}><WorkspaceIcon name="plus"/>{en ? "Create a case" : "Создать кейс"}</button>
          <button type="button" className="entry-import" onClick={onImport}><WorkspaceIcon name="upload"/><span>{en ? "Import case or prompt" : "Импортировать кейс или промпт"}<small>JSON · Markdown · TXT</small></span></button>
        </div>
      </div>
      <div className="studio-entry-demo">
        <span className="workspace-eyebrow">{en ? "Explore an example" : "Изучите пример"}</span>
        <h2>{en ? "See a decision take shape" : "Посмотрите, как формируется решение"}</h2>
        <p>{en ? "Open Canopy or a playable case. Follow the evidence, compare options and preview the report." : "Откройте Canopy или игровой кейс. Изучите доказательства, сравните варианты и просмотрите отчёт."}</p>
        <button type="button" className="primary-cta" onClick={onDemo}>{en ? "Open demo case" : "Открыть демо-кейс"}<WorkspaceIcon name="arrow"/></button>
        <small>{en ? "Prepared examples · No sign-in needed to explore" : "Готовые примеры · Можно изучать без входа"}</small>
      </div>
    </section>
    <section className="studio-entry-recent" aria-labelledby="entry-recent-title">
      <div className="workspace-section-heading"><h2 id="entry-recent-title">{en ? "Continue recent work" : "Продолжите работу"}</h2><a href={savedCasesHref}>{en ? "Organization cases" : "Дела организации"}<span aria-hidden="true"> →</span></a></div>
      <p className="entry-saved-links"><a href="/studio?view=community">{en ? "Open saved Studio drafts →" : "Открыть сохранённые черновики Studio →"}</a></p>
      {recentTitle ? <button type="button" className="entry-recent-case" onClick={onContinue}><WorkspaceIcon name="studio"/><span><b>{recentTitle}</b><small>{en ? "Current working draft" : "Текущий рабочий черновик"}</small></span><WorkspaceIcon name="arrow"/></button>
        : <div className="entry-recent-empty"><WorkspaceIcon name="cases"/><p>{en ? "Your current draft will appear here. Saved Studio drafts belong to your account; organization cases have their own shared evidence and reviews." : "Здесь появится текущий черновик. Черновики Studio принадлежат вашему аккаунту; дела организации содержат общие доказательства и рецензии."}</p></div>}
    </section>
    <div className="studio-entry-method"><span>{en ? "A clear path to your decision package" : "Понятный путь к пакету решений"}</span><ol>{(en ? ["Brief", "Review", "Evidence", "Decision map", "Test", "Report"] : ["Задача", "Проверка", "Материалы", "Карта", "Тест", "Отчёт"]).map((step,i)=><li key={step}><b>{i+1}</b>{step}</li>)}</ol></div>
  </main>;
}
