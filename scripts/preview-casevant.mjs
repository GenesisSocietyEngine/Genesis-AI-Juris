import { resolve } from "node:path";
import { createServer } from "vite";
import { localPreviewAuth } from "./lib/local-preview-auth.mjs";
if (process.argv.length !== 2) throw Error("Run from the CaseVant checkout: node scripts/preview-casevant.mjs");
const server = await createServer({ configFile: resolve("vite.config.ts"), plugins: [localPreviewAuth()], server: { host: "127.0.0.1", port: 4173, strictPort: true } });
await server.listen(); server.printUrls();
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => void server.close().then(() => process.exit(0)));
