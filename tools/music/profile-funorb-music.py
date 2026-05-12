#!/usr/bin/env python3
import argparse
import importlib.util
import json
import re
import subprocess
import sys
from collections import Counter, defaultdict
from pathlib import Path


def load_module(path, name):
    spec = importlib.util.spec_from_file_location(name, path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


TOOLS_DIR = Path(__file__).resolve().parent
RENDERER = load_module(TOOLS_DIR / "render-funorb-native.py", "funorb_native_renderer")
MUSIC = load_module(TOOLS_DIR / "extract-dekobloko-music.py", "funorb_music_extract")


CALL_RE = re.compile(r"\b(?P<class>[A-Za-z_$][\w$]*)\.a\s*\((?P<args>[^;\n]*\"[^;\n]*)\)")
METHOD_RE = re.compile(
    r"^\s*(?:(?:public|private|protected|static|final|synchronized)\s+)*"
    r"[\w\[\]<>]+\s+(?P<name>[A-Za-z_$][\w$]*)\s*\((?P<params>[^)]*)\)\s*\{",
    re.MULTILINE,
)
STRING_RE = re.compile(r'"((?:\\.|[^"\\])*)"')


def java_unescape(value):
    return bytes(value, "utf-8").decode("unicode_escape")


def split_args(args):
    parts = []
    current = []
    depth = 0
    in_string = False
    escape = False
    for ch in args:
        current.append(ch)
        if in_string:
            if escape:
                escape = False
            elif ch == "\\":
                escape = True
            elif ch == '"':
                in_string = False
            continue
        if ch == '"':
            in_string = True
        elif ch == "(":
            depth += 1
        elif ch == ")":
            depth -= 1
        elif ch == "," and depth == 0:
            parts.append("".join(current[:-1]).strip())
            current = []
    if current:
        parts.append("".join(current).strip())
    return parts


def read_java_sources(java_dir):
    sources = {}
    for path in sorted(java_dir.glob("*.java")):
        sources[path.name[:-5]] = path.read_text(encoding="utf-8", errors="replace")
    return sources


def source_strings(sources):
    values = []
    seen = set()
    for text in sources.values():
        for raw in STRING_RE.findall(text):
            value = java_unescape(raw)
            if value and value not in seen:
                seen.add(value)
                values.append(value)
    return values


def discover_loader_calls(sources):
    calls = []
    for source_name, text in sources.items():
        for match in CALL_RE.finditer(text):
            args = split_args(match.group("args"))
            strings = [java_unescape(s) for s in STRING_RE.findall(match.group("args"))]
            names = [s for s in strings if s]
            if not names:
                continue
            calls.append(
                {
                    "source": source_name,
                    "track_type": match.group("class"),
                    "args": args,
                    "strings": strings,
                    "names": names,
                }
            )
    calls.extend(discover_wrapper_loader_calls(sources))
    return calls


def matching_brace(text, open_pos):
    depth = 0
    in_string = False
    escape = False
    for pos in range(open_pos, len(text)):
        ch = text[pos]
        if in_string:
            if escape:
                escape = False
            elif ch == "\\":
                escape = True
            elif ch == '"':
                in_string = False
            continue
        if ch == '"':
            in_string = True
        elif ch == "{":
            depth += 1
        elif ch == "}":
            depth -= 1
            if depth == 0:
                return pos + 1
    return len(text)


def method_param_names(params):
    names = []
    for param in split_args(params):
        bits = param.strip().split()
        if bits:
            names.append(bits[-1].replace("[]", ""))
    return names


def discover_wrapper_loader_calls(sources):
    families = renderer_families()
    known_track_types = set(families)
    calls = []
    for source_name, text in sources.items():
        wrappers = []
        for method_match in METHOD_RE.finditer(text):
            body_start = method_match.end() - 1
            body_end = matching_brace(text, body_start)
            body = text[body_start:body_end]
            params = method_param_names(method_match.group("params"))
            string_params = {name for name in params if re.search(rf"\bString\s+{re.escape(name)}\b", method_match.group("params"))}
            if not string_params:
                continue
            for track_type in known_track_types:
                loader_match = re.search(rf"\b{re.escape(track_type)}\.a\s*\((?P<args>[^;]+)\)", body)
                if not loader_match:
                    continue
                args = split_args(loader_match.group("args"))
                if not any(arg in string_params for arg in args):
                    continue
                wrappers.append(
                    {
                        "method": method_match.group("name"),
                        "track_type": track_type,
                        "loader_args": args,
                    }
                )

        for wrapper in wrappers:
            for call_match in re.finditer(rf"(?:this\.)?{re.escape(wrapper['method'])}\s*\((?P<args>[^;\n]*\"[^;\n]*)\)", text):
                args = split_args(call_match.group("args"))
                strings = [java_unescape(s) for s in STRING_RE.findall(call_match.group("args"))]
                names = [s for s in strings if s]
                if not names:
                    continue
                calls.append(
                    {
                        "source": source_name,
                        "track_type": wrapper["track_type"],
                        "args": wrapper["loader_args"],
                        "strings": strings,
                        "names": names,
                    }
                )
    return calls


def renderer_families():
    families = {}
    for name, profile in RENDERER.PROFILES.items():
        families.setdefault(profile["track_type"], []).append((name, profile))
    return families


def score_candidates(calls):
    families = renderer_families()
    grouped = defaultdict(list)
    for call in calls:
        if call["track_type"] in families:
            grouped[call["track_type"]].append(call)

    candidates = []
    for track_type, track_calls in grouped.items():
        counts = Counter()
        first_seen = {}
        load_shapes = Counter()
        archive_exprs = Counter()
        for call in track_calls:
            name = call["names"][-1]
            if len(name) < 3:
                continue
            counts[name] += 1
            first_seen.setdefault(name, call)
            strings = call["strings"]
            args = call["args"]
            if len(args) >= 3:
                if strings[:2] == ["", name]:
                    load_shapes[f"{track_type}.a(archive10, \"\", name)"] += 1
                elif strings[:2] == [name, ""]:
                    load_shapes[f"{track_type}.a(archive10, name, \"\")"] += 1
                archive_exprs[args[0]] += 1
        tracks = [name for name, _ in counts.most_common()]
        if not tracks:
            continue
        best_family_name, family_profile = max(
            families[track_type],
            key=lambda item: len(set(item[1].get("tracks", [])) & set(tracks)),
        )
        candidates.append(
            {
                "track_type": track_type,
                "family": best_family_name,
                "score": len(tracks),
                "tracks": tracks,
                "load_shape": load_shapes.most_common(1)[0][0] if load_shapes else family_profile["track_load"],
                "archive_expr": archive_exprs.most_common(1)[0][0] if archive_exprs else None,
                "sources": sorted({first_seen[name]["source"] for name in tracks}),
            }
        )
    candidates.sort(key=lambda c: (c["score"], len(c["tracks"])), reverse=True)
    return candidates


def cache_archives(cache):
    indexes = []
    for path in cache.glob("main_file_cache.idx*"):
        suffix = path.name.removeprefix("main_file_cache.idx")
        if suffix.isdigit():
            indexes.append(int(suffix))
    return sorted(indexes)


def score_song_archives(cache, tracks, candidate_archives, preferred_archive):
    targets = {MUSIC.name_hash(track): track for track in tracks}
    scored = []
    existing = set(cache_archives(cache))
    for archive in sorted(set(candidate_archives) & existing):
        if archive == 255:
            continue
        try:
            index = MUSIC.parse_index(cache, archive)
        except Exception:
            continue
        hits = []
        for group in index["groups"].values():
            if group.get("name_hash") in targets:
                hits.append(("group", group["id"], targets[group["name_hash"]]))
            for file_id, file_hash in group.get("file_name_hashes", {}).items():
                if file_hash in targets:
                    hits.append(("file", group["id"], file_id, targets[file_hash]))
        if hits:
            scored.append({"archive": archive, "hits": hits, "score": len({hit[-1] for hit in hits})})
    scored.sort(key=lambda item: (item["score"], -abs(item["archive"] - preferred_archive)), reverse=True)
    return scored


def infer_archive_ids(sources, archive_expr, source_names):
    if not archive_expr:
        return []
    expr = archive_expr.strip()
    patterns = [re.escape(expr)]
    ids = []
    seen = set()
    search_sources = {name: sources[name] for name in source_names if name in sources} or sources
    for text in search_sources.values():
        for pattern in patterns:
            for match in re.finditer(pattern + r"\s*=\s*(?P<rhs>[^;]+);", text):
                rhs = match.group("rhs")
                for number in re.findall(r"(?<![\w.])-?\d+(?![\w.])", rhs):
                    value = int(number)
                    if 0 <= value <= 255 and value not in seen:
                        seen.add(value)
                        ids.append(value)
    return ids


def shifted_archives(template, song_archive):
    archives = template.get("archives", [7, 8, 9, 10])
    if len(archives) == 4 and archives[-1] != song_archive:
        delta = song_archive - archives[-1]
        return [archive + delta for archive in archives]
    return list(archives)


def valid_archive_layout(archives):
    return all(isinstance(archive, int) and 0 <= archive <= 255 for archive in archives)


def build_profile(game, candidate, cache, all_strings, sources):
    template = dict(RENDERER.PROFILES[candidate["family"]])
    template_archives = template.get("archives", [7, 8, 9, 10])
    inferred_archives = infer_archive_ids(sources, candidate.get("archive_expr"), candidate["sources"])
    candidate_archives = set(inferred_archives) if inferred_archives else (set(range(0, 21)) | {template_archives[-1]})
    preferred_archive = max(inferred_archives) if inferred_archives else template_archives[-1]
    candidate_scores = score_song_archives(cache, candidate["tracks"], candidate_archives, preferred_archive) if cache else []
    song_archive = candidate_scores[0]["archive"] if candidate_scores else template.get("archives", [7, 8, 9, 10])[-1]
    archive_scores = score_song_archives(cache, all_strings, {song_archive}, song_archive) if cache and all_strings else candidate_scores
    tracks = candidate["tracks"]
    if archive_scores:
        tracks = []
        seen = set()
        for hit in archive_scores[0]["hits"]:
            name = hit[-1]
            if name not in seen:
                seen.add(name)
                tracks.append(name)
    template["name"] = game
    template["tracks"] = tracks
    template["discover_archive10"] = False
    template["archives"] = shifted_archives(template, song_archive)
    if not valid_archive_layout(template["archives"]):
        template["_invalid"] = f"invalid shifted archive layout {template['archives']}"
    template["_discovery"] = {
        "family": candidate["family"],
        "track_type": candidate["track_type"],
        "score": candidate["score"],
        "sources": candidate["sources"],
        "archive_expr": candidate["archive_expr"],
        "inferred_archives": inferred_archives,
        "candidate_song_archive_scores": candidate_scores[:5],
        "song_archive_scores": archive_scores[:5],
    }
    return template


def run_validation(args, profile_path):
    out = args.validate_out or (args.work / "validation-output")
    work = args.work / "validation-renderer"
    cmd = [
        sys.executable,
        str(TOOLS_DIR / "render-funorb-native.py"),
        "--profile-file",
        str(profile_path),
        "--classes",
        str(args.classes),
        "--cache",
        str(args.cache),
        "--out",
        str(out),
        "--work",
        str(work),
        "--keep-source",
    ]
    subprocess.run(cmd, check=True)


def main():
    parser = argparse.ArgumentParser(description="Discover a FunOrb native music renderer profile from CFR Java.")
    parser.add_argument("--game", required=True)
    parser.add_argument("--java", type=Path, required=True, help="directory of CFR .java sources")
    parser.add_argument("--classes", type=Path, help="classes used for optional validation")
    parser.add_argument("--cache", type=Path, help="JS5 cache directory for archive-name validation")
    parser.add_argument("--out", type=Path, required=True, help="profile JSON output")
    parser.add_argument("--work", type=Path, default=Path(".work/music-profile"))
    parser.add_argument("--validate", action="store_true", help="compile and render with the generated profile")
    parser.add_argument("--validate-out", type=Path)
    parser.add_argument("--print-candidates", action="store_true")
    args = parser.parse_args()

    sources = read_java_sources(args.java)
    all_strings = source_strings(sources)
    calls = discover_loader_calls(sources)
    candidates = score_candidates(calls)
    if args.print_candidates:
        print(json.dumps(candidates, indent=2))
    if not candidates:
        raise SystemExit("no supported native-MIDI loader family found in CFR Java")

    profiles = [build_profile(args.game, candidate, args.cache, all_strings, sources) for candidate in candidates]
    valid_profiles = [profile for profile in profiles if "_invalid" not in profile]
    if not valid_profiles:
        raise SystemExit("no supported native-MIDI profile with a valid archive layout")
    profile = max(
        valid_profiles,
        key=lambda item: (
            item["_discovery"]["candidate_song_archive_scores"][0]["score"]
            if item["_discovery"]["candidate_song_archive_scores"]
            else 0,
            len(item["tracks"]),
            item["_discovery"]["score"],
        ),
    )
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(json.dumps(profile, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    print(f"wrote {args.out}")
    print(
        f"selected family={profile['_discovery']['family']} "
        f"track_type={profile['_discovery']['track_type']} "
        f"tracks={len(profile['tracks'])} archives={profile['archives']}"
    )

    if args.validate:
        if not args.classes or not args.cache:
            parser.error("--validate requires --classes and --cache")
        run_validation(args, args.out)


if __name__ == "__main__":
    main()
