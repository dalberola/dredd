const fs = require('fs');
const path = require('path');

const createCompileResultSchema = require('../schemas/createCompileResultSchema');

const { assert, fixtures } = require('../support');
const parse = require('../../parse');
const compile = require('../../compile');

function compileOpenAPI31(apiDescription) {
  let compileResult;

  parse(apiDescription, (err, parseResult) => {
    if (err) {
      throw err;
    }
    compileResult = compile(
      parseResult.mediaType,
      parseResult.apiElements,
      'openapi31.yml'
    );
  });

  return compileResult;
}

describe('compile() · OpenAPI 3', () => {
  describe('ordinary, valid API description', () => {
    const { mediaType, apiElements } = fixtures('proof-of-concept').openapi3;
    const compileResult = compile(mediaType, apiElements);

    it('produces some annotation and some transactions', () => {
      assert.jsonSchema(compileResult, createCompileResultSchema({
        annotations: [1],
        transactions: [1],
      }));
    });
  });

  describe('minimal OpenAPI 3.1 API description', () => {
    let compileResult;

    before((done) => {
      const apiDescription = fs.readFileSync(
        path.join(__dirname, '../fixtures/openapi3/openapi31-minimal.yml'),
        'utf8'
      );
      parse(apiDescription, (err, parseResult) => {
        if (err) {
          done(err);
          return;
        }
        compileResult = compile(
          parseResult.mediaType,
          parseResult.apiElements,
          'openapi31-minimal.yml'
        );
        done();
      });
    });

    it('produces one transaction and no annotations', () => {
      assert.jsonSchema(compileResult, createCompileResultSchema({
        annotations: 0,
        transactions: 1,
      }));
    });

    it('expands path and query parameters', () => {
      assert.equal(compileResult.transactions[0].request.uri, '/things/abc?include=details');
    });

    it('compiles request headers and body from examples', () => {
      assert.deepEqual(compileResult.transactions[0].request.headers, [
        { name: 'Content-Type', value: 'application/json' },
      ]);
      assert.equal(compileResult.transactions[0].request.body, '{"name":"created"}');
    });

    it('compiles response headers, body, and OpenAPI 3.1 schema', () => {
      assert.deepEqual(compileResult.transactions[0].response.headers, [
        { name: 'Content-Type', value: 'application/json' },
      ]);
      assert.equal(compileResult.transactions[0].response.body, '{"id":"abc","label":null}');
      assert.deepEqual(JSON.parse(compileResult.transactions[0].response.schema), {
        $schema: 'https://spec.openapis.org/oas/3.1/dialect/base',
        type: 'object',
        required: ['id', 'label'],
        properties: {
          id: { type: 'string' },
          label: { type: ['string', 'null'] },
        },
      });
    });
  });

  describe('OpenAPI 3.1 schema dialects', () => {
    function createAPI(schema, jsonSchemaDialect) {
      return `
openapi: 3.1.0
${jsonSchemaDialect ? `jsonSchemaDialect: ${jsonSchemaDialect}\n` : ''}info:
  title: Dialect API
  version: '1.0'
paths:
  /resource:
    get:
      responses:
        '200':
          description: Representation
          content:
            application/json:
              schema:
${schema.split('\n').map((line) => `                ${line}`).join('\n')}
`;
    }

    it('uses the OAS dialect by default', () => {
      const compileResult = compileOpenAPI31(createAPI('type: object'));
      assert.equal(
        JSON.parse(compileResult.transactions[0].response.schema).$schema,
        'https://spec.openapis.org/oas/3.1/dialect/base'
      );
    });

    it('uses root jsonSchemaDialect when schema has no $schema', () => {
      const compileResult = compileOpenAPI31(createAPI(
        'type: object',
        'https://json-schema.org/draft/2020-12/schema'
      ));
      assert.equal(
        JSON.parse(compileResult.transactions[0].response.schema).$schema,
        'https://json-schema.org/draft/2020-12/schema'
      );
    });

    it('keeps schema-level $schema over root jsonSchemaDialect', () => {
      const compileResult = compileOpenAPI31(createAPI(
        '$schema: https://json-schema.org/draft/2020-12/schema\ntype: object',
        'https://spec.openapis.org/oas/3.1/dialect/base'
      ));
      assert.equal(
        JSON.parse(compileResult.transactions[0].response.schema).$schema,
        'https://json-schema.org/draft/2020-12/schema'
      );
    });
  });

  describe('OpenAPI 3.1 parameter serialization', () => {
    function createAPI(pathTemplate, parameter) {
      return `
openapi: 3.1.0
info:
  title: Parameters API
  version: '1.0'
paths:
  ${pathTemplate}:
    get:
      parameters:
${parameter.split('\n').map((line) => `        ${line}`).join('\n')}
      responses:
        '200':
          description: OK
`;
    }

    [
      {
        name: 'serializes default path simple arrays',
        pathTemplate: '/colors/{color}',
        parameter: `- name: color
  in: path
  required: true
  schema:
    type: array
    items:
      type: string
  example:
    - blue
    - black
    - brown`,
        uri: '/colors/blue,black,brown',
      },
      {
        name: 'serializes path simple objects with explode false',
        pathTemplate: '/colors/{color}',
        parameter: `- name: color
  in: path
  required: true
  style: simple
  explode: false
  schema:
    type: object
  example:
    R: 100
    G: 200
    B: 150`,
        uri: '/colors/R,100,G,200,B,150',
      },
      {
        name: 'serializes path simple objects with explode true',
        pathTemplate: '/colors/{color}',
        parameter: `- name: color
  in: path
  required: true
  style: simple
  explode: true
  schema:
    type: object
  example:
    R: 100
    G: 200
    B: 150`,
        uri: '/colors/R=100,G=200,B=150',
      },
      {
        name: 'serializes default query form arrays with explode true',
        pathTemplate: '/colors',
        parameter: `- name: color
  in: query
  schema:
    type: array
    items:
      type: string
  example:
    - blue
    - black
    - brown`,
        uri: '/colors?color=blue&color=black&color=brown',
      },
      {
        name: 'serializes query form arrays with explode false',
        pathTemplate: '/colors',
        parameter: `- name: color
  in: query
  style: form
  explode: false
  schema:
    type: array
    items:
      type: string
  example:
    - blue
    - black
    - brown`,
        uri: '/colors?color=blue,black,brown',
      },
      {
        name: 'serializes default query form objects with explode true',
        pathTemplate: '/colors',
        parameter: `- name: color
  in: query
  schema:
    type: object
  example:
    R: 100
    G: 200
    B: 150`,
        uri: '/colors?R=100&G=200&B=150',
      },
      {
        name: 'serializes query form objects with explode false',
        pathTemplate: '/colors',
        parameter: `- name: color
  in: query
  style: form
  explode: false
  schema:
    type: object
  example:
    R: 100
    G: 200
    B: 150`,
        uri: '/colors?color=R,100,G,200,B,150',
      },
    ].forEach(({
      name,
      pathTemplate,
      parameter,
      uri,
    }) => {
      it(name, () => {
        const compileResult = compileOpenAPI31(createAPI(pathTemplate, parameter));

        assert.equal(compileResult.transactions[0].request.uri, uri);
      });
    });
  });

  describe('with response schema', () => {
    let compileResult;

    before((done) => {
      const apiDescription = fs.readFileSync(
        path.join(__dirname, '../fixtures/openapi3/response-schema.yml'),
        'utf8'
      );
      parse(apiDescription, (err, parseResult) => {
        if (err) {
          done(err);
          return;
        }
        compileResult = compile(
          parseResult.mediaType,
          parseResult.apiElements,
          'response-schema.yml'
        );
        done();
      });
    });

    it('produces two transactions', () => {
      assert.jsonSchema(compileResult, createCompileResultSchema({
        transactions: 2,
      }));
    });

    context('the first transaction', () => {
      it('has the body in response data', () => {
        assert.ok(compileResult.transactions[0].response.body);
        assert.doesNotThrow(() => JSON.parse(compileResult.transactions[0].response.body));
      });
      it('has the schema in response data', () => {
        assert.ok(compileResult.transactions[0].response.schema);
        assert.doesNotThrow(() => JSON.parse(compileResult.transactions[0].response.schema));
      });
    });

    context('the second transaction', () => {
      it('has no body in response data', () => {
        assert.notOk(compileResult.transactions[1].response.body);
      });
      it('has the schema in response data', () => {
        assert.ok(compileResult.transactions[1].response.schema);
        assert.doesNotThrow(() => JSON.parse(compileResult.transactions[1].response.schema));
      });
    });
  });

  describe("with 'multipart/form-data' message bodies", () => {
    const expectedBody = [
      '--CUSTOM-BOUNDARY',
      'Content-Disposition: form-data; name="text"',
      'Content-Type: text/plain',
      '',
      'test equals to 42',
      '--CUSTOM-BOUNDARY',
      'Content-Disposition: form-data; name="json"',
      'Content-Type: application/json',
      '',
      '{"test": 42}',
      '',
      '--CUSTOM-BOUNDARY--',
      '',
    ].join('\r\n');
    let compileResult;

    before((done) => {
      const apiDescription = fs.readFileSync(
        path.join(__dirname, '../fixtures/openapi3/multipart-form-data.yml'),
        'utf8'
      );
      parse(apiDescription, (err, parseResult) => {
        if (err) {
          done(err);
          return;
        }
        compileResult = compile(
          parseResult.mediaType,
          parseResult.apiElements,
          'multipart-form-data.yml'
        );
        done();
      });
    });

    it('produces no annotations and 1 transaction', () => {
      assert.jsonSchema(compileResult, createCompileResultSchema({
        annotations: 0,
        transactions: 1,
      }));
    });

    context('the transaction', () => {
      it('has the expected request body', () => {
        assert.deepEqual(compileResult.transactions[0].request.body, expectedBody);
      });
      it('has the expected response body', () => {
        assert.deepEqual(compileResult.transactions[0].response.body, expectedBody);
      });
    });
  });
});
