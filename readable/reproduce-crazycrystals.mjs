import {crazyConfig} from './build-crazycrystals-rules.mjs';
import {reproduceReviewedGame} from './reviewed-game.mjs';

try {console.log(JSON.stringify(await reproduceReviewedGame(crazyConfig)));}
catch (error) {console.error(error.stderr?.toString() || error.stack); process.exitCode = 1;}
