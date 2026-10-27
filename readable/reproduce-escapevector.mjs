import {escapeConfig} from './build-escapevector-rules.mjs';
import {reproduceReviewedGame} from './reviewed-game.mjs';

try {console.log(JSON.stringify(await reproduceReviewedGame(escapeConfig)));}
catch(error){console.error(error.stderr?.toString()||error.stack);process.exitCode=1;}
