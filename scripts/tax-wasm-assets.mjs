/** Owned generated assets. Verification needs Node only; regeneration needs pinned Rust/bindgen. */
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, readdirSync, mkdirSync, mkdtempSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { homedir } from "node:os";

const root = fileURLToPath(new URL("../", import.meta.url));
const output = "app/tax-runtime/generated";
const corpus = "tests/fixtures/tax-runtime/native-corpus.json";
const artifactNames = ["juris_tax_wasm.js", "juris_tax_wasm.d.ts", "juris_tax_wasm_bg.wasm", "juris_tax_wasm_bg.wasm.d.ts"];
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
const json = (value) => JSON.stringify(value, null, 2) + "\n";
const record = (path, base = root) => {
  const bytes = readFileSync(join(base, path));
  return { path, bytes: bytes.length, sha256: sha256(bytes) };
};
function sourceInputs() {
  const paths = ["Cargo.toml", "Cargo.lock", "rust-toolchain.toml", "scripts/tax-wasm-assets.mjs", "content/cases/unpaid_logistics_invoices.scenario.json"];
  function visit(path) {
    for (const entry of readdirSync(join(root, path), { withFileTypes: true })) {
      const next = `${path}/${entry.name}`;
      if (entry.isSymbolicLink()) throw new Error(`Source must not be a symlink: ${next}`);
      if (entry.isDirectory()) visit(next);
      else if (entry.name === "Cargo.toml" || entry.name.endsWith(".rs") || next.includes("juris-tax-economics/tests/fixtures/")) paths.push(next);
    }
  }
  visit("crates");
  // Rust include_str!/include_bytes! inputs outside crate src directories also
  // affect compilation (including the native reference corpus).
  const inputs = new Set(paths);
  for (const path of paths.filter(path => path.endsWith(".rs") && (path.includes("/src/") || path === "crates/juris-tax-wasm/examples/native_corpus.rs"))) {
    const source = readFileSync(join(root, path), "utf8");
    for (const match of source.matchAll(/include_(?:str|bytes)!\(\s*"([^"]+)"\s*\)/g)) {
      const included = relative(root, resolve(root, dirname(path), match[1])).replaceAll("\\", "/");
      if (included.startsWith("../")) throw new Error(`Rust include escapes the source tree: ${included}`);
      inputs.add(included);
    }
  }
  return [...inputs].sort().map(path => record(path));
}

export function verifyTaxWasmAssets() {
  const receipt = JSON.parse(readFileSync(join(root, output, "receipt.json"), "utf8"));
  if (receipt.schema !== "juris.tax-wasm-assets.v1" || receipt.rust !== "1.95.0" || receipt.wasmBindgen !== "0.2.128" || receipt.generatorHost !== "x86_64-pc-windows-msvc" || receipt.target !== "wasm32-unknown-unknown" || receipt.profile !== "tax-wasm") throw new Error("Unsupported tax WASM build receipt.");
  if (json(receipt.inputs) !== json(sourceInputs())) throw new Error("Rust tax sources changed: regenerate and review the tax WASM assets.");
  const artifacts = [...artifactNames.map(name => record(`${output}/${name}`)), record(corpus)];
  if (json(receipt.artifacts) !== json(artifacts)) throw new Error("Generated tax WASM asset or native corpus does not match its receipt.");
  return receipt;
}

function generate(check) {
  // Rust's embedded panic locations retain host path separators. Pin the
  // generator host rather than claiming cross-platform byte reproducibility.
  if (process.platform !== "win32" || process.arch !== "x64") throw new Error("Regenerate tax assets on the pinned Windows x64/MSVC host. Node-only asset verification works on every web build host.");
  const bindgen = process.env.WASM_BINDGEN || "wasm-bindgen";
  const env = { ...process.env };
  for (const key of Object.keys(env)) {
    if (/^(RUSTFLAGS|RUSTC|RUSTC_WRAPPER|RUSTC_WORKSPACE_WRAPPER|RUSTC_BOOTSTRAP|CARGO_ENCODED_RUSTFLAGS|CARGO_BUILD_TARGET)$/.test(key) ||
        /^CARGO_(PROFILE_|BUILD_RUST)/.test(key) ||
        (key.startsWith("CARGO_TARGET_") && key !== "CARGO_TARGET_DIR")) delete env[key];
  }
  const cargoHome = resolve(root, env.CARGO_HOME || join(homedir(), ".cargo"));
  env.CARGO_INCREMENTAL = "0";
  env.CARGO_ENCODED_RUSTFLAGS = [`--remap-path-prefix=${root}=juris/`, `--remap-path-prefix=${cargoHome}=cargo`].join("\x1f");
  const run = (command, args, options = {}) => execFileSync(command, args, { cwd: root, env, encoding: "utf8", ...options });
  if (run("rustc", ["+1.95.0", "--version"]).split(" ")[1] !== "1.95.0") throw new Error("Rust 1.95.0 is required.");
  if (!run("rustc", ["+1.95.0", "-vV"]).split(/\r?\n/).includes("host: x86_64-pc-windows-msvc")) throw new Error("The generator requires the pinned MSVC Rust host.");
  if (run(bindgen, ["--version"]).trim() !== "wasm-bindgen 0.2.128") throw new Error("wasm-bindgen CLI 0.2.128 is required.");
  mkdirSync(join(root, ".artifacts/tax-runtime"), { recursive: true });
  const staging = mkdtempSync(join(root, ".artifacts/tax-runtime/generated-"));
  run("cargo", ["+1.95.0", "build", "--locked", "-p", "juris-tax-wasm", "--target", "wasm32-unknown-unknown", "--profile", "tax-wasm"], { stdio: "inherit" });
  const target = resolve(root, process.env.CARGO_TARGET_DIR || "target");
  run(bindgen, [join(target, "wasm32-unknown-unknown/tax-wasm/juris_tax_wasm.wasm"), "--target", "web", "--omit-default-module-path", "--out-dir", staging, "--out-name", "juris_tax_wasm"]);
  const native = run("cargo", ["+1.95.0", "run", "--locked", "--quiet", "-p", "juris-tax-wasm", "--example", "native_corpus"]);
  const nativeBytes = Buffer.from(native.replace(/\r\n/g, "\n"));
  const artifacts = artifactNames.map(name => {
    const bytes = readFileSync(join(staging, name));
    return { path: `${output}/${name}`, bytes: bytes.length, sha256: sha256(bytes) };
  });
  artifacts.push({ path: corpus, bytes: nativeBytes.length, sha256: sha256(nativeBytes) });
  const receipt = { schema: "juris.tax-wasm-assets.v1", rust: "1.95.0", wasmBindgen: "0.2.128", generatorHost: "x86_64-pc-windows-msvc", target: "wasm32-unknown-unknown", profile: "tax-wasm", inputs: sourceInputs(), artifacts };
  if (check) {
    verifyTaxWasmAssets();
    if (json(receipt) !== readFileSync(join(root, output, "receipt.json"), "utf8")) throw new Error("Regeneration differs from committed tax runtime assets.");
  } else {
    mkdirSync(join(root, output), { recursive: true });
    mkdirSync(join(root, "tests/fixtures/tax-runtime"), { recursive: true });
    for (const name of artifactNames) writeFileSync(join(root, output, name), readFileSync(join(staging, name)));
    writeFileSync(join(root, corpus), nativeBytes);
    writeFileSync(join(root, output, "receipt.json"), json(receipt));
  }
  console.log(check ? "Tax runtime regeneration matches every committed byte." : "Tax runtime assets and complete native corpus generated.");
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const mode = process.argv[2] || "--verify";
  if (mode === "--generate" || mode === "--rebuild-check") generate(mode === "--rebuild-check");
  else if (mode === "--verify") { verifyTaxWasmAssets(); console.log("Tax runtime sources, generated assets and native corpus match."); }
  else throw new Error(`Unknown tax asset mode: ${mode}`);
}
