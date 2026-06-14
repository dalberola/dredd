const fury = require('@apielements/core');

const { assert, fixtures } = require('../support');
const compileAnnotation = require('../../compile/compileAnnotation');

describe('compileAnnotation()', () => {
  const { Annotation } = fury.minim.elements;

  it('sets the type to error for error annotations', () => {
    const annotationElement = new Annotation('Ouch!');
    annotationElement.classes.push('error');
    const annotation = compileAnnotation(annotationElement);

    assert.propertyVal(annotation, 'type', 'error');
  });
  it('sets the type to warning for warning annotations', () => {
    const annotationElement = new Annotation('Ouch!');
    annotationElement.classes.push('warning');
    const annotation = compileAnnotation(annotationElement);

    assert.propertyVal(annotation, 'type', 'warning');
  });
  it('sets the source component of the annotation to parser', () => {
    const annotationElement = new Annotation('Ouch!');
    const annotation = compileAnnotation(annotationElement);

    assert.propertyVal(annotation, 'component', 'apiDescriptionParser');
  });
  it('sets message of the annotation', () => {
    const annotationElement = new Annotation('Ouch!');
    const annotation = compileAnnotation(annotationElement);

    assert.propertyVal(annotation, 'message', 'Ouch!');
  });
  it('sets location to null for no source maps', () => {
    const annotationElement = new Annotation('Ouch!');
    const annotation = compileAnnotation(annotationElement);

    assert.isNull(annotation.location);
  });

  fixtures('parser-warning').forEachDescribe(({ apiElements }) => {
    const { location } = compileAnnotation(apiElements.annotations.first);

    it('sets location in the expected format', () => {
      assert.isArray(location);
      assert.equal(location.length, 2);

      assert.isArray(location[0]);
      assert.equal(location[0].length, 2);
      assert.isNumber(location[0][0]);
      assert.isNumber(location[0][1]);

      assert.isArray(location[1]);
      assert.equal(location[1].length, 2);
      assert.isNumber(location[1][0]);
      assert.isNumber(location[1][1]);
    });
    it('has the first row number ≦ second row number', () => {
      assert.isAtMost(location[0][0], location[1][0]);
    });
  });
});
