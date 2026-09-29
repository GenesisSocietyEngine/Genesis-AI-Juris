import { STUDIO_PROMPT_CHARACTER_LIMIT } from "./studio-prompt-limit";

export function studioImportFileKind(file: Pick<File, "name" | "type">): "case" | "prompt" | null {
  const name = file.name.toLowerCase();
  if (name.endsWith(".json")) return "case";
  if (name.endsWith(".md") || name.endsWith(".txt")) return "prompt";
  if (file.type === "application/json") return "case";
  if (file.type === "text/markdown" || file.type === "text/plain") return "prompt";
  return null;
}

/** Read fully before replacing the editor's current prompt. */
export async function readStudioPromptFile(file: Pick<File, "size" | "text">): Promise<string> {
  if (file.size > STUDIO_PROMPT_CHARACTER_LIMIT * 2) throw new Error("prompt_file_too_large");
  const value = await file.text();
  if (value.length > STUDIO_PROMPT_CHARACTER_LIMIT) throw new Error("prompt_text_too_long");
  if (!value.trim()) throw new Error("prompt_file_empty");
  return value;
}

export function studioPromptFileError(error: unknown, locale: "en" | "ru"): string {
  const code = error instanceof Error ? error.message : "";
  if (code === "prompt_file_too_large" || code === "prompt_text_too_long") return locale === "en"
    ? "The prompt file is too large. Use up to 64,000 characters. Your current work is unchanged."
    : "Файл промпта слишком велик. Лимит — 64 000 символов. Текущая работа не изменена.";
  if (code === "prompt_file_empty") return locale === "en"
    ? "The prompt file is empty. Choose a Markdown or text file containing your case description."
    : "Файл промпта пуст. Выберите Markdown или текстовый файл с описанием кейса.";
  return locale === "en"
    ? "The prompt file could not be read. Download it again and retry. Your current work is unchanged."
    : "Не удалось прочитать файл промпта. Скачайте его заново и повторите. Текущая работа не изменена.";
}
