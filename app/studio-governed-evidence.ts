import { safeWorkspaceReturn, workspaceDestination } from "./workspace-navigation";

/** Navigation provenance only: a return URL never creates a Studio–Matter association. */
export function studioGovernedEvidenceDestination(location: string) {
  const origin = "https://workspace.invalid";
  const source = new URL(safeWorkspaceReturn(location), origin);
  const previous = new URL(safeWorkspaceReturn(source.searchParams.get("return_to"), "/"), origin);
  const target = new URL(workspaceDestination("/matters?collection=team", source.pathname + source.search), origin);
  // Generic workspace navigation also preserves Canopy context. Evidence must
  // return only to the explicit originating Matter, never an inferred match.
  target.searchParams.delete("dossier");
  const dossier = previous.pathname === "/matters" ? previous.searchParams.get("dossier") : null;
  const sameOrganization = (target.searchParams.get("organization") ?? "") === (previous.searchParams.get("organization") ?? "");
  const returning = Boolean(dossier && dossier.length <= 2048 && sameOrganization);
  if (returning) {
    target.searchParams.set("dossier", dossier!);
    target.searchParams.set("section", "evidence");
  }
  return { href: target.pathname + target.search, returning };
}
