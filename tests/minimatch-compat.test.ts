import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import test from 'node:test';
import { ESLint } from 'eslint';

const require = createRequire(import.meta.url);
const matcher = require('minimatch');

test('all actual lint consumer families resolve the patched callable and named API', () => {
  const consumers = ['eslint', '@eslint/config-array', '@eslint/eslintrc', 'eslint-plugin-import', 'eslint-plugin-jsx-a11y', 'eslint-plugin-react', '@typescript-eslint/typescript-estree'];
  for (const consumer of consumers) {
    const fromConsumer = createRequire(require.resolve(consumer))('minimatch');
    assert.equal(fromConsumer, matcher, consumer);
    assert.equal(typeof fromConsumer, 'function', consumer);
    assert.equal(fromConsumer.minimatch('app/file.ts', '**/*.ts'), true, consumer);
    assert.equal(new fromConsumer.Minimatch('*.ts', { matchBase: true }).match('app/file.ts'), true, consumer);
  }
  assert.equal(require('@casevant/minimatch-engine/package.json').version, '11.0.1');
  assert.equal(require('minimatch/package.json').version, '11.0.1+casevant.compat.1');
});

test('representative lint glob contracts retain negation, braces, dot and basename behavior', () => {
  const cases: Array<[string, string, Record<string, unknown>, boolean]> = [
    ['app/a.ts', '**/*.ts', {}, true], ['app/a.js', '**/*.ts', {}, false],
    ['app/deep/a.tsx', '**/*.{ts,tsx}', {}, true], ['app/deep/a.jsx', '**/*.{ts,tsx}', {}, false],
    ['.hidden/a.ts', '**/*.ts', {}, false], ['.hidden/a.ts', '**/*.ts', { dot: true }, true],
    ['app/a.test.ts', '!**/*.test.ts', {}, false], ['app/a.ts', '!**/*.test.ts', {}, true],
    ['app/File.TS', '**/*.ts', { nocase: true }, true], ['app/File.TS', '**/*.ts', {}, false],
    ['app/a.ts', '*.ts', {}, false], ['app/a.ts', '*.ts', { matchBase: true }, true],
    ['#comment', '#comment', {}, false], ['#comment', '#comment', { nocomment: true }, true],
    ['app/a.spec.ts', '**/*.@(spec|test).ts', {}, true], ['app/a.ts', '**/*.@(spec|test).ts', {}, false],
  ];
  for (const [filename, pattern, options, expected] of cases) {
    assert.equal(matcher(filename, pattern, options), expected, `${filename}: ${pattern}`);
    assert.equal(new matcher.Minimatch(pattern, options).match(filename), expected, `class ${filename}: ${pattern}`);
  }
  assert.deepEqual(matcher.braceExpand('*.{js,ts}'), ['*.js', '*.ts']);
  assert.deepEqual(matcher.match(['a.ts', 'b.js', 'c.ts'], '*.ts'), ['a.ts', 'c.ts']);
  assert.deepEqual(['a.ts', 'b.js'].filter(matcher.filter('*.ts')), ['a.ts']);
  assert.equal(matcher.makeRe('**/*.ts').test('app/a.ts'), true);
  assert.equal(matcher.defaults({ nocase: true })('FILE.TS', '*.ts'), true);
  assert.equal(new matcher.Minimatch('src/**/*.ts', { platform: 'win32', windowsPathsNoEscape: true }).match('src\\nested\\file.ts'), true);
  assert.equal(new matcher.Minimatch('src/**/*.ts', { platform: 'linux' }).match('src/nested/file.ts'), true);
});

test('the actual ESLint and JSX accessibility consumer still select files and report diagnostics', async () => {
  const jsx = require('eslint-plugin-jsx-a11y');
  const imports = require('eslint-plugin-import');
  const eslint = new ESLint({ overrideConfigFile: true, overrideConfig: [{
    files: ['**/*.{js,jsx}'], languageOptions: { parserOptions: { ecmaFeatures: { jsx: true } } },
    plugins: { 'jsx-a11y': jsx, import: imports }, rules: { 'no-unused-vars': 'error', 'jsx-a11y/alt-text': 'error', 'import/no-internal-modules': ['error', { forbid: ['library/internal/**'] }] },
  }] });
  const [invalid] = await eslint.lintText('const unused = 1; const image = <img src="synthetic.png" />;', { filePath: 'synthetic/check.jsx' });
  assert.ok(invalid.messages.some(message => message.ruleId === 'no-unused-vars'));
  assert.ok(invalid.messages.some(message => message.ruleId === 'jsx-a11y/alt-text'));
  const [valid] = await eslint.lintText('export default <img src="synthetic.png" alt="Synthetic test" />;', { filePath: 'synthetic/check.jsx' });
  assert.equal(valid.errorCount, 0);
  const [forbidden] = await eslint.lintText('import "library/internal/source";', { filePath: 'synthetic/check.js' });
  assert.ok(forbidden.messages.some(message => message.ruleId === 'import/no-internal-modules'));
  const [allowed] = await eslint.lintText('import "library/public";', { filePath: 'synthetic/check.js' });
  assert.equal(allowed.errorCount, 0);
});

test('patched glob preprocessing stays bounded for a representative parent/globstar pattern', () => {
  const result = spawnSync(process.execPath, ['-e', `
    const {Minimatch}=require('minimatch');
    const pattern=Array(12).fill('**/..').join('/')+'/synthetic';
    const matcher=new Minimatch(pattern,{optimizationLevel:2});
    console.log(JSON.stringify({parts:matcher.globParts.length,matched:matcher.match('synthetic')}));
  `], { cwd: process.cwd(), encoding: 'utf8', timeout: 5000 });
  assert.ifError(result.error);
  assert.equal(result.status, 0, result.stderr);
  const output = JSON.parse(result.stdout);
  assert.ok(output.parts <= 64, 'small fixture must not amplify into an unbounded pattern set');
  assert.equal(typeof output.matched, 'boolean');
});
