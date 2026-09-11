/** Declared synthetic inputs, fingerprinted in the existing Studio node detail.
 * These are authored scenario inputs, not a new financial or inference engine. */
export type CanopyInputs = {
  sourceBaselineSignedPacksPerWeek: number;
  assumedDemandPacksPerWeek: number;
  capacityPacksPerWeek: number;
  assumedYieldPercent: number;
  annualRevenueCredits: number;
  annualEnergyCredits: number;
  annualOtherCostsCredits: number;
  setupCredits: number;
  conservativePaybackYears: number;
  staffing: "unresolved" | "confirmed";
  commissioning: "pending" | "accepted";
  clearance: "no_critical_failure_identified" | "passed" | "failed" | "unavailable";
  policy: { minimumSignedPacksPerWeek: number; minimumYieldPercent: number; maximumPaybackYears: number };
};
export const CANOPY_UPSIDE_INPUTS: Readonly<CanopyInputs> = {
  sourceBaselineSignedPacksPerWeek: 480, assumedDemandPacksPerWeek: 480,
  capacityPacksPerWeek: 480, assumedYieldPercent: 95,
  annualRevenueCredits: 840000, annualEnergyCredits: 80000, annualOtherCostsCredits: 600000,
  setupCredits: 240000, conservativePaybackYears: 3,
  staffing: "confirmed", commissioning: "accepted", clearance: "passed",
  policy: { minimumSignedPacksPerWeek: 450, minimumYieldPercent: 90, maximumPaybackYears: 3 },
};
export function canopyGuardDeclaration(inputs: CanopyInputs) {
  const stopped = inputs.clearance === "failed" || inputs.clearance === "unavailable";
  const downside = inputs.conservativePaybackYears > inputs.policy.maximumPaybackYears || inputs.assumedYieldPercent < inputs.policy.minimumYieldPercent;
  const fullyReady = inputs.clearance === "passed" && inputs.commissioning === "accepted" && inputs.staffing === "confirmed"
    && inputs.assumedDemandPacksPerWeek >= inputs.policy.minimumSignedPacksPerWeek && inputs.assumedDemandPacksPerWeek <= inputs.capacityPacksPerWeek && !downside;
  return { clearance: !stopped, fullyReady, downside };
}
export function canopySemanticInputDiff(before: CanopyInputs, after: CanopyInputs) {
  return (Object.keys(before) as Array<keyof CanopyInputs>).filter(key => JSON.stringify(before[key]) !== JSON.stringify(after[key]))
    .map(key => ({ field: key, before: before[key], after: after[key] }));
}
