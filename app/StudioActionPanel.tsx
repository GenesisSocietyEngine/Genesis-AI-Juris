"use client";

import ActionTile from "./ActionTile";
import { caseTypePlaybook } from "./case-type-playbooks";
import type { StudioDraft, StudioNodeType } from "./types";
import type { StudioCheck } from "./studio-validation";
import type { StudioWorkflowStep } from "./studio-workflow";

export type StudioActionTarget = { step: StudioWorkflowStep; id: string; nodeType?: StudioNodeType; nodeId?: string; developer?: boolean };

export default function StudioActionPanel({ draft, checks, locale, checking, canEdit, onOpen, onReport, onSave, saved, saving, withinEnvelope }: {
  draft: StudioDraft; checks: StudioCheck[]; locale: "en" | "ru"; checking: boolean; canEdit: boolean;
  onOpen: (target: StudioActionTarget) => void; onReport: () => void; onSave: () => void; saved: boolean; saving: boolean; withinEnvelope: boolean;
}) {
  const en = locale === "en";
  const warnings = checks.filter(check => check.level === "warn");
  const playbook = caseTypePlaybook(draft.caseType);
  function action(check: StudioCheck): { title: string; target: StudioActionTarget } {
    if (!draft.nodes.length) return { title: en ? "Build the initial case draft" : "Создайте начальный черновик", target: { step: 1, id: "studio-case-brief" } };
    const group = playbook.requiredNodeGroups.find(group => `nodes:${group.id}` === check.id);
    if (group) return { title: group.types.includes("evidence") ? (en ? "Add missing evidence" : "Добавьте недостающие доказательства") : `${en ? "Add" : "Добавьте"} ${group.label[locale].toLowerCase()}`, target: { step: 3, id: "studio-evidence-composer", nodeType: group.types.includes("evidence") ? "evidence" : group.types[0] } };
    if (check.id === "brief") return { title: en ? "Complete the case title and context" : "Заполните название и контекст", target: { step: 3, id: draft.title.trim() ? "studio-publishable-context" : "studio-title" } };
    if (check.id === "context") return { title: en ? "Review case context" : "Проверьте контекст кейса", target: { step: 3, id: "studio-publishable-context" } };
    if (check.id === "identity" || check.id === "version") return { title: en ? "Correct case identity" : "Исправьте идентификатор кейса", target: { step: 3, id: check.id === "version" ? "studio-case-version" : "studio-case-identity", developer: true } };
    if (check.id === "participants") return { title: en ? "Complete case details" : "Заполните данные кейса", target: { step: 3, id: draft.jurisdiction.trim() ? "studio-role" : "studio-jurisdiction" } };
    if (check.id === "legal-as-of") return { title: en ? "Confirm the legal review date" : "Укажите дату проверки права", target: { step: 3, id: "studio-legal-date" } };
    if (check.id === "https-sources") return { title: en ? "Attach authoritative sources" : "Добавьте авторитетные источники", target: { step: 3, id: "studio-source-urls" } };
    if (check.id === "compliance-gate") return { title: en ? "Review compliance controls" : "Проверьте контроль законности", target: { step: 3, id: "studio-compliance" } };
    const connected = new Set(draft.links.flatMap(link => [link.from, link.to]));
    return { title: en ? "Connect the decision route" : "Свяжите маршрут решения", target: { step: 4, id: "studio-connect-node", nodeId: draft.nodes.find(node => !connected.has(node.id))?.id ?? draft.nodes.find(node => node.type === "trigger")?.id ?? draft.nodes[0]?.id } };
  }
  return <section id="studio-next-actions" className="action-center page-width" aria-labelledby="studio-next-actions-title" tabIndex={-1}>
    <header><div><h2 id="studio-next-actions-title">{en ? "Your next actions" : "Следующие действия"}</h2><p>{en ? "Open an action, make the change, then return here to check progress." : "Откройте действие, внесите изменения и вернитесь сюда проверить результат."}</p></div><span role="status">{checking ? (en ? "Checking changes…" : "Проверка изменений…") : `${warnings.length} ${en ? "to complete" : "для завершения"}`}</span></header>
    {!canEdit && <p className="action-prerequisite">{en ? "Inspection only. Ask the case owner for an editable working copy; the source remains protected." : "Только просмотр. Запросите у владельца редактируемую рабочую копию."}</p>}
    <div className="action-tile-grid">
      {!checking && warnings.filter(check => check.id).map(check => { const item = action(check); return <ActionTile key={check.id} id={`action-${check.id}`} title={item.title} detail={check.text} status={en ? "Needs attention" : "Нужно действие"} next={item.target.developer ? (en ? "Developer controls" : "Настройки разработчика") : (en ? "Open control" : "Открыть поле")} onClick={() => onOpen(item.target)}/>; })}
      {!checking && warnings.filter(check => !check.id).map((check, index) => <p key={index} role="alert">{check.text} {en ? "Return to the previous step and retry validation." : "Вернитесь на предыдущий шаг и повторите проверку."}</p>)}
      {!checking && warnings.length === 0 && <p className="action-complete" role="status">{en ? "Completeness checks passed. Evidence quality and independent approval still require review." : "Проверки полноты пройдены. Надёжность доказательств и независимое утверждение проверяются отдельно."}</p>}
      <ActionTile title={en ? "Generate report" : "Создайте отчёт"} detail={en ? "Preview the active case as a preliminary A4 decision package." : "Просмотрите предварительный пакет решений по текущему кейсу в A4."} status={en ? "Preliminary draft" : "Предварительный черновик"} next={en ? "Open report" : "Открыть отчёт"} disabled={!canEdit || !draft.nodes.length} onClick={onReport}/>
      <ActionTile title={en ? "Save working case" : "Сохраните рабочий кейс"} detail={!withinEnvelope ? (en ? "Shorten node or relation details to fit the 900 KB limit before saving." : "Сократите описания узлов или связей до лимита 900 КБ.") : en ? "Keep this exact working version in your workspace. Sign in if requested." : "Сохраните текущую версию в рабочем пространстве. При необходимости войдите."} status={saving ? (en ? "Saving…" : "Сохранение…") : saved ? (en ? "Saved" : "Сохранено") : (en ? "Not saved to workspace" : "Не сохранено")} next={en ? "Save" : "Сохранить"} disabled={!canEdit || checking || saving || !withinEnvelope} onClick={onSave}/>
    </div>
  </section>;
}

export function StudioEvidenceComposer({ draft, type, locale, canEdit, onSave }: {
  draft: StudioDraft; type: StudioNodeType; locale: "en" | "ru"; canEdit: boolean;
  onSave: (value: { type: StudioNodeType; title: string; detail: string; relatedId: string }) => void;
}) {
  const en = locale === "en";
  return <section id="studio-evidence-composer" className="action-editor page-width" tabIndex={-1}>
    <h2>{en ? "Add a connected case item" : "Добавьте связанный элемент кейса"}</h2>
    <p>{en ? "Record the source or reasoning and choose the step it supports. This adds to your working draft; it does not certify the evidence." : "Укажите источник или обоснование и выберите связанный шаг. Запись добавляется в черновик, но не подтверждает достоверность доказательств."}</p>
    {!canEdit ? <p>{en ? "An editable working copy is required." : "Требуется редактируемая рабочая копия."}</p> : <form key={type} onSubmit={event => { event.preventDefault(); const form = event.currentTarget; const fields = new FormData(form); onSave({ type, title: String(fields.get("title")).trim(), detail: String(fields.get("detail")).trim(), relatedId: String(fields.get("relatedId")) }); }}>
      <label><span>{en ? "Item title" : "Название элемента"}</span><input name="title" required maxLength={160}/></label>
      <label><span>{en ? "Source and explanation" : "Источник и пояснение"}</span><textarea name="detail" required maxLength={8000}/></label>
      <label><span>{en ? "Connect to this step" : "Связать с шагом"}</span><select name="relatedId" required defaultValue=""><option value="">{en ? "Choose the related step" : "Выберите связанный шаг"}</option>{draft.nodes.map(node => <option key={node.id} value={node.id}>{node.title}</option>)}</select></label>
      <button className="primary-cta" disabled={draft.nodes.length >= 200 || draft.links.length >= 500 || !draft.nodes.length}>{en ? "Add item and return to actions" : "Добавить и вернуться к действиям"}</button>
      {(draft.nodes.length >= 200 || draft.links.length >= 500) && <p>{en ? "The case item or connection limit is reached. Combine or remove an item on the decision map first." : "Достигнут лимит элементов или связей. Сначала объедините или удалите элемент на карте."}</p>}
    </form>}
  </section>;
}
