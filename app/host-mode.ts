export const FALCON_STUDIO_HOST = "studio.falcon-merlin.com";

export function isFalconStudioHost(host: string | null | undefined): boolean {
  if (!host) return false;
  const firstForwardedHost = host.split(",", 1)[0]?.trim().toLowerCase();
  const hostname = firstForwardedHost?.replace(/:\d+$/, "");
  return hostname === FALCON_STUDIO_HOST;
}
