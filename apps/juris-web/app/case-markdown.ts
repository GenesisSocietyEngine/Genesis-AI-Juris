import { caseFingerprint, isRecord, normalizeStudioDraft } from "./case-integrity";
import type { StudioDraft, StudioLink, StudioNode, StudioNodeType } from "./types";

export const CANONICAL_CASE_MARKER = "GENESIS-JURIS-CANONICAL-V1";
export type CaseMarkdownStatus = "amended" | "final";
export type CaseMarkdownLanguage = "en" | "ru";
export type ParsedCaseMarkdown = { draft: StudioDraft; fingerprint: string; status: CaseMarkdownStatus; language: CaseMarkdownLanguage };

const labels: Record<CaseMarkdownLanguage, Record<StudioNodeType, string>> = {
  en: { trigger:"Trigger", actor:"Actors and stakeholders", fact:"Material facts", evidence:"Evidence and sources", deadline:"Deadlines", decision:"Decisions", outcome:"Outcomes", entity:"Entities and jurisdictions", tax_rule:"Tax and legal rules", cash_flow:"Cash flows" },
  ru: { trigger:"Исходная ситуация", actor:"Участники и заинтересованные стороны", fact:"Существенные факты", evidence:"Доказательства и источники", deadline:"Сроки", decision:"Решения", outcome:"Исходы", entity:"Субъекты и юрисдикции", tax_rule:"Налоговые и правовые нормы", cash_flow:"Денежные потоки" },
};

function portableDraft(source: StudioDraft) {
  const candidate = structuredClone(source) as StudioDraft;
  candidate.parent = null;
  candidate.editHistory = [];
  delete candidate.protection;
  return normalizeStudioDraft(candidate);
}

const cell = (value: unknown) => String(value ?? "").replace(/\|/g, "\\|").replace(/\r?\n/g, "<br>");
const money = (value: number | null | undefined, currency: string) => value === null || value === undefined ? "—" : `${currency} ${value.toLocaleString("en-GB")}`;
const percent = (bps: number | null | undefined) => bps === null || bps === undefined ? "—" : `${(bps / 100).toFixed(2).replace(/\.00$/, "")}%`;

function runtime(node: StudioNode, language: CaseMarkdownLanguage) {
  if (!node.runtime) return "";
  const value = node.runtime;
  const parts = [
    value.day ? `${language === "en" ? "day" : "день"} ${value.day}` : "",
    value.time,
    value.deadlineDay && value.deadlineTime ? `${language === "en" ? "deadline" : "срок"}: ${value.deadlineDay}/${value.deadlineTime}` : "",
    value.budgetCostEur !== undefined ? `EUR ${value.budgetCostEur.toLocaleString("en-GB")}` : "",
    value.durationMinutes !== undefined ? `${value.durationMinutes} min` : "",
    value.terminalOutcome ? `${language === "en" ? "class" : "класс"}: ${value.terminalOutcome}` : "",
    value.pressure,
  ].filter(Boolean);
  return parts.length ? `\n\n_${parts.join(" · ")}_` : "";
}

function relation(link: StudioLink, nodes: Map<string, StudioNode>, language: CaseMarkdownLanguage) {
  const from = nodes.get(link.from)?.title ?? link.from;
  const to = nodes.get(link.to)?.title ?? link.to;
  const rule = link.rule;
  const notes = [
    rule?.label,
    rule?.detail,
    rule?.result ? `${language === "en" ? "Result" : "Результат"}: ${rule.result}` : "",
    rule?.cost !== undefined ? `EUR ${rule.cost.toLocaleString("en-GB")}` : "",
    rule?.minutes !== undefined ? `${rule.minutes} min` : "",
    rule?.repeatability,
    rule?.maxUses !== undefined ? `${language === "en" ? "max" : "макс."} ${rule.maxUses}` : "",
    rule?.guards?.length ? rule.guards.map((guard) => `${guard.metric} ${guard.comparison} ${guard.value}`).join(", ") : "",
    rule?.effects && Object.keys(rule.effects).length ? Object.entries(rule.effects).map(([key,value]) => `${key} ${Number(value) >= 0 ? "+" : ""}${value}`).join(", ") : "",
  ].filter(Boolean);
  return `- **${from} → ${to}**${notes.length ? ` — ${notes.join("; ")}` : ""}`;
}

async function gzip(value: string) {
  const stream = new Blob([value]).stream().pipeThrough(new CompressionStream("gzip"));
  const bytes = new Uint8Array(await new Response(stream).arrayBuffer());
  let binary = "";
  for (let offset=0; offset<bytes.length; offset+=0x8000) binary += String.fromCharCode(...bytes.subarray(offset,offset+0x8000));
  return btoa(binary).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/g,"");
}

async function gunzip(value: string) {
  const binary = atob(value.replace(/-/g,"+").replace(/_/g,"/").padEnd(Math.ceil(value.length/4)*4,"="));
  const bytes = Uint8Array.from(binary,(character)=>character.charCodeAt(0));
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("gzip"));
  return new Response(stream).text();
}

function economics(draft: StudioDraft, language: CaseMarkdownLanguage) {
  const en=language==="en";
  const output:string[]=[];
  if(draft.dealEconomics){
    const model=draft.dealEconomics;
    output.push(en?"### Investment and cash-flow assumptions":"### Инвестиционные допущения и денежные потоки","",`| ${en?"Input":"Параметр"} | ${en?"Value":"Значение"} |`,"|---|---:|",
      `| ${en?"Purchase price":"Цена покупки"} | ${money(model.purchasePrice,model.currency)} |`,
      `| LTV | ${percent(model.loanToValueBps)} |`,
      `| ${en?"Interest rate":"Процентная ставка"} | ${percent(model.annualInterestRateBps)} |`,
      `| ${en?"Loan term":"Срок кредита"} | ${model.termMonths ?? "—"} ${en?"months":"месяцев"} |`,
      `| ${en?"Gross annual income":"Валовой годовой доход"} | ${money(model.grossAnnualIncome,model.currency)} |`,
      `| ${en?"Annual operating costs":"Годовые операционные расходы"} | ${money(model.annualOperatingCosts,model.currency)} |`,
      `| ${en?"One-off structure cost":"Разовые расходы на структуру"} | ${money(model.oneOffStructureCost,model.currency)} |`,
      `| ${en?"Annual structure cost":"Годовые расходы на структуру"} | ${money(model.annualStructureCost,model.currency)} |`,
      `| ${en?"Target annual return":"Целевая годовая доходность"} | ${percent(model.targetAnnualReturnBps)} |`,"");
    if(model.assumptions.length) output.push(en?"**Model assumptions**":"**Допущения модели**","",...model.assumptions.map((item)=>`- ${item}`),"");
  }
  if(draft.taxEconomics){
    const model=draft.taxEconomics;
    output.push(en?"### Tax-structure economics":"### Экономика налоговой структуры","",`| ${en?"Input":"Параметр"} | ${en?"Value":"Значение"} |`,"|---|---:|",
      `| ${en?"Tax input basis":"Способ ввода налога"} | ${model.taxInputBasis === "rates" ? (en?"Tax base + rates (%)":"Налоговая база + ставки (%)") : (en?"Annual tax amounts":"Годовые суммы налога")} |`,
      `| ${en?"Annual taxable base":"Годовая налоговая база"} | ${money(model.annualTaxBase,model.currency)} |`,
      `| ${en?"Baseline annual tax":"Базовый годовой налог"} | ${money(model.baselineAnnualTaxCost,model.currency)} |`,
      `| ${en?"Optimized annual tax":"Оптимизированный годовой налог"} | ${money(model.optimizedAnnualTaxCost,model.currency)} |`,
      `| ${en?"Baseline rate":"Базовая ставка"} | ${percent(model.baselineTaxRateBps)} |`,
      `| ${en?"Optimized rate":"Оптимизированная ставка"} | ${percent(model.optimizedTaxRateBps)} |`,
      `| ${en?"Implementation":"Внедрение"} | ${money(model.implementationCost,model.currency)} |`,
      `| ${en?"Annualized implementation":"Внедрение в пересчёте на год"} | ${money(model.implementationCost/(model.analysisHorizonMonths/12),model.currency)} |`,
      `| ${en?"Annual maintenance":"Годовое сопровождение"} | ${money(model.annualMaintenanceCost,model.currency)} |`,
      `| ${en?"Terminal tax / unwind":"Налог / расходы при выходе"} | ${money(model.terminalTaxOrUnwindCost,model.currency)} |`,
      `| ${en?"Analysis horizon":"Горизонт анализа"} | ${model.analysisHorizonMonths} ${en?"months":"месяцев"} |`,
      ...(model.fx ? [`| ${en?"Currency conversion":"Конвертация валюты"} | ECB ${model.fx.asOf}: 1 ${model.fx.sourceCurrency} = ${model.fx.rate.toPrecision(8)} ${model.fx.targetCurrency} |`] : []),
      "",model.assumptions?`> ${model.assumptions}`:"","");
  }
  return output;
}

export async function buildCaseMarkdown(source:StudioDraft,options:{status:CaseMarkdownStatus;language:CaseMarkdownLanguage}){
  const draft=portableDraft(source);
  const fingerprint=caseFingerprint(draft);
  const language=options.language;
  const en=language==="en";
  const nodeById=new Map(draft.nodes.map((node)=>[node.id,node]));
  const groups=(Object.keys(labels[language]) as StudioNodeType[]).map((type)=>({type,nodes:draft.nodes.filter((node)=>node.type===type)})).filter((group)=>group.nodes.length);
  const payload=await gzip(JSON.stringify({format:"genesis-juris-canonical-markdown",schemaVersion:1,fingerprint,status:options.status,language,draft}));
  const lines=[
    `# ${draft.title}`,"",
    `> **${en?"Document status":"Статус документа"}:** ${options.status==="final"?(en?"Final reviewed case description":"Финальное проверенное описание кейса"):(en?"Amended case description":"Уточнённое описание кейса")}`,
    `> **${en?"Canonical fingerprint":"Канонический отпечаток"}:** \`${fingerprint}\``,"",
    `## ${en?"1. Case mandate":"1. Мандат кейса"}`,"",
    draft.premise||(en?"_The factual case context must be completed in Studio._":"_Фактический контекст кейса необходимо заполнить в Studio._"),"",
    `| ${en?"Field":"Поле"} | ${en?"Reviewed value":"Проверенное значение"} |`,"|---|---|",
    `| ${en?"Jurisdiction":"Юрисдикция"} | ${cell(draft.jurisdiction)} |`,
    `| ${en?"Player role":"Роль игрока"} | ${cell(draft.role)} |`,
    `| ${en?"Practice area":"Область практики"} | ${cell(draft.classification?.practiceArea)} |`,
    `| ${en?"Difficulty":"Сложность"} | ${cell(draft.classification?.difficulty)} |`,
    `| ${en?"Case purpose":"Цель кейса"} | ${cell(draft.classification?.purpose)} |`,
    `| ${en?"Law / guidance as of":"Право / guidance на дату"} | ${cell(draft.classification?.legalAsOf||"—")} |`,"",
    `## ${en?"2. Reviewed case elements":"2. Проверенные элементы кейса"}`,"",
    ...groups.flatMap((group)=>[`### ${labels[language][group.type]}`,"",...group.nodes.flatMap((node)=>[`#### ${node.title}`,"",node.detail||(en?"_No further detail authored._":"_Дополнительное описание не задано._"),runtime(node,language),""])]),
    `## ${en?"3. Decision paths and consequences":"3. Варианты решений и последствия"}`,"",
    ...draft.links.map((link)=>relation(link,nodeById,language)),"",
    `## ${en?"4. Economics and quantified assumptions":"4. Экономика и количественные допущения"}`,"",
    ...economics(draft,language),
    ...(!draft.dealEconomics&&!draft.taxEconomics?[en?"_No structured economic model is attached._":"_Структурированная экономическая модель не приложена._",""]:[]),
    `## ${en?"5. Classification, sources and review controls":"5. Классификация, источники и контроль проверки"}`,"",
    `- **${en?"Tags":"Теги"}:** ${(draft.classification?.tags??[]).join(", ")||"—"}`,
    `- **${en?"Tax topics":"Налоговые темы"}:** ${(draft.classification?.taxTopics??[]).join(", ")||"—"}`,
    `- **${en?"Source URLs":"URL источников"}:** ${(draft.classification?.sourceUrls??[]).join(", ")||"—"}`,
    `- **${en?"Compliance-only guard":"Ограничение на законные цели"}:** ${draft.classification?.complianceOnly===false?"No":"Yes"}`,"",
    `## ${en?"6. Deterministic Studio hand-off":"6. Детерминированная передача в Studio"}`,"",
    en?"Enter this complete Markdown file as a Studio prompt and choose **Verify canonical case**. Studio validates the embedded fingerprint and reconstructs the exact reviewed graph without AI reinterpretation. To amend canonical content, edit the case in Studio and generate a new file.":"Введите весь Markdown-файл как промпт Studio и выберите **Проверить канонический кейс**. Studio проверит встроенный отпечаток и восстановит точную проверенную схему без повторной AI-интерпретации. Для канонических изменений отредактируйте кейс в Studio и создайте новый файл.","",
    `<!-- ${CANONICAL_CASE_MARKER}`,`fingerprint:${fingerprint}`,"encoding:gzip-base64url",`payload:${payload}`,"-->","",
  ];
  return {markdown:lines.filter((line,index)=>line!==""||lines[index-1]!=="").join("\n"),fingerprint,draft};
}

export async function parseCaseMarkdown(markdown:string):Promise<ParsedCaseMarkdown|null>{
  const marker=`<!-- ${CANONICAL_CASE_MARKER}`;
  const start=markdown.indexOf(marker);
  if(start<0)return null;
  const end=markdown.indexOf("-->",start+marker.length);
  if(end<0)throw new Error("Canonical case marker is incomplete");
  const fields=Object.fromEntries(markdown.slice(start+marker.length,end).trim().split(/\r?\n/).flatMap((line)=>{const separator=line.indexOf(":");return separator>0?[[line.slice(0,separator),line.slice(separator+1)]]:[];}));
  if(fields.encoding!=="gzip-base64url"||!fields.payload||!/^sha256-[a-f0-9]{64}$/.test(fields.fingerprint??""))throw new Error("Canonical case marker is invalid");
  const parsed:unknown=JSON.parse(await gunzip(fields.payload));
  if(!isRecord(parsed)||parsed.format!=="genesis-juris-canonical-markdown"||parsed.schemaVersion!==1||parsed.fingerprint!==fields.fingerprint||(parsed.status!=="amended"&&parsed.status!=="final")||(parsed.language!=="en"&&parsed.language!=="ru"))throw new Error("Canonical case payload is invalid");
  const draft=portableDraft(normalizeStudioDraft(parsed.draft));
  const fingerprint=caseFingerprint(draft);
  if(fingerprint!==fields.fingerprint)throw new Error("Canonical case fingerprint mismatch");
  return {draft,fingerprint,status:parsed.status,language:parsed.language};
}
