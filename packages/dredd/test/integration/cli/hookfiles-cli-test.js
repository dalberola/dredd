import { assert } from 'chai';

import {
  createServer,
  runCLIWithServer,
  runCLI,
  DEFAULT_SERVER_PORT,
} from '../helpers';

describe('CLI', () => {
  describe('Arguments with existing API description document and responding server', () => {
    describe('when executing the command and the server is responding as specified in the API description', () => {
      let runtimeInfo;

      before((done) => {
        const app = createServer();
        app.get('/machines', (req, res) =>
          res.json([{ type: 'bulldozer', name: 'willy' }]),
        );

        const args = [
          './test/fixtures/single-get.yaml',
          `http://127.0.0.1:${DEFAULT_SERVER_PORT}`,
        ];
        runCLIWithServer(args, app, (err, info) => {
          runtimeInfo = info;
          done(err);
        });
      });

      it('exit status should be 0', () =>
        assert.equal(runtimeInfo.dredd.exitStatus, 0));
    });

    describe('when executing the command and the server is responding as specified in the API description, endpoint with path', () => {
      let runtimeInfo;

      before((done) => {
        const app = createServer();
        app.get('/v2/machines', (req, res) =>
          res.json([{ type: 'bulldozer', name: 'willy' }]),
        );

        const args = [
          './test/fixtures/single-get.yaml',
          `http://127.0.0.1:${DEFAULT_SERVER_PORT}/v2/`,
        ];
        runCLIWithServer(args, app, (err, info) => {
          runtimeInfo = info;
          done(err);
        });
      });

      it('exit status should be 0', () =>
        assert.equal(runtimeInfo.dredd.exitStatus, 0));
    });

    describe('when executing the command and the server is sending different response', () => {
      let runtimeInfo;

      before((done) => {
        const app = createServer();
        app.get('/machines', (req, res) =>
          res
            .status(201)
            .json([{ kind: 'bulldozer', imatriculation: 'willy' }]),
        );

        const args = [
          './test/fixtures/single-get.yaml',
          `http://127.0.0.1:${DEFAULT_SERVER_PORT}`,
        ];
        runCLIWithServer(args, app, (err, info) => {
          runtimeInfo = info;
          done(err);
        });
      });

      it('exit status should be 1', () =>
        assert.equal(runtimeInfo.dredd.exitStatus, 1));
    });
  });

  describe('when called with arguments', () => {
    describe('when adding additional headers with -h', () => {
      let runtimeInfo;

      before((done) => {
        const app = createServer();
        app.get('/machines', (req, res) =>
          res.json([{ type: 'bulldozer', name: 'willy' }]),
        );

        const args = [
          './test/fixtures/single-get.yaml',
          `http://127.0.0.1:${DEFAULT_SERVER_PORT}`,
          '-h',
          'Accept:application/json',
        ];
        runCLIWithServer(args, app, (err, info) => {
          runtimeInfo = info;
          done(err);
        });
      });

      it('should have an additional header in the request', () =>
        assert.nestedPropertyVal(
          runtimeInfo.server.requests['/machines'][0],
          'headers.accept',
          'application/json',
        ));
    });

    describe('when adding basic auth credentials with -u', () => {
      let runtimeInfo;

      before((done) => {
        const app = createServer();
        app.get('/machines', (req, res) =>
          res.json([{ type: 'bulldozer', name: 'willy' }]),
        );

        const args = [
          './test/fixtures/single-get.yaml',
          `http://127.0.0.1:${DEFAULT_SERVER_PORT}`,
          '-u',
          'username:password',
        ];
        runCLIWithServer(args, app, (err, info) => {
          runtimeInfo = info;
          done(err);
        });
      });

      it('should have an authorization header in the request', () =>
        assert.isOk(
          runtimeInfo.server.requests['/machines'][0].headers.authorization,
        ));

      it('should contain a base64 encoded string of the username and password', () =>
        assert.isOk(
          runtimeInfo.server.requests['/machines'][0].headers.authorization ===
            `Basic ${Buffer.from('username:password').toString('base64')}`,
        ));
    });

    describe('when sorting requests with -s', () => {
      let runtimeInfo;

      before((done) => {
        const app = createServer();
        app.get('/machines', (req, res) =>
          res.json([{ type: 'bulldozer', name: 'willy' }]),
        );

        const args = [
          './test/fixtures/apiary.yaml',
          `http://127.0.0.1:${DEFAULT_SERVER_PORT}`,
          '-s',
        ];
        runCLIWithServer(args, app, (err, info) => {
          runtimeInfo = info;
          done(err);
        });
      });

      it('should perform the POST, GET, PUT, DELETE in order', () => {
        assert.isOk(
          runtimeInfo.dredd.stdout.indexOf('POST') <
            runtimeInfo.dredd.stdout.indexOf('GET') <
            runtimeInfo.dredd.stdout.indexOf('PUT') <
            runtimeInfo.dredd.stdout.indexOf('DELETE'),
        );
      });
    });

    describe('when displaying errors inline with -e', () => {
      let runtimeInfo;

      before((done) => {
        const app = createServer();
        app.get('/machines', (req, res) =>
          res
            .status(201)
            .json([{ kind: 'bulldozer', imatriculation: 'willy' }]),
        );

        const args = [
          './test/fixtures/single-get.yaml',
          `http://127.0.0.1:${DEFAULT_SERVER_PORT}`,
          '-e',
        ];
        runCLIWithServer(args, app, (err, info) => {
          runtimeInfo = info;
          done(err);
        });
      });

      it('should display errors inline', () => {
        // When displayed inline, a single fail request only creates two "fail:" messages,
        // as opposed to the usual three
        const count = runtimeInfo.dredd.stdout.split('fail').length - 2; // Says fail in the epilogue
        assert.equal(count, 2);
      });
    });

    describe('when showing details for all requests with -d', () => {
      let runtimeInfo;

      before((done) => {
        const app = createServer();
        app.get('/machines', (req, res) =>
          res.json([{ type: 'bulldozer', name: 'willy' }]),
        );

        const args = [
          './test/fixtures/single-get.yaml',
          `http://127.0.0.1:${DEFAULT_SERVER_PORT}`,
          '-d',
        ];
        runCLIWithServer(args, app, (err, info) => {
          runtimeInfo = info;
          done(err);
        });
      });

      it('should display details on passing tests', () => {
        // The request: block is not shown for passing tests normally
        assert.isOk(runtimeInfo.dredd.stdout.indexOf('request') > -1);
      });
    });

    describe('when filtering request methods with -m', () => {
      describe('when blocking a request', () => {
        let runtimeInfo;

        before((done) => {
          const app = createServer();
          app.get('/machines', (req, res) =>
            res.json([{ type: 'bulldozer', name: 'willy' }]),
          );

          const args = [
            './test/fixtures/single-get.yaml',
            `http://127.0.0.1:${DEFAULT_SERVER_PORT}`,
            '-m',
            'POST',
          ];
          runCLIWithServer(args, app, (err, info) => {
            runtimeInfo = info;
            done(err);
          });
        });

        it('should not send the request request', () =>
          assert.deepEqual(runtimeInfo.server.requestCounts, {}));
      });

      describe('when not blocking a request', () => {
        let runtimeInfo;

        before((done) => {
          const app = createServer();
          app.get('/machines', (req, res) =>
            res.json([{ type: 'bulldozer', name: 'willy' }]),
          );

          const args = [
            './test/fixtures/single-get.yaml',
            `http://127.0.0.1:${DEFAULT_SERVER_PORT}`,
            '-m',
            'GET',
          ];
          runCLIWithServer(args, app, (err, info) => {
            runtimeInfo = info;
            done(err);
          });
        });

        it('should allow the request to go through', () =>
          assert.deepEqual(runtimeInfo.server.requestCounts, {
            '/machines': 1,
          }));
      });
    });

    describe('when filtering transaction to particular name with -x or --only', () => {
      let runtimeInfo;

      before((done) => {
        const app = createServer();
        app.get('/machines', (req, res) =>
          res.json([{ type: 'bulldozer', name: 'willy' }]),
        );

        app.get('/message', (req, res) =>
          res.type('text/plain').send('Hello World!\n'),
        );

        const args = [
          './test/fixtures/single-get.yaml',
          `http://127.0.0.1:${DEFAULT_SERVER_PORT}`,
          '--path=./test/fixtures/multifile/*.yaml',
          '--only=Message API > /message > GET > 200 > text/plain; charset=utf-8',
          '--no-color',
        ];
        runCLIWithServer(args, app, (err, info) => {
          runtimeInfo = info;
          done(err);
        });
      });

      it('should notify skipping to the stdout', () =>
        assert.include(runtimeInfo.dredd.stdout, 'skip: GET (200) /machines'));

      it('should hit the only transaction', () =>
        assert.deepEqual(runtimeInfo.server.requestCounts, { '/message': 1 }));

      it('exit status should be 0', () =>
        assert.equal(runtimeInfo.dredd.exitStatus, 0));
    });

    describe('when suppressing color with --no-color', () => {
      let runtimeInfo;

      before((done) => {
        const app = createServer();
        app.get('/machines', (req, res) =>
          res.json([{ type: 'bulldozer', name: 'willy' }]),
        );

        const args = [
          './test/fixtures/single-get.yaml',
          `http://127.0.0.1:${DEFAULT_SERVER_PORT}`,
          '--no-color',
        ];
        runCLIWithServer(args, app, (err, info) => {
          runtimeInfo = info;
          done(err);
        });
      });

      it('should print without colors', () => {
        // If colors are not on, there is no closing color code between
        // the "pass" and the ":"
        assert.include(runtimeInfo.dredd.stdout, 'pass:');
      });
    });

    describe('when setting the log output level with --loglevel', () => {
      let runtimeInfo;

      before((done) => {
        const app = createServer();
        app.get('/machines', (req, res) =>
          res.json([{ type: 'bulldozer', name: 'willy' }]),
        );

        const args = [
          './test/fixtures/single-get.yaml',
          `http://127.0.0.1:${DEFAULT_SERVER_PORT}`,
          '--loglevel=error',
          '--no-color',
        ];
        runCLIWithServer(args, app, (err, info) => {
          runtimeInfo = info;
          done(err);
        });
      });

      it('should not display any debug logging', () => {
        assert.notInclude(runtimeInfo.dredd.output, 'debug:');
      });
    });

    describe('when showing timestamps with --loglevel=debug', () => {
      let runtimeInfo;

      before((done) => {
        const app = createServer();
        app.get('/machines', (req, res) =>
          res.json([{ type: 'bulldozer', name: 'willy' }]),
        );

        const args = [
          './test/fixtures/single-get.yaml',
          `http://127.0.0.1:${DEFAULT_SERVER_PORT}`,
          '--loglevel=debug',
        ];
        runCLIWithServer(args, app, (err, info) => {
          runtimeInfo = info;
          done(err);
        });
      });

      it('should display timestamps', () => {
        // Look for the prefix for cli output with timestamps
        assert.include(runtimeInfo.dredd.stderr, 'Z -');
      });
    });
  });

  describe('when loading hooks with --hookfiles', () => {
    let runtimeInfo;

    before((done) => {
      const app = createServer();
      app.get('/machines', (req, res) =>
        res.json([{ type: 'bulldozer', name: 'willy' }]),
      );

      const args = [
        './test/fixtures/single-get.yaml',
        `http://127.0.0.1:${DEFAULT_SERVER_PORT}`,
        '--hookfiles=./test/fixtures/*_hooks.*',
      ];
      runCLIWithServer(args, app, (err, info) => {
        runtimeInfo = info;
        done(err);
      });
    });

    it('should modify the transaction with hooks', () =>
      assert.equal(
        runtimeInfo.server.requests['/machines'][0].headers.header,
        '123232323',
      ));
  });

  describe('when describing events in hookfiles', () => {
    let runtimeInfo;

    function containsLine(str, expected) {
      const lines = str.split('\n');
      for (const line of lines) {
        if (line.indexOf(expected) > -1) {
          return true;
        }
      }
      return false;
    }

    before((done) => {
      const app = createServer();
      app.get('/machines', (req, res) =>
        res.json([{ type: 'bulldozer', name: 'willy' }]),
      );

      const args = [
        './test/fixtures/single-get.yaml',
        `http://127.0.0.1:${DEFAULT_SERVER_PORT}`,
        '--hookfiles=./test/fixtures/*_events.*',
      ];
      runCLIWithServer(args, app, (err, info) => {
        runtimeInfo = info;
        done(err);
      });
    });

    it('should execute the before and after events', () => {
      assert.isOk(
        containsLine(runtimeInfo.dredd.stdout, 'hooks.beforeAll'),
        runtimeInfo.dredd.stdout,
      );
      assert.isOk(
        containsLine(runtimeInfo.dredd.stdout, 'hooks.afterAll'),
        runtimeInfo.dredd.stdout,
      );
    });
  });

  describe('when describing both hooks and events in hookfiles', () => {
    let runtimeInfo;

    function getResults(str) {
      const ret = [];
      const lines = str.split('\n');
      for (const line of lines) {
        if (line.indexOf('*** ') > -1) {
          ret.push(line.substr(line.indexOf('*** ') + 4));
        }
      }
      return ret.join(',');
    }

    before((done) => {
      const app = createServer();
      app.get('/machines', (req, res) =>
        res.json([{ type: 'bulldozer', name: 'willy' }]),
      );

      const args = [
        './test/fixtures/single-get.yaml',
        `http://127.0.0.1:${DEFAULT_SERVER_PORT}`,
        '--require=coffeescript/register',
        '--hookfiles=./test/fixtures/*_all.*',
      ];
      runCLIWithServer(args, app, (err, info) => {
        runtimeInfo = info;
        done(err);
      });
    });

    it('should execute hooks and events in order', () => {
      const events = getResults(runtimeInfo.dredd.stdout);
      assert.isOk(events === 'beforeAll,before,after,afterAll');
    });
  });

  describe('tests an API description containing an endpoint with schema', () => {
    describe('and server is responding in accordance with the schema', () => {
      let runtimeInfo;

      before((done) => {
        const app = createServer();
        app.get('/', (req, res) =>
          res.json({
            data: {
              expires: 1234,
              token: 'this should pass since it is a string',
            },
          }),
        );

        const args = [
          './test/fixtures/schema.yaml',
          `http://127.0.0.1:${DEFAULT_SERVER_PORT}`,
        ];
        runCLIWithServer(args, app, (err, info) => {
          runtimeInfo = info;
          done(err);
        });
      });

      it('exit status should be 0 (success)', () => {
        assert.equal(runtimeInfo.dredd.exitStatus, 0);
      });
    });

    describe('and server is NOT responding in accordance with the schema', () => {
      let runtimeInfo;

      before((done) => {
        const app = createServer();
        app.get('/', (req, res) =>
          res.json({
            data: {
              expires: 'this should fail since it is a string',
              token: 'this should pass since it is a string',
            },
          }),
        );

        const args = [
          './test/fixtures/schema.yaml',
          `http://127.0.0.1:${DEFAULT_SERVER_PORT}`,
        ];
        runCLIWithServer(args, app, (err, info) => {
          runtimeInfo = info;
          done(err);
        });
      });

      it('exit status should be 1 (failure)', () =>
        assert.equal(runtimeInfo.dredd.exitStatus, 1));
    });
  });

  describe('when API description document path is a glob', () => {
    describe('and called with --names options', () => {
      let cliInfo;

      before((done) => {
        const args = [
          './test/fixtures/multifile/*.yaml',
          `http://127.0.0.1:${DEFAULT_SERVER_PORT}`,
          '--names',
          '--loglevel=debug',
        ];
        runCLI(args, (err, info) => {
          cliInfo = info;
          done(err);
        });
      });

      it('it should include all paths from all API description documents matching the glob', () => {
        assert.include(cliInfo.stdout, '> /greeting > GET');
        assert.include(cliInfo.stdout, '> /message > GET');
        assert.include(cliInfo.stdout, '> /name > GET');
      });

      it('should exit with status 0', () =>
        assert.equal(cliInfo.exitStatus, 0));
    });

    describe('and called with hooks', () => {
      let runtimeInfo;

      before((done) => {
        const app = createServer();
        app.get('/name', (req, res) => res.type('text/plain').send('Adam\n'));

        app.get('/greeting', (req, res) =>
          res.type('text/plain').send('Howdy!\n'),
        );

        app.get('/message', (req, res) =>
          res.type('text/plain').send('Hello World!\n'),
        );

        const args = [
          './test/fixtures/multifile/*.yaml',
          `http://127.0.0.1:${DEFAULT_SERVER_PORT}`,
          '--require=coffeescript/register',
          '--hookfiles=./test/fixtures/multifile/multifile_hooks.coffee',
        ];
        runCLIWithServer(args, app, (err, info) => {
          runtimeInfo = info;
          done(err);
        });
      });

      it('should eval the hook for each transaction', () => {
        assert.include(runtimeInfo.dredd.stdout, 'after name');
        assert.include(runtimeInfo.dredd.stdout, 'after greeting');
        assert.include(runtimeInfo.dredd.stdout, 'after message');
      });

      it('should exit with status 0', () =>
        assert.equal(
          runtimeInfo.dredd.exitStatus,
          0,
          runtimeInfo.dredd.output,
        ));

      it('server should receive 3 requests', () => {
        assert.deepEqual(runtimeInfo.server.requestCounts, {
          '/name': 1,
          '/greeting': 1,
          '/message': 1,
        });
      });
    });
  });
});
