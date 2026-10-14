"use client";
import { lazy, Suspense, useState } from 'react';
import { EXAMPLE_REGISTRY, exampleDescriptor } from './example-registry';
import { caseTypePlaybook } from './case-type-playbooks';
import { caseTypePresentation } from './case-type-presentation';
import { caseTypeReference } from './case-type-reference';
import { CASE_TYPE_REGISTRY } from './case-type-registry';
import { matchingCategoryDemos } from './category-demos';
import DemoCatalogueCards from './DemoCatalogueCards';
import type { ExampleLaunch } from './ExampleLaunchStatus';
import type { FeedbackTarget } from './FeedbackDialog';
import type { CanopyScenarioId } from './canopy-fixture';
import type { CaseTypeId } from './types';
import type { PublishedCaseSummary, Locale } from './JurisApp';
const CategoryDemoCards = lazy(() => import('./CategoryDemoCards'));
function editorialReviewLabel(level: string | undefined, locale: Locale) {
  if (level === "practitioner_reviewed") return locale === "en" ? "Practitioner reviewed" : "Проверено практиком";
  if (level === "editorial_reviewed") return locale === "en" ? "Editorially reviewed" : "Редакционная проверка";
  if (level === "community_beta") return locale === "en" ? "Community preview" : "Предпросмотр сообщества";
  return locale === "en" ? "Editorial preview" : "Редакционный предпросмотр";
}
export default function LibraryView({locale, restorePlaySession, records, launchCase, requestFeedback, openCanopy, canopyWorkflowHref, openTemplates, openCategoryDemo, exampleLaunch, cancelExample}: {
 locale: Locale; restorePlaySession: () => void; records: PublishedCaseSummary[];
 launchCase: (record: PublishedCaseSummary) => void; requestFeedback: (target: FeedbackTarget) => void;
 openCanopy: (id: CanopyScenarioId) => Promise<void>; canopyWorkflowHref: string; openTemplates: () => void;
 openCategoryDemo: (id: CaseTypeId) => void; exampleLaunch: ExampleLaunch | null; cancelExample: () => void;
}) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [topic, setTopic] = useState("all");
  const [jurisdiction, setJurisdiction] = useState("all");
  const [guided, setGuided] = useState(false);
  const label = (id: CaseTypeId) => caseTypePresentation(caseTypePlaybook(caseTypeReference(id)), locale).label;
  const bundled = records;
  const topics = [...new Set(EXAMPLE_REGISTRY.filter(item => item.visible && item.family !== "category").flatMap(item => item.topics))].sort();
  const jurisdictions = [...new Set(EXAMPLE_REGISTRY.filter(item => item.visible).map(item => item.jurisdiction[locale]))].sort();
  const matches = (id: CaseTypeId, words: string, place: string, tags: readonly string[], walkthrough = false) =>
    (category === "all" || category === id) && (!query.trim() || words.toLowerCase().includes(query.trim().toLowerCase()))
    && (jurisdiction === "all" || jurisdiction === place) && (topic === "all" || tags.includes(topic)) && (!guided || walkthrough);
  const cards = bundled.filter(record => {
    const spec = EXAMPLE_REGISTRY.find(item => item.family === "converted" && item.cardId === record.id);
    return spec && matches(spec.category, [spec.title[locale], spec.description[locale], label(spec.category), spec.jurisdiction[locale], ...spec.topics].join(" "), spec.jurisdiction[locale], spec.topics);
  }).map(record => {
    const spec = exampleDescriptor(`converted:${record.id}`);
    const review = locale === 'en'
      ? `Converted template · review required. Legacy source v${record.currentVersion}: ${editorialReviewLabel(record.reviewLevel, locale)}`
      : `Преобразованный шаблон · требуется проверка. Исходный пакет v${record.currentVersion}: ${editorialReviewLabel(record.reviewLevel, locale)}`;
    return { id: record.id, title: spec.title[locale], summary: spec.description[locale], jurisdiction: spec.jurisdiction[locale], practice: label(spec.category), output: caseTypePlaybook(caseTypeReference(spec.category)).primaryOutcome[locale], duration: 0, version: spec.source.version, review, author: record.authorName };
  });
  const canopy = exampleDescriptor("canopy:base");
  const showCanopy = matches(canopy.category, [canopy.title[locale], "Verdant Atelier Advisory decision", label(canopy.category), ...canopy.topics].join(" "), canopy.jurisdiction[locale], canopy.topics, canopy.guidance !== null);
  const categoryDemos = matchingCategoryDemos({ query, practice: "all", jurisdiction, difficulty: "all", duration: "all", tag: topic, format: "all" }, locale).filter(demo => (category === "all" || category === exampleDescriptor(`category:${demo.caseTypeId}`).category) && !guided);
  const reset = () => { setQuery(""); setCategory("all"); setTopic("all"); setJurisdiction("all"); setGuided(false); };
  return <main className="library-view demo-catalogue">
    <header className="demo-catalogue-header page-width"><div><h1>{locale === "en" ? "Example cases" : "Примеры кейсов"}</h1><p>{locale === "en" ? "Explore worked cases across nine categories. Open a working copy to review sources, compare options and prepare an output. Guided walkthroughs are available on selected cases." : "Изучите кейсы девяти категорий. Откройте рабочую копию, проверьте источники, сравните варианты и подготовьте результат. Для отдельных кейсов доступен пошаговый обзор."}</p></div><button className="secondary-cta" onClick={openTemplates}>{locale === "en" ? "Create your own case" : "Создать свой кейс"}</button></header>
    <section className="catalogue-filters page-width">
      <label className="filter-search"><span>{locale === "en" ? "Search example cases" : "Поиск примеров"}</span><input value={query} onChange={e => setQuery(e.target.value)} placeholder={locale === "en" ? "Title, category, topic or jurisdiction" : "Название, категория, тема или юрисдикция"}/></label>
      <label><span>{locale === "en" ? "Case category" : "Категория кейса"}</span><select value={category} onChange={e => setCategory(e.target.value)}><option value="all">{locale === "en" ? "All categories" : "Все категории"}</option>{CASE_TYPE_REGISTRY.map(type => <option key={type.id} value={type.id}>{label(type.id)}</option>)}</select></label>
      <details className="catalogue-filter-more"><summary>{locale === "en" ? "More filters" : "Другие фильтры"}</summary><div>
        <label><span>{locale === "en" ? "Topic" : "Тема"}</span><select value={topic} onChange={e => setTopic(e.target.value)}><option value="all">{locale === "en" ? "All topics" : "Все темы"}</option>{topics.map(item => <option key={item}>{item}</option>)}</select></label>
        <label><span>{locale === "en" ? "Jurisdiction" : "Юрисдикция"}</span><select value={jurisdiction} onChange={e => setJurisdiction(e.target.value)}><option value="all">{locale === "en" ? "All jurisdictions" : "Все юрисдикции"}</option>{jurisdictions.map(item => <option key={item}>{item}</option>)}</select></label>
        <label><input type="checkbox" checked={guided} onChange={e => setGuided(e.target.checked)}/><span>{locale === "en" ? "Guided walkthrough available" : "Есть пошаговый обзор"}</span></label>
      </div></details>
      <div className="filter-result"><b role="status" aria-live="polite">{cards.length + Number(showCanopy) + categoryDemos.length} {locale === "en" ? "shown" : "показано"}</b><button onClick={reset}>{locale === "en" ? "Reset" : "Сбросить"}</button></div>
    </section>
    <section className="page-width demo-catalogue-results" aria-label={locale === "en" ? "Example cases" : "Примеры кейсов"}>
      <div className="demo-catalogue-grid">
      <DemoCatalogueCards locale={locale} cards={cards} showCanopy={showCanopy} exampleLaunch={exampleLaunch} cancelExample={cancelExample} busy={false} openCanopy={openCanopy} canopyWorkflowHref={canopyWorkflowHref} launch={id => { const record = bundled.find(item => item.id === id); if (record) launchCase(record); }} feedback={id => { const record = bundled.find(item => item.id === id); if (record) requestFeedback({ caseId: record.id, version: record.currentVersion, title: record.title, source: "playable", fingerprint: record.fingerprint }); }}/>
      {categoryDemos.length > 0 && <Suspense fallback={<p role="status">Loading examples…</p>}><CategoryDemoCards demos={categoryDemos} locale={locale} onOpen={openCategoryDemo} exampleLaunch={exampleLaunch} cancelExample={cancelExample}/></Suspense>}
      </div>
      {!showCanopy && !cards.length && !categoryDemos.length && <p>{locale === "en" ? "No example cases match these filters." : "По этим фильтрам примеров нет."}</p>}
      {(category === "all" || category === "training_simulation") && !guided && <details className="library-restore"><summary>{locale === "en" ? "Training simulation · saved-play recovery" : "Учебная симуляция · восстановление прохождения"}</summary><p>{locale === "en" ? "Recover existing simulation sessions in their original training workflow. Converted examples open independently in Studio." : "Восстановите старые прохождения в исходном учебном процессе. Примеры открываются отдельными копиями в Studio."}</p><button className="secondary-cta" onClick={restorePlaySession}>{locale === "en" ? "Restore a play session" : "Восстановить прохождение"}</button></details>}
    </section>
  </main>;
}
