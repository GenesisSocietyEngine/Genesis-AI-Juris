import {
  createObservabilityEvent,
  emitStructuredObservability,
  type ObservabilityEventInput,
  type ObservabilityEventV1,
  type ObservabilityReleaseIdentity,
  type ObservabilitySink,
} from "./observability";
import {
  shouldEmitOperationalAnomaly,
  shouldPersistOperationalAnomaly,
} from "./observability-persistence";
import {
  MAX_OPERATIONAL_EVENT_INSERTS_PER_BATCH,
  persistOperationalEvents,
  type OperationalEventDatabase,
} from "./operational-events";

export const OPERATIONAL_TELEMETRY_COOLDOWN_MS = 60_000;

export interface OperationalTelemetryCircuitBreaker {
  isOpen(): boolean;
  trip(): void;
  openUntil(): number;
}

export interface OperationalTelemetryScope {
  readonly database: OperationalEventDatabase | null;
  readonly defer?: (promise: Promise<unknown>) => void;
  readonly circuitBreaker: OperationalTelemetryCircuitBreaker;
  readonly queuedEvents: ObservabilityEventV1[];
  finished: boolean;
}

export interface ObserveOperationalEventCoreOptions {
  identity: ObservabilityReleaseIdentity;
  scope?: OperationalTelemetryScope | null;
  sink?: ObservabilitySink;
}

export interface ObserveWorkerRequestEventCoreOptions {
  identity: ObservabilityReleaseIdentity;
  sink?: ObservabilitySink;
}

export interface CreateCircuitBreakerOptions {
  cooldownMs?: number;
  now?: () => number;
}

export interface CreateOperationalTelemetryScopeOptions {
  database?: OperationalEventDatabase | null;
  defer?: (promise: Promise<unknown>) => void;
  circuitBreaker: OperationalTelemetryCircuitBreaker;
}

function validCooldown(value: number) {
  return Number.isSafeInteger(value) && value >= 1_000 && value <= 15 * 60_000;
}

export function createOperationalTelemetryCircuitBreaker(
  options: CreateCircuitBreakerOptions = {},
): OperationalTelemetryCircuitBreaker {
  const cooldownMs = options.cooldownMs ?? OPERATIONAL_TELEMETRY_COOLDOWN_MS;
  if (!validCooldown(cooldownMs)) throw new Error("Invalid operational telemetry cooldown.");
  const now = options.now ?? Date.now;
  let disabledUntil = 0;
  return {
    isOpen() {
      return now() < disabledUntil;
    },
    trip() {
      disabledUntil = Math.max(disabledUntil, now() + cooldownMs);
    },
    openUntil() {
      return disabledUntil;
    },
  };
}

export function createOperationalTelemetryScope(
  options: CreateOperationalTelemetryScopeOptions,
): OperationalTelemetryScope {
  return {
    database: options.database ?? null,
    defer: options.defer,
    circuitBreaker: options.circuitBreaker,
    queuedEvents: [],
    finished: false,
  };
}

function isWorkerRequestEvent(event: ObservabilityEventV1) {
  return event.eventName === "worker.request" || event.eventName === "worker.exception";
}

function isD1CapacityFailure(event: ObservabilityEventV1) {
  return event.eventName === "d1.operation"
    && (event.outcome === "internal_failure" || event.reason === "busy" || event.reason === "timeout");
}

function enqueueOperationalEvent(scope: OperationalTelemetryScope, event: ObservabilityEventV1) {
  if (scope.finished || scope.circuitBreaker.isOpen()) return;
  if (scope.queuedEvents.length < MAX_OPERATIONAL_EVENT_INSERTS_PER_BATCH) {
    scope.queuedEvents.push(event);
  }
}

export function observeWorkerRequestEventCore(
  input: ObservabilityEventInput,
  options: ObserveWorkerRequestEventCoreOptions,
): ObservabilityEventV1 | null {
  let event: ObservabilityEventV1;
  try {
    event = createObservabilityEvent(input, options.identity);
  } catch {
    return null;
  }
  if (!isWorkerRequestEvent(event)) return null;
  emitStructuredObservability(event, options.sink);
  return event;
}

export function observeOperationalEventCore(
  input: ObservabilityEventInput,
  options: ObserveOperationalEventCoreOptions,
): ObservabilityEventV1 | null {
  let event: ObservabilityEventV1;
  try {
    event = createObservabilityEvent(input, options.identity);
  } catch {
    return null;
  }

  // Worker request outcomes belong exclusively to the platform log stream.
  // This defensive branch keeps them out of D1 even if a caller uses the
  // product-operation API accidentally.
  if (isWorkerRequestEvent(event)) {
    emitStructuredObservability(event, options.sink);
    return event;
  }

  if (!shouldEmitOperationalAnomaly(event)) return event;
  emitStructuredObservability(event, options.sink);
  if (options.scope && isD1CapacityFailure(event)) {
    options.scope.queuedEvents.length = 0;
    options.scope.circuitBreaker.trip();
    return event;
  }
  if (shouldPersistOperationalAnomaly(event) && options.scope) enqueueOperationalEvent(options.scope, event);
  return event;
}

export function flushOperationalTelemetryScope(scope: OperationalTelemetryScope): void {
  if (scope.finished) return;
  scope.finished = true;
  if (!scope.database || scope.queuedEvents.length === 0) return;
  if (scope.circuitBreaker.isOpen()) return;

  let persistence: Promise<void>;
  try {
    persistence = Promise.resolve(persistOperationalEvents(scope.database, scope.queuedEvents));
  } catch {
    scope.circuitBreaker.trip();
    return;
  }
  const failOpenPersistence = persistence.catch(() => {
    scope.circuitBreaker.trip();
  });
  try {
    scope.defer?.(failOpenPersistence);
  } catch {
    void failOpenPersistence.catch(() => undefined);
  }
  if (!scope.defer) void failOpenPersistence.catch(() => undefined);
}
