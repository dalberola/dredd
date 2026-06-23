import type { EventEmitter } from 'events';

import logger from '../logger.js';
import type { ReporterStats, ReporterTest } from '../types/reporters.js';

// Stamp `test.end` and compute `test.duration` from `test.start`. `test.start`
// is normally a Date set by the 'test start' event, but may be a serialized
// string (e.g. when replayed through a reporter); coerce it. If it is missing
// entirely (no 'test start' was emitted), fall back to a zero duration rather
// than producing NaN.
function recordTestDuration(test: ReporterTest): void {
  test.end = new Date();
  if (typeof test.start === 'string') {
    test.start = new Date(test.start);
  }
  test.duration = test.start ? Number(test.end) - Number(test.start) : 0;
}

class BaseReporter {
  type: string;
  stats: ReporterStats;

  constructor(emitter: EventEmitter, stats: ReporterStats) {
    this.type = 'base';
    this.stats = stats;
    this.configureEmitter(emitter);
    logger.debug(`Using '${this.type}' reporter.`);
  }

  configureEmitter(emitter: EventEmitter): void {
    emitter.on('start', (apiDescriptions, callback) => {
      this.stats.start = new Date();
      callback();
    });

    emitter.on('end', (callback) => {
      this.stats.end = new Date();
      this.stats.duration = Number(this.stats.end) - Number(this.stats.start);
      callback();
    });

    emitter.on('test start', (test) => {
      this.stats.tests += 1;
      test.start = new Date();
    });

    emitter.on('test pass', (test) => {
      this.stats.passes += 1;
      recordTestDuration(test);
    });

    emitter.on('test skip', () => {
      this.stats.skipped += 1;
    });

    emitter.on('test fail', (test) => {
      this.stats.failures += 1;
      recordTestDuration(test);
    });

    emitter.on('test error', (error, test) => {
      this.stats.errors += 1;
      recordTestDuration(test);
    });
  }
}

export default BaseReporter;
