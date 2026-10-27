import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {withPinnedCompiler} from './pinned-compiler.mjs';
import {digest} from './game-export.mjs';
import {sourceInventory, sourceIdentity} from './tools/readable-java.mjs';

// Apply existing generic default proofs, never text replacements or assumptions
// about game guards. Preserve the historical source for independent comparison.
export function prepareEscapeVector(input, temporary) {
  fs.cpSync(input, path.join(temporary, 'historical-source'), {recursive: true});
  const compiler = {commit: '1162ba86b839d9dcd1028f3ee11b728f329fa2bb',
    sourceArchiveSha256: 'a4282cf5d26b64507f5d6e233c4d13febb06b09d90eabf45cdbb5de43aed3406'};
  return withPinnedCompiler(compiler.commit, compiler.sourceArchiveSha256, (require, root) => {
    const emitter = require(path.join(root, 'src/decompiler/javaAstEmitter.js'));
    const stages = [];
    for (const [name, recover, keys] of [
      ['declarations', emitter.localizeCompilationUnitDeclarations,
        ['bodiesLocalized', 'declarationsMoved', 'declarationsMerged', 'inertStoresRemoved']],
      ['decisions', emitter.simplifyCompilationUnitDecisions,
        ['bodiesSimplified', 'dispatchesRecovered', 'predicatesSimplified', 'predicateGroupsRemoved', 'elseIfBlocksRemoved',
          'frameCleanups', 'valueBranchesFolded', 'booleanLocalsPromoted', 'booleanComparisonsRecovered', 'booleanSelectionsRecovered']],
    ]) {
      const before = sourceInventory(input), files = [], counts = Object.fromEntries(keys.map(k => [k, 0]));
      for (const entry of before) {
        const file = path.join(input, entry.path), source = fs.readFileSync(file, 'utf8'), result = recover(source);
        assert.deepEqual(recover(source), result, 'Nondeterministic recovery: ' + entry.path);
        assert.equal(recover(result.source).source, result.source, 'Non-idempotent recovery: ' + entry.path);
        if (source === result.source) continue;
        for (const key of keys) counts[key] += result[key];
        files.push({file: entry.path, inputSha256: entry.sha256, outputSha256: digest(result.source),
          ...Object.fromEntries(keys.map(k => [k, result[k]]))});
        fs.writeFileSync(file, result.source);
      }
      stages.push({name, inputTreeSha256: sourceIdentity(before), outputTreeSha256: sourceIdentity(sourceInventory(input)),
        filesChecked: before.length, filesChanged: files.length, ...counts, files});
    }
    return {compiler, stages, defaultCompilerProofs: true, deterministic: true, idempotent: true};
  });
}
