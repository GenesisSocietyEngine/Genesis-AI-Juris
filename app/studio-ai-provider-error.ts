export type StudioAIProviderErrorCode =
  | "provider_authentication"
  | "provider_permission"
  | "provider_quota"
  | "provider_rate_limited"
  | "provider_model_unavailable"
  | "provider_bad_request"
  | "provider_unavailable"
  | "provider_rejected";

export type StudioAIProviderFailure = {
  code: StudioAIProviderErrorCode;
  status: number;
  providerCode: string | null;
  providerType: string | null;
  providerParam: string | null;
  retryAfterSeconds: number | null;
};

/**
 * Convert an OpenAI API failure into a bounded, non-secret diagnostic. The
 * provider message is deliberately discarded because it can echo submitted
 * content. Only documented machine-readable fields are retained.
 */
export function classifyStudioAIProviderFailure(status: number, payload: unknown, retryAfter: string | null = null): StudioAIProviderFailure {
  const error = isRecord(payload) && isRecord(payload.error) ? payload.error : null;
  const providerCode = boundedMachineField(error?.code);
  const providerType = boundedMachineField(error?.type);
  const providerParam = boundedMachineField(error?.param);
  const retryAfterSeconds = parseRetryAfter(retryAfter);
  const normalized = `${providerCode ?? ""} ${providerType ?? ""}`.toLowerCase();

  let code: StudioAIProviderErrorCode;
  if (status === 401) code = "provider_authentication";
  else if (status === 403) code = "provider_permission";
  else if (status === 429 && /(credit|quota|spend|billing|usage_limit)/.test(normalized)) code = "provider_quota";
  else if (status === 429) code = "provider_rate_limited";
  else if (status === 404 || /(model.*not.*found|model_not_found|unsupported_model)/.test(normalized)) code = "provider_model_unavailable";
  else if (status === 400 || status === 422) code = "provider_bad_request";
  else if (status >= 500) code = "provider_unavailable";
  else code = "provider_rejected";

  return { code, status, providerCode, providerType, providerParam, retryAfterSeconds };
}

export function shouldRetryStudioAIWithoutStrictSchema(failure: StudioAIProviderFailure) {
  if (failure.code !== "provider_bad_request") return false;
  const hint = `${failure.providerCode ?? ""} ${failure.providerType ?? ""} ${failure.providerParam ?? ""}`.toLowerCase();
  return !hint || /(schema|format|response|json|invalid_request)/.test(hint);
}

function boundedMachineField(value: unknown) {
  return typeof value === "string" && value.length <= 160 && /^[A-Za-z0-9_.:\[\]-]+$/.test(value) ? value : null;
}

function parseRetryAfter(value: string | null) {
  if (!value) return null;
  const seconds = Number(value);
  return Number.isInteger(seconds) && seconds >= 1 && seconds <= 86_400 ? seconds : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
