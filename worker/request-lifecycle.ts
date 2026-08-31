import {
  OBSERVABILITY_REQUEST_HEADER,
  createRequestId,
  normalizeObservabilityRoute,
  responseClassForStatus,
  withRequestId,
  type ObservabilityEventInput,
  type ObservabilityRoute,
} from "../app/observability";

export interface WorkerRequestLifecycleTelemetry {
  begin(requestId: string, route: ObservabilityRoute): void;
  finish(requestId: string): void;
  emit(input: ObservabilityEventInput): void;
}

export interface WorkerRequestLifecycleOptions {
  dispatch(request: Request, url: URL): Promise<Response>;
  decorateResponse?(response: Response, url: URL): Response;
  telemetry?: WorkerRequestLifecycleTelemetry;
  uuid?: () => string;
  now?: () => number;
}

function failOpen(action: (() => void) | undefined) {
  try {
    action?.();
  } catch {
    // Telemetry must never change the request result.
  }
}

function failOpenNow(now: () => number) {
  try {
    const value = now();
    return Number.isFinite(value) ? value : 0;
  } catch {
    return 0;
  }
}

export async function runObservedWorkerRequest(
  request: Request,
  options: WorkerRequestLifecycleOptions,
): Promise<Response> {
  const requestId = createRequestId(options.uuid);
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set(OBSERVABILITY_REQUEST_HEADER, requestId);
  const observedRequest = new Request(request, { headers: requestHeaders });
  const url = new URL(observedRequest.url);
  const route = normalizeObservabilityRoute(url);
  const now = options.now ?? Date.now;
  const startedAt = failOpenNow(now);
  failOpen(() => options.telemetry?.begin(requestId, route));

  let response: Response;
  try {
    response = await options.dispatch(observedRequest, url);
    response = options.decorateResponse?.(response, url) ?? response;
    response = withRequestId(response, requestId);
  } catch (error) {
    failOpen(() => options.telemetry?.finish(requestId));
    failOpen(() => options.telemetry?.emit({
      requestId,
      eventName: "worker.exception",
      route,
      outcome: "internal_failure",
      reason: "handler_exception",
      responseClass: "exception",
      latencyMs: Math.max(0, failOpenNow(now) - startedAt),
      operation: "request",
      logicalRepository: "none",
    }));
    throw error;
  }

  failOpen(() => options.telemetry?.finish(requestId));
  failOpen(() => options.telemetry?.emit({
    requestId,
    eventName: "worker.request",
    route,
    outcome: response.status >= 500 ? "internal_failure" : response.status >= 400 ? "expected_rejection" : "success",
    reason: response.status >= 500 ? "server_error" : response.status >= 400 ? "client_response" : "completed",
    responseClass: responseClassForStatus(response.status),
    latencyMs: Math.max(0, failOpenNow(now) - startedAt),
    operation: "request",
    logicalRepository: "none",
  }));
  return response;
}
