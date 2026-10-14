const trainingOnlyTerminationIds = new Set(["client_terminated_engagement", "client_engagement_terminated"]);
export const convertedGameplayId = (id: string) => trainingOnlyTerminationIds.has(id) || /^(rest|rest_completed|rest_recovery_applied)$/.test(id) || /(?:^|_)(?:inactivity|client_warning|fatigue|stamina|strain)(?:_|$)/.test(id);
