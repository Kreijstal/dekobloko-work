'use strict';
const path = require('node:path');
const dekoRoot = path.resolve(__dirname, '../..');
// A static web root, not a source checkout. Hosts choose the destination;
// the default keeps generated files inside Deko's ignored working directory.
const assetRoot = path.resolve(process.env.GAME_ASSETS_ROOT || path.join(dekoRoot, '.work/browser-assets'));
const catalogPath = path.join(assetRoot, 'game-catalog.json');
module.exports = {dekoRoot, assetRoot, catalogPath};
