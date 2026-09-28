# Disabled renderer experiments

The renderer helpers in `game-source-patches.mjs`, `layer-dirty-bounds.mjs`,
`empty-run-copy.mjs`, and `outline-output-parameters.mjs` are experimental.
They are not registered in the normal loader or its manifest.

The dirty-bounds patch validates the complete original GeoBlox source map
against `layer-dirty-bounds-source-identity.mjs` before applying coupled
transforms. Apply it before per-file transformations. The writer inventory
is a review aid, not proof of alias safety. Unknown writes invalidate bounds;
unsupported shapes retain the original implementation.

Native Java differential tests cover pixels, exceptions, aliases, publication,
and source guards. Their success does not establish browser performance.
The latest isolated dirty-bounds run recorded 24 median AWT submissions per
second, minimum 9 in a rolling second, and a 209.6 ms worst gap. These are not
actual presented-frame measurements and do not meet the mandatory 24 FPS floor.
Empty-run copying and explicit outline output showed no demonstrated median
improvement. Do not enable these experiments as a performance release without
constrained browser validation.

Detailed experiment commands and evidence are in the cloner repository's
`JVM-MEMORY-VALIDATION.md` on `fix/jvm-measurement`.
