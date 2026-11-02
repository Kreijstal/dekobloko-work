import {cardConfig} from './build-36cardtrick-rules.mjs';
import {reproduceReviewedGame} from './reviewed-game.mjs';

try {console.log(JSON.stringify(await reproduceReviewedGame(cardConfig)));}
catch (error) {console.error(error.stderr?.toString() || error.stack); process.exitCode = 1;}
