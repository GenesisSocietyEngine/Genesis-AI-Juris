"use client";

export default function ActionTile({ title, detail, status, next = "Open", onClick, id, disabled = false }: {
  title: string; detail: string; status?: string; next?: string; onClick: () => void; id?: string; disabled?: boolean;
}) {
  return <button type="button" id={id} className="action-tile" onClick={onClick} disabled={disabled}>
    <span className="action-tile-copy"><strong>{title}</strong><span>{detail}</span>{status && <small>{status}</small>}</span>
    <span className="action-tile-next">{next}<span aria-hidden="true"> →</span></span>
  </button>;
}

export function focusActionTarget(id: string) {
  const element = document.getElementById(id);
  if (!element) return false;
  for (let parent: HTMLElement | null = element; parent; parent = parent.parentElement) {
    if (parent instanceof HTMLDetailsElement) parent.open = true;
  }
  document.querySelectorAll("[data-action-target]").forEach(item => item.removeAttribute("data-action-target"));
  element.setAttribute("data-action-target", "true");
  element.scrollIntoView({ block: "center", behavior: "auto" });
  const control = element.matches("input,textarea,select,button,a") ? element : element.querySelector<HTMLElement>("input:not([type=hidden]):not(:disabled),textarea:not(:disabled),select:not(:disabled),button:not(:disabled),a,summary");
  if (!control) element.tabIndex = -1;
  (control ?? element).focus({ preventScroll: true });
  return true;
}
