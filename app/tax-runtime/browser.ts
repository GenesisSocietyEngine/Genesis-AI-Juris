import init, { execute_tax_json } from "./generated/juris_tax_wasm.js";
import wasmUrl from "./generated/juris_tax_wasm_bg.wasm?url";
import { createTaxRuntimeLoader } from "./runtime";

/** Vite resolves the versioned asset URL; no Node or Worker imports reach the browser. */
export const loadBrowserTaxRuntime = createTaxRuntimeLoader(async () => {
  const response = await fetch(wasmUrl);
  if (!response.ok) throw new Error(`Tax WebAssembly asset returned HTTP ${response.status}.`);
  await init({ module_or_path: response });
  return execute_tax_json;
});
