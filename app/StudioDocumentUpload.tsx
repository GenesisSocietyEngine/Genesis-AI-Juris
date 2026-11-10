"use client";
import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { casePublicationFingerprint } from "./case-integrity";
import { startReportDownload } from "./report-download";
import { workspaceDestination } from "./workspace-navigation";
import { useWorkspaceLocation } from "./use-interface-locale";
import { attachStudioSource, MAX_SOURCE_BYTES } from "./studio-source-files";
import type { MaterialsAuthority } from "./StudioMaterialsWorkspace";
import type { StudioDraft } from "./types";

export default function StudioDocumentUpload({ draft, locale, authority, onApply, team }: {
  draft: StudioDraft; locale: "en" | "ru"; authority?: MaterialsAuthority;
  onApply?: (expected: string, next: StudioDraft) => boolean;
  team: { href: string; returning: boolean };
}) {
  const t = (en: string, ru: string) => locale === "en" ? en : ru;
  const [destination, choose] = useState("");
  const location = useWorkspaceLocation();
  const scope = useMemo(() => ({ draft, locale, destination, epoch: authority?.epoch, allowed: authority?.allowed }), [draft, locale, destination, authority?.epoch, authority?.allowed]);
  const context = useRef<typeof scope | null>(null);
  const active = useRef<typeof scope | null>(null);
  const [pending, setPending] = useState<typeof scope | null>(null);
  const [feedback, setFeedback] = useState<{scope: typeof scope; text: string} | null>(null);
  const busy = pending === scope;
  const message = feedback?.scope === scope ? feedback.text : "";
  const report = (text: string) => setFeedback({scope, text});
  useLayoutEffect(() => {
    context.current = scope;
    return () => { context.current = null; };
  }, [scope]);
  async function upload(files: File[]) {
    if (!authority?.allowed || !onApply || active.current === scope) return;
    const ticket = context.current;
    active.current = scope;
    report("");
    setPending(scope);
    try {
      if (!files.length || files.some(file => !file.size || file.size > MAX_SOURCE_BYTES)) throw new Error();
      const permitted = await authority.verify();
      if (ticket !== context.current || !permitted()) return;
      let next = draft;
      for (const file of files) {
        const bytes = new Uint8Array(await file.arrayBuffer());
        if (ticket !== context.current || !permitted()) return;
        let binary = "";
        for (const byte of bytes) binary += String.fromCharCode(byte);
        next = attachStudioSource(next, { name: file.name, data: btoa(binary) });
      }
      if (ticket !== context.current || !permitted()) return;
      if (!onApply(casePublicationFingerprint(draft), next)) throw new Error();
    } catch {
      if (ticket === context.current) report(t("Could not attach this file. Check its format, size and remaining draft space.", "Не удалось прикрепить файл. Проверьте формат, размер и свободное место в черновике."));
    } finally {
      if (ticket === context.current) { active.current = null; setPending(null); }
    }
  }

  return <section aria-labelledby="studio-upload-title"><h3 id="studio-upload-title">{t("Upload a document", "Загрузить документ")}</h3>
    <label>{t("Save document to", "Куда сохранить документ")} <select value={destination} onChange={e => choose(e.target.value)}>
      <option value="">{t("Choose a destination", "Выберите место сохранения")}</option>
      <option value="studio">{t("This Studio draft", "Этот черновик Studio")}</option>
      <option value="team">{t("Team case", "Командное дело")}</option>
      <option value="firm">{t("Firm documents", "Документы фирмы")}</option>
      <option value="templates">{t("Document templates", "Шаблоны документов")}</option>
    </select></label>
    {destination === "studio" && <div><p>{t("The original file travels with this draft when you save, export or share it. Use synthetic or de-identified files.", "При сохранении, экспорте или публикации черновика исходный файл передаётся вместе с ним. Используйте синтетические или обезличенные файлы.")}</p>
      <label>{t("Attach PDF, DOCX, TXT or Markdown (up to 512 KiB each)", "Прикрепить PDF, DOCX, TXT или Markdown (до 512 КиБ каждый)")} <input type="file" multiple disabled={busy || !authority?.allowed || !onApply} accept=".pdf,.docx,.txt,.md" onChange={e => {
        const files = Array.from(e.currentTarget.files ?? []);
        e.currentTarget.value = "";
        if (files.length) void upload(files);
      }}/></label>
      {!authority?.allowed && <p>{t("Open an editable draft to attach a document.", "Для загрузки откройте редактируемый черновик.")}</p>}
    </div>}
    {destination === "team" && <p><a href={team.returning ? team.href : workspaceDestination("/library?view=cases", location)}>{team.returning ? t("Open the originating team case’s upload form", "Открыть форму загрузки в исходном командном деле") : t("Choose a team case for upload", "Выбрать командное дело для загрузки")}</a>{!team.returning && t(" → Documents & evidence → Add a document or version.", " → Документы и материалы → Добавить документ или версию.")}</p>}
    {destination === "firm" && <p><a href={workspaceDestination("/library?view=firm", location)}>{t("Open firm files and folders", "Открыть файлы и папки фирмы")}</a></p>}
    {destination === "templates" && <p><a href={workspaceDestination("/library?view=templates", location)}>{t("Create or use a document template", "Создать или использовать шаблон документа")}</a></p>}
    {message && <p role="alert">{message}</p>}
    {Boolean(draft.sourceFiles?.length) && <div><h4>{t("Files attached to this draft", "Файлы этого черновика")}</h4><ul>{draft.sourceFiles?.map((file, index) => <li key={index}><button type="button" disabled={!authority?.allowed} onClick={async () => {
      const ticket = context.current;
      try {
        const permitted = await authority?.verify();
        if (ticket !== context.current || !permitted?.()) return;
        const bytes = Uint8Array.from(atob(file.data), character => character.charCodeAt(0));
        startReportDownload(new Blob([bytes], {type:"application/octet-stream"}), file.name);
      } catch { if (ticket === context.current) report(t("Unable to download the file.", "Не удалось скачать файл.")); }
    }}>{t("Download", "Скачать")} {file.name}</button></li>)}</ul></div>}
  </section>;
}
