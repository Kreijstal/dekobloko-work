#!/usr/bin/env bash
set -uo pipefail

ORIGINAL_ARGS=("$@")

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO="$(dirname "$SCRIPT_DIR")"
ROOT="$REPO/.work/games"
JAVA_TOOLS_DIR="${JAVA_TOOLS_DIR:-${JT_DIR:-/home/kreijstal/git/java-tools}}"
PIPELINE_TIMEOUT_SECONDS="${PIPELINE_TIMEOUT_SECONDS:-1800}"
DECOMPILER_TIMEOUT_SECONDS="${DECOMPILER_TIMEOUT_SECONDS:-600}"
JAVAC_TIMEOUT_SECONDS="${JAVAC_TIMEOUT_SECONDS:-600}"
GAME=""
RESUME=0
UPDATE_BASELINE=0
REUSE_PIPELINE=0

while (($#)); do
  case "$1" in
    --game) GAME="$2"; shift 2 ;;
    --resume) RESUME=1; shift ;;
    --reuse-pipeline) REUSE_PIPELINE=1; shift ;;
    --update-baseline) UPDATE_BASELINE=1; shift ;;
    --help|-h)
      echo "Usage: $0 [games-root] [--game NAME] [--resume] [--reuse-pipeline] [--update-baseline]"
      exit 0
      ;;
    --*) echo "Unknown option: $1" >&2; exit 2 ;;
    *) ROOT="$1"; shift ;;
  esac
done

DECOMPILER="$JAVA_TOOLS_DIR/scripts/runCfr.js"
EXPECTED="$SCRIPT_DIR/EXPECTED-OWN-DECOMPILER-ALL-GAMES.tsv"
SUMMARY="${OWNED_DECOMPILER_SUMMARY:-$ROOT/owned-decompiler-all-games.tsv}"
STUBS="$REPO/lib/dekobloko-stubs.jar"
ASM_LIB="$JAVA_TOOLS_DIR/lib"
VERIFY_TOOLS="$ROOT/.owned-decompiler-tools"
ASM_CACHE="$VERIFY_TOOLS/asm"
PROVENANCE="$ROOT/decompilation-provenance.json"

[[ -f "$DECOMPILER" ]] || { echo "FATAL: missing owned decompiler: $DECOMPILER" >&2; exit 2; }
[[ -f "$STUBS" ]] || "$SCRIPT_DIR/build-stubs.sh" >/dev/null
[[ -f "$STUBS" ]] || { echo "FATAL: missing stubs jar: $STUBS" >&2; exit 2; }
dekobloko_sha="$(git -C "$REPO" rev-parse HEAD 2>/dev/null)" \
  || { echo "FATAL: $REPO is not a Git worktree" >&2; exit 2; }
java_tools_sha="$(git -C "$JAVA_TOOLS_DIR" rev-parse HEAD 2>/dev/null)" \
  || { echo "FATAL: $JAVA_TOOLS_DIR is not a Git worktree" >&2; exit 2; }
dekobloko_clean=true
java_tools_clean=true
git -C "$REPO" diff --quiet HEAD -- || dekobloko_clean=false
git -C "$JAVA_TOOLS_DIR" diff --quiet HEAD -- || java_tools_clean=false

mkdir -p "$ROOT" "$VERIFY_TOOLS" "$ASM_CACHE"
provenance_candidate="$PROVENANCE.candidate"
node - "$provenance_candidate" "$dekobloko_sha" "$dekobloko_clean" \
  "$java_tools_sha" "$java_tools_clean" "$GAME" "$REUSE_PIPELINE" \
  "$UPDATE_BASELINE" "${ORIGINAL_ARGS[@]}" <<'NODE'
const fs = require('fs');
const [file, dekoblokoCommit, dekoblokoClean, javaToolsCommit, javaToolsClean,
  game, reusePipeline, updateBaseline, ...args] = process.argv.slice(2);
const selectedEnvironment = {};
for (const key of Object.keys(process.env).sort()) {
  if (key.startsWith('PIPELINE_') || key.startsWith('BULK_PIPELINE_') ||
      key === 'SKIP_PIPELINE_PASSES') {
    selectedEnvironment[key] = process.env[key];
  }
}
const manifest = {
  formatVersion: 1,
  capturedAt: new Date().toISOString(),
  generators: {
    dekoblokoWork: { commit: dekoblokoCommit, trackedClean: dekoblokoClean === 'true' },
    javaTools: { commit: javaToolsCommit, trackedClean: javaToolsClean === 'true' },
  },
  invocation: {
    script: 'scripts/decompile-all-games.sh',
    arguments: args,
    selectedGame: game || null,
    reusePipeline: reusePipeline === '1',
    updateBaseline: updateBaseline === '1',
    fixedPipelineArguments: ['--profile', 'none', '--safe-bytecode'],
    environment: selectedEnvironment,
  },
};
fs.writeFileSync(file, JSON.stringify(manifest, null, 2) + '\n');
NODE
if ((RESUME)) && [[ -f "$PROVENANCE" ]]; then
  if ! node - "$PROVENANCE" "$provenance_candidate" <<'NODE'
const fs = require('fs');
const [previousFile, candidateFile] = process.argv.slice(2);
const previous = JSON.parse(fs.readFileSync(previousFile, 'utf8'));
const candidate = JSON.parse(fs.readFileSync(candidateFile, 'utf8'));
const stable = (value) => JSON.stringify(value);
const compatible = stable(previous.generators) === stable(candidate.generators) &&
  stable(previous.invocation.environment) === stable(candidate.invocation.environment) &&
  stable(previous.invocation.fixedPipelineArguments) === stable(candidate.invocation.fixedPipelineArguments);
if (!compatible) {
  console.error('FATAL: --resume generator SHAs, cleanliness, or pipeline gates differ from the existing batch');
  process.exit(1);
}
NODE
  then
    rm -f "$provenance_candidate"
    exit 2
  fi
  rm -f "$provenance_candidate"
else
  mv "$provenance_candidate" "$PROVENANCE"
fi
for artifact in asm asm-tree asm-analysis; do
  source_jar="$ASM_LIB/$artifact-9.9.1.jar"
  cache_jar="$ASM_CACHE/$artifact-9.9.1.jar"
  var="ASM_${artifact//-/_}"
  if [[ -f "$source_jar" ]]; then
    printf -v "$var" '%s' "$source_jar"
  else
    if [[ ! -f "$cache_jar" ]]; then
      curl -fsSL "https://repo1.maven.org/maven2/org/ow2/asm/$artifact/9.9.1/$artifact-9.9.1.jar" -o "$cache_jar"
    fi
    printf -v "$var" '%s' "$cache_jar"
  fi
done
ASM_CP="$ASM_asm:$ASM_asm_tree:$ASM_asm_analysis"
javac -cp "$ASM_CP" -d "$VERIFY_TOOLS" "$SCRIPT_DIR/Verify.java"

if [[ -n "$GAME" ]]; then
  GAME_DIRS=("$ROOT/$GAME")
else
  shopt -s nullglob
  GAME_DIRS=("$ROOT"/*)
  shopt -u nullglob
fi

mkdir -p "$(dirname "$SUMMARY")"
: > "$SUMMARY.tmp"
printf '# game\tclasses\tsources\thard\tcli\tverify\tjavac\tstatus\n' >> "$SUMMARY.tmp"
overall=0

for game_dir in "${GAME_DIRS[@]}"; do
  [[ -d "$game_dir/classes" ]] || continue
  game="$(basename "$game_dir")"
  work="$game_dir/decompile-owned"
  report="$work/logs/report.json"
  if ((RESUME)) && [[ -f "$report" ]] && rg -q '"status": "pass"' "$report"; then
    prior_row="$(awk -F'\t' -v game="$game" '$1 == game { print; exit }' "$SUMMARY" 2>/dev/null || true)"
    if [[ -n "$prior_row" ]]; then
      printf '%s\n' "$prior_row" >> "$SUMMARY.tmp"
    else
      node - "$report" >> "$SUMMARY.tmp" <<'NODE'
const fs = require('fs');
const report = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const values = [
  report.game,
  report.classes,
  report.sources,
  report.hardFailures,
  report.failures && report.failures.cli,
  report.failures && report.failures.verify,
  report.failures && report.failures.javac,
  report.status,
];
process.stdout.write(`${values.map((value) => value ?? 0).join('\t')}\n`);
NODE
    fi
    printf '%s\tresume-pass\n' "$game" >&2
    continue
  fi

  if ((REUSE_PIPELINE)); then
    [[ -d "$work/out" ]] || { echo "FATAL: no reusable pipeline output for $game" >&2; exit 2; }
    rm -rf "$work/java" "$work/classes"
    mkdir -p "$work/java" "$work/classes" "$work/logs"
  else
    rm -rf "$work"
    mkdir -p "$work/out" "$work/java" "$work/classes" "$work/logs"
  fi
  pipeline_fail=0 cli_fail=0 verify_fail=0 javac_fail=0
  pipeline_skip_passes="${SKIP_PIPELINE_PASSES:+$SKIP_PIPELINE_PASSES,}intize-boolean-parameters,compile-conflict-renames"

  if ((!REUSE_PIPELINE)); then
    PIPELINE_SIGNATURE_MAP_OUT="$work/logs/signature-map.json" \
    SKIP_PIPELINE_PASSES="$pipeline_skip_passes" timeout "$PIPELINE_TIMEOUT_SECONDS" node "$REPO/scripts/pipeline/bulk-pipeline.js" \
      "$game_dir/classes" "$work/out" --profile none --safe-bytecode \
      >"$work/logs/pipeline.log" 2>&1 || pipeline_fail=1
  fi

  input_count=$(find "$game_dir/classes" -type f -name '*.class' | wc -l)
  mapfile -d '' class_files < <(find "$work/out" -type f -name '*.class' -print0)
  if ((pipeline_fail == 0)) && ((${#class_files[@]})); then
    if ! java -cp "$VERIFY_TOOLS:$ASM_CP" Verify "${class_files[@]}" \
      >"$work/logs/transform-verify.log" 2>&1; then
      # Guard retry: re-run the pipeline for just the classes a pass broke,
      # with per-pass ASM verification enabled for them so only the breaking
      # pass is reverted. The guard set is derived from the verification
      # failures — no game-specific class names.
      retry_in="$work/guard-retry-in" retry_out="$work/guard-retry-out" guard_names=""
      retry_class_list="$work/logs/guard-retry-classes.txt"
      rm -rf "$retry_in" "$retry_out"
      : > "$retry_class_list"
      while IFS= read -r invalid_class; do
        relative_class="${invalid_class#"$work/out/"}"
        original_class="$game_dir/classes/$relative_class"
        if [[ -f "$original_class" ]]; then
          printf '%s\n' "$relative_class" >> "$retry_class_list"
          mkdir -p "$retry_in/$(dirname "$relative_class")" "$retry_out"
          cp "$original_class" "$retry_in/$relative_class"
          guard_names+="${guard_names:+,}$(basename "$relative_class" .class)"
        fi
      done < <(awk '/^FAIL_CLASS: / { print $2 }' "$work/logs/transform-verify.log")
      if [[ -n "$guard_names" ]]; then
        final_out="$(cd "$work/out" && pwd)"
        printf '[bytecode-guard] per-pass retry for: %s\n' "$guard_names" >>"$work/logs/pipeline.log"
        if [[ "${PIPELINE_EXPERIMENTAL_SIGNATURE_COMPACTION:-0}" == 1 ]]; then
          # Descriptor rewrites are atomic across the gamepack. If any class
          # fails final verification, discard the complete compacted output and
          # rerun every class with signature compaction disabled; a per-class
          # retry would mix old and new descriptors.
          printf '[bytecode-guard] signature compaction rejected; retrying the complete gamepack without it\n' \
            >>"$work/logs/pipeline.log"
          rm -rf "$retry_out"
          PIPELINE_EXPERIMENTAL_SIGNATURE_COMPACTION=0 \
          SKIP_PIPELINE_PASSES="$pipeline_skip_passes" timeout "$PIPELINE_TIMEOUT_SECONDS" node "$REPO/scripts/pipeline/bulk-pipeline.js" \
            "$game_dir/classes" "$retry_out" --profile none --safe-bytecode \
            >>"$work/logs/pipeline.log" 2>&1 \
            && rm -rf "$final_out" \
            && mv "$retry_out" "$final_out" \
            && rm -f "$work/logs/signature-map.json" \
            || pipeline_fail=1
        else
          PIPELINE_EXPERIMENTAL_INTERCLASS_DCE=0 \
          PIPELINE_EXPERIMENTAL_SIGNATURE_COMPACTION=0 \
          BULK_PIPELINE_ASM_GUARD_CP="$VERIFY_TOOLS:$ASM_CP" \
          BULK_PIPELINE_ASM_GUARD_CLASSES="$guard_names" \
          SKIP_PIPELINE_PASSES="$pipeline_skip_passes" timeout "$PIPELINE_TIMEOUT_SECONDS" node "$REPO/scripts/pipeline/bulk-pipeline.js" \
            "$retry_in" "$retry_out" --profile none --safe-bytecode \
            >>"$work/logs/pipeline.log" 2>&1 \
            && (cd "$retry_out" && find . -type f -name '*.class' -exec cp --parents {} "$final_out/" \;)
        fi
      fi
      if [[ "${PIPELINE_EXPERIMENTAL_SIGNATURE_COMPACTION:-0}" != 1 ]]; then
        # Anything still failing falls back to its untransformed original.
        if ! java -cp "$VERIFY_TOOLS:$ASM_CP" Verify "${class_files[@]}" \
          >"$work/logs/guard-verify.log" 2>&1; then
          while IFS= read -r invalid_class; do
            relative_class="${invalid_class#"$work/out/"}"
            original_class="$game_dir/classes/$relative_class"
            if [[ -f "$original_class" ]]; then
              cp "$original_class" "$invalid_class"
              printf '[bytecode-guard] restored original %s after final ASM verification failure\n' \
                "$relative_class" >>"$work/logs/pipeline.log"
            fi
          done < <(awk '/^FAIL_CLASS: / { print $2 }' "$work/logs/guard-verify.log")
        fi
      fi
      mapfile -d '' class_files < <(find "$work/out" -type f -name '*.class' -print0)
    fi
    java -cp "$VERIFY_TOOLS:$ASM_CP" Verify "${class_files[@]}" \
      >"$work/logs/verify.log" 2>&1 || verify_fail=1
    rg -q 'ClassesWithFails: 0' "$work/logs/verify.log" || verify_fail=1
  else
    verify_fail=1
  fi

  if ((pipeline_fail == 0 && verify_fail == 0)); then
    timeout "$DECOMPILER_TIMEOUT_SECONDS" node "$DECOMPILER" \
      --silent --fail-on-fallback \
      --classpath "$work/out:$STUBS" \
      --diagnostics-json "$work/logs/diagnostics.json" \
      --outputdir "$work/java" "$work/out" \
      >"$work/logs/decompiler.log" 2>&1 || cli_fail=1
  else
    cli_fail=1
  fi

  source_count=$(find "$work/java" -type f -name '*.java' | wc -l)
  hard=0
  if [[ -f "$work/logs/diagnostics.json" ]]; then
    hard=$(node -e 'const fs=require("fs"); const r=JSON.parse(fs.readFileSync(process.argv[1], "utf8")); console.log(r.hardFailures || 0)' "$work/logs/diagnostics.json" 2>/dev/null || echo 0)
  fi

  if ((source_count > 0)); then
    find "$work/java" -type f -name '*.java' -print > "$work/logs/javac.args"
    timeout "$JAVAC_TIMEOUT_SECONDS" javac -source 7 -target 7 -proc:none \
      -cp "$work/out:$STUBS" -sourcepath '' -d "$work/classes" \
      @"$work/logs/javac.args" >"$work/logs/javac.log" 2>&1 || javac_fail=1
  else
    javac_fail=1
  fi

  status=pass
  if ((pipeline_fail || cli_fail || verify_fail || javac_fail || hard > 0 || input_count != source_count)); then
    status=fail
    overall=1
  fi

  node - "$report" "$game" "$input_count" "$source_count" "$hard" "$pipeline_fail" "$cli_fail" "$verify_fail" "$javac_fail" "$status" <<'NODE'
const fs = require('fs');
const [file, game, classes, sources, hard, pipeline, cli, verify, javac, status] = process.argv.slice(2);
fs.writeFileSync(file, JSON.stringify({
  game, status, classes: Number(classes), sources: Number(sources), hardFailures: Number(hard),
  failures: { pipeline: Number(pipeline), cli: Number(cli), verify: Number(verify), javac: Number(javac) },
}, null, 2) + '\n');
NODE
  printf '%s\t%d\t%d\t%d\t%d\t%d\t%d\t%s\n' \
    "$game" "$input_count" "$source_count" "$hard" "$cli_fail" "$verify_fail" "$javac_fail" "$status" \
    | tee -a "$SUMMARY.tmp"
done

mv "$SUMMARY.tmp" "$SUMMARY"
if ((UPDATE_BASELINE)); then
  cp "$SUMMARY" "$EXPECTED"
fi
exit "$overall"
