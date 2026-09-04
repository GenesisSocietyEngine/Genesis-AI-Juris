import { env, waitUntil } from "cloudflare:workers";
import canonicalBundle from "./canonical-case-bundle.json";
import { CANONICAL_RUNTIME_REVISION } from "./canonical-runtime";
import {
  requestIdFromRequest,
  type ObservabilityEventInput,
  type ObservabilityEventV1,
  type ObservabilityReleaseIdentity,
  type ObservabilitySink,
} from "./observability";
import { PLAYED_CASE_SCHEMA_REVISION } from "./played-case-contract";
import { type OperationalEventDatabase } from "./operational-events";
import {
  createOperationalTelemetryCircuitBreaker,
  createOperationalTelemetryScope,
  flushOperationalTelemetryScope,
  observeOperationalEventCore,
  observeWorkerRequestEventCore,
  type OperationalTelemetryCircuitBreaker,
  type OperationalTelemetryScope,
} from "./server-observability-core";

interface VersionMetadata {
  id?: string;
  tag?: string;
}

export interface ObservabilityBindings {
  DB?: D1Database;
  GENESIS_DEPLOYMENT_VERSION?: string;
  GENESIS_WEB_COMMIT?: string;
  CF_VERSION_METADATA?: VersionMetadata;
}

interface ObserveOptions {
  bindings?: ObservabilityBindings;
  scope?: OperationalTelemetryScope | null;
  sink?: ObservabilitySink;
}

interface BeginOperationalTelemetryRequestOptions {
  bindings?: ObservabilityBindings;
  database?: OperationalEventDatabase | null;
  defer?: (promise: Promise<unknown>) => void;
  circuitBreaker?: OperationalTelemetryCircuitBreaker;
}

const REQUEST_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;
const operationalTelemetryCircuitBreaker = createOperationalTelemetryCircuitBreaker();
const activeOperationalTelemetryScopes = new Map<string, OperationalTelemetryScope>();

function releaseToken(value: string | undefined, fallback: string) {
  const normalized = value?.trim();
  return normalized && /^[A-Za-z0-9][A-Za-z0-9._:-]{0,99}$/u.test(normalized) ? normalized : fallback;
}

function webCommit(value: string | undefined) {
  const normalized = value?.trim().toLowerCase();
  return normalized && /^[a-f0-9]{40}$/u.test(normalized) ? normalized : "unknown";
}

export function currentObservabilityReleaseIdentity(bindings: ObservabilityBindings = env as unknown as ObservabilityBindings): ObservabilityReleaseIdentity {
  const bundleRevision = (canonicalBundle as { bundle_version?: unknown }).bundle_version;
  if (typeof bundleRevision !== "number" || !Number.isSafeInteger(bundleRevision) || bundleRevision < 0) {
    throw new Error("The canonical bundle revision is unavailable.");
  }
  return {
    deploymentVersion: releaseToken(bindings.GENESIS_DEPLOYMENT_VERSION ?? bindings.CF_VERSION_METADATA?.tag ?? bindings.CF_VERSION_METADATA?.id, "unassigned"),
    webCommit: webCommit(bindings.GENESIS_WEB_COMMIT),
    bundleRevision,
    runtimeRevision: CANONICAL_RUNTIME_REVISION,
    playedCaseSchemaRevision: PLAYED_CASE_SCHEMA_REVISION,
  };
}

export function beginOperationalTelemetryRequest(
  requestId: string,
  options: BeginOperationalTelemetryRequestOptions = {},
): boolean {
  try {
    if (!REQUEST_ID_PATTERN.test(requestId) || activeOperationalTelemetryScopes.has(requestId)) return false;
    const bindings = options.bindings ?? env as unknown as ObservabilityBindings;
    const database = options.database === undefined ? bindings.DB ?? null : options.database;
    activeOperationalTelemetryScopes.set(requestId, createOperationalTelemetryScope({
      database,
      defer: options.defer ?? waitUntil,
      circuitBreaker: options.circuitBreaker ?? operationalTelemetryCircuitBreaker,
    }));
    return true;
  } catch {
    return false;
  }
}

export function finishOperationalTelemetryRequest(requestId: string): void {
  try {
    const scope = activeOperationalTelemetryScopes.get(requestId);
    if (!scope) return;
    activeOperationalTelemetryScopes.delete(requestId);
    flushOperationalTelemetryScope(scope);
  } catch {
    activeOperationalTelemetryScopes.delete(requestId);
  }
}

export function observeWorkerRequestEvent(
  input: ObservabilityEventInput,
  options: Pick<ObserveOptions, "bindings" | "sink"> = {},
): ObservabilityEventV1 | null {
  try {
    const bindings = options.bindings ?? env as unknown as ObservabilityBindings;
    return observeWorkerRequestEventCore(input, {
      identity: currentObservabilityReleaseIdentity(bindings),
      sink: options.sink,
    });
  } catch {
    return null;
  }
}

export function observeOperationalEvent(input: ObservabilityEventInput, options: ObserveOptions = {}): ObservabilityEventV1 | null {
  try {
    const bindings = options.bindings ?? env as unknown as ObservabilityBindings;
    return observeOperationalEventCore(input, {
      identity: currentObservabilityReleaseIdentity(bindings),
      scope: options.scope ?? activeOperationalTelemetryScopes.get(input.requestId) ?? null,
      sink: options.sink,
    });
  } catch {
    return null;
  }
}

export function observabilityRequestId(request: Request) {
  return requestIdFromRequest(request);
}
