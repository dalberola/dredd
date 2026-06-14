import { assert } from 'chai';

import Dredd from '../../lib/Dredd';
import { runDreddWithServer, createServer } from './helpers';

const FIXTURE_PATH = './test/fixtures/openapi30-schema-edge-cases.yml';

function buildServer(arrayBody) {
  const app = createServer();
  app.get('/ref', (req, res) =>
    res
      .status(200)
      .set('Content-Type', 'application/json')
      .send(JSON.stringify({ id: 1, label: null })),
  );
  app.get('/allof', (req, res) =>
    res
      .status(200)
      .set('Content-Type', 'application/json')
      .send(JSON.stringify({ id: 2, label: 'two', extra: true })),
  );
  app.get('/array', (req, res) =>
    res
      .status(200)
      .set('Content-Type', 'application/json')
      .send(JSON.stringify(arrayBody)),
  );
  return app;
}

describe('OpenAPI 3.0 edge-case schema validation', () => {
  describe('when every response conforms ($ref, allOf, array of $ref)', () => {
    let runtimeInfo;

    before((done) => {
      const dredd = new Dredd({ options: { path: FIXTURE_PATH } });
      runDreddWithServer(dredd, buildServer([{ id: 3, label: 'three' }]), (error, info) => {
        runtimeInfo = info;
        done(error);
      });
    });

    it('passes all three transactions', () =>
      assert.deepInclude(runtimeInfo.dredd.stats, { tests: 3, passes: 3 }));
  });

  describe('when an array element violates the item schema', () => {
    let runtimeInfo;

    before((done) => {
      const dredd = new Dredd({ options: { path: FIXTURE_PATH } });
      // /array returns an item whose `id` is a string instead of an integer.
      runDreddWithServer(dredd, buildServer([{ id: 'not-an-integer' }]), (error, info) => {
        runtimeInfo = info;
        done(error);
      });
    });

    it('passes the $ref and allOf transactions but fails the array one', () =>
      assert.deepInclude(runtimeInfo.dredd.stats, { tests: 3, passes: 2, failures: 1 }));

    it('reports the data-type violation inside the array element', () =>
      assert.include(
        runtimeInfo.dredd.logging,
        'Invalid type: string (expected integer)',
      ));
  });
});
