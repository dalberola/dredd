import fury from '@apielements/core';

import parse from '../../parse/index.js';

import { assert, fixtures } from '../support.mjs';

describe('parse()', () => {
  const reMediaType = /\w+\/[\w.+]+/;

  describe('when valid document gets correctly parsed', () => {
    fixtures('ordinary').forEachDescribe(({ apiDescription }) => {
      let error;
      let mediaType;
      let apiElements;

      beforeEach((done) => {
        parse(apiDescription, (err, parseResult) => {
          error = err;
          if (parseResult) { ({ mediaType, apiElements } = parseResult); }
          done();
        });
      });

      it('produces no error', () => {
        assert.isNull(error);
      });
      it('produces API Elements', () => {
        assert.isObject(apiElements);
      });
      it('produces media type', () => {
        assert.match(mediaType, reMediaType);
      });
      it('the parse result is API Elements represented by minim objects', () => {
        assert.instanceOf(apiElements, fury.minim.elements.ParseResult);
      });
      it('the parse result contains no annotation elements', () => {
        assert.isTrue(apiElements.annotations.isEmpty);
      });
      it('the parse result contains source map elements', () => {
        const sourceMaps = apiElements
          .recursiveChildren
          .flatMap((element) => element.sourceMapValue);
        assert.ok(sourceMaps.length);
      });
    });
  });

  describe('when invalid document causes error', () => {
    fixtures('parser-error').forEachDescribe(({ apiDescription }) => {
      let error;
      let mediaType;
      let apiElements;

      beforeEach((done) => {
        parse(apiDescription, (err, parseResult) => {
          error = err;
          if (parseResult) { ({ mediaType, apiElements } = parseResult); }
          done();
        });
      });

      it('produces no error', () => {
        assert.isNull(error);
      });
      it('produces API Elements', () => {
        assert.isObject(apiElements);
      });
      it('produces media type', () => {
        assert.match(mediaType, reMediaType);
      });
      it('the parse result contains annotation elements', () => {
        assert.isFalse(apiElements.annotations.isEmpty);
      });
      it('the annotations are errors', () => {
        assert.equal(apiElements.errors.length, apiElements.annotations.length);
      });
    });
  });

  describe('when defective document causes warning', () => {
    fixtures('parser-warning').forEachDescribe(({ apiDescription }) => {
      let error;
      let mediaType;
      let apiElements;

      beforeEach((done) => {
        parse(apiDescription, (err, parseResult) => {
          error = err;
          if (parseResult) { ({ mediaType, apiElements } = parseResult); }
          done();
        });
      });

      it('produces no error', () => {
        assert.isNull(error);
      });
      it('produces API Elements', () => {
        assert.isObject(apiElements);
      });
      it('produces media type', () => {
        assert.match(mediaType, reMediaType);
      });
      it('the parse result contains annotation elements', () => {
        assert.isFalse(apiElements.annotations.isEmpty);
      });
      it('the annotations are warnings', () => {
        assert.equal(apiElements.warnings.length, apiElements.annotations.length);
      });
    });
  });
});
