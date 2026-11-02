import {confinedConfig} from './build-confined-rules.mjs';
import {reproduceReviewedGame} from './reviewed-game.mjs';

try {console.log(JSON.stringify(await reproduceReviewedGame(confinedConfig)));}
catch (error) {console.error(error.stderr?.toString() || error.stack); process.exitCode = 1;}
