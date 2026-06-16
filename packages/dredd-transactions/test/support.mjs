import { assert, use } from 'chai';
import chaiJsonSchema from './chaiJsonSchema.mjs';
import fixtures from './fixtures/index.js';

use(chaiJsonSchema);

export { assert, fixtures };
