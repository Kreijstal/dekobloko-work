"""Real archive-3 Vorbis setup and file 1, not an invented PCM waveform."""
import importlib.util, pathlib, sys, json, hashlib, struct
here=pathlib.Path(__file__).parent
spec=importlib.util.spec_from_file_location('cache',here.parent/'music/extract-dekobloko-music.py')
cache=importlib.util.module_from_spec(spec);spec.loader.exec_module(cache)
root,out=map(pathlib.Path,sys.argv[1:])
cache.read_group=lambda _,a,g:(root/f'{a}-{g}.bin').read_bytes()
group=cache.parse_index(root,3)['groups'][0]
parts=dict(zip(group['file_ids'],cache.split_group(cache.decode_container(cache.read_group(root,3,0)),group['file_count'])))
setup,sample=parts[0],parts[1]
packed=struct.pack('>I',len(setup))+setup+sample
out.mkdir(parents=True,exist_ok=True)
(out/'audio.bin').write_bytes(packed)
evidence={'archive':3,'group':0,'files':[0,1],'setupBytes':len(setup),'sampleBytes':len(sample),'sha256':hashlib.sha256(packed).hexdigest(),'scope':'one actual game sample; not a captured full mixer state or a proven transition dependency'}
(out/'input.json').write_text(json.dumps(evidence,indent=2));print(evidence)
