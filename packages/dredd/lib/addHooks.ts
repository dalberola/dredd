import clone from 'clone';
import Module, { createRequire } from 'module';

import Hooks from './Hooks.js';
import logger from './logger.js';
import reporterOutputLogger from './reporters/reporterOutputLogger.js';
import resolvePaths from './resolvePaths.js';

const nodeRequire = createRequire(import.meta.url);

// The 'addHooks()' function is a strange glue code responsible for various
// side effects needed as a preparation for loading Node.js hooks.
//
// In the future we should get rid of this code. Hooks should get a nice,
// separate logical component, which takes care of their loading and running.
// Side effects should get eliminated as much as possible in favor of
// decoupling.

/**
 * @param hooks The Hooks instance, passed to the hook file as a stub.
 */
function loadHookFile(hookfile: string, hooks: any) {
  try {
    const resolved = nodeRequire.resolve(hookfile);
    // Re-evaluate the hook file on each load (proxyquire never cached it).
    delete nodeRequire.cache[resolved];

    // Inject Dredd's Hooks instance as the `hooks` module the hook file
    // requires. Intercepting Module._load replaces proxyquire, which cannot run
    // under ESM (it reads `module.parent`, undefined in an ES module).
    const moduleLoader = Module as unknown as {
      _load: (request: string, ...args: any[]) => any;
    };
    const originalLoad = moduleLoader._load;
    moduleLoader._load = function _load(request: string, ...args: any[]) {
      if (request === 'hooks') {
        return hooks;
      }
      return originalLoad.call(this, request, ...args);
    };
    try {
      nodeRequire(resolved);
    } finally {
      moduleLoader._load = originalLoad;
    }
  } catch (error) {
    const hookError = error as Error;
    logger.warn(
      `Skipping hook loading. Error reading hook file '${hookfile}'. ` +
        'This probably means one or more of your hook files are invalid.\n' +
        `Message: ${hookError.message}\n` +
        `Stack: \n${hookError.stack}\n`,
    );
  }
}

/**
 * @param runner The TransactionRunner instance (no canonical type until
 *   TransactionRunner is type-checked).
 */
export default function addHooks(
  runner: any,
  transactions: any[],
  callback: (error?: any) => void,
) {
  if (!runner.logs) {
    runner.logs = [];
  }
  runner.hooks = new Hooks({ logs: runner.logs, logger: reporterOutputLogger });

  if (!runner.hooks.transactions) {
    runner.hooks.transactions = {};
  }

  Array.from(transactions).forEach((transaction) => {
    runner.hooks.transactions[transaction.name] = transaction;
  });

  // No hooks
  if (
    !runner.configuration.hookfiles ||
    !runner.configuration.hookfiles.length
  ) {
    return callback();
  }

  // Loading hookfiles from fs
  let hookfiles;
  try {
    hookfiles = resolvePaths(
      runner.configuration.custom.cwd,
      runner.configuration.hookfiles,
    );
  } catch (err) {
    return callback(err);
  }
  logger.debug('Found Hookfiles:', hookfiles);

  // Override hookfiles option in configuration object with
  // sorted and resolved files
  runner.configuration.hookfiles = hookfiles;

  // Clone the configuration object to hooks.configuration to make it
  // accessible in the node.js hooks API
  runner.hooks.configuration = clone(runner.configuration);

  hookfiles.forEach((hookfile) => loadHookFile(hookfile, runner.hooks));
  return callback();
}
