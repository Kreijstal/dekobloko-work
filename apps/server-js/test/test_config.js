'use strict';

// Golden-vector tests for src/config.js, generated from config.py via
// test/gen-vectors.py (see fixtures/config.json).

const assert = require('assert');
const { ServerConfig } = require('../src/config');
const fixture = require('./fixtures/config.json');

function run() {
  let passed = 0;
  for (const [index, testCase] of fixture.cases.entries()) {
    const config = new ServerConfig(testCase.inputs);
    const params = config.applet_params;
    assert.deepStrictEqual(
      params,
      testCase.applet_params,
      'applet_params mismatch on case ' + index,
    );
    // Frozen dataclass parity: mutation must throw in strict mode.
    let froze = false;
    try {
      'use strict';
      config.servernum = 1;
    } catch (_error) {
      froze = true;
    }
    assert.ok(froze, 'ServerConfig should be frozen (case ' + index + ')');
    passed += 1;
  }
  console.log('config: ' + passed + ' passed, 0 failed');
}

module.exports = { run };
if (require.main === module) run();
