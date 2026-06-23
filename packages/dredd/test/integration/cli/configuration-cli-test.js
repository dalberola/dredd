import express from 'express';
import fs from 'fs';
import esmock from 'esmock';
import sinon from 'sinon';
import { assert } from 'chai';

import loggerStub from '../../../lib/logger';
import * as configUtilsModule from '../../../lib/configUtils';

const PORT = 9876;

// A mutable shallow copy of the configUtils module so its methods can be
// stubbed. ES module namespace objects are sealed (read-only) and esmock
// snapshots the injected mock at load time, so `load` is pre-stubbed here and
// reconfigured in place per test (rather than re-stubbed) so the esmocked CLI
// observes the behaviour.
const configUtils = { ...configUtilsModule, load: sinon.stub() };

let exitStatus;

let stderr = '';

// CLI is loaded through esmock with its genuinely-faked dependencies replaced:
// the mutable configUtils copy, and console/logger routed to the test logger so
// output is captured. Dredd and TransactionRunner run for real. esmock is
// async, so the class is loaded in a `before` hook.
let CLIStub;

function execCommand(custom = {}, cb) {
  stderr = '';
  exitStatus = null;
  let finished = false;
  const cli = new CLIStub({ custom }, (exitStatusCode) => {
    if (!finished) {
      finished = true;
      exitStatus = exitStatusCode != null ? exitStatusCode : 0;
      cb();
    }
  });

  cli.run();
}

describe('CLI class Integration', () => {
  before(async () => {
    CLIStub = (
      await esmock.p('../../../lib/CLI.ts', {
        '../../../lib/configUtils.ts': configUtils,
        '../../../lib/logger.ts': { default: loggerStub },
        console: { default: loggerStub },
      })
    ).default;

    ['warn', 'error', 'debug'].forEach((method) => {
      sinon.stub(loggerStub, method).callsFake((chunk) => {
        stderr += `\n${method}: ${chunk}`;
      });
    });
  });

  after(() => {
    ['warn', 'error', 'debug'].forEach((method) => {
      loggerStub[method].restore();
    });
  });

  describe('When using configuration file', () => {
    describe('When specifying custom configuration file by --config', () => {
      const configPath = '../../../custom-dredd-config-path.yaml';
      const cmd = { argv: ['--config', configPath, '--loglevel=debug'] };
      const options = { _: ['api-description.yaml', 'http://127.0.0.1'] };

      let fsExistsSync;
      let configUtilsLoad;

      before((done) => {
        fsExistsSync = sinon.stub(fs, 'existsSync').callsFake(() => true);
        configUtils.load.callsFake(() => options);
        configUtilsLoad = configUtils.load;
        execCommand(cmd, done);
      });
      after(() => {
        fsExistsSync.restore();
        configUtils.load.reset();
      });

      it('should call fs.existsSync with given path', () =>
        assert.isTrue(fsExistsSync.calledWith(configPath)));
      it('should call configUtils.load with given path', () =>
        assert.isTrue(configUtilsLoad.calledWith(configPath)));
      it('should print message about using given configuration file', () =>
        assert.include(stderr, `debug: Configuration '${configPath}' found`));
    });

    describe('When dredd.yml exists', () => {
      const configPath = './dredd.yml';
      const cmd = { argv: ['--loglevel=debug'] };
      const options = { _: ['api-description.yaml', 'http://127.0.0.1'] };

      let fsExistsSync;
      let configUtilsLoad;

      before((done) => {
        fsExistsSync = sinon.stub(fs, 'existsSync').callsFake(() => true);
        configUtils.load.callsFake(() => options);
        configUtilsLoad = configUtils.load;
        execCommand(cmd, done);
      });
      after(() => {
        fsExistsSync.restore();
        configUtils.load.reset();
      });

      it('should call fs.existsSync with dredd.yml', () =>
        assert.isTrue(fsExistsSync.calledWith(configPath)));
      it('should call configUtils.load with dredd.yml', () =>
        assert.isTrue(configUtilsLoad.calledWith(configPath)));
      it('should print message about using dredd.yml', () =>
        assert.include(stderr, `debug: Configuration '${configPath}' found`));
    });

    describe('When dredd.yml does not exist', () => {
      const configPath = './dredd.yml';
      const cmd = { argv: ['--loglevel=debug'] };

      let fsExistsSync;
      let configUtilsLoad;

      before((done) => {
        fsExistsSync = sinon.stub(fs, 'existsSync').callsFake(() => false);
        configUtilsLoad = configUtils.load;
        execCommand(cmd, done);
      });
      after(() => {
        fsExistsSync.restore();
        configUtils.load.reset();
      });

      it('should call fs.existsSync with dredd.yml', () =>
        assert.isTrue(fsExistsSync.calledWith(configPath)));
      it('should never call configUtils.load', () =>
        assert.isFalse(configUtilsLoad.called));
      it('should not print message about using configuration file', () =>
        assert.notInclude(stderr, 'debug: Configuration'));
    });
  });

  describe("to test various Errors - When API description document should be loaded from 'http(s)://...' url", () => {
    let app = null;
    let server = null;

    const errorCmd = {
      argv: [
        `http://127.0.0.1:${PORT + 1}/connection-error.yaml`,
        `http://127.0.0.1:${PORT + 1}`,
      ],
    };
    const wrongCmd = {
      argv: [
        `http://127.0.0.1:${PORT}/not-found.yaml`,
        `http://127.0.0.1:${PORT}`,
      ],
    };
    const goodCmd = {
      argv: [`http://127.0.0.1:${PORT}/file.yaml`, `http://127.0.0.1:${PORT}`],
    };

    before((done) => {
      app = express();

      app.get('/', (req, res) => res.sendStatus(404));

      app.get('/file.yaml', (req, res) => {
        fs.createReadStream('./test/fixtures/single-get.yaml').pipe(
          res.type('text'),
        );
      });

      app.get('/machines', (req, res) =>
        res.json([{ type: 'bulldozer', name: 'willy' }]),
      );

      app.get('/not-found.yaml', (req, res) => res.status(404).end());

      server = app.listen(PORT, () => done());
    });

    after((done) =>
      server.close(() => {
        app = null;
        server = null;
        done();
      }),
    );

    describe('and I try to load a file from bad hostname at all', () => {
      before((done) => execCommand(errorCmd, done));

      it('should exit with status 1', () => assert.equal(exitStatus, 1));

      it('should print error message to stderr', () => {
        assert.include(stderr, 'Unable to load API description document from');
        assert.include(stderr, 'connection-error.yaml');
      });
    });

    describe('and I try to load a file that does not exist from an existing server', () => {
      before((done) => execCommand(wrongCmd, done));

      it('should exit with status 1', () => assert.equal(exitStatus, 1));

      it('should print error message to stderr', () => {
        assert.include(stderr, 'Unable to load API description document from');
        assert.include(stderr, 'Dredd got HTTP 404 response without body');
        assert.include(stderr, 'not-found.yaml');
      });
    });

    describe('and I try to load a file that actually is there', () => {
      before((done) => execCommand(goodCmd, done));

      it('should exit with status 0', () => assert.equal(exitStatus, 0));
    });
  });
});
