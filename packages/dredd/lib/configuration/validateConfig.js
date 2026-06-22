// @ts-check

/**
 * @typedef {object} ConfigRule
 * @property {string[]} options Config keys this rule matches
 * @property {string} message Warning/error message to surface
 */

/** @type {ConfigRule[]} */
const deprecatedOptions = [
  {
    options: ['c'],
    message:
      'DEPRECATED: The -c configuration option is deprecated. Plese use --color instead.',
  },
  {
    options: ['data'],
    message:
      'DEPRECATED: The --data configuration option is deprecated ' +
      'in favor of `apiDescriptions`, please see https://dredd.org',
  },
  {
    options: ['blueprintPath'],
    message:
      'DEPRECATED: The --blueprintPath configuration option is deprecated, ' +
      'please use --path instead.',
  },
  {
    options: ['level'],
    message:
      'DEPRECATED: The --level configuration option is deprecated. Please use --loglevel instead.',
  },
];

/** @type {ConfigRule[]} */
const unsupportedOptions = [
  {
    options: ['timestamp', 't'],
    message:
      'REMOVED: The --timestamp/-t configuration option is no longer supported. Please use --loglevel=debug instead.',
  },
  {
    options: ['silent', 'q'],
    message:
      'REMOVED: The --silent/-q configuration option is no longer supported. Please use --loglevel=silent instead.',
  },
  {
    options: ['sandbox', 'b'],
    message:
      'REMOVED: Dredd does not support sandboxed JS hooks anymore, use standard JS hooks instead.',
  },
  {
    options: ['hooksData'],
    message:
      'REMOVED: Dredd does not support sandboxed JS hooks anymore, use standard JS hooks instead.',
  },
];

/**
 * @param {ConfigRule[]} rules
 * @param {Record<string, unknown>} config
 * @returns {string[]}
 */
function flushMessages(rules, config) {
  return Object.keys(config).reduce((messages, configKey) => {
    const warning = rules.find((rule) => rule.options.includes(configKey));
    return warning ? messages.concat(warning.message) : messages;
  }, /** @type {string[]} */ ([]));
}

/**
 * Returns the errors and warnings relative to the given config.
 * @param {Record<string, unknown>} config
 * @returns {{ warnings: string[], errors: string[] }}
 */
const validateConfig = (config) => ({
  warnings: flushMessages(deprecatedOptions, config),
  errors: flushMessages(unsupportedOptions, config),
});

export default validateConfig;
