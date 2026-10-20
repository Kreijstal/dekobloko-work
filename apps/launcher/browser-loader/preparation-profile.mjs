// One shared dependency list for the standalone intro and the applet. These
// loop-free rotation helpers were observed compiling during the intro's first
// frame. Selecting them changes compilation timing, never Java execution.
const rotationHelpers = Object.freeze([
  'DelegatingCanvas.sineQ16(BI)I',
  'IntrusiveNodeHashTable.cosineQ16(II)I',
  'ArchiveIndex.buildLogoRotationTransform(IBI)[I',
  'Geoblox.prepareLogoMeshRotation(BI)V',
]);
const geobloxSources = [
  // The class digest includes the standalone patch as well as game classes.
  ['d1e394b07ecc5cabd0f5a4aa0801bfa3345db13811a5104e0fa85f0720740b98', 'standalone-intro-v1'],
  // Readable funorb-decompiled export consumed by the normal GitHub launcher.
  ['b168d7edeb104599156b5f908df62dfdc9f3b250', 'catalog-account-server-v11-voice-cursor'],
];

export function geobloxPreparationPolicy(sourceIdentity, patchIdentity) {
  if (!geobloxSources.some(([source, patch]) => source === sourceIdentity && patch === patchIdentity)) return undefined;
  return {priorityMethods: [...rotationHelpers], wasmCalleeMethods: [...rotationHelpers]};
}

// Unknown revisions use the ordinary JVM policy rather than another revision's
// symbols. Application-specific entry points and budgets remain with the host.
export function selectPreparationProfile(profiles, sourceIdentity, patchIdentity) {
  if (!sourceIdentity || !patchIdentity || !Array.isArray(profiles)) return undefined;
  return profiles.find(profile => profile.sourceIdentity === sourceIdentity &&
    profile.patchIdentity === patchIdentity)?.policy;
}

export function selectGamePreparationProfile(game, sourceIdentity, patchIdentity, fallbackPolicy) {
  const policy = selectPreparationProfile(game.preparationProfiles, sourceIdentity, patchIdentity) ?? fallbackPolicy;
  const shared = game.internalName === 'geoblox' && geobloxPreparationPolicy(sourceIdentity, patchIdentity);
  if (!shared) return policy;
  return {...policy,
    priorityMethods: [...new Set([...shared.priorityMethods, ...(policy?.priorityMethods || [])])],
    wasmCalleeMethods: [...new Set([...shared.wasmCalleeMethods, ...(policy?.wasmCalleeMethods || [])])],
  };
}
