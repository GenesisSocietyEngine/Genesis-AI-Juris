import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);

for (const major of [2, 4]) {
  test(`CV-033 picomatch ${major}: repeated wildcard rejection is bounded`, () => {
    const script = `
      const assert = require('node:assert/strict');
      const pm = require('./vendor/picomatch${major}');
      for (const options of [{}, {maxExtglobRecursion:false}]) {
        for (const pattern of ['+(*)b', '+(*a)b', '*(*)b', '*(*a)b', '+(a*)b', '+(?(a))b']) {
          const match = pm(pattern, options);
          assert.equal(match('a'.repeat(10000) + '!'), false);
          assert.equal(match('aaaaab'), false);
        }
      }
    `;
    const result = spawnSync(process.execPath, ['-e', script], { timeout: 5000, encoding: 'utf8' });
    assert.equal(result.error, undefined);
    assert.equal(result.status, 0, result.stderr);
  });
  test(`CV-033 picomatch ${major}: ordinary build globs retain semantics`, () => {
    const pm = require(`../vendor/picomatch${major}`);
    for (const [pattern, yes, no] of [
      ['**/*.{ts,tsx}', 'app/reports/model.ts', 'app/reports/model.js'],
      ['**/+(test|spec).ts', 'tests/test.ts', 'tests/other.ts'],
      ['+(ab)', 'abab', 'abc'],
      ['src/!(vendor)/*.js', 'src/app/main.js', 'src/vendor/main.js'],
    ]) {
      assert.equal(pm(pattern)(yes), true, pattern);
      assert.equal(pm(pattern)(no), false, pattern);
    }
  });
}
import { readFileSync } from "node:fs";
test("CV-033 lock routes both major lines to checked-in maintained code", () => {
  const lock = JSON.parse(readFileSync(new URL("../package-lock.json", import.meta.url), "utf8"));
  assert.equal(lock.packages["node_modules/picomatch"].resolved, "vendor/picomatch4");
  assert.equal(lock.packages["node_modules/micromatch/node_modules/picomatch"].resolved, "vendor/picomatch2");
  for (const [name, value] of Object.entries(lock.packages) as [string, { resolved?: string }][]) {
    if (name.endsWith("/picomatch")) {
      assert.ok(["vendor/picomatch2", "vendor/picomatch4"].includes(value.resolved ?? ""), name);
    }
  }
});
