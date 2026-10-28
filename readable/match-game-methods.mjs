import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {funorbRepository} from './game-export.mjs';
import {isOpaqueName} from './naming-coverage.mjs';

// Read-only review aid, never an automatic renamer or an equivalence proof.
// Keep operators/constants and identifier reuse; normalize local spelling and
// obfuscated exception-context prefixes. Shared semantic class names must agree.
const keywords = new Set(('abstract assert boolean break byte case catch char class const continue default do double else enum extends final finally float for goto if implements import instanceof int interface long native new package private protected public return short static strictfp super switch synchronized this throw throws transient try void volatile while true false null').split(' '));
const platformTypes = new Set(('Object String StringBuilder StringBuffer Class Throwable Exception RuntimeException Error IOException Math System Arrays Integer Long Float Double Boolean Byte Character Short java javax').split(' '));
const tokenPattern = /\s+|\/\/[^\n]*|\/\*[\s\S]*?\*\/|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|[$_\p{ID_Start}][$_\p{ID_Continue}]*|(?:0[xX][\da-fA-F]+|\d+(?:\.\d*)?(?:[eE][+-]?\d+)?)[fFdDlL]?|>>>=|>>>|>>=|<<=|>>|<<|\+\+|--|&&|\|\||==|!=|<=|>=|\+=|-=|\*=|\/=|%=|&=|\|=|\^=|->|::|./guy;

function tokens(source) {
  const result = []; let offset = 0;
  while (offset < source.length) {
    tokenPattern.lastIndex = offset;
    const match = tokenPattern.exec(source);
    if (!match) throw new Error('Unsupported source token at ' + offset);
    offset = tokenPattern.lastIndex;
    if (!/^\s|^\/\//.test(match[0]) && !match[0].startsWith('/*'))
      result.push({text:match[0],start:match.index,end:offset});
  }
  return result;
}

function publishedPosition(position, edits) {
  let shift = 0;
  for (const edit of edits) {
    if (edit.start >= position) break;
    if (edit.end > position) throw new Error('Declaration starts inside an edit');
    shift += edit.renamed.length - (edit.end - edit.start);
  }
  return position + shift;
}

export function methodShapes(mapping, loadSource) {
  const types = new Set(mapping.symbols.filter(row => row.symbol.startsWith('C:') && !isOpaqueName(row.renamedName)).map(row => row.renamedName));
  const fileRows = new Map(mapping.files.map(row => [row.original,row]));
  const cached = new Map(), result = [];
  for (const row of mapping.symbols) {
    if (!row.symbol.startsWith('M:') || row.symbol.includes('.<init>(')) continue;
    const file = fileRows.get(row.declaration.file);
    if (!file) throw new Error('Missing method source: ' + row.symbol);
    if (!cached.has(file.original)) cached.set(file.original,tokens(loadSource(file)));
    const sourceTokens = cached.get(file.original);
    const position = publishedPosition(row.declaration.start,file.edits || []);
    let index = sourceTokens.findIndex(token => token.start === position);
    if (index < 0 || sourceTokens[index].text !== row.renamedName) throw new Error('Stale method declaration: ' + row.symbol);
    index++;
    if (sourceTokens[index]?.text !== '(') throw new Error('Missing method parameters: ' + row.symbol);
    let depth = 0;
    for (;index < sourceTokens.length;index++) {
      const value = sourceTokens[index].text;
      if (value === '(') depth++;
      if (value === ')') depth--;
      if (!depth && (value === '{' || value === ';')) break;
    }
    if (sourceTokens[index]?.text !== '{') continue; // abstract/native contract
    const body = [], identifiers = new Map(); depth = 0;
    for (;index < sourceTokens.length;index++) {
      let value = sourceTokens[index].text;
      if (value === '{') depth++;
      if (value === '}') depth--;
      if (/^[$_\p{ID_Start}]/u.test(value) && !keywords.has(value) && !platformTypes.has(value) && !types.has(value)) {
        if (!identifiers.has(value)) identifiers.set(value,'identifier'+identifiers.size);
        value = identifiers.get(value);
      } else if (value.startsWith('"')) {
        value = value.replace(/^"[a-z]{1,2}\.[A-Z]{1,4}\(/,'"exceptionContext(');
      }
      body.push(value);
      if (!depth) break;
    }
    if (depth) throw new Error('Unclosed method: ' + row.symbol);
    const renamed = row.renamedSymbol || row.symbol;
    const paren = renamed.indexOf('('), dot = renamed.lastIndexOf('.',paren);
    const owner = renamed.slice(2,dot), descriptor = renamed.slice(paren);
    if (isOpaqueName(owner.split('$')[0])) continue;
    result.push({symbol:row.symbol,name:row.renamedName,owner,descriptor,file:file.renamed,
      tokens:body.length,shape:crypto.createHash('sha256').update(JSON.stringify(body)).digest('hex')});
  }
  return result;
}

export function matchMethods(target, references, minimumTokens = 70) {
  const index = new Map();
  for (const row of references) {
    if (isOpaqueName(row.name)) continue;
    const key = JSON.stringify([row.owner,row.descriptor,row.shape]);
    if (!index.has(key)) index.set(key,[]);
    index.get(key).push(row);
  }
  const candidates = [];
  for (const row of target) {
    if (!isOpaqueName(row.name) || row.tokens < minimumTokens) continue;
    const matches = index.get(JSON.stringify([row.owner,row.descriptor,row.shape])) || [];
    if (new Set(matches.map(match => match.name)).size !== 1) continue;
    candidates.push({...row,proposedName:matches[0].name,
      references:matches.map(match => ({game:match.game,symbol:match.symbol,name:match.name}))});
  }
  return candidates;
}

function readShapes(game) {
  if (!/^[a-z0-9]+$/.test(game)) throw new Error('Invalid game name');
  const mapping = JSON.parse(fs.readFileSync(path.join(funorbRepository,'decompilation',game+'-naming.json')));
  return methodShapes(mapping,file => {
    const source = fs.readFileSync(path.join(funorbRepository,'games',game,file.renamed),'utf8');
    if (crypto.createHash('sha256').update(source).digest('hex') !== file.outputSha256)
      throw new Error('Modified published source: '+game+'/'+file.renamed);
    return source;
  }).map(row => ({...row,game}));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [game,...selected] = process.argv.slice(2);
  if (!game) throw new Error('Usage: node readable/match-game-methods.mjs GAME [REFERENCE_GAME ...]');
  const references = selected.length ? selected : ['geoblox','dekobloko','armiesofgielinor','brickabrac','steelsentinels','aceofskies'];
  const target = readShapes(game), pool = references.filter(name => name !== game).flatMap(readShapes);
  const candidates = matchMethods(target,pool);
  console.log(JSON.stringify({game,inspectedMethods:target.length,referenceMethods:pool.length,
    candidates:candidates.length,reviewRequired:true,examples:candidates.slice(0,30)},null,2));
}
