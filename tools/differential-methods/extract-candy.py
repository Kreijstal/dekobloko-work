"""Extract the real Candy foreground; use the existing checked JS5 reader."""
import importlib.util, pathlib, sys, json, hashlib
here = pathlib.Path(__file__).parent
spec = importlib.util.spec_from_file_location('cache', here.parent / 'music/extract-dekobloko-music.py')
cache = importlib.util.module_from_spec(spec)
spec.loader.exec_module(cache)
root, out = map(pathlib.Path, sys.argv[1:])
cache.read_group = lambda unused, archive, group: (root / f'{archive}-{group}.bin').read_bytes()
for index in sorted(root.glob('255-*.bin')):
    archive = int(index.stem.split('-')[1])
    if archive == 255: continue
    idx = cache.parse_index(root, archive)
    group = idx['groups_by_hash'].get(cache.name_hash('sweets'))
    if not group: continue
    parts = cache.split_group(cache.decode_container(cache.read_group(root, archive, group['id'])), group['file_count'])
    for fid, data in zip(group['file_ids'], parts):
        if group['file_name_hashes'][fid] != cache.name_hash('sweets_foreground'): continue
        out.mkdir(parents=True, exist_ok=True)
        (out / 'candy.bin').write_bytes(data)
        evidence = dict(archive=archive, group=group, file=fid, name='sweets/sweets_foreground', bytes=len(data), sha256=hashlib.sha256(data).hexdigest())
        (out / 'input.json').write_text(json.dumps(evidence, indent=2))
        print(json.dumps(evidence))
        sys.exit(0)
raise SystemExit('Candy foreground not found: no substitute fixture permitted')
