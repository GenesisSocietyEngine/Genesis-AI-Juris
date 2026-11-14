"use client";

import type { FormEvent } from "react";
import { useWorkspaceDraft } from "./WorkspaceDrafts";
import type { DocumentItem } from "./matter-view-model";
import styles from "./matters.module.css";

export default function DocumentUploadForm({ locale = "en", caseId, classification, documents, mutationKey, onUpload }: {
  locale?: "en" | "ru";
  caseId: string;
  classification: string;
  documents: DocumentItem[];
  mutationKey: string | null;
  onUpload: (event: FormEvent<HTMLFormElement>) => void;
}) {
  const t = (en: string, ru: string) => locale === "ru" ? ru : en;
  const [documentId, setDocumentId] = useWorkspaceDraft(`${caseId}:upload:documentId`, "");
  const [title, setTitle] = useWorkspaceDraft(`${caseId}:upload:title`, "");
  const [sourceNote, setSourceNote] = useWorkspaceDraft(`${caseId}:upload:sourceNote`, "");
  const [tags, setTags] = useWorkspaceDraft(`${caseId}:upload:tags`, "");
  const [documentType, setDocumentType] = useWorkspaceDraft(`${caseId}:upload:type`, "");
  const [newClassification, setNewClassification] = useWorkspaceDraft(`${caseId}:upload:classification`, classification);
  // Unknown origins are ineligible. The server still verifies ownership,
  // finalization, source origin, metadata and the current case revision.
  const versionTargets = documents.filter(document => document.sourceOrigin === "internal_upload");
  const selected = versionTargets.find(document => document.id === documentId);
  const missingTarget = documentId !== "" && !selected;
  const locked = documentId !== "";
  const busy = mutationKey !== null;
  return <form id="document-upload-form" className={styles.uploadForm} onSubmit={event => {
    if (busy || missingTarget) { event.preventDefault(); return; }
    onUpload(event);
  }} onReset={() => {
    setDocumentId(""); setTitle(""); setSourceNote(""); setTags(""); setDocumentType(""); setNewClassification(classification);
  }}>
    <label className={styles.field} data-own-drafts><span>{t("Upload purpose", "Цель загрузки")}</span><select name="documentId" value={documentId} onChange={event => setDocumentId(event.target.value)} disabled={busy} aria-describedby={locked ? "upload-version-context" : undefined}>
      <option value="">{t("Create a new logical document", "Создать новый документ")}</option>
      {missingTarget && <option value={documentId}>{t("Previously selected document is unavailable", "Ранее выбранный документ недоступен")}</option>}
      {versionTargets.map(document => <option key={document.id} value={document.id}>{t("Add a new immutable version of ", "Добавить неизменяемую версию документа «")}{document.title}{locale === "ru" ? "»" : ""}</option>)}
    </select></label>
    <label className={styles.field} data-own-drafts><span>{t("Logical document title", "Название документа")}</span><input name="title" required minLength={2} maxLength={240} value={locked ? selected?.title ?? "" : title} readOnly={locked} disabled={busy} onChange={event => setTitle(event.target.value)}/></label>
    <label className={styles.field} data-own-drafts><span>{t("Document type", "Тип документа")}</span><input name="documentType" required maxLength={120} value={locked ? selected?.type ?? "" : documentType} readOnly={locked} disabled={busy} onChange={event => setDocumentType(event.target.value)} placeholder={t("e.g. witness statement", "Например, показания свидетеля")}/></label>
    <label className={styles.field} data-own-drafts><span>{t("Classification", "Конфиденциальность")}</span><select name={locked ? undefined : "classification"} value={locked ? selected?.classification ?? "" : newClassification} disabled={busy || locked} onChange={event => setNewClassification(event.target.value)}>
      {missingTarget && <option value="">{t("Unavailable", "Недоступно")}</option>}
      <option value="public">{t("Public", "Общедоступно")}</option><option value="internal">{t("Internal", "Для внутреннего использования")}</option><option value="confidential">{t("Confidential", "Конфиденциально")}</option><option value="strictly_confidential">{t("Strictly confidential", "Строго конфиденциально")}</option>
    </select></label>
    {locked && <input type="hidden" name="classification" value={selected?.classification ?? ""}/>}
    {locked && <p id="upload-version-context" className={styles.uploadContext} role={missingTarget ? "alert" : undefined}>{missingTarget
      ? t("This document is no longer available for a new version. Choose an available document or explicitly create a new one. Your selected file is retained while this form stays open.", "Добавить версию к этому документу больше нельзя. Выберите доступный документ или создайте новый. Выбранный файл сохранится, пока форма открыта.")
      : t("A new version keeps this document’s title, type and classification. Earlier versions remain in its history.", "Новая версия сохранит название, тип и уровень конфиденциальности документа. Предыдущие версии останутся в истории.")}</p>}
    <label className={styles.fileField}><span>{t("Choose one source file", "Выберите исходный файл")}</span><input name="file" type="file" accept=".pdf,.docx,.txt,.md,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain,text/markdown" required disabled={busy}/><small>{t("Unsupported or image-only attachments may be retained as “not extractable”; they are never presented as analysed.", "Если текст вложения нельзя извлечь, файл может быть сохранён с соответствующей отметкой. Такой файл не считается проанализированным.")}</small></label>
    <label className={styles.checkField}><input name="privacyAcknowledged" type="checkbox" value="true" required disabled={busy}/><span>{t("I confirm this pilot file is synthetic or de-identified and contains no live privileged or client-identifying material.", "Подтверждаю, что файл содержит только синтетические или обезличенные данные без защищённых сведений и информации, позволяющей установить личность клиента.")}</span></label>
    {!locked && <label className={styles.field} data-own-drafts><span>{t("Tags (comma-separated, optional)", "Метки через запятую (необязательно)")}</span><input name="tags" value={tags} onChange={event => setTags(event.target.value)} maxLength={780} disabled={busy}/></label>}
    <label className={styles.field} data-own-drafts><span>{t("Version description (optional)", "Описание версии (необязательно)")}</span><textarea name="sourceNote" value={sourceNote} onChange={event => setSourceNote(event.target.value)} maxLength={1000} disabled={busy}/></label>
    <button className={styles.primaryButton} disabled={busy || missingTarget}>{mutationKey === "upload" ? t("Uploading…", "Загрузка…") : locked ? t("Upload new version", "Загрузить новую версию") : t("Upload document", "Загрузить документ")}</button>
  </form>;
}
