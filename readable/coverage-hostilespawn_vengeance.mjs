// naming-coverage.mjs's CLI rejects underscores in game ids; call its API directly.
import fs from 'node:fs';
import path from 'node:path';
import {namingCoverage} from './naming-coverage.mjs';
import {funorbRepository} from './game-export.mjs';

const game = 'hostilespawn_vengeance';
const result = namingCoverage(JSON.parse(fs.readFileSync(path.join(funorbRepository, 'decompilation', game + '-naming.json'))));
console.log(JSON.stringify({...result, unresolvedClasses: result.unresolvedClasses.length,
  unresolvedMethods: result.unresolvedMethods.length,
  nextClasses: result.unresolvedClasses.slice(0, 8), nextMethods: result.unresolvedMethods.slice(0, 8)}));
