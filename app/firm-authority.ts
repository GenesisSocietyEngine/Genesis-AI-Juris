import { dossierJson, revalidateDossierIdentity, type DossierServerContext } from "./dossier-server";
import { assertOrganizationCurrent } from "./organization-store";

export async function firmAuthority(c: DossierServerContext) {
  const denied = await revalidateDossierIdentity(c);
  if (denied) return denied;
  try {
    await assertOrganizationCurrent(c.db, c.actor, c.organization!);
    return null;
  } catch {
    return dossierJson({ error: "Organization access changed." }, 404);
  }
}
export async function firmReply(c: DossierServerContext, body: unknown, status = 200) {
  return (await firmAuthority(c)) ?? dossierJson(body, status);
}
