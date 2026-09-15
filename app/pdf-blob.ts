import type { TDocumentDefinitions } from "pdfmake/interfaces";
import type { TCreatedPdf } from "pdfmake/build/pdfmake";

/** Embedded fonts/images need no URL resolver. The callback getBlob API hides
 * layout failures in an unreturned promise; the public stream API exposes both
 * synchronous creation failures and stream errors to the caller's catch. */
export function pdfBlobFromDocument(document: Pick<TCreatedPdf, "getStream">): Promise<Blob> {
  return new Promise((resolve, reject) => {
    let settled = false;
    const parts: ArrayBuffer[] = [];
    const fail = (error: unknown) => {
      if (settled) return;
      settled = true;
      parts.length = 0;
      reject(error);
    };
    try {
      const stream = document.getStream();
      stream.on("data", (chunk: Uint8Array) => {
        if (settled) return;
        try { parts.push(new Uint8Array(chunk).buffer); }
        catch (error) { fail(error); }
      });
      stream.on("error", fail);
      stream.on("end", () => {
        if (settled) return;
        try {
          const blob = new Blob(parts, { type: "application/pdf" });
          settled = true;
          parts.length = 0;
          resolve(blob);
        } catch (error) { fail(error); }
      });
      stream.on("close", () => {
        if (!settled) fail(new Error("PDF stream closed before completion"));
      });
      stream.end();
    } catch (error) { fail(error); }
  });
}
export type PdfDefinition = TDocumentDefinitions;
