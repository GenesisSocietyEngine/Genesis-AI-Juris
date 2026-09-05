import { env } from "cloudflare:workers";
import {
  dossierGovernedErrorResponse,
  downloadDossierSnapshotManifest,
} from "../../../../../../dossier-governed-output-server";
import {
  dossierNotFound,
  dossierJson,
  isResponse,
  requireDossierAccess,
  resolveDossierServerContext,
} from "../../../../../../dossier-server";
import { parseDossierOpaqueId } from "../../../../../../dossier-security";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ dossierId: string; snapshotId: string }> };

export async function GET(_request: Request, routeContext: RouteContext) {
  const context = await resolveDossierServerContext(_request);
  if (isResponse(context)) return context;
  const { dossierId, snapshotId: snapshotIdValue } = await routeContext.params;
  const access = await requireDossierAccess(context, dossierId, "download");
  if (isResponse(access)) return access;
  let snapshotId: string;
  try {
    snapshotId = parseDossierOpaqueId(snapshotIdValue, "snapshot ID");
  } catch {
    return dossierNotFound();
  }
  const bindings = env as unknown as { DOSSIER_DOCUMENTS?: R2Bucket };
  if (!bindings.DOSSIER_DOCUMENTS) {
    return dossierJson({ error: "Private Matter storage is unavailable.", code: "private_storage_unavailable" }, 503);
  }
  try {
    const response = await downloadDossierSnapshotManifest({
      context,
      bucket: bindings.DOSSIER_DOCUMENTS,
      dossierId: access.dossier.id,
      snapshotId,
    });
    const current = await requireDossierAccess(context, dossierId, "download");
    if (isResponse(current)) { await response.body?.cancel(); return current; }
    return response;
  } catch (error) {
    return dossierGovernedErrorResponse(error);
  }
}
