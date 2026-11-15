import type { FirmCase } from "./work-controller";
import { distinctLabels } from "./work-presentation";

type Props = {
  locale: "en" | "ru";
  scope: string;
  lifecycle: string;
  cases: FirmCase[];
  leads: {id:string; name:string}[];
  onScope: (value:string) => void;
  onLifecycle: (value:string) => void;
};

export function matchesTaskScope(item: {caseId:string; leadId?:string; caseStatus?:string; leadActive?:boolean}, scope:string, lifecycle:string) {
  if (lifecycle !== "all") {
    if (!(item.caseId && item.caseStatus) && !item.leadId) return false;
    const closed = item.leadId ? !item.leadActive : ["closed", "archived", "declined", "cancelled"].includes(item.caseStatus!);
    if (closed !== (lifecycle === "closed")) return false;
  }
  if (!scope) return true;
  if (scope === "firm") return !item.caseId && !item.leadId;
  return (item.caseId || item.leadId) === scope;
}

export default function TaskScopeFilter({locale,scope,lifecycle,cases,leads,onScope,onLifecycle}:Props) {
  const t = (en:string,ru:string) => locale === "ru" ? ru : en;
  const caseNames = distinctLabels(cases.map(c => ({id:c.id,name:c.title})));
  const leadNames = distinctLabels(leads);
  return <>
    <label>{t("Case or lead","Дело или лид")}<select value={scope} onChange={e=>onScope(e.target.value)}>
      <option value="">{t("All tasks","Все задачи")}</option>
      <option value="firm">{t("Firm only","Только работа фирмы")}</option>
      <optgroup label={t("Cases","Дела")}>{cases.map(c=><option key={c.id} value={c.id}>{caseNames.get(c.id)}</option>)}</optgroup>
      <optgroup label={t("Leads","Лиды")}>{leads.map(l=><option key={l.id} value={l.id}>{leadNames.get(l.id)}</option>)}</optgroup>
    </select></label>
    <label>{t("Case or lead status","Статус дела или лида")}<select value={lifecycle} onChange={e=>onLifecycle(e.target.value)}>
      <option value="all">{t("All work","Вся работа")}</option>
      <option value="open">{t("Open cases and leads","Открытые дела и лиды")}</option>
      <option value="closed">{t("Closed cases and leads","Закрытые дела и лиды")}</option>
    </select></label>
  </>;
}
