import {config} from './build-stellarshard-rules.mjs';
import {reproduceReviewedGame} from './reviewed-game.mjs';

try {console.log(JSON.stringify(await reproduceReviewedGame(config)));}
catch (error) {console.error(error.stderr?.toString() || error.stack); process.exitCode = 1;}
