import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { lstatSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, relative, resolve, sep } from "node:path";

// Static offline integrity check; never represented as a browser/device test.
const root = resolve(process.argv[2] ?? ".artifacts/canopy-v2");
const files = (directory) => readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
  const path = resolve(directory, entry.name);
  assert.ok(!lstatSync(path).isSymbolicLink(), "Portable packet cannot depend on a symlink");
  return entry.isDirectory() ? files(path) : [path];
});
const inventory = files(root).sort();
const local = path => relative(root, path).replaceAll("\\", "/");
const hash = path => createHash("sha256").update(readFileSync(path)).digest("hex");
const manifestPath = resolve(root, "SHA256SUMS.txt");
if (process.argv.includes("--write-manifest")) {
  writeFileSync(manifestPath, inventory.filter(path => path !== manifestPath).map(path => `${hash(path)}  ${local(path)}`).join("\n") + "\n");
}
const declared = new Set();
for (const line of readFileSync(manifestPath, "utf8").trim().split(/\r?\n/u)) {
  const match = /^([a-f0-9]{64})  (.+)$/u.exec(line); assert.ok(match, "Malformed checksum line");
  const path = resolve(root, match[2]);
  assert.ok(!isAbsolute(match[2]), "Checksum paths must be relative");
  assert.equal(local(path), match[2], "Checksum paths must be canonical packet-relative paths");
  assert.ok(!declared.has(local(path)), "Duplicate checksum entry");
  assert.ok(path.startsWith(root + sep), "Checksum path escapes packet");
  assert.equal(hash(path), match[1], "Checksum mismatch: " + match[2]); declared.add(local(path));
}
assert.deepEqual([...declared].sort(), inventory.filter(path => path !== manifestPath).map(local).sort(), "Every packet file must be checksummed");
let links = 0;
for (const path of inventory.filter(path => /\.(?:html|css|md)$/iu.test(path))) {
  const content = readFileSync(path, "utf8");
  if (/\.html$/iu.test(path)) assert.ok(!/<(?:script|iframe|object|embed|form)\b|\b(?:srcset|srcdoc|http-equiv)\s*=|@import|image-set\s*\(/iu.test(content), "Packet HTML must remain self-contained static markup");
  if (/\.css$/iu.test(path)) assert.ok(!/@import/iu.test(content), "External CSS imports are not portable");
  assert.ok(!/\b(?:fetch\s*\(|XMLHttpRequest|serviceWorker)/u.test(content) || !/\.html$/iu.test(path), "Offline HTML may not fetch a server");
  const targets = /\.md$/iu.test(path)
    ? [...content.matchAll(/\]\(([^)]+)\)/gu)].map(match => match[1])
    : [...content.matchAll(/(?:href|src)\s*=\s*["']([^"']+)["']|url\(\s*["']?([^)'"\s]+)["']?\s*\)/giu)].map(match => match[1] ?? match[2]);
  for (let target of targets) {
    target = target.replace(/^<|>$/gu, "").replaceAll("&amp;", "&");
    if (target.startsWith("data:")) continue;
    assert.ok(!/^[a-z][a-z0-9+.-]*:/iu.test(target) && !target.startsWith("//") && !isAbsolute(target), "Nonportable link: " + target);
    const [pathname, fragment] = target.split("#");
    const dest = pathname ? resolve(dirname(path), decodeURIComponent(pathname.split("?")[0])) : path;
    assert.ok(dest === root || dest.startsWith(root + sep), "Link escapes packet: " + target);
    assert.ok(lstatSync(dest).isFile(), "Missing linked file: " + target);
    if (fragment && /\.html$/iu.test(dest)) {
      const ids = [...readFileSync(dest, "utf8").matchAll(/\bid\s*=\s*["']([^"']+)["']/giu)].map(match => match[1]);
      assert.ok(ids.includes(decodeURIComponent(fragment)), "Missing HTML fragment: " + target);
    }
    links++;
  }
}
console.log(JSON.stringify({ kind: "static-offline-integrity", checkedAt: new Date().toISOString(), files: declared.size, links, checksums: "pass", relativeTargetsInsidePacket: "pass", networkRequired: false, browserOpened: false, presentationDeviceOpened: false }, null, 2));
