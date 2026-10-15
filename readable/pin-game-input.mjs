import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {inventory, validateNamedExport} from '../scripts/publish-decompiled-games.mjs';

const run = (command, args, options = {}) => execFileSync(command, args,
  {maxBuffer: 128 * 1024 * 1024, stdio: [options.input === undefined ? 'ignore' : 'pipe', 'pipe', 'pipe'], ...options});
const git = (repository, args, options = {}) => run('git', ['-C', repository, ...args], options);
const sha256 = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const json = bytes => JSON.parse(bytes);

function cleanHead(repository, expected) {
  const head = git(repository, ['rev-parse', 'HEAD']).toString().trim();
  if (!/^[a-f0-9]{40}$/.test(head) || expected && head !== expected ||
      git(repository, ['status', '--porcelain=v1', '--untracked-files=all']).length ||
      ['MERGE_HEAD', 'CHERRY_PICK_HEAD', 'REVERT_HEAD'].some(reference => optionalRef(repository, reference)))
    throw new Error('Input pinning requires the expected clean Git worktree and index');
  return head;
}

function optionalRef(repository, reference) {
  try { return git(repository, ['rev-parse', '--verify', '--quiet', reference]).toString().trim(); }
  catch (error) { if (error.status === 1) return null; throw error; }
}

/** Git-only staging after the full catalog publication check has succeeded.
 * The caller owns the gate; this helper still checks the committed source
 * identity, named receipt and clean index, and never replaces worktree files. */
export function recordVerifiedRawInput({destination, game, rawSources}) {
  if (!/^[a-z0-9_]+$/.test(game)) throw new Error('Invalid game identity');
  destination = path.resolve(destination);
  rawSources = path.resolve(rawSources);
  const parent = cleanHead(destination);
  const manifest = json(git(destination, ['show', `${parent}:decompilation-provenance.json`]));
  const record = manifest.publication?.games?.[game];
  const sources = inventory(path.resolve(rawSources), '.java');
  if (!sources.files || !record || record.sources?.files !== sources.files || record.sources?.sha256 !== sources.sha256 ||
      record.validation?.bytecodeVerifier !== 'pass' || record.validation?.javac !== 'pass')
    throw new Error('Raw input differs from the verified published catalog record');
  const receipt = manifest.namedExports?.[game];
  if (!receipt) {
    const current = inventory(path.join(destination, 'games', game), '.java', ['README.md']);
    if (current.sha256 !== sources.sha256 || current.files !== sources.files)
      throw new Error('Published raw source differs from the catalog');
    return {game, commit: parent, reference: null, parent, files: sources.files, sourceTreeSha256: sources.sha256};
  }
  validateNamedExport(destination, game, receipt);
  const dictionary = `decompilation/${game}-naming.json`;
  delete manifest.namedExports[game];
  if (!Object.keys(manifest.namedExports).length) delete manifest.namedExports;
  delete record.publishedSources;

  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'readable-input-index-'));
  const env = {...process.env, GIT_INDEX_FILE: path.join(temporary, 'index')};
  const indexedGit = args => git(destination, args, {env});
  try {
    indexedGit(['read-tree', parent]);
    const prefix = `games/${game}/`;
    const previous = git(destination, ['ls-tree', '-r', '--name-only', '-z', parent, '--', prefix])
      .toString().split('\0').filter(Boolean);
    const removed = [...previous, dictionary];
    for (let i = 0; i < removed.length; i += 128)
      indexedGit(['update-index', '--force-remove', '--', ...removed.slice(i, i + 128)]);
    const add = (file, bytes) => {
      const blob = git(destination, ['hash-object', '-w', '--stdin'], {input: bytes}).toString().trim();
      indexedGit(['update-index', '--add', '--cacheinfo', `100644,${blob},${file}`]);
    };
    for (const [file, expected] of sources.entries) {
      const bytes = fs.readFileSync(path.join(rawSources, file));
      if (sha256(bytes) !== expected) throw new Error('Raw input changed during pinning: ' + file);
      add(prefix + file, bytes);
    }
    add('decompilation-provenance.json', Buffer.from(JSON.stringify(manifest, null, 2) + '\n'));
    const tree = indexedGit(['write-tree']).toString().trim();
    const reference = `refs/readable-inputs/${game}`;
    const previousRef = optionalRef(destination, reference);
    // Never follow a symbolic input reference into another branch.
    try {
      git(destination, ['symbolic-ref', '--quiet', reference]);
      throw new Error('Raw input reference must not be symbolic');
    } catch (error) { if (error.status !== 1) throw error; }
    if (previousRef) {
      if (git(destination, ['cat-file', '-t', previousRef]).toString().trim() !== 'commit')
        throw new Error('Raw input reference must point directly to a commit');
      const previousTree = git(destination, ['rev-parse', previousRef + '^{tree}']).toString().trim();
      if (previousTree === tree) {
        cleanHead(destination, parent);
        return {game, commit: previousRef, reference, parent, files: sources.files, sourceTreeSha256: sources.sha256};
      }
      try { git(destination, ['merge-base', '--is-ancestor', previousRef, parent]); }
      catch (error) {
        if (error.status === 1) throw new Error('An unfinished raw input pin already exists: ' + reference);
        throw error;
      }
    }
    const message = `Freeze verified ${game} decompiler input\n\n` +
      `Raw Java source tree SHA-256: ${sources.sha256}\n` +
      'Preserve this input as an ancestor of its reproducible named export.\n';
    const commit = git(destination, ['commit-tree', tree, '-p', parent], {input: message}).toString().trim();
    cleanHead(destination, parent);
    // Verify HEAD and the previous marker together; another operation cannot
    // silently move either reference while this pending input is installed.
    git(destination, ['update-ref', '--stdin'], {input:
      `verify HEAD ${parent}\nupdate ${reference} ${commit} ${previousRef || '0'.repeat(40)}\n`});
    return {game, commit, reference, parent, files: sources.files, sourceTreeSha256: sources.sha256};
  } finally { fs.rmSync(temporary, {recursive: true, force: true}); }
}

export function pinGameInput({batch, destination, javaTools, game}) {
  if (!/^[a-z0-9_]+$/.test(game)) throw new Error('Invalid game identity');
  batch = path.resolve(batch); destination = path.resolve(destination); javaTools = path.resolve(javaTools);
  const parent = cleanHead(destination);
  const manifest = json(git(destination, ['show', `${parent}:decompilation-provenance.json`]));
  if (!manifest.publication?.games?.[game]) throw new Error('Unknown published game: ' + game);
  const publisherRoot = path.join(batch, 'tooling/dekobloko-work');
  const publisher = path.join(publisherRoot, 'scripts/publish-decompiled-games.mjs');
  const identity = manifest.publication.publisher;
  if (!identity || identity.commit !== cleanHead(publisherRoot) ||
      sha256(fs.readFileSync(publisher)) !== identity.sourceSha256)
    throw new Error('Batch publisher differs from the committed catalog publisher');
  // Replay the existing full-roster, compiler-pin, verifier, diagnostic,
  // fingerprint and stubs-only compilation gates before creating any Git pin.
  run(process.execPath, [publisher, batch, destination, javaTools, '--check']);
  cleanHead(destination, parent);
  return recordVerifiedRawInput({destination, game,
    rawSources: path.join(batch, game, 'decompile-owned/java')});
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const args = process.argv.slice(2);
    if (args.length !== 4) throw new Error('Usage: node readable/pin-game-input.mjs BATCH FUNORB_REPO JAVA_TOOLS GAME');
    const [batch, destination, javaTools, game] = args;
    console.log(JSON.stringify(pinGameInput({batch, destination, javaTools, game})));
  } catch (error) {
    console.error(error.stderr?.toString() || error.message);
    process.exitCode = 1;
  }
}
