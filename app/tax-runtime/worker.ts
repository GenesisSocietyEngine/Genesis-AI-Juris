import { initSync, execute_tax_json } from "./generated/juris_tax_wasm.js";
import module from "./generated/juris_tax_wasm_bg.wasm?module";
import { createTaxRuntimeLoader } from "./runtime";
import { createWebTaxRepository } from "./web-repository";
export { deriveWebTaxSource, canonicalWebTaxJson } from "../studio-tax-source";

/** Cloudflare provides a precompiled module; workerd cannot compile fetched bytes. */
export const loadWorkerTaxRuntime = createTaxRuntimeLoader(async () => {
  if (!(module instanceof WebAssembly.Module)) throw new Error("A precompiled tax WebAssembly module is required.");
  initSync({ module });
  return execute_tax_json;
});
export const webTaxRepository = createWebTaxRepository(loadWorkerTaxRuntime);
