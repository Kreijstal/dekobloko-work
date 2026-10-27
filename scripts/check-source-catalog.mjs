import fs from 'node:fs';
import path from 'node:path';
import {inventory, validateNamedExport, validateRawClassRepairs} from './publish-decompiled-games.mjs';

const repository = path.resolve(process.argv[2] || '../funorb-decompiled');
const manifest = JSON.parse(fs.readFileSync(path.join(repository, 'decompilation-provenance.json')));
const records = manifest.publication.games;
if (JSON.stringify(fs.readdirSync(path.join(repository, 'games')).sort()) !== JSON.stringify(Object.keys(records).sort()))
  throw new Error('Catalog roster differs');
let files = 0;
for (const [game, record] of Object.entries(records)) {
  const named = manifest.namedExports?.[game];
  const sources = named ? validateNamedExport(repository, game, named) : inventory(path.join(repository, 'games', game), '.java', ['README.md']);
  const expected = named ? record.publishedSources : record.sources;
  if (sources.files !== expected?.files || sources.sha256 !== expected.sha256) throw new Error('Published source differs: ' + game);
  validateRawClassRepairs(repository, game, record, named);
  files += sources.files;
}
console.log(JSON.stringify({games: Object.keys(records).length, files, namedGames: Object.keys(manifest.namedExports || {}), allSourceIdentitiesChecked: true}));
