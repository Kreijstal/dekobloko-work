// Rolling source baseline for optimization experiments, separate from deployed
// bundles and the immutable revisions attached to historical observations.
// Advance after correctness and full-loading observations under the same
// constraints. Required correctness fixes may supersede historical comparators;
// retain their results without treating that replacement as a speedup.
export const benchmarkBaselineRevision='97aa42eb432bf494686c12c85d445cc4751241aa';
export const selectBenchmarkRevision=revision=>
 revision===undefined||revision==='baseline'?benchmarkBaselineRevision:revision;
