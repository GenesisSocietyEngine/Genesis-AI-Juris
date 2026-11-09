/** Classify unfinished forms without putting addresses, filenames or message text in navigation state. */
const forms = {
  email: "portal_invitation", label: "portal_invitation", reply: "portal_reply", upload: "portal_upload",
} as const;
export type PortalField = keyof typeof forms;
export type PortalChange = typeof forms[PortalField];
const fields: readonly PortalField[] = ["email", "label", "reply", "upload"];

export function editPortalField(history: readonly PortalField[], field: PortalField): PortalField[] {
  return [field, ...history.filter(item => item !== field)];
}
export function portalDraftReview(dirty: Record<PortalField, boolean>, history: readonly PortalField[]): { field: PortalField | null; changes: PortalChange[] } {
  const remaining = [...new Set([...history, ...fields])].filter(field => dirty[field]);
  return { field: remaining[0] ?? null, changes: [...new Set(remaining.map(field => forms[field]))] };
}

export const portalWarning = {
  en: { title: "Leave unsent portal work?", detail: "Review it before leaving, or discard the items listed here.", review: "Review unsent work" },
  ru: { title: "Выйти из портала без отправки?", detail: "Проверьте перечисленные черновики перед выходом или отмените изменения.", review: "Проверить перед выходом" },
} as const;
