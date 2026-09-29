import {
  classifyD1Failure,
  type ObservabilityEventInput,
  type ObservabilityOperation,
  type ObservabilityRepository,
} from "./observability";

export type D1OperationObserver = (
  input: Omit<ObservabilityEventInput, "requestId" | "route">,
) => unknown;

export interface ObservedD1OperationOptions {
  operation: ObservabilityOperation;
  logicalRepository: Exclude<ObservabilityRepository, "none">;
}

function emitD1Observation(
  observe: D1OperationObserver | undefined,
  input: Omit<ObservabilityEventInput, "requestId" | "route">,
) {
  try {
    observe?.(input);
  } catch {
    // Observation cannot change the database result or thrown error.
  }
}

function failOpenNow() {
  try {
    const value = Date.now();
    return Number.isFinite(value) ? value : 0;
  } catch {
    return 0;
  }
}

function failOpenD1Classification(error: unknown) {
  try {
    return classifyD1Failure(error);
  } catch {
    return { outcome: "internal_failure", reason: "unexpected_error" } as const;
  }
}

export async function runObservedD1Operation<T>(
  observe: D1OperationObserver | undefined,
  options: ObservedD1OperationOptions,
  operation: () => Promise<T>,
): Promise<T> {
  const startedAt = failOpenNow();
  try {
    const result = await operation();
    emitD1Observation(observe, {
      eventName: "d1.operation",
      outcome: "success",
      reason: "completed",
      responseClass: "none",
      latencyMs: Math.max(0, failOpenNow() - startedAt),
      operation: options.operation,
      logicalRepository: options.logicalRepository,
    });
    return result;
  } catch (error) {
    const failure = failOpenD1Classification(error);
    emitD1Observation(observe, {
      eventName: "d1.operation",
      outcome: failure.outcome,
      reason: failure.reason,
      responseClass: "none",
      latencyMs: Math.max(0, failOpenNow() - startedAt),
      operation: options.operation,
      logicalRepository: options.logicalRepository,
    });
    throw error;
  }
}
