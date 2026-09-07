# Phase 3 preparation: verifying what the plan names

Written before starting Phase 3. Every artifact section 3.2-3.4 names is checked
here, because two plan-named harnesses had already turned out absent.

## Verified present

- `site.fastPositional` — real and current (`java-tools src/jit/JitCompiler.js`
  2507, 2508, 3216, 3368, 4533). Section 3.2's recorded obstacle still stands:
  a warmed JS positional caller cannot reach a newly installed Wasm body until
  publication updates or invalidates that cached entry path.
- All eight named classes exist in `dekobloko.jar` (343 classes total). These are
  Deko Bloko's own names, not carried over from another game — obfuscated
  two-letter names collide across games, which is easy to misread.

## Absent

- `wasm_flags.py`, the refusal census section 3.4 asks for. This is the THIRD
  plan-named harness missing from this machine, after `logo_session9.py` and
  `heap_check.py`. As with the fps harness, a documented equivalent has to be
  built rather than assumed available.
- Note: `dekobloko.zip` in the repository root is NOT a gamepack. It is an
  unrelated "blank-github-cloner" project archive with zero `.class` entries.
  The game is `dekobloko.jar`.

## The named work items are ambiguous as written

Sections 3.2 and 3.4 name targets as `class.method` with no descriptor. Most are
not unique, so they do not identify a method:

| Named target | Overloads | Unique? |
| --- | ---: | --- |
| `ck.a` | 13 | **no** |
| `hk.c` | 4 | **no** |
| `ok.b` | 3 | **no** |
| `lm.a` | 5 | **no** |
| `fh.a` | 4 | **no** |
| `hn.f` | 1 | yes |
| `ke.k` | 2 | **no** |
| `ib.l` | 1 | yes |

Only `hn.f` and `ib.l` name a single method. `ck.a` names thirteen. Any Phase 3
work item, refusal census, or "this method now runs in Wasm" claim about these
targets is meaningless until resolved to a descriptor, and a census that reports
per-name rather than per-descriptor will silently merge unrelated methods.
