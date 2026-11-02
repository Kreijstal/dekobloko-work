import {dungeonConfig} from './build-dungeonassault-rules.mjs';
import {reproduceReviewedGame} from './reviewed-game.mjs';

try {console.log(JSON.stringify(await reproduceReviewedGame(dungeonConfig)));}
catch (error) {console.error(error.stderr?.toString() || error.stack); process.exitCode = 1;}
