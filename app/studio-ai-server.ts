import { env } from "cloudflare:workers";
import { materializeAIStudioPlan, STUDIO_AI_PLAN_SCHEMA } from "./studio-ai-plan";
import { studioAIProviderContext } from "./studio-ai-provider-context";
import type { StudioDraft } from "./types";

type StudioAIConfig = { apiKey: string; model: string };

export type StudioAIUsage = {
  inputTokens: number | null;
  cachedInputTokens: number | null;
  outputTokens: number | null;
  reasoningOutputTokens: number | null;
  totalTokens: number | null;
};

export class StudioAIServiceError extends Error {
  constructor(public readonly code: "not_configured" | "provider_rejected" | "provider_unavailable" | "refused" | "invalid_output" | "incomplete") {
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
    max_output_tokens: 6_000,
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
    response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        "Content-Type": "application/json",
        "User-Agent": "GENESIS-JURIS/16 studio-ai",
      },
      body: JSON.stringify(requestBody),
      signal: values.signal
        ? AbortSignal.any([values.signal, AbortSignal.timeout(35_000)])
        : AbortSignal.timeout(35_000),
    });
  } catch {
    throw new StudioAIServiceError("provider_unavailable");
  }
  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) throw new StudioAIServiceError("provider_rejected");
  if (!isRecord(payload)) throw new StudioAIServiceError("invalid_output");
  if (payload.status !== "completed") throw new StudioAIServiceError(payload.status === "incomplete" ? "incomplete" : "invalid_output");
  const output = Array.isArray(payload.output) ? payload.output : [];
  let outputText = "";
  for (const item of output) {
    if (!isRecord(item) || !Array.isArray(item.content)) continue;
    for (const content of item.content) {
      if (!isRecord(content)) continue;
      if (content.type === "refusal") throw new StudioAIServiceError("refused");
      if (content.type === "output_text" && typeof content.text === "string") outputText += content.text;
    }
  }
  if (!outputText) throw new StudioAIServiceError("invalid_output");
  let proposal: unknown;
  try { proposal = JSON.parse(outputText); } catch { throw new StudioAIServiceError("invalid_output"); }
  let plan;
  try {
    plan = materializeAIStudioPlan(values.draft, values.instruction, proposal, values.locale, values.selectedNodeId);
  } catch {
    throw new StudioAIServiceError("invalid_output");
  }
  return {
    plan,
    model: config.model,
    requestId: typeof payload.id === "string" ? payload.id.slice(0, 200) : null,
    usage: studioAIUsage(payload.usage),
  };
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
