const fury = require('@apielements/core');
const yaml = require('yaml-js');


fury.use(require('@apielements/apib-parser'));
fury.use(require('@apielements/openapi2-parser'));
fury.use(require('@apielements/openapi3-parser'));

const { Annotation, SourceMap, ParseResult } = fury.minim.elements;


function createAnnotation(type, message) {
  const element = new Annotation(message);
  element.classes.push(type);
  element.attributes.set('sourceMap', [
    new SourceMap([[0, 1]]),
  ]);
  return element;
}


function detectMediaType(apiDescription) {
  const adapters = fury.detect(apiDescription);
  if (adapters.length) {
    return { mediaType: adapters[0].mediaTypes[0], fallback: false };
  }
  return { mediaType: 'text/vnd.apiblueprint', fallback: true };
}


function parse(apiDescription, callback) {
  try {
    const document = yaml.load(apiDescription);
    const version = document && document.openapi;
    if (typeof version === 'string' && /^3\.1\.\d+$/.test(version)) {
      const apiElements = new ParseResult([]);
      apiElements.openapi31 = { document, source: apiDescription };
      callback(null, {
        mediaType: 'application/vnd.oai.openapi',
        apiElements,
      });
      return;
    }
  } catch (e) {
    // Let the existing parser produce the public parse annotations.
  }

  const { mediaType, fallback } = detectMediaType(apiDescription);

  fury.parse({
    source: apiDescription,
    mediaType,
    generateSourceMap: true,
  }, (err, parseResult) => {
    const apiElements = parseResult || new ParseResult([]);

    if (fallback) {
      apiElements.unshift(createAnnotation('warning', (
        'Could not recognize API description format, assuming API Blueprint'
      )));
    }
    if (err && !parseResult) {
      // The condition should be only 'if (err)'
      // https://github.com/apiaryio/api-elements.js/issues/167
      apiElements.unshift(createAnnotation('error', (
        `Could not parse API description: ${err.message}`
      )));
    }

    callback(null, { mediaType, apiElements });
  });
}


module.exports = parse;
