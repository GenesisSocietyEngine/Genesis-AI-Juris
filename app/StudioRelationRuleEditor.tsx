import { metricLabels } from "./JurisViewShared";
import { studioInspectorPresentation } from "./studio-inspector-presentation";
import type { MetricKey, StudioDraft, StudioLink } from "./types";

export default function RelationRuleEditor({ locale, caseType, link, developerMode, disabled, beginFieldEdit, setRule, applyRule, commitField }: {
  locale: "en" | "ru";
  caseType: StudioDraft["caseType"];
  link: StudioLink;
  developerMode: boolean;
  disabled: boolean;
  beginFieldEdit: (value: string) => void;
  setRule: (change: NonNullable<StudioLink["rule"]>) => void;
  applyRule: (change: NonNullable<StudioLink["rule"]>, label: string) => void;
  commitField: (label: string, value: string) => void;
}) {
  const copy = studioInspectorPresentation(caseType, locale);
  const rule = link.rule ?? {};
  const guard = rule.guards?.[0];
  const numberValue = (value: string) => value === "" ? undefined : Number(value);
  return <section className="relation-rule-editor" data-workflow={copy.workflow} aria-label={developerMode ? (locale === "en" ? `Runtime rules for ${link.id}` : `Runtime-правила для ${link.id}`) : copy.optionSection}>
    <header><div><span>{developerMode ? `RULES DSL · ${link.id}` : copy.optionBadge}</span><h3>{developerMode ? (locale === "en" ? "Author the action, not just the arrow" : "Настройте действие, а не только стрелку") : copy.optionQuestion}</h3></div>{developerMode && <code>{link.from} → {link.to}</code>}</header>
    <fieldset className="relation-rule-grid" disabled={disabled}>
      <label className="wide-field"><span>{copy.optionLabel}</span><input value={rule.label ?? ""} placeholder={locale === "en" ? "Defaults to destination title" : "По умолчанию — название целевого узла"} onFocus={(event) => beginFieldEdit(event.currentTarget.value)} onChange={(event) => setRule({ label: event.target.value })} onBlur={(event) => commitField(locale === "en" ? "action label" : "название действия", event.currentTarget.value)}/></label>
      <label><span>{copy.optionCost}</span><input type="number" min="0" max="1000000000" value={rule.cost ?? ""} placeholder={copy.costPlaceholder} onFocus={(event)=>beginFieldEdit(event.currentTarget.value)} onChange={(event) => setRule({ cost: numberValue(event.target.value) })} onBlur={(event)=>commitField(locale === "en" ? "cost" : "стоимость",event.currentTarget.value)}/></label>
      <label><span>{copy.optionDuration}</span><input type="number" min="0" max="100000000" value={rule.minutes ?? ""} placeholder={copy.durationPlaceholder} onFocus={(event)=>beginFieldEdit(event.currentTarget.value)} onChange={(event) => setRule({ minutes: numberValue(event.target.value) })} onBlur={(event)=>commitField(locale === "en" ? "duration" : "длительность",event.currentTarget.value)}/></label>
      {developerMode && <>
        {(Object.keys(metricLabels.en) as MetricKey[]).map((metric) => <label key={metric}><span>{metricLabels[locale][metric]} · Δ</span><input type="number" min="-100" max="100" value={rule.effects?.[metric] ?? ""} placeholder="auto" onFocus={(event)=>beginFieldEdit(event.currentTarget.value)} onChange={(event) => setRule({ effects: { ...(rule.effects ?? {}), [metric]: numberValue(event.target.value) } })} onBlur={(event)=>commitField(`${metric} effect`,event.currentTarget.value)}/></label>)}
        <label><span>{locale === "en" ? "Repeatability" : "Повторяемость"}</span><select value={rule.repeatability ?? "once"} onChange={(event) => { const repeatability = event.target.value as NonNullable<StudioLink["rule"]>["repeatability"]; applyRule({ repeatability, maxUses: repeatability === "limited" ? rule.maxUses ?? 2 : undefined }, locale === "en" ? "repeatability" : "повторяемость"); }}><option value="once">{locale === "en" ? "Once" : "Один раз"}</option><option value="repeatable">{locale === "en" ? "Repeatable" : "Повторяемо"}</option><option value="limited">{locale === "en" ? "Limited" : "Ограниченно"}</option></select></label>
        {rule.repeatability === "limited" && <label><span>{locale === "en" ? "Maximum uses" : "Максимум использований"}</span><input type="number" min="1" max="10000" value={rule.maxUses ?? 2} onFocus={(event)=>beginFieldEdit(event.currentTarget.value)} onChange={(event) => setRule({ maxUses: Math.max(1, Number(event.target.value) || 1) })} onBlur={(event)=>commitField(locale === "en" ? "maximum uses" : "лимит использований",event.currentTarget.value)}/></label>}
        <label><span>{locale === "en" ? "Guard metric" : "Метрика условия"}</span><select value={guard?.metric ?? "none"} onChange={(event) => applyRule({ guards: event.target.value === "none" ? undefined : [{ metric: event.target.value as MetricKey, comparison: guard?.comparison ?? "gte", value: guard?.value ?? 50 }] }, locale === "en" ? "availability guard" : "условие доступности")}><option value="none">{locale === "en" ? "Always available" : "Всегда доступно"}</option>{(Object.keys(metricLabels.en) as MetricKey[]).map((metric) => <option key={metric} value={metric}>{metricLabels[locale][metric]}</option>)}</select></label>
        {guard && <><label><span>{locale === "en" ? "Comparison" : "Сравнение"}</span><select value={guard.comparison} onChange={(event) => applyRule({ guards: [{ ...guard, comparison: event.target.value as "gte" | "lte" | "eq" }] }, locale === "en" ? "guard comparison" : "сравнение условия")}><option value="gte">≥</option><option value="lte">≤</option><option value="eq">=</option></select></label><label><span>{locale === "en" ? "Threshold" : "Порог"}</span><input type="number" min="0" max="100" value={guard.value} onFocus={(event)=>beginFieldEdit(event.currentTarget.value)} onChange={(event) => setRule({ guards: [{ ...guard, value: Math.max(0, Math.min(100, Number(event.target.value) || 0)) }] })} onBlur={(event)=>commitField(locale === "en" ? "guard threshold" : "порог условия",event.currentTarget.value)}/></label></>}
      </>}
      <label className="wide-field"><span>{copy.consequence}</span><textarea value={rule.result ?? ""} placeholder={locale === "en" ? "Defaults to destination detail" : "По умолчанию — описание целевого узла"} onFocus={(event) => beginFieldEdit(event.currentTarget.value)} onChange={(event) => setRule({ result: event.target.value })} onBlur={(event) => commitField(locale === "en" ? "consequence text" : "текст последствия", event.currentTarget.value)}/></label>
    </fieldset>
    <p>{developerMode ? (locale === "en" ? "Typed rules are validated and interpreted deterministically; no uploaded JavaScript or eval is executed." : "Типизированные правила валидируются и исполняются детерминированно; загружаемый JavaScript и eval не используются.") : copy.optionHelp}</p>
  </section>;
}

