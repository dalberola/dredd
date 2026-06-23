import { assert } from 'chai';

import { printClosingMessage } from '../../../lib/init';

function print(s) {
  print.output += `${s}\n`;
}

describe('init._printClosingMessage()', () => {
  beforeEach(() => {
    print.output = '';
  });

  it('mentions the config has been saved to dredd.yml', () => {
    printClosingMessage(print);
    assert.include(print.output, 'saved to dredd.yml');
  });
  it('tells the user how to run Dredd', () => {
    printClosingMessage(print);
    assert.include(print.output, '$ dredd');
  });
  it('does not mention installing hooks', () => {
    printClosingMessage(print);
    assert.notInclude(print.output, 'hooks');
  });
});
