import { and, eq, sql } from "drizzle-orm";
import {
  calendarFeeds as feeds,
  calendarReminders as reminders,
  organizationCasGuards as guards,
} from "../../../db/schema";
import {
  dossierJson as json,
  finalizeDossierRead,
  isResponse,
  requireDossierAccess,
  resolveDossierServerContext,
  type DossierAccess,
  type DossierServerContext,
} from "../../dossier-server";
import { firmReply } from "../../firm-authority";
import { canonicalDossierJson } from "../../dossier-contract";
import { available, feedToken, grant, latest, members, openItem } from "../../calendar/store";
import { sha } from "../../calendar/ical";
import { readMoment } from "../../matters/practice-scheduling";
import { readJsonObject, isSameOriginMutation } from "../../request-security";
export const dynamic = "force-dynamic";
type Session = {
  c: DossierServerContext;
  scope: string;
  org: string;
  who: string;
  access: DossierAccess | null;
  canWrite: boolean;
};
async function session(req: Request): Promise<Session | Response> {
  const c = await resolveDossierServerContext(req);
  if (isResponse(c)) return c;
  const scope = new URL(req.url).searchParams.get("scope");
  if (!scope) return json({ error: "Choose a calendar." }, 400);
  const access = scope === "firm" ? null : await requireDossierAccess(c, scope, "read");
  if (isResponse(access)) return access;
  return {
    c,
    scope,
    org: c.organization!.id,
    who: c.actor.actorId,
    access,
    canWrite:
      c.organization!.role !== "auditor" &&
      (!access || (["owner", "contributor"].includes(access.role) && available(access.dossier.status))),
  };
}
const reply = (s: Session, data: unknown, code = 200) =>
  s.access ? finalizeDossierRead(s.c, s.access, json(data, code)) : firmReply(s.c, data, code);
const owned = (s: Session) =>
  and(eq(feeds.organizationId, s.org), eq(feeds.scope, s.scope), eq(feeds.owner, s.who));
const conflict = () => json({ error: "This calendar changed. Refresh and review it before saving." }, 409);
async function view(s: Session) {
  const { c, org, scope, who, canWrite } = s;
  const [f] = await c.db.select().from(feeds).where(owned(s)).limit(1);
  const { plan } = await latest(c.db, org, scope);
  const people = canWrite ? await members(c.db, org, scope) : [];
  const rows = await c.db.all<{
    id: string;
    item: string;
    name: string;
    recipient: string;
    sender: string;
    channel: string;
    state: string;
    dismissed: number;
    due_at: string;
  }>(
    sql`SELECT r.id,r.item,COALESCE(u.display_name,'') AS name,r.recipient,r.sender,r.channel,r.state,r.dismissed,r.due_at FROM calendar_reminders r LEFT JOIN users u ON u.actor_id=r.recipient WHERE r.organization_id=${org} AND r.scope=${scope} AND (r.recipient=${who} OR r.sender=${who}) ORDER BY CASE WHEN r.dismissed=0 AND r.state IN ('ready','pending','accepted','unknown','failed') THEN 0 ELSE 1 END, r.due_at DESC,r.id LIMIT 200`,
  );
  return {
    scope,
    revision: plan.revision,
    canWrite,
    feed: { active: Boolean(f?.active), revision: f?.revision ?? 0 },
    people,
    items: plan.items.filter((i) => i.status === "open").map((i) => ({ id: i.id, title: i.title })),
    receipts: rows.map((r) => ({
      id: r.id,
      title: plan.items.find((i) => i.id === r.item)?.title ?? "",
      name: r.name,
      mine: r.recipient === who,
      sent: r.sender === who,
      channel: r.channel,
      state: r.state,
      dueAt: r.due_at,
      dismissed: !!r.dismissed,
    })),
  };
}
export async function GET(req: Request) {
  const s = await session(req);
  if (isResponse(s)) return s;
  if (new URL(req.url).searchParams.get("link") === "1") {
    const [f] = await s.c.db.select().from(feeds).where(owned(s)).limit(1);
    if (!f?.active || !s.canWrite) return json({ error: "This link is off." }, 404);
    const token = await feedToken(s.c.db, f);
    if (!token) return json({ error: "Calendar link unavailable." }, 503);
    return reply(s, { path: "/api/calendar/feed/" + token });
  }
  return reply(s, await view(s));
}
export async function POST(req: Request) {
  if (!isSameOriginMutation(req)) return json({ error: "Cross-site change rejected." }, 403);
  const s = await session(req);
  if (isResponse(s)) return s;
  const b = await readJsonObject(req, 12000);
  if (!b) return json({ error: "Invalid calendar change." }, 400);
  const { c, scope, org, who } = s,
    db = c.db;
  const op = b.operation;
  if (typeof op !== "string" || !/^[\w-]{12,100}$/.test(op))
    return json({ error: "Missing save reference." }, 400);
  const guarded = (condition: ReturnType<typeof sql>) =>
    db.insert(guards).values({ changed: sql`CASE WHEN ${condition} THEN 1 ELSE 0 END` });
  if (b.action === "dismiss") {
    if (typeof b.id !== "string") return json({ error: "Choose a reminder." }, 400);
    const target = and(
      eq(reminders.organizationId, org),
      eq(reminders.scope, scope),
      eq(reminders.recipient, who),
      eq(reminders.id, b.id),
    );
    if (!(await db.select({ id: reminders.id }).from(reminders).where(target).limit(1)).length)
      return json({ error: "Reminder unavailable." }, 404);
    try {
      await db.batch([
        guarded(grant(org, scope, who)),
        db
          .update(reminders)
          .set({
            dismissed: 1,
            lease: sql`CASE WHEN state='pending' THEN NULL ELSE lease END`,
            state: sql`CASE WHEN state='pending' THEN CASE WHEN first_attempt IS NULL THEN 'cancelled' ELSE 'unknown' END ELSE state END`,
          })
          .where(target),
        db.delete(guards),
      ]);
    } catch {
      return conflict();
    }
    return reply(s, { saved: true });
  }
  if (!s.canWrite) return json({ error: "This calendar is read-only for you." }, 403);
  if (b.action === "cancel") {
    if (typeof b.id !== "string") return json({ error: "Choose a reminder." }, 400);
    const owned = sql`id=${b.id} AND organization_id=${org} AND scope=${scope} AND sender=${who}`;
    const row = await db.get<{ state: string }>(sql`SELECT state FROM calendar_reminders WHERE ${owned}`);
    if (!row) return json({ error: "Reminder unavailable." }, 404);
    if (row.state === "cancelled") return reply(s, { saved: true });
    try {
      await db.batch([
        guarded(
          sql`${grant(org, scope, who, true)} AND EXISTS(SELECT 1 FROM calendar_reminders WHERE ${owned} AND state IN ('ready','pending') AND first_attempt IS NULL)`,
        ),
        db.update(reminders).set({ state: "cancelled", lease: null }).where(owned),
        db.delete(guards),
      ]);
    } catch {
      return conflict();
    }
    return reply(s, { saved: true });
  }
  if (["enable", "rotate", "revoke"].includes(String(b.action))) {
    const action = b.action,
      rev = b.revision;
    if (typeof rev !== "number" || !Number.isSafeInteger(rev) || rev < 0)
      return json({ error: "Invalid link version." }, 400);
    const [f] = await db.select().from(feeds).where(owned(s)).limit(1);
    if (f?.operation === op + ":" + action) return reply(s, { saved: true });
    if ((f?.revision ?? 0) !== rev || (action === "enable" ? f?.active : !f?.active)) return conflict();
    const entry = {
      id: f?.id ?? crypto.randomUUID(),
      organizationId: org,
      scope,
      owner: who,
      revision: rev + 1,
      active: action === "revoke" ? 0 : 1,
      operation: op + ":" + action,
    };
    if (entry.active && !(await feedToken(db, entry, true)))
      return json({ error: "Could not prepare the calendar link." }, 503);
    const cas = sql`COALESCE((SELECT revision FROM calendar_feeds WHERE organization_id=${org} AND scope=${scope} AND owner=${who}),0)=${rev} AND ${grant(org, scope, who, true)}`;
    try {
      await db.batch([
        guarded(cas),
        db
          .insert(feeds)
          .values(entry)
          .onConflictDoUpdate({
            target: [feeds.organizationId, feeds.scope, feeds.owner],
            set: { revision: entry.revision, active: entry.active, operation: entry.operation },
          }),
        db.delete(guards),
      ]);
    } catch {
      return conflict();
    }
    return reply(s, { saved: true });
  }
  if (
    b.action !== "schedule" ||
    (b.channel !== "email" && b.channel !== "app") ||
    !Array.isArray(b.recipients) ||
    !b.recipients.length ||
    b.recipients.length > 20 ||
    b.recipients.some((id) => typeof id !== "string" || !id || id.length > 120) ||
    typeof b.item !== "string" ||
    !Number.isSafeInteger(b.revision)
  )
    return json({ error: "Choose work, recipients, a time and a delivery method." }, 400);
  const ids = [...new Set(b.recipients as string[])].sort(),
    item = b.item,
    channel = b.channel;
  let dueAt: string;
  try {
    dueAt = readMoment(b.when).at;
  } catch {
    return json({ error: "Choose a valid reminder time and time zone." }, 400);
  }
  const digest = await sha(canonicalDossierJson({ scope, ids, item, channel, dueAt, revision: b.revision }));
  const receipt = async () => {
    const [r] = await db
      .select({ digest: reminders.digest })
      .from(reminders)
      .where(and(eq(reminders.organizationId, org), eq(reminders.sender, who), eq(reminders.operation, op)))
      .limit(1);
    return r ? (r.digest === digest ? reply(s, { saved: true }) : conflict()) : null;
  };
  const prior = await receipt();
  if (prior) return prior;
  if (Date.parse(dueAt) <= Date.now()) return json({ error: "Choose a reminder time in the future." }, 400);
  const now = new Date().toISOString(),
    eligible = sql.join(
      ids.map((id) => grant(org, scope, id)),
      sql` AND `,
    );
  const condition = sql`${grant(org, scope, who, true)} AND ${openItem(org, scope, item, b.revision as number)} AND ${eligible}`;
  try {
    await db.batch([
      guarded(condition),
      db.insert(reminders).values(
        ids.map((recipient) => ({
          id: crypto.randomUUID(),
          organizationId: org,
          scope,
          item,
          sender: who,
          recipient,
          operation: op,
          digest,
          dueAt,
          channel,
          state: channel === "app" ? "ready" : "pending",
          availableAt: dueAt,
          createdAt: now,
        })),
      ),
      db.delete(guards),
    ]);
  } catch {
    return (await receipt()) ?? conflict();
  }
  return reply(s, { saved: true }, 201);
}
