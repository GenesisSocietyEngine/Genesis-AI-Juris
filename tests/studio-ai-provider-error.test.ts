import assert from "node:assert/strict";
import test from "node:test";
import { classifyStudioAIProviderFailure, shouldRetryStudioAIWithoutStrictSchema } from "../app/studio-ai-provider-error";

test("OpenAI provider errors are classified without retaining provider messages", () => {
  const auth = classifyStudioAIProviderFailure(401, { error: { code: "invalid_api_key", type: "invalid_request_error", message: "secret echoed content" } });
  assert.equal(auth.code, "provider_authentication");
  assert.equal("message" in auth, false);

  const quota = classifyStudioAIProviderFailure(429, { error: { code: "project_spend_limit_exceeded", type: "insufficient_quota" } });
  assert.equal(quota.code, "provider_quota");

  const rate = classifyStudioAIProviderFailure(429, { error: { code: "rate_limit_exceeded", type: "requests" } }, "30");
  assert.equal(rate.code, "provider_rate_limited");
  assert.equal(rate.retryAfterSeconds, 30);
});

test("only controlled bad requests can retry through the JSON compatibility format", () => {
  const schema = classifyStudioAIProviderFailure(400, { error: { code: "invalid_json_schema", type: "invalid_request_error", param: "text.format.schema" } });
  assert.equal(shouldRetryStudioAIWithoutStrictSchema(schema), true);
  const auth = classifyStudioAIProviderFailure(401, { error: { code: "invalid_api_key" } });
  assert.equal(shouldRetryStudioAIWithoutStrictSchema(auth), false);
});
