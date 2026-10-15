import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { deploymentBuild, verifyDeploymentAssets } from "./tests/deployment-assets";

const args = process.argv.slice(2), values = new Map<string, string>();
for (let index = 0; index < args.length; index += 2) {
  const name = args[index], value = args[index + 1];
  if (!["--url", "--expected-commit", "--output"].includes(name) || values.has(name) || !value || value.startsWith("--")) throw new Error("Usage: verify-deployment-assets.ts --url HTTPS_ORIGIN --expected-commit FULL_SHA --output RECEIPT_PATH");
  values.set(name, value);
}
if (values.size !== 3) throw new Error("Specify URL, exact expected commit and output receipt");
const root = resolve(import.meta.dirname, ".."), build = deploymentBuild(root, values.get("--expected-commit")!);
const { assets, ...identity } = build;
const receipt = { expectedBuild: identity, ...await verifyDeploymentAssets(values.get("--url")!, assets) };
const output = resolve(values.get("--output")!);
mkdirSync(dirname(output), { recursive: true }); writeFileSync(output, JSON.stringify(receipt, null, 2) + "\n");
console.log(JSON.stringify({ expectedBuild: identity, origin: receipt.origin, passed: receipt.passed, assets: receipt.assetCount, verified: receipt.verifiedCount, output, failed: receipt.assets.filter(asset => !asset.verified).map(({path,status,reason}) => ({path,status,reason})), deployedSourceVerified: false, browserHydrationVerified: false, authenticatedWorkflowsVerified: false }));
if (!receipt.passed) process.exitCode = 1;
