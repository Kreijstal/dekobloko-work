'use strict';

const assert = require('assert');
const { decode } = require('../src/huffman');
const fixture = require("./fixtures/huffman.json");

function run() {
  let passed = 0;
  for (const [index, testCase] of fixture.cases.entries()) {
    const data = Buffer.from(testCase.hex_in, "hex");
    const got = decode(data, testCase.count);
    assert.strictEqual(got, testCase.expected,
      "huffman case " + index + ": got " + JSON.stringify(got));
    passed += 1;
  }
  console.log("huffman: " + passed + " passed, 0 failed");
}

module.exports = { run };
if (require.main === module) run();
