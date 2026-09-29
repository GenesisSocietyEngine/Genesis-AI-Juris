import { access, cp, mkdir, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { Plugin } from "vite";
import { buildReleaseIdentity } from "./release-identity.ts";

async function exists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return false;
    }
    throw error;
  }
}

// Packages Sites metadata and migrations after Vite finishes compiling.
export function sites(identity?: ReturnType<typeof buildReleaseIdentity>): Plugin {
  let root = process.cwd();

  return {
    name: "sites",
    apply: "build",
    configResolved(config) {
      root = config.root;
    },
    async closeBundle() {
      if (identity) {
        const after = buildReleaseIdentity(root);
        if (after.applicationInputsSha256 !== identity.applicationInputsSha256 || after.hostingConfigSha256 !== identity.hostingConfigSha256) {
          throw new Error("Release inputs changed during compilation; rebuild from a stable source tree.");
        }
      }
      const outputDirectory = resolve(root, "dist", ".openai");
      const hostingConfig = resolve(root, ".openai", "hosting.json");
      const drizzleSource = resolve(root, "drizzle");

      await rm(outputDirectory, { recursive: true, force: true });
      await mkdir(outputDirectory, { recursive: true });
      if (identity) await writeFile(resolve(outputDirectory, "release-provenance.json"), `${JSON.stringify(identity, null, 2)}\n`, "utf8");

      if (await exists(hostingConfig)) {
        await cp(hostingConfig, resolve(outputDirectory, "hosting.json"));
      }
      if (await exists(drizzleSource)) {
        await cp(drizzleSource, resolve(outputDirectory, "drizzle"), {
          recursive: true,
        });
      }
    },
  };
}
