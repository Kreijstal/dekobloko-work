# Oracle 20 Sample

This directory preserves the 20-class CFR GOTO oracle sample from the refreshed
all-game scan tagged `oracle-20-seed`.

These are discovery fixtures, not production deob inputs. The production
pipeline must not copy selected bytecode from this directory or call the CFR
oracle. Any useful result here has to be translated into a bytecode-shape
predicate and a deterministic pass in `scripts/pipeline/`, then validated
against these fixtures.

`results.tsv` and `results.json` record all 20 oracle outcomes. The
`accepted/` subdirectories keep the original Krakatau input and selected
Krakatau output for the five clean accepted candidates:

- `02-aceofskies-fg`: `15 -> 7`, profile `no-terminal-extract`
- `06-arcanistsmulti-tj`: `3 -> 0`, profile `default`
- `12-armiesofgielinor-cw`: `8 -> 5`, profile `default`
- `18-brickabrac-jq`: `2 -> 0`, profile `default`
- `20-brickabrac-nh`: `17 -> 7`, profile `no-terminal-tail-clone`

To rerun one accepted specimen:

```sh
node scripts/cfr-oracle-select-transform.js \
  tools/cfr-goto-labs/oracle-20-sample/accepted/02-aceofskies-fg/input.j \
  .work/oracle-rerun/fg.class \
  --disasm .work/oracle-rerun/fg-selected.j
```

The broader `.work/oracle-20-goto*` directories are only cache artifacts. This
directory is the durable repro record.
