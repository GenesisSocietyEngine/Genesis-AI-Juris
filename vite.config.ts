import vinext from "vinext";
import { defineConfig, type Plugin } from "vite";
import hostingConfig from "./.openai/hosting.json" with { type: "json" };
import { sites } from "./build/sites-vite-plugin.ts";
import { buildReleaseIdentity } from "./build/release-identity.ts";
import { taxRuntime } from "./build/tax-runtime-plugin.ts";

const SITE_CREATOR_PLACEHOLDER_DATABASE_ID =
  "00000000-0000-4000-8000-000000000000";

const { d1, r2 } = hostingConfig;

// macOS Seatbelt blocks FSEvents, so Codex previews need polling for HMR.
const isCodexSeatbeltSandbox = process.env.CODEX_SANDBOX === "seatbelt";

const localBindingConfig = {
  main: "./worker/index.ts",
  compatibility_flags: ["nodejs_compat"],
  d1_databases: d1
    ? [
        {
          binding: d1,
          database_name: "site-creator-d1",
          database_id: SITE_CREATOR_PLACEHOLDER_DATABASE_ID,
        },
      ]
    : [],
  r2_buckets: r2
    ? [
        {
          binding: r2,
          bucket_name: "site-creator-r2",
        },
      ]
    : [],
};

export default defineConfig(async () => {
  const identity = buildReleaseIdentity(process.cwd());
  const packagedIdentity = Object.fromEntries(Object.entries(identity).filter(([key]) => key !== "files"));
  // Keep Wrangler and Miniflare state project-local. These are non-secret tool
  // settings; application environment belongs in ignored `.env*` files.
  process.env.WRANGLER_WRITE_LOGS ??= "false";
  process.env.WRANGLER_LOG_PATH ??= ".wrangler/logs";
  process.env.MINIFLARE_REGISTRY_PATH ??= ".wrangler/registry";

  // Wrangler snapshots its log path while the Cloudflare plugin is imported.
  const { cloudflare } = await import("@cloudflare/vite-plugin");

  return {
    define: { __GENESIS_BUILD_IDENTITY__: JSON.stringify(packagedIdentity) },
    server: {
      host: "0.0.0.0",
      allowedHosts: ["terminal.local"],
      ...(isCodexSeatbeltSandbox
        ? { watch: { useFsEvents: false, usePolling: true } }
        : {}),
    },
    plugins: [
      vinext(),
      {
        name: "exclude-declarations-from-development-scan",
        apply: "serve",
        configEnvironment(_name, environment) {
          // Vinext's app/**/*.ts entry glob also matches wasm-bindgen's .d.ts
          // declarations. They describe modules but are never executable entries.
          if (environment.optimizeDeps?.entries) {
            const entries = environment.optimizeDeps.entries;
            environment.optimizeDeps.entries = [
              ...(typeof entries === "string" ? [entries] : entries),
              "!**/*.d.ts",
            ];
          }
        },
      } satisfies Plugin,
      taxRuntime({ sourceCommit: identity.sourceCommit, applicationInputsSha256: identity.applicationInputsSha256 }),
      sites(identity),
      cloudflare({
        viteEnvironment: { name: "rsc", childEnvironments: ["ssr"] },
        inspectorPort: false,
        config: localBindingConfig,
      }),
    ],
  };
});
