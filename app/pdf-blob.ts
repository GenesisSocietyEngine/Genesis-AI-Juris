import type { TDocumentDefinitions } from "pdfmake/interfaces";
import type { TCreatedPdf } from "pdfmake/build/pdfmake";

/** Embedded fonts/images need no URL resolver. The callback getBlob API hides
 * layout failures in an unreturned promise; the public stream API exposes both
 * synchronous creation failures and stream errors to the caller's catch. */
export function pdfBlobFromDocument(document: Pick<TCreatedPdf, "getStream">): Promise<Blob> {
 return new Promise((resolve, reject) => {
  try {
   const stream=document.getStream();
   const parts:ArrayBuffer[]=[]; let ended=false;
   stream.on("data", (chunk: Uint8Array) => { parts.push(new Uint8Array(chunk).buffer); });
   stream.on("error", reject);
   stream.on("end", () => {ended=true;resolve(new Blob(parts,{type:"application/pdf"}));});
   stream.on("close",()=>{if(!ended)reject(new Error("PDF stream closed before completion"));});
   stream.end();
  } catch(error) { reject(error); }
 });
}
export type PdfDefinition = TDocumentDefinitions;
