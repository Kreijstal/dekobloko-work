# Native JRE versus JVM.js main-menu startup time

Measured August 12, 2026. The native measurements use OpenJDK 11.0.31 on
Linux/x64. The probe loads each applet and game classes reflectively, supplies
the same `simplemode=true` applet parameters as the JVM.js acceptance harness,
and discovers initialized software framebuffers through reflection. Games that
select the native OpenGL renderer have no Java `int[]` framebuffer, so the same
probe falls back to capturing the applet rectangle through AWT. Both paths use
the JVM.js harness's palette/density/frame-history menu classifier and its
10-second settling window; there is no game, class, method, or field-name list.

The native runs are one warm-cache sample per variant, executed serially with
original before recompiled. “Recompiled” means the class tree compiled from the
owned decompiler's generated Java and ABI-restored against the original jar.
All 88 native runs reached the checkpoint. The original and recompiled native
medians are **28.069 s** and **28.539 s**. The median of the 44 paired percentage
changes is **−0.07%**, so generated Java has no general native-JRE startup
penalty. TerraPhoenix is the conspicuous exception: **58.205 s → 113.554 s** and
deserves a separate repeated/profiled investigation.

The JVM.js values are the existing exact-class-tree acceptance results, not a
new controlled speed benchmark. Nineteen are serial runs; 25 came from a
three-game batch and include CPU contention. They use the same recompiled class
tree hashes proven by `scripts/audit-recompiled-main-menu-evidence.js`. Their
median is **328.144 s**, and the median per-game JVM.js/JRE ratio is **11.24×**.
Because of the mixed JVM.js run modes, use the individual ratios to locate large
gaps, not to claim precise engine speedups.

| Game | JRE original | JRE recompiled | JRE change | JVM.js recompiled | JVM.js / JRE | JVM.js run |
| --- | ---: | ---: | ---: | ---: | ---: | :---: |
| Thirty-Six Card Trick | 24.664 s | 24.598 s | -0.3% | 248.528 s | 10.1× | 3-way |
| Ace of Skies | 27.336 s | 26.997 s | -1.2% | 618.946 s | 22.9× | 3-way |
| Arcanists | 29.314 s | 29.327 s | +0.0% | 581.588 s | 19.8× | 3-way |
| Armies of Gielinor | 39.682 s | 39.126 s | -1.4% | 981.927 s | 25.1× | 3-way |
| Bachelor Fridge | 27.918 s | 28.501 s | +2.1% | 50.767 s | 1.8× | serial |
| Bouncedown | 25.553 s | 25.381 s | -0.7% | 215.871 s | 8.5× | 3-way |
| Brick-A-Brac | 30.558 s | 30.837 s | +0.9% | 381.402 s | 12.4× | 3-way |
| Chess | 28.572 s | 28.576 s | +0.0% | 279.522 s | 9.8× | 3-way |
| Confined | 30.231 s | 29.882 s | -1.2% | 332.897 s | 11.1× | 3-way |
| Crazy Crystals | 28.213 s | 28.931 s | +2.5% | 113.393 s | 3.9× | serial |
| Deko Bloko | 27.824 s | 27.848 s | +0.1% | 182.357 s | 6.5× | 3-way |
| Dr. Phlogiston Saves The Earth | 27.925 s | 27.717 s | -0.7% | 382.536 s | 13.8× | serial |
| Dungeon Assault | 30.753 s | 30.821 s | +0.2% | 506.985 s | 16.4× | 3-way |
| Escape Vector | 26.446 s | 27.181 s | +2.8% | 261.624 s | 9.6× | 3-way |
| Flea Circus | 26.655 s | 26.607 s | -0.2% | 168.093 s | 6.3× | serial |
| Geoblox | 25.645 s | 25.694 s | +0.2% | 753.807 s | 29.3× | 3-way |
| Hold The Line | 27.398 s | 27.275 s | -0.4% | 856.251 s | 31.4× | 3-way |
| Hostile Spawn | 30.151 s | 29.783 s | -1.2% | 593.285 s | 19.9× | serial |
| Kickabout League | 33.317 s | 33.127 s | -0.6% | 181.631 s | 5.5× | 3-way |
| Lexicominos | 27.884 s | 29.766 s | +6.7% | 224.284 s | 7.5× | 3-way |
| Miner Disturbance | 26.856 s | 26.769 s | -0.3% | 354.267 s | 13.2× | 3-way |
| Monkey Puzzle 2 | 26.013 s | 26.379 s | +1.4% | 363.601 s | 13.8× | 3-way |
| Orb Defence | 25.849 s | 26.037 s | +0.7% | 330.962 s | 12.7× | 3-way |
| Pixelate | 28.334 s | 28.310 s | -0.1% | 321.246 s | 11.3× | 3-way |
| Pool | 31.565 s | 31.585 s | +0.1% | 219.125 s | 6.9× | serial |
| Shattered Plans | 29.726 s | 30.368 s | +2.2% | 646.074 s | 21.3× | 3-way |
| Sol-Knight | 27.407 s | 27.602 s | +0.7% | 271.724 s | 9.8× | 3-way |
| Star Cannon | 25.176 s | 25.337 s | +0.6% | 276.108 s | 10.9× | 3-way |
| Steel Sentinels | 30.400 s | 30.459 s | +0.2% | 371.358 s | 12.2× | serial |
| Stellar Shard | 25.473 s | 25.334 s | -0.5% | 1020.094 s | 40.3× | 3-way |
| Sumoblitz | 30.661 s | 28.874 s | -5.8% | 586.764 s | 20.3× | 3-way |
| TerraPhoenix | 58.205 s | 113.554 s | +95.1% | 717.486 s | 6.3× | 3-way |
| TetraLink | 29.603 s | 29.571 s | -0.1% | 139.564 s | 4.7× | serial |
| Tomb Racer | 42.252 s | 39.725 s | -6.0% | 853.068 s | 21.5× | serial |
| Tor Challenge | 27.892 s | 27.923 s | +0.1% | 610.599 s | 21.9× | serial |
| Torquing! | 30.842 s | 29.393 s | -4.7% | 257.140 s | 8.7× | serial |
| The Track Controller | 26.274 s | 26.389 s | +0.4% | 97.293 s | 3.7× | serial |
| Transmogrify | 27.214 s | 27.121 s | -0.3% | 211.846 s | 7.8× | serial |
| Vertigo 2 | 35.273 s | 35.151 s | -0.3% | 282.259 s | 8.0× | serial |
| Virogrid | 40.029 s | 39.870 s | -0.4% | 836.889 s | 21.0× | serial |
| Void Hunters | 35.842 s | 32.823 s | -8.4% | 297.702 s | 9.1× | serial |
| Wizard Run | 27.185 s | 27.295 s | +0.4% | 325.325 s | 11.9× | serial |
| Zombie Dawn | 27.022 s | 27.008 s | -0.1% | 197.233 s | 7.3× | serial |
| Zombie Dawn Multiplayer | 30.031 s | 29.716 s | -1.0% | 484.599 s | 16.3× | serial |

## Reproduction

The native coordinator and reflection probe are:

- `scripts/run-jre-reflection-main-menu.js`
- `scripts/jre-reflection-main-menu/ReflectionMainMenuProbe.java`

The native measurements are recorded under the ignored
`.work/jre-reflection-main-menu/` directory. The JVM.js reports are under the
ignored `.work/alterorb-jvmjs/` directory. Regenerate the Markdown table with:

```bash
node scripts/render-startup-comparison-table.js \
  --jre-report <native-report> \
  --jvmjs-report <jvmjs-report>
```

The renderer accepts each option repeatedly, rejects duplicate game/variant
evidence, and fails if any game lacks one of the three required measurements.
The checked-in table combines the 43-game native report plus the isolated Ace
of Skies pair, and the three exact-tree JVM.js evidence groups documented in
`docs/recompiled-runtime-validation.md`.
