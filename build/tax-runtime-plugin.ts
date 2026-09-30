import { resolve } from "node:path";
import type { Plugin } from "vite";
import { verifyTaxWasmAssets } from "../scripts/tax-wasm-assets.mjs";

/** Package explicit entry points even before the editor/report adopts tax v2. */
export function taxRuntime(identity: { sourceCommit: string; applicationInputsSha256: string }): Plugin {
  const entries = new Map<string, string>();
  return {
    name: "juris-tax-runtime",
    apply: "build",
    configResolved() { verifyTaxWasmAssets(); },
    buildStart() {
      const environment = this.environment.name;
      if (!["client", "rsc", "ssr"].includes(environment)) return;
      entries.set(environment, this.emitFile({
        type: "chunk",
        id: resolve("app/tax-runtime", environment === "client" ? "browser.ts" : "worker.ts"),
        name: "tax-runtime",
        preserveSignature: "strict",
      }));
    },
    generateBundle() {
      const environment = this.environment.name;
      const entry = entries.get(environment);
      if (!entry) return;
      this.emitFile({
        type: "asset", fileName: "tax-runtime-entry.json",
        source: JSON.stringify({ schema: "juris.tax-runtime-entry.v1", environment, entry: this.getFileName(entry), ...identity }) + "\n",
      });
    },
  };
}
