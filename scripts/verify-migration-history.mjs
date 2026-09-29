import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const MIGRATION_HISTORY_REVISIONS = Object.freeze({
  rollback: 'bf5799383a52b6617cd9d4a0acf47af780086218',
  defectiveMigration: 'e256660f5e7d5c88ffe4dc0076ead74a70d18b1b',
});

export function verifyMigrationHistory(repository = process.cwd()) {
  const root = resolve(repository);
  const repositoryCheck = spawnSync('git', ['-C', root, 'rev-parse', '--git-dir'], {
    encoding: 'utf8', windowsHide: true,
  });
  if (repositoryCheck.status !== 0) throw new Error([
    'Migration compatibility preflight could not inspect the Git repository.',
    repositoryCheck.error?.message ?? repositoryCheck.stderr?.trim() ?? `git exited ${repositoryCheck.status}`,
    'Check Git installation, repository access and trust before retrying; missing history has not been established.',
  ].join('\n'));
  const diagnostics = [];
  const missing = Object.values(MIGRATION_HISTORY_REVISIONS).filter(revision => {
    const result = spawnSync('git', ['-C', root, 'cat-file', '-e', `${revision}^{commit}`], {
      encoding: 'utf8', windowsHide: true,
    });
    if (result.status === 0) return false;
    diagnostics.push(`  ${revision}: ${result.error?.message ?? result.stderr?.trim() ?? `git exited ${result.status}`}`);
    return true;
  });
  if (missing.length) throw new Error([
    'Migration compatibility preflight failed: required historical Git commits are unavailable.',
    ...missing.map(revision => `  missing ${revision}`),
    ...diagnostics,
    'CI: use actions/checkout with fetch-depth: 0 and preserve the intended tested ref.',
    'Local shallow checkout: git fetch --unshallow <remote> (or fetch the required published ref).',
    'Full history only helps when that remote actually contains both revisions. Publish or fetch the reviewed history from the authorized repository, then rerun this preflight.',
    'Do not skip compatibility assertions or substitute current source for historical source.',
  ].join('\n'));
  return { repository: root, revisions: Object.values(MIGRATION_HISTORY_REVISIONS) };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const args = process.argv.slice(2);
    if (args.length && (args.length !== 2 || args[0] !== '--repo' || !args[1])) {
      throw new Error('Usage: node scripts/verify-migration-history.mjs [--repo <checkout>]');
    }
    console.log(`PASS migration history ${JSON.stringify(verifyMigrationHistory(args[1]))}`);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
