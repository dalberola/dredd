// @ts-check
import clone from 'clone';
import { randomUUID as generateUuid } from 'crypto';
import os from 'os';

import request from '../httpClient';
import logger from '../logger';
import reporterOutputLogger from './reporterOutputLogger';
import packageData from '../../package.json';

/**
 * @typedef {import('../types/reporters').ReporterStats} ReporterStats
 * @typedef {import('../types/reporters').ReporterTest} ReporterTest
 * @typedef {{
 *   custom?: Record<string, any>,
 *   server?: string,
 *   http?: Record<string, any>,
 * }} ApiaryConfig
 * @typedef {{ logs?: any[] }} ApiaryRunner
 * @typedef {(error?: any, response?: any, parsedBody?: any) => void} ApiaryCallback
 */

const CONNECTION_ERRORS = [
  'ECONNRESET',
  'ENOTFOUND',
  'ESOCKETTIMEDOUT',
  'ETIMEDOUT',
  'ECONNREFUSED',
  'EHOSTUNREACH',
  'EPIPE',
];

/**
 * @param {import('events').EventEmitter} emitter
 * @param {ReporterStats} stats
 * @param {ApiaryConfig} config
 * @param {ApiaryRunner} [runner]
 */
function ApiaryReporter(emitter, stats, config, runner) {
  this.type = 'apiary';
  this.stats = stats;
  /** @type {string | null} */
  this.uuid = null;
  /** @type {number | null} */
  this.startedAt = null;
  /** @type {number | null} */
  this.endedAt = null;
  /** @type {string | null} */
  this.remoteId = null;
  this.config = config;
  this.runner = runner;
  /** @type {string | null} */
  this.reportUrl = null;
  /** @type {ReporterTest[]} */
  this.errors = [];
  this.serverError = false;
  this.configuration = {
    apiUrl: this._get(
      'apiaryApiUrl',
      'APIARY_API_URL',
      'https://api.apiary.io',
    ).replace(/\/$/, ''),
    apiToken: this._get('apiaryApiKey', 'APIARY_API_KEY', null),
    apiSuite: this._get('apiaryApiName', 'APIARY_API_NAME', null),
  };

  this.configureEmitter(emitter);

  logger.debug(`Using '${this.type}' reporter.`);

  if (!this.configuration.apiToken && !this.configuration.apiSuite) {
    logger.warn(`
Apiary API Key or API Project Name were not provided.
Configure Dredd to be able to save test reports alongside your Apiary API project:
https://dredd.org/en/latest/how-to-guides/#using-apiary-reporter-and-apiary-tests
`);
  }
  if (!this.configuration.apiSuite) {
    this.configuration.apiSuite = 'public';
  }
}

// THIS IS HIIIIGHWAY TO HELL, HIIIIIGHWAY TO HELL. Everything should have one single interface
/**
 * Reads a setting from (in order) the deprecated custom config, the apiary
 * reporter env block, or the process environment. The value is intentionally
 * loosely typed since it spans config values, env strings and defaults.
 * @param {string} customProperty
 * @param {string} envProperty
 * @param {*} [defaultVal]
 * @returns {any}
 */
ApiaryReporter.prototype._get = function _get(
  customProperty,
  envProperty,
  defaultVal,
) {
  let returnVal = defaultVal;

  // This will be deprecated
  if (this.config.custom && this.config.custom[customProperty]) {
    returnVal = this.config.custom[customProperty];

    // This will be deprecated
  } else if (
    this.config.custom &&
    this.config.custom.apiaryReporterEnv &&
    this.config.custom.apiaryReporterEnv[customProperty]
  ) {
    returnVal = this.config.custom.apiaryReporterEnv[customProperty];

    // This will be deprecated
  } else if (
    this.config.custom &&
    this.config.custom.apiaryReporterEnv &&
    this.config.custom.apiaryReporterEnv[envProperty]
  ) {
    returnVal = this.config.custom.apiaryReporterEnv[envProperty];

    // This will be supported for backward compatibility, but can be removed in future.
  } else if (process.env[envProperty]) {
    returnVal = process.env[envProperty];
  }

  return returnVal;
};

/** @returns {string[]} */
ApiaryReporter.prototype._getKeys = function _getKeys() {
  /** @type {string[]} */
  let returnKeys = [];
  returnKeys = returnKeys.concat(
    Object.keys(
      (this.config.custom && this.config.custom.apiaryReporterEnv) || {},
    ),
  );
  return returnKeys.concat(Object.keys(process.env));
};

/** @param {import('events').EventEmitter} emitter */
ApiaryReporter.prototype.configureEmitter = function configureEmitter(emitter) {
  emitter.on('start', (apiDescriptions, callback) => {
    if (this.serverError === true) {
      return callback();
    }
    this.uuid = generateUuid();
    this.startedAt = Math.round(new Date().getTime() / 1000);

    // Cycle through all keys from
    // - config.custom.apiaryReporterEnv
    // - process.env keys
    const ciVars = /^(TRAVIS|CIRCLE|CI|DRONE|BUILD_ID)/;
    const envVarNames = this._getKeys();
    /** @type {Record<string, any>} */
    const ciEnvVars = {};
    for (const envVarName of envVarNames) {
      if (envVarName.match(ciVars)) {
        ciEnvVars[envVarName] = this._get(envVarName, envVarName);
      }
    }

    // Transform blueprints data to array
    /** @type {Record<string, any>} */
    const data = {
      blueprints: /** @type {any[]} */ (apiDescriptions).map(
        (apiDescription) => ({
          filename: apiDescription.location,
          raw: apiDescription.content,
          annotations: apiDescription.annotations,
        }),
      ),
      endpoint: this.config.server,
      agent:
        this._get('dreddAgent', 'DREDD_AGENT') || this._get('user', 'USER'),
      agentRunUuid: this.uuid,
      hostname: this._get('dreddHostname', 'DREDD_HOSTNAME') || os.hostname(),
      startedAt: this.startedAt,
      public: true,
      status: 'running',
      agentEnvironment: ciEnvVars,
    };

    if (this.configuration.apiToken && this.configuration.apiSuite) {
      data.public = false;
    }

    const path = `/apis/${this.configuration.apiSuite}/tests/runs`;

    this._performRequestAsync(
      path,
      'POST',
      data,
      (error, response, parsedBody) => {
        if (error) {
          callback(error);
        } else {
          this.remoteId = parsedBody._id;
          if (parsedBody.reportUrl) {
            this.reportUrl = parsedBody.reportUrl;
          }
          callback();
        }
      },
    );
  });

  emitter.on('test pass', this._createStep.bind(this));

  emitter.on('test fail', this._createStep.bind(this));

  emitter.on('test skip', this._createStep.bind(this));

  emitter.on('test error', (error, test, callback) => {
    if (this.serverError === true) {
      return callback();
    }
    const data = this._transformTestToReporter(test);

    if (Array.from(CONNECTION_ERRORS).includes(error.code)) {
      data.results.errors.push({
        severity: 'error',
        message: 'Error connecting to server under test!',
      });
    } else {
      data.results.errors.push({
        severity: 'error',
        message: 'Unhandled error occured when executing the transaction.',
      });
    }

    const path = `/apis/${this.configuration.apiSuite}/tests/steps?testRunId=${this.remoteId}`;
    this._performRequestAsync(path, 'POST', data, (err) => {
      if (err) {
        return callback(err);
      }
      callback();
    });
  });

  emitter.on('end', (callback) => {
    if (this.serverError === true) {
      return callback();
    }

    const data = {
      endedAt: Math.round(new Date().getTime() / 1000),
      result: this.stats,
      status:
        this.stats.failures > 0 || this.stats.errors > 0 ? 'failed' : 'passed',
      logs:
        this.runner && this.runner.logs && this.runner.logs.length
          ? this.runner.logs
          : undefined,
    };

    const path = `/apis/${this.configuration.apiSuite}/tests/run/${this.remoteId}`;

    this._performRequestAsync(path, 'PATCH', data, (error) => {
      if (error) {
        return callback(error);
      }
      const reportUrl =
        this.reportUrl ||
        `https://app.apiary.io/${this.configuration.apiSuite}/tests/run/${this.remoteId}`;
      reporterOutputLogger.complete(`See results in Apiary at: ${reportUrl}`);
      callback();
    });
  });
};

/**
 * @param {ReporterTest} test
 * @param {ApiaryCallback} callback
 */
ApiaryReporter.prototype._createStep = function _createStep(test, callback) {
  if (this.serverError === true) {
    return callback();
  }
  const data = this._transformTestToReporter(test);
  const path = `/apis/${this.configuration.apiSuite}/tests/steps?testRunId=${this.remoteId}`;
  this._performRequestAsync(path, 'POST', data, (error) => {
    if (error) {
      return callback(error);
    }
    callback();
  });
};

/**
 * @param {string} path
 * @param {string} method
 * @param {any} reqBody
 * @param {ApiaryCallback} callback
 */
ApiaryReporter.prototype._performRequestAsync = function _performRequestAsync(
  path,
  method,
  reqBody,
  callback,
) {
  /**
   * @param {any} err
   * @param {{ headers: any, statusCode?: number } | undefined} res
   * @param {string | Buffer | undefined} resBody
   */
  const handleRequest = (err, res, resBody) => {
    let parsedBody;
    if (err) {
      this.serverError = true;
      logger.debug('Requesting Apiary API errored:', `${err}` || err.code);

      if (Array.from(CONNECTION_ERRORS).includes(err.code)) {
        return callback(
          new Error('Apiary reporter could not connect to Apiary API'),
        );
      }
      return callback(err);
    }

    logger.debug('Handling HTTP response from Apiary API');

    try {
      parsedBody = JSON.parse(/** @type {string} */ (resBody));
    } catch (error) {
      this.serverError = true;
      err = new Error(`
Apiary reporter failed to parse Apiary API response body:
${/** @type {Error} */ (error).message}\n${resBody}
`);
      return callback(err);
    }

    const response = /** @type {{ headers: any, statusCode?: number }} */ (res);
    const info = {
      headers: response.headers,
      statusCode: response.statusCode,
      body: parsedBody,
    };

    logger.debug('Apiary reporter response:', JSON.stringify(info, null, 2));

    callback(null, res, parsedBody);
  };

  const body = reqBody ? JSON.stringify(reqBody) : '';
  const system = `${os.type()} ${os.release()}; ${os.arch()}`;
  const headers = {
    'User-Agent': `Dredd Apiary Reporter/${packageData.version} (${system})`,
    'Content-Type': 'application/json',
  };

  /** @type {Record<string, any>} */
  const options = clone(this.config.http || {});
  options.uri = this.configuration.apiUrl + path;
  options.method = method;
  options.headers = headers;
  options.body = body;

  if (this.configuration.apiToken) {
    options.headers.Authentication = `Token ${this.configuration.apiToken}`;
  }

  try {
    const protocol = options.uri.split(':')[0].toUpperCase();
    logger.debug(`
About to perform an ${protocol} request from Apiary reporter
to Apiary API: ${options.method} ${options.uri} \
(${body ? 'with' : 'without'} body)
`);
    logger.debug(
      'Request details:',
      JSON.stringify({ options, body }, null, 2),
    );
    return request(options, handleRequest);
  } catch (error) {
    this.serverError = true;
    logger.debug('Requesting Apiary API errored:', error);
    return callback(error);
  }
};

/**
 * @param {ReporterTest} test
 * @returns {{
 *   testRunId: string | null,
 *   origin: any,
 *   duration: number | undefined,
 *   result: string | undefined,
 *   startedAt: number | null | undefined,
 *   results: {
 *     request: any,
 *     realResponse: any,
 *     expectedResponse: any,
 *     validationResult: any,
 *     errors: any[],
 *   },
 * }}
 */
ApiaryReporter.prototype._transformTestToReporter =
  function _transformTestToReporter(test) {
    return {
      testRunId: this.remoteId,
      origin: test.origin,
      duration: test.duration,
      result: test.status,
      startedAt: test.startedAt,
      results: {
        request: test.request,
        realResponse: test.actual,
        expectedResponse: test.expected,
        validationResult: test.results || {},
        errors: test.errors || [],
      },
    };
  };

export default ApiaryReporter;
