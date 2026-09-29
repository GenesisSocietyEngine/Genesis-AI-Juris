"use client";

import type { FormEvent } from "react";
import { useWorkspaceDraft } from "./WorkspaceDrafts";
import type { DocumentItem } from "./matter-view-model";
import styles from "./matters.module.css";

export default function DocumentUploadForm({ caseId, classification, documents, mutationKey, onUpload }: {
  caseId: string;
  classification: string;
  documents: DocumentItem[];
  mutationKey: string | null;
  onUpload: (event: FormEvent<HTMLFormElement>) => void;
}) {
  const [documentId, setDocumentId] = useWorkspaceDraft(`${caseId}:upload:documentId`, "");
  const [title, setTitle] = useWorkspaceDraft(`${caseId}:upload:title`, "");
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
    setDocumentId(""); setTitle(""); setDocumentType(""); setNewClassification(classification);
  }}>
    <label className={styles.field} data-own-drafts><span>Upload purpose</span><select name="documentId" value={documentId} onChange={event => setDocumentId(event.target.value)} disabled={busy} aria-describedby={locked ? "upload-version-context" : undefined}>
      <option value="">Create a new logical document</option>
      {missingTarget && <option value={documentId}>Previously selected document is unavailable</option>}
      {versionTargets.map(document => <option key={document.id} value={document.id}>Add a new immutable version of {document.title}</option>)}
    </select></label>
    <label className={styles.field} data-own-drafts><span>Logical document title</span><input name="title" required minLength={2} maxLength={240} value={locked ? selected?.title ?? "" : title} readOnly={locked} disabled={busy} onChange={event => setTitle(event.target.value)}/></label>
    <label className={styles.field} data-own-drafts><span>Document type</span><input name="documentType" required maxLength={120} value={locked ? selected?.type ?? "" : documentType} readOnly={locked} disabled={busy} onChange={event => setDocumentType(event.target.value)} placeholder="e.g. witness statement"/></label>
    <label className={styles.field} data-own-drafts><span>Classification</span><select name={locked ? undefined : "classification"} value={locked ? selected?.classification ?? "" : newClassification} disabled={busy || locked} onChange={event => setNewClassification(event.target.value)}>
      {missingTarget && <option value="">Unavailable</option>}
      <option value="public">Public</option><option value="internal">Internal</option><option value="confidential">Confidential</option><option value="strictly_confidential">Strictly confidential</option>
    </select></label>
    {locked && <input type="hidden" name="classification" value={selected?.classification ?? ""}/>}
    {locked && <p id="upload-version-context" className={styles.uploadContext} role={missingTarget ? "alert" : undefined}>{missingTarget
      ? "This document is no longer available for a new version. Choose an available document or explicitly create a new one. Your selected file is retained while this form stays open."
      : "A new version keeps this document’s title, type and classification. Earlier versions remain in its history."}</p>}
    <label className={styles.fileField}><span>Choose one source file</span><input name="file" type="file" accept=".pdf,.docx,.txt,.md,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain,text/markdown" required disabled={busy}/><small>Unsupported or image-only attachments may be retained as “not extractable”; they are never presented as analysed.</small></label>
    <label className={styles.checkField}><input name="privacyAcknowledged" type="checkbox" value="true" required disabled={busy}/><span>I confirm this pilot file is synthetic or de-identified and contains no live privileged or client-identifying material.</span></label>
    <button className={styles.primaryButton} disabled={busy || missingTarget}>{mutationKey === "upload" ? "Submitting securely…" : "Submit for server validation"}</button>
  </form>;
}
