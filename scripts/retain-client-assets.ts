import { resolve } from "node:path";
import { deploymentBuild } from "../build/deployment-assets";
import { retainPreviousClientAssets } from "../build/retained-client-assets";

const args = process.argv.slice(2), values = new Map<string, string>();
for (let index = 0; index < args.length; index += 2) {
  const name = args[index], value = args[index + 1];
  if (!["--previous-dist", "--expected-previous-commit", "--expected-current-commit"].includes(name) || values.has(name) || !value || value.startsWith("--")) throw new Error("Specify previous extracted dist and exact previous/current source commits");
  values.set(name, value);
}
if (values.size !== 3) throw new Error("Specify all previous/current artifact arguments");
const root = resolve(import.meta.dirname, ".."), current = values.get("--expected-current-commit")!;
deploymentBuild(root, current);
const previous = values.get("--expected-previous-commit")!;
const result = retainPreviousClientAssets(resolve(root, "dist"), resolve(values.get("--previous-dist")!), current, previous);
const checked = deploymentBuild(root, current, previous);
console.log(JSON.stringify({ ...result, locallyVerifiedAssets: checked.assets.length, currentAssets: checked.currentAssetCount, retainedPreviousAssets: checked.retainedPreviousAssetCount }));
