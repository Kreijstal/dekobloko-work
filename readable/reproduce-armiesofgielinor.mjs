import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {archivedInput, digest, funorbRepository, installNamedGame, verifyToolPin, workflowRoot} from './game-export.mjs';
import {generateReadable} from './tools/readable-java.mjs';
import {buildCompilationStubs} from './compilation-stubs.mjs';
import {buildArmiesGuide, validateArmiesManifest} from './build-armiesofgielinor-rules.mjs';
import {verifyArmiesCore} from './tests/test-armiesofgielinor-core.mjs';

const args=process.argv.slice(2);
if(args.length!==1||!['--update','--check'].includes(args[0])) throw new Error('Usage: node readable/reproduce-armiesofgielinor.mjs --update|--check');
const temporary=fs.mkdtempSync(path.join(os.tmpdir(),'armies-named-export-'));
try {
  verifyToolPin();
  const rulesFile=path.join(workflowRoot,'armiesofgielinor-rules.json');
  const rules=JSON.parse(fs.readFileSync(rulesFile));validateArmiesManifest(rules);
  const input=archivedInput(rules,temporary),stubs=buildCompilationStubs(funorbRepository,temporary);
  if(stubs.sourceTreeSha256!==rules.publication.stubSourceTreeSha256||digest(fs.readFileSync(stubs.jar))!==rules.publication.stubJarSha256)
    throw new Error('Compilation stub source/dependency changed');
  const generated=path.join(temporary,'generated');
  const result=generateReadable({input,output:generated,rulesFile,classpath:stubs.jar});
  const mapping=JSON.parse(fs.readFileSync(path.join(generated,'mapping.json')));
  const dictionary={...mapping,provenance:JSON.parse(fs.readFileSync(path.join(generated,'provenance.json'))),generators:rules.generators};
  dictionary.provenance.verification.gameplayCore=verifyArmiesCore(input,path.join(generated,'src'),mapping,stubs.jar,temporary);
  installNamedGame(funorbRepository,rules.game,generated,dictionary,buildArmiesGuide(rules,mapping),args[0]==='--check');
  console.log(JSON.stringify({...result,gameplayCore:dictionary.provenance.verification.gameplayCore,check:args[0]==='--check',publishedDirectory:'games/armiesofgielinor'}));
} catch(error) {console.error(error.stderr?.toString()||error.message);process.exitCode=1;}
finally {fs.rmSync(temporary,{recursive:true,force:true});}
