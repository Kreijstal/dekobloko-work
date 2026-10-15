'use strict';

const path = require('path');

const JT = path.resolve(process.env.JAVA_TOOLS_DIR || process.env.JT_DIR || path.join(__dirname, '../../..', 'java-tools'));

module.exports = require(path.join(JT, 'src/passes/rasterClipContinuation'));
