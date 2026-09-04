import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const catalogue = readFileSync(
  new URL("../app/api/dossiers/[dossierId]/documents/route.ts", import.meta.url),
  "utf8",
);
const catalogueGet = catalogue.slice(
  catalogue.indexOf("export async function GET"),
  catalogue.indexOf("export async function POST"),
);
const catalogueResponse = catalogueGet.slice(catalogueGet.indexOf("return dossierJson"));
const download = readFileSync(
  new URL(
    "../app/api/dossiers/[dossierId]/documents/[documentId]/versions/[versionId]/download/route.ts",
    import.meta.url,
  ),
  "utf8",
);

test("document catalogue is participant-scoped, bounded and metadata-only", () => {
  assert.match(catalogue, /requireDossierAccess\(context, dossierId, "read"\)/u);
  assert.match(catalogue, /MAX_DOCUMENTS = 100/u);
  assert.match(catalogue, /MAX_VERSIONS = 1_000/u);
  assert.match(catalogue, /MAX_EXTRACTION_ATTEMPTS = 10_000/u);
  assert.match(catalogue, /dossierDocumentCurrentVersions/u);
  assert.match(catalogue, /dossierExtractionJobs/u);
  assert.match(catalogue, /eq\(dossierDocuments\.isProvisional, false\)/u);
  assert.doesNotMatch(
    catalogueResponse,
    /binaryObjectReference|extractedText|DOSSIER_DOCUMENTS/u,
  );
});

test("catalogue separates immutable versions and exposes only server download routes", () => {
  assert.match(catalogue, /current_version_id/u);
  assert.match(catalogue, /predecessor_version_id/u);
  assert.match(catalogue, /content_sha256/u);
  assert.match(catalogue, /extraction_status/u);
  assert.match(catalogue, /documentDownloadUrl/u);
  assert.match(catalogue, /"\/download"/u);
  assert.doesNotMatch(catalogueGet, /https?:\/\//u);
});

test("download authorization and D1 lookup precede every private R2 read", () => {
  assert.match(download, /requireDossierAccess\(context, routeIds\.dossierId, "download"\)/u);
  assert.match(download, /dossierDocumentVersions\.dossierId, access\.dossier\.id/u);
  assert.match(download, /dossierDocumentVersions\.documentId, documentId/u);
  assert.match(download, /dossierDocumentVersions\.id, versionId/u);
  assert.match(download, /assertDossierObjectKeyScope/u);
  assert.match(download, /bindings\.DOSSIER_DOCUMENTS\.get\(record\.binaryObjectReference\)/u);
  assert.ok(download.indexOf("requireDossierAccess") < download.indexOf("DOSSIER_DOCUMENTS.get"));
});

test("download verifies stored length, media, custom hash and R2 checksum without key disclosure", () => {
  assert.match(download, /object\.size !== record\.byteLength/u);
  assert.match(download, /object\.httpMetadata\?\.contentType !== record\.mediaType/u);
  assert.match(download, /object\.customMetadata\?\.contentSha256 !== record\.contentSha256/u);
  assert.match(download, /object\.checksums\.sha256/u);
  assert.match(download, /decideDossierDownload/u);
  assert.match(download, /Content-Security-Policy/u);
  assert.match(download, /dossierNotFound/u);
  assert.doesNotMatch(download, /publicUrl|signedUrl|createPresigned|\.list\(/u);
});
