import { env } from "cloudflare:workers";
import { dossierGovernedErrorResponse, downloadDossierGovernedOutput, renderCanopyPresentationExtract, type DossierReportModelV1 } from "../../../../../../dossier-governed-output-server";
import { dossierJson, dossierNotFound, isResponse, requireDossierAccess, resolveDossierServerContext } from "../../../../../../dossier-server";
import { parseDossierOpaqueId } from "../../../../../../dossier-security";

export const dynamic = "force-dynamic";
export async function GET(request:Request,routeContext:{params:Promise<{dossierId:string;outputId:string}>}) {
 const context=await resolveDossierServerContext(request);if(isResponse(context))return context;
 const {dossierId,outputId:rawOutputId}=await routeContext.params;
 const access=await requireDossierAccess(context,dossierId,"download");if(isResponse(access))return access;
 let outputId:string;try{outputId=parseDossierOpaqueId(rawOutputId,"output ID");}catch{return dossierNotFound();}
 const bucket=(env as unknown as {DOSSIER_DOCUMENTS?:R2Bucket}).DOSSIER_DOCUMENTS;
 if(!bucket)return dossierJson({error:"Private Matter storage is unavailable."},503);
 try{
  const source=await downloadDossierGovernedOutput({context,bucket,dossierId:access.dossier.id,outputId});
  const afterRead=await requireDossierAccess(context,dossierId,"download");if(isResponse(afterRead)){await source.body?.cancel();return afterRead;}
  if(!source.ok)return source;
  if(!source.headers.get("content-type")?.includes("application/json")){await source.body?.cancel();return dossierJson({error:"Select the exact governed JSON output for this presentation extract."},400);}
  const model=await source.json() as DossierReportModelV1;
  const bytes=await renderCanopyPresentationExtract(model);
  const hash=Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",new Uint8Array(bytes))),b=>b.toString(16).padStart(2,"0")).join("");
  const current=await requireDossierAccess(context,dossierId,"download");if(isResponse(current))return current;
  return new Response(bytes as BodyInit,{headers:{"content-type":"application/pdf","content-disposition":`attachment; filename="${model.snapshot.snapshot_id}-presentation-not-approved.pdf"`,"cache-control":"no-store","x-content-type-options":"nosniff","x-genesis-presentation-sha256":hash,"x-genesis-presentation-approval":"none","x-genesis-source-output":outputId}});
 }catch(error){return dossierGovernedErrorResponse(error);}
}
