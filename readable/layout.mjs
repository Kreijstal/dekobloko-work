import path from 'node:path';
import {fileURLToPath} from 'node:url';

export const workflowRoot = fileURLToPath(new URL('./', import.meta.url));
export const workflowRepository = path.resolve(workflowRoot, '..');
// The source/export repository is an explicit integration dependency. No Java
// export is generated in Deko, including during checks of cloned worktrees.
export const funorbRepository = path.resolve(process.env.FUNORB_DECOMPILED_DIR ||
  path.join(workflowRepository, '..', 'funorb-decompiled'));
export const publishedReadableRoot = path.join(funorbRepository, 'readable');
export const manifestFile = path.join(workflowRoot, 'geoblox-rules.json');
