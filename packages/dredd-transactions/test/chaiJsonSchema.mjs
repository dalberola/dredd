import Ajv from 'ajv';

// Local replacement for the unmaintained `chai-json-schema` plugin.
// Registers `assert.jsonSchema(value, schema)` (and the BDD
// `expect(value).to.be.jsonSchema(schema)` form) backed by Ajv.
const ajv = new Ajv({ allErrors: true, strict: false });

export default function chaiJsonSchema(chai) {
  chai.Assertion.addMethod('jsonSchema', function jsonSchemaAssertion(schema) {
    const value = this._obj;
    const validate = ajv.compile(schema);
    const valid = validate(value);
    const errorsText = valid
      ? ''
      : ajv.errorsText(validate.errors, { separator: '\n' });

    this.assert(
      valid,
      `expected value to match the given JSON schema:\n${errorsText}`,
      'expected value not to match the given JSON schema',
      schema,
      value,
    );
  });

  chai.assert.jsonSchema = function jsonSchema(value, schema, message) {
    new chai.Assertion(value, message).to.be.jsonSchema(schema);
  };
}
