// Rolling source baseline for optimization experiments, separate from deployed
// bundles and the immutable revisions attached to historical observations.
// Advance only after correctness and unchanged full-loading comparisons pass.
export const benchmarkBaselineRevision='f2c8ad04a4b035ee863cd3abc29ae44c5b88f083';
export const selectBenchmarkRevision=revision=>
 revision===undefined||revision==='baseline'?benchmarkBaselineRevision:revision;
