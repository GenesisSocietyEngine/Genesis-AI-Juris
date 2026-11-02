'use strict';

// Lint consumers use both the historical callable CommonJS API and modern
// named exports. Every operation delegates to the pinned, patched engine;
// this adapter includes no historical matcher or glob preprocessing code.
// eslint-disable-next-line @typescript-eslint/no-require-imports -- Consumers require a synchronous CommonJS callable entry.
const engine = require('@casevant/minimatch-engine');
const matcher = Object.assign(engine.minimatch, engine);
matcher.Minimatch.GLOBSTAR = engine.GLOBSTAR;
// eslint-plugin-import/no-internal-modules consumes only makeRe(...).test(...).
// v11 intentionally has no regex compiler. Keep that used test interface
// explicit, with every match delegated to the nonrecursive patched engine.
matcher.makeRe = (pattern, options) => {
  const compiled = new engine.Minimatch(pattern, options);
  return Object.freeze({ test: value => compiled.match(value) });
};
module.exports = matcher;
