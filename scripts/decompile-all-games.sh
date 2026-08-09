#!/usr/bin/env bash
set -uo pipefail

ORIGINAL_ARGS=("$@")

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO="$(dirname "$SCRIPT_DIR")"
ROOT="$REPO/.work/games"
JAVA_TOOLS_DIR="${JAVA_TOOLS_DIR:-${JT_DIR:-/home/kreijstal/git/java-tools}}"
PIPELINE_TIMEOUT_SECONDS="${PIPELINE_TIMEOUT_SECONDS:-1800}"
# Floor for the decompiler cap; the effective cap scales with class count.
DECOMPILER_TIMEOUT_SECONDS="${DECOMPILER_TIMEOUT_SECONDS:-600}"
DECOMPILER_SECONDS_PER_CLASS="${DECOMPILER_SECONDS_PER_CLASS:-6}"
JAVAC_TIMEOUT_SECONDS="${JAVAC_TIMEOUT_SECONDS:-600}"
GAME=""
JOBS=1
RESUME=0
UPDATE_BASELINE=0
REUSE_PIPELINE=0

# AlterOrb gamepacks are processed as complete closed-world class corpora. This
# permits the generic fixed-point proof for default-false static sentinels:
# every write is visible, and a mutually guarded cycle cannot leave false.
# Keep the gate independently overrideable for partial-corpus diagnostics.
export PIPELINE_ALLOW_MUTUALLY_GUARDED_FALSE_CYCLES="${PIPELINE_ALLOW_MUTUALLY_GUARDED_FALSE_CYCLES:-1}"

while (($#)); do
  case "$1" in
    --game) GAME="$2"; shift 2 ;;
    --jobs) JOBS="$2"; shift 2 ;;
    --resume) RESUME=1; shift ;;
    --reuse-pipeline) REUSE_PIPELINE=1; shift ;;
    --update-baseline) UPDATE_BASELINE=1; shift ;;
    --help|-h)
      echo "Usage: $0 [games-root] [--game NAME] [--jobs N] [--resume] [--reuse-pipeline] [--update-baseline]"
      exit 0
      ;;
    --*) echo "Unknown option: $1" >&2; exit 2 ;;
    *) ROOT="$1"; shift ;;
  esac
done

[[ "$JOBS" =~ ^[1-9][0-9]*$ ]] || {
  echo "FATAL: --jobs must be a positive integer" >&2
  exit 2
}
if [[ -n "$GAME" && "$JOBS" != 1 ]]; then
  echo "FATAL: --jobs cannot be combined with --game" >&2
  exit 2
fi

DECOMPILER="$JAVA_TOOLS_DIR/scripts/runCfr.js"
CACHE_PROVENANCE="$SCRIPT_DIR/pipeline-cache-provenance.js"
EXPECTED="$SCRIPT_DIR/EXPECTED-OWN-DECOMPILER-ALL-GAMES.tsv"
SUMMARY="${OWNED_DECOMPILER_SUMMARY:-$ROOT/owned-decompiler-all-games.tsv}"
STUBS="$REPO/lib/dekobloko-stubs.jar"
ASM_LIB="$JAVA_TOOLS_DIR/lib"
VERIFY_TOOLS="$ROOT/.owned-decompiler-tools"
ASM_CACHE="$VERIFY_TOOLS/asm"
PROVENANCE="${OWNED_DECOMPILER_PROVENANCE:-$ROOT/decompilation-provenance.json}"

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
if [[ "${OWNED_DECOMPILER_SKIP_TOOL_BUILD:-0}" != 1 ]]; then
  javac -cp "$ASM_CP" -d "$VERIFY_TOOLS" "$SCRIPT_DIR/Verify.java"
fi

if [[ -n "$GAME" ]]; then
  GAME_DIRS=("$ROOT/$GAME")
else
  shopt -s nullglob
  GAME_DIRS=("$ROOT"/*)
  shopt -u nullglob
fi

if ((JOBS > 1)); then
  parallel_dir="$(mktemp -d "$ROOT/.owned-decompiler-parallel.XXXXXX")"
  worker_pids=()
  cleanup_parallel() {
    local worker_pid
    for worker_pid in "${worker_pids[@]}"; do
      # Each worker owns a session so an interrupted parent can terminate the
      # transformer/decompiler timeout process groups it created as well.
      pkill -TERM -s "$worker_pid" 2>/dev/null || true
    done
    rm -rf -- "$parallel_dir"
  }
  terminate_parallel() {
    exit 130
  }
  trap cleanup_parallel EXIT
  trap terminate_parallel INT TERM

  worker_flags=()
  ((RESUME)) && worker_flags+=(--resume)
  ((REUSE_PIPELINE)) && worker_flags+=(--reuse-pipeline)
  worker_status=0
  active_workers=0
  wait_for_worker() {
    local completed_pid="" worker_pid
    local remaining_pids=()
    if ! wait -n -p completed_pid; then
      worker_status=1
    fi
    for worker_pid in "${worker_pids[@]}"; do
      [[ "$worker_pid" == "$completed_pid" ]] || remaining_pids+=("$worker_pid")
    done
    worker_pids=("${remaining_pids[@]}")
    active_workers=$((active_workers - 1))
  }
  for game_dir in "${GAME_DIRS[@]}"; do
    [[ -d "$game_dir/classes" ]] || continue
    game="$(basename "$game_dir")"
    setsid env \
      OWNED_DECOMPILER_SUMMARY="$parallel_dir/$game.tsv" \
      OWNED_DECOMPILER_PROVENANCE="$parallel_dir/$game-provenance.json" \
      OWNED_DECOMPILER_SKIP_TOOL_BUILD=1 \
        "$SCRIPT_DIR/decompile-all-games.sh" "$ROOT" --game "$game" "${worker_flags[@]}" &
    worker_pids+=("$!")
    active_workers=$((active_workers + 1))
    if ((active_workers >= JOBS)); then
      wait_for_worker
    fi
  done
  while ((active_workers > 0)); do
    wait_for_worker
  done

  : > "$SUMMARY.tmp"
  printf '# game\tclasses\tsources\thard\tcli\tverify\tjavac\tstatus\n' >> "$SUMMARY.tmp"
  for game_dir in "${GAME_DIRS[@]}"; do
    [[ -d "$game_dir/classes" ]] || continue
    game="$(basename "$game_dir")"
    report="$game_dir/decompile-owned/logs/report.json"
    if [[ ! -f "$report" ]]; then
      printf '%s\t0\t0\t0\t1\t1\t1\tfail\n' "$game" >> "$SUMMARY.tmp"
      worker_status=1
      continue
    fi
    node - "$report" >> "$SUMMARY.tmp" <<'NODE'
const fs = require('fs');
const report = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const failures = report.failures || {};
const values = [
  report.game,
  report.classes,
  report.sources,
  report.hardFailures,
  failures.cli,
  failures.verify,
  failures.javac,
  report.status,
];
process.stdout.write(`${values.map((value) => value ?? 0).join('\t')}\n`);
NODE
    [[ "$(node -e 'const fs=require("fs"); console.log(JSON.parse(fs.readFileSync(process.argv[1], "utf8")).status)' "$report")" == pass ]] \
      || worker_status=1
  done
  mv "$SUMMARY.tmp" "$SUMMARY"
  if ((UPDATE_BASELINE)); then
    cp "$SUMMARY" "$EXPECTED"
  fi
  exit "$worker_status"
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
  pipeline_skip_passes="${SKIP_PIPELINE_PASSES:+$SKIP_PIPELINE_PASSES,}intize-boolean-parameters,compile-conflict-renames"
  pipeline_stamp="$work/pipeline-provenance.json"
  pipeline_cache_args=(
    --repo "$REPO"
    --java-tools "$JAVA_TOOLS_DIR"
    --input "$game_dir/classes"
    --skip-passes "$pipeline_skip_passes"
  )
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

  game_reuse_pipeline=$REUSE_PIPELINE
  cache_rebuilt=0
  if ((game_reuse_pipeline)) && {
    [[ ! -d "$work/out" ]] ||
    ! node "$CACHE_PROVENANCE" check "$pipeline_stamp" "${pipeline_cache_args[@]}"
  }; then
    game_reuse_pipeline=0
    cache_rebuilt=1
    printf '%s\tstale or unproven pipeline cache; rebuilding\n' "$game" >&2
  fi

  if ((game_reuse_pipeline)); then
    rm -rf "$work/java" "$work/classes"
    mkdir -p "$work/java" "$work/classes" "$work/logs"
  else
    rm -rf "$work"
    mkdir -p "$work/out" "$work/java" "$work/classes" "$work/logs"
    if ((cache_rebuilt)); then
      printf '[pipeline-cache] stale or unproven output rejected; rebuilt from input classes\n' \
        >"$work/logs/pipeline.log"
    fi
  fi
  pipeline_fail=0 cli_fail=0 verify_fail=0 javac_fail=0
  run_original_bytecode_fallback=0
  if [[ "${PIPELINE_EXPERIMENTAL_SIGNATURE_COMPACTION:-0}" != 1 ]]; then
    run_original_bytecode_fallback=1
  fi
  compaction_stage="$work/compaction-stage"

  if ((!game_reuse_pipeline)); then
    PIPELINE_SIGNATURE_MAP_OUT="$work/logs/signature-map.json" \
    PIPELINE_SIGNATURE_COMPACTION_STAGE_OUT="$compaction_stage" \
    SKIP_PIPELINE_PASSES="$pipeline_skip_passes" timeout "$PIPELINE_TIMEOUT_SECONDS" node "$REPO/scripts/pipeline/bulk-pipeline.js" \
      "$game_dir/classes" "$work/out" --profile none --safe-bytecode \
      >>"$work/logs/pipeline.log" 2>&1 || pipeline_fail=1
  fi

  input_count=$(find "$game_dir/classes" -type f -name '*.class' | wc -l)
  mapfile -d '' class_files < <(find "$work/out" -type f -name '*.class' -print0)
  if ((game_reuse_pipeline)) && ((${#class_files[@]} != input_count)); then
    printf '[bytecode-guard] cached pipeline output incomplete: expected %d classes, found %d; rebuilding\n' \
      "$input_count" "${#class_files[@]}" >>"$work/logs/pipeline.log"
    rm -rf "$work/out"
    mkdir -p "$work/out"
    rm -f "$work/logs/signature-map.json"
    PIPELINE_SIGNATURE_MAP_OUT="$work/logs/signature-map.json" \
    PIPELINE_SIGNATURE_COMPACTION_STAGE_OUT="$compaction_stage" \
    SKIP_PIPELINE_PASSES="$pipeline_skip_passes" timeout "$PIPELINE_TIMEOUT_SECONDS" node "$REPO/scripts/pipeline/bulk-pipeline.js" \
      "$game_dir/classes" "$work/out" --profile none --safe-bytecode \
      >>"$work/logs/pipeline.log" 2>&1 || pipeline_fail=1
    mapfile -d '' class_files < <(find "$work/out" -type f -name '*.class' -print0)
  fi
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
          # Descriptor rewrites are atomic across the gamepack, so a failing
          # class cannot be rerun with compaction disabled and it cannot be
          # restored from its untransformed original: either would leave a
          # pre-compaction descriptor behind while every call site elsewhere
          # already uses the compacted one. The staging set is the correct
          # baseline instead — it carries the compacted descriptors and nothing
          # but the descriptor rewrite, so reverting a class to it undoes only
          # the later pass that broke it. Compaction is abandoned wholesale only
          # if that staged baseline is unavailable.
          compaction_stage_restored=0
          if [[ -d "$compaction_stage" ]]; then
            # First try the same guarded per-pass retry the other experimental
            # configurations use. Analysis still spans the whole gamepack, so
            # the compaction set is identical to the one already baked into the
            # output; only the broken classes are emitted and overlaid.
            rm -rf "$retry_out"
            if PIPELINE_EXPERIMENTAL_INTERCLASS_DCE="${PIPELINE_EXPERIMENTAL_INTERCLASS_DCE:-0}" \
              PIPELINE_EXPERIMENTAL_SIGNATURE_COMPACTION=1 \
              BULK_PIPELINE_ASM_GUARD_CP="$VERIFY_TOOLS:$ASM_CP" \
              BULK_PIPELINE_ASM_GUARD_CLASSES="$guard_names" \
              BULK_PIPELINE_CLASS_LIST="$retry_class_list" \
              BULK_PIPELINE_SKIP_UNSELECTED_COPY=1 \
              SKIP_PIPELINE_PASSES="$pipeline_skip_passes" timeout "$PIPELINE_TIMEOUT_SECONDS" node "$REPO/scripts/pipeline/bulk-pipeline.js" \
                "$game_dir/classes" "$retry_out" --profile none --safe-bytecode \
                >>"$work/logs/pipeline.log" 2>&1
            then
              (cd "$retry_out" && find . -type f -name '*.class' -exec cp --parents {} "$final_out/" \;)
              compaction_stage_restored=1
            fi
            # Anything the guarded retry could not repair reverts to its staged
            # class rather than its original, so the descriptor stays compacted.
            while IFS= read -r relative_class; do
              if [[ -f "$final_out/$relative_class" ]] \
                && java -cp "$VERIFY_TOOLS:$ASM_CP" Verify "$final_out/$relative_class" >/dev/null 2>&1; then
                continue
              fi
              if [[ -f "$compaction_stage/$relative_class" ]]; then
                cp "$compaction_stage/$relative_class" "$final_out/$relative_class"
                printf '[bytecode-guard] restored staged compacted %s after pipeline ASM verification failure\n' \
                  "$relative_class" >>"$work/logs/pipeline.log"
                compaction_stage_restored=1
              else
                compaction_stage_restored=0
                break
              fi
            done < "$retry_class_list"
          fi
          if ((compaction_stage_restored)); then
            rm -rf "$retry_out"
          else
            printf '[bytecode-guard] signature compaction rejected; retrying the complete gamepack without it\n' \
              >>"$work/logs/pipeline.log"
            rm -rf "$retry_out"
            run_original_bytecode_fallback=1
            PIPELINE_EXPERIMENTAL_SIGNATURE_COMPACTION=0 \
            SKIP_PIPELINE_PASSES="$pipeline_skip_passes" timeout "$PIPELINE_TIMEOUT_SECONDS" node "$REPO/scripts/pipeline/bulk-pipeline.js" \
              "$game_dir/classes" "$retry_out" --profile none --safe-bytecode \
              >>"$work/logs/pipeline.log" 2>&1 \
              && rm -rf "$final_out" \
              && mv "$retry_out" "$final_out" \
              && rm -f "$work/logs/signature-map.json" \
              || pipeline_fail=1
          fi
        elif [[ "${PIPELINE_EXPERIMENTAL_INTERCLASS_DCE:-0}" == 1 ]]; then
          # Interclass specialization needs to analyze the complete gamepack,
          # but only the invalid classes need to be emitted again. Keep analysis
          # global while selecting the verifier failures for guarded processing;
          # then overlay those repaired classes onto the otherwise-valid output.
          rm -rf "$retry_out"
          PIPELINE_EXPERIMENTAL_INTERCLASS_DCE=1 \
          PIPELINE_EXPERIMENTAL_SIGNATURE_COMPACTION=0 \
          BULK_PIPELINE_ASM_GUARD_CP="$VERIFY_TOOLS:$ASM_CP" \
          BULK_PIPELINE_ASM_GUARD_CLASSES="$guard_names" \
          BULK_PIPELINE_CLASS_LIST="$retry_class_list" \
          BULK_PIPELINE_SKIP_UNSELECTED_COPY=1 \
          SKIP_PIPELINE_PASSES="$pipeline_skip_passes" timeout "$PIPELINE_TIMEOUT_SECONDS" node "$REPO/scripts/pipeline/bulk-pipeline.js" \
            "$game_dir/classes" "$retry_out" --profile none --safe-bytecode \
            >>"$work/logs/pipeline.log" 2>&1 \
            && (cd "$retry_out" && find . -type f -name '*.class' -exec cp --parents {} "$final_out/" \;) \
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
      if ((run_original_bytecode_fallback)); then
        # Anything still failing falls back to its untransformed original.
        mapfile -d '' class_files < <(find "$work/out" -type f -name '*.class' -print0)
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
    node "$CACHE_PROVENANCE" write "$pipeline_stamp" \
      "${pipeline_cache_args[@]}" || pipeline_fail=1
  fi

  if ((pipeline_fail == 0 && verify_fail == 0)); then
    # A timeout here is never "the whole game was a bit slow": measured cost is
    # ~0.1-0.6s per class, and every game that has ever hit the cap did so by
    # wedging on ONE class (aceofskies eg.class, kickabout os.class) while the
    # other 500-odd finished in seconds.  So the cap only has to be generous
    # enough to be unambiguous, and the useful output is WHICH class it died on.
    cli_timeout=$((input_count * DECOMPILER_SECONDS_PER_CLASS))
    ((cli_timeout < DECOMPILER_TIMEOUT_SECONDS)) && cli_timeout="$DECOMPILER_TIMEOUT_SECONDS"
    # CFR_JS_PROFILE_CLASSES makes cfr.js log per-class start/done lines. Without
    # it a kill left a 0-byte log, no diagnostics.json, and only cli=1 in the
    # summary -- indistinguishable from the decompiler genuinely failing, which
    # is how six games were misfiled as decompiler limits.
    CFR_JS_PROFILE_CLASSES=1 timeout "$cli_timeout" node "$DECOMPILER" \
      --silent --fail-on-hard-failure \
      --classpath "$work/out:$STUBS" \
      --diagnostics-json "$work/logs/diagnostics.json" \
      --outputdir "$work/java" "$work/out" \
      >"$work/logs/decompiler.log" 2>&1
    cli_status=$?
    if ((cli_status != 0)); then
      cli_fail=1
      if ((cli_status == 124)); then
        # The last class to start without a matching done line is the culprit.
        stuck=$(awk '/cfr-class-start/ {s=$2} /cfr-class-done/ {d=$3} END {print (s==d ? "" : s)}' \
          "$work/logs/decompiler.log")
        echo "[harness] decompiler killed by timeout after ${cli_timeout}s" \
          "(${input_count} classes); wedged on class: ${stuck:-unknown}" \
          >>"$work/logs/decompiler.log"
      fi
    fi
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
