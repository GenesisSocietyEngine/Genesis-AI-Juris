import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { verifyMobileCheckoutState } from "./mobile-checkout-guard";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const lock = JSON.parse(readFileSync(join(projectRoot, "parity", "mobile-parity.lock.json"), "utf8")) as {
  mobile?: { commit?: unknown };
};
const mobileRepo = process.argv[2]?.trim();
if (!mobileRepo) throw new Error("mobile checkout path is required");
if (typeof lock.mobile?.commit !== "string") throw new Error("mobile parity lock commit is missing");

verifyMobileCheckoutState(resolve(mobileRepo), lock.mobile.commit);
console.log(`PASS final mobile checkout guard: tracked bytes still equal ${lock.mobile.commit}`);
