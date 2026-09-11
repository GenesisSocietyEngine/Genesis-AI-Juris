export type CanopySource = { id: string; version: number; title: string; sections: Record<string, string> };
const assumption = "Illustrative synthetic assumption.";
export const CANOPY_HISTORICAL_SOURCES: readonly CanopySource[] = [
 { id:"D01", version:1, title:"Investment mandate and approval thresholds", sections:{
  Mandate:"The fictional Investment and Operating Committee has ten days from dossier opening to choose a controlled managed-site opportunity. This mandate covers premium crops and a 90-day transition pilot, not commodity-volume expansion.",
  Thresholds:"Minimum signed demand: 450 packs per week. Required yield: 90%. Maximum downside simple payback: 3 years. Setup commitment: 240000 illustrative credits. These are committee assumptions, not market forecasts.",
  Safety:"A failed or unavailable mandatory independent food-safety or traceability clearance at the production release gate means no-go regardless of financial attractiveness. No production release is permitted under the conditional pilot until all release conditions are independently accepted.",
  Alternatives:"Approve full management takeover subject to recorded conditions; approve only a conditional 90-day transition pilot; renegotiate and defer; or decline/no-go."
 }},
 { id:"D02", version:1, title:"Draft farm-management term sheet", sections:{
  Control:"Verdant Atelier Farms retains authority to pause production and deliveries. The site owner funds the illustrative setup commitment. No exclusivity or irreversible takeover is permitted during the pilot.",
  Exit:"The pilot lasts 90 days with reviews on days 30, 60 and 90. Exit without expansion is required if signed demand, yield, independent release clearance or staffing conditions fail. Commercial owner: Mara Vale; decision deadline: day 10."
 }},
 { id:"D03", version:1, title:"Hospitality demand pipeline", sections:{
  Demand:"Total indicated demand is 600 packs per week: 300 signed, 180 non-binding LOI and 120 expressions of interest. Only 300 count as signed commitments against the 450 minimum.",
  Gap:"The commercial request of 600 packs per week exceeds evidenced transition capacity of 480 by 120. Non-binding interest is not revenue or a production authorization."
 }},
 { id:"D03", version:2, title:"Hospitality demand pipeline", sections:{
  Demand:"The defined 180-pack LOI subset has become signed commitments. Signed demand is now 480 packs per week: the original 300 plus 180. The remaining 120 expressions of interest remain uncommitted; total indicated demand remains 600.",
  Gap:"Only 480 packs per week are in the approved scope, matching transition capacity. The additional 120 remain excluded pending an independently reviewed capacity change."
 }},
 { id:"D04", version:1, title:"Current capacity and crop-fit report", sections:{
  Capacity:"Evidenced premium-crop transition capacity is 480 packs per week. The candidate is suitable for the specified high-value crop mix. Commodity-volume expansion is excluded.",
  Yield:"The release yield threshold is 90%. Base demonstrated yield is 92%; upside is 95%; downside is 85%. These are illustrative synthetic scenario assumptions, not agronomy forecasts."
 }},
 { id:"D05", version:1, title:"Candidate-site technical assessment", sections:{
  Site:"The fictional candidate has suitable cultivation and environmental-control equipment for premium crops. Full operation depends on independent commissioning evidence and closed release controls.",
  Readiness:"The material traceability reconciliation item in D06 v1 remains pending. A controlled non-production transition pilot may close it; equipment suitability alone never authorizes production."
 }},
 { id:"D06", version:1, title:"Independent commissioning and traceability-readiness report", sections:{
  Commissioning:"Independent closure evidence for batch-to-delivery traceability reconciliation is pending. This material readiness gap blocks full operation but is not a failed critical safety control. Controlled non-production pilot work may resolve it.",
  Clearance:"Base declaration: no critical safety failure is identified. Hard-stop stress declaration: mandatory independent food-safety or traceability clearance fails or is unavailable at the production release gate. That declaration requires no-go even with upside economics."
 }},
 { id:"D06", version:2, title:"Independent commissioning and traceability-readiness report", sections:{
  Commissioning:"Independent evidence now closes batch-to-delivery traceability reconciliation for the 480-pack scope. The evidence requires explicit authorized review before it can support release.",
  Clearance:"Upside declaration: mandatory independent food-safety and traceability clearances are passed for the scoped operation. Reopening either clearance as failed or unavailable invokes the D01 no-go rule; this version is not an unconditional perpetual clearance."
 }},
 { id:"D07", version:1, title:"Illustrative unit-economics and scenario sheet", sections:{
  Method:assumption+" Unit: fictional credits. Simple payback = 240000 setup commitment / annual contribution. Contribution = annual revenue - energy - other annual operating costs. These transparent precomputed values are not forecasts, audited calculations or a Genesis financial engine.",
  Base:"Base: revenue 720000; energy 80000; other costs 520000; total costs 600000; contribution 120000; simple payback 2.00 years. Signed demand 300 packs/week; yield 92%. Headline economics meet the 3-year mandate; evidence and leadership remain conditions.",
  Upside:"Upside: revenue 840000; energy 80000; other costs 600000; total costs 680000; contribution 160000; simple payback 1.50 years. Signed demand 480 packs/week; yield 95%; accountable leadership confirmed.",
  Downside:"Downside: revenue 670000; energy 100000; other costs 500000; total costs 600000; contribution 70000; simple payback 3.43 years (rounded from 24/7). Energy rises 25% from 80000; signed demand 300 packs/week; yield 85%. Renegotiate and defer.",
  HardStop:"Hard stop uses the attractive upside economics (1.50-year payback) with failed or unavailable mandatory release clearance. Recommendation remains no-go. Financial values do not alter safety clearance.",
  Underwriting:"Conservative base pilot: revenue 690000 - energy 90000 - other 520000 = contribution 80000. Conservative upside operation: revenue 780000 - energy 100000 - other 600000 = contribution 80000. Both downside paybacks are 240000 / 80000 = 3.00 years, meeting the mandate. The separate Downside stress contribution of 70000 breaches it and requires renegotiation/exit. Illustrative synthetic assumptions."
 }},
 { id:"D08", version:1, title:"Staffing and 90-day transition plan", sections:{
  Leadership:"Base: transition leader appointment and minimum-team commitment are unresolved. Upside declared assumption: transition lead Inez Reed and the minimum team are confirmed before release. Operating owner Noah Wren must evidence confirmation by day 10.",
  Reviews:"Mara Vale owns signed-demand scope by day 10; Inez Reed owns commissioning evidence before release; Noah Wren owns team readiness before release; finance owner Eli Moss checks the mandate on days 30, 60 and 90. Review demand, yield, traceability, delivery performance and exit conditions at every review."
 }},
 { id:"D09", version:1, title:"Cold-chain and delivery service model", sections:{
  Service:"The fictional service model supports same-day hospitality deliveries for up to 480 packs per week. Cold-chain capacity matches the scoped upside volume. Delivery owner Sol Hart retains a contingency carrier and may pause deliveries.",
  Controls:"Production and deliveries require accepted independent release clearance. Monitor freshness SLA and routing capacity at the day 30, 60 and 90 reviews. No customer names, actual facility details or real operating figures are used."
 }}
];
