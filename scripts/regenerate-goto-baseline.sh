#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEKOB_DIR="$(dirname "$SCRIPT_DIR")"
GAMES_DIR="${1:-$DEKOB_DIR/.work/games}"
PIPELINE_TIMEOUT_SECONDS="${PIPELINE_TIMEOUT_SECONDS:-900}"
CFR_TIMEOUT_SECONDS="${CFR_TIMEOUT_SECONDS:-300}"
GOTO_SOURCE_SCOPE_REPAIR_PHASE="${GOTO_SOURCE_SCOPE_REPAIR_PHASE:-1}"
GOTO_SOURCE_SCOPE_REPAIR_ROUNDS="${GOTO_SOURCE_SCOPE_REPAIR_ROUNDS:-1}"
GOTO_ORIGINAL_CLASS_REPAIR_PHASE="${GOTO_ORIGINAL_CLASS_REPAIR_PHASE:-1}"
GOTO_PEEPHOLE_CLEAN_REPAIR_PHASE="${GOTO_PEEPHOLE_CLEAN_REPAIR_PHASE:-1}"
GOTO_PEEPHOLE_CLEAN_REPAIR_ROUNDS="${GOTO_PEEPHOLE_CLEAN_REPAIR_ROUNDS:-3}"
GOTO_SAME_INT_SELECTOR_REPAIR_PHASE="${GOTO_SAME_INT_SELECTOR_REPAIR_PHASE:-1}"
GOTO_LOOP_GUARD_ENTRY_SPLIT_REPAIR_PHASE="${GOTO_LOOP_GUARD_ENTRY_SPLIT_REPAIR_PHASE:-1}"
GOTO_MULTI_ENTRY_NORMALIZE_REPAIR_PHASE="${GOTO_MULTI_ENTRY_NORMALIZE_REPAIR_PHASE:-1}"
GOTO_ORACLE_SPLIT_REPAIR_PHASE="${GOTO_ORACLE_SPLIT_REPAIR_PHASE:-1}"
GOTO_ORACLE_SPLIT_MAX_ITERS="${GOTO_ORACLE_SPLIT_MAX_ITERS:-3}"
GOTO_SIMPLIFY_NOT_COMPARE_REPAIR_PHASE="${GOTO_SIMPLIFY_NOT_COMPARE_REPAIR_PHASE:-1}"
GOTO_TERMINAL_TAIL_REPAIR_PHASE="${GOTO_TERMINAL_TAIL_REPAIR_PHASE:-1}"
GOTO_TERMINAL_TAIL_REPAIR_ROUNDS="${GOTO_TERMINAL_TAIL_REPAIR_ROUNDS:-1}"
GOTO_ORACLE_REPAIR_PHASE="${GOTO_ORACLE_REPAIR_PHASE:-1}"
GOTO_ORACLE_REPAIR_ROUNDS="${GOTO_ORACLE_REPAIR_ROUNDS:-8}"
GOTO_GATES_OFF_REPAIR_PHASE="${GOTO_GATES_OFF_REPAIR_PHASE:-1}"
GOTO_GATES_OFF_REPAIR_ROUNDS="${GOTO_GATES_OFF_REPAIR_ROUNDS:-1}"
GOTO_GATES_OFF_TIMEOUT_SECONDS="${GOTO_GATES_OFF_TIMEOUT_SECONDS:-1800}"

if [[ ! -d "$GAMES_DIR/classes" && ! -d "$GAMES_DIR" ]]; then
  echo "FATAL: missing games directory: $GAMES_DIR" >&2
  exit 2
fi

if [[ -d "$GAMES_DIR/classes" ]]; then
  GAME_DIRS=("$GAMES_DIR")
else
  shopt -s nullglob
  GAME_DIRS=("$GAMES_DIR"/*)
  shopt -u nullglob
fi

for game_dir in "${GAME_DIRS[@]}"; do
  classes_dir="$game_dir/classes"
  [[ -d "$classes_dir" ]] || continue
  game="$(basename "$game_dir")"
  work="$game_dir/deob-safe"
  out="$work/out"
  cfr="$work/cfr"
  logs="$work/logs"

  echo "==> $game"
  work_backup=""
  if [[ -d "$work" ]]; then
    work_backup="$game_dir/.deob-safe-backup-$$"
    rm -rf "$work_backup"
    mv "$work" "$work_backup"
  fi
  rm -rf "$work"
  mkdir -p "$out" "$cfr" "$logs"

  if ! JAVA_TOOLS_DIR="${JAVA_TOOLS_DIR:-/home/kreijstal/git/java-tools}" \
    timeout "$PIPELINE_TIMEOUT_SECONDS" \
    node "$DEKOB_DIR/scripts/pipeline/bulk-pipeline.js" \
      "$classes_dir" "$out" --profile none --safe-bytecode \
      > "$logs/pipeline.log" 2>&1; then
    echo "FATAL: $game pipeline failed or timed out after ${PIPELINE_TIMEOUT_SECONDS}s" >&2
    rm -rf "$work"
    if [[ -n "$work_backup" && -d "$work_backup" ]]; then
      mv "$work_backup" "$work"
    fi
    exit 1
  fi

  mapfile -d '' class_files < <(find "$out" -type f -name '*.class' -print0)
  if (( ${#class_files[@]} == 0 )); then
    echo "FATAL: $game produced no .class files" >&2
    rm -rf "$work"
    if [[ -n "$work_backup" && -d "$work_backup" ]]; then
      mv "$work_backup" "$work"
    fi
    exit 1
  fi
  if [[ -n "$work_backup" ]]; then
    rm -rf "$work_backup"
  fi
  run_cfr_report() {
    rm -rf "$cfr"
    mkdir -p "$cfr"
    mapfile -d '' class_files < <(find "$out" -type f -name '*.class' -print0)
    if ! timeout "$CFR_TIMEOUT_SECONDS" \
      java -jar "$DEKOB_DIR/lib/cfr.jar" "${class_files[@]}" \
      --outputdir "$cfr" --silent true --caseinsensitivefs false \
      > "$logs/cfr.log" 2>&1; then
      rm -rf "$cfr"
      echo "FATAL: $game CFR failed or timed out after ${CFR_TIMEOUT_SECONDS}s" >&2
      return 1
    fi

    rg -n '\*\* GOTO|Unable to fully structure code|lbl-1000' "$cfr" \
      > "$logs/cfr-markers.txt" || true
    # A method CFR cannot decompile is emitted as an "Exception decompiling"
    # stub (0 GOTO markers), so the goto-only metric silently rewards leaving a
    # class undecompilable. Track these so the baseline measures real decompile
    # breakage, not just marker cosmetics.
    rg -n 'Exception decompiling' "$cfr" \
      > "$logs/cfr-exceptions.txt" || true
  }

  run_cfr_report

  accept_repair_candidates() {
    local repair_list="$1"
    local repair_out="$2"
    REPAIR_ACCEPTED=0
    while IFS= read -r rel; do
      [[ -n "$rel" && -f "$repair_out/$rel" ]] || continue
      if node -e '
        const fs = require("fs");
        const path = require("path");
        const os = require("os");
        const { spawnSync } = require("child_process");
        const script = process.argv[1];
        const baseline = process.argv[2];
        const candidate = process.argv[3];
        const cfrJar = process.argv[4];
        function count(file) {
          const res = spawnSync(process.execPath, [script, file], { encoding: "utf8" });
          if (res.status !== 0) return null;
          try { return JSON.parse(res.stdout); } catch { return null; }
        }
        function directGotos(file) {
          const work = fs.mkdtempSync(path.join(os.tmpdir(), "goto-repair-accept-"));
          try {
            const classFile = path.join(work, path.basename(file));
            fs.copyFileSync(file, classFile);
            const cfrDir = path.join(work, "cfr");
            fs.mkdirSync(cfrDir, { recursive: true });
            const res = spawnSync("java", ["-jar", cfrJar, classFile, "--outputdir", cfrDir, "--silent", "true", "--caseinsensitivefs", "false"], { encoding: "utf8", timeout: 180000, killSignal: "SIGKILL", maxBuffer: 64 * 1024 * 1024 });
            if (res.error || res.status !== 0) return null;
            let gotos = 0;
            for (const name of fs.readdirSync(cfrDir)) {
              if (!name.endsWith(".java")) continue;
              const text = fs.readFileSync(path.join(cfrDir, name), "utf8");
              gotos += (text.match(/[*][*] GOTO/g) || []).length;
            }
            return gotos;
          } finally {
            fs.rmSync(work, { recursive: true, force: true });
          }
        }
        const before = count(baseline);
        const after = count(candidate);
        const beforeGotos = directGotos(baseline);
        const afterGotos = directGotos(candidate);
        process.exit(before && after && !after.bad &&
          beforeGotos != null && afterGotos != null &&
          afterGotos <= beforeGotos &&
          after.markers < before.markers ? 0 : 1);
      ' "$DEKOB_DIR/scripts/cfr-marker-count.js" "$out/$rel" "$repair_out/$rel" "$DEKOB_DIR/lib/cfr.jar"; then
        mkdir -p "$(dirname "$out/$rel")"
        cp "$repair_out/$rel" "$out/$rel"
        REPAIR_ACCEPTED=$((REPAIR_ACCEPTED + 1))
      fi
    done < "$repair_list"
  }

  write_repair_list() {
    local repair_list="$1"
    awk -F: -v root="$cfr/" '
      {
        file = $1
        if (index(file, root) == 1) {
          rel = substr(file, length(root) + 1)
          sub(/[.]java$/, ".class", rel)
          seen[rel] = 1
        }
      }
      END {
        for (rel in seen) print rel
      }
    ' "$logs/cfr-markers.txt" | sort > "$repair_list"
  }

  marker_direct_gotos() {
    grep -c '\*\* GOTO' "$logs/cfr-markers.txt" || true
  }

  marker_total_lines() {
    grep -c '\*\* GOTO\|Unable to fully structure code\|lbl-1000' "$logs/cfr-markers.txt" || true
  }

  begin_repair_round_backup() {
    local backup="$1"
    rm -rf "$backup"
    cp -a "$out" "$backup"
  }

  restore_repair_round_backup() {
    local backup="$1"
    rm -rf "$out"
    mv "$backup" "$out"
    run_cfr_report
  }

  if [[ "$GOTO_ORIGINAL_CLASS_REPAIR_PHASE" == "1" ]]; then
    repair_list="$logs/goto-original-class-repair.classes"
    write_repair_list "$repair_list"
    if [[ -s "$repair_list" ]]; then
      before_repair_gotos="$(marker_direct_gotos)"
      before_repair_markers="$(marker_total_lines)"
      repair_backup="$work/original-class-repair-backup"
      begin_repair_round_backup "$repair_backup"
      repair_out="$work/original-class-repair"
      rm -rf "$repair_out"
      mkdir -p "$repair_out"
      while IFS= read -r rel; do
        [[ -n "$rel" && -f "$classes_dir/$rel" ]] || continue
        mkdir -p "$(dirname "$repair_out/$rel")"
        cp "$classes_dir/$rel" "$repair_out/$rel"
      done < "$repair_list"
      accept_repair_candidates "$repair_list" "$repair_out"
      rm -rf "$repair_out"
      if (( REPAIR_ACCEPTED > 0 )); then
        run_cfr_report
        after_repair_gotos="$(marker_direct_gotos)"
        after_repair_markers="$(marker_total_lines)"
        if (( after_repair_gotos > before_repair_gotos ||
          after_repair_markers >= before_repair_markers )); then
          restore_repair_round_backup "$repair_backup"
        else
          rm -rf "$repair_backup"
        fi
      else
        rm -rf "$repair_backup"
      fi
    fi
  fi

  if [[ "$GOTO_PEEPHOLE_CLEAN_REPAIR_PHASE" == "1" ]]; then
    for ((round = 1; round <= GOTO_PEEPHOLE_CLEAN_REPAIR_ROUNDS; round++)); do
      repair_list="$logs/goto-peephole-clean-repair-round-${round}.classes"
      write_repair_list "$repair_list"
      if [[ ! -s "$repair_list" ]]; then
        break
      fi
      before_repair_gotos="$(marker_direct_gotos)"
      before_repair_markers="$(marker_total_lines)"
      repair_backup="$work/peephole-clean-repair-round-${round}-backup"
      begin_repair_round_backup "$repair_backup"
      repair_out="$work/peephole-clean-repair-round-${round}"
      rm -rf "$repair_out"
      mkdir -p "$repair_out"
      : > "$logs/goto-peephole-clean-repair-round-${round}.log"
      while IFS= read -r rel; do
        [[ -n "$rel" && -f "$out/$rel" ]] || continue
        mkdir -p "$(dirname "$repair_out/$rel")"
        if ! JAVA_TOOLS_DIR="${JAVA_TOOLS_DIR:-/home/kreijstal/git/java-tools}" \
          node "${JAVA_TOOLS_DIR:-/home/kreijstal/git/java-tools}/scripts/jvm-cli.js" \
            peephole-clean "$out/$rel" --out "$repair_out/$rel" \
            >> "$logs/goto-peephole-clean-repair-round-${round}.log" 2>&1; then
          cp "$out/$rel" "$repair_out/$rel"
        fi
      done < "$repair_list"
      accept_repair_candidates "$repair_list" "$repair_out"
      rm -rf "$repair_out"
      if (( REPAIR_ACCEPTED > 0 )); then
        run_cfr_report
        after_repair_gotos="$(marker_direct_gotos)"
        after_repair_markers="$(marker_total_lines)"
        if (( after_repair_gotos > before_repair_gotos ||
          after_repair_markers >= before_repair_markers )); then
          restore_repair_round_backup "$repair_backup"
          break
        fi
        rm -rf "$repair_backup"
      else
        rm -rf "$repair_backup"
        break
      fi
    done
  fi

  if [[ "$GOTO_SAME_INT_SELECTOR_REPAIR_PHASE" == "1" ]]; then
    repair_list="$logs/goto-same-int-selector-repair.classes"
    write_repair_list "$repair_list"
    if [[ -s "$repair_list" ]]; then
      before_repair_gotos="$(marker_direct_gotos)"
      before_repair_markers="$(marker_total_lines)"
      repair_backup="$work/same-int-selector-repair-backup"
      begin_repair_round_backup "$repair_backup"
      repair_out="$work/same-int-selector-repair"
      rm -rf "$repair_out"
      mkdir -p "$repair_out"
      : > "$logs/goto-same-int-selector-repair.log"
      while IFS= read -r rel; do
        [[ -n "$rel" && -f "$out/$rel" ]] || continue
        mkdir -p "$(dirname "$repair_out/$rel")"
        if ! JAVA_TOOLS_DIR="${JAVA_TOOLS_DIR:-/home/kreijstal/git/java-tools}" \
          node "$DEKOB_DIR/scripts/repair-same-int-constant-selectors.js" \
            "$out/$rel" "$repair_out/$rel" \
            >> "$logs/goto-same-int-selector-repair.log" 2>&1; then
          cp "$out/$rel" "$repair_out/$rel"
        fi
      done < "$repair_list"
      accept_repair_candidates "$repair_list" "$repair_out"
      rm -rf "$repair_out"
      if (( REPAIR_ACCEPTED > 0 )); then
        run_cfr_report
        after_repair_gotos="$(marker_direct_gotos)"
        after_repair_markers="$(marker_total_lines)"
        if (( after_repair_gotos > before_repair_gotos ||
          after_repair_markers >= before_repair_markers )); then
          restore_repair_round_backup "$repair_backup"
        else
          rm -rf "$repair_backup"
        fi
      else
        rm -rf "$repair_backup"
      fi
    fi
  fi

  if [[ "$GOTO_LOOP_GUARD_ENTRY_SPLIT_REPAIR_PHASE" == "1" ]]; then
    repair_list="$logs/goto-loop-guard-entry-split-repair.classes"
    write_repair_list "$repair_list"
    if [[ -s "$repair_list" ]]; then
      before_repair_gotos="$(marker_direct_gotos)"
      before_repair_markers="$(marker_total_lines)"
      repair_backup="$work/loop-guard-entry-split-repair-backup"
      begin_repair_round_backup "$repair_backup"
      repair_out="$work/loop-guard-entry-split-repair"
      rm -rf "$repair_out"
      mkdir -p "$repair_out"
      : > "$logs/goto-loop-guard-entry-split-repair.log"
      while IFS= read -r rel; do
        [[ -n "$rel" && -f "$out/$rel" ]] || continue
        mkdir -p "$(dirname "$repair_out/$rel")"
        if ! JAVA_TOOLS_DIR="${JAVA_TOOLS_DIR:-/home/kreijstal/git/java-tools}" \
          node "${JAVA_TOOLS_DIR:-/home/kreijstal/git/java-tools}/scripts/jvm-cli.js" \
            loop-guard-entry-split "$out/$rel" --out "$repair_out/$rel" \
            >> "$logs/goto-loop-guard-entry-split-repair.log" 2>&1; then
          cp "$out/$rel" "$repair_out/$rel"
        fi
      done < "$repair_list"
      accept_repair_candidates "$repair_list" "$repair_out"
      rm -rf "$repair_out"
      if (( REPAIR_ACCEPTED > 0 )); then
        run_cfr_report
        after_repair_gotos="$(marker_direct_gotos)"
        after_repair_markers="$(marker_total_lines)"
        if (( after_repair_gotos > before_repair_gotos ||
          after_repair_markers >= before_repair_markers )); then
          restore_repair_round_backup "$repair_backup"
        else
          rm -rf "$repair_backup"
        fi
      else
        rm -rf "$repair_backup"
      fi
    fi
  fi

  if [[ "$GOTO_MULTI_ENTRY_NORMALIZE_REPAIR_PHASE" == "1" ]]; then
    repair_list="$logs/goto-multi-entry-normalize-repair.classes"
    write_repair_list "$repair_list"
    if [[ -s "$repair_list" ]]; then
      before_repair_gotos="$(marker_direct_gotos)"
      before_repair_markers="$(marker_total_lines)"
      repair_backup="$work/multi-entry-normalize-repair-backup"
      begin_repair_round_backup "$repair_backup"
      repair_out="$work/multi-entry-normalize-repair"
      rm -rf "$repair_out"
      mkdir -p "$repair_out"
      : > "$logs/goto-multi-entry-normalize-repair.log"
      while IFS= read -r rel; do
        [[ -n "$rel" && -f "$out/$rel" ]] || continue
        mkdir -p "$(dirname "$repair_out/$rel")"
        if ! JAVA_TOOLS_DIR="${JAVA_TOOLS_DIR:-/home/kreijstal/git/java-tools}" \
          node "${JAVA_TOOLS_DIR:-/home/kreijstal/git/java-tools}/scripts/jvm-cli.js" \
            multi-entry-normalize "$out/$rel" --out "$repair_out/$rel" \
            >> "$logs/goto-multi-entry-normalize-repair.log" 2>&1; then
          cp "$out/$rel" "$repair_out/$rel"
        fi
      done < "$repair_list"
      accept_repair_candidates "$repair_list" "$repair_out"
      rm -rf "$repair_out"
      if (( REPAIR_ACCEPTED > 0 )); then
        run_cfr_report
        after_repair_gotos="$(marker_direct_gotos)"
        after_repair_markers="$(marker_total_lines)"
        if (( after_repair_gotos > before_repair_gotos ||
          after_repair_markers >= before_repair_markers )); then
          restore_repair_round_backup "$repair_backup"
        else
          rm -rf "$repair_backup"
        fi
      else
        rm -rf "$repair_backup"
      fi
    fi
  fi

  if [[ "$GOTO_SIMPLIFY_NOT_COMPARE_REPAIR_PHASE" == "1" ]]; then
    repair_list="$logs/goto-simplify-not-compare-repair.classes"
    write_repair_list "$repair_list"
    if [[ -s "$repair_list" ]]; then
      before_repair_gotos="$(marker_direct_gotos)"
      before_repair_markers="$(marker_total_lines)"
      repair_backup="$work/simplify-not-compare-repair-backup"
      begin_repair_round_backup "$repair_backup"
      repair_out="$work/simplify-not-compare-repair"
      rm -rf "$repair_out"
      mkdir -p "$repair_out"
      : > "$logs/goto-simplify-not-compare-repair.log"
      while IFS= read -r rel; do
        [[ -n "$rel" && -f "$out/$rel" ]] || continue
        mkdir -p "$(dirname "$repair_out/$rel")"
        if ! JAVA_TOOLS_DIR="${JAVA_TOOLS_DIR:-/home/kreijstal/git/java-tools}" \
          node "${JAVA_TOOLS_DIR:-/home/kreijstal/git/java-tools}/scripts/jvm-cli.js" \
            simplify-not-compare "$out/$rel" --out "$repair_out/$rel" \
            >> "$logs/goto-simplify-not-compare-repair.log" 2>&1; then
          cp "$out/$rel" "$repair_out/$rel"
        fi
      done < "$repair_list"
      accept_repair_candidates "$repair_list" "$repair_out"
      rm -rf "$repair_out"
      if (( REPAIR_ACCEPTED > 0 )); then
        run_cfr_report
        after_repair_gotos="$(marker_direct_gotos)"
        after_repair_markers="$(marker_total_lines)"
        if (( after_repair_gotos > before_repair_gotos ||
          after_repair_markers >= before_repair_markers )); then
          restore_repair_round_backup "$repair_backup"
        else
          rm -rf "$repair_backup"
        fi
      else
        rm -rf "$repair_backup"
      fi
    fi
  fi

  if [[ "$GOTO_TERMINAL_TAIL_REPAIR_PHASE" == "1" ]]; then
    for ((round = 1; round <= GOTO_TERMINAL_TAIL_REPAIR_ROUNDS; round++)); do
      repair_list="$logs/goto-terminal-tail-repair-round-${round}.classes"
      write_repair_list "$repair_list"
      if [[ ! -s "$repair_list" ]]; then
        break
      fi
      before_repair_gotos="$(marker_direct_gotos)"
      before_repair_markers="$(marker_total_lines)"
      repair_backup="$work/terminal-tail-repair-round-${round}-backup"
      begin_repair_round_backup "$repair_backup"
      repair_out="$work/terminal-tail-repair-round-${round}"
      rm -rf "$repair_out"
      mkdir -p "$repair_out"
      : > "$logs/goto-terminal-tail-repair-round-${round}.log"
      terminal_tail_repair_failed=0
      while IFS= read -r rel; do
        [[ -n "$rel" && -f "$out/$rel" ]] || continue
        single_in="$work/terminal-tail-repair-round-${round}-in"
        single_out="$work/terminal-tail-repair-round-${round}-single"
        rm -rf "$single_in" "$single_out"
        mkdir -p "$(dirname "$single_in/$rel")" "$single_out"
        cp "$out/$rel" "$single_in/$rel"
        if ! JAVA_TOOLS_DIR="${JAVA_TOOLS_DIR:-/home/kreijstal/git/java-tools}" \
          PIPELINE_EXPERIMENTAL_PEEPHOLE_OPTIONS='{"cloneForwardTerminalGotoTails":true,"cloneForwardTerminalGotoTailMaxInsns":260,"cloneForwardTerminalGotoTailMaxClones":6,"cloneConditionalTerminalTails":true,"cloneConditionalTerminalTailMaxInsns":260,"cloneConditionalTerminalTailMaxClones":4}' \
          timeout "$PIPELINE_TIMEOUT_SECONDS" \
          node "$DEKOB_DIR/scripts/pipeline/bulk-pipeline.js" \
            "$single_in" "$single_out" --profile none --safe-bytecode \
            >> "$logs/goto-terminal-tail-repair-round-${round}.log" 2>&1; then
          echo "WARN: $game terminal-tail repair round $round failed or timed out on $rel after ${PIPELINE_TIMEOUT_SECONDS}s" >&2
          terminal_tail_repair_failed=1
          rm -rf "$single_in" "$single_out"
          break
        fi
        if [[ -f "$single_out/$rel" ]]; then
          mkdir -p "$(dirname "$repair_out/$rel")"
          cp "$single_out/$rel" "$repair_out/$rel"
        fi
        rm -rf "$single_in" "$single_out"
      done < "$repair_list"
      if (( terminal_tail_repair_failed != 0 )); then
        rm -rf "$repair_out"
        break
      fi
      accept_repair_candidates "$repair_list" "$repair_out"
      rm -rf "$repair_out"
      if (( REPAIR_ACCEPTED == 0 )); then
        rm -rf "$repair_backup"
        break
      fi
      run_cfr_report
      after_repair_gotos="$(marker_direct_gotos)"
      after_repair_markers="$(marker_total_lines)"
      if (( after_repair_gotos > before_repair_gotos ||
        after_repair_markers >= before_repair_markers )); then
        restore_repair_round_backup "$repair_backup"
        break
      fi
      rm -rf "$repair_backup"
    done
  fi

  if [[ "$GOTO_SOURCE_SCOPE_REPAIR_PHASE" == "1" ]]; then
    for ((round = 1; round <= GOTO_SOURCE_SCOPE_REPAIR_ROUNDS; round++)); do
      repair_list="$logs/goto-source-scope-repair-round-${round}.classes"
      write_repair_list "$repair_list"
      if [[ ! -s "$repair_list" ]]; then
        break
      fi
      before_repair_gotos="$(marker_direct_gotos)"
      before_repair_markers="$(marker_total_lines)"
      repair_backup="$work/source-scope-repair-round-${round}-backup"
      begin_repair_round_backup "$repair_backup"
      repair_out="$work/source-scope-repair-round-${round}"
      rm -rf "$repair_out"
      mkdir -p "$repair_out"
      : > "$logs/goto-source-scope-repair-round-${round}.log"
      source_repair_failed=0
      while IFS= read -r rel; do
        [[ -n "$rel" ]] || continue
        single_list="$logs/goto-source-scope-repair-round-${round}.$(basename "$rel" .class).classes"
        single_out="$work/source-scope-repair-round-${round}-single"
        printf '%s\n' "$rel" > "$single_list"
        rm -rf "$single_out"
        mkdir -p "$single_out"
        if ! JAVA_TOOLS_DIR="${JAVA_TOOLS_DIR:-/home/kreijstal/git/java-tools}" \
          BULK_PIPELINE_CLASS_LIST="$single_list" \
          BULK_PIPELINE_SCOPE_ANALYSIS_TO_SELECTED=1 \
          BULK_PIPELINE_SKIP_UNSELECTED_COPY=1 \
          timeout "$PIPELINE_TIMEOUT_SECONDS" \
          node "$DEKOB_DIR/scripts/pipeline/bulk-pipeline.js" \
            "$classes_dir" "$single_out" --profile none --safe-bytecode \
            >> "$logs/goto-source-scope-repair-round-${round}.log" 2>&1; then
          echo "WARN: $game source-scope repair round $round failed or timed out on $rel after ${PIPELINE_TIMEOUT_SECONDS}s" >&2
          source_repair_failed=1
          rm -rf "$single_out"
          break
        fi
        if [[ -f "$single_out/$rel" ]]; then
          mkdir -p "$(dirname "$repair_out/$rel")"
          cp "$single_out/$rel" "$repair_out/$rel"
        fi
        rm -rf "$single_out"
      done < "$repair_list"
      if (( source_repair_failed != 0 )); then
        rm -rf "$repair_out"
        break
      fi
      accept_repair_candidates "$repair_list" "$repair_out"
      rm -rf "$repair_out"
      if (( REPAIR_ACCEPTED == 0 )); then
        rm -rf "$repair_backup"
        break
      fi
      run_cfr_report
      after_repair_gotos="$(marker_direct_gotos)"
      after_repair_markers="$(marker_total_lines)"
      if (( after_repair_gotos > before_repair_gotos ||
        after_repair_markers >= before_repair_markers )); then
        restore_repair_round_backup "$repair_backup"
        break
      fi
      rm -rf "$repair_backup"
    done
  fi

  if [[ "$GOTO_ORACLE_REPAIR_PHASE" == "1" ]]; then
    for ((round = 1; round <= GOTO_ORACLE_REPAIR_ROUNDS; round++)); do
      repair_list="$logs/goto-oracle-repair-round-${round}.classes"
      write_repair_list "$repair_list"
      if [[ ! -s "$repair_list" ]]; then
        break
      fi
      before_repair_gotos="$(marker_direct_gotos)"
      before_repair_markers="$(marker_total_lines)"
      repair_backup="$work/oracle-repair-round-${round}-backup"
      begin_repair_round_backup "$repair_backup"
      repair_out="$work/oracle-repair-round-${round}"
      rm -rf "$repair_out"
      mkdir -p "$repair_out"
      if ! JAVA_TOOLS_DIR="${JAVA_TOOLS_DIR:-/home/kreijstal/git/java-tools}" \
        BULK_PIPELINE_CLASS_LIST="$repair_list" \
        BULK_PIPELINE_SCOPE_ANALYSIS_TO_SELECTED=1 \
        BULK_PIPELINE_SKIP_UNSELECTED_COPY=1 \
        BULK_PIPELINE_EARLY_CFR_ORACLE_DEFAULT_PASSES=1 \
        BULK_PIPELINE_EARLY_CFR_ORACLE_EXPERIMENTAL_PASSES=1 \
        timeout "$PIPELINE_TIMEOUT_SECONDS" \
        node "$DEKOB_DIR/scripts/pipeline/bulk-pipeline.js" \
          "$out" "$repair_out" --profile none --safe-bytecode \
          > "$logs/goto-oracle-repair-round-${round}.log" 2>&1; then
        echo "WARN: $game oracle repair round $round failed or timed out after ${PIPELINE_TIMEOUT_SECONDS}s" >&2
        rm -rf "$repair_out"
        break
      fi
      accept_repair_candidates "$repair_list" "$repair_out"
      rm -rf "$repair_out"
      if (( REPAIR_ACCEPTED == 0 )); then
        rm -rf "$repair_backup"
        break
      fi
      run_cfr_report
      after_repair_gotos="$(marker_direct_gotos)"
      after_repair_markers="$(marker_total_lines)"
      if (( after_repair_gotos > before_repair_gotos ||
        after_repair_markers >= before_repair_markers )); then
        restore_repair_round_backup "$repair_backup"
        break
      fi
      rm -rf "$repair_backup"
    done
  fi

  if [[ "$GOTO_GATES_OFF_REPAIR_PHASE" == "1" ]]; then
    for ((round = 1; round <= GOTO_GATES_OFF_REPAIR_ROUNDS; round++)); do
      repair_list="$logs/goto-gates-off-repair-round-${round}.classes"
      write_repair_list "$repair_list"
      if [[ ! -s "$repair_list" ]]; then
        break
      fi
      before_repair_gotos="$(marker_direct_gotos)"
      before_repair_markers="$(marker_total_lines)"
      repair_backup="$work/gates-off-repair-round-${round}-backup"
      begin_repair_round_backup "$repair_backup"
      repair_out="$work/gates-off-repair-round-${round}"
      rm -rf "$repair_out"
      mkdir -p "$repair_out"
      : > "$logs/goto-gates-off-repair-round-${round}.log"
      # Re-run each residual goto-bearing class from raw sources with the broad
      # structured-goto preserve/skip shape gates disabled. These gates trade
      # transform quality for speed and can false-match classes the full pipeline
      # decompiles far better; full analysis scope (no scope-to-selected) lets the
      # narrow/broad transforms use cross-class facts. Per-class isolation keeps a
      # slow class from stalling the round; the CFR oracle rejects any regression.
      while IFS= read -r rel; do
        [[ -n "$rel" ]] || continue
        single_list="$logs/goto-gates-off-repair-round-${round}.$(basename "$rel" .class).classes"
        single_out="$work/gates-off-repair-round-${round}-single"
        printf '%s\n' "$rel" > "$single_list"
        rm -rf "$single_out"
        mkdir -p "$single_out"
        if ! JAVA_TOOLS_DIR="${JAVA_TOOLS_DIR:-/home/kreijstal/git/java-tools}" \
          BULK_PIPELINE_CLASS_LIST="$single_list" \
          BULK_PIPELINE_SKIP_UNSELECTED_COPY=1 \
          BULK_PIPELINE_DISABLE_BROAD_PRESERVE_GATE=1 \
          BULK_PIPELINE_DISABLE_SKIP_BROAD_GATE=1 \
          timeout "$GOTO_GATES_OFF_TIMEOUT_SECONDS" \
          node "$DEKOB_DIR/scripts/pipeline/bulk-pipeline.js" \
            "$classes_dir" "$single_out" --profile none --safe-bytecode \
            >> "$logs/goto-gates-off-repair-round-${round}.log" 2>&1; then
          echo "WARN: $game gates-off repair round $round failed or timed out on $rel after ${GOTO_GATES_OFF_TIMEOUT_SECONDS}s" >&2
          rm -rf "$single_out"
          continue
        fi
        if [[ -f "$single_out/$rel" ]]; then
          mkdir -p "$(dirname "$repair_out/$rel")"
          cp "$single_out/$rel" "$repair_out/$rel"
        fi
        rm -rf "$single_out"
      done < "$repair_list"
      accept_repair_candidates "$repair_list" "$repair_out"
      rm -rf "$repair_out"
      if (( REPAIR_ACCEPTED == 0 )); then
        rm -rf "$repair_backup"
        break
      fi
      run_cfr_report
      after_repair_gotos="$(marker_direct_gotos)"
      after_repair_markers="$(marker_total_lines)"
      if (( after_repair_gotos > before_repair_gotos ||
        after_repair_markers >= before_repair_markers )); then
        restore_repair_round_backup "$repair_backup"
        break
      fi
      rm -rf "$repair_backup"
    done
  fi

  if [[ "$GOTO_ORACLE_SPLIT_REPAIR_PHASE" == "1" ]]; then
    repair_list="$logs/goto-oracle-split-repair.classes"
    write_repair_list "$repair_list"
    if [[ -s "$repair_list" ]]; then
      before_repair_gotos="$(marker_direct_gotos)"
      before_repair_markers="$(marker_total_lines)"
      repair_backup="$work/oracle-split-repair-backup"
      begin_repair_round_backup "$repair_backup"
      repair_out="$work/oracle-split-repair"
      rm -rf "$repair_out"
      mkdir -p "$repair_out"
      : > "$logs/goto-oracle-split-repair.log"
      # CFR-oracle-guided node splitting: greedily tail-duplicate joins/loop
      # guards, keeping only splits CFR confirms reduce markers. Slow (CFR in
      # the loop) so it runs last, only on whatever residuals survive the
      # cheaper phases. Every split is pure node duplication (semantics-safe).
      while IFS= read -r rel; do
        [[ -n "$rel" && -f "$out/$rel" ]] || continue
        mkdir -p "$(dirname "$repair_out/$rel")"
        if ! JAVA_TOOLS_DIR="${JAVA_TOOLS_DIR:-/home/kreijstal/git/java-tools}" \
          CFR_JAR="$DEKOB_DIR/lib/cfr.jar" \
          node "$DEKOB_DIR/scripts/goto-oracle-split.js" \
            "$out/$rel" "$repair_out/$rel" --max-iters "$GOTO_ORACLE_SPLIT_MAX_ITERS" \
            >> "$logs/goto-oracle-split-repair.log" 2>&1; then
          cp "$out/$rel" "$repair_out/$rel"
        fi
      done < "$repair_list"
      accept_repair_candidates "$repair_list" "$repair_out"
      rm -rf "$repair_out"
      if (( REPAIR_ACCEPTED > 0 )); then
        run_cfr_report
        after_repair_gotos="$(marker_direct_gotos)"
        after_repair_markers="$(marker_total_lines)"
        if (( after_repair_gotos > before_repair_gotos ||
          after_repair_markers >= before_repair_markers )); then
          restore_repair_round_backup "$repair_backup"
        else
          rm -rf "$repair_backup"
        fi
      else
        rm -rf "$repair_backup"
      fi
    fi
  fi

  gotos="$(grep -c '\*\* GOTO' "$logs/cfr-markers.txt" || true)"
  unable="$(grep -c 'Unable to fully structure code\|lbl-1000' "$logs/cfr-markers.txt" || true)"
  classes="$(cut -d: -f1 "$logs/cfr-markers.txt" | sort -u | wc -l)"
  printf '    gotos=%s unable=%s classes=%s\n' "$gotos" "$unable" "$classes"
done
