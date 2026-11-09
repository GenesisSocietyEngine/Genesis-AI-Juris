import { providerRequest } from "./provider-request";
import { and, eq, sql } from "drizzle-orm";
import { calendarReminders as table } from "../../db/schema";
import type { DossierDb } from "../dossier-server";
import { grant, openItem } from "./store";
import { sha } from "./ical";
type Config = {
  RESEND_API_KEY?: string;
  GENESIS_INVITATION_FROM_EMAIL?: string;
  GENESIS_PUBLIC_ORIGIN?: string;
};
export const configured = (c: Config) =>
  !!(
    c.RESEND_API_KEY?.trim() &&
    c.GENESIS_INVITATION_FROM_EMAIL?.trim() &&
    !/[\r\n]/.test(c.GENESIS_INVITATION_FROM_EMAIL) &&
    c.GENESIS_PUBLIC_ORIGIN &&
    /^https:\/\/[a-z0-9.-]+\/?$/i.test(c.GENESIS_PUBLIC_ORIGIN)
  );
export async function dispatch(
  db: DossierDb,
  c: Config,
  transport: typeof fetch = fetch,
  now = Date.now(),
  dry = false,
) {
  const iso = (n: number) => new Date(n).toISOString(),
    at = iso(now),
    counts = {
      due: 0,
      accepted: 0,
      delivered: 0,
      failed: 0,
      retry: 0,
      unknown: 0,
      cancelled: 0,
      configured: configured(c),
    };
  const queue = await db
    .select()
    .from(table)
    .where(sql`channel='email' AND state IN ('pending','accepted') AND available_at<=${at}`)
    .orderBy(table.availableAt)
    .limit(20);
  counts.due = queue.length;
  if (dry) return counts;
  for (const r of queue) {
    const key = crypto.randomUUID(),
      claim = await db
        .update(table)
        .set({ lease: key, availableAt: iso(now + 5 * 60000) })
        .where(and(eq(table.id, r.id), eq(table.state, r.state), sql`available_at<=${at}`))
        .returning({ id: table.id });
    if (!claim.length) continue;
    const leased = and(eq(table.id, r.id), eq(table.lease, key)),
      finish = async (state: string, delay = 0, providerId = r.providerId) => {
        await db
          .update(table)
          .set({ state, providerId, lease: null, availableAt: iso(now + delay) })
          .where(leased);
      };
    const expire = r.firstAttempt && now - Date.parse(r.firstAttempt) > 23 * 3600000;
    if (r.state === "pending" && expire) {
      await finish("unknown");
      counts.unknown++;
      continue;
    }
    if (r.state === "accepted" && r.firstAttempt && now - Date.parse(r.firstAttempt) > 3 * 86400000) {
      await finish("unconfirmed");
      counts.unknown++;
      continue;
    }
    const eligibility = sql`${grant(r.organizationId, r.scope, r.sender, true)} AND ${grant(r.organizationId, r.scope, r.recipient)} AND ${openItem(r.organizationId, r.scope, r.item)}`;
    const current = await db.get<{ email: string; orgVersion: number; memberVersion: number }>(
      sql`SELECT u.email,o.revision orgVersion,m.revision memberVersion FROM users u JOIN organization_memberships m ON m.user_id=u.id JOIN organizations o ON o.id=m.organization_id,calendar_reminders cr WHERE o.id=cr.organization_id AND cr.id=${r.id} AND cr.lease=${key} AND u.actor_id=cr.recipient AND ${eligibility}`,
    );
    if (!current || (r.dismissed && r.state === "pending")) {
      await finish(r.state === "accepted" ? "unconfirmed" : "cancelled");
      counts.cancelled++;
      continue;
    }
    if (!configured(c)) {
      await finish(r.state === "accepted" ? "accepted" : "failed", 3600000);
      counts.failed++;
      continue;
    }
    const requestHeaders = {
      Authorization: "Bearer " + c.RESEND_API_KEY!,
      "Content-Type": "application/json",
    };
    const retry = async () => {
      await finish(r.state, Math.min(60, 2 ** Math.min(6, r.attempts + 1)) * 60000);
      counts.retry++;
    };
    try {
      if (r.state === "accepted") {
        if (!r.providerId) {
          await finish("unconfirmed");
          counts.unknown++;
          continue;
        }
        const resp = await providerRequest(
          transport,
          "https://api.resend.com/emails/" + encodeURIComponent(r.providerId),
          {
            headers: requestHeaders,
          },
          7000,
        );
        if (!resp.ok) {
          await retry();
          continue;
        }
        const body = (await resp.json()) as { last_event?: string };
        if (["delivered", "opened", "clicked"].includes(body.last_event ?? "")) {
          await finish("delivered");
          counts.delivered++;
        } else if (
          ["bounced", "failed", "suppressed", "canceled", "complained"].includes(body.last_event ?? "")
        ) {
          await finish("failed");
          counts.failed++;
        } else {
          await finish("accepted", 30 * 60000);
        }
        continue;
      }
      const origin = c.GENESIS_PUBLIC_ORIGIN!.replace(/\/$/, ""),
        url = new URL("/work", origin);
      url.searchParams.set("view", "reminders");
      const selection = [r.organizationId, current.orgVersion, current.memberVersion, r.recipient].join(".");
      url.searchParams.set("organization", selection);
      if (r.scope !== "firm")
        url.searchParams.set(
          "return_to",
          "/matters?collection=team&organization=" +
            encodeURIComponent(selection) +
            "&dossier=" +
            encodeURIComponent(r.scope) +
            "&section=calendar",
        );
      const payload = JSON.stringify({
        from: c.GENESIS_INVITATION_FROM_EMAIL,
        to: [current.email],
        subject: "CaseVant reminder",
        text: "You have a reminder in CaseVant. Sign in to view it:\n" + url.href,
      });
      const fingerprint = await sha(payload);
      if (r.destinationHash && r.destinationHash !== fingerprint) {
        await finish("unknown");
        counts.unknown++;
        continue;
      }
      const mark = await db
        .update(table)
        .set({ firstAttempt: r.firstAttempt ?? at, destinationHash: fingerprint, attempts: r.attempts + 1 })
        .where(
          and(
            leased,
            eq(table.dismissed, 0),
            eligibility,
            sql`EXISTS(SELECT 1 FROM users WHERE actor_id=${r.recipient} AND email=${current.email})`,
          ),
        )
        .returning({ id: table.id });
      if (!mark.length) {
        await finish("cancelled");
        counts.cancelled++;
        continue;
      }
      const resp = await providerRequest(
        transport,
        "https://api.resend.com/emails",
        {
          method: "POST",
          headers: { ...requestHeaders, "Idempotency-Key": "casevant-reminder-" + r.id },
          body: payload,
        },
        7000,
      );
      if (resp.ok) {
        const data = (await resp.json()) as { id?: string };
        if (typeof data.id === "string" && /^[\w-]{1,100}$/.test(data.id)) {
          await finish("accepted", 5 * 60000, data.id);
          counts.accepted++;
        } else await retry();
      } else if ([408, 409, 425, 429].includes(resp.status) || resp.status >= 500) await retry();
      else {
        await finish("failed");
        counts.failed++;
      }
    } catch {
      await retry();
    }
  }
  return counts;
}
