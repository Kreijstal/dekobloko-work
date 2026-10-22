// Rolling source baseline for optimization experiments, separate from deployed
// bundles and the immutable revisions attached to historical observations.
// Advance only after correctness and unchanged full-loading comparisons pass.
export const benchmarkBaselineRevision='aa23806e673abe4b80c6072b83df8929884c77e9';
export const selectBenchmarkRevision=revision=>
 revision===undefined||revision==='baseline'?benchmarkBaselineRevision:revision;
