export type FirmDocument = {
  id: string;
  version: number;
  title: string;
  folder: string;
  filename: string;
  mediaType: string;
  bytes: number;
  occurredAt: string;
};
export type IncompleteFirmUpload = {
  key: string;
  id: string | null;
  expectedVersion: number;
  title: string;
  folder: string;
  filename: string;
};
export function firmFolder(value: unknown) {
  if (
    typeof value !== "string" ||
    value.length > 200 ||
    /[\u0000-\u001f\\]/.test(value) ||
    value.split("/").some((p) => p.trim() === "." || p.trim() === "..")
  )
    throw Error("Use a folder name of up to 200 characters, without dot segments.");
  return value
    .split("/")
    .map((s) => s.trim())
    .filter(Boolean)
    .join("/");
}
export function firmDocumentFields(value: Record<string, unknown>) {
  if (typeof value.title !== "string" || !value.title.trim() || value.title.length > 240)
    throw Error("Enter a document title of up to 240 characters.");
  const folder = firmFolder(value.folder);
  const version = Number(value.expectedVersion);
  if (!Number.isSafeInteger(version) || version < 0) throw Error("Invalid document version.");
  if (typeof value.operationKey !== "string" || !/^[\w-]{8,120}$/.test(value.operationKey))
    throw Error("Invalid upload operation.");
  if (
    value.id !== undefined &&
    value.id !== "" &&
    (typeof value.id !== "string" || !/^firm_doc_[a-f0-9]{64}$/.test(value.id))
  )
    throw Error("Invalid document.");
  if (value.id ? version === 0 : version !== 0)
    throw Error("Refresh the document before uploading a version.");
  return {
    title: value.title.trim(),
    folder,
    expectedVersion: version,
    operationKey: value.operationKey,
    id: value.id ? String(value.id) : null,
  };
}
export function firmObjectKey(organization: string, id: string, version: number, digest: string) {
  if (
    !/^[\w-]+$/.test(organization) ||
    !/^firm_doc_[a-f0-9]{64}$/.test(id) ||
    !Number.isSafeInteger(version) ||
    version < 1 ||
    !/^[a-f0-9]{64}$/.test(digest)
  )
    throw Error("Invalid storage identity.");
  return `firm/${organization}/${id}/${version}/${digest}`;
}
