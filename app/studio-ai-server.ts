import { env } from "cloudflare:workers";
import { materializeAIStudioPlan, STUDIO_AI_PLAN_SCHEMA } from "./studio-ai-plan";
import { studioAIProviderContext } from "./studio-ai-provider-context";
import { classifyStudioAIProviderFailure, shouldRetryStudioAIWithoutStrictSchema, type StudioAIProviderErrorCode, type StudioAIProviderFailure } from "./studio-ai-provider-error";
import type { StudioDraft } from "./types";

type StudioAIConfig = { apiKey: string; model: string };
const STUDIO_AI_TIMEOUT_MS = 300_000;
const STUDIO_AI_REPAIR_TIMEOUT_MS = 120_000;

export type StudioAIUsage = {
  inputTokens: number | null;
  cachedInputTokens: number | null;
  outputTokens: number | null;
  reasoningOutputTokens: number | null;
  totalTokens: number | null;
};

export class StudioAIServiceError extends Error {
  constructor(
    public readonly code: "not_configured" | StudioAIProviderErrorCode | "refused" | "invalid_output" | "incomplete",
    public readonly providerFailure: StudioAIProviderFailure | null = null,
    public readonly usage: StudioAIUsage | null = null,
    public readonly incompleteReason: "max_output_tokens" | "content_filter" | null = null,
    public readonly invalidStage: "payload" | "content" | "json" | "materialization" | "repair_materialization" | null = null,
  ) {
    super(code);
  }
}

export function studioAIAvailable() {
  return getStudioAIConfig() !== null;
}

export async function createAIStudioPlan(values: {
  draft: StudioDraft;
  instruction: string;
  locale: "en" | "ru";
  selectedNodeId?: string | null;
  safetyIdentifier: string;
  signal?: AbortSignal;
}) {
  const config = getStudioAIConfig();
  if (!config) throw new StudioAIServiceError("not_configured");
  const providerContext = studioAIProviderContext(values);
  const requestBody = {
    model: config.model,
    store: false,
    safety_identifier: values.safetyIdentifier,
    max_output_tokens: 25_000,
    reasoning: { effort: "low" },
    instructions: providerContext.instructions,
    input: providerContext.input,
    text: {
      format: {
        type: "json_schema",
        name: "genesis_juris_studio_plan",
        description: "A reviewable, non-destructive semantic plan for a legal scenario graph.",
        strict: true,
        schema: STUDIO_AI_PLAN_SCHEMA,
      },
    },
  };

  let response: Response;
  try {
    response = await requestStudioAIResponse(config.apiKey, requestBody, values.signal);
  } catch {
    throw new StudioAIServiceError("provider_unavailable");
  }
  let payload: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const failure = classifyStudioAIProviderFailure(response.status, payload, response.headers.get("Retry-After"));
    if (shouldRetryStudioAIWithoutStrictSchema(failure)) {
      const fallbackBody = {
        ...requestBody,
        instructions: `${providerContext.instructions}\n- Return one valid JSON object matching the described plan shape. Do not wrap it in Markdown.`,
        text: { format: { type: "json_object" } },
      };
      try {
        response = await requestStudioAIResponse(config.apiKey, fallbackBody, values.signal);
      } catch {
        throw new StudioAIServiceError("provider_unavailable");
      }
      payload = await response.json().catch(() => null);
      if (!response.ok) {
        const fallbackFailure = classifyStudioAIProviderFailure(response.status, payload, response.headers.get("Retry-After"));
        throw new StudioAIServiceError(fallbackFailure.code, fallbackFailure);
      }
    } else {
      throw new StudioAIServiceError(failure.code, failure);
    }
  }
  const first = studioAIProposal(payload);
  let plan;
  try {
    plan = materializeAIStudioPlan(values.draft, values.instruction, first.proposal, values.locale, values.selectedNodeId);
  } catch {
    const repairBody = {
      ...requestBody,
      max_output_tokens: 16_000,
      reasoning: { effort: "none" },
      instructions: `${providerContext.instructions}\n\nSEMANTIC REPAIR PASS\n- The prior proposal matched the JSON schema but failed the graph validator. Rebuild the complete proposal from the original input; do not describe the repair.\n- Recheck all reference formats and endpoints, cross-field null rules, unique relations, reachability and acyclicity before returning the replacement JSON.`,
    };
    let repairResponse: Response;
    try {
      repairResponse = await requestStudioAIResponse(config.apiKey, repairBody, values.signal, STUDIO_AI_REPAIR_TIMEOUT_MS);
    } catch {
      throw new StudioAIServiceError("provider_unavailable", null, first.usage);
    }
    const repairPayload: unknown = await repairResponse.json().catch(() => null);
    if (!repairResponse.ok) {
      const repairFailure = classifyStudioAIProviderFailure(repairResponse.status, repairPayload, repairResponse.headers.get("Retry-After"));
      throw new StudioAIServiceError(repairFailure.code, repairFailure, first.usage);
    }
    let repair;
    try {
      repair = studioAIProposal(repairPayload);
      plan = materializeAIStudioPlan(values.draft, values.instruction, repair.proposal, values.locale, values.selectedNodeId);
    } catch (error) {
      if (error instanceof StudioAIServiceError) throw withMergedUsage(error, first.usage);
      throw new StudioAIServiceError("invalid_output", null, first.usage, null, "repair_materialization");
    }
    return {
      plan,
      model: config.model,
      requestId: repair.requestId,
      usage: mergeStudioAIUsage(first.usage, repair.usage),
    };
  }
  return {
    plan,
    model: config.model,
    requestId: first.requestId,
    usage: first.usage,
  };
}

async function requestStudioAIResponse(apiKey: string, body: unknown, signal?: AbortSignal, timeoutMs = STUDIO_AI_TIMEOUT_MS) {
  return fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "User-Agent": "GENESIS-JURIS/17 studio-ai",
    },
    body: JSON.stringify(body),
    signal: signal
      ? AbortSignal.any([signal, AbortSignal.timeout(timeoutMs)])
      : AbortSignal.timeout(timeoutMs),
  });
}

function studioAIProposal(payload: unknown) {
  if (!isRecord(payload)) throw new StudioAIServiceError("invalid_output", null, null, null, "payload");
  const usage = studioAIUsage(payload.usage);
  if (payload.status !== "completed") {
    const incompleteDetails = isRecord(payload.incomplete_details) ? payload.incomplete_details : null;
    const incompleteReason = incompleteDetails?.reason === "max_output_tokens" || incompleteDetails?.reason === "content_filter" ? incompleteDetails.reason : null;
    throw new StudioAIServiceError(payload.status === "incomplete" ? "incomplete" : "invalid_output", null, usage, incompleteReason, "payload");
  }
  const output = Array.isArray(payload.output) ? payload.output : [];
  let outputText = "";
  for (const item of output) {
    if (!isRecord(item) || !Array.isArray(item.content)) continue;
    for (const content of item.content) {
      if (!isRecord(content)) continue;
      if (content.type === "refusal") throw new StudioAIServiceError("refused", null, usage);
      if (content.type === "output_text" && typeof content.text === "string") outputText += content.text;
    }
  }
  if (!outputText) throw new StudioAIServiceError("invalid_output", null, usage, null, "content");
  let proposal: unknown;
  try { proposal = JSON.parse(outputText); }
  catch { throw new StudioAIServiceError("invalid_output", null, usage, null, "json"); }
  return { proposal, usage, requestId: typeof payload.id === "string" ? payload.id.slice(0, 200) : null };
}

function mergeStudioAIUsage(first: StudioAIUsage | null, second: StudioAIUsage | null): StudioAIUsage | null {
  if (!first) return second;
  if (!second) return first;
  const add = (left: number | null, right: number | null) => left === null || right === null ? null : left + right;
  return {
    inputTokens: add(first.inputTokens, second.inputTokens),
    cachedInputTokens: add(first.cachedInputTokens, second.cachedInputTokens),
    outputTokens: add(first.outputTokens, second.outputTokens),
    reasoningOutputTokens: add(first.reasoningOutputTokens, second.reasoningOutputTokens),
    totalTokens: add(first.totalTokens, second.totalTokens),
  };
}

function withMergedUsage(error: StudioAIServiceError, prior: StudioAIUsage | null) {
  return new StudioAIServiceError(error.code, error.providerFailure, mergeStudioAIUsage(prior, error.usage), error.incompleteReason, error.invalidStage);
}

function studioAIUsage(value: unknown): StudioAIUsage | null {
  if (!isRecord(value)) return null;
  const inputDetails = isRecord(value.input_tokens_details) ? value.input_tokens_details : null;
  const outputDetails = isRecord(value.output_tokens_details) ? value.output_tokens_details : null;
  return {
    inputTokens: tokenCount(value.input_tokens),
    cachedInputTokens: tokenCount(inputDetails?.cached_tokens),
    outputTokens: tokenCount(value.output_tokens),
    reasoningOutputTokens: tokenCount(outputDetails?.reasoning_tokens),
    totalTokens: tokenCount(value.total_tokens),
  };
}

function tokenCount(value: unknown) {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? value : null;
}

function getStudioAIConfig(): StudioAIConfig | null {
  const bindings = env as unknown as { OPENAI_API_KEY?: string; GENESIS_OPENAI_MODEL?: string };
  const apiKey = bindings.OPENAI_API_KEY?.trim() ?? "";
  const model = bindings.GENESIS_OPENAI_MODEL?.trim() || "gpt-5.6";
  if (!apiKey || apiKey.length > 300 || !/^[A-Za-z0-9._:-]{2,100}$/.test(model)) return null;
  return { apiKey, model };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
