import { assert } from 'chai';

import Dredd from '../../lib/Dredd';
import { runDreddWithServer, createServer } from './helpers';

const FIXTURE_PATH = './test/fixtures/openapi31-json-schema.yml';

describe('OpenAPI 3.1 JSON Schema validation', () => {
  describe('when the server response matches a JSON Schema 2020-12 schema', () => {
    let runtimeInfo;

    before((done) => {
      const app = createServer();
      app.get('/resource', (req, res) =>
        res
          .set('Content-Type', 'application/json')
          .send(JSON.stringify({ label: null })));
      const dredd = new Dredd({ options: { path: FIXTURE_PATH } });

      runDreddWithServer(dredd, app, (error, info) => {
        runtimeInfo = info;
        done(error);
      });
    });

    it('evaluates the response as valid', () =>
      assert.deepInclude(runtimeInfo.dredd.stats, { tests: 1, passes: 1 }));
  });

  describe('when the server response does not match a JSON Schema 2020-12 schema', () => {
    let runtimeInfo;

    before((done) => {
      const app = createServer();
      app.get('/resource', (req, res) =>
        res
          .set('Content-Type', 'application/json')
          .send(JSON.stringify({ label: 123 })));
      const dredd = new Dredd({ options: { path: FIXTURE_PATH } });

      runDreddWithServer(dredd, app, (error, info) => {
        runtimeInfo = info;
        done(error);
      });
    });

    it('evaluates the response as invalid', () =>
      assert.deepInclude(runtimeInfo.dredd.stats, { tests: 1, failures: 1 }));

    it('prints JSON Schema 2020-12 validation error', () =>
      assert.include(
        runtimeInfo.dredd.logging,
        "At '/label' Invalid type: number (expected string,null)",
      ));
  });
});
