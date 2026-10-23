// Rolling source baseline for optimization experiments, separate from deployed
// bundles and the immutable revisions attached to historical observations.
// Advance after correctness and full-loading observations under the same
// constraints. Required correctness fixes may supersede historical comparators;
// retain their results without treating that replacement as a speedup.
export const benchmarkBaselineRevision='42066793907a9308c2420fbeea2afd013cd380df';
export const selectBenchmarkRevision=revision=>
 revision===undefined||revision==='baseline'?benchmarkBaselineRevision:revision;
