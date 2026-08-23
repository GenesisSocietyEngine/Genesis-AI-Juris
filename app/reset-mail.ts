import { env } from "cloudflare:workers";

type ResetMailConfig = { apiKey: string; from: string; origin: string };

export function canonicalHttpsOrigin(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) return null;
  try {
    const url = new URL(value.trim());
    if (url.protocol !== "https:" || url.username || url.password || url.pathname !== "/" || url.search || url.hash) return null;
    return url.origin;
  } catch {
    return null;
  }
}

export function passwordResetMailAvailable() {
  return getResetMailConfig() !== null;
}

export async function sendPasswordResetMail(values: { to: string; token: string; tokenHash: string }) {
  const config = getResetMailConfig();
  if (!config) return { ok: false as const, reason: "not_configured" as const };
  const resetUrl = `${config.origin}/account/reset#token=${encodeURIComponent(values.token)}`;
  return sendResendMessage(config, {
    to: values.to,
    subject: "Reset your GENESIS: JURIS password",
    text: `A password reset was requested for your GENESIS: JURIS account. Open this one-time link within 15 minutes:\n\n${resetUrl}\n\nIf you did not request this, ignore this message. Your password has not changed.`,
    html: `<p>A password reset was requested for your GENESIS: JURIS account.</p><p><a href="${escapeHtml(resetUrl)}">Reset password</a></p><p>This one-time link expires in 15 minutes. If you did not request it, ignore this message.</p>`,
    idempotencyKey: `gj-reset-${values.tokenHash}`,
  });
}

export async function sendPasswordChangedMail(values: { to: string; accountId: number; changedAt: string }) {
  const config = getResetMailConfig();
  if (!config) return { ok: false as const, reason: "not_configured" as const };
  return sendResendMessage(config, {
    to: values.to,
    subject: "Your GENESIS: JURIS password was changed",
    text: "Your GENESIS: JURIS password was changed and existing local sessions were revoked. If you did not make this change, use your trusted ChatGPT identity or contact the platform administrator.",
    html: "<p>Your GENESIS: JURIS password was changed and existing local sessions were revoked.</p><p>If you did not make this change, use your trusted ChatGPT identity or contact the platform administrator.</p>",
    idempotencyKey: `gj-password-changed-${values.accountId}-${values.changedAt.replace(/[^0-9]/g, "")}`,
  });
}

function getResetMailConfig(): ResetMailConfig | null {
  const bindings = env as unknown as { RESEND_API_KEY?: string; GENESIS_RESET_FROM_EMAIL?: string; GENESIS_PUBLIC_ORIGIN?: string };
  const apiKey = bindings.RESEND_API_KEY?.trim() ?? "";
  const from = bindings.GENESIS_RESET_FROM_EMAIL?.trim() ?? "";
  const origin = canonicalHttpsOrigin(bindings.GENESIS_PUBLIC_ORIGIN);
  if (!apiKey || apiKey.length > 300 || !from || from.length > 320 || /[\r\n]/.test(from) || !origin) return null;
  return { apiKey, from, origin };
}

async function sendResendMessage(config: ResetMailConfig, message: { to: string; subject: string; text: string; html: string; idempotencyKey: string }) {
  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        "Content-Type": "application/json",
        "Idempotency-Key": message.idempotencyKey,
        "User-Agent": "GENESIS-JURIS/15 password-security",
      },
      body: JSON.stringify({ from: config.from, to: [message.to], subject: message.subject, text: message.text, html: message.html }),
      signal: AbortSignal.timeout(8_000),
    });
    return response.ok ? { ok: true as const } : { ok: false as const, reason: "provider_rejected" as const };
  } catch {
    return { ok: false as const, reason: "provider_unavailable" as const };
  }
}

function escapeHtml(value: string) {
  return value.replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}
