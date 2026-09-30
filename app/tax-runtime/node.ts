import { readFile } from "node:fs/promises";
import init, { execute_tax_json } from "./generated/juris_tax_wasm.js";
import { createTaxRuntimeLoader } from "./runtime";
import { createWebTaxRepository } from "./web-repository";
export { deriveWebTaxSource, canonicalWebTaxJson } from "../studio-tax-source";

/** Explicit Node entry for offline report tools. Never import this from a Worker. */
export const loadNodeTaxRuntime = createTaxRuntimeLoader(async () => {
  const bytes = await readFile(new URL("./generated/juris_tax_wasm_bg.wasm", import.meta.url));
  await init({ module_or_path: bytes });
  return execute_tax_json;
});
export const webTaxRepository = createWebTaxRepository(loadNodeTaxRuntime);
