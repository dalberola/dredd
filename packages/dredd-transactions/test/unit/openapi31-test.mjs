import { assert } from 'chai';

import { _sampleFromSchema as sampleFromSchema } from '../../compile/openapi31.js';

// `sampleFromSchema(document, schema)` produces an example value used as the
// request/response body for OpenAPI 3.1 operations. These cases lock in the
// behaviour the compiler relies on (and document the deterministic choices the
// audit flagged as "lossy" but are by design for body sampling).
describe('OpenAPI 3.1 sampleFromSchema()', () => {
  it('prefers example, then default, then const, then enum over the type', () => {
    assert.strictEqual(sampleFromSchema({}, { type: 'string', example: 'x' }), 'x');
    assert.strictEqual(sampleFromSchema({}, { type: 'integer', default: 7 }), 7);
    assert.strictEqual(sampleFromSchema({}, { const: 'c' }), 'c');
    assert.strictEqual(sampleFromSchema({}, { enum: ['a', 'b'] }), 'a');
  });

  it('samples each primitive type', () => {
    assert.strictEqual(sampleFromSchema({}, { type: 'string' }), '');
    assert.strictEqual(sampleFromSchema({}, { type: 'integer' }), 0);
    assert.strictEqual(sampleFromSchema({}, { type: 'number' }), 0);
    assert.strictEqual(sampleFromSchema({}, { type: 'boolean' }), false);
  });

  it('samples the first non-null type for a 3.1 multi-type schema', () => {
    assert.strictEqual(sampleFromSchema({}, { type: ['string', 'null'] }), '');
    assert.strictEqual(sampleFromSchema({}, { type: ['integer', 'null'] }), 0);
    assert.strictEqual(sampleFromSchema({}, { type: ['null', 'boolean'] }), false);
  });

  it('merges object subschemas of an allOf', () => {
    const schema = {
      allOf: [
        { type: 'object', properties: { a: { type: 'string' } } },
        { type: 'object', properties: { b: { type: 'integer' } } },
      ],
    };
    assert.deepEqual(sampleFromSchema({}, schema), { a: '', b: 0 });
  });

  it('layers sibling properties on top of allOf object samples', () => {
    const schema = {
      allOf: [{ type: 'object', properties: { a: { type: 'string' } } }],
      properties: { b: { type: 'boolean' } },
    };
    assert.deepEqual(sampleFromSchema({}, schema), { a: '', b: false });
  });

  it('falls back to the first defined sample when allOf has no object subschemas', () => {
    // Regression: previously produced `undefined` (no body) for an allOf that
    // only wraps a primitive/$ref.
    assert.strictEqual(sampleFromSchema({}, { allOf: [{ type: 'integer' }] }), 0);
    assert.strictEqual(
      sampleFromSchema({}, { allOf: [{ type: 'string', example: 'hi' }] }),
      'hi',
    );
  });

  it('resolves internal $ref schemas', () => {
    const document = {
      components: { schemas: { Name: { type: 'string', example: 'willy' } } },
    };
    assert.strictEqual(
      sampleFromSchema(document, { $ref: '#/components/schemas/Name' }),
      'willy',
    );
  });
});
