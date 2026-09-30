import { deriveWebTaxSource, WEB_TAX_SOURCE_SCHEMA, type WebTaxSource } from "../studio-tax-source";
import type { StudioDraft } from "../types";
import { TAX_RUNTIME_CONTRACT, TaxRuntimeError, type TaxRuntime } from "./runtime";

type JsonObject = Record<string, unknown>;
export type WebTaxExecution = { source: WebTaxSource; request: string; response: string };

/** Host-neutral command construction only. Rust owns financial/input validation.
 * This repository does not adopt async results or write drafts: a future editor
 * must fence adoption on source/artifact/edit/authority identity and attempt.
 */
export function createWebTaxRepository(loadRuntime: () => Promise<TaxRuntime>) {
  let pending: Promise<TaxRuntime> | undefined;
  const ready = () => pending ??= Promise.resolve().then(loadRuntime).then(runtime => {
    let capability: unknown;
    try { capability = JSON.parse(runtime.execute('{"command":"tax_web_capabilities"}')); }
    catch (cause) { throw new TaxRuntimeError("incompatible_runtime", "This Rust runtime does not support the web tax source contract.", { cause }); }
    const expected = { ...TAX_RUNTIME_CONTRACT, type: "tax_web_capabilities", source_schema: WEB_TAX_SOURCE_SCHEMA };
    if (!capability || typeof capability !== "object" ||
        Object.entries(expected).some(([key, value]) => Reflect.get(capability, key) !== value) ||
        JSON.stringify(Reflect.get(capability, "currencies")) !== JSON.stringify(["EUR", "GBP", "USD"])) {
      throw new TaxRuntimeError("incompatible_runtime", "The web source capability does not match this application.");
    }
    return runtime;
  });
  async function execute(draft: StudioDraft, command: JsonObject): Promise<WebTaxExecution> {
    const snapshot = structuredClone(command);
    const sourcePending = deriveWebTaxSource(draft);
    const [source, runtime] = await Promise.all([sourcePending, ready()]);
    const request = JSON.stringify({ ...snapshot, source: source.descriptor });
    return { source, request, response: runtime.execute(request) };
  }
  return Object.freeze({
    ready,
    prepare: (draft: StudioDraft, input: { artifact_id: string; revision: string; currency: string }) => execute(draft, { ...input, command: "tax_web_prepare" }),
    calculate: (draft: StudioDraft, input: { request: JsonObject; bindings: JsonObject[]; required_component_ids: string[] }) => execute(draft, { ...input, command: "tax_web_calculate" }),
    importLegacy: (draft: StudioDraft, input: { artifact_id: string; revision: string; schema: "web_amounts_v1" | "web_rates_fx_v1"; original_json: string }) => execute(draft, { ...input, command: "tax_web_import" }),
  });
}
