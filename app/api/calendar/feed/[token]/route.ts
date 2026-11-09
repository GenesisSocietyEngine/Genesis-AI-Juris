import {eq,sql} from "drizzle-orm";
import {getDb} from "../../../../../db";
import {calendarFeeds} from "../../../../../db/schema";
import {renderCalendar,type Withdrawal} from "../../../../calendar/ical";
import {feedToken,grant,latest,safeEqual} from "../../../../calendar/store";
export const dynamic="force-dynamic";
const headers={"Cache-Control":"private, no-store, max-age=0","Referrer-Policy":"no-referrer","X-Robots-Tag":"noindex, nofollow","X-Content-Type-Options":"nosniff"};
const missing=()=>new Response(null,{status:404,headers});
export async function GET(request:Request,{params}:{params:Promise<{token:string}>}){
 const {token}=await params;if(!/^[0-9a-f-]{36}\.[0-9a-f]{64}\.ics$/.test(token))return missing();
 const db=getDb(),[f]=await db.select().from(calendarFeeds).where(eq(calendarFeeds.id,token.split(".")[0])).limit(1);
 if(!f?.active||!safeEqual(token,(await feedToken(db,f))??""))return missing();
 const check=()=>db.get(sql`SELECT 1 AS valid FROM calendar_feeds WHERE id=${f.id} AND revision=${f.revision} AND active=1 AND ${grant(f.organizationId,f.scope,f.owner)}`);
 if(!await check())return missing();
 const {plan,stamp}=await latest(db,f.organizationId,f.scope);
 const tombstones=await db.all<Withdrawal>(sql`SELECT item,due_date,timing,revision,stamp FROM calendar_withdrawals WHERE organization_id=${f.organizationId} AND scope=${f.scope} AND stamp>=${new Date(Date.now()-90*86400000).toISOString()} ORDER BY item`);
 const body=await renderCalendar(f.organizationId,f.scope,plan,stamp,tombstones);
 if(!await check())return missing();
 return new Response(request.method==="HEAD"?null:body,{headers:{...headers,"Content-Type":"text/calendar; charset=utf-8","Content-Disposition":'inline; filename="CaseVant.ics"'}});
}
export const HEAD=GET;
