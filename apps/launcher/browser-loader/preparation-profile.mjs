// Profiles must be measured for this exact source and patch pair. Unknown
// revisions use the ordinary JVM policy rather than another game's profile.
export function selectPreparationProfile(profiles, sourceIdentity, patchIdentity) {
  if (!sourceIdentity || !patchIdentity || !Array.isArray(profiles)) return undefined;
  return profiles.find(profile => profile.sourceIdentity === sourceIdentity &&
    profile.patchIdentity === patchIdentity)?.policy;
}
