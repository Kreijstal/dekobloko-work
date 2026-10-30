// FunOrb host policy. The JVM only receives ordinary applet parameters.
import {selectedEscapeLevel} from './escape-levels.mjs';
export function configureApplet(controller, game, {codeBase = game.server, simpleMode = true, instanceId = Date.now()} = {}) {
  controller.options.appletParameters = {
    overxgames: '45', overxachievements: '1000', member: 'no',
    gameport1: '43594', gameport2: '43594', servernum: '8003',
    simplemode: String(simpleMode), instanceid: String(instanceId),
    gamecrc: String(game.gamecrc),
  };
  if(game.internalName==='escapevector') {
    const level=selectedEscapeLevel(globalThis.location?.search||'');
    if(level)controller.options.appletParameters.customlevel=level.id;
  }
  controller.options.appletCodeBase = codeBase;
}
