import { readFileSync } from "node:fs";
import { extractPublishedStudioArtifact } from "./lib/published-studio-artifact.mjs";
const args = process.argv.slice(2);
if (args.length !== 6 || args[0] !== "--archive" || args[2] !== "--receipt" || args[4] !== "--output") throw Error("Usage: --archive ARCHIVE --receipt NATIVE_RECEIPT --output NEW_ARTIFACT_DIRECTORY");
const result = extractPublishedStudioArtifact(args[1], JSON.parse(readFileSync(args[3], "utf8")), args[5]);
console.log(JSON.stringify({ ...result, fileHashes: `${result.fileCount} exact-file hashes in artifact-inspection.json` }));
