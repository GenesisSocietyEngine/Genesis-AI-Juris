export function studioReplacementMessage(locale: "en" | "ru", destination: string, retention: boolean) {
  const name = destination.trim() || (locale === "en" ? "a blank draft" : "пустой черновик");
  return locale === "en"
    ? `Open ${name}? Your current graph, prompt, undo history and unadded form items will be replaced. ${retention ? "Eligible local drafts and their prompt will be kept in Earlier device drafts before device-only saves are removed. Undo history and unadded form items are not archived." : "This work cannot be archived on this device. Save it to the workspace before switching."} Workspace saves are unchanged. Cancel to keep editing.`
    : `Открыть «${name}»? Текущий граф, промпт, история отмены и недобавленные элементы формы будут заменены. ${retention ? "Допустимые локальные черновики и их промпт будут сохранены в разделе «Предыдущие черновики устройства» до удаления активных копий устройства. История отмены и недобавленные элементы формы не архивируются." : "Эта работа не может быть архивирована на устройстве. Сохраните её в workspace перед переключением."} Сохранённые кейсы workspace не изменятся. Отмените действие, чтобы продолжить редактирование.`;
}
