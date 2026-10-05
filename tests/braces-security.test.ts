import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";

const require = createRequire(import.meta.url);
const braces = require("../vendor/braces");
const installed = createRequire(require.resolve("micromatch"))("braces");
const controlledDepthError = (error: unknown) => error instanceof SyntaxError && /nesting exceeds maximum depth/.test(error.message);
const nested = (open: string, close: string, depth: number) => open.repeat(depth) + "a" + close.repeat(depth);

test("the actual build dependency uses the reviewed bounded fork", () => {
  assert.equal(installed, braces);
  assert.equal(createRequire(require.resolve("micromatch"))("braces/package.json").name, "@casevant/braces");
});

test("all string entry points reject excessive braces, parentheses and mixed nesting", () => {
  for (const depth of [101, 4000]) {
    for (const pattern of [nested("{", "}", depth), nested("(", ")", depth), nested("{(", ")}", Math.ceil(depth / 2))]) {
      for (const method of [braces, braces.create, braces.parse, braces.compile, braces.expand, braces.stringify]) {
        assert.throws(() => method(pattern), controlledDepthError);
      }
    }
  }
  assert.throws(() => braces(nested("{", "}", 101), { maxDepth: Infinity, maxLength: Infinity }), controlledDepthError);
});

test("ordinary patterns, ranges, escapes and the depth boundary retain their behavior", () => {
  assert.deepEqual(braces.expand("src/{app,lib}/file{1..2}.ts"), ["src/app/file1.ts", "src/app/file2.ts", "src/lib/file1.ts", "src/lib/file2.ts"]);
  assert.deepEqual(braces("a/{b,c}/d"), ["a/(b|c)/d"]);
  for (const depth of [1, 99, 100]) {
    const pattern = nested("{", "}", depth);
    assert.equal(braces.compile(pattern), pattern);
    assert.deepEqual(braces.expand(pattern), [pattern]);
    assert.equal(braces.stringify(pattern), pattern);
  }
  for (const literal of ['"' + "{".repeat(150) + '"', "\\{".repeat(150), "[" + "{".repeat(150) + "]"]) {
    assert.doesNotThrow(() => braces(literal));
  }
  const micromatch = require("micromatch");
  assert.deepEqual(micromatch(["app/a.ts", "lib/b.ts", "other/c.ts"], "{app,lib}/**/*.ts"), ["app/a.ts", "lib/b.ts"]);
});

test("public AST walkers bound caller-supplied trees before stack exhaustion", () => {
  const makeAst = () => {
    let node = { type: "root", nodes: [] as object[] };
    const root = node;
    for (let i = 0; i < 4000; i++) {
      const child = { type: "root", nodes: [] as object[] };
      node.nodes.push(child);
      node = child;
    }
    return root;
  };
  for (const method of [braces.compile, braces.expand, braces.stringify]) {
    assert.throws(() => method(makeAst()), controlledDepthError);
  }
});
