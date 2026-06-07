# GOTO Baseline Runbook

This doc is the canonical guide for regenerating and validating CFR GOTO baselines.

## Purpose

The deobfuscation pipeline can produce `** GOTO` markers and `Unable to fully structure code` markers in CFR output. We track those as a regression budget per game under

- `.work/games/<game>/deob-safe/logs/cfr-markers.txt`

and compare against checked-in expected baselines.

## Required repositories and files

- `dekobloko-work` (this repo)
- `java-tools` (required by `scripts/pipeline/bulk-pipeline.js`)
- `lib/cfr.jar`
- a populated `.work/games` tree with game classes (at minimum `<game>/classes`)

Nothing else is required to run the baseline scripts.

## Scripts involved

- `scripts/regenerate-goto-baseline.sh`: runs bytecode pipeline + CFR on each game and writes:
  - `.work/games/<game>/deob-safe/out`
  - `.work/games/<game>/deob-safe/cfr`
  - `.work/games/<game>/deob-safe/logs/pipeline.log`
  - `.work/games/<game>/deob-safe/logs/cfr.log`
  - `.work/games/<game>/deob-safe/logs/cfr-markers.txt`
- `scripts/check-goto-baseline.sh`: validates current markers against:
  - `scripts/EXPECTED-GOTO-ALL-GAMES.tsv` (upper bounds)
  - `scripts/EXPECTED-GOTO-FREE-GAMES.txt` (games expected to have `0` goto markers)
- `scripts/analyze-goto-pass-impact.js`: identifies which pipeline pass increases `** GOTO`
  markers on a class set by running pipeline incrementally and counting CFR markers.

## Commands

Run across all games:

```bash
./scripts/regenerate-goto-baseline.sh .work/games
./scripts/check-goto-baseline.sh .work/games
```

Tune timeouts if needed:

```bash
PIPELINE_TIMEOUT_SECONDS=1800 CFR_TIMEOUT_SECONDS=600 ./scripts/regenerate-goto-baseline.sh .work/games
```

Run just one game for faster iteration:

```bash
./scripts/regenerate-goto-baseline.sh .work/games/<game>
./scripts/check-goto-baseline.sh .work/games/<game>
```

When the baseline regresses and you need to attribute the increase to a pass:

```bash
node scripts/analyze-goto-pass-impact.js .work/games/<game>/classes --sample-classes 12 --max-passes 40
node scripts/analyze-goto-pass-impact.js classes-original --sample-classes 12 --max-passes 80 --json > /tmp/impact.json
```

> `check-goto-baseline.sh` expects markers for listed games. If a game is
> missing (`deob-safe/logs/cfr-markers.txt` absent), it reports regression.

## Check output interpretation

`check-goto-baseline.sh` prints one line per game:

- `REGRESSION` when any of `gotos`, `unable`, `classes` exceed baseline bounds.
- `improved` when all three are below baseline bounds.
- separate “expected 0 GOTO markers” section for games listed in `EXPECTED-GOTO-FREE-GAMES.txt`.

Exit code is non-zero if any regression exists.

## Latest all-games rerun (2026-06-07)

Ran with:

```bash
PIPELINE_TIMEOUT_SECONDS=1800 CFR_TIMEOUT_SECONDS=600 ./scripts/regenerate-goto-baseline.sh .work/games
./scripts/check-goto-baseline.sh .work/games
```

Result:

- `FAIL: 53 regression(s), 3 improvement(s), 360 GOTO markers across 43 games, 440 unable markers`
- 3 games improved versus baseline: `holdtheline`, `steelsentinels`, `tetralink`

Top remaining GOTO-heavy games from this run:

1. `voidhunters` — gotos=58 unable=93 classes=16
2. `shatteredplans` — gotos=28 unable=31 classes=16
3. `brickabrac` — gotos=24 unable=13 classes=8
4. `bachelorfridge` — gotos=18 unable=13 classes=6
5. `torchallenge` — gotos=16 unable=13 classes=8

Full regression lines captured from check output are listed below:

```text
36cardtrick                  expected<=0/1/1 got=1/2/2 REGRESSION
aceofskies                   expected<=10/2/2 got=2/3/3 REGRESSION
arcanistsmulti               expected<=8/6/5 got=9/14/7 REGRESSION
armiesofgielinor             expected<=12/5/5 got=8/12/4 REGRESSION
bachelorfridge               expected<=0/2/2 got=18/13/6 REGRESSION
bouncedown                   expected<=0/1/1 got=2/4/4 REGRESSION
brickabrac                   expected<=24/8/7 got=24/13/8 REGRESSION
chess                        expected<=4/3/3 got=3/8/4 REGRESSION
confined                     expected<=2/2/2 got=1/3/3 REGRESSION
crazycrystals                expected<=0/1/1 got=1/2/2 REGRESSION
drphlogistonsavestheearth    expected<=3/2/2 got=7/14/6 REGRESSION
dungeonassault               expected<=3/4/2 got=5/5/4 REGRESSION
escapevector                 expected<=3/2/2 got=5/6/6 REGRESSION
fleacircus                   expected<=8/2/2 got=4/4/4 REGRESSION
geoblox                      expected<=9/4/2 got=13/14/5 REGRESSION
holdtheline                  expected<=5/5/5 got=4/5/5 improved
hostilespawn_vengeance       expected<=8/5/5 got=14/11/7 REGRESSION
kickabout                    expected<=14/7/7 got=15/16/7 REGRESSION
lexicominos                  expected<=0/1/1 got=1/2/2 REGRESSION
minerdisturbance             expected<=3/3/3 got=5/10/6 REGRESSION
monkeypuzzle2                expected<=4/4/4 got=7/9/5 REGRESSION
orbdefence                   expected<=2/2/2 got=4/4/4 REGRESSION
pixelate                     expected<=7/4/4 got=11/12/6 REGRESSION
pool                         expected<=2/2/2 got=7/5/5 REGRESSION
shatteredplans               expected<=21/13/12 got=28/31/16 REGRESSION
solknight                    expected<=0/1/1 got=2/4/4 REGRESSION
starcannon                   expected<=0/1/1 got=6/9/4 REGRESSION
steelsentinels               expected<=98/16/5 got=7/4/3 improved
stellarshard                 expected<=0/1/1 got=3/5/3 REGRESSION
sumoblitz                    expected<=0/1/1 got=4/4/4 REGRESSION
terraphoenix                 expected<=5/4/4 got=13/17/9 REGRESSION
tetralink                    expected<=3/3/3 got=1/2/2 improved
tombracer                    expected<=6/7/7 got=7/12/9 REGRESSION
torchallenge                 expected<=8/3/3 got=16/13/8 REGRESSION
torquing                     expected<=0/1/1 got=4/7/5 REGRESSION
trackcontroller              expected<=0/1/1 got=3/4/4 REGRESSION
transmogrify                 expected<=4/2/2 got=6/11/5 REGRESSION
vertigo2                     expected<=0/1/1 got=5/7/5 REGRESSION
virogrid                     expected<=11/5/5 got=9/8/6 REGRESSION
voidhunters                  expected<=63/20/18 got=58/93/16 REGRESSION
wizardrun                    expected<=22/3/3 got=4/6/5 REGRESSION
zombiedawn                   expected<=2/3/3 got=8/6/6 REGRESSION
zombiedawnmulti              expected<=0/1/1 got=5/6/4 REGRESSION
36cardtrick                  expected 0 GOTO markers, got 1 REGRESSION
bachelorfridge               expected 0 GOTO markers, got 18 REGRESSION
bouncedown                   expected 0 GOTO markers, got 2 REGRESSION
crazycrystals                expected 0 GOTO markers, got 1 REGRESSION
lexicominos                  expected 0 GOTO markers, got 1 REGRESSION
solknight                    expected 0 GOTO markers, got 2 REGRESSION
starcannon                   expected 0 GOTO markers, got 6 REGRESSION
stellarshard                 expected 0 GOTO markers, got 3 REGRESSION
sumoblitz                    expected 0 GOTO markers, got 4 REGRESSION
torquing                     expected 0 GOTO markers, got 4 REGRESSION
trackcontroller              expected 0 GOTO markers, got 3 REGRESSION
vertigo2                     expected 0 GOTO markers, got 5 REGRESSION
zombiedawnmulti              expected 0 GOTO markers, got 5 REGRESSION
```

## Notes

- The runbook intentionally avoids creating root-level `.work/*` scratch folders.
  Keep per-game artifacts under `.work/games/<game>/...` only.
- `cfr-markers.txt` is the authoritative input for both baseline files and any
  future regression diffs.
