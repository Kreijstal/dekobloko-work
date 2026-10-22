// Rolling source baseline for optimization experiments, separate from deployed
// bundles and the immutable revisions attached to historical observations.
// Advance only after correctness and unchanged full-loading comparisons pass.
export const benchmarkBaselineRevision='8789cccad5c3b6bc22d585f0a58082de5d44ea08';
export const selectBenchmarkRevision=revision=>
 revision===undefined||revision==='baseline'?benchmarkBaselineRevision:revision;
