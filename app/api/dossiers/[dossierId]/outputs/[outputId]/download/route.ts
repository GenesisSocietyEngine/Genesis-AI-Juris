import { env } from "cloudflare:workers";
import {
  dossierGovernedErrorResponse,
  downloadDossierGovernedOutput,
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

type RouteContext = { params: Promise<{ dossierId: string; outputId: string }> };

export async function GET(_request: Request, routeContext: RouteContext) {
  const context = await resolveDossierServerContext();
  if (isResponse(context)) return context;
  const { dossierId, outputId: outputIdValue } = await routeContext.params;
  const access = await requireDossierAccess(context, dossierId, "download");
  if (isResponse(access)) return access;
  let outputId: string;
  try {
    outputId = parseDossierOpaqueId(outputIdValue, "output ID");
  } catch {
    return dossierNotFound();
  }
  const bindings = env as unknown as { DOSSIER_DOCUMENTS?: R2Bucket };
  if (!bindings.DOSSIER_DOCUMENTS) {
    return dossierJson({ error: "Private Matter storage is unavailable.", code: "private_storage_unavailable" }, 503);
  }
  try {
    return await downloadDossierGovernedOutput({
      context,
      bucket: bindings.DOSSIER_DOCUMENTS,
      dossierId: access.dossier.id,
      outputId,
    });
  } catch (error) {
    return dossierGovernedErrorResponse(error);
  }
}
