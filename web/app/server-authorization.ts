import { env } from "cloudflare:workers";

export function isPlatformAdmin(email: string) {
  const bindings = env as unknown as { GENESIS_ADMIN_EMAILS?: string };
  const configured = typeof bindings.GENESIS_ADMIN_EMAILS === "string"
    ? bindings.GENESIS_ADMIN_EMAILS.split(",").map((item: string) => item.trim().toLowerCase()).filter(Boolean)
    : [];
  return configured.includes(email.trim().toLowerCase());
}
