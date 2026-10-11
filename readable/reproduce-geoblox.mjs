import {reproduceGame} from './game-export.mjs';
await reproduceGame('geoblox').catch(error => {
  console.error(error.stderr?.toString() || error.message);process.exitCode = 1;
});
