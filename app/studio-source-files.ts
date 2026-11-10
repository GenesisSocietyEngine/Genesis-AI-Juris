import type { StudioDraft } from "./types";
import { STUDIO_DRAFT_SERIALIZED_LIMIT, studioJsonBytes } from "./studio-envelope";
import { observeMediaType } from "./dossier-private-upload";

export type StudioSourceFile = { name: string; data: string };
export const MAX_SOURCE_BYTES = 512 * 1024;
const supportedName = /\.(pdf|docx|md|txt)$/i;

export function sourceFiles(value: unknown): StudioSourceFile[] | undefined {
  if (value === undefined) return undefined;
  if (!Array.isArray(value) || value.length > 64) throw new Error("Invalid Studio source files");
  return value.map(file => {
    if (!file || typeof file.name !== "string" || file.name.length > 200 || !supportedName.test(file.name) ||
        /[\\/\x00-\x1f]/.test(file.name) || typeof file.data !== "string" || !file.data.length ||
        file.data.length > 4 * Math.ceil(MAX_SOURCE_BYTES / 3) || file.data.length % 4 ||
        !/^[A-Za-z0-9+/]+={0,2}$/.test(file.data)) {
      throw new Error("Invalid Studio source file");
    }
    const bytes = Uint8Array.from(atob(file.data), character => character.charCodeAt(0));
    if (bytes.length > MAX_SOURCE_BYTES) throw new Error("Studio source file exceeds size limit");
    const mediaType = observeMediaType(file.name, bytes);
    if (mediaType.startsWith("text/")) new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    return { name: file.name, data: file.data };
  });
}

export function attachStudioSource(draft: StudioDraft, file: StudioSourceFile) {
  const next = { ...draft, sourceFiles: sourceFiles([...(draft.sourceFiles ?? []), file]) };
  if (studioJsonBytes(next) > STUDIO_DRAFT_SERIALIZED_LIMIT) throw new Error("Studio draft size limit exceeded");
  return next;
}
