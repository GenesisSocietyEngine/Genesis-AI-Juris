"use client";

import { useRef, useState } from "react";
import type { StudioOverviewProps } from "./StudioOverview";
import { openStudioSourceFragment, studioOverview, studioSourceFragmentId } from "./studio-overview";
import { studioGovernedEvidenceDestination } from "./studio-governed-evidence";
import { reportStatementStatus } from "./report-statement-status";
import { useWorkspaceLocation } from "./use-interface-locale";
import styles from "./studio-overview.module.css";
import StudioSourcePacketExport from "./StudioSourcePacketExport";
import StudioExampleUpgrade from "./StudioExampleUpgrade";
import StudioConvertedSourcePacket from "./StudioConvertedSourcePacket";
import StudioProvenanceRegister from "./StudioProvenanceRegister";

export default function StudioSourcesPanel({ draft, locale, onStep, onNode, onAction, packetAuthority, onUpgrade }: StudioOverviewProps & {
  onUpgrade?: (expectedFingerprint: string, next: StudioOverviewProps["draft"]) => boolean;
  packetAuthority?: { allowed: boolean; epoch: number; verify: () => Promise<() => boolean> };
}) {
  const model = studioOverview(draft, locale);
  const evidenceDestination = studioGovernedEvidenceDestination(useWorkspaceLocation());
  const root = useRef<HTMLElement>(null);
  const [notice, setNotice] = useState("");
  const [technicalOpen, setTechnicalOpen] = useState(false);
  const t = (en: string, ru: string) => locale === "en" ? en : ru;
  const records = [...model.facts, ...model.evidence];
  function openArea(id: "studio-source-documents" | "studio-source-records" | "studio-source-requirement" | "studio-governed-evidence-title") {
    const heading = root.current?.querySelector<HTMLElement>(`#${id}`);
    if (!heading) return;
    const disclosure = heading.closest("details");
    if (disclosure) disclosure.open = true;
    heading.focus();
    heading.scrollIntoView({ block: "start", behavior: "auto" });
  }
  function linkedStatements(nodeId: string) {
    const connected = new Set(draft.links.flatMap(link => link.from === nodeId ? [link.to] : link.to === nodeId ? [link.from] : []));
    return model.facts.filter(fact => connected.has(fact.id));
  }
  function jump(document: string, version: number, section: string) {
    const opened = root.current && openStudioSourceFragment(root.current, studioSourceFragmentId(document, version, section));
    setNotice(opened ? "" : t("That exact reference section is unavailable. No substitute version has been opened.", "Точный фрагмент недоступен. Другая версия не была подставлена."));
  }
  return <section ref={root} className={styles.workspace} aria-labelledby="studio-sources-title">
    <header className={styles.header}><div><p className={styles.eyebrow}>{t("CASE MATERIALS", "МАТЕРИАЛЫ ДЕЛА")}</p><h2 id="studio-sources-title">{t("Sources and evidence", "Источники и материалы")}</h2></div><span className={styles.status}>{t("Review not recorded here", "Проверка здесь не зафиксирована")}</span></header>
    <div className={styles.sourceCards} aria-label={t("Explore sources and evidence", "Открыть источники и материалы")}>
      {([
        ["studio-source-documents", t("Reference documents", "Эталонные документы"), model.documentCount ?? t("Not attached", "Не приложены"), t("Open source material", "Открыть материалы")],
        ["studio-source-records", t("Fact / evidence records in graph", "Записи фактов / материалов на схеме"), model.recordedCount, t("Browse records", "Открыть записи")],
        ["studio-source-requirement", t("Minimum graph records required", "Минимальное число записей графа"), model.requiredRecordCount ?? t("Not specified", "Не указано"), t("Check requirement", "Проверить требование")],
        ["studio-governed-evidence-title", t("Human-reviewed grounds", "Основания, проверенные человеком"), t("Not recorded in Studio", "Не фиксируются в Studio"), t("Open review workflow", "Открыть процесс проверки")],
      ] as const).map(([id, label, value, action]) => <button key={id} type="button" className={styles.fileCard} aria-label={label} aria-describedby={`${id}-count`} aria-controls={id} onClick={() => openArea(id)}><span>{label}</span><strong id={`${id}-count`} className={styles.fileCount}>{value}</strong><span className={styles.fileAction}>{action} →</span></button>)}
    </div>
    <p className={styles.muted}>{t("Reference material and case records still need independent review.", "Источники и записи дела требуют независимой проверки.")}</p>
    {notice && <p role="alert" className={styles.notice}>{notice}</p>}
    <section className={styles.block} aria-labelledby="studio-source-documents"><h3 className={styles.sourceTarget} id="studio-source-documents" tabIndex={-1}>{t("Source documents and references", "Документы и ссылки")}</h3>
    <StudioConvertedSourcePacket key={"packet-" + (packetAuthority?.epoch ?? 0)} draft={draft} locale={locale} onNode={onNode} authority={packetAuthority}/>
    {model.sourcePacket.length > 0 && <section className={styles.block}><h3>{t("Retained fictional source packet", "Сохранённый пакет вымышленных источников")}</h3><p>{t(`${model.documentCount} document identities · ${model.sourcePacket.length} immutable versions. Open the version cited by the record; a later version does not silently replace it.`, `Документов: ${model.documentCount}; неизменяемых версий: ${model.sourcePacket.length}. Открывайте указанную в записи версию: новая версия не подставляется автоматически.`)}</p>{model.sourcePacket.map(source => <details className={styles.source} key={`${source.id}:${source.version}`}><summary>{source.id} v{source.version} — {source.title}</summary>{Object.entries(source.sections).map(([section, text]) => <div className={styles.fragment} tabIndex={-1} id={studioSourceFragmentId(source.id, source.version, section)} key={section} lang="en"><h4>§ {section}</h4><p>{text}</p></div>)}</details>)}</section>}
    {model.referenceScenario && packetAuthority && <section className={styles.block}><h3>{t("Complete source packet export", "Экспорт полного пакета источников")}</h3><StudioSourcePacketExport key={packetAuthority.epoch} draft={draft} locale={locale} allowed={packetAuthority.allowed} verify={packetAuthority.verify}/></section>}
    {model.documentCount === null && <section className={styles.block}><h3>{t("Text references only", "Только текстовые ссылки")}</h3>{draft.classification?.sourceUrls?.length ? <ul>{draft.classification.sourceUrls.map((url, index) => <li key={`${index}:${url}`}><code>{url}</code></li>)}</ul> : <p>{t("No separate source URLs are recorded. Node explanations remain available in the decision map.", "Отдельные URL источников не записаны. Пояснения узлов доступны на карте решений.")}</p>}<p>{t("A text URL is not an uploaded document, exact citation or human verification.", "Текстовый URL не является загруженным документом, точной цитатой или человеческой проверкой.")}</p></section>}
    </section>

    <section className={styles.block}><h3 className={styles.sourceTarget} id="studio-source-records" tabIndex={-1}>{t("Recorded facts and evidence", "Записанные факты и материалы")}</h3>{records.length ? <ul className={styles.records}>{records.map(node => <li key={node.id}><span className={styles.muted}>{node.type === "fact" ? reportStatementStatus(node, locale) || t("Authored fact record", "Авторская запись факта") : t("Evidence record", "Запись материала")}</span><h4>{node.title}</h4><p>{node.detail}</p>{node.type === 'evidence' && linkedStatements(node.id).length > 0 && <div><p className={styles.muted}>{t('Linked authored statements · review required', 'Связанные авторские утверждения · требуется проверка')}</p><ul>{linkedStatements(node.id).map(fact => <li key={fact.id}><button type="button" aria-label={t("Inspect linked statement: ", "Открыть связанное утверждение: ") + fact.title} onClick={() => onNode(fact.id)}>{fact.title}</button>{fact.factStatus && <span className={styles.muted}> — {reportStatementStatus(fact, locale)}</span>}</li>)}</ul></div>}<button type="button" onClick={() => onNode(node.id)}>{t("Inspect this graph record", "Открыть запись на схеме")}</button></li>)}</ul> : <p>{t("No fact or evidence graph records are present.", "На схеме пока нет записей фактов или материалов.")}</p>}<button type="button" onClick={() => onAction ? onAction({ step: 3, id: "studio-evidence-composer", nodeType: "evidence" }) : onStep(3)}>{t("Add a connected working record", "Добавить связанную рабочую запись")}</button></section>
    <details className={`${styles.block} ${styles.planning}`}><summary>{t("Record requirement", "Требование к записям")}</summary>
      <h3 className={styles.sourceTarget} id="studio-source-requirement" tabIndex={-1}>{t("Minimum case structure", "Минимальная структура дела")}</h3>
      <p>{t(`Case records: ${model.recordedCount}. Minimum required: ${model.requiredRecordCount ?? "not specified"}.`, `Записей дела: ${model.recordedCount}. Требуемый минимум: ${model.requiredRecordCount ?? "не указан"}.`)}</p>
      <p>{t("This minimum checks case structure. It does not establish document coverage or human review.", "Минимум относится к структуре дела. Он не подтверждает полноту документов или проверку человеком.")}</p>
      <button type="button" onClick={() => onAction ? onAction({ step: 3, id: "studio-evidence-composer", nodeType: "fact" }) : onStep(3)}>{t("Add a fact or assumption", "Добавить факт или допущение")}</button>
    </details>
    <details className={`${styles.block} ${styles.planning}`}><summary>{t("Facts, assumptions and review", "Факты, допущения и проверка")}</summary>
      <h3 className={styles.sourceTarget} id="studio-governed-evidence-title" tabIndex={-1}>{t("Facts, assumptions and review", "Факты, допущения и проверка")}</h3>
      <p>{t("Organization cases provide source versions, typed assertions and review in Evidence.", "В разделе «Доказательства» дела организации доступны версии источников, типы утверждений и проверка.")}</p>
      <p>{evidenceDestination.returning
        ? t("Return to the organization case you came from. This Studio draft remains separate; opening its evidence does not copy or link the draft's records.", "Вернитесь в дело организации, из которого открыли Studio. Этот черновик остаётся отдельным: переход не копирует и не связывает его записи.")
        : t("Choose the intended case in My cases → Team, then open Evidence. Studio does not infer a matching organization case or copy your draft into it.", "Выберите нужное дело в «Мои кейсы → Команда», затем откройте «Доказательства». Studio не подбирает дело организации и не копирует в него черновик.")}</p>
      <a className={styles.actionLink} href={evidenceDestination.href}>{evidenceDestination.returning ? t("Return to the originating case's evidence", "Вернуться к доказательствам исходного дела") : t("Choose an organization case", "Выбрать дело организации")}</a>
    </details>
    {model.references.length > 0 && <section className={styles.block}><h3>{t("Text references in the working model", "Текстовые ссылки в рабочей модели")}</h3><p>{t("These references open the retained fictional source section. They are not accepted dossier anchors or proof of an unchanged source-to-conclusion dependency.", "Ссылки открывают сохранённый фрагмент вымышленного источника. Это не принятые ссылки дела и не доказательство неизменной зависимости вывода от источника.")}</p><ul className={styles.references}>{model.references.map(ref => <li key={`${ref.nodeId}:${ref.document}:${ref.version}:${ref.section}`}><button type="button" onClick={() => onNode(ref.nodeId)}>{draft.nodes.find(node => node.id === ref.nodeId)?.title ?? ref.nodeId}</button><span>{ref.document} v{ref.version} § {ref.section}</span>{ref.source ? <button type="button" onClick={() => jump(ref.document, ref.version, ref.section)}>{t("Open exact reference passage", "Открыть точный фрагмент")}</button> : <strong>{t("Exact source/version/section unavailable", "Точный источник, версия или фрагмент недоступны")}</strong>}{!ref.exactTextPresent && <p>{t("The full reference excerpt is not present verbatim in this graph record. Reconcile the text before relying on the relationship.", "Полный фрагмент источника не совпадает дословно с записью. Сопоставьте тексты перед использованием связи.")}</p>}</li>)}</ul></section>}
    <details className={`${styles.block} ${styles.planning}`} onToggle={event => setTechnicalOpen(event.currentTarget.open)}>
      <summary>{t("Source history and technical details", "История источников и технические сведения")}</summary>
      {technicalOpen && <>
        <StudioExampleUpgrade key={"upgrade-" + (packetAuthority?.epoch ?? 0)} draft={draft} locale={locale} authority={packetAuthority} onUpgrade={onUpgrade}/>
        <StudioProvenanceRegister key={packetAuthority?.epoch ?? 0} draft={draft} locale={locale} onNode={onNode} authority={packetAuthority}/>
      </>}
    </details>
  </section>;
}
