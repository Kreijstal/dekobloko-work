import {lexicominosConfig} from './build-lexicominos-rules.mjs';
import {reproduceReviewedGame} from './reviewed-game.mjs';

try {console.log(JSON.stringify(await reproduceReviewedGame(lexicominosConfig)));}
catch (error) {console.error(error.stderr?.toString() || error.stack); process.exitCode = 1;}
