"use client";
import { createContext, useContext, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import type { WorkspaceController } from "./workspace-controller";
const DraftOwner = createContext<WorkspaceController | null>(null);
export function useWorkspaceDraft(key: string, initial: string) {
  const owner = useContext(DraftOwner);
  const [value, setValue] = useState(() => { const saved = owner?.draft(key); return typeof saved === "string" ? saved : initial; });
  return [value, (next: string) => { owner?.rememberDraft(key, next, initial); setValue(next); }] as const;
}
/** Private drafts remain only in the visit owner, outside the gated DOM. File
 * inputs require reselection; controlled exact request selection stays in the URL. */
export default function WorkspaceDrafts({ owner, scope, children }: { owner: WorkspaceController; scope: string; children: ReactNode }) {
  const root = useRef<HTMLDivElement>(null);
  const fieldKey = (field: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement) => {
    if (field.closest("[data-own-drafts]") || !field.name || !field.form || field.name === "requestId" || field instanceof HTMLInputElement && ["file", "hidden", "password"].includes(field.type)) return null;
    const form = field.form;
    const formKey = form.id || `${form.closest("[id]")?.id ?? "case"}:${Array.from(root.current?.querySelectorAll("form") ?? []).indexOf(form)}`;
    return `${scope}:${formKey}:${field.name}`;
  };
  useLayoutEffect(() => {
    root.current?.querySelectorAll("input[name], textarea[name], select[name]").forEach(field => {
      if (!(field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement || field instanceof HTMLSelectElement)) return;
      const key = fieldKey(field), value = key && owner.draft(key);
      if (typeof value === "boolean" && field instanceof HTMLInputElement) field.checked = value;
      else if (typeof value === "string") {
        if (field instanceof HTMLSelectElement && field.multiple) { const values: string[] = JSON.parse(value); Array.from(field.options).forEach(option => { option.selected = values.includes(option.value); }); }
        else field.value = value;
      }
    });
  // Restore only when this private section is mounted, not after user input.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [owner, scope]);
  return <DraftOwner.Provider value={owner}><div ref={root} style={{ display: "contents" }} onChangeCapture={event => {
    const field = event.target;
    if (!(field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement || field instanceof HTMLSelectElement)) return;
    const key = fieldKey(field); if (!key) return;
    const check = field instanceof HTMLInputElement && ["checkbox", "radio"].includes(field.type);
    const multiple = field instanceof HTMLSelectElement && field.multiple;
    const initial = check ? field.defaultChecked : field instanceof HTMLSelectElement ? (multiple ? JSON.stringify(Array.from(field.options).filter(o=>o.defaultSelected).map(o=>o.value)) : Array.from(field.options).find(o=>o.defaultSelected)?.value ?? field.options[0]?.value ?? "") : field.defaultValue;
    owner.rememberDraft(key, check ? field.checked : multiple ? JSON.stringify(Array.from(field.selectedOptions, option => option.value)) : field.value, initial);
  }}>{children}</div></DraftOwner.Provider>;
}
