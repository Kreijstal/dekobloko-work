// Rolling source baseline for optimization experiments, separate from deployed
// bundles and the immutable revisions attached to historical observations.
// Advance only after correctness and unchanged full-loading comparisons pass.
export const benchmarkBaselineRevision='679bcfba5dc05b9d991f81838b1a3c4fd265a039';
export const selectBenchmarkRevision=revision=>
 revision===undefined||revision==='baseline'?benchmarkBaselineRevision:revision;
