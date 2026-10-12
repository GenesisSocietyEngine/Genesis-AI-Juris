import { spawnSync } from 'node:child_process';
// Preserve the Linux release gate; use equivalent argument arrays on portable Windows hosts.
const commands = process.platform === 'win32' ? [
  [process.execPath, 'node_modules/typescript/bin/tsc', '--noEmit', '--incremental', 'false'],
  [process.execPath, 'scripts/tax-wasm-assets.mjs', '--verify'],
  [process.execPath, '--experimental-sqlite', '--import', 'tsx', '--test', '--test-name-pattern=every D1 migration breakpoint', 'tests/dossier-persistence.test.ts'],
  [process.execPath, '--import', 'tsx', 'scripts/verify-mobile-parity.ts', '--lock-only'],
  [process.execPath, 'node_modules/vinext/dist/cli.js', 'build'],
] : [['bash', 'scripts/build-verified.sh']];
for (const [command, ...args] of commands) {
  const result = spawnSync(command, args, { stdio: 'inherit', windowsHide: true, timeout: 300000 });
  if (result.error) console.error(result.error.message);
  if (result.status !== 0) process.exit(result.status ?? 1);
}
