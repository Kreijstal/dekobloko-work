#!/usr/bin/env python3
import argparse
import html
import json
import re
import subprocess
import urllib.parse
import urllib.request
from pathlib import Path


API = "https://funorb.fandom.com/api.php"
USER_AGENT = "Mozilla/5.0"

GAMES = {
    "aceofskies": ("Ace of Skies", "Ace of Skies music"),
    "armiesofgielinor": ("Armies of Gielinor", "Armies of Gielinor music"),
    "chess": ("Chess", "Chess music"),
    "drphlogistonsavestheearth": ("Dr_P._Saves_the_Earth", "Dr P. Saves the Earth music"),
    "kickabout": ("Kickabout_League", "Kickabout League music"),
    "lexicominos": ("Lexicominos", "Lexicominos music"),
    "monkeypuzzle2": ("Monkey_Puzzle_2", "Monkey Puzzle 2 music"),
    "pool": ("Pool", "Pool music"),
    "shatteredplans": ("Shattered_Plans", "Shattered Plans music"),
    "solknight": ("Sol-Knight", "Sol-Knight music"),
    "stellarshard": ("Stellar_Shard", "Stellar Shard music"),
    "sumoblitz": ("Sumoblitz", "Sumoblitz music"),
    "terraphoenix": ("TerraPhoenix", "TerraPhoenix music"),
    "torchallenge": ("Tor_Challenge", "Tor Challenge music"),
    "voidhunters": ("Void_Hunters", "Void Hunters music"),
    "wizardrun": ("Wizard_Run", "Wizard Run music"),
}


def request_json(params):
    query = urllib.parse.urlencode({**params, "format": "json", "origin": "*"})
    req = urllib.request.Request(API + "?" + query, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(req, timeout=30) as response:
        return json.load(response)


def safe_name(value):
    return re.sub(r"[^A-Za-z0-9._-]+", "_", value).strip("_")


def category_files(category):
    data = request_json({
        "action": "query",
        "list": "categorymembers",
        "cmtitle": "Category:" + category,
        "cmlimit": "100",
    })
    return [
        member["title"]
        for member in data.get("query", {}).get("categorymembers", [])
        if member.get("title", "").startswith("File:") and member["title"].lower().endswith(".ogg")
    ]


def image_info(title):
    data = request_json({
        "action": "query",
        "titles": title,
        "prop": "imageinfo",
        "iiprop": "url|size|mime",
    })
    page = next(iter(data.get("query", {}).get("pages", {}).values()))
    return page.get("imageinfo", [{}])[0]


def page_tracks(page_slug):
    data = request_json({
        "action": "parse",
        "page": "Orb Downloads/Music/" + page_slug,
        "prop": "text",
    })
    html = data.get("parse", {}).get("text", {}).get("*", "")
    tracks = []
    for row in re.findall(r"<tr.*?</tr>", html, re.S):
        cells = re.findall(r"<td[^>]*>(.*?)</td>", row, re.S)
        if len(cells) < 6:
            continue
        title = re.sub(r"<[^>]+>", " ", cells[0])
        title = re.sub(r"\s+", " ", html_module_unescape(title)).strip()
        size = re.sub(r"<[^>]+>", " ", cells[3]).strip()
        length = re.sub(r"<[^>]+>", " ", cells[4]).strip()
        if re.fullmatch(r"\d+(?:\.\d+)?MB", size) and re.fullmatch(r"\d{2}:\d{2}", length):
            tracks.append({"title": title, "size": size, "length": length})
    return tracks


def html_module_unescape(value):
    return html.unescape(value)


def download_file(url, path, expected_size):
    if path.exists() and (expected_size is None or path.stat().st_size == expected_size):
        return False
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(req, timeout=90) as response:
        path.write_bytes(response.read())
    return True


def convert_wav(ogg, wav):
    if wav.exists() and wav.stat().st_mtime >= ogg.stat().st_mtime:
        return False
    subprocess.run(
        ["ffmpeg", "-y", "-hide_banner", "-loglevel", "error", "-i", str(ogg), str(wav)],
        check=True,
    )
    return True


def run_game(game, out_root):
    page_slug, category = GAMES[game]
    game_root = out_root / game / "music-orb-downloads"
    ogg_root = game_root / "ogg"
    wav_root = game_root / "wav"
    ogg_root.mkdir(parents=True, exist_ok=True)
    wav_root.mkdir(parents=True, exist_ok=True)

    entries = []
    for title in category_files(category):
        info = image_info(title)
        url = info.get("url")
        if not url:
            continue
        stem = safe_name(title.removeprefix("File:").removesuffix(".ogg"))
        ogg = ogg_root / f"{stem}.ogg"
        wav = wav_root / f"{stem}.wav"
        download_file(url, ogg, info.get("size"))
        convert_wav(ogg, wav)
        entries.append({
            "file": title,
            "ogg": str(ogg),
            "wav": str(wav),
            "size": info.get("size"),
            "url": url,
        })

    manifest = {
        "game": game,
        "page": "Orb Downloads/Music/" + page_slug,
        "category": category,
        "listed_tracks": page_tracks(page_slug),
        "downloaded_files": entries,
    }
    manifest_path = game_root / "manifest.json"
    manifest_path.write_text(json.dumps(manifest, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    return manifest


def main():
    parser = argparse.ArgumentParser(description="Download FunOrb Wiki Orb Downloads music OGGs and convert them to WAV.")
    parser.add_argument("--game", help="comma-separated game ids; defaults to all known fallback games")
    parser.add_argument("--out-root", type=Path, default=Path(".work/games"))
    args = parser.parse_args()

    games = args.game.split(",") if args.game else sorted(GAMES)
    for game in games:
        if game not in GAMES:
            raise SystemExit(f"unknown game: {game}")
        manifest = run_game(game, args.out_root)
        print(
            f"{game}: listed={len(manifest['listed_tracks'])} "
            f"downloaded={len(manifest['downloaded_files'])}"
        )


if __name__ == "__main__":
    main()
