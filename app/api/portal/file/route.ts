import { clientSession, protect, staffSession } from "../../../portal/authority";
import { download, receive } from "../../../portal/files";
export const dynamic = "force-dynamic";
export const GET = (r: Request) =>
  protect(async () => {
    const w =
      new URL(r.url).searchParams.get("mode") === "staff" ? await staffSession(r) : await clientSession();
    return w instanceof Response ? w : download(w, r);
  });
export const POST = (r: Request) =>
  protect(async () => {
    const w = await clientSession();
    return w instanceof Response ? w : receive(w, r);
  });
