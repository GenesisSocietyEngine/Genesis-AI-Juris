/** The landing URL owns the initial reading order. An automatic catalogue selection
 * later adds a dossier to the URL but must not turn a register visit into a direct link. */
export function isDirectCaseEntry(location: string) {
  const params = new URL(location, "https://workspace.invalid").searchParams;
  return Boolean(params.get("dossier")?.trim()) && params.get("create") !== "case";
}

const wideQuery = "(min-width: 1200px)";
export function wideCaseLayout() { return window.matchMedia(wideQuery).matches; }
export function subscribeCaseLayout(update: () => void) {
  const media = window.matchMedia(wideQuery);
  media.addEventListener("change", update);
  return () => media.removeEventListener("change", update);
}
export const initialCaseLayout = () => false;
