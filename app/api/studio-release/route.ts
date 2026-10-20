import { studioRelease } from "../../studio-release";

export function GET() {
  const release = studioRelease();
  return Response.json(release ?? { unavailable: true }, { status: release ? 200 : 503, headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } });
}
