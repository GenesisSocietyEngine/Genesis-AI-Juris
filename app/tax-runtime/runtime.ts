/** Readiness and transport only. Financial and request validation stay in Rust. */
export const TAX_RUNTIME_CONTRACT = Object.freeze({
  type: "tax_capabilities",
  transport_protocol: "tax-economics-json-v1",
  input_schema: "tax-economics-input-v2",
  result_schema: "tax-economics-result-v2",
  calculation_version: "tax-economics-2026-09-29",
  application_policy: "tax-editor-v1",
  max_request_bytes: 262144,
});

export type RawTaxExecutor = (encoded: string) => string | undefined;
export interface TaxRuntime {
  readonly capabilities: Readonly<typeof TAX_RUNTIME_CONTRACT>;
  /** Preserve the complete JSON string, including decimal money and revisions. */
  execute(encoded: string): string;
}

export class TaxRuntimeError extends Error {
  constructor(public readonly code: "initialization_failed" | "incompatible_runtime" | "unsupported_command" | "execution_failed", message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "TaxRuntimeError";
  }
}

export function checkedTaxRuntime(execute: RawTaxExecutor): TaxRuntime {
  let capabilities: unknown;
  try {
    const encoded = execute('{"command":"tax_capabilities"}');
    capabilities = encoded === undefined ? undefined : JSON.parse(encoded);
  } catch (cause) {
    throw new TaxRuntimeError("incompatible_runtime", "The Rust tax runtime did not return its capabilities.", { cause });
  }
  if (!capabilities || typeof capabilities !== "object" ||
      Object.entries(TAX_RUNTIME_CONTRACT).some(([key, value]) => Reflect.get(capabilities, key) !== value) ||
      JSON.stringify(Reflect.get(capabilities, "currencies")) !== JSON.stringify(["EUR", "GBP", "USD"])) {
    throw new TaxRuntimeError("incompatible_runtime", "The Rust tax runtime version does not match this application.");
  }
  return Object.freeze({
    capabilities: TAX_RUNTIME_CONTRACT,
    execute(encoded: string) {
      let response: string | undefined;
      try { response = execute(encoded); }
      catch (cause) { throw new TaxRuntimeError("execution_failed", "The Rust tax runtime could not execute the command.", { cause }); }
      if (response === undefined) throw new TaxRuntimeError("unsupported_command", "The command is not part of the Rust tax protocol.");
      return response;
    },
  });
}

/** Cache success and failure. A failed loader never silently retries or falls back. */
export function createTaxRuntimeLoader(initialize: () => Promise<RawTaxExecutor>) {
  let pending: Promise<TaxRuntime> | undefined;
  return () => pending ??= Promise.resolve().then(initialize).then(checkedTaxRuntime).catch((cause: unknown) => {
    if (cause instanceof TaxRuntimeError) throw cause;
    throw new TaxRuntimeError("initialization_failed", "The Rust tax runtime could not load. Reload the application to retry.", { cause });
  });
}
