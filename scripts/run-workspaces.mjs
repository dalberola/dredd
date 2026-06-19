#!/usr/bin/env node
/*
 * Minimal replacement for `lerna exec <script>` across the workspaces.
 *
 * Runs the given yarn script in each workspace sequentially, in dependency
 * order (dredd-transactions before dredd). It continues past a failing
 * workspace instead of stopping early (equivalent to lerna's --no-bail) and
 * exits non-zero if any workspace failed.
 *
 * Usage: node scripts/run-workspaces.mjs <script>
 */
import { execFileSync } from 'child_process';

const WORKSPACES = ['@stacklych/dredd-transactions', '@stacklych/dredd'];

const script = process.argv[2];
if (!script) {
  console.error('Usage: node scripts/run-workspaces.mjs <script>');
  process.exit(2);
}

let failed = false;
for (const workspace of WORKSPACES) {
  console.log(`\n> ${workspace}: yarn ${script}`);
  try {
    execFileSync('yarn', ['workspace', workspace, script], {
      stdio: 'inherit',
    });
  } catch {
    failed = true;
  }
}

process.exit(failed ? 1 : 0);
