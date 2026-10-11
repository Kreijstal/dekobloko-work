import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {archivedInput, digest, funorbRepository, installNamedGame, verifyToolPin, workflowRoot} from './game-export.mjs';
import {generateReadable} from './tools/readable-java.mjs';
import {buildCompilationStubs} from './compilation-stubs.mjs';
import {buildSteelGuide, validateSteelManifest} from './build-steelsentinels-rules.mjs';
import {verifySteelCore} from './tests/test-steelsentinels-core.mjs';

const args=process.argv.slice(2);
if(args.length!==1||!['--update','--check'].includes(args[0])) throw new Error('Usage: node readable/reproduce-steelsentinels.mjs --update|--check');
const temporary=fs.mkdtempSync(path.join(os.tmpdir(),'steel-named-export-'));
try {
  verifyToolPin();
  const rulesFile=path.join(workflowRoot,'steelsentinels-rules.json');
  const rules=JSON.parse(fs.readFileSync(rulesFile));validateSteelManifest(rules);
  const input=archivedInput(rules,temporary),stubs=buildCompilationStubs(funorbRepository,temporary);
  if(stubs.sourceTreeSha256!==rules.publication.stubSourceTreeSha256||digest(fs.readFileSync(stubs.jar))!==rules.publication.stubJarSha256)
    throw new Error('Compilation stub source/dependency changed');
  const generated=path.join(temporary,'generated');
  const result=generateReadable({input,output:generated,rulesFile,classpath:stubs.jar});
  const mapping=JSON.parse(fs.readFileSync(path.join(generated,'mapping.json')));
  const dictionary={...mapping,provenance:JSON.parse(fs.readFileSync(path.join(generated,'provenance.json'))),generators:rules.generators};
  dictionary.provenance.verification.gameplayCore=verifySteelCore(input,path.join(generated,'src'),mapping,stubs.jar,temporary);
  installNamedGame(funorbRepository,rules.game,generated,dictionary,buildSteelGuide(rules,mapping),args[0]==='--check');
  console.log(JSON.stringify({...result,gameplayCore:dictionary.provenance.verification.gameplayCore,check:args[0]==='--check',publishedDirectory:'games/steelsentinels'}));
} catch(error) {console.error(error.stderr?.toString()||error.message);process.exitCode=1;}
finally {fs.rmSync(temporary,{recursive:true,force:true});}
