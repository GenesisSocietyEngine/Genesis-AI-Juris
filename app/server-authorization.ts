import { env } from "cloudflare:workers";
import type { ChatGPTUser } from "./chatgpt-auth";

export function isPlatformAdmin(identity: Pick<ChatGPTUser, "email" | "authSource">) {
  if (identity.authSource !== "chatgpt") return false;
  const bindings = env as unknown as { GENESIS_ADMIN_EMAILS?: string };
  const configured = typeof bindings.GENESIS_ADMIN_EMAILS === "string"
    ? bindings.GENESIS_ADMIN_EMAILS.split(",").map((item: string) => item.trim().toLowerCase()).filter(Boolean)
    : [];
  return configured.includes(identity.email.trim().toLowerCase());
}
