const compileTransactionName = require('./compileTransactionName');

const METHODS = ['get', 'put', 'post', 'delete', 'options', 'head', 'patch', 'trace'];
const OAS_31_DIALECT = 'https://spec.openapis.org/oas/3.1/dialect/base';

function decodePointerSegment(segment) {
  return segment.replace(/~1/g, '/').replace(/~0/g, '~');
}

function resolveRef(document, value) {
  if (!value || typeof value !== 'object' || !value.$ref) {
    return value;
  }

  const { $ref } = value;
  if (!$ref.startsWith('#/')) {
    return value;
  }

  return $ref
    .slice(2)
    .split('/')
    .map(decodePointerSegment)
    .reduce((current, segment) => (current ? current[segment] : undefined), document) || value;
}

function cloneWithoutRef(document, value) {
  const resolved = resolveRef(document, value);
  if (!resolved || typeof resolved !== 'object') {
    return resolved;
  }
  if (Array.isArray(resolved)) {
    return resolved.map((item) => cloneWithoutRef(document, item));
  }

  return Object.keys(resolved).reduce((result, key) => Object.assign(result, {
    [key]: cloneWithoutRef(document, resolved[key]),
  }), {});
}

function findFirstExample(document, examples) {
  if (!examples || typeof examples !== 'object') {
    return undefined;
  }

  const firstKey = Object.keys(examples)[0];
  if (!firstKey) {
    return undefined;
  }

  const example = resolveRef(document, examples[firstKey]);
  return example ? example.value : undefined;
}

function schemaTypes(schema) {
  const type = schema && schema.type;
  if (Array.isArray(type)) {
    return type;
  }
  if (typeof type === 'string') {
    return [type];
  }
  if (schema && schema.properties) {
    return ['object'];
  }
  if (schema && schema.items) {
    return ['array'];
  }
  return [];
}

function sampleFromSchema(document, schema) {
  const resolvedSchema = resolveRef(document, schema);
  if (!resolvedSchema || typeof resolvedSchema !== 'object') {
    return undefined;
  }

  if (Object.prototype.hasOwnProperty.call(resolvedSchema, 'example')) {
    return resolvedSchema.example;
  }
  if (Object.prototype.hasOwnProperty.call(resolvedSchema, 'default')) {
    return resolvedSchema.default;
  }
  if (Object.prototype.hasOwnProperty.call(resolvedSchema, 'const')) {
    return resolvedSchema.const;
  }
  if (resolvedSchema.enum && resolvedSchema.enum.length) {
    return resolvedSchema.enum[0];
  }
  if (resolvedSchema.oneOf && resolvedSchema.oneOf.length) {
    return sampleFromSchema(document, resolvedSchema.oneOf[0]);
  }
  if (resolvedSchema.anyOf && resolvedSchema.anyOf.length) {
    return sampleFromSchema(document, resolvedSchema.anyOf[0]);
  }

  const type = schemaTypes(resolvedSchema).filter((item) => item !== 'null')[0];
  switch (type) {
    case 'object':
      return Object.keys(resolvedSchema.properties || {}).reduce(
        (result, name) => Object.assign(result, {
          [name]: sampleFromSchema(document, resolvedSchema.properties[name]),
        }),
        {}
      );
    case 'array':
      return [sampleFromSchema(document, resolvedSchema.items)];
    case 'integer':
    case 'number':
      return 0;
    case 'boolean':
      return false;
    case 'string':
      return '';
    default:
      return undefined;
  }
}

function sampleFromParameter(document, parameter) {
  if (Object.prototype.hasOwnProperty.call(parameter, 'example')) {
    return parameter.example;
  }
  if (parameter.examples) {
    const example = findFirstExample(document, parameter.examples);
    if (typeof example !== 'undefined') {
      return example;
    }
  }
  return sampleFromSchema(document, parameter.schema);
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function encodePart(value) {
  return encodeURIComponent(String(value));
}

function serializePrimitive(value) {
  return encodePart(value);
}

function serializeArray(value, delimiter) {
  return value.map(encodePart).join(delimiter);
}

function serializeObject(value, delimiter, assignmentDelimiter) {
  return Object.keys(value)
    .reduce((serialized, key) => {
      if (assignmentDelimiter === delimiter) {
        return serialized.concat([encodePart(key), encodePart(value[key])]);
      }
      return serialized.concat(
        `${encodePart(key)}${assignmentDelimiter}${encodePart(value[key])}`
      );
    }, [])
    .join(delimiter);
}

function serializeSimpleParameter(value, explode) {
  if (Array.isArray(value)) {
    return serializeArray(value, ',');
  }
  if (value && typeof value === 'object') {
    return serializeObject(value, ',', explode ? '=' : ',');
  }
  return serializePrimitive(value);
}

function serializeFormParameter(name, value, explode) {
  const serializedName = encodePart(name);

  if (Array.isArray(value)) {
    if (explode) {
      return value.map((item) => `${serializedName}=${encodePart(item)}`);
    }
    return [`${serializedName}=${serializeArray(value, ',')}`];
  }

  if (value && typeof value === 'object') {
    if (explode) {
      return Object.keys(value)
        .map((key) => `${encodePart(key)}=${encodePart(value[key])}`);
    }
    return [`${serializedName}=${serializeObject(value, ',', ',')}`];
  }

  return [`${serializedName}=${serializePrimitive(value)}`];
}

function getDefaultStyle(location) {
  return location === 'path' ? 'simple' : 'form';
}

function getDefaultExplode(style) {
  return style === 'form';
}

function compileParameters(document, pathTemplate, parameters) {
  let uri = pathTemplate;
  const query = [];

  parameters.forEach((parameter) => {
    const resolvedParameter = resolveRef(document, parameter);
    const value = sampleFromParameter(document, resolvedParameter);
    if (typeof value === 'undefined') {
      return;
    }

    if (resolvedParameter.in === 'path') {
      const style = resolvedParameter.style || getDefaultStyle(resolvedParameter.in);
      const explode = Object.prototype.hasOwnProperty.call(resolvedParameter, 'explode')
        ? resolvedParameter.explode
        : getDefaultExplode(style);
      const serializedValue = style === 'simple'
        ? serializeSimpleParameter(value, explode)
        : serializePrimitive(value);
      uri = uri.replace(
        new RegExp(`{${escapeRegExp(resolvedParameter.name)}}`, 'g'),
        serializedValue
      );
    } else if (resolvedParameter.in === 'query') {
      const style = resolvedParameter.style || getDefaultStyle(resolvedParameter.in);
      const explode = Object.prototype.hasOwnProperty.call(resolvedParameter, 'explode')
        ? resolvedParameter.explode
        : getDefaultExplode(style);
      if (style === 'form') {
        query.push(...serializeFormParameter(resolvedParameter.name, value, explode));
      } else {
        query.push(`${encodePart(resolvedParameter.name)}=${serializePrimitive(value)}`);
      }
    }
  });

  if (query.length) {
    uri = `${uri}?${query.join('&')}`;
  }

  return uri;
}

function isJSONMediaType(mediaType) {
  const type = mediaType.split(';')[0].trim();
  return type === 'application/json' || type.endsWith('+json');
}

function bodyFromMediaType(document, mediaType, mediaTypeObject) {
  if (Object.prototype.hasOwnProperty.call(mediaTypeObject, 'example')) {
    return isJSONMediaType(mediaType)
      ? JSON.stringify(mediaTypeObject.example)
      : String(mediaTypeObject.example);
  }

  const example = findFirstExample(document, mediaTypeObject.examples);
  if (typeof example !== 'undefined') {
    return isJSONMediaType(mediaType) ? JSON.stringify(example) : String(example);
  }

  const sample = sampleFromSchema(document, mediaTypeObject.schema);
  if (typeof sample === 'undefined') {
    return undefined;
  }
  return isJSONMediaType(mediaType) ? JSON.stringify(sample) : String(sample);
}

function getFirstContent(content) {
  const mediaType = Object.keys(content || {})[0];
  if (!mediaType) {
    return null;
  }
  return { mediaType, mediaTypeObject: content[mediaType] };
}

function compileRequest(document, method, uri, operation) {
  const request = {
    method: method.toUpperCase(),
    uri,
    headers: [],
    body: '',
  };

  const content = operation.requestBody && resolveRef(document, operation.requestBody).content;
  const firstContent = getFirstContent(content);
  if (firstContent) {
    request.headers.push({ name: 'Content-Type', value: firstContent.mediaType });
    const body = bodyFromMediaType(document, firstContent.mediaType, firstContent.mediaTypeObject);
    if (typeof body !== 'undefined') {
      request.body = body;
    }
  }

  return request;
}

function compileHeaders(document, headers) {
  return Object.keys(headers || {}).map((name) => {
    const header = resolveRef(document, headers[name]);
    const value = Object.prototype.hasOwnProperty.call(header, 'example')
      ? header.example
      : sampleFromSchema(document, header.schema);
    return { name, value: typeof value === 'undefined' ? '' : String(value) };
  });
}

function compileResponse(document, status, response, content) {
  const resolvedResponse = resolveRef(document, response);
  const compiledResponse = {
    status: status === 'default' ? '200' : String(status),
    headers: compileHeaders(document, resolvedResponse.headers),
  };

  if (content) {
    compiledResponse.headers.unshift({ name: 'Content-Type', value: content.mediaType });
    const body = bodyFromMediaType(document, content.mediaType, content.mediaTypeObject);
    if (typeof body !== 'undefined') {
      compiledResponse.body = body;
    }
    if (content.mediaTypeObject.schema) {
      const schema = cloneWithoutRef(document, content.mediaTypeObject.schema);
      if (schema && typeof schema === 'object' && !schema.$schema) {
        schema.$schema = document.jsonSchemaDialect || OAS_31_DIALECT;
      }
      compiledResponse.schema = JSON.stringify(schema);
    }
  }

  return compiledResponse;
}

function compileOrigin(filename, document, pathTemplate, method, response) {
  return {
    filename: filename || '',
    apiName: (document.info && document.info.title) || filename || '',
    resourceGroupName: '',
    resourceName: pathTemplate,
    actionName: method.toUpperCase(),
    exampleName: [
      response.status,
      response.headers
        .filter((header) => header.name.toLowerCase() === 'content-type')
        .map((header) => header.value)[0],
    ].filter(Boolean).join(' > '),
  };
}

function compileOperation(document, filename, pathTemplate, pathItem, method, operation) {
  const parameters = []
    .concat(pathItem.parameters || [])
    .concat(operation.parameters || []);
  const uri = compileParameters(document, pathTemplate, parameters);
  const request = compileRequest(document, method, uri, operation);

  return Object.keys(operation.responses || {}).reduce((transactions, status) => {
    const response = resolveRef(document, operation.responses[status]);
    const content = getFirstContent(response.content);
    const compiledResponse = compileResponse(document, status, response, content);
    const origin = compileOrigin(filename, document, pathTemplate, method, compiledResponse);
    transactions.push({
      request,
      response: compiledResponse,
      name: compileTransactionName(origin),
      origin,
    });
    return transactions;
  }, []);
}

module.exports = function compileOpenAPI31(apiElements, filename) {
  const { document } = apiElements.openapi31;
  const paths = document.paths || {};

  const transactions = Object.keys(paths).reduce((result, pathTemplate) => {
    const pathItem = resolveRef(document, paths[pathTemplate]);
    METHODS.forEach((method) => {
      const operation = pathItem[method];
      if (operation) {
        result.push(
          ...compileOperation(document, filename, pathTemplate, pathItem, method, operation)
        );
      }
    });
    return result;
  }, []);

  return {
    mediaType: 'application/vnd.oai.openapi',
    transactions,
    annotations: [],
  };
};
