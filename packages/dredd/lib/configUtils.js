// @ts-check
import clone from 'clone';
import fs from 'fs';
import yaml from 'js-yaml';

/**
 * @param {Record<string, any>} argsOrigin
 * @param {string} [path]
 */
export function save(argsOrigin, path) {
  if (!path) {
    path = './dredd.yml';
  }

  const args = clone(argsOrigin);

  args.blueprint = args._[0];
  args.endpoint = args._[1];

  Object.keys(args).forEach((key) => {
    if (key.length === 1) {
      delete args[key];
    }
  });

  delete args.$0;
  delete args._;

  fs.writeFileSync(path, yaml.dump(args));
}

/**
 * @param {string} [path]
 * @returns {Record<string, any>}
 */
export function load(path) {
  if (!path) {
    path = './dredd.yml';
  }

  const yamlData = fs.readFileSync(path, 'utf8');
  const data = /** @type {Record<string, any>} */ (yaml.load(yamlData));

  data._ = [data.blueprint, data.endpoint];

  delete data.blueprint;
  delete data.endpoint;

  return data;
}

/**
 * @param {string[]} [customArray]
 * @returns {Record<string, string | undefined>}
 */
export function parseCustom(customArray) {
  /** @type {Record<string, string | undefined>} */
  const output = {};
  if (Array.isArray(customArray)) {
    for (const string of customArray) {
      const splitted = string.split(/:(.+)?/);
      output[splitted[0]] = splitted[1];
    }
  }
  return output;
}
