import { LibraryController } from "../../app/library/library-controller";
import type { NavigationController } from "../../app/navigation-controller";
import type { FirmDocument } from "../../app/library/firm-document-model";

/** In-memory transport exclusively for the synthetic browser preview. */
export function libraryPreview(navigation: NavigationController, scope: string) {
  const id = "firm_doc_" + "a".repeat(64),
    folders = new Set(["Policies", "Team / Forms"]),
    receipts = new Map<string, unknown>();
  const base = {
    id,
    title: "Team review guide · synthetic",
    version: 2,
    folder: "Policies",
    filename: "review-guide.txt",
    mediaType: "text/plain",
    bytes: 24,
    occurredAt: "2026-11-07T08:00:00.000Z",
  };
  const versions: FirmDocument[] = [base, { ...base, version: 1, occurredAt: "2026-11-06T08:00:00.000Z" }];
  let lose = false;
  const controller = new LibraryController(navigation, async (path, init) => {
    const query = new URL(path, "https://preview.invalid").searchParams;
    if (init?.method === "POST") {
      const body = init.body as FormData,
        key = String(body.get("operationKey"));
      let receipt = receipts.get(key);
      if (!receipt) {
        if (body.get("action") === "folder") {
          const folder = String(body.get("folder")).trim();
          folders.add(folder);
          receipt = { operation: key, folder };
        } else {
          const file = body.get("file") as File,
            doc = {
              id: String(body.get("id") || "firm_doc_" + "b".repeat(64)),
              version: Number(body.get("expectedVersion")) + 1,
              title: String(body.get("title")),
              folder: String(body.get("folder")),
              filename: file.name,
              mediaType: String(body.get("mediaType")),
              bytes: file.size,
              occurredAt: new Date().toISOString(),
            };
          versions.unshift(doc);
          receipt = { operation: key, document: doc };
        }
        receipts.set(key, receipt);
      }
      if (lose) {
        lose = false;
        throw Error("Response lost");
      }
      return Response.json(receipt);
    }
    if (query.has("operation")) {
      const key = query.get("operation")!,
        record = receipts.get(key);
      return Response.json({
        scope,
        operation: key,
        state: record ? "committed" : "not_started",
        ...(record ?? {}),
      });
    }
    if (query.get("download")) return new Response("Synthetic file contents.");
    if (query.has("id"))
      return Response.json({
        scope,
        documents: versions.filter((v) => v.id === query.get("id")),
        nextVersion: null,
      });
    return Response.json({
      scope,
      documents: versions.filter((v, i) => versions.findIndex((other) => other.id === v.id) === i),
      folders: [...folders],
      incomplete: [],
      nextCursor: null,
      canWrite: true,
    });
  });
  return {
    controller,
    loseNext() {
      lose = true;
    },
  };
}
