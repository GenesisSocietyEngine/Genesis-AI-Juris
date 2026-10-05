'use strict';

// Bound both parser nesting and public AST walkers independently of input length.
const MAX_DEPTH = 100;
const assertDepth = (depth, limit = MAX_DEPTH) => {
  if (depth > limit) {
    throw new SyntaxError(`Brace pattern nesting exceeds maximum depth (${MAX_DEPTH})`);
  }
};

const assertAstDepth = depth => assertDepth(depth, MAX_DEPTH + 1);

module.exports = { MAX_DEPTH, assertDepth, assertAstDepth };
