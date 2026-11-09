import { protect, staffSession } from "../../../portal/authority";
import { command } from "../../../portal/commands";
import { portalView } from "../../../portal/store";
export const dynamic = "force-dynamic";
export const GET = (r: Request) =>
  protect(async () => {
    const w = await staffSession(r);
    return w instanceof Response ? w : portalView(w, r);
  });
export const POST = (r: Request) =>
  protect(async () => {
    const w = await staffSession(r);
    return w instanceof Response ? w : command(w, r);
  });
